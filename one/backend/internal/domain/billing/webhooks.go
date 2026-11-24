package billing

import (
	"bytes"
	"context"
	"crypto"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

const stripeMaxSigAgeSeconds = 300

type PayPalSignatureVerifier interface {
	VerifyWebhookSignature(ctx context.Context, rawBody []byte, headers map[string]string, webhookID string) (bool, error)
}

func VerifyStripeWebhookSignature(rawBody []byte, sigHeader, secret string, now time.Time) bool {
	if len(rawBody) == 0 || strings.TrimSpace(sigHeader) == "" || strings.TrimSpace(secret) == "" {
		return false
	}
	var timestampStr string
	var v1Sigs []string
	for _, part := range strings.Split(sigHeader, ",") {
		kv := strings.SplitN(strings.TrimSpace(part), "=", 2)
		if len(kv) != 2 {
			continue
		}
		switch kv[0] {
		case "t":
			if timestampStr == "" {
				timestampStr = kv[1]
			}
		case "v1":
			v1Sigs = append(v1Sigs, kv[1])
		}
	}
	ts, err := strconv.ParseInt(timestampStr, 10, 64)
	if err != nil || ts <= 0 || len(v1Sigs) == 0 {
		return false
	}
	age := math.Abs(float64(now.Unix() - ts))
	if age > stripeMaxSigAgeSeconds {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestampStr + "."))
	mac.Write(rawBody)
	expected := hex.EncodeToString(mac.Sum(nil))
	for _, candidate := range v1Sigs {
		if hmac.Equal([]byte(expected), []byte(candidate)) {
			return true
		}
	}
	return false
}

func BuildAlipaySignString(params map[string]string, isVerify bool) string {
	keys := make([]string, 0, len(params))
	for k, v := range params {
		if k == "sign" || (isVerify && k == "sign_type") || v == "" {
			continue
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts, k+"="+params[k])
	}
	return strings.Join(parts, "&")
}

func VerifyAlipaySignature(params map[string]string, publicKeyPEM string) (bool, error) {
	if strings.TrimSpace(publicKeyPEM) == "" {
		return false, errors.New("ALIPAY_PUBLIC_KEY_MISSING")
	}
	signB64 := strings.ReplaceAll(strings.TrimSpace(params["sign"]), " ", "+")
	if signB64 == "" {
		return false, nil
	}
	sig, err := base64.StdEncoding.DecodeString(signB64)
	if err != nil {
		return false, nil
	}
	pub, err := parseRSAPublicKey(publicKeyPEM)
	if err != nil {
		return false, err
	}
	signStr := BuildAlipaySignString(params, true)
	sum := sha256.Sum256([]byte(signStr))
	return rsa.VerifyPKCS1v15(pub, crypto.SHA256, sum[:], sig) == nil, nil
}

func VerifyWechatV3Signature(timestamp, nonce string, rawBody []byte, sigB64, publicKeyPEM string) (bool, error) {
	if strings.TrimSpace(publicKeyPEM) == "" {
		return false, errors.New("WECHAT_PUBLIC_KEY_MISSING")
	}
	if strings.TrimSpace(sigB64) == "" {
		return false, nil
	}
	sig, err := base64.StdEncoding.DecodeString(strings.TrimSpace(sigB64))
	if err != nil {
		return false, nil
	}
	pub, err := parseRSAPublicKey(publicKeyPEM)
	if err != nil {
		return false, err
	}
	msg := timestamp + "\n" + nonce + "\n" + string(rawBody) + "\n"
	sum := sha256.Sum256([]byte(msg))
	return rsa.VerifyPKCS1v15(pub, crypto.SHA256, sum[:], sig) == nil, nil
}

type WechatEncryptedResource struct {
	Algorithm      string `json:"algorithm"`
	Ciphertext     string `json:"ciphertext"`
	Nonce          string `json:"nonce"`
	AssociatedData string `json:"associated_data"`
}

func DecryptWechatV3Resource(res WechatEncryptedResource, apiV3Key string) ([]byte, error) {
	if len(apiV3Key) != 32 {
		return nil, errors.New("WECHAT_API_V3_KEY must be 32 bytes")
	}
	ciphertext, err := base64.StdEncoding.DecodeString(res.Ciphertext)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher([]byte(apiV3Key))
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return gcm.Open(nil, []byte(res.Nonce), ciphertext, []byte(res.AssociatedData))
}

func parseRSAPublicKey(raw string) (*rsa.PublicKey, error) {
	clean := strings.ReplaceAll(strings.TrimSpace(raw), `\n`, "\n")
	if !strings.Contains(clean, "BEGIN ") {
		clean = "-----BEGIN PUBLIC KEY-----\n" + clean + "\n-----END PUBLIC KEY-----"
	}
	block, _ := pem.Decode([]byte(clean))
	if block == nil {
		return nil, errors.New("invalid PEM public key or certificate")
	}
	if strings.Contains(block.Type, "CERTIFICATE") {
		cert, err := x509.ParseCertificate(block.Bytes)
		if err != nil {
			return nil, err
		}
		pub, ok := cert.PublicKey.(*rsa.PublicKey)
		if !ok {
			return nil, errors.New("certificate does not contain RSA public key")
		}
		return pub, nil
	}
	if pubIface, err := x509.ParsePKIXPublicKey(block.Bytes); err == nil {
		if pub, ok := pubIface.(*rsa.PublicKey); ok {
			return pub, nil
		}
	}
	if pub, err := x509.ParsePKCS1PublicKey(block.Bytes); err == nil {
		return pub, nil
	}
	return nil, errors.New("unsupported RSA public key format")
}

type livePayPalVerifier struct {
	clientID     string
	clientSecret string
	mode         string
}

func (v *livePayPalVerifier) VerifyWebhookSignature(ctx context.Context, rawBody []byte, headers map[string]string, webhookID string) (bool, error) {
	if v.clientID == "" || v.clientSecret == "" || webhookID == "" {
		return false, errors.New("PAYPAL_CREDENTIALS_MISSING")
	}
	baseURL := "https://api-m.paypal.com"
	if strings.EqualFold(v.mode, "sandbox") {
		baseURL = "https://api-m.sandbox.paypal.com"
	}
	authBasic := base64.StdEncoding.EncodeToString([]byte(v.clientID + ":" + v.clientSecret))
	tokReq, _ := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/v1/oauth2/token", strings.NewReader("grant_type=client_credentials"))
	tokReq.Header.Set("Authorization", "Basic "+authBasic)
	tokReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	client := &http.Client{Timeout: 10 * time.Second}
	tokResp, err := client.Do(tokReq)
	if err != nil {
		return false, err
	}
	defer tokResp.Body.Close()
	if tokResp.StatusCode < 200 || tokResp.StatusCode >= 300 {
		return false, fmt.Errorf("paypal oauth HTTP %d", tokResp.StatusCode)
	}
	var tokBody struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(tokResp.Body).Decode(&tokBody); err != nil || tokBody.AccessToken == "" {
		return false, errors.New("paypal access token missing")
	}

	var eventObj any
	if err := json.Unmarshal(rawBody, &eventObj); err != nil {
		return false, err
	}
	verifyReqBody, _ := json.Marshal(map[string]any{
		"auth_algo":         headers["paypal-auth-algo"],
		"cert_url":          headers["paypal-cert-url"],
		"transmission_id":   headers["paypal-transmission-id"],
		"transmission_sig":  headers["paypal-transmission-sig"],
		"transmission_time": headers["paypal-transmission-time"],
		"webhook_id":        webhookID,
		"webhook_event":     eventObj,
	})
	vReq, _ := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/v1/notifications/verify-webhook-signature", bytes.NewReader(verifyReqBody))
	vReq.Header.Set("Authorization", "Bearer "+tokBody.AccessToken)
	vReq.Header.Set("Content-Type", "application/json")
	vResp, err := client.Do(vReq)
	if err != nil {
		return false, err
	}
	defer vResp.Body.Close()
	resBytes, _ := io.ReadAll(io.LimitReader(vResp.Body, 64*1024))
	var res struct {
		VerificationStatus string `json:"verification_status"`
	}
	_ = json.Unmarshal(resBytes, &res)
	return res.VerificationStatus == "SUCCESS", nil
}

func (s *Service) HandleStripeWebhook(ctx context.Context, rawBody []byte, sigHeader string) (*WebhookDispatchResult, error) {
	secret := strings.TrimSpace(s.Config.StripeWebhookSecret)
	if secret == "" {
		return nil, svcErr(http.StatusServiceUnavailable, "STRIPE_WEBHOOK_NOT_CONFIGURED", "Stripe webhook 尚未配置")
	}
	if !VerifyStripeWebhookSignature(rawBody, sigHeader, secret, s.now()) {
		return nil, svcErr(http.StatusBadRequest, "INVALID_STRIPE_SIGNATURE", "无效的 Stripe 签名")
	}
	var ev struct {
		ID   string `json:"id"`
		Type string `json:"type"`
		Data struct {
			Object map[string]any `json:"object"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rawBody, &ev); err != nil || ev.ID == "" {
		return nil, svcErr(http.StatusBadRequest, "INVALID_EVENT", "无效的事件数据")
	}
	in, eligible := stripeWebhookInput(ev.ID, ev.Type, ev.Data.Object)
	if !eligible {
		return &WebhookDispatchResult{Received: true, Action: "ignored_" + ev.Type, OrderID: in.OrderID}, nil
	}
	return s.dispatchWebhookToRepo(ctx, in)
}

func stripeWebhookInput(eventID, eventType string, obj map[string]any) (WebhookFulfillmentInput, bool) {
	meta, _ := obj["metadata"].(map[string]any)
	providerID := strFromAny(obj["id"])
	paymentID := strFromAny(obj["payment_intent"])
	in := WebhookFulfillmentInput{
		Provider: "stripe", EventID: eventID, EventType: eventType,
		OrderID: strFromAny(meta["order_id"]), ProviderOrderID: providerID,
		ProviderPaymentID:      firstStr(paymentID, providerID),
		ProviderSubscriptionID: strFromAny(obj["subscription"]),
		Currency:               strings.ToUpper(strFromAny(obj["currency"])), RawPayload: obj,
	}
	switch eventType {
	case "checkout.session.completed", "checkout.session.async_payment_succeeded":
		if strFromAny(obj["payment_status"]) != "paid" {
			return in, false
		}
		in.PaidAmountMinor = int64(toFloat(obj["amount_total"]))
	case "payment_intent.succeeded":
		in.ProviderOrderID = ""
		in.PaidAmountMinor = int64(toFloat(obj["amount_received"]))
	case "invoice.paid", "invoice.payment_succeeded":
		in.ProviderOrderID = ""
		in.PaidAmountMinor = int64(toFloat(obj["amount_paid"]))
	case "charge.refunded", "refund.updated":
		in.IsRefund = true
		in.OriginalPaymentID = paymentID
		in.ProviderPaymentID = providerID
		in.ProviderOrderID = ""
		if eventType == "charge.refunded" {
			if obj["refunded"] != true {
				return in, false
			}
			in.PaidAmountMinor = int64(toFloat(obj["amount_refunded"]))
		} else {
			if strFromAny(obj["status"]) != "succeeded" {
				return in, false
			}
			in.PaidAmountMinor = int64(toFloat(obj["amount"]))
		}
	default:
		return in, false
	}
	return in, in.PaidAmountMinor > 0 && in.Currency != ""
}

func (s *Service) HandleAlipayWebhook(ctx context.Context, rawBody []byte) (*WebhookDispatchResult, error) {
	if strings.TrimSpace(s.Config.AlipayPublicKey) == "" {
		return nil, svcErr(http.StatusServiceUnavailable, "ALIPAY_PROVIDER_NOT_CONFIGURED", "支付宝公钥未配置")
	}
	vals, err := url.ParseQuery(string(rawBody))
	if err != nil {
		return nil, svcErr(http.StatusBadRequest, "ALIPAY_WEBHOOK_UNREADABLE", "请求体解析失败")
	}
	params := make(map[string]string, len(vals))
	for k, v := range vals {
		if len(v) > 0 {
			params[k] = v[0]
		}
	}
	if params["sign"] == "" || params["app_id"] == "" {
		return nil, svcErr(http.StatusBadRequest, "ALIPAY_WEBHOOK_MALFORMED", "通知缺少 sign 或 app_id")
	}
	ok, err := VerifyAlipaySignature(params, s.Config.AlipayPublicKey)
	if err != nil {
		return nil, svcErr(http.StatusServiceUnavailable, "ALIPAY_KEY_INVALID", "支付宝验签配置异常")
	}
	if !ok {
		if s.Repo != nil {
			sum := sha256.Sum256(rawBody)
			_ = s.Repo.RecordRejectedWebhook(ctx, "alipay", "reject_"+hex.EncodeToString(sum[:16]), "alipay.notify_rejected", "ALIPAY_WEBHOOK_SIGNATURE_INVALID", nil, nil, s.now())
		}
		return nil, svcErr(http.StatusBadRequest, "ALIPAY_WEBHOOK_SIGNATURE_INVALID", "通知验签失败")
	}
	orderID := params["out_trade_no"]
	status := params["trade_status"]
	if orderID == "" || status == "" {
		return nil, svcErr(http.StatusBadRequest, "ALIPAY_WEBHOOK_ORDER_MISSING", "通知缺少订单号或状态")
	}
	isRefund := params["refund_fee"] != "" || status == "TRADE_CLOSED"
	isPaidStatus := status == "TRADE_SUCCESS" || status == "TRADE_FINISHED"
	if !isRefund && !isPaidStatus {
		return &WebhookDispatchResult{Received: true, Action: "ignored_" + strings.ToLower(status), OrderID: orderID}, nil
	}
	paidAmt := int64(math.Round(parseFloat(params["total_amount"]) * 100))
	rawMap := map[string]any{}
	for k, v := range params {
		if k != "sign" {
			rawMap[k] = v
		}
	}
	return s.dispatchWebhookToRepo(ctx, WebhookFulfillmentInput{
		Provider:          "alipay",
		EventID:           "ali_" + firstStr(params["notify_id"], params["trade_no"], orderID),
		EventType:         "alipay." + strings.ToLower(status),
		OrderID:           orderID,
		ProviderOrderID:   orderID,
		ProviderPaymentID: params["trade_no"],
		PaidAmountMinor:   paidAmt,
		Currency:          "CNY",
		IsRefund:          isRefund,
		RawPayload:        rawMap,
	})
}

func (s *Service) HandleWechatWebhook(ctx context.Context, rawBody []byte, headers map[string]string) (*WebhookDispatchResult, error) {
	sig := headers["wechatpay-signature"]
	ts := headers["wechatpay-timestamp"]
	nonce := headers["wechatpay-nonce"]
	if sig == "" || ts == "" || nonce == "" {
		return nil, svcErr(http.StatusBadRequest, "WECHAT_WEBHOOK_MALFORMED", "缺少微信签名头部")
	}
	if strings.TrimSpace(s.Config.WechatPublicKey) == "" || strings.TrimSpace(s.Config.WechatAPIV3Key) == "" {
		return nil, svcErr(http.StatusServiceUnavailable, "WECHAT_PROVIDER_NOT_CONFIGURED", "微信支付未配置")
	}
	ok, err := VerifyWechatV3Signature(ts, nonce, rawBody, sig, s.Config.WechatPublicKey)
	if err != nil {
		return nil, svcErr(http.StatusServiceUnavailable, "WECHAT_KEY_INVALID", "微信验签公钥异常")
	}
	if !ok {
		if s.Repo != nil {
			sum := sha256.Sum256(rawBody)
			_ = s.Repo.RecordRejectedWebhook(ctx, "wechat", "reject_"+hex.EncodeToString(sum[:16]), "wechatpay.notify_rejected", "WECHAT_WEBHOOK_SIGNATURE_INVALID", nil, headers, s.now())
		}
		return nil, svcErr(http.StatusBadRequest, "WECHAT_WEBHOOK_SIGNATURE_INVALID", "微信通知验签失败")
	}
	var env struct {
		ID        string                  `json:"id"`
		EventType string                  `json:"event_type"`
		Resource  WechatEncryptedResource `json:"resource"`
	}
	if err := json.Unmarshal(rawBody, &env); err != nil {
		return nil, svcErr(http.StatusBadRequest, "WECHAT_WEBHOOK_MALFORMED", "微信通知 JSON 格式无效")
	}
	plain, err := DecryptWechatV3Resource(env.Resource, s.Config.WechatAPIV3Key)
	if err != nil {
		return nil, svcErr(http.StatusBadRequest, "WECHAT_DECRYPT_FAILED", "微信通知解密失败")
	}
	var dec map[string]any
	if err := json.Unmarshal(plain, &dec); err != nil {
		return nil, svcErr(http.StatusBadRequest, "WECHAT_DECRYPT_INVALID", "解密载荷无效")
	}
	orderID, _ := dec["out_trade_no"].(string)
	txID, _ := dec["transaction_id"].(string)
	tradeState, _ := dec["trade_state"].(string)
	amtObj, _ := dec["amount"].(map[string]any)
	paidAmt := int64(toFloat(amtObj["total"]))
	isRefund := strings.HasPrefix(env.EventType, "REFUND.")
	if !isRefund && (env.EventType != "TRANSACTION.SUCCESS" || (tradeState != "" && tradeState != "SUCCESS")) {
		return &WebhookDispatchResult{Received: true, Action: "ignored_" + strings.ToLower(env.EventType), OrderID: orderID}, nil
	}
	return s.dispatchWebhookToRepo(ctx, WebhookFulfillmentInput{
		Provider:          "wechat",
		EventID:           "wx_" + firstStr(env.ID, txID, orderID),
		EventType:         env.EventType,
		OrderID:           orderID,
		ProviderOrderID:   orderID,
		ProviderPaymentID: txID,
		PaidAmountMinor:   paidAmt,
		Currency:          "CNY",
		IsRefund:          isRefund,
		RawPayload:        dec,
		Headers:           headers,
	})
}

// HandlePayPalWebhook ALWAYS enforces cryptographic signature verification and FAILS CLOSED
// in production (or whenever verification cannot run) if PAYPAL_WEBHOOK_ID is missing.
func (s *Service) HandlePayPalWebhook(ctx context.Context, rawBody []byte, headers map[string]string) (*WebhookDispatchResult, error) {
	webhookID := strings.TrimSpace(s.Config.PayPalWebhookID)
	if webhookID == "" {
		// Fail closed! Never skip signature verification when PAYPAL_WEBHOOK_ID is missing.
		return nil, svcErr(http.StatusServiceUnavailable, "PAYPAL_WEBHOOK_ID_MISSING", "PayPal Webhook ID 未配置，拒绝处理通知")
	}
	requiredHeaders := []string{
		"paypal-auth-algo",
		"paypal-cert-url",
		"paypal-transmission-id",
		"paypal-transmission-sig",
		"paypal-transmission-time",
	}
	for _, h := range requiredHeaders {
		if strings.TrimSpace(headers[h]) == "" {
			return nil, svcErr(http.StatusBadRequest, "PAYPAL_WEBHOOK_SIGNATURE_MISSING", "缺少 PayPal 验签请求头")
		}
	}

	verifier := s.PayPalVerifier
	if verifier == nil {
		if s.Config.PayPalClientID == "" || s.Config.PayPalClientSecret == "" {
			return nil, svcErr(http.StatusServiceUnavailable, "PAYPAL_PROVIDER_NOT_CONFIGURED", "PayPal 商户凭证未配置")
		}
		verifier = &livePayPalVerifier{
			clientID:     s.Config.PayPalClientID,
			clientSecret: s.Config.PayPalClientSecret,
			mode:         s.Config.PayPalMode,
		}
	}
	ok, err := verifier.VerifyWebhookSignature(ctx, rawBody, headers, webhookID)
	if err != nil {
		return nil, svcErr(http.StatusServiceUnavailable, "PAYPAL_VERIFY_ERROR", "PayPal 验签服务不可用")
	}
	if !ok {
		if s.Repo != nil {
			sum := sha256.Sum256(rawBody)
			_ = s.Repo.RecordRejectedWebhook(ctx, "paypal", "reject_"+hex.EncodeToString(sum[:16]), "paypal.notify_rejected", "PAYPAL_WEBHOOK_SIGNATURE_INVALID", nil, headers, s.now())
		}
		return nil, svcErr(http.StatusBadRequest, "PAYPAL_WEBHOOK_SIGNATURE_INVALID", "PayPal 签名验证失败")
	}

	var ev struct {
		ID        string         `json:"id"`
		EventType string         `json:"event_type"`
		Resource  map[string]any `json:"resource"`
	}
	if err := json.Unmarshal(rawBody, &ev); err != nil {
		return nil, svcErr(http.StatusBadRequest, "PAYPAL_WEBHOOK_MALFORMED", "PayPal 通知格式无效")
	}
	orderID := extractPayPalOrderID(ev.Resource)
	captureID, _ := ev.Resource["id"].(string)
	evType := strings.ToUpper(ev.EventType)
	isRefund := evType == "PAYMENT.CAPTURE.REFUNDED" || evType == "PAYMENT.CAPTURE.REVERSED"
	isPaid := evType == "PAYMENT.CAPTURE.COMPLETED" || evType == "CHECKOUT.ORDER.COMPLETED"
	if !isRefund && !isPaid {
		return &WebhookDispatchResult{Received: true, Action: "ignored_" + strings.ToLower(evType), OrderID: orderID}, nil
	}
	var paidAmt int64
	if amtObj, ok := ev.Resource["amount"].(map[string]any); ok {
		if vStr, ok := amtObj["value"].(string); ok {
			paidAmt = int64(math.Round(parseFloat(vStr) * 100))
		}
	}
	return s.dispatchWebhookToRepo(ctx, WebhookFulfillmentInput{
		Provider:          "paypal",
		EventID:           firstStr(ev.ID, "pp_"+captureID),
		EventType:         evType,
		OrderID:           orderID,
		ProviderOrderID:   orderID,
		ProviderPaymentID: captureID,
		PaidAmountMinor:   paidAmt,
		Currency:          "USD",
		IsRefund:          isRefund,
		RawPayload:        ev.Resource,
		Headers:           headers,
	})
}

func extractPayPalOrderID(resource map[string]any) string {
	if resource == nil {
		return ""
	}
	if cid, ok := resource["custom_id"].(string); ok && cid != "" {
		var meta map[string]any
		if json.Unmarshal([]byte(cid), &meta) == nil {
			if oid, ok := meta["order_id"].(string); ok && oid != "" {
				return oid
			}
		}
	}
	if pus, ok := resource["purchase_units"].([]any); ok && len(pus) > 0 {
		if pu, ok := pus[0].(map[string]any); ok {
			if ref, ok := pu["reference_id"].(string); ok && ref != "" {
				return ref
			}
		}
	}
	if inv, ok := resource["invoice_id"].(string); ok {
		return inv
	}
	return ""
}

func (s *Service) dispatchWebhookToRepo(ctx context.Context, in WebhookFulfillmentInput) (*WebhookDispatchResult, error) {
	if s.Repo == nil {
		return &WebhookDispatchResult{Received: true, Action: "accepted_no_repo", OrderID: in.OrderID}, nil
	}
	claimed, err := s.Repo.ClaimWebhookEvent(ctx, in.Provider, in.EventID, in.EventType, in.RawPayload, in.Headers, s.now())
	if err != nil {
		return nil, err
	}
	if !claimed {
		return &WebhookDispatchResult{Received: true, Action: "duplicate_ignored", Duplicate: true, OrderID: in.OrderID}, nil
	}
	res, err := s.Repo.ApplyPaymentWebhook(ctx, in, s.now())
	if err != nil {
		_ = s.Repo.MarkWebhookFailed(ctx, in.Provider, in.EventID, err.Error(), s.now())
		return nil, err
	}
	_ = s.Repo.MarkWebhookProcessed(ctx, in.Provider, in.EventID, s.now())
	res.Received = true
	return res, nil
}

func toFloat(v any) float64 {
	switch t := v.(type) {
	case float64:
		return t
	case int64:
		return float64(t)
	case int:
		return float64(t)
	default:
		return 0
	}
}

func parseFloat(s string) float64 {
	v, _ := strconv.ParseFloat(strings.TrimSpace(s), 64)
	return v
}

func firstStr(vals ...string) string {
	for _, v := range vals {
		if t := strings.TrimSpace(v); t != "" {
			return t
		}
	}
	return ""
}

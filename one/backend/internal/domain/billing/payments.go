package billing

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
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
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"one/backend/internal/config"
	"one/backend/internal/outbound"
	"one/backend/internal/pkg/seckey"
)

type GatewayCheckoutRequest struct {
	Order        Order
	UserEmail    string
	PlanName     string
	CreditAmount int64
	SuccessURL   string
	CancelURL    string
	NotifyURL    string
}

type GatewayCheckoutResponse struct {
	ProviderOrderID string
	CheckoutURL     string
	QRCode          string
}

type GatewayRefundRequest struct {
	Order           Order
	ProviderPayment string
	Reason          string
	IdempotencyKey  string
}

type GatewayRefundResponse struct {
	ExternalRefundID string
	Status           string
}

type GatewayOrderStatus struct {
	Status            string // paid | pending | closed | failed
	ProviderOrderID   string
	ProviderPaymentID string
	PaidAmountMinor   int64
	Currency          string
	RawPayload        map[string]any
}

type OrderStatusQuerier interface {
	QueryOrderStatus(ctx context.Context, order Order, providerPaymentID string) (*GatewayOrderStatus, error)
}

type PaymentGateway interface {
	CreateCheckout(ctx context.Context, req GatewayCheckoutRequest) (*GatewayCheckoutResponse, error)
	Refund(ctx context.Context, req GatewayRefundRequest) (*GatewayRefundResponse, error)
}

type HTTPGateway struct {
	Config           config.Config
	Pool             *pgxpool.Pool
	Client           *http.Client
	StripeBaseURL    string
	AlipayGatewayURL string
	WechatBaseURL    string
	PayPalBaseURL    string
}

func NewHTTPGateway(cfg config.Config, pool *pgxpool.Pool, client *http.Client) *HTTPGateway {
	if client == nil {
		client = outbound.NewSafeHTTPClient(15*time.Second, cfg.AllowedPrivateHosts...)
	}
	ppBase := "https://api-m.paypal.com"
	if strings.EqualFold(cfg.PayPalMode, "sandbox") {
		ppBase = "https://api-m.sandbox.paypal.com"
	}
	return &HTTPGateway{
		Config:           cfg,
		Pool:             pool,
		Client:           client,
		StripeBaseURL:    "https://api.stripe.com",
		AlipayGatewayURL: "https://openapi.alipay.com/gateway.do",
		WechatBaseURL:    "https://api.mch.weixin.qq.com",
		PayPalBaseURL:    ppBase,
	}
}

func (g *HTTPGateway) httpClient() *http.Client {
	if g != nil && g.Client != nil {
		return g.Client
	}
	return outbound.NewSafeHTTPClient(15*time.Second, g.Config.AllowedPrivateHosts...)
}

func (g *HTTPGateway) readSecret(ctx context.Context, provider, keyName, fallback string) string {
	if g != nil && g.Pool != nil {
		if v, err := seckey.ReadProviderSecret(ctx, g.Pool.QueryRow, g.Config.ProviderSecretKey(), provider, keyName); err == nil && strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return strings.TrimSpace(fallback)
}

func (g *HTTPGateway) CreateCheckout(ctx context.Context, req GatewayCheckoutRequest) (*GatewayCheckoutResponse, error) {
	switch strings.ToLower(strings.TrimSpace(req.Order.Provider)) {
	case "stripe":
		return g.stripeCreateCheckout(ctx, req)
	case "alipay":
		return g.alipayCreateCheckout(ctx, req)
	case "wechat":
		return g.wechatCreateCheckout(ctx, req)
	case "paypal":
		return g.paypalCreateCheckout(ctx, req)
	default:
		return nil, svcErr(http.StatusBadRequest, "UNSUPPORTED_PROVIDER", "不支持的支付渠道")
	}
}

func (g *HTTPGateway) Refund(ctx context.Context, req GatewayRefundRequest) (*GatewayRefundResponse, error) {
	switch strings.ToLower(strings.TrimSpace(req.Order.Provider)) {
	case "stripe":
		return g.stripeRefund(ctx, req)
	case "alipay":
		return g.alipayRefund(ctx, req)
	case "wechat":
		return g.wechatRefund(ctx, req)
	case "paypal":
		return g.paypalRefund(ctx, req)
	default:
		return nil, svcErr(http.StatusBadRequest, "UNSUPPORTED_PROVIDER", "不支持该支付渠道的原路退款")
	}
}

func (g *HTTPGateway) stripeCreateCheckout(ctx context.Context, req GatewayCheckoutRequest) (*GatewayCheckoutResponse, error) {
	secret := g.readSecret(ctx, "stripe", "secret_key", g.Config.StripeSecretKey)
	if secret == "" {
		return nil, svcErr(http.StatusServiceUnavailable, "PAYMENT_PROVIDER_NOT_CONFIGURED", "Stripe 尚未配置商户密钥")
	}
	mode := "subscription"
	isSub := req.Order.ProductType == "" || req.Order.ProductType == "subscription"
	if !isSub {
		mode = "payment"
	}
	form := url.Values{}
	form.Set("mode", mode)
	form.Set("success_url", req.SuccessURL)
	form.Set("cancel_url", req.CancelURL)
	if req.UserEmail != "" {
		form.Set("customer_email", req.UserEmail)
	}
	form.Set("line_items[0][quantity]", "1")
	form.Set("line_items[0][price_data][currency]", strings.ToLower(firstStr(req.Order.Currency, "USD")))
	form.Set("line_items[0][price_data][unit_amount]", strconv.FormatInt(req.Order.AmountCent, 10))
	form.Set("line_items[0][price_data][product_data][name]", fmt.Sprintf("%s (%s)", firstStr(req.PlanName, req.Order.PlanID), firstStr(req.Order.BillingCycle, "monthly")))
	if isSub {
		switch req.Order.BillingCycle {
		case "yearly":
			form.Set("line_items[0][price_data][recurring][interval]", "year")
		case "quarterly":
			form.Set("line_items[0][price_data][recurring][interval]", "month")
			form.Set("line_items[0][price_data][recurring][interval_count]", "3")
		default:
			form.Set("line_items[0][price_data][recurring][interval]", "month")
		}
		form.Set("subscription_data[metadata][order_id]", req.Order.ID)
		form.Set("subscription_data[metadata][user_id]", req.Order.UserID)
		form.Set("subscription_data[metadata][plan_id]", req.Order.PlanID)
	} else {
		form.Set("payment_intent_data[metadata][order_id]", req.Order.ID)
		form.Set("payment_intent_data[metadata][user_id]", req.Order.UserID)
		form.Set("payment_intent_data[metadata][plan_id]", req.Order.PlanID)
	}
	form.Set("metadata[order_id]", req.Order.ID)
	form.Set("metadata[user_id]", req.Order.UserID)
	form.Set("metadata[plan_id]", req.Order.PlanID)
	form.Set("metadata[product_type]", firstStr(req.Order.ProductType, "subscription"))
	form.Set("metadata[billing_cycle]", firstStr(req.Order.BillingCycle, "monthly"))
	form.Set("metadata[credit_amount]", strconv.FormatInt(req.CreditAmount, 10))

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(g.StripeBaseURL, "/")+"/v1/checkout/sessions", strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Authorization", "Bearer "+secret)
	httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	httpReq.Header.Set("Idempotency-Key", "checkout:"+req.Order.ID)

	resp, err := g.httpClient().Do(httpReq)
	if err != nil {
		return nil, svcErr(http.StatusBadGateway, "STRIPE_REQUEST_FAILED", err.Error())
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 512*1024))
	var out struct {
		ID    string `json:"id"`
		URL   string `json:"url"`
		Error *struct {
			Message string `json:"message"`
			Code    string `json:"code"`
		} `json:"error"`
	}
	_ = json.Unmarshal(body, &out)
	if resp.StatusCode >= 400 || out.URL == "" {
		msg := "Stripe 创建支付会话失败"
		if out.Error != nil && out.Error.Message != "" {
			msg = out.Error.Message
		}
		return nil, svcErr(http.StatusBadGateway, "STRIPE_CHECKOUT_FAILED", msg)
	}
	return &GatewayCheckoutResponse{ProviderOrderID: out.ID, CheckoutURL: out.URL}, nil
}

func (g *HTTPGateway) stripeRefund(ctx context.Context, req GatewayRefundRequest) (*GatewayRefundResponse, error) {
	secret := g.readSecret(ctx, "stripe", "secret_key", g.Config.StripeSecretKey)
	if secret == "" {
		return nil, svcErr(http.StatusServiceUnavailable, "PAYMENT_PROVIDER_NOT_CONFIGURED", "Stripe 尚未配置商户密钥")
	}
	pi := firstStr(req.ProviderPayment, req.Order.ProviderOrderID)
	if pi == "" {
		return nil, svcErr(http.StatusBadRequest, "REFUND_MISSING_PAYMENT_ID", "Stripe 订单缺少 payment_intent 标识")
	}
	form := url.Values{}
	form.Set("payment_intent", pi)
	form.Set("metadata[order_id]", req.Order.ID)
	if req.Reason != "" {
		form.Set("metadata[reason]", req.Reason)
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(g.StripeBaseURL, "/")+"/v1/refunds", strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Authorization", "Bearer "+secret)
	httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	httpReq.Header.Set("Idempotency-Key", firstStr(req.IdempotencyKey, "refund:"+req.Order.ID))

	resp, err := g.httpClient().Do(httpReq)
	if err != nil {
		return nil, svcErr(http.StatusBadGateway, "STRIPE_REFUND_FAILED", err.Error())
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 256*1024))
	var out struct {
		ID     string `json:"id"`
		Status string `json:"status"`
		Error  *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	_ = json.Unmarshal(body, &out)
	if resp.StatusCode >= 400 || out.ID == "" {
		msg := "Stripe 退款请求失败"
		if out.Error != nil && out.Error.Message != "" {
			msg = out.Error.Message
		}
		return nil, svcErr(http.StatusBadGateway, "STRIPE_REFUND_FAILED", msg)
	}
	return &GatewayRefundResponse{ExternalRefundID: out.ID, Status: out.Status}, nil
}

func (g *HTTPGateway) alipayCreds(ctx context.Context) (appID, privKey, notifyURL string, err error) {
	appID = g.readSecret(ctx, "alipay", "app_id", g.Config.AlipayAppID)
	privKey = g.readSecret(ctx, "alipay", "private_key", g.Config.AlipayPrivateKey)
	notifyURL = firstStr(os.Getenv("ALIPAY_NOTIFY_URL"), strings.TrimRight(g.Config.PublicAppURL, "/")+"/api/billing/webhooks/alipay")
	if appID == "" || privKey == "" {
		return "", "", "", svcErr(http.StatusServiceUnavailable, "PAYMENT_PROVIDER_NOT_CONFIGURED", "支付宝支付尚未完成配置")
	}
	return appID, privKey, notifyURL, nil
}

func (g *HTTPGateway) callAlipayGateway(ctx context.Context, appID, privKey, method, notifyURL, returnURL string, bizObj map[string]any) (map[string]any, error) {
	bizJSON, _ := json.Marshal(bizObj)
	params := map[string]string{
		"app_id":      appID,
		"method":      method,
		"format":      "JSON",
		"charset":     "utf-8",
		"sign_type":   "RSA2",
		"timestamp":   time.Now().UTC().Format("2006-01-02 15:04:05"),
		"version":     "1.0",
		"biz_content": string(bizJSON),
	}
	if notifyURL != "" {
		params["notify_url"] = notifyURL
	}
	if returnURL != "" {
		params["return_url"] = returnURL
	}
	sig, err := signAlipayRSA2(params, privKey)
	if err != nil {
		return nil, svcErr(http.StatusServiceUnavailable, "ALIPAY_KEY_INVALID", err.Error())
	}
	params["sign"] = sig

	form := url.Values{}
	for k, v := range params {
		form.Set(k, v)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, g.AlipayGatewayURL, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded;charset=utf-8")
	resp, err := g.httpClient().Do(req)
	if err != nil {
		return nil, svcErr(http.StatusBadGateway, "ALIPAY_REQUEST_FAILED", err.Error())
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 512*1024))
	var outer map[string]any
	if json.Unmarshal(body, &outer) != nil {
		return nil, svcErr(http.StatusBadGateway, "ALIPAY_INVALID_RESPONSE", "支付宝响应解析失败")
	}
	respKey := strings.ReplaceAll(method, ".", "_") + "_response"
	inner, _ := outer[respKey].(map[string]any)
	if inner == nil || inner["code"] != "10000" {
		msg := "支付宝请求失败"
		if inner != nil {
			msg = firstStr(strFromAny(inner["sub_msg"]), strFromAny(inner["msg"]), msg)
		}
		return nil, svcErr(http.StatusBadGateway, "ALIPAY_API_ERROR", msg)
	}
	return inner, nil
}

func (g *HTTPGateway) alipayCreateCheckout(ctx context.Context, req GatewayCheckoutRequest) (*GatewayCheckoutResponse, error) {
	appID, privKey, notifyURL, err := g.alipayCreds(ctx)
	if err != nil {
		return nil, err
	}
	yuan := fmt.Sprintf("%.2f", float64(req.Order.AmountCent)/100.0)
	subject := fmt.Sprintf("SupDance AI - %s", firstStr(req.PlanName, req.Order.PlanID))
	if len(subject) > 100 {
		subject = subject[:100]
	}
	biz := map[string]any{
		"out_trade_no":    req.Order.ID,
		"total_amount":    yuan,
		"subject":         subject,
		"timeout_express": "30m",
	}
	inner, err := g.callAlipayGateway(ctx, appID, privKey, "alipay.trade.precreate", firstStr(req.NotifyURL, notifyURL), req.SuccessURL, biz)
	if err != nil {
		return nil, err
	}
	qr := strFromAny(inner["qr_code"])
	return &GatewayCheckoutResponse{
		ProviderOrderID: req.Order.ID,
		CheckoutURL:     qr,
		QRCode:          qr,
	}, nil
}

func (g *HTTPGateway) alipayRefund(ctx context.Context, req GatewayRefundRequest) (*GatewayRefundResponse, error) {
	appID, privKey, _, err := g.alipayCreds(ctx)
	if err != nil {
		return nil, err
	}
	yuan := fmt.Sprintf("%.2f", float64(req.Order.AmountCent)/100.0)
	biz := map[string]any{
		"out_trade_no":  req.Order.ID,
		"refund_amount": yuan,
		"refund_reason": firstStr(req.Reason, "正常退款"),
	}
	inner, err := g.callAlipayGateway(ctx, appID, privKey, "alipay.trade.refund", "", "", biz)
	if err != nil {
		return nil, err
	}
	return &GatewayRefundResponse{
		ExternalRefundID: firstStr(strFromAny(inner["trade_no"]), req.Order.ID),
		Status:           "succeeded",
	}, nil
}

func (g *HTTPGateway) wechatCreds(ctx context.Context) (appID, mchID, serialNo, privKey, notifyURL string, err error) {
	appID = g.readSecret(ctx, "wechat", "app_id", g.Config.WechatAppID)
	mchID = g.readSecret(ctx, "wechat", "mch_id", g.Config.WechatMchID)
	serialNo = g.readSecret(ctx, "wechat", "serial_no", g.Config.WechatSerialNo)
	privKey = g.readSecret(ctx, "wechat", "private_key", g.Config.WechatPrivateKey)
	notifyURL = firstStr(os.Getenv("WECHAT_NOTIFY_URL"), strings.TrimRight(g.Config.PublicAppURL, "/")+"/api/billing/webhooks/wechat")
	if appID == "" || mchID == "" || serialNo == "" || privKey == "" {
		return "", "", "", "", "", svcErr(http.StatusServiceUnavailable, "PAYMENT_PROVIDER_NOT_CONFIGURED", "微信支付尚未完成配置")
	}
	return appID, mchID, serialNo, privKey, notifyURL, nil
}

func (g *HTTPGateway) wechatCreateCheckout(ctx context.Context, req GatewayCheckoutRequest) (*GatewayCheckoutResponse, error) {
	appID, mchID, serialNo, privKey, notifyURL, err := g.wechatCreds(ctx)
	if err != nil {
		return nil, err
	}
	const urlPath = "/v3/pay/transactions/native"
	desc := fmt.Sprintf("SupDance AI - %s", firstStr(req.PlanName, req.Order.PlanID))
	if len(desc) > 120 {
		desc = desc[:120]
	}
	amt := req.Order.AmountCent
	if amt < 1 {
		amt = 1
	}
	payload, _ := json.Marshal(map[string]any{
		"appid":        appID,
		"mchid":        mchID,
		"description":  desc,
		"out_trade_no": req.Order.ID,
		"notify_url":   firstStr(req.NotifyURL, notifyURL),
		"amount":       map[string]any{"total": amt, "currency": "CNY"},
	})
	authHdr, err := buildWechatV3Header("POST", urlPath, string(payload), mchID, serialNo, privKey)
	if err != nil {
		return nil, svcErr(http.StatusServiceUnavailable, "WECHAT_KEY_INVALID", err.Error())
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(g.WechatBaseURL, "/")+urlPath, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("Authorization", authHdr)

	resp, err := g.httpClient().Do(httpReq)
	if err != nil {
		return nil, svcErr(http.StatusBadGateway, "WECHAT_REQUEST_FAILED", err.Error())
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 256*1024))
	var out struct {
		CodeURL string `json:"code_url"`
		Message string `json:"message"`
	}
	_ = json.Unmarshal(body, &out)
	if resp.StatusCode >= 400 || out.CodeURL == "" {
		return nil, svcErr(http.StatusBadGateway, "WECHAT_NATIVE_FAILED", firstStr(out.Message, "微信统一下单失败"))
	}
	return &GatewayCheckoutResponse{ProviderOrderID: req.Order.ID, CheckoutURL: out.CodeURL, QRCode: out.CodeURL}, nil
}

func (g *HTTPGateway) wechatRefund(ctx context.Context, req GatewayRefundRequest) (*GatewayRefundResponse, error) {
	_, mchID, serialNo, privKey, _, err := g.wechatCreds(ctx)
	if err != nil {
		return nil, err
	}
	const urlPath = "/v3/refund/domestic/refunds"
	outRefundNo := "rf_" + req.Order.ID
	amt := req.Order.AmountCent
	if amt < 1 {
		amt = 1
	}
	payload, _ := json.Marshal(map[string]any{
		"out_trade_no":  req.Order.ID,
		"out_refund_no": outRefundNo,
		"reason":        firstStr(req.Reason, "订单退款"),
		"amount":        map[string]any{"refund": amt, "total": amt, "currency": "CNY"},
	})
	authHdr, err := buildWechatV3Header("POST", urlPath, string(payload), mchID, serialNo, privKey)
	if err != nil {
		return nil, svcErr(http.StatusServiceUnavailable, "WECHAT_KEY_INVALID", err.Error())
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(g.WechatBaseURL, "/")+urlPath, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("Authorization", authHdr)

	resp, err := g.httpClient().Do(httpReq)
	if err != nil {
		return nil, svcErr(http.StatusBadGateway, "WECHAT_REFUND_FAILED", err.Error())
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 256*1024))
	var out struct {
		RefundID string `json:"refund_id"`
		Status   string `json:"status"`
		Message  string `json:"message"`
	}
	_ = json.Unmarshal(body, &out)
	if resp.StatusCode >= 400 {
		return nil, svcErr(http.StatusBadGateway, "WECHAT_REFUND_FAILED", firstStr(out.Message, "微信申请退款失败"))
	}
	return &GatewayRefundResponse{ExternalRefundID: firstStr(out.RefundID, outRefundNo), Status: firstStr(out.Status, "PROCESSING")}, nil
}

func (g *HTTPGateway) paypalAccessToken(ctx context.Context) (string, error) {
	cid := g.readSecret(ctx, "paypal", "client_id", g.Config.PayPalClientID)
	csec := g.readSecret(ctx, "paypal", "client_secret", g.Config.PayPalClientSecret)
	if cid == "" || csec == "" {
		return "", svcErr(http.StatusServiceUnavailable, "PAYMENT_PROVIDER_NOT_CONFIGURED", "PayPal 支付尚未完成配置")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(g.PayPalBaseURL, "/")+"/v1/oauth2/token", strings.NewReader("grant_type=client_credentials"))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte(cid+":"+csec)))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := g.httpClient().Do(req)
	if err != nil {
		return "", svcErr(http.StatusBadGateway, "PAYPAL_AUTH_FAILED", err.Error())
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 128*1024))
	var tok struct {
		AccessToken string `json:"access_token"`
	}
	_ = json.Unmarshal(body, &tok)
	if resp.StatusCode >= 400 || tok.AccessToken == "" {
		return "", svcErr(http.StatusBadGateway, "PAYPAL_AUTH_FAILED", "PayPal OAuth 授权失败")
	}
	return tok.AccessToken, nil
}

func (g *HTTPGateway) paypalCreateCheckout(ctx context.Context, req GatewayCheckoutRequest) (*GatewayCheckoutResponse, error) {
	token, err := g.paypalAccessToken(ctx)
	if err != nil {
		return nil, err
	}
	customMeta, _ := json.Marshal(map[string]any{
		"user_id":       req.Order.UserID,
		"order_id":      req.Order.ID,
		"plan_id":       req.Order.PlanID,
		"product_type":  firstStr(req.Order.ProductType, "subscription"),
		"billing_cycle": firstStr(req.Order.BillingCycle, "monthly"),
		"credit_amount": strconv.FormatInt(req.CreditAmount, 10),
	})
	payload, _ := json.Marshal(map[string]any{
		"intent": "CAPTURE",
		"purchase_units": []map[string]any{{
			"reference_id": req.Order.ID,
			"description":  fmt.Sprintf("%s (%s)", firstStr(req.PlanName, req.Order.PlanID), firstStr(req.Order.BillingCycle, "monthly")),
			"custom_id":    string(customMeta),
			"amount": map[string]any{
				"currency_code": strings.ToUpper(firstStr(req.Order.Currency, "USD")),
				"value":         fmt.Sprintf("%.2f", float64(req.Order.AmountCent)/100.0),
			},
		}},
		"application_context": map[string]any{
			"brand_name":  "SupDance AI",
			"user_action": "PAY_NOW",
			"return_url":  req.SuccessURL,
			"cancel_url":  req.CancelURL,
		},
	})
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(g.PayPalBaseURL, "/")+"/v2/checkout/orders", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Authorization", "Bearer "+token)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("PayPal-Request-Id", "checkout_"+req.Order.ID)

	resp, err := g.httpClient().Do(httpReq)
	if err != nil {
		return nil, svcErr(http.StatusBadGateway, "PAYPAL_CHECKOUT_FAILED", err.Error())
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 256*1024))
	var out struct {
		ID    string `json:"id"`
		Links []struct {
			Rel  string `json:"rel"`
			Href string `json:"href"`
		} `json:"links"`
	}
	_ = json.Unmarshal(body, &out)
	var approveURL string
	for _, l := range out.Links {
		if l.Rel == "approve" || l.Rel == "payer-action" {
			approveURL = l.Href
			break
		}
	}
	if resp.StatusCode >= 400 || out.ID == "" || approveURL == "" {
		return nil, svcErr(http.StatusBadGateway, "PAYPAL_CHECKOUT_FAILED", "PayPal 未返回有效的支付审批链接")
	}
	return &GatewayCheckoutResponse{ProviderOrderID: out.ID, CheckoutURL: approveURL}, nil
}

func (g *HTTPGateway) paypalRefund(ctx context.Context, req GatewayRefundRequest) (*GatewayRefundResponse, error) {
	token, err := g.paypalAccessToken(ctx)
	if err != nil {
		return nil, err
	}
	capID := firstStr(req.ProviderPayment, req.Order.ProviderOrderID)
	if capID == "" {
		return nil, svcErr(http.StatusBadRequest, "REFUND_MISSING_CAPTURE_ID", "PayPal 订单缺少 Capture 标识")
	}
	payload, _ := json.Marshal(map[string]any{
		"note_to_payer": firstStr(req.Reason, "退款申请"),
		"amount": map[string]any{
			"value":         fmt.Sprintf("%.2f", float64(req.Order.AmountCent)/100.0),
			"currency_code": strings.ToUpper(firstStr(req.Order.Currency, "USD")),
		},
	})
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/v2/payments/captures/%s/refund", strings.TrimRight(g.PayPalBaseURL, "/"), url.PathEscape(capID)), bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Authorization", "Bearer "+token)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("PayPal-Request-Id", firstStr(req.IdempotencyKey, "refund_"+capID))

	resp, err := g.httpClient().Do(httpReq)
	if err != nil {
		return nil, svcErr(http.StatusBadGateway, "PAYPAL_REFUND_FAILED", err.Error())
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 256*1024))
	var out struct {
		ID      string `json:"id"`
		Status  string `json:"status"`
		Message string `json:"message"`
	}
	_ = json.Unmarshal(body, &out)
	if resp.StatusCode >= 400 || out.ID == "" {
		return nil, svcErr(http.StatusBadGateway, "PAYPAL_REFUND_FAILED", firstStr(out.Message, "PayPal 退款请求失败"))
	}
	return &GatewayRefundResponse{ExternalRefundID: out.ID, Status: out.Status}, nil
}

func signAlipayRSA2(params map[string]string, privKeyText string) (string, error) {
	priv, err := parseRSAPrivateKey(privKeyText)
	if err != nil {
		return "", err
	}
	keys := make([]string, 0, len(params))
	for k, v := range params {
		if k == "sign" || v == "" {
			continue
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts, k+"="+params[k])
	}
	h := sha256.Sum256([]byte(strings.Join(parts, "&")))
	sig, err := rsa.SignPKCS1v15(rand.Reader, priv, crypto.SHA256, h[:])
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(sig), nil
}

func buildWechatV3Header(method, urlPath, body, mchID, serialNo, privKeyText string) (string, error) {
	priv, err := parseRSAPrivateKey(privKeyText)
	if err != nil {
		return "", err
	}
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	var nb [12]byte
	_, _ = rand.Read(nb[:])
	nonce := hex.EncodeToString(nb[:])
	msg := fmt.Sprintf("%s\n%s\n%s\n%s\n%s\n", method, urlPath, ts, nonce, body)
	h := sha256.Sum256([]byte(msg))
	sig, err := rsa.SignPKCS1v15(rand.Reader, priv, crypto.SHA256, h[:])
	if err != nil {
		return "", err
	}
	return fmt.Sprintf(`WECHATPAY2-SHA256-RSA2048 mchid="%s",nonce_str="%s",signature="%s",timestamp="%s",serial_no="%s"`,
		mchID, nonce, base64.StdEncoding.EncodeToString(sig), ts, serialNo), nil
}

func parseRSAPrivateKey(raw string) (*rsa.PrivateKey, error) {
	norm := strings.ReplaceAll(strings.TrimSpace(raw), `\n`, "\n")
	if !strings.Contains(norm, "PRIVATE KEY") {
		norm = "-----BEGIN PRIVATE KEY-----\n" + norm + "\n-----END PRIVATE KEY-----"
	}
	block, _ := pem.Decode([]byte(norm))
	if block == nil {
		return nil, errors.New("invalid RSA private key PEM")
	}
	if pk, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return pk, nil
	}
	parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	rk, ok := parsed.(*rsa.PrivateKey)
	if !ok {
		return nil, errors.New("key is not RSA private key")
	}
	return rk, nil
}

type orderCheckoutUpdater interface {
	UpdateOrderCheckout(ctx context.Context, orderID, providerOrderID, checkoutURL string) error
}

type RefundOrderResult struct {
	Order            *Order `json:"order"`
	Reason           string `json:"reason,omitempty"`
	ExternalRefundID string `json:"externalRefundId,omitempty"`
	ProviderStatus   string `json:"providerStatus,omitempty"`
}

func (s *Service) RefundOrder(ctx context.Context, orderID, reason, actorID string) (*RefundOrderResult, error) {
	if s.Repo == nil {
		return nil, svcErr(http.StatusServiceUnavailable, "BILLING_UNAVAILABLE", "账务服务暂不可用")
	}
	o, err := s.Repo.GetOrder(ctx, strings.TrimSpace(orderID))
	if err != nil {
		return nil, err
	}
	if o == nil {
		return nil, svcErr(http.StatusNotFound, "ORDER_NOT_FOUND", "未找到对应订单")
	}
	if o.Status == "refunded" {
		return nil, svcErr(http.StatusBadRequest, "ORDER_ALREADY_REFUNDED", "该订单已处于退款状态")
	}
	if o.Status != "paid" {
		return nil, svcErr(http.StatusConflict, "ORDER_NOT_PAID", "只能对已支付的订单申请退款")
	}

	var extRefundID, provStatus string
	prov := strings.ToLower(strings.TrimSpace(o.Provider))
	if prov == "stripe" || prov == "alipay" || prov == "wechat" || prov == "paypal" {
		if s.Gateway == nil {
			return nil, svcErr(http.StatusServiceUnavailable, "PROVIDER_REFUND_UNAVAILABLE", "支付网关尚未接入")
		}
		var payID string
		if pgRepo, ok := s.Repo.(*PGRepository); ok && pgRepo.Pool != nil {
			_ = pgRepo.Pool.QueryRow(ctx, `SELECT COALESCE(provider_payment_id, '') FROM ops_bill.orders WHERE id = $1`, o.ID).Scan(&payID)
		}
		rfResp, err := s.Gateway.Refund(ctx, GatewayRefundRequest{
			Order:           *o,
			ProviderPayment: payID,
			Reason:          reason,
			IdempotencyKey:  "admin_refund:" + o.ID,
		})
		if err != nil {
			return nil, err
		}
		extRefundID = rfResp.ExternalRefundID
		provStatus = rfResp.Status
		switch strings.ToLower(strings.TrimSpace(provStatus)) {
		case "succeeded", "success", "completed":
		case "pending", "processing", "requires_action":
			return nil, svcErr(http.StatusConflict, "REFUND_AWAITING_PROVIDER", "退款申请已受理，等待支付渠道确认")
		default:
			return nil, svcErr(http.StatusBadGateway, "REFUND_NOT_CONFIRMED", "支付渠道尚未确认退款成功，请核实渠道状态")
		}
	}

	if _, err := s.Repo.ApplyPaymentWebhook(ctx, WebhookFulfillmentInput{
		Provider:          prov,
		EventID:           "admin_refund_" + o.ID,
		EventType:         "admin.order_refund",
		OrderID:           o.ID,
		ProviderOrderID:   o.ProviderOrderID,
		ProviderPaymentID: extRefundID,
		PaidAmountMinor:   o.AmountCent,
		Currency:          o.Currency,
		IsRefund:          true,
		RawPayload:        map[string]any{"actorId": actorID, "reason": reason, "externalRefundId": extRefundID},
	}, s.now()); err != nil {
		return nil, err
	}
	updated, _ := s.Repo.GetOrder(ctx, o.ID)
	if updated == nil {
		updated = o
		updated.Status = "refunded"
	}
	return &RefundOrderResult{
		Order:            updated,
		Reason:           reason,
		ExternalRefundID: extRefundID,
		ProviderStatus:   provStatus,
	}, nil
}

func (s *Service) ReplayWebhookEvent(ctx context.Context, eventID string) (*WebhookDispatchResult, error) {
	pgRepo, ok := s.Repo.(*PGRepository)
	if !ok || pgRepo == nil || pgRepo.Pool == nil {
		return nil, svcErr(http.StatusServiceUnavailable, "BILLING_UNAVAILABLE", "账务仓库未连接")
	}
	var provider, evID, evType, status string
	var rawPayload []byte
	err := pgRepo.Pool.QueryRow(ctx, `
		SELECT provider, event_id, COALESCE(event_type, ''), status, COALESCE(payload_json, '{}'::jsonb)
		FROM ops_bill.webhook_events
		WHERE event_id = $1
		ORDER BY created_at DESC LIMIT 1
	`, strings.TrimSpace(eventID)).Scan(&provider, &evID, &evType, &status, &rawPayload)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, svcErr(http.StatusNotFound, "WEBHOOK_EVENT_NOT_FOUND", "Webhook 事件记录不存在")
	}
	if err != nil {
		return nil, err
	}
	if status == "processed" {
		return nil, svcErr(http.StatusUnprocessableEntity, "WEBHOOK_ALREADY_PROCESSED", "该 Webhook 事件已处理，无需重放")
	}

	_, _ = pgRepo.Pool.Exec(ctx, `
		UPDATE ops_bill.webhook_events
		SET attempts = attempts + 1, replayed_at = $2
		WHERE provider = $1 AND event_id = $3
	`, provider, s.now().UTC(), evID)

	var obj map[string]any
	_ = json.Unmarshal(rawPayload, &obj)
	in := buildReplayWebhookInput(provider, evID, evType, obj)
	if provider == "stripe" {
		var eligible bool
		in, eligible = stripeWebhookInput(evID, evType, obj)
		if !eligible {
			return nil, svcErr(http.StatusUnprocessableEntity, "WEBHOOK_NO_SETTLEMENT", "此事件不包含已确认的支付或退款")
		}
	}
	res, err := s.Repo.ApplyPaymentWebhook(ctx, in, s.now())
	if err != nil {
		_ = s.Repo.MarkWebhookFailed(ctx, provider, evID, err.Error(), s.now())
		return nil, err
	}
	_ = s.Repo.MarkWebhookProcessed(ctx, provider, evID, s.now())
	res.Received = true
	return res, nil
}

func buildReplayWebhookInput(provider, eventID, eventType string, obj map[string]any) WebhookFulfillmentInput {
	in := WebhookFulfillmentInput{
		Provider:   provider,
		EventID:    eventID,
		EventType:  eventType,
		RawPayload: obj,
	}
	switch strings.ToLower(provider) {
	case "alipay":
		in.OrderID = strFromAny(obj["out_trade_no"])
		in.ProviderOrderID = in.OrderID
		in.ProviderPaymentID = strFromAny(obj["trade_no"])
		in.PaidAmountMinor = int64(math.Round(parseFloat(strFromAny(obj["total_amount"])) * 100))
		in.Currency = "CNY"
		in.IsRefund = strFromAny(obj["refund_fee"]) != "" || strFromAny(obj["trade_status"]) == "TRADE_CLOSED"
	case "wechat":
		in.OrderID = strFromAny(obj["out_trade_no"])
		in.ProviderOrderID = in.OrderID
		in.ProviderPaymentID = strFromAny(obj["transaction_id"])
		if amt, ok := obj["amount"].(map[string]any); ok {
			in.PaidAmountMinor = int64(toFloat(amt["total"]))
		}
		in.Currency = "CNY"
		in.IsRefund = strings.HasPrefix(eventType, "REFUND.")
	case "paypal":
		in.OrderID = extractPayPalOrderID(obj)
		in.ProviderOrderID = in.OrderID
		in.ProviderPaymentID = strFromAny(obj["id"])
		if amt, ok := obj["amount"].(map[string]any); ok {
			in.PaidAmountMinor = int64(math.Round(parseFloat(strFromAny(amt["value"])) * 100))
		}
		in.Currency = "USD"
		up := strings.ToUpper(eventType)
		in.IsRefund = up == "PAYMENT.CAPTURE.REFUNDED" || up == "PAYMENT.CAPTURE.REVERSED"
	}
	return in
}

func strFromAny(v any) string {
	if s, ok := v.(string); ok {
		return strings.TrimSpace(s)
	}
	return ""
}

func (g *HTTPGateway) QueryOrderStatus(ctx context.Context, order Order, providerPaymentID string) (*GatewayOrderStatus, error) {
	switch strings.ToLower(strings.TrimSpace(order.Provider)) {
	case "stripe":
		return g.stripeQueryOrder(ctx, order, providerPaymentID)
	case "alipay":
		return g.alipayQueryOrder(ctx, order)
	case "wechat":
		return g.wechatQueryOrder(ctx, order)
	case "paypal":
		return g.paypalQueryOrder(ctx, order)
	default:
		return nil, svcErr(http.StatusBadRequest, "UNSUPPORTED_PROVIDER", "不支持主动查单的支付渠道")
	}
}

func (g *HTTPGateway) stripeQueryOrder(ctx context.Context, order Order, _ string) (*GatewayOrderStatus, error) {
	secret := g.readSecret(ctx, "stripe", "secret_key", g.Config.StripeSecretKey)
	if secret == "" {
		return nil, svcErr(http.StatusServiceUnavailable, "PAYMENT_PROVIDER_NOT_CONFIGURED", "Stripe 尚未配置商户密钥")
	}
	sid := strings.TrimSpace(order.ProviderOrderID)
	if sid == "" {
		return nil, svcErr(http.StatusBadRequest, "MISSING_PROVIDER_ORDER_ID", "缺少 Stripe Session ID")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(g.StripeBaseURL, "/")+"/v1/checkout/sessions/"+url.PathEscape(sid), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+secret)
	resp, err := g.httpClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 256*1024))
	if resp.StatusCode >= 400 {
		return nil, svcErr(http.StatusBadGateway, "STRIPE_QUERY_FAILED", fmt.Sprintf("Stripe 查单 HTTP %d", resp.StatusCode))
	}
	var obj map[string]any
	if err := json.Unmarshal(body, &obj); err != nil {
		return nil, err
	}
	st := "pending"
	if strFromAny(obj["payment_status"]) == "paid" {
		st = "paid"
	} else if strFromAny(obj["status"]) == "expired" {
		st = "closed"
	}
	return &GatewayOrderStatus{
		Status:            st,
		ProviderOrderID:   firstStr(strFromAny(obj["id"]), sid),
		ProviderPaymentID: firstStr(strFromAny(obj["payment_intent"]), sid),
		PaidAmountMinor:   int64(toFloat(obj["amount_total"])),
		Currency:          strings.ToUpper(firstStr(strFromAny(obj["currency"]), order.Currency)),
		RawPayload:        obj,
	}, nil
}

func (g *HTTPGateway) alipayQueryOrder(ctx context.Context, order Order) (*GatewayOrderStatus, error) {
	appID, privKey, _, err := g.alipayCreds(ctx)
	if err != nil {
		return nil, err
	}
	inner, err := g.callAlipayGateway(ctx, appID, privKey, "alipay.trade.query", "", "", map[string]any{
		"out_trade_no": order.ID,
	})
	if err != nil {
		return nil, err
	}
	tradeState := strFromAny(inner["trade_status"])
	st := "pending"
	if tradeState == "TRADE_SUCCESS" || tradeState == "TRADE_FINISHED" {
		st = "paid"
	} else if tradeState == "TRADE_CLOSED" {
		st = "closed"
	}
	amtMinor := int64(math.Round(parseFloat(strFromAny(inner["total_amount"])) * 100))
	if amtMinor == 0 {
		amtMinor = order.AmountCent
	}
	return &GatewayOrderStatus{
		Status:            st,
		ProviderOrderID:   order.ID,
		ProviderPaymentID: strFromAny(inner["trade_no"]),
		PaidAmountMinor:   amtMinor,
		Currency:          "CNY",
		RawPayload:        inner,
	}, nil
}

func (g *HTTPGateway) wechatQueryOrder(ctx context.Context, order Order) (*GatewayOrderStatus, error) {
	_, mchID, serialNo, privKey, _, err := g.wechatCreds(ctx)
	if err != nil {
		return nil, err
	}
	urlPath := fmt.Sprintf("/v3/pay/transactions/out-trade-no/%s?mchid=%s", url.PathEscape(order.ID), url.QueryEscape(mchID))
	authHdr, err := buildWechatV3Header("GET", urlPath, "", mchID, serialNo, privKey)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(g.WechatBaseURL, "/")+urlPath, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", authHdr)
	resp, err := g.httpClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 256*1024))
	if resp.StatusCode >= 400 {
		return nil, svcErr(http.StatusBadGateway, "WECHAT_QUERY_FAILED", fmt.Sprintf("微信查单 HTTP %d", resp.StatusCode))
	}
	var obj map[string]any
	if err := json.Unmarshal(body, &obj); err != nil {
		return nil, err
	}
	state := strFromAny(obj["trade_state"])
	st := "pending"
	switch state {
	case "SUCCESS":
		st = "paid"
	case "CLOSED", "REVOKED", "PAYERROR":
		st = "closed"
	}
	var amtMinor int64
	if amtMap, ok := obj["amount"].(map[string]any); ok {
		amtMinor = int64(toFloat(amtMap["total"]))
	}
	return &GatewayOrderStatus{
		Status:            st,
		ProviderOrderID:   order.ID,
		ProviderPaymentID: strFromAny(obj["transaction_id"]),
		PaidAmountMinor:   amtMinor,
		Currency:          "CNY",
		RawPayload:        obj,
	}, nil
}

func (g *HTTPGateway) paypalQueryOrder(ctx context.Context, order Order) (*GatewayOrderStatus, error) {
	ppID := firstStr(order.ProviderOrderID, order.ID)
	tok, err := g.paypalAccessToken(ctx)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(g.PayPalBaseURL, "/")+"/v2/checkout/orders/"+url.PathEscape(ppID), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+tok)
	resp, err := g.httpClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 256*1024))
	if resp.StatusCode >= 400 {
		return nil, svcErr(http.StatusBadGateway, "PAYPAL_QUERY_FAILED", fmt.Sprintf("PayPal 查单 HTTP %d", resp.StatusCode))
	}
	var obj map[string]any
	if err := json.Unmarshal(body, &obj); err != nil {
		return nil, err
	}
	st := "pending"
	switch strings.ToUpper(strFromAny(obj["status"])) {
	case "COMPLETED":
		st = "paid"
	case "VOIDED":
		st = "closed"
	}
	return &GatewayOrderStatus{
		Status:            st,
		ProviderOrderID:   ppID,
		ProviderPaymentID: ppID,
		PaidAmountMinor:   order.AmountCent,
		Currency:          firstStr(order.Currency, "USD"),
		RawPayload:        obj,
	}, nil
}

// ReconcilePendingOrders polls active payment gateways for pending orders whose
// webhook notification may have been delayed or dropped, fulfilling paid ones
// idempotently via ApplyPaymentWebhook and expiring closed/stale orders.
func (s *Service) ReconcilePendingOrders(ctx context.Context, limit int) (int, error) {
	if s == nil || s.Repo == nil || s.Gateway == nil {
		return 0, nil
	}
	querier, ok := s.Gateway.(OrderStatusQuerier)
	if !ok {
		return 0, nil
	}
	pgRepo, ok := s.Repo.(*PGRepository)
	if !ok || pgRepo == nil || pgRepo.Pool == nil {
		return 0, nil
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	rows, err := pgRepo.Pool.Query(ctx, `
		SELECT id, user_id, plan_id, provider, COALESCE(provider_order_id, ''),
		       COALESCE(provider_payment_id, ''), amount_minor, currency,
		       COALESCE(product_type, 'subscription'), COALESCE(billing_cycle, 'monthly'),
		       created_at
		FROM ops_bill.orders
		WHERE status = 'pending'
		  AND provider IN ('stripe', 'alipay', 'wechat', 'paypal')
		  AND created_at < now() - INTERVAL '2 minutes'
		  AND created_at > now() - INTERVAL '48 hours'
		ORDER BY created_at ASC
		LIMIT $1`, limit)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	type pendingRow struct {
		order     Order
		paymentID string
		createdAt time.Time
	}
	var pending []pendingRow
	for rows.Next() {
		var item pendingRow
		if err := rows.Scan(
			&item.order.ID, &item.order.UserID, &item.order.PlanID, &item.order.Provider,
			&item.order.ProviderOrderID, &item.paymentID, &item.order.AmountCent,
			&item.order.Currency, &item.order.ProductType, &item.order.BillingCycle,
			&item.createdAt,
		); err == nil {
			pending = append(pending, item)
		}
	}
	rows.Close()

	reconciled := 0
	for _, item := range pending {
		st, err := querier.QueryOrderStatus(ctx, item.order, item.paymentID)
		if err != nil || st == nil {
			continue
		}
		if st.Status == "paid" {
			_, _ = s.Repo.ApplyPaymentWebhook(ctx, WebhookFulfillmentInput{
				Provider:          item.order.Provider,
				EventID:           "reconcile_" + item.order.ID,
				EventType:         "reconcile.order_paid",
				OrderID:           item.order.ID,
				ProviderOrderID:   firstStr(st.ProviderOrderID, item.order.ProviderOrderID),
				ProviderPaymentID: st.ProviderPaymentID,
				PaidAmountMinor:   st.PaidAmountMinor,
				Currency:          firstStr(st.Currency, item.order.Currency),
				RawPayload:        st.RawPayload,
			}, s.now())
			reconciled++
		} else if st.Status == "closed" || st.Status == "failed" || time.Since(item.createdAt) > 24*time.Hour {
			_, _ = pgRepo.Pool.Exec(ctx, `
				UPDATE ops_bill.orders SET status = 'expired', updated_at = $2
				WHERE id = $1 AND status = 'pending'`, item.order.ID, s.now().UTC())
		}
	}
	return reconciled, nil
}

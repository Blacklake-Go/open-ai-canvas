package billing

import (
	"context"
	"crypto"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
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
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"one/backend/internal/config"
	"one/backend/internal/platform/coordination"
)

type fakeBillingRepo struct {
	orders          map[string]Order
	idemOrders      map[string]string
	paidExclusive   map[string]bool
	sub             *SubscriptionInfo
	coupons         map[string]CouponInfo
	redeemedCoupons map[string]bool
	claimedEvents   map[string]bool
	processedEvents map[string]bool
	rejectedEvents  []string
	appliedWebhooks []WebhookFulfillmentInput
}

func newFakeBillingRepo() *fakeBillingRepo {
	return &fakeBillingRepo{
		orders:          map[string]Order{},
		idemOrders:      map[string]string{},
		paidExclusive:   map[string]bool{},
		coupons:         map[string]CouponInfo{},
		redeemedCoupons: map[string]bool{},
		claimedEvents:   map[string]bool{},
		processedEvents: map[string]bool{},
	}
}

func (f *fakeBillingRepo) GetOrder(_ context.Context, orderID string) (*Order, error) {
	o, ok := f.orders[orderID]
	if !ok {
		return nil, nil
	}
	cp := o
	return &cp, nil
}

func (f *fakeBillingRepo) ListOrdersByUser(_ context.Context, userID string, limit, offset int) ([]Order, error) {
	var out []Order
	for _, o := range f.orders {
		if o.UserID == userID {
			out = append(out, o)
		}
	}
	return out, nil
}

func (f *fakeBillingRepo) HasPaidExclusiveOrder(_ context.Context, userID string) (bool, error) {
	return f.paidExclusive[userID], nil
}

func (f *fakeBillingRepo) CreateOrder(_ context.Context, order Order, idempotencyKey string) (*Order, error) {
	if idempotencyKey != "" {
		k := order.Provider + ":" + idempotencyKey
		if existingID, ok := f.idemOrders[k]; ok {
			existing := f.orders[existingID]
			if existing.UserID != order.UserID || existing.PlanID != order.PlanID || existing.AmountCent != order.AmountCent {
				return nil, svcErr(409, "IDEMPOTENCY_CONFLICT", "conflict")
			}
			return &existing, nil
		}
		f.idemOrders[k] = order.ID
	}
	f.orders[order.ID] = order
	cp := order
	return &cp, nil
}

func (f *fakeBillingRepo) GetActiveSubscription(_ context.Context, userID string) (*SubscriptionInfo, error) {
	return f.sub, nil
}

func (f *fakeBillingRepo) UpdateSubscriptionCancelAtPeriodEnd(_ context.Context, userID string, cancel bool) (*SubscriptionInfo, error) {
	if f.sub == nil {
		return nil, svcErr(404, "SUBSCRIPTION_NOT_FOUND", "none")
	}
	f.sub.CancelAtPeriodEnd = cancel
	cp := *f.sub
	return &cp, nil
}

func (f *fakeBillingRepo) GetUsageSummary(_ context.Context, userID string) (*UsageSummary, error) {
	return &UsageSummary{TotalCreations: 7, TotalCreditsUsed: 120, Recent30DaysUsed: 80}, nil
}

func (f *fakeBillingRepo) VerifyCoupon(_ context.Context, code, userID string, now time.Time) (*CouponInfo, error) {
	c, ok := f.coupons[code]
	if !ok {
		return nil, ErrCouponNotFound
	}
	if c.ExpiresAt != nil && !c.ExpiresAt.After(now) {
		return nil, ErrCouponInvalid
	}
	if f.redeemedCoupons[code+":"+userID] {
		return nil, ErrCouponRedeemed
	}
	cp := c
	return &cp, nil
}

func (f *fakeBillingRepo) RedeemCoupon(_ context.Context, code, userID, ip string, now time.Time) (map[string]any, error) {
	c, err := f.VerifyCoupon(context.Background(), code, userID, now)
	if err != nil {
		return nil, err
	}
	f.redeemedCoupons[code+":"+userID] = true
	return map[string]any{
		"redeemed": true,
		"code":     c.Code,
		"credits":  c.Credits,
	}, nil
}

func (f *fakeBillingRepo) ClaimWebhookEvent(_ context.Context, provider, eventID, eventType string, _ map[string]any, _ map[string]string, _ time.Time) (bool, error) {
	k := provider + ":" + eventID
	if f.claimedEvents[k] {
		return false, nil
	}
	f.claimedEvents[k] = true
	return true, nil
}

func (f *fakeBillingRepo) MarkWebhookProcessed(_ context.Context, provider, eventID string, _ time.Time) error {
	f.processedEvents[provider+":"+eventID] = true
	return nil
}

func (f *fakeBillingRepo) MarkWebhookFailed(_ context.Context, provider, eventID, errMsg string, _ time.Time) error {
	return nil
}

func (f *fakeBillingRepo) RecordRejectedWebhook(_ context.Context, provider, eventID, eventType, errMsg string, _ map[string]any, _ map[string]string, _ time.Time) error {
	f.rejectedEvents = append(f.rejectedEvents, provider+":"+eventID+":"+errMsg)
	return nil
}

func (f *fakeBillingRepo) ApplyPaymentWebhook(_ context.Context, in WebhookFulfillmentInput, _ time.Time) (*WebhookDispatchResult, error) {
	f.appliedWebhooks = append(f.appliedWebhooks, in)
	return &WebhookDispatchResult{Action: "paid", OrderID: in.OrderID}, nil
}

type mockPayPalVerifier struct {
	valid bool
	err   error
}

func (m mockPayPalVerifier) VerifyWebhookSignature(_ context.Context, _ []byte, _ map[string]string, _ string) (bool, error) {
	return m.valid, m.err
}

func generateTestRSAKeys(t *testing.T) (*rsa.PrivateKey, string) {
	t.Helper()
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("rsa key: %v", err)
	}
	der, err := x509.MarshalPKIXPublicKey(&priv.PublicKey)
	if err != nil {
		t.Fatalf("marshal pub: %v", err)
	}
	pubPEM := string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: der}))
	return priv, pubPEM
}

func signRSA256(t *testing.T, priv *rsa.PrivateKey, msg []byte) string {
	t.Helper()
	h := sha256.Sum256(msg)
	sig, err := rsa.SignPKCS1v15(rand.Reader, priv, crypto.SHA256, h[:])
	if err != nil {
		t.Fatalf("rsa sign: %v", err)
	}
	return base64.StdEncoding.EncodeToString(sig)
}

func TestCheckoutAndCatalogsAndCoupons(t *testing.T) {
	now := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	repo := newFakeBillingRepo()
	repo.coupons["GIFT100"] = CouponInfo{Code: "GIFT100", Title: "100 积分", Type: "credits", Credits: 100}
	repo.sub = &SubscriptionInfo{ID: "sub_1", PlanID: "basic", Status: "active", IsSubscribed: true}

	coord, _ := coordination.New(coordination.Options{})
	svc := &Service{
		Repo:   repo,
		Coord:  coord,
		Config: config.Config{StripeSecretKey: "sk_test_123"},
		Now:    func() time.Time { return now },
	}

	plans, err := svc.ListPlans(context.Background())
	if err != nil || len(plans["plans"].([]PlanItem)) != 4 {
		t.Fatalf("expected 4 plans")
	}

	packs := svc.ListCreditPacks(context.Background(), "u1")
	if packs["isFirstPurchase"] != true {
		t.Fatalf("expected first purchase true")
	}

	res, err := svc.CreateCheckout(context.Background(), CheckoutInput{
		UserID:         "u1",
		PlanID:         "basic",
		Provider:       "stripe",
		BillingCycle:   "monthly",
		IdempotencyKey: "idem-1",
	})
	if err != nil {
		t.Fatalf("checkout err: %v", err)
	}
	if res.Currency != "USD" || res.AmountMinor != 5000 {
		t.Fatalf("unexpected checkout result: %+v", res)
	}

	// Idempotent replay returns same order
	res2, err := svc.CreateCheckout(context.Background(), CheckoutInput{
		UserID:         "u1",
		PlanID:         "basic",
		Provider:       "stripe",
		BillingCycle:   "monthly",
		IdempotencyKey: "idem-1",
	})
	if err != nil || res2.OrderID != res.OrderID {
		t.Fatalf("expected idempotent order %s, got %+v (%v)", res.OrderID, res2, err)
	}

	// Order status ownership check
	if _, err := svc.GetOrderStatusForUser(context.Background(), res.OrderID, "other_user"); err == nil {
		t.Fatalf("expected forbidden for other user")
	}

	// Coupon verify & redeem & double-redeem rejection
	ci, err := svc.VerifyCoupon(context.Background(), "gift100", "u1")
	if err != nil || ci.Credits != 100 {
		t.Fatalf("verify coupon failed: %+v, %v", ci, err)
	}
	if _, err := svc.RedeemCoupon(context.Background(), "gift100", "u1", "127.0.0.1"); err != nil {
		t.Fatalf("redeem failed: %v", err)
	}
	if _, err := svc.RedeemCoupon(context.Background(), "gift100", "u1", "127.0.0.1"); err == nil {
		t.Fatalf("expected double redeem rejection")
	}
}

func TestWebhooksCryptoAndFailClosedPayPal(t *testing.T) {
	now := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	repo := newFakeBillingRepo()
	priv, pubPEM := generateTestRSAKeys(t)
	apiV3Key := "0123456789abcdef0123456789abcdef" // 32 bytes

	svc := &Service{
		Repo: repo,
		Config: config.Config{
			StripeWebhookSecret: "whsec_test_secret",
			AlipayPublicKey:     pubPEM,
			WechatPublicKey:     pubPEM,
			WechatAPIV3Key:      apiV3Key,
			PayPalWebhookID:     "", // intentionally empty first
		},
		PayPalVerifier: mockPayPalVerifier{valid: true},
		Now:            func() time.Time { return now },
	}

	// 1. PayPal MUST FAIL CLOSED when PAYPAL_WEBHOOK_ID is missing
	_, err := svc.HandlePayPalWebhook(context.Background(), []byte(`{}`), map[string]string{
		"paypal-auth-algo":         "SHA256withRSA",
		"paypal-cert-url":          "https://api.paypal.com/cert.pem",
		"paypal-transmission-id":   "tx_1",
		"paypal-transmission-sig":  "sig",
		"paypal-transmission-time": now.Format(time.RFC3339),
	})
	var se *ServiceError
	if !errors.As(err, &se) || se.Status != http.StatusServiceUnavailable || se.Code != "PAYPAL_WEBHOOK_ID_MISSING" {
		t.Fatalf("expected PayPal fail-closed 503 PAYPAL_WEBHOOK_ID_MISSING, got %v", err)
	}

	// Configure PayPal webhook ID and test valid + invalid verifier
	svc.Config.PayPalWebhookID = "WH-PAYPAL-123"
	ppBody := []byte(`{"id":"EV_PP_1","event_type":"PAYMENT.CAPTURE.COMPLETED","resource":{"id":"CAP_1","custom_id":"{\"order_id\":\"order_pp_1\"}","amount":{"value":"50.00"}}}`)
	ppHeaders := map[string]string{
		"paypal-auth-algo":         "SHA256withRSA",
		"paypal-cert-url":          "https://api.paypal.com/cert.pem",
		"paypal-transmission-id":   "tx_1",
		"paypal-transmission-sig":  "sig",
		"paypal-transmission-time": now.Format(time.RFC3339),
	}
	ppRes, err := svc.HandlePayPalWebhook(context.Background(), ppBody, ppHeaders)
	if err != nil || !ppRes.Received || ppRes.OrderID != "order_pp_1" {
		t.Fatalf("paypal webhook failed: %+v, err=%v", ppRes, err)
	}

	svc.PayPalVerifier = mockPayPalVerifier{valid: false}
	if _, err := svc.HandlePayPalWebhook(context.Background(), ppBody, ppHeaders); !errors.As(err, &se) || se.Status != http.StatusBadRequest {
		t.Fatalf("expected PayPal invalid signature 400, got %v", err)
	}

	// 2. Stripe HMAC signature + idempotent duplicate ignore
	stripeBody := []byte(`{"id":"evt_1","type":"checkout.session.completed","data":{"object":{"id":"cs_1","payment_status":"paid","amount_total":5000,"currency":"usd","payment_intent":"pi_1","metadata":{"order_id":"order_st_1"}}}}`)
	mac := hmac.New(sha256.New, []byte("whsec_test_secret"))
	mac.Write([]byte(fmt.Sprintf("%d.", now.Unix())))
	mac.Write(stripeBody)
	sigHeader := fmt.Sprintf("t=%d,v1=%s", now.Unix(), hex.EncodeToString(mac.Sum(nil)))

	stRes, err := svc.HandleStripeWebhook(context.Background(), stripeBody, sigHeader)
	if err != nil || stRes.OrderID != "order_st_1" || stRes.Duplicate {
		t.Fatalf("stripe webhook failed: %+v, err=%v", stRes, err)
	}
	stDup, err := svc.HandleStripeWebhook(context.Background(), stripeBody, sigHeader)
	if err != nil || !stDup.Duplicate {
		t.Fatalf("expected duplicate ignore on replay, got %+v, err=%v", stDup, err)
	}
	if _, err := svc.HandleStripeWebhook(context.Background(), stripeBody, "t=100,v1=deadbeef"); err == nil {
		t.Fatalf("expected stale/bad stripe signature error")
	}

	// 3. Alipay RSA2 verification
	aliParams := map[string]string{
		"app_id":       "2021000001",
		"notify_id":    "ali_n_1",
		"out_trade_no": "order_ali_1",
		"trade_no":     "2026ali1",
		"trade_status": "TRADE_SUCCESS",
		"total_amount": "140.00",
		"sign_type":    "RSA2",
	}
	aliSignStr := BuildAlipaySignString(aliParams, true)
	aliParams["sign"] = signRSA256(t, priv, []byte(aliSignStr))
	form := url.Values{}
	for k, v := range aliParams {
		form.Set(k, v)
	}
	aliRes, err := svc.HandleAlipayWebhook(context.Background(), []byte(form.Encode()))
	if err != nil || aliRes.OrderID != "order_ali_1" {
		t.Fatalf("alipay webhook failed: %+v, err=%v", aliRes, err)
	}

	// 4. WeChat Pay v3 RSA-SHA256 + AES-256-GCM decryption
	wxPlain := []byte(`{"out_trade_no":"order_wx_1","transaction_id":"wx_tx_1","amount":{"total":35000}}`)
	block, _ := aes.NewCipher([]byte(apiV3Key))
	gcm, _ := cipher.NewGCM(block)
	wxNonce := "123456789012"
	wxAAD := "transaction"
	wxCipher := gcm.Seal(nil, []byte(wxNonce), wxPlain, []byte(wxAAD))
	wxPayload, _ := json.Marshal(map[string]any{
		"id":         "wx_ev_1",
		"event_type": "TRANSACTION.SUCCESS",
		"resource": WechatEncryptedResource{
			Algorithm:      "AEAD_AES_256_GCM",
			Ciphertext:     base64.StdEncoding.EncodeToString(wxCipher),
			AssociatedData: wxAAD,
			Nonce:          wxNonce,
		},
	})
	ts := fmt.Sprintf("%d", now.Unix())
	msg := fmt.Sprintf("%s\n%s\n%s\n", ts, "nonce_abc", string(wxPayload))
	wxSig := signRSA256(t, priv, []byte(msg))
	wxRes, err := svc.HandleWechatWebhook(context.Background(), wxPayload, map[string]string{
		"wechatpay-signature": wxSig,
		"wechatpay-timestamp": ts,
		"wechatpay-nonce":     "nonce_abc",
	})
	if err != nil || wxRes.OrderID != "order_wx_1" {
		t.Fatalf("wechat webhook failed: %+v, err=%v", wxRes, err)
	}
}

func TestWebhookNonPaidEventsDoNotFulfill(t *testing.T) {
	priv, _ := rsa.GenerateKey(rand.Reader, 2048)
	pubDER, _ := x509.MarshalPKIXPublicKey(&priv.PublicKey)
	pubPEM := string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: pubDER}))
	apiV3Key := "0123456789abcdef0123456789abcdef"

	repo := newFakeBillingRepo()
	now := time.Now().UTC()
	svc := &Service{
		Repo: repo,
		Now:  func() time.Time { return now },
		Config: config.Config{
			StripeWebhookSecret: "whsec_test_secret",
			AlipayAppID:         "2021000001",
			AlipayPublicKey:     pubPEM,
			WechatPublicKey:     pubPEM,
			WechatAPIV3Key:      apiV3Key,
			PayPalWebhookID:     "WH-PAYPAL-1",
		},
		PayPalVerifier: mockPayPalVerifier{valid: true},
	}

	// 1. Stripe checkout.session.completed with payment_status="unpaid" MUST NOT fulfill
	unpaidStripe := []byte(`{"id":"evt_unpaid","type":"checkout.session.completed","data":{"object":{"id":"cs_unpaid","payment_status":"unpaid","amount_total":5000,"metadata":{"order_id":"order_unpaid"}}}}`)
	mac := hmac.New(sha256.New, []byte("whsec_test_secret"))
	mac.Write([]byte(fmt.Sprintf("%d.", now.Unix())))
	mac.Write(unpaidStripe)
	sig := fmt.Sprintf("t=%d,v1=%s", now.Unix(), hex.EncodeToString(mac.Sum(nil)))
	if res, err := svc.HandleStripeWebhook(context.Background(), unpaidStripe, sig); err != nil || !strings.HasPrefix(res.Action, "ignored") {
		t.Fatalf("expected unpaid stripe session ignored, got res=%+v err=%v", res, err)
	}

	// 2. Stripe payment_intent.payment_failed MUST NOT fulfill
	failedStripe := []byte(`{"id":"evt_fail","type":"payment_intent.payment_failed","data":{"object":{"id":"pi_fail","metadata":{"order_id":"order_fail"}}}}`)
	mac2 := hmac.New(sha256.New, []byte("whsec_test_secret"))
	mac2.Write([]byte(fmt.Sprintf("%d.", now.Unix())))
	mac2.Write(failedStripe)
	sig2 := fmt.Sprintf("t=%d,v1=%s", now.Unix(), hex.EncodeToString(mac2.Sum(nil)))
	if res, err := svc.HandleStripeWebhook(context.Background(), failedStripe, sig2); err != nil || !strings.HasPrefix(res.Action, "ignored") {
		t.Fatalf("expected failed stripe intent ignored, got res=%+v err=%v", res, err)
	}

	// 3. Alipay WAIT_BUYER_PAY MUST NOT fulfill
	aliParams := map[string]string{
		"app_id":       "2021000001",
		"notify_id":    "ali_wait_1",
		"out_trade_no": "order_ali_wait",
		"trade_no":     "2026aliwait",
		"trade_status": "WAIT_BUYER_PAY",
		"total_amount": "140.00",
		"sign_type":    "RSA2",
	}
	aliParams["sign"] = signRSA256(t, priv, []byte(BuildAlipaySignString(aliParams, true)))
	form := url.Values{}
	for k, v := range aliParams {
		form.Set(k, v)
	}
	if res, err := svc.HandleAlipayWebhook(context.Background(), []byte(form.Encode())); err != nil || !strings.HasPrefix(res.Action, "ignored") {
		t.Fatalf("expected Alipay WAIT_BUYER_PAY ignored, got res=%+v err=%v", res, err)
	}

	// 4. PayPal CHECKOUT.ORDER.APPROVED (not yet captured) MUST NOT fulfill
	ppApproved := []byte(`{"id":"EV_PP_APPROVED","event_type":"CHECKOUT.ORDER.APPROVED","resource":{"id":"ORD_1","custom_id":"{\"order_id\":\"order_pp_wait\"}"}}`)
	ppHeaders := map[string]string{
		"paypal-auth-algo":         "SHA256withRSA",
		"paypal-cert-url":          "https://api.paypal.com/cert.pem",
		"paypal-transmission-id":   "tx_2",
		"paypal-transmission-sig":  "sig",
		"paypal-transmission-time": now.Format(time.RFC3339),
	}
	if res, err := svc.HandlePayPalWebhook(context.Background(), ppApproved, ppHeaders); err != nil || !strings.HasPrefix(res.Action, "ignored") {
		t.Fatalf("expected PayPal CHECKOUT.ORDER.APPROVED ignored, got res=%+v err=%v", res, err)
	}

	// 5. WeChat non-SUCCESS trade_state (NOTPAY) / non-payment event MUST NOT fulfill
	wxPlain := []byte(`{"out_trade_no":"order_wx_wait","transaction_id":"wx_tx_wait","trade_state":"NOTPAY","amount":{"total":35000}}`)
	block, _ := aes.NewCipher([]byte(apiV3Key))
	gcm, _ := cipher.NewGCM(block)
	wxNonce := "123456789012"
	wxCipher := gcm.Seal(nil, []byte(wxNonce), wxPlain, []byte("transaction"))
	wxOther, _ := json.Marshal(map[string]any{
		"id":         "wx_ev_notpay",
		"event_type": "TRANSACTION.SUCCESS",
		"resource":   WechatEncryptedResource{Algorithm: "AEAD_AES_256_GCM", Ciphertext: base64.StdEncoding.EncodeToString(wxCipher), AssociatedData: "transaction", Nonce: wxNonce},
	})
	ts := fmt.Sprintf("%d", now.Unix())
	wxSig := signRSA256(t, priv, []byte(fmt.Sprintf("%s\n%s\n%s\n", ts, "nonce_2", string(wxOther))))
	if res, err := svc.HandleWechatWebhook(context.Background(), wxOther, map[string]string{
		"wechatpay-signature": wxSig,
		"wechatpay-timestamp": ts,
		"wechatpay-nonce":     "nonce_2",
	}); err != nil || !strings.HasPrefix(res.Action, "ignored") {
		t.Fatalf("expected WeChat NOTPAY ignored, got res=%+v err=%v", res, err)
	}

	if len(repo.appliedWebhooks) != 0 {
		t.Fatalf("expected zero webhook fulfillments for non-paid events, got %+v", repo.appliedWebhooks)
	}
}

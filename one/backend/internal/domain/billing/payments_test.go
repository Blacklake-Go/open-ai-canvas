package billing

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"one/backend/internal/config"
)

func genRSAPEM(t *testing.T) string {
	t.Helper()
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("rsa keygen: %v", err)
	}
	der := x509.MarshalPKCS1PrivateKey(priv)
	return string(pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: der}))
}

func TestHTTPGatewayStripeAlipayWechatPayPalCheckoutAndRefund(t *testing.T) {
	privPEM := genRSAPEM(t)

	var stripePath, alipayMethod, wechatAuth, paypalAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		body, _ := io.ReadAll(r.Body)
		switch r.URL.Path {
		case "/v1/checkout/sessions":
			stripePath = r.URL.Path
			_ = json.NewEncoder(w).Encode(map[string]any{"id": "cs_test_1", "url": "https://checkout.stripe.com/pay/cs_test_1"})
		case "/v1/refunds":
			_ = json.NewEncoder(w).Encode(map[string]any{"id": "re_test_1", "status": "succeeded"})
		case "/gateway.do":
			vals, _ := url.ParseQuery(string(body))
			alipayMethod = vals.Get("method")
			if vals.Get("sign") == "" {
				http.Error(w, "missing sign", http.StatusBadRequest)
				return
			}
			if alipayMethod == "alipay.trade.precreate" {
				_ = json.NewEncoder(w).Encode(map[string]any{
					"alipay_trade_precreate_response": map[string]any{
						"code": "10000", "qr_code": "https://qr.alipay.com/bax0001",
					},
				})
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"alipay_trade_refund_response": map[string]any{"code": "10000", "trade_no": "ali_trade_99"},
			})
		case "/v3/pay/transactions/native":
			wechatAuth = r.Header.Get("Authorization")
			_ = json.NewEncoder(w).Encode(map[string]any{"code_url": "weixin://wxpay/bizpayurl?pr=123"})
		case "/v3/refund/domestic/refunds":
			_ = json.NewEncoder(w).Encode(map[string]any{"refund_id": "wx_rf_1", "status": "SUCCESS"})
		case "/v1/oauth2/token":
			paypalAuth = r.Header.Get("Authorization")
			_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "pp_tok_1"})
		case "/v2/checkout/orders":
			if r.Header.Get("Authorization") != "Bearer pp_tok_1" {
				http.Error(w, "bad token", http.StatusUnauthorized)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id": "PP-ORDER-1",
				"links": []map[string]any{
					{"rel": "approve", "href": "https://www.sandbox.paypal.com/checkoutnow?token=PP-ORDER-1"},
				},
			})
		case "/v2/payments/captures/CAP-1/refund":
			_ = json.NewEncoder(w).Encode(map[string]any{"id": "PP-RF-1", "status": "COMPLETED"})
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	cfg := config.Config{
		PublicAppURL:       "https://one.example.com",
		StripeSecretKey:    "sk_test_1",
		AlipayAppID:        "2021000001",
		AlipayPrivateKey:   privPEM,
		WechatAppID:        "wx123",
		WechatMchID:        "16000001",
		WechatSerialNo:     "SERIAL1",
		WechatPrivateKey:   privPEM,
		PayPalClientID:     "pp-id",
		PayPalClientSecret: "pp-sec",
		PayPalMode:         "sandbox",
	}
	gw := &HTTPGateway{
		Config:           cfg,
		Client:           srv.Client(),
		StripeBaseURL:    srv.URL,
		AlipayGatewayURL: srv.URL + "/gateway.do",
		WechatBaseURL:    srv.URL,
		PayPalBaseURL:    srv.URL,
	}

	repo := newFakeBillingRepo()
	repo.orders["ord_paid_stripe"] = Order{
		ID: "ord_paid_stripe", UserID: "u1", PlanID: "basic", Provider: "stripe",
		ProviderOrderID: "pi_123", Status: "paid", AmountCent: 1990, Currency: "USD",
	}
	svc := &Service{
		Repo:    repo,
		Config:  cfg,
		Gateway: gw,
		Now:     func() time.Time { return time.Date(2026, 11, 16, 12, 0, 0, 0, time.UTC) },
	}

	for _, prov := range []string{"stripe", "alipay", "wechat", "paypal"} {
		res, err := svc.CreateCheckout(context.Background(), CheckoutInput{
			UserID: "u1", UserEmail: "u1@example.com", PlanID: "basic", Provider: prov,
		})
		if err != nil {
			t.Fatalf("CreateCheckout(%s) failed: %v", prov, err)
		}
		if res.CheckoutURL == "" {
			t.Fatalf("CreateCheckout(%s) returned empty checkoutUrl", prov)
		}
	}
	if stripePath != "/v1/checkout/sessions" || alipayMethod != "alipay.trade.precreate" {
		t.Fatalf("unexpected stripe=%q alipay=%q", stripePath, alipayMethod)
	}
	if !strings.HasPrefix(wechatAuth, "WECHATPAY2-SHA256-RSA2048 ") || paypalAuth != "Basic "+"cHAtaWQ6cHAtc2Vj" {
		t.Fatalf("unexpected wechatAuth=%q paypalAuth=%q", wechatAuth, paypalAuth)
	}

	rf, err := svc.RefundOrder(context.Background(), "ord_paid_stripe", "user requested", "admin1")
	if err != nil || rf.ExternalRefundID != "re_test_1" {
		t.Fatalf("RefundOrder failed: rf=%+v err=%v", rf, err)
	}
	ppRf, err := gw.Refund(context.Background(), GatewayRefundRequest{
		Order:           Order{ID: "ord_pp", Provider: "paypal", AmountCent: 1000, Currency: "USD"},
		ProviderPayment: "CAP-1",
	})
	if err != nil || ppRf.ExternalRefundID != "PP-RF-1" {
		t.Fatalf("PayPal refund failed: %+v err=%v", ppRf, err)
	}

	// Unconfigured gateway must fail closed with PAYMENT_PROVIDER_NOT_CONFIGURED
	emptyGW := NewHTTPGateway(config.Config{}, nil, srv.Client())
	_, err = emptyGW.CreateCheckout(context.Background(), GatewayCheckoutRequest{
		Order: Order{ID: "ord_empty", Provider: "stripe", AmountCent: 100, Currency: "USD"},
	})
	var se *ServiceError
	if !errors.As(err, &se) || se.Code != "PAYMENT_PROVIDER_NOT_CONFIGURED" {
		t.Fatalf("expected PAYMENT_PROVIDER_NOT_CONFIGURED, got %v", err)
	}
}

func TestHTTPGatewayQueryOrderStatus(t *testing.T) {
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	der, err := x509.MarshalPKCS8PrivateKey(priv)
	if err != nil {
		t.Fatal(err)
	}
	privPEM := string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der}))

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/v1/checkout/sessions/cs_paid_1":
			_, _ = w.Write([]byte(`{"id":"cs_paid_1","payment_status":"paid","payment_intent":"pi_paid_1","amount_total":1990,"currency":"usd"}`))
		case r.Method == http.MethodPost && r.URL.Path == "/alipay":
			_, _ = w.Write([]byte(`{"alipay_trade_query_response":{"code":"10000","trade_status":"TRADE_SUCCESS","trade_no":"202611160001","total_amount":"19.90"}}`))
		case r.Method == http.MethodGet && strings.HasPrefix(r.URL.Path, "/v3/pay/transactions/out-trade-no/"):
			_, _ = w.Write([]byte(`{"trade_state":"SUCCESS","transaction_id":"wx_tx_1","amount":{"total":1990}}`))
		case r.Method == http.MethodPost && r.URL.Path == "/v1/oauth2/token":
			_, _ = w.Write([]byte(`{"access_token":"pp_tok_q"}`))
		case r.Method == http.MethodGet && r.URL.Path == "/v2/checkout/orders/PP-ORD-1":
			_, _ = w.Write([]byte(`{"id":"PP-ORD-1","status":"COMPLETED"}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()

	cfg := config.Config{
		PublicAppURL:       "https://one.supdance.com",
		StripeSecretKey:    "sk_test_123",
		AlipayAppID:        "2021000000000001",
		AlipayPrivateKey:   privPEM,
		WechatAppID:        "wx123",
		WechatMchID:        "1600000001",
		WechatSerialNo:     "SER123",
		WechatPrivateKey:   privPEM,
		PayPalClientID:     "pp-id",
		PayPalClientSecret: "pp-sec",
	}
	gw := &HTTPGateway{
		Config:           cfg,
		Client:           srv.Client(),
		StripeBaseURL:    srv.URL,
		AlipayGatewayURL: srv.URL + "/alipay",
		WechatBaseURL:    srv.URL,
		PayPalBaseURL:    srv.URL,
	}

	cases := []Order{
		{ID: "o1", Provider: "stripe", ProviderOrderID: "cs_paid_1", AmountCent: 1990, Currency: "USD"},
		{ID: "o2", Provider: "alipay", AmountCent: 1990, Currency: "CNY"},
		{ID: "o3", Provider: "wechat", AmountCent: 1990, Currency: "CNY"},
		{ID: "o4", Provider: "paypal", ProviderOrderID: "PP-ORD-1", AmountCent: 1990, Currency: "USD"},
	}
	for _, ord := range cases {
		st, err := gw.QueryOrderStatus(context.Background(), ord, "")
		if err != nil {
			t.Fatalf("QueryOrderStatus(%s) failed: %v", ord.Provider, err)
		}
		if st.Status != "paid" {
			t.Fatalf("QueryOrderStatus(%s) got status=%q, want paid", ord.Provider, st.Status)
		}
	}
}

func TestStripeSettlementRequiresFinalStateAndAmount(t *testing.T) {
	for _, tc := range []struct {
		name, event string
		obj         map[string]any
		eligible    bool
		refund      bool
	}{
		{"checkout without payment status", "checkout.session.completed", map[string]any{"amount_total": 500, "currency": "usd"}, false, false},
		{"delayed settlement", "checkout.session.async_payment_succeeded", map[string]any{"payment_status": "paid", "amount_total": 500, "currency": "usd"}, true, false},
		{"invoice without paid amount", "invoice.paid", map[string]any{"amount_total": 500, "currency": "usd"}, false, false},
		{"refund in progress", "refund.updated", map[string]any{"status": "pending", "amount": 500, "currency": "usd"}, false, true},
		{"partial charge refund", "charge.refunded", map[string]any{"refunded": false, "amount_refunded": 250, "currency": "usd"}, false, true},
		{"settled refund", "refund.updated", map[string]any{"status": "succeeded", "amount": 500, "currency": "usd", "payment_intent": "pi_fixture"}, true, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			input, eligible := stripeWebhookInput("evt_fixture", tc.event, tc.obj)
			if eligible != tc.eligible || input.IsRefund != tc.refund {
				t.Fatalf("eligible=%v, isRefund=%v", eligible, input.IsRefund)
			}
			if tc.eligible && tc.refund && input.OriginalPaymentID != "pi_fixture" {
				t.Fatal("settled refund discarded its original payment reference")
			}
		})
	}
}

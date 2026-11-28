package stripepayment

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stripe/stripe-go/v87"
	"github.com/stripe/stripe-go/v87/webhook"
	sdk "yingce/backend/payment-sdk"
)

func stripeTestConfig() sdk.Config {
	return sdk.Config{
		"mode": "test", "apiKey": "rk_test_fixture", "webhookSigningSecret": "whsec_fixture",
		"settlementCurrency": "USD", "publicBaseUrl": "https://qa.example.invalid", "allowedUserId": "reviewer",
	}
}

func stripeTestOrder() sdk.CreateRequest {
	return sdk.CreateRequest{
		MerchantOrderNo: "merchant-order", Description: "QA credit pack", AmountFen: 125, Currency: "USD",
		ExpiresAt: time.Now().Truncate(time.Second).Add(45 * time.Minute), ReturnURL: "https://qa.example.invalid/api/payments/return/stripe?orderId=order",
		UserID: "reviewer", ProviderConfigID: "config-version",
	}
}

func TestStripeCheckoutProvider(t *testing.T) {
	request := stripeTestOrder()
	var mu sync.Mutex
	var creates int
	status := "open"
	paymentStatus := "unpaid"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		if r.Header.Get("Authorization") != "Bearer rk_test_fixture" {
			t.Error("unexpected Stripe credential")
		}
		switch r.Method + " " + r.URL.Path {
		case "POST /v1/checkout/sessions":
			creates++
			if err := r.ParseForm(); err != nil {
				t.Error(err)
			}
			for key, want := range map[string]string{
				"mode": "payment", "adaptive_pricing[enabled]": "false", "integration_identifier": integrationIdentifier,
				"client_reference_id": request.MerchantOrderNo, "metadata[" + configMetadataKey + "]": request.ProviderConfigID,
				"success_url": request.ReturnURL, "cancel_url": request.ReturnURL, "expires_at": strconv.FormatInt(request.ExpiresAt.Unix(), 10),
				"line_items[0][price_data][currency]": "usd", "line_items[0][price_data][unit_amount]": "125",
				"line_items[0][price_data][product_data][name]": request.Description, "line_items[0][quantity]": "1",
			} {
				if got := r.Form.Get(key); got != want {
					t.Errorf("%s = %q, want %q", key, got, want)
				}
			}
			if strings.Contains(r.Form.Encode(), "payment_method_types") || r.Header.Get("Idempotency-Key") != "supdance-checkout-"+request.MerchantOrderNo {
				t.Error("checkout creation changed the idempotency key or pinned payment methods")
			}
		case "GET /v1/checkout/sessions/cs_test_fixture":
		case "POST /v1/checkout/sessions/cs_test_fixture/expire":
			status = "expired"
		default:
			t.Errorf("unexpected Stripe API request: %s %s", r.Method, r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"object": "checkout.session", "id": "cs_test_fixture", "mode": "payment", "status": status, "payment_status": paymentStatus,
			"client_reference_id": request.MerchantOrderNo, "metadata": map[string]string{configMetadataKey: request.ProviderConfigID},
			"amount_total": 125, "currency": "usd", "url": "https://checkout.stripe.com/c/pay/fixture", "expires_at": request.ExpiresAt.Unix(),
		})
	}))
	defer server.Close()
	p := &Provider{backends: stripe.NewBackendsWithConfig(&stripe.BackendConfig{URL: stripe.String(server.URL)})}
	cfg := stripeTestConfig()
	ctx := t.Context()
	unauthorized := request
	unauthorized.UserID = "another-user"
	if _, err := p.CreateOrder(ctx, cfg, unauthorized); err == nil {
		t.Fatal("sandbox accepted a different reviewer")
	}
	first, err := p.CreateOrder(ctx, cfg, request)
	if err != nil || first.ProviderTradeNo != "cs_test_fixture" || first.Mode != "redirect" || first.Value == "" {
		t.Fatalf("create checkout = %#v, %v", first, err)
	}
	if retried, err := p.CreateOrder(ctx, cfg, request); err != nil || retried != first {
		t.Fatalf("retry without a locally stored session = %#v, %v", retried, err)
	}
	request.ProviderTradeNo = first.ProviderTradeNo
	refreshed, err := p.CreateOrder(ctx, cfg, request)
	mu.Lock()
	createCalls := creates
	mu.Unlock()
	if err != nil || refreshed != first || createCalls != 2 {
		t.Fatalf("refresh = %#v, %v, create calls=%d", refreshed, err, createCalls)
	}
	query := sdk.QueryRequest{MerchantOrderNo: request.MerchantOrderNo, ProviderTradeNo: first.ProviderTradeNo}
	if result, err := p.QueryOrder(ctx, cfg, query); err != nil || result.Paid || result.Closed {
		t.Fatalf("open checkout = %#v, %v", result, err)
	}
	if _, err := p.QueryOrder(ctx, cfg, sdk.QueryRequest{MerchantOrderNo: request.MerchantOrderNo}); !errors.Is(err, sdk.ErrOrderNotFound) {
		t.Fatalf("query without session ID = %v", err)
	}
	if _, err := p.CloseOrder(ctx, cfg, sdk.CloseRequest{MerchantOrderNo: request.MerchantOrderNo, ExpiresAt: &request.ExpiresAt}); err == nil || errors.Is(err, sdk.ErrOrderNotFound) {
		t.Fatalf("unconfirmed checkout can still be payable: %v", err)
	}
	closeRequest := sdk.CloseRequest{MerchantOrderNo: request.MerchantOrderNo, ProviderTradeNo: first.ProviderTradeNo}
	setPaymentState := func(sessionStatus, newPaymentStatus string) {
		mu.Lock()
		defer mu.Unlock()
		status, paymentStatus = sessionStatus, newPaymentStatus
	}
	setPaymentState("complete", "unpaid")
	if _, err := p.CloseOrder(ctx, cfg, closeRequest); err == nil {
		t.Fatal("closed a completed checkout while delayed payment was pending")
	}
	setPaymentState("complete", "paid")
	if result, err := p.CloseOrder(ctx, cfg, closeRequest); err != nil || !result.Paid || result.Closed {
		t.Fatalf("paid checkout = %#v, %v", result, err)
	}
	setPaymentState("open", "unpaid")
	if result, err := p.CloseOrder(ctx, cfg, closeRequest); err != nil || !result.Closed || result.Paid {
		t.Fatalf("closed checkout = %#v, %v", result, err)
	}
}

func TestStripeWebhookStatesAndSignatures(t *testing.T) {
	p := New()
	cfg := stripeTestConfig()
	for _, tc := range []struct {
		name, kind, status, paymentStatus string
		live, tampered, stale             bool
		paid, closed, ignored, wantErr    bool
	}{
		{name: "paid", kind: "checkout.session.completed", status: "complete", paymentStatus: "paid", paid: true},
		{name: "pending", kind: "checkout.session.completed", status: "complete", paymentStatus: "unpaid"},
		{name: "delayed success", kind: "checkout.session.async_payment_succeeded", status: "complete", paymentStatus: "paid", paid: true},
		{name: "delayed failure", kind: "checkout.session.async_payment_failed", status: "complete", paymentStatus: "unpaid", closed: true},
		{name: "expired", kind: "checkout.session.expired", status: "expired", paymentStatus: "unpaid", closed: true},
		{name: "unrelated", kind: "payment_intent.succeeded", ignored: true},
		{name: "live in sandbox", kind: "checkout.session.completed", status: "complete", paymentStatus: "paid", live: true, wantErr: true},
		{name: "tampered bytes", kind: "checkout.session.completed", status: "complete", paymentStatus: "paid", tampered: true, wantErr: true},
		{name: "expired signature", kind: "checkout.session.completed", status: "complete", paymentStatus: "paid", stale: true, wantErr: true},
		{name: "inconsistent success", kind: "checkout.session.async_payment_succeeded", status: "complete", paymentStatus: "unpaid", wantErr: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			now := time.Now()
			payload, err := json.Marshal(map[string]any{
				"object": "event", "id": "evt_fixture", "type": tc.kind, "created": now.Unix(), "livemode": tc.live,
				"data": map[string]any{"object": map[string]any{
					"object": "checkout.session", "id": "cs_test_fixture", "client_reference_id": "merchant-order",
					"metadata": map[string]string{configMetadataKey: "config-version"}, "livemode": tc.live, "mode": "payment",
					"amount_total": 125, "currency": "usd", "status": tc.status, "payment_status": tc.paymentStatus,
				}},
			})
			if err != nil {
				t.Fatal(err)
			}
			signingTime := now
			if tc.stale {
				signingTime = now.Add(-10 * time.Minute)
			}
			signed := webhook.GenerateTestSignedPayload(&webhook.UnsignedPayload{Payload: payload, Secret: cfg["webhookSigningSecret"], Timestamp: signingTime})
			if tc.tampered {
				payload = append(payload, ' ')
			}
			headers := http.Header{"Stripe-Signature": {signed.Header}}
			got, err := p.VerifyNotification(t.Context(), cfg, headers, payload)
			if (err != nil) != tc.wantErr || got.Paid != tc.paid || got.Closed != tc.closed || got.Ignored != tc.ignored {
				t.Fatalf("notification = %#v, %v", got, err)
			}
			if !tc.wantErr && !tc.ignored && (got.EventID != "evt_fixture" || got.ProviderConfigID != "config-version" || got.AmountFen != 125 || got.Currency != "USD" || got.PaidAt.IsZero() == got.Paid) {
				t.Fatalf("normalized notification = %#v", got)
			}
		})
	}
}

func TestStripeSandboxCheckout(t *testing.T) {
	key := os.Getenv("SUPDANCE_STRIPE_SANDBOX_API_KEY")
	if key == "" {
		t.Skip("Stripe sandbox API key unavailable")
	}
	if !hasCredentialPrefix(key, "rk_test_") && !hasCredentialPrefix(key, "sk_test_") {
		t.Fatal("sandbox test only accepts a Stripe test credential")
	}
	cfg := stripeTestConfig()
	cfg["apiKey"] = key
	p := New()
	request := stripeTestOrder()
	request.MerchantOrderNo = "supdance-qa-" + strconv.FormatInt(time.Now().UnixNano(), 10)
	checkout, err := p.CreateOrder(t.Context(), cfg, request)
	if err != nil {
		t.Fatal(err)
	}
	closeRequest := sdk.CloseRequest{MerchantOrderNo: request.MerchantOrderNo, ProviderTradeNo: checkout.ProviderTradeNo}
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		if result, err := p.CloseOrder(ctx, cfg, closeRequest); err != nil || !result.Closed {
			t.Errorf("expire sandbox checkout = %#v, %v", result, err)
		}
	})
	query, err := p.QueryOrder(t.Context(), cfg, sdk.QueryRequest{MerchantOrderNo: request.MerchantOrderNo, ProviderTradeNo: checkout.ProviderTradeNo})
	if err != nil || query.Paid || query.Closed || query.Currency != "USD" || query.AmountFen != request.AmountFen {
		t.Fatalf("read sandbox checkout = %#v, %v", query, err)
	}
}

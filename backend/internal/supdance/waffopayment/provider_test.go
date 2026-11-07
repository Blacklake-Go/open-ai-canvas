package waffopayment

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/waffo-com/waffo-go/v2/core"
	waffonet "github.com/waffo-com/waffo-go/v2/net"
	"github.com/waffo-com/waffo-go/v2/utils"
	sdk "yingce/backend/payment-sdk"
)

type transportFunc func(context.Context, *waffonet.HttpRequest) (*waffonet.HttpResponse, error)

func (f transportFunc) Send(ctx context.Context, req *waffonet.HttpRequest) (*waffonet.HttpResponse, error) {
	return f(ctx, req)
}

func testKeys(t *testing.T) (string, string) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	private, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatal(err)
	}
	public, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	if err != nil {
		t.Fatal(err)
	}
	return base64.StdEncoding.EncodeToString(private), base64.StdEncoding.EncodeToString(public)
}

func testConfig(t *testing.T) (sdk.Config, string, string) {
	private, public := testKeys(t)
	waffoPrivate, waffoPublic := testKeys(t)
	return sdk.Config{
		"environment": "SANDBOX", "merchantId": "1000011727", "apiKey": "fixture",
		"privateKey": private, "waffoPublicKey": waffoPublic, "allowedUserId": strings.Repeat("a", 32),
		"publicBaseUrl": "https://wallet.example", "goodsUrl": "https://wallet.example/pricing",
	}, public, waffoPrivate
}

func signedResponse(t *testing.T, key, code string, data any) *waffonet.HttpResponse {
	t.Helper()
	body, err := json.Marshal(map[string]any{"code": code, "data": data})
	if err != nil {
		t.Fatal(err)
	}
	signature, err := utils.Sign(string(body), key)
	if err != nil {
		t.Fatal(err)
	}
	return waffonet.NewHttpResponse(200, map[string]string{"X-SIGNATURE": signature}, body)
}

func TestCheckoutUsesStablePersistedIDAndRealUser(t *testing.T) {
	values, public, serverPrivate := testConfig(t)
	ref := strings.Repeat("b", 32)
	provider := &Provider{transport: transportFunc(func(_ context.Context, req *waffonet.HttpRequest) (*waffonet.HttpResponse, error) {
		if !utils.Verify(string(req.Body), req.Headers["X-SIGNATURE"], public) {
			t.Fatal("merchant signature invalid")
		}
		var body map[string]any
		if err := json.Unmarshal(req.Body, &body); err != nil {
			t.Fatal(err)
		}
		if body["paymentRequestId"] != ref || body["merchantOrderId"] != ref || body["orderAmount"] != "1.43" || body["orderCurrency"] != "USD" {
			t.Fatalf("incorrect order mapping: %#v", body)
		}
		user := body["userInfo"].(map[string]any)
		if user["userId"] != values["allowedUserId"] || user["userEmail"] != "reviewer@example.com" || user["userTerminal"] != "WEB" {
			t.Fatal("user mapping incorrect")
		}
		for _, field := range []string{"successRedirectUrl", "failedRedirectUrl", "cancelRedirectUrl", "notifyUrl"} {
			if body[field] == nil || body[field] == "" {
				t.Fatalf("missing %s", field)
			}
		}
		return signedResponse(t, serverPrivate, "0", map[string]any{"paymentRequestId": ref, "merchantOrderId": ref, "acquiringOrderId": "acq-id", "orderStatus": "PAY_IN_PROGRESS", "orderAction": `{"actionType":"REDIRECT","webUrl":"https://checkout.example/pay"}`}), nil
	})}
	request := sdk.CreateRequest{MerchantOrderNo: ref, AmountFen: 143, Currency: "USD", Description: "Wallet credits", UserID: values["allowedUserId"], UserEmail: "reviewer@example.com", ExpiresAt: time.Now().Add(time.Minute), NotifyURL: "https://wallet.example/notify", ReturnURL: "https://wallet.example/return"}
	checkout, err := provider.CreateOrder(context.Background(), values, request)
	if err != nil || checkout.ProviderTradeNo != "acq-id" || checkout.Value != "https://checkout.example/pay" {
		t.Fatalf("checkout=%#v error=%v", checkout, err)
	}
	request.UserID = strings.Repeat("c", 32)
	if _, err = provider.CreateOrder(context.Background(), values, request); err == nil {
		t.Fatal("sandbox user restriction bypassed")
	}
}

func TestWebhookVerifiesScopeAndReturnsSignedAcknowledgement(t *testing.T) {
	values, public, serverPrivate := testConfig(t)
	ref := strings.Repeat("b", 32)
	event := core.PaymentNotification{EventType: core.EventPayment, Result: &core.PaymentNotificationResult{
		PaymentRequestID: ref, MerchantOrderID: ref, AcquiringOrderID: "acq-id", OrderStatus: "PAY_SUCCESS", OrderCurrency: "USD", OrderAmount: "1.43000000", FinalDealAmount: "1.43000000", OrderCompletedAt: "2026-11-07T04:00:00Z",
		MerchantInfo: map[string]any{"merchantId": values["merchantId"]}, UserInfo: map[string]any{"userId": values["allowedUserId"]}, PaymentInfo: map[string]any{"productName": "ONE_TIME_PAYMENT"},
	}}
	body, _ := json.Marshal(event)
	signature, _ := utils.Sign(string(body), serverPrivate)
	headers := http.Header{"X-Signature": []string{signature}}
	provider := New()
	notification, err := provider.VerifyNotification(context.Background(), values, headers, body)
	if err != nil || !notification.Paid || notification.AmountFen != 143 || notification.Response == nil {
		t.Fatalf("verification: %#v %v", notification, err)
	}
	if notification.Response.Body != `{"message":"success"}` || !utils.Verify(notification.Response.Body, notification.Response.Signature, public) {
		t.Fatal("invalid signed acknowledgement")
	}
	if _, err = provider.VerifyNotification(context.Background(), values, headers, append(body, ' ')); err == nil {
		t.Fatal("tampered body accepted")
	}
	event.Result.UserInfo["userId"] = strings.Repeat("c", 32)
	body, _ = json.Marshal(event)
	signature, _ = utils.Sign(string(body), serverPrivate)
	headers.Set("X-SIGNATURE", signature)
	if _, err = provider.VerifyNotification(context.Background(), values, headers, body); err == nil {
		t.Fatal("other buyer accepted")
	}
}

func TestUnknownCheckoutRecoversWithOriginalRequestID(t *testing.T) {
	values, _, serverPrivate := testConfig(t)
	ref := strings.Repeat("b", 32)
	var calls []string
	provider := &Provider{transport: transportFunc(func(_ context.Context, req *waffonet.HttpRequest) (*waffonet.HttpResponse, error) {
		var body map[string]any
		if err := json.Unmarshal(req.Body, &body); err != nil {
			t.Fatal(err)
		}
		if body["paymentRequestId"] != ref {
			t.Fatal("recovery changed the persisted request ID")
		}
		calls = append(calls, req.URL)
		if len(calls) == 1 {
			if !strings.Contains(req.URL, "create") {
				t.Fatal("first operation must create")
			}
			return signedResponse(t, serverPrivate, "E0001", nil), nil
		}
		if len(calls) != 2 || !strings.Contains(req.URL, "inquiry") {
			t.Fatal("unknown creation must inquire, never create again")
		}
		return signedResponse(t, serverPrivate, "0", map[string]any{"paymentRequestId": ref, "merchantOrderId": ref, "acquiringOrderId": "recovered-acq", "orderAction": `{"webUrl":"https://checkout.example/recovered"}`}), nil
	})}
	request := sdk.CreateRequest{MerchantOrderNo: ref, AmountFen: 143, Currency: "USD", Description: "Wallet credits", UserID: values["allowedUserId"], UserEmail: "reviewer@example.com", ExpiresAt: time.Now().Add(time.Minute), NotifyURL: "https://wallet.example/notify", ReturnURL: "https://wallet.example/return"}
	checkout, err := provider.CreateOrder(context.Background(), values, request)
	if err != nil || checkout.ProviderTradeNo != "recovered-acq" || len(calls) != 2 {
		t.Fatalf("recovery = %#v, %v, calls=%v", checkout, err, calls)
	}
}

func TestUnknownCancellationDoesNotClosePendingOrder(t *testing.T) {
	values, _, serverPrivate := testConfig(t)
	ref := strings.Repeat("b", 32)
	provider := &Provider{transport: transportFunc(func(_ context.Context, req *waffonet.HttpRequest) (*waffonet.HttpResponse, error) {
		if strings.HasSuffix(req.URL, "/cancel") {
			return signedResponse(t, serverPrivate, "E0001", nil), nil
		}
		return signedResponse(t, serverPrivate, "0", map[string]any{
			"paymentRequestId": ref, "merchantOrderId": ref, "acquiringOrderId": "acq-id", "orderStatus": "PAY_IN_PROGRESS", "orderCurrency": "USD", "orderAmount": "1.43",
			"merchantInfo": map[string]any{"merchantId": values["merchantId"]}, "userInfo": map[string]any{"userId": values["allowedUserId"]}, "paymentInfo": map[string]any{"productName": "ONE_TIME_PAYMENT"},
		}), nil
	})}
	result, err := provider.CloseOrder(context.Background(), values, sdk.CloseRequest{MerchantOrderNo: ref})
	if err == nil || result.Closed {
		t.Fatal("unconfirmed cancellation was treated as closed")
	}
}

func TestAmountPrecision(t *testing.T) {
	for _, v := range []string{"1.43", "1.43000000"} {
		cents, err := amountFen(v)
		if err != nil || cents != 143 {
			t.Fatalf("amount=%s cents=%d err=%v", v, cents, err)
		}
	}
	for _, v := range []string{"1.431", "-1.43", "1e2"} {
		if _, err := amountFen(v); err == nil {
			t.Fatalf("invalid amount accepted: %s", v)
		}
	}
}

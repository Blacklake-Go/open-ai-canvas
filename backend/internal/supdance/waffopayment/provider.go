// Package waffopayment adapts the enterprise Waffo SDK to the host payment ABI.
package waffopayment

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/mail"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	waffo "github.com/waffo-com/waffo-go/v2"
	"github.com/waffo-com/waffo-go/v2/config"
	"github.com/waffo-com/waffo-go/v2/core"
	waffoerrors "github.com/waffo-com/waffo-go/v2/errors"
	waffonet "github.com/waffo-com/waffo-go/v2/net"
	"github.com/waffo-com/waffo-go/v2/types/merchant"
	"github.com/waffo-com/waffo-go/v2/types/order"
	"yingce/backend/internal/outbound"
	sdk "yingce/backend/payment-sdk"
)

const ProviderID = "waffo-enterprise"
const PluginID = "supdance-payment-waffo-enterprise"

var orderIDPattern = regexp.MustCompile(`^[a-f0-9]{32}$`)
var merchantPattern = regexp.MustCompile(`^[0-9]{6,20}$`)
var moneyPattern = regexp.MustCompile(`^[0-9]{1,14}(\.[0-9]{1,8})?$`)
var codePattern = regexp.MustCompile(`^[A-Z][0-9]{4}$`)

type Provider struct {
	// Tests inject a transport while preserving SDK signing and verification.
	transport waffonet.HttpTransport
}

func New() *Provider { return &Provider{} }

func (p *Provider) Descriptor() sdk.Descriptor {
	return sdk.Descriptor{ID: ProviderID, PluginID: PluginID, PluginVersion: "1.0.1", Name: "Waffo Enterprise Sandbox", Icon: "CreditCard", CheckoutMode: "redirect"}
}

func failure(code, message string) error {
	return &sdk.ProviderError{Code: code, Message: message}
}

func validHTTPS(value string) bool {
	u, err := url.Parse(value)
	return err == nil && u.Scheme == "https" && u.Hostname() != "" && u.User == nil && u.Fragment == ""
}

func (p *Provider) client(values sdk.Config) (*waffo.Waffo, error) {
	if values["environment"] == string(config.Production) {
		panic("WAFFO_DECISION_REQUIRED: production go-live questions are unconfirmed; sandbox only")
	}
	if values["environment"] != string(config.Sandbox) || !merchantPattern.MatchString(values["merchantId"]) ||
		!orderIDPattern.MatchString(values["allowedUserId"]) || !validHTTPS(values["publicBaseUrl"]) ||
		!validHTTPS(values["goodsUrl"]) {
		return nil, failure("invalid_config", "Check sandbox environment, merchant, allowed user and HTTPS URLs")
	}
	transport := p.transport
	if transport == nil {
		client := outbound.OutboundHTTPClient(10 * time.Second)
		client.CheckRedirect = func(*http.Request, []*http.Request) error { return errors.New("redirect refused") }
		transport = &signedTransport{http: client}
	}
	cfg, err := config.NewConfigBuilder().
		APIKey(values["apiKey"]).PrivateKey(values["privateKey"]).WaffoPublicKey(values["waffoPublicKey"]).
		MerchantID(values["merchantId"]).Environment(config.Sandbox).
		ConnectTimeout(5000).ReadTimeout(10000).CustomTransport(transport).Build()
	if err != nil {
		return nil, failure("invalid_config", "Invalid Waffo enterprise API credentials")
	}
	return waffo.New(cfg), nil
}

func (p *Provider) ValidateConfig(values sdk.Config) error {
	_, err := p.client(values)
	return err
}

// ValidateRemote reads the contracted methods without opening a payment.
func (p *Provider) ValidateRemote(ctx context.Context, values sdk.Config) (*merchant.InquiryPayMethodConfigData, error) {
	client, err := p.client(values)
	if err != nil {
		return nil, err
	}
	response, err := client.PayMethodConfig().Inquiry(ctx, &merchant.InquiryPayMethodConfigParams{}, nil)
	if err != nil {
		return nil, failure("waffo_query_failed", "Waffo payment method query failed")
	}
	if response == nil || !response.IsSuccess() || response.GetData() == nil {
		return nil, failure("waffo_query_failed", "Waffo payment method query was rejected")
	}
	return response.GetData(), nil
}

func (p *Provider) CreateOrder(ctx context.Context, values sdk.Config, request sdk.CreateRequest) (sdk.Checkout, error) {
	client, err := p.client(values)
	if err != nil {
		return sdk.Checkout{}, err
	}
	email, emailErr := mail.ParseAddress(request.UserEmail)
	if !orderIDPattern.MatchString(request.MerchantOrderNo) || request.UserID != values["allowedUserId"] ||
		emailErr != nil || email.Address != request.UserEmail || request.AmountFen <= 0 ||
		(request.Currency != "CNY" && request.Currency != "USD") || !validHTTPS(request.NotifyURL) || !validHTTPS(request.ReturnURL) ||
		strings.TrimSpace(request.Description) == "" || !request.ExpiresAt.After(time.Now()) {
		return sdk.Checkout{}, failure("invalid_request", "Invalid Waffo sandbox order or test account")
	}
	params := &order.CreateOrderParams{
		PaymentRequestID: request.MerchantOrderNo, MerchantOrderID: request.MerchantOrderNo,
		OrderCurrency: request.Currency, OrderAmount: fmt.Sprintf("%d.%02d", request.AmountFen/100, request.AmountFen%100),
		OrderDescription: request.Description, OrderExpiredAt: request.ExpiresAt.UTC().Format("2006-01-02T15:04:05.000Z"),
		NotifyURL: request.NotifyURL, SuccessRedirectURL: request.ReturnURL, FailedRedirectURL: request.ReturnURL, CancelRedirectURL: request.ReturnURL,
		UserInfo:    &order.UserInfo{UserID: request.UserID, UserEmail: request.UserEmail, UserTerminal: "WEB"},
		GoodsInfo:   &order.GoodsInfo{GoodsID: request.ProductID, GoodsName: request.Description, GoodsURL: values["goodsUrl"]},
		PaymentInfo: &order.PaymentInfo{ProductName: "ONE_TIME_PAYMENT"},
	}
	response, err := client.Order().Create(ctx, params, nil)
	var unknown *waffoerrors.WaffoUnknownStatusError
	if errors.As(err, &unknown) || (response != nil && response.GetCode() == "E0001") {
		data, queryErr := inquiry(ctx, client, request.MerchantOrderNo)
		if queryErr != nil {
			return sdk.Checkout{}, failure("payment_status_unknown", "Payment status is pending confirmation; retry this order")
		}
		return checkout(data.PaymentRequestID, data.MerchantOrderID, data.AcquiringOrderID, data.OrderAction, request)
	}
	if err != nil {
		return sdk.Checkout{}, failure("waffo_create_failed", "Waffo could not create checkout; retry this order")
	}
	if response == nil || !response.IsSuccess() || response.GetData() == nil {
		code := "waffo_create_rejected"
		if response != nil && codePattern.MatchString(response.GetCode()) {
			code += "_" + response.GetCode()
		}
		return sdk.Checkout{}, failure(code, "Waffo rejected checkout; check channel settings or try another payment method")
	}
	data := response.GetData()
	return checkout(data.PaymentRequestID, data.MerchantOrderID, data.AcquiringOrderID, data.OrderAction, request)
}

func checkout(paymentID, merchantID, acquiringID, rawAction string, request sdk.CreateRequest) (sdk.Checkout, error) {
	if paymentID != request.MerchantOrderNo || merchantID != request.MerchantOrderNo || acquiringID == "" {
		return sdk.Checkout{}, failure("payment_evidence_mismatch", "Waffo returned a different order identity")
	}
	var action order.OrderAction
	if json.Unmarshal([]byte(rawAction), &action) != nil || !validHTTPS(action.WebURL) {
		return sdk.Checkout{}, failure("invalid_checkout", "Waffo did not return an HTTPS checkout URL; query this order")
	}
	return sdk.Checkout{Mode: "redirect", Value: action.WebURL, ExpiresAt: request.ExpiresAt, ProviderTradeNo: acquiringID}, nil
}

func inquiry(ctx context.Context, client *waffo.Waffo, ref string) (*order.InquiryOrderData, error) {
	if !orderIDPattern.MatchString(ref) {
		return nil, failure("invalid_request", "Invalid payment request ID")
	}
	response, err := client.Order().Inquiry(ctx, &order.InquiryOrderParams{PaymentRequestID: ref}, nil)
	if err != nil || response == nil || !response.IsSuccess() || response.GetData() == nil {
		return nil, failure("waffo_query_failed", "Waffo could not confirm payment status")
	}
	return response.GetData(), nil
}

func (p *Provider) QueryOrder(ctx context.Context, values sdk.Config, request sdk.QueryRequest) (sdk.Result, error) {
	client, err := p.client(values)
	if err != nil {
		return sdk.Result{}, err
	}
	data, err := inquiry(ctx, client, request.MerchantOrderNo)
	if err != nil {
		return sdk.Result{}, err
	}
	if data.MerchantInfo == nil || data.MerchantInfo.MerchantID != values["merchantId"] ||
		data.UserInfo == nil || data.UserInfo.UserID != values["allowedUserId"] ||
		data.PaymentInfo == nil || data.PaymentInfo.ProductName != "ONE_TIME_PAYMENT" {
		return sdk.Result{}, failure("payment_evidence_mismatch", "Waffo merchant, buyer or payment product mismatch")
	}
	return result(request.MerchantOrderNo, data.PaymentRequestID, data.MerchantOrderID, data.AcquiringOrderID, data.OrderStatus, data.OrderCurrency, data.OrderAmount, data.FinalDealAmount, data.OrderCompletedAt)
}

func (p *Provider) CloseOrder(ctx context.Context, values sdk.Config, request sdk.CloseRequest) (sdk.Result, error) {
	current, err := p.QueryOrder(ctx, values, sdk.QueryRequest{MerchantOrderNo: request.MerchantOrderNo})
	if err != nil || current.Paid || current.Closed {
		return current, err
	}
	client, err := p.client(values)
	if err != nil {
		return sdk.Result{}, err
	}
	response, err := client.Order().Cancel(ctx, &order.CancelOrderParams{PaymentRequestID: request.MerchantOrderNo}, nil)
	var unknown *waffoerrors.WaffoUnknownStatusError
	uncertain := errors.As(err, &unknown) || (response != nil && response.GetCode() == "E0001")
	if !uncertain && (err != nil || response == nil || !response.IsSuccess() || response.GetData() == nil) {
		return sdk.Result{}, failure("waffo_close_failed", "Waffo did not confirm order cancellation")
	}
	current, err = p.QueryOrder(ctx, values, sdk.QueryRequest{MerchantOrderNo: request.MerchantOrderNo})
	if err != nil {
		return sdk.Result{}, err
	}
	if !current.Paid && !current.Closed {
		return sdk.Result{}, failure("payment_status_unknown", "Waffo cancellation remains unconfirmed")
	}
	return current, nil
}

func amountFen(value string) (int64, error) {
	if !moneyPattern.MatchString(value) {
		return 0, failure("invalid_amount", "Invalid Waffo amount")
	}
	parts := strings.SplitN(value, ".", 2)
	whole, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return 0, failure("invalid_amount", "Invalid Waffo amount")
	}
	fraction := "00"
	if len(parts) == 2 {
		if len(parts[1]) > 2 && strings.Trim(parts[1][2:], "0") != "" {
			return 0, failure("invalid_amount", "Waffo amount contains fractional minor units")
		}
		fraction = (parts[1] + "0")[:2]
	}
	cents, _ := strconv.ParseInt(fraction, 10, 64)
	return whole*100 + cents, nil
}

func result(ref, paymentID, merchantID, acquiringID, status, currency, amount, finalAmount, completed string) (sdk.Result, error) {
	if ref != paymentID || ref != merchantID || acquiringID == "" || (currency != "CNY" && currency != "USD") {
		return sdk.Result{}, failure("payment_evidence_mismatch", "Waffo order identity or currency mismatch")
	}
	cents, err := amountFen(amount)
	if err != nil || cents <= 0 {
		return sdk.Result{}, failure("invalid_amount", "Invalid Waffo order amount")
	}
	value := sdk.Result{MerchantOrderNo: ref, ProviderTradeNo: acquiringID, ProviderStatus: status, AmountFen: cents, Currency: currency}
	switch status {
	case "PAY_SUCCESS":
		charged, err := amountFen(finalAmount)
		if err != nil || charged != cents {
			return sdk.Result{}, failure("payment_evidence_mismatch", "Waffo charged amount mismatch")
		}
		value.PaidAt, err = time.Parse(time.RFC3339Nano, completed)
		if err != nil {
			return sdk.Result{}, failure("invalid_payment_time", "Invalid Waffo payment completion time")
		}
		value.Paid = true
	case "ORDER_CLOSE":
		value.Closed = true
	case "PAY_IN_PROGRESS", "AUTHORIZATION_REQUIRED", "AUTHED_WAITING_CAPTURE":
	default:
		return sdk.Result{}, failure("unknown_payment_status", "Unrecognized Waffo payment status")
	}
	return value, nil
}

func (p *Provider) VerifyNotification(ctx context.Context, values sdk.Config, headers http.Header, body []byte) (sdk.Notification, error) {
	client, err := p.client(values)
	if err != nil {
		return sdk.Notification{}, err
	}
	if len(headers.Values("X-SIGNATURE")) != 1 {
		return sdk.Notification{}, failure("invalid_notification", "Missing or ambiguous Waffo signature")
	}
	var notification sdk.Notification
	var parseErr error
	handled := false
	handler := client.Webhook().OnPayment(func(event *core.PaymentNotification) {
		handled = true
		if event == nil || event.Result == nil {
			parseErr = errors.New("missing payment")
			return
		}
		data := event.Result
		if data.MerchantInfo["merchantId"] != values["merchantId"] || data.UserInfo["userId"] != values["allowedUserId"] ||
			data.PaymentInfo["productName"] != "ONE_TIME_PAYMENT" {
			parseErr = errors.New("payment scope mismatch")
			return
		}
		notification.Result, parseErr = result(data.PaymentRequestID, data.PaymentRequestID, data.MerchantOrderID,
			data.AcquiringOrderID, data.OrderStatus, data.OrderCurrency, data.OrderAmount, data.FinalDealAmount, data.OrderCompletedAt)
	})
	response := handler.HandleWebhook(string(body), headers.Get("X-SIGNATURE"))
	if !response.Success || !handled || parseErr != nil {
		return sdk.Notification{}, failure("invalid_notification", "Waffo payment signature or evidence validation failed")
	}
	digest := sha256.Sum256(body)
	notification.EventID = hex.EncodeToString(digest[:])
	notification.Response = &sdk.NotificationResponse{Status: http.StatusOK, ContentType: "application/json", Body: response.ResponseBody, Signature: response.ResponseSignature}
	return notification, nil
}

func (p *Provider) DownloadTradeBill(context.Context, sdk.Config, time.Time) ([]sdk.BillRecord, error) {
	return nil, failure("unsupported_operation", "Enterprise sandbox trade bills are not integrated")
}

type signedTransport struct{ http *http.Client }

func (t *signedTransport) Send(ctx context.Context, request *waffonet.HttpRequest) (*waffonet.HttpResponse, error) {
	u, err := url.Parse(request.URL)
	if err != nil || u.Scheme != "https" || u.Host != "api-sandbox.waffo.com" {
		return nil, errors.New("unexpected Waffo endpoint")
	}
	req, err := http.NewRequestWithContext(ctx, request.Method, request.URL, bytes.NewReader(request.Body))
	if err != nil {
		return nil, err
	}
	for name, value := range request.Headers {
		req.Header.Set(name, value)
	}
	response, err := t.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, (2<<20)+1))
	if err != nil || len(body) > 2<<20 {
		return nil, errors.New("invalid Waffo response size")
	}
	if response.StatusCode >= 200 && response.StatusCode < 300 && response.Header.Get("X-SIGNATURE") == "" {
		return nil, errors.New("missing Waffo response signature")
	}
	headers := make(map[string]string)
	for name := range response.Header {
		headers[name] = response.Header.Get(name)
	}
	return waffonet.NewHttpResponse(response.StatusCode, headers, body), nil
}

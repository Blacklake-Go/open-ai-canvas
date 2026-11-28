package stripepayment

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/stripe/stripe-go/v87"
	sdk "yingce/backend/payment-sdk"
)

const (
	configMetadataKey     = "supdance_payment_config"
	integrationIdentifier = "supdance-checkout-mzprwjtf"
)

type Provider struct {
	backends *stripe.Backends
}

var _ sdk.Provider = (*Provider)(nil)

func New() *Provider {
	return &Provider{backends: stripe.NewBackendsWithConfig(&stripe.BackendConfig{
		HTTPClient:        &http.Client{Timeout: 8 * time.Second},
		EnableTelemetry:   stripe.Bool(false),
		LeveledLogger:     &stripe.LeveledLogger{Level: stripe.LevelNull},
		MaxNetworkRetries: stripe.Int64(1),
	})}
}

func (*Provider) Descriptor() sdk.Descriptor {
	return sdk.Descriptor{ID: "stripe", PluginID: "supdance-payment-stripe", Name: "Stripe", Icon: "brand:stripe", CheckoutMode: "redirect"}
}

func (*Provider) ValidateConfig(values sdk.Config) error {
	mode := values["mode"]
	if mode != "test" && mode != "live" {
		return errors.New("Stripe mode must be test or live")
	}
	if !hasCredentialPrefix(values["apiKey"], "rk_"+mode+"_") && !hasCredentialPrefix(values["apiKey"], "sk_"+mode+"_") {
		return errors.New("Stripe API key must match the selected mode")
	}
	if !hasCredentialPrefix(values["webhookSigningSecret"], "whsec_") {
		return errors.New("Stripe webhook signing secret is required")
	}
	if mode == "test" && strings.TrimSpace(values["allowedUserId"]) == "" {
		return errors.New("Stripe test mode requires a reviewer user ID")
	}
	switch values["settlementCurrency"] {
	case "USD", "CNY":
	default:
		return errors.New("Stripe settlement currency must be USD or CNY")
	}
	if _, err := checkoutURL(values["publicBaseUrl"], mode == "test"); err != nil {
		return errors.New("Stripe site URL must use HTTPS, or loopback HTTP in test mode")
	}
	return nil
}

func hasCredentialPrefix(value, prefix string) bool {
	return strings.HasPrefix(value, prefix) && len(value) > len(prefix) && !strings.ContainsAny(value, " \r\t\n")
}

func checkoutURL(raw string, allowLoopbackHTTP bool) (*url.URL, error) {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Hostname() == "" || parsed.User != nil {
		return nil, errors.New("invalid Stripe checkout URL")
	}
	if parsed.Scheme == "https" || (allowLoopbackHTTP && parsed.Scheme == "http" &&
		(strings.EqualFold(parsed.Hostname(), "localhost") || net.ParseIP(parsed.Hostname()).IsLoopback())) {
		return parsed, nil
	}
	return nil, errors.New("invalid Stripe checkout URL scheme")
}

func (p *Provider) client(values sdk.Config) *stripe.Client {
	return stripe.NewClient(values["apiKey"], stripe.WithBackends(p.backends))
}

func (p *Provider) CreateOrder(ctx context.Context, values sdk.Config, request sdk.CreateRequest) (sdk.Checkout, error) {
	if err := p.ValidateConfig(values); err != nil {
		return sdk.Checkout{}, err
	}
	if reviewer := values["allowedUserId"]; reviewer != "" && reviewer != request.UserID {
		return sdk.Checkout{}, errors.New("Stripe checkout is restricted to the configured reviewer")
	}
	if request.MerchantOrderNo == "" || request.ProviderConfigID == "" || request.AmountFen <= 0 ||
		request.Currency != values["settlementCurrency"] || strings.TrimSpace(request.Description) == "" || request.ExpiresAt.IsZero() {
		return sdk.Checkout{}, errors.New("invalid Stripe order snapshot")
	}
	returnURL, err := checkoutURL(request.ReturnURL, values["mode"] == "test")
	if err != nil {
		return sdk.Checkout{}, err
	}
	client := p.client(values)
	var session *stripe.CheckoutSession
	if request.ProviderTradeNo != "" {
		session, err = p.retrieve(ctx, client, request.ProviderTradeNo)
	} else {
		params := &stripe.CheckoutSessionCreateParams{
			Mode:                  stripe.String("payment"),
			ClientReferenceID:     stripe.String(request.MerchantOrderNo),
			SuccessURL:            stripe.String(returnURL.String()),
			CancelURL:             stripe.String(returnURL.String()),
			ExpiresAt:             stripe.Int64(request.ExpiresAt.Unix()),
			AdaptivePricing:       &stripe.CheckoutSessionCreateAdaptivePricingParams{Enabled: stripe.Bool(false)},
			IntegrationIdentifier: stripe.String(integrationIdentifier),
			Metadata:              map[string]string{configMetadataKey: request.ProviderConfigID},
			LineItems: []*stripe.CheckoutSessionCreateLineItemParams{{
				Quantity: stripe.Int64(1),
				PriceData: &stripe.CheckoutSessionCreateLineItemPriceDataParams{
					Currency:   stripe.String(strings.ToLower(request.Currency)),
					UnitAmount: stripe.Int64(request.AmountFen),
					ProductData: &stripe.CheckoutSessionCreateLineItemPriceDataProductDataParams{
						Name: stripe.String(request.Description),
					},
				},
			}},
		}
		// Merchants can retry the same host order when the first result was lost.
		params.SetIdempotencyKey("supdance-checkout-" + request.MerchantOrderNo)
		session, err = client.V1CheckoutSessions.Create(ctx, params)
		if err != nil {
			err = stripeError("create checkout", err)
		}
	}
	if err != nil {
		return sdk.Checkout{}, err
	}
	result, err := sessionResult(session, values["mode"], request.MerchantOrderNo)
	if err != nil {
		return sdk.Checkout{}, err
	}
	if session.Metadata[configMetadataKey] != request.ProviderConfigID ||
		result.AmountFen != request.AmountFen || result.Currency != request.Currency ||
		session.ExpiresAt != request.ExpiresAt.Unix() || session.Status != stripe.CheckoutSessionStatusOpen {
		return sdk.Checkout{}, errors.New("Stripe checkout is unavailable or differs from the order snapshot")
	}
	if _, err := checkoutURL(session.URL, false); err != nil {
		return sdk.Checkout{}, err
	}
	return sdk.Checkout{Mode: "redirect", Value: session.URL, ExpiresAt: time.Unix(session.ExpiresAt, 0), ProviderTradeNo: session.ID}, nil
}

func (p *Provider) retrieve(ctx context.Context, client *stripe.Client, sessionID string) (*stripe.CheckoutSession, error) {
	if sessionID == "" {
		return nil, sdk.ErrOrderNotFound
	}
	if !strings.HasPrefix(sessionID, "cs_") {
		return nil, errors.New("invalid Stripe Checkout Session ID")
	}
	session, err := client.V1CheckoutSessions.Retrieve(ctx, sessionID, nil)
	if err != nil {
		return nil, stripeError("retrieve checkout", err)
	}
	if session.ID != sessionID {
		return nil, errors.New("Stripe returned a different Checkout Session")
	}
	return session, nil
}

func (p *Provider) QueryOrder(ctx context.Context, values sdk.Config, request sdk.QueryRequest) (sdk.Result, error) {
	session, err := p.retrieve(ctx, p.client(values), request.ProviderTradeNo)
	if err != nil {
		return sdk.Result{}, err
	}
	return sessionResult(session, values["mode"], request.MerchantOrderNo)
}

func (p *Provider) CloseOrder(ctx context.Context, values sdk.Config, request sdk.CloseRequest) (sdk.Result, error) {
	if request.ProviderTradeNo == "" && (request.ExpiresAt == nil || time.Now().Before(*request.ExpiresAt)) {
		return sdk.Result{}, errors.New("Stripe checkout creation is unconfirmed")
	}
	client := p.client(values)
	session, err := p.retrieve(ctx, client, request.ProviderTradeNo)
	if err != nil {
		return sdk.Result{}, err
	}
	result, err := sessionResult(session, values["mode"], request.MerchantOrderNo)
	if err != nil || result.Paid || result.Closed {
		return result, err
	}
	if session.Status != stripe.CheckoutSessionStatusOpen {
		return sdk.Result{}, errors.New("Stripe payment confirmation is pending")
	}
	session, err = client.V1CheckoutSessions.Expire(ctx, session.ID, nil)
	if err != nil {
		return sdk.Result{}, stripeError("expire checkout", err)
	}
	if session.ID != request.ProviderTradeNo {
		return sdk.Result{}, errors.New("Stripe returned a different Checkout Session")
	}
	result, err = sessionResult(session, values["mode"], request.MerchantOrderNo)
	if err == nil && !result.Closed && !result.Paid {
		return sdk.Result{}, errors.New("Stripe did not confirm checkout expiration")
	}
	return result, err
}

func sessionResult(session *stripe.CheckoutSession, mode, merchantOrderNo string) (sdk.Result, error) {
	if (mode != "test" && mode != "live") || session.Livemode != (mode == "live") ||
		session.Mode != stripe.CheckoutSessionModePayment || !strings.HasPrefix(session.ID, "cs_") ||
		session.Metadata[configMetadataKey] == "" || merchantOrderNo == "" || session.ClientReferenceID != merchantOrderNo ||
		session.AmountTotal <= 0 || (session.Currency != stripe.CurrencyUSD && session.Currency != stripe.CurrencyCNY) {
		return sdk.Result{}, errors.New("Stripe checkout does not match the expected order")
	}
	return sdk.Result{
		MerchantOrderNo: merchantOrderNo, ProviderTradeNo: session.ID,
		ProviderStatus: string(session.Status) + ":" + string(session.PaymentStatus),
		AmountFen:      session.AmountTotal, Currency: strings.ToUpper(string(session.Currency)),
		Paid:   session.Status == stripe.CheckoutSessionStatusComplete && session.PaymentStatus == stripe.CheckoutSessionPaymentStatusPaid,
		Closed: session.Status == stripe.CheckoutSessionStatusExpired,
	}, nil
}

func stripeError(operation string, err error) error {
	var apiErr *stripe.Error
	if errors.As(err, &apiErr) && apiErr.Code != "" {
		return errors.New("Stripe could not " + operation + " (" + string(apiErr.Code) + ")")
	}
	return errors.New("Stripe could not " + operation)
}

func (*Provider) DownloadTradeBill(context.Context, sdk.Config, time.Time) ([]sdk.BillRecord, error) {
	return nil, &sdk.ProviderError{Code: "unsupported_operation", Message: "Stripe trade bill downloads are unsupported"}
}

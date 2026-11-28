package stripepayment

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/stripe/stripe-go/v87"
	"github.com/stripe/stripe-go/v87/webhook"
	sdk "yingce/backend/payment-sdk"
)

func (*Provider) VerifyNotification(_ context.Context, values sdk.Config, headers http.Header, body []byte) (sdk.Notification, error) {
	secret := values["webhookSigningSecret"]
	if !hasCredentialPrefix(secret, "whsec_") {
		return sdk.Notification{}, errors.New("Stripe webhook signing secret is missing")
	}
	// Decode only the fields we use after checking the original request bytes.
	// Dashboard endpoints can emit a different snapshot version from the SDK.
	if err := webhook.ValidatePayload(body, headers.Get("Stripe-Signature"), secret); err != nil {
		return sdk.Notification{}, errors.New("invalid Stripe webhook signature")
	}
	var event stripe.Event
	if err := json.Unmarshal(body, &event); err != nil || event.ID == "" || event.Object != "event" || event.Created <= 0 {
		return sdk.Notification{}, errors.New("invalid Stripe webhook event")
	}
	if event.Livemode != (values["mode"] == "live") {
		return sdk.Notification{}, errors.New("Stripe webhook mode does not match the configured mode")
	}
	switch event.Type {
	case stripe.EventTypeCheckoutSessionCompleted, stripe.EventTypeCheckoutSessionAsyncPaymentSucceeded,
		stripe.EventTypeCheckoutSessionAsyncPaymentFailed, stripe.EventTypeCheckoutSessionExpired:
	default:
		return sdk.Notification{Ignored: true}, nil
	}
	var session stripe.CheckoutSession
	if event.Data == nil || json.Unmarshal(event.Data.Raw, &session) != nil || session.Object != "checkout.session" {
		return sdk.Notification{}, errors.New("invalid Stripe Checkout Session event")
	}
	configID := session.Metadata[configMetadataKey]
	if configID == "" {
		return sdk.Notification{Ignored: true}, nil
	}
	result, err := sessionResult(&session, values["mode"], session.ClientReferenceID)
	if err != nil {
		return sdk.Notification{}, err
	}
	switch event.Type {
	case stripe.EventTypeCheckoutSessionCompleted:
		if session.Status != stripe.CheckoutSessionStatusComplete {
			return sdk.Notification{}, errors.New("unexpected Stripe checkout completion state")
		}
	case stripe.EventTypeCheckoutSessionAsyncPaymentSucceeded:
		if !result.Paid {
			return sdk.Notification{}, errors.New("Stripe has not confirmed payment")
		}
	case stripe.EventTypeCheckoutSessionAsyncPaymentFailed:
		if session.Status != stripe.CheckoutSessionStatusComplete || session.PaymentStatus != stripe.CheckoutSessionPaymentStatusUnpaid {
			return sdk.Notification{}, errors.New("unexpected Stripe asynchronous failure state")
		}
		result.Closed = true
		result.ProviderStatus = "async_payment_failed"
	case stripe.EventTypeCheckoutSessionExpired:
		if !result.Closed {
			return sdk.Notification{}, errors.New("Stripe has not confirmed checkout expiration")
		}
	}
	if result.Paid {
		result.PaidAt = time.Unix(event.Created, 0).UTC()
	}
	return sdk.Notification{EventID: event.ID, ProviderConfigID: configID, Result: result}, nil
}

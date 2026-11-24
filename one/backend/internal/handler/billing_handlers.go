package handler

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"one/backend/internal/domain/billing"
	"one/backend/internal/middleware"
	"one/backend/internal/pkg/envelope"
)

func (d *Dependencies) billingService() *billing.Service {
	if d.Billing != nil {
		return d.Billing
	}
	svc := &billing.Service{Config: d.Config}
	if d.Pool != nil {
		svc.Repo = &billing.PGRepository{Pool: d.Pool}
		svc.Gateway = billing.NewHTTPGateway(d.Config, d.Pool, nil)
	}
	return svc
}

func (d *Dependencies) handleBillingPlans(w http.ResponseWriter, r *http.Request) {
	catalog, err := d.billingService().ListPlans(r.Context())
	if err != nil {
		writeDomainError(w, err, "读取会员套餐失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, catalog)
}

func (d *Dependencies) handleBillingCreditPacks(w http.ResponseWriter, r *http.Request) {
	uid := ""
	if u, ok := middleware.UserFromContext(r.Context()); ok && u != nil {
		uid = u.ID
	}
	envelope.DomainJSON(w, http.StatusOK, d.billingService().ListCreditPacks(r.Context(), uid))
}

func (d *Dependencies) handleBillingCredits(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	res, err := d.billingService().GetBillingCredits(r.Context(), u.ID)
	if err != nil {
		writeDomainError(w, err, "获取积分信息失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, res)
}

func (d *Dependencies) handleBillingEntitlements(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	ent, err := d.billingService().GetEntitlements(r.Context(), u.ID)
	if err != nil {
		writeDomainError(w, err, "获取会员权益失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{
		"entitlements": ent,
	})
}

func (d *Dependencies) handleBillingSubscription(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	sub, err := d.billingService().GetSubscription(r.Context(), u.ID)
	if err != nil {
		writeDomainError(w, err, "获取订阅信息失败")
		return
	}
	ent, err := d.billingService().GetEntitlements(r.Context(), u.ID)
	if err != nil {
		writeDomainError(w, err, "获取订阅信息失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{
		"subscription": sub,
		"entitlements": ent,
	})
}

func (d *Dependencies) handleBillingUsage(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	usage, err := d.billingService().GetUsage(r.Context(), u.ID)
	if err != nil {
		writeDomainError(w, err, "获取用量统计失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, usage)
}

func (d *Dependencies) handleBillingOrdersMy(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	w.Header().Set("Cache-Control", "private, no-store")
	if !coreExpectedOwner(w, r, envelope.FormatDirectDomainJSON, u.ID, "BILLING_ACCOUNT_CHANGED") {
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	orders, err := d.billingService().ListMyOrders(r.Context(), u.ID, limit, offset)
	if err != nil {
		writeDomainError(w, err, "获取订单列表失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{"orders": orders})
}

func (d *Dependencies) handleBillingOrderStatus(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	w.Header().Set("Cache-Control", "private, no-store")
	if !coreExpectedOwner(w, r, envelope.FormatDirectDomainJSON, u.ID, "BILLING_ACCOUNT_CHANGED") {
		return
	}
	orderID := r.PathValue("id")
	order, err := d.billingService().GetOrderStatusForUser(r.Context(), orderID, u.ID)
	if err != nil {
		writeDomainError(w, err, "查询订单状态失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{"order": order})
}

func (d *Dependencies) handleBillingCheckout(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	var body struct {
		PlanID         string `json:"planId"`
		PackID         string `json:"packId"`
		ProductID      string `json:"productId"`
		Provider       string `json:"provider"`
		BillingCycle   string `json:"billingCycle"`
		ProductType    string `json:"productType"`
		IdempotencyKey string `json:"idempotencyKey"`
	}
	if !decodeJSONBody(w, r, 16*1024, &body) {
		return
	}
	idem := firstNonEmpty(r.Header.Get("x-idempotency-key"), r.Header.Get("idempotency-key"), body.IdempotencyKey)
	res, err := d.billingService().CreateCheckout(r.Context(), billing.CheckoutInput{
		UserID:         u.ID,
		UserEmail:      strPtrVal(u.Email),
		PlanID:         firstNonEmpty(body.PlanID, body.PackID, body.ProductID),
		Provider:       body.Provider,
		BillingCycle:   body.BillingCycle,
		ProductType:    body.ProductType,
		IdempotencyKey: idem,
		Origin:         requestOrigin(r),
	})
	if err != nil {
		writeDomainError(w, err, "创建支付订单失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, res)
}

func (d *Dependencies) handleCouponVerify(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	var body struct {
		Code string `json:"code"`
	}
	if !decodeJSONBody(w, r, 16*1024, &body) {
		return
	}
	info, err := d.billingService().VerifyCoupon(r.Context(), body.Code, u.ID)
	if err != nil {
		writeDomainError(w, err, "核验卡密失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{"valid": true, "coupon": info})
}

func (d *Dependencies) handleCouponRedeem(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	var body struct {
		Code string `json:"code"`
	}
	if !decodeJSONBody(w, r, 16*1024, &body) {
		return
	}
	res, err := d.billingService().RedeemCoupon(r.Context(), body.Code, u.ID, clientIP(r))
	if err != nil {
		writeDomainError(w, err, "兑换卡密失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, res)
}

func (d *Dependencies) handleStripeWebhook(w http.ResponseWriter, r *http.Request) {
	raw, err := readBodyLimit(r, 1024*1024)
	if err != nil || len(raw) > 1024*1024 {
		envelope.DomainError(w, http.StatusBadRequest, "无效的通知载荷", "STRIPE_WEBHOOK_INVALID_BODY")
		return
	}
	res, err := d.billingService().HandleStripeWebhook(r.Context(), raw, r.Header.Get("stripe-signature"))
	if err != nil {
		writeDomainError(w, err, "Stripe 通知处理失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, res)
}

func (d *Dependencies) handleAlipayWebhook(w http.ResponseWriter, r *http.Request) {
	raw, err := readBodyLimit(r, 1024*1024)
	if err != nil || len(raw) > 1024*1024 {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte("fail"))
		return
	}
	_, err = d.billingService().HandleAlipayWebhook(r.Context(), raw)
	if err != nil {
		code := "REJECTED"
		status := http.StatusBadRequest
		var be *billing.ServiceError
		if errors.As(err, &be) {
			code = be.Code
			status = be.Status
		}
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Header().Set("x-webhook-code", code)
		w.WriteHeader(status)
		_, _ = w.Write([]byte("fail"))
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("success"))
}

func (d *Dependencies) handleWechatWebhook(w http.ResponseWriter, r *http.Request) {
	raw, err := readBodyLimit(r, 1024*1024)
	if err != nil || len(raw) > 1024*1024 {
		envelope.DomainError(w, http.StatusBadRequest, "微信通知载荷无效", "WECHAT_WEBHOOK_INVALID_BODY")
		return
	}
	headers := map[string]string{
		"wechatpay-signature": r.Header.Get("Wechatpay-Signature"),
		"wechatpay-timestamp": r.Header.Get("Wechatpay-Timestamp"),
		"wechatpay-nonce":     r.Header.Get("Wechatpay-Nonce"),
		"wechatpay-serial":    r.Header.Get("Wechatpay-Serial"),
	}
	res, err := d.billingService().HandleWechatWebhook(r.Context(), raw, headers)
	if err != nil {
		writeDomainError(w, err, "微信通知处理失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, res)
}

func (d *Dependencies) handlePayPalWebhook(w http.ResponseWriter, r *http.Request) {
	raw, err := readBodyLimit(r, 1024*1024)
	if err != nil || len(raw) > 1024*1024 {
		envelope.DomainError(w, http.StatusBadRequest, "PayPal 通知载荷无效", "PAYPAL_WEBHOOK_INVALID_BODY")
		return
	}
	headers := map[string]string{
		"paypal-auth-algo":         strings.TrimSpace(r.Header.Get("PayPal-Auth-Algo")),
		"paypal-cert-url":          strings.TrimSpace(r.Header.Get("PayPal-Cert-Url")),
		"paypal-transmission-id":   strings.TrimSpace(r.Header.Get("PayPal-Transmission-Id")),
		"paypal-transmission-sig":  strings.TrimSpace(r.Header.Get("PayPal-Transmission-Sig")),
		"paypal-transmission-time": strings.TrimSpace(r.Header.Get("PayPal-Transmission-Time")),
	}
	res, err := d.billingService().HandlePayPalWebhook(r.Context(), raw, headers)
	if err != nil {
		writeDomainError(w, err, "PayPal 通知处理失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, res)
}

package billing

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"one/backend/internal/config"
	"one/backend/internal/domain/finance"
	"one/backend/internal/pkg/ids"
	"one/backend/internal/platform/coordination"
)

var (
	ErrNotImplemented   = errors.New("billing domain repository not yet implemented")
	ErrOrderNotFound    = errors.New("ORDER_NOT_FOUND")
	ErrForbidden        = errors.New("FORBIDDEN")
	ErrCouponNotFound   = errors.New("COUPON_NOT_FOUND")
	ErrCouponInvalid    = errors.New("COUPON_INVALID")
	ErrCouponRedeemed   = errors.New("COUPON_ALREADY_REDEEMED")
	ErrAmountMismatch   = errors.New("PAYMENT_AMOUNT_MISMATCH")
	ErrInvalidSignature = errors.New("INVALID_WEBHOOK_SIGNATURE")
)

type ServiceError struct {
	Status     int
	Code       string
	Message    string
	RetryAfter int
}

func (e *ServiceError) Error() string { return e.Message }

func svcErr(status int, code, msg string) *ServiceError {
	return &ServiceError{Status: status, Code: code, Message: msg}
}

type Order struct {
	ID              string         `json:"id"`
	UserID          string         `json:"user_id"`
	PlanID          string         `json:"plan_id"`
	ProductType     string         `json:"productType,omitempty"`
	BillingCycle    string         `json:"billingCycle,omitempty"`
	Status          string         `json:"status"`
	Provider        string         `json:"provider"`
	ProviderOrderID string         `json:"providerOrderId,omitempty"`
	AmountCent      int64          `json:"amount_cent"`
	PaidAmountCent  int64          `json:"paid_amount_cent,omitempty"`
	Currency        string         `json:"currency"`
	CheckoutURL     string         `json:"checkoutUrl,omitempty"`
	Metadata        map[string]any `json:"metadata,omitempty"`
	CreatedAt       time.Time      `json:"createdAt"`
	PaidAt          *time.Time     `json:"paidAt,omitempty"`
}

type PlanItem struct {
	ID                string   `json:"id"`
	CodeName          string   `json:"codeName"`
	Name              string   `json:"name"`
	MonthlyCny        float64  `json:"monthlyCny"`
	MonthlyUsd        float64  `json:"monthlyUsd"`
	QuarterlyCny      float64  `json:"quarterlyCny"`
	QuarterlyUsd      float64  `json:"quarterlyUsd"`
	YearlyCny         float64  `json:"yearlyCny"`
	YearlyUsd         float64  `json:"yearlyUsd"`
	QuotaBase         int64    `json:"quotaBase"`
	MonthlyCredits    int64    `json:"monthlyCredits"`
	Concurrency       int      `json:"concurrency"`
	AsyncConcurrency  int      `json:"asyncConcurrency"`
	PortraitCapacity  int      `json:"portraitCapacity"`
	StorageGb         int      `json:"storageGb"`
	Badge             string   `json:"badge,omitempty"`
	ExclusiveFeatures []string `json:"exclusiveFeatures"`
	Features          []string `json:"features"`
	Enabled           bool     `json:"enabled"`
	DisplayOrder      int      `json:"displayOrder"`
	Configured        bool     `json:"configured"`
}

type CreditPackItem struct {
	ID           string  `json:"id"`
	Kind         string  `json:"kind"`
	Credits      int64   `json:"credits"`
	PriceCny     float64 `json:"priceCny"`
	DisplayOrder int     `json:"displayOrder"`
	Featured     bool    `json:"featured"`
	Name         string  `json:"name"`
	RateLabel    string  `json:"rateLabel"`
	ValidityText string  `json:"validityText"`
}

type ExclusivePackItem struct {
	ID                    string  `json:"id"`
	Kind                  string  `json:"kind"`
	FamilyKey             string  `json:"familyKey"`
	FamilyName            string  `json:"familyName"`
	CanonicalModelID      string  `json:"canonicalModelId"`
	Name                  string  `json:"name"`
	PriceCny              float64 `json:"priceCny"`
	PurchasedCredits      int64   `json:"purchasedCredits"`
	StandardBonusCredits  int64   `json:"standardBonusCredits"`
	StandardTotalCredits  int64   `json:"standardTotalCredits"`
	FirstBonusCredits     int64   `json:"firstBonusCredits"`
	FirstTotalCredits     int64   `json:"firstTotalCredits"`
	PurchasedValidityDays int     `json:"purchasedValidityDays"`
	BonusValidityDays     int     `json:"bonusValidityDays"`
}

type SubscriptionInfo struct {
	ID                 string     `json:"id,omitempty"`
	PlanID             string     `json:"planId"`
	PlanName           string     `json:"planName,omitempty"`
	Status             string     `json:"status"`
	Provider           string     `json:"provider,omitempty"`
	BillingCycle       string     `json:"billingCycle,omitempty"`
	CancelAtPeriodEnd  bool       `json:"cancelAtPeriodEnd"`
	CurrentPeriodEnd   *time.Time `json:"currentPeriodEnd,omitempty"`
	IsSubscribed       bool       `json:"isSubscribed"`
	MaxConcurrentTasks int        `json:"maxConcurrentTasks"`
	ModelConcurrency   int        `json:"modelConcurrency"`
	PortraitCapacity   int        `json:"portraitCapacity"`
	PriorityQueue      bool       `json:"priorityQueue"`
	ExclusiveFeatures  []string   `json:"exclusiveFeatures"`
	StorageGb          int        `json:"storageGb"`
}

type UsageSummary struct {
	TotalCreations   int   `json:"totalCreations"`
	TotalCreditsUsed int64 `json:"totalCreditsUsed"`
	Recent30DaysUsed int64 `json:"recent30DaysUsed"`
}

type CouponInfo struct {
	Code         string     `json:"code"`
	Title        string     `json:"title"`
	Type         string     `json:"type"`
	Credits      int64      `json:"credits,omitempty"`
	PlanID       string     `json:"planId,omitempty"`
	DurationDays int        `json:"durationDays,omitempty"`
	ExpiresAt    *time.Time `json:"expiresAt,omitempty"`
}

type CheckoutInput struct {
	UserID         string
	UserEmail      string
	PlanID         string
	Provider       string
	BillingCycle   string
	ProductType    string
	IdempotencyKey string
	Origin         string
}

type CheckoutResult struct {
	OrderID     string `json:"orderId"`
	Provider    string `json:"provider"`
	Status      string `json:"status"`
	CheckoutURL string `json:"checkoutUrl,omitempty"`
	QRCode      string `json:"qrCode,omitempty"`
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
}

type WebhookFulfillmentInput struct {
	Provider               string
	EventID                string
	EventType              string
	OrderID                string
	ProviderOrderID        string
	ProviderPaymentID      string
	OriginalPaymentID      string
	ProviderCustomerID     string
	ProviderSubscriptionID string
	PaidAmountMinor        int64
	Currency               string
	IsRefund               bool
	CurrentPeriodEnd       *time.Time
	RawPayload             map[string]any
	Headers                map[string]string
}

type WebhookDispatchResult struct {
	Received  bool   `json:"received"`
	Action    string `json:"action"`
	Duplicate bool   `json:"duplicate"`
	Retryable bool   `json:"retryable,omitempty"`
	OrderID   string `json:"orderId,omitempty"`
}

type Repository interface {
	GetOrder(ctx context.Context, orderID string) (*Order, error)
	ListOrdersByUser(ctx context.Context, userID string, limit, offset int) ([]Order, error)
	HasPaidExclusiveOrder(ctx context.Context, userID string) (bool, error)
	CreateOrder(ctx context.Context, order Order, idempotencyKey string) (*Order, error)
	GetActiveSubscription(ctx context.Context, userID string) (*SubscriptionInfo, error)
	UpdateSubscriptionCancelAtPeriodEnd(ctx context.Context, userID string, cancel bool) (*SubscriptionInfo, error)
	GetUsageSummary(ctx context.Context, userID string) (*UsageSummary, error)
	VerifyCoupon(ctx context.Context, code, userID string, now time.Time) (*CouponInfo, error)
	RedeemCoupon(ctx context.Context, code, userID, ip string, now time.Time) (map[string]any, error)

	ClaimWebhookEvent(ctx context.Context, provider, eventID, eventType string, payload map[string]any, headers map[string]string, now time.Time) (claimed bool, err error)
	MarkWebhookProcessed(ctx context.Context, provider, eventID string, now time.Time) error
	MarkWebhookFailed(ctx context.Context, provider, eventID, errMsg string, now time.Time) error
	RecordRejectedWebhook(ctx context.Context, provider, eventID, eventType, errMsg string, payload map[string]any, headers map[string]string, now time.Time) error
	ApplyPaymentWebhook(ctx context.Context, in WebhookFulfillmentInput, now time.Time) (*WebhookDispatchResult, error)
}

type Service struct {
	Repo           Repository
	Finance        *finance.Service
	Coord          *coordination.Coordinator
	Config         config.Config
	PayPalVerifier PayPalSignatureVerifier
	Gateway        PaymentGateway
	Now            func() time.Time
}

func (s *Service) now() time.Time {
	if s != nil && s.Now != nil {
		return s.Now()
	}
	return time.Now().UTC()
}

func (s *Service) checkLimit(ctx context.Context, scope, subject string, limit int, window time.Duration) error {
	if s.Coord == nil {
		return nil
	}
	res, err := s.Coord.ConsumeRateLimit(ctx, coordination.RateLimitRequest{
		Scope: scope, Subject: subject, Limit: limit, Window: window,
	})
	if err != nil {
		return err
	}
	if !res.Allowed {
		return &ServiceError{
			Status:     http.StatusTooManyRequests,
			Code:       "RATE_LIMITED",
			Message:    "请求过于频繁，请稍后重试",
			RetryAfter: res.RetryAfterSeconds,
		}
	}
	return nil
}

func CommercialPlans() []PlanItem {
	return []PlanItem{
		{
			ID: "starter", CodeName: "BASE", Name: "Starter (入门探索版)",
			MonthlyCny: 140, MonthlyUsd: 20, QuarterlyCny: 420, QuarterlyUsd: 60, YearlyCny: 1680, YearlyUsd: 240,
			QuotaBase: 2000, MonthlyCredits: 2000, Concurrency: 2, AsyncConcurrency: 2, PortraitCapacity: 2, StorageGb: 5,
			ExclusiveFeatures: []string{"no_watermark", "canvas_premium_tools", "commercial_license"},
		},
		{
			ID: "basic", CodeName: "STAR", Name: "Basic (进阶创作者)",
			MonthlyCny: 350, MonthlyUsd: 50, QuarterlyCny: 945, QuarterlyUsd: 135, YearlyCny: 3600, YearlyUsd: 514,
			QuotaBase: 5000, MonthlyCredits: 5000, Concurrency: 4, AsyncConcurrency: 4, PortraitCapacity: 5, StorageGb: 20,
			Badge: "最受欢迎", ExclusiveFeatures: []string{"no_watermark", "vip_speed_queue", "export_4k", "canvas_premium_tools", "commercial_license"},
		},
		{
			ID: "plus", CodeName: "PRO", Name: "Plus (专业工作室)",
			MonthlyCny: 800, MonthlyUsd: 112, QuarterlyCny: 2160, QuarterlyUsd: 300, YearlyCny: 8000, YearlyUsd: 1110,
			QuotaBase: 12000, MonthlyCredits: 12000, Concurrency: 8, AsyncConcurrency: 8, PortraitCapacity: 15, StorageGb: 100,
			ExclusiveFeatures: []string{"no_watermark", "vip_speed_queue", "export_4k", "canvas_premium_tools", "commercial_license"},
		},
		{
			ID: "pro", CodeName: "APEX", Name: "Pro (企业旗舰版)",
			MonthlyCny: 1760, MonthlyUsd: 245, QuarterlyCny: 4752, QuarterlyUsd: 660, YearlyCny: 17600, YearlyUsd: 2440,
			QuotaBase: 27000, MonthlyCredits: 27000, Concurrency: 16, AsyncConcurrency: 16, PortraitCapacity: 50, StorageGb: 500,
			ExclusiveFeatures: []string{"no_watermark", "vip_speed_queue", "export_4k", "canvas_premium_tools", "commercial_license", "dedicated_support"},
		},
	}
}

func FindPlanByID(id string) *PlanItem {
	for _, p := range CommercialPlans() {
		if p.ID == id {
			cp := p
			return &cp
		}
	}
	return nil
}

func UniversalCreditPacks() []CreditPackItem {
	return []CreditPackItem{
		{ID: "credit_490", Kind: "universal", Credits: 490, PriceCny: 49, DisplayOrder: 1, Name: "490 通用算力", RateLabel: "¥0.10/分", ValidityText: "永久有效"},
		{ID: "credit_1400", Kind: "universal", Credits: 1400, PriceCny: 140, DisplayOrder: 2, Name: "1,400 通用算力", RateLabel: "¥0.10/分", ValidityText: "永久有效"},
		{ID: "credit_2100", Kind: "universal", Credits: 2100, PriceCny: 210, DisplayOrder: 3, Name: "2,100 通用算力", RateLabel: "¥0.10/分", ValidityText: "永久有效"},
		{ID: "credit_3500", Kind: "universal", Credits: 3500, PriceCny: 350, DisplayOrder: 4, Featured: true, Name: "3,500 通用算力", RateLabel: "¥0.10/分", ValidityText: "永久有效"},
		{ID: "credit_7000", Kind: "universal", Credits: 7000, PriceCny: 700, DisplayOrder: 5, Name: "7,000 通用算力", RateLabel: "¥0.10/分", ValidityText: "永久有效"},
		{ID: "credit_14000", Kind: "universal", Credits: 14000, PriceCny: 1400, DisplayOrder: 6, Name: "14,000 通用算力", RateLabel: "¥0.10/分", ValidityText: "永久有效"},
		{ID: "credit_70000", Kind: "universal", Credits: 70000, PriceCny: 7000, DisplayOrder: 7, Name: "70,000 通用算力", RateLabel: "¥0.10/分", ValidityText: "永久有效"},
	}
}

func FindCreditPackByID(id string) *CreditPackItem {
	for _, p := range UniversalCreditPacks() {
		if p.ID == id {
			cp := p
			return &cp
		}
	}
	return nil
}

func ExclusivePacks() []ExclusivePackItem {
	tiers := []struct {
		key             string
		price           float64
		purchased, stdB int64
		firstB          int64
	}{
		{"350", 350, 3500, 2100, 700},
		{"700", 700, 7000, 4200, 1400},
		{"1400", 1400, 14000, 8400, 1400},
		{"7000", 7000, 70000, 42000, 1400},
	}
	families := []struct{ key, name, model string }{
		{"veo", "Veo 3.1 Standard", "veo-3.1-standard"},
		{"seedance", "Seedance 2.0 标准版", "seedance-2.0"},
	}
	var out []ExclusivePackItem
	for _, f := range families {
		for _, t := range tiers {
			out = append(out, ExclusivePackItem{
				ID:                    "exclusive_" + f.key + "_" + t.key,
				Kind:                  "exclusive_pack",
				FamilyKey:             f.key,
				FamilyName:            f.name,
				CanonicalModelID:      f.model,
				Name:                  f.name + " 专属包",
				PriceCny:              t.price,
				PurchasedCredits:      t.purchased,
				StandardBonusCredits:  t.stdB,
				StandardTotalCredits:  t.purchased + t.stdB,
				FirstBonusCredits:     t.firstB,
				FirstTotalCredits:     t.purchased + t.stdB + t.firstB,
				PurchasedValidityDays: 365,
				BonusValidityDays:     31,
			})
		}
	}
	return out
}

func FindExclusivePackByID(id string) *ExclusivePackItem {
	for _, p := range ExclusivePacks() {
		if p.ID == id {
			cp := p
			return &cp
		}
	}
	return nil
}

func (s *Service) ListPlans(ctx context.Context) (map[string]any, error) {
	catalog, err := s.planCatalog(ctx)
	if err != nil {
		return nil, err
	}
	plans := []PlanItem{}
	for _, plan := range catalog {
		if plan.Enabled {
			plans = append(plans, plan.PlanItem)
		}
	}
	return map[string]any{
		"plans": plans,
		"channels": map[string]any{
			"stripe": map[string]any{"configured": s.Config.StripeSecretKey != ""},
			"alipay": map[string]any{"configured": s.Config.AlipayAppID != ""},
			"wechat": map[string]any{"configured": s.Config.WechatMchID != ""},
			"paypal": map[string]any{"configured": s.Config.PayPalClientID != ""},
		},
	}, nil
}

func (s *Service) ListCreditPacks(ctx context.Context, userID string) map[string]any {
	isFirst := false
	if s.Repo != nil && userID != "" {
		if paid, err := s.Repo.HasPaidExclusiveOrder(ctx, userID); err == nil {
			isFirst = !paid
		}
	}
	return map[string]any{
		"packs":           UniversalCreditPacks(),
		"exclusivePacks":  ExclusivePacks(),
		"isFirstPurchase": isFirst,
	}
}

func (s *Service) GetBillingCredits(ctx context.Context, userID string) (map[string]any, error) {
	if s.Finance == nil {
		return map[string]any{"balance": 0, "ledger": []any{}}, nil
	}
	w, err := s.Finance.GetCreditWallet(ctx, userID)
	if err != nil {
		return nil, err
	}
	ledger, _ := s.Finance.GetCreditLedger(ctx, userID, 20, 0)
	return map[string]any{
		"wallet": w,
		"ledger": ledger,
	}, nil
}

func (s *Service) GetSubscription(ctx context.Context, userID string) (*SubscriptionInfo, error) {
	if s.Repo == nil || strings.TrimSpace(userID) == "" {
		return nil, nil
	}
	return s.Repo.GetActiveSubscription(ctx, userID)
}

func (s *Service) GetEntitlements(ctx context.Context, userID string) (*SubscriptionInfo, error) {
	if s.Repo == nil || strings.TrimSpace(userID) == "" {
		return &SubscriptionInfo{
			PlanID:             "free",
			Status:             "inactive",
			MaxConcurrentTasks: 2,
			ExclusiveFeatures:  []string{},
		}, nil
	}
	sub, err := s.Repo.GetActiveSubscription(ctx, userID)
	if err != nil {
		return nil, err
	}
	if sub == nil {
		return &SubscriptionInfo{
			PlanID:             "free",
			Status:             "inactive",
			MaxConcurrentTasks: 2,
			ExclusiveFeatures:  []string{},
		}, nil
	}
	return s.applyPlanEntitlements(ctx, sub)
}

func (s *Service) GetEntitlementsMap(ctx context.Context, userID string) (map[string]any, error) {
	ent, err := s.GetEntitlements(ctx, userID)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"planId":             ent.PlanID,
		"planName":           ent.PlanName,
		"isSubscribed":       ent.IsSubscribed,
		"status":             ent.Status,
		"maxConcurrentTasks": ent.MaxConcurrentTasks,
		"modelConcurrency":   ent.ModelConcurrency,
		"portraitCapacity":   ent.PortraitCapacity,
		"storageGb":          ent.StorageGb,
		"priorityQueue":      ent.PriorityQueue,
		"exclusiveFeatures":  ent.ExclusiveFeatures,
		"currentPeriodEnd":   ent.CurrentPeriodEnd,
	}, nil
}

func (s *Service) UpdateSubscriptionCancel(ctx context.Context, userID string, cancel bool) (*SubscriptionInfo, error) {
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	sub, err := s.Repo.UpdateSubscriptionCancelAtPeriodEnd(ctx, userID, cancel)
	if err != nil {
		return nil, err
	}
	return s.applyPlanEntitlements(ctx, sub)
}

func (s *Service) GetUsage(ctx context.Context, userID string) (*UsageSummary, error) {
	if s.Repo == nil {
		return &UsageSummary{}, nil
	}
	return s.Repo.GetUsageSummary(ctx, userID)
}

func (s *Service) GetOrder(ctx context.Context, orderID string) (*Order, error) {
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	return s.Repo.GetOrder(ctx, orderID)
}

func (s *Service) ListMyOrders(ctx context.Context, userID string, limit, offset int) ([]Order, error) {
	if s.Repo == nil {
		return []Order{}, nil
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	return s.Repo.ListOrdersByUser(ctx, userID, limit, offset)
}

func (s *Service) GetOrderStatusForUser(ctx context.Context, orderID, userID string) (*Order, error) {
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	o, err := s.Repo.GetOrder(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if o == nil {
		return nil, svcErr(http.StatusNotFound, "ORDER_NOT_FOUND", "订单不存在")
	}
	if o.UserID != userID {
		return nil, svcErr(http.StatusForbidden, "FORBIDDEN", "无权查看该订单")
	}
	return o, nil
}

func (s *Service) CreateCheckout(ctx context.Context, in CheckoutInput) (*CheckoutResult, error) {
	if err := s.checkLimit(ctx, "billing_checkout", in.UserID, 30, time.Hour); err != nil {
		return nil, err
	}
	prov := strings.ToLower(strings.TrimSpace(in.Provider))
	if prov != "stripe" && prov != "alipay" && prov != "wechat" && prov != "paypal" {
		return nil, svcErr(http.StatusBadRequest, "UNSUPPORTED_PROVIDER", "不支持的支付渠道")
	}
	planID := strings.TrimSpace(in.PlanID)
	productType := strings.TrimSpace(in.ProductType)
	if productType == "" {
		if strings.HasPrefix(planID, "credit_") {
			productType = "credit_pack"
		} else if strings.HasPrefix(planID, "exclusive_") {
			productType = "exclusive_pack"
		} else {
			productType = "subscription"
		}
	}

	var priceCny, subscriptionPriceUsd float64
	var planName string
	var creditAmount int64
	cycle := strings.ToLower(strings.TrimSpace(in.BillingCycle))
	switch productType {
	case "credit_pack":
		pack := FindCreditPackByID(planID)
		if pack == nil {
			return nil, svcErr(http.StatusBadRequest, "INVALID_PACK", "请选择有效的通用算力包")
		}
		priceCny = pack.PriceCny
		planName = pack.Name
		creditAmount = pack.Credits
		cycle = "one_time"
	case "exclusive_pack":
		pack := FindExclusivePackByID(planID)
		if pack == nil {
			return nil, svcErr(http.StatusBadRequest, "INVALID_PACK", "请选择有效的模型专属算力包")
		}
		isFirst := false
		if s.Repo != nil {
			if paid, err := s.Repo.HasPaidExclusiveOrder(ctx, in.UserID); err == nil {
				isFirst = !paid
			}
		}
		priceCny = pack.PriceCny
		planName = pack.Name
		creditAmount = pack.StandardTotalCredits
		if isFirst {
			creditAmount = pack.FirstTotalCredits
		}
		cycle = "one_time"
	case "subscription":
		plan, err := s.findCatalogPlan(ctx, planID)
		if err != nil {
			return nil, err
		}
		if plan == nil || !plan.Enabled {
			return nil, svcErr(http.StatusBadRequest, "INVALID_PLAN", "请选择付费方案")
		}
		planName = plan.Name
		if cycle != "yearly" && cycle != "quarterly" {
			cycle = "monthly"
		}
		switch cycle {
		case "yearly":
			priceCny, subscriptionPriceUsd = plan.YearlyCny, plan.YearlyUsd
			creditAmount = plan.QuotaBase * 12
		case "quarterly":
			priceCny, subscriptionPriceUsd = plan.QuarterlyCny, plan.QuarterlyUsd
			creditAmount = plan.QuotaBase * 3
		default:
			priceCny, subscriptionPriceUsd = plan.MonthlyCny, plan.MonthlyUsd
			creditAmount = plan.QuotaBase
		}
	default:
		return nil, svcErr(http.StatusBadRequest, "INVALID_PRODUCT_TYPE", "不支持的商品类型")
	}

	currency := "CNY"
	amountMinor := int64(priceCny * 100)
	if prov == "stripe" || prov == "paypal" {
		currency = "USD"
		if productType == "subscription" {
			amountMinor = int64(subscriptionPriceUsd * 100)
		} else {
			amountMinor = int64((priceCny / 7.23) * 100)
			if amountMinor < 100 {
				amountMinor = 100
			}
		}
	}
	if amountMinor <= 0 {
		return nil, svcErr(http.StatusUnprocessableEntity, "PLAN_PRICE_UNAVAILABLE", "此支付渠道或周期尚未设置有效价格")
	}

	orderID, _ := ids.NewPrefixedID("order")
	order := Order{
		ID:           orderID,
		UserID:       in.UserID,
		PlanID:       planID,
		ProductType:  productType,
		BillingCycle: cycle,
		Status:       "pending",
		Provider:     prov,
		AmountCent:   amountMinor,
		Currency:     currency,
		Metadata: map[string]any{
			"productType":  productType,
			"productId":    planID,
			"productName":  planName,
			"creditAmount": creditAmount,
			"billingCycle": cycle,
		},
		CreatedAt: s.now(),
	}
	if s.Repo != nil {
		created, err := s.Repo.CreateOrder(ctx, order, in.IdempotencyKey)
		if err != nil {
			return nil, err
		}
		order = *created
	}
	var qrCode string
	if order.CheckoutURL == "" && s.Gateway != nil {
		origin := strings.TrimRight(firstStr(s.Config.PublicAppURL, in.Origin, "https://www.supdance.com"), "/")
		returnURL := origin + "/billing/success?orderId=" + url.QueryEscape(order.ID)
		if storedName, ok := order.Metadata["productName"].(string); ok && storedName != "" {
			planName = storedName
		}
		gwResp, err := s.Gateway.CreateCheckout(ctx, GatewayCheckoutRequest{
			Order:        order,
			UserEmail:    in.UserEmail,
			PlanName:     planName,
			CreditAmount: extractCreditAmount(&order),
			SuccessURL:   returnURL,
			CancelURL:    returnURL + "&canceled=1",
		})
		if err != nil {
			return nil, err
		}
		order.ProviderOrderID = gwResp.ProviderOrderID
		order.CheckoutURL = gwResp.CheckoutURL
		qrCode = gwResp.QRCode
		if updater, ok := s.Repo.(orderCheckoutUpdater); ok {
			_ = updater.UpdateOrderCheckout(ctx, order.ID, gwResp.ProviderOrderID, gwResp.CheckoutURL)
		}
	}
	return &CheckoutResult{
		OrderID:     order.ID,
		Provider:    order.Provider,
		Status:      order.Status,
		CheckoutURL: order.CheckoutURL,
		QRCode:      qrCode,
		AmountMinor: order.AmountCent,
		Currency:    order.Currency,
	}, nil
}

func (s *Service) VerifyCoupon(ctx context.Context, code, userID string) (*CouponInfo, error) {
	if err := s.checkLimit(ctx, "coupon_verify_user", userID, 60, time.Hour); err != nil {
		return nil, err
	}
	clean := strings.ToUpper(strings.TrimSpace(code))
	if clean == "" {
		return nil, svcErr(http.StatusBadRequest, "INVALID_COUPON", "请输入卡密兑换码")
	}
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	info, err := s.Repo.VerifyCoupon(ctx, clean, userID, s.now())
	if err != nil {
		if errors.Is(err, ErrCouponNotFound) || errors.Is(err, ErrCouponInvalid) || errors.Is(err, ErrCouponRedeemed) {
			return nil, svcErr(http.StatusBadRequest, err.Error(), "兑换码无效、已过期或已使用")
		}
		return nil, err
	}
	return info, nil
}

func (s *Service) RedeemCoupon(ctx context.Context, code, userID, ip string) (map[string]any, error) {
	if err := s.checkLimit(ctx, "coupon_redeem_user", userID, 20, 24*time.Hour); err != nil {
		return nil, err
	}
	clean := strings.ToUpper(strings.TrimSpace(code))
	if clean == "" {
		return nil, svcErr(http.StatusBadRequest, "INVALID_COUPON", "请输入卡密兑换码")
	}
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	res, err := s.Repo.RedeemCoupon(ctx, clean, userID, ip, s.now())
	if err != nil {
		if errors.Is(err, ErrCouponNotFound) || errors.Is(err, ErrCouponInvalid) || errors.Is(err, ErrCouponRedeemed) {
			return nil, svcErr(http.StatusBadRequest, err.Error(), "兑换码无效、已过期或已使用")
		}
		return nil, err
	}
	return res, nil
}

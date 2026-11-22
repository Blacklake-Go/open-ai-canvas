package generation

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var (
	ErrModelNotFound         = errors.New("MODEL_NOT_FOUND")
	ErrPricingUnconfigured   = errors.New("MODEL_PRICING_UNCONFIGURED")
	ErrSitePriceNotEffective = errors.New("SITE_PRICE_NOT_EFFECTIVE")
	ErrSitePriceExpired      = errors.New("SITE_PRICE_EXPIRED")
	ErrMarginBelowFloor      = errors.New("PRICING_MARGIN_BELOW_FLOOR")
	ErrCapabilityChanged     = errors.New("MODEL_CAPABILITY_CHANGED")
	ErrNoEligibleRoute       = errors.New("NO_ELIGIBLE_ROUTE")
)

type PricingError struct {
	Code    string
	Message string
	Status  int
}

func (e *PricingError) Error() string { return e.Message }

const (
	CNYPerCredit            = 0.07
	ProviderCostReserveRate = 0.10
	DefaultMinMarginRate    = 0.30
	DefaultMinCredits       = 10
	DefaultUSDToCNY         = 7.25
)

type PricingRecord struct {
	ModelID            string
	PricingType        string
	BaseCredits        int
	MinCredits         int
	MinGrossMarginRate *float64
	FormulaConfig      map[string]any
	SitePriceCNY       *float64
	SitePriceVersionID string
	PriceValidFrom     *time.Time
	PriceValidUntil    *time.Time
	OverrideReason     string
	OverrideExpiresAt  *time.Time
}

type FormulaMultipliers struct {
	Resolution float64
	Duration   float64
	Quality    float64
}

type PriceResolution struct {
	PolicyVersion      string
	Credits            int
	CreditsSource      string
	SitePriceCNY       float64
	SitePriceSource    string
	SitePriceVersionID string
	MinMarginRate      float64
	MarginSource       string
	Blockers           []string
}

type RouteCandidate struct {
	ProviderModelID   string         `json:"providerModelId"`
	ProviderID        string         `json:"providerId"`
	ProviderModelName string         `json:"providerModelName"`
	ProviderEndpoint  string         `json:"providerEndpoint"`
	Priority          int            `json:"priority"`
	IsPrimary         bool           `json:"isPrimary"`
	HealthStatus      string         `json:"healthStatus"`
	PriceVersionID    string         `json:"priceVersionId,omitempty"`
	PriceType         string         `json:"priceType,omitempty"`
	EstimatedCostUSD  *float64       `json:"estimatedCostUsd,omitempty"`
	EstimatedCostCNY  *float64       `json:"estimatedCostCny,omitempty"`
	CostKnown         bool           `json:"costKnown"`
	Metadata          map[string]any `json:"metadata,omitempty"`
}

type QuoteRequest struct {
	UserID            string
	ModelID           string
	Site              string // studio | canvas
	Parameters        map[string]any
	IdempotencyKey    string
	CapabilityVersion string
	SubscriptionLevel string
}

type QuoteResponse struct {
	QuoteID          string         `json:"quoteId"`
	Credits          int            `json:"credits"`
	ModelID          string         `json:"modelId"`
	PricingBreakdown map[string]any `json:"pricingBreakdown"`
	RouteSnapshot    map[string]any `json:"routeSnapshot"`
	ExpiresAt        time.Time      `json:"expiresAt"`
	Idempotent       bool           `json:"idempotent,omitempty"`
}

// QuoteCreditsFromCostCNY computes ceil-rounded credits from worst-case CNY cost + reserve + margin.
func QuoteCreditsFromCostCNY(costCNY, minMarginRate float64, minCredits int) int {
	denom := CNYPerCredit * (1 - minMarginRate)
	if denom <= 0 {
		denom = CNYPerCredit * 0.70
	}
	raw := (costCNY * (1 + ProviderCostReserveRate)) / denom
	rounded := int(math.Ceil(raw))
	if rounded < minCredits {
		return minCredits
	}
	return rounded
}

// ResolveModelPricePolicy evaluates fixed vs formula credits, site price validity, and margin floor.
func ResolveModelPricePolicy(rec PricingRecord, highestCostCNY *float64, mult FormulaMultipliers, now time.Time) PriceResolution {
	minCred := rec.MinCredits
	if minCred < DefaultMinCredits {
		minCred = DefaultMinCredits
	}
	if rec.BaseCredits < minCred && rec.BaseCredits > 0 {
		minCred = rec.BaseCredits
	}

	pType := strings.ToLower(strings.TrimSpace(rec.PricingType))
	if pType != "formula" {
		pType = "fixed"
	}
	var blockers []string

	// Margin floor resolution
	minMargin := DefaultMinMarginRate
	marginSource := "policy_default"
	if rec.OverrideReason != "" && rec.OverrideExpiresAt != nil && rec.OverrideExpiresAt.After(now) {
		minMargin = 0
		marginSource = "time_limited_override"
	} else if rec.MinGrossMarginRate != nil && *rec.MinGrossMarginRate >= DefaultMinMarginRate {
		minMargin = *rec.MinGrossMarginRate
		marginSource = "model_config"
	}

	// Credits derivation
	credits := rec.BaseCredits
	creditsSource := "fixed_base_credits"
	if pType == "formula" && highestCostCNY != nil && *highestCostCNY >= 0 {
		resM := mult.Resolution
		if resM <= 0 {
			resM = 1
		}
		durM := mult.Duration
		if durM <= 0 {
			durM = 1
		}
		qualM := mult.Quality
		if qualM <= 0 {
			qualM = 1
		}
		formulaBase := int(math.Round(float64(rec.BaseCredits) * resM * durM * qualM))
		if formulaBase < minCred {
			formulaBase = minCred
		}
		costCredits := QuoteCreditsFromCostCNY(*highestCostCNY, minMargin, minCred)
		if formulaBase > costCredits {
			credits = formulaBase
		} else {
			credits = costCredits
		}
		creditsSource = "provider_cost_margin_ceiling"
	} else if credits < minCred {
		if credits > 0 {
			credits = rec.BaseCredits
		} else {
			blockers = append(blockers, "PRICE_POLICY_INVALID")
		}
	}

	// Locked site price check
	sitePriceCNY := float64(credits) * CNYPerCredit
	sitePriceSource := "credit_denomination"
	if rec.SitePriceCNY != nil && *rec.SitePriceCNY >= 0 {
		if rec.PriceValidFrom != nil && rec.PriceValidFrom.After(now) {
			blockers = append(blockers, "SITE_PRICE_NOT_EFFECTIVE")
		} else if rec.PriceValidUntil != nil && !rec.PriceValidUntil.After(now) {
			blockers = append(blockers, "SITE_PRICE_EXPIRED")
		} else {
			sitePriceCNY = *rec.SitePriceCNY
			sitePriceSource = "site_price_version"
		}
	}

	return PriceResolution{
		PolicyVersion:      "price-policy-v1",
		Credits:            credits,
		CreditsSource:      creditsSource,
		SitePriceCNY:       math.Round(sitePriceCNY*1e8) / 1e8,
		SitePriceSource:    sitePriceSource,
		SitePriceVersionID: rec.SitePriceVersionID,
		MinMarginRate:      minMargin,
		MarginSource:       marginSource,
		Blockers:           blockers,
	}
}

func estimatePriceConfigCostUSD(priceCfg map[string]any, currency string, usdToCny float64, params map[string]any) (usd float64, cny float64, ok bool) {
	if len(priceCfg) == 0 {
		return 0, 0, false
	}
	base, hasBase := priceNum(priceCfg["base_cost"])
	if !hasBase {
		base, hasBase = priceNum(priceCfg["cost_per_call"])
	}
	if !hasBase {
		base, hasBase = priceNum(priceCfg["per_request"])
	}
	if !hasBase {
		base, hasBase = priceNum(priceCfg["amount"])
	}
	if !hasBase {
		return 0, 0, false
	}
	dur := 1.0
	if d, ok := priceNum(params["duration"]); ok && d > 0 {
		if ps, ok := priceNum(priceCfg["per_second"]); ok && ps > 0 {
			base += ps * d
		} else if _, hasPerSec := priceCfg["price_per_second"]; hasPerSec {
			ps2, _ := priceNum(priceCfg["price_per_second"])
			base += ps2 * d
		} else if dur > 1 {
			_ = dur
		}
	}
	cur := strings.ToUpper(strings.TrimSpace(currency))
	if cur == "" {
		cur = "USD"
	}
	if usdToCny <= 0 {
		usdToCny = DefaultUSDToCNY
	}
	if cur == "CNY" || cur == "RMB" {
		return base / usdToCny, base, true
	}
	return base, base * usdToCny, true
}

func priceNum(v any) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, !math.IsNaN(n) && !math.IsInf(n, 0)
	case int:
		return float64(n), true
	case int64:
		return float64(n), true
	case string:
		f, err := strconv.ParseFloat(strings.TrimSpace(n), 64)
		return f, err == nil
	default:
		return 0, false
	}
}

func computeFormulaMultipliers(formulaCfg map[string]any, params map[string]any) FormulaMultipliers {
	m := FormulaMultipliers{Resolution: 1, Duration: 1, Quality: 1}
	if formulaCfg == nil || params == nil {
		return m
	}
	resText := strings.ToLower(fmt.Sprint(params["resolution"], params["size"]))
	if rm, ok := formulaCfg["resolution_multipliers"].(map[string]any); ok {
		for k, v := range rm {
			if strings.Contains(resText, strings.ToLower(k)) {
				if f, ok := priceNum(v); ok && f > 0 {
					m.Resolution = f
					break
				}
			}
		}
	}
	if d, ok := priceNum(params["duration"]); ok && d > 0 {
		if dm, ok := formulaCfg["duration_multipliers"].(map[string]any); ok {
			if f, ok := priceNum(dm[strconv.Itoa(int(d))]); ok && f > 0 {
				m.Duration = f
			} else if d > 5 {
				m.Duration = 1 + (d-5)*0.15
			}
		}
	}
	qual := strings.ToLower(strings.TrimSpace(fmt.Sprint(params["quality"])))
	if qual != "" {
		if qm, ok := formulaCfg["quality_multipliers"].(map[string]any); ok {
			if f, ok := priceNum(qm[qual]); ok && f > 0 {
				m.Quality = f
			}
		}
	}
	return m
}

func hashParams(userID, modelID string, params map[string]any, idem string) string {
	raw, _ := json.Marshal(map[string]any{"userId": userID, "modelId": modelID, "params": params, "idem": idem})
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:])
}

// CreateQuote computes pricing, filters margin-safe channels, and stores an idempotent quote row.
func (s *Service) CreateQuote(ctx context.Context, req QuoteRequest) (*QuoteResponse, error) {
	if s == nil || s.Pool == nil {
		return nil, &PricingError{Code: "DB_UNAVAILABLE", Message: "数据库不可用", Status: 503}
	}
	pool := s.Pool

	// 1. Idempotency check
	if req.IdempotencyKey != "" {
		var qID string
		var credits int
		var pbRaw, rsRaw []byte
		var exp time.Time
		err := pool.QueryRow(ctx, `
			SELECT id, credits_quoted, pricing_breakdown_json, COALESCE(route_snapshot_json,'{}'::jsonb), expires_at
			FROM ai_studio.generation_quotes
			WHERE user_id = $1 AND idempotency_key = $2 LIMIT 1`, req.UserID, req.IdempotencyKey).
			Scan(&qID, &credits, &pbRaw, &rsRaw, &exp)
		if err == nil {
			pb, rs := map[string]any{}, map[string]any{}
			_ = json.Unmarshal(pbRaw, &pb)
			_ = json.Unmarshal(rsRaw, &rs)
			return &QuoteResponse{
				QuoteID: qID, Credits: credits, ModelID: req.ModelID,
				PricingBreakdown: pb, RouteSnapshot: rs, ExpiresAt: exp, Idempotent: true,
			}, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, &PricingError{Code: "QUOTE_FAILED", Message: "获取模型报价失败", Status: 503}
		}
	}

	// 2. Verify active & visible model + optional capability version
	var category string
	var capsRaw []byte
	err := pool.QueryRow(ctx, `
		SELECT COALESCE(category,'image'), COALESCE(capabilities,'{}'::jsonb)
		FROM ai_studio.ai_models
		WHERE id = $1 AND status = 'active' AND COALESCE(is_visible, true)`, req.ModelID).
		Scan(&category, &capsRaw)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, &PricingError{Code: "MODEL_NOT_AVAILABLE", Message: "模型当前不可用", Status: 404}
	}
	if err != nil {
		return nil, &PricingError{Code: "QUOTE_FAILED", Message: "获取模型报价失败", Status: 503}
	}
	if req.Site == "canvas" && category != "image" && category != "image_edit" {
		return nil, &PricingError{Code: "CANVAS_CAPABILITY_DISABLED", Message: "Canvas 当前仅开放已验证的图片生成能力", Status: 422}
	}
	if req.CapabilityVersion != "" {
		h := sha256.Sum256(capsRaw)
		if "cap_"+hex.EncodeToString(h[:8]) != req.CapabilityVersion {
			return nil, &PricingError{Code: "MODEL_CAPABILITY_CHANGED", Message: "模型能力已更新，请刷新参数并重新报价", Status: 409}
		}
	}

	// 3. Load active pricing rule
	rec := PricingRecord{ModelID: req.ModelID, PricingType: "fixed", BaseCredits: 1, MinCredits: 1}
	var fcRaw []byte
	var minGross *float64
	var sitePrice *float64
	var validFrom, validUntil, ovExp *time.Time
	var ovReason, siteVerID *string
	var activePricing bool
	err = pool.QueryRow(ctx, `
		SELECT mp.pricing_type, COALESCE(mp.base_credits, 1), COALESCE(mp.min_credits, 1),
		       mp.min_gross_margin_rate, mp.formula_config, mp.is_active,
		       spv.id, spv.site_price, spv.effective_at, spv.expires_at, spv.override_reason, spv.override_expires_at
		FROM ai_studio.model_pricing mp
		LEFT JOIN ai_studio.model_site_price_versions spv ON spv.model_id = mp.model_id AND spv.status = 'active'
		WHERE mp.model_id = $1 LIMIT 1`, req.ModelID).
		Scan(&rec.PricingType, &rec.BaseCredits, &rec.MinCredits, &minGross, &fcRaw, &activePricing,
			&siteVerID, &sitePrice, &validFrom, &validUntil, &ovReason, &ovExp)
	if err == nil {
		if !activePricing {
			return nil, &PricingError{Code: "MODEL_PRICING_UNCONFIGURED", Message: "模型价盘已停用", Status: 422}
		}
		rec.MinGrossMarginRate = minGross
		rec.SitePriceCNY = sitePrice
		rec.PriceValidFrom = validFrom
		rec.PriceValidUntil = validUntil
		rec.OverrideExpiresAt = ovExp
		if siteVerID != nil {
			rec.SitePriceVersionID = *siteVerID
		}
		if ovReason != nil {
			rec.OverrideReason = *ovReason
		}
		if len(fcRaw) > 0 {
			_ = json.Unmarshal(fcRaw, &rec.FormulaConfig)
		}
	}

	// 4. FX rate + candidate routes
	usdToCny := DefaultUSDToCNY
	var dbFX float64
	if err := pool.QueryRow(ctx, `
		SELECT rate FROM ops_bill.exchange_rates
		WHERE from_currency = 'USD' AND to_currency = 'CNY'
		ORDER BY fetched_at DESC LIMIT 1`).Scan(&dbFX); err == nil && dbFX > 0 {
		usdToCny = dbFX
	}

	var routingMode = "balanced"
	_ = pool.QueryRow(ctx, `SELECT routing_mode FROM ai_studio.routing_policies WHERE model_id = $1`, req.ModelID).Scan(&routingMode)

	candidates, err := s.listEligibleRouteCandidates(ctx, req.ModelID, usdToCny, req.Parameters)
	if err != nil {
		return nil, &PricingError{Code: "QUOTE_FAILED", Message: "路由候选加载失败", Status: 503}
	}

	var highestCostPtr *float64
	var highestCost float64
	hasKnownCosts := false
	for _, c := range candidates {
		if c.CostKnown && c.EstimatedCostCNY != nil {
			hasKnownCosts = true
			if *c.EstimatedCostCNY > highestCost {
				highestCost = *c.EstimatedCostCNY
			}
		}
	}
	if hasKnownCosts {
		highestCostPtr = &highestCost
	}

	mult := computeFormulaMultipliers(rec.FormulaConfig, req.Parameters)
	pr := ResolveModelPricePolicy(rec, highestCostPtr, mult, time.Now().UTC())
	if len(pr.Blockers) > 0 {
		return nil, &PricingError{Code: pr.Blockers[0], Message: "当前价盘政策阻断报价: " + pr.Blockers[0], Status: 422}
	}

	// Filter margin-safe candidates when verified cost prices exist
	costCeilingCNY := pr.SitePriceCNY * (1 - pr.MinMarginRate) / (1 + ProviderCostReserveRate)
	var eligible []RouteCandidate
	for _, c := range candidates {
		if hasKnownCosts && c.CostKnown && c.EstimatedCostCNY != nil && *c.EstimatedCostCNY > costCeilingCNY {
			continue
		}
		eligible = append(eligible, c)
	}
	if hasKnownCosts && len(candidates) > 0 && len(eligible) == 0 {
		return nil, &PricingError{Code: "PRICING_MARGIN_BELOW_FLOOR", Message: "当前售价无法满足最低毛利底线", Status: 422}
	}
	if len(eligible) == 0 {
		eligible = candidates
	}

	var selected *RouteCandidate
	if len(eligible) > 0 {
		sortRouteCandidates(eligible, routingMode)
		selected = &eligible[0]
	}

	planID := req.SubscriptionLevel
	if planID == "" {
		_ = pool.QueryRow(ctx, `
			SELECT plan_id FROM ops_bill.subscriptions
			WHERE user_id = $1 AND status IN ('active','trialing')
			  AND (current_period_end IS NULL OR current_period_end > now())
			ORDER BY updated_at DESC LIMIT 1`, req.UserID).Scan(&planID)
	}
	if planID == "" {
		planID = "free"
	}

	routeSnapshot := map[string]any{
		"routingMode":        routingMode,
		"candidates":         eligible,
		"usdToCny":           usdToCny,
		"maxFailoverCostCny": costCeilingCNY,
		"hasWorkingRoute":    len(eligible) > 0,
	}
	var estCostUSD *float64
	if selected != nil {
		routeSnapshot["selectedProviderId"] = selected.ProviderID
		routeSnapshot["selectedProviderModelId"] = selected.ProviderModelID
		routeSnapshot["selectedProviderModelName"] = selected.ProviderModelName
		estCostUSD = selected.EstimatedCostUSD
	}

	breakdown := map[string]any{
		"subscriptionLevel":  planID,
		"modelId":            req.ModelID,
		"site":               req.Site,
		"baseCredits":        rec.BaseCredits,
		"credits":            pr.Credits,
		"creditsSource":      pr.CreditsSource,
		"sitePriceCny":       pr.SitePriceCNY,
		"sitePriceSource":    pr.SitePriceSource,
		"sitePriceVersionId": pr.SitePriceVersionID,
		"minGrossMarginRate": pr.MinMarginRate,
		"marginFloorSource":  pr.MarginSource,
		"pricePolicyVersion": pr.PolicyVersion,
		"hasWorkingRoute":    len(eligible) > 0,
	}

	quoteID := randomHexID("quote")
	expiresAt := time.Now().UTC().Add(5 * time.Minute)
	paramsBytes, _ := json.Marshal(req.Parameters)
	pbBytes, _ := json.Marshal(breakdown)
	rsBytes, _ := json.Marshal(routeSnapshot)
	fxBytes, _ := json.Marshal(map[string]any{"usdToCny": usdToCny, "fetchedAt": time.Now().UTC()})
	reqHash := hashParams(req.UserID, req.ModelID, req.Parameters, req.IdempotencyKey)

	var idemPtr any
	if req.IdempotencyKey != "" {
		idemPtr = req.IdempotencyKey
	}
	_, err = pool.Exec(ctx, `
		INSERT INTO ai_studio.generation_quotes
			(id, user_id, model_id, parameters_json, credits_quoted, pricing_breakdown_json,
			 estimated_provider_cost_usd, route_snapshot_json, fx_snapshot_json,
			 site_price_version_id, expires_at, created_at, idempotency_key, request_hash)
		VALUES ($1,$2,$3,$4::jsonb,$5,$6::jsonb,$7,$8::jsonb,$9::jsonb,$10,$11,now(),$12,$13)`,
		quoteID, req.UserID, req.ModelID, string(paramsBytes), pr.Credits, string(pbBytes),
		estCostUSD, string(rsBytes), string(fxBytes),
		nullableStr(pr.SitePriceVersionID), expiresAt, idemPtr, reqHash)
	if err != nil {
		return nil, &PricingError{Code: "QUOTE_FAILED", Message: "保存报价失败", Status: 409}
	}

	return &QuoteResponse{
		QuoteID: qIDOr(quoteID), Credits: pr.Credits, ModelID: req.ModelID,
		PricingBreakdown: breakdown, RouteSnapshot: routeSnapshot, ExpiresAt: expiresAt,
	}, nil
}

func (s *Service) listEligibleRouteCandidates(ctx context.Context, modelID string, usdToCny float64, params map[string]any) ([]RouteCandidate, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT pm.id, pm.provider_id, pm.provider_model_id, COALESCE(pm.provider_endpoint,''),
		       COALESCE(pm.priority,0), COALESCE((pm.metadata->>'primary')::boolean, false),
		       COALESCE(p.health_status,'unknown'), COALESCE(pm.metadata,'{}'::jsonb),
		       COALESCE(pm.cost_config,'{}'::jsonb),
		       pv.id, COALESCE(pv.price_type,''), COALESCE(pv.currency,'USD'), COALESCE(pv.price_config,'{}'::jsonb)
		FROM ai_studio.provider_models pm
		JOIN ai_studio.ai_providers p ON p.id = pm.provider_id
		LEFT JOIN ai_studio.provider_model_price_versions pv ON pv.provider_model_id = pm.id AND pv.status = 'active'
		WHERE pm.model_id = $1
		  AND pm.enabled = TRUE
		  AND p.enabled = TRUE
		  AND COALESCE(p.circuit_state, 'closed') NOT IN ('open', 'circuit_open')
		ORDER BY COALESCE((pm.metadata->>'primary')::boolean, false) DESC, pm.priority DESC, pm.id ASC`, modelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []RouteCandidate
	for rows.Next() {
		var c RouteCandidate
		var metaRaw, legacyCostRaw, verCostRaw []byte
		var verID, priceType, cur *string
		if err := rows.Scan(&c.ProviderModelID, &c.ProviderID, &c.ProviderModelName, &c.ProviderEndpoint,
			&c.Priority, &c.IsPrimary, &c.HealthStatus, &metaRaw, &legacyCostRaw,
			&verID, &priceType, &cur, &verCostRaw); err != nil {
			return nil, err
		}
		if len(metaRaw) > 0 {
			_ = json.Unmarshal(metaRaw, &c.Metadata)
		}
		if verID != nil {
			c.PriceVersionID = *verID
		}
		if priceType != nil {
			c.PriceType = *priceType
		}
		priceCfg := map[string]any{}
		if len(verCostRaw) > 0 && c.PriceVersionID != "" {
			_ = json.Unmarshal(verCostRaw, &priceCfg)
		} else if len(legacyCostRaw) > 0 {
			_ = json.Unmarshal(legacyCostRaw, &priceCfg)
		}
		curr := "USD"
		if cur != nil && *cur != "" {
			curr = *cur
		} else if s, ok := priceCfg["currency"].(string); ok && s != "" {
			curr = s
		}
		if u, cny, ok := estimatePriceConfigCostUSD(priceCfg, curr, usdToCny, params); ok {
			uCopy, cnyCopy := math.Round(u*1e8)/1e8, math.Round(cny*1e8)/1e8
			c.EstimatedCostUSD = &uCopy
			c.EstimatedCostCNY = &cnyCopy
			c.CostKnown = true
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func sortRouteCandidates(list []RouteCandidate, mode string) {
	sort.SliceStable(list, func(i, j int) bool {
		a, b := list[i], list[j]
		if mode == "cost" && a.CostKnown && b.CostKnown && a.EstimatedCostCNY != nil && b.EstimatedCostCNY != nil {
			if math.Abs(*a.EstimatedCostCNY-*b.EstimatedCostCNY) > 1e-6 {
				return *a.EstimatedCostCNY < *b.EstimatedCostCNY
			}
		}
		if a.IsPrimary != b.IsPrimary {
			return a.IsPrimary
		}
		if a.Priority != b.Priority {
			return a.Priority > b.Priority
		}
		return a.ProviderModelID < b.ProviderModelID
	})
}

func qIDOr(s string) string { return s }
func nullableStr(s string) any {
	if s == "" {
		return nil
	}
	return s
}

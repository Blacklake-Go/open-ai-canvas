package billing

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"one/backend/internal/pkg/ids"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PGRepository struct {
	Pool *pgxpool.Pool
}

func (r *PGRepository) GetOrder(ctx context.Context, orderID string) (*Order, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	var o Order
	var metaRaw []byte
	err := r.Pool.QueryRow(ctx, `
		SELECT id, user_id, plan_id, COALESCE(billing_cycle, ''), status, provider,
		       COALESCE(provider_order_id, ''), amount_minor, COALESCE(paid_amount_minor, 0),
		       currency, COALESCE(checkout_url, ''), COALESCE(metadata_json, '{}'::jsonb),
		       created_at, paid_at
		FROM ops_bill.orders
		WHERE id = $1
	`, orderID).Scan(
		&o.ID, &o.UserID, &o.PlanID, &o.BillingCycle, &o.Status, &o.Provider,
		&o.ProviderOrderID, &o.AmountCent, &o.PaidAmountCent,
		&o.Currency, &o.CheckoutURL, &metaRaw,
		&o.CreatedAt, &o.PaidAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if len(metaRaw) > 0 {
		_ = json.Unmarshal(metaRaw, &o.Metadata)
		if pt, ok := o.Metadata["productType"].(string); ok {
			o.ProductType = pt
		}
	}
	return &o, nil
}

func (r *PGRepository) ListOrdersByUser(ctx context.Context, userID string, limit, offset int) ([]Order, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	rows, err := r.Pool.Query(ctx, `
		SELECT id, user_id, plan_id, COALESCE(billing_cycle, ''), status, provider,
		       COALESCE(provider_order_id, ''), amount_minor, COALESCE(paid_amount_minor, 0),
		       currency, COALESCE(checkout_url, ''), COALESCE(metadata_json, '{}'::jsonb),
		       created_at, paid_at
		FROM ops_bill.orders
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Order{}
	for rows.Next() {
		var o Order
		var metaRaw []byte
		if err := rows.Scan(
			&o.ID, &o.UserID, &o.PlanID, &o.BillingCycle, &o.Status, &o.Provider,
			&o.ProviderOrderID, &o.AmountCent, &o.PaidAmountCent,
			&o.Currency, &o.CheckoutURL, &metaRaw,
			&o.CreatedAt, &o.PaidAt,
		); err == nil {
			if len(metaRaw) > 0 {
				_ = json.Unmarshal(metaRaw, &o.Metadata)
				if pt, ok := o.Metadata["productType"].(string); ok {
					o.ProductType = pt
				}
			}
			out = append(out, o)
		}
	}
	return out, nil
}

func (r *PGRepository) HasPaidExclusiveOrder(ctx context.Context, userID string) (bool, error) {
	if r == nil || r.Pool == nil {
		return false, ErrNotImplemented
	}
	var exists bool
	err := r.Pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM ops_bill.orders
			WHERE user_id = $1 AND status = 'paid'
			  AND (plan_id LIKE 'exclusive_%' OR metadata_json->>'productType' = 'exclusive_pack')
		)
	`, userID).Scan(&exists)
	if err != nil {
		return false, err
	}
	return exists, nil
}

func (r *PGRepository) CreateOrder(ctx context.Context, order Order, idempotencyKey string) (*Order, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	now := order.CreatedAt.UTC()
	if now.IsZero() {
		now = time.Now().UTC()
	}
	cycle := strings.ToLower(strings.TrimSpace(order.BillingCycle))
	if cycle == "" {
		cycle = "monthly"
	}
	meta := order.Metadata
	if meta == nil {
		meta = map[string]any{}
	}
	metaBytes, _ := json.Marshal(meta)

	var idemPtr *string
	if clean := strings.TrimSpace(idempotencyKey); clean != "" {
		idemPtr = &clean
	}

	var out Order
	var metaRaw []byte
	err := r.Pool.QueryRow(ctx, `
		INSERT INTO ops_bill.orders
		  (id, user_id, provider, plan_id, status, amount_minor, currency, idempotency_key, billing_cycle, metadata_json, version, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, 1, $11, $11)
		ON CONFLICT (provider, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
		RETURNING id, user_id, plan_id, COALESCE(billing_cycle, ''), status, provider,
		          COALESCE(provider_order_id, ''), amount_minor, COALESCE(paid_amount_minor, 0),
		          currency, COALESCE(checkout_url, ''), COALESCE(metadata_json, '{}'::jsonb),
		          created_at, paid_at
	`, order.ID, order.UserID, order.Provider, order.PlanID, order.Status, order.AmountCent, order.Currency, idemPtr, cycle, string(metaBytes), now).Scan(
		&out.ID, &out.UserID, &out.PlanID, &out.BillingCycle, &out.Status, &out.Provider,
		&out.ProviderOrderID, &out.AmountCent, &out.PaidAmountCent,
		&out.Currency, &out.CheckoutURL, &metaRaw,
		&out.CreatedAt, &out.PaidAt,
	)
	if err == nil {
		_ = json.Unmarshal(metaRaw, &out.Metadata)
		out.ProductType = order.ProductType
		return &out, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	// Idempotent replay lookup
	err = r.Pool.QueryRow(ctx, `
		SELECT id, user_id, plan_id, COALESCE(billing_cycle, ''), status, provider,
		       COALESCE(provider_order_id, ''), amount_minor, COALESCE(paid_amount_minor, 0),
		       currency, COALESCE(checkout_url, ''), COALESCE(metadata_json, '{}'::jsonb),
		       created_at, paid_at
		FROM ops_bill.orders
		WHERE provider = $1 AND idempotency_key = $2
	`, order.Provider, *idemPtr).Scan(
		&out.ID, &out.UserID, &out.PlanID, &out.BillingCycle, &out.Status, &out.Provider,
		&out.ProviderOrderID, &out.AmountCent, &out.PaidAmountCent,
		&out.Currency, &out.CheckoutURL, &metaRaw,
		&out.CreatedAt, &out.PaidAt,
	)
	if err != nil {
		return nil, err
	}
	if out.UserID != order.UserID || out.PlanID != order.PlanID || out.AmountCent != order.AmountCent || out.Currency != order.Currency {
		return nil, svcErr(409, "IDEMPOTENCY_CONFLICT", "幂等键已经用于另一笔支付订单")
	}
	_ = json.Unmarshal(metaRaw, &out.Metadata)
	if pt, ok := out.Metadata["productType"].(string); ok {
		out.ProductType = pt
	}
	return &out, nil
}

func (r *PGRepository) UpdateOrderCheckout(ctx context.Context, orderID, providerOrderID, checkoutURL string) error {
	if r == nil || r.Pool == nil {
		return nil
	}
	_, err := r.Pool.Exec(ctx, `
		UPDATE ops_bill.orders
		SET provider_order_id = COALESCE(NULLIF($2, ''), provider_order_id),
		    checkout_url = COALESCE(NULLIF($3, ''), checkout_url),
		    updated_at = now()
		WHERE id = $1
	`, orderID, providerOrderID, checkoutURL)
	return err
}

func (r *PGRepository) GetActiveSubscription(ctx context.Context, userID string) (*SubscriptionInfo, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	var sub SubscriptionInfo
	err := r.Pool.QueryRow(ctx, `
		SELECT id, plan_id, status, COALESCE(provider, ''), COALESCE(billing_cycle, ''),
		       COALESCE(cancel_at_period_end, FALSE), current_period_end
		FROM ops_bill.subscriptions
		WHERE user_id = $1 AND status IN ('active', 'trialing', 'past_due')
		  AND (current_period_end IS NULL OR current_period_end > now())
		ORDER BY updated_at DESC
		LIMIT 1
	`, userID).Scan(
		&sub.ID, &sub.PlanID, &sub.Status, &sub.Provider, &sub.BillingCycle,
		&sub.CancelAtPeriodEnd, &sub.CurrentPeriodEnd,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	sub.IsSubscribed = sub.PlanID != "" && sub.PlanID != "free"
	return &sub, nil
}

func (r *PGRepository) UpdateSubscriptionCancelAtPeriodEnd(ctx context.Context, userID string, cancel bool) (*SubscriptionInfo, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	var sub SubscriptionInfo
	err := r.Pool.QueryRow(ctx, `
		UPDATE ops_bill.subscriptions
		SET cancel_at_period_end = $2, updated_at = now(), version = version + 1
		WHERE id = (
			SELECT id FROM ops_bill.subscriptions
			WHERE user_id = $1 AND status IN ('active', 'trialing', 'past_due')
			ORDER BY updated_at DESC LIMIT 1
		)
		RETURNING id, plan_id, status, COALESCE(provider, ''), COALESCE(billing_cycle, ''),
		          COALESCE(cancel_at_period_end, FALSE), current_period_end
	`, userID, cancel).Scan(
		&sub.ID, &sub.PlanID, &sub.Status, &sub.Provider, &sub.BillingCycle,
		&sub.CancelAtPeriodEnd, &sub.CurrentPeriodEnd,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, svcErr(404, "SUBSCRIPTION_NOT_FOUND", "当前没有有效订阅")
	}
	if err != nil {
		return nil, err
	}
	sub.IsSubscribed = sub.PlanID != "" && sub.PlanID != "free"
	if plan := FindPlanByID(sub.PlanID); plan != nil {
		sub.MaxConcurrentTasks = plan.AsyncConcurrency
		sub.ExclusiveFeatures = plan.ExclusiveFeatures
		sub.PriorityQueue = plan.ID != "free" && plan.ID != "starter"
	}
	return &sub, nil
}

func (r *PGRepository) GetUsageSummary(ctx context.Context, userID string) (*UsageSummary, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	var out UsageSummary
	_ = r.Pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM ai_studio.creations WHERE user_id = $1`, userID).Scan(&out.TotalCreations)
	_ = r.Pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(ABS(delta))::bigint, 0)
		FROM ops_bill.credit_ledger_v2
		WHERE user_id = $1 AND delta < 0 AND action_type IN ('COMMIT', 'GENERATION_DEBIT', 'DEDUCT')
	`, userID).Scan(&out.TotalCreditsUsed)
	_ = r.Pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(ABS(delta))::bigint, 0)
		FROM ops_bill.credit_ledger_v2
		WHERE user_id = $1 AND delta < 0 AND action_type IN ('COMMIT', 'GENERATION_DEBIT', 'DEDUCT')
		  AND created_at >= now() - interval '30 days'
	`, userID).Scan(&out.Recent30DaysUsed)
	return &out, nil
}

func parseCouponValue(cType, rawVal string) (title string, credits int64, planID string, durationDays int) {
	cTypeLower := strings.ToLower(strings.TrimSpace(cType))
	switch cTypeLower {
	case "credits", "credit":
		credits, _ = strconv.ParseInt(strings.TrimSpace(rawVal), 10, 64)
		title = fmt.Sprintf("%d 算力积分兑换券", credits)
		return title, credits, "", 0
	default:
		// subscription / plan coupon e.g. "basic:30" or "pro"
		parts := strings.Split(strings.TrimSpace(rawVal), ":")
		planID = strings.ToLower(strings.TrimSpace(parts[0]))
		durationDays = 30
		if len(parts) > 1 {
			if d, err := strconv.Atoi(strings.TrimSpace(parts[1])); err == nil && d > 0 {
				durationDays = d
			}
		}
		title = fmt.Sprintf("%s 会员 %d 天兑换券", strings.ToUpper(planID), durationDays)
		return title, 0, planID, durationDays
	}
}

func (r *PGRepository) VerifyCoupon(ctx context.Context, code, userID string, now time.Time) (*CouponInfo, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	var cCode, cType, cVal string
	var maxUses, usedCount int
	var isActive bool
	var expiresAt *time.Time
	err := r.Pool.QueryRow(ctx, `
		SELECT code, type, value, max_uses, used_count, is_active, expires_at
		FROM ops_bill.coupons WHERE code = $1
	`, code).Scan(&cCode, &cType, &cVal, &maxUses, &usedCount, &isActive, &expiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrCouponNotFound
	}
	if err != nil {
		return nil, err
	}
	if !isActive || usedCount >= maxUses || (expiresAt != nil && !expiresAt.After(now)) {
		return nil, ErrCouponInvalid
	}
	if userID != "" {
		var already bool
		_ = r.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM ops_bill.coupon_redemptions WHERE coupon_code = $1 AND user_id = $2)`, cCode, userID).Scan(&already)
		if already {
			return nil, ErrCouponRedeemed
		}
	}
	title, credits, planID, durationDays := parseCouponValue(cType, cVal)
	return &CouponInfo{
		Code:         cCode,
		Title:        title,
		Type:         cType,
		Credits:      credits,
		PlanID:       planID,
		DurationDays: durationDays,
		ExpiresAt:    expiresAt,
	}, nil
}

func (r *PGRepository) RedeemCoupon(ctx context.Context, code, userID, ip string, now time.Time) (map[string]any, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var cCode, cType, cVal string
	var maxUses, usedCount int
	var isActive bool
	var expiresAt *time.Time
	err = tx.QueryRow(ctx, `
		SELECT code, type, value, max_uses, used_count, is_active, expires_at
		FROM ops_bill.coupons WHERE code = $1 FOR UPDATE
	`, code).Scan(&cCode, &cType, &cVal, &maxUses, &usedCount, &isActive, &expiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrCouponNotFound
	}
	if err != nil {
		return nil, err
	}
	if !isActive || usedCount >= maxUses || (expiresAt != nil && !expiresAt.After(now)) {
		return nil, ErrCouponInvalid
	}
	var already bool
	_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM ops_bill.coupon_redemptions WHERE coupon_code = $1 AND user_id = $2)`, cCode, userID).Scan(&already)
	if already {
		return nil, ErrCouponRedeemed
	}

	tag, err := tx.Exec(ctx, `
		UPDATE ops_bill.coupons
		SET used_count = used_count + 1
		WHERE code = $1 AND is_active = TRUE AND used_count < max_uses
	`, cCode)
	if err != nil || tag.RowsAffected() == 0 {
		return nil, ErrCouponInvalid
	}

	redmID, _ := ids.NewPrefixedID("redm")
	if _, err := tx.Exec(ctx, `
		INSERT INTO ops_bill.coupon_redemptions (id, coupon_code, user_id, value, redeemed_at)
		VALUES ($1, $2, $3, $4, $5)
	`, redmID, cCode, userID, cVal, now.UTC()); err != nil {
		return nil, err
	}

	title, credits, planID, durationDays := parseCouponValue(cType, cVal)
	result := map[string]any{
		"redeemed":     true,
		"redemptionId": redmID,
		"code":         cCode,
		"type":         cType,
		"title":        title,
	}

	if credits > 0 {
		newBal, err := grantWalletCreditsTx(ctx, tx, userID, "PERPETUAL", credits, "COUPON_REDEEM", redmID, fmt.Sprintf("兑换卡密 %s", cCode), "coupon:"+redmID, nil, now)
		if err != nil {
			return nil, err
		}
		result["credits"] = credits
		result["balanceAfter"] = newBal
	} else if planID != "" {
		periodEnd := now.UTC().Add(time.Duration(durationDays) * 24 * time.Hour)
		subID, _ := ids.NewPrefixedID("sub")
		_, err := tx.Exec(ctx, `
			INSERT INTO ops_bill.subscriptions
			  (id, user_id, provider, provider_customer_id, provider_subscription_id, plan_id, status, current_period_end, last_synced_at, version, created_at, updated_at)
			VALUES ($1, $2, 'coupon', $3, $4, $5, 'active', $6, $7, 1, $7, $7)
			ON CONFLICT (provider, provider_subscription_id) DO UPDATE
			SET status = EXCLUDED.status, current_period_end = EXCLUDED.current_period_end, updated_at = EXCLUDED.updated_at
		`, subID, userID, "coupon_"+strings.ToUpper(planID), redmID, planID, periodEnd, now.UTC())
		if err != nil {
			return nil, err
		}
		if plan := FindPlanByID(planID); plan != nil && plan.QuotaBase > 0 {
			_, err = grantWalletCreditsTx(ctx, tx, userID, "SUBSCRIPTION", plan.QuotaBase, "COUPON_SUBSCRIPTION_GRANT", redmID, fmt.Sprintf("兑换 %s 会员算力", plan.Name), "coupon_sub:"+redmID, &periodEnd, now)
			if err != nil {
				return nil, err
			}
		}
		result["planId"] = planID
		result["durationDays"] = durationDays
		result["currentPeriodEnd"] = periodEnd
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return result, nil
}

func (r *PGRepository) ClaimWebhookEvent(ctx context.Context, provider, eventID, eventType string, payload map[string]any, headers map[string]string, now time.Time) (bool, error) {
	if r == nil || r.Pool == nil {
		return false, ErrNotImplemented
	}
	payloadBytes, _ := json.Marshal(payload)
	headersBytes, _ := json.Marshal(headers)
	var insertedID string
	err := r.Pool.QueryRow(ctx, `
		INSERT INTO ops_bill.webhook_events
		  (provider, event_id, event_type, status, attempts, payload_json, headers_json, received_at, last_attempt_at, created_at)
		VALUES ($1, $2, $3, 'received', 1, $4::jsonb, $5::jsonb, $6, $6, $6)
		ON CONFLICT (provider, event_id) DO NOTHING
		RETURNING event_id
	`, provider, eventID, eventType, string(payloadBytes), string(headersBytes), now.UTC()).Scan(&insertedID)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return insertedID != "", nil
}

func (r *PGRepository) MarkWebhookProcessed(ctx context.Context, provider, eventID string, now time.Time) error {
	if r == nil || r.Pool == nil {
		return ErrNotImplemented
	}
	_, err := r.Pool.Exec(ctx, `
		UPDATE ops_bill.webhook_events
		SET status = 'processed', processed_at = COALESCE(processed_at, $3), last_error = NULL, next_retry_at = NULL, last_attempt_at = $3
		WHERE provider = $1 AND event_id = $2
	`, provider, eventID, now.UTC())
	return err
}

func (r *PGRepository) MarkWebhookFailed(ctx context.Context, provider, eventID, errMsg string, now time.Time) error {
	if r == nil || r.Pool == nil {
		return ErrNotImplemented
	}
	retryAt := now.UTC().Add(5 * time.Minute)
	_, err := r.Pool.Exec(ctx, `
		UPDATE ops_bill.webhook_events
		SET status = 'failed', last_error = $3, next_retry_at = $4, attempts = attempts + 1, last_attempt_at = $5
		WHERE provider = $1 AND event_id = $2
	`, provider, eventID, errMsg, retryAt, now.UTC())
	return err
}

func (r *PGRepository) RecordRejectedWebhook(ctx context.Context, provider, eventID, eventType, errMsg string, payload map[string]any, headers map[string]string, now time.Time) error {
	if r == nil || r.Pool == nil {
		return ErrNotImplemented
	}
	payloadBytes, _ := json.Marshal(payload)
	headersBytes, _ := json.Marshal(headers)
	_, err := r.Pool.Exec(ctx, `
		INSERT INTO ops_bill.webhook_events
		  (provider, event_id, event_type, status, attempts, last_error, payload_json, headers_json, received_at, last_attempt_at, created_at)
		VALUES ($1, $2, $3, 'rejected', 1, $4, $5::jsonb, $6::jsonb, $7, $7, $7)
		ON CONFLICT (provider, event_id) DO UPDATE SET
		  status = 'rejected', attempts = ops_bill.webhook_events.attempts + 1,
		  last_error = EXCLUDED.last_error, last_attempt_at = EXCLUDED.last_attempt_at
	`, provider, eventID, eventType, errMsg, string(payloadBytes), string(headersBytes), now.UTC())
	return err
}

func (r *PGRepository) ApplyPaymentWebhook(ctx context.Context, in WebhookFulfillmentInput, now time.Time) (*WebhookDispatchResult, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var o Order
	var metaRaw []byte
	err = tx.QueryRow(ctx, `
		SELECT id, user_id, plan_id, COALESCE(billing_cycle, 'monthly'), status, provider,
		       COALESCE(provider_order_id, ''), amount_minor, COALESCE(paid_amount_minor, 0),
		       currency, COALESCE(metadata_json, '{}'::jsonb)
		FROM ops_bill.orders
		WHERE id = $1 OR ($2 <> '' AND provider = $3 AND provider_order_id = $2)
		FOR UPDATE
	`, in.OrderID, in.ProviderOrderID, in.Provider).Scan(
		&o.ID, &o.UserID, &o.PlanID, &o.BillingCycle, &o.Status, &o.Provider,
		&o.ProviderOrderID, &o.AmountCent, &o.PaidAmountCent,
		&o.Currency, &metaRaw,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return &WebhookDispatchResult{Action: "order_not_found_ignored", OrderID: in.OrderID}, nil
	}
	if err != nil {
		return nil, err
	}
	if len(metaRaw) > 0 {
		_ = json.Unmarshal(metaRaw, &o.Metadata)
		if pt, ok := o.Metadata["productType"].(string); ok {
			o.ProductType = pt
		}
	}

	if in.IsRefund {
		if o.Status == "refunded" {
			return &WebhookDispatchResult{Action: "already_refunded", Duplicate: true, OrderID: o.ID}, nil
		}
		if _, err := tx.Exec(ctx, `
			UPDATE ops_bill.orders
			SET status = 'refunded', refunded_at = $2, updated_at = $2, version = version + 1
			WHERE id = $1
		`, o.ID, now.UTC()); err != nil {
			return nil, err
		}
		payID, _ := ids.NewPrefixedID("pay")
		payloadBytes, _ := json.Marshal(in.RawPayload)
		_, _ = tx.Exec(ctx, `
			INSERT INTO ops_bill.payment_ledger
			  (id, provider, event_id, order_id, user_id, entry_type, amount_minor, currency, provider_payment_id, idempotency_key, payload_json)
			VALUES ($1, $2, $3, $4, $5, 'payment_refund', $6, $7, $8, $9, $10::jsonb)
			ON CONFLICT (idempotency_key) DO NOTHING
		`, payID, in.Provider, in.EventID, o.ID, o.UserID, o.AmountCent, o.Currency, firstStr(in.ProviderPaymentID, o.ProviderOrderID), "refund:"+o.ID, string(payloadBytes))

		creditAmt := extractCreditAmount(&o)
		if creditAmt > 0 {
			_, _ = reverseWalletCreditsTx(ctx, tx, o.UserID, o.ID, creditAmt, now)
		}
		if o.ProductType == "" || o.ProductType == "subscription" {
			_, _ = tx.Exec(ctx, `
				UPDATE ops_bill.subscriptions
				SET status = 'canceled', updated_at = $3, version = version + 1
				WHERE user_id = $1 AND plan_id = $2 AND status IN ('active', 'trialing', 'past_due')
			`, o.UserID, o.PlanID, now.UTC())
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		return &WebhookDispatchResult{Action: "refunded", OrderID: o.ID}, nil
	}

	if o.Status == "paid" {
		return &WebhookDispatchResult{Action: "already_paid", Duplicate: true, OrderID: o.ID}, nil
	}

	if in.PaidAmountMinor > 0 && o.AmountCent > 0 && in.PaidAmountMinor < o.AmountCent {
		return nil, ErrAmountMismatch
	}
	if in.Currency != "" && o.Currency != "" && !strings.EqualFold(in.Currency, o.Currency) {
		return nil, ErrAmountMismatch
	}

	paidMinor := in.PaidAmountMinor
	if paidMinor <= 0 {
		paidMinor = o.AmountCent
	}
	if _, err := tx.Exec(ctx, `
		UPDATE ops_bill.orders
		SET status = 'paid',
		    paid_amount_minor = $2,
		    provider_order_id = COALESCE(NULLIF($3, ''), provider_order_id),
		    provider_payment_id = COALESCE(NULLIF($4, ''), provider_payment_id),
		    paid_at = $5,
		    updated_at = $5,
		    version = version + 1
		WHERE id = $1
	`, o.ID, paidMinor, in.ProviderOrderID, in.ProviderPaymentID, now.UTC()); err != nil {
		return nil, err
	}

	payID, _ := ids.NewPrefixedID("pay")
	payloadBytes, _ := json.Marshal(in.RawPayload)
	_, err = tx.Exec(ctx, `
		INSERT INTO ops_bill.payment_ledger
		  (id, provider, event_id, order_id, user_id, entry_type, amount_minor, currency, provider_payment_id, idempotency_key, payload_json)
		VALUES ($1, $2, $3, $4, $5, 'payment_succeeded', $6, $7, $8, $9, $10::jsonb)
		ON CONFLICT (idempotency_key) DO NOTHING
	`, payID, in.Provider, in.EventID, o.ID, o.UserID, paidMinor, o.Currency, in.ProviderPaymentID, "pay:"+o.ID, string(payloadBytes))
	if err != nil {
		return nil, err
	}

	creditAmt := extractCreditAmount(&o)
	switch o.ProductType {
	case "credit_pack", "exclusive_pack":
		if creditAmt > 0 {
			if _, err := grantWalletCreditsTx(ctx, tx, o.UserID, "PERPETUAL", creditAmt, "ORDER_CREDIT_GRANT", o.ID, fmt.Sprintf("购买算力包 %s", o.PlanID), "order_credit:"+o.ID, nil, now); err != nil {
				return nil, err
			}
		}
	default:
		periodEnd := now.UTC().AddDate(0, 1, 0)
		switch o.BillingCycle {
		case "yearly":
			periodEnd = now.UTC().AddDate(1, 0, 0)
		case "quarterly":
			periodEnd = now.UTC().AddDate(0, 3, 0)
		}
		if in.CurrentPeriodEnd != nil {
			periodEnd = in.CurrentPeriodEnd.UTC()
		}
		subID, _ := ids.NewPrefixedID("sub")
		if _, err := tx.Exec(ctx, `
			INSERT INTO ops_bill.subscriptions
			  (id, user_id, provider, provider_customer_id, provider_subscription_id, plan_id, billing_cycle, status, current_period_end, last_synced_at, version, created_at, updated_at)
			VALUES ($1, $2, $3, NULLIF($4, ''), COALESCE(NULLIF($5, ''), $1), $6, $7, 'active', $8, $9, 1, $9, $9)
			ON CONFLICT (provider, provider_subscription_id) DO UPDATE
			SET plan_id = EXCLUDED.plan_id, billing_cycle = EXCLUDED.billing_cycle, status = 'active', current_period_end = EXCLUDED.current_period_end, last_synced_at = EXCLUDED.last_synced_at, updated_at = EXCLUDED.updated_at, version = ops_bill.subscriptions.version + 1
		`, subID, o.UserID, in.Provider, in.ProviderCustomerID, firstStr(in.ProviderSubscriptionID, o.ID), o.PlanID, o.BillingCycle, periodEnd, now.UTC()); err != nil {
			return nil, err
		}
		if creditAmt > 0 {
			if _, err := grantWalletCreditsTx(ctx, tx, o.UserID, "SUBSCRIPTION", creditAmt, "SUBSCRIPTION_GRANT", o.ID, fmt.Sprintf("订阅套餐 %s 算力发放", o.PlanID), "order_sub:"+o.ID, &periodEnd, now); err != nil {
				return nil, err
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &WebhookDispatchResult{Action: "paid", OrderID: o.ID}, nil
}

func extractCreditAmount(o *Order) int64 {
	if o != nil && o.Metadata != nil {
		if v, ok := o.Metadata["creditAmount"]; ok {
			switch n := v.(type) {
			case float64:
				return int64(math.Round(n))
			case int64:
				return n
			case int:
				return int64(n)
			}
		}
	}
	if o == nil {
		return 0
	}
	if p := FindCreditPackByID(o.PlanID); p != nil {
		return p.Credits
	}
	if p := FindExclusivePackByID(o.PlanID); p != nil {
		return p.StandardTotalCredits
	}
	if p := FindPlanByID(o.PlanID); p != nil {
		return p.QuotaBase
	}
	return 0
}

func grantWalletCreditsTx(ctx context.Context, tx pgx.Tx, userID, bucket string, amount int64, actionType, refID, reason, idemKey string, subExpiresAt *time.Time, now time.Time) (int64, error) {
	if amount <= 0 {
		return 0, nil
	}
	_, err := tx.Exec(ctx, `
		INSERT INTO ops_bill.credit_wallets
		  (user_id, daily_free_credits, subscription_credits, perpetual_credits, frozen_credits, version, created_at, updated_at)
		VALUES ($1, 0, 0, 0, 0, 1, $2, $2)
		ON CONFLICT (user_id) DO NOTHING
	`, userID, now.UTC())
	if err != nil {
		return 0, err
	}
	var daily, sub, perp int64
	if err := tx.QueryRow(ctx, `
		SELECT daily_free_credits, subscription_credits, perpetual_credits
		FROM ops_bill.credit_wallets WHERE user_id = $1 FOR UPDATE
	`, userID).Scan(&daily, &sub, &perp); err != nil {
		return 0, err
	}
	var bucketBal int64
	if bucket == "SUBSCRIPTION" {
		sub += amount
		bucketBal = sub
		_, err = tx.Exec(ctx, `
			UPDATE ops_bill.credit_wallets
			SET subscription_credits = $2, subscription_expires_at = COALESCE($3, subscription_expires_at), version = version + 1, updated_at = $4
			WHERE user_id = $1
		`, userID, sub, subExpiresAt, now.UTC())
	} else {
		bucket = "PERPETUAL"
		perp += amount
		bucketBal = perp
		_, err = tx.Exec(ctx, `
			UPDATE ops_bill.credit_wallets
			SET perpetual_credits = $2, version = version + 1, updated_at = $3
			WHERE user_id = $1
		`, userID, perp, now.UTC())
	}
	if err != nil {
		return 0, err
	}
	newTotal := daily + sub + perp
	_, _ = tx.Exec(ctx, `UPDATE auth_usr.users SET credits = $2, updated_at = $3 WHERE id = $1`, userID, newTotal, now.UTC())
	lid, _ := ids.NewPrefixedID("cl2")
	_, err = tx.Exec(ctx, `
		INSERT INTO ops_bill.credit_ledger_v2
		  (id, user_id, bucket_type, delta, balance_after, action_type, reference_id, description, idempotency_key, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
	`, lid, userID, bucket, amount, bucketBal, actionType, refID, reason, idemKey, now.UTC())
	return newTotal, err
}

func reverseWalletCreditsTx(ctx context.Context, tx pgx.Tx, userID, refID string, amount int64, now time.Time) (int64, error) {
	if amount <= 0 {
		return 0, nil
	}
	var daily, sub, perp int64
	err := tx.QueryRow(ctx, `
		SELECT daily_free_credits, subscription_credits, perpetual_credits
		FROM ops_bill.credit_wallets WHERE user_id = $1 FOR UPDATE
	`, userID).Scan(&daily, &sub, &perp)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	takePerp := amount
	if takePerp > perp {
		takePerp = perp
	}
	perp -= takePerp
	rem := amount - takePerp
	takeSub := rem
	if takeSub > sub {
		takeSub = sub
	}
	sub -= takeSub
	if _, err := tx.Exec(ctx, `
		UPDATE ops_bill.credit_wallets
		SET perpetual_credits = $2, subscription_credits = $3, version = version + 1, updated_at = $4
		WHERE user_id = $1
	`, userID, perp, sub, now.UTC()); err != nil {
		return 0, err
	}
	newTotal := daily + sub + perp
	_, _ = tx.Exec(ctx, `UPDATE auth_usr.users SET credits = $2, updated_at = $3 WHERE id = $1`, userID, newTotal, now.UTC())
	lid, _ := ids.NewPrefixedID("cl2")
	_, _ = tx.Exec(ctx, `
		INSERT INTO ops_bill.credit_ledger_v2
		  (id, user_id, bucket_type, delta, balance_after, action_type, reference_id, description, idempotency_key, created_at)
		VALUES ($1, $2, 'PERPETUAL', $3, $4, 'REFUND_REVERSAL', $5, '订单退款收回算力', $6, $7)
		ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
	`, lid, userID, -(takePerp + takeSub), perp+sub, refID, "refund_rev:"+refID, now.UTC())
	return newTotal, nil
}

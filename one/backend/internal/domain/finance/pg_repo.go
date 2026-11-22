package finance

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"one/backend/internal/pkg/ids"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PGRepository struct {
	Pool *pgxpool.Pool
}

func (r *PGRepository) GetCreditsBalance(ctx context.Context, userID string) (int64, error) {
	w, err := r.GetCreditWallet(ctx, userID)
	if err != nil {
		return 0, err
	}
	return w.TotalAvailable, nil
}

func (r *PGRepository) ensureCreditWalletForUpdate(ctx context.Context, tx pgx.Tx, userID string, now time.Time) (*CreditWallet, error) {
	_, err := tx.Exec(ctx, `
		INSERT INTO ops_bill.credit_wallets
		  (user_id, daily_free_credits, subscription_credits, perpetual_credits, frozen_credits, version, created_at, updated_at)
		VALUES ($1, 0, 0, 0, 0, 1, $2, $2)
		ON CONFLICT (user_id) DO NOTHING
	`, userID, now.UTC())
	if err != nil {
		return nil, err
	}
	var w CreditWallet
	err = tx.QueryRow(ctx, `
		SELECT user_id, daily_free_credits, subscription_credits, perpetual_credits, frozen_credits, daily_expires_at, subscription_expires_at
		FROM ops_bill.credit_wallets WHERE user_id = $1 FOR UPDATE
	`, userID).Scan(
		&w.UserID, &w.DailyFreeCredits, &w.SubscriptionCredits, &w.PerpetualCredits,
		&w.FrozenCredits, &w.DailyExpiresAt, &w.SubscriptionExpiresAt,
	)
	if err != nil {
		return nil, err
	}
	if w.DailyExpiresAt != nil && !w.DailyExpiresAt.After(now) {
		w.DailyFreeCredits = 0
	}
	if w.SubscriptionExpiresAt != nil && !w.SubscriptionExpiresAt.After(now) {
		w.SubscriptionCredits = 0
	}
	w.TotalAvailable = w.DailyFreeCredits + w.SubscriptionCredits + w.PerpetualCredits
	return &w, nil
}

func (r *PGRepository) GetCreditWallet(ctx context.Context, userID string) (*CreditWallet, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	now := time.Now().UTC()
	var w CreditWallet
	err := r.Pool.QueryRow(ctx, `
		SELECT user_id, daily_free_credits, subscription_credits, perpetual_credits, frozen_credits, daily_expires_at, subscription_expires_at
		FROM ops_bill.credit_wallets WHERE user_id = $1
	`, userID).Scan(
		&w.UserID, &w.DailyFreeCredits, &w.SubscriptionCredits, &w.PerpetualCredits,
		&w.FrozenCredits, &w.DailyExpiresAt, &w.SubscriptionExpiresAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		var legacy int64
		_ = r.Pool.QueryRow(ctx, `SELECT COALESCE(credits, 0)::bigint FROM auth_usr.users WHERE id = $1`, userID).Scan(&legacy)
		return &CreditWallet{
			UserID:           userID,
			PerpetualCredits: legacy,
			TotalAvailable:   legacy,
		}, nil
	}
	if err != nil {
		return nil, err
	}
	if w.DailyExpiresAt != nil && !w.DailyExpiresAt.After(now) {
		w.DailyFreeCredits = 0
	}
	if w.SubscriptionExpiresAt != nil && !w.SubscriptionExpiresAt.After(now) {
		w.SubscriptionCredits = 0
	}
	w.TotalAvailable = w.DailyFreeCredits + w.SubscriptionCredits + w.PerpetualCredits
	return &w, nil
}

func (r *PGRepository) GetCreditLedger(ctx context.Context, userID string, limit, offset int) ([]LedgerEntry, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	rows, err := r.Pool.Query(ctx, `
		SELECT id, user_id, bucket_type, delta, balance_after, action_type, COALESCE(reference_id, ''), COALESCE(description, ''), COALESCE(idempotency_key, ''), created_at
		FROM ops_bill.credit_ledger_v2
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []LedgerEntry{}
	for rows.Next() {
		var e LedgerEntry
		if rows.Scan(&e.ID, &e.UserID, &e.BucketType, &e.Delta, &e.Balance, &e.ActionType, &e.ReferenceID, &e.Reason, &e.IdempotencyKey, &e.CreatedAt) == nil {
			out = append(out, e)
		}
	}
	return out, nil
}

func shanghaiTodayBounds(now time.Time) (dateStr string, endOfDay time.Time) {
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		loc = time.FixedZone("CST", 8*3600)
	}
	local := now.In(loc)
	dateStr = local.Format("2006-01-02")
	endOfDay = time.Date(local.Year(), local.Month(), local.Day(), 23, 59, 59, 0, loc).UTC()
	return dateStr, endOfDay
}

func (r *PGRepository) DailyCheckIn(ctx context.Context, userID string, reward int64, now time.Time) (*CheckInResult, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	w, err := r.ensureCreditWalletForUpdate(ctx, tx, userID, now)
	if err != nil {
		return nil, err
	}
	dateStr, endOfDay := shanghaiTodayBounds(now)
	idemKey := fmt.Sprintf("checkin:%s:%s", userID, dateStr)

	var existingID string
	err = tx.QueryRow(ctx, `SELECT id FROM ops_bill.credit_ledger_v2 WHERE idempotency_key = $1 LIMIT 1`, idemKey).Scan(&existingID)
	if err == nil {
		return &CheckInResult{
			Success:      true,
			CheckedIn:    true,
			Reward:       0,
			TotalCredits: w.TotalAvailable,
			AlreadyDone:  true,
		}, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	newDaily := w.DailyFreeCredits + reward
	newTotal := newDaily + w.SubscriptionCredits + w.PerpetualCredits
	if _, err := tx.Exec(ctx, `
		UPDATE ops_bill.credit_wallets
		SET daily_free_credits = $2, daily_expires_at = $3, version = version + 1, updated_at = $4
		WHERE user_id = $1
	`, userID, newDaily, endOfDay, now.UTC()); err != nil {
		return nil, err
	}
	_, _ = tx.Exec(ctx, `UPDATE auth_usr.users SET credits = $2, updated_at = $3 WHERE id = $1`, userID, newTotal, now.UTC())

	lid, _ := ids.NewPrefixedID("cl2")
	if _, err := tx.Exec(ctx, `
		INSERT INTO ops_bill.credit_ledger_v2
		  (id, user_id, bucket_type, delta, balance_after, action_type, reference_id, description, idempotency_key, created_at)
		VALUES ($1, $2, 'DAILY_FREE', $3, $4, 'DAILY_CHECKIN', $5, '每日签到领取算力积分', $6, $7)
	`, lid, userID, reward, newDaily, dateStr, idemKey, now.UTC()); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &CheckInResult{
		Success:      true,
		CheckedIn:    true,
		Reward:       reward,
		TotalCredits: newTotal,
	}, nil
}

func (r *PGRepository) ReserveCredits(ctx context.Context, req ReserveRequest, now time.Time) (*ReservationResult, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Check existing reservation by idempotency key
	var existingID, existingUser, existingStatus string
	var existingAmt int64
	var existingExp time.Time
	var existingSplitRaw json.RawMessage
	err = tx.QueryRow(ctx, `
		SELECT id, user_id, status, reserved_amount, bucket_split_json, expires_at
		FROM ops_bill.credit_reservations
		WHERE idempotency_key = $1 FOR UPDATE
	`, req.IdempotencyKey).Scan(&existingID, &existingUser, &existingStatus, &existingAmt, &existingSplitRaw, &existingExp)
	if err == nil {
		if existingUser != req.UserID || existingAmt != req.Amount {
			return nil, ErrIdempotencyConflict
		}
		split := map[string]int64{}
		_ = json.Unmarshal(existingSplitRaw, &split)
		return &ReservationResult{
			Success:        true,
			ReservationID:  existingID,
			Status:         existingStatus,
			ReservedAmount: existingAmt,
			BucketSplit:    split,
			ExpiresAt:      existingExp,
			Idempotent:     true,
		}, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	w, err := r.ensureCreditWalletForUpdate(ctx, tx, req.UserID, now)
	if err != nil {
		return nil, err
	}
	if w.TotalAvailable < req.Amount {
		return nil, ErrInsufficientCredits
	}

	needed := req.Amount
	takeDaily := min64(needed, w.DailyFreeCredits)
	needed -= takeDaily
	takeSub := min64(needed, w.SubscriptionCredits)
	needed -= takeSub
	takePerp := min64(needed, w.PerpetualCredits)

	newDaily := w.DailyFreeCredits - takeDaily
	newSub := w.SubscriptionCredits - takeSub
	newPerp := w.PerpetualCredits - takePerp
	newFrozen := w.FrozenCredits + req.Amount
	newTotal := newDaily + newSub + newPerp

	if _, err := tx.Exec(ctx, `
		UPDATE ops_bill.credit_wallets
		SET daily_free_credits = $2, subscription_credits = $3, perpetual_credits = $4,
		    frozen_credits = $5, version = version + 1, updated_at = $6
		WHERE user_id = $1
	`, req.UserID, newDaily, newSub, newPerp, newFrozen, now.UTC()); err != nil {
		return nil, err
	}
	_, _ = tx.Exec(ctx, `UPDATE auth_usr.users SET credits = $2, updated_at = $3 WHERE id = $1`, req.UserID, newTotal, now.UTC())

	resID, _ := ids.NewPrefixedID("res")
	expAt := now.Add(ReservationTTLMinutes * time.Minute).UTC()
	split := map[string]int64{
		"daily":        takeDaily,
		"subscription": takeSub,
		"perpetual":    takePerp,
	}
	splitBytes, _ := json.Marshal(split)
	allocs := []map[string]any{}
	if takeDaily > 0 {
		allocs = append(allocs, map[string]any{"bucket": "daily", "source": "wallet", "amount": takeDaily, "expiresAt": w.DailyExpiresAt})
	}
	if takeSub > 0 {
		allocs = append(allocs, map[string]any{"bucket": "subscription", "source": "wallet", "amount": takeSub, "expiresAt": w.SubscriptionExpiresAt})
	}
	if takePerp > 0 {
		allocs = append(allocs, map[string]any{"bucket": "perpetual", "source": "wallet", "amount": takePerp, "expiresAt": nil})
	}
	allocBytes, _ := json.Marshal(allocs)

	if _, err := tx.Exec(ctx, `
		INSERT INTO ops_bill.credit_reservations
		  (id, user_id, model_id, reserved_amount, status, bucket_split_json, bucket_allocations_json, idempotency_key, expires_at, created_at)
		VALUES ($1, $2, $3, $4, 'RESERVED', $5::jsonb, $6::jsonb, $7, $8, $9)
	`, resID, req.UserID, req.ModelID, req.Amount, string(splitBytes), string(allocBytes), req.IdempotencyKey, expAt, now.UTC()); err != nil {
		return nil, err
	}

	for _, b := range []struct {
		name string
		amt  int64
		bal  int64
	}{
		{"DAILY_FREE", takeDaily, newDaily},
		{"SUBSCRIPTION", takeSub, newSub},
		{"PERPETUAL", takePerp, newPerp},
	} {
		if b.amt <= 0 {
			continue
		}
		lid, _ := ids.NewPrefixedID("cl2")
		_, err = tx.Exec(ctx, `
			INSERT INTO ops_bill.credit_ledger_v2
			  (id, user_id, bucket_type, delta, balance_after, action_type, reference_id, description, idempotency_key, created_at)
			VALUES ($1, $2, $3, $4, $5, 'TASK_RESERVE', $6, $7, $8, $9)
		`, lid, req.UserID, b.name, -b.amt, b.bal, resID, "模型 "+req.ModelID+" 生成预扣", resID+":"+b.name+":reserve", now.UTC())
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &ReservationResult{
		Success:        true,
		ReservationID:  resID,
		Status:         "RESERVED",
		ReservedAmount: req.Amount,
		BucketSplit:    split,
		ExpiresAt:      expAt,
	}, nil
}

func (r *PGRepository) CommitCredits(ctx context.Context, req CommitRequest, now time.Time) (*CommitResult, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var owner, status, modelID string
	var reservedAmt int64
	var splitRaw json.RawMessage
	err = tx.QueryRow(ctx, `
		SELECT user_id, status, COALESCE(model_id, 'unknown'), reserved_amount, bucket_split_json
		FROM ops_bill.credit_reservations WHERE id = $1 FOR UPDATE
	`, req.ReservationID).Scan(&owner, &status, &modelID, &reservedAmt, &splitRaw)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrReservationNotFound
	}
	if err != nil {
		return nil, err
	}
	if req.UserID != "" && owner != req.UserID {
		return nil, ErrForbidden
	}
	if status == "COMMITTED" {
		return &CommitResult{Success: true, ReservationID: req.ReservationID, Status: "COMMITTED", Cost: reservedAmt}, nil
	}
	if status != "RESERVED" {
		return nil, fmt.Errorf("%w: status %s", ErrReservationConflict, status)
	}

	settledAmt := reservedAmt
	if req.SettledAmount != nil && *req.SettledAmount >= 0 && *req.SettledAmount < reservedAmt {
		settledAmt = *req.SettledAmount
	}
	refundAmt := reservedAmt - settledAmt

	w, err := r.ensureCreditWalletForUpdate(ctx, tx, owner, now)
	if err != nil {
		return nil, err
	}
	newFrozen := w.FrozenCredits - reservedAmt
	if newFrozen < 0 {
		newFrozen = 0
	}
	split := map[string]int64{}
	_ = json.Unmarshal(splitRaw, &split)
	var refundDaily, refundSub, refundPerp int64
	if refundAmt > 0 {
		rem := refundAmt
		takePerp := min64(rem, split["perpetual"])
		refundPerp = takePerp
		rem -= takePerp
		takeSub := min64(rem, split["subscription"])
		refundSub = takeSub
		rem -= takeSub
		takeDaily := min64(rem, split["daily"])
		refundDaily = takeDaily
		rem -= takeDaily
		if rem > 0 {
			refundPerp += rem
		}
	}
	newDaily := w.DailyFreeCredits + refundDaily
	newSub := w.SubscriptionCredits + refundSub
	newPerp := w.PerpetualCredits + refundPerp
	if _, err := tx.Exec(ctx, `
		UPDATE ops_bill.credit_wallets
		SET daily_free_credits = $2,
		    subscription_credits = $3,
		    perpetual_credits = $4,
		    frozen_credits = $5,
		    version = version + 1,
		    updated_at = $6
		WHERE user_id = $1
	`, owner, newDaily, newSub, newPerp, newFrozen, now.UTC()); err != nil {
		return nil, err
	}
	if refundAmt > 0 {
		_, _ = tx.Exec(ctx, `UPDATE auth_usr.users SET credits = $2, updated_at = $3 WHERE id = $1`, owner, newDaily+newSub+newPerp, now.UTC())
	}
	var cid *string
	if strings.TrimSpace(req.CreationID) != "" {
		c := strings.TrimSpace(req.CreationID)
		cid = &c
	}
	if _, err := tx.Exec(ctx, `
		UPDATE ops_bill.credit_reservations SET status = 'COMMITTED', settled_amount = $2, released_amount = $3, creation_id = $4, settled_at = $5 WHERE id = $1
	`, req.ReservationID, settledAmt, refundAmt, cid, now.UTC()); err != nil {
		return nil, err
	}

	for _, b := range []struct {
		key    string
		name   string
		bal    int64
		refund int64
	}{
		{"daily", "DAILY_FREE", newDaily, refundDaily},
		{"subscription", "SUBSCRIPTION", newSub, refundSub},
		{"perpetual", "PERPETUAL", newPerp, refundPerp},
	} {
		if split[b.key] <= 0 && b.refund <= 0 {
			continue
		}
		lid, _ := ids.NewPrefixedID("cl2")
		_, _ = tx.Exec(ctx, `
			INSERT INTO ops_bill.credit_ledger_v2
			  (id, user_id, bucket_type, delta, balance_after, action_type, reference_id, description, idempotency_key, created_at)
			VALUES ($1, $2, $3, $4, $5, 'TASK_COMMIT', $6, $7, $8, $9)
		`, lid, owner, b.name, b.refund, b.bal, req.ReservationID, "模型 "+modelID+" 生成确认", req.ReservationID+":"+b.name+":commit", now.UTC())
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &CommitResult{Success: true, ReservationID: req.ReservationID, Status: "COMMITTED", Cost: settledAmt}, nil
}

func (r *PGRepository) VoidCredits(ctx context.Context, req VoidRequest, now time.Time) (*VoidResult, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var owner, status string
	var reservedAmt int64
	var splitRaw json.RawMessage
	err = tx.QueryRow(ctx, `
		SELECT user_id, status, reserved_amount, bucket_split_json
		FROM ops_bill.credit_reservations WHERE id = $1 FOR UPDATE
	`, req.ReservationID).Scan(&owner, &status, &reservedAmt, &splitRaw)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrReservationNotFound
	}
	if err != nil {
		return nil, err
	}
	if req.UserID != "" && owner != req.UserID {
		return nil, ErrForbidden
	}
	if status == "VOIDED" {
		return &VoidResult{Success: true, ReservationID: req.ReservationID, Status: "VOIDED", ReleasedAmount: reservedAmt}, nil
	}
	if status != "RESERVED" {
		return nil, fmt.Errorf("%w: status %s", ErrReservationConflict, status)
	}

	w, err := r.ensureCreditWalletForUpdate(ctx, tx, owner, now)
	if err != nil {
		return nil, err
	}
	split := map[string]int64{}
	_ = json.Unmarshal(splitRaw, &split)

	newDaily := w.DailyFreeCredits + split["daily"]
	newSub := w.SubscriptionCredits + split["subscription"]
	newPerp := w.PerpetualCredits + split["perpetual"]
	newFrozen := w.FrozenCredits - reservedAmt
	if newFrozen < 0 {
		newFrozen = 0
	}
	newTotal := newDaily + newSub + newPerp

	if _, err := tx.Exec(ctx, `
		UPDATE ops_bill.credit_wallets
		SET daily_free_credits = $2, subscription_credits = $3, perpetual_credits = $4,
		    frozen_credits = $5, version = version + 1, updated_at = $6
		WHERE user_id = $1
	`, owner, newDaily, newSub, newPerp, newFrozen, now.UTC()); err != nil {
		return nil, err
	}
	_, _ = tx.Exec(ctx, `UPDATE auth_usr.users SET credits = $2, updated_at = $3 WHERE id = $1`, owner, newTotal, now.UTC())
	if _, err := tx.Exec(ctx, `
		UPDATE ops_bill.credit_reservations SET status = 'VOIDED', settled_at = $2, released_amount = $3, expired_amount = 0 WHERE id = $1
	`, req.ReservationID, now.UTC(), reservedAmt); err != nil {
		return nil, err
	}

	for _, b := range []struct {
		key  string
		name string
		bal  int64
	}{
		{"daily", "DAILY_FREE", newDaily},
		{"subscription", "SUBSCRIPTION", newSub},
		{"perpetual", "PERPETUAL", newPerp},
	} {
		if split[b.key] <= 0 {
			continue
		}
		lid, _ := ids.NewPrefixedID("cl2")
		_, _ = tx.Exec(ctx, `
			INSERT INTO ops_bill.credit_ledger_v2
			  (id, user_id, bucket_type, delta, balance_after, action_type, reference_id, description, idempotency_key, created_at)
			VALUES ($1, $2, $3, $4, $5, 'TASK_RELEASE', $6, $7, $8, $9)
		`, lid, owner, b.name, split[b.key], b.bal, req.ReservationID, "任务未完成解冻返还: "+req.Reason, req.ReservationID+":"+b.name+":release", now.UTC())
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &VoidResult{Success: true, ReservationID: req.ReservationID, Status: "VOIDED", ReleasedAmount: reservedAmt}, nil
}

func (r *PGRepository) ensureCurrencyWalletForUpdate(ctx context.Context, tx pgx.Tx, userID string, now time.Time) (*CurrencyWallet, error) {
	_, err := tx.Exec(ctx, `
		INSERT INTO ops_bill.currency_wallets
		  (user_id, available_balance, frozen_balance, restricted_balance, is_locked, version, created_at, updated_at)
		VALUES ($1, 0, 0, 0, FALSE, 1, $2, $2)
		ON CONFLICT (user_id) DO NOTHING
	`, userID, now.UTC())
	if err != nil {
		return nil, err
	}
	var w CurrencyWallet
	var payHash *string
	err = tx.QueryRow(ctx, `
		SELECT user_id, available_balance::float8, frozen_balance::float8, restricted_balance::float8, is_locked, pay_password_hash
		FROM ops_bill.currency_wallets WHERE user_id = $1 FOR UPDATE
	`, userID).Scan(&w.UserID, &w.AvailableBalance, &w.FrozenBalance, &w.RestrictedBalance, &w.IsLocked, &payHash)
	if err != nil {
		return nil, err
	}
	w.HasPayPassword = payHash != nil && *payHash != ""
	return &w, nil
}

func (r *PGRepository) GetCurrencyWallet(ctx context.Context, userID string) (*CurrencyWallet, []CurrencyJournalItem, error) {
	if r == nil || r.Pool == nil {
		return nil, nil, ErrNotImplemented
	}
	var w CurrencyWallet
	var payHash *string
	err := r.Pool.QueryRow(ctx, `
		SELECT user_id, available_balance::float8, frozen_balance::float8, restricted_balance::float8, is_locked, pay_password_hash
		FROM ops_bill.currency_wallets WHERE user_id = $1
	`, userID).Scan(&w.UserID, &w.AvailableBalance, &w.FrozenBalance, &w.RestrictedBalance, &w.IsLocked, &payHash)
	if errors.Is(err, pgx.ErrNoRows) {
		w = CurrencyWallet{UserID: userID}
	} else if err != nil {
		return nil, nil, err
	} else {
		w.HasPayPassword = payHash != nil && *payHash != ""
	}

	rows, err := r.Pool.Query(ctx, `
		SELECT id, transaction_id, direction, amount::float8, balance_after::float8, biz_type, COALESCE(biz_id, ''), COALESCE(description, ''), created_at
		FROM ops_bill.currency_journal_entries
		WHERE user_id = $1
		ORDER BY created_at DESC LIMIT 20
	`, userID)
	ledger := []CurrencyJournalItem{}
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var it CurrencyJournalItem
			if rows.Scan(&it.ID, &it.TransactionID, &it.Direction, &it.Amount, &it.BalanceAfter, &it.BizType, &it.BizID, &it.Description, &it.CreatedAt) == nil {
				ledger = append(ledger, it)
			}
		}
	}
	return &w, ledger, nil
}

func (r *PGRepository) GetDailyLoginStatus(ctx context.Context, userID string, now time.Time) (*DailyLoginResult, error) {
	w, _, err := r.GetCurrencyWallet(ctx, userID)
	if err != nil {
		return nil, err
	}
	var id string
	err = r.Pool.QueryRow(ctx, `
		SELECT id FROM ops_bill.currency_journal_entries
		WHERE user_id = $1 AND biz_type = 'DAILY_LOGIN' AND created_at >= CURRENT_DATE AT TIME ZONE 'Asia/Shanghai'
		LIMIT 1
	`, userID).Scan(&id)
	claimed := err == nil
	return &DailyLoginResult{
		Success:  true,
		Claimed:  claimed,
		CanClaim: !claimed,
		Balance:  w.AvailableBalance,
		Reward:   DailyLoginCoinReward,
	}, nil
}

func (r *PGRepository) ClaimDailyLoginCoin(ctx context.Context, userID string, reward float64, now time.Time) (*DailyLoginResult, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	w, err := r.ensureCurrencyWalletForUpdate(ctx, tx, userID, now)
	if err != nil {
		return nil, err
	}
	var id string
	err = tx.QueryRow(ctx, `
		SELECT id FROM ops_bill.currency_journal_entries
		WHERE user_id = $1 AND biz_type = 'DAILY_LOGIN' AND created_at >= CURRENT_DATE AT TIME ZONE 'Asia/Shanghai'
		LIMIT 1
	`, userID).Scan(&id)
	if err == nil {
		return &DailyLoginResult{
			Success:      true,
			Claimed:      true,
			CanClaim:     false,
			IsFirstToday: false,
			Amount:       0,
			Balance:      w.AvailableBalance,
			Reward:       reward,
			Message:      "今日登录奖励已领取",
		}, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	newBal := math.Round((w.AvailableBalance+reward)*10000) / 10000
	txID, _ := ids.NewPrefixedID("tx_log")
	cjeID, _ := ids.NewPrefixedID("cje")
	dateStr, _ := shanghaiTodayBounds(now)
	if _, err := tx.Exec(ctx, `
		INSERT INTO ops_bill.currency_journal_entries
		  (id, transaction_id, user_id, account_code, direction, amount, balance_after, biz_type, biz_id, description, created_at)
		VALUES ($1, $2, $3, '2001', 'CREDIT', $4, $5, 'DAILY_LOGIN', $6, '每日登录打卡赠送 1 枚 K-Coin', $7)
	`, cjeID, txID, userID, reward, newBal, "login_"+dateStr, now.UTC()); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE ops_bill.currency_wallets SET available_balance = $2, version = version + 1, updated_at = $3 WHERE user_id = $1
	`, userID, newBal, now.UTC()); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &DailyLoginResult{
		Success:      true,
		Claimed:      true,
		CanClaim:     false,
		IsFirstToday: true,
		Amount:       reward,
		Balance:      newBal,
		Reward:       reward,
		Message:      "成功领取今日登录奖励 1 枚 K 币！",
	}, nil
}

func (r *PGRepository) ListRewards(ctx context.Context, userID string) ([]RewardItem, error) {
	if r == nil || r.Pool == nil {
		return DefaultRewardItems(), nil
	}
	rows, err := r.Pool.Query(ctx, `
		SELECT i.id, i.slug, i.name, COALESCE(i.description, ''), COALESCE(i.cost_coins, 0)::float8,
		       i.reward_type, CASE WHEN i.is_active THEN 'active' ELSE 'inactive' END,
		       (ucr.id IS NOT NULL), (ucr.equipped_at IS NOT NULL)
		FROM ai_studio.coin_reward_items i
		LEFT JOIN ai_studio.user_coin_rewards ucr
		  ON ucr.reward_item_id = i.id
		 AND ucr.user_id = $1
		 AND ucr.status = 'active'
		 AND (ucr.expires_at IS NULL OR ucr.expires_at > NOW())
		WHERE i.is_active = TRUE
		ORDER BY i.sort_order ASC, i.id ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []RewardItem
	for rows.Next() {
		var it RewardItem
		if err := rows.Scan(&it.ID, &it.Slug, &it.Title, &it.Description, &it.CostCoins, &it.Category, &it.Status, &it.Redeemed, &it.Equipped); err == nil {
			it.Name = it.Title
			it.RewardType = it.Category
			items = append(items, it)
		}
	}
	if items == nil {
		items = []RewardItem{}
	}
	return items, nil
}

func (r *PGRepository) RedeemReward(ctx context.Context, userID, rewardID string, now time.Time) (map[string]any, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var itemID, slug, name string
	var cost float64
	var durationDays, stock *int
	err = tx.QueryRow(ctx, `
		SELECT id, slug, COALESCE(cost_coins, 1)::float8, name, duration_days, stock
		FROM ai_studio.coin_reward_items
		WHERE (id = $1 OR slug = $1) AND is_active = TRUE
		FOR UPDATE
	`, rewardID).Scan(&itemID, &slug, &cost, &name, &durationDays, &stock)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, svcErr(http.StatusNotFound, "REWARD_NOT_FOUND", "奖励商品不存在或已下架")
	}
	if err != nil {
		return nil, err
	}
	if stock != nil && *stock <= 0 {
		return nil, svcErr(http.StatusConflict, "REWARD_OUT_OF_STOCK", "该奖励已兑完")
	}

	var existingID string
	err = tx.QueryRow(ctx, `
		SELECT id FROM ai_studio.user_coin_rewards
		WHERE user_id = $1 AND reward_item_id = $2 AND status = 'active' AND (expires_at IS NULL OR expires_at > $3)
		LIMIT 1
	`, userID, itemID, now.UTC()).Scan(&existingID)
	if err == nil {
		return nil, svcErr(http.StatusConflict, "REWARD_ALREADY_OWNED", "您已兑换过该权益")
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	w, err := r.ensureCurrencyWalletForUpdate(ctx, tx, userID, now)
	if err != nil {
		return nil, err
	}
	if w.IsLocked {
		return nil, ErrWalletLocked
	}
	if w.AvailableBalance < cost {
		return nil, ErrInsufficientCoins
	}
	newBal := math.Round((w.AvailableBalance-cost)*10000) / 10000
	if _, err := tx.Exec(ctx, `UPDATE ops_bill.currency_wallets SET available_balance = $2, version = version + 1, updated_at = $3 WHERE user_id = $1`, userID, newBal, now.UTC()); err != nil {
		return nil, err
	}
	if stock != nil {
		if _, err := tx.Exec(ctx, `UPDATE ai_studio.coin_reward_items SET stock = stock - 1, updated_at = $2 WHERE id = $1`, itemID, now.UTC()); err != nil {
			return nil, err
		}
	}
	var expiresAt *time.Time
	if durationDays != nil && *durationDays > 0 {
		t := now.UTC().Add(time.Duration(*durationDays) * 24 * time.Hour)
		expiresAt = &t
	}
	ucrID, _ := ids.NewPrefixedID("ucr")
	if _, err := tx.Exec(ctx, `
		INSERT INTO ai_studio.user_coin_rewards (id, user_id, reward_item_id, status, redeemed_at, expires_at)
		VALUES ($1, $2, $3, 'active', $4, $5)
		ON CONFLICT (user_id, reward_item_id) DO UPDATE
		SET status = 'active', redeemed_at = $4, expires_at = $5
	`, ucrID, userID, itemID, now.UTC(), expiresAt); err != nil {
		return nil, err
	}

	txID, _ := ids.NewPrefixedID("tx_rew")
	cjeID, _ := ids.NewPrefixedID("cje")
	_, _ = tx.Exec(ctx, `
		INSERT INTO ops_bill.currency_journal_entries (id, transaction_id, user_id, account_code, direction, amount, balance_after, biz_type, biz_id, description, created_at)
		VALUES ($1, $2, $3, '2001', 'DEBIT', $4, $5, 'REWARD_REDEEM', $6, $7, $8)
	`, cjeID, txID, userID, cost, newBal, itemID, "兑换奖励: "+name, now.UTC())
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return map[string]any{"success": true, "rewardId": itemID, "rewardSlug": slug, "balance": newBal}, nil
}

func (r *PGRepository) EquipReward(ctx context.Context, userID, rewardIDOrSlug string, now time.Time) (map[string]any, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var itemID, slug string
	err = tx.QueryRow(ctx, `
		SELECT i.id, i.slug
		FROM ai_studio.user_coin_rewards ucr
		JOIN ai_studio.coin_reward_items i ON i.id = ucr.reward_item_id
		WHERE ucr.user_id = $1
		  AND (i.id = $2 OR i.slug = $2)
		  AND ucr.status = 'active'
		  AND (ucr.expires_at IS NULL OR ucr.expires_at > $3)
		LIMIT 1
	`, userID, rewardIDOrSlug, now.UTC()).Scan(&itemID, &slug)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, svcErr(http.StatusNotFound, "REWARD_NOT_OWNED", "请先兑换该奖励后再佩戴")
	}
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE ai_studio.user_coin_rewards
		SET equipped_at = NULL
		WHERE user_id = $1 AND status = 'active' AND equipped_at IS NOT NULL
	`, userID); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE ai_studio.user_coin_rewards
		SET equipped_at = $3
		WHERE user_id = $1 AND reward_item_id = $2
	`, userID, itemID, now.UTC()); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return map[string]any{"success": true, "rewardId": itemID, "rewardSlug": slug, "equipped": true}, nil
}

func (r *PGRepository) ListUnlockedBenefits(ctx context.Context, userID string) (map[string]bool, error) {
	out := map[string]bool{}
	if r == nil || r.Pool == nil {
		return out, nil
	}
	rows, err := r.Pool.Query(ctx, `SELECT DISTINCT biz_id FROM ops_bill.currency_journal_entries WHERE user_id = $1 AND biz_type = 'BENEFIT_REDEEM'`, userID)
	if err != nil {
		return out, nil
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil && id != "" {
			out[id] = true
		}
	}
	return out, nil
}

func (r *PGRepository) RedeemBenefit(ctx context.Context, userID string, benefit BenefitItem, now time.Time) (map[string]any, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	w, err := r.ensureCurrencyWalletForUpdate(ctx, tx, userID, now)
	if err != nil {
		return nil, err
	}
	if w.IsLocked {
		return nil, ErrWalletLocked
	}
	if w.AvailableBalance < benefit.Coins {
		return nil, ErrInsufficientCoins
	}
	newBal := math.Round((w.AvailableBalance-benefit.Coins)*10000) / 10000
	if _, err := tx.Exec(ctx, `UPDATE ops_bill.currency_wallets SET available_balance = $2, version = version + 1, updated_at = $3 WHERE user_id = $1`, userID, newBal, now.UTC()); err != nil {
		return nil, err
	}
	txID, _ := ids.NewPrefixedID("tx_ben")
	cjeID, _ := ids.NewPrefixedID("cje")
	bizID := benefit.ID
	if benefit.Frame != "" {
		bizID = benefit.ID + ":" + benefit.Frame
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO ops_bill.currency_journal_entries (id, transaction_id, user_id, account_code, direction, amount, balance_after, biz_type, biz_id, description, created_at)
		VALUES ($1, $2, $3, '2001', 'DEBIT', $4, $5, 'BENEFIT_REDEEM', $6, $7, $8)
	`, cjeID, txID, userID, benefit.Coins, newBal, bizID, "兑换权益: "+benefit.Title, now.UTC()); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return map[string]any{
		"success":   true,
		"benefitId": benefit.ID,
		"balance":   newBal,
		"frame":     benefit.Frame,
	}, nil
}

func (r *PGRepository) ExchangeCoinsToCredits(ctx context.Context, req ExchangeRequest, creditsGranted int64, now time.Time) (*ExchangeResult, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var prevBal float64
	var prevTx string
	err = tx.QueryRow(ctx, `
		SELECT transaction_id, COALESCE(balance_after, 0)::float8
		FROM ops_bill.currency_journal_entries
		WHERE user_id = $1 AND biz_type = 'CREDIT_EXCHANGE' AND biz_id = $2 LIMIT 1
	`, req.UserID, req.IdempotencyKey).Scan(&prevTx, &prevBal)
	if err == nil {
		return &ExchangeResult{
			Success:        true,
			TransactionID:  prevTx,
			CoinsSpent:     req.CoinsAmount,
			CreditsGranted: creditsGranted,
			WalletBalance:  prevBal,
			Idempotent:     true,
		}, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	cw, err := r.ensureCurrencyWalletForUpdate(ctx, tx, req.UserID, now)
	if err != nil {
		return nil, err
	}
	if cw.IsLocked {
		return nil, ErrWalletLocked
	}
	if cw.AvailableBalance < req.CoinsAmount {
		return nil, ErrInsufficientCoins
	}

	newCoinBal := math.Round((cw.AvailableBalance-req.CoinsAmount)*10000) / 10000
	if _, err := tx.Exec(ctx, `UPDATE ops_bill.currency_wallets SET available_balance = $2, version = version + 1, updated_at = $3 WHERE user_id = $1`, req.UserID, newCoinBal, now.UTC()); err != nil {
		return nil, err
	}

	kw, err := r.ensureCreditWalletForUpdate(ctx, tx, req.UserID, now)
	if err != nil {
		return nil, err
	}
	newPerp := kw.PerpetualCredits + creditsGranted
	newTotal := kw.DailyFreeCredits + kw.SubscriptionCredits + newPerp
	if _, err := tx.Exec(ctx, `UPDATE ops_bill.credit_wallets SET perpetual_credits = $2, version = version + 1, updated_at = $3 WHERE user_id = $1`, req.UserID, newPerp, now.UTC()); err != nil {
		return nil, err
	}
	_, _ = tx.Exec(ctx, `UPDATE auth_usr.users SET credits = $2, updated_at = $3 WHERE id = $1`, req.UserID, newTotal, now.UTC())

	txID, _ := ids.NewPrefixedID("tx_exc")
	cjeID1, _ := ids.NewPrefixedID("cje")
	cjeID2, _ := ids.NewPrefixedID("cje")
	_, _ = tx.Exec(ctx, `
		INSERT INTO ops_bill.currency_journal_entries (id, transaction_id, user_id, account_code, direction, amount, balance_after, biz_type, biz_id, description, created_at)
		VALUES ($1, $2, $3, '2001', 'DEBIT', $4, $5, 'CREDIT_EXCHANGE', $6, 'K币兑换算力积分', $7)
	`, cjeID1, txID, req.UserID, req.CoinsAmount, newCoinBal, req.IdempotencyKey, now.UTC())
	_, _ = tx.Exec(ctx, `
		INSERT INTO ops_bill.currency_journal_entries (id, transaction_id, user_id, account_code, direction, amount, balance_after, biz_type, biz_id, description, created_at)
		VALUES ($1, $2, NULL, '4002', 'CREDIT', $3, NULL, 'CREDIT_EXCHANGE', $4, '算力兑换履约收入', $5)
	`, cjeID2, txID, req.CoinsAmount, req.IdempotencyKey, now.UTC())

	lid, _ := ids.NewPrefixedID("cl2")
	_, _ = tx.Exec(ctx, `
		INSERT INTO ops_bill.credit_ledger_v2 (id, user_id, bucket_type, delta, balance_after, action_type, reference_id, description, idempotency_key, created_at)
		VALUES ($1, $2, 'PERPETUAL', $3, $4, 'CREDIT_GRANT', $5, 'K币兑换永久算力积分', $6, $7)
	`, lid, req.UserID, creditsGranted, newPerp, txID, "exchange:"+req.IdempotencyKey, now.UTC())

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &ExchangeResult{
		Success:          true,
		TransactionID:    txID,
		CoinsSpent:       req.CoinsAmount,
		CreditsGranted:   creditsGranted,
		WalletBalance:    newCoinBal,
		PerpetualCredits: newPerp,
	}, nil
}

func (r *PGRepository) TransferCurrency(ctx context.Context, req TransferRequest, fee float64, now time.Time) (*TransferResult, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var recvID, recvName string
	cleanRecv := strings.TrimSpace(req.ReceiverIdentifier)
	err = tx.QueryRow(ctx, `
		SELECT id, COALESCE(NULLIF(display_name, ''), '创作者#' || id)
		FROM auth_usr.users WHERE id = $1 OR user_number = $1 OR LOWER(email) = LOWER($1) LIMIT 1
	`, cleanRecv).Scan(&recvID, &recvName)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrReceiverNotFound
	}
	if err != nil {
		return nil, err
	}
	if recvID == req.UserID {
		return nil, ErrReceiverNotFound
	}

	// Lock deterministic user_id order to prevent deadlocks
	firstID, secondID := req.UserID, recvID
	if secondID < firstID {
		firstID, secondID = secondID, firstID
	}
	w1, err := r.ensureCurrencyWalletForUpdate(ctx, tx, firstID, now)
	if err != nil {
		return nil, err
	}
	w2, err := r.ensureCurrencyWalletForUpdate(ctx, tx, secondID, now)
	if err != nil {
		return nil, err
	}
	senderW, recvW := w1, w2
	if req.UserID != firstID {
		senderW, recvW = w2, w1
	}
	if senderW.IsLocked || recvW.IsLocked {
		return nil, ErrWalletLocked
	}
	totalDeduction := req.Amount + fee
	if senderW.AvailableBalance < totalDeduction {
		return nil, ErrInsufficientCoins
	}

	senderNewBal := math.Round((senderW.AvailableBalance-totalDeduction)*10000) / 10000
	recvNewBal := math.Round((recvW.AvailableBalance+req.Amount)*10000) / 10000
	if _, err := tx.Exec(ctx, `UPDATE ops_bill.currency_wallets SET available_balance = $2, version = version + 1, updated_at = $3 WHERE user_id = $1`, req.UserID, senderNewBal, now.UTC()); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `UPDATE ops_bill.currency_wallets SET available_balance = $2, version = version + 1, updated_at = $3 WHERE user_id = $1`, recvID, recvNewBal, now.UTC()); err != nil {
		return nil, err
	}

	trfID := req.IdempotencyKey
	if trfID == "" {
		trfID, _ = ids.NewPrefixedID("trf")
	}
	txID, _ := ids.NewPrefixedID("tx_trf")
	_, _ = tx.Exec(ctx, `
		INSERT INTO ops_bill.currency_transfers (id, sender_id, receiver_id, amount, fee, status, risk_score, risk_remarks, client_ip, user_agent, created_at)
		VALUES ($1, $2, $3, $4, $5, 'SUCCESS', 0, '正常用户互转', $6, $7, $8)
	`, trfID, req.UserID, recvID, req.Amount, fee, req.ClientIP, req.UserAgent, now.UTC())

	cje1, _ := ids.NewPrefixedID("cje")
	cje2, _ := ids.NewPrefixedID("cje")
	cje3, _ := ids.NewPrefixedID("cje")
	cje4, _ := ids.NewPrefixedID("cje")
	_, _ = tx.Exec(ctx, `INSERT INTO ops_bill.currency_journal_entries (id, transaction_id, user_id, account_code, direction, amount, balance_after, biz_type, biz_id, description, created_at) VALUES ($1, $2, $3, '2001', 'DEBIT', $4, $5, 'TRANSFER_OUT', $6, $7, $8)`,
		cje1, txID, req.UserID, req.Amount, senderNewBal, trfID, "向用户 "+recvName+" 转出", now.UTC())
	_, _ = tx.Exec(ctx, `INSERT INTO ops_bill.currency_journal_entries (id, transaction_id, user_id, account_code, direction, amount, balance_after, biz_type, biz_id, description, created_at) VALUES ($1, $2, $3, '2001', 'DEBIT', $4, $5, 'TRANSFER_FEE', $6, '转账服务费 (1%)', $7)`,
		cje2, txID, req.UserID, fee, senderNewBal, trfID, now.UTC())
	_, _ = tx.Exec(ctx, `INSERT INTO ops_bill.currency_journal_entries (id, transaction_id, user_id, account_code, direction, amount, balance_after, biz_type, biz_id, description, created_at) VALUES ($1, $2, NULL, '4001', 'CREDIT', $3, NULL, 'TRANSFER_FEE', $4, '转账手续费收益', $5)`,
		cje3, txID, fee, trfID, now.UTC())
	_, _ = tx.Exec(ctx, `INSERT INTO ops_bill.currency_journal_entries (id, transaction_id, user_id, account_code, direction, amount, balance_after, biz_type, biz_id, description, created_at) VALUES ($1, $2, $3, '2001', 'CREDIT', $4, $5, 'TRANSFER_IN', $6, '收到转账', $7)`,
		cje4, txID, recvID, req.Amount, recvNewBal, trfID, now.UTC())

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &TransferResult{
		Success:             true,
		TransferID:          trfID,
		TransactionID:       txID,
		Amount:              req.Amount,
		Fee:                 fee,
		SenderBalanceAfter:  senderNewBal,
		ReceiverDisplayName: recvName,
	}, nil
}

func (r *PGRepository) GetPayPasswordHash(ctx context.Context, userID string) (string, string, bool, error) {
	if r == nil || r.Pool == nil {
		return "", "", false, ErrNotImplemented
	}
	var hash, salt *string
	err := r.Pool.QueryRow(ctx, `SELECT pay_password_hash, pay_password_salt FROM ops_bill.currency_wallets WHERE user_id = $1 LIMIT 1`, userID).Scan(&hash, &salt)
	if errors.Is(err, pgx.ErrNoRows) || hash == nil || *hash == "" {
		return "", "", false, nil
	}
	if err != nil {
		return "", "", false, err
	}
	s := ""
	if salt != nil {
		s = *salt
	}
	return *hash, s, true, nil
}

func (r *PGRepository) SetPayPasswordHash(ctx context.Context, userID, hash, salt string) error {
	if r == nil || r.Pool == nil {
		return ErrNotImplemented
	}
	now := time.Now().UTC()
	_, err := r.Pool.Exec(ctx, `
		INSERT INTO ops_bill.currency_wallets (user_id, available_balance, frozen_balance, restricted_balance, is_locked, pay_password_hash, pay_password_salt, version, created_at, updated_at)
		VALUES ($1, 0, 0, 0, FALSE, $2, $3, 1, $4, $4)
		ON CONFLICT (user_id) DO UPDATE SET pay_password_hash = $2, pay_password_salt = $3, updated_at = $4
	`, userID, hash, salt, now)
	return err
}

func min64(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}

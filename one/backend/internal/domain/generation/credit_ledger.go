package generation

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/jackc/pgx/v5"
)

var (
	ErrInsufficientCredits = errors.New("INSUFFICIENT_CREDITS")
	ErrReservationNotFound = errors.New("RESERVATION_NOT_FOUND")
	ErrReservationState    = errors.New("INVALID_RESERVATION_STATE")
)

type BucketSplit struct {
	Daily        int `json:"daily"`
	Subscription int `json:"subscription"`
	Perpetual    int `json:"perpetual"`
}

type ReturnedLot struct {
	ID         string     `json:"id"`
	BucketType string     `json:"bucketType"` // DAILY_FREE | SUBSCRIPTION
	Remaining  int        `json:"remaining"`
	ExpiresAt  *time.Time `json:"expiresAt,omitempty"`
}

type BucketAllocation struct {
	Bucket    string     `json:"bucket"` // daily | subscription | perpetual
	Source    string     `json:"source"` // wallet | returned
	LotID     string     `json:"lotId,omitempty"`
	Amount    int        `json:"amount"`
	ExpiresAt *time.Time `json:"expiresAt,omitempty"`
}

type FundingPlan struct {
	IsSufficient bool               `json:"isSufficient"`
	Split        BucketSplit        `json:"split"`
	WalletSplit  BucketSplit        `json:"walletSplit"`
	Allocations  []BucketAllocation `json:"allocations"`
}

type ReserveRequest struct {
	UserID         string
	StudioID       string
	ModelID        string
	Amount         int
	IdempotencyKey string
	CreationID     string
	TTL            time.Duration
}

type ReserveResult struct {
	ReservationID string    `json:"reservationId"`
	Status        string    `json:"status"`
	Reserved      int       `json:"reservedAmount"`
	ExpiresAt     time.Time `json:"expiresAt"`
}

type VoidResult struct {
	ReservationID  string `json:"reservationId"`
	Status         string `json:"status"`
	AlreadyVoided  bool   `json:"alreadyVoided,omitempty"`
	Skipped        bool   `json:"skipped,omitempty"`
	ReleasedAmount int    `json:"releasedAmount"`
	ExpiredAmount  int    `json:"expiredAmount"`
}

func randomHexID(prefix string) string {
	var b [12]byte
	_, _ = rand.Read(b[:])
	return prefix + "_" + hex.EncodeToString(b[:])
}

type fundingSource struct {
	bucket    string
	source    string
	lotID     string
	amount    int
	expiresAt *time.Time
}

func expirySortKey(t *time.Time) int64 {
	if t == nil {
		return 1<<62 - 1
	}
	return t.UnixNano()
}

// AllocateCreditFunding computes deterministic DAILY_FREE -> SUBSCRIPTION -> PERPETUAL
// bucket deductions sorted by earliest expiry within each bucket (per creditLots.js).
func AllocateCreditFunding(
	daily, sub, perpetual int,
	dailyExp, subExp *time.Time,
	lots []ReturnedLot,
	needed int,
	now time.Time,
) FundingPlan {
	plan := FundingPlan{}
	if needed <= 0 {
		plan.IsSufficient = true
		return plan
	}

	effDaily := daily
	if dailyExp != nil && !dailyExp.After(now) {
		effDaily = 0
	}
	effSub := sub
	if subExp != nil && !subExp.After(now) {
		effSub = 0
	}

	buckets := []struct {
		name     string
		typeName string
		wallet   int
		expiry   *time.Time
	}{
		{"daily", "DAILY_FREE", effDaily, dailyExp},
		{"subscription", "SUBSCRIPTION", effSub, subExp},
		{"perpetual", "PERPETUAL", perpetual, nil},
	}

	rem := needed
	for _, b := range buckets {
		if rem <= 0 {
			break
		}
		var sources []fundingSource
		if b.wallet > 0 {
			sources = append(sources, fundingSource{bucket: b.name, source: "wallet", amount: b.wallet, expiresAt: b.expiry})
		}
		for _, lot := range lots {
			if lot.BucketType == b.typeName && lot.Remaining > 0 && (lot.ExpiresAt == nil || lot.ExpiresAt.After(now)) {
				sources = append(sources, fundingSource{bucket: b.name, source: "returned", lotID: lot.ID, amount: lot.Remaining, expiresAt: lot.ExpiresAt})
			}
		}
		sort.SliceStable(sources, func(i, j int) bool {
			return expirySortKey(sources[i].expiresAt) < expirySortKey(sources[j].expiresAt)
		})
		for _, src := range sources {
			if rem <= 0 {
				break
			}
			take := rem
			if src.amount < take {
				take = src.amount
			}
			if take <= 0 {
				continue
			}
			switch b.name {
			case "daily":
				plan.Split.Daily += take
				if src.source == "wallet" {
					plan.WalletSplit.Daily += take
				}
			case "subscription":
				plan.Split.Subscription += take
				if src.source == "wallet" {
					plan.WalletSplit.Subscription += take
				}
			case "perpetual":
				plan.Split.Perpetual += take
				if src.source == "wallet" {
					plan.WalletSplit.Perpetual += take
				}
			}
			plan.Allocations = append(plan.Allocations, BucketAllocation{
				Bucket:    b.name,
				Source:    src.source,
				LotID:     src.lotID,
				Amount:    take,
				ExpiresAt: src.expiresAt,
			})
			rem -= take
		}
	}
	plan.IsSufficient = rem == 0
	return plan
}

type walletRow struct {
	daily     int
	dailyExp  *time.Time
	sub       int
	subExp    *time.Time
	perpetual int
	frozen    int
	version   int
}

func loadAndExpireWalletForUpdate(ctx context.Context, tx pgx.Tx, userID string, now time.Time) (*walletRow, []ReturnedLot, error) {
	// Ensure wallet row exists cleanly inside tx before FOR UPDATE lock.
	_, err := tx.Exec(ctx, `
		INSERT INTO ops_bill.credit_wallets (user_id, perpetual_credits, created_at, updated_at)
		VALUES ($1, COALESCE((SELECT credits FROM auth_usr.users WHERE id = $1), 0), $2, $2)
		ON CONFLICT (user_id) DO NOTHING`, userID, now)
	if err != nil {
		return nil, nil, err
	}

	var w walletRow
	err = tx.QueryRow(ctx, `
		SELECT daily_free_credits, daily_expires_at, subscription_credits, subscription_expires_at,
		       perpetual_credits, frozen_credits, version
		FROM ops_bill.credit_wallets WHERE user_id = $1 FOR UPDATE`, userID).
		Scan(&w.daily, &w.dailyExp, &w.sub, &w.subExp, &w.perpetual, &w.frozen, &w.version)
	if err != nil {
		return nil, nil, err
	}

	// Expire stale wallet buckets & returned lots atomically.
	var expiredDaily, expiredSub int
	if w.daily > 0 && w.dailyExp != nil && !w.dailyExp.After(now) {
		expiredDaily = w.daily
		w.daily = 0
	}
	if w.sub > 0 && w.subExp != nil && !w.subExp.After(now) {
		expiredSub = w.sub
		w.sub = 0
	}
	expRows, err := tx.Query(ctx, `
		SELECT id, bucket_type, remaining_credits FROM ops_bill.credit_returned_lots
		WHERE user_id = $1 AND remaining_credits > 0 AND expires_at IS NOT NULL AND expires_at <= $2 FOR UPDATE`, userID, now)
	if err != nil {
		return nil, nil, err
	}
	var expiredLotIDs []string
	for expRows.Next() {
		var id, bType string
		var rem int
		if err := expRows.Scan(&id, &bType, &rem); err != nil {
			expRows.Close()
			return nil, nil, err
		}
		expiredLotIDs = append(expiredLotIDs, id)
		if bType == "DAILY_FREE" {
			expiredDaily += rem
		} else if bType == "SUBSCRIPTION" {
			expiredSub += rem
		}
	}
	expRows.Close()

	if len(expiredLotIDs) > 0 {
		_, err = tx.Exec(ctx, `UPDATE ops_bill.credit_returned_lots SET remaining_credits = 0 WHERE id = ANY($1)`, expiredLotIDs)
		if err != nil {
			return nil, nil, err
		}
	}
	if expiredDaily > 0 || expiredSub > 0 {
		w.version++
		_, err = tx.Exec(ctx, `
			UPDATE ops_bill.credit_wallets
			SET daily_free_credits = $2, subscription_credits = $3, version = version + 1, updated_at = $4
			WHERE user_id = $1`, userID, w.daily, w.sub, now)
		if err != nil {
			return nil, nil, err
		}
	}

	rows, err := tx.Query(ctx, `
		SELECT id, bucket_type, remaining_credits, expires_at
		FROM ops_bill.credit_returned_lots
		WHERE user_id = $1 AND remaining_credits > 0 AND (expires_at IS NULL OR expires_at > $2)
		ORDER BY expires_at ASC NULLS LAST, created_at ASC, id ASC FOR UPDATE`, userID, now)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	var lots []ReturnedLot
	for rows.Next() {
		var l ReturnedLot
		if err := rows.Scan(&l.ID, &l.BucketType, &l.Remaining, &l.ExpiresAt); err != nil {
			return nil, nil, err
		}
		lots = append(lots, l)
	}
	return &w, lots, rows.Err()
}

// SyncLegacyUserCredits updates auth_usr.users.credits to reflect the exact
// bucket-aware wallet balance (daily + subscription + perpetual + active returned lots).
func SyncLegacyUserCredits(ctx context.Context, tx pgx.Tx, userID string, now time.Time) error {
	return syncLegacyUserCredits(ctx, tx, userID, now)
}

func syncLegacyUserCredits(ctx context.Context, tx pgx.Tx, userID string, now time.Time) error {
	_, err := tx.Exec(ctx, `
		UPDATE auth_usr.users u
		SET credits = COALESCE((
			SELECT w.daily_free_credits + w.subscription_credits + w.perpetual_credits
			  + COALESCE((SELECT SUM(l.remaining_credits) FROM ops_bill.credit_returned_lots l
			              WHERE l.user_id = w.user_id AND l.remaining_credits > 0
			                AND (l.expires_at IS NULL OR l.expires_at > $2)), 0)
			FROM ops_bill.credit_wallets w WHERE w.user_id = u.id
		), 0), updated_at = $2
		WHERE u.id = $1`, userID, now)
	return err
}

// ReserveCredits freezes user credits atomically inside an open transaction.
func ReserveCredits(ctx context.Context, tx pgx.Tx, req ReserveRequest) (*ReserveResult, error) {
	now := time.Now().UTC()
	if req.IdempotencyKey != "" {
		var existingID, status string
		var reserved int
		var expiresAt time.Time
		err := tx.QueryRow(ctx, `
			SELECT id, status, reserved_amount, expires_at
			FROM ops_bill.credit_reservations WHERE idempotency_key = $1`, req.IdempotencyKey).
			Scan(&existingID, &status, &reserved, &expiresAt)
		if err == nil {
			return &ReserveResult{ReservationID: existingID, Status: status, Reserved: reserved, ExpiresAt: expiresAt}, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
	}

	if req.Amount <= 0 {
		return nil, fmt.Errorf("reserve amount must be positive")
	}
	w, lots, err := loadAndExpireWalletForUpdate(ctx, tx, req.UserID, now)
	if err != nil {
		return nil, err
	}

	plan := AllocateCreditFunding(w.daily, w.sub, w.perpetual, w.dailyExp, w.subExp, lots, req.Amount, now)
	if !plan.IsSufficient {
		return nil, ErrInsufficientCredits
	}

	newDaily := w.daily - plan.WalletSplit.Daily
	newSub := w.sub - plan.WalletSplit.Subscription
	newPerpetual := w.perpetual - plan.WalletSplit.Perpetual
	newFrozen := w.frozen + req.Amount

	_, err = tx.Exec(ctx, `
		UPDATE ops_bill.credit_wallets
		SET daily_free_credits = $2, subscription_credits = $3, perpetual_credits = $4,
		    frozen_credits = $5, version = version + 1, updated_at = $6
		WHERE user_id = $1`, req.UserID, newDaily, newSub, newPerpetual, newFrozen, now)
	if err != nil {
		return nil, err
	}
	for _, alloc := range plan.Allocations {
		if alloc.Source == "returned" && alloc.LotID != "" {
			if _, err := tx.Exec(ctx, `UPDATE ops_bill.credit_returned_lots SET remaining_credits = remaining_credits - $1 WHERE id = $2`, alloc.Amount, alloc.LotID); err != nil {
				return nil, err
			}
		}
	}
	if err := syncLegacyUserCredits(ctx, tx, req.UserID, now); err != nil {
		return nil, err
	}

	ttl := req.TTL
	if ttl <= 0 {
		ttl = 30 * time.Minute
	}
	resID := randomHexID("res")
	idem := req.IdempotencyKey
	if idem == "" {
		idem = resID
	}
	expiresAt := now.Add(ttl)
	splitJSON, _ := json.Marshal(plan.Split)
	allocJSON, _ := json.Marshal(plan.Allocations)

	var creationPtr any
	if req.CreationID != "" {
		creationPtr = req.CreationID
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO ops_bill.credit_reservations
			(id, user_id, studio_id, model_id, reserved_amount, settled_amount,
			 bucket_split_json, bucket_allocations_json, status, idempotency_key, creation_id, expires_at, created_at)
		VALUES ($1,$2,$3,$4,$5,0,$6::jsonb,$7::jsonb,'RESERVED',$8,$9,$10,$11)`,
		resID, req.UserID, req.StudioID, req.ModelID, req.Amount,
		string(splitJSON), string(allocJSON), idem, creationPtr, expiresAt, now)
	if err != nil {
		return nil, err
	}

	var retDaily, retSub int
	for _, l := range lots {
		if l.BucketType == "DAILY_FREE" {
			retDaily += l.Remaining
		} else if l.BucketType == "SUBSCRIPTION" {
			retSub += l.Remaining
		}
	}
	// Subtract returned amounts already consumed by this reservation.
	for _, a := range plan.Allocations {
		if a.Source == "returned" {
			if a.Bucket == "daily" {
				retDaily -= a.Amount
			} else if a.Bucket == "subscription" {
				retSub -= a.Amount
			}
		}
	}
	ledgerEntries := []struct {
		bucketType   string
		amount       int
		balanceAfter int
	}{
		{"DAILY_FREE", plan.Split.Daily, newDaily + retDaily},
		{"SUBSCRIPTION", plan.Split.Subscription, newSub + retSub},
		{"PERPETUAL", plan.Split.Perpetual, newPerpetual},
	}
	for _, le := range ledgerEntries {
		if le.amount <= 0 {
			continue
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO ops_bill.credit_ledger_v2
				(id, user_id, bucket_type, delta, balance_after, action_type, reference_id, description, idempotency_key, created_at)
			VALUES ($1,$2,$3,$4,$5,'TASK_RESERVE',$6,$7,$8,$9)`,
			randomHexID("cl2"), req.UserID, le.bucketType, -le.amount, le.balanceAfter, resID,
			"生成任务预扣 "+req.ModelID, fmt.Sprintf("%s:%s:reserve", idem, le.bucketType), now)
		if err != nil {
			return nil, err
		}
	}

	return &ReserveResult{ReservationID: resID, Status: "RESERVED", Reserved: req.Amount, ExpiresAt: expiresAt}, nil
}

// CommitCredits finalizes a RESERVED credit hold on task success.
func CommitCredits(ctx context.Context, tx pgx.Tx, reservationID, creationID string) error {
	now := time.Now().UTC()
	var userID, modelID, status string
	var reserved int
	var splitRaw []byte
	err := tx.QueryRow(ctx, `
		SELECT user_id, model_id, status, reserved_amount, bucket_split_json
		FROM ops_bill.credit_reservations WHERE id = $1 FOR UPDATE`, reservationID).
		Scan(&userID, &modelID, &status, &reserved, &splitRaw)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrReservationNotFound
	}
	if err != nil {
		return err
	}
	if status == "COMMITTED" {
		return nil
	}
	if status != "RESERVED" {
		return fmt.Errorf("%w: status=%s", ErrReservationState, status)
	}

	var split BucketSplit
	_ = json.Unmarshal(splitRaw, &split)

	var daily, sub, perpetual, frozen int
	err = tx.QueryRow(ctx, `
		SELECT daily_free_credits, subscription_credits, perpetual_credits, frozen_credits
		FROM ops_bill.credit_wallets WHERE user_id = $1 FOR UPDATE`, userID).
		Scan(&daily, &sub, &perpetual, &frozen)
	if err != nil {
		return err
	}
	if frozen < reserved {
		return fmt.Errorf("frozen credits %d < reserved %d", frozen, reserved)
	}
	if _, err := tx.Exec(ctx, `
		UPDATE ops_bill.credit_wallets SET frozen_credits = frozen_credits - $2, version = version + 1, updated_at = $3 WHERE user_id = $1`,
		userID, reserved, now); err != nil {
		return err
	}
	if err := syncLegacyUserCredits(ctx, tx, userID, now); err != nil {
		return err
	}
	var cPtr any
	if creationID != "" {
		cPtr = creationID
	}
	if _, err := tx.Exec(ctx, `
		UPDATE ops_bill.credit_reservations
		SET status = 'COMMITTED', settled_amount = $2, creation_id = COALESCE($3, creation_id), settled_at = $4
		WHERE id = $1`, reservationID, reserved, cPtr, now); err != nil {
		return err
	}

	entries := []struct {
		bucket string
		amt    int
		bal    int
	}{
		{"DAILY_FREE", split.Daily, daily},
		{"SUBSCRIPTION", split.Subscription, sub},
		{"PERPETUAL", split.Perpetual, perpetual},
	}
	for _, e := range entries {
		if e.amt <= 0 {
			continue
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO ops_bill.credit_ledger_v2
				(id, user_id, bucket_type, delta, balance_after, action_type, reference_id, description, idempotency_key, created_at)
			VALUES ($1,$2,$3,0,$4,'TASK_COMMIT',$5,$6,$7,$8)
			ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
			randomHexID("cl2"), userID, e.bucket, e.bal, reservationID,
			"模型 "+modelID+" 生成确认", fmt.Sprintf("%s:%s:commit", reservationID, e.bucket), now)
		if err != nil {
			return err
		}
	}
	return nil
}

// VoidCredits releases frozen credits back to their original expiry buckets.
func VoidCredits(ctx context.Context, tx pgx.Tx, reservationID, reason string, onlyIfUnlinked, onlyIfExpired bool) (*VoidResult, error) {
	var userID, modelID, status string
	var reserved int
	var splitRaw, allocRaw []byte
	var expiresAt time.Time
	var creationID *string
	err := tx.QueryRow(ctx, `
		SELECT user_id, model_id, status, reserved_amount, bucket_split_json, bucket_allocations_json, expires_at, creation_id
		FROM ops_bill.credit_reservations WHERE id = $1 FOR UPDATE`, reservationID).
		Scan(&userID, &modelID, &status, &reserved, &splitRaw, &allocRaw, &expiresAt, &creationID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrReservationNotFound
	}
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	if onlyIfExpired && (status != "RESERVED" || expiresAt.After(now)) {
		return &VoidResult{ReservationID: reservationID, Status: status, Skipped: true}, nil
	}
	if onlyIfUnlinked {
		if creationID != nil && *creationID != "" {
			return &VoidResult{ReservationID: reservationID, Status: status, Skipped: true}, nil
		}
		var linked bool
		_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM ai_studio.creations WHERE reservation_id = $1)`, reservationID).Scan(&linked)
		if linked {
			return &VoidResult{ReservationID: reservationID, Status: status, Skipped: true}, nil
		}
	}
	if status == "VOIDED" {
		return &VoidResult{ReservationID: reservationID, Status: "VOIDED", AlreadyVoided: true}, nil
	}
	if status != "RESERVED" {
		return nil, fmt.Errorf("%w: status=%s", ErrReservationState, status)
	}

	var split BucketSplit
	_ = json.Unmarshal(splitRaw, &split)
	var allocs []BucketAllocation
	if len(allocRaw) > 0 {
		_ = json.Unmarshal(allocRaw, &allocs)
	}
	if len(allocs) == 0 {
		if split.Daily > 0 || split.Subscription > 0 {
			return nil, fmt.Errorf("%w: missing bucket_allocations_json for expiring buckets", ErrReservationState)
		}
		allocs = []BucketAllocation{{Bucket: "perpetual", Source: "wallet", Amount: split.Perpetual}}
	}

	w, _, err := loadAndExpireWalletForUpdate(ctx, tx, userID, now)
	if err != nil {
		return nil, err
	}
	if w.frozen < reserved {
		return nil, fmt.Errorf("frozen credits %d < reserved %d", w.frozen, reserved)
	}

	var expDaily, expSub int
	for idx, a := range allocs {
		if a.Bucket == "perpetual" {
			continue
		}
		bType := "DAILY_FREE"
		if a.Bucket == "subscription" {
			bType = "SUBSCRIPTION"
		}
		expired := a.ExpiresAt != nil && !a.ExpiresAt.After(now)
		rem := a.Amount
		if expired {
			rem = 0
			if a.Bucket == "daily" {
				expDaily += a.Amount
			} else {
				expSub += a.Amount
			}
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO ops_bill.credit_returned_lots
				(id, user_id, bucket_type, initial_credits, remaining_credits, expires_at, reservation_id, created_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
			ON CONFLICT (id) DO NOTHING`,
			fmt.Sprintf("returned_%s_%d", reservationID, idx), userID, bType, a.Amount, rem, a.ExpiresAt, reservationID, now); err != nil {
			return nil, err
		}
	}

	expiredTotal := expDaily + expSub
	released := reserved - expiredTotal
	newPerp := w.perpetual + split.Perpetual
	newFrozen := w.frozen - reserved

	if _, err := tx.Exec(ctx, `
		UPDATE ops_bill.credit_wallets
		SET perpetual_credits = $2, frozen_credits = $3, version = version + 1, updated_at = $4
		WHERE user_id = $1`, userID, newPerp, newFrozen, now); err != nil {
		return nil, err
	}
	if err := syncLegacyUserCredits(ctx, tx, userID, now); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE ops_bill.credit_reservations
		SET status = 'VOIDED', settled_at = $2, released_amount = $3, expired_amount = $4
		WHERE id = $1`, reservationID, now, released, expiredTotal); err != nil {
		return nil, err
	}

	for _, b := range []struct {
		name string
		amt  int
		bal  int
		exp  int
	}{
		{"DAILY_FREE", split.Daily, w.daily + split.Daily - expDaily, expDaily},
		{"SUBSCRIPTION", split.Subscription, w.sub + split.Subscription - expSub, expSub},
		{"PERPETUAL", split.Perpetual, newPerp, 0},
	} {
		if b.amt <= 0 {
			continue
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO ops_bill.credit_ledger_v2
				(id, user_id, bucket_type, delta, balance_after, action_type, reference_id, description, idempotency_key, created_at)
			VALUES ($1,$2,$3,$4,$5,'TASK_RELEASE',$6,$7,$8,$9)
			ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
			randomHexID("cl2"), userID, b.name, b.amt, b.bal+b.exp, reservationID,
			"任务未完成解冻返还: "+reason, fmt.Sprintf("%s:%s:release", reservationID, b.name), now)
		if err != nil {
			return nil, err
		}
		if b.exp > 0 {
			_, err = tx.Exec(ctx, `
				INSERT INTO ops_bill.credit_ledger_v2
					(id, user_id, bucket_type, delta, balance_after, action_type, reference_id, description, idempotency_key, created_at)
				VALUES ($1,$2,$3,$4,$5,'CREDIT_EXPIRE',$6,$7,$8,$9)
				ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
				randomHexID("cl2"), userID, b.name, -b.exp, b.bal, reservationID,
				"原预扣额度已到期，释放不延长有效期", fmt.Sprintf("%s:%s:release-expired", reservationID, b.name), now)
			if err != nil {
				return nil, err
			}
		}
	}

	return &VoidResult{
		ReservationID:  reservationID,
		Status:         "VOIDED",
		ReleasedAmount: released,
		ExpiredAmount:  expiredTotal,
	}, nil
}

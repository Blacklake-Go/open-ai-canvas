package finance

import (
	"context"
	"testing"
	"time"
)

type memFinanceRepo struct {
	credits      map[string]*CreditWallet
	reservations map[string]*struct {
		owner  string
		status string
		amount int64
		split  map[string]int64
		idem   string
	}
	checkins    map[string]bool
	coins       map[string]*CurrencyWallet
	payHash     map[string][2]string
	dailyLogins map[string]bool
	unlocked    map[string]map[string]bool
	exchanged   map[string]*ExchangeResult
	ledger      []LedgerEntry
}

func newMemFinanceRepo() *memFinanceRepo {
	return &memFinanceRepo{
		credits: map[string]*CreditWallet{
			"100001": {UserID: "100001", DailyFreeCredits: 10, SubscriptionCredits: 20, PerpetualCredits: 50, TotalAvailable: 80},
			"100002": {UserID: "100002", PerpetualCredits: 0, TotalAvailable: 0},
		},
		reservations: make(map[string]*struct {
			owner  string
			status string
			amount int64
			split  map[string]int64
			idem   string
		}),
		checkins: map[string]bool{},
		coins: map[string]*CurrencyWallet{
			"100001": {UserID: "100001", AvailableBalance: 100},
			"100002": {UserID: "100002", AvailableBalance: 0},
		},
		payHash:     map[string][2]string{},
		dailyLogins: map[string]bool{},
		unlocked:    map[string]map[string]bool{"100001": {}},
		exchanged:   map[string]*ExchangeResult{},
	}
}

func (m *memFinanceRepo) GetCreditsBalance(_ context.Context, uid string) (int64, error) {
	if w := m.credits[uid]; w != nil {
		return w.TotalAvailable, nil
	}
	return 0, nil
}
func (m *memFinanceRepo) GetCreditWallet(_ context.Context, uid string) (*CreditWallet, error) {
	if w := m.credits[uid]; w != nil {
		return w, nil
	}
	return &CreditWallet{UserID: uid}, nil
}
func (m *memFinanceRepo) GetCreditLedger(_ context.Context, uid string, _, _ int) ([]LedgerEntry, error) {
	var out []LedgerEntry
	for _, l := range m.ledger {
		if l.UserID == uid {
			out = append(out, l)
		}
	}
	return out, nil
}
func (m *memFinanceRepo) DailyCheckIn(_ context.Context, uid string, reward int64, _ time.Time) (*CheckInResult, error) {
	w := m.credits[uid]
	if m.checkins[uid] {
		return &CheckInResult{Success: true, CheckedIn: true, TotalCredits: w.TotalAvailable, AlreadyDone: true}, nil
	}
	m.checkins[uid] = true
	w.DailyFreeCredits += reward
	w.TotalAvailable += reward
	return &CheckInResult{Success: true, CheckedIn: true, Reward: reward, TotalCredits: w.TotalAvailable}, nil
}
func (m *memFinanceRepo) ReserveCredits(_ context.Context, req ReserveRequest, now time.Time) (*ReservationResult, error) {
	for id, r := range m.reservations {
		if r.idem == req.IdempotencyKey {
			if r.owner != req.UserID || r.amount != req.Amount {
				return nil, ErrIdempotencyConflict
			}
			return &ReservationResult{Success: true, ReservationID: id, Status: r.status, ReservedAmount: r.amount, Idempotent: true}, nil
		}
	}
	w := m.credits[req.UserID]
	if w.TotalAvailable < req.Amount {
		return nil, ErrInsufficientCredits
	}
	need := req.Amount
	td := min64(need, w.DailyFreeCredits)
	need -= td
	ts := min64(need, w.SubscriptionCredits)
	need -= ts
	tp := min64(need, w.PerpetualCredits)
	w.DailyFreeCredits -= td
	w.SubscriptionCredits -= ts
	w.PerpetualCredits -= tp
	w.FrozenCredits += req.Amount
	w.TotalAvailable -= req.Amount
	split := map[string]int64{"daily": td, "subscription": ts, "perpetual": tp}
	id := "res_1"
	if len(m.reservations) > 0 {
		id = "res_2"
	}
	m.reservations[id] = &struct {
		owner  string
		status string
		amount int64
		split  map[string]int64
		idem   string
	}{owner: req.UserID, status: "RESERVED", amount: req.Amount, split: split, idem: req.IdempotencyKey}
	return &ReservationResult{Success: true, ReservationID: id, Status: "RESERVED", ReservedAmount: req.Amount, BucketSplit: split, ExpiresAt: now.Add(15 * time.Minute)}, nil
}
func (m *memFinanceRepo) CommitCredits(_ context.Context, req CommitRequest, _ time.Time) (*CommitResult, error) {
	r := m.reservations[req.ReservationID]
	if r == nil {
		return nil, ErrReservationNotFound
	}
	if req.UserID != "" && r.owner != req.UserID {
		return nil, ErrForbidden
	}
	if r.status != "RESERVED" {
		return nil, ErrReservationConflict
	}
	r.status = "COMMITTED"
	m.credits[r.owner].FrozenCredits -= r.amount
	return &CommitResult{Success: true, ReservationID: req.ReservationID, Status: "COMMITTED", Cost: r.amount}, nil
}
func (m *memFinanceRepo) VoidCredits(_ context.Context, req VoidRequest, _ time.Time) (*VoidResult, error) {
	r := m.reservations[req.ReservationID]
	if r == nil {
		return nil, ErrReservationNotFound
	}
	if req.UserID != "" && r.owner != req.UserID {
		return nil, ErrForbidden
	}
	if r.status != "RESERVED" {
		return nil, ErrReservationConflict
	}
	r.status = "VOIDED"
	w := m.credits[r.owner]
	w.FrozenCredits -= r.amount
	w.DailyFreeCredits += r.split["daily"]
	w.SubscriptionCredits += r.split["subscription"]
	w.PerpetualCredits += r.split["perpetual"]
	w.TotalAvailable += r.amount
	return &VoidResult{Success: true, ReservationID: req.ReservationID, Status: "VOIDED", ReleasedAmount: r.amount}, nil
}
func (m *memFinanceRepo) GetCurrencyWallet(_ context.Context, uid string) (*CurrencyWallet, []CurrencyJournalItem, error) {
	w := m.coins[uid]
	w.HasPayPassword = m.payHash[uid][0] != ""
	return w, []CurrencyJournalItem{}, nil
}
func (m *memFinanceRepo) GetDailyLoginStatus(_ context.Context, uid string, _ time.Time) (*DailyLoginResult, error) {
	claimed := m.dailyLogins[uid]
	return &DailyLoginResult{Success: true, Claimed: claimed, CanClaim: !claimed, Balance: m.coins[uid].AvailableBalance, Reward: 1}, nil
}
func (m *memFinanceRepo) ClaimDailyLoginCoin(_ context.Context, uid string, reward float64, _ time.Time) (*DailyLoginResult, error) {
	if m.dailyLogins[uid] {
		return &DailyLoginResult{Success: true, Claimed: true, CanClaim: false, IsFirstToday: false, Balance: m.coins[uid].AvailableBalance, Reward: reward}, nil
	}
	m.dailyLogins[uid] = true
	m.coins[uid].AvailableBalance += reward
	return &DailyLoginResult{Success: true, Claimed: true, IsFirstToday: true, Amount: reward, Balance: m.coins[uid].AvailableBalance, Reward: reward}, nil
}
func (m *memFinanceRepo) ListRewards(_ context.Context, _ string) ([]RewardItem, error) {
	return DefaultRewardItems(), nil
}
func (m *memFinanceRepo) RedeemReward(_ context.Context, uid, rid string, _ time.Time) (map[string]any, error) {
	return map[string]any{"success": true, "rewardId": rid, "balance": m.coins[uid].AvailableBalance}, nil
}
func (m *memFinanceRepo) ListUnlockedBenefits(_ context.Context, uid string) (map[string]bool, error) {
	return m.unlocked[uid], nil
}
func (m *memFinanceRepo) RedeemBenefit(_ context.Context, uid string, b BenefitItem, _ time.Time) (map[string]any, error) {
	w := m.coins[uid]
	if w.AvailableBalance < b.Coins {
		return nil, ErrInsufficientCoins
	}
	w.AvailableBalance -= b.Coins
	m.unlocked[uid][b.ID] = true
	return map[string]any{"success": true, "benefitId": b.ID, "balance": w.AvailableBalance}, nil
}
func (m *memFinanceRepo) ExchangeCoinsToCredits(_ context.Context, req ExchangeRequest, granted int64, _ time.Time) (*ExchangeResult, error) {
	if prev, ok := m.exchanged[req.IdempotencyKey]; ok {
		cp := *prev
		cp.Idempotent = true
		return &cp, nil
	}
	cw := m.coins[req.UserID]
	if cw.AvailableBalance < req.CoinsAmount {
		return nil, ErrInsufficientCoins
	}
	cw.AvailableBalance -= req.CoinsAmount
	kw := m.credits[req.UserID]
	kw.PerpetualCredits += granted
	kw.TotalAvailable += granted
	res := &ExchangeResult{Success: true, TransactionID: "tx_1", CoinsSpent: req.CoinsAmount, CreditsGranted: granted, WalletBalance: cw.AvailableBalance, PerpetualCredits: kw.PerpetualCredits}
	m.exchanged[req.IdempotencyKey] = res
	return res, nil
}
func (m *memFinanceRepo) TransferCurrency(_ context.Context, req TransferRequest, fee float64, _ time.Time) (*TransferResult, error) {
	sw := m.coins[req.UserID]
	rw := m.coins[req.ReceiverIdentifier]
	if rw == nil {
		return nil, ErrReceiverNotFound
	}
	if sw.AvailableBalance < req.Amount+fee {
		return nil, ErrInsufficientCoins
	}
	sw.AvailableBalance -= (req.Amount + fee)
	rw.AvailableBalance += req.Amount
	return &TransferResult{Success: true, TransferID: "trf_1", TransactionID: "tx_trf", Amount: req.Amount, Fee: fee, SenderBalanceAfter: sw.AvailableBalance, ReceiverDisplayName: "CreatorTwo"}, nil
}
func (m *memFinanceRepo) GetPayPasswordHash(_ context.Context, uid string) (string, string, bool, error) {
	p, ok := m.payHash[uid]
	return p[0], p[1], ok && p[0] != "", nil
}
func (m *memFinanceRepo) SetPayPasswordHash(_ context.Context, uid, h, s string) error {
	m.payHash[uid] = [2]string{h, s}
	return nil
}

func TestCreditsTwoPhaseAndCheckIn(t *testing.T) {
	repo := newMemFinanceRepo()
	svc := &Service{Repo: repo}
	ctx := context.Background()

	// Check-in
	ci, err := svc.DailyCheckIn(ctx, "100001")
	if err != nil || ci.Reward != 10 || ci.TotalCredits != 90 {
		t.Fatalf("DailyCheckIn = %+v, err=%v", ci, err)
	}
	ci2, _ := svc.DailyCheckIn(ctx, "100001")
	if !ci2.AlreadyDone || ci2.Reward != 0 {
		t.Fatalf("second DailyCheckIn should be idempotent: %+v", ci2)
	}

	// Short idempotency key rejected with 422
	if _, err := svc.ReserveCredits(ctx, ReserveRequest{UserID: "100001", Amount: 25, IdempotencyKey: "short"}); err == nil {
		t.Fatal("expected 422 for short idempotency key")
	}

	// Reserve 25 -> consumes 20 daily + 5 subscription
	res1, err := svc.ReserveCredits(ctx, ReserveRequest{UserID: "100001", Amount: 25, ModelID: "flux", IdempotencyKey: "idem-key-0001"})
	if err != nil || res1.BucketSplit["daily"] != 20 || res1.BucketSplit["subscription"] != 5 {
		t.Fatalf("ReserveCredits = %+v, err=%v", res1, err)
	}
	// Wrong user commit -> 403
	if _, err := svc.CommitCredits(ctx, CommitRequest{UserID: "100002", ReservationID: res1.ReservationID}); err == nil {
		t.Fatal("expected forbidden for different user commit")
	}
	// Owner commit succeeds
	com, err := svc.CommitCredits(ctx, CommitRequest{UserID: "100001", ReservationID: res1.ReservationID})
	if err != nil || com.Status != "COMMITTED" {
		t.Fatalf("CommitCredits = %+v, err=%v", com, err)
	}

	// Reserve 15 & Void returns credits
	res2, err := svc.ReserveCredits(ctx, ReserveRequest{UserID: "100001", Amount: 15, ModelID: "kling", IdempotencyKey: "idem-key-0002"})
	if err != nil {
		t.Fatalf("ReserveCredits 2 err = %v", err)
	}
	beforeVoid := repo.credits["100001"].TotalAvailable
	voided, err := svc.VoidCredits(ctx, VoidRequest{UserID: "100001", ReservationID: res2.ReservationID, Reason: "failed"})
	if err != nil || voided.ReleasedAmount != 15 || repo.credits["100001"].TotalAvailable != beforeVoid+15 {
		t.Fatalf("VoidCredits = %+v, err=%v", voided, err)
	}
}

func TestCurrencyDailyExchangeTransferAndBenefits(t *testing.T) {
	repo := newMemFinanceRepo()
	svc := &Service{Repo: repo}
	ctx := context.Background()

	// Unauthenticated daily login status
	anon, err := svc.GetDailyLoginStatus(ctx, "")
	if err != nil || anon.CanClaim || anon.Balance != 0 {
		t.Fatalf("anon daily login = %+v, err=%v", anon, err)
	}

	// Claim daily login coin
	claim1, err := svc.ClaimDailyLoginCoin(ctx, "100001")
	if err != nil || !claim1.IsFirstToday || claim1.Balance != 101 {
		t.Fatalf("ClaimDailyLoginCoin = %+v, err=%v", claim1, err)
	}
	claim2, _ := svc.ClaimDailyLoginCoin(ctx, "100001")
	if claim2.IsFirstToday || claim2.Amount != 0 {
		t.Fatalf("second daily login claim should return 0: %+v", claim2)
	}

	// Redeem soon benefit rejected, open benefit succeeds
	if _, err := svc.RedeemBenefit(ctx, "100001", "badge_creator"); err == nil {
		t.Fatal("expected error redeeming 'soon' benefit")
	}
	if _, err := svc.RedeemBenefit(ctx, "100001", "frame_coin_gold"); err != nil {
		t.Fatalf("RedeemBenefit open error = %v", err)
	}

	// Exchange 2 coins -> 200 credits
	ex, err := svc.ExchangeCoinsToCredits(ctx, ExchangeRequest{UserID: "100001", CoinsAmount: 2, IdempotencyKey: "ex-idem-123456"})
	if err != nil || ex.CreditsGranted != 200 {
		t.Fatalf("ExchangeCoinsToCredits = %+v, err=%v", ex, err)
	}

	// Pay password & Transfer
	if err := svc.SetPayPassword(ctx, "100001", "", "abc"); err == nil {
		t.Fatal("expected invalid non-6-digit pin error")
	}
	if err := svc.SetPayPassword(ctx, "100001", "", "123456"); err != nil {
		t.Fatalf("SetPayPassword error = %v", err)
	}
	if _, err := svc.TransferCurrency(ctx, TransferRequest{
		UserID: "100001", ReceiverIdentifier: "100002", Amount: 20, PayPassword: "wrong", IdempotencyKey: "trf-idem-123456",
	}); err == nil {
		t.Fatal("expected wrong pay password rejection")
	}
	trf, err := svc.TransferCurrency(ctx, TransferRequest{
		UserID: "100001", ReceiverIdentifier: "100002", Amount: 20, PayPassword: "123456", IdempotencyKey: "trf-idem-123456",
	})
	if err != nil || trf.Fee != 0.2 || repo.coins["100002"].AvailableBalance != 20 {
		t.Fatalf("TransferCurrency = %+v, err=%v, recvBal=%v", trf, err, repo.coins["100002"].AvailableBalance)
	}
}

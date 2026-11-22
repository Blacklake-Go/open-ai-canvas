package finance

import (
	"context"
	"errors"
	"math"
	"net/http"
	"regexp"
	"strings"
	"time"

	"one/backend/internal/domain/auth"
	"one/backend/internal/platform/coordination"
)

var (
	ErrNotImplemented        = errors.New("finance domain repository not yet implemented")
	ErrInsufficientCredits   = errors.New("INSUFFICIENT_CREDITS")
	ErrReservationNotFound   = errors.New("RESERVATION_NOT_FOUND")
	ErrReservationConflict   = errors.New("RESERVATION_STATUS_CONFLICT")
	ErrForbidden             = errors.New("FORBIDDEN")
	ErrInsufficientCoins     = errors.New("INSUFFICIENT_COINS")
	ErrWalletLocked          = errors.New("WALLET_LOCKED")
	ErrReceiverNotFound      = errors.New("RECEIVER_NOT_FOUND")
	ErrIdempotencyConflict   = errors.New("IDEMPOTENCY_CONFLICT")
	payPasswordNumericPin6Re = regexp.MustCompile(`^\d{6}$`)
)

const (
	DailyCheckInReward    int64   = 10
	DailyLoginCoinReward  float64 = 1
	CreditsPerKCoin       int64   = 100
	MinTransferAmount     float64 = 1
	MaxSingleTransfer     float64 = 1000
	MaxDailyTransfer      float64 = 5000
	TransferFeeRate       float64 = 0.01
	MinTransferFee        float64 = 0.1
	ReservationTTLMinutes         = 15
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

type LedgerEntry struct {
	ID             string    `json:"id"`
	UserID         string    `json:"user_id"`
	BucketType     string    `json:"bucketType,omitempty"`
	Delta          int64     `json:"delta"`
	Balance        int64     `json:"balance"`
	ActionType     string    `json:"actionType,omitempty"`
	ReferenceID    string    `json:"referenceId,omitempty"`
	Reason         string    `json:"reason"`
	RequestID      string    `json:"request_id,omitempty"`
	IdempotencyKey string    `json:"idempotencyKey,omitempty"`
	CreatedAt      time.Time `json:"createdAt"`
}

type CreditWallet struct {
	UserID                string     `json:"userId"`
	DailyFreeCredits      int64      `json:"dailyFreeCredits"`
	SubscriptionCredits   int64      `json:"subscriptionCredits"`
	PerpetualCredits      int64      `json:"perpetualCredits"`
	FrozenCredits         int64      `json:"frozenCredits"`
	TotalAvailable        int64      `json:"totalAvailable"`
	DailyExpiresAt        *time.Time `json:"dailyExpiresAt,omitempty"`
	SubscriptionExpiresAt *time.Time `json:"subscriptionExpiresAt,omitempty"`
}

type ReserveRequest struct {
	UserID         string
	Amount         int64
	ModelID        string
	IdempotencyKey string
}

type ReservationResult struct {
	Success        bool             `json:"success"`
	ReservationID  string           `json:"reservationId"`
	Status         string           `json:"status"`
	ReservedAmount int64            `json:"reservedAmount"`
	BucketSplit    map[string]int64 `json:"bucketSplit,omitempty"`
	ExpiresAt      time.Time        `json:"expiresAt"`
	Idempotent     bool             `json:"idempotent,omitempty"`
}

type CommitRequest struct {
	UserID        string
	ReservationID string
	CreationID    string
	SettledAmount *int64
}

type CommitResult struct {
	Success       bool   `json:"success"`
	ReservationID string `json:"reservationId"`
	Status        string `json:"status"`
	Cost          int64  `json:"cost"`
}

type VoidRequest struct {
	UserID        string
	ReservationID string
	Reason        string
}

type VoidResult struct {
	Success        bool   `json:"success"`
	ReservationID  string `json:"reservationId"`
	Status         string `json:"status"`
	ReleasedAmount int64  `json:"releasedAmount"`
	ExpiredAmount  int64  `json:"expiredAmount"`
}

type CheckInResult struct {
	Success      bool  `json:"success"`
	CheckedIn    bool  `json:"checkedIn"`
	Reward       int64 `json:"reward"`
	TotalCredits int64 `json:"totalCredits"`
	AlreadyDone  bool  `json:"alreadyCheckedIn,omitempty"`
}

type CurrencyWallet struct {
	UserID            string  `json:"userId"`
	AvailableBalance  float64 `json:"availableBalance"`
	FrozenBalance     float64 `json:"frozenBalance"`
	RestrictedBalance float64 `json:"restrictedBalance"`
	IsLocked          bool    `json:"isLocked"`
	HasPayPassword    bool    `json:"hasPayPassword"`
}

type CurrencyJournalItem struct {
	ID            string    `json:"id"`
	TransactionID string    `json:"transactionId"`
	Direction     string    `json:"direction"`
	Amount        float64   `json:"amount"`
	BalanceAfter  *float64  `json:"balanceAfter"`
	BizType       string    `json:"bizType"`
	BizID         string    `json:"bizId,omitempty"`
	Description   string    `json:"description"`
	CreatedAt     time.Time `json:"createdAt"`
}

type DailyLoginResult struct {
	Success      bool    `json:"success"`
	Claimed      bool    `json:"claimed"`
	CanClaim     bool    `json:"canClaim"`
	IsFirstToday bool    `json:"isFirstToday,omitempty"`
	Amount       float64 `json:"amount"`
	Balance      float64 `json:"balance"`
	Reward       float64 `json:"reward"`
	Message      string  `json:"message,omitempty"`
}

type RewardItem struct {
	ID          string  `json:"id"`
	Slug        string  `json:"slug,omitempty"`
	Title       string  `json:"title"`
	Name        string  `json:"name,omitempty"`
	Description string  `json:"description"`
	CostCoins   float64 `json:"costCoins"`
	Category    string  `json:"category"`
	RewardType  string  `json:"rewardType,omitempty"`
	Status      string  `json:"status"`
	Redeemed    bool    `json:"redeemed"`
	Equipped    bool    `json:"equipped,omitempty"`
}

type BenefitItem struct {
	ID       string  `json:"id"`
	Kind     string  `json:"kind"`
	Category string  `json:"category"`
	Status   string  `json:"status"`
	Coins    float64 `json:"coins"`
	Frame    string  `json:"frame,omitempty"`
	Title    string  `json:"title"`
	Summary  string  `json:"summary"`
	Unlocked bool    `json:"unlocked,omitempty"`
}

type ExchangeRequest struct {
	UserID         string
	CoinsAmount    float64
	IdempotencyKey string
}

type ExchangeResult struct {
	Success          bool    `json:"success"`
	TransactionID    string  `json:"transactionId"`
	CoinsSpent       float64 `json:"coinsSpent"`
	CreditsGranted   int64   `json:"creditsGranted"`
	WalletBalance    float64 `json:"walletBalance"`
	PerpetualCredits int64   `json:"perpetualCredits"`
	Idempotent       bool    `json:"idempotent,omitempty"`
}

type TransferRequest struct {
	UserID             string
	ReceiverIdentifier string
	Amount             float64
	PayPassword        string
	IdempotencyKey     string
	ClientIP           string
	UserAgent          string
}

type TransferResult struct {
	Success             bool    `json:"success"`
	TransferID          string  `json:"transferId"`
	TransactionID       string  `json:"transactionId"`
	Amount              float64 `json:"amount"`
	Fee                 float64 `json:"fee"`
	SenderBalanceAfter  float64 `json:"senderBalanceAfter"`
	ReceiverDisplayName string  `json:"receiverDisplayName"`
}

type Repository interface {
	GetCreditsBalance(ctx context.Context, userID string) (int64, error)
	GetCreditWallet(ctx context.Context, userID string) (*CreditWallet, error)
	GetCreditLedger(ctx context.Context, userID string, limit, offset int) ([]LedgerEntry, error)
	DailyCheckIn(ctx context.Context, userID string, reward int64, now time.Time) (*CheckInResult, error)
	ReserveCredits(ctx context.Context, req ReserveRequest, now time.Time) (*ReservationResult, error)
	CommitCredits(ctx context.Context, req CommitRequest, now time.Time) (*CommitResult, error)
	VoidCredits(ctx context.Context, req VoidRequest, now time.Time) (*VoidResult, error)

	GetCurrencyWallet(ctx context.Context, userID string) (*CurrencyWallet, []CurrencyJournalItem, error)
	GetDailyLoginStatus(ctx context.Context, userID string, now time.Time) (*DailyLoginResult, error)
	ClaimDailyLoginCoin(ctx context.Context, userID string, reward float64, now time.Time) (*DailyLoginResult, error)
	ListRewards(ctx context.Context, userID string) ([]RewardItem, error)
	RedeemReward(ctx context.Context, userID, rewardID string, now time.Time) (map[string]any, error)
	ListUnlockedBenefits(ctx context.Context, userID string) (map[string]bool, error)
	RedeemBenefit(ctx context.Context, userID string, benefit BenefitItem, now time.Time) (map[string]any, error)
	ExchangeCoinsToCredits(ctx context.Context, req ExchangeRequest, creditsGranted int64, now time.Time) (*ExchangeResult, error)
	TransferCurrency(ctx context.Context, req TransferRequest, fee float64, now time.Time) (*TransferResult, error)
	GetPayPasswordHash(ctx context.Context, userID string) (hash string, salt string, exists bool, err error)
	SetPayPasswordHash(ctx context.Context, userID, hash, salt string) error
}

type Service struct {
	Repo  Repository
	Coord *coordination.Coordinator
	Now   func() time.Time
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

func (s *Service) GetBalance(ctx context.Context, userID string) (int64, error) {
	if s.Repo == nil {
		return 0, ErrNotImplemented
	}
	return s.Repo.GetCreditsBalance(ctx, userID)
}

func (s *Service) GetCreditWallet(ctx context.Context, userID string) (*CreditWallet, error) {
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	return s.Repo.GetCreditWallet(ctx, userID)
}

func (s *Service) GetCreditLedger(ctx context.Context, userID string, limit, offset int) ([]LedgerEntry, error) {
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	return s.Repo.GetCreditLedger(ctx, userID, limit, offset)
}

func (s *Service) DailyCheckIn(ctx context.Context, userID string) (*CheckInResult, error) {
	if err := s.checkLimit(ctx, "credits_checkin", userID, 20, time.Hour); err != nil {
		return nil, err
	}
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	return s.Repo.DailyCheckIn(ctx, userID, DailyCheckInReward, s.now())
}

func validateIdempotencyKey(key string, minLen, maxLen int) error {
	clean := strings.TrimSpace(key)
	if len(clean) < minLen || len(clean) > maxLen {
		return svcErr(http.StatusUnprocessableEntity, "IDEMPOTENCY_KEY_INVALID", "请求缺少有效的幂等键 (x-idempotency-key)")
	}
	return nil
}

func (s *Service) ReserveCredits(ctx context.Context, req ReserveRequest) (*ReservationResult, error) {
	if err := validateIdempotencyKey(req.IdempotencyKey, 8, 200); err != nil {
		return nil, err
	}
	if req.Amount <= 0 {
		return nil, svcErr(http.StatusBadRequest, "INVALID_AMOUNT", "预扣积分必须大于 0")
	}
	if strings.TrimSpace(req.ModelID) == "" {
		req.ModelID = "unknown"
	}
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	res, err := s.Repo.ReserveCredits(ctx, req, s.now())
	if err != nil {
		if errors.Is(err, ErrInsufficientCredits) {
			return nil, svcErr(http.StatusPaymentRequired, "INSUFFICIENT_CREDITS", "积分余额不足，请先充值或签到获取积分")
		}
		if errors.Is(err, ErrIdempotencyConflict) {
			return nil, svcErr(http.StatusConflict, "IDEMPOTENCY_CONFLICT", "幂等键与已有预扣请求冲突")
		}
		return nil, err
	}
	return res, nil
}

func (s *Service) CommitCredits(ctx context.Context, req CommitRequest) (*CommitResult, error) {
	if strings.TrimSpace(req.ReservationID) == "" {
		return nil, svcErr(http.StatusBadRequest, "MISSING_RESERVATION_ID", "缺少 reservationId")
	}
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	res, err := s.Repo.CommitCredits(ctx, req, s.now())
	if err != nil {
		if errors.Is(err, ErrReservationNotFound) {
			return nil, svcErr(http.StatusNotFound, "RESERVATION_NOT_FOUND", "未找到该预扣凭单")
		}
		if errors.Is(err, ErrForbidden) {
			return nil, svcErr(http.StatusForbidden, "FORBIDDEN", "无权操作该预扣凭单")
		}
		if errors.Is(err, ErrReservationConflict) {
			return nil, svcErr(http.StatusConflict, "RESERVATION_CONFLICT", err.Error())
		}
		return nil, err
	}
	return res, nil
}

func (s *Service) VoidCredits(ctx context.Context, req VoidRequest) (*VoidResult, error) {
	if strings.TrimSpace(req.ReservationID) == "" {
		return nil, svcErr(http.StatusBadRequest, "MISSING_RESERVATION_ID", "缺少 reservationId")
	}
	if strings.TrimSpace(req.Reason) == "" {
		req.Reason = "任务执行失败或被取消"
	}
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	res, err := s.Repo.VoidCredits(ctx, req, s.now())
	if err != nil {
		if errors.Is(err, ErrReservationNotFound) {
			return nil, svcErr(http.StatusNotFound, "RESERVATION_NOT_FOUND", "未找到该预扣凭单")
		}
		if errors.Is(err, ErrForbidden) {
			return nil, svcErr(http.StatusForbidden, "FORBIDDEN", "无权操作该预扣凭单")
		}
		if errors.Is(err, ErrReservationConflict) {
			return nil, svcErr(http.StatusConflict, "RESERVATION_CONFLICT", err.Error())
		}
		return nil, err
	}
	return res, nil
}

func (s *Service) GetCurrencyWallet(ctx context.Context, userID string) (map[string]any, error) {
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	w, ledger, err := s.Repo.GetCurrencyWallet(ctx, userID)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"wallet": w,
		"ledger": ledger,
	}, nil
}

func (s *Service) GetDailyLoginStatus(ctx context.Context, userID string) (*DailyLoginResult, error) {
	if strings.TrimSpace(userID) == "" {
		return &DailyLoginResult{
			Claimed:  false,
			CanClaim: false,
			Balance:  0,
			Reward:   DailyLoginCoinReward,
		}, nil
	}
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	return s.Repo.GetDailyLoginStatus(ctx, userID, s.now())
}

func (s *Service) ClaimDailyLoginCoin(ctx context.Context, userID string) (*DailyLoginResult, error) {
	if err := s.checkLimit(ctx, "currency_daily_login", userID, 30, time.Hour); err != nil {
		return nil, err
	}
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	return s.Repo.ClaimDailyLoginCoin(ctx, userID, DailyLoginCoinReward, s.now())
}

func (s *Service) ListRewards(ctx context.Context, userID string) ([]RewardItem, error) {
	if s.Repo == nil {
		return DefaultRewardItems(), nil
	}
	return s.Repo.ListRewards(ctx, userID)
}

type RewardEquipper interface {
	EquipReward(ctx context.Context, userID, rewardIDOrSlug string, now time.Time) (map[string]any, error)
}

func (s *Service) EquipReward(ctx context.Context, userID, rewardIDOrSlug string) (map[string]any, error) {
	if strings.TrimSpace(rewardIDOrSlug) == "" {
		return nil, svcErr(http.StatusBadRequest, "INVALID_REWARD", "请选择有效的奖励项目")
	}
	if err := s.checkLimit(ctx, "currency_rewards", userID, 30, time.Hour); err != nil {
		return nil, err
	}
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	if eq, ok := s.Repo.(RewardEquipper); ok {
		return eq.EquipReward(ctx, userID, rewardIDOrSlug, s.now())
	}
	return map[string]any{"success": true, "rewardSlug": rewardIDOrSlug, "equipped": true}, nil
}

func (s *Service) RedeemReward(ctx context.Context, userID, rewardID string) (map[string]any, error) {
	if strings.TrimSpace(rewardID) == "" {
		return nil, svcErr(http.StatusBadRequest, "INVALID_REWARD", "请选择有效的奖励项目")
	}
	if err := s.checkLimit(ctx, "currency_rewards", userID, 20, time.Hour); err != nil {
		return nil, err
	}
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	res, err := s.Repo.RedeemReward(ctx, userID, rewardID, s.now())
	if err != nil {
		if errors.Is(err, ErrInsufficientCoins) {
			return nil, svcErr(http.StatusBadRequest, "INSUFFICIENT_COINS", "K 币余额不足")
		}
		return nil, err
	}
	return res, nil
}

func DefaultBenefitsCatalog() []BenefitItem {
	zodiacs := []struct{ key, name, glyph, dates, line string }{
		{"aries", "白羊座", "♈", "3.21 - 4.19", "想到就出发的那股劲儿"},
		{"taurus", "金牛座", "♉", "4.20 - 5.20", "慢慢来，反而走得远"},
		{"gemini", "双子座", "♊", "5.21 - 6.21", "一个脑袋，两种心情"},
		{"cancer", "巨蟹座", "♋", "6.22 - 7.22", "把柔软留给自家人"},
		{"leo", "狮子座", "♌", "7.23 - 8.22", "天生就该被看见"},
		{"virgo", "处女座", "♍", "8.23 - 9.22", "细节里都是在意"},
		{"libra", "天秤座", "♎", "9.23 - 10.23", "什么都要刚刚好"},
		{"scorpio", "天蝎座", "♏", "10.24 - 11.22", "喜欢就喜欢到底"},
		{"sagittarius", "射手座", "♐", "11.23 - 12.21", "下一站总是更远的那站"},
		{"capricorn", "摩羯座", "♑", "12.22 - 1.19", "不吭声，把事做成"},
		{"aquarius", "水瓶座", "♒", "1.20 - 2.18", "有点不一样，也不打算改"},
		{"pisces", "双鱼座", "♓", "2.19 - 3.20", "连做梦都很认真"},
	}
	items := make([]BenefitItem, 0, len(zodiacs)+4)
	for _, z := range zodiacs {
		items = append(items, BenefitItem{
			ID:       "frame_zodiac_" + z.key,
			Kind:     "avatar_frame",
			Category: "outfit",
			Status:   "open",
			Coins:    1,
			Frame:    "zodiac-" + z.key,
			Title:    z.name + " " + z.glyph,
			Summary:  z.dates + " · " + z.line,
		})
	}
	items = append(items,
		BenefitItem{ID: "frame_coin_gold", Kind: "avatar_frame", Category: "outfit", Status: "open", Coins: 30, Frame: "coin-gold", Title: "鎏金头像框", Summary: "一圈常驻的鎏金，认真创作的人值得被认出来。"},
		BenefitItem{ID: "frame_coin_cyan", Kind: "avatar_frame", Category: "outfit", Status: "open", Coins: 60, Frame: "coin-cyan", Title: "霓虹头像框", Summary: "站内最亮的那圈霓虹，一次拥有，随时换戴。"},
		BenefitItem{ID: "boost_24h", Kind: "priority", Category: "speed", Status: "open", Coins: 20, Title: "24小时出图加速卡", Summary: "全站异步任务优先出队 24 小时。"},
		BenefitItem{ID: "badge_creator", Kind: "badge", Category: "honor", Status: "soon", Coins: 100, Title: "认证创作者徽章", Summary: "社区主页与作品卡片专属标识。"},
	)
	return items
}

func DefaultRewardItems() []RewardItem {
	return []RewardItem{
		{ID: "first_creation", Title: "首次创作奖励", Description: "完成首个 AI 作品生成", CostCoins: 0, Category: "milestone", Status: "active"},
		{ID: "daily_checkin_streak", Title: "连续签到激励", Description: "连续每日活跃打卡", CostCoins: 0, Category: "streak", Status: "active"},
	}
}

func (s *Service) GetBenefitsCatalog(ctx context.Context, userID string) map[string]any {
	items := DefaultBenefitsCatalog()
	if s.Repo != nil && strings.TrimSpace(userID) != "" {
		if unlocked, err := s.Repo.ListUnlockedBenefits(ctx, userID); err == nil {
			for i := range items {
				if unlocked[items[i].ID] || (items[i].Frame != "" && unlocked[items[i].Frame]) {
					items[i].Unlocked = true
				}
			}
		}
	}
	return map[string]any{
		"benefits": items,
	}
}

func (s *Service) RedeemBenefit(ctx context.Context, userID, benefitID string) (map[string]any, error) {
	if err := s.checkLimit(ctx, "currency_benefits", userID, 30, time.Hour); err != nil {
		return nil, err
	}
	var target *BenefitItem
	for _, b := range DefaultBenefitsCatalog() {
		if b.ID == benefitID {
			cp := b
			target = &cp
			break
		}
	}
	if target == nil {
		return nil, svcErr(http.StatusBadRequest, "BENEFIT_NOT_FOUND", "无效的权益项目")
	}
	if target.Status != "open" {
		return nil, svcErr(http.StatusBadRequest, "BENEFIT_UNAVAILABLE", "该权益暂未开放兑换")
	}
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	res, err := s.Repo.RedeemBenefit(ctx, userID, *target, s.now())
	if err != nil {
		if errors.Is(err, ErrInsufficientCoins) {
			return nil, svcErr(http.StatusBadRequest, "INSUFFICIENT_COINS", "K 币余额不足")
		}
		if errors.Is(err, ErrWalletLocked) {
			return nil, svcErr(http.StatusForbidden, "WALLET_LOCKED", "钱包已被锁定")
		}
		return nil, err
	}
	return res, nil
}

func (s *Service) ExchangeCoinsToCredits(ctx context.Context, req ExchangeRequest) (*ExchangeResult, error) {
	if err := validateIdempotencyKey(req.IdempotencyKey, 8, 200); err != nil {
		return nil, err
	}
	if req.CoinsAmount <= 0 || math.IsNaN(req.CoinsAmount) || math.IsInf(req.CoinsAmount, 0) {
		return nil, svcErr(http.StatusBadRequest, "INVALID_AMOUNT", "兑换 K 币数量必须大于 0")
	}
	if math.Floor(req.CoinsAmount) != req.CoinsAmount {
		return nil, svcErr(http.StatusBadRequest, "INVALID_AMOUNT", "兑换 K 币数量需为整数")
	}
	creditsGranted := int64(req.CoinsAmount) * CreditsPerKCoin
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	res, err := s.Repo.ExchangeCoinsToCredits(ctx, req, creditsGranted, s.now())
	if err != nil {
		if errors.Is(err, ErrInsufficientCoins) {
			return nil, svcErr(http.StatusBadRequest, "INSUFFICIENT_COINS", "K 币余额不足")
		}
		if errors.Is(err, ErrWalletLocked) {
			return nil, svcErr(http.StatusForbidden, "WALLET_LOCKED", "钱包已被锁定")
		}
		if errors.Is(err, ErrIdempotencyConflict) {
			return nil, svcErr(http.StatusConflict, "IDEMPOTENCY_CONFLICT", "幂等键冲突")
		}
		return nil, err
	}
	return res, nil
}

func CalculateTransferFee(amount float64) float64 {
	fee := math.Round(amount*TransferFeeRate*10000) / 10000
	if fee < MinTransferFee {
		fee = MinTransferFee
	}
	return fee
}

func (s *Service) TransferCurrency(ctx context.Context, req TransferRequest) (*TransferResult, error) {
	if err := validateIdempotencyKey(req.IdempotencyKey, 8, 200); err != nil {
		return nil, err
	}
	if err := s.checkLimit(ctx, "currency_transfer", req.UserID, 20, time.Hour); err != nil {
		return nil, err
	}
	if strings.TrimSpace(req.ReceiverIdentifier) == "" {
		return nil, svcErr(http.StatusBadRequest, "INVALID_RECEIVER", "请填写收款方用户")
	}
	if req.Amount < MinTransferAmount || req.Amount > MaxSingleTransfer || math.IsNaN(req.Amount) {
		return nil, svcErr(http.StatusBadRequest, "INVALID_AMOUNT", "单笔转账金额需在 1 到 1000 枚 K 币之间")
	}
	if strings.TrimSpace(req.PayPassword) == "" {
		return nil, svcErr(http.StatusBadRequest, "PAY_PASSWORD_REQUIRED", "请输入支付密码")
	}
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	hash, salt, exists, err := s.Repo.GetPayPasswordHash(ctx, req.UserID)
	if err != nil {
		return nil, err
	}
	if !exists || hash == "" {
		return nil, svcErr(http.StatusBadRequest, "PAY_PASSWORD_NOT_SET", "请先设置 6 位数字支付密码")
	}
	if !auth.VerifyPassword(req.PayPassword, hash, salt) {
		return nil, svcErr(http.StatusForbidden, "INVALID_PAY_PASSWORD", "支付密码不正确")
	}
	fee := CalculateTransferFee(req.Amount)
	res, err := s.Repo.TransferCurrency(ctx, req, fee, s.now())
	if err != nil {
		if errors.Is(err, ErrReceiverNotFound) {
			return nil, svcErr(http.StatusNotFound, "RECEIVER_NOT_FOUND", "收款方用户不存在")
		}
		if errors.Is(err, ErrInsufficientCoins) {
			return nil, svcErr(http.StatusBadRequest, "INSUFFICIENT_COINS", "可用 K 币余额不足（含手续费）")
		}
		if errors.Is(err, ErrWalletLocked) {
			return nil, svcErr(http.StatusForbidden, "WALLET_LOCKED", "钱包已被锁定，无法完成转账")
		}
		return nil, err
	}
	return res, nil
}

func (s *Service) GetPayPasswordStatus(ctx context.Context, userID string) (bool, error) {
	if s.Repo == nil {
		return false, nil
	}
	_, _, exists, err := s.Repo.GetPayPasswordHash(ctx, userID)
	return exists, err
}

func (s *Service) SetPayPassword(ctx context.Context, userID, currentPayPassword, newPayPassword string) error {
	if !payPasswordNumericPin6Re.MatchString(strings.TrimSpace(newPayPassword)) {
		return svcErr(http.StatusBadRequest, "INVALID_PAY_PASSWORD", "支付密码须为 6 位数字")
	}
	if s.Repo == nil {
		return ErrNotImplemented
	}
	hash, salt, exists, err := s.Repo.GetPayPasswordHash(ctx, userID)
	if err != nil {
		return err
	}
	if exists && hash != "" {
		if !auth.VerifyPassword(currentPayPassword, hash, salt) {
			return svcErr(http.StatusBadRequest, "INVALID_CURRENT_PAY_PASSWORD", "原支付密码不正确")
		}
	}
	nextHash, nextSalt, err := auth.HashPassword(strings.TrimSpace(newPayPassword))
	if err != nil {
		return err
	}
	return s.Repo.SetPayPasswordHash(ctx, userID, nextHash, nextSalt)
}

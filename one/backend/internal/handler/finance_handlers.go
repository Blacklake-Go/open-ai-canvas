package handler

import (
	"net/http"
	"strconv"
	"strings"

	"one/backend/internal/domain/finance"
	"one/backend/internal/middleware"
	"one/backend/internal/pkg/envelope"
)

func (d *Dependencies) financeService() *finance.Service {
	if d.Finance != nil {
		return d.Finance
	}
	return &finance.Service{}
}

func (d *Dependencies) handleFinancialCreditsWallet(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	wallet, err := d.financeService().GetCreditWallet(r.Context(), u.ID)
	if err != nil {
		writeDomainError(w, err, "读取算力钱包失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{
		"wallet":  wallet,
		"credits": wallet.TotalAvailable,
	})
}

func (d *Dependencies) handleFinancialCreditsLedger(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	entries, err := d.financeService().GetCreditLedger(r.Context(), u.ID, limit, offset)
	if err != nil {
		writeDomainError(w, err, "读取算力流水失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{
		"entries": entries,
		"items":   entries,
		"ledger":  entries,
	})
}

func (d *Dependencies) handleFinancialCreditsCheckin(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	res, err := d.financeService().DailyCheckIn(r.Context(), u.ID)
	if err != nil {
		writeDomainError(w, err, "每日签到失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, res)
}

func (d *Dependencies) handleFinancialCreditsReserve(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	var body struct {
		Amount         int64  `json:"amount"`
		ModelID        string `json:"modelId"`
		IdempotencyKey string `json:"idempotencyKey"`
	}
	if !decodeJSONBody(w, r, 16*1024, &body) {
		return
	}
	idem := firstNonEmpty(r.Header.Get("x-idempotency-key"), r.Header.Get("idempotency-key"), body.IdempotencyKey)
	if len(strings.TrimSpace(idem)) < 8 || len(strings.TrimSpace(idem)) > 200 {
		envelope.DomainError(w, http.StatusUnprocessableEntity, "缺少 x-idempotency-key，重复请求可能导致业务不一致", "MISSING_IDEMPOTENCY_KEY")
		return
	}
	res, err := d.financeService().ReserveCredits(r.Context(), finance.ReserveRequest{
		UserID:         u.ID,
		Amount:         body.Amount,
		ModelID:        body.ModelID,
		IdempotencyKey: strings.TrimSpace(idem),
	})
	if err != nil {
		writeDomainError(w, err, "算力积分预冻结失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, res)
}

func (d *Dependencies) handleFinancialCreditsCommit(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	var body struct {
		ReservationID string `json:"reservationId"`
		CreationID    string `json:"creationId"`
		ActualAmount  *int64 `json:"actualAmount"`
		SettledAmount *int64 `json:"settledAmount"`
	}
	if !decodeJSONBody(w, r, 16*1024, &body) {
		return
	}
	settled := body.SettledAmount
	if settled == nil {
		settled = body.ActualAmount
	}
	res, err := d.financeService().CommitCredits(r.Context(), finance.CommitRequest{
		ReservationID: body.ReservationID,
		UserID:        u.ID,
		CreationID:    body.CreationID,
		SettledAmount: settled,
	})
	if err != nil {
		writeDomainError(w, err, "算力确认扣款失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, res)
}

func (d *Dependencies) handleFinancialCreditsVoid(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	var body struct {
		ReservationID string `json:"reservationId"`
		Reason        string `json:"reason"`
	}
	if !decodeJSONBody(w, r, 16*1024, &body) {
		return
	}
	res, err := d.financeService().VoidCredits(r.Context(), finance.VoidRequest{
		ReservationID: body.ReservationID,
		UserID:        u.ID,
		Reason:        body.Reason,
	})
	if err != nil {
		writeDomainError(w, err, "算力解冻退回失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, res)
}

func (d *Dependencies) handleFinancialCurrencyWallet(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	res, err := d.financeService().GetCurrencyWallet(r.Context(), u.ID)
	if err != nil {
		writeDomainError(w, err, "读取金币钱包失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, res)
}

func (d *Dependencies) handleFinancialCurrencyDailyLogin(w http.ResponseWriter, r *http.Request) {
	u, hasUser := middleware.UserFromContext(r.Context())
	if r.Method == http.MethodGet {
		if !hasUser || u == nil {
			envelope.DomainJSON(w, http.StatusOK, map[string]any{
				"claimed":  false,
				"canClaim": false,
				"balance":  0,
			})
			return
		}
		res, err := d.financeService().GetDailyLoginStatus(r.Context(), u.ID)
		if err != nil {
			writeDomainError(w, err, "获取每日登录状态失败")
			return
		}
		envelope.DomainJSON(w, http.StatusOK, res)
		return
	}
	if !hasUser || u == nil {
		envelope.DomainError(w, http.StatusUnauthorized, "请先登录", "UNAUTHORIZED")
		return
	}
	res, err := d.financeService().ClaimDailyLoginCoin(r.Context(), u.ID)
	if err != nil {
		writeDomainError(w, err, "领取每日登录金币失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, res)
}

func (d *Dependencies) handleFinancialCurrencyRewards(w http.ResponseWriter, r *http.Request) {
	u, hasUser := middleware.UserFromContext(r.Context())
	if r.Method == http.MethodGet {
		uid := ""
		if hasUser && u != nil {
			uid = u.ID
		}
		items, err := d.financeService().ListRewards(r.Context(), uid)
		if err != nil {
			writeDomainError(w, err, "获取悬赏任务失败")
			return
		}
		envelope.DomainJSON(w, http.StatusOK, map[string]any{"rewards": items})
		return
	}
	if !hasUser || u == nil {
		envelope.DomainError(w, http.StatusUnauthorized, "请先登录", "UNAUTHORIZED")
		return
	}
	var body struct {
		Action     string `json:"action"`
		RewardSlug string `json:"rewardSlug"`
		RewardID   string `json:"rewardId"`
	}
	if !decodeJSONBody(w, r, 16*1024, &body) {
		return
	}
	action := strings.ToLower(strings.TrimSpace(body.Action))
	if action == "" {
		action = "redeem"
	}
	targetReward := firstNonEmpty(body.RewardSlug, body.RewardID)
	switch action {
	case "equip":
		res, err := d.financeService().EquipReward(r.Context(), u.ID, targetReward)
		if err != nil {
			writeDomainError(w, err, "佩戴头像框失败")
			return
		}
		envelope.DomainJSON(w, http.StatusOK, res)
	case "redeem":
		res, err := d.financeService().RedeemReward(r.Context(), u.ID, targetReward)
		if err != nil {
			writeDomainError(w, err, "领取悬赏奖励失败")
			return
		}
		envelope.DomainJSON(w, http.StatusOK, res)
	default:
		envelope.DomainError(w, http.StatusBadRequest, "不支持的兑换操作", "INVALID_ACTION")
	}
}

func (d *Dependencies) handleFinancialCurrencyBenefits(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	var body struct {
		BenefitID string `json:"benefitId"`
		Action    string `json:"action"`
	}
	if !decodeJSONBody(w, r, 16*1024, &body) {
		return
	}
	if strings.TrimSpace(body.BenefitID) == "" || strings.EqualFold(body.Action, "list") {
		envelope.DomainJSON(w, http.StatusOK, d.financeService().GetBenefitsCatalog(r.Context(), u.ID))
		return
	}
	res, err := d.financeService().RedeemBenefit(r.Context(), u.ID, body.BenefitID)
	if err != nil {
		writeDomainError(w, err, "兑换权益失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, res)
}

func (d *Dependencies) handleFinancialCurrencyExchange(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	var body struct {
		CoinAmount  float64 `json:"coinAmount"`
		CoinsAmount float64 `json:"coinsAmount"`
		Coins       float64 `json:"coins"`
		Amount      float64 `json:"amount"`
	}
	if !decodeJSONBody(w, r, 16*1024, &body) {
		return
	}
	amt := body.CoinsAmount
	if amt <= 0 {
		amt = body.CoinAmount
	}
	if amt <= 0 {
		amt = body.Coins
	}
	if amt <= 0 {
		amt = body.Amount
	}
	res, err := d.financeService().ExchangeCoinsToCredits(r.Context(), finance.ExchangeRequest{
		UserID:         u.ID,
		CoinsAmount:    amt,
		IdempotencyKey: firstNonEmpty(r.Header.Get("x-idempotency-key"), r.Header.Get("idempotency-key")),
	})
	if err != nil {
		writeDomainError(w, err, "金币兑换算力失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, res)
}

func (d *Dependencies) handleFinancialCurrencyTransfer(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	var body struct {
		RecipientIdentifier string  `json:"recipientIdentifier"`
		ReceiverIdentifier  string  `json:"receiverIdentifier"`
		ReceiverID          string  `json:"receiverId"`
		Recipient           string  `json:"recipient"`
		ToUserID            string  `json:"toUserId"`
		Amount              float64 `json:"amount"`
		PayPassword         string  `json:"payPassword"`
	}
	if !decodeJSONBody(w, r, 16*1024, &body) {
		return
	}
	res, err := d.financeService().TransferCurrency(r.Context(), finance.TransferRequest{
		UserID:             u.ID,
		ReceiverIdentifier: firstNonEmpty(body.ReceiverIdentifier, body.RecipientIdentifier, body.ReceiverID, body.Recipient, body.ToUserID),
		Amount:             body.Amount,
		PayPassword:        body.PayPassword,
		IdempotencyKey:     firstNonEmpty(r.Header.Get("x-idempotency-key"), r.Header.Get("idempotency-key")),
		ClientIP:           clientIP(r),
		UserAgent:          r.UserAgent(),
	})
	if err != nil {
		writeDomainError(w, err, "金币转账失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, res)
}

func (d *Dependencies) handleFinancialCurrencyPassword(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	var body struct {
		Action             string `json:"action"`
		CurrentPayPassword string `json:"currentPayPassword"`
		CurrentPassword    string `json:"currentPassword"`
		NewPayPassword     string `json:"newPayPassword"`
		PayPassword        string `json:"payPassword"`
		Password           string `json:"password"`
	}
	if !decodeJSONBody(w, r, 16*1024, &body) {
		return
	}
	if strings.EqualFold(body.Action, "status") {
		has, err := d.financeService().GetPayPasswordStatus(r.Context(), u.ID)
		if err != nil {
			writeDomainError(w, err, "查询支付密码状态失败")
			return
		}
		envelope.SuccessJSON(w, http.StatusOK, map[string]any{"hasPayPassword": has})
		return
	}
	cur := firstNonEmpty(body.CurrentPayPassword, body.CurrentPassword)
	pw := firstNonEmpty(body.NewPayPassword, body.PayPassword, body.Password)
	if err := d.financeService().SetPayPassword(r.Context(), u.ID, cur, pw); err != nil {
		writeDomainError(w, err, "设置支付密码失败")
		return
	}
	envelope.SuccessJSON(w, http.StatusOK, map[string]any{
		"hasPayPassword": true,
		"message":        "支付密码已更新",
	})
}

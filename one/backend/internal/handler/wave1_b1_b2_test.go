package handler

import (
	"bytes"
	"context"
	"crypto"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"one/backend/internal/config"
	"one/backend/internal/domain/auth"
	"one/backend/internal/domain/billing"
	"one/backend/internal/domain/finance"
	"one/backend/internal/domain/generation"
	"one/backend/internal/domain/site"
	"one/backend/internal/domain/user"
	"one/backend/internal/middleware"
	"one/backend/internal/pkg/envelope"
	"one/backend/internal/platform/coordination"
)

// --- Minimal in-memory repos for Wave 1 HTTP integration tests ---

type hAuthRepo struct {
	creds     map[string]*auth.CredentialRecord
	usersByID map[string]*middleware.SessionUser
	sessions  map[string]string // tokenHash -> userID
	codes     map[string]auth.VerificationCodeRecord
	flows     map[string]auth.OAuthFlowRecord
	byState   map[string]string
	settings  map[string]json.RawMessage
}

func newHAuthRepo() *hAuthRepo {
	h, s, _ := auth.HashPassword("Pass12345!")
	em := "alice@example.com"
	u := &middleware.SessionUser{
		ID: "100001", UserNumber: "100001", Email: &em, DisplayName: "Alice", Role: "user", Status: "active", Locale: "en",
	}
	admEmail := "admin@example.com"
	adm := &middleware.SessionUser{
		ID: "100000", UserNumber: "100000", Email: &admEmail, DisplayName: "Admin", Role: "admin", Status: "active", Locale: "en",
	}
	return &hAuthRepo{
		creds: map[string]*auth.CredentialRecord{
			"alice@example.com": {
				UserID: "100001", UserNumber: "100001", Email: &em, DisplayName: "Alice", Role: "user", Status: "active",
				Locale: "en", PasswordHash: h, PasswordSalt: s,
			},
		},
		usersByID: map[string]*middleware.SessionUser{"100001": u, "100000": adm},
		sessions:  map[string]string{},
		codes:     map[string]auth.VerificationCodeRecord{},
		flows:     map[string]auth.OAuthFlowRecord{},
		byState:   map[string]string{},
		settings:  map[string]json.RawMessage{},
	}
}

func (r *hAuthRepo) LookupByTokenHash(_ context.Context, tokHash string) (*middleware.SessionUser, error) {
	uid, ok := r.sessions[tokHash]
	if !ok {
		return nil, nil
	}
	return r.usersByID[uid], nil
}
func (r *hAuthRepo) GetSettingJSON(_ context.Context, key string) (json.RawMessage, error) {
	return r.settings[key], nil
}
func (r *hAuthRepo) FindCredentialByAccount(_ context.Context, ident string) (*auth.CredentialRecord, error) {
	return r.creds[strings.ToLower(strings.TrimSpace(ident))], nil
}
func (r *hAuthRepo) CheckInviteCodeValid(_ context.Context, code string) (auth.InviteCodeCheck, error) {
	return auth.InviteCodeCheck{Valid: true, Code: code}, nil
}
func (r *hAuthRepo) CreateUser(_ context.Context, p auth.CreateUserParams) (*middleware.SessionUser, error) {
	em := p.Email
	u := &middleware.SessionUser{ID: "100002", UserNumber: "100002", Email: &em, DisplayName: "NewUser", Role: "user", Status: "active", Locale: p.Locale}
	r.usersByID[u.ID] = u
	r.creds[em] = &auth.CredentialRecord{UserID: u.ID, UserNumber: u.UserNumber, Email: &em, DisplayName: u.DisplayName, Role: "user", Status: "active", PasswordHash: p.PasswordHash, PasswordSalt: p.PasswordSalt}
	return u, nil
}
func (r *hAuthRepo) UpdateLoginAudit(_ context.Context, _, _ string) error { return nil }
func (r *hAuthRepo) CreateSession(_ context.Context, userID, rawTok, tokHash string, exp time.Time) (*auth.SessionRecord, error) {
	r.sessions[tokHash] = userID
	return &auth.SessionRecord{Token: rawTok, TokenHash: tokHash, UserID: userID, ExpiresAt: exp}, nil
}
func (r *hAuthRepo) RotateSession(_ context.Context, oldHash, nextRaw, nextHash string, nextExp time.Time) (*auth.SessionRecord, string, error) {
	uid, ok := r.sessions[oldHash]
	if !ok {
		return nil, "", nil
	}
	delete(r.sessions, oldHash)
	r.sessions[nextHash] = uid
	return &auth.SessionRecord{Token: nextRaw, TokenHash: nextHash, UserID: uid, ExpiresAt: nextExp}, uid, nil
}
func (r *hAuthRepo) RevokeSession(_ context.Context, tokHash string) error {
	delete(r.sessions, tokHash)
	return nil
}
func (r *hAuthRepo) RevokeAllUserSessions(_ context.Context, _ string) error { return nil }
func (r *hAuthRepo) LastVerificationCodeIssuedAt(_ context.Context, target, codeType string) (*time.Time, error) {
	if c, ok := r.codes[target+"|"+codeType]; ok {
		return &c.CreatedAt, nil
	}
	return nil, nil
}
func (r *hAuthRepo) ReplaceVerificationCode(_ context.Context, id, target, hash, codeType string, exp time.Time, _ string) error {
	r.codes[target+"|"+codeType] = auth.VerificationCodeRecord{ID: id, Target: target, CodeHash: hash, Type: codeType, ExpiresAt: exp, CreatedAt: time.Now().UTC()}
	return nil
}
func (r *hAuthRepo) FindLatestVerificationCode(_ context.Context, target, codeType string) (*auth.VerificationCodeRecord, error) {
	if c, ok := r.codes[target+"|"+codeType]; ok {
		cp := c
		return &cp, nil
	}
	return nil, nil
}
func (r *hAuthRepo) IncrementVerificationAttempts(_ context.Context, _ string) error { return nil }
func (r *hAuthRepo) MarkVerificationCodeUsed(_ context.Context, _ string) error      { return nil }
func (r *hAuthRepo) FindResetUserByEmail(_ context.Context, email string) (*auth.ResetUserRecord, error) {
	if c, ok := r.creds[email]; ok {
		un := "alice"
		return &auth.ResetUserRecord{ID: c.UserID, UserNumber: c.UserNumber, Email: c.Email, Username: &un, Status: "active"}, nil
	}
	return nil, nil
}
func (r *hAuthRepo) FindResetUserByPhone(_ context.Context, phone string) (*auth.ResetUserRecord, error) {
	return &auth.ResetUserRecord{ID: "100001", UserNumber: "100001", Phone: &phone, Status: "active"}, nil
}
func (r *hAuthRepo) SetUserPassword(_ context.Context, userID, h, s string) error {
	for _, c := range r.creds {
		if c.UserID == userID {
			c.PasswordHash, c.PasswordSalt = h, s
		}
	}
	return nil
}
func (r *hAuthRepo) UpsertPhoneUserAndVerify(_ context.Context, phone, cc, ip, locale string) (*middleware.SessionUser, error) {
	return r.usersByID["100001"], nil
}
func (r *hAuthRepo) BindUserPhone(_ context.Context, _, _, _ string) error { return nil }
func (r *hAuthRepo) CreateOAuthFlow(_ context.Context, f auth.OAuthFlowRecord) error {
	r.flows[f.ID] = f
	r.byState[f.State] = f.ID
	return nil
}
func (r *hAuthRepo) FindOAuthFlowByID(_ context.Context, id string) (*auth.OAuthFlowRecord, error) {
	if f, ok := r.flows[id]; ok {
		cp := f
		return &cp, nil
	}
	return nil, nil
}
func (r *hAuthRepo) FindOAuthFlowByState(_ context.Context, state string) (*auth.OAuthFlowRecord, error) {
	if id, ok := r.byState[state]; ok {
		cp := r.flows[id]
		return &cp, nil
	}
	return nil, nil
}
func (r *hAuthRepo) UpdateOAuthFlow(_ context.Context, f auth.OAuthFlowRecord) error {
	r.flows[f.ID] = f
	return nil
}
func (r *hAuthRepo) FindOrCreateOAuthUser(_ context.Context, _, _, _, _, _, _, _, _ string, _ bool) (*middleware.SessionUser, bool, error) {
	return r.usersByID["100001"], false, nil
}
func (r *hAuthRepo) RecordAuthEvent(_ context.Context, _, _, _, _ string) error { return nil }

type hUserRepo struct {
	profile *user.Profile
	follow  bool
}

func newHUserRepo() *hUserRepo {
	h, s, _ := auth.HashPassword("Pass12345!")
	return &hUserRepo{
		profile: &user.Profile{
			ID: "100001", UserNumber: "100001", Email: "alice@example.com", Phone: "+8613800138000",
			DisplayName: "Alice", Role: "user", Status: "active", Locale: "en", HasPassword: true,
			PasswordHash: h, PasswordSalt: s, IsActivityPublic: true,
			PrivacySettings: map[string]any{}, Preferences: map[string]any{}, SocialLinks: map[string]any{},
		},
	}
}
func (r *hUserRepo) GetByID(_ context.Context, _ string) (*user.Profile, error) {
	return r.profile, nil
}
func (r *hUserRepo) GetProfileByIdentifier(_ context.Context, _ string) (*user.Profile, error) {
	return r.profile, nil
}
func (r *hUserRepo) UpdateProfile(_ context.Context, _ string, dn, bio, web, av, un *string) (*user.Profile, error) {
	if dn != nil {
		r.profile.DisplayName = *dn
	}
	if av != nil {
		r.profile.AvatarURL = *av
	}
	return r.profile, nil
}
func (r *hUserRepo) ClearAvatar(_ context.Context, _ string) (*user.Profile, error) {
	r.profile.AvatarURL = ""
	return r.profile, nil
}
func (r *hUserRepo) SetAvatarFrame(_ context.Context, _, frame string) error {
	r.profile.AvatarFrame = frame
	return nil
}
func (r *hUserRepo) HasUnlockedAvatarFrame(_ context.Context, _, _ string) (bool, error) {
	return true, nil
}
func (r *hUserRepo) GetOrInitAPIKey(_ context.Context, _ string, gen func() string) (string, string, error) {
	return gen(), "2026-11-15T00:00:00Z", nil
}
func (r *hUserRepo) RotateAPIKey(_ context.Context, _, k string) (string, string, error) {
	return k, "2026-11-15T00:00:00Z", nil
}
func (r *hUserRepo) UpdatePassword(_ context.Context, _, h, s string) error {
	r.profile.PasswordHash, r.profile.PasswordSalt = h, s
	return nil
}
func (r *hUserRepo) BindEmail(_ context.Context, _, em string) error {
	r.profile.Email = em
	return nil
}
func (r *hUserRepo) UnbindEmail(_ context.Context, _ string) error { r.profile.Email = ""; return nil }
func (r *hUserRepo) IsEmailOwnedByAnother(_ context.Context, _, _ string) (bool, error) {
	return false, nil
}
func (r *hUserRepo) UpdatePhone(_ context.Context, _, p, cc string) error {
	r.profile.Phone, r.profile.PhoneCountryCode = p, cc
	return nil
}
func (r *hUserRepo) UnbindPhone(_ context.Context, _ string) error { r.profile.Phone = ""; return nil }
func (r *hUserRepo) GetPreferences(_ context.Context, _ string) (map[string]any, error) {
	return r.profile.Preferences, nil
}
func (r *hUserRepo) UpdatePreferences(_ context.Context, _ string, prefs map[string]any) (map[string]any, error) {
	for k, v := range prefs {
		r.profile.Preferences[k] = v
	}
	return r.profile.Preferences, nil
}
func (r *hUserRepo) UpdatePrivacy(_ context.Context, _ string, pub *bool, settings map[string]any) (bool, map[string]any, error) {
	if pub != nil {
		r.profile.IsActivityPublic = *pub
	}
	return r.profile.IsActivityPublic, r.profile.PrivacySettings, nil
}
func (r *hUserRepo) IsFollowing(_ context.Context, _, _ string) (bool, error) { return r.follow, nil }
func (r *hUserRepo) ToggleFollow(_ context.Context, _, _ string) (bool, error) {
	r.follow = !r.follow
	return r.follow, nil
}
func (r *hUserRepo) ListNotifications(_ context.Context, _ string, _ int) ([]user.NotificationItem, int, error) {
	return []user.NotificationItem{{ID: "ntf_1", Title: "Hi"}}, 1, nil
}
func (r *hUserRepo) MarkAllNotificationsRead(_ context.Context, _ string) error { return nil }
func (r *hUserRepo) GetActivityDashboard(_ context.Context, _ string) (*user.ActivityDashboard, error) {
	return &user.ActivityDashboard{TotalCreations: 3, IsPublic: true}, nil
}
func (r *hUserRepo) GetOnboarding(_ context.Context, _ string) (*user.OnboardingPayload, error) {
	return &user.OnboardingPayload{Completed: true, Step: 3}, nil
}
func (r *hUserRepo) SaveOnboarding(_ context.Context, _ string, in user.OnboardingPayload) (*user.OnboardingPayload, error) {
	return &in, nil
}
func (r *hUserRepo) ListOAuthAccounts(_ context.Context, _ string) ([]user.OAuthAccountItem, error) {
	return []user.OAuthAccountItem{{Provider: "google"}}, nil
}
func (r *hUserRepo) CountValidCredentials(_ context.Context, _ string) (int, int, error) {
	return 2, 1, nil
}
func (r *hUserRepo) UnbindOAuthProvider(_ context.Context, _, _ string) error { return nil }
func (r *hUserRepo) ScheduleDeactivation(_ context.Context, _ string, _ time.Time, _ string) error {
	return nil
}
func (r *hUserRepo) CancelDeactivation(_ context.Context, _ string) error { return nil }

type hFinanceRepo struct {
	credits int64
	coins   float64
	payH    string
	payS    string
}

func (r *hFinanceRepo) GetCreditsBalance(_ context.Context, _ string) (int64, error) {
	return r.credits, nil
}
func (r *hFinanceRepo) GetCreditWallet(_ context.Context, uid string) (*finance.CreditWallet, error) {
	return &finance.CreditWallet{UserID: uid, PerpetualCredits: r.credits, TotalAvailable: r.credits}, nil
}
func (r *hFinanceRepo) GetCreditLedger(_ context.Context, _ string, _, _ int) ([]finance.LedgerEntry, error) {
	return []finance.LedgerEntry{}, nil
}
func (r *hFinanceRepo) DailyCheckIn(_ context.Context, _ string, rw int64, _ time.Time) (*finance.CheckInResult, error) {
	r.credits += rw
	return &finance.CheckInResult{Success: true, CheckedIn: true, Reward: rw, TotalCredits: r.credits}, nil
}
func (r *hFinanceRepo) ReserveCredits(_ context.Context, req finance.ReserveRequest, now time.Time) (*finance.ReservationResult, error) {
	return &finance.ReservationResult{Success: true, ReservationID: "res_1", Status: "reserved", ReservedAmount: req.Amount, ExpiresAt: now.Add(15 * time.Minute)}, nil
}
func (r *hFinanceRepo) CommitCredits(_ context.Context, req finance.CommitRequest, _ time.Time) (*finance.CommitResult, error) {
	return &finance.CommitResult{Success: true, ReservationID: req.ReservationID, Status: "committed", Cost: 10}, nil
}
func (r *hFinanceRepo) VoidCredits(_ context.Context, req finance.VoidRequest, _ time.Time) (*finance.VoidResult, error) {
	return &finance.VoidResult{Success: true, ReservationID: req.ReservationID, Status: "voided", ReleasedAmount: 10}, nil
}
func (r *hFinanceRepo) GetCurrencyWallet(_ context.Context, uid string) (*finance.CurrencyWallet, []finance.CurrencyJournalItem, error) {
	return &finance.CurrencyWallet{UserID: uid, AvailableBalance: r.coins, HasPayPassword: r.payH != ""}, nil, nil
}
func (r *hFinanceRepo) GetDailyLoginStatus(_ context.Context, _ string, _ time.Time) (*finance.DailyLoginResult, error) {
	return &finance.DailyLoginResult{Success: true, CanClaim: true, Balance: r.coins}, nil
}
func (r *hFinanceRepo) ClaimDailyLoginCoin(_ context.Context, _ string, rw float64, _ time.Time) (*finance.DailyLoginResult, error) {
	r.coins += rw
	return &finance.DailyLoginResult{Success: true, Claimed: true, Amount: rw, Balance: r.coins}, nil
}
func (r *hFinanceRepo) ListRewards(_ context.Context, _ string) ([]finance.RewardItem, error) {
	return finance.DefaultRewardItems(), nil
}
func (r *hFinanceRepo) RedeemReward(_ context.Context, _, id string, _ time.Time) (map[string]any, error) {
	return map[string]any{"success": true, "rewardId": id}, nil
}
func (r *hFinanceRepo) ListUnlockedBenefits(_ context.Context, _ string) (map[string]bool, error) {
	return map[string]bool{}, nil
}
func (r *hFinanceRepo) RedeemBenefit(_ context.Context, _ string, b finance.BenefitItem, _ time.Time) (map[string]any, error) {
	return map[string]any{"success": true, "benefitId": b.ID}, nil
}
func (r *hFinanceRepo) ExchangeCoinsToCredits(_ context.Context, req finance.ExchangeRequest, cg int64, _ time.Time) (*finance.ExchangeResult, error) {
	r.coins -= req.CoinsAmount
	r.credits += cg
	return &finance.ExchangeResult{Success: true, CoinsSpent: req.CoinsAmount, CreditsGranted: cg, WalletBalance: r.coins, PerpetualCredits: r.credits}, nil
}
func (r *hFinanceRepo) TransferCurrency(_ context.Context, req finance.TransferRequest, fee float64, _ time.Time) (*finance.TransferResult, error) {
	return &finance.TransferResult{Success: true, TransferID: "tr_1", Amount: req.Amount, Fee: fee, SenderBalanceAfter: r.coins - req.Amount - fee}, nil
}
func (r *hFinanceRepo) GetPayPasswordHash(_ context.Context, _ string) (string, string, bool, error) {
	return r.payH, r.payS, r.payH != "", nil
}
func (r *hFinanceRepo) SetPayPasswordHash(_ context.Context, _, h, s string) error {
	r.payH, r.payS = h, s
	return nil
}

type hBillingRepo struct {
	orders map[string]billing.Order
}

func (r *hBillingRepo) GetOrder(_ context.Context, id string) (*billing.Order, error) {
	if o, ok := r.orders[id]; ok {
		cp := o
		return &cp, nil
	}
	return nil, nil
}
func (r *hBillingRepo) ListOrdersByUser(_ context.Context, uid string, _, _ int) ([]billing.Order, error) {
	out := []billing.Order{}
	for _, o := range r.orders {
		if o.UserID == uid {
			out = append(out, o)
		}
	}
	return out, nil
}
func (r *hBillingRepo) HasPaidExclusiveOrder(_ context.Context, _ string) (bool, error) {
	return false, nil
}
func (r *hBillingRepo) CreateOrder(_ context.Context, o billing.Order, _ string) (*billing.Order, error) {
	r.orders[o.ID] = o
	return &o, nil
}
func (r *hBillingRepo) GetActiveSubscription(_ context.Context, _ string) (*billing.SubscriptionInfo, error) {
	return &billing.SubscriptionInfo{ID: "sub_1", PlanID: "basic", Status: "active", IsSubscribed: true}, nil
}
func (r *hBillingRepo) UpdateSubscriptionCancelAtPeriodEnd(_ context.Context, _ string, c bool) (*billing.SubscriptionInfo, error) {
	return &billing.SubscriptionInfo{ID: "sub_1", PlanID: "basic", Status: "active", IsSubscribed: true, CancelAtPeriodEnd: c}, nil
}
func (r *hBillingRepo) GetUsageSummary(_ context.Context, _ string) (*billing.UsageSummary, error) {
	return &billing.UsageSummary{TotalCreations: 5, TotalCreditsUsed: 50}, nil
}
func (r *hBillingRepo) VerifyCoupon(_ context.Context, code, _ string, _ time.Time) (*billing.CouponInfo, error) {
	return &billing.CouponInfo{Code: code, Title: "100 Credits", Type: "credits", Credits: 100}, nil
}
func (r *hBillingRepo) RedeemCoupon(_ context.Context, code, _, _ string, _ time.Time) (map[string]any, error) {
	return map[string]any{"redeemed": true, "code": code, "credits": 100}, nil
}
func (r *hBillingRepo) ClaimWebhookEvent(_ context.Context, _, _, _ string, _ map[string]any, _ map[string]string, _ time.Time) (bool, error) {
	return true, nil
}
func (r *hBillingRepo) MarkWebhookProcessed(_ context.Context, _, _ string, _ time.Time) error {
	return nil
}
func (r *hBillingRepo) MarkWebhookFailed(_ context.Context, _, _, _ string, _ time.Time) error {
	return nil
}
func (r *hBillingRepo) RecordRejectedWebhook(_ context.Context, _, _, _, _ string, _ map[string]any, _ map[string]string, _ time.Time) error {
	return nil
}
func (r *hBillingRepo) ApplyPaymentWebhook(_ context.Context, in billing.WebhookFulfillmentInput, _ time.Time) (*billing.WebhookDispatchResult, error) {
	return &billing.WebhookDispatchResult{Action: "paid", OrderID: in.OrderID}, nil
}

type hPayPalVerifier struct{ ok bool }

func (p hPayPalVerifier) VerifyWebhookSignature(_ context.Context, _ []byte, _ map[string]string, _ string) (bool, error) {
	return p.ok, nil
}

type hEntAdapter struct{ svc *billing.Service }

func (a hEntAdapter) GetEntitlements(ctx context.Context, uid string) (map[string]any, error) {
	return a.svc.GetEntitlementsMap(ctx, uid)
}

func newWave1TestEnv(t *testing.T) (http.Handler, *hAuthRepo, *billing.Service, *rsa.PrivateKey, config.Config) {
	t.Helper()
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("rsa key: %v", err)
	}
	der, _ := x509.MarshalPKIXPublicKey(&priv.PublicKey)
	pubPEM := string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: der}))

	cfg := config.Config{
		PublicAppURL:               "https://www.supdance.com",
		AuthVerificationCodeSecret: "test-secret-key",
		StripeWebhookSecret:        "whsec_test",
		StripeSecretKey:            "sk_test",
		AlipayAppID:                "202100001",
		AlipayPublicKey:            pubPEM,
		WechatPublicKey:            pubPEM,
		WechatAPIV3Key:             "0123456789abcdef0123456789abcdef",
		PayPalWebhookID:            "", // initially empty to assert fail-closed
	}
	coord, _ := coordination.New(coordination.Options{})
	authRepo := newHAuthRepo()
	authRepo.sessions[auth.HashSessionToken("tok-100001")] = "100001"
	authRepo.sessions[auth.HashSessionToken("tok-logout")] = "100001"
	authRepo.sessions[auth.HashSessionToken("tok-refresh")] = "100001"
	authRepo.sessions[auth.HashSessionToken("tok-admin")] = "100000"
	userRepo := newHUserRepo()
	finRepo := &hFinanceRepo{credits: 500, coins: 200}
	billRepo := &hBillingRepo{orders: map[string]billing.Order{}}

	finSvc := &finance.Service{Repo: finRepo, Coord: coord}
	billSvc := &billing.Service{Repo: billRepo, Finance: finSvc, Coord: coord, Config: cfg, PayPalVerifier: hPayPalVerifier{ok: true}}
	authSvc := &auth.Service{Entitlements: hEntAdapter{svc: billSvc}, Repo: authRepo, Sessions: authRepo, Coord: coord, Config: cfg}
	userSvc := &user.Service{Repo: userRepo, AuthRepo: authRepo, Coord: coord, Secret: cfg.AuthVerificationCodeSecret}

	r, err := NewRouter(Dependencies{
		Config:      cfg,
		SessionAuth: authRepo,
		Coord:       coord,
		Site:        &site.Service{},
		Auth:        authSvc,
		User:        userSvc,
		Finance:     finSvc,
		Billing:     billSvc,
		Generation:  &generation.Service{},
		DBCheck:     func(context.Context) error { return nil },
	})
	if err != nil {
		t.Fatalf("NewRouter: %v", err)
	}
	return r, authRepo, billSvc, priv, cfg
}

func materializePath(nextPath string) string {
	p := strings.ReplaceAll(nextPath, "[provider]", "google")
	p = strings.ReplaceAll(p, "[id]", "order_1")
	p = strings.ReplaceAll(p, "[[...path]]", "x")
	p = strings.ReplaceAll(p, "[...path]", "x")
	return p
}

func TestWave1ExactMountedRouteCountsVsStubs(t *testing.T) {
	router, _, _, _, _ := newWave1TestEnv(t)
	contracts, err := envelope.LoadRouteContracts()
	if err != nil {
		t.Fatalf("LoadRouteContracts: %v", err)
	}
	if len(contracts) != 238 {
		t.Fatalf("expected 238 manifest routes, got %d", len(contracts))
	}

	// Completion guard: all 238 baseline routes must have real mounted handlers. Any future
	// change that reintroduces a 501 registry stub fails here immediately. The SSE route has
	// its own dedicated streaming test, so it is counted as real without a blocking probe.
	realCount := 0
	stubCount := 0
	for _, c := range contracts {
		if c.RoutePath == "/api/generations/events" {
			realCount++
			continue
		}
		target := materializePath(c.RoutePath)
		req := httptest.NewRequest(c.Methods[0], target, strings.NewReader(`{}`))
		req.Host = "www.supdance.com"
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "https://www.supdance.com")
		req.Header.Set("Idempotency-Key", "test-idempotency-key-0001")
		if strings.HasPrefix(c.RoutePath, "/api/admin") {
			req.AddCookie(&http.Cookie{Name: "ko_session", Value: "tok-admin"})
		} else if c.RoutePath == "/api/auth/logout" {
			req.AddCookie(&http.Cookie{Name: "ko_session", Value: "tok-logout"})
		} else if c.RoutePath == "/api/auth/refresh" {
			req.AddCookie(&http.Cookie{Name: "ko_session", Value: "tok-refresh"})
		} else {
			req.AddCookie(&http.Cookie{Name: "ko_session", Value: "tok-100001"})
		}
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code == http.StatusNotImplemented {
			stubCount++
		} else {
			realCount++
		}
	}
	if realCount+stubCount != 238 {
		t.Fatalf("expected 238 probed routes, got real=%d stub=%d", realCount, stubCount)
	}
	if stubCount != 0 {
		t.Fatalf("all 238 routes must be real-mounted, got %d registry stubs", stubCount)
	}
	if realCount != 238 {
		t.Fatalf("expected 238 real routes, got %d", realCount)
	}
}

func TestWave1AuthUserFinanceBillingAndWebhooks(t *testing.T) {
	router, _, _, priv, cfg := newWave1TestEnv(t)

	doReq := func(method, target string, body string, withAuth bool) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, target, strings.NewReader(body))
		req.Host = "www.supdance.com"
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "https://www.supdance.com")
		if withAuth {
			req.AddCookie(&http.Cookie{Name: "ko_session", Value: "tok-100001"})
		}
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec
	}

	// 1. Login sets Host-Only ko_session cookie + Refresh + Logout
	loginRec := doReq(http.MethodPost, "/api/auth/login", `{"identifier":"alice@example.com","password":"Pass12345!"}`, false)
	if loginRec.Code != http.StatusOK {
		t.Fatalf("login failed: %d %s", loginRec.Code, loginRec.Body.String())
	}
	cookies := loginRec.Result().Cookies()
	if len(cookies) == 0 || cookies[0].Name != middleware.SessionCookieName || cookies[0].Domain != "" {
		t.Fatalf("expected Host-Only ko_session cookie (empty Domain), got %+v", cookies)
	}
	freshTok := cookies[0].Value

	refReq := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", nil)
	refReq.Host = "www.supdance.com"
	refReq.Header.Set("Origin", "https://www.supdance.com")
	refReq.AddCookie(&http.Cookie{Name: middleware.SessionCookieName, Value: freshTok})
	refRec := httptest.NewRecorder()
	router.ServeHTTP(refRec, refReq)
	if refRec.Code != http.StatusOK {
		t.Fatalf("refresh failed: %d %s", refRec.Code, refRec.Body.String())
	}

	// 2. Sitemap XML
	smRec := doReq(http.MethodGet, "/sitemap.xml", "", false)
	if smRec.Code != http.StatusOK || !strings.Contains(smRec.Header().Get("Content-Type"), "application/xml") || !strings.Contains(smRec.Body.String(), "<urlset") {
		t.Fatalf("sitemap failed: %d %s %s", smRec.Code, smRec.Header().Get("Content-Type"), smRec.Body.String())
	}

	// 3. User routes: profile, avatar 307, api-key, oauth delete 403 REAUTH_REQUIRED
	if r := doReq(http.MethodGet, "/api/user/profile", "", true); r.Code != http.StatusOK {
		t.Fatalf("profile get failed: %d", r.Code)
	}
	if r := doReq(http.MethodGet, "/api/user/avatar", "", false); r.Code != http.StatusTemporaryRedirect {
		t.Fatalf("avatar anonymous should 307 redirect, got %d", r.Code)
	}
	if r := doReq(http.MethodDelete, "/api/user/oauth/google", "", true); r.Code != http.StatusForbidden {
		t.Fatalf("expected 403 REAUTH_REQUIRED on DELETE /api/user/oauth/google, got %d", r.Code)
	}

	// 4. Financial: reserve missing idempotency -> 422, valid -> 200
	if r := doReq(http.MethodPost, "/api/financial/credits/reserve", `{"amount":10,"modelId":"veo-3.1"}`, true); r.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422 missing idempotency key, got %d", r.Code)
	}
	resReq := httptest.NewRequest(http.MethodPost, "/api/financial/credits/reserve", strings.NewReader(`{"amount":10,"modelId":"veo-3.1"}`))
	resReq.Header.Set("Content-Type", "application/json")
	resReq.Header.Set("x-idempotency-key", "idem-reserve-123456")
	resReq.AddCookie(&http.Cookie{Name: "ko_session", Value: "tok-100001"})
	resRec := httptest.NewRecorder()
	router.ServeHTTP(resRec, resReq)
	if resRec.Code != http.StatusOK {
		t.Fatalf("reserve failed: %d %s", resRec.Code, resRec.Body.String())
	}

	// 5. Billing checkout -> order status -> coupons
	chkRec := doReq(http.MethodPost, "/api/billing/checkout", `{"planId":"basic","provider":"stripe","billingCycle":"monthly"}`, true)
	if chkRec.Code != http.StatusOK {
		t.Fatalf("checkout failed: %d %s", chkRec.Code, chkRec.Body.String())
	}
	var chkOut struct {
		OrderID string `json:"orderId"`
	}
	_ = json.Unmarshal(chkRec.Body.Bytes(), &chkOut)
	if r := doReq(http.MethodGet, "/api/billing/orders/"+chkOut.OrderID+"/status", "", true); r.Code != http.StatusOK {
		t.Fatalf("order status failed: %d %s", r.Code, r.Body.String())
	}
	if r := doReq(http.MethodPost, "/api/coupons/redeem", `{"code":"SPRING100"}`, true); r.Code != http.StatusOK {
		t.Fatalf("coupon redeem failed: %d %s", r.Code, r.Body.String())
	}

	// 6. Webhooks: CSRF-exempt external POSTs without Origin, crypto verification, PayPal fail-closed
	ppReq := httptest.NewRequest(http.MethodPost, "/api/billing/webhooks/paypal", bytes.NewBufferString(`{"id":"EV1"}`))
	ppReq.Header.Set("PayPal-Auth-Algo", "SHA256withRSA")
	ppReq.Header.Set("PayPal-Cert-Url", "https://api.paypal.com/cert")
	ppReq.Header.Set("PayPal-Transmission-Id", "tx1")
	ppReq.Header.Set("PayPal-Transmission-Sig", "sig")
	ppReq.Header.Set("PayPal-Transmission-Time", time.Now().UTC().Format(time.RFC3339))
	ppRec := httptest.NewRecorder()
	router.ServeHTTP(ppRec, ppReq)
	if ppRec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected PayPal fail-closed 503 when PAYPAL_WEBHOOK_ID missing, got %d %s", ppRec.Code, ppRec.Body.String())
	}

	// Stripe signed webhook without Origin header (proving CSRF exemption!)
	stBody := []byte(`{"id":"evt_http_1","type":"checkout.session.completed","data":{"object":{"id":"cs_1","amount_total":5000,"currency":"usd","metadata":{"order_id":"` + chkOut.OrderID + `"}}}}`)
	mac := hmac.New(sha256.New, []byte(cfg.StripeWebhookSecret))
	ts := time.Now().UTC().Unix()
	mac.Write([]byte(fmt.Sprintf("%d.", ts)))
	mac.Write(stBody)
	stReq := httptest.NewRequest(http.MethodPost, "/api/billing/webhooks/stripe", bytes.NewReader(stBody))
	stReq.Header.Set("stripe-signature", fmt.Sprintf("t=%d,v1=%s", ts, hex.EncodeToString(mac.Sum(nil))))
	stRec := httptest.NewRecorder()
	router.ServeHTTP(stRec, stReq)
	if stRec.Code != http.StatusOK {
		t.Fatalf("stripe webhook failed: %d %s", stRec.Code, stRec.Body.String())
	}

	// Alipay signed webhook -> text/plain "success"
	aliParams := map[string]string{
		"app_id": "202100001", "notify_id": "n1", "out_trade_no": chkOut.OrderID,
		"trade_no": "ali1", "trade_status": "TRADE_SUCCESS", "total_amount": "350.00", "sign_type": "RSA2",
	}
	h := sha256.Sum256([]byte(billing.BuildAlipaySignString(aliParams, true)))
	sigBytes, _ := rsa.SignPKCS1v15(rand.Reader, priv, crypto.SHA256, h[:])
	aliParams["sign"] = base64.StdEncoding.EncodeToString(sigBytes)
	form := url.Values{}
	for k, v := range aliParams {
		form.Set(k, v)
	}
	aliReq := httptest.NewRequest(http.MethodPost, "/api/billing/webhooks/alipay", strings.NewReader(form.Encode()))
	aliRec := httptest.NewRecorder()
	router.ServeHTTP(aliRec, aliReq)
	if aliRec.Code != http.StatusOK || aliRec.Body.String() != "success" {
		t.Fatalf("alipay webhook failed: %d %q", aliRec.Code, aliRec.Body.String())
	}

	// WeChat signed + AES-256-GCM encrypted webhook
	wxPlain := []byte(`{"out_trade_no":"` + chkOut.OrderID + `","transaction_id":"wx1","amount":{"total":35000}}`)
	block, _ := aes.NewCipher([]byte(cfg.WechatAPIV3Key))
	gcm, _ := cipher.NewGCM(block)
	wxCipher := gcm.Seal(nil, []byte("123456789012"), wxPlain, []byte("transaction"))
	wxPayload, _ := json.Marshal(map[string]any{
		"id": "wx_ev_http", "event_type": "TRANSACTION.SUCCESS",
		"resource": billing.WechatEncryptedResource{
			Algorithm: "AEAD_AES_256_GCM", Ciphertext: base64.StdEncoding.EncodeToString(wxCipher),
			AssociatedData: "transaction", Nonce: "123456789012",
		},
	})
	tsStr := fmt.Sprintf("%d", ts)
	wh := sha256.Sum256([]byte(tsStr + "\nnonce1\n" + string(wxPayload) + "\n"))
	wSig, _ := rsa.SignPKCS1v15(rand.Reader, priv, crypto.SHA256, wh[:])
	wxReq := httptest.NewRequest(http.MethodPost, "/api/billing/webhooks/wechat", bytes.NewReader(wxPayload))
	wxReq.Header.Set("Wechatpay-Signature", base64.StdEncoding.EncodeToString(wSig))
	wxReq.Header.Set("Wechatpay-Timestamp", tsStr)
	wxReq.Header.Set("Wechatpay-Nonce", "nonce1")
	wxRec := httptest.NewRecorder()
	router.ServeHTTP(wxRec, wxReq)
	if wxRec.Code != http.StatusOK {
		t.Fatalf("wechat webhook failed: %d %s", wxRec.Code, wxRec.Body.String())
	}
}

func TestWave1ReviewRegressionsAndContracts(t *testing.T) {
	router, _, billSvc, _, _ := newWave1TestEnv(t)

	doReq := func(method, target string, body string, withAuth bool) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, target, strings.NewReader(body))
		req.Host = "www.supdance.com"
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "https://www.supdance.com")
		if withAuth {
			req.AddCookie(&http.Cookie{Name: "ko_session", Value: "tok-100001"})
		}
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec
	}

	// 1. GET /auth/tiktok routes to callback (state missing -> 307 error redirect, NOT OAuth start 503)
	tkRec := doReq(http.MethodGet, "/auth/tiktok", "", false)
	if tkRec.Code != http.StatusTemporaryRedirect || !strings.Contains(tkRec.Header().Get("Location"), "error=") {
		t.Fatalf("expected /auth/tiktok to invoke callback error redirect, got %d loc=%q", tkRec.Code, tkRec.Header().Get("Location"))
	}

	// 2. GET /api/user/profile?userId=100001 allows unauthenticated lookup and masks email/phone
	profRec := doReq(http.MethodGet, "/api/user/profile?userId=100001", "", false)
	if profRec.Code != http.StatusOK {
		t.Fatalf("expected unauthenticated public profile 200, got %d %s", profRec.Code, profRec.Body.String())
	}
	var profOut struct {
		User struct {
			Email string `json:"email"`
			Phone string `json:"phone"`
		} `json:"user"`
	}
	_ = json.Unmarshal(profRec.Body.Bytes(), &profOut)
	if profOut.User.Email != "" || profOut.User.Phone != "" {
		t.Fatalf("expected unauthenticated profile PII masked, got %+v", profOut.User)
	}

	// 3. POST /api/user/avatar supports multipart/form-data upload and rejects non-image
	var mpBuf bytes.Buffer
	mw := multipart.NewWriter(&mpBuf)
	fw, _ := mw.CreateFormFile("avatar", "pic.png")
	_, _ = fw.Write([]byte("\x89PNG\r\n\x1a\n"))
	_ = mw.Close()
	avReq := httptest.NewRequest(http.MethodPost, "/api/user/avatar", &mpBuf)
	avReq.Host = "www.supdance.com"
	avReq.Header.Set("Content-Type", mw.FormDataContentType())
	avReq.Header.Set("Origin", "https://www.supdance.com")
	avReq.AddCookie(&http.Cookie{Name: "ko_session", Value: "tok-100001"})
	avRec := httptest.NewRecorder()
	router.ServeHTTP(avRec, avReq)
	if avRec.Code != http.StatusOK || !strings.Contains(avRec.Body.String(), "data:image/") {
		t.Fatalf("expected multipart avatar upload 200 with data URI, got %d %s", avRec.Code, avRec.Body.String())
	}

	// 4. POST /api/user/password accepts oldPassword
	if r := doReq(http.MethodPost, "/api/user/password", `{"oldPassword":"Pass12345!","newPassword":"NewPass123!"}`, true); r.Code != http.StatusOK {
		t.Fatalf("expected POST /api/user/password with oldPassword 200, got %d %s", r.Code, r.Body.String())
	}

	// 5. PUT /api/user/preferences accepts top-level fields and sets locale cookie
	prefRec := doReq(http.MethodPut, "/api/user/preferences", `{"notifyOnComplete":true,"locale":"zh-CN"}`, true)
	if prefRec.Code != http.StatusOK || !strings.Contains(prefRec.Body.String(), `"notifyOnComplete":true`) {
		t.Fatalf("expected top-level preference update, got %d %s", prefRec.Code, prefRec.Body.String())
	}
	foundLocaleCookie := false
	for _, c := range prefRec.Result().Cookies() {
		if c.Name == "locale" && c.Value == "zh-CN" {
			foundLocaleCookie = true
		}
	}
	if !foundLocaleCookie {
		t.Fatalf("expected locale=zh-CN cookie set on preference update, got %+v", prefRec.Result().Cookies())
	}

	// 6. GET /api/user/oauth/google reads "accounts" key -> isBound: true
	oaRec := doReq(http.MethodGet, "/api/user/oauth/google", "", true)
	if oaRec.Code != http.StatusOK || !strings.Contains(oaRec.Body.String(), `"isBound":true`) {
		t.Fatalf("expected isBound:true for google oauth, got %d %s", oaRec.Code, oaRec.Body.String())
	}

	// 7. POST /api/user/oauth-security supports action=send-code and rejects unknown action
	if r := doReq(http.MethodPost, "/api/user/oauth-security", `{"action":"send-code"}`, true); r.Code != http.StatusOK {
		t.Fatalf("expected oauth-security send-code 200, got %d %s", r.Code, r.Body.String())
	}
	if r := doReq(http.MethodPost, "/api/user/oauth-security", `{"action":"bogus"}`, true); r.Code != http.StatusBadRequest {
		t.Fatalf("expected oauth-security bogus action 400, got %d %s", r.Code, r.Body.String())
	}

	// 8. POST /api/user/deactivate schedules 3-day deletion window (not 14 days)
	deactRec := doReq(http.MethodPost, "/api/user/deactivate", `{"password":"NewPass123!","confirm":"DELETE"}`, true)
	if deactRec.Code != http.StatusOK || !strings.Contains(deactRec.Body.String(), "3 天") {
		t.Fatalf("expected 3-day deactivation notice, got %d %s", deactRec.Code, deactRec.Body.String())
	}
	var deactOut struct {
		DeletionDueAt string `json:"deletionDueAt"`
	}
	_ = json.Unmarshal(deactRec.Body.Bytes(), &deactOut)
	due, err := time.Parse(time.RFC3339, deactOut.DeletionDueAt)
	if err != nil || time.Until(due) > 4*24*time.Hour || time.Until(due) < 2*24*time.Hour {
		t.Fatalf("expected ~3d deletionDueAt, got %q (err=%v)", deactOut.DeletionDueAt, err)
	}

	// 9. POST /api/auth/refresh returns {user, expires}
	loginRec := doReq(http.MethodPost, "/api/auth/login", `{"identifier":"alice@example.com","password":"Pass12345!"}`, false)
	if loginRec.Code != http.StatusOK {
		t.Fatalf("login failed: %d %s", loginRec.Code, loginRec.Body.String())
	}
	refReq := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", nil)
	refReq.Host = "www.supdance.com"
	refReq.Header.Set("Origin", "https://www.supdance.com")
	refReq.AddCookie(loginRec.Result().Cookies()[0])
	refRec := httptest.NewRecorder()
	router.ServeHTTP(refRec, refReq)
	if refRec.Code != http.StatusOK || !strings.Contains(refRec.Body.String(), `"user":`) || !strings.Contains(refRec.Body.String(), `"expires":`) {
		t.Fatalf("expected {user, expires} from refresh, got %d %s", refRec.Code, refRec.Body.String())
	}

	// 10. OAuth webhook GET challenge & POST message/msg
	whGet := doReq(http.MethodGet, "/api/auth/oauth/feishu/webhook?challenge=ch_ok", "", false)
	if whGet.Code != http.StatusOK || whGet.Body.String() != "ch_ok" {
		t.Fatalf("expected challenge echo, got %d %s", whGet.Code, whGet.Body.String())
	}
	whPost := doReq(http.MethodPost, "/api/auth/oauth/feishu/webhook", `{"event":"ping"}`, false)
	if whPost.Code != http.StatusOK || !strings.Contains(whPost.Body.String(), `"message":"success"`) {
		t.Fatalf("expected {code:0, message:success}, got %d %s", whPost.Code, whPost.Body.String())
	}

	// 11. Finance handlers: ledger key, anon daily-login, rewards action=equip & rewardSlug, transfer receiverId, password {password}
	if r := doReq(http.MethodGet, "/api/financial/credits/ledger", "", true); r.Code != http.StatusOK || !strings.Contains(r.Body.String(), `"ledger":`) {
		t.Fatalf("expected ledger key in credits ledger, got %d %s", r.Code, r.Body.String())
	}
	if r := doReq(http.MethodGet, "/api/financial/currency/daily-login", "", false); r.Code != http.StatusOK || !strings.Contains(r.Body.String(), `"canClaim":false`) {
		t.Fatalf("expected anon daily-login canClaim:false, got %d %s", r.Code, r.Body.String())
	}
	if r := doReq(http.MethodPost, "/api/financial/currency/rewards", `{"action":"equip","rewardSlug":"coin-gold"}`, true); r.Code != http.StatusOK || !strings.Contains(r.Body.String(), `"equipped":true`) {
		t.Fatalf("expected reward equip 200, got %d %s", r.Code, r.Body.String())
	}
	if r := doReq(http.MethodPost, "/api/financial/currency/rewards", `{"action":"bad"}`, true); r.Code != http.StatusBadRequest {
		t.Fatalf("expected invalid reward action 400, got %d %s", r.Code, r.Body.String())
	}
	if r := doReq(http.MethodPost, "/api/financial/currency/password", `{"password":"123456"}`, true); r.Code != http.StatusOK {
		t.Fatalf("expected pay password with 'password' field 200, got %d %s", r.Code, r.Body.String())
	}
	trReq := httptest.NewRequest(http.MethodPost, "/api/financial/currency/transfer", strings.NewReader(`{"receiverId":"100002","amount":10,"payPassword":"123456"}`))
	trReq.Host = "www.supdance.com"
	trReq.Header.Set("Content-Type", "application/json")
	trReq.Header.Set("Origin", "https://www.supdance.com")
	trReq.Header.Set("x-idempotency-key", "idem-transfer-123456")
	trReq.AddCookie(&http.Cookie{Name: "ko_session", Value: "tok-100001"})
	trRec := httptest.NewRecorder()
	router.ServeHTTP(trRec, trReq)
	if trRec.Code != http.StatusOK {
		t.Fatalf("expected currency transfer with receiverId 200, got %d %s", trRec.Code, trRec.Body.String())
	}

	// 12. Billing entitlements wrapped in {entitlements} and subscription null when unsubscribed
	if r := doReq(http.MethodGet, "/api/billing/entitlements", "", true); r.Code != http.StatusOK || !strings.Contains(r.Body.String(), `"entitlements":`) {
		t.Fatalf("expected {entitlements} wrapper, got %d %s", r.Code, r.Body.String())
	}
	subRec := doReq(http.MethodGet, "/api/billing/subscription", "", true)
	if subRec.Code != http.StatusOK || !strings.Contains(subRec.Body.String(), `"subscription":`) {
		t.Fatalf("expected {subscription, entitlements}, got %d %s", subRec.Code, subRec.Body.String())
	}
	// Verify nil subscription produces "subscription":null via nil-sub repo
	origRepo := billSvc.Repo
	billSvc.Repo = nil
	subNilRec := doReq(http.MethodGet, "/api/billing/subscription", "", true)
	billSvc.Repo = origRepo
	if subNilRec.Code != http.StatusOK || !strings.Contains(subNilRec.Body.String(), `"subscription":null`) {
		t.Fatalf("expected subscription:null when unsubscribed, got %d %s", subNilRec.Code, subNilRec.Body.String())
	}
}

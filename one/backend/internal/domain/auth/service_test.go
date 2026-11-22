package auth

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"math/big"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"one/backend/internal/config"
	"one/backend/internal/middleware"
	"one/backend/internal/platform/coordination"
)

type memAuthRepo struct {
	settings    map[string]json.RawMessage
	usersByID   map[string]*CredentialRecord
	sessions    map[string]*SessionRecord
	codes       map[string]*VerificationCodeRecord
	invites     map[string]InviteCodeCheck
	flows       map[string]*OAuthFlowRecord
	revokedAll  []string
	nextNumeric int64
}

func newMemAuthRepo() *memAuthRepo {
	return &memAuthRepo{
		settings:    make(map[string]json.RawMessage),
		usersByID:   make(map[string]*CredentialRecord),
		sessions:    make(map[string]*SessionRecord),
		codes:       make(map[string]*VerificationCodeRecord),
		invites:     make(map[string]InviteCodeCheck),
		flows:       make(map[string]*OAuthFlowRecord),
		nextNumeric: 100001,
	}
}

func (m *memAuthRepo) GetSettingJSON(_ context.Context, key string) (json.RawMessage, error) {
	return m.settings[key], nil
}

func (m *memAuthRepo) FindCredentialByAccount(_ context.Context, identifier string) (*CredentialRecord, error) {
	clean := strings.TrimSpace(identifier)
	for _, u := range m.usersByID {
		if u.UserNumber == clean || (u.Email != nil && strings.EqualFold(*u.Email, clean)) {
			return u, nil
		}
	}
	return nil, nil
}

func (m *memAuthRepo) CheckInviteCodeValid(_ context.Context, code string) (InviteCodeCheck, error) {
	if c, ok := m.invites[strings.ToUpper(strings.TrimSpace(code))]; ok {
		return c, nil
	}
	return InviteCodeCheck{Valid: false, Reason: "邀请码不存在", ErrCode: "INVALID_INVITE_CODE"}, nil
}

func (m *memAuthRepo) CreateUser(_ context.Context, p CreateUserParams) (*middleware.SessionUser, error) {
	clean := NormalizeEmail(p.Email)
	if clean != "" {
		for _, u := range m.usersByID {
			if u.Email != nil && strings.EqualFold(*u.Email, clean) {
				return nil, ErrEmailExists
			}
		}
	}
	m.nextNumeric++
	id := "100001"
	if m.nextNumeric > 100002 {
		id = string(rune('0'+m.nextNumeric%10)) + "00001"
	}
	if len(m.usersByID) > 0 {
		id = "1000" + strings.Repeat("1", len(m.usersByID)+2)
	}
	var emailPtr, phonePtr *string
	if clean != "" {
		emailPtr = &clean
	}
	if p.Phone != "" {
		ph := p.Phone
		phonePtr = &ph
	}
	dn := p.DisplayName
	if dn == "" && clean != "" {
		dn = strings.SplitN(clean, "@", 2)[0]
	}
	if dn == "" {
		dn = "创作者#" + id
	}
	rec := &CredentialRecord{
		UserID:       id,
		UserNumber:   id,
		Email:        emailPtr,
		Phone:        phonePtr,
		DisplayName:  dn,
		Role:         "user",
		Status:       "active",
		Locale:       firstNonEmptyStr(p.Locale, "en"),
		PasswordHash: p.PasswordHash,
		PasswordSalt: p.PasswordSalt,
	}
	m.usersByID[id] = rec
	return &middleware.SessionUser{
		ID:          rec.UserID,
		UserNumber:  rec.UserNumber,
		Email:       rec.Email,
		Phone:       rec.Phone,
		DisplayName: rec.DisplayName,
		Role:        rec.Role,
		Status:      rec.Status,
		Locale:      rec.Locale,
		PlanID:      "free",
	}, nil
}

func (m *memAuthRepo) UpdateLoginAudit(_ context.Context, _, _ string) error { return nil }

func (m *memAuthRepo) CreateSession(_ context.Context, userID, rawToken, tokenHash string, expiresAt time.Time) (*SessionRecord, error) {
	s := &SessionRecord{Token: rawToken, TokenHash: tokenHash, UserID: userID, ExpiresAt: expiresAt}
	m.sessions[tokenHash] = s
	return s, nil
}

func (m *memAuthRepo) RotateSession(_ context.Context, oldTokenHash, nextRawToken, nextTokenHash string, nextExpiresAt time.Time) (*SessionRecord, string, error) {
	old, ok := m.sessions[oldTokenHash]
	if !ok || !old.ExpiresAt.After(time.Now()) {
		return nil, "", nil
	}
	delete(m.sessions, oldTokenHash)
	next := &SessionRecord{Token: nextRawToken, TokenHash: nextTokenHash, UserID: old.UserID, ExpiresAt: nextExpiresAt}
	m.sessions[nextTokenHash] = next
	return next, old.UserID, nil
}

func (m *memAuthRepo) RevokeSession(_ context.Context, tokenHash string) error {
	delete(m.sessions, tokenHash)
	return nil
}

func (m *memAuthRepo) RevokeAllUserSessions(_ context.Context, userID string) error {
	m.revokedAll = append(m.revokedAll, userID)
	for k, v := range m.sessions {
		if v.UserID == userID {
			delete(m.sessions, k)
		}
	}
	return nil
}

func (m *memAuthRepo) LastVerificationCodeIssuedAt(_ context.Context, target, codeType string) (*time.Time, error) {
	rec := m.codes[target+":"+codeType]
	if rec == nil || rec.UsedAt != nil {
		return nil, nil
	}
	return &rec.CreatedAt, nil
}

func (m *memAuthRepo) ReplaceVerificationCode(_ context.Context, id, target, codeHash, codeType string, expiresAt time.Time, _ string) error {
	m.codes[target+":"+codeType] = &VerificationCodeRecord{
		ID:        id,
		Target:    target,
		CodeHash:  codeHash,
		Type:      codeType,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now(),
	}
	return nil
}

func (m *memAuthRepo) FindLatestVerificationCode(_ context.Context, target, codeType string) (*VerificationCodeRecord, error) {
	return m.codes[target+":"+codeType], nil
}

func (m *memAuthRepo) IncrementVerificationAttempts(_ context.Context, id string) error {
	for _, c := range m.codes {
		if c.ID == id {
			c.Attempts++
		}
	}
	return nil
}

func (m *memAuthRepo) MarkVerificationCodeUsed(_ context.Context, id string) error {
	now := time.Now()
	for _, c := range m.codes {
		if c.ID == id {
			c.UsedAt = &now
		}
	}
	return nil
}

func (m *memAuthRepo) FindResetUserByEmail(_ context.Context, email string) (*ResetUserRecord, error) {
	clean := NormalizeEmail(email)
	for _, u := range m.usersByID {
		if u.Email != nil && strings.EqualFold(*u.Email, clean) {
			return &ResetUserRecord{ID: u.UserID, UserNumber: u.UserNumber, Email: u.Email, Status: u.Status}, nil
		}
	}
	return nil, nil
}

func (m *memAuthRepo) FindResetUserByPhone(_ context.Context, phone string) (*ResetUserRecord, error) {
	for _, u := range m.usersByID {
		if u.Phone != nil && *u.Phone == phone {
			return &ResetUserRecord{ID: u.UserID, UserNumber: u.UserNumber, Phone: u.Phone, Status: u.Status}, nil
		}
	}
	return nil, nil
}

func (m *memAuthRepo) SetUserPassword(_ context.Context, userID, passwordHash, passwordSalt string) error {
	if u, ok := m.usersByID[userID]; ok {
		u.PasswordHash = passwordHash
		u.PasswordSalt = passwordSalt
	}
	return nil
}

func (m *memAuthRepo) UpsertPhoneUserAndVerify(ctx context.Context, phone, countryCode, ip, locale string) (*middleware.SessionUser, error) {
	for _, u := range m.usersByID {
		if u.Phone != nil && *u.Phone == phone {
			return &middleware.SessionUser{
				ID: u.UserID, UserNumber: u.UserNumber, Phone: u.Phone, DisplayName: u.DisplayName,
				Role: u.Role, Status: u.Status, Locale: u.Locale, PlanID: "free",
			}, nil
		}
	}
	return m.CreateUser(ctx, CreateUserParams{Phone: phone, PhoneCountryCode: countryCode, IP: ip, Locale: locale})
}

func (m *memAuthRepo) BindUserPhone(_ context.Context, userID, phone, _ string) error {
	for _, u := range m.usersByID {
		if u.Phone != nil && *u.Phone == phone && u.UserID != userID {
			return ErrPhoneBound
		}
	}
	if u, ok := m.usersByID[userID]; ok {
		ph := phone
		u.Phone = &ph
	}
	return nil
}

func (m *memAuthRepo) CreateOAuthFlow(_ context.Context, f OAuthFlowRecord) error {
	cp := f
	m.flows[f.ID] = &cp
	return nil
}

func (m *memAuthRepo) FindOAuthFlowByID(_ context.Context, id string) (*OAuthFlowRecord, error) {
	return m.flows[id], nil
}

func (m *memAuthRepo) FindOAuthFlowByState(_ context.Context, state string) (*OAuthFlowRecord, error) {
	for _, f := range m.flows {
		if f.State == state {
			return f, nil
		}
	}
	return nil, nil
}

func (m *memAuthRepo) UpdateOAuthFlow(_ context.Context, f OAuthFlowRecord) error {
	cp := f
	m.flows[f.ID] = &cp
	return nil
}

func (m *memAuthRepo) FindOrCreateOAuthUser(ctx context.Context, _, _, email, _, displayName, _, locale, ip string, _ bool) (*middleware.SessionUser, bool, error) {
	if email != "" {
		for _, u := range m.usersByID {
			if u.Email != nil && strings.EqualFold(*u.Email, email) {
				return &middleware.SessionUser{
					ID: u.UserID, UserNumber: u.UserNumber, Email: u.Email, DisplayName: u.DisplayName,
					Role: u.Role, Status: u.Status, Locale: u.Locale, PlanID: "free",
				}, false, nil
			}
		}
	}
	u, err := m.CreateUser(ctx, CreateUserParams{Email: email, DisplayName: displayName, Locale: locale, IP: ip})
	return u, true, err
}

func (m *memAuthRepo) RecordAuthEvent(_ context.Context, _, _, _, _ string) error { return nil }

type stubSessionLookup struct {
	repo *memAuthRepo
}

func (s *stubSessionLookup) LookupByTokenHash(_ context.Context, tokenHash string) (*middleware.SessionUser, error) {
	ses := s.repo.sessions[tokenHash]
	if ses == nil {
		return nil, nil
	}
	u := s.repo.usersByID[ses.UserID]
	if u == nil {
		return nil, nil
	}
	return &middleware.SessionUser{
		ID:           u.UserID,
		UserNumber:   u.UserNumber,
		Email:        u.Email,
		Phone:        u.Phone,
		DisplayName:  u.DisplayName,
		Role:         u.Role,
		Status:       u.Status,
		Locale:       u.Locale,
		PlanID:       "pro",
		IsSubscribed: true,
	}, nil
}

type captureSender struct {
	lastEmailCode string
	lastSMSCode   string
}

func (c *captureSender) SendEmailCode(_ context.Context, _, code, _ string) error {
	c.lastEmailCode = code
	return nil
}

func (c *captureSender) SendSMSCode(_ context.Context, _, code, _ string) error {
	c.lastSMSCode = code
	return nil
}

func TestScryptPasswordCompatibility(t *testing.T) {
	digest, salt, err := HashPassword("SupDance#2026")
	if err != nil {
		t.Fatalf("HashPassword error = %v", err)
	}
	if len(digest) != 128 || len(salt) != 32 {
		t.Fatalf("unexpected scrypt sizes digest=%d salt=%d", len(digest), len(salt))
	}
	if !VerifyPassword("SupDance#2026", digest, salt) {
		t.Fatal("VerifyPassword rejected valid scrypt password")
	}
	if VerifyPassword("wrong", digest, salt) {
		t.Fatal("VerifyPassword accepted wrong password")
	}
}

func TestRegisterLoginRefreshLogoutAndResetFlows(t *testing.T) {
	now := time.Date(2026, 11, 15, 10, 0, 0, 0, time.UTC)
	repo := newMemAuthRepo()
	repo.invites["KOYO-VIP1"] = InviteCodeCheck{Valid: true, Code: "KOYO-VIP1"}
	sender := &captureSender{}
	coord, _ := coordination.New(coordination.Options{Now: func() time.Time { return now }})
	svc := &Service{
		Repo:     repo,
		Sessions: &stubSessionLookup{repo: repo},
		Coord:    coord,
		Sender:   sender,
		Config: config.Config{
			AuthVerificationCodeSecret: "test-secret",
			InviteCodeRequired:         true,
		},
		Now: func() time.Time { return now },
	}
	ctx := context.Background()

	// Send code & register
	if err := svc.SendRegisterCode(ctx, "Creator@Example.com", "1.2.3.4"); err != nil {
		t.Fatalf("SendRegisterCode error = %v", err)
	}
	if len(sender.lastEmailCode) != 6 {
		t.Fatalf("expected 6-digit code, got %q", sender.lastEmailCode)
	}

	// Missing invite code rejected
	if _, err := svc.Register(ctx, RegisterInput{
		Email: "Creator@Example.com", Password: "Password123!", Code: sender.lastEmailCode, IP: "1.2.3.4",
	}); err == nil {
		t.Fatal("expected invite code required error")
	}

	// Wrong OTP rejected and valid succeeds
	if _, err := svc.Register(ctx, RegisterInput{
		Email: "Creator@Example.com", Password: "Password123!", Code: "000000", InviteCode: "KOYO-VIP1", IP: "1.2.3.4",
	}); err == nil {
		t.Fatal("expected invalid code error")
	}

	regRes, err := svc.Register(ctx, RegisterInput{
		Email: "Creator@Example.com", Password: "Password123!", Code: sender.lastEmailCode, InviteCode: "KOYO-VIP1", Locale: "zh-CN", IP: "1.2.3.4",
	})
	if err != nil {
		t.Fatalf("Register error = %v", err)
	}
	if regRes.Session == nil || regRes.User == nil {
		t.Fatal("missing session or user after register")
	}

	// Login with email
	loginRes, err := svc.Login(ctx, "creator@example.com", "Password123!", "1.2.3.4")
	if err != nil {
		t.Fatalf("Login error = %v", err)
	}
	if !loginRes.User.IsSubscribed || loginRes.User.PlanID != "pro" {
		t.Fatalf("expected hydrated subscription plan from Sessions lookup, got %+v", loginRes.User)
	}

	// Refresh rotates token
	refreshed, err := svc.RefreshSession(ctx, loginRes.Session.Token)
	if err != nil {
		t.Fatalf("RefreshSession error = %v", err)
	}
	if refreshed.Session.Token == loginRes.Session.Token {
		t.Fatal("RefreshSession must rotate token")
	}

	// Password reset via email revokes all sessions
	if err := svc.ForgotPasswordEmail(ctx, "creator@example.com", "1.2.3.4"); err != nil {
		t.Fatalf("ForgotPasswordEmail error = %v", err)
	}
	if err := svc.ResetPasswordEmail(ctx, "creator@example.com", sender.lastEmailCode, "NewPassword456!", "1.2.3.4"); err != nil {
		t.Fatalf("ResetPasswordEmail error = %v", err)
	}
	if len(repo.revokedAll) == 0 {
		t.Fatal("expected RevokeAllUserSessions to be called on password reset")
	}
	if _, err := svc.Login(ctx, "creator@example.com", "Password123!", "1.2.3.4"); err == nil {
		t.Fatal("old password must fail after reset")
	}
	if _, err := svc.Login(ctx, "creator@example.com", "NewPassword456!", "1.2.3.4"); err != nil {
		t.Fatalf("new password login failed: %v", err)
	}

	// Phone OTP login + reset
	if _, err := svc.SendPhoneCode(ctx, "13800138000", "+86", "phone_login", "1.2.3.4"); err != nil {
		t.Fatalf("SendPhoneCode error = %v", err)
	}
	phoneRes, err := svc.VerifyPhone(ctx, "13800138000", "+86", sender.lastSMSCode, "phone_login", "1.2.3.4", "zh-CN", nil)
	if err != nil {
		t.Fatalf("VerifyPhone error = %v", err)
	}
	if phoneRes.User.Phone == nil || *phoneRes.User.Phone != "+8613800138000" {
		t.Fatalf("expected E.164 phone +8613800138000, got %+v", phoneRes.User.Phone)
	}
}

func TestGoogleOneTapAndHostOnlyCookie(t *testing.T) {
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("rsa keygen: %v", err)
	}
	jwk := JWK{
		Kid: "kid-1",
		Kty: "RSA",
		Alg: "RS256",
		N:   base64.RawURLEncoding.EncodeToString(priv.N.Bytes()),
		E:   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(priv.E)).Bytes()),
	}
	now := time.Date(2026, 11, 15, 10, 0, 0, 0, time.UTC)
	signToken := func(aud string, exp int64) string {
		hdr, _ := json.Marshal(map[string]string{"alg": "RS256", "kid": "kid-1"})
		pay, _ := json.Marshal(GoogleIDClaims{
			Issuer:        "https://accounts.google.com",
			Audience:      aud,
			Subject:       "google-sub-999",
			Email:         "googleuser@example.com",
			EmailVerified: true,
			Name:          "Google Creator",
			ExpiresAt:     exp,
		})
		signingInput := base64.RawURLEncoding.EncodeToString(hdr) + "." + base64.RawURLEncoding.EncodeToString(pay)
		sum := sha256.Sum256([]byte(signingInput))
		sig, _ := rsa.SignPKCS1v15(rand.Reader, priv, crypto.SHA256, sum[:])
		return signingInput + "." + base64.RawURLEncoding.EncodeToString(sig)
	}

	repo := newMemAuthRepo()
	svc := &Service{
		Repo: repo,
		Config: config.Config{
			GoogleClientID: "google-client-123",
		},
		GoogleJWKS: func(context.Context) ([]JWK, error) { return []JWK{jwk}, nil },
		Now:        func() time.Time { return now },
	}
	ctx := context.Background()

	if _, err := svc.HandleGoogleOneTap(ctx, signToken("wrong-aud", now.Add(time.Hour).Unix()), "1.2.3.4", "en"); err == nil {
		t.Fatal("expected audience mismatch error")
	}
	res, err := svc.HandleGoogleOneTap(ctx, signToken("google-client-123", now.Add(time.Hour).Unix()), "1.2.3.4", "en")
	if err != nil {
		t.Fatalf("HandleGoogleOneTap error = %v", err)
	}
	if res.User == nil || res.Session == nil {
		t.Fatal("expected user and session from Google One Tap")
	}

	// Host-only cookie check on *.supdance.com
	rec := httptest.NewRecorder()
	SetSessionCookie(rec, res.Session.Token, res.Session.ExpiresAt, "one.supdance.com", "", true)
	cookies := rec.Result().Cookies()
	if len(cookies) != 2 {
		t.Fatalf("expected host-only cookie + .supdance.com purge cookie, got %d", len(cookies))
	}
	if cookies[0].Domain != "" || !cookies[0].HttpOnly || !cookies[0].Secure {
		t.Fatalf("expected Host-Only HttpOnly Secure cookie on *.supdance.com, got %+v", cookies[0])
	}
	if cookies[1].Domain != "supdance.com" && cookies[1].Domain != ".supdance.com" || cookies[1].MaxAge != -1 {
		t.Fatalf("expected expired purge cookie for .supdance.com, got %+v", cookies[1])
	}
	_ = http.StatusOK
}

type failingSender struct{}

func (failingSender) SendEmailCode(context.Context, string, string, string) error {
	return errors.New("smtp down")
}
func (failingSender) SendSMSCode(context.Context, string, string, string) error {
	return errors.New("sms down")
}

func TestSendCodeDeliveryFailureInvalidatesCode(t *testing.T) {
	now := time.Date(2026, 11, 16, 10, 0, 0, 0, time.UTC)
	repo := newMemAuthRepo()
	svc := &Service{
		Repo:   repo,
		Sender: failingSender{},
		Now:    func() time.Time { return now },
	}
	if err := svc.SendRegisterCode(context.Background(), "bad@example.com", "1.2.3.4"); err == nil {
		t.Fatal("expected email send failure to fail closed")
	}
	rec, err := repo.FindLatestVerificationCode(context.Background(), "bad@example.com", "email_register")
	if err == nil && rec != nil && rec.UsedAt == nil {
		t.Fatal("expected undelivered verification code to be marked used")
	}
}

func TestOAuthStartCallbackFailClosedAndRealProviders(t *testing.T) {
	now := time.Date(2026, 11, 16, 10, 0, 0, 0, time.UTC)
	repo := newMemAuthRepo()

	// 1. Fail closed when credentials are missing
	unconf := &Service{Repo: repo, Now: func() time.Time { return now }}
	if _, _, err := unconf.StartOAuth(context.Background(), "google", "login", "/studio", "https://one.example.com"); err == nil {
		t.Fatal("expected OAuth StartOAuth to fail closed when unconfigured")
	}

	// 2. Real HTTP token exchange + PKCE + profile normalization (Google & QQ)
	var tokenForm url.Values
	oauthSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/google/token":
			_ = r.ParseForm()
			tokenForm = r.PostForm
			_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "g-tok-1"})
		case "/google/userinfo":
			if r.Header.Get("Authorization") != "Bearer g-tok-1" {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"sub":            "google-user-42",
				"email":          "oauth@example.com",
				"email_verified": true,
				"name":           "OAuth Creator",
				"picture":        "https://cdn.example.com/a.png",
			})
		case "/qq/token":
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "qq-tok-1"})
		case "/qq/me":
			_, _ = w.Write([]byte(`callback( {"client_id":"qq-id","openid":"qq-open-77"} );`))
		case "/qq/userinfo":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"ret":            0,
				"nickname":       "QQStar",
				"figureurl_qq_2": "http://q.qlogo.cn/avatar.jpg",
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer oauthSrv.Close()

	svc := &Service{
		Repo:      repo,
		OAuthHTTP: oauthSrv.Client(),
		Now:       func() time.Time { return now },
		Config:    config.Config{PublicAppURL: "https://one.example.com"},
		OAuthSecretFn: func(_ context.Context, p, k string) string {
			switch p + ":" + k {
			case "google:client_id":
				return "g-cid"
			case "google:client_secret":
				return "g-sec"
			case "qq:app_id":
				return "qq-cid"
			case "qq:app_key":
				return "qq-sec"
			}
			return ""
		},
		OAuthProviders: map[string]OAuthProviderSpec{
			"google": {
				ID:                  "google",
				CredentialProviders: []string{"google"},
				ClientIDKeys:        []string{"client_id"},
				ClientSecretKeys:    []string{"client_secret"},
				AuthorizeURL:        oauthSrv.URL + "/google/authorize",
				TokenURL:            oauthSrv.URL + "/google/token",
				UserInfoURL:         oauthSrv.URL + "/google/userinfo",
				Scopes:              []string{"openid", "email"},
				PKCE:                true,
				ClientIDParam:       "client_id",
				SecretParam:         "client_secret",
				TokenTransport:      "form",
				ProfileTransport:    "bearer",
			},
			"qq": {
				ID:                      "qq",
				CredentialProviders:     []string{"qq"},
				ClientIDKeys:            []string{"app_id"},
				ClientSecretKeys:        []string{"app_key"},
				AuthorizeURL:            oauthSrv.URL + "/qq/authorize",
				TokenURL:                oauthSrv.URL + "/qq/token",
				OpenIDURL:               oauthSrv.URL + "/qq/me",
				UserInfoURL:             oauthSrv.URL + "/qq/userinfo",
				Scopes:                  []string{"get_user_info"},
				ClientIDParam:           "client_id",
				SecretParam:             "client_secret",
				TokenTransport:          "get-query",
				TokenIncludeRedirectURI: true,
				ProfileTransport:        "qq-jsonp",
			},
		},
	}

	flow, authURL, err := svc.StartOAuth(context.Background(), "google", "login", "/projects", "https://one.example.com")
	if err != nil {
		t.Fatalf("StartOAuth google error = %v", err)
	}
	if !strings.Contains(authURL, "code_challenge_method=S256") || !strings.Contains(authURL, "redirect_uri=https%3A%2F%2Fone.example.com%2Fapi%2Fauth%2Foauth%2Fgoogle%2Fcallback") {
		t.Fatalf("unexpected google authorize url: %s", authURL)
	}
	res, err := svc.HandleOAuthCallback(context.Background(), "google", "auth-code-1", flow.State, "", "1.2.3.4")
	if err != nil {
		t.Fatalf("HandleOAuthCallback google error = %v", err)
	}
	if tokenForm.Get("code_verifier") != flow.CodeVerifier {
		t.Fatalf("expected PKCE verifier=%q, got %q", flow.CodeVerifier, tokenForm.Get("code_verifier"))
	}
	if res.Session == nil || res.Session.User == nil || res.Session.User.Email == nil || *res.Session.User.Email != "oauth@example.com" || res.ReturnTo != "/projects" {
		t.Fatalf("unexpected google oauth result: %+v", res)
	}

	qqFlow, _, err := svc.StartOAuth(context.Background(), "qq", "login", "/studio", "")
	if err != nil {
		t.Fatalf("StartOAuth qq error = %v", err)
	}
	qqRes, err := svc.HandleOAuthCallback(context.Background(), "qq", "qq-code-1", qqFlow.State, "", "1.2.3.4")
	if err != nil {
		t.Fatalf("HandleOAuthCallback qq error = %v", err)
	}
	if qqRes.Flow.ProviderUID != "qq-open-77" || qqRes.Flow.DisplayName != "QQStar" {
		t.Fatalf("unexpected qq oauth result: %+v", qqRes.Flow)
	}
}

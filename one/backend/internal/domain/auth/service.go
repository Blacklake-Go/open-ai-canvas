package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"one/backend/internal/config"
	"one/backend/internal/middleware"
	"one/backend/internal/pkg/ids"
	"one/backend/internal/platform/coordination"
)

const (
	SessionTTL          = 30 * 24 * time.Hour
	OTPLifetime         = 5 * time.Minute
	EmailCodeLifetime   = 15 * time.Minute
	ResendCooldown      = 60 * time.Second
	MaxVerifyAttempts   = 5
	OAuthFlowCookieName = "ko_oauth_pending"
	OAuthStateCookie    = "ko_oauth_state"
	StepUpCookieName    = "ko_oauth_step_up"
)

type ServiceError struct {
	Status     int
	Code       string
	Message    string
	RetryAfter int
}

func (e *ServiceError) Error() string {
	return e.Message
}

func svcErr(status int, code, msg string) *ServiceError {
	return &ServiceError{Status: status, Code: code, Message: msg}
}

type MeResponse struct {
	User         *middleware.SessionUser `json:"user"`
	Entitlements map[string]any          `json:"entitlements"`
}

type EntitlementsLookup interface {
	GetEntitlements(ctx context.Context, userID string) (map[string]any, error)
}

type OutboundCodeSender interface {
	SendEmailCode(ctx context.Context, email, code, purpose string) error
	SendSMSCode(ctx context.Context, phone, code, purpose string) error
}

type Service struct {
	Entitlements   EntitlementsLookup
	Repo           AuthRepository
	Sessions       middleware.SessionLookup
	Coord          *coordination.Coordinator
	Config         config.Config
	Sender         OutboundCodeSender
	GoogleJWKS     func(ctx context.Context) ([]JWK, error)
	OAuthHTTP      *http.Client
	OAuthProviders map[string]OAuthProviderSpec
	OAuthSecretFn  func(ctx context.Context, provider, name string) string
	Now            func() time.Time
}

func (s *Service) now() time.Time {
	if s != nil && s.Now != nil {
		return s.Now()
	}
	return time.Now().UTC()
}

func (s *Service) codeSecret() string {
	if s != nil && strings.TrimSpace(s.Config.AuthVerificationCodeSecret) != "" {
		return s.Config.AuthVerificationCodeSecret
	}
	return "one-dev-verification-secret"
}

func (s *Service) GetMe(ctx context.Context, user *middleware.SessionUser) MeResponse {
	if user == nil {
		return MeResponse{User: nil, Entitlements: nil}
	}
	var ent map[string]any
	if s.Entitlements != nil {
		ent, _ = s.Entitlements.GetEntitlements(ctx, user.ID)
	}
	if ent == nil {
		ent = map[string]any{
			"planId":             user.PlanID,
			"isSubscribed":       user.IsSubscribed,
			"maxConcurrentTasks": 2,
			"priorityQueue":      false,
		}
	}
	return MeResponse{
		User:         user,
		Entitlements: ent,
	}
}

// SessionCookieDomain enforces host-only ko_session cookies on *.supdance.com
// matching Supdance Pro/lib/services/auth.js:1019.
func SessionCookieDomain(host string, overrideDomain string) string {
	if d := strings.TrimSpace(overrideDomain); d != "" {
		if !strings.HasPrefix(d, ".") {
			return "." + d
		}
		return d
	}
	cleanHost := strings.ToLower(strings.TrimSpace(strings.Split(host, ":")[0]))
	if cleanHost == "" || cleanHost == "localhost" || cleanHost == "127.0.0.1" ||
		strings.HasSuffix(cleanHost, ".local") || strings.HasSuffix(cleanHost, ".test") {
		return ""
	}
	if cleanHost == "supdance.com" || strings.HasSuffix(cleanHost, ".supdance.com") {
		return ""
	}
	parts := strings.Split(cleanHost, ".")
	if len(parts) >= 2 {
		return "." + strings.Join(parts[len(parts)-2:], ".")
	}
	return ""
}

func SetSessionCookie(w http.ResponseWriter, token string, expires time.Time, host, overrideDomain string, isProd bool) {
	domain := SessionCookieDomain(host, overrideDomain)
	cookie := &http.Cookie{
		Name:     middleware.SessionCookieName,
		Value:    token,
		Path:     "/",
		Expires:  expires,
		MaxAge:   int(time.Until(expires).Seconds()),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   isProd,
	}
	if domain != "" {
		cookie.Domain = domain
	}
	http.SetCookie(w, cookie)

	// Clear stale wildcard .supdance.com cookie if we are issuing host-only on supdance.com
	cleanHost := strings.ToLower(strings.TrimSpace(strings.Split(host, ":")[0]))
	if domain == "" && (cleanHost == "supdance.com" || strings.HasSuffix(cleanHost, ".supdance.com")) {
		http.SetCookie(w, &http.Cookie{
			Name:     middleware.SessionCookieName,
			Value:    "",
			Path:     "/",
			Domain:   ".supdance.com",
			MaxAge:   -1,
			Expires:  time.Unix(0, 0),
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
			Secure:   isProd,
		})
	}
}

func ClearSessionCookie(w http.ResponseWriter, host, overrideDomain string, isProd bool) {
	domain := SessionCookieDomain(host, overrideDomain)
	http.SetCookie(w, &http.Cookie{
		Name:     middleware.SessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   isProd,
	})
	if domain != "" {
		http.SetCookie(w, &http.Cookie{
			Name:     middleware.SessionCookieName,
			Value:    "",
			Path:     "/",
			Domain:   domain,
			MaxAge:   -1,
			Expires:  time.Unix(0, 0),
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
			Secure:   isProd,
		})
	}
}

func SetLocaleCookies(w http.ResponseWriter, locale string, isProd bool) {
	for _, name := range []string{"NEXT_LOCALE", "locale"} {
		http.SetCookie(w, &http.Cookie{
			Name:     name,
			Value:    locale,
			Path:     "/",
			MaxAge:   31536000,
			SameSite: http.SameSiteLaxMode,
			Secure:   isProd,
		})
	}
}

func (s *Service) checkLimit(ctx context.Context, scope, subject string, limit int, window time.Duration) error {
	if s.Coord == nil {
		return nil
	}
	res, err := s.Coord.ConsumeRateLimit(ctx, coordination.RateLimitRequest{
		Scope:   scope,
		Subject: subject,
		Limit:   limit,
		Window:  window,
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

type AuthSessionResult struct {
	User    *middleware.SessionUser
	Session *SessionRecord
	IsNew   bool
}

func (s *Service) Login(ctx context.Context, identifier, password, ip string) (*AuthSessionResult, error) {
	if err := s.checkLimit(ctx, "auth_login_ip", ip, 20, 15*time.Minute); err != nil {
		return nil, err
	}
	if strings.TrimSpace(identifier) == "" || password == "" {
		return nil, svcErr(http.StatusUnauthorized, "INVALID_CREDENTIALS", "账号/邮箱或密码不正确")
	}
	if s.Repo == nil {
		return nil, svcErr(http.StatusServiceUnavailable, "AUTH_UNAVAILABLE", "登录暂时不可用")
	}
	cred, err := s.Repo.FindCredentialByAccount(ctx, identifier)
	if err != nil {
		return nil, err
	}
	if cred == nil || !VerifyPassword(password, cred.PasswordHash, cred.PasswordSalt) {
		return nil, svcErr(http.StatusUnauthorized, "INVALID_CREDENTIALS", "账号/邮箱或密码不正确")
	}
	if cred.Status == "suspended" {
		return nil, svcErr(http.StatusForbidden, "ACCOUNT_SUSPENDED", "账号已被停用，请联系客服处理")
	}

	_ = s.Repo.UpdateLoginAudit(ctx, cred.UserID, ip)
	_ = s.Repo.RecordAuthEvent(ctx, cred.UserID, "login_password", ip, "")

	rawTok := GenerateRandomHex(32)
	tokHash := HashSessionToken(rawTok)
	exp := s.now().Add(SessionTTL)
	ses, err := s.Repo.CreateSession(ctx, cred.UserID, rawTok, tokHash, exp)
	if err != nil {
		return nil, err
	}
	user := &middleware.SessionUser{
		ID:          cred.UserID,
		UserNumber:  cred.UserNumber,
		Email:       cred.Email,
		Phone:       cred.Phone,
		DisplayName: cred.DisplayName,
		AvatarURL:   cred.AvatarURL,
		Role:        cred.Role,
		Status:      cred.Status,
		Locale:      cred.Locale,
		Credits:     cred.Credits,
		PlanID:      "free",
	}
	if s.Sessions != nil {
		if lookedUp, lErr := s.Sessions.LookupByTokenHash(ctx, tokHash); lErr == nil && lookedUp != nil {
			user = lookedUp
		}
	}
	return &AuthSessionResult{User: user, Session: ses}, nil
}

func (s *Service) Logout(ctx context.Context, rawToken string) error {
	if s.Repo == nil || strings.TrimSpace(rawToken) == "" {
		return nil
	}
	return s.Repo.RevokeSession(ctx, HashSessionToken(rawToken))
}

func (s *Service) RefreshSession(ctx context.Context, rawToken string) (*AuthSessionResult, error) {
	if s.Repo == nil || strings.TrimSpace(rawToken) == "" {
		return nil, svcErr(http.StatusUnauthorized, "SESSION_INVALID", "会话已失效，请重新登录")
	}
	nextRaw := GenerateRandomHex(32)
	nextHash := HashSessionToken(nextRaw)
	nextExp := s.now().Add(SessionTTL)

	ses, userID, err := s.Repo.RotateSession(ctx, HashSessionToken(rawToken), nextRaw, nextHash, nextExp)
	if err != nil {
		return nil, err
	}
	if ses == nil || userID == "" {
		return nil, svcErr(http.StatusUnauthorized, "SESSION_INVALID", "会话已失效，请重新登录")
	}
	var user *middleware.SessionUser
	if s.Sessions != nil {
		user, err = s.Sessions.LookupByTokenHash(ctx, nextHash)
		if err != nil {
			return nil, err
		}
	}
	if user == nil {
		return nil, svcErr(http.StatusUnauthorized, "SESSION_REFRESH_FAILED", "会话刷新失败，请重新登录")
	}
	return &AuthSessionResult{User: user, Session: ses}, nil
}

func (s *Service) isSettingEnabled(ctx context.Context, key string, defaultVal bool) (bool, string) {
	if s.Repo == nil {
		return defaultVal, ""
	}
	raw, err := s.Repo.GetSettingJSON(ctx, key)
	if err != nil || len(raw) == 0 {
		return defaultVal, ""
	}
	var obj struct {
		Enabled *bool  `json:"enabled"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(raw, &obj); err == nil && obj.Enabled != nil {
		return *obj.Enabled, obj.Message
	}
	var b bool
	if err := json.Unmarshal(raw, &b); err == nil {
		return b, ""
	}
	return defaultVal, ""
}

func (s *Service) isInviteRequired(ctx context.Context) bool {
	if s.Repo != nil {
		raw, err := s.Repo.GetSettingJSON(ctx, "invite_code_required")
		if err == nil && len(raw) > 0 {
			var obj struct {
				Enabled *bool `json:"enabled"`
			}
			if json.Unmarshal(raw, &obj) == nil && obj.Enabled != nil {
				return *obj.Enabled
			}
			var b bool
			if json.Unmarshal(raw, &b) == nil {
				return b
			}
		}
	}
	return s.Config.InviteCodeRequired
}

func (s *Service) SendRegisterCode(ctx context.Context, email, ip string) error {
	clean := NormalizeEmail(email)
	if !IsValidEmail(clean) {
		return svcErr(http.StatusBadRequest, "INVALID_EMAIL", "请输入有效的邮箱地址")
	}
	if err := s.checkLimit(ctx, "auth_reg_code_ip", ip, 10, time.Hour); err != nil {
		return err
	}
	if err := s.checkLimit(ctx, "auth_reg_code_email", clean, 5, time.Hour); err != nil {
		return err
	}
	if maint, msg := s.isSettingEnabled(ctx, "maintenance_mode", false); maint {
		if msg == "" {
			msg = "系统维护中，暂停用户注册"
		}
		return svcErr(http.StatusServiceUnavailable, "MAINTENANCE_MODE", msg)
	}
	if regOn, _ := s.isSettingEnabled(ctx, "registration_enabled", true); !regOn {
		return svcErr(http.StatusForbidden, "REGISTRATION_DISABLED", "新用户注册通道当前已暂停开放")
	}

	if s.Repo != nil {
		if last, err := s.Repo.LastVerificationCodeIssuedAt(ctx, clean, "email_register"); err == nil && last != nil {
			if s.now().Sub(*last) < ResendCooldown {
				return svcErr(http.StatusTooManyRequests, "COOLDOWN_ACTIVE", "验证码发送过于频繁，请 60 秒后再试")
			}
		}
		if existing, err := s.Repo.FindCredentialByAccount(ctx, clean); err == nil && existing != nil {
			// Generic success or conflict? Supdance Pro returns 409 if email already registered on register/send-code
			return svcErr(http.StatusConflict, "EMAIL_ALREADY_EXISTS", "该邮箱已注册，请直接登录")
		}
		code := GenerateNumericOTP(6)
		codeHash := HashVerificationCode(s.codeSecret(), clean, "email_register", code)
		id, _ := ids.NewPrefixedID("evc")
		if err := s.Repo.ReplaceVerificationCode(ctx, id, clean, codeHash, "email_register", s.now().Add(EmailCodeLifetime), ip); err != nil {
			return err
		}
		if err := s.sendCodeOrInvalidate(ctx, id, func() error {
			return s.Sender.SendEmailCode(ctx, clean, code, "email_register")
		}, "EMAIL_DELIVERY_FAILED"); err != nil {
			return err
		}
	}
	return nil
}

type RegisterInput struct {
	Email      string
	Password   string
	Code       string
	InviteCode string
	Locale     string
	IP         string
}

func (s *Service) Register(ctx context.Context, in RegisterInput) (*AuthSessionResult, error) {
	if err := s.checkLimit(ctx, "auth_register_ip", in.IP, 10, time.Hour); err != nil {
		return nil, err
	}
	if maint, msg := s.isSettingEnabled(ctx, "maintenance_mode", false); maint {
		if msg == "" {
			msg = "系统维护中，暂停用户注册"
		}
		return nil, svcErr(http.StatusServiceUnavailable, "MAINTENANCE_MODE", msg)
	}
	if regOn, _ := s.isSettingEnabled(ctx, "registration_enabled", true); !regOn {
		return nil, svcErr(http.StatusForbidden, "REGISTRATION_DISABLED", "新用户注册通道当前已暂停开放")
	}
	if msg := ValidateCredentials(in.Email, in.Password); msg != "" {
		return nil, svcErr(http.StatusBadRequest, "INVALID_CREDENTIALS", msg)
	}
	cleanEmail := NormalizeEmail(in.Email)
	if s.isInviteRequired(ctx) {
		invite := strings.TrimSpace(in.InviteCode)
		if invite == "" {
			return nil, svcErr(http.StatusBadRequest, "INVITE_CODE_REQUIRED", "内测期间需凭邀请码注册，请输入有效的邀请码")
		}
		if s.Repo != nil {
			chk, err := s.Repo.CheckInviteCodeValid(ctx, invite)
			if err != nil {
				return nil, err
			}
			if !chk.Valid {
				return nil, svcErr(http.StatusBadRequest, chk.ErrCode, chk.Reason)
			}
		}
	}
	code := strings.TrimSpace(in.Code)
	if !sixDigitRe.MatchString(code) {
		return nil, svcErr(http.StatusBadRequest, "INVALID_CODE", "请输入6位有效邮箱验证码")
	}
	if s.Repo == nil {
		return nil, svcErr(http.StatusServiceUnavailable, "AUTH_UNAVAILABLE", "注册暂时不可用")
	}
	if err := s.verifyStoredCode(ctx, cleanEmail, "email_register", code); err != nil {
		return nil, err
	}
	hashHex, saltHex, err := HashPassword(in.Password)
	if err != nil {
		return nil, err
	}
	locale := strings.TrimSpace(in.Locale)
	if locale == "" {
		locale = "en"
	}
	user, err := s.Repo.CreateUser(ctx, CreateUserParams{
		Email:              cleanEmail,
		PasswordHash:       hashHex,
		PasswordSalt:       saltHex,
		Locale:             locale,
		RegistrationSource: "web_email",
		IP:                 in.IP,
		EmailVerified:      true,
		InviteCode:         strings.TrimSpace(in.InviteCode),
	})
	if err != nil {
		if errors.Is(err, ErrEmailExists) {
			return nil, svcErr(http.StatusConflict, "EMAIL_ALREADY_EXISTS", "该邮箱已注册")
		}
		if errors.Is(err, ErrInvalidInvite) {
			return nil, svcErr(http.StatusBadRequest, "INVALID_INVITE_CODE", "邀请码无效或已用尽")
		}
		return nil, err
	}

	rawTok := GenerateRandomHex(32)
	tokHash := HashSessionToken(rawTok)
	exp := s.now().Add(SessionTTL)
	ses, err := s.Repo.CreateSession(ctx, user.ID, rawTok, tokHash, exp)
	if err != nil {
		return nil, err
	}
	_ = s.Repo.RecordAuthEvent(ctx, user.ID, "register_email", in.IP, "")
	return &AuthSessionResult{User: user, Session: ses}, nil
}

func (s *Service) verifyStoredCode(ctx context.Context, target, codeType, inputCode string) error {
	rec, err := s.Repo.FindLatestVerificationCode(ctx, target, codeType)
	if err != nil {
		return err
	}
	if rec == nil {
		return svcErr(http.StatusBadRequest, "OTP_MISSING", "请重新获取验证码")
	}
	if rec.UsedAt != nil {
		return svcErr(http.StatusBadRequest, "OTP_USED", "验证码已失效，请重新获取")
	}
	if !rec.ExpiresAt.After(s.now()) {
		return svcErr(http.StatusBadRequest, "OTP_EXPIRED", "验证码已过期，请重新获取")
	}
	if rec.Attempts >= MaxVerifyAttempts {
		return svcErr(http.StatusBadRequest, "OTP_ATTEMPTS_EXCEEDED", "验证码尝试次数过多，请重新获取")
	}
	if !VerifyVerificationCode(s.codeSecret(), target, codeType, inputCode, rec.CodeHash) {
		_ = s.Repo.IncrementVerificationAttempts(ctx, rec.ID)
		return svcErr(http.StatusBadRequest, "OTP_INCORRECT", "验证码错误，请重新输入")
	}
	return s.Repo.MarkVerificationCodeUsed(ctx, rec.ID)
}

func (s *Service) SendPhoneCode(ctx context.Context, phone, countryCode, purpose, ip string) (map[string]any, error) {
	e164, _, ok := NormalizePhoneE164(phone, countryCode)
	if !ok {
		return nil, svcErr(http.StatusBadRequest, "INVALID_PHONE", "请输入有效的手机号")
	}
	if err := s.checkLimit(ctx, "auth_sms_ip", ip, 10, time.Hour); err != nil {
		return nil, err
	}
	if err := s.checkLimit(ctx, "auth_sms_phone", e164, 5, 10*time.Minute); err != nil {
		return nil, err
	}
	if purpose == "" {
		purpose = "phone_login"
	}
	if s.Repo != nil {
		if last, err := s.Repo.LastVerificationCodeIssuedAt(ctx, e164, purpose); err == nil && last != nil {
			if s.now().Sub(*last) < ResendCooldown {
				return nil, svcErr(http.StatusTooManyRequests, "OTP_RATE_LIMITED", "发送过于频繁，请稍后再试")
			}
		}
		code := GenerateNumericOTP(6)
		codeHash := HashVerificationCode(s.codeSecret(), e164, purpose, code)
		id, _ := ids.NewPrefixedID("otp")
		if err := s.Repo.ReplaceVerificationCode(ctx, id, e164, codeHash, purpose, s.now().Add(OTPLifetime), ip); err != nil {
			return nil, err
		}
		if err := s.sendCodeOrInvalidate(ctx, id, func() error {
			return s.Sender.SendSMSCode(ctx, e164, code, purpose)
		}, "SMS_DELIVERY_FAILED"); err != nil {
			return nil, err
		}
	}
	return map[string]any{
		"ok":          true,
		"maskedPhone": MaskPhone(e164),
		"expiresIn":   int(OTPLifetime.Seconds()),
	}, nil
}

func (s *Service) VerifyPhone(ctx context.Context, phone, countryCode, code, purpose, ip, locale string, currentUser *middleware.SessionUser) (*AuthSessionResult, error) {
	e164, cc, ok := NormalizePhoneE164(phone, countryCode)
	if !ok {
		return nil, svcErr(http.StatusBadRequest, "INVALID_PHONE", "请输入有效的手机号")
	}
	cleanCode := strings.TrimSpace(code)
	if !sixDigitRe.MatchString(cleanCode) {
		return nil, svcErr(http.StatusBadRequest, "OTP_INCORRECT", "请输入6位短信验证码")
	}
	if purpose == "" {
		purpose = "phone_login"
	}
	if s.Repo == nil {
		return nil, svcErr(http.StatusServiceUnavailable, "SMS_UNAVAILABLE", "短信服务暂不可用")
	}
	if err := s.verifyStoredCode(ctx, e164, purpose, cleanCode); err != nil {
		return nil, err
	}
	if purpose == "phone_bind" || purpose == "bind" {
		if currentUser == nil {
			return nil, svcErr(http.StatusUnauthorized, "AUTH_REQUIRED", "请先登录后再绑定手机号")
		}
		if err := s.Repo.BindUserPhone(ctx, currentUser.ID, e164, cc); err != nil {
			if errors.Is(err, ErrPhoneBound) {
				return nil, svcErr(http.StatusConflict, "PHONE_ALREADY_BOUND", "该手机号码已绑定其他账户，请先登录该账户再操作")
			}
			return nil, err
		}
		return &AuthSessionResult{User: currentUser}, nil
	}
	if locale == "" {
		locale = "zh-CN"
	}
	user, err := s.Repo.UpsertPhoneUserAndVerify(ctx, e164, cc, ip, locale)
	if err != nil {
		return nil, err
	}
	if user.Status == "suspended" {
		return nil, svcErr(http.StatusForbidden, "ACCOUNT_SUSPENDED", "账号已被停用，请联系客服处理")
	}
	rawTok := GenerateRandomHex(32)
	tokHash := HashSessionToken(rawTok)
	exp := s.now().Add(SessionTTL)
	ses, err := s.Repo.CreateSession(ctx, user.ID, rawTok, tokHash, exp)
	if err != nil {
		return nil, err
	}
	_ = s.Repo.RecordAuthEvent(ctx, user.ID, "login_phone", ip, "")
	return &AuthSessionResult{User: user, Session: ses}, nil
}

func (s *Service) ForgotPasswordEmail(ctx context.Context, email, ip string) error {
	clean := NormalizeEmail(email)
	if !IsValidEmail(clean) {
		return svcErr(http.StatusBadRequest, "INVALID_EMAIL", "请输入有效的邮箱地址")
	}
	if err := s.checkLimit(ctx, "auth_pwd_forgot_ip", ip, 10, 15*time.Minute); err != nil {
		return err
	}
	if err := s.checkLimit(ctx, "auth_pwd_forgot_email", clean, 5, 15*time.Minute); err != nil {
		return err
	}
	if s.Repo == nil {
		return nil
	}
	u, err := s.Repo.FindResetUserByEmail(ctx, clean)
	if err != nil || u == nil || u.Status == "suspended" {
		// Always succeed silently to avoid account enumeration
		return nil
	}
	code := GenerateNumericOTP(6)
	codeHash := HashVerificationCode(s.codeSecret(), clean, "password_reset_email", code)
	id, _ := ids.NewPrefixedID("evc")
	if err := s.Repo.ReplaceVerificationCode(ctx, id, clean, codeHash, "password_reset_email", s.now().Add(EmailCodeLifetime), ip); err != nil {
		return err
	}
	if err := s.sendCodeOrInvalidate(ctx, id, func() error {
		return s.Sender.SendEmailCode(ctx, clean, code, "password_reset_email")
	}, "EMAIL_DELIVERY_FAILED"); err != nil {
		return err
	}
	return nil
}

func (s *Service) ResetPasswordEmail(ctx context.Context, email, code, newPassword, ip string) error {
	if msg := ValidateCredentials(email, newPassword); msg != "" {
		return svcErr(http.StatusBadRequest, "INVALID_CREDENTIALS", msg)
	}
	clean := NormalizeEmail(email)
	cleanCode := strings.TrimSpace(code)
	if !sixDigitRe.MatchString(cleanCode) {
		return svcErr(http.StatusBadRequest, "INVALID_CODE", "请输入6位邮箱验证码")
	}
	if s.Repo == nil {
		return svcErr(http.StatusServiceUnavailable, "AUTH_UNAVAILABLE", "密码重置暂时不可用")
	}
	if err := s.verifyStoredCode(ctx, clean, "password_reset_email", cleanCode); err != nil {
		return err
	}
	u, err := s.Repo.FindResetUserByEmail(ctx, clean)
	if err != nil {
		return err
	}
	if u == nil {
		return svcErr(http.StatusBadRequest, "USER_NOT_FOUND", "账号不存在或状态异常")
	}
	if u.Status == "suspended" {
		return svcErr(http.StatusForbidden, "ACCOUNT_SUSPENDED", "账号已被停用，请联系客服处理")
	}
	hashHex, saltHex, err := HashPassword(newPassword)
	if err != nil {
		return err
	}
	if err := s.Repo.SetUserPassword(ctx, u.ID, hashHex, saltHex); err != nil {
		return err
	}
	_ = s.Repo.RevokeAllUserSessions(ctx, u.ID)
	_ = s.Repo.RecordAuthEvent(ctx, u.ID, "password_reset_email", ip, "")
	return nil
}

func (s *Service) ResetPasswordPhone(ctx context.Context, phone, countryCode, code, newPassword, ip string) error {
	e164, _, ok := NormalizePhoneE164(phone, countryCode)
	if !ok {
		return svcErr(http.StatusBadRequest, "INVALID_PHONE", "请输入有效的手机号")
	}
	if len(newPassword) < 8 || len(newPassword) > 128 {
		return svcErr(http.StatusBadRequest, "INVALID_PASSWORD", "密码长度需在 8 到 128 位之间")
	}
	cleanCode := strings.TrimSpace(code)
	if !sixDigitRe.MatchString(cleanCode) {
		return svcErr(http.StatusBadRequest, "OTP_INCORRECT", "请输入6位短信验证码")
	}
	if s.Repo == nil {
		return svcErr(http.StatusServiceUnavailable, "AUTH_UNAVAILABLE", "密码重置暂时不可用")
	}
	if err := s.verifyStoredCode(ctx, e164, "phone_reset", cleanCode); err != nil {
		return err
	}
	u, err := s.Repo.FindResetUserByPhone(ctx, e164)
	if err != nil {
		return err
	}
	if u == nil {
		return svcErr(http.StatusBadRequest, "USER_NOT_FOUND", "该手机号尚未绑定已验证账号")
	}
	if u.Status == "suspended" {
		return svcErr(http.StatusForbidden, "ACCOUNT_SUSPENDED", "账号已被停用，请联系客服处理")
	}
	hashHex, saltHex, err := HashPassword(newPassword)
	if err != nil {
		return err
	}
	if err := s.Repo.SetUserPassword(ctx, u.ID, hashHex, saltHex); err != nil {
		return err
	}
	_ = s.Repo.RevokeAllUserSessions(ctx, u.ID)
	_ = s.Repo.RecordAuthEvent(ctx, u.ID, "password_reset_phone", ip, "")
	return nil
}

func (s *Service) ForgotUsernameEmail(ctx context.Context, email, ip string) error {
	clean := NormalizeEmail(email)
	if !IsValidEmail(clean) {
		return svcErr(http.StatusBadRequest, "INVALID_EMAIL", "请输入有效的邮箱地址")
	}
	if err := s.checkLimit(ctx, "auth_username_forgot_ip", ip, 10, 15*time.Minute); err != nil {
		return err
	}
	if s.Repo == nil {
		return nil
	}
	u, err := s.Repo.FindResetUserByEmail(ctx, clean)
	if err != nil || u == nil || u.Status == "suspended" {
		return nil
	}
	code := GenerateNumericOTP(6)
	codeHash := HashVerificationCode(s.codeSecret(), clean, "username_recovery_email", code)
	id, _ := ids.NewPrefixedID("evc")
	if err := s.Repo.ReplaceVerificationCode(ctx, id, clean, codeHash, "username_recovery_email", s.now().Add(EmailCodeLifetime), ip); err != nil {
		return err
	}
	if err := s.sendCodeOrInvalidate(ctx, id, func() error {
		return s.Sender.SendEmailCode(ctx, clean, code, "username_recovery_email")
	}, "EMAIL_DELIVERY_FAILED"); err != nil {
		return err
	}
	return nil
}

func (s *Service) RecoverUsernameEmail(ctx context.Context, email, code, ip string) (map[string]any, error) {
	clean := NormalizeEmail(email)
	if !IsValidEmail(clean) {
		return nil, svcErr(http.StatusBadRequest, "INVALID_EMAIL", "请输入有效的邮箱地址")
	}
	cleanCode := strings.TrimSpace(code)
	if !sixDigitRe.MatchString(cleanCode) {
		return nil, svcErr(http.StatusBadRequest, "INVALID_CODE", "请输入6位邮箱验证码")
	}
	if s.Repo == nil {
		return nil, svcErr(http.StatusServiceUnavailable, "AUTH_UNAVAILABLE", "服务暂不可用")
	}
	if err := s.verifyStoredCode(ctx, clean, "username_recovery_email", cleanCode); err != nil {
		return nil, err
	}
	u, err := s.Repo.FindResetUserByEmail(ctx, clean)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, svcErr(http.StatusBadRequest, "USER_NOT_FOUND", "未找到该邮箱关联的账号")
	}
	_ = s.Repo.RecordAuthEvent(ctx, u.ID, "username_recover_email", ip, "")
	return map[string]any{
		"ok":         true,
		"userNumber": u.UserNumber,
		"username":   u.Username,
		"email":      MaskEmail(clean),
	}, nil
}

type SocialProviderOption struct {
	ID         string `json:"id"`
	Label      string `json:"label"`
	Configured bool   `json:"configured"`
	Enabled    bool   `json:"enabled"`
}

func (s *Service) GetSocialOptions(ctx context.Context, regionHeader, queryRegion string) map[string]any {
	region := "international"
	if queryRegion == "mainland_china" || queryRegion == "international" {
		region = queryRegion
	} else if regionHeader == "mainland_china" || regionHeader == "international" {
		region = regionHeader
	}
	var providers []SocialProviderOption
	if region == "mainland_china" {
		providers = []SocialProviderOption{
			{ID: "wechat", Label: "微信登录", Configured: s.isOAuthConfigured(ctx, "wechat"), Enabled: true},
			{ID: "qq", Label: "QQ 登录", Configured: s.isOAuthConfigured(ctx, "qq"), Enabled: true},
			{ID: "douyin", Label: "抖音登录", Configured: s.isOAuthConfigured(ctx, "douyin"), Enabled: true},
			{ID: "bilibili", Label: "哔哩哔哩", Configured: s.isOAuthConfigured(ctx, "bilibili"), Enabled: true},
		}
	} else {
		providers = []SocialProviderOption{
			{ID: "google", Label: "Google", Configured: s.isOAuthConfigured(ctx, "google"), Enabled: true},
			{ID: "github", Label: "GitHub", Configured: s.isOAuthConfigured(ctx, "github"), Enabled: true},
			{ID: "discord", Label: "Discord", Configured: s.isOAuthConfigured(ctx, "discord"), Enabled: true},
			{ID: "tiktok", Label: "TikTok", Configured: s.isOAuthConfigured(ctx, "tiktok"), Enabled: true},
		}
	}
	return map[string]any{
		"region":    region,
		"providers": providers,
		"googleOneTap": map[string]any{
			"enabled":  region == "international" && s.Config.GoogleClientID != "",
			"clientId": s.Config.GoogleClientID,
		},
	}
}

func (s *Service) HandleGoogleOneTap(ctx context.Context, idToken, ip, locale string) (*AuthSessionResult, error) {
	if err := s.checkLimit(ctx, "auth_google_onetap_ip", ip, 20, 15*time.Minute); err != nil {
		return nil, err
	}
	if strings.TrimSpace(idToken) == "" {
		return nil, svcErr(http.StatusBadRequest, "GOOGLE_ID_TOKEN_MISSING", "缺少 Google 登录凭证")
	}
	if s.Config.GoogleClientID == "" {
		return nil, svcErr(http.StatusServiceUnavailable, "GOOGLE_NOT_CONFIGURED", "Google 登录暂未配置")
	}
	fetchKeys := s.GoogleJWKS
	if fetchKeys == nil {
		fetchKeys = fetchGoogleCertsJWKS
	}
	keys, err := fetchKeys(ctx)
	if err != nil {
		return nil, svcErr(http.StatusServiceUnavailable, "GOOGLE_JWKS_UNAVAILABLE", "Google 公钥获取失败")
	}
	claims, err := VerifyGoogleIDTokenWithKeys(idToken, s.Config.GoogleClientID, keys, s.now())
	if err != nil {
		return nil, svcErr(http.StatusUnauthorized, "GOOGLE_TOKEN_INVALID", "Google 登录凭证无效或已过期")
	}
	if s.Repo == nil {
		return nil, svcErr(http.StatusServiceUnavailable, "AUTH_UNAVAILABLE", "登录服务暂不可用")
	}
	if locale == "" {
		locale = "en"
	}
	user, isNew, err := s.Repo.FindOrCreateOAuthUser(ctx, "google", claims.Subject, claims.Email, "", claims.Name, claims.Picture, locale, ip, true)
	if err != nil {
		return nil, err
	}
	rawTok := GenerateRandomHex(32)
	tokHash := HashSessionToken(rawTok)
	exp := s.now().Add(SessionTTL)
	ses, err := s.Repo.CreateSession(ctx, user.ID, rawTok, tokHash, exp)
	if err != nil {
		return nil, err
	}
	_ = s.Repo.RecordAuthEvent(ctx, user.ID, "login_google_one_tap", ip, "")
	return &AuthSessionResult{User: user, Session: ses, IsNew: isNew}, nil
}

func fetchGoogleCertsJWKS(ctx context.Context) ([]JWK, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://www.googleapis.com/oauth2/v3/certs", nil)
	if err != nil {
		return nil, err
	}
	resp, err := (&http.Client{Timeout: 8 * time.Second}).Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("google jwks status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 512*1024))
	if err != nil {
		return nil, err
	}
	var payload struct {
		Keys []JWK `json:"keys"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}
	return payload.Keys, nil
}

func SanitizeReturnTo(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" || !strings.HasPrefix(trimmed, "/") || strings.HasPrefix(trimmed, "//") {
		return "/studio"
	}
	return trimmed
}

func (s *Service) StartOAuth(ctx context.Context, provider, mode, returnTo, returnOrigin string) (*OAuthFlowRecord, string, error) {
	cleanProvider := strings.ToLower(strings.TrimSpace(provider))
	if cleanProvider == "" {
		return nil, "", svcErr(http.StatusBadRequest, "INVALID_PROVIDER", "不支持的登录方式")
	}
	creds, err := s.resolveOAuthCreds(ctx, cleanProvider)
	if err != nil {
		return nil, "", err
	}
	flowID, _ := ids.NewPrefixedID("ofl")
	state := GenerateRandomHex(24)
	verifier := GenerateRandomHex(32)
	flow := OAuthFlowRecord{
		ID:           flowID,
		Provider:     creds.Spec.ID,
		Mode:         firstNonEmptyStr(mode, "login"),
		Status:       "pending",
		State:        state,
		CodeVerifier: verifier,
		ReturnTo:     SanitizeReturnTo(returnTo),
		ReturnOrigin: strings.TrimSpace(returnOrigin),
		ExpiresAt:    s.now().Add(10 * time.Minute),
	}
	if s.Repo != nil {
		if err := s.Repo.CreateOAuthFlow(ctx, flow); err != nil {
			return nil, "", err
		}
	}
	redirectURI := resolveOAuthRedirectURI(creds, creds.Spec.ID, flow.ReturnOrigin, s.Config.PublicAppURL)
	authURL, err := buildOAuthAuthorizeURL(creds, state, verifier, redirectURI)
	if err != nil {
		return nil, "", err
	}
	return &flow, authURL, nil
}

func (s *Service) GetPendingOAuthInfo(ctx context.Context, flowID string) (map[string]any, error) {
	if strings.TrimSpace(flowID) == "" || s.Repo == nil {
		return nil, svcErr(http.StatusUnauthorized, "OAUTH_EXPIRED", "授权已过期，请重新登录")
	}
	flow, err := s.Repo.FindOAuthFlowByID(ctx, flowID)
	if err != nil || flow == nil || !flow.ExpiresAt.After(s.now()) {
		return nil, svcErr(http.StatusUnauthorized, "OAUTH_EXPIRED", "授权已过期，请重新登录")
	}
	return map[string]any{
		"flowId":      flow.ID,
		"provider":    flow.Provider,
		"status":      flow.Status,
		"email":       flow.Email,
		"displayName": flow.DisplayName,
		"avatarUrl":   flow.AvatarURL,
		"returnTo":    flow.ReturnTo,
	}, nil
}

func (s *Service) SendOAuthOnboardingCode(ctx context.Context, flowID, email, ip string) error {
	if strings.TrimSpace(flowID) == "" || s.Repo == nil {
		return svcErr(http.StatusBadRequest, "OAUTH_FLOW_REJECTED", "授权流程已过期，请重新登录")
	}
	flow, err := s.Repo.FindOAuthFlowByID(ctx, flowID)
	if err != nil || flow == nil || !flow.ExpiresAt.After(s.now()) {
		return svcErr(http.StatusBadRequest, "OAUTH_FLOW_REJECTED", "授权流程已过期，请重新登录")
	}
	clean := NormalizeEmail(firstNonEmptyStr(email, flow.Email))
	if !IsValidEmail(clean) {
		return svcErr(http.StatusBadRequest, "INVALID_EMAIL", "请输入有效邮箱")
	}
	if last, err := s.Repo.LastVerificationCodeIssuedAt(ctx, flowID+":"+clean, "oauth_onboarding"); err == nil && last != nil {
		if s.now().Sub(*last) < ResendCooldown {
			return svcErr(http.StatusTooManyRequests, "COOLDOWN_ACTIVE", "请等待 60 秒后再发送")
		}
	}
	code := GenerateNumericOTP(6)
	codeHash := HashVerificationCode(s.codeSecret(), flowID+":"+clean, "oauth_onboarding", code)
	id, _ := ids.NewPrefixedID("evc")
	if err := s.Repo.ReplaceVerificationCode(ctx, id, flowID+":"+clean, codeHash, "oauth_onboarding", s.now().Add(10*time.Minute), ip); err != nil {
		return err
	}
	return s.sendCodeOrInvalidate(ctx, id, func() error {
		return s.Sender.SendEmailCode(ctx, clean, code, "oauth_onboarding")
	}, "EMAIL_DELIVERY_FAILED")
}

func (s *Service) sendCodeOrInvalidate(ctx context.Context, codeID string, fn func() error, defaultCode string) error {
	if s == nil || s.Sender == nil {
		return nil
	}
	if err := fn(); err != nil {
		if s.Repo != nil {
			_ = s.Repo.MarkVerificationCodeUsed(ctx, codeID)
		}
		return svcErr(http.StatusServiceUnavailable, defaultCode, err.Error())
	}
	return nil
}

func (s *Service) CompleteOAuthOnboarding(ctx context.Context, flowID, email, displayName, ip string) (*AuthSessionResult, *OAuthFlowRecord, error) {
	if strings.TrimSpace(flowID) == "" || s.Repo == nil {
		return nil, nil, svcErr(http.StatusBadRequest, "OAUTH_FLOW_REJECTED", "授权已过期，请重新登录")
	}
	flow, err := s.Repo.FindOAuthFlowByID(ctx, flowID)
	if err != nil || flow == nil || !flow.ExpiresAt.After(s.now()) {
		return nil, nil, svcErr(http.StatusBadRequest, "OAUTH_FLOW_REJECTED", "授权已过期，请重新登录")
	}
	targetEmail := NormalizeEmail(firstNonEmptyStr(email, flow.Email))
	if targetEmail != "" && !IsValidEmail(targetEmail) {
		return nil, nil, svcErr(http.StatusBadRequest, "INVALID_EMAIL", "请输入有效的邮箱地址")
	}
	puid := firstNonEmptyStr(flow.ProviderUID, flow.ID)
	user, _, err := s.Repo.FindOrCreateOAuthUser(ctx, flow.Provider, puid, targetEmail, "", firstNonEmptyStr(displayName, flow.DisplayName), flow.AvatarURL, "en", ip, true)
	if err != nil {
		return nil, nil, err
	}
	flow.Status = "completed"
	flow.UserID = user.ID
	flow.Email = targetEmail
	_ = s.Repo.UpdateOAuthFlow(ctx, *flow)

	rawTok := GenerateRandomHex(32)
	tokHash := HashSessionToken(rawTok)
	exp := s.now().Add(SessionTTL)
	ses, err := s.Repo.CreateSession(ctx, user.ID, rawTok, tokHash, exp)
	if err != nil {
		return nil, nil, err
	}
	return &AuthSessionResult{User: user, Session: ses}, flow, nil
}

type OAuthCallbackResult struct {
	Flow      *OAuthFlowRecord
	Session   *AuthSessionResult
	ReturnTo  string
	NeedsBind bool
}

func (s *Service) HandleOAuthCallback(ctx context.Context, provider, code, state, oauthErr, ip string) (*OAuthCallbackResult, error) {
	cleanProvider := strings.ToLower(strings.TrimSpace(provider))
	if strings.TrimSpace(oauthErr) != "" {
		return nil, svcErr(http.StatusBadRequest, "OAUTH_DENIED", "第三方授权已取消或失败")
	}
	if strings.TrimSpace(state) == "" || strings.TrimSpace(code) == "" {
		return nil, svcErr(http.StatusBadRequest, "OAUTH_CALLBACK_INVALID", "缺少授权码或 state 参数")
	}
	if s.Repo == nil {
		return nil, svcErr(http.StatusServiceUnavailable, "AUTH_UNAVAILABLE", "授权服务暂不可用")
	}
	flow, err := s.Repo.FindOAuthFlowByState(ctx, state)
	if err != nil || flow == nil || !flow.ExpiresAt.After(s.now()) {
		return nil, svcErr(http.StatusBadRequest, "OAUTH_STATE_EXPIRED", "授权状态已过期，请重新登录")
	}
	if cleanProvider != "" && !strings.EqualFold(flow.Provider, cleanProvider) {
		return nil, svcErr(http.StatusBadRequest, "OAUTH_PROVIDER_MISMATCH", "授权渠道不匹配")
	}
	creds, err := s.resolveOAuthCreds(ctx, flow.Provider)
	if err != nil {
		return nil, err
	}
	redirectURI := resolveOAuthRedirectURI(creds, flow.Provider, flow.ReturnOrigin, s.Config.PublicAppURL)
	tok, err := s.exchangeOAuthCode(ctx, creds, code, redirectURI, flow.CodeVerifier)
	if err != nil {
		return nil, err
	}
	profile, err := s.fetchOAuthProfile(ctx, creds, tok)
	if err != nil {
		return nil, err
	}
	puid := strings.TrimSpace(profile.ID)
	if puid == "" {
		return nil, svcErr(http.StatusBadGateway, "OAUTH_PROFILE_FAILED", flow.Provider+" 未返回有效用户标识")
	}
	user, _, err := s.Repo.FindOrCreateOAuthUser(
		ctx,
		flow.Provider,
		puid,
		firstNonEmptyStr(profile.Email, flow.Email),
		profile.Username,
		firstNonEmptyStr(profile.DisplayName, flow.DisplayName, flow.Provider+" user"),
		firstNonEmptyStr(profile.AvatarURL, flow.AvatarURL),
		"en",
		ip,
		true,
	)
	if err != nil {
		return nil, err
	}
	flow.Status = "completed"
	flow.ProviderUID = puid
	flow.Email = firstNonEmptyStr(profile.Email, flow.Email)
	flow.DisplayName = firstNonEmptyStr(profile.DisplayName, flow.DisplayName)
	flow.AvatarURL = firstNonEmptyStr(profile.AvatarURL, flow.AvatarURL)
	flow.UserID = user.ID
	_ = s.Repo.UpdateOAuthFlow(ctx, *flow)

	rawTok := GenerateRandomHex(32)
	tokHash := HashSessionToken(rawTok)
	ses, err := s.Repo.CreateSession(ctx, user.ID, rawTok, tokHash, s.now().Add(SessionTTL))
	if err != nil {
		return nil, err
	}
	return &OAuthCallbackResult{
		Flow:     flow,
		Session:  &AuthSessionResult{User: user, Session: ses},
		ReturnTo: SanitizeReturnTo(flow.ReturnTo),
	}, nil
}

func firstNonEmptyStr(vals ...string) string {
	for _, v := range vals {
		if t := strings.TrimSpace(v); t != "" {
			return t
		}
	}
	return ""
}

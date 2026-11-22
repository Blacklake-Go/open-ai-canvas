package handler

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"time"

	"one/backend/internal/domain/auth"
	"one/backend/internal/domain/site"
	"one/backend/internal/middleware"
	"one/backend/internal/pkg/envelope"
)

func (d *Dependencies) authService() *auth.Service {
	if d.Auth != nil {
		return d.Auth
	}
	return &auth.Service{Config: d.Config}
}

func (d *Dependencies) handleSitemapXML(w http.ResponseWriter, r *http.Request) {
	svc := d.Site
	if svc == nil {
		svc = &site.Service{}
	}
	xmlBody := svc.GenerateSitemapXML(r.Context(), time.Now().UTC().Format("2006-01-02"))
	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(xmlBody))
}

func (d *Dependencies) handleAuthLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Identifier string `json:"identifier"`
		Account    string `json:"account"`
		Email      string `json:"email"`
		Username   string `json:"username"`
		Password   string `json:"password"`
	}
	if !decodeJSONBody(w, r, 16*1024, &body) {
		return
	}
	ident := firstNonEmpty(body.Identifier, body.Account, body.Email, body.Username)
	res, err := d.authService().Login(r.Context(), ident, body.Password, clientIP(r))
	if err != nil {
		writeDomainError(w, err, "登录失败，请稍后重试")
		return
	}
	auth.SetSessionCookie(w, res.Session.Token, res.Session.ExpiresAt, r.Host, d.Config.CookieDomain, d.Config.IsProduction)
	if res.User != nil && res.User.Locale != "" {
		auth.SetLocaleCookies(w, res.User.Locale, d.Config.IsProduction)
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{"user": res.User})
}

func (d *Dependencies) handleAuthLogout(w http.ResponseWriter, r *http.Request) {
	if tok := middleware.ExtractSessionToken(r); tok != "" {
		_ = d.authService().Logout(r.Context(), tok)
	}
	auth.ClearSessionCookie(w, r.Host, d.Config.CookieDomain, d.Config.IsProduction)
	envelope.DomainJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (d *Dependencies) handleAuthRefresh(w http.ResponseWriter, r *http.Request) {
	tok := middleware.ExtractSessionToken(r)
	if tok == "" {
		envelope.DomainError(w, http.StatusUnauthorized, "未登录或会话已过期", "UNAUTHORIZED")
		return
	}
	res, err := d.authService().RefreshSession(r.Context(), tok)
	if err != nil {
		auth.ClearSessionCookie(w, r.Host, d.Config.CookieDomain, d.Config.IsProduction)
		writeDomainError(w, err, "会话刷新失败")
		return
	}
	auth.SetSessionCookie(w, res.Session.Token, res.Session.ExpiresAt, r.Host, d.Config.CookieDomain, d.Config.IsProduction)
	envelope.DomainJSON(w, http.StatusOK, map[string]any{
		"user":      res.User,
		"expires":   res.Session.ExpiresAt.UTC().Format(time.RFC3339),
		"expiresAt": res.Session.ExpiresAt,
	})
}

func (d *Dependencies) handleAuthRegisterSendCode(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email string `json:"email"`
	}
	if !decodeJSONBody(w, r, 16*1024, &body) {
		return
	}
	if err := d.authService().SendRegisterCode(r.Context(), body.Email, clientIP(r)); err != nil {
		writeDomainError(w, err, "验证码发送失败，请稍后再试")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{
		"ok":               true,
		"message":          "验证码已发送至邮箱，请在 15 分钟内完成验证",
		"expiresInSeconds": int(auth.EmailCodeLifetime.Seconds()),
	})
}

func (d *Dependencies) handleAuthRegister(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email      string `json:"email"`
		Password   string `json:"password"`
		Code       string `json:"code"`
		InviteCode string `json:"inviteCode"`
		Locale     string `json:"locale"`
	}
	if !decodeJSONBody(w, r, 16*1024, &body) {
		return
	}
	res, err := d.authService().Register(r.Context(), auth.RegisterInput{
		Email:      body.Email,
		Password:   body.Password,
		Code:       body.Code,
		InviteCode: body.InviteCode,
		Locale:     body.Locale,
		IP:         clientIP(r),
	})
	if err != nil {
		writeDomainError(w, err, "注册失败，请稍后重试")
		return
	}
	auth.SetSessionCookie(w, res.Session.Token, res.Session.ExpiresAt, r.Host, d.Config.CookieDomain, d.Config.IsProduction)
	if res.User != nil && res.User.Locale != "" {
		auth.SetLocaleCookies(w, res.User.Locale, d.Config.IsProduction)
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{"user": res.User})
}

func (d *Dependencies) handleAuthSocialOptions(w http.ResponseWriter, r *http.Request) {
	regionHeader := r.Header.Get("CF-IPCountry")
	if regionHeader == "" {
		regionHeader = r.Header.Get("X-Vercel-IP-Country")
	}
	opts := d.authService().GetSocialOptions(r.Context(), regionHeader, r.URL.Query().Get("region"))
	envelope.DomainJSON(w, http.StatusOK, opts)
}

func (d *Dependencies) handleAuthPhoneSendCode(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Phone       string `json:"phone"`
		CountryCode string `json:"countryCode"`
		Purpose     string `json:"purpose"`
	}
	if !decodeJSONBody(w, r, 16*1024, &body) {
		return
	}
	res, err := d.authService().SendPhoneCode(r.Context(), body.Phone, body.CountryCode, body.Purpose, clientIP(r))
	if err != nil {
		writeDomainError(w, err, "短信验证码发送失败")
		return
	}
	envelope.SuccessJSON(w, http.StatusOK, res)
}

func (d *Dependencies) handleAuthPhoneVerify(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Phone       string `json:"phone"`
		CountryCode string `json:"countryCode"`
		Code        string `json:"code"`
		Purpose     string `json:"purpose"`
		Locale      string `json:"locale"`
	}
	if !decodeJSONBody(w, r, 16*1024, &body) {
		return
	}
	currentUser, _ := middleware.UserFromContext(r.Context())
	res, err := d.authService().VerifyPhone(r.Context(), body.Phone, body.CountryCode, body.Code, body.Purpose, clientIP(r), body.Locale, currentUser)
	if err != nil {
		writeDomainError(w, err, "短信验证失败")
		return
	}
	if res.Session != nil {
		auth.SetSessionCookie(w, res.Session.Token, res.Session.ExpiresAt, r.Host, d.Config.CookieDomain, d.Config.IsProduction)
	}
	if res.User != nil && res.User.Locale != "" {
		auth.SetLocaleCookies(w, res.User.Locale, d.Config.IsProduction)
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{
		"user":  res.User,
		"isNew": res.IsNew,
	})
}

func (d *Dependencies) handleAuthPasswordForgotEmail(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email string `json:"email"`
	}
	if !decodeJSONBody(w, r, 16*1024, &body) {
		return
	}
	if err := d.authService().ForgotPasswordEmail(r.Context(), body.Email, clientIP(r)); err != nil {
		writeDomainError(w, err, "请求失败，请稍后重试")
		return
	}
	envelope.SuccessJSON(w, http.StatusOK, map[string]any{
		"message": "如果该邮箱已注册，验证码已发送至邮箱",
	})
}

func (d *Dependencies) handleAuthPasswordResetEmail(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email       string `json:"email"`
		Code        string `json:"code"`
		NewPassword string `json:"newPassword"`
		Password    string `json:"password"`
	}
	if !decodeJSONBody(w, r, 16*1024, &body) {
		return
	}
	pw := firstNonEmpty(body.NewPassword, body.Password)
	if err := d.authService().ResetPasswordEmail(r.Context(), body.Email, body.Code, pw, clientIP(r)); err != nil {
		writeDomainError(w, err, "重置密码失败")
		return
	}
	envelope.SuccessJSON(w, http.StatusOK, map[string]any{"message": "密码已重置，请使用新密码登录"})
}

func (d *Dependencies) handleAuthPasswordResetPhone(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Phone       string `json:"phone"`
		CountryCode string `json:"countryCode"`
		Code        string `json:"code"`
		NewPassword string `json:"newPassword"`
		Password    string `json:"password"`
	}
	if !decodeJSONBody(w, r, 16*1024, &body) {
		return
	}
	pw := firstNonEmpty(body.NewPassword, body.Password)
	if err := d.authService().ResetPasswordPhone(r.Context(), body.Phone, body.CountryCode, body.Code, pw, clientIP(r)); err != nil {
		writeDomainError(w, err, "重置密码失败")
		return
	}
	envelope.SuccessJSON(w, http.StatusOK, map[string]any{"message": "密码已重置，请使用新密码登录"})
}

func (d *Dependencies) handleAuthUsernameForgotEmail(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email string `json:"email"`
	}
	if !decodeJSONBody(w, r, 16*1024, &body) {
		return
	}
	if err := d.authService().ForgotUsernameEmail(r.Context(), body.Email, clientIP(r)); err != nil {
		writeDomainError(w, err, "发送验证码失败")
		return
	}
	envelope.SuccessJSON(w, http.StatusOK, map[string]any{"message": "如果该邮箱已绑定账号，验证码已发送"})
}

func (d *Dependencies) handleAuthUsernameRecoverEmail(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email string `json:"email"`
		Code  string `json:"code"`
	}
	if !decodeJSONBody(w, r, 16*1024, &body) {
		return
	}
	res, err := d.authService().RecoverUsernameEmail(r.Context(), body.Email, body.Code, clientIP(r))
	if err != nil {
		writeDomainError(w, err, "找回账号失败")
		return
	}
	envelope.SuccessJSON(w, http.StatusOK, res)
}

func (d *Dependencies) handleAuthGoogleOneTap(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		envelope.DomainJSON(w, http.StatusOK, map[string]any{
			"enabled":  d.Config.GoogleClientID != "",
			"clientId": d.Config.GoogleClientID,
		})
		return
	}
	var body struct {
		Credential string `json:"credential"`
		IDToken    string `json:"idToken"`
		Locale     string `json:"locale"`
	}
	if !decodeJSONBody(w, r, 32*1024, &body) {
		return
	}
	tok := firstNonEmpty(body.Credential, body.IDToken)
	res, err := d.authService().HandleGoogleOneTap(r.Context(), tok, clientIP(r), body.Locale)
	if err != nil {
		writeDomainError(w, err, "Google 一键登录失败")
		return
	}
	auth.SetSessionCookie(w, res.Session.Token, res.Session.ExpiresAt, r.Host, d.Config.CookieDomain, d.Config.IsProduction)
	if res.User != nil && res.User.Locale != "" {
		auth.SetLocaleCookies(w, res.User.Locale, d.Config.IsProduction)
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{"user": res.User})
}

func (d *Dependencies) handleAuthOAuthStart(w http.ResponseWriter, r *http.Request) {
	provider := r.PathValue("provider")
	if provider == "" {
		provider = "tiktok"
	}
	mode := r.URL.Query().Get("action")
	if mode == "" {
		mode = r.URL.Query().Get("mode")
	}
	returnTo := firstNonEmpty(r.URL.Query().Get("returnTo"), r.URL.Query().Get("redirect"))
	flow, authURL, err := d.authService().StartOAuth(r.Context(), provider, mode, returnTo, requestOrigin(r))
	if err != nil {
		writeDomainError(w, err, "OAuth 初始化失败")
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     auth.OAuthStateCookie,
		Value:    flow.State,
		Path:     "/",
		HttpOnly: true,
		Secure:   d.Config.IsProduction,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   600,
	})
	http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
}

func (d *Dependencies) handleAuthOAuthCallback(w http.ResponseWriter, r *http.Request) {
	provider := r.PathValue("provider")
	if provider == "" {
		if strings.Contains(r.URL.Path, "tiktok") {
			provider = "tiktok"
		} else if strings.Contains(r.URL.Path, "/qq/") {
			provider = "qq"
		}
	}
	if r.Method == http.MethodPost {
		raw, _ := readBodyLimit(r, 64*1024)
		var payload map[string]any
		if json.Unmarshal(raw, &payload) == nil {
			if ev, _ := payload["event"].(string); ev == "verify_webhook" {
				envelope.DomainJSON(w, http.StatusOK, map[string]any{"challenge": payload["challenge"]})
				return
			}
		}
		envelope.DomainJSON(w, http.StatusOK, map[string]any{"ok": true, "provider": provider})
		return
	}
	q := r.URL.Query()
	res, err := d.authService().HandleOAuthCallback(r.Context(), provider, q.Get("code"), q.Get("state"), q.Get("error"), clientIP(r))
	if err != nil {
		if strings.Contains(r.URL.Path, "/api/") && q.Get("format") == "json" {
			writeDomainError(w, err, "OAuth 回调失败")
			return
		}
		target := "/studio?auth_error=" + url.QueryEscape(err.Error())
		http.Redirect(w, r, target, http.StatusTemporaryRedirect)
		return
	}
	if res.Session != nil && res.Session.Session != nil {
		auth.SetSessionCookie(w, res.Session.Session.Token, res.Session.Session.ExpiresAt, r.Host, d.Config.CookieDomain, d.Config.IsProduction)
	}
	returnTo := res.ReturnTo
	if returnTo == "" {
		returnTo = "/studio"
	}
	http.Redirect(w, r, returnTo, http.StatusTemporaryRedirect)
}

func (d *Dependencies) handleAuthOAuthWebhook(w http.ResponseWriter, r *http.Request) {
	provider := r.PathValue("provider")
	if r.Method == http.MethodGet {
		q := r.URL.Query()
		if challenge := firstNonEmpty(q.Get("hub.challenge"), q.Get("challenge"), q.Get("echostr")); challenge != "" {
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(challenge))
			return
		}
		envelope.DomainJSON(w, http.StatusOK, map[string]any{"ok": true, "provider": provider})
		return
	}
	raw, _ := readBodyLimit(r, 64*1024)
	var body map[string]any
	_ = json.Unmarshal(raw, &body)
	if content, ok := body["content"].(map[string]any); ok {
		if ch, ok := content["challenge"]; ok {
			envelope.DomainJSON(w, http.StatusOK, map[string]any{"challenge": ch})
			return
		}
	}
	if ch, ok := body["challenge"]; ok {
		envelope.DomainJSON(w, http.StatusOK, map[string]any{"challenge": ch})
		return
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{
		"code":     0,
		"message":  "success",
		"msg":      "success",
		"ok":       true,
		"provider": provider,
	})
}

func (d *Dependencies) handleAuthOAuthOnboarding(w http.ResponseWriter, r *http.Request) {
	flowID := ""
	if c, err := r.Cookie(auth.OAuthFlowCookieName); err == nil {
		flowID = c.Value
	}
	if flowID == "" {
		flowID = r.URL.Query().Get("flowId")
	}
	if r.Method == http.MethodGet {
		info, err := d.authService().GetPendingOAuthInfo(r.Context(), flowID)
		if err != nil {
			writeDomainError(w, err, "获取授权信息失败")
			return
		}
		envelope.SuccessJSON(w, http.StatusOK, info)
		return
	}
	var body struct {
		Action      string `json:"action"`
		FlowID      string `json:"flowId"`
		Email       string `json:"email"`
		DisplayName string `json:"displayName"`
	}
	if !decodeJSONBody(w, r, 16*1024, &body) {
		return
	}
	if body.FlowID != "" {
		flowID = body.FlowID
	}
	if strings.EqualFold(strings.TrimSpace(body.Action), "send-code") {
		if err := d.authService().SendOAuthOnboardingCode(r.Context(), flowID, body.Email, clientIP(r)); err != nil {
			writeDomainError(w, err, "验证码发送失败")
			return
		}
		envelope.SuccessJSON(w, http.StatusOK, map[string]any{"sent": true})
		return
	}
	res, flow, err := d.authService().CompleteOAuthOnboarding(r.Context(), flowID, body.Email, body.DisplayName, clientIP(r))
	if err != nil {
		writeDomainError(w, err, "完善 OAuth 注册信息失败")
		return
	}
	auth.SetSessionCookie(w, res.Session.Token, res.Session.ExpiresAt, r.Host, d.Config.CookieDomain, d.Config.IsProduction)
	if res.User != nil && res.User.Locale != "" {
		auth.SetLocaleCookies(w, res.User.Locale, d.Config.IsProduction)
	}
	http.SetCookie(w, &http.Cookie{
		Name:     auth.OAuthFlowCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   d.Config.IsProduction,
	})
	returnTo := "/studio"
	if flow != nil && flow.ReturnTo != "" {
		returnTo = flow.ReturnTo
	}
	envelope.SuccessJSON(w, http.StatusOK, map[string]any{
		"user":     res.User,
		"returnTo": returnTo,
	})
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if t := strings.TrimSpace(v); t != "" {
			return t
		}
	}
	return ""
}

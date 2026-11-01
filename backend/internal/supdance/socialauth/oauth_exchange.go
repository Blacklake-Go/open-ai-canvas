package socialauth

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Upstream OAuth endpoints. They are package-level variables so the exchange can
// be exercised against httptest servers without leaving the test process.
var (
	googleTokenURL    = "https://oauth2.googleapis.com/token"
	googleUserInfoURL = "https://openidconnect.googleapis.com/v1/userinfo"
	xTokenURL         = "https://api.x.com/2/oauth2/token"
	xUserInfoURL      = "https://api.x.com/2/users/me"

	oauthUpstreamClient = &http.Client{Timeout: 12 * time.Second}
)

// liveExchangeSupported reports whether a channel redeems its authorization code
// upstream. Channels without a real exchange must fail closed: the previous
// placeholder synthesised a profile straight from the code string, which let
// anyone who first called the public /start endpoint mint accounts and sessions.
func liveExchangeSupported(providerID string) bool {
	switch providerID {
	case ProviderGoogle, ProviderX:
		return true
	default:
		return false
	}
}

// redeemCode exchanges an authorization code for the upstream profile.
func redeemCode(ctx context.Context, providerID string, cfg ProviderConfig, code, verifier, redirectURI string) (*socialProfile, error) {
	switch providerID {
	case ProviderGoogle:
		return redeemGoogle(ctx, cfg, code, redirectURI)
	case ProviderX:
		return redeemX(ctx, cfg, code, verifier, redirectURI)
	default:
		return nil, fmt.Errorf("渠道 %s 尚未接入真实授权码交换，已拒绝登录以避免伪造身份", providerID)
	}
}

func redeemGoogle(ctx context.Context, cfg ProviderConfig, code, redirectURI string) (*socialProfile, error) {
	form := url.Values{
		"code":          {code},
		"client_id":     {cfg.ClientID},
		"client_secret": {cfg.ClientSecret},
		"redirect_uri":  {redirectURI},
		"grant_type":    {"authorization_code"},
	}
	var tokens struct {
		AccessToken string `json:"access_token"`
		Scope       string `json:"scope"`
		Error       string `json:"error"`
		Description string `json:"error_description"`
	}
	if err := postForm(ctx, googleTokenURL, form, nil, &tokens); err != nil {
		return nil, err
	}
	if strings.TrimSpace(tokens.AccessToken) == "" {
		return nil, fmt.Errorf("Google 未签发访问令牌: %s %s", tokens.Error, tokens.Description)
	}

	var info struct {
		Sub     string `json:"sub"`
		Name    string `json:"name"`
		Picture string `json:"picture"`
		Email   string `json:"email"`
	}
	if err := getJSON(ctx, googleUserInfoURL, tokens.AccessToken, &info); err != nil {
		return nil, err
	}
	if strings.TrimSpace(info.Sub) == "" {
		return nil, errors.New("Google 身份接口未返回 sub")
	}

	display := strings.TrimSpace(info.Name)
	if display == "" {
		display = strings.TrimSpace(info.Email)
	}
	if display == "" {
		display = "Google 创作者"
	}
	handle := info.Email
	if handle == "" {
		handle = info.Sub
	}
	return &socialProfile{
		Subject:     "google_sub_" + info.Sub,
		Username:    sanitizeHandle(handle),
		DisplayName: display,
		AvatarURL:   info.Picture,
		Email:       info.Email,
	}, nil
}

func redeemX(ctx context.Context, cfg ProviderConfig, code, verifier, redirectURI string) (*socialProfile, error) {
	form := url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"client_id":     {cfg.ClientID},
		"redirect_uri":  {redirectURI},
		"code_verifier": {verifier},
	}
	basic := base64.StdEncoding.EncodeToString([]byte(cfg.ClientID + ":" + cfg.ClientSecret))
	headers := http.Header{"Authorization": {"Basic " + basic}}

	var tokens struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
		Description string `json:"error_description"`
	}
	if err := postForm(ctx, xTokenURL, form, headers, &tokens); err != nil {
		return nil, err
	}
	if strings.TrimSpace(tokens.AccessToken) == "" {
		return nil, fmt.Errorf("X 未签发访问令牌: %s %s", tokens.Error, tokens.Description)
	}

	var me struct {
		Data struct {
			ID       string `json:"id"`
			Username string `json:"username"`
			Name     string `json:"name"`
		} `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}
	if err := getJSON(ctx, xUserInfoURL, tokens.AccessToken, &me); err != nil {
		return nil, err
	}
	if strings.TrimSpace(me.Data.ID) == "" {
		msg := ""
		for _, e := range me.Errors {
			msg += " " + e.Message
		}
		return nil, fmt.Errorf("X 身份接口未返回用户 ID%s", msg)
	}

	display := strings.TrimSpace(me.Data.Name)
	if display == "" {
		display = me.Data.Username
	}
	if display == "" {
		display = "X 创作者"
	}
	return &socialProfile{
		Subject:     "x_sub_" + me.Data.ID,
		Username:    sanitizeHandle(me.Data.Username),
		DisplayName: display,
		AvatarURL:   "",
	}, nil
}

// sanitizeHandle turns an upstream login/email into a short account handle.
func sanitizeHandle(raw string) string {
	if at := strings.IndexAny(raw, "@"); at > 0 {
		raw = raw[:at]
	}
	var b strings.Builder
	for _, r := range strings.ToLower(raw) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9', r == '_', r == '-':
			b.WriteRune(r)
		}
	}
	out := b.String()
	if len(out) > 24 {
		out = out[:24]
	}
	if out == "" {
		return "social_user"
	}
	return out
}

func postForm(ctx context.Context, endpoint string, form url.Values, headers http.Header, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	for k, v := range headers {
		for _, item := range v {
			req.Header.Set(k, item)
		}
	}
	resp, err := oauthUpstreamClient.Do(req)
	if err != nil {
		return fmt.Errorf("无法连接 %s：%w", endpoint, err)
	}
	defer resp.Body.Close()
	return decodeUpstream(resp, out)
}

func getJSON(ctx context.Context, endpoint, accessToken string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	resp, err := oauthUpstreamClient.Do(req)
	if err != nil {
		return fmt.Errorf("无法连接 %s：%w", endpoint, err)
	}
	defer resp.Body.Close()
	return decodeUpstream(resp, out)
}

func decodeUpstream(resp *http.Response, out any) error {
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("上游返回 HTTP %d：%s", resp.StatusCode, truncateForError(string(body)))
	}
	if err := json.Unmarshal(body, out); err != nil {
		return fmt.Errorf("解析上游响应失败：%w", err)
	}
	return nil
}

func truncateForError(s string) string {
	s = strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(s, "\n", " "), "\t", " "))
	if len(s) > 160 {
		return s[:160] + "…"
	}
	return s
}

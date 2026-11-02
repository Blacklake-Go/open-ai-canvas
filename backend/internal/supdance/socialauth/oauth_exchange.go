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

	// QQ Connect 三段链：授权码换令牌 → 令牌换 openid → openid 换昵称头像。
	// 前两个响应都不是标准 JSON（query-string 与 JSONP），解析见 qqAccessToken / stripJSONP。
	qqTokenURL    = "https://graph.qq.com/oauth2.0/token"
	qqOpenIDURL   = "https://graph.qq.com/oauth2.0/me"
	qqUserInfoURL = "https://graph.qq.com/user/get_user_info"

	// Douyin Login Kit v2：两个响应都是 {"data":{…,"error_code":n,"description":"…"},"message":…} 信封。
	douyinTokenURL    = "https://open.douyin.com/oauth/v2/access_token"
	douyinUserInfoURL = "https://open.douyin.com/oauth/v2/userinfo"

	oauthUpstreamClient = &http.Client{Timeout: 12 * time.Second}
)

// liveExchangeSupported reports whether a channel redeems its authorization code
// upstream. Channels without a real exchange must fail closed: the previous
// placeholder synthesised a profile straight from the code string, which let
// anyone who first called the public /start endpoint mint accounts and sessions.
//
// 哔哩哔哩刻意仍未接入：从生产出口实测，公开文档里能找到的四个令牌端点
// （member.bilibili.com/x/account-oauth2/v1/token、app.bilibili.com/x/oauth2/token、
// api.bilibili.com/x/passport-login/oauth2/access_token、passport.bilibili.com/api/v2/oauth2/token）
// GET/POST 一律 404，其第三方 OAuth 需应用审核通过后另行下发可用域名；
// 在没有可验证端点之前继续 fail-closed，比照抄一份猜测地址更负责。
func liveExchangeSupported(providerID string) bool {
	switch providerID {
	case ProviderGoogle, ProviderX, ProviderQQ, ProviderDouyin:
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
	case ProviderQQ:
		return redeemQQ(ctx, cfg, code, redirectURI)
	case ProviderDouyin:
		return redeemDouyin(ctx, cfg, code)
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

// redeemQQ walks the three QQ Connect steps. Every step has to answer: a channel
// whose upstream says no must fail the login, never fall back to a synthesised
// profile.
func redeemQQ(ctx context.Context, cfg ProviderConfig, code, redirectURI string) (*socialProfile, error) {
	form := url.Values{
		"grant_type":    {"authorization_code"},
		"client_id":     {cfg.ClientID},
		"client_secret": {cfg.ClientSecret},
		"code":          {code},
		"redirect_uri":  {redirectURI},
	}
	status, body, err := upstreamFetch(ctx, http.MethodPost, qqTokenURL, form, nil)
	if err != nil {
		return nil, err
	}
	accessToken, err := qqAccessToken(status, body)
	if err != nil {
		return nil, err
	}

	openIDURL := qqOpenIDURL + "?access_token=" + url.QueryEscape(accessToken)
	status, body, err = upstreamFetch(ctx, http.MethodGet, openIDURL, nil, nil)
	if err != nil {
		return nil, err
	}
	var me struct {
		OpenID           string `json:"openid"`
		ClientID         string `json:"client_id"`
		Error            any    `json:"error"`
		ErrorDescription string `json:"error_description"`
	}
	if err := decodeUpstream(status, stripJSONP(body), &me); err != nil {
		return nil, err
	}
	if strings.TrimSpace(me.OpenID) == "" {
		return nil, fmt.Errorf("QQ 未返回 openid：%v %s", me.Error, me.ErrorDescription)
	}

	infoURL := qqUserInfoURL + "?access_token=" + url.QueryEscape(accessToken) +
		"&oauth_consumer_key=" + url.QueryEscape(cfg.ClientID) +
		"&openid=" + url.QueryEscape(me.OpenID) + "&format=json"
	status, body, err = upstreamFetch(ctx, http.MethodGet, infoURL, nil, nil)
	if err != nil {
		return nil, err
	}
	var info struct {
		Ret          int    `json:"ret"`
		Msg          string `json:"msg"`
		Nickname     string `json:"nickname"`
		FigureurlQQ2 string `json:"figureurl_qq_2"`
		FigureurlQQ1 string `json:"figureurl_qq_1"`
		Figureurl1   string `json:"figureurl_1"`
	}
	if err := decodeUpstream(status, stripJSONP(body), &info); err != nil {
		return nil, err
	}
	if info.Ret != 0 {
		return nil, fmt.Errorf("QQ 用户信息接口拒绝：ret=%d %s", info.Ret, truncateForError(info.Msg))
	}
	return &socialProfile{
		Subject:     "qq_openid_" + me.OpenID,
		Username:    sanitizeHandle(me.OpenID),
		DisplayName: firstNonEmpty(info.Nickname, "QQ 创作者"),
		AvatarURL:   firstNonEmpty(info.FigureurlQQ2, info.FigureurlQQ1, info.Figureurl1),
	}, nil
}

// qqAccessToken accepts both shapes of this endpoint: a successful
// `access_token=…&expires_in=…` query string, and a (JSONP-wrapped) error document.
func qqAccessToken(status int, body string) (string, error) {
	trimmed := strings.TrimSpace(body)
	if strings.HasPrefix(trimmed, "{") || strings.HasPrefix(trimmed, "callback") {
		var doc struct {
			AccessToken      string `json:"access_token"`
			Error            any    `json:"error"`
			ErrorDescription string `json:"error_description"`
			Msg              string `json:"msg"`
		}
		if err := decodeUpstream(status, stripJSONP(trimmed), &doc); err != nil {
			return "", err
		}
		if strings.TrimSpace(doc.AccessToken) == "" {
			return "", fmt.Errorf("QQ 未签发访问令牌：%v %s %s", doc.Error, doc.ErrorDescription, doc.Msg)
		}
		return strings.TrimSpace(doc.AccessToken), nil
	}
	values, err := url.ParseQuery(trimmed)
	if err != nil {
		return "", fmt.Errorf("无法解析 QQ 令牌响应：%s", truncateForError(trimmed))
	}
	accessToken := strings.TrimSpace(values.Get("access_token"))
	if accessToken == "" {
		return "", fmt.Errorf("QQ 未签发访问令牌：%s %s", values.Get("error"), values.Get("error_description"))
	}
	return accessToken, nil
}

// redeemDouyin exchanges a Login Kit v2 code and reads the profile back. Douyin
// takes its parameters from the query string (verified against the live endpoint)
// and reports business failures inside an HTTP 200 reply, so error_code is checked
// even when the status code looks friendly.
func redeemDouyin(ctx context.Context, cfg ProviderConfig, code string) (*socialProfile, error) {
	form := url.Values{
		"client_key":    {cfg.ClientID},
		"client_secret": {cfg.ClientSecret},
		"code":          {code},
		"grant_type":    {"authorization_code"},
	}
	endpoint := douyinTokenURL + "?" + form.Encode()
	var tokenReply struct {
		Data struct {
			AccessToken string `json:"access_token"`
			OpenID      string `json:"open_id"`
			Scope       string `json:"scope"`
			ErrorCode   int    `json:"error_code"`
			Description string `json:"description"`
		} `json:"data"`
		Message string `json:"message"`
	}
	if err := postForm(ctx, endpoint, form, nil, &tokenReply); err != nil {
		return nil, err
	}
	accessToken := strings.TrimSpace(tokenReply.Data.AccessToken)
	openID := strings.TrimSpace(tokenReply.Data.OpenID)
	if accessToken == "" || openID == "" || tokenReply.Data.ErrorCode != 0 {
		return nil, fmt.Errorf("抖音未签发访问令牌：error_code=%d %s %s",
			tokenReply.Data.ErrorCode, truncateForError(tokenReply.Data.Description), truncateForError(tokenReply.Message))
	}

	infoURL := douyinUserInfoURL + "?access_token=" + url.QueryEscape(accessToken) +
		"&open_id=" + url.QueryEscape(openID)
	status, body, err := upstreamFetch(ctx, http.MethodGet, infoURL, nil, nil)
	if err != nil {
		return nil, err
	}
	var infoReply struct {
		Data struct {
			ErrorCode   int    `json:"error_code"`
			Description string `json:"description"`
			OpenID      string `json:"open_id"`
			Nickname    string `json:"nickname"`
			Avatar      string `json:"avatar"`
		} `json:"data"`
		Message string `json:"message"`
	}
	if err := decodeUpstream(status, body, &infoReply); err != nil {
		return nil, err
	}
	upstreamOpenID := firstNonEmpty(infoReply.Data.OpenID, openID)
	if infoReply.Data.ErrorCode != 0 || upstreamOpenID == "" {
		return nil, fmt.Errorf("抖音用户信息接口拒绝：error_code=%d %s",
			infoReply.Data.ErrorCode, truncateForError(infoReply.Data.Description))
	}
	return &socialProfile{
		Subject:     "douyin_openid_" + upstreamOpenID,
		Username:    sanitizeHandle(upstreamOpenID),
		DisplayName: firstNonEmpty(infoReply.Data.Nickname, "抖音创作者"),
		AvatarURL:   infoReply.Data.Avatar,
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
	status, body, err := upstreamFetch(ctx, http.MethodPost, endpoint, form, headers)
	if err != nil {
		return err
	}
	return decodeUpstream(status, body, out)
}

func getJSON(ctx context.Context, endpoint, accessToken string, out any) error {
	headers := http.Header{"Authorization": {"Bearer " + accessToken}}
	status, body, err := upstreamFetch(ctx, http.MethodGet, endpoint, nil, headers)
	if err != nil {
		return err
	}
	return decodeUpstream(status, body, out)
}

// upstreamFetch performs a single upstream call and returns the raw reply so a
// provider-specific parser can handle query-string and JSONP bodies. Only a
// transport failure is an error here: HTTP 4xx/5xx is an answer the caller has to
// read, because QQ and Douyin both explain a rejected code inside the body.
func upstreamFetch(ctx context.Context, method, endpoint string, form url.Values, headers http.Header) (int, string, error) {
	var payload io.Reader
	if form != nil {
		payload = strings.NewReader(form.Encode())
	}
	req, err := http.NewRequestWithContext(ctx, method, endpoint, payload)
	if err != nil {
		return 0, "", err
	}
	if payload != nil {
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	}
	for k, v := range headers {
		for _, item := range v {
			req.Header.Set(k, item)
		}
	}
	resp, err := oauthUpstreamClient.Do(req)
	if err != nil {
		return 0, "", fmt.Errorf("无法连接 %s：%w", endpoint, err)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return resp.StatusCode, "", err
	}
	return resp.StatusCode, string(raw), nil
}

func decodeUpstream(status int, body string, out any) error {
	if status < 200 || status >= 300 {
		return fmt.Errorf("上游返回 HTTP %d：%s", status, truncateForError(body))
	}
	if err := json.Unmarshal([]byte(body), out); err != nil {
		return fmt.Errorf("解析上游响应失败：%w（%s）", err, truncateForError(body))
	}
	return nil
}

// stripJSONP unwraps QQ Connect's `callback( {…} );` envelope. The endpoint wraps
// errors the same way it wraps results, so the payload has to be unwrapped before
// it can be inspected.
func stripJSONP(body string) string {
	s := strings.TrimSpace(body)
	open := strings.Index(s, "(")
	if open < 0 || !strings.EqualFold(strings.TrimSpace(s[:open]), "callback") {
		return s
	}
	end := strings.LastIndex(s, ")")
	if end <= open {
		return s
	}
	return strings.TrimRight(s[open+1:end], "; \t\r\n")
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func truncateForError(s string) string {
	s = strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(s, "\n", " "), "\t", " "))
	if len(s) > 160 {
		return s[:160] + "…"
	}
	return s
}

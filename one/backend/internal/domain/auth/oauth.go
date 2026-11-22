package auth

import (
	"context"
	"crypto/hmac"
	"crypto/md5"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"sort"
	"strings"
	"time"

	"one/backend/internal/outbound"
	"one/backend/internal/pkg/ids"
	"one/backend/internal/pkg/seckey"
)

type OAuthProviderSpec struct {
	ID                      string
	CredentialProviders     []string
	ClientIDKeys            []string
	ClientSecretKeys        []string
	RedirectURIKeys         []string
	EnvClientID             []string
	EnvClientSecret         []string
	EnvRedirectURI          string
	AuthorizeURL            string
	TokenURL                string
	OpenIDURL               string
	UserInfoURL             string
	Scopes                  []string
	ScopeDelimiter          string
	PKCE                    bool
	ClientIDParam           string
	SecretParam             string
	TokenTransport          string // form | get-query | bilibili-query-post
	TokenBasicAuth          bool
	TokenIncludeRedirectURI bool
	TokenExtraParams        map[string]string
	AuthorizeExtraParams    map[string]string
	AuthorizeFragment       string
	ProfileTransport        string // bearer | qq-jsonp | wechat-query | douyin-post | instagram | bilibili-signed
}

type OAuthProfile struct {
	ID            string
	Email         string
	EmailVerified bool
	Username      string
	DisplayName   string
	AvatarURL     string
}

type resolvedOAuthCreds struct {
	Spec         OAuthProviderSpec
	ClientID     string
	ClientSecret string
	RedirectURI  string
}

var oauthSpecs = map[string]OAuthProviderSpec{
	"google": {
		ID:                  "google",
		CredentialProviders: []string{"google"},
		ClientIDKeys:        []string{"client_id"},
		ClientSecretKeys:    []string{"client_secret"},
		EnvClientID:         []string{"GOOGLE_CLIENT_ID", "NEXT_PUBLIC_GOOGLE_CLIENT_ID"},
		EnvClientSecret:     []string{"GOOGLE_CLIENT_SECRET"},
		AuthorizeURL:        "https://accounts.google.com/o/oauth2/v2/auth",
		TokenURL:            "https://oauth2.googleapis.com/token",
		UserInfoURL:         "https://openidconnect.googleapis.com/v1/userinfo",
		Scopes:              []string{"openid", "email", "profile"},
		PKCE:                true,
		AuthorizeExtraParams: map[string]string{
			"prompt": "select_account",
		},
		ClientIDParam:    "client_id",
		SecretParam:      "client_secret",
		TokenTransport:   "form",
		ProfileTransport: "bearer",
	},
	"github": {
		ID:                  "github",
		CredentialProviders: []string{"github"},
		ClientIDKeys:        []string{"client_id"},
		ClientSecretKeys:    []string{"client_secret"},
		EnvClientID:         []string{"GITHUB_CLIENT_ID"},
		EnvClientSecret:     []string{"GITHUB_CLIENT_SECRET"},
		AuthorizeURL:        "https://github.com/login/oauth/authorize",
		TokenURL:            "https://github.com/login/oauth/access_token",
		UserInfoURL:         "https://api.github.com/user",
		Scopes:              []string{"read:user", "user:email"},
		ClientIDParam:       "client_id",
		SecretParam:         "client_secret",
		TokenTransport:      "form",
		ProfileTransport:    "bearer",
	},
	"x": {
		ID:                  "x",
		CredentialProviders: []string{"x"},
		ClientIDKeys:        []string{"client_id"},
		ClientSecretKeys:    []string{"client_secret"},
		EnvClientID:         []string{"X_CLIENT_ID"},
		EnvClientSecret:     []string{"X_CLIENT_SECRET"},
		AuthorizeURL:        "https://x.com/i/oauth2/authorize",
		TokenURL:            "https://api.x.com/2/oauth2/token",
		UserInfoURL:         "https://api.x.com/2/users/me?user.fields=profile_image_url",
		Scopes:              []string{"users.read"},
		PKCE:                true,
		ClientIDParam:       "client_id",
		SecretParam:         "client_secret",
		TokenTransport:      "form",
		TokenBasicAuth:      true,
		ProfileTransport:    "bearer",
	},
	"tiktok": {
		ID:                  "tiktok",
		CredentialProviders: []string{"tiktok"},
		ClientIDKeys:        []string{"client_key", "client_id"},
		ClientSecretKeys:    []string{"client_secret"},
		EnvClientID:         []string{"TIKTOK_CLIENT_KEY"},
		EnvClientSecret:     []string{"TIKTOK_CLIENT_SECRET"},
		AuthorizeURL:        "https://www.tiktok.com/v2/auth/authorize/",
		TokenURL:            "https://open.tiktokapis.com/v2/oauth/token/",
		UserInfoURL:         "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,display_name,avatar_url",
		Scopes:              []string{"user.info.basic"},
		PKCE:                true,
		ClientIDParam:       "client_key",
		SecretParam:         "client_secret",
		TokenTransport:      "form",
		ProfileTransport:    "bearer",
	},
	"instagram": {
		ID:                  "instagram",
		CredentialProviders: []string{"instagram", "facebook"},
		ClientIDKeys:        []string{"client_id", "app_id"},
		ClientSecretKeys:    []string{"client_secret", "app_secret"},
		EnvClientID:         []string{"INSTAGRAM_CLIENT_ID", "INSTAGRAM_APP_ID"},
		EnvClientSecret:     []string{"INSTAGRAM_CLIENT_SECRET", "INSTAGRAM_APP_SECRET"},
		AuthorizeURL:        "https://www.instagram.com/oauth/authorize",
		TokenURL:            "https://api.instagram.com/oauth/access_token",
		UserInfoURL:         "https://graph.instagram.com/me?fields=user_id,username",
		Scopes:              []string{"instagram_business_basic"},
		AuthorizeExtraParams: map[string]string{
			"enable_fb_login": "0",
		},
		ClientIDParam:    "client_id",
		SecretParam:      "client_secret",
		TokenTransport:   "form",
		ProfileTransport: "instagram",
	},
	"wechat": {
		ID:                  "wechat",
		CredentialProviders: []string{"wechat_oauth", "wechat"},
		ClientIDKeys:        []string{"app_id", "client_id"},
		ClientSecretKeys:    []string{"app_secret", "client_secret"},
		EnvClientID:         []string{"WECHAT_OAUTH_APP_ID", "WECHAT_APP_ID"},
		EnvClientSecret:     []string{"WECHAT_OAUTH_APP_SECRET", "WECHAT_SECRET"},
		AuthorizeURL:        "https://open.weixin.qq.com/connect/qrconnect",
		TokenURL:            "https://api.weixin.qq.com/sns/oauth2/access_token",
		UserInfoURL:         "https://api.weixin.qq.com/sns/userinfo",
		Scopes:              []string{"snsapi_login"},
		ClientIDParam:       "appid",
		SecretParam:         "secret",
		TokenTransport:      "get-query",
		AuthorizeFragment:   "#wechat_redirect",
		ProfileTransport:    "wechat-query",
	},
	"qq": {
		ID:                      "qq",
		CredentialProviders:     []string{"qq"},
		ClientIDKeys:            []string{"app_id", "client_id"},
		ClientSecretKeys:        []string{"app_key", "client_secret"},
		RedirectURIKeys:         []string{"redirect_uri", "callback_url"},
		EnvClientID:             []string{"QQ_APP_ID"},
		EnvClientSecret:         []string{"QQ_APP_KEY"},
		EnvRedirectURI:          "QQ_REDIRECT_URI",
		AuthorizeURL:            "https://graph.qq.com/oauth2.0/authorize",
		TokenURL:                "https://graph.qq.com/oauth2.0/token",
		OpenIDURL:               "https://graph.qq.com/oauth2.0/me",
		UserInfoURL:             "https://graph.qq.com/user/get_user_info",
		Scopes:                  []string{"get_user_info"},
		ClientIDParam:           "client_id",
		SecretParam:             "client_secret",
		TokenTransport:          "get-query",
		TokenIncludeRedirectURI: true,
		TokenExtraParams:        map[string]string{"fmt": "json"},
		ProfileTransport:        "qq-jsonp",
	},
	"bilibili": {
		ID:                  "bilibili",
		CredentialProviders: []string{"bilibili"},
		ClientIDKeys:        []string{"client_id"},
		ClientSecretKeys:    []string{"client_secret"},
		EnvClientID:         []string{"BILIBILI_CLIENT_ID"},
		EnvClientSecret:     []string{"BILIBILI_CLIENT_SECRET"},
		AuthorizeURL:        "https://account.bilibili.com/pc/account-pc/auth/oauth",
		TokenURL:            "https://api.bilibili.com/x/account-oauth2/v1/token",
		UserInfoURL:         "https://member.bilibili.com/arcopen/fn/user/account/info",
		Scopes:              []string{"USER_INFO"},
		ClientIDParam:       "client_id",
		SecretParam:         "client_secret",
		TokenTransport:      "bilibili-query-post",
		ProfileTransport:    "bilibili-signed",
	},
	"douyin": {
		ID:                  "douyin",
		CredentialProviders: []string{"douyin"},
		ClientIDKeys:        []string{"client_key", "app_id"},
		ClientSecretKeys:    []string{"client_secret", "app_secret"},
		RedirectURIKeys:     []string{"redirect_uri", "callback_url"},
		EnvClientID:         []string{"DOUYIN_CLIENT_KEY", "DOUYIN_APP_ID"},
		EnvClientSecret:     []string{"DOUYIN_CLIENT_SECRET", "DOUYIN_APP_SECRET"},
		EnvRedirectURI:      "DOUYIN_REDIRECT_URI",
		AuthorizeURL:        "https://open.douyin.com/platform/oauth/connect",
		TokenURL:            "https://open.douyin.com/oauth/access_token/",
		UserInfoURL:         "https://open.douyin.com/oauth/userinfo/",
		Scopes:              []string{"user_info"},
		ScopeDelimiter:      ",",
		ClientIDParam:       "client_key",
		SecretParam:         "client_secret",
		TokenTransport:      "form",
		ProfileTransport:    "douyin-post",
	},
	"discord": {
		ID:                  "discord",
		CredentialProviders: []string{"discord"},
		ClientIDKeys:        []string{"client_id"},
		ClientSecretKeys:    []string{"client_secret"},
		EnvClientID:         []string{"DISCORD_CLIENT_ID"},
		EnvClientSecret:     []string{"DISCORD_CLIENT_SECRET"},
		AuthorizeURL:        "https://discord.com/api/oauth2/authorize",
		TokenURL:            "https://discord.com/api/oauth2/token",
		UserInfoURL:         "https://discord.com/api/users/@me",
		Scopes:              []string{"identify", "email"},
		ClientIDParam:       "client_id",
		SecretParam:         "client_secret",
		TokenTransport:      "form",
		ProfileTransport:    "bearer",
	},
}

func (s *Service) oauthClient() *http.Client {
	if s != nil && s.OAuthHTTP != nil {
		return s.OAuthHTTP
	}
	var allowed []string
	if s != nil {
		allowed = s.Config.AllowedPrivateHosts
	}
	return outbound.NewSafeHTTPClient(10*time.Second, allowed...)
}

func (s *Service) lookupOAuthSpec(provider string) (OAuthProviderSpec, bool) {
	clean := strings.ToLower(strings.TrimSpace(provider))
	if clean == "wechat_oauth" {
		clean = "wechat"
	}
	if s != nil && s.OAuthProviders != nil {
		if ov, ok := s.OAuthProviders[clean]; ok {
			return ov, true
		}
	}
	spec, ok := oauthSpecs[clean]
	return spec, ok
}

func (s *Service) readOAuthSecret(ctx context.Context, providers, keys []string) string {
	for _, p := range providers {
		for _, k := range keys {
			if s != nil && s.OAuthSecretFn != nil {
				if v := strings.TrimSpace(s.OAuthSecretFn(ctx, p, k)); v != "" {
					return v
				}
			}
			if s != nil {
				if pgRepo, ok := s.Repo.(*PGRepository); ok && pgRepo != nil && pgRepo.Pool != nil {
					if v, err := seckey.ReadProviderSecret(ctx, pgRepo.Pool.QueryRow, s.Config.ProviderSecretKey(), p, k); err == nil && strings.TrimSpace(v) != "" {
						return strings.TrimSpace(v)
					}
				}
			}
		}
	}
	return ""
}

func (s *Service) resolveOAuthCreds(ctx context.Context, provider string) (*resolvedOAuthCreds, error) {
	spec, ok := s.lookupOAuthSpec(provider)
	if !ok {
		return nil, svcErr(http.StatusBadRequest, "INVALID_PROVIDER", "不支持的登录方式")
	}
	clientID := s.readOAuthSecret(ctx, spec.CredentialProviders, spec.ClientIDKeys)
	if clientID == "" {
		for _, envKey := range spec.EnvClientID {
			if v := strings.TrimSpace(os.Getenv(envKey)); v != "" {
				clientID = v
				break
			}
		}
	}
	if clientID == "" && spec.ID == "google" {
		clientID = strings.TrimSpace(s.Config.GoogleClientID)
	}

	clientSecret := s.readOAuthSecret(ctx, spec.CredentialProviders, spec.ClientSecretKeys)
	if clientSecret == "" {
		for _, envKey := range spec.EnvClientSecret {
			if v := strings.TrimSpace(os.Getenv(envKey)); v != "" {
				clientSecret = v
				break
			}
		}
	}

	redirectURI := s.readOAuthSecret(ctx, spec.CredentialProviders, spec.RedirectURIKeys)
	if redirectURI == "" && spec.EnvRedirectURI != "" {
		redirectURI = strings.TrimSpace(os.Getenv(spec.EnvRedirectURI))
	}
	if clientID == "" || clientSecret == "" {
		return nil, svcErr(http.StatusServiceUnavailable, "OAUTH_NOT_CONFIGURED", spec.ID+" OAuth 登录尚未配置")
	}
	return &resolvedOAuthCreds{
		Spec:         spec,
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURI:  redirectURI,
	}, nil
}

func (s *Service) isOAuthConfigured(ctx context.Context, provider string) bool {
	creds, err := s.resolveOAuthCreds(ctx, provider)
	return err == nil && creds != nil && creds.ClientID != "" && creds.ClientSecret != ""
}

func resolveOAuthRedirectURI(creds *resolvedOAuthCreds, provider, returnOrigin, publicAppURL string) string {
	if creds != nil && creds.RedirectURI != "" {
		return creds.RedirectURI
	}
	base := strings.TrimRight(firstNonEmptyStr(returnOrigin, publicAppURL, "https://www.supdance.com"), "/")
	return fmt.Sprintf("%s/api/auth/oauth/%s/callback", base, provider)
}

func buildOAuthAuthorizeURL(creds *resolvedOAuthCreds, state, verifier, redirectURI string) (string, error) {
	u, err := url.Parse(creds.Spec.AuthorizeURL)
	if err != nil {
		return "", err
	}
	q := u.Query()
	idParam := firstNonEmptyStr(creds.Spec.ClientIDParam, "client_id")
	q.Set(idParam, creds.ClientID)
	q.Set("redirect_uri", redirectURI)
	q.Set("response_type", "code")
	q.Set("state", state)
	if len(creds.Spec.Scopes) > 0 {
		delim := firstNonEmptyStr(creds.Spec.ScopeDelimiter, " ")
		q.Set("scope", strings.Join(creds.Spec.Scopes, delim))
	}
	for k, v := range creds.Spec.AuthorizeExtraParams {
		q.Set(k, v)
	}
	if creds.Spec.PKCE && verifier != "" {
		sum := sha256.Sum256([]byte(verifier))
		q.Set("code_challenge", base64.RawURLEncoding.EncodeToString(sum[:]))
		q.Set("code_challenge_method", "S256")
	}
	u.RawQuery = q.Encode()
	return u.String() + creds.Spec.AuthorizeFragment, nil
}

type oauthTokenResponse struct {
	AccessToken string
	OpenID      string
	OpenIDAlt   string
	UserID      string
	Raw         map[string]any
}

func (s *Service) exchangeOAuthCode(ctx context.Context, creds *resolvedOAuthCreds, code, redirectURI, verifier string) (*oauthTokenResponse, error) {
	spec := creds.Spec
	idParam := firstNonEmptyStr(spec.ClientIDParam, "client_id")
	secretParam := firstNonEmptyStr(spec.SecretParam, "client_secret")
	cleanCode := strings.TrimSpace(strings.SplitN(code, "#", 2)[0])

	var req *http.Request
	var err error
	switch spec.TokenTransport {
	case "bilibili-query-post":
		u, uerr := url.Parse(spec.TokenURL)
		if uerr != nil {
			return nil, uerr
		}
		q := u.Query()
		q.Set("client_id", creds.ClientID)
		q.Set("client_secret", creds.ClientSecret)
		q.Set("grant_type", "authorization_code")
		q.Set("code", cleanCode)
		u.RawQuery = q.Encode()
		req, err = http.NewRequestWithContext(ctx, http.MethodPost, u.String(), nil)

	case "get-query":
		u, uerr := url.Parse(spec.TokenURL)
		if uerr != nil {
			return nil, uerr
		}
		q := u.Query()
		q.Set(idParam, creds.ClientID)
		q.Set(secretParam, creds.ClientSecret)
		q.Set("code", cleanCode)
		q.Set("grant_type", "authorization_code")
		if spec.TokenIncludeRedirectURI {
			q.Set("redirect_uri", redirectURI)
		}
		for k, v := range spec.TokenExtraParams {
			q.Set(k, v)
		}
		u.RawQuery = q.Encode()
		req, err = http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)

	default:
		form := url.Values{}
		form.Set("code", cleanCode)
		form.Set("grant_type", "authorization_code")
		form.Set("redirect_uri", redirectURI)
		form.Set(idParam, creds.ClientID)
		form.Set(secretParam, creds.ClientSecret)
		for k, v := range spec.TokenExtraParams {
			form.Set(k, v)
		}
		if spec.PKCE && verifier != "" {
			form.Set("code_verifier", verifier)
		}
		if spec.TokenBasicAuth {
			form.Del(idParam)
			form.Del(secretParam)
		}
		req, err = http.NewRequestWithContext(ctx, http.MethodPost, spec.TokenURL, strings.NewReader(form.Encode()))
		if err == nil {
			req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
			req.Header.Set("Accept", "application/json")
			if spec.TokenBasicAuth {
				rawCred := base64.StdEncoding.EncodeToString([]byte(creds.ClientID + ":" + creds.ClientSecret))
				req.Header.Set("Authorization", "Basic "+rawCred)
			}
		}
	}
	if err != nil {
		return nil, err
	}

	resp, err := s.oauthClient().Do(req)
	if err != nil {
		return nil, svcErr(http.StatusBadGateway, "OAUTH_TOKEN_FAILED", spec.ID+" token 请求失败: "+err.Error())
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 512*1024))

	data := parseOAuthTokenBody(body)
	if resp.StatusCode >= 400 || data == nil {
		msg := firstMapStr(data, "error_description", "error", "errmsg", "message")
		return nil, svcErr(http.StatusBadGateway, "OAUTH_TOKEN_FAILED", firstNonEmptyStr(msg, "OAuth token exchange failed"))
	}
	token := firstNonEmptyStr(strMap(data, "access_token"), nestedStr(data, "data", "access_token"))
	if token == "" {
		msg := firstMapStr(data, "errmsg", "error_description", "error", "message")
		if msg == "" {
			msg = nestedStr(data, "data", "description")
		}
		return nil, svcErr(http.StatusBadGateway, "OAUTH_TOKEN_FAILED", firstNonEmptyStr(msg, spec.ID+" 未返回 access_token"))
	}
	return &oauthTokenResponse{
		AccessToken: token,
		OpenID:      firstNonEmptyStr(strMap(data, "openid"), nestedStr(data, "data", "openid")),
		OpenIDAlt:   firstNonEmptyStr(strMap(data, "open_id"), nestedStr(data, "data", "open_id")),
		UserID:      firstNonEmptyStr(strMap(data, "user_id"), nestedStr(data, "data", "user_id")),
		Raw:         data,
	}, nil
}

func (s *Service) fetchOAuthProfile(ctx context.Context, creds *resolvedOAuthCreds, tok *oauthTokenResponse) (*OAuthProfile, error) {
	spec := creds.Spec
	switch spec.ProfileTransport {
	case "qq-jsonp":
		openID := tok.OpenID
		if openID == "" {
			var err error
			openID, err = s.fetchQQOpenID(ctx, spec.OpenIDURL, tok.AccessToken)
			if err != nil {
				return nil, err
			}
		}
		u, err := url.Parse(spec.UserInfoURL)
		if err != nil {
			return nil, err
		}
		q := u.Query()
		q.Set("access_token", tok.AccessToken)
		q.Set("oauth_consumer_key", creds.ClientID)
		q.Set("openid", openID)
		u.RawQuery = q.Encode()
		data, err := s.doOAuthJSONGet(ctx, u.String(), map[string]string{"User-Agent": "supdance-oauth"})
		if err != nil {
			return nil, err
		}
		if ret, has := numMap(data, "ret"); has && ret != 0 {
			return nil, svcErr(http.StatusBadGateway, "OAUTH_PROFILE_FAILED", firstNonEmptyStr(strMap(data, "msg"), "QQ 用户信息获取失败"))
		}
		avatar := strings.Replace(firstNonEmptyStr(strMap(data, "figureurl_qq_2"), strMap(data, "figureurl_qq_1"), strMap(data, "figureurl")), "http://", "https://", 1)
		return &OAuthProfile{
			ID:          openID,
			Username:    strMap(data, "nickname"),
			DisplayName: firstNonEmptyStr(strMap(data, "nickname"), "QQ用户"),
			AvatarURL:   avatar,
		}, nil

	case "wechat-query":
		if tok.OpenID == "" {
			return nil, svcErr(http.StatusBadGateway, "OAUTH_PROFILE_FAILED", "微信授权响应缺少 openid")
		}
		u, err := url.Parse(spec.UserInfoURL)
		if err != nil {
			return nil, err
		}
		q := u.Query()
		q.Set("access_token", tok.AccessToken)
		q.Set("openid", tok.OpenID)
		q.Set("lang", "zh_CN")
		u.RawQuery = q.Encode()
		data, err := s.doOAuthJSONGet(ctx, u.String(), nil)
		if err != nil {
			return nil, err
		}
		if ec, has := numMap(data, "errcode"); has && ec != 0 {
			return nil, svcErr(http.StatusBadGateway, "OAUTH_PROFILE_FAILED", firstNonEmptyStr(strMap(data, "errmsg"), "微信用户信息获取失败"))
		}
		return &OAuthProfile{
			ID:          firstNonEmptyStr(strMap(data, "unionid"), strMap(data, "openid"), tok.OpenID),
			Username:    strMap(data, "nickname"),
			DisplayName: firstNonEmptyStr(strMap(data, "nickname"), "微信用户"),
			AvatarURL:   strings.Replace(strMap(data, "headimgurl"), "http://", "https://", 1),
		}, nil

	case "douyin-post":
		openID := firstNonEmptyStr(tok.OpenIDAlt, tok.OpenID)
		if openID == "" {
			return nil, svcErr(http.StatusBadGateway, "OAUTH_PROFILE_FAILED", "抖音授权响应缺少 open_id")
		}
		payload, _ := json.Marshal(map[string]string{"access_token": tok.AccessToken, "open_id": openID})
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, spec.UserInfoURL, strings.NewReader(string(payload)))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("access-token", tok.AccessToken)
		resp, err := s.oauthClient().Do(req)
		if err != nil {
			return &OAuthProfile{ID: openID, DisplayName: "抖音用户"}, nil
		}
		defer resp.Body.Close()
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 512*1024))
		var data map[string]any
		if json.Unmarshal(raw, &data) != nil || resp.StatusCode >= 400 {
			return &OAuthProfile{ID: openID, DisplayName: "抖音用户"}, nil
		}
		prof, _ := data["data"].(map[string]any)
		if prof == nil {
			prof = data
		}
		return &OAuthProfile{
			ID:          firstNonEmptyStr(strMap(prof, "union_id"), strMap(prof, "open_id"), openID),
			Email:       strMap(prof, "email"),
			Username:    strMap(prof, "nickname"),
			DisplayName: firstNonEmptyStr(strMap(prof, "nickname"), "抖音用户"),
			AvatarURL:   firstNonEmptyStr(strMap(prof, "avatar_larger"), strMap(prof, "avatar"), strMap(prof, "avatar_url")),
		}, nil

	case "instagram":
		u, err := url.Parse(spec.UserInfoURL)
		if err != nil {
			return nil, err
		}
		q := u.Query()
		q.Set("access_token", tok.AccessToken)
		u.RawQuery = q.Encode()
		data, err := s.doOAuthJSONGet(ctx, u.String(), nil)
		if err != nil {
			if tok.UserID != "" {
				return &OAuthProfile{ID: tok.UserID, DisplayName: "Instagram User"}, nil
			}
			return nil, err
		}
		id := firstNonEmptyStr(strMap(data, "user_id"), strMap(data, "id"), tok.UserID)
		uname := strMap(data, "username")
		return &OAuthProfile{
			ID:          id,
			Username:    uname,
			DisplayName: firstNonEmptyStr(uname, "Instagram User"),
		}, nil

	case "bilibili-signed":
		nonce, _ := ids.NewPrefixedID("bili")
		md5Sum := md5.Sum(nil)
		signedHeaders := map[string]string{
			"x-bili-accesskeyid":       creds.ClientID,
			"x-bili-content-md5":       hex.EncodeToString(md5Sum[:]),
			"x-bili-signature-method":  "HMAC-SHA256",
			"x-bili-signature-nonce":   nonce,
			"x-bili-signature-version": "2.0",
			"x-bili-timestamp":         fmt.Sprintf("%d", time.Now().Unix()),
		}
		keys := make([]string, 0, len(signedHeaders))
		for k := range signedHeaders {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		var lines []string
		for _, k := range keys {
			lines = append(lines, k+":"+signedHeaders[k])
		}
		mac := hmac.New(sha256.New, []byte(creds.ClientSecret))
		mac.Write([]byte(strings.Join(lines, "\n")))
		signedHeaders["Authorization"] = hex.EncodeToString(mac.Sum(nil))
		signedHeaders["access-token"] = tok.AccessToken
		data, err := s.doOAuthJSONGet(ctx, spec.UserInfoURL, signedHeaders)
		if err != nil {
			return nil, err
		}
		if code, has := numMap(data, "code"); has && code != 0 {
			return nil, svcErr(http.StatusBadGateway, "OAUTH_PROFILE_FAILED", firstNonEmptyStr(strMap(data, "message"), "Bilibili 用户信息获取失败"))
		}
		prof, _ := data["data"].(map[string]any)
		return &OAuthProfile{
			ID:          strMap(prof, "openid"),
			Username:    strMap(prof, "name"),
			DisplayName: strMap(prof, "name"),
			AvatarURL:   strMap(prof, "face"),
		}, nil

	default:
		data, err := s.doOAuthJSONGet(ctx, spec.UserInfoURL, map[string]string{
			"Authorization": "Bearer " + tok.AccessToken,
			"User-Agent":    "supdance-oauth",
		})
		if err != nil {
			return nil, err
		}
		return normalizeBearerProfile(spec.ID, data)
	}
}

func (s *Service) fetchQQOpenID(ctx context.Context, openIDURL, accessToken string) (string, error) {
	u, err := url.Parse(openIDURL)
	if err != nil {
		return "", err
	}
	q := u.Query()
	q.Set("access_token", accessToken)
	q.Set("fmt", "json")
	u.RawQuery = q.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "supdance-oauth")
	resp, err := s.oauthClient().Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 256*1024))
	reJSON := regexp.MustCompile(`\{[\s\S]*\}`)
	m := reJSON.Find(body)
	if m == nil {
		return "", svcErr(http.StatusBadGateway, "OAUTH_PROFILE_FAILED", "QQ 返回了无法解析的 openid 响应")
	}
	var obj map[string]any
	if json.Unmarshal(m, &obj) != nil {
		return "", svcErr(http.StatusBadGateway, "OAUTH_PROFILE_FAILED", "QQ openid JSON 解析失败")
	}
	openID := strMap(obj, "openid")
	if openID == "" {
		return "", svcErr(http.StatusBadGateway, "OAUTH_PROFILE_FAILED", firstNonEmptyStr(strMap(obj, "error_description"), "QQ 未返回 openid"))
	}
	return openID, nil
}

func (s *Service) doOAuthJSONGet(ctx context.Context, targetURL string, headers map[string]string) (map[string]any, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := s.oauthClient().Do(req)
	if err != nil {
		return nil, svcErr(http.StatusBadGateway, "OAUTH_PROFILE_FAILED", err.Error())
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 512*1024))
	var out map[string]any
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, svcErr(http.StatusBadGateway, "OAUTH_PROFILE_FAILED", "OAuth profile 响应解析失败")
	}
	if resp.StatusCode >= 400 {
		msg := firstMapStr(out, "error_description", "message", "error", "errmsg")
		return nil, svcErr(http.StatusBadGateway, "OAUTH_PROFILE_FAILED", firstNonEmptyStr(msg, "OAuth profile request failed"))
	}
	return out, nil
}

func normalizeBearerProfile(provider string, data map[string]any) (*OAuthProfile, error) {
	p := &OAuthProfile{}
	if rootData, ok := data["data"].(map[string]any); ok {
		if nestedUser, ok2 := rootData["user"].(map[string]any); ok2 {
			data = nestedUser
		} else {
			data = rootData
		}
	}
	p.ID = firstNonEmptyStr(strMap(data, "sub"), strMap(data, "open_id"), strMap(data, "id"), numAsStr(data["id"]))
	if p.ID == "" {
		return nil, svcErr(http.StatusBadGateway, "OAUTH_PROFILE_FAILED", provider+" 未返回用户标识")
	}
	p.Email = NormalizeEmail(strMap(data, "email"))
	if ev, ok := data["email_verified"].(bool); ok {
		p.EmailVerified = ev
	}
	p.Username = firstNonEmptyStr(strMap(data, "username"), strMap(data, "login"), strMap(data, "preferred_username"))
	p.DisplayName = firstNonEmptyStr(strMap(data, "name"), strMap(data, "display_name"), p.Username, provider+" user")
	p.AvatarURL = firstNonEmptyStr(strMap(data, "picture"), strMap(data, "avatar_url"), strMap(data, "profile_image_url"))
	return p, nil
}

func parseOAuthTokenBody(body []byte) map[string]any {
	var out map[string]any
	if json.Unmarshal(body, &out) == nil && out != nil {
		return out
	}
	vals, err := url.ParseQuery(string(body))
	if err != nil {
		return nil
	}
	out = make(map[string]any, len(vals))
	for k, v := range vals {
		if len(v) > 0 {
			out[k] = v[0]
		}
	}
	return out
}

func strMap(m map[string]any, k string) string {
	if m == nil {
		return ""
	}
	if s, ok := m[k].(string); ok {
		return strings.TrimSpace(s)
	}
	return ""
}

func nestedStr(m map[string]any, k1, k2 string) string {
	if m == nil {
		return ""
	}
	if sub, ok := m[k1].(map[string]any); ok {
		return strMap(sub, k2)
	}
	return ""
}

func firstMapStr(m map[string]any, keys ...string) string {
	for _, k := range keys {
		if v := strMap(m, k); v != "" {
			return v
		}
	}
	return ""
}

func numMap(m map[string]any, k string) (float64, bool) {
	if m == nil {
		return 0, false
	}
	if f, ok := m[k].(float64); ok {
		return f, true
	}
	return 0, false
}

func numAsStr(v any) string {
	switch x := v.(type) {
	case float64:
		return fmt.Sprintf("%.0f", x)
	case int64:
		return fmt.Sprintf("%d", x)
	case int:
		return fmt.Sprintf("%d", x)
	default:
		return ""
	}
}

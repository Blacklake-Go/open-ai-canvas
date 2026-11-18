package socialauth

import (
	"context"
	"errors"
	"net/url"
	"strings"
)

const tikTokBasicScope = "user.info.basic"

var (
	tikTokTokenURL    = "https://open.tiktokapis.com/v2/oauth/token/"
	tikTokUserInfoURL = "https://open.tiktokapis.com/v2/user/info/"
)

func redeemTikTok(ctx context.Context, cfg ProviderConfig, code, redirectURI string) (*socialProfile, error) {
	form := url.Values{
		"client_key":    {cfg.ClientID},
		"client_secret": {cfg.ClientSecret},
		"code":          {code},
		"grant_type":    {"authorization_code"},
		"redirect_uri":  {redirectURI},
	}
	var token struct {
		AccessToken string `json:"access_token"`
		OpenID      string `json:"open_id"`
		Scope       string `json:"scope"`
		Error       string `json:"error"`
	}
	if err := postForm(ctx, tikTokTokenURL, form, nil, &token); err != nil {
		return nil, err
	}
	if token.Error != "" || strings.TrimSpace(token.AccessToken) == "" || strings.TrimSpace(token.OpenID) == "" {
		return nil, errors.New("TikTok 未签发有效的登录令牌")
	}
	if strings.TrimSpace(token.Scope) != tikTokBasicScope {
		return nil, errors.New("TikTok 登录授权范围与基础资料权限不符")
	}

	endpoint := tikTokUserInfoURL + "?" + url.Values{"fields": {"open_id,display_name,avatar_url"}}.Encode()
	var profile struct {
		Data struct {
			User struct {
				OpenID      string `json:"open_id"`
				DisplayName string `json:"display_name"`
				AvatarURL   string `json:"avatar_url"`
			} `json:"user"`
		} `json:"data"`
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := getJSON(ctx, endpoint, token.AccessToken, &profile); err != nil {
		return nil, err
	}
	user := profile.Data.User
	if profile.Error.Code != "ok" || user.OpenID != token.OpenID {
		return nil, errors.New("TikTok 用户资料与授权身份不符")
	}

	// Open IDs belong to a client. Keep sandbox and production identities separate.
	return &socialProfile{
		Subject:     "tiktok:" + HashToken(HashToken(cfg.ClientID)+":"+user.OpenID),
		Username:    sanitizeHandle(user.DisplayName),
		DisplayName: firstNonEmpty(user.DisplayName, "TikTok"),
		AvatarURL:   user.AvatarURL,
	}, nil
}

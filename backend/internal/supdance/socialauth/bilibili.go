package socialauth

import (
	"context"
	"crypto/hmac"
	"crypto/md5"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

var (
	bilibiliTokenURL    = "https://api.bilibili.com/x/account-oauth2/v1/token"
	bilibiliUserInfoURL = "https://member.bilibili.com/arcopen/fn/user/account/info"
)

// The official token contract requires URL parameters on an empty POST.
// Never log this URL: it contains the application secret and authorization code.
func redeemBilibili(ctx context.Context, cfg ProviderConfig, code string) (*socialProfile, error) {
	query := url.Values{"client_id": {cfg.ClientID}, "client_secret": {cfg.ClientSecret}, "grant_type": {"authorization_code"}, "code": {code}}
	status, body, err := upstreamFetch(ctx, http.MethodPost, bilibiliTokenURL+"?"+query.Encode(), url.Values{}, nil)
	if err != nil {
		return nil, err
	}
	var tokens struct {
		Code *int `json:"code"`
		Data struct {
			AccessToken string   `json:"access_token"`
			Scopes      []string `json:"scopes"`
		} `json:"data"`
	}
	if err := decodeUpstream(status, body, &tokens); err != nil {
		return nil, err
	}
	if tokens.Code == nil || *tokens.Code != 0 || strings.TrimSpace(tokens.Data.AccessToken) == "" {
		return nil, errors.New("Bilibili 授权码交换失败，请核对应用凭据和授权状态")
	}
	allowed := false
	for _, scope := range tokens.Data.Scopes {
		if scope == "USER_INFO" {
			allowed = true
		}
	}
	if !allowed {
		return nil, errors.New("Bilibili 应用尚未获得 USER_INFO 权限或用户未授权该权限")
	}
	headers := bilibiliHeaders(cfg, tokens.Data.AccessToken, RandomToken(), time.Now())
	status, body, err = upstreamFetch(ctx, http.MethodGet, bilibiliUserInfoURL, nil, headers)
	if err != nil {
		return nil, err
	}
	var info struct {
		Code *int `json:"code"`
		Data struct {
			OpenID string `json:"openid"`
			Name   string `json:"name"`
		} `json:"data"`
	}
	if err := decodeUpstream(status, body, &info); err != nil {
		return nil, err
	}
	id := strings.TrimSpace(info.Data.OpenID)
	if info.Code == nil || *info.Code != 0 || id == "" || len(id) > 128 {
		return nil, errors.New("Bilibili 用户信息校验失败，未取得有效身份")
	}
	name := strings.TrimSpace(info.Data.Name)
	if name == "" {
		name = "Bilibili 创作者"
	}
	// Bilibili prohibits hotlinking its face URL. Keep the native avatar fallback
	// until the host provides an authenticated, bounded avatar cache.
	return &socialProfile{Subject: "bilibili_openid_" + id, Username: name, DisplayName: name}, nil
}

func bilibiliHeaders(cfg ProviderConfig, token, nonce string, now time.Time) http.Header {
	emptyMD5 := md5.Sum(nil)
	stamp := strconv.FormatInt(now.Unix(), 10)
	canonical := fmt.Sprintf("x-bili-accesskeyid:%s\nx-bili-content-md5:%s\nx-bili-signature-method:HMAC-SHA256\nx-bili-signature-nonce:%s\nx-bili-signature-version:2.0\nx-bili-timestamp:%s", cfg.ClientID, hex.EncodeToString(emptyMD5[:]), nonce, stamp)
	mac := hmac.New(sha256.New, []byte(cfg.ClientSecret))
	_, _ = mac.Write([]byte(canonical))
	return http.Header{
		"Accept": {"application/json"}, "Content-Type": {"application/json"},
		"Access-Token": {token}, "X-Bili-Accesskeyid": {cfg.ClientID},
		"X-Bili-Content-Md5":      {hex.EncodeToString(emptyMD5[:])},
		"X-Bili-Signature-Method": {"HMAC-SHA256"}, "X-Bili-Signature-Nonce": {nonce},
		"X-Bili-Signature-Version": {"2.0"}, "X-Bili-Timestamp": {stamp},
		"Authorization": {hex.EncodeToString(mac.Sum(nil))},
	}
}

package socialauth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"
)

func useBilibiliStub(t *testing.T, tokenReply, infoReply string) *int {
	t.Helper()
	hits := new(int)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/token" {
			q := r.URL.Query()
			if r.Method != http.MethodPost || q.Get("client_id") != "bili-client" || q.Get("client_secret") != "bili-secret" || !strings.HasPrefix(q.Get("code"), "provider-code") || q.Get("grant_type") != "authorization_code" {
				t.Error("token request does not match official query-parameter POST contract")
			}
			if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/x-www-form-urlencoded") {
				t.Error("wrong token request content type")
			}
			fmt.Fprint(w, tokenReply)
			return
		}
		*hits++
		if r.Method != http.MethodGet || r.URL.RawQuery != "" || r.Header.Get("Access-Token") != "test-access-token" {
			t.Error("user info request does not match official contract")
		}
		stamp := r.Header.Get("X-Bili-Timestamp")
		seconds, _ := strconv.ParseInt(stamp, 10, 64)
		if time.Since(time.Unix(seconds, 0)).Abs() > time.Minute || r.Header.Get("X-Bili-Signature-Nonce") == "" {
			t.Error("missing nonce or current timestamp")
		}
		canonical := "x-bili-accesskeyid:bili-client\nx-bili-content-md5:d41d8cd98f00b204e9800998ecf8427e\nx-bili-signature-method:HMAC-SHA256\nx-bili-signature-nonce:" + r.Header.Get("X-Bili-Signature-Nonce") + "\nx-bili-signature-version:2.0\nx-bili-timestamp:" + stamp
		mac := hmac.New(sha256.New, []byte("bili-secret"))
		mac.Write([]byte(canonical))
		if r.Header.Get("Authorization") != hex.EncodeToString(mac.Sum(nil)) {
			t.Error("invalid Bilibili HMAC signature")
		}
		fmt.Fprint(w, infoReply)
	}))
	oldToken, oldInfo := bilibiliTokenURL, bilibiliUserInfoURL
	bilibiliTokenURL, bilibiliUserInfoURL = server.URL+"/token", server.URL+"/info"
	t.Cleanup(func() { bilibiliTokenURL, bilibiliUserInfoURL = oldToken, oldInfo; server.Close() })
	return hits
}

const biliTokenFixture = `{"code":0,"data":{"access_token":"test-access-token","scopes":["USER_INFO"]}}`
const biliInfoFixture = `{"code":0,"data":{"openid":"stable-openid","name":"Bili Creator","face":"https://i0.hdslb.com/avatar.png"}}`

func TestBilibiliSignedCodeExchangeAndOnboarding(t *testing.T) {
	repo, svc := newSecurityTestService(t)
	seedChannel(t, svc, ProviderBilibili, "bili-client", "bili-secret", false)
	hits := useBilibiliStub(t, biliTokenFixture, biliInfoFixture)
	result, err := completeBoundTestAuth(t, svc, cnRequest("/callback"), ProviderBilibili, mintState(t, repo, ProviderBilibili), "provider-code", "")
	if err != nil {
		t.Fatal(err)
	}
	if result.User == nil || *hits != 1 {
		t.Fatal("verified Bilibili identity did not complete onboarding")
	}
	identity, err := repo.UserIdentity(ProviderBilibili, "bilibili_openid_stable-openid")
	if err != nil || identity.UserID != result.User.ID {
		t.Fatalf("wrong identity: %v", err)
	}
	if identity.AvatarURL != "" {
		t.Fatal("Bilibili face URL must not be hotlinked")
	}
}

func TestBilibiliRejectsProviderErrorsMissingScopesAndMissingIdentity(t *testing.T) {
	for _, tc := range []struct{ token, info string }{
		{`{"code":122001,"data":{"access_token":"test-access-token","scopes":["USER_INFO"]}}`, biliInfoFixture},
		{`{"code":0,"data":{"access_token":"test-access-token","scopes":[]}}`, biliInfoFixture},
		{biliTokenFixture, `{"code":0,"data":{"name":"No Identity"}}`},
		{biliTokenFixture, `{"code":127007,"data":{"openid":"must-not-trust"}}`},
	} {
		t.Run(strconv.Itoa(len(tc.token))+tc.info, func(t *testing.T) {
			useBilibiliStub(t, tc.token, tc.info)
			if _, err := redeemBilibili(context.Background(), ProviderConfig{ClientID: "bili-client", ClientSecret: "bili-secret"}, "provider-code"); err == nil {
				t.Fatal("unverified Bilibili identity accepted")
			}
		})
	}
}

func TestBilibiliCurrentAuthorizationURLAndManualEnable(t *testing.T) {
	_, svc := newSecurityTestService(t)
	view, err := svc.UpdateAdminSettings(cnRequest("/settings"), nil, UpdateSettingsRequest{Providers: map[string]UpdateProviderInput{ProviderBilibili: {ClientID: "bili-client", ClientSecret: "bili-secret", Enabled: true}}})
	if err != nil || view.Providers[ProviderBilibili].Enabled {
		t.Fatalf("first credential save enabled Bilibili automatically: %v", err)
	}
	_, err = svc.UpdateAdminSettings(cnRequest("/settings"), nil, UpdateSettingsRequest{Providers: map[string]UpdateProviderInput{ProviderBilibili: {Enabled: true}}})
	if err != nil {
		t.Fatal(err)
	}
	target, err := svc.BeginAuth(cnRequest("/start"), ProviderBilibili, "/create", true)
	if err != nil {
		t.Fatal(err)
	}
	u, _ := url.Parse(target)
	if u.Host != "account.bilibili.com" || u.Path != "/pc/account-pc/auth/oauth" || u.Query().Get("gourl") != "https://www.supdance.com/api/auth/oauth/bilibili/callback" || u.Query().Get("state") == "" {
		t.Fatal("obsolete Bilibili authorization URL")
	}
}

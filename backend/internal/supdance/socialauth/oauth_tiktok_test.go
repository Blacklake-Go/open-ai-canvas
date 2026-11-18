package socialauth

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

const tikTokTestCallback = "https://www.supdance.com/api/auth/social/tiktok/callback"

func TestTikTokWebAuthorizationURL(t *testing.T) {
	cfg := ProviderConfig{ClientID: "sandbox-client", Scopes: []string{"video.publish"}}
	endpoint, err := url.Parse(buildAuthorizeURL(ProviderTikTok, cfg, tikTokTestCallback, "oauth-state", "unused"))
	if err != nil {
		t.Fatal(err)
	}
	want := url.Values{
		"client_key": {"sandbox-client"}, "response_type": {"code"},
		"scope": {"user.info.basic"}, "redirect_uri": {tikTokTestCallback}, "state": {"oauth-state"},
	}
	if endpoint.Scheme != "https" || endpoint.Host != "www.tiktok.com" ||
		endpoint.Path != "/v2/auth/authorize/" || endpoint.Query().Encode() != want.Encode() {
		t.Fatalf("unexpected TikTok Login Kit URL: %s", endpoint)
	}
}

func TestTikTokWebCodeExchange(t *testing.T) {
	for _, tc := range []struct {
		name, scope, profileID, profileCode string
	}{
		{"basic profile", "user.info.basic", "open-id", "ok"},
		{"missing scope", "", "open-id", "ok"},
		{"expanded scope", "user.info.basic,video.publish", "open-id", "ok"},
		{"wrong profile", "user.info.basic", "different-id", "ok"},
		{"profile rejected", "user.info.basic", "open-id", "scope_not_authorized"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				switch r.URL.Path {
				case "/token":
					if err := r.ParseForm(); err != nil {
						t.Error(err)
					}
					want := url.Values{
						"client_key": {"sandbox-client"}, "client_secret": {"fixture-secret"},
						"code": {"authorization-code"}, "redirect_uri": {tikTokTestCallback},
						"grant_type": {"authorization_code"},
					}
					if r.Method != http.MethodPost || r.PostForm.Encode() != want.Encode() {
						t.Error("unexpected TikTok token request")
					}
					fmt.Fprintf(w, `{"access_token":"fixture-token","open_id":"open-id","scope":%q}`, tc.scope)
				case "/info":
					if tc.scope != tikTokBasicScope || r.Method != http.MethodGet ||
						r.Header.Get("Authorization") != "Bearer fixture-token" ||
						r.URL.Query().Get("fields") != "open_id,display_name,avatar_url" {
						t.Error("unexpected TikTok profile request")
					}
					fmt.Fprintf(w, `{"data":{"user":{"open_id":%q,"display_name":"Sandbox Creator","avatar_url":"https://example.com/avatar.png"}},"error":{"code":%q}}`, tc.profileID, tc.profileCode)
				default:
					http.NotFound(w, r)
				}
			}))
			t.Cleanup(server.Close)
			oldTokenURL, oldUserInfoURL := tikTokTokenURL, tikTokUserInfoURL
			t.Cleanup(func() { tikTokTokenURL, tikTokUserInfoURL = oldTokenURL, oldUserInfoURL })
			tikTokTokenURL, tikTokUserInfoURL = server.URL+"/token", server.URL+"/info"

			cfg := ProviderConfig{ClientID: "sandbox-client", ClientSecret: "fixture-secret"}
			profile, err := redeemCode(context.Background(), ProviderTikTok, cfg, "authorization-code", "", tikTokTestCallback)
			if tc.name != "basic profile" {
				if err == nil || profile != nil {
					t.Fatal("unverified profile was accepted")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			wantSubject := "tiktok:" + HashToken(HashToken("sandbox-client")+":open-id")
			if profile.Subject != wantSubject || profile.DisplayName != "Sandbox Creator" ||
				profile.AvatarURL != "https://example.com/avatar.png" || profile.Email != "" {
				t.Fatalf("unexpected TikTok profile: %+v", profile)
			}
		})
	}
}

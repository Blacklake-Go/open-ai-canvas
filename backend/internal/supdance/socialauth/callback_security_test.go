package socialauth

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"yingce/backend/internal/model"
)

// ---------------------------------------------------------------------------
// 安全回归：回调端点不能凭调用方给的 code 铸造身份
// ---------------------------------------------------------------------------

// 回调只看 code 前缀判定 mock 时，任何人先调用公开的 /start 拿到 state，再用
// code=mock_code_xxx 打回调，就能凭空铸出账号与会话。mock 只应由渠道配置开启。
func TestMockCallbackCodeIsHonoredOnlyWhenSandboxEnabled(t *testing.T) {
	repo, svc := newSecurityTestService(t)
	_ = repo
	seedChannel(t, svc, ProviderGoogle, "real_google_client", "real_google_secret", false)

	req := intlRequest("/api/auth/social/google/start")
	redirectURL, err := svc.BeginAuth(req, ProviderGoogle, "/create", true, true)
	if err != nil {
		t.Fatalf("BeginAuth failed: %v", err)
	}
	if strings.Contains(redirectURL, "mock=true") {
		t.Fatalf("sandbox disabled but BeginAuth issued a loopback mock redirect: %s", redirectURL)
	}
	state := oauthStateFromRedirect(t, redirectURL)

	if res, err := svc.CompleteAuth(intlRequest("/callback"), ProviderGoogle, state, "mock_code_attacker", ""); err == nil {
		t.Fatalf("forged mock code minted session for user %s", res.User.ID)
	}
}

// 真实（非 mock）授权码分支以前直接拼造 profile，等价于任何渠道都能被空转登录。
func TestLiveCallbackRequiresRealTokenExchange(t *testing.T) {
	repo, svc := newSecurityTestService(t)
	seedChannel(t, svc, ProviderQQ, "real_qq_client", "real_qq_secret", false)
	// 未接入上游交换的渠道现在既不能发起授权，也不出现在登录页。
	if _, err := svc.BeginAuth(cnRequest("/api/auth/social/qq/start"), ProviderQQ, "/create", true, false); err == nil {
		t.Fatalf("BeginAuth accepted a channel with no upstream token exchange")
	}
	state := mintState(t, repo, ProviderQQ)

	if res, err := svc.CompleteAuth(cnRequest("/callback"), ProviderQQ, state, "abcdef1234567890", ""); err == nil {
		t.Fatalf("no upstream exchange implemented but callback minted identity %s", res.User.ID)
	}
	if id, err := repo.UserIdentity(ProviderQQ, "qq_live_abcdef12"); err == nil && id != nil && id.ID != "" {
		t.Fatalf("callback persisted a fabricated identity %+v", id)
	}
	respCN, err := svc.GetPublicProviders(cnRequest("/api/auth/social/providers"))
	if err != nil {
		t.Fatalf("GetPublicProviders failed: %v", err)
	}
	for _, p := range respCN.Providers {
		if p.ID == ProviderQQ {
			t.Fatalf("QQ without a real exchange must not be advertised, got %+v", respCN.Providers)
		}
	}
}

// ---------------------------------------------------------------------------
// Google / X 的真实令牌交换
// ---------------------------------------------------------------------------

func TestGoogleLiveExchangeUsesUpstreamProfile(t *testing.T) {
	repo, svc := newSecurityTestService(t)
	seedChannel(t, svc, ProviderGoogle, "real_google_client", "real_google_secret", false)

	var hits int32
	tokenSrv, userinfoSrv, _ := startGoogleStub(t, "real_google_secret", "sub-777", "viewer@example.com", &hits)
	withGoogleEndpoints(t, tokenSrv, userinfoSrv)

	state := mintState(t, repo, ProviderGoogle)
	res, err := svc.CompleteAuth(intlRequest("/callback"), ProviderGoogle, state, "upstream_code_1234", "")
	if err != nil {
		t.Fatalf("CompleteAuth failed: %v", err)
	}
	identity, err := repo.UserIdentity(ProviderGoogle, "google_sub_sub-777")
	if err != nil || identity == nil {
		t.Fatalf("expected upstream subject google_sub_sub-777 to be persisted: %v", err)
	}
	if res.Session == nil {
		t.Fatalf("expected a session")
	}
	if got := atomic.LoadInt32(&hits); got < 2 {
		t.Errorf("expected token + userinfo upstream calls, got %d", got)
	}

	// 上游不认这把密钥时必须失败，而不是退化成伪造身份。
	badToken, badUserinfo, _ := startGoogleStub(t, "a_different_secret", "sub-888", "other@example.com", nil)
	withGoogleEndpoints(t, badToken, badUserinfo)
	if res, err := svc.CompleteAuth(intlRequest("/callback"), ProviderGoogle, mintState(t, repo, ProviderGoogle), "upstream_code_9999", ""); err == nil {
		t.Fatalf("upstream rejected the exchange but a session was minted for %s", res.User.ID)
	}
}

func TestXLiveExchangeUsesUpstreamProfile(t *testing.T) {
	repo, svc := newSecurityTestService(t)
	seedChannel(t, svc, ProviderX, "real_x_client", "real_x_secret", false)

	tokenSrv, meSrv := startXStub(t, "real_x_client", "real_x_secret", "x-42", "nova")
	withXEndpoints(t, tokenSrv, meSrv)

	res, err := svc.CompleteAuth(intlRequest("/callback"), ProviderX, mintState(t, repo, ProviderX), "upstream_code_5678", "")
	if err != nil {
		t.Fatalf("CompleteAuth failed: %v", err)
	}
	if _, err := repo.UserIdentity(ProviderX, "x_sub_x-42"); err != nil {
		t.Fatalf("expected upstream subject x_sub_x-42: %v", err)
	}
	if res.User == nil {
		t.Fatalf("expected user")
	}

	// 上游拒绝授权码时交换必须失败，而不是退化成伪造身份。
	badToken, badMe := startXStub(t, "real_x_client", "real_x_secret", "x-43", "magma")
	withXEndpoints(t, badToken, badMe)
	if res, err := svc.CompleteAuth(intlRequest("/callback"), ProviderX, mintState(t, repo, ProviderX), "code_without_verifier_check", ""); err == nil {
		t.Fatalf("upstream rejected the exchange but a session was minted for %s", res.User.ID)
	}
}

// ---------------------------------------------------------------------------
// 夹具
// ---------------------------------------------------------------------------

func newSecurityTestService(t *testing.T) (*testRepo, *Service) {
	t.Helper()
	repo := newTestRepo(t)
	return repo, NewService(repo, &testHost{})
}

func seedChannel(t *testing.T, svc *Service, provider, clientID, secret string, sandbox bool) {
	t.Helper()
	settings, err := svc.ReadSettings()
	if err != nil {
		t.Fatalf("ReadSettings failed: %v", err)
	}
	cfg := settings.Providers[provider]
	cfg.Enabled = true
	cfg.ClientID = clientID
	cfg.ClientSecret = secret
	cfg.SandboxMockEnabled = sandbox
	settings.Providers[provider] = cfg
	if err := svc.SaveSettings(&model.User{ID: "admin", Role: model.UserRoleAdmin}, settings); err != nil {
		t.Fatalf("SaveSettings failed: %v", err)
	}
}

func mintState(t *testing.T, repo *testRepo, provider string) string {
	t.Helper()
	stateToken := RandomToken()
	if err := repo.CreateOAuthState(&model.OAuthState{
		ID:            RandomToken()[:32],
		Provider:      provider,
		StateHash:     HashToken(stateToken),
		CodeVerifier:  RandomToken(),
		NextPath:      "/create",
		AcceptedTerms: true,
		ExpiresAt:     time.Now().Add(10 * time.Minute),
		CreatedAt:     time.Now(),
	}); err != nil {
		t.Fatalf("CreateOAuthState failed: %v", err)
	}
	return stateToken
}

func intlRequest(path string) *http.Request {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	req.Header.Set("CF-IPCountry", "US")
	return req
}

func cnRequest(path string) *http.Request {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	req.Header.Set("X-Real-IP", "124.90.230.101")
	return req
}

func oauthStateFromRedirect(t *testing.T, redirectURL string) string {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, redirectURL, nil)
	if err != nil {
		t.Fatalf("parse redirect url %q: %v", redirectURL, err)
	}
	state := req.URL.Query().Get("state")
	if state == "" {
		t.Fatalf("redirect url %q carries no state", redirectURL)
	}
	return state
}

func startGoogleStub(t *testing.T, wantSecret, sub, email string, hits *int32) (string, string, *httptest.Server) {
	t.Helper()
	accessToken := "at_" + sub
	mux := http.NewServeMux()
	mux.HandleFunc("/token", func(w http.ResponseWriter, r *http.Request) {
		if hits != nil {
			atomic.AddInt32(hits, 1)
		}
		w.Header().Set("Content-Type", "application/json")
		if err := r.ParseForm(); err != nil || r.FormValue("client_secret") != wantSecret || r.FormValue("grant_type") != "authorization_code" {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid_client"})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"access_token": accessToken, "scope": "openid profile email"})
	})
	mux.HandleFunc("/userinfo", func(w http.ResponseWriter, r *http.Request) {
		if hits != nil {
			atomic.AddInt32(hits, 1)
		}
		w.Header().Set("Content-Type", "application/json")
		if r.Header.Get("Authorization") != "Bearer "+accessToken {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{
			"sub": sub, "name": "Studio Viewer", "email": email, "picture": "https://example.test/avatar.png",
		})
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv.URL + "/token", srv.URL + "/userinfo", srv
}

func startXStub(t *testing.T, clientID, secret, id, username string) (string, string) {
	t.Helper()
	accessToken := "at_" + id
	wantBasic := "Basic " + base64.StdEncoding.EncodeToString([]byte(clientID+":"+secret))
	mux := http.NewServeMux()
	mux.HandleFunc("/token", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if err := r.ParseForm(); err != nil ||
			r.Header.Get("Authorization") != wantBasic ||
			r.FormValue("code_verifier") == "" ||
			strings.HasPrefix(r.FormValue("code"), "code_without") {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid_grant"})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"access_token": accessToken})
	})
	mux.HandleFunc("/me", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Header.Get("Authorization") != "Bearer "+accessToken {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": map[string]string{"id": id, "username": username, "name": username},
		})
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv.URL + "/token", srv.URL + "/me"
}

func withGoogleEndpoints(t *testing.T, tokenURL, userInfoURL string) {
	t.Helper()
	prevToken, prevUserinfo := googleTokenURL, googleUserInfoURL
	googleTokenURL, googleUserInfoURL = tokenURL, userInfoURL
	t.Cleanup(func() { googleTokenURL, googleUserInfoURL = prevToken, prevUserinfo })
}

func withXEndpoints(t *testing.T, tokenURL, meURL string) {
	t.Helper()
	prevToken, prevMe := xTokenURL, xUserInfoURL
	xTokenURL, xUserInfoURL = tokenURL, meURL
	t.Cleanup(func() { xTokenURL, xUserInfoURL = prevToken, prevMe })
}

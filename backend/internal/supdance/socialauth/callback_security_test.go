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
	redirectURL, err := svc.BeginAuth(req, ProviderGoogle, "/create", true)
	if err != nil {
		t.Fatalf("BeginAuth failed: %v", err)
	}
	if strings.Contains(redirectURL, "mock=true") {
		t.Fatalf("sandbox disabled but BeginAuth issued a loopback mock redirect: %s", redirectURL)
	}
	state := oauthStateFromRedirect(t, redirectURL)

	if res, err := completeBoundTestAuth(t, svc, intlRequest("/callback"), ProviderGoogle, state, "mock_code_attacker", ""); err == nil {
		t.Fatalf("forged mock code minted session for user %s", res.User.ID)
	}
}

// 真实（非 mock）授权码分支以前直接拼造 profile，等价于任何渠道都能被空转登录。
func TestLiveCallbackRequiresRealTokenExchange(t *testing.T) {
	repo, svc := newSecurityTestService(t)
	seedChannel(t, svc, ProviderBilibili, "real_bili_client", "real_bili_secret", false)
	// 未接入上游交换的渠道现在既不能发起授权，也不出现在登录页。
	if _, err := svc.BeginAuth(cnRequest("/api/auth/social/bilibili/start"), ProviderBilibili, "/create", true); err == nil {
		t.Fatalf("BeginAuth accepted a channel with no upstream token exchange")
	}
	state := mintState(t, repo, ProviderBilibili)

	if res, err := completeBoundTestAuth(t, svc, cnRequest("/callback"), ProviderBilibili, state, "abcdef1234567890", ""); err == nil {
		t.Fatalf("no upstream exchange implemented but callback minted identity %s", res.User.ID)
	}
	if id, err := repo.UserIdentity(ProviderBilibili, "bilibili_live_abcdef12"); err == nil && id != nil && id.ID != "" {
		t.Fatalf("callback persisted a fabricated identity %+v", id)
	}
	respCN, err := svc.GetPublicProviders(cnRequest("/api/auth/social/providers"))
	if err != nil {
		t.Fatalf("GetPublicProviders failed: %v", err)
	}
	for _, p := range respCN.Providers {
		if p.ID == ProviderBilibili {
			t.Fatalf("Bilibili without a real exchange must not be advertised, got %+v", respCN.Providers)
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
	res, err := completeBoundTestAuth(t, svc, intlRequest("/callback"), ProviderGoogle, state, "upstream_code_1234", "")
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
	if res, err := completeBoundTestAuth(t, svc, intlRequest("/callback"), ProviderGoogle, mintState(t, repo, ProviderGoogle), "upstream_code_9999", ""); err == nil {
		t.Fatalf("upstream rejected the exchange but a session was minted for %s", res.User.ID)
	}
}

func TestXLiveExchangeUsesUpstreamProfile(t *testing.T) {
	repo, svc := newSecurityTestService(t)
	seedChannel(t, svc, ProviderX, "real_x_client", "real_x_secret", false)

	tokenSrv, meSrv := startXStub(t, "real_x_client", "real_x_secret", "x-42", "nova")
	withXEndpoints(t, tokenSrv, meSrv)

	res, err := completeBoundTestAuth(t, svc, intlRequest("/callback"), ProviderX, mintState(t, repo, ProviderX), "upstream_code_5678", "")
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
	if res, err := completeBoundTestAuth(t, svc, intlRequest("/callback"), ProviderX, mintState(t, repo, ProviderX), "code_without_verifier_check", ""); err == nil {
		t.Fatalf("upstream rejected the exchange but a session was minted for %s", res.User.ID)
	}
}

// ---------------------------------------------------------------------------
// QQ / 抖音的真实令牌交换（CN 分区）
// ---------------------------------------------------------------------------

// QQ Connect 的三步链各有自己的响应格式：令牌是 query-string、openid 是 JSONP、
// 用户信息是带 ret 的 JSON。这里逐段验证，并确认上游说「不」时不会铸出身份。
func TestQQLiveExchangeUsesUpstreamProfile(t *testing.T) {
	repo, svc := newSecurityTestService(t)
	seedChannel(t, svc, ProviderQQ, "1000520", "real_qq_secret", false)
	useQQStub(t, "real_qq_secret", "7F8A9B0C1D2E3F40")

	// 接入真实交换后，QQ 重新可以发起授权（此前 BeginAuth 直接拒绝）。
	if _, err := svc.BeginAuth(cnRequest("/api/auth/social/qq/start"), ProviderQQ, "/create", true); err != nil {
		t.Fatalf("BeginAuth should accept a channel with a real exchange: %v", err)
	}
	res, err := completeBoundTestAuth(t, svc, cnRequest("/callback"), ProviderQQ, mintState(t, repo, ProviderQQ), "upstream_code_qq_1", "")
	if err != nil {
		t.Fatalf("CompleteAuth failed: %v", err)
	}
	identity, err := repo.UserIdentity(ProviderQQ, "qq_openid_7F8A9B0C1D2E3F40")
	if err != nil || identity == nil {
		t.Fatalf("expected upstream subject qq_openid_7F8A9B0C1D2E3F40 to be persisted: %v", err)
	}
	if res.User == nil || res.Session == nil {
		t.Fatalf("expected user and session")
	}
	if res.User.DisplayName != "星尘编剧" {
		t.Errorf("profile should come from get_user_info, got %q", res.User.DisplayName)
	}
	if identity.AvatarURL != "https://example.test/qq-avatar.png" {
		t.Errorf("avatar should come from get_user_info, got %q", identity.AvatarURL)
	}

	// 上游拒绝授权码时（QQ 用 JSONP 包裹错误）必须失败，而不是退化成伪造身份。
	useQQStub(t, "a_different_secret", "never-used")
	if bad, err := completeBoundTestAuth(t, svc, cnRequest("/callback"), ProviderQQ, mintState(t, repo, ProviderQQ), "code_rejected_by_qq", ""); err == nil {
		t.Fatalf("QQ rejected the exchange but a session was minted for %s", bad.User.ID)
	}
	if id, err := repo.UserIdentity(ProviderQQ, "qq_live_code_rej"); err == nil && id != nil && id.ID != "" {
		t.Fatalf("callback persisted a fabricated identity %+v", id)
	}
}

// 抖音在 HTTP 200 里用 data.error_code 报告业务失败，所以状态码友好不代表交换成功。
func TestDouyinLiveExchangeUsesUpstreamProfile(t *testing.T) {
	repo, svc := newSecurityTestService(t)
	seedChannel(t, svc, ProviderDouyin, "awj7wwc7sh2g6kuf", "real_douyin_secret", false)
	useDouyinStub(t, "awj7wwc7sh2g6kuf", "real_douyin_secret", "aad3-bbbb-cccc-dddd")

	res, err := completeBoundTestAuth(t, svc, cnRequest("/callback"), ProviderDouyin, mintState(t, repo, ProviderDouyin), "upstream_code_dy_1", "")
	if err != nil {
		t.Fatalf("CompleteAuth failed: %v", err)
	}
	identity, err := repo.UserIdentity(ProviderDouyin, "douyin_openid_aad3-bbbb-cccc-dddd")
	if err != nil || identity == nil {
		t.Fatalf("expected upstream subject douyin_openid_aad3-bbbb-cccc-dddd: %v", err)
	}
	if res.Session == nil {
		t.Fatalf("expected a session")
	}

	// 密钥对不上时抖音返回 error_code=22（非法应用），交换必须失败。
	useDouyinStub(t, "a_different_key", "real_douyin_secret", "never-used")
	if bad, err := completeBoundTestAuth(t, svc, cnRequest("/callback"), ProviderDouyin, mintState(t, repo, ProviderDouyin), "upstream_code_dy_2", ""); err == nil {
		t.Fatalf("Douyin rejected the exchange but a session was minted for %s", bad.User.ID)
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

func seedChannel(t *testing.T, svc *Service, provider, clientID, secret string, _ bool) {
	t.Helper()
	settings, err := svc.ReadSettings()
	if err != nil {
		t.Fatalf("ReadSettings failed: %v", err)
	}
	cfg := settings.Providers[provider]
	cfg.Enabled = true
	cfg.ClientID = clientID
	cfg.ClientSecret = secret
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
		_ = json.NewEncoder(w).Encode(map[string]any{
			"sub": sub, "name": "Studio Viewer", "email": email, "email_verified": true, "picture": "https://example.test/avatar.png",
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

// startQQStub 复现 QQ Connect 的三种响应格式：令牌是 query-string、openid 是
// JSONP 包裹、get_user_info 是带 ret 的 JSON。
func useQQStub(t *testing.T, wantSecret, openID string) {
	t.Helper()
	accessToken := "qq_at_" + openID
	mux := http.NewServeMux()
	mux.HandleFunc("/token", func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		w.Header().Set("Content-Type", "text/plain; charset=ISO-8859-1")
		if r.FormValue("client_secret") != wantSecret || strings.HasPrefix(r.FormValue("code"), "code_rejected") {
			_, _ = w.Write([]byte(`callback( {"error":100016,"error_description":"the code is a wrong one"} );`))
			return
		}
		_, _ = w.Write([]byte("access_token=" + accessToken + "&expires_in=31536000&refresh_token=rt_1"))
	})
	mux.HandleFunc("/me", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/javascript; charset=UTF-8")
		if r.URL.Query().Get("access_token") != accessToken {
			_, _ = w.Write([]byte(`callback( {"error":100004,"error_description":"access token is illegal"} );`))
			return
		}
		_, _ = w.Write([]byte(`callback( {"client_id":"1000520","openid":"` + openID + `"} );`))
	})
	mux.HandleFunc("/get_user_info", func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()
		w.Header().Set("Content-Type", "application/json; charset=UTF-8")
		if query.Get("access_token") != accessToken || query.Get("openid") != openID || query.Get("oauth_consumer_key") == "" {
			_, _ = w.Write([]byte(`{"ret":100016,"msg":"the openid is invalid"}`))
			return
		}
		_, _ = w.Write([]byte(`{"ret":0,"msg":"","nickname":"星尘编剧","figureurl_qq_2":"https://example.test/qq-avatar.png"}`))
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	withQQEndpoints(t, srv.URL+"/token", srv.URL+"/me", srv.URL+"/get_user_info")
}

func withQQEndpoints(t *testing.T, tokenURL, openIDURL, userInfoURL string) {
	t.Helper()
	prevToken, prevMe, prevInfo := qqTokenURL, qqOpenIDURL, qqUserInfoURL
	qqTokenURL, qqOpenIDURL, qqUserInfoURL = tokenURL, openIDURL, userInfoURL
	t.Cleanup(func() { qqTokenURL, qqOpenIDURL, qqUserInfoURL = prevToken, prevMe, prevInfo })
}

// startDouyinStub 复现 Login Kit v2：业务失败也走 HTTP 200 + data.error_code。
func useDouyinStub(t *testing.T, wantKey, wantSecret, openID string) {
	t.Helper()
	accessToken := "dy_at_" + openID
	fail := func(w http.ResponseWriter, code int, desc string) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data":   map[string]any{"error_code": code, "description": desc},
			"log_id": "stub",
		})
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/access_token", func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		if r.FormValue("client_key") != wantKey || r.FormValue("client_secret") != wantSecret {
			fail(w, 22, "非法应用")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": map[string]any{
				"error_code": 0, "access_token": accessToken, "open_id": openID,
				"scope": "user_info", "expires_in": 864000,
			},
			"message": "success",
		})
	})
	mux.HandleFunc("/userinfo", func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()
		if query.Get("access_token") != accessToken || query.Get("open_id") != openID {
			fail(w, 21018, "access_token 无效")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": map[string]any{
				"error_code": 0, "open_id": openID,
				"nickname": "短剧组", "avatar": "https://example.test/dy-avatar.png",
			},
			"message": "success",
		})
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	withDouyinEndpoints(t, srv.URL+"/access_token", srv.URL+"/userinfo")
}

func withDouyinEndpoints(t *testing.T, tokenURL, userInfoURL string) {
	t.Helper()
	prevToken, prevInfo := douyinTokenURL, douyinUserInfoURL
	douyinTokenURL, douyinUserInfoURL = tokenURL, userInfoURL
	t.Cleanup(func() { douyinTokenURL, douyinUserInfoURL = prevToken, prevInfo })
}

func useWeChatStub(t *testing.T, wantAppID, wantSecret, openID, unionID string) {
	t.Helper()
	accessToken := "wx_at_" + openID
	mux := http.NewServeMux()
	mux.HandleFunc("/oauth2/access_token", func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()
		if query.Get("appid") != wantAppID || query.Get("secret") != wantSecret {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"errcode": 40001,
				"errmsg":  "invalid credential, appid or secret error",
			})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"access_token": accessToken,
			"expires_in":   7200,
			"openid":       openID,
			"unionid":      unionID,
			"scope":        "snsapi_login",
			"errcode":      0,
			"errmsg":       "ok",
		})
	})
	mux.HandleFunc("/userinfo", func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()
		if query.Get("access_token") != accessToken || query.Get("openid") != openID {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"errcode": 40003,
				"errmsg":  "invalid openid",
			})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"openid":     openID,
			"nickname":   "微信舞者",
			"sex":        1,
			"headimgurl": "https://thirdwx.qlogo.cn/avatar.png",
			"unionid":    unionID,
			"errcode":    0,
			"errmsg":     "ok",
		})
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	withWeChatEndpoints(t, srv.URL+"/oauth2/access_token", srv.URL+"/userinfo")
}

func withWeChatEndpoints(t *testing.T, tokenURL, userInfoURL string) {
	t.Helper()
	prevToken, prevInfo := wechatTokenURL, wechatUserInfoURL
	wechatTokenURL, wechatUserInfoURL = tokenURL, userInfoURL
	t.Cleanup(func() { wechatTokenURL, wechatUserInfoURL = prevToken, prevInfo })
}

func TestWeChatLiveExchangeUsesUpstreamProfile(t *testing.T) {
	repo, svc := newSecurityTestService(t)
	seedChannel(t, svc, ProviderWeChat, "wx_appid_test", "wx_secret_test", false)

	useWeChatStub(t, "wx_appid_test", "wx_secret_test", "wx_open_888", "wx_union_999")

	// BeginAuth succeeds for mainland request
	redirectURL, err := svc.BeginAuth(cnRequest("/api/auth/social/wechat/start"), ProviderWeChat, "/create", true)
	if err != nil {
		t.Fatalf("BeginAuth failed: %v", err)
	}
	state := oauthStateFromRedirect(t, redirectURL)

	// CompleteAuth exchanges token and mints identity
	res, err := completeBoundTestAuth(t, svc, cnRequest("/callback"), ProviderWeChat, state, "upstream_wx_code", "")
	if err != nil {
		t.Fatalf("CompleteAuth failed: %v", err)
	}
	if res.User == nil {
		t.Fatalf("expected user to be created")
	}
	identity, err := repo.UserIdentity(ProviderWeChat, "wechat_unionid_wx_union_999")
	if err != nil || identity == nil {
		t.Fatalf("expected identity wechat_unionid_wx_union_999 to be saved: %v", err)
	}

	// Bad credentials test: upstream rejects with errcode
	seedChannel(t, svc, ProviderWeChat, "wx_appid_test", "wrong_secret", false)
	badState := mintState(t, repo, ProviderWeChat)
	if _, err := completeBoundTestAuth(t, svc, cnRequest("/callback"), ProviderWeChat, badState, "some_code", ""); err == nil {
		t.Fatalf("expected error on invalid WeChat secret, but got success")
	}
}

func TestNewOAuthUserHandlesUsernameAndEmailCollisions(t *testing.T) {
	repo, svc := newSecurityTestService(t)
	seedChannel(t, svc, ProviderQQ, "real_qq_key", "real_qq_secret", false)

	// Create an existing user with conflicting username and email
	existingUser := &model.User{
		ID:        "existing_user_id",
		Username:  "qq_qq_openid_collided_1",
		Email:     "shared@example.com",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := repo.Save(existingUser); err != nil {
		t.Fatalf("failed to create existing user: %v", err)
	}

	// Stub QQ response returning the same subject
	useQQStub(t, "real_qq_secret", "collided_1")

	state := mintState(t, repo, ProviderQQ)
	res, err := completeBoundTestAuth(t, svc, cnRequest("/callback"), ProviderQQ, state, "code_collision_test", "")
	if err != nil {
		t.Fatalf("CompleteAuth should handle username and email collision gracefully, but failed: %v", err)
	}
	if res.User == nil {
		t.Fatalf("expected user to be created despite collisions")
	}
	if res.User.Username == "qq_qq_openid_collided_1" {
		t.Fatalf("expected username to have random suffix on collision, got %s", res.User.Username)
	}
}

package socialauth

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// 这里的响应体是从生产出口对真实上游打了一次参数不合法的请求后逐字录下来的
// （2026-11-02，43.133.253.76 容器内 wget）。把它们钉进测试的原因很直接：
// QQ 与抖音的「失败」都长得不像失败——HTTP 200、错误塞在 body 里，而且 QQ 的
// 错误还是 JSONP 包裹的。只按标准 JSON 假设写的解析器会在真实拒绝面前把空令牌
// 当成成功，从而又给伪造身份开门。

func recorded(t *testing.T, bodies map[string]string) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	for path, body := range bodies {
		mux.HandleFunc(path, func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/plain; charset=ISO-8859-1")
			_, _ = w.Write([]byte(body))
		})
	}
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

func TestQQParsersMatchRecordedLivePayloads(t *testing.T) {
	// 1. 参数缺失时 QQ 用 JSONP 包裹错误（graph.qq.com/oauth2.0/token 实测原文）。
	if _, err := qqAccessToken(http.StatusOK, `callback( {"error":100004,"error_description":"param grant_type is wrong or lost"} );`); err == nil {
		t.Fatal("a JSONP-wrapped QQ error must not parse as a token")
	} else if !strings.Contains(err.Error(), "grant_type") {
		t.Fatalf("the upstream reason should be surfaced, got %q", err.Error())
	}

	// 2. 成功响应是 query-string，不是 JSON。
	token, err := qqAccessToken(http.StatusOK, "access_token=3D4E5F6A7B8C9D0E&expires_in=31536000&refresh_token=1A2B3C4D")
	if err != nil {
		t.Fatalf("query-string token reply should parse: %v", err)
	}
	if token != "3D4E5F6A7B8C9D0E" {
		t.Fatalf("unexpected access token %q", token)
	}

	// 3. /oauth2.0/me 拒绝坏令牌（实测原文）→ 整条链路必须失败，不产出身份。
	srv := recorded(t, map[string]string{
		"/token":         "access_token=3D4E5F6A7B8C9D0E&expires_in=31536000",
		"/me":            `callback( {"error":100013,"error_description":"access token is illegal"} );`,
		"/get_user_info": `{"ret":-1,"msg":"client request's parameters are invalid, invalid appid"}`,
	})
	withQQEndpoints(t, srv.URL+"/token", srv.URL+"/me", srv.URL+"/get_user_info")
	profile, err := redeemQQ(t.Context(), ProviderConfig{ClientID: "supdance", ClientSecret: "not-a-real-secret"}, "code", "https://www.supdance.com/api/auth/qq/callback")
	if err == nil {
		t.Fatalf("QQ rejected the openid step but a profile was produced: %+v", profile)
	}

	// 4. get_user_info 用 ret 报业务失败（实测原文）→ 同样必须失败。
	ok := recorded(t, map[string]string{
		"/token":         "access_token=3D4E5F6A7B8C9D0E&expires_in=31536000",
		"/me":            `callback( {"client_id":"1000520","openid":"7F8A9B0C1D2E3F40"} );`,
		"/get_user_info": `{"ret":-1,"msg":"client request's parameters are invalid, invalid appid"}`,
	})
	withQQEndpoints(t, ok.URL+"/token", ok.URL+"/me", ok.URL+"/get_user_info")
	if profile, err := redeemQQ(t.Context(), ProviderConfig{ClientID: "supdance", ClientSecret: "s"}, "code", "https://www.supdance.com/api/auth/qq/callback"); err == nil {
		t.Fatalf("QQ reported ret=-1 but a profile was produced: %+v", profile)
	}
}

func TestDouyinParsersMatchRecordedLivePayloads(t *testing.T) {
	// open.douyin.com/oauth/access_token/ 与 /oauth/userinfo/ 在参数不合法时
	// 都是 HTTP 200 + data.error_code。
	srv := recorded(t, map[string]string{
		"/access_token": `{"data":{"captcha":"","desc_url":"","description":"非法应用","error_code":22},"message":"error"}`,
		"/userinfo":     `{"data":{"captcha":"","desc_url":"","description":"非法应用","error_code":22},"message":"error"}`,
	})
	withDouyinEndpoints(t, srv.URL+"/access_token", srv.URL+"/userinfo")

	profile, err := redeemDouyin(t.Context(), ProviderConfig{ClientID: "awj7wwc7sh2g6kuf", ClientSecret: "not-a-real-secret"}, "code")
	if err == nil {
		t.Fatalf("Douyin answered error_code=22 but a profile was produced: %+v", profile)
	}
	if !strings.Contains(err.Error(), "非法应用") || !strings.Contains(err.Error(), "22") {
		t.Fatalf("the upstream reason should be surfaced, got %q", err.Error())
	}
}

func TestStripJSONPCoversTheShapesQQActuallySends(t *testing.T) {
	cases := map[string]string{
		`callback( {"openid":"abc"} );`:      `{"openid":"abc"}`,
		"callback({\"openid\":\"abc\"});":    `{"openid":"abc"}`,
		`  callback( {"error":100004} )\r\n`: `{"error":100004}`,
		`{"ret":0,"msg":""}`:                 `{"ret":0,"msg":""}`,
		`other( {"openid":"abc"} );`:         `other( {"openid":"abc"} );`,
	}
	for in, want := range cases {
		if got := stripJSONP(in); got != want {
			t.Errorf("stripJSONP(%q) = %q, want %q", in, got, want)
		}
	}
}

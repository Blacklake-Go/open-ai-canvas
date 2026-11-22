package handler

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestExecuteSEOPushHTTPIndexNowAndBaidu(t *testing.T) {
	var indexNowGot map[string]any
	var baiduBody string
	var baiduQuery url.Values

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/indexnow":
			_ = json.NewDecoder(r.Body).Decode(&indexNowGot)
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"ok":true}`))
		case "/baidu":
			baiduQuery = r.URL.Query()
			buf := make([]byte, 4096)
			n, _ := r.Body.Read(buf)
			baiduBody = string(buf[:n])
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"remain":99,"success":2}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()

	u, _ := url.Parse(srv.URL)
	t.Setenv("ONE_INDEXNOW_ENDPOINT", srv.URL+"/indexnow")
	t.Setenv("ONE_BAIDU_PUSH_ENDPOINT", srv.URL+"/baidu")

	attempts := executeSEOPushHTTP(
		context.Background(),
		"all",
		[]string{"https://www.supdance.com/", "https://www.supdance.com/studio"},
		map[string]any{
			"indexNow":  map[string]any{"enabled": true, "host": "www.supdance.com", "key": "test-indexnow-key"},
			"baiduPush": map[string]any{"enabled": true, "site": "https://www.supdance.com", "token": "bd-tok-123"},
		},
		"",
		[]string{u.Hostname()},
	)

	if len(attempts) != 2 {
		t.Fatalf("expected 2 SEO push attempts, got %d: %+v", len(attempts), attempts)
	}
	if attempts[0].Status != "succeeded" || attempts[0].StatusCode != 200 {
		t.Fatalf("indexnow attempt failed: %+v", attempts[0])
	}
	if indexNowGot["key"] != "test-indexnow-key" {
		t.Fatalf("indexnow payload missing key: %#v", indexNowGot)
	}
	if attempts[1].Status != "succeeded" || baiduQuery.Get("token") != "bd-tok-123" || !strings.Contains(baiduBody, "/studio") {
		t.Fatalf("baidu attempt mismatch: %+v query=%v body=%q", attempts[1], baiduQuery, baiduBody)
	}

	// Missing credentials must fail closed cleanly (never fake 200)
	failAttempts := executeSEOPushHTTP(context.Background(), "indexnow", []string{"https://example.com"}, map[string]any{}, "", nil)
	if len(failAttempts) != 1 || failAttempts[0].Status != "failed" {
		t.Fatalf("expected failed attempt when unconfigured, got %+v", failAttempts)
	}
}

func TestFetchGA4AnalyticsReportOAuth2JWT(t *testing.T) {
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	der, err := x509.MarshalPKCS8PrivateKey(priv)
	if err != nil {
		t.Fatal(err)
	}
	pemStr := string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der}))

	var gotGrant, gotAssertion string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/token":
			_ = r.ParseForm()
			gotGrant = r.FormValue("grant_type")
			gotAssertion = r.FormValue("assertion")
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"access_token":"ga4_tok_abc","token_type":"Bearer","expires_in":3600}`))
		case "/v1beta/properties/123456789:runRealtimeReport":
			if r.Header.Get("Authorization") != "Bearer ga4_tok_abc" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"rows":[{"metricValues":[{"value":"7"}]}]}`))
		case "/v1beta/properties/123456789:runReport":
			if r.Header.Get("Authorization") != "Bearer ga4_tok_abc" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"rows":[{"metricValues":[{"value":"42"},{"value":"55"},{"value":"120"},{"value":"300"}]}]}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()

	u, _ := url.Parse(srv.URL)
	t.Setenv("ONE_GA4_TOKEN_URL", srv.URL+"/token")
	t.Setenv("ONE_GA4_API_BASE", srv.URL+"/v1beta")

	res, err := fetchGA4AnalyticsReport(context.Background(), map[string]any{
		"propertyId":               "properties/123456789",
		"measurementId":            "G-TEST1234",
		"serviceAccountEmail":      "ga4-reader@example.iam.gserviceaccount.com",
		"serviceAccountPrivateKey": pemStr,
	}, []string{u.Hostname()})
	if err != nil {
		t.Fatalf("fetchGA4AnalyticsReport: %v", err)
	}
	if gotGrant != "urn:ietf:params:oauth:grant-type:jwt-bearer" || len(strings.Split(gotAssertion, ".")) != 3 {
		t.Fatalf("unexpected OAuth2 JWT grant=%q assertion=%q", gotGrant, gotAssertion)
	}
	if res["configured"] != true || res["propertyId"] != "123456789" {
		t.Fatalf("unexpected GA4 result: %#v", res)
	}
}

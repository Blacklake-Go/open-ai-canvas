package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"one/backend/internal/middleware"
)

// TestMiscWaveBehaviour pins the externally observable contract of the misc shard:
// public webhook challenge handshakes, default-deny legacy proxies, and IndexNow key text.
func TestMiscWaveBehaviour(t *testing.T) {
	router, _ := newTestRouter(t, nil)

	call := func(method, path, body string, headers map[string]string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Host = "www.supdance.com"
		for k, v := range headers {
			req.Header.Set(k, v)
		}
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec
	}

	t.Run("bilibili GET challenge", func(t *testing.T) {
		rec := call(http.MethodGet, "/api/webhooks/bilibili?challenge=abc123", "", nil)
		if rec.Code != http.StatusOK || rec.Body.String() != "abc123" {
			t.Fatalf("bilibili challenge = %d %q", rec.Code, rec.Body.String())
		}
		if ct := rec.Header().Get("Content-Type"); !strings.Contains(ct, "text/plain") {
			t.Fatalf("challenge content-type = %q", ct)
		}
	})

	t.Run("douyin verify_webhook handshake", func(t *testing.T) {
		rec := call(http.MethodPost, "/api/webhooks/douyin",
			`{"event":"verify_webhook","content":{"challenge":"dy-777"}}`,
			map[string]string{"Content-Type": "application/json"})
		if rec.Code != http.StatusOK {
			t.Fatalf("douyin handshake status = %d %s", rec.Code, rec.Body.String())
		}
		var body map[string]any
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil || body["challenge"] != "dy-777" {
			t.Fatalf("douyin handshake body = %s", rec.Body.String())
		}
	})

	t.Run("webhook POST is CSRF exempt with no Origin", func(t *testing.T) {
		if !middleware.IsCSRFExemptPath("/api/webhooks/bilibili") || !middleware.IsCSRFExemptPath("/api/webhooks/douyin") {
			t.Fatal("webhooks must be exempt from the origin guard (platform callback has no Origin)")
		}
	})

	t.Run("legacy proxy default-deny", func(t *testing.T) {
		rec := call(http.MethodGet, "/api/workflow/secrets", "", map[string]string{
			"Origin": "https://www.supdance.com",
		})
		if rec.Code != http.StatusNotFound {
			t.Fatalf("default-deny proxy status = %d %s", rec.Code, rec.Body.String())
		}
		var body map[string]any
		_ = json.Unmarshal(rec.Body.Bytes(), &body)
		if body["code"] != "DENY_PATH" {
			t.Fatalf("default-deny decision = %v", body["code"])
		}
	})

	t.Run("billed legacy inference stays closed", func(t *testing.T) {
		rec := call(http.MethodPost, "/api/agents/suggest", `{}`, map[string]string{
			"Origin": "https://www.supdance.com", "Content-Type": "application/json",
		})
		if rec.Code != http.StatusPaymentRequired {
			t.Fatalf("billed proxy status = %d %s", rec.Code, rec.Body.String())
		}
		var body map[string]any
		_ = json.Unmarshal(rec.Body.Bytes(), &body)
		if body["code"] != "DENY_BILLING_REQUIRED" {
			t.Fatalf("billed decision = %v", body["code"])
		}
	})

	t.Run("feedback requires login", func(t *testing.T) {
		rec := call(http.MethodGet, "/api/feedback", "", nil)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("anonymous feedback status = %d %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("indexnow key is plain text", func(t *testing.T) {
		rec := call(http.MethodGet, "/api/seo/indexnow-key", "", nil)
		if rec.Code != http.StatusOK || !strings.Contains(rec.Header().Get("Content-Type"), "text/plain") {
			t.Fatalf("indexnow = %d %q %q", rec.Code, rec.Header().Get("Content-Type"), rec.Body.String())
		}
		if strings.TrimSpace(rec.Body.String()) == "" {
			t.Fatal("indexnow key must not be empty")
		}
	})
}

package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"one/backend/internal/config"
)

type stubSessionLookup struct {
	users map[string]*SessionUser
}

func (s *stubSessionLookup) LookupByTokenHash(_ context.Context, tokenHash string) (*SessionUser, error) {
	return s.users[tokenHash], nil
}

func TestSecurityHeadersAndEmbedAuthException(t *testing.T) {
	h := SecurityHeaders(true)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	recDefault := httptest.NewRecorder()
	h.ServeHTTP(recDefault, httptest.NewRequest(http.MethodGet, "/studio", nil))
	if recDefault.Header().Get("X-Frame-Options") != "DENY" {
		t.Fatalf("expected X-Frame-Options DENY, got %q", recDefault.Header().Get("X-Frame-Options"))
	}
	if !strings.Contains(recDefault.Header().Get("Content-Security-Policy"), "frame-ancestors 'none';") {
		t.Fatalf("expected frame-ancestors 'none' in CSP")
	}

	recEmbed := httptest.NewRecorder()
	h.ServeHTTP(recEmbed, httptest.NewRequest(http.MethodGet, "/embed-auth", nil))
	if recEmbed.Header().Get("X-Frame-Options") != "" {
		t.Fatalf("expected no X-Frame-Options on /embed-auth, got %q", recEmbed.Header().Get("X-Frame-Options"))
	}
	if !strings.Contains(recEmbed.Header().Get("Content-Security-Policy"), "https://canvas.supdance.com") {
		t.Fatalf("expected canvas.supdance.com in /embed-auth CSP")
	}
}

func TestCanvasCORSPreflightAndHeaders(t *testing.T) {
	h := CanvasCORS(true)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	reqOpt := httptest.NewRequest(http.MethodOptions, "/api/models/active", nil)
	reqOpt.Header.Set("Origin", "https://canvas.supdance.com")
	recOpt := httptest.NewRecorder()
	h.ServeHTTP(recOpt, reqOpt)
	if recOpt.Code != http.StatusNoContent {
		t.Fatalf("expected 204 for preflight, got %d", recOpt.Code)
	}
	if recOpt.Header().Get("Access-Control-Allow-Origin") != "https://canvas.supdance.com" {
		t.Fatalf("missing ACAO header")
	}

	reqBad := httptest.NewRequest(http.MethodOptions, "/api/models/active", nil)
	reqBad.Header.Set("Origin", "https://evil.example.com")
	recBad := httptest.NewRecorder()
	h.ServeHTTP(recBad, reqBad)
	if recBad.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatalf("evil origin must not receive ACAO")
	}
}

func TestCSRFOriginGuardAndWebhookExemption(t *testing.T) {
	cfg := config.Config{IsProduction: true, CSRFOriginRequired: true, PublicAppURL: "https://one.supdance.com"}
	h := CSRFOriginGuard(cfg)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// Missing origin on normal mutation -> 403
	recNoOrigin := httptest.NewRecorder()
	h.ServeHTTP(recNoOrigin, httptest.NewRequest(http.MethodPost, "/api/generations", nil))
	if recNoOrigin.Code != http.StatusForbidden {
		t.Fatalf("expected 403 without Origin, got %d", recNoOrigin.Code)
	}

	// Evil origin -> 403
	reqEvil := httptest.NewRequest(http.MethodPost, "/api/generations", nil)
	reqEvil.Header.Set("Origin", "https://evil.com")
	recEvil := httptest.NewRecorder()
	h.ServeHTTP(recEvil, reqEvil)
	if recEvil.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for evil Origin, got %d", recEvil.Code)
	}

	// Trusted origin -> 200
	reqGood := httptest.NewRequest(http.MethodPost, "/api/generations", nil)
	reqGood.Header.Set("Origin", "https://one.supdance.com")
	recGood := httptest.NewRecorder()
	h.ServeHTTP(recGood, reqGood)
	if recGood.Code != http.StatusOK {
		t.Fatalf("expected 200 for trusted Origin, got %d", recGood.Code)
	}

	// Webhook exemption without Origin -> 200
	for _, wh := range []string{
		"/api/billing/webhooks/stripe",
		"/api/billing/webhooks/alipay",
		"/api/billing/webhooks/wechat",
		"/api/billing/webhooks/paypal",
		"/api/auth/oauth/google/webhook",
		"/api/generations/gen_123/callback",
	} {
		recWh := httptest.NewRecorder()
		h.ServeHTTP(recWh, httptest.NewRequest(http.MethodPost, wh, nil))
		if recWh.Code != http.StatusOK {
			t.Fatalf("expected webhook %s to be CSRF exempt, got %d", wh, recWh.Code)
		}
	}
}

func TestPGSessionLookupSubscriptionAndEligibility(t *testing.T) {
	if !strings.Contains(pgSessionLookupSQL, "ops_bill.subscriptions") {
		t.Fatal("pgSessionLookupSQL must query ops_bill.subscriptions")
	}
	if !strings.Contains(pgSessionLookupSQL, "is_subscribed") || !strings.Contains(pgSessionLookupSQL, "plan_id") {
		t.Fatal("pgSessionLookupSQL must project is_subscribed and plan_id")
	}
	now := time.Date(2026, 11, 15, 10, 0, 0, 0, time.UTC)
	future := now.Add(time.Hour)
	past := now.Add(-time.Hour)
	if !isSessionUserEligible("active", nil, future, now) {
		t.Fatal("active non-expired session should be eligible")
	}
	if isSessionUserEligible("suspended", nil, future, now) {
		t.Fatal("suspended user must not be eligible")
	}
	if isSessionUserEligible("active", nil, past, now) {
		t.Fatal("expired session must not be eligible")
	}
	if !isSessionUserEligible("deletion_pending", &future, future, now) {
		t.Fatal("deletion_pending within grace period should remain eligible")
	}
	if isSessionUserEligible("deletion_pending", &past, future, now) {
		t.Fatal("deletion_pending past deletion_due_at must not be eligible")
	}
}

func TestKoSessionSHA256AuthAndAdminRBAC(t *testing.T) {
	rawToken := "secret-session-token-xyz"
	store := &stubSessionLookup{
		users: map[string]*SessionUser{
			HashSessionToken(rawToken): {
				ID:   "100042",
				Role: "finance_admin",
			},
		},
	}

	h := RequirePermission(store, "models.write")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// Unauthenticated -> 401 admin envelope
	recAnon := httptest.NewRecorder()
	h.ServeHTTP(recAnon, httptest.NewRequest(http.MethodPost, "/api/admin/models", nil))
	if recAnon.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", recAnon.Code)
	}

	// finance_admin lacks models.write -> 403 admin envelope
	reqFin := httptest.NewRequest(http.MethodPost, "/api/admin/models", nil)
	reqFin.AddCookie(&http.Cookie{Name: SessionCookieName, Value: rawToken})
	recFin := httptest.NewRecorder()
	h.ServeHTTP(recFin, reqFin)
	if recFin.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for finance_admin lacking models.write, got %d", recFin.Code)
	}
	var body map[string]any
	_ = json.Unmarshal(recFin.Body.Bytes(), &body)
	if body["ok"] != false {
		t.Fatalf("expected admin error envelope ok=false, got %v", body)
	}

	// finance_admin has billing.write -> 200
	hAllow := RequirePermission(store, "billing.write")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	recAllow := httptest.NewRecorder()
	hAllow.ServeHTTP(recAllow, reqFin)
	if recAllow.Code != http.StatusOK {
		t.Fatalf("expected 200 for allowed permission, got %d", recAllow.Code)
	}
}

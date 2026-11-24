package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"one/backend/internal/config"
	"one/backend/internal/domain/auth"
	"one/backend/internal/domain/generation"
	"one/backend/internal/domain/site"
	"one/backend/internal/middleware"
	"one/backend/internal/pkg/envelope"
	"one/backend/internal/queue"
)

type stubSessionStore struct {
	users map[string]*middleware.SessionUser
}

func (s *stubSessionStore) LookupByTokenHash(_ context.Context, tokenHash string) (*middleware.SessionUser, error) {
	if s == nil {
		return nil, nil
	}
	return s.users[tokenHash], nil
}

type stubModelRepo struct {
	models []generation.ActiveModel
}

func (s *stubModelRepo) ListActiveModels(_ context.Context, _ string) ([]generation.ActiveModel, error) {
	return s.models, nil
}

func newTestRouter(t *testing.T, dbErr error) (http.Handler, *queue.EventHub) {
	t.Helper()
	hub := queue.NewEventHub()
	userToken := "valid-user-token"
	adminToken := "valid-admin-token"
	sessions := &stubSessionStore{
		users: map[string]*middleware.SessionUser{
			middleware.HashSessionToken(userToken): {
				ID:          "100001",
				UserNumber:  "100001",
				DisplayName: "Creator",
				Role:        "user",
				Status:      "active",
				Locale:      "zh-CN",
				Credits:     120,
				PlanID:      "free",
			},
			middleware.HashSessionToken(adminToken): {
				ID:          "100002",
				UserNumber:  "100002",
				DisplayName: "Operator",
				Role:        "operations_admin",
				Status:      "active",
				Locale:      "en",
				Credits:     999,
				PlanID:      "pro",
			},
		},
	}

	var dbCheck HealthChecker
	if dbErr != nil {
		dbCheck = func(context.Context) error { return dbErr }
	} else {
		dbCheck = func(context.Context) error { return nil }
	}

	r, err := NewRouter(Dependencies{
		Config: config.Config{
			PublicAppURL:       "http://127.0.0.1:3000",
			CSRFOriginRequired: true,
			IsProduction:       false,
		},
		SessionAuth: sessions,
		Site:        &site.Service{},
		Auth:        &auth.Service{},
		Generation: &generation.Service{
			Repo: &stubModelRepo{
				models: []generation.ActiveModel{
					{
						ID:          "seedream-4",
						Name:        "seedream-4",
						DisplayName: "Seedream 4",
						Category:    "image",
						Type:        "image",
						Tier:        "core",
						IsActive:    true,
						IsVisible:   true,
					},
				},
			},
		},
		Events:  hub,
		DBCheck: dbCheck,
	})
	if err != nil {
		t.Fatalf("NewRouter failed: %v", err)
	}
	return r, hub
}

func TestRouterBuildsAll238ContractsWithoutConflicts(t *testing.T) {
	contracts, err := envelope.LoadRouteContracts()
	if err != nil {
		t.Fatalf("LoadRouteContracts: %v", err)
	}
	if len(contracts) != 238 {
		t.Fatalf("expected 238 baseline contracts, got %d", len(contracts))
	}

	router, _ := newTestRouter(t, nil)

	// Unauthenticated admin request returns admin_ok_meta_envelope 401
	req := httptest.NewRequest(http.MethodGet, "/api/admin/users", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("admin unauthenticated status = %d, want 401", rec.Code)
	}
	var adminBody map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &adminBody); err != nil {
		t.Fatalf("decode admin error: %v", err)
	}
	if adminBody["ok"] != false || adminBody["meta"] == nil || adminBody["error"] == nil {
		t.Fatalf("unexpected admin envelope: %#v", adminBody)
	}

	// Regular user blocked from admin route with 403 FORBIDDEN
	req = httptest.NewRequest(http.MethodGet, "/api/admin/users", nil)
	req.AddCookie(&http.Cookie{Name: "ko_session", Value: "valid-user-token"})
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("regular user admin status = %d, want 403", rec.Code)
	}

	// Admin with permission reaches a real handler (or, before its batch lands, the
	// contract-enforced stub). Either way the response must be a valid admin envelope and
	// must never be 404/405. This keeps the test valid throughout the staged migration.
	req = httptest.NewRequest(http.MethodGet, "/api/admin/users", nil)
	req.AddCookie(&http.Cookie{Name: "ko_session", Value: "valid-admin-token"})
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code == http.StatusNotFound || rec.Code == http.StatusMethodNotAllowed {
		t.Fatalf("admin route status = %d, want a mounted handler", rec.Code)
	}
	var reached map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &reached); err != nil {
		t.Fatalf("decode admin response: %v", err)
	}
	if reached["meta"] == nil {
		t.Fatalf("admin response missing meta: %#v", reached)
	}

	// Next.js precedence is a property of the compiled route table, independent of whether a
	// handler is real or a stub: static `/api/assets/library/[id]` must outrank the
	// dynamic `/api/assets/[id]/download` for `/api/assets/library/download`.
	staticSegs := compileNextPath("/api/assets/library/[id]")
	dynamicSegs := compileNextPath("/api/assets/[id]/download")
	if compareRouteSpecificity(staticSegs, dynamicSegs) <= 0 {
		t.Fatal("static /api/assets/library/[id] must outrank /api/assets/[id]/download")
	}
	if params, ok := matchSegments(staticSegs, splitRequestPath("/api/assets/library/download")); !ok || params["id"] != "download" {
		t.Fatalf("static precedence match failed: ok=%v params=%v", ok, params)
	}

	// Optional catch-all `[[...path]]` matches both with and without trailing segments.
	catchSegs := compileNextPath("/api/agents/[[...path]]")
	for path, want := range map[string]string{"/api/agents": "", "/api/agents/runs/123": "runs/123"} {
		params, ok := matchSegments(catchSegs, splitRequestPath(path))
		if !ok || params["path"] != want {
			t.Fatalf("%s optional catch-all: ok=%v params=%v", path, ok, params)
		}
	}
}

func TestVerticalSliceHealthLiveReady(t *testing.T) {
	router, _ := newTestRouter(t, nil)
	for _, tc := range []struct {
		path       string
		code       int
		wantStatus string
	}{
		{"/api/health", http.StatusOK, "healthy"},
		{"/api/live", http.StatusOK, "live"},
		{"/api/ready", http.StatusOK, "ready"},
	} {
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, tc.path, nil))
		if rec.Code != tc.code {
			t.Fatalf("%s status = %d, want %d", tc.path, rec.Code, tc.code)
		}
		if rec.Header().Get("X-Frame-Options") != "DENY" {
			t.Fatalf("%s missing X-Frame-Options: DENY", tc.path)
		}
		if cc := rec.Header().Get("Cache-Control"); cc != "no-store" {
			t.Fatalf("%s Cache-Control = %q, want no-store", tc.path, cc)
		}
		var body map[string]any
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
			t.Fatalf("%s invalid JSON: %v", tc.path, err)
		}
		if body["status"] != tc.wantStatus {
			t.Fatalf("%s status field = %v, want %q", tc.path, body["status"], tc.wantStatus)
		}
		if _, ok := body["checkedAt"]; !ok {
			t.Fatalf("%s missing checkedAt field", tc.path)
		}
		if tc.path == "/api/health" || tc.path == "/api/ready" {
			dbMap, ok := body["database"].(map[string]any)
			if !ok || dbMap["ok"] != true {
				t.Fatalf("%s database = %v, want {ok:true}", tc.path, body["database"])
			}
			for _, dep := range []string{"worker", "storage", "email", "providers"} {
				if _, exists := body[dep]; !exists {
					t.Fatalf("%s missing dependency %q", tc.path, dep)
				}
			}
		}
	}

	degradedRouter, _ := newTestRouter(t, errors.New("pg down"))
	rec := httptest.NewRecorder()
	degradedRouter.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/ready", nil))
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("degraded /api/ready status = %d, want 503", rec.Code)
	}
}

type mockSiteRepo struct {
	keys []string
	data map[string]json.RawMessage
}

func (m *mockSiteRepo) GetSetting(_ context.Context, key string) (json.RawMessage, error) {
	m.keys = append(m.keys, key)
	return m.data[key], nil
}

func TestVerticalSliceSiteAndI18n(t *testing.T) {
	repo := &mockSiteRepo{
		data: map[string]json.RawMessage{
			"homepage_motion":         json.RawMessage(`{"motionLevel":"minimal","ambientGlow":false}`),
			"subscription_faq_config": json.RawMessage(`{"notice":"custom notice","items":[{"id":"custom-1","order":1,"enabled":true,"category":"quota","question":"Q","answer":"A"}]}`),
			"i18n.published":          json.RawMessage(`{"zh-CN":{"hero.title":"影策"}}`),
		},
	}
	hub := queue.NewEventHub()
	router, err := NewRouter(Dependencies{
		Config: config.Config{PublicAppURL: "http://127.0.0.1:3000", CSRFOriginRequired: true},
		Site:   &site.Service{Repo: repo},
		Events: hub,
	})
	if err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct {
		path string
		cc   string
	}{
		{"/api/site/branding", "private, no-store, max-age=0"},
		{"/api/site/content-config", "public, max-age=15, stale-while-revalidate=60"},
		{"/api/site/subscription-faq", "public, no-cache"},
	} {
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, tc.path, nil))
		if rec.Code != http.StatusOK {
			t.Fatalf("%s status = %d", tc.path, rec.Code)
		}
		if gotCC := rec.Header().Get("Cache-Control"); gotCC != tc.cc {
			t.Fatalf("%s Cache-Control = %q, want %q", tc.path, gotCC, tc.cc)
		}
	}

	// Alias zh -> zh-CN (reads i18n.published overrides)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/i18n?locale=zh", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("/api/i18n?locale=zh status = %d", rec.Code)
	}
	var i18nResp site.I18nPayload
	if err := json.Unmarshal(rec.Body.Bytes(), &i18nResp); err != nil {
		t.Fatal(err)
	}
	if i18nResp.Locale != "zh-CN" {
		t.Fatalf("got locale %q, want zh-CN", i18nResp.Locale)
	}
	if i18nResp.Messages["hero.title"] != "影策" {
		t.Fatalf("expected override hero.title from i18n.published, got %v", i18nResp.Messages)
	}

	// Missing ?locale= -> 400 (matches Supdance Pro/app/api/i18n/route.js)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/i18n", nil))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("/api/i18n without locale status = %d, want 400", rec.Code)
	}

	// Bad locale -> 400
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/i18n?locale=fr-FR", nil))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("/api/i18n?locale=fr-FR status = %d, want 400", rec.Code)
	}
}

func TestVerticalSliceAuthMeAndModelsActive(t *testing.T) {
	router, _ := newTestRouter(t, nil)

	// Unauthenticated /api/auth/me returns 200 { user: null, entitlements: null }
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/auth/me", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("unauth /api/auth/me status = %d", rec.Code)
	}
	var me auth.MeResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &me); err != nil {
		t.Fatal(err)
	}
	if me.User != nil {
		t.Fatalf("expected nil user, got %+v", me.User)
	}

	// Authenticated /api/auth/me resolves ko_session via SHA-256
	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.AddCookie(&http.Cookie{Name: "ko_session", Value: "valid-user-token"})
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("auth /api/auth/me status = %d", rec.Code)
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &me); err != nil {
		t.Fatal(err)
	}
	if me.User == nil || me.User.ID != "100001" {
		t.Fatalf("expected user 100001, got %+v", me.User)
	}

	// /api/models/active valid schemaVersion=2
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/models/active?schemaVersion=2", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("/api/models/active status = %d", rec.Code)
	}
	var modelsResp generation.ActiveModelsResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &modelsResp); err != nil {
		t.Fatal(err)
	}
	if !modelsResp.Success || modelsResp.SchemaVersion != 2 || len(modelsResp.Models) != 1 {
		t.Fatalf("unexpected models response: %+v", modelsResp)
	}

	// /api/models/active invalid schemaVersion=99 -> 409
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/models/active?schemaVersion=99", nil))
	if rec.Code != http.StatusConflict {
		t.Fatalf("/api/models/active?schemaVersion=99 status = %d, want 409", rec.Code)
	}
}

func TestVerticalSliceGenerationsEventsSSE(t *testing.T) {
	router, hub := newTestRouter(t, nil)

	// Unauthenticated SSE -> 401
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/generations/events", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("unauth SSE status = %d, want 401", rec.Code)
	}

	// Authenticated SSE receives initial connected frame + live task event
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	req := httptest.NewRequest(http.MethodGet, "/api/generations/events?taskId=gen_123", nil).WithContext(ctx)
	req.AddCookie(&http.Cookie{Name: "ko_session", Value: "valid-user-token"})
	rec = httptest.NewRecorder()

	done := make(chan struct{})
	go func() {
		defer close(done)
		router.ServeHTTP(rec, req)
	}()

	time.Sleep(25 * time.Millisecond)
	hub.PublishLocal(queue.GenerationEvent{
		Type:   "task.updated",
		TaskID: "gen_123",
		UserID: "100001",
		Status: "completed",
	})
	time.Sleep(25 * time.Millisecond)
	cancel()
	<-done

	if rec.Code != http.StatusOK {
		t.Fatalf("auth SSE status = %d, want 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.Contains(ct, "text/event-stream") {
		t.Fatalf("SSE Content-Type = %q", ct)
	}
	body := rec.Body.String()
	if !strings.Contains(body, "event: connected") || !strings.Contains(body, "event: task.updated") {
		t.Fatalf("unexpected SSE body: %q", body)
	}
}

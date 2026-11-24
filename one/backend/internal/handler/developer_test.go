package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"one/backend/internal/config"
	"one/backend/internal/middleware"
)

func TestDeveloperRoutesKeepBearerAndSessionAuthSeparate(t *testing.T) {
	const session = "local-test-session"
	router, err := NewRouter(Dependencies{
		Config: config.Config{CSRFOriginRequired: true},
		SessionAuth: &stubSessionStore{users: map[string]*middleware.SessionUser{
			middleware.HashSessionToken(session): {ID: "user", Role: "user", Status: "active"},
		}},
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, route := range []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/developer/v1/models"},
		{http.MethodGet, "/api/developer/v1/wallet"},
		{http.MethodPost, "/api/developer/v1/generations/quote"},
		{http.MethodPost, "/api/developer/v1/generations"},
		{http.MethodGet, "/api/developer/v1/generations/test-id"},
		{http.MethodGet, "/api/developer/v1/generations/test-id/result"},
	} {
		req := httptest.NewRequest(route.method, route.path, nil)
		req.AddCookie(&http.Cookie{Name: middleware.SessionCookieName, Value: session})
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		if res.Code != http.StatusUnauthorized || !strings.HasPrefix(res.Header().Get("WWW-Authenticate"), "Bearer ") {
			t.Errorf("%s %s: expected a bearer challenge even with a valid session, got %d", route.method, route.path, res.Code)
		}
	}
	for _, method := range []string{http.MethodPost, http.MethodDelete} {
		req := httptest.NewRequest(method, "/api/user/api-key", nil)
		req.AddCookie(&http.Cookie{Name: middleware.SessionCookieName, Value: session})
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		if res.Code != http.StatusForbidden {
			t.Errorf("%s /api/user/api-key: expected an origin check, got %d", method, res.Code)
		}
	}
}

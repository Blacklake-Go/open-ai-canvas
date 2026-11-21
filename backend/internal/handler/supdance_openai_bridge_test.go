package handler

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestSupdanceOpenAIBridgeHealthRequiresConfiguredServiceCredential(t *testing.T) {
	const path = "/api/supdance-openai/v1/healthz"
	secretFile := filepath.Join(t.TempDir(), "bridge.secret")
	t.Setenv("CANVAS_SUPDANCE_OPENAI_BRIDGE_SECRET_FILE", secretFile)

	router := gin.New()
	RegisterSupdanceOpenAIBridgeRoutes(router.Group("/api"), nil)
	missing := httptest.NewRecorder()
	router.ServeHTTP(missing, httptest.NewRequest(http.MethodGet, path, nil))
	if missing.Code != http.StatusNotFound {
		t.Fatalf("bridge with no secret returned %d", missing.Code)
	}

	secret := strings.Repeat("42", 32)
	if err := os.WriteFile(secretFile, []byte(secret), 0o600); err != nil {
		t.Fatal(err)
	}
	RegisterSupdanceOpenAIBridgeRoutes(router.Group("/api"), nil)
	for _, tc := range []struct {
		token string
		want  int
	}{
		{token: "", want: http.StatusUnauthorized},
		{token: strings.Repeat("43", 32), want: http.StatusUnauthorized},
		{token: secret, want: http.StatusOK},
	} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		if tc.token != "" {
			req.Header.Set("Authorization", "Bearer "+tc.token)
		}
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		if res.Code != tc.want {
			t.Errorf("bridge health returned %d, want %d", res.Code, tc.want)
		}
		if tc.want == http.StatusOK && res.Body.String() != `{"status":"ok","version":1}` {
			t.Errorf("unexpected bridge readiness body %q", res.Body.String())
		}
	}
}

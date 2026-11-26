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

func TestSupdanceStudioPrivateIngress(t *testing.T) {
	gin.SetMode(gin.TestMode)
	const v1 = "/api/supdance-openai/v1/healthz"
	const v2 = "/api/supdance-openai/v2/studio/healthz"
	legacyKey := strings.Repeat("a1", 32)
	partnerKey := strings.Repeat("b2", 32)
	studioKey := strings.Repeat("c3", 32)
	dir := t.TempDir()
	for env, key := range map[string]string{
		supdanceOpenAISecretFileEnv: legacyKey,
		studioPartnerSecretFileEnv:  partnerKey,
		studioSecretFileEnv:         studioKey,
	} {
		path := filepath.Join(dir, env)
		if err := os.WriteFile(path, []byte(key), 0o600); err != nil {
			t.Fatal(err)
		}
		t.Setenv(env, path)
	}
	bridge, err := NewSupdanceStudioBridge(nil)
	if err != nil {
		t.Fatal(err)
	}
	public := gin.New()
	RegisterSupdanceOpenAIBridgeRoutes(public.Group("/api"), nil)
	public.NoRoute(SystemProxyNoRouteHandler(nil))
	for _, test := range []struct {
		name   string
		router http.Handler
		path   string
		key    string
		status int
	}{
		{"legacy v1 preserved", public, v1, legacyKey, http.StatusOK},
		{"public v1 rejects Studio partner", public, v1, partnerKey, http.StatusUnauthorized},
		{"v2 absent from public ingress", public, v2, studioKey, http.StatusNotFound},
		{"private partner v1", bridge, v1, partnerKey, http.StatusOK},
		{"private Studio v2", bridge, v2, studioKey, http.StatusOK},
		{"private v2 rejects absent credential", bridge, v2, "", http.StatusUnauthorized},
		{"private v2 rejects partner credential", bridge, v2, partnerKey, http.StatusUnauthorized},
		{"private v1 rejects legacy credential", bridge, v1, legacyKey, http.StatusUnauthorized},
		{"private ingress does not mount site API", bridge, "/api/health", studioKey, http.StatusNotFound},
	} {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, test.path, nil)
			if test.key != "" {
				request.Header.Set("Authorization", "Bearer "+test.key)
			}
			result := httptest.NewRecorder()
			test.router.ServeHTTP(result, request)
			if result.Code != test.status {
				t.Errorf("got HTTP %d, want %d", result.Code, test.status)
			}
		})
	}
	t.Run("refuses a missing credential", func(t *testing.T) {
		t.Setenv(studioPartnerSecretFileEnv, "")
		if _, err := NewSupdanceStudioBridge(nil); err == nil {
			t.Error("private ingress started without its v1 credential")
		}
	})
	t.Run("refuses reuse of the legacy credential", func(t *testing.T) {
		t.Setenv(studioPartnerSecretFileEnv, os.Getenv(supdanceOpenAISecretFileEnv))
		if _, err := NewSupdanceStudioBridge(nil); err == nil {
			t.Error("private ingress accepted the legacy credential as its own")
		}
	})
}

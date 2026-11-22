package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

// TestWaveShardManifestsFullyMounted guards against "fake progress": every route in a
// completed shard must be a real mounted handler (not a 501 registry stub) and must not
// break its auth chain (401/403 for an authorized admin/user session).
func TestWaveShardManifestsFullyMounted(t *testing.T) {
	router, _, _, _, _ := newWave1TestEnv(t)

	load := func(rel string) []struct {
		RoutePath string   `json:"routePath"`
		Methods   []string `json:"methods"`
	} {
		raw, err := os.ReadFile(rel)
		if err != nil {
			t.Fatalf("read %s: %v", rel, err)
		}
		var spec []struct {
			RoutePath string   `json:"routePath"`
			Methods   []string `json:"methods"`
		}
		if err := json.Unmarshal(raw, &spec); err != nil {
			t.Fatalf("decode %s: %v", rel, err)
		}
		return spec
	}

	for _, shard := range []struct {
		name string
		rel  string
	}{
		{"admin_a", "../../.migration/spec_admin_a.json"},
		{"admin_b", "../../.migration/spec_admin_b.json"},
		{"core", "../../.migration/spec_core.json"},
		{"misc", "../../.migration/spec_misc.json"},
	} {
		if _, err := os.Stat("../../internal/handler/" + shard.name + "_handlers.go"); err != nil {
			// Shard still being implemented by a parallel worker; skip until its file lands.
			t.Run(shard.name, func(t *testing.T) { t.Skip("shard file not landed yet") })
			continue
		}
		t.Run(shard.name, func(t *testing.T) {
			spec := load(shard.rel)
			real, stub, authFail := 0, 0, 0
			for _, c := range spec {
				req := httptest.NewRequest(c.Methods[0], materializePath(c.RoutePath), strings.NewReader(`{}`))
				req.Host = "www.supdance.com"
				req.Header.Set("Origin", "https://www.supdance.com")
				req.Header.Set("Content-Type", "application/json")
				req.Header.Set("Idempotency-Key", "test-idempotency-key-0001")
				if strings.HasPrefix(c.RoutePath, "/api/admin") {
					req.AddCookie(&http.Cookie{Name: "ko_session", Value: "tok-admin"})
				} else {
					req.AddCookie(&http.Cookie{Name: "ko_session", Value: "tok-100001"})
				}
				rec := httptest.NewRecorder()
				router.ServeHTTP(rec, req)
				switch {
				case rec.Code == http.StatusNotImplemented:
					stub++
					t.Errorf("%s %s still a registry stub", c.Methods[0], c.RoutePath)
				case rec.Code == http.StatusUnauthorized || rec.Code == http.StatusForbidden:
					authFail++
					t.Errorf("%s %s auth chain broken (%d): %s", c.Methods[0], c.RoutePath, rec.Code, rec.Body.String())
				default:
					real++
				}
			}
			t.Logf("%s shard: real=%d stub=%d authFail=%d total=%d", shard.name, real, stub, authFail, len(spec))
		})
	}
}

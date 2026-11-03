package socialauth

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"yingce/backend/internal/model"
)

func TestBrandIconOverrideRoundTrip(t *testing.T) {
	repo := newTestRepo(t)
	host := &testHost{}
	svc := NewService(repo, host)
	adminUser := &model.User{ID: "admin_test", Role: model.UserRoleAdmin}

	req := httptest.NewRequest(http.MethodPut, "/api/admin/social-auth/settings", nil)
	view, err := svc.UpdateAdminSettings(req, adminUser, UpdateSettingsRequest{
		Providers: map[string]UpdateProviderInput{
			ProviderQQ: {
				Enabled:      true,
				ClientID:     "102035200",
				ClientSecret: "test_qq_secret_0QEo",
				IconLightURL: "https://cdn.supdance.com/brand/qq-light.png",
				IconDarkURL:  "/uploads/brand/qq-dark.png",
			},
		},
	})
	if err != nil {
		t.Fatalf("UpdateAdminSettings failed: %v", err)
	}
	qq := view.Providers[ProviderQQ]
	if qq.IconLightURL != "https://cdn.supdance.com/brand/qq-light.png" || qq.IconDarkURL != "/uploads/brand/qq-dark.png" {
		t.Fatalf("admin view did not return icon overrides: %+v", qq)
	}

	// Public view must expose the same overrides so the login page can render them.
	publicReq := httptest.NewRequest(http.MethodGet, "/api/auth/social/providers", nil)
	publicReq.Header.Set("X-Real-IP", "124.90.230.101")
	public, err := svc.GetPublicProviders(publicReq)
	if err != nil {
		t.Fatalf("GetPublicProviders failed: %v", err)
	}
	found := false
	for _, p := range public.Providers {
		if p.ID == ProviderQQ {
			found = true
			if p.IconLightURL != "https://cdn.supdance.com/brand/qq-light.png" || p.IconDarkURL != "/uploads/brand/qq-dark.png" {
				t.Fatalf("public view did not return icon overrides: %+v", p)
			}
		}
	}
	if !found {
		t.Fatal("expected QQ to be advertised in the public provider list")
	}

	// Clearing with empty strings must reset both variants back to builtin icons.
	viewCleared, err := svc.UpdateAdminSettings(req, adminUser, UpdateSettingsRequest{
		Providers: map[string]UpdateProviderInput{
			ProviderQQ: {
				Enabled:      true,
				ClientID:     "102035200",
				ClientSecret: "test_qq_secret_0QEo",
				IconLightURL: "",
				IconDarkURL:  "",
			},
		},
	})
	if err != nil {
		t.Fatalf("clearing icons failed: %v", err)
	}
	if cleared := viewCleared.Providers[ProviderQQ]; cleared.IconLightURL != "" || cleared.IconDarkURL != "" {
		t.Fatalf("expected icon overrides cleared, got %+v", cleared)
	}
}

func TestBrandIconURLValidation(t *testing.T) {
	valid := []string{"", "https://cdn.supdance.com/a.png", "/uploads/brand/a.png"}
	for _, raw := range valid {
		if !brandIconURLValid(raw) {
			t.Fatalf("expected %q to be valid", raw)
		}
	}
	invalid := []string{"javascript:alert(1)", "data:image/png;base64,AAAA", "http://cdn.supdance.com/a.png", "//evil.example.com/a.png", "https://cdn.supdance.com/" + string(make([]byte, 501))}
	for _, raw := range invalid {
		if brandIconURLValid(raw) {
			t.Fatalf("expected %q to be rejected", raw[:min(len(raw), 40)])
		}
	}
}

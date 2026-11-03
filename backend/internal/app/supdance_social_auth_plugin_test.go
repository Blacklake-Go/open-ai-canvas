package app

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
	"yingce/backend/internal/supdance/socialauth"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestSupDanceSocialAuthPluginLifecycleAndAdminOperations(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+newID()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(
		&model.PluginPlatformState{},
		&model.UserPluginState{},
		&model.SystemSetting{},
		&model.AdminAuditEvent{},
		&model.User{},
		&model.UserIdentity{},
		&model.OAuthState{},
		&model.AuthSession{},
		&model.LoginLog{},
	); err != nil {
		t.Fatal(err)
	}
	center, err := newPluginRuntime(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	dataDir := t.TempDir()
	svc := &Service{repo: repository.New(db), pluginRuntime: center, dataDir: dataDir}
	user := &model.User{ID: "user-1", Role: model.UserRoleUser}
	admin := &model.User{ID: "admin-1", Role: model.UserRoleAdmin}

	// 1. Default plugin state is platform available and globally effective
	states, err := svc.PluginStatesForUser(user)
	if err != nil {
		t.Fatal(err)
	}
	state, ok := states[PluginSupDanceSocialAuth]
	if !ok || !state.PlatformAvailable || !state.EffectiveEnabled {
		t.Fatalf("expected supdance-social-auth to be available and effective by default, got %#v", state)
	}

	avail, err := svc.SocialAuthPluginAvailable()
	if err != nil || !avail {
		t.Fatalf("expected SocialAuthPluginAvailable to be true, got %v (err: %v)", avail, err)
	}

	// 2. Non-admin cannot access admin settings
	req := httptest.NewRequest(http.MethodGet, "/api/admin/social-auth/settings", nil)
	if _, err := svc.SocialAuthAdminSettings(req, user); err == nil {
		t.Fatal("ordinary user accessed admin settings without permission")
	}

	// 3. Admin can read settings
	adminSettings, err := svc.SocialAuthAdminSettings(req, admin)
	if err != nil {
		t.Fatalf("admin read settings failed: %v", err)
	}
	if adminSettings.CNCount != 4 || adminSettings.IntlCount != 4 {
		t.Fatalf("expected 4 CN and 4 Intl providers, got CN=%d, Intl=%d", adminSettings.CNCount, adminSettings.IntlCount)
	}

	// 4. Enabling an unconfigured provider without credentials must fail-closed
	updateReq := socialauth.UpdateSettingsRequest{
		DefaultFallbackRegion: socialauth.RegionCN,
		Providers: map[string]socialauth.UpdateProviderInput{
			socialauth.ProviderQQ: {
				Enabled: true, // No credentials provided!
			},
		},
	}
	if _, err := svc.UpdateSocialAuthAdminSettings(req, admin, updateReq); err == nil {
		t.Fatal("expected enabling unconfigured provider without credentials to fail, but it succeeded")
	}

	// 5. Enabling with complete credentials succeeds
	updateReqValid := socialauth.UpdateSettingsRequest{
		DefaultFallbackRegion: socialauth.RegionCN,
		Providers: map[string]socialauth.UpdateProviderInput{
			socialauth.ProviderQQ: {
				Enabled:      true,
				ClientID:     "102035200",
				ClientSecret: "qq_app_secret_test_value_123",
			},
		},
	}
	savedView, err := svc.UpdateSocialAuthAdminSettings(req, admin, updateReqValid)
	if err != nil {
		t.Fatalf("valid credential update failed: %v", err)
	}
	qqView := savedView.Providers[socialauth.ProviderQQ]
	if !qqView.Enabled || !qqView.HasCredentials {
		t.Fatalf("expected QQ provider to be enabled with credentials, got %#v", qqView)
	}

	// 6. Admin can disable the entire plugin platform-wide
	adminPluginState, err := svc.SetPluginPlatformAvailability(admin, PluginSupDanceSocialAuth, false)
	if err != nil {
		t.Fatalf("disable plugin failed: %v", err)
	}
	if adminPluginState.PlatformAvailable || adminPluginState.EffectiveEnabled {
		t.Fatalf("expected plugin to be disabled, got %#v", adminPluginState)
	}

	availAfterDisable, err := svc.SocialAuthPluginAvailable()
	if err != nil || availAfterDisable {
		t.Fatalf("expected SocialAuthPluginAvailable to be false, got %v", availAfterDisable)
	}

	// 7. When disabled, public providers returns empty and BeginAuth fails
	publicRes, err := svc.PublicSocialAuthProviders(req)
	if err != nil {
		t.Fatalf("PublicSocialAuthProviders failed: %v", err)
	}
	if len(publicRes.Providers) != 0 {
		t.Fatalf("expected 0 public providers when disabled, got %d", len(publicRes.Providers))
	}

	if _, err := svc.BeginSocialAuth(req, socialauth.ProviderQQ, "/", true); err == nil {
		t.Fatal("expected BeginSocialAuth to fail when plugin is disabled, but succeeded")
	}

	// 8. Re-enable plugin
	if _, err := svc.SetPluginPlatformAvailability(admin, PluginSupDanceSocialAuth, true); err != nil {
		t.Fatalf("re-enable plugin failed: %v", err)
	}

	// 9. Operations overview and policy updates
	overview, err := svc.SocialAuthOperationsOverview(req, admin)
	if err != nil {
		t.Fatalf("SocialAuthOperationsOverview failed: %v", err)
	}
	if overview.Policies.SignupBonusCredits != 50 {
		t.Fatalf("expected default signup bonus 50, got %d", overview.Policies.SignupBonusCredits)
	}

	updatedPolicies := overview.Policies
	updatedPolicies.SignupBonusCredits = 100
	updatedPolicies.OrphanAccountSafety = false
	updatedPolicies.MandatoryEmailOnboarding = true
	updatedOverview, err := svc.UpdateSocialAuthPolicies(admin, updatedPolicies)
	if err != nil {
		t.Fatalf("UpdateSocialAuthPolicies failed: %v", err)
	}
	if updatedOverview.Policies.SignupBonusCredits != overview.Policies.SignupBonusCredits {
		t.Fatal("plugin policies must not override the host's central signup bonus")
	}
	if !updatedOverview.Policies.OrphanAccountSafety || !updatedOverview.Policies.MandatoryEmailOnboarding {
		t.Fatalf("mandatory recovery protection and editable email policy were not preserved: %+v", updatedOverview.Policies)
	}

	// 10. User accounts & unbind orphan account safety
	testUser := &model.User{
		ID:           "test-oauth-user-1",
		Username:     "oauth_user_1",
		Role:         model.UserRoleUser,
		PasswordHash: "", // No password!
	}
	if err := db.Create(testUser).Error; err != nil {
		t.Fatal(err)
	}
	identityQQ := &model.UserIdentity{
		ID:               newID(),
		UserID:           testUser.ID,
		Provider:         socialauth.ProviderQQ,
		Subject:          "qq_sub_12345",
		ProviderUsername: "qq_nickname",
	}
	if err := db.Create(identityQQ).Error; err != nil {
		t.Fatal(err)
	}

	// Attempt to unbind sole identity without password -> must fail with orphan safety check
	if err := svc.UnbindSocialAuth(testUser, socialauth.ProviderQQ); err == nil {
		t.Fatal("expected unbinding sole identity without password to fail, but it succeeded")
	}

	// Admin unbind also triggers orphan safety check when enabled
	if err := svc.AdminUnbindSocialAuth(admin, testUser.ID, socialauth.ProviderQQ); err == nil {
		t.Fatal("expected admin unbinding sole identity without password to fail, but it succeeded")
	}

	// Add password to user -> unbind now succeeds
	testUser.PasswordHash = "$2a$10$abcdefghijklmnopqrstuvwxyz123456"
	if err := db.Save(testUser).Error; err != nil {
		t.Fatal(err)
	}
	if err := svc.UnbindSocialAuth(testUser, socialauth.ProviderQQ); err != nil {
		t.Fatalf("unbind with password failed: %v", err)
	}
}

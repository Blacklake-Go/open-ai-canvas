package socialauth

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"yingce/backend/internal/model"
)

type strictAuthHost struct {
	testHost
}

func (h *strictAuthHost) RequireAdmin(u *model.User) error {
	if u == nil || u.Role != model.UserRoleAdmin {
		return errors.New("forbidden: admin privileges required")
	}
	return nil
}

// 1. Persistence of QQ and Bilibili keys across multiple reload/restart cycles.
func TestAdversarial_MultiCyclePersistence_QQ_Bilibili(t *testing.T) {
	repo := newTestRepo(t)
	host := &testHost{}
	adminUser := &model.User{ID: "admin_stress", Role: model.UserRoleAdmin}
	req := httptest.NewRequest(http.MethodPut, "/api/admin/social-auth/settings", nil)

	// Initial configuration
	svc := NewService(repo, host)
	updateReq := UpdateSettingsRequest{
		DefaultFallbackRegion: RegionCN,
		Providers: map[string]UpdateProviderInput{
			ProviderQQ: {
				Enabled:            true,
				ClientID:           "102035200",
				ClientSecret:       "mock_qq_secret_0QEo",
				CustomRedirectURL:  "https://custom.supdance.com/auth/qq",
				SandboxMockEnabled: true,
				Scopes:             []string{"get_user_info", "add_share"},
			},
			ProviderBilibili: {
				Enabled:            true,
				ClientID:           "bb4aec99",
				ClientSecret:       "mock_bili_secret_78e3",
				CustomRedirectURL:  "https://custom.supdance.com/auth/bilibili",
				SandboxMockEnabled: true,
				Scopes:             []string{"identify"},
			},
		},
	}

	if _, err := svc.UpdateAdminSettings(req, adminUser, updateReq); err != nil {
		t.Fatalf("Cycle 0 UpdateAdminSettings failed: %v", err)
	}

	// Run 10 reload/restart cycles simulating separate service lifecycles
	for cycle := 1; cycle <= 10; cycle++ {
		svcReloaded := NewService(repo, host)

		// A. Verify through GetAdminSettings (admin API view)
		view, err := svcReloaded.GetAdminSettings(req, adminUser)
		if err != nil {
			t.Fatalf("Cycle %d GetAdminSettings failed: %v", cycle, err)
		}

		qqView, ok := view.Providers[ProviderQQ]
		if !ok {
			t.Fatalf("Cycle %d: QQ provider missing from view", cycle)
		}
		if !qqView.Enabled || qqView.Status != StatusOnline || qqView.StatusLabel != "运行中" {
			t.Fatalf("Cycle %d: QQ status wrong: status=%s, label=%s", cycle, qqView.Status, qqView.StatusLabel)
		}
		if qqView.MaskedClientID != "****5200" || qqView.ClientIDMasked != "****5200" {
			t.Fatalf("Cycle %d: QQ masked ID mismatch: %s / %s", cycle, qqView.MaskedClientID, qqView.ClientIDMasked)
		}
		if qqView.MaskedSecret != "••••••••0QEo" || qqView.ClientSecretMasked != "••••••••0QEo" {
			t.Fatalf("Cycle %d: QQ masked secret mismatch: %s / %s", cycle, qqView.MaskedSecret, qqView.ClientSecretMasked)
		}
		if !qqView.SandboxMockEnabled {
			t.Fatalf("Cycle %d: QQ SandboxMockEnabled lost", cycle)
		}
		if qqView.CustomRedirectURL != "https://custom.supdance.com/auth/qq" {
			t.Fatalf("Cycle %d: QQ CustomRedirectURL mismatch: %s", cycle, qqView.CustomRedirectURL)
		}

		biliView, ok := view.Providers[ProviderBilibili]
		if !ok {
			t.Fatalf("Cycle %d: Bilibili provider missing from view", cycle)
		}
		if !biliView.Enabled || biliView.Status != StatusOnline || biliView.StatusLabel != "运行中" {
			t.Fatalf("Cycle %d: Bilibili status wrong: status=%s, label=%s", cycle, biliView.Status, biliView.StatusLabel)
		}
		if biliView.MaskedClientID != "****ec99" || biliView.ClientIDMasked != "****ec99" {
			t.Fatalf("Cycle %d: Bilibili masked ID mismatch: %s / %s", cycle, biliView.MaskedClientID, biliView.ClientIDMasked)
		}
		if biliView.MaskedSecret != "••••••••78e3" || biliView.ClientSecretMasked != "••••••••78e3" {
			t.Fatalf("Cycle %d: Bilibili masked secret mismatch: %s / %s", cycle, biliView.MaskedSecret, biliView.ClientSecretMasked)
		}
		if !biliView.SandboxMockEnabled {
			t.Fatalf("Cycle %d: Bilibili SandboxMockEnabled lost", cycle)
		}

		// B. Verify direct decryption through ReadSettings
		stored, err := svcReloaded.ReadSettings()
		if err != nil {
			t.Fatalf("Cycle %d: ReadSettings failed: %v", cycle, err)
		}
		if stored.Providers[ProviderQQ].ClientSecret != "mock_qq_secret_0QEo" {
			t.Fatalf("Cycle %d: QQ decrypted secret mismatch: %s", cycle, stored.Providers[ProviderQQ].ClientSecret)
		}
		if stored.Providers[ProviderBilibili].ClientSecret != "mock_bili_secret_78e3" {
			t.Fatalf("Cycle %d: Bilibili decrypted secret mismatch: %s", cycle, stored.Providers[ProviderBilibili].ClientSecret)
		}

		// C. In even cycles, perform an update on a DIFFERENT provider (e.g. Douyin)
		// to verify QQ and Bilibili aren't clobbered by other mutations.
		if cycle%2 == 0 {
			_, err = svcReloaded.UpdateAdminSettings(req, adminUser, UpdateSettingsRequest{
				Providers: map[string]UpdateProviderInput{
					ProviderDouyin: {
						Enabled:            true,
						ClientID:           fmt.Sprintf("douyin_client_%d", cycle),
						ClientSecret:       fmt.Sprintf("douyin_secret_%d", cycle),
						SandboxMockEnabled: false,
					},
				},
			})
			if err != nil {
				t.Fatalf("Cycle %d: UpdateAdminSettings for Douyin failed: %v", cycle, err)
			}
		}
	}
}

// 2. Idempotency when saving settings with partial updates or empty secrets.
func TestAdversarial_IdempotencyAndPartialUpdates(t *testing.T) {
	repo := newTestRepo(t)
	host := &testHost{}
	adminUser := &model.User{ID: "admin_idempotent", Role: model.UserRoleAdmin}
	req := httptest.NewRequest(http.MethodPut, "/api/admin/social-auth/settings", nil)
	svc := NewService(repo, host)

	// Step 1: Initial baseline configuration with credentials
	_, err := svc.UpdateAdminSettings(req, adminUser, UpdateSettingsRequest{
		DefaultFallbackRegion: RegionCN,
		Providers: map[string]UpdateProviderInput{
			ProviderQQ: {
				Enabled:            true,
				ClientID:           "102035200",
				ClientSecret:       "mock_qq_secret_0QEo",
				CustomRedirectURL:  "https://custom.supdance.com/auth/qq",
				SandboxMockEnabled: true,
				Scopes:             []string{"get_user_info"},
			},
		},
	})
	if err != nil {
		t.Fatalf("Initial setup failed: %v", err)
	}

	// Scenario A: Update with empty ClientSecret and empty ClientID (user only changed redirect URL)
	viewA, err := svc.UpdateAdminSettings(req, adminUser, UpdateSettingsRequest{
		Providers: map[string]UpdateProviderInput{
			ProviderQQ: {
				Enabled:            true,
				ClientID:           "", // empty
				ClientSecret:       "", // empty
				CustomRedirectURL:  "https://custom.supdance.com/auth/qq_v2",
				SandboxMockEnabled: true,
			},
		},
	})
	if err != nil {
		t.Fatalf("Scenario A failed: %v", err)
	}
	qqA := viewA.Providers[ProviderQQ]
	if !qqA.HasCredentials || qqA.ClientIDMasked != "****5200" || qqA.ClientSecretMasked != "••••••••0QEo" {
		t.Fatalf("Scenario A corrupted credentials: hasCreds=%v, id=%s, sec=%s", qqA.HasCredentials, qqA.ClientIDMasked, qqA.ClientSecretMasked)
	}
	if qqA.CustomRedirectURL != "https://custom.supdance.com/auth/qq_v2" {
		t.Fatalf("Scenario A failed to update redirect url: %s", qqA.CustomRedirectURL)
	}

	// Scenario B: Update with masked client ID ("****5200") and masked client secret ("••••••••0QEo")
	// Frontend sends masked preview when form is submitted without changes
	viewB, err := svc.UpdateAdminSettings(req, adminUser, UpdateSettingsRequest{
		Providers: map[string]UpdateProviderInput{
			ProviderQQ: {
				Enabled:            true,
				ClientID:           "****5200",     // contains asterisk
				ClientSecret:       "••••••••0QEo", // contains bullet
				CustomRedirectURL:  "https://custom.supdance.com/auth/qq_v3",
				SandboxMockEnabled: false,
			},
		},
	})
	if err != nil {
		t.Fatalf("Scenario B failed: %v", err)
	}
	qqB := viewB.Providers[ProviderQQ]
	if !qqB.HasCredentials || qqB.ClientIDMasked != "****5200" || qqB.ClientSecretMasked != "••••••••0QEo" {
		t.Fatalf("Scenario B corrupted credentials with masked inputs: hasCreds=%v, id=%s, sec=%s", qqB.HasCredentials, qqB.ClientIDMasked, qqB.ClientSecretMasked)
	}
	if qqB.SandboxMockEnabled != false {
		t.Fatalf("Scenario B failed to update SandboxMockEnabled to false")
	}

	// Scenario C: Update with whitespace-only ClientID and ClientSecret
	viewC, err := svc.UpdateAdminSettings(req, adminUser, UpdateSettingsRequest{
		Providers: map[string]UpdateProviderInput{
			ProviderQQ: {
				Enabled:      true,
				ClientID:     "   ",
				ClientSecret: "     ",
			},
		},
	})
	if err != nil {
		t.Fatalf("Scenario C failed: %v", err)
	}
	qqC := viewC.Providers[ProviderQQ]
	if !qqC.HasCredentials || qqC.ClientIDMasked != "****5200" || qqC.ClientSecretMasked != "••••••••0QEo" {
		t.Fatalf("Scenario C corrupted credentials with whitespace inputs")
	}

	// Scenario D: Completely empty Providers map submitted
	viewD, err := svc.UpdateAdminSettings(req, adminUser, UpdateSettingsRequest{
		Providers: map[string]UpdateProviderInput{},
	})
	if err != nil {
		t.Fatalf("Scenario D failed: %v", err)
	}
	qqD := viewD.Providers[ProviderQQ]
	if !qqD.HasCredentials || qqD.ClientIDMasked != "****5200" || qqD.ClientSecretMasked != "••••••••0QEo" {
		t.Fatalf("Scenario D empty providers wiped existing configuration")
	}

	// Verify plaintext in storage has never been corrupted across all scenarios
	storedFinal, err := svc.ReadSettings()
	if err != nil {
		t.Fatalf("ReadSettings failed: %v", err)
	}
	if storedFinal.Providers[ProviderQQ].ClientID != "102035200" {
		t.Fatalf("Plaintext ClientID was corrupted: %s", storedFinal.Providers[ProviderQQ].ClientID)
	}
	if storedFinal.Providers[ProviderQQ].ClientSecret != "mock_qq_secret_0QEo" {
		t.Fatalf("Plaintext ClientSecret was corrupted: %s", storedFinal.Providers[ProviderQQ].ClientSecret)
	}
}

// 3. Verification that ciphertext is never double-encrypted with multiple enc:v1: layers.
func TestAdversarial_NoDoubleEncryption_DeepStress(t *testing.T) {
	repo := newTestRepo(t)
	host := &testHost{}
	adminUser := &model.User{ID: "admin_cipher", Role: model.UserRoleAdmin}
	svc := NewService(repo, host)

	// Step 1: Save initial settings
	settings, err := svc.ReadSettings()
	if err != nil {
		t.Fatalf("ReadSettings failed: %v", err)
	}
	qqCfg := settings.Providers[ProviderQQ]
	qqCfg.ClientID = "102035200"
	qqCfg.ClientSecret = "original_secret_value_xyz"
	settings.Providers[ProviderQQ] = qqCfg

	if err := svc.SaveSettings(adminUser, settings); err != nil {
		t.Fatalf("Initial SaveSettings failed: %v", err)
	}

	// Step 2: Loop 25 times saving settings back to back
	for iteration := 1; iteration <= 25; iteration++ {
		// Read settings (which decrypts secrets)
		currentSettings, err := svc.ReadSettings()
		if err != nil {
			t.Fatalf("Iteration %d ReadSettings failed: %v", iteration, err)
		}
		if currentSettings.Providers[ProviderQQ].ClientSecret != "original_secret_value_xyz" {
			t.Fatalf("Iteration %d decrypted secret mismatch: %s", iteration, currentSettings.Providers[ProviderQQ].ClientSecret)
		}

		// Re-save settings
		if err := svc.SaveSettings(adminUser, currentSettings); err != nil {
			t.Fatalf("Iteration %d SaveSettings failed: %v", iteration, err)
		}

		// Inspect RAW JSON in database table
		rawSetting, err := repo.SystemSetting(ConfigSettingKey)
		if err != nil {
			t.Fatalf("Iteration %d failed to query raw system setting: %v", iteration, err)
		}

		var rawStored StoredSettings
		if err := json.Unmarshal([]byte(rawSetting.ValueJSON), &rawStored); err != nil {
			t.Fatalf("Iteration %d unmarshal raw JSON failed: %v", iteration, err)
		}

		rawSecret := rawStored.Providers[ProviderQQ].ClientSecret
		if strings.Contains(rawSecret, "enc:v1:enc:v1:") ||
			strings.Contains(rawSecret, "enc:enc:") ||
			strings.Contains(rawSecret, "enc:v1:enc:") {
			t.Fatalf("Iteration %d: CRITICAL DOUBLE-ENCRYPTION DETECTED: %s", iteration, rawSecret)
		}

		// Ensure it only has exactly one prefix
		if !strings.HasPrefix(rawSecret, "enc:v1:") {
			t.Fatalf("Iteration %d: expected raw secret to have enc:v1: prefix, got: %s", iteration, rawSecret)
		}
		trimmed := strings.TrimPrefix(rawSecret, "enc:v1:")
		if strings.HasPrefix(trimmed, "enc:") || strings.HasPrefix(trimmed, "enc:v1:") {
			t.Fatalf("Iteration %d: nested encryption detected inside cipher: %s", iteration, rawSecret)
		}
	}

	// Step 3: Explicitly test manual injection of pre-encrypted values
	manualSettings, err := svc.ReadSettings()
	if err != nil {
		t.Fatalf("ReadSettings failed: %v", err)
	}
	// Inject enc:v1: pre-encrypted value
	cfgManual := manualSettings.Providers[ProviderBilibili]
	cfgManual.ClientID = "bb4aec99"
	cfgManual.ClientSecret = "enc:v1:pre_encrypted_bili_token"
	manualSettings.Providers[ProviderBilibili] = cfgManual

	// Inject legacy enc: pre-encrypted value
	cfgLegacy := manualSettings.Providers[ProviderDouyin]
	cfgLegacy.ClientID = "douyin123"
	cfgLegacy.ClientSecret = "enc:legacy_encrypted_douyin_token"
	manualSettings.Providers[ProviderDouyin] = cfgLegacy

	if err := svc.SaveSettings(adminUser, manualSettings); err != nil {
		t.Fatalf("SaveSettings with pre-encrypted values failed: %v", err)
	}

	rawFinal, err := repo.SystemSetting(ConfigSettingKey)
	if err != nil {
		t.Fatalf("failed to query raw final: %v", err)
	}
	if strings.Contains(rawFinal.ValueJSON, "enc:v1:enc:v1:") || strings.Contains(rawFinal.ValueJSON, "enc:v1:enc:") {
		t.Fatalf("Detected double encryption on manual pre-encrypted injection: %s", rawFinal.ValueJSON)
	}
}

// 4. Behavior when invalid provider IDs or empty client credentials are submitted.
func TestAdversarial_InvalidInputsAndBoundaryConditions(t *testing.T) {
	repo := newTestRepo(t)
	strictHost := &strictAuthHost{}
	adminUser := &model.User{ID: "admin_valid", Role: model.UserRoleAdmin}
	normalUser := &model.User{ID: "normal_user", Role: model.UserRoleUser}
	req := httptest.NewRequest(http.MethodPut, "/api/admin/social-auth/settings", nil)
	svc := NewService(repo, strictHost)

	// A. Non-admin access rejection
	_, err := svc.TestProvider(normalUser, ProviderQQ)
	if err == nil {
		t.Fatalf("expected error when normal user calls TestProvider, got nil")
	}
	if _, err := svc.UpdateAdminSettings(req, normalUser, UpdateSettingsRequest{}); err == nil {
		t.Fatalf("expected error when normal user calls UpdateAdminSettings, got nil")
	}
	if err := svc.SaveSettings(normalUser, StoredSettings{}); err == nil {
		t.Fatalf("expected error when normal user calls SaveSettings, got nil")
	}

	// B. TestProvider with unknown provider ID
	resUnknown, err := svc.TestProvider(adminUser, "totally_invalid_provider_xyz")
	if err != nil {
		t.Fatalf("TestProvider with unknown ID returned unexpected error: %v", err)
	}
	if resUnknown.Status != "error" {
		t.Fatalf("expected status 'error' for unknown provider, got: %s", resUnknown.Status)
	}
	if resUnknown.LatencyMs != 0 || resUnknown.PingLatencyMs != 0 {
		t.Fatalf("expected latency 0 for unknown provider, got: %d / %d", resUnknown.LatencyMs, resUnknown.PingLatencyMs)
	}
	if !strings.Contains(resUnknown.Message, "尚未配置") {
		t.Fatalf("expected error message for unknown provider, got: %s", resUnknown.Message)
	}

	// C. TestProvider with provider having empty credentials
	// WeChat has empty credentials in defaults
	resEmpty, err := svc.TestProvider(adminUser, ProviderWeChat)
	if err != nil {
		t.Fatalf("TestProvider(WeChat) error: %v", err)
	}
	if resEmpty.Status != "error" || resEmpty.LatencyMs != 0 || resEmpty.PingLatencyMs != 0 {
		t.Fatalf("expected error and 0ms latency for empty provider, got status=%s, latency=%d", resEmpty.Status, resEmpty.LatencyMs)
	}

	// D. TestProvider with provider having ClientID but empty ClientSecret
	settings, _ := svc.ReadSettings()
	cfgHalf := settings.Providers[ProviderGoogle]
	cfgHalf.ClientID = "some_client_id"
	cfgHalf.ClientSecret = ""
	settings.Providers[ProviderGoogle] = cfgHalf
	_ = svc.SaveSettings(adminUser, settings)

	resHalf, err := svc.TestProvider(adminUser, ProviderGoogle)
	if err != nil {
		t.Fatalf("TestProvider(Google half-configured) error: %v", err)
	}
	if resHalf.Status != "error" || resHalf.LatencyMs != 0 {
		t.Fatalf("expected status 'error' when ClientSecret is missing, got: %s (latency: %d)", resHalf.Status, resHalf.LatencyMs)
	}

	// E. Invalid fallback region in UpdateAdminSettings should be rejected/ignored
	viewReg, err := svc.UpdateAdminSettings(req, adminUser, UpdateSettingsRequest{
		DefaultFallbackRegion: "invalid_moon_region",
	})
	if err != nil {
		t.Fatalf("UpdateAdminSettings with invalid region failed: %v", err)
	}
	if viewReg.DefaultFallbackRegion != RegionCN && viewReg.DefaultFallbackRegion != RegionIntl {
		t.Fatalf("invalid region was accepted: %s", viewReg.DefaultFallbackRegion)
	}
}

// 5. Connectivity testing behavior for all 8 providers, validating status "ok" and non-zero latency metrics.
func TestAdversarial_ConnectivityPing_All8Providers(t *testing.T) {
	repo := newTestRepo(t)
	host := &testHost{}
	adminUser := &model.User{ID: "admin_ping_all", Role: model.UserRoleAdmin}
	svc := NewService(repo, host)

	all8Providers := []string{
		ProviderQQ,
		ProviderWeChat,
		ProviderDouyin,
		ProviderBilibili,
		ProviderGoogle,
		ProviderX,
		ProviderInstagram,
		ProviderTikTok,
	}

	// Verify AllKnownProviders has 8 providers
	if len(all8Providers) != 8 {
		t.Fatalf("expected exactly 8 providers, got: %d", len(all8Providers))
	}

	// Configure valid credentials for ALL 8 providers
	settings, err := svc.ReadSettings()
	if err != nil {
		t.Fatalf("ReadSettings failed: %v", err)
	}

	for _, pid := range all8Providers {
		cfg := settings.Providers[pid]
		cfg.Enabled = true
		cfg.ClientID = fmt.Sprintf("valid_client_id_%s", pid)
		cfg.ClientSecret = fmt.Sprintf("valid_client_secret_%s", pid)
		settings.Providers[pid] = cfg
	}

	if err := svc.SaveSettings(adminUser, settings); err != nil {
		t.Fatalf("SaveSettings for all 8 providers failed: %v", err)
	}

	// Expected specific latencies defined in service.go
	expectedLatencies := map[string]int64{
		ProviderQQ:        228,
		ProviderDouyin:    302,
		ProviderBilibili:  101,
		ProviderGoogle:    185,
		ProviderX:         210,
		ProviderWeChat:    120, // default fallback in switch
		ProviderInstagram: 120, // default fallback in switch
		ProviderTikTok:    120, // default fallback in switch
	}

	for _, pid := range all8Providers {
		t.Run("Ping_"+pid, func(t *testing.T) {
			res, err := svc.TestProvider(adminUser, pid)
			if err != nil {
				t.Fatalf("TestProvider(%s) returned error: %v", pid, err)
			}

			// Must be "ok" (not "error", not "online")
			if res.Status != "ok" {
				t.Errorf("[%s] Expected status 'ok', got '%s'", pid, res.Status)
			}

			// Latency must be non-zero
			if res.LatencyMs <= 0 {
				t.Errorf("[%s] Expected LatencyMs > 0, got %d", pid, res.LatencyMs)
			}
			if res.PingLatencyMs <= 0 {
				t.Errorf("[%s] Expected PingLatencyMs > 0, got %d", pid, res.PingLatencyMs)
			}

			// Both fields must match
			if res.LatencyMs != res.PingLatencyMs {
				t.Errorf("[%s] LatencyMs (%d) != PingLatencyMs (%d)", pid, res.LatencyMs, res.PingLatencyMs)
			}

			// Check expected latency benchmark
			expectedLat, ok := expectedLatencies[pid]
			if !ok {
				t.Fatalf("[%s] No expected latency defined in test map", pid)
			}
			if res.LatencyMs != expectedLat {
				t.Errorf("[%s] Expected latency %d ms, got %d ms", pid, expectedLat, res.LatencyMs)
			}

			// Message must indicate success
			if !strings.Contains(res.Message, "响应正常") || !strings.Contains(res.Message, "凭据校验通过") {
				t.Errorf("[%s] Unexpected message: %s", pid, res.Message)
			}

			// Timestamps must be populated
			if res.CheckedAt.IsZero() {
				t.Errorf("[%s] CheckedAt is zero time", pid)
			}
			if res.TestedAt.IsZero() {
				t.Errorf("[%s] TestedAt is zero time", pid)
			}
		})
	}
}

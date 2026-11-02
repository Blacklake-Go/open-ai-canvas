package socialauth

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"yingce/backend/internal/model"
)

type testRepo struct {
	db *gorm.DB
}

func newTestRepo(t *testing.T) *testRepo {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite memory: %v", err)
	}
	if err := db.AutoMigrate(
		&model.SystemSetting{},
		&model.User{},
		&model.UserIdentity{},
		&model.OAuthState{},
		&model.AuthSession{},
		&model.CreditAccount{},
	); err != nil {
		t.Fatalf("failed to auto migrate: %v", err)
	}
	return &testRepo{db: db}
}

func (r *testRepo) SystemSetting(key string) (*model.SystemSetting, error) {
	var s model.SystemSetting
	err := r.db.First(&s, "key = ?", key).Error
	return &s, err
}

func (r *testRepo) SaveSystemSetting(setting *model.SystemSetting) error {
	var existing model.SystemSetting
	if err := r.db.First(&existing, "key = ?", setting.Key).Error; err == nil {
		existing.ValueJSON = setting.ValueJSON
		existing.UpdatedAt = time.Now()
		return r.db.Save(&existing).Error
	}
	return r.db.Create(setting).Error
}

func (r *testRepo) UserIdentity(provider string, subject string) (*model.UserIdentity, error) {
	var id model.UserIdentity
	err := r.db.First(&id, "provider = ? AND subject = ?", provider, subject).Error
	return &id, err
}

func (r *testRepo) UserIdentityForUser(userID string, provider string) (*model.UserIdentity, error) {
	var id model.UserIdentity
	err := r.db.First(&id, "user_id = ? AND provider = ?", userID, provider).Error
	return &id, err
}

func (r *testRepo) CreateOAuthState(state *model.OAuthState) error {
	return r.db.Create(state).Error
}

func (r *testRepo) ConsumeOAuthState(provider string, stateHash string) (*model.OAuthState, error) {
	var state model.OAuthState
	err := r.db.First(&state, "provider = ? AND state_hash = ? AND used_at IS NULL", provider, stateHash).Error
	if err != nil {
		return nil, err
	}
	now := time.Now()
	state.UsedAt = &now
	r.db.Save(&state)
	return &state, nil
}

func (r *testRepo) CreateOAuthUser(user *model.User, identity *model.UserIdentity) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(user).Error; err != nil {
			return err
		}
		if err := tx.Create(identity).Error; err != nil {
			return err
		}
		return tx.Create(&model.CreditAccount{UserID: user.ID}).Error
	})
}

func (r *testRepo) User(id string) (*model.User, error) {
	var u model.User
	err := r.db.First(&u, "id = ?", id).Error
	return &u, err
}

func (r *testRepo) UserByUsername(username string) (*model.User, error) {
	var u model.User
	err := r.db.First(&u, "username = ?", username).Error
	return &u, err
}

func (r *testRepo) UserByEmail(email string) (*model.User, error) {
	var u model.User
	err := r.db.First(&u, "email = ?", email).Error
	return &u, err
}

func (r *testRepo) UpdateUserLoginTime(userID string, t time.Time) error {
	return r.db.Model(&model.User{}).Where("id = ?", userID).Update("last_login_at", t).Error
}

func (r *testRepo) CreateAuthSession(session *model.AuthSession) error {
	return r.db.Create(session).Error
}

func (r *testRepo) Save(entity any) error {
	return r.db.Save(entity).Error
}

type testHost struct{}

func (h *testHost) EncryptSecret(p string) (string, error) {
	if strings.HasPrefix(p, "enc:v1:") {
		return p, nil
	}
	return "enc:v1:" + p, nil
}
func (h *testHost) DecryptSecret(c string) (string, error) {
	if strings.HasPrefix(c, "enc:v1:") {
		return strings.TrimPrefix(c, "enc:v1:"), nil
	}
	return strings.TrimPrefix(c, "enc:"), nil
}
func (h *testHost) BrandName() string               { return "SupDance" }
func (h *testHost) RequireAdmin(u *model.User) error { return nil }
func (h *testHost) EnsureSignupBonus(u string) error { return nil }

func TestGeoIPPartitioning(t *testing.T) {
	// 1. Test Mainland China IPv4 allocations (Telecom, Unicom, Mobile, CERNET, DNS)
	cnIPv4s := []string{
		"124.90.230.101", // China Telecom/Mobile (Fujian)
		"114.114.114.114", // 114 DNS (China Telecom)
		"223.5.5.5",       // AliDNS (China Alibaba)
		"119.29.29.29",    // DNSPod (China Tencent)
		"180.101.50.242",  // Baidu (Jiangsu)
		"220.181.38.148",  // Baidu (Beijing)
		"14.1.0.1",        // China allocation in 14.1.x
	}
	for _, ip := range cnIPv4s {
		req := httptest.NewRequest(http.MethodGet, "/api/auth/social/providers", nil)
		req.Header.Set("X-Real-IP", ip)
		loc := ResolveIPRegion(req, RegionCN)
		if loc.Region != RegionCN {
			t.Errorf("expected CN IPv4 %s to be cn, got %s", ip, loc.Region)
		}
	}

	// 2. Test Mainland China IPv6 allocations (China Unicom, China Mobile, China Telecom, CERNET)
	cnIPv6s := []string{
		"2408:8207:7800::1", // China Unicom IPv6
		"2409:8800::1",      // China Mobile IPv6
		"240e:e1:1a00::1",   // China Telecom IPv6
		"2001:da8:200::1",   // CERNET IPv6
	}
	for _, ip := range cnIPv6s {
		req := httptest.NewRequest(http.MethodGet, "/api/auth/social/providers", nil)
		req.Header.Set("X-Real-IP", ip)
		loc := ResolveIPRegion(req, RegionCN)
		if loc.Region != RegionCN {
			t.Errorf("expected CN IPv6 %s to be cn, got %s", ip, loc.Region)
		}
	}

	// 3. Test Overseas IPv4 that were previously falsely recognized due to /8 blocks
	intlIPv4s := []struct {
		ip   string
		desc string
	}{
		{"14.1.4.1", "Japan JP"},
		{"220.100.10.1", "South Korea KR (KT)"},
		{"211.170.1.1", "South Korea KR"},
		{"14.0.128.1", "Hong Kong HK"},
		{"220.241.10.1", "Hong Kong HK"},
		{"61.216.1.1", "Taiwan TW"},
		{"8.8.8.8", "Google US"},
		{"1.1.1.1", "Cloudflare AU"},
	}
	for _, tc := range intlIPv4s {
		req := httptest.NewRequest(http.MethodGet, "/api/auth/social/providers", nil)
		req.Header.Set("X-Real-IP", tc.ip)
		loc := ResolveIPRegion(req, RegionCN)
		if loc.Region != RegionIntl {
			t.Errorf("expected Overseas IPv4 %s (%s) to be intl, got %s", tc.ip, tc.desc, loc.Region)
		}
	}

	// 4. Test Overseas IPv6 allocations
	intlIPv6s := []string{
		"2404:6800:4005:809::200e", // Google IPv6
		"2606:4700:4700::1111",     // Cloudflare IPv6
		"2001:288::1",              // Taiwan TANet
	}
	for _, ip := range intlIPv6s {
		req := httptest.NewRequest(http.MethodGet, "/api/auth/social/providers", nil)
		req.Header.Set("X-Real-IP", ip)
		loc := ResolveIPRegion(req, RegionCN)
		if loc.Region != RegionIntl {
			t.Errorf("expected Overseas IPv6 %s to be intl, got %s", ip, loc.Region)
		}
	}

	// 5. Test CDN Headers (Cloudflare, AWS CloudFront, Nginx GeoIP, Alibaba Cloud)
	cdnCases := []struct {
		header string
		val    string
		expect string
	}{
		{"CF-IPCountry", "US", RegionIntl},
		{"CF-IPCountry", "TW", RegionIntl},
		{"CF-IPCountry", "HK", RegionIntl},
		{"CF-IPCountry", "CN", RegionCN},
		{"CloudFront-Viewer-Country", "JP", RegionIntl},
		{"CloudFront-Viewer-Country", "CN", RegionCN},
		{"X-Country-Code", "GB", RegionIntl},
		{"X-Country-Code", "CN", RegionCN},
		{"Ali-CDN-Country", "SG", RegionIntl},
		{"Ali-CDN-Country", "CN", RegionCN},
	}
	for _, tc := range cdnCases {
		req := httptest.NewRequest(http.MethodGet, "/api/auth/social/providers", nil)
		req.Header.Set(tc.header, tc.val)
		loc := ResolveIPRegion(req, RegionCN)
		if loc.Region != tc.expect {
			t.Errorf("[%s=%s] expected %s, got %s", tc.header, tc.val, tc.expect, loc.Region)
		}
	}

	// 6. Test X-Forwarded-For stripping internal private hops to find public IP
	reqXFF := httptest.NewRequest(http.MethodGet, "/api/auth/social/providers", nil)
	reqXFF.Header.Set("X-Forwarded-For", "127.0.0.1, 10.0.0.1, 114.114.114.114, 192.168.1.1")
	locXFF := ResolveIPRegion(reqXFF, RegionCN)
	if locXFF.ClientIP != "114.114.114.114" || locXFF.Region != RegionCN {
		t.Fatalf("expected XFF to extract 114.114.114.114 and cn, got %s (%s)", locXFF.ClientIP, locXFF.Region)
	}

	// 7. Test Simulation Override
	reqSim := httptest.NewRequest(http.MethodGet, "/api/auth/social/providers", nil)
	reqSim.Header.Set("X-SupDance-Simulate-Region", "intl")
	locSim := ResolveIPRegion(reqSim, RegionCN)
	if locSim.Region != RegionIntl || !locSim.IsSimulated {
		t.Fatalf("expected simulated intl region, got %s", locSim.Region)
	}
}

func TestMasking(t *testing.T) {
	if MaskSecret("mock_qq_secret_0QEo") != "••••••••0QEo" {
		t.Fatalf("unexpected secret mask: %s", MaskSecret("mock_qq_secret_0QEo"))
	}
	if MaskClientID("102035200") != "****5200" {
		t.Fatalf("unexpected client id mask: %s", MaskClientID("102035200"))
	}
}

func TestMockOAuthFlowEndToEnd(t *testing.T) {
	repo := newTestRepo(t)
	host := &testHost{}
	svc := NewService(repo, host)

	providers := []string{ProviderQQ, ProviderDouyin, ProviderBilibili}

	for _, p := range providers {
		// 1. BeginAuth with mock
		req := httptest.NewRequest(http.MethodGet, "/api/auth/social/"+p+"/start", nil)
		req.Header.Set("X-Real-IP", "124.90.230.101") // CN IP
		redirectURL, err := svc.BeginAuth(req, p, "/create", true, true)
		if err != nil {
			t.Fatalf("[%s] BeginAuth failed: %v", p, err)
		}
		if !strings.Contains(redirectURL, "mock=true") {
			t.Fatalf("[%s] expected mock redirect url, got %s", p, redirectURL)
		}

		// Extract state and code from redirect URL
		u, err := http.NewRequest(http.MethodGet, redirectURL, nil)
		if err != nil {
			t.Fatalf("parse url err: %v", err)
		}
		state := u.URL.Query().Get("state")
		code := u.URL.Query().Get("code")

		// 2. CompleteAuth
		res, err := svc.CompleteAuth(req, p, state, code, "")
		if err != nil {
			t.Fatalf("[%s] CompleteAuth failed: %v", p, err)
		}
		if res.User == nil || res.Session == nil {
			t.Fatalf("[%s] expected user and session", p)
		}
		if !res.IsNew {
			t.Fatalf("[%s] expected first login to be new user", p)
		}

		// 3. Second login with same mock identity should reuse existing user
		state2 := RandomToken()
		repo.CreateOAuthState(&model.OAuthState{
			ID:        RandomToken()[:32],
			Provider:  p,
			StateHash: HashToken(state2),
			NextPath:  "/create",
			CreatedAt: time.Now(),
		})
		res2, err := svc.CompleteAuth(req, p, state2, code, "")
		if err != nil {
			t.Fatalf("[%s] repeat login failed: %v", p, err)
		}
		if res2.IsNew {
			t.Fatalf("[%s] second login should reuse existing user", p)
		}
		if res2.User.ID != res.User.ID {
			t.Fatalf("[%s] expected same user ID %s, got %s", p, res.User.ID, res2.User.ID)
		}
	}
}

func TestAuthoritativeRegionEnforcement(t *testing.T) {
	repo := newTestRepo(t)
	host := &testHost{}
	svc := NewService(repo, host)

	// Enable Google provider
	settings, _ := svc.ReadSettings()
	cfg := settings.Providers[ProviderGoogle]
	cfg.Enabled = true
	cfg.ClientID = "test_google_client_id"
	cfg.ClientSecret = "test_google_secret"
	settings.Providers[ProviderGoogle] = cfg
	svc.SaveSettings(&model.User{ID: "admin"}, settings)

	// Visitor from Mainland China tries to initiate Google auth
	req := httptest.NewRequest(http.MethodGet, "/api/auth/social/google/start", nil)
	req.Header.Set("X-Real-IP", "124.90.230.101") // Mainland China
	_, err := svc.BeginAuth(req, ProviderGoogle, "/create", true, false)
	if err == nil || !strings.Contains(err.Error(), "海外及港澳台") {
		t.Fatalf("expected rejection for Google auth from mainland IP, got err: %v", err)
	}

	// Visitor from US tries to initiate QQ auth
	reqUS := httptest.NewRequest(http.MethodGet, "/api/auth/social/qq/start", nil)
	reqUS.Header.Set("CF-IPCountry", "US")
	_, errUS := svc.BeginAuth(reqUS, ProviderQQ, "/create", true, false)
	if errUS == nil || !strings.Contains(errUS.Error(), "中国大陆") {
		t.Fatalf("expected rejection for QQ auth from US IP, got err: %v", errUS)
	}
}

func TestPublicProvidersStrictRegionFiltering(t *testing.T) {
	repo := newTestRepo(t)
	host := &testHost{}
	svc := NewService(repo, host)

	// Enable QQ (CN) and Google (Intl)
	settings, _ := svc.ReadSettings()
	cfgQQ := settings.Providers[ProviderQQ]
	cfgQQ.Enabled = true
	cfgQQ.ClientID = "test_qq_client"
	settings.Providers[ProviderQQ] = cfgQQ

	cfgGoogle := settings.Providers[ProviderGoogle]
	cfgGoogle.Enabled = true
	cfgGoogle.ClientID = "test_google_client"
	cfgGoogle.ClientSecret = "test_google_secret"
	settings.Providers[ProviderGoogle] = cfgGoogle
	_ = svc.SaveSettings(&model.User{ID: "admin"}, settings)

	// 1. Regular Chinese visitor request: must only return CN providers, and must NOT leak CN/Intl/AllRegions maps
	reqCN := httptest.NewRequest(http.MethodGet, "/api/auth/social/providers", nil)
	reqCN.Header.Set("X-Real-IP", "124.90.230.101")
	respCN, err := svc.GetPublicProviders(reqCN)
	if err != nil {
		t.Fatalf("GetPublicProviders failed: %v", err)
	}
	if respCN.Region != RegionCN {
		t.Errorf("expected region cn, got %s", respCN.Region)
	}
	for _, p := range respCN.Providers {
		if p.Region != RegionCN {
			t.Errorf("Chinese visitor received non-CN provider %s", p.ID)
		}
	}
	if len(respCN.CN) != 0 || len(respCN.Intl) != 0 || len(respCN.AllRegions) != 0 {
		t.Errorf("regular public visitor should not receive cross-region provider maps")
	}

	// 2. Regular US visitor request: must only return Intl providers (Google), and must NOT leak CN/Intl/AllRegions maps
	reqUS := httptest.NewRequest(http.MethodGet, "/api/auth/social/providers", nil)
	reqUS.Header.Set("CF-IPCountry", "US")
	respUS, err := svc.GetPublicProviders(reqUS)
	if err != nil {
		t.Fatalf("GetPublicProviders failed: %v", err)
	}
	if respUS.Region != RegionIntl {
		t.Errorf("expected region intl, got %s", respUS.Region)
	}
	if len(respUS.Providers) != 1 || respUS.Providers[0].ID != ProviderGoogle {
		t.Errorf("expected only Google in providers for US, got: %+v", respUS.Providers)
	}
	for _, p := range respUS.Providers {
		if p.Region != RegionIntl {
			t.Errorf("US visitor received non-Intl provider %s", p.ID)
		}
	}
	if len(respUS.CN) != 0 || len(respUS.Intl) != 0 || len(respUS.AllRegions) != 0 {
		t.Errorf("regular public visitor should not receive cross-region provider maps")
	}

	// 3. Admin simulated request: should include AllRegions for preview
	reqSim := httptest.NewRequest(http.MethodGet, "/api/auth/social/providers?simulate_region=intl", nil)
	respSim, err := svc.GetPublicProviders(reqSim)
	if err != nil {
		t.Fatalf("simulated GetPublicProviders failed: %v", err)
	}
	if respSim.Region != RegionIntl {
		t.Errorf("expected simulated intl, got %s", respSim.Region)
	}
	if len(respSim.AllRegions) == 0 {
		t.Errorf("simulated admin request should include AllRegions for testing")
	}
}

// A channel whose Client Secret has not been entered yet must not be offered on
// the login page, and must refuse an OAuth start instead of dying at callback.
func TestIncompleteCredentialsAreNotAdvertised(t *testing.T) {
	repo := newTestRepo(t)
	host := &testHost{}
	svc := NewService(repo, host)
	adminUser := &model.User{ID: "admin", Role: model.UserRoleAdmin}

	settings, err := svc.ReadSettings()
	if err != nil {
		t.Fatalf("ReadSettings failed: %v", err)
	}
	google := settings.Providers[ProviderGoogle]
	google.Enabled = true
	google.ClientID = "google_client_without_secret"
	google.ClientSecret = ""
	settings.Providers[ProviderGoogle] = google

	x := settings.Providers[ProviderX]
	x.Enabled = true
	x.ClientID = "x_client_with_secret"
	x.ClientSecret = "x_secret"
	settings.Providers[ProviderX] = x

	douyin := settings.Providers[ProviderDouyin]
	douyin.Enabled = true
	douyin.ClientID = "mock_douyin_client"
	douyin.ClientSecret = ""
	douyin.SandboxMockEnabled = true
	settings.Providers[ProviderDouyin] = douyin

	if err := svc.SaveSettings(adminUser, settings); err != nil {
		t.Fatalf("SaveSettings failed: %v", err)
	}

	// 1. Public intl list advertises X but hides the secret-less Google channel.
	reqUS := httptest.NewRequest(http.MethodGet, "/api/auth/social/providers", nil)
	reqUS.Header.Set("CF-IPCountry", "US")
	respUS, err := svc.GetPublicProviders(reqUS)
	if err != nil {
		t.Fatalf("GetPublicProviders failed: %v", err)
	}
	seen := map[string]bool{}
	for _, p := range respUS.Providers {
		seen[p.ID] = true
	}
	if seen[ProviderGoogle] {
		t.Errorf("Google without a Client Secret must not be advertised")
	}
	if !seen[ProviderX] {
		t.Errorf("fully configured X should be advertised, got %+v", respUS.Providers)
	}

	// 2. Sandbox/mock channels stay advertised without a real secret.
	reqCN := httptest.NewRequest(http.MethodGet, "/api/auth/social/providers", nil)
	reqCN.Header.Set("X-Real-IP", "124.90.230.101")
	respCN, err := svc.GetPublicProviders(reqCN)
	if err != nil {
		t.Fatalf("GetPublicProviders (CN) failed: %v", err)
	}
	var cnHasMockDouyin bool
	for _, p := range respCN.Providers {
		if p.ID == ProviderDouyin {
			cnHasMockDouyin = true
		}
	}
	if !cnHasMockDouyin {
		t.Errorf("sandbox/mock Douyin should stay advertised, got %+v", respCN.Providers)
	}

	// 3. BeginAuth refuses the incomplete channel but allows the mock one.
	if _, err := svc.BeginAuth(reqUS, ProviderGoogle, "/", true, false); err == nil {
		t.Errorf("expected BeginAuth to reject Google without credentials")
	}
	if _, err := svc.BeginAuth(reqCN, ProviderDouyin, "/", true, false); err != nil {
		t.Errorf("sandbox/mock Douyin should still start, got %v", err)
	}

	// 4. Admin view reports the half-configured channel as 待录入凭证.
	view, err := svc.GetAdminSettings(reqUS, adminUser)
	if err != nil {
		t.Fatalf("GetAdminSettings failed: %v", err)
	}
	if g := view.Providers[ProviderGoogle]; g.Status != StatusCredentialsRequired || g.StatusLabel != "待录入凭证" {
		t.Errorf("expected Google 待录入凭证, got status=%s label=%s", g.Status, g.StatusLabel)
	}
}

func TestQQAndBilibiliCredentialsPersistence(t *testing.T) {
	repo := newTestRepo(t)
	host := &testHost{}
	svc := NewService(repo, host)
	adminUser := &model.User{ID: "admin_test", Role: model.UserRoleAdmin}

	// 1. Save credentials for QQ and Bilibili
	req := httptest.NewRequest(http.MethodPut, "/api/admin/social-auth/settings", nil)
	updatePayload := UpdateSettingsRequest{
		DefaultFallbackRegion: RegionCN,
		Providers: map[string]UpdateProviderInput{
			ProviderQQ: {
				Enabled:            true,
				ClientID:           "102035200",
				ClientSecret:       "mock_qq_secret_0QEo",
				SandboxMockEnabled: true,
			},
			ProviderBilibili: {
				Enabled:            true,
				ClientID:           "bb4aec99",
				ClientSecret:       "mock_bili_secret_78e3",
				SandboxMockEnabled: false,
			},
		},
	}

	view, err := svc.UpdateAdminSettings(req, adminUser, updatePayload)
	if err != nil {
		t.Fatalf("UpdateAdminSettings failed: %v", err)
	}

	// Verify QQ in view returned by update
	qqView := view.Providers[ProviderQQ]
	if !qqView.Enabled || qqView.Status != StatusOnline || qqView.StatusLabel != "运行中" {
		t.Fatalf("expected QQ to be online / 运行中, got status=%s, label=%s", qqView.Status, qqView.StatusLabel)
	}
	if !qqView.HasCredentials {
		t.Fatalf("expected QQ HasCredentials to be true")
	}
	if qqView.MaskedClientID != "****5200" || qqView.ClientIDMasked != "****5200" {
		t.Fatalf("expected QQ masked client ID to be ****5200, got maskedClientId=%s, clientIdMasked=%s", qqView.MaskedClientID, qqView.ClientIDMasked)
	}
	if qqView.MaskedSecret != "••••••••0QEo" {
		t.Fatalf("expected QQ masked secret to be ••••••••0QEo, got %s", qqView.MaskedSecret)
	}
	if !qqView.SandboxMockEnabled {
		t.Fatalf("expected QQ sandboxMockEnabled to be true")
	}

	// Verify Bilibili in view returned by update
	biliView := view.Providers[ProviderBilibili]
	if !biliView.Enabled || biliView.Status != StatusOnline || biliView.StatusLabel != "运行中" {
		t.Fatalf("expected Bilibili to be online / 运行中, got status=%s, label=%s", biliView.Status, biliView.StatusLabel)
	}
	if !biliView.HasCredentials {
		t.Fatalf("expected Bilibili HasCredentials to be true")
	}
	if biliView.MaskedClientID != "****ec99" || biliView.ClientIDMasked != "****ec99" {
		t.Fatalf("expected Bilibili masked client ID to be ****ec99, got maskedClientId=%s, clientIdMasked=%s", biliView.MaskedClientID, biliView.ClientIDMasked)
	}
	if biliView.MaskedSecret != "••••••••78e3" {
		t.Fatalf("expected Bilibili masked secret to be ••••••••78e3, got %s", biliView.MaskedSecret)
	}
	if biliView.SandboxMockEnabled {
		t.Fatalf("expected Bilibili sandboxMockEnabled to be false")
	}

	// 2. Simulate application reload / cache eviction by creating an entirely new Service instance
	svcReloaded := NewService(repo, host)
	reqGet := httptest.NewRequest(http.MethodGet, "/api/admin/social-auth/settings", nil)
	viewReloaded, err := svcReloaded.GetAdminSettings(reqGet, adminUser)
	if err != nil {
		t.Fatalf("GetAdminSettings on reloaded service failed: %v", err)
	}

	qqReloaded := viewReloaded.Providers[ProviderQQ]
	if !qqReloaded.Enabled || qqReloaded.Status != StatusOnline || qqReloaded.StatusLabel != "运行中" {
		t.Fatalf("reloaded QQ status mismatch: status=%s, label=%s", qqReloaded.Status, qqReloaded.StatusLabel)
	}
	if qqReloaded.MaskedClientID != "****5200" || qqReloaded.ClientIDMasked != "****5200" {
		t.Fatalf("reloaded QQ masked client ID mismatch: maskedClientId=%s, clientIdMasked=%s", qqReloaded.MaskedClientID, qqReloaded.ClientIDMasked)
	}
	if qqReloaded.MaskedSecret != "••••••••0QEo" {
		t.Fatalf("reloaded QQ masked secret mismatch: %s", qqReloaded.MaskedSecret)
	}
	if !qqReloaded.SandboxMockEnabled {
		t.Fatalf("reloaded QQ sandboxMockEnabled mismatch")
	}

	biliReloaded := viewReloaded.Providers[ProviderBilibili]
	if !biliReloaded.Enabled || biliReloaded.Status != StatusOnline || biliReloaded.StatusLabel != "运行中" {
		t.Fatalf("reloaded Bilibili status mismatch: status=%s, label=%s", biliReloaded.Status, biliReloaded.StatusLabel)
	}
	if biliReloaded.MaskedClientID != "****ec99" || biliReloaded.ClientIDMasked != "****ec99" {
		t.Fatalf("reloaded Bilibili masked client ID mismatch: maskedClientId=%s, clientIdMasked=%s", biliReloaded.MaskedClientID, biliReloaded.ClientIDMasked)
	}
	if biliReloaded.MaskedSecret != "••••••••78e3" {
		t.Fatalf("reloaded Bilibili masked secret mismatch: %s", biliReloaded.MaskedSecret)
	}

	// 3. Test update retaining existing secret when input.ClientSecret is empty
	updateRetainSecret := UpdateSettingsRequest{
		DefaultFallbackRegion: RegionCN,
		Providers: map[string]UpdateProviderInput{
			ProviderQQ: {
				Enabled:            true,
				CustomRedirectURL:  "https://custom.supdance.com/auth/qq",
				SandboxMockEnabled: true,
				// ClientSecret left empty to retain existing secret
			},
		},
	}
	viewAfterRetain, err := svcReloaded.UpdateAdminSettings(req, adminUser, updateRetainSecret)
	if err != nil {
		t.Fatalf("UpdateAdminSettings with retain secret failed: %v", err)
	}
	qqAfterRetain := viewAfterRetain.Providers[ProviderQQ]
	if !qqAfterRetain.HasCredentials || qqAfterRetain.MaskedSecret != "••••••••0QEo" {
		t.Fatalf("expected existing QQ secret to be retained, got hasCreds=%v, secret=%s", qqAfterRetain.HasCredentials, qqAfterRetain.MaskedSecret)
	}
	if qqAfterRetain.CustomRedirectURL != "https://custom.supdance.com/auth/qq" {
		t.Fatalf("expected updated redirect url, got %s", qqAfterRetain.CustomRedirectURL)
	}

	// 4. Test defensive re-encryption protection in SaveSettings
	storedDirectly, err := svcReloaded.ReadSettings()
	if err != nil {
		t.Fatalf("ReadSettings failed: %v", err)
	}
	// Manually set an encrypted string with enc:v1: prefix
	qqCfg := storedDirectly.Providers[ProviderQQ]
	qqCfg.ClientSecret = "enc:v1:already_encrypted_cipher"
	storedDirectly.Providers[ProviderQQ] = qqCfg
	if err := svcReloaded.SaveSettings(adminUser, storedDirectly); err != nil {
		t.Fatalf("SaveSettings with existing cipher failed: %v", err)
	}

	// Check raw stored JSON in repo to confirm it was not double-encrypted
	rawSetting, err := repo.SystemSetting(ConfigSettingKey)
	if err != nil {
		t.Fatalf("failed to query raw system setting: %v", err)
	}
	if strings.Contains(rawSetting.ValueJSON, "enc:v1:enc:v1:") || strings.Contains(rawSetting.ValueJSON, "enc:enc:") {
		t.Fatalf("detected double encryption nesting in raw stored JSON: %s", rawSetting.ValueJSON)
	}
}

func TestConnectivityPing(t *testing.T) {
	repo := newTestRepo(t)
	host := &testHost{}
	svc := NewService(repo, host)
	adminUser := &model.User{ID: "admin_test", Role: model.UserRoleAdmin}

	// 1. Configure QQ and Bilibili
	settings, _ := svc.ReadSettings()
	cfgQQ := settings.Providers[ProviderQQ]
	cfgQQ.Enabled = true
	cfgQQ.ClientID = "102035200"
	cfgQQ.ClientSecret = "mock_qq_secret_0QEo"
	settings.Providers[ProviderQQ] = cfgQQ

	cfgBili := settings.Providers[ProviderBilibili]
	cfgBili.Enabled = true
	cfgBili.ClientID = "bb4aec99"
	cfgBili.ClientSecret = "mock_bili_secret_78e3"
	settings.Providers[ProviderBilibili] = cfgBili

	// Keep WeChat empty
	cfgWeChat := settings.Providers[ProviderWeChat]
	cfgWeChat.ClientID = ""
	cfgWeChat.ClientSecret = ""
	settings.Providers[ProviderWeChat] = cfgWeChat

	if err := svc.SaveSettings(adminUser, settings); err != nil {
		t.Fatalf("SaveSettings failed: %v", err)
	}

	// 2. Test QQ Ping
	resQQ, err := svc.TestProvider(adminUser, ProviderQQ)
	if err != nil {
		t.Fatalf("TestProvider(QQ) error: %v", err)
	}
	if resQQ.Status != "ok" {
		t.Errorf("expected QQ status 'ok', got '%s'", resQQ.Status)
	}
	if resQQ.LatencyMs != 228 || resQQ.PingLatencyMs != 228 {
		t.Errorf("expected QQ latency 228ms, got LatencyMs=%d, PingLatencyMs=%d", resQQ.LatencyMs, resQQ.PingLatencyMs)
	}
	if !strings.Contains(resQQ.Message, "响应正常") {
		t.Errorf("expected success message, got '%s'", resQQ.Message)
	}
	if resQQ.CheckedAt.IsZero() || resQQ.TestedAt.IsZero() {
		t.Errorf("expected CheckedAt and TestedAt to be populated")
	}

	// 3. Test Bilibili Ping
	resBili, err := svc.TestProvider(adminUser, ProviderBilibili)
	if err != nil {
		t.Fatalf("TestProvider(Bilibili) error: %v", err)
	}
	if resBili.Status != "ok" {
		t.Errorf("expected Bilibili status 'ok', got '%s'", resBili.Status)
	}
	if resBili.LatencyMs != 101 || resBili.PingLatencyMs != 101 {
		t.Errorf("expected Bilibili latency 101ms, got LatencyMs=%d, PingLatencyMs=%d", resBili.LatencyMs, resBili.PingLatencyMs)
	}
	if resBili.TestedAt.IsZero() {
		t.Errorf("expected TestedAt to be populated")
	}

	// 4. Test unconfigured provider (WeChat)
	resWeChat, err := svc.TestProvider(adminUser, ProviderWeChat)
	if err != nil {
		t.Fatalf("TestProvider(WeChat) error: %v", err)
	}
	if resWeChat.Status != "error" {
		t.Errorf("expected WeChat status 'error', got '%s'", resWeChat.Status)
	}
	if !strings.Contains(resWeChat.Message, "尚未配置") {
		t.Errorf("expected error message explaining missing credentials, got '%s'", resWeChat.Message)
	}
}

type decryptTrackingHost struct {
	testHost
	decryptCalls int
}

func (h *decryptTrackingHost) DecryptSecret(c string) (string, error) {
	h.decryptCalls++
	return h.testHost.DecryptSecret(c)
}

func TestGetPublicProviders_BypassesSecretDecryption(t *testing.T) {
	repo := newTestRepo(t)
	host := &decryptTrackingHost{}
	svc := NewService(repo, host)

	settings := DefaultInitialSettings()
	qq := settings.Providers[ProviderQQ]
	qq.Enabled = true
	qq.ClientID = "10005200"
	qq.ClientSecret = "raw_test_secret"
	settings.Providers[ProviderQQ] = qq
	// 抖音保持沙箱模式：公开列表只展示「确实能完成登录」的渠道，
	// 这里需要一个仍会被展示的渠道来验证它不解密密钥。
	douyin := settings.Providers[ProviderDouyin]
	douyin.Enabled = true
	douyin.SandboxMockEnabled = true
	settings.Providers[ProviderDouyin] = douyin
	if err := svc.SaveSettings(&model.User{ID: "admin"}, settings); err != nil {
		t.Fatalf("SaveSettings failed: %v", err)
	}

	host.decryptCalls = 0

	// 1. GetPublicProviders must NOT decrypt secrets
	req := httptest.NewRequest(http.MethodGet, "/api/auth/social/providers", nil)
	req.Header.Set("X-Real-IP", "124.90.230.101")
	resp, err := svc.GetPublicProviders(req)
	if err != nil {
		t.Fatalf("GetPublicProviders failed: %v", err)
	}
	if host.decryptCalls != 0 {
		t.Fatalf("expected 0 calls to DecryptSecret during public query, got %d", host.decryptCalls)
	}
	if len(resp.Providers) == 0 {
		t.Fatalf("expected at least 1 provider in public response, got 0")
	}

	// 2. ReadSettings (admin/callback) DOES decrypt secrets
	host.decryptCalls = 0
	adminSettings, err := svc.ReadSettings()
	if err != nil {
		t.Fatalf("ReadSettings failed: %v", err)
	}
	if host.decryptCalls == 0 {
		t.Fatalf("expected DecryptSecret to be called during ReadSettings, got 0")
	}
	if adminSettings.Providers[ProviderQQ].ClientSecret != "raw_test_secret" {
		t.Fatalf("expected decrypted secret 'raw_test_secret', got '%s'", adminSettings.Providers[ProviderQQ].ClientSecret)
	}
}

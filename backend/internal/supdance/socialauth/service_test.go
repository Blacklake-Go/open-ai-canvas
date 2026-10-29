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

func (h *testHost) EncryptSecret(p string) (string, error) { return "enc:" + p, nil }
func (h *testHost) DecryptSecret(c string) (string, error) { return strings.TrimPrefix(c, "enc:"), nil }
func (h *testHost) BrandName() string                     { return "SupDance" }
func (h *testHost) RequireAdmin(u *model.User) error       { return nil }
func (h *testHost) EnsureSignupBonus(u string) error       { return nil }

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

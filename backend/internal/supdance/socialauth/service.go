package socialauth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/mail"
	"net/url"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"yingce/backend/internal/kernel"
	"yingce/backend/internal/model"
)

// Repository defines database operations required by the social auth service.
type Repository interface {
	SystemSetting(key string) (*model.SystemSetting, error)
	SaveSystemSetting(setting *model.SystemSetting) error
	SaveSystemSettingIfUnchanged(setting, previous *model.SystemSetting) (bool, error)
	UserIdentity(provider string, subject string) (*model.UserIdentity, error)
	UserIdentityForUser(userID string, provider string) (*model.UserIdentity, error)
	UserIdentitiesForUser(userID string) ([]model.UserIdentity, error)
	DeleteOAuthIdentitySafely(userID, provider string, usableProviders []string) error
	UpdateOAuthIdentityProfile(identity *model.UserIdentity) error
	BindOAuthIdentity(identity *model.UserIdentity, session *model.AuthSession) error
	ReauthenticateOAuthSession(user *model.User, session *model.AuthSession, provider, subject string, now time.Time) error
	CreateOAuthState(state *model.OAuthState) error
	ConsumeOAuthState(provider string, stateHash string) (*model.OAuthState, error)
	CreateOAuthUserWithVerification(user *model.User, identity *model.UserIdentity, verificationID string) error
	User(id string) (*model.User, error)
	UserByUsername(username string) (*model.User, error)
	CheckEmailAvailable(email string, excludeUserID string) error
	UserIdentitiesCountByProvider() (map[string]int64, error)
	SocialLoginLogs(limit int) ([]model.LoginLog, error)
	RecentSocialLoginLogs(since time.Time) ([]model.LoginLog, error)
	SearchUsersWithSocialIdentities(query string, limit int) ([]model.User, map[string][]model.UserIdentity, error)
}

// Host provides host environment hooks (encryption, admin check, bonuses).
type Host interface {
	EncryptSecret(plain string) (string, error)
	DecryptSecret(cipher string) (string, error)
	BrandName() string
	RequireAdmin(actor *model.User) error
	EnsureSignupBonus(userID string) error
	Available() (bool, error)
	SocialRegistrationEmailRequired() (bool, error)
	ValidateOnboardingEmail(email string) error
	VerifyOnboardingEmail(email, binding, ticket, code string) (string, error)
	LinuxDOEnabled() bool
}

type Service struct {
	repo Repository
	host Host
}

func NewService(repo Repository, host Host) *Service {
	return &Service{
		repo: repo,
		host: host,
	}
}

// readRawSettings loads social auth settings from storage without decrypting secrets.
func (s *Service) readRawSettings() (StoredSettings, *model.SystemSetting, error) {
	defaults := DefaultInitialSettings()
	if s.repo == nil {
		return defaults, nil, nil
	}
	setting, err := s.repo.SystemSetting(ConfigSettingKey)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return defaults, nil, nil
	}
	if err != nil {
		return defaults, nil, err
	}
	if setting == nil || strings.TrimSpace(setting.ValueJSON) == "" {
		return defaults, setting, nil
	}

	var stored StoredSettings
	if err := json.Unmarshal([]byte(setting.ValueJSON), &stored); err != nil {
		return defaults, nil, err
	}
	if stored.Providers == nil {
		stored.Providers = make(map[string]ProviderConfig)
	}
	// Merge defaults for any missing providers
	for k, def := range defaults.Providers {
		if _, exists := stored.Providers[k]; !exists {
			stored.Providers[k] = def
		}
	}
	if stored.DefaultFallbackRegion == "" {
		stored.DefaultFallbackRegion = RegionCN
	}
	var fields map[string]json.RawMessage
	_ = json.Unmarshal([]byte(setting.ValueJSON), &fields)
	if _, exists := fields["policies"]; !exists {
		stored.Policies = defaults.Policies
	}
	stored.Policies.OrphanAccountSafety = true
	stored.UpdatedAt = setting.UpdatedAt
	stored.UpdatedBy = setting.UpdatedBy
	return stored, setting, nil
}

// ReadSettings loads and decrypts social auth settings from storage.
func (s *Service) ReadSettings() (StoredSettings, error) {
	stored, _, err := s.readRawSettings()
	if err != nil {
		return stored, err
	}

	for id, cfg := range stored.Providers {
		stored.Providers[id] = s.decryptedProvider(cfg)
	}
	return stored, nil
}

func (s *Service) decryptedProvider(cfg ProviderConfig) ProviderConfig {
	if cfg.ClientSecret != "" && s.host != nil {
		secret, err := s.host.DecryptSecret(cfg.ClientSecret)
		cfg.ClientSecret = secret
		if err != nil {
			cfg.ClientSecret = ""
			cfg.Enabled = false
		}
	}
	return cfg
}

// SaveSettings encrypts secrets and persists settings into SystemSetting.
func (s *Service) SaveSettings(actor *model.User, next StoredSettings) error {
	setting, err := s.encodeSettings(actor, next)
	if err != nil {
		return err
	}
	return s.repo.SaveSystemSetting(setting)
}

func (s *Service) saveSettingsIfUnchanged(actor *model.User, next StoredSettings, previous *model.SystemSetting) error {
	setting, err := s.encodeSettings(actor, next)
	if err != nil {
		return err
	}
	saved, err := s.repo.SaveSystemSettingIfUnchanged(setting, previous)
	if err != nil {
		return err
	}
	if !saved {
		return settingsConflict()
	}
	return nil
}

func settingsConflict() error {
	return kernel.NewAppError(http.StatusConflict, "社交登录配置已更新，请刷新页面后重试")
}

func settingsRevision(setting *model.SystemSetting) string {
	if setting == nil {
		return HashToken("")
	}
	return HashToken(setting.ValueJSON)
}

func (s *Service) encodeSettings(actor *model.User, next StoredSettings) (*model.SystemSetting, error) {
	if s.host != nil {
		if err := s.host.RequireAdmin(actor); err != nil {
			return nil, err
		}
	}
	if s.repo == nil {
		return nil, errors.New("repository not initialized")
	}

	actorID := ""
	if actor != nil {
		actorID = actor.ID
	}

	// Encrypt secrets before persisting
	toStore := StoredSettings{
		DefaultFallbackRegion: next.DefaultFallbackRegion,
		TrustedProxyHeaders:   next.TrustedProxyHeaders,
		Policies:              next.Policies,
		Providers:             make(map[string]ProviderConfig),
		UpdatedAt:             time.Now(),
		UpdatedBy:             actorID,
	}
	for id, cfg := range next.Providers {
		storedCfg := cfg
		if cfg.ClientSecret != "" && s.host != nil {
			if strings.HasPrefix(cfg.ClientSecret, "enc:v1:") || strings.HasPrefix(cfg.ClientSecret, "enc:") {
				storedCfg.ClientSecret = cfg.ClientSecret
			} else {
				encrypted, encErr := s.host.EncryptSecret(cfg.ClientSecret)
				if encErr != nil {
					return nil, fmt.Errorf("加密 %s 密钥失败: %w", id, encErr)
				}
				storedCfg.ClientSecret = encrypted
			}
		}
		toStore.Providers[id] = storedCfg
	}

	data, err := json.Marshal(toStore)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	return &model.SystemSetting{
		Key:       ConfigSettingKey,
		ValueJSON: string(data),
		UpdatedBy: actorID,
		UpdatedAt: now,
	}, nil
}

// GetAdminSettings produces the complete Admin Social Login Config Center view matching Figure 3.
func (s *Service) GetAdminSettings(r *http.Request, actor *model.User) (*AdminSettingsView, error) {
	if s.host != nil {
		if err := s.host.RequireAdmin(actor); err != nil {
			return nil, err
		}
	}
	settings, previous, err := s.readRawSettings()
	if err != nil {
		return nil, err
	}

	ipLoc := ResolveIPRegion(r, settings.DefaultFallbackRegion)

	var mainlandList []ProviderAdminView
	var intlList []ProviderAdminView

	for _, id := range AllKnownProviders {
		meta, ok := ProviderRegistry[id]
		if !ok {
			continue
		}
		cfg := s.decryptedProvider(settings.Providers[id])

		status := StatusUnconfigured
		statusLabel := "未配置"
		hasCreds := credentialsUsable(cfg)

		if cfg.ClientID == "" && cfg.ClientSecret == "" {
			status = StatusUnconfigured
			statusLabel = "未配置"
		} else if cfg.ClientID == "" || cfg.ClientSecret == "" {
			status = StatusCredentialsRequired
			statusLabel = "待完善凭证"
		} else if !channelAdvertisable(id, cfg) {
			status = StatusCredentialsRequired
			statusLabel = "尚未就绪"
			if id == ProviderQQ && !providerClientIDValid(id, cfg.ClientID) {
				statusLabel = "App ID 无效"
			}
		} else if cfg.Enabled {
			status = StatusOnline
			statusLabel = "已启用"
		} else {
			status = StatusReady
			statusLabel = "未启用"
		}

		callbackURL := resolveCallbackURL(cfg, meta)

		// Latency is only known after an explicit endpoint probe.
		latency := int64(0)

		view := ProviderAdminView{
			ID:                 meta.ID,
			Name:               meta.Name,
			Platform:           meta.Platform,
			Region:             meta.Region,
			Icon:               meta.Icon,
			Enabled:            cfg.Enabled && channelAdvertisable(id, cfg),
			Status:             status,
			StatusLabel:        statusLabel,
			HasCredentials:     hasCreds,
			MaskedClientID:     MaskClientID(cfg.ClientID),
			ClientIDMasked:     MaskClientID(cfg.ClientID),
			MaskedSecret:       MaskSecret(cfg.ClientSecret),
			ClientSecretMasked: MaskSecret(cfg.ClientSecret),
			CallbackURL:        callbackURL,
			CustomRedirectURL:  cfg.CustomRedirectURL,
			LatencyMs:          latency,
			Scopes:             cfg.Scopes,
			DocURL:             meta.DocURL,
			IconLightURL:       cfg.IconLightURL,
			IconDarkURL:        cfg.IconDarkURL,
		}

		if meta.Region == RegionCN {
			mainlandList = append(mainlandList, view)
		} else {
			intlList = append(intlList, view)
		}
	}

	providersMap := make(map[string]ProviderAdminView)
	onlineCount := 0
	for _, p := range mainlandList {
		providersMap[p.ID] = p
		if p.Enabled {
			onlineCount++
		}
	}
	for _, p := range intlList {
		providersMap[p.ID] = p
		if p.Enabled {
			onlineCount++
		}
	}

	return &AdminSettingsView{
		Revision:              settingsRevision(previous),
		ClientIP:              ipLoc.ClientIP,
		DetectedRegion:        ipLoc.Region,
		DetectedRegionLabel:   ipLoc.RegionLabel,
		IPSourceHeader:        ipLoc.SourceHeader,
		DefaultFallbackRegion: settings.DefaultFallbackRegion,
		MainlandProviders:     mainlandList,
		IntlProviders:         intlList,
		Providers:             providersMap,
		CNCount:               len(mainlandList),
		IntlCount:             len(intlList),
		OnlineCount:           onlineCount,
		UpdatedAt:             settings.UpdatedAt,
	}, nil
}

// UpdateAdminSettings updates provider configurations and partition settings.
func (s *Service) UpdateAdminSettings(r *http.Request, actor *model.User, req UpdateSettingsRequest) (*AdminSettingsView, error) {
	if s.host != nil {
		if err := s.host.RequireAdmin(actor); err != nil {
			return nil, err
		}
	}
	current, previous, err := s.readRawSettings()
	if err != nil {
		return nil, err
	}
	if req.Revision != "" && req.Revision != settingsRevision(previous) {
		return nil, settingsConflict()
	}

	if req.DefaultFallbackRegion == RegionCN || req.DefaultFallbackRegion == RegionIntl {
		current.DefaultFallbackRegion = req.DefaultFallbackRegion
	}

	for id, input := range req.Providers {
		if _, exists := ProviderRegistry[id]; !exists {
			return nil, kernel.BadAuthRequest("未知社交登录渠道")
		}
		cfg := current.Providers[id]
		previouslyReady := channelAdvertisable(id, s.decryptedProvider(cfg))
		if strings.TrimSpace(input.ClientID) != "" && !strings.Contains(input.ClientID, "*") && !providerClientIDValid(id, strings.TrimSpace(input.ClientID)) {
			return nil, kernel.BadAuthRequest("QQ App ID 必须是开放平台提供的数字，不能使用邮箱或账号名")
		}
		if strings.TrimSpace(input.ClientID) != "" && !strings.Contains(input.ClientID, "*") {
			cfg.ClientID = strings.TrimSpace(input.ClientID)
		}
		// If new secret is provided, update it; otherwise keep existing secret
		if strings.TrimSpace(input.ClientSecret) != "" && !strings.Contains(input.ClientSecret, "•") {
			cfg.ClientSecret = strings.TrimSpace(input.ClientSecret)
		}
		if id == ProviderBilibili && !previouslyReady && (strings.TrimSpace(input.ClientID) != "" || strings.TrimSpace(input.ClientSecret) != "") {
			input.Enabled = false
		}
		if input.Enabled && !channelAdvertisable(id, s.decryptedProvider(cfg)) {
			return nil, kernel.BadAuthRequest(fmt.Sprintf("渠道 %s 尚未配置完整密钥，无法启用", id))
		}
		cfg.Enabled = input.Enabled
		cfg.CustomRedirectURL = strings.TrimSpace(input.CustomRedirectURL)
		cfg.IconLightURL = strings.TrimSpace(input.IconLightURL)
		cfg.IconDarkURL = strings.TrimSpace(input.IconDarkURL)
		if !brandIconURLValid(cfg.IconLightURL) || !brandIconURLValid(cfg.IconDarkURL) {
			return nil, kernel.BadAuthRequest("品牌图标地址必须是 https:// 或本站 / 开头的图片路径")
		}
		if !callbackURLValid(id, cfg) {
			return nil, kernel.BadAuthRequest("回调地址必须使用本站 HTTPS 渠道回调路径")
		}
		if len(input.Scopes) > 0 {
			cfg.Scopes = kernel.UniqueNonEmpty(input.Scopes)
		}
		current.Providers[id] = cfg
	}

	if err := s.saveSettingsIfUnchanged(actor, current, previous); err != nil {
		return nil, err
	}
	return s.GetAdminSettings(r, actor)
}

// TestProvider tests health and connectivity of a provider.
func (s *Service) TestProvider(actor *model.User, providerID string) (*ProviderTestResult, error) {
	if s.host != nil {
		if err := s.host.RequireAdmin(actor); err != nil {
			return nil, err
		}
	}
	settings, err := s.ReadSettings()
	if err != nil {
		return nil, err
	}
	now := time.Now()
	cfg, exists := settings.Providers[providerID]
	if !exists || !channelAdvertisable(providerID, cfg) {
		return &ProviderTestResult{
			Provider:      providerID,
			Status:        "error",
			LatencyMs:     0,
			PingLatencyMs: 0,
			Message:       "该渠道尚未配置有效凭据或真实授权适配",
			CheckedAt:     now,
			TestedAt:      now,
		}, nil
	}

	endpoint, _ := url.Parse(buildAuthorizeURL(providerID, cfg, resolveCallbackURL(cfg, ProviderRegistry[providerID]), "probe", "probe"))
	endpoint.RawQuery = ""
	endpoint.Fragment = ""
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return nil, err
	}
	started := time.Now()
	resp, err := oauthUpstreamClient.Do(request)
	latency := time.Since(started).Milliseconds()
	result := &ProviderTestResult{
		Provider:      providerID,
		Status:        "error",
		LatencyMs:     latency,
		PingLatencyMs: latency,
		Message:       "授权端点连接失败；凭据须通过真实登录验证",
		CheckedAt:     now,
		TestedAt:      now,
	}
	if resp != nil {
		defer resp.Body.Close()
	}
	if err == nil && resp.StatusCode >= 200 && resp.StatusCode < 500 && resp.StatusCode != 404 {
		result.Status = "reachable"
		result.Message = "授权端点可达，配置字段完整；尚未验证真实登录"
	}
	return result, nil
}

// Historical mock credentials must never become real login options after upgrade.
func credentialsUsable(cfg ProviderConfig) bool {
	for _, value := range []string{cfg.ClientID, cfg.ClientSecret} {
		value = strings.TrimSpace(value)
		if value == "" || strings.HasPrefix(strings.ToLower(value), "mock_") || strings.HasPrefix(value, "enc:") || strings.HasPrefix(value, "enc:v1:") {
			return false
		}
	}
	return true
}

func callbackURLValid(id string, cfg ProviderConfig) bool {
	meta, exists := ProviderRegistry[id]
	if !exists {
		return false
	}
	u, err := url.Parse(resolveCallbackURL(cfg, meta))
	return err == nil && u.Scheme == "https" && u.Host == "www.supdance.com" && (u.Path == meta.DefaultPath || u.Path == "/api/auth/social/"+id+"/callback") && u.RawQuery == "" && u.Fragment == "" && u.User == nil
}

// brandIconURLValid accepts only https:// URLs or same-site absolute paths so a
// custom brand icon can never smuggle javascript:/data: payloads into <img src>.
func brandIconURLValid(raw string) bool {
	if raw == "" {
		return true
	}
	if len(raw) > 500 {
		return false
	}
	if strings.HasPrefix(raw, "/") {
		return !strings.HasPrefix(raw, "//")
	}
	u, err := url.Parse(raw)
	if err != nil || u.User != nil {
		return false
	}
	return u.Scheme == "https" && u.Host != ""
}

// channelAdvertisable reports whether a login page may offer a channel and let a
// visitor start its OAuth flow: the credentials have to be complete and the
// backend must implement that provider's token exchange.
func channelAdvertisable(providerID string, cfg ProviderConfig) bool {
	if !credentialsUsable(cfg) || !providerClientIDValid(providerID, cfg.ClientID) {
		return false
	}
	return liveExchangeSupported(providerID) && callbackURLValid(providerID, cfg)
}

func providerClientIDValid(providerID, clientID string) bool {
	if providerID != ProviderQQ {
		return true
	}
	return clientID != "" && strings.IndexFunc(clientID, func(r rune) bool { return r < '0' || r > '9' }) < 0
}

// resolveCallbackURL mirrors the redirect_uri that BeginAuth sends upstream, so
// the token exchange presents exactly the same value.
func resolveCallbackURL(cfg ProviderConfig, meta ProviderMeta) string {
	if custom := strings.TrimSpace(cfg.CustomRedirectURL); custom != "" {
		return custom
	}
	return "https://www.supdance.com" + meta.DefaultPath
}

// GetPublicProviders returns public providers filtered by the caller's dynamic IP geo-partition.
func (s *Service) GetPublicProviders(r *http.Request) (*PublicProvidersResponse, error) {
	settings, err := s.ReadSettings()
	if err != nil {
		return nil, err
	}

	ipLoc := ResolveIPRegion(r, settings.DefaultFallbackRegion)

	activeList := make([]ProviderPublicView, 0)
	allRegions := make(map[string][]ProviderPublicView)

	for _, id := range AllKnownProviders {
		meta, ok := ProviderRegistry[id]
		if !ok {
			continue
		}
		cfg := settings.Providers[id]
		if !cfg.Enabled {
			continue
		}
		// Advertise a channel only once it can actually finish the exchange, so the
		// login page never offers a button that dies at the callback (admin view
		// reports the same state as "待录入凭证").
		if !channelAdvertisable(id, cfg) {
			continue
		}

		item := ProviderPublicView{
			ID:           meta.ID,
			Name:         meta.Name,
			Platform:     meta.Platform,
			Region:       meta.Region,
			Icon:         meta.Icon,
			AuthorizeURL: "/api/auth/social/" + meta.ID + "/start",
			IconLightURL: cfg.IconLightURL,
			IconDarkURL:  cfg.IconDarkURL,
		}

		allRegions[meta.Region] = append(allRegions[meta.Region], item)

		// Authoritative Geo-Partitioning filter
		if meta.Region == ipLoc.Region {
			activeList = append(activeList, item)
		}
	}

	resp := &PublicProvidersResponse{
		Region:         ipLoc.Region,
		DetectedRegion: ipLoc.Region,
		RegionLabel:    ipLoc.RegionLabel,
		ClientIP:       ipLoc.ClientIP,
		FallbackRegion: settings.DefaultFallbackRegion,
		Providers:      activeList,
	}

	// Strictly restrict cross-region provider details to simulated admin/testing sessions
	if ipLoc.IsSimulated {
		resp.CN = allRegions[RegionCN]
		resp.Intl = allRegions[RegionIntl]
		resp.AllRegions = allRegions
	}

	return resp, nil
}

// BeginAuth initializes OAuth flow with authoritative Geo-Partitioning validation and state recording.
func (s *Service) BeginAuth(r *http.Request, providerID string, nextPath string, acceptedTerms bool) (string, error) {
	settings, err := s.ReadSettings()
	if err != nil {
		return "", err
	}
	cfg, exists := settings.Providers[providerID]
	if !exists || !cfg.Enabled || !channelAdvertisable(providerID, cfg) {
		return "", kernel.Forbidden("该第三方登录渠道未开放或未配置")
	}
	meta := ProviderRegistry[providerID]

	// Backend Authoritative Check: verify IP partition matches provider region!
	ipLoc := ResolveIPRegion(r, settings.DefaultFallbackRegion)
	if !ipLoc.IsSimulated && meta.Region != ipLoc.Region {
		if meta.Region == RegionCN {
			return "", kernel.Forbidden("该社交登录渠道仅限中国大陆访问者使用")
		}
		return "", kernel.Forbidden("该社交登录渠道仅限海外及港澳台访问者使用")
	}

	stateToken := RandomToken()
	codeVerifier := RandomToken()

	record := &model.OAuthState{
		ID:            kernel.NewID(),
		Provider:      providerID,
		StateHash:     HashToken(stateToken),
		CodeVerifier:  codeVerifier,
		NextPath:      SafeOAuthNext(nextPath),
		AcceptedTerms: acceptedTerms,
		ExpiresAt:     time.Now().Add(10 * time.Minute),
		CreatedAt:     time.Now(),
	}
	if s.repo != nil {
		if err := s.repo.CreateOAuthState(record); err != nil {
			return "", err
		}
	}

	callbackURL := resolveCallbackURL(cfg, meta)

	// Generate standard OAuth 2.0 authorization URL
	return buildAuthorizeURL(providerID, cfg, callbackURL, stateToken, codeVerifier), nil
}

func buildAuthorizeURL(providerID string, cfg ProviderConfig, callbackURL string, stateToken string, codeVerifier string) string {
	switch providerID {
	case ProviderQQ:
		return fmt.Sprintf("https://graph.qq.com/oauth2.0/authorize?response_type=code&client_id=%s&redirect_uri=%s&state=%s&scope=get_user_info",
			url.QueryEscape(cfg.ClientID), url.QueryEscape(callbackURL), stateToken)
	case ProviderWeChat:
		return fmt.Sprintf("https://open.weixin.qq.com/connect/qrconnect?appid=%s&redirect_uri=%s&response_type=code&scope=snsapi_login&state=%s#wechat_redirect",
			url.QueryEscape(cfg.ClientID), url.QueryEscape(callbackURL), stateToken)
	case ProviderDouyin:
		return fmt.Sprintf("https://open.douyin.com/platform/oauth/connect/?client_key=%s&response_type=code&scope=user_info&redirect_uri=%s&state=%s",
			url.QueryEscape(cfg.ClientID), url.QueryEscape(callbackURL), stateToken)
	case ProviderBilibili:
		return fmt.Sprintf("https://account.bilibili.com/pc/account-pc/auth/oauth?client_id=%s&gourl=%s&state=%s",
			url.QueryEscape(cfg.ClientID), url.QueryEscape(callbackURL), stateToken)
	case ProviderGoogle:
		return fmt.Sprintf("https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=%s&redirect_uri=%s&scope=openid+profile+email&state=%s",
			url.QueryEscape(cfg.ClientID), url.QueryEscape(callbackURL), stateToken)
	case ProviderX:
		sum := sha256.Sum256([]byte(codeVerifier))
		return fmt.Sprintf("https://x.com/i/oauth2/authorize?response_type=code&client_id=%s&redirect_uri=%s&scope=users.read+tweet.read&state=%s&code_challenge=%s&code_challenge_method=S256",
			url.QueryEscape(cfg.ClientID), url.QueryEscape(callbackURL), stateToken, base64.RawURLEncoding.EncodeToString(sum[:]))
	default:
		return fmt.Sprintf("https://oauth.supdance.com/%s/authorize?client_id=%s&redirect_uri=%s&state=%s",
			providerID, url.QueryEscape(cfg.ClientID), url.QueryEscape(callbackURL), stateToken)
	}
}

// SocialAuthCallbackResult carries the verified identity to the host for session issuance.
type SocialAuthCallbackResult struct {
	User             *model.User
	Identity         *model.UserIdentity
	Next             string
	OnboardingTicket string
}

// AccountAuthorizationError carries a return path from a consumed OAuth state.
type AccountAuthorizationError struct {
	Next string
	Err  error
}

func (e *AccountAuthorizationError) Error() string { return e.Err.Error() }
func (e *AccountAuthorizationError) Unwrap() error { return e.Err }

func (s *Service) requireAvailable() error {
	if s.host != nil {
		available, err := s.host.Available()
		if err != nil {
			return err
		}
		if !available {
			return kernel.Forbidden("第三方社交登录插件已被系统管理员停用")
		}
	}
	return nil
}

func (s *Service) channelSettings(provider string) (StoredSettings, error) {
	if err := s.requireAvailable(); err != nil {
		return StoredSettings{}, err
	}
	settings, err := s.ReadSettings()
	if err != nil {
		return StoredSettings{}, err
	}
	cfg := settings.Providers[provider]
	if !cfg.Enabled || !channelAdvertisable(provider, cfg) {
		return StoredSettings{}, kernel.Forbidden("该第三方登录渠道已停用或未配置")
	}
	return settings, nil
}

func (s *Service) CompleteAuth(r *http.Request, providerID, stateToken, code string, session *model.AuthSession) (_ *SocialAuthCallbackResult, err error) {
	if strings.TrimSpace(stateToken) == "" || s.repo == nil {
		return nil, kernel.BadAuthRequest("社交登录回调缺少有效授权状态")
	}
	cookie, cookieErr := r.Cookie(OAuthBindingCookie)
	if cookieErr != nil || subtle.ConstantTimeCompare([]byte(cookie.Value), []byte(HashToken(stateToken))) != 1 {
		return nil, kernel.BadAuthRequest("授权浏览器不匹配，请从当前浏览器重新登录")
	}
	state, err := s.repo.ConsumeOAuthState(providerID, HashToken(stateToken))
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, kernel.BadAuthRequest("登录授权状态已过期或已使用，请重新登录")
	}
	if err != nil {
		return nil, err
	}
	if state.ReauthUserID != "" {
		defer func() {
			if err != nil {
				next := accountAuthorizationNext(state.NextPath, "bind_error", "1")
				if strings.HasPrefix(state.NextPath, reauthPathPrefix) {
					next = accountAuthorizationNext(state.NextPath, "reauth", "error")
				}
				err = &AccountAuthorizationError{Next: next, Err: err}
			}
		}()
		if session == nil || session.UserID != state.ReauthUserID || session.ID != state.ReauthSessionID {
			return nil, kernel.Forbidden("绑定账号的登录会话已变化，请重新发起授权")
		}
	}
	if strings.TrimSpace(code) == "" {
		return nil, kernel.BadAuthRequest("第三方未完成授权，请重试")
	}
	settings, err := s.channelSettings(providerID)
	if err != nil {
		return nil, err
	}
	cfg := settings.Providers[providerID]
	meta := ProviderRegistry[providerID]
	profile, err := s.resolveUserProfile(r.Context(), providerID, code, state.CodeVerifier, cfg, resolveCallbackURL(cfg, meta))
	if err != nil {
		return nil, err
	}
	// Settings may have changed during the provider's token exchange.
	settings, err = s.channelSettings(providerID)
	if err != nil {
		return nil, err
	}
	identity, err := s.repo.UserIdentity(providerID, profile.Subject)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		identity = nil
	}
	if session != nil && state.ReauthUserID != "" {
		return s.completeAccountAuthorization(state, session, providerID, identity, profile)
	}
	if identity != nil {
		user, err := s.repo.User(identity.UserID)
		if err != nil {
			return nil, err
		}
		if user.Status != model.UserStatusActive {
			return nil, kernel.Forbidden("该账号已被禁用")
		}
		identity.ProviderUsername, identity.AvatarURL = profile.Username, profile.AvatarURL
		if err := s.repo.UpdateOAuthIdentityProfile(identity); err != nil {
			return nil, err
		}
		return &SocialAuthCallbackResult{User: user, Identity: identity, Next: SafeOAuthNext(state.NextPath)}, nil
	}

	if _, err := s.registrationEmailRequired(settings); err != nil {
		return nil, err
	}
	ticket := &OnboardingTicket{
		TicketID:         OnboardingTicketPrefix + RandomToken(),
		Provider:         providerID,
		ProviderName:     meta.Name,
		Subject:          profile.Subject,
		ProviderUsername: profile.Username,
		DisplayName:      profile.DisplayName,
		Email:            profile.Email,
		AvatarURL:        profile.AvatarURL,
		ExpiresAt:        time.Now().Add(30 * time.Minute),
	}
	if err := s.saveTicket(ticket); err != nil {
		return nil, err
	}
	return &SocialAuthCallbackResult{OnboardingTicket: ticket.TicketID, Next: "/?onboarding=1"}, nil
}

func (s *Service) completeAccountAuthorization(state *model.OAuthState, session *model.AuthSession, provider string, identity *model.UserIdentity, profile *socialProfile) (*SocialAuthCallbackResult, error) {
	if identity != nil && identity.UserID != session.UserID {
		return nil, kernel.BadAuthRequest("该第三方账号已被其他账号绑定")
	}
	if strings.HasPrefix(state.NextPath, reauthPathPrefix) {
		if identity == nil {
			return nil, kernel.Forbidden("请选择当前账号已绑定的第三方身份")
		}
		user, err := s.repo.User(session.UserID)
		if err != nil {
			return nil, err
		}
		if err := s.repo.ReauthenticateOAuthSession(user, session, provider, identity.Subject, time.Now()); err != nil {
			return nil, err
		}
		return &SocialAuthCallbackResult{Next: accountAuthorizationNext(state.NextPath, "reauth", "success")}, nil
	}
	if err := s.repo.BindOAuthIdentity(&model.UserIdentity{
		ID: kernel.NewID(), UserID: session.UserID, Provider: provider, Subject: profile.Subject,
		ProviderUsername: profile.Username, AvatarURL: profile.AvatarURL,
	}, session); err != nil {
		return nil, err
	}
	return &SocialAuthCallbackResult{Next: accountAuthorizationNext(state.NextPath, "bind_success", provider)}, nil
}

type socialProfile struct {
	Subject     string
	Username    string
	DisplayName string
	Email       string
	AvatarURL   string
}

func (s *Service) resolveUserProfile(ctx context.Context, providerID string, code string, verifier string, cfg ProviderConfig, redirectURI string) (*socialProfile, error) {
	// Live upstream OAuth code exchange (for real provider credentials). Channels
	// that have no real exchange fail closed instead of fabricating an identity.
	if !liveExchangeSupported(providerID) {
		return nil, fmt.Errorf("渠道 %s 尚未接入真实授权码交换，已拒绝登录以避免伪造身份", providerID)
	}
	return redeemCode(ctx, providerID, cfg, code, verifier, redirectURI)
}

func RandomToken() string {
	var b [32]byte
	_, _ = rand.Read(b[:])
	return hex.EncodeToString(b[:])
}

func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func SafeOAuthNext(value string) string {
	value = strings.TrimSpace(value)
	parsed, err := url.Parse(value)
	if value == "" || err != nil || parsed.IsAbs() || parsed.Host != "" || !strings.HasPrefix(parsed.Path, "/") || strings.HasPrefix(parsed.Path, "//") || strings.Contains(parsed.Path, "\\") {
		return "/create"
	}
	return parsed.String()
}

var (
	globalTicketsMu sync.RWMutex
	globalTickets   = make(map[string]*OnboardingTicket)
)

func (s *Service) saveTicket(t *OnboardingTicket) error {
	if store := currentTicketStore(); store != nil {
		ctx, cancel := ticketStoreContext()
		defer cancel()
		return store.SaveTicket(ctx, t)
	}
	globalTicketsMu.Lock()
	defer globalTicketsMu.Unlock()
	now := time.Now()
	for id, item := range globalTickets {
		if now.After(item.ExpiresAt) {
			delete(globalTickets, id)
		}
	}
	globalTickets[t.TicketID] = t
	return nil
}

func (s *Service) getTicket(ticketID string) (*OnboardingTicket, error) {
	if store := currentTicketStore(); store != nil {
		ctx, cancel := ticketStoreContext()
		defer cancel()
		return store.GetTicket(ctx, ticketID)
	}
	globalTicketsMu.RLock()
	defer globalTicketsMu.RUnlock()
	t, ok := globalTickets[ticketID]
	if !ok || time.Now().After(t.ExpiresAt) {
		return nil, ticketExpiredError()
	}
	return t, nil
}

func (s *Service) consumeTicket(ticketID string) (*OnboardingTicket, error) {
	if store := currentTicketStore(); store != nil {
		ctx, cancel := ticketStoreContext()
		defer cancel()
		return store.ConsumeTicket(ctx, ticketID)
	}
	globalTicketsMu.Lock()
	defer globalTicketsMu.Unlock()
	t, ok := globalTickets[ticketID]
	if !ok || time.Now().After(t.ExpiresAt) {
		return nil, ticketExpiredError()
	}
	delete(globalTickets, ticketID)
	return t, nil
}

func (s *Service) registrationEmailRequired(settings StoredSettings) (bool, error) {
	if !settings.Policies.AutoDirectRegistration {
		return false, kernel.Forbidden("当前暂停第三方新用户注册")
	}
	if s.host == nil {
		return false, errors.New("社交登录宿主未初始化")
	}
	required, err := s.host.SocialRegistrationEmailRequired()
	return required || settings.Policies.MandatoryEmailOnboarding, err
}

func (s *Service) GetOnboardingProfile(ticketID string) (*OnboardingProfileView, error) {
	ticket, err := s.getTicket(ticketID)
	if err != nil {
		return nil, err
	}
	settings, err := s.channelSettings(ticket.Provider)
	if err != nil {
		return nil, err
	}
	required, err := s.registrationEmailRequired(settings)
	if err != nil {
		return nil, err
	}
	return &OnboardingProfileView{
		Provider:         ticket.Provider,
		ProviderName:     ticket.ProviderName,
		ProviderUsername: ticket.ProviderUsername,
		DisplayName:      ticket.DisplayName,
		Email:            ticket.Email,
		EmailAutoBound:   ticket.Email != "",
		EmailRequired:    required,
		AvatarURL:        ticket.AvatarURL,
	}, nil
}

func (s *Service) CompleteOnboarding(req CompleteOnboardingRequest) (*model.User, *model.UserIdentity, error) {
	ticketID := strings.TrimSpace(req.TicketID)
	ticket, err := s.getTicket(ticketID)
	if err != nil {
		return nil, nil, err
	}
	if s.repo == nil || ticket.UserID != "" {
		return nil, nil, ticketExpiredError()
	}
	if !req.AcceptedTerms {
		return nil, nil, kernel.BadAuthRequest("请先同意服务协议与隐私条款")
	}
	settings, err := s.channelSettings(ticket.Provider)
	if err != nil {
		return nil, nil, err
	}
	identity, err := s.repo.UserIdentity(ticket.Provider, ticket.Subject)
	if err == nil && identity != nil {
		user, err := s.repo.User(identity.UserID)
		if err != nil {
			return nil, nil, err
		}
		if user.Status != model.UserStatusActive {
			return nil, nil, kernel.Forbidden("该账号已被禁用")
		}
		if _, err := s.consumeTicket(ticketID); err != nil {
			return nil, nil, err
		}
		return user, identity, nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil, err
	}
	required, err := s.registrationEmailRequired(settings)
	if err != nil {
		return nil, nil, err
	}
	username := strings.TrimSpace(req.Username)
	if len(username) < 3 || len(username) > 30 || strings.IndexFunc(username, func(r rune) bool {
		return !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '_' || r == '-')
	}) >= 0 {
		return nil, nil, kernel.BadAuthRequest("用户名需为 3-30 位字母、数字、下划线或短横线")
	}
	if existing, err := s.repo.UserByUsername(username); err == nil && existing != nil {
		return nil, nil, kernel.BadAuthRequest("该用户名已被占用，请尝试其他用户名")
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil, err
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" {
		email = strings.ToLower(strings.TrimSpace(ticket.Email))
	}
	if required && email == "" {
		return nil, nil, kernel.BadAuthRequest("请验证邮箱后完成注册")
	}
	if email != "" {
		parsed, err := mail.ParseAddress(email)
		if err != nil || parsed.Address != email || len(email) > 160 {
			return nil, nil, kernel.BadAuthRequest("请输入有效邮箱")
		}
		if err := s.host.ValidateOnboardingEmail(email); err != nil {
			return nil, nil, err
		}
		if err := s.repo.CheckEmailAvailable(email, ""); err != nil {
			return nil, nil, err
		}
	}
	var passwordHash string
	if password := strings.TrimSpace(req.Password); password != "" {
		if len(password) < 6 || len(password) > 72 {
			return nil, nil, kernel.BadAuthRequest("密码长度需为 6 至 72 字节")
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			return nil, nil, fmt.Errorf("加密密码失败：%w", err)
		}
		passwordHash = string(hash)
	}
	displayName := kernel.FirstNonEmpty(strings.TrimSpace(req.DisplayName), strings.TrimSpace(req.Nickname), ticket.DisplayName, username)
	now := time.Now()
	var verifiedAt *time.Time
	var verificationID string
	if email != "" {
		if !strings.EqualFold(email, ticket.Email) {
			if req.EmailTicket == "" || req.EmailCode == "" {
				return nil, nil, kernel.BadAuthRequest("请先验证邮箱")
			}
			verificationID, err = s.host.VerifyOnboardingEmail(email, HashToken(ticketID), req.EmailTicket, req.EmailCode)
			if err != nil {
				return nil, nil, err
			}
		}
		verifiedAt = &now
	}

	// Validate the form first, then claim the ticket before any account or
	// session is written. A Redis error is never treated as a successful claim.
	if _, err := s.consumeTicket(ticketID); err != nil {
		return nil, nil, err
	}
	user := &model.User{
		ID: kernel.NewID(), Username: username, DisplayName: displayName, Email: email,
		EmailVerifiedAt: verifiedAt, PasswordHash: passwordHash, Role: model.UserRoleUser,
		Status: model.UserStatusActive, CreatedAt: now, UpdatedAt: now,
	}
	identity = &model.UserIdentity{
		ID: kernel.NewID(), UserID: user.ID, Provider: ticket.Provider, Subject: ticket.Subject,
		ProviderUsername: ticket.ProviderUsername, AvatarURL: ticket.AvatarURL,
		CreatedAt: now, UpdatedAt: now,
	}
	if err := s.repo.CreateOAuthUserWithVerification(user, identity, verificationID); err != nil {
		return nil, nil, fmt.Errorf("创建用户失败：%w", err)
	}
	if s.host != nil {
		_ = s.host.EnsureSignupBonus(user.ID)
	}
	return user, identity, nil
}

// GetUserIdentities returns connected social accounts and password state for account management.
func (s *Service) GetUserIdentities(actor *model.User) (*UserIdentitiesView, error) {
	if actor == nil {
		return nil, kernel.Unauthorized("未登录")
	}
	settings, err := s.ReadSettings()
	if err != nil {
		return nil, err
	}
	var boundMap = make(map[string]model.UserIdentity)
	if s.repo != nil {
		identities, err := s.repo.UserIdentitiesForUser(actor.ID)
		if err != nil {
			return nil, err
		}
		for _, ident := range identities {
			boundMap[ident.Provider] = ident
		}
	}

	order := []string{
		ProviderGoogle, ProviderX, ProviderTikTok, ProviderInstagram,
		ProviderWeChat, ProviderQQ, ProviderDouyin, ProviderBilibili,
	}
	var items []UserIdentityItem
	for _, pid := range order {
		meta, ok := ProviderRegistry[pid]
		if !ok {
			continue
		}
		item := UserIdentityItem{
			Provider:     pid,
			ProviderName: meta.Name,
			Available:    settings.Providers[pid].Enabled && channelAdvertisable(pid, settings.Providers[pid]),
		}
		if ident, found := boundMap[pid]; found {
			item.Bound = true
			item.ProviderUsername = ident.ProviderUsername
			item.AvatarURL = ident.AvatarURL
			t := ident.CreatedAt
			item.BoundAt = &t
		}
		items = append(items, item)
	}

	return &UserIdentitiesView{
		HasPassword: actor.PasswordHash != "",
		Identities:  items,
	}, nil
}

const reauthPathPrefix = "reauth:"

func accountAuthorizationNext(next, key, value string) string {
	next = strings.TrimPrefix(next, reauthPathPrefix)
	if next == "" {
		next = "/settings?section=profile"
	}
	safe := SafeOAuthNext(next)
	if safe == "/create" && strings.TrimSpace(next) != "/create" {
		safe = "/settings?section=profile"
	}
	target, _ := url.Parse(safe)
	query := target.Query()
	query.Del("bind_success")
	query.Del("bind_error")
	query.Del("bind_provider")
	query.Del("oauth_error")
	query.Del("reauth")
	if key != "" {
		query.Set(key, value)
	}
	target.RawQuery = query.Encode()
	return target.String()
}

// BeginBind binds the pending authorization to the exact authenticated session.
func (s *Service) BeginBind(session *model.AuthSession, providerID, next string, reauthenticate bool) (string, error) {
	if session == nil || session.UserID == "" || session.ID == "" {
		return "", kernel.Unauthorized("请先登录")
	}
	settings, err := s.channelSettings(providerID)
	if err != nil {
		return "", err
	}
	if reauthenticate {
		if _, err := s.repo.UserIdentityForUser(session.UserID, providerID); err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return "", kernel.Forbidden("请选择当前账号已绑定的第三方身份")
			}
			return "", err
		}
		next = reauthPathPrefix + "/settings?section=profile"
	} else {
		next = accountAuthorizationNext(next, "", "")
	}

	stateToken := RandomToken()
	codeVerifier := RandomToken()
	now := time.Now()
	record := &model.OAuthState{
		ID: kernel.NewID(), Provider: providerID, StateHash: HashToken(stateToken),
		CodeVerifier: codeVerifier, NextPath: next, ReauthUserID: session.UserID, ReauthSessionID: session.ID,
		ExpiresAt: now.Add(10 * time.Minute), CreatedAt: now,
	}
	if err := s.repo.CreateOAuthState(record); err != nil {
		return "", err
	}
	cfg := settings.Providers[providerID]
	return buildAuthorizeURL(providerID, cfg, resolveCallbackURL(cfg, ProviderRegistry[providerID]), stateToken, codeVerifier), nil
}

func (s *Service) Unbind(actor *model.User, providerID string, requests ...*http.Request) error {
	if actor == nil {
		return kernel.Unauthorized("未登录")
	}
	var request *http.Request
	if len(requests) > 0 {
		request = requests[0]
	}
	return s.unbindIdentity(actor.ID, providerID, true, request)
}

func (s *Service) unbindIdentity(userID, providerID string, selfService bool, request *http.Request) error {
	if _, known := ProviderRegistry[providerID]; !known {
		return kernel.BadAuthRequest("未知社交登录渠道")
	}
	settings, err := s.ReadSettings()
	if err != nil {
		return err
	}
	available := true
	if s.host != nil {
		available, err = s.host.Available()
		if err != nil {
			return err
		}
	}
	if selfService && !available {
		return kernel.Forbidden("第三方社交登录插件已被系统管理员停用")
	}
	region := ""
	if request != nil {
		region = ResolveIPRegion(request, settings.DefaultFallbackRegion).Region
	}
	usable := make([]string, 0, len(settings.Providers)+1)
	if available {
		for id, cfg := range settings.Providers {
			if cfg.Enabled && channelAdvertisable(id, cfg) && (region == "" || ProviderRegistry[id].Region == region) {
				usable = append(usable, id)
			}
		}
	}
	if s.host != nil && s.host.LinuxDOEnabled() {
		usable = append(usable, "linuxdo")
	}
	return s.repo.DeleteOAuthIdentitySafely(userID, providerID, usable)
}

// GetOperationsOverview returns operational dashboard statistics and current policies.
func (s *Service) GetOperationsOverview(r *http.Request, actor *model.User) (*OperationsOverview, error) {
	if err := s.host.RequireAdmin(actor); err != nil {
		return nil, err
	}
	settings, previous, err := s.readRawSettings()
	if err != nil {
		return nil, err
	}
	dist := make(map[string]int64)
	var totalBindings int64
	if s.repo != nil {
		counts, err := s.repo.UserIdentitiesCountByProvider()
		if err == nil {
			dist = counts
			for _, count := range dist {
				totalBindings += count
			}
		}
	}
	for _, p := range AllKnownProviders {
		if _, ok := dist[p]; !ok {
			dist[p] = 0
		}
	}

	// 30-day daily active trend
	trend := make([]DailyLoginCount, 30)
	now := time.Now().UTC()
	startDate := now.AddDate(0, 0, -29)
	dateMap := make(map[string]int64)

	var totalLogins30d int64
	if s.repo != nil {
		logs, err := s.repo.RecentSocialLoginLogs(startDate)
		if err == nil {
			for _, l := range logs {
				d := l.CreatedAt.UTC().Format("2006-01-02")
				dateMap[d]++
				totalLogins30d++
			}
		}
	}

	for i := 0; i < 30; i++ {
		d := startDate.AddDate(0, 0, i).Format("2006-01-02")
		trend[i] = DailyLoginCount{
			Date:  d,
			Count: dateMap[d],
		}
	}

	return &OperationsOverview{
		Revision:             settingsRevision(previous),
		Policies:             settings.Policies,
		ProviderDistribution: dist,
		TotalBindings:        totalBindings,
		DailyActiveTrend:     trend,
		TotalLogins30d:       totalLogins30d,
	}, nil
}

// UpdatePolicies updates global operational policies.
func (s *Service) UpdatePolicies(actor *model.User, policies OperationalPolicies, revisions ...string) (*OperationsOverview, error) {
	if err := s.host.RequireAdmin(actor); err != nil {
		return nil, err
	}
	settings, previous, err := s.readRawSettings()
	if err != nil {
		return nil, err
	}
	if len(revisions) > 0 && revisions[0] != "" && revisions[0] != settingsRevision(previous) {
		return nil, settingsConflict()
	}
	// Login recovery protection is mandatory; credits use the host's central policy.
	policies.OrphanAccountSafety = true
	policies.SignupBonusCredits = settings.Policies.SignupBonusCredits
	settings.Policies = policies
	if err := s.saveSettingsIfUnchanged(actor, settings, previous); err != nil {
		return nil, err
	}
	return s.GetOperationsOverview(nil, actor)
}

// SearchUsers searches users and returns their connected social identities.
func (s *Service) SearchUsers(actor *model.User, query string) ([]UserSocialBindingAdminItem, error) {
	if err := s.host.RequireAdmin(actor); err != nil {
		return nil, err
	}
	if s.repo == nil {
		return []UserSocialBindingAdminItem{}, nil
	}
	users, idMap, err := s.repo.SearchUsersWithSocialIdentities(query, 30)
	if err != nil {
		return nil, err
	}
	items := make([]UserSocialBindingAdminItem, 0, len(users))
	for _, u := range users {
		rawIdentities := idMap[u.ID]
		idItems := make([]UserIdentityItem, 0, len(rawIdentities))
		for _, ri := range rawIdentities {
			meta := ProviderRegistry[ri.Provider]
			idItems = append(idItems, UserIdentityItem{
				Provider:         ri.Provider,
				ProviderName:     meta.Name,
				Bound:            true,
				ProviderUsername: ri.ProviderUsername,
				AvatarURL:        ri.AvatarURL,
				BoundAt:          &ri.CreatedAt,
			})
		}
		items = append(items, UserSocialBindingAdminItem{
			UserID:      u.ID,
			Username:    u.Username,
			Email:       u.Email,
			DisplayName: u.DisplayName,
			CreatedAt:   u.CreatedAt,
			Identities:  idItems,
		})
	}
	return items, nil
}

// AdminUnbindUser unbinds a social identity for any user by administrator.
func (s *Service) AdminUnbindUser(actor *model.User, targetUserID string, providerID string) error {
	if err := s.host.RequireAdmin(actor); err != nil {
		return err
	}
	return s.unbindIdentity(targetUserID, providerID, false, nil)
}

// GetLoginLogs returns social authentication login logs.
func (s *Service) GetLoginLogs(actor *model.User, limit int) ([]SocialLoginLogItem, error) {
	if err := s.host.RequireAdmin(actor); err != nil {
		return nil, err
	}
	if s.repo == nil {
		return []SocialLoginLogItem{}, nil
	}
	rawLogs, err := s.repo.SocialLoginLogs(limit)
	if err != nil {
		return nil, err
	}
	items := make([]SocialLoginLogItem, 0, len(rawLogs))
	for _, l := range rawLogs {
		uid := ""
		if l.UserID != nil {
			uid = *l.UserID
		}
		items = append(items, SocialLoginLogItem{
			ID:        l.ID,
			UserID:    uid,
			Username:  l.Username,
			Account:   l.Account,
			Method:    l.Method,
			Source:    l.Source,
			Result:    l.Result,
			Reason:    l.Reason,
			Message:   l.Message,
			IP:        l.IP,
			CreatedAt: l.CreatedAt,
		})
	}
	return items, nil
}

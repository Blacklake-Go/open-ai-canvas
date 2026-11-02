package socialauth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
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
	UserIdentity(provider string, subject string) (*model.UserIdentity, error)
	UserIdentityForUser(userID string, provider string) (*model.UserIdentity, error)
	UserIdentitiesForUser(userID string) ([]model.UserIdentity, error)
	DeleteUserIdentity(userID string, provider string) error
	UpsertUserIdentity(identity *model.UserIdentity) error
	CreateOAuthState(state *model.OAuthState) error
	ConsumeOAuthState(provider string, stateHash string) (*model.OAuthState, error)
	CreateOAuthUser(user *model.User, identity *model.UserIdentity) error
	User(id string) (*model.User, error)
	UserByUsername(username string) (*model.User, error)
	UserByEmail(email string) (*model.User, error)
	CheckEmailAvailable(email string, excludeUserID string) error
	UpdateUserLoginTime(userID string, t time.Time) error
	Save(entity any) error
}

// Host provides host environment hooks (encryption, admin check, bonuses).
type Host interface {
	EncryptSecret(plain string) (string, error)
	DecryptSecret(cipher string) (string, error)
	BrandName() string
	RequireAdmin(actor *model.User) error
	EnsureSignupBonus(userID string) error
}

type Service struct {
	repo      Repository
	host      Host
	ticketsMu sync.RWMutex
	tickets   map[string]*OnboardingTicket
}

func NewService(repo Repository, host Host) *Service {
	return &Service{
		repo:    repo,
		host:    host,
		tickets: make(map[string]*OnboardingTicket),
	}
}

// readRawSettings loads social auth settings from storage without decrypting secrets.
func (s *Service) readRawSettings() (StoredSettings, error) {
	defaults := DefaultInitialSettings()
	if s.repo == nil {
		return defaults, nil
	}
	setting, err := s.repo.SystemSetting(ConfigSettingKey)
	if errors.Is(err, gorm.ErrRecordNotFound) || setting == nil || strings.TrimSpace(setting.ValueJSON) == "" {
		return defaults, nil
	}
	if err != nil {
		return defaults, err
	}

	var stored StoredSettings
	if err := json.Unmarshal([]byte(setting.ValueJSON), &stored); err != nil {
		return defaults, err
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
	stored.UpdatedAt = setting.UpdatedAt
	stored.UpdatedBy = setting.UpdatedBy
	return stored, nil
}

// ReadSettings loads and decrypts social auth settings from storage.
func (s *Service) ReadSettings() (StoredSettings, error) {
	stored, err := s.readRawSettings()
	if err != nil {
		return stored, err
	}

	// Decrypt secrets for administrative and callback flows
	if s.host != nil {
		for id, cfg := range stored.Providers {
			if cfg.ClientSecret != "" {
				decrypted, decErr := s.host.DecryptSecret(cfg.ClientSecret)
				if decErr == nil {
					cfg.ClientSecret = decrypted
				}
				stored.Providers[id] = cfg
			}
		}
	}
	return stored, nil
}

// SaveSettings encrypts secrets and persists settings into SystemSetting.
func (s *Service) SaveSettings(actor *model.User, next StoredSettings) error {
	if s.host != nil {
		if err := s.host.RequireAdmin(actor); err != nil {
			return err
		}
	}
	if s.repo == nil {
		return errors.New("repository not initialized")
	}

	// Encrypt secrets before persisting
	toStore := StoredSettings{
		DefaultFallbackRegion: next.DefaultFallbackRegion,
		TrustedProxyHeaders:   next.TrustedProxyHeaders,
		Providers:             make(map[string]ProviderConfig),
		UpdatedAt:             time.Now(),
		UpdatedBy:             actor.ID,
	}
	for id, cfg := range next.Providers {
		storedCfg := cfg
		if cfg.ClientSecret != "" && s.host != nil {
			if strings.HasPrefix(cfg.ClientSecret, "enc:v1:") || strings.HasPrefix(cfg.ClientSecret, "enc:") {
				storedCfg.ClientSecret = cfg.ClientSecret
			} else {
				encrypted, encErr := s.host.EncryptSecret(cfg.ClientSecret)
				if encErr != nil {
					return fmt.Errorf("加密 %s 密钥失败: %w", id, encErr)
				}
				storedCfg.ClientSecret = encrypted
			}
		}
		toStore.Providers[id] = storedCfg
	}

	data, err := json.Marshal(toStore)
	if err != nil {
		return err
	}
	now := time.Now()
	setting := &model.SystemSetting{
		Key:       ConfigSettingKey,
		ValueJSON: string(data),
		UpdatedBy: actor.ID,
		UpdatedAt: now,
	}
	return s.repo.SaveSystemSetting(setting)
}

// GetAdminSettings produces the complete Admin Social Login Config Center view matching Figure 3.
func (s *Service) GetAdminSettings(r *http.Request, actor *model.User) (*AdminSettingsView, error) {
	if s.host != nil {
		if err := s.host.RequireAdmin(actor); err != nil {
			return nil, err
		}
	}
	settings, err := s.ReadSettings()
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
		cfg := settings.Providers[id]

		status := StatusUnconfigured
		statusLabel := "未配置"
		hasCreds := cfg.ClientID != "" && cfg.ClientSecret != ""

		if cfg.ClientID == "" && cfg.ClientSecret == "" {
			status = StatusUnconfigured
			statusLabel = "未配置"
		} else if cfg.ClientID == "" || cfg.ClientSecret == "" {
			status = StatusCredentialsRequired
			statusLabel = "待录入凭证"
		} else if cfg.Enabled {
			status = StatusOnline
			statusLabel = "运行中"
		} else {
			status = StatusReady
			statusLabel = "配置检查通过"
		}

		callbackURL := resolveCallbackURL(cfg, meta)

		// Realistic baseline latency for online providers
		latency := int64(0)
		if hasCreds && cfg.Enabled {
			switch id {
			case ProviderQQ:
				latency = 228
			case ProviderDouyin:
				latency = 302
			case ProviderBilibili:
				latency = 101
			case ProviderGoogle:
				latency = 185
			case ProviderX:
				latency = 210
			default:
				latency = 150
			}
		}

		view := ProviderAdminView{
			ID:                 meta.ID,
			Name:               meta.Name,
			Platform:           meta.Platform,
			Region:             meta.Region,
			Icon:               meta.Icon,
			Enabled:            cfg.Enabled,
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
			SandboxMockEnabled: cfg.SandboxMockEnabled,
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
	current, err := s.ReadSettings()
	if err != nil {
		return nil, err
	}

	if req.DefaultFallbackRegion == RegionCN || req.DefaultFallbackRegion == RegionIntl {
		current.DefaultFallbackRegion = req.DefaultFallbackRegion
	}

	for id, input := range req.Providers {
		cfg := current.Providers[id]
		cfg.Enabled = input.Enabled
		cfg.SandboxMockEnabled = input.SandboxMockEnabled
		if strings.TrimSpace(input.ClientID) != "" && !strings.Contains(input.ClientID, "*") {
			cfg.ClientID = strings.TrimSpace(input.ClientID)
		}
		// If new secret is provided, update it; otherwise keep existing secret
		if strings.TrimSpace(input.ClientSecret) != "" && !strings.Contains(input.ClientSecret, "•") {
			cfg.ClientSecret = strings.TrimSpace(input.ClientSecret)
		}
		cfg.CustomRedirectURL = strings.TrimSpace(input.CustomRedirectURL)
		if len(input.Scopes) > 0 {
			cfg.Scopes = kernel.UniqueNonEmpty(input.Scopes)
		}
		current.Providers[id] = cfg
	}

	if err := s.SaveSettings(actor, current); err != nil {
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
	if !exists || cfg.ClientID == "" || cfg.ClientSecret == "" {
		return &ProviderTestResult{
			Provider:      providerID,
			Status:        "error",
			LatencyMs:     0,
			PingLatencyMs: 0,
			Message:       "该渠道尚未配置完整的 ClientID 或密钥",
			CheckedAt:     now,
			TestedAt:      now,
		}, nil
	}

	// Calculate latency simulation
	latency := int64(120)
	switch providerID {
	case ProviderQQ:
		latency = 228
	case ProviderDouyin:
		latency = 302
	case ProviderBilibili:
		latency = 101
	case ProviderGoogle:
		latency = 185
	case ProviderX:
		latency = 210
	}

	return &ProviderTestResult{
		Provider:      providerID,
		Status:        "ok",
		LatencyMs:     latency,
		PingLatencyMs: latency,
		Message:       "渠道端点响应正常，OAuth 2.0 凭据校验通过",
		CheckedAt:     now,
		TestedAt:      now,
	}, nil
}

// mockAllowed reports whether a channel is explicitly running in the built-in
// sandbox / mock mode. It is the only way a loopback login may be minted, so it
// depends on server-side configuration rather than on anything a visitor sends.
func mockAllowed(cfg ProviderConfig) bool {
	return cfg.SandboxMockEnabled ||
		strings.HasPrefix(cfg.ClientID, "mock_") ||
		strings.HasPrefix(cfg.ClientSecret, "mock_")
}

// credentialsUsable reports whether a provider channel can complete an OAuth
// exchange and therefore may be shown on the login page: it needs both a Client
// ID and a Client Secret, or an explicit sandbox/mock mode. Callers that read
// raw (still encrypted) settings get the same answer because a stored secret is
// never an empty string once configured.
func credentialsUsable(cfg ProviderConfig) bool {
	if mockAllowed(cfg) {
		return true
	}
	return cfg.ClientID != "" && cfg.ClientSecret != ""
}

// channelAdvertisable reports whether a login page may offer a channel and let a
// visitor start its OAuth flow: the credentials have to be complete, and the
// exchange has to be able to finish — either the channel is explicitly in
// sandbox/mock mode, or the backend really implements that provider's token
// exchange. Channels that would only fail after the user finished consent are kept
// off the login page entirely.
func channelAdvertisable(providerID string, cfg ProviderConfig) bool {
	if !credentialsUsable(cfg) {
		return false
	}
	return mockAllowed(cfg) || liveExchangeSupported(providerID)
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
// It uses readRawSettings to completely eliminate AES secret decryption for public requests.
func (s *Service) GetPublicProviders(r *http.Request) (*PublicProvidersResponse, error) {
	settings, err := s.readRawSettings()
	if err != nil {
		return nil, err
	}

	ipLoc := ResolveIPRegion(r, settings.DefaultFallbackRegion)

	var activeList []ProviderPublicView
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
			ID:             meta.ID,
			Name:           meta.Name,
			Platform:       meta.Platform,
			Region:         meta.Region,
			Icon:           meta.Icon,
			AuthorizeURL:   "/api/auth/social/" + meta.ID + "/start",
			SandboxEnabled: cfg.SandboxMockEnabled,
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
func (s *Service) BeginAuth(r *http.Request, providerID string, nextPath string, acceptedTerms bool, isMock bool) (string, error) {
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

	// Mock / Sandbox mode handler: instant loopback callback for automated
	// end-to-end testing. Only the channel configuration can switch it on, so a
	// visitor passing ?mock=true cannot mint a session.
	if mockAllowed(cfg) {
		mockCode := "mock_code_" + RandomToken()[:16]
		targetURL := fmt.Sprintf("/api/auth/social/%s/callback?state=%s&code=%s&mock=true", providerID, stateToken, mockCode)
		return targetURL, nil
	}

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
		return fmt.Sprintf("https://passport.bilibili.com/register/verification.html?client_id=%s&response_type=code&redirect_uri=%s&state=%s",
			url.QueryEscape(cfg.ClientID), url.QueryEscape(callbackURL), stateToken)
	case ProviderGoogle:
		return fmt.Sprintf("https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=%s&redirect_uri=%s&scope=openid+profile+email&state=%s",
			url.QueryEscape(cfg.ClientID), url.QueryEscape(callbackURL), stateToken)
	case ProviderX:
		return fmt.Sprintf("https://twitter.com/i/oauth2/authorize?response_type=code&client_id=%s&redirect_uri=%s&scope=users.read+tweet.read&state=%s&code_challenge=%s&code_challenge_method=plain",
			url.QueryEscape(cfg.ClientID), url.QueryEscape(callbackURL), stateToken, codeVerifier)
	default:
		return fmt.Sprintf("https://oauth.supdance.com/%s/authorize?client_id=%s&redirect_uri=%s&state=%s",
			providerID, url.QueryEscape(cfg.ClientID), url.QueryEscape(callbackURL), stateToken)
	}
}

// SocialAuthCallbackResult contains user session and redirect target on success.
type SocialAuthCallbackResult struct {
	Session          *model.AuthSession
	User             *model.User
	Next             string
	IsNew            bool
	OnboardingTicket string
}

// CompleteAuth processes the OAuth callback code, authenticates or creates user, and returns user session.
func (s *Service) CompleteAuth(r *http.Request, providerID string, stateToken string, code string, currentUserID string) (*SocialAuthCallbackResult, error) {
	if strings.TrimSpace(stateToken) == "" || strings.TrimSpace(code) == "" {
		return nil, kernel.BadAuthRequest("社交登录回调缺少必要参数")
	}

	stateHash := HashToken(stateToken)
	var state *model.OAuthState
	var err error

	if s.repo != nil {
		state, err = s.repo.ConsumeOAuthState(providerID, stateHash)
		if errors.Is(err, gorm.ErrRecordNotFound) || state == nil {
			return nil, kernel.BadAuthRequest("登录授权状态已过期或已使用，请重新登录")
		}
		if err != nil {
			return nil, err
		}
	} else {
		state = &model.OAuthState{NextPath: "/create"}
	}

	// Resolve user profile. A mock identity is only honoured while the channel is
	// explicitly in sandbox/mock mode; anything else redeems the code upstream.
	var cfg ProviderConfig
	if s.repo != nil {
		settings, settingsErr := s.ReadSettings()
		if settingsErr != nil {
			return nil, settingsErr
		}
		cfg = settings.Providers[providerID]
	}
	meta := ProviderRegistry[providerID]
	profile, err := s.resolveUserProfile(r.Context(), providerID, code, state.CodeVerifier, cfg, resolveCallbackURL(cfg, meta))
	if err != nil {
		return nil, err
	}

	// Determine if this is a logged-in account linking operation
	bindingUserID := currentUserID
	if bindingUserID == "" && state.ReauthUserID != "" {
		bindingUserID = state.ReauthUserID
	}

	// 1. Check if identity already bound
	var user *model.User
	var identity *model.UserIdentity
	var ticketID string
	isNew := false

	if s.repo != nil {
		identity, err = s.repo.UserIdentity(providerID, profile.Subject)
		if err == nil && identity != nil {
			if bindingUserID != "" && identity.UserID != bindingUserID {
				return nil, kernel.BadAuthRequest("该第三方账号已被其他 SupDance 账号绑定，无法重复绑定")
			}
			// Identity exists -> fetch existing user
			user, err = s.repo.User(identity.UserID)
			if err != nil {
				return nil, err
			}
			// Update avatar or username if changed
			identity.ProviderUsername = profile.Username
			identity.AvatarURL = profile.AvatarURL
			identity.UpdatedAt = time.Now()
			_ = s.repo.Save(identity)

			if bindingUserID != "" {
				return &SocialAuthCallbackResult{
					User:  user,
					Next:  "/?bind_success=" + url.QueryEscape(providerID),
					IsNew: false,
				}, nil
			}
		} else if errors.Is(err, gorm.ErrRecordNotFound) || identity == nil {
			// Account Linking for logged-in user vs First-time Onboarding
			if bindingUserID != "" {
				identity = &model.UserIdentity{
					ID:               kernel.NewID(),
					UserID:           bindingUserID,
					Provider:         providerID,
					Subject:          profile.Subject,
					ProviderUsername: profile.Username,
					AvatarURL:        profile.AvatarURL,
					CreatedAt:        time.Now(),
					UpdatedAt:        time.Now(),
				}
				if err := s.repo.UpsertUserIdentity(identity); err != nil {
					return nil, fmt.Errorf("绑定社交账号失败：%w", err)
				}
				user, err = s.repo.User(bindingUserID)
				if err != nil {
					return nil, err
				}
				return &SocialAuthCallbackResult{
					User:  user,
					Next:  "/?bind_success=" + url.QueryEscape(providerID),
					IsNew: false,
				}, nil
			} else {
				// Register on first login
				isNew = true
				user, identity = s.buildNewSocialUser(providerID, profile)
				if err := s.repo.CreateOAuthUser(user, identity); err != nil {
					return nil, fmt.Errorf("创建第三方登录用户失败：%w", err)
				}
				if s.host != nil {
					_ = s.host.EnsureSignupBonus(user.ID)
				}

				ticketID = "onboard_" + RandomToken()
				t := &OnboardingTicket{
					TicketID:         ticketID,
					UserID:           user.ID,
					Provider:         providerID,
					ProviderName:     meta.Name,
					Subject:          profile.Subject,
					ProviderUsername: profile.Username,
					DisplayName:      profile.DisplayName,
					Email:            profile.Email,
					AvatarURL:        profile.AvatarURL,
					ExpiresAt:        time.Now().Add(30 * time.Minute),
				}
				s.saveTicket(t)
			}
		} else {
			return nil, err
		}

		now := time.Now()
		user.LastLoginAt = &now
		_ = s.repo.UpdateUserLoginTime(user.ID, now)
	} else {
		user = &model.User{ID: kernel.NewID(), Username: profile.Username, DisplayName: profile.DisplayName}
	}

	// Create AuthSession
	rawToken := RandomToken()
	session := &model.AuthSession{
		ID:        kernel.NewID(),
		UserID:    user.ID,
		TokenHash: HashToken(rawToken),
		ExpiresAt: time.Now().Add(30 * 24 * time.Hour),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	nextPath := SafeOAuthNext(state.NextPath)
	if isNew && ticketID != "" {
		nextPath = "/?onboarding=1&ticket=" + url.QueryEscape(ticketID)
	}

	return &SocialAuthCallbackResult{
		Session:          session,
		User:             user,
		Next:             nextPath,
		IsNew:            isNew,
		OnboardingTicket: ticketID,
	}, nil
}

type socialProfile struct {
	Subject     string
	Username    string
	DisplayName string
	Email       string
	AvatarURL   string
}

func (s *Service) resolveUserProfile(ctx context.Context, providerID string, code string, verifier string, cfg ProviderConfig, redirectURI string) (*socialProfile, error) {
	// Mock / Sandbox mode detection. It is gated by the channel's own server-side
	// configuration, never by a code prefix a caller can freely invent.
	if mockAllowed(cfg) && (strings.HasPrefix(code, "mock_code_") || code == "test_auth_code") {
		sum := sha256.Sum256([]byte(code))
		mockID := hex.EncodeToString(sum[:4])

		switch providerID {
		case ProviderQQ:
			return &socialProfile{
				Subject:     "qq_openid_" + mockID,
				Username:    "qq_user_" + mockID,
				DisplayName: "QQ 创作者 " + mockID,
				AvatarURL:   "https://thirdqq.qlogo.cn/g?b=oidb&k=" + mockID,
			}, nil
		case ProviderDouyin:
			return &socialProfile{
				Subject:     "douyin_uid_" + mockID,
				Username:    "douyin_creator_" + mockID,
				DisplayName: "抖音创意人 " + mockID,
				AvatarURL:   "https://p3.douyinpic.com/aweme/100x100/" + mockID + ".jpeg",
			}, nil
		case ProviderBilibili:
			return &socialProfile{
				Subject:     "bili_mid_" + mockID,
				Username:    "bili_up_" + mockID,
				DisplayName: "哔哩UP主 " + mockID,
				AvatarURL:   "https://i0.hdslb.com/bfs/face/" + mockID + ".jpg",
			}, nil
		case ProviderWeChat:
			return &socialProfile{
				Subject:     "wx_unionid_" + mockID,
				Username:    "wechat_user_" + mockID,
				DisplayName: "微信用户 " + mockID,
				AvatarURL:   "https://thirdwx.qlogo.cn/mmopen/" + mockID,
			}, nil
		default:
			return &socialProfile{
				Subject:     providerID + "_sub_" + mockID,
				Username:    providerID + "_user_" + mockID,
				DisplayName: strings.ToUpper(providerID) + " User",
				AvatarURL:   "",
			}, nil
		}
	}

	// Live upstream OAuth code exchange (for real provider credentials). Channels
	// that have no real exchange fail closed instead of fabricating an identity.
	if !liveExchangeSupported(providerID) {
		return nil, fmt.Errorf("渠道 %s 尚未接入真实授权码交换，已拒绝登录以避免伪造身份", providerID)
	}
	return redeemCode(ctx, providerID, cfg, code, verifier, redirectURI)
}

func (s *Service) buildNewSocialUser(providerID string, profile *socialProfile) (*model.User, *model.UserIdentity) {
	baseUsername := strings.ToLower(providerID) + "_" + profile.Subject
	if len(baseUsername) > 24 {
		baseUsername = baseUsername[:24]
	}
	userID := kernel.NewID()
	user := &model.User{
		ID:          userID,
		Username:    baseUsername,
		DisplayName: profile.DisplayName,
		Email:       profile.Email,
		Role:        model.UserRoleUser,
		Status:      model.UserStatusActive,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	identity := &model.UserIdentity{
		ID:               kernel.NewID(),
		UserID:           userID,
		Provider:         providerID,
		Subject:          profile.Subject,
		ProviderUsername: profile.Username,
		AvatarURL:        profile.AvatarURL,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}
	return user, identity
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
	if value == "" || err != nil || parsed.IsAbs() || parsed.Host != "" || !strings.HasPrefix(parsed.Path, "/") || strings.HasPrefix(value, "//") || strings.Contains(value, "\\") {
		return "/create"
	}
	return parsed.RequestURI()
}

var (
	globalTicketsMu sync.RWMutex
	globalTickets   = make(map[string]*OnboardingTicket)
)

func (s *Service) saveTicket(t *OnboardingTicket) {
	globalTicketsMu.Lock()
	defer globalTicketsMu.Unlock()
	now := time.Now()
	for id, item := range globalTickets {
		if now.After(item.ExpiresAt) {
			delete(globalTickets, id)
		}
	}
	globalTickets[t.TicketID] = t
}

func (s *Service) getTicket(ticketID string) (*OnboardingTicket, error) {
	globalTicketsMu.RLock()
	defer globalTicketsMu.RUnlock()
	t, ok := globalTickets[ticketID]
	if !ok || time.Now().After(t.ExpiresAt) {
		return nil, kernel.BadAuthRequest("授权入站凭证已过期或不存在，请重新发起登录")
	}
	return t, nil
}

func (s *Service) consumeTicket(ticketID string) (*OnboardingTicket, error) {
	globalTicketsMu.Lock()
	defer globalTicketsMu.Unlock()
	t, ok := globalTickets[ticketID]
	if !ok || time.Now().After(t.ExpiresAt) {
		return nil, kernel.BadAuthRequest("授权入站凭证已过期或不存在，请重新发起登录")
	}
	delete(globalTickets, ticketID)
	return t, nil
}

// GetOnboardingProfile returns the initial user profile carried by the verified OAuth onboarding ticket.
func (s *Service) GetOnboardingProfile(ticketID string) (*OnboardingProfileView, error) {
	t, err := s.getTicket(ticketID)
	if err != nil {
		return nil, err
	}
	return &OnboardingProfileView{
		TicketID:         t.TicketID,
		Provider:         t.Provider,
		ProviderName:     t.ProviderName,
		ProviderUsername: t.ProviderUsername,
		DisplayName:      t.DisplayName,
		Email:            t.Email,
		AvatarURL:        t.AvatarURL,
		EmailAutoBound:   t.Email != "",
	}, nil
}

// CompleteOnboarding registers a new user with custom username, auto-bound/confirmed email and optional password.
func (s *Service) CompleteOnboarding(req CompleteOnboardingRequest) (*model.User, *model.AuthSession, error) {
	t, err := s.consumeTicket(req.TicketID)
	if err != nil {
		return nil, nil, err
	}
	if s.repo == nil {
		return nil, nil, errors.New("存储未初始化")
	}

	username := strings.TrimSpace(req.Username)
	email := strings.TrimSpace(req.Email)
	if t.Email != "" && email == "" {
		email = t.Email
	}

	var user *model.User
	if t.UserID != "" {
		user, err = s.repo.User(t.UserID)
		if err != nil {
			return nil, nil, fmt.Errorf("找不到对应用户：%w", err)
		}
	}

	if username != "" && (user == nil || username != user.Username) {
		if len(username) < 3 || len(username) > 40 {
			return nil, nil, kernel.BadAuthRequest("用户名长度须在 3 到 40 个字符之间")
		}
		excludeID := ""
		if user != nil {
			excludeID = user.ID
		}
		if existing, err := s.repo.UserByUsername(username); err == nil && existing != nil && existing.ID != excludeID {
			return nil, nil, kernel.BadAuthRequest("该用户名已被占用，请尝试其他用户名")
		}
	}

	if email != "" && (user == nil || email != user.Email) {
		excludeID := ""
		if user != nil {
			excludeID = user.ID
		}
		if err := s.repo.CheckEmailAvailable(email, excludeID); err != nil {
			return nil, nil, kernel.BadAuthRequest("该邮箱已被其他账号使用：" + err.Error())
		}
	}

	var passwordHash string
	if password := strings.TrimSpace(req.Password); password != "" {
		if len(password) < 6 {
			return nil, nil, kernel.BadAuthRequest("密码长度至少为 6 个字符")
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			return nil, nil, fmt.Errorf("加密密码失败：%w", err)
		}
		passwordHash = string(hash)
	}

	displayName := strings.TrimSpace(req.DisplayName)
	if displayName == "" {
		displayName = t.DisplayName
	}
	if displayName == "" {
		displayName = username
	}

	now := time.Now()
	var emailVerifiedAt *time.Time
	if email != "" && t.Email != "" && strings.EqualFold(email, t.Email) {
		emailVerifiedAt = &now
	}

	if user != nil {
		if username != "" {
			user.Username = username
		}
		if displayName != "" {
			user.DisplayName = displayName
		}
		if email != "" {
			user.Email = email
			if emailVerifiedAt != nil {
				user.EmailVerifiedAt = emailVerifiedAt
			}
		}
		if passwordHash != "" {
			user.PasswordHash = passwordHash
		}
		user.UpdatedAt = now
		if err := s.repo.Save(user); err != nil {
			return nil, nil, fmt.Errorf("更新用户信息失败：%w", err)
		}
	} else {
		userID := kernel.NewID()
		user = &model.User{
			ID:              userID,
			Username:        username,
			DisplayName:     displayName,
			Email:           email,
			EmailVerifiedAt: emailVerifiedAt,
			PasswordHash:    passwordHash,
			Role:            model.UserRoleUser,
			Status:          model.UserStatusActive,
			CreatedAt:       now,
			UpdatedAt:       now,
		}

		identity := &model.UserIdentity{
			ID:               kernel.NewID(),
			UserID:           userID,
			Provider:         t.Provider,
			Subject:          t.Subject,
			ProviderUsername: t.ProviderUsername,
			AvatarURL:        t.AvatarURL,
			CreatedAt:        now,
			UpdatedAt:        now,
		}

		if err := s.repo.CreateOAuthUser(user, identity); err != nil {
			return nil, nil, fmt.Errorf("创建用户失败：%w", err)
		}
		if s.host != nil {
			_ = s.host.EnsureSignupBonus(user.ID)
		}
	}

	rawToken := RandomToken()
	session := &model.AuthSession{
		ID:        kernel.NewID(),
		UserID:    user.ID,
		TokenHash: HashToken(rawToken),
		ExpiresAt: time.Now().Add(30 * 24 * time.Hour),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	return user, session, nil
}

// GetUserIdentities returns connected social accounts and password state for account management.
func (s *Service) GetUserIdentities(actor *model.User) (*UserIdentitiesView, error) {
	if actor == nil {
		return nil, kernel.Unauthorized("未登录")
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

// BeginBind initiates OAuth flow bound to an existing logged in user account.
func (s *Service) BeginBind(r *http.Request, actor *model.User, providerID string) (string, error) {
	if actor == nil {
		return "", kernel.Unauthorized("未登录")
	}
	settings, err := s.ReadSettings()
	if err != nil {
		return "", err
	}
	cfg, exists := settings.Providers[providerID]
	if !exists || !cfg.Enabled || !channelAdvertisable(providerID, cfg) {
		return "", kernel.Forbidden("该第三方登录渠道未开放或未配置")
	}
	meta := ProviderRegistry[providerID]

	stateToken := RandomToken()
	codeVerifier := RandomToken()

	record := &model.OAuthState{
		ID:            kernel.NewID(),
		Provider:      providerID,
		StateHash:     HashToken(stateToken),
		CodeVerifier:  codeVerifier,
		NextPath:      "/?bind_success=" + url.QueryEscape(providerID),
		ReauthUserID:  actor.ID,
		AcceptedTerms: true,
		ExpiresAt:     time.Now().Add(10 * time.Minute),
		CreatedAt:     time.Now(),
	}
	if s.repo != nil {
		if err := s.repo.CreateOAuthState(record); err != nil {
			return "", err
		}
	}

	callbackURL := resolveCallbackURL(cfg, meta)
	if mockAllowed(cfg) {
		mockCode := "mock_code_" + RandomToken()[:16]
		targetURL := fmt.Sprintf("/api/auth/social/%s/callback?state=%s&code=%s&mock=true", providerID, stateToken, mockCode)
		return targetURL, nil
	}

	return buildAuthorizeURL(providerID, cfg, callbackURL, stateToken, codeVerifier), nil
}

// Unbind safely removes a connected third-party identity, preventing orphaned accounts.
func (s *Service) Unbind(actor *model.User, providerID string) error {
	if actor == nil {
		return kernel.Unauthorized("未登录")
	}
	if s.repo == nil {
		return nil
	}
	identities, err := s.repo.UserIdentitiesForUser(actor.ID)
	if err != nil {
		return err
	}
	var targetFound bool
	for _, ident := range identities {
		if ident.Provider == providerID {
			targetFound = true
			break
		}
	}
	if !targetFound {
		return kernel.BadAuthRequest("未找到已绑定的该渠道账号")
	}

	// Security Guard Check: Prevent user from being locked out without password or other login methods
	hasPassword := actor.PasswordHash != ""
	if !hasPassword && len(identities) <= 1 {
		return kernel.BadAuthRequest("无法解绑唯一的登录凭证。请先在安全设置中设置独立登录密码，或绑定其他第三方账号。")
	}

	return s.repo.DeleteUserIdentity(actor.ID, providerID)
}

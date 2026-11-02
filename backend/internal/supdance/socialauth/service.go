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
	var fields map[string]json.RawMessage
	_ = json.Unmarshal([]byte(setting.ValueJSON), &fields)
	if _, exists := fields["policies"]; !exists {
		stored.Policies = defaults.Policies
	}
	stored.Policies.OrphanAccountSafety = true
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
				if decErr != nil {
					cfg.ClientSecret = ""
					cfg.Enabled = false
					stored.Providers[id] = cfg
					continue
				}
				cfg.ClientSecret = decrypted
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
		UpdatedBy: actorID,
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
		if _, exists := ProviderRegistry[id]; !exists {
			return nil, kernel.BadAuthRequest("未知社交登录渠道")
		}
		cfg := current.Providers[id]
		previouslyReady := channelAdvertisable(id, cfg)
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
		if input.Enabled && !channelAdvertisable(id, cfg) {
			return nil, kernel.BadAuthRequest(fmt.Sprintf("渠道 %s 尚未配置完整密钥，无法启用", id))
		}
		cfg.Enabled = input.Enabled
		cfg.CustomRedirectURL = strings.TrimSpace(input.CustomRedirectURL)
		if !callbackURLValid(id, cfg) {
			return nil, kernel.BadAuthRequest("回调地址必须使用本站 HTTPS 渠道回调路径")
		}
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
// It uses readRawSettings to completely eliminate AES secret decryption for public requests.
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
	cookie, cookieErr := r.Cookie(OAuthBindingCookie)
	if cookieErr != nil || subtle.ConstantTimeCompare([]byte(cookie.Value), []byte(HashToken(stateToken))) != 1 {
		return nil, kernel.BadAuthRequest("授权浏览器不匹配，请从当前浏览器重新登录")
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

	// Recheck lifecycle and credentials after the user returns from the provider.
	var cfg ProviderConfig
	if s.repo != nil {
		settings, settingsErr := s.ReadSettings()
		if settingsErr != nil {
			return nil, settingsErr
		}
		cfg = settings.Providers[providerID]
	}
	if !cfg.Enabled || !channelAdvertisable(providerID, cfg) {
		return nil, kernel.Forbidden("该第三方登录渠道已停用或未配置")
	}
	if time.Now().After(state.ExpiresAt) {
		return nil, kernel.BadAuthRequest("登录授权状态已过期")
	}
	meta := ProviderRegistry[providerID]
	profile, err := s.resolveUserProfile(r.Context(), providerID, code, state.CodeVerifier, cfg, resolveCallbackURL(cfg, meta))
	if err != nil {
		return nil, err
	}

	// Determine if this is a logged-in account linking operation
	bindingUserID := state.ReauthUserID
	if bindingUserID != "" && bindingUserID != currentUserID {
		return nil, kernel.Forbidden("绑定账号的登录会话已变化，请重新发起绑定")
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
				settings, err := s.ReadSettings()
				if err != nil {
					return nil, err
				}
				if !settings.Policies.AutoDirectRegistration {
					return nil, kernel.Forbidden("当前暂停第三方新用户注册")
				}
				// Keep the verified profile pending until onboarding succeeds.
				isNew = true

				ticketID = "onboard_" + RandomToken()
				t := &OnboardingTicket{
					TicketID:         ticketID,
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
				return &SocialAuthCallbackResult{IsNew: true, OnboardingTicket: ticketID, Next: "/?onboarding=1&ticket=" + url.QueryEscape(ticketID)}, nil
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
	candidateUsername := baseUsername
	if s.repo != nil {
		if existing, err := s.repo.UserByUsername(candidateUsername); err == nil && existing != nil {
			candidateUsername = kernel.TruncateRunes(baseUsername, 18) + "_" + RandomToken()[:5]
		}
	}
	email := profile.Email
	if s.repo != nil && email != "" {
		if err := s.repo.CheckEmailAvailable(email, ""); err != nil {
			// Third-party returned email is already occupied; clear email on user record so it can be resolved during onboarding
			email = ""
		}
	}
	userID := kernel.NewID()
	user := &model.User{
		ID:          userID,
		Username:    candidateUsername,
		DisplayName: profile.DisplayName,
		Email:       email,
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
	onboardingMu    sync.Mutex
	identityMu      sync.Mutex
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
	// Serialize ticket completion so validation can be retried without allowing replay.
	onboardingMu.Lock()
	defer onboardingMu.Unlock()
	ticketID := strings.TrimSpace(req.TicketID)
	if ticketID == "" {
		ticketID = strings.TrimSpace(req.Ticket)
	}
	t, err := s.getTicket(ticketID)
	if err != nil {
		return nil, nil, err
	}
	if s.repo == nil {
		return nil, nil, errors.New("存储未初始化")
	}
	if !req.AcceptedTerms {
		return nil, nil, kernel.BadAuthRequest("请先同意服务协议与隐私条款")
	}
	settings, err := s.ReadSettings()
	if err != nil {
		return nil, nil, err
	}
	if !settings.Policies.AutoDirectRegistration {
		return nil, nil, kernel.Forbidden("当前暂停第三方新用户注册")
	}

	username := strings.TrimSpace(req.Username)
	if len(username) < 3 || len(username) > 30 || strings.IndexFunc(username, func(r rune) bool {
		return !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '_' || r == '-')
	}) >= 0 {
		return nil, nil, kernel.BadAuthRequest("用户名需为 3-30 位字母、数字、下划线或短横线")
	}
	email := strings.TrimSpace(req.Email)
	if t.Email != "" && email == "" {
		email = t.Email
	}
	if settings.Policies.MandatoryEmailOnboarding && email == "" {
		return nil, nil, kernel.BadAuthRequest("请填写联系邮箱")
	}
	if email != "" {
		parsed, err := mail.ParseAddress(email)
		if err != nil || parsed.Address != email {
			return nil, nil, kernel.BadAuthRequest("请输入有效邮箱")
		}
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
		displayName = strings.TrimSpace(req.Nickname)
	}
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

	_, _ = s.consumeTicket(ticketID)
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
	return buildAuthorizeURL(providerID, cfg, callbackURL, stateToken, codeVerifier), nil
}

// Unbind safely removes a connected third-party identity, preventing orphaned accounts.
func (s *Service) Unbind(actor *model.User, providerID string) error {
	identityMu.Lock()
	defer identityMu.Unlock()
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

	settings, err := s.ReadSettings()
	orphanSafety := true
	if err == nil {
		orphanSafety = settings.Policies.OrphanAccountSafety
	}

	// Security Guard Check: Prevent user from being locked out without password or other login methods
	if orphanSafety {
		hasPassword := actor.PasswordHash != ""
		if !hasPassword && len(identities) <= 1 {
			return kernel.BadAuthRequest("无法解绑唯一的登录凭证。请先在安全设置中设置独立登录密码，或绑定其他第三方账号。")
		}
	}

	return s.repo.DeleteUserIdentity(actor.ID, providerID)
}

// GetOperationsOverview returns operational dashboard statistics and current policies.
func (s *Service) GetOperationsOverview(r *http.Request, actor *model.User) (*OperationsOverview, error) {
	if err := s.host.RequireAdmin(actor); err != nil {
		return nil, err
	}
	settings, err := s.ReadSettings()
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
		Policies:             settings.Policies,
		ProviderDistribution: dist,
		TotalBindings:        totalBindings,
		DailyActiveTrend:     trend,
		TotalLogins30d:       totalLogins30d,
	}, nil
}

// UpdatePolicies updates global operational policies.
func (s *Service) UpdatePolicies(actor *model.User, policies OperationalPolicies) (*OperationsOverview, error) {
	if err := s.host.RequireAdmin(actor); err != nil {
		return nil, err
	}
	settings, err := s.ReadSettings()
	if err != nil {
		return nil, err
	}
	// Login recovery protection is mandatory; credits use the host's central policy.
	policies.OrphanAccountSafety = true
	policies.SignupBonusCredits = settings.Policies.SignupBonusCredits
	settings.Policies = policies
	if err := s.SaveSettings(actor, settings); err != nil {
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
	identityMu.Lock()
	defer identityMu.Unlock()
	if err := s.host.RequireAdmin(actor); err != nil {
		return err
	}
	settings, err := s.ReadSettings()
	if err != nil {
		return err
	}
	targetUser, err := s.repo.User(targetUserID)
	if err != nil {
		return err
	}
	identities, err := s.repo.UserIdentitiesForUser(targetUserID)
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
		return kernel.BadAuthRequest("未找到该用户绑定的该渠道账号")
	}
	if settings.Policies.OrphanAccountSafety && targetUser.PasswordHash == "" && len(identities) <= 1 {
		return kernel.BadAuthRequest("目标用户未设置独立密码且仅剩此唯一登录凭据，已触发防孤立安全拦截")
	}
	return s.repo.DeleteUserIdentity(targetUserID, providerID)
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

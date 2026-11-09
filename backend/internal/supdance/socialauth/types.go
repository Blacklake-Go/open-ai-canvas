package socialauth

import (
	"time"
)

const (
	PluginID = "supdance-social-auth"

	ConfigSettingKey = "supdance_social_auth"

	OAuthBindingCookie     = "supdance_social_oauth"
	OnboardingTicketPrefix = "onboard_v2_"

	RegionCN   = "cn"   // 中国大陆渠道
	RegionIntl = "intl" // 海外及港澳台渠道

	// Channel Statuses
	StatusUnconfigured        = "unconfigured"         // 未配置
	StatusCredentialsRequired = "credentials_required" // 待录入凭证
	StatusReady               = "ready"                // 配置检查通过 / 已就绪
	StatusOnline              = "online"               // 正常在线
)

// Provider IDs
const (
	// Mainland China
	ProviderQQ       = "qq"
	ProviderWeChat   = "wechat"
	ProviderDouyin   = "douyin"
	ProviderBilibili = "bilibili"

	// International
	ProviderGoogle    = "google"
	ProviderX         = "x"
	ProviderInstagram = "instagram"
	ProviderTikTok    = "tiktok"
)

// AllKnownProviders defines all 8 supported social providers.
var AllKnownProviders = []string{
	ProviderQQ,
	ProviderWeChat,
	ProviderDouyin,
	ProviderBilibili,
	ProviderGoogle,
	ProviderX,
	ProviderInstagram,
	ProviderTikTok,
}

// ProviderMeta contains static branding, region category and title info for a provider.
type ProviderMeta struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Platform    string `json:"platform"`
	Region      string `json:"region"` // "cn" or "intl"
	Icon        string `json:"icon"`
	DefaultPath string `json:"defaultPath"`
	DocURL      string `json:"docUrl"`
}

// OperationalPolicies defines global operational controls for social authentication.
type OperationalPolicies struct {
	AutoDirectRegistration   bool `json:"autoDirectRegistration"`
	MandatoryEmailOnboarding bool `json:"mandatoryEmailOnboarding"`
	SignupBonusCredits       int  `json:"signupBonusCredits"`
	OrphanAccountSafety      bool `json:"orphanAccountSafety"`
}

// ProviderConfig represents stored provider credentials and settings (unencrypted in memory, encrypted at rest).
type ProviderConfig struct {
	Enabled           bool     `json:"enabled"`           // 前台展示开关
	ClientID          string   `json:"clientId"`          // Client ID / AppID / Client Key
	ClientSecret      string   `json:"clientSecret"`      // Client Secret / AppKey / AppSecret (masked in admin view)
	CustomRedirectURL string   `json:"customRedirectUrl"` // 自定义回调地址 (选填，留空使用默认)
	Scopes            []string `json:"scopes"`            // 授权范围
	IconLightURL      string   `json:"iconLightUrl"`      // 自定义品牌图标（亮色界面）
	IconDarkURL       string   `json:"iconDarkUrl"`       // 自定义品牌图标（暗色界面）
}

// StoredSettings is the JSON representation stored in SystemSetting.
type StoredSettings struct {
	DefaultFallbackRegion string                    `json:"defaultFallbackRegion"` // "cn" or "intl"
	TrustedProxyHeaders   []string                  `json:"trustedProxyHeaders"`
	Providers             map[string]ProviderConfig `json:"providers"`
	Policies              OperationalPolicies       `json:"policies"`
	UpdatedAt             time.Time                 `json:"updatedAt"`
	UpdatedBy             string                    `json:"updatedBy"`
}

// ProviderAdminView is returned to the Admin Config Center.
type ProviderAdminView struct {
	ID                 string   `json:"id"`
	Name               string   `json:"name"`
	Platform           string   `json:"platform"`
	Region             string   `json:"region"` // "cn" or "intl"
	Icon               string   `json:"icon"`
	Enabled            bool     `json:"enabled"`
	Status             string   `json:"status"` // unconfigured | credentials_required | ready | online
	StatusLabel        string   `json:"statusLabel"`
	HasCredentials     bool     `json:"hasCredentials"`
	MaskedClientID     string   `json:"maskedClientId"`
	ClientIDMasked     string   `json:"clientIdMasked"`
	MaskedSecret       string   `json:"maskedSecret"`
	ClientSecretMasked string   `json:"clientSecretMasked,omitempty"`
	CallbackURL        string   `json:"callbackUrl"`
	CustomRedirectURL  string   `json:"customRedirectUrl"`
	LatencyMs          int64    `json:"latencyMs"`
	Scopes             []string `json:"scopes"`
	DocURL             string   `json:"docUrl"`
	IconLightURL       string   `json:"iconLightUrl"`
	IconDarkURL        string   `json:"iconDarkUrl"`
}

// AdminSettingsView is the full view for the Admin Social Login Config Center.
type AdminSettingsView struct {
	Revision              string                       `json:"revision"`
	ClientIP              string                       `json:"clientIp"`
	DetectedRegion        string                       `json:"detectedRegion"` // "cn" or "intl"
	DetectedRegionLabel   string                       `json:"detectedRegionLabel"`
	IPSourceHeader        string                       `json:"ipSourceHeader"` // e.g. "x-real-ip" or "x-forwarded-for"
	DefaultFallbackRegion string                       `json:"defaultFallbackRegion"`
	MainlandProviders     []ProviderAdminView          `json:"mainlandProviders"`
	IntlProviders         []ProviderAdminView          `json:"intlProviders"`
	Providers             map[string]ProviderAdminView `json:"providers,omitempty"`
	CNCount               int                          `json:"cnCount"`
	IntlCount             int                          `json:"intlCount"`
	OnlineCount           int                          `json:"onlineCount"`
	UpdatedAt             time.Time                    `json:"updatedAt"`
}

// ProviderPublicView is returned to frontend login pages.
type ProviderPublicView struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Platform     string `json:"platform"`
	Region       string `json:"region"`
	Icon         string `json:"icon"`
	AuthorizeURL string `json:"authorizeUrl"`
	IconLightURL string `json:"iconLightUrl,omitempty"`
	IconDarkURL  string `json:"iconDarkUrl,omitempty"`
}

// PublicProvidersResponse is returned by GET /api/auth/social/providers.
type PublicProvidersResponse struct {
	Region         string                          `json:"region"` // "cn" or "intl"
	DetectedRegion string                          `json:"detectedRegion,omitempty"`
	RegionLabel    string                          `json:"regionLabel"`
	ClientIP       string                          `json:"clientIp"`
	FallbackRegion string                          `json:"fallbackRegion,omitempty"`
	Providers      []ProviderPublicView            `json:"providers"`
	CN             []ProviderPublicView            `json:"cn,omitempty"`
	Intl           []ProviderPublicView            `json:"intl,omitempty"`
	AllRegions     map[string][]ProviderPublicView `json:"allRegions,omitempty"` // for preview / dev
}

// UpdateProviderInput is the DTO for saving/updating a provider's credentials.
type UpdateProviderInput struct {
	Enabled           bool     `json:"enabled"`
	ClientID          string   `json:"clientId"`
	ClientSecret      string   `json:"clientSecret"` // Leave empty to retain existing secret
	CustomRedirectURL string   `json:"customRedirectUrl"`
	Scopes            []string `json:"scopes"`
	IconLightURL      string   `json:"iconLightUrl"` // 空字符串表示清除自定义图标
	IconDarkURL       string   `json:"iconDarkUrl"`
}

// UpdateSettingsRequest is the payload for PUT /api/admin/social-auth/settings.
type UpdateSettingsRequest struct {
	Revision              string                         `json:"revision,omitempty"`
	DefaultFallbackRegion string                         `json:"defaultFallbackRegion,omitempty"`
	Providers             map[string]UpdateProviderInput `json:"providers"`
}

// OperationsOverview represents the dashboard and policy state for operations.
type OperationsOverview struct {
	Revision             string              `json:"revision"`
	Policies             OperationalPolicies `json:"policies"`
	ProviderDistribution map[string]int64    `json:"providerDistribution"`
	TotalBindings        int64               `json:"totalBindings"`
	DailyActiveTrend     []DailyLoginCount   `json:"dailyActiveTrend"`
	TotalLogins30d       int64               `json:"totalLogins30d"`
}

// DailyLoginCount represents single-day login count.
type DailyLoginCount struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

// UserSocialBindingAdminItem describes a user and all their bound social identities.
type UserSocialBindingAdminItem struct {
	UserID      string             `json:"userId"`
	Username    string             `json:"username"`
	Email       string             `json:"email"`
	DisplayName string             `json:"displayName"`
	CreatedAt   time.Time          `json:"createdAt"`
	Identities  []UserIdentityItem `json:"identities"`
}

// SocialLoginLogItem represents a social authentication audit log entry.
type SocialLoginLogItem struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	Username  string    `json:"username"`
	Account   string    `json:"account"`
	Method    string    `json:"method"`
	Source    string    `json:"source"`
	Result    string    `json:"result"`
	Reason    string    `json:"reason"`
	Message   string    `json:"message"`
	IP        string    `json:"ip"`
	CreatedAt time.Time `json:"createdAt"`
}

// ProviderTestResult is returned by POST /api/admin/social-auth/test/:provider.
type ProviderTestResult struct {
	Provider      string    `json:"provider"`
	Status        string    `json:"status"` // "ok", "online", "degraded", "error"
	LatencyMs     int64     `json:"latencyMs"`
	PingLatencyMs int64     `json:"pingLatencyMs"`
	Message       string    `json:"message"`
	CheckedAt     time.Time `json:"checkedAt"`
	TestedAt      time.Time `json:"testedAt"`
}

// OnboardingTicket represents temporary verified OAuth profile details awaiting user confirmation.
type OnboardingTicket struct {
	TicketID         string    `json:"ticketId"`
	UserID           string    `json:"userId"`
	Provider         string    `json:"provider"`
	ProviderName     string    `json:"providerName"`
	Subject          string    `json:"subject"`
	ProviderUsername string    `json:"providerUsername"`
	DisplayName      string    `json:"displayName"`
	Email            string    `json:"email"`
	AvatarURL        string    `json:"avatarUrl"`
	ExpiresAt        time.Time `json:"expiresAt"`
}

// OnboardingProfileView is returned by GET /api/auth/social/onboarding/profile.
type OnboardingProfileView struct {
	Provider         string `json:"provider"`
	ProviderName     string `json:"providerName"`
	ProviderUsername string `json:"providerUsername"`
	DisplayName      string `json:"displayName"`
	Email            string `json:"email"`
	EmailRequired    bool   `json:"emailRequired"`
	AvatarURL        string `json:"avatarUrl"`
	EmailAutoBound   bool   `json:"emailAutoBound"`
}

// CompleteOnboardingRequest is the payload for POST /api/auth/social/onboarding/complete.
type CompleteOnboardingRequest struct {
	AcceptedTerms bool   `json:"acceptedTerms"`
	TicketID      string `json:"-"`
	Username      string `json:"username"`
	DisplayName   string `json:"displayName"`
	Nickname      string `json:"nickname"`
	Email         string `json:"email"`
	EmailTicket   string `json:"emailTicket"`
	EmailCode     string `json:"emailCode"`
	Password      string `json:"password"`
}

// UserIdentityItem describes one third-party connection state in user settings.
type UserIdentityItem struct {
	Provider         string     `json:"provider"`
	ProviderName     string     `json:"providerName"`
	Bound            bool       `json:"bound"`
	Available        bool       `json:"available"`
	ProviderUsername string     `json:"providerUsername"`
	AvatarURL        string     `json:"avatarUrl"`
	BoundAt          *time.Time `json:"boundAt"`
}

// UserIdentitiesView is returned by GET /api/auth/social/identities.
type UserIdentitiesView struct {
	HasPassword bool               `json:"hasPassword"`
	Identities  []UserIdentityItem `json:"identities"`
}

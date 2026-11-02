package socialauth

import (
	"time"
)

const (
	PluginID = "supdance-social-auth"

	ConfigSettingKey = "supdance_social_auth"

	OAuthBindingCookie = "supdance_social_oauth"

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

// ProviderConfig represents stored provider credentials and settings (unencrypted in memory, encrypted at rest).
type ProviderConfig struct {
	Enabled            bool     `json:"enabled"`           // 前台展示开关
	ClientID           string   `json:"clientId"`          // Client ID / AppID / Client Key
	ClientSecret       string   `json:"clientSecret"`      // Client Secret / AppKey / AppSecret (masked in admin view)
	CustomRedirectURL  string   `json:"customRedirectUrl"` // 自定义回调地址 (选填，留空使用默认)
	Scopes             []string `json:"scopes"`            // 授权范围
	SandboxMockEnabled bool     `json:"sandboxMockEnabled"`
}

// StoredSettings is the JSON representation stored in SystemSetting.
type StoredSettings struct {
	DefaultFallbackRegion string                    `json:"defaultFallbackRegion"` // "cn" or "intl"
	TrustedProxyHeaders   []string                  `json:"trustedProxyHeaders"`
	Providers             map[string]ProviderConfig `json:"providers"`
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
	SandboxMockEnabled bool     `json:"sandboxMockEnabled"`
}

// AdminSettingsView is the full view for the Admin Social Login Config Center.
type AdminSettingsView struct {
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
	ID             string `json:"id"`
	Name           string `json:"name"`
	Platform       string `json:"platform"`
	Region         string `json:"region"`
	Icon           string `json:"icon"`
	AuthorizeURL   string `json:"authorizeUrl"`
	SandboxEnabled bool   `json:"sandboxEnabled,omitempty"`
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
	Enabled            bool     `json:"enabled"`
	ClientID           string   `json:"clientId"`
	ClientSecret       string   `json:"clientSecret"` // Leave empty to retain existing secret
	CustomRedirectURL  string   `json:"customRedirectUrl"`
	Scopes             []string `json:"scopes"`
	SandboxMockEnabled bool     `json:"sandboxMockEnabled"`
}

// UpdateSettingsRequest is the payload for PUT /api/admin/social-auth/settings.
type UpdateSettingsRequest struct {
	DefaultFallbackRegion string                         `json:"defaultFallbackRegion,omitempty"`
	Providers             map[string]UpdateProviderInput `json:"providers"`
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
	TicketID         string `json:"ticketId"`
	Provider         string `json:"provider"`
	ProviderName     string `json:"providerName"`
	ProviderUsername string `json:"providerUsername"`
	DisplayName      string `json:"displayName"`
	Email            string `json:"email"`
	AvatarURL        string `json:"avatarUrl"`
	EmailAutoBound   bool   `json:"emailAutoBound"`
}

// CompleteOnboardingRequest is the payload for POST /api/auth/social/onboarding/complete.
type CompleteOnboardingRequest struct {
	TicketID    string `json:"ticketId"`
	Username    string `json:"username"`
	DisplayName string `json:"displayName"`
	Email       string `json:"email"`
	Password    string `json:"password"`
}

// UserIdentityItem describes one third-party connection state in user settings.
type UserIdentityItem struct {
	Provider         string     `json:"provider"`
	ProviderName     string     `json:"providerName"`
	Bound            bool       `json:"bound"`
	ProviderUsername string     `json:"providerUsername"`
	AvatarURL        string     `json:"avatarUrl"`
	BoundAt          *time.Time `json:"boundAt"`
}

// UserIdentitiesView is returned by GET /api/auth/social/identities.
type UserIdentitiesView struct {
	HasPassword bool               `json:"hasPassword"`
	Identities  []UserIdentityItem `json:"identities"`
}

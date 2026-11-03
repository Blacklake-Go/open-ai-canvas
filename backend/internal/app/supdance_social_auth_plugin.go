package app

import (
	"fmt"
	"net/http"
	"time"

	"yingce/backend/internal/auth"
	"yingce/backend/internal/kernel"
	"yingce/backend/internal/model"
	"yingce/backend/internal/platform"
	"yingce/backend/internal/supdance/socialauth"
)

const (
	PluginSupDanceSocialAuth = socialauth.PluginID
)

// wireSocialAuthTicketStore keeps onboarding tickets in the shared Redis so a
// backend restart or an additional replica cannot lose or replay them. Without
// Redis the service falls back to its single-process in-memory tickets.
func wireSocialAuthTicketStore(coordinator *platform.Coordinator) {
	if coordinator != nil && coordinator.HasRedis() {
		socialauth.UseTicketStore(socialauth.NewRedisTicketStore(coordinator.Redis()))
	}
}

type (
	SocialAuthAdminSettingsView         = socialauth.AdminSettingsView
	SocialAuthSettingsUpdateRequest     = socialauth.UpdateSettingsRequest
	SocialAuthProviderTestResult        = socialauth.ProviderTestResult
	SocialAuthProvidersPublicView       = socialauth.PublicProvidersResponse
	SocialAuthOnboardingProfileView     = socialauth.OnboardingProfileView
	SocialAuthCompleteOnboardingRequest = socialauth.CompleteOnboardingRequest
	SocialAuthUserIdentitiesView        = socialauth.UserIdentitiesView
	SocialAuthUserIdentityItem          = socialauth.UserIdentityItem
	SocialAuthOperationalPolicies       = socialauth.OperationalPolicies
	SocialAuthOperationsOverview        = socialauth.OperationsOverview
	SocialAuthUserSocialBindingItem     = socialauth.UserSocialBindingAdminItem
	SocialAuthLoginLogItem              = socialauth.SocialLoginLogItem
)

type socialAuthHost struct {
	svc *Service
}

func (h *socialAuthHost) EncryptSecret(plain string) (string, error) {
	if h.svc == nil {
		return plain, nil
	}
	return h.svc.encryptSettingSecret(plain)
}

func (h *socialAuthHost) DecryptSecret(cipher string) (string, error) {
	if h.svc == nil {
		return cipher, nil
	}
	return h.svc.decryptSettingSecret(cipher)
}

func (h *socialAuthHost) BrandName() string {
	if h.svc == nil {
		return "SupDance"
	}
	return h.svc.appearanceBrandName()
}

func (h *socialAuthHost) RequireAdmin(actor *model.User) error {
	if h.svc == nil {
		return nil
	}
	return h.svc.RequireAdmin(actor)
}

func (h *socialAuthHost) EnsureSignupBonus(userID string) error {
	if h.svc == nil {
		return nil
	}
	return h.svc.ensureSignupBonus(userID)
}

func (s *Service) socialAuthService() *socialauth.Service {
	return socialauth.NewService(s.repo, &socialAuthHost{svc: s})
}

// SocialAuthAdminSettings returns the full admin config center view matching Figure 3.
func (s *Service) SocialAuthAdminSettings(r *http.Request, actor *model.User) (*socialauth.AdminSettingsView, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	return s.socialAuthService().GetAdminSettings(r, actor)
}

// UpdateSocialAuthAdminSettings updates credentials and partition configuration.
func (s *Service) UpdateSocialAuthAdminSettings(r *http.Request, actor *model.User, req socialauth.UpdateSettingsRequest) (*socialauth.AdminSettingsView, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	view, err := s.socialAuthService().UpdateAdminSettings(r, actor, req)
	if err != nil {
		return nil, err
	}
	_ = s.appendAdminAudit(actor, "socialauth.settings.update", "plugin", PluginSupDanceSocialAuth, "更新第三方社交登录配置与密钥轮换", map[string]any{
		"defaultFallbackRegion": req.DefaultFallbackRegion,
		"providersCount":        len(req.Providers),
	})
	return view, nil
}

// TestSocialAuthProvider tests the connection/ping of a provider.
func (s *Service) TestSocialAuthProvider(actor *model.User, providerID string) (*socialauth.ProviderTestResult, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	return s.socialAuthService().TestProvider(actor, providerID)
}

// SocialAuthPluginAvailable returns whether the supdance-social-auth plugin is currently enabled on the platform.
func (s *Service) SocialAuthPluginAvailable() (bool, error) {
	if s.repo == nil {
		return true, nil
	}
	state, err := s.repo.PluginPlatformState(PluginSupDanceSocialAuth)
	if err != nil {
		return false, fmt.Errorf("读取第三方社交登录插件状态：%w", err)
	}
	if state == nil {
		return true, nil
	}
	return state.Available, nil
}

// PublicSocialAuthProviders returns available providers for the visitor's dynamic IP geo-partition.
func (s *Service) PublicSocialAuthProviders(r *http.Request) (*socialauth.PublicProvidersResponse, error) {
	available, err := s.SocialAuthPluginAvailable()
	if err != nil {
		return nil, err
	}
	if !available {
		return &socialauth.PublicProvidersResponse{
			Region:    socialauth.RegionCN,
			Providers: []socialauth.ProviderPublicView{},
		}, nil
	}
	return s.socialAuthService().GetPublicProviders(r)
}

// BeginSocialAuth starts social authorization flow with authoritative geo-partition enforcement.
func (s *Service) BeginSocialAuth(r *http.Request, providerID string, nextPath string, acceptedTerms bool) (string, error) {
	available, err := s.SocialAuthPluginAvailable()
	if err != nil {
		return "", err
	}
	if !available {
		return "", kernel.Forbidden("第三方社交登录插件已被系统管理员停用")
	}
	return s.socialAuthService().BeginAuth(r, providerID, nextPath, acceptedTerms)
}

// SocialAuthLoginResult combines social auth callback with session creation and login logging.
type SocialAuthLoginResult struct {
	Session          *AuthSessionResult `json:"session,omitempty"`
	Next             string             `json:"next"`
	IsNew            bool               `json:"isNew"`
	User             *model.User        `json:"user,omitempty"`
	OnboardingTicket string             `json:"onboardingTicket,omitempty"`
}

// CompleteSocialAuth completes social login, binds user, or initiates onboarding ticket.
func (s *Service) CompleteSocialAuth(r *http.Request, providerID string, state string, code string, cookie string, contexts ...LoginContext) (*SocialAuthLoginResult, error) {
	available, err := s.SocialAuthPluginAvailable()
	if err != nil {
		return nil, err
	}
	if !available {
		return nil, kernel.Forbidden("第三方社交登录插件已被系统管理员停用")
	}

	var context LoginContext
	if len(contexts) > 0 {
		context = contexts[0]
	}
	event := auth.NewLoginLog("social_"+providerID, "login", context)

	currentUserID := ""
	if cookie != "" {
		if u, err := s.CurrentUser(cookie); err == nil && u != nil {
			currentUserID = u.ID
		}
	}

	result, err := s.socialAuthService().CompleteAuth(r, providerID, state, code, currentUserID)
	if err != nil {
		_ = s.authDomain().RecordLoginFailure(event, err)
		return nil, err
	}

	// New OAuth user awaiting onboarding profile confirmation
	if result.OnboardingTicket != "" {
		return &SocialAuthLoginResult{
			OnboardingTicket: result.OnboardingTicket,
			Next:             result.Next,
			IsNew:            true,
		}, nil
	}

	if result.User != nil {
		auth.LoginLogUser(event, result.User)
		now := time.Now()
		result.User.LastLoginAt = &now
		_ = s.repo.UpdateUserLoginTime(result.User.ID, now)

		session, err := s.authDomain().CreateAuthSession(result.User, event)
		if err != nil {
			return nil, err
		}

		return &SocialAuthLoginResult{
			Session: session,
			Next:    result.Next,
			IsNew:   result.IsNew,
			User:    result.User,
		}, nil
	}

	return &SocialAuthLoginResult{
		Next:  result.Next,
		IsNew: result.IsNew,
	}, nil
}

// SocialAuthOnboardingProfile returns the profile info for the onboarding modal.
func (s *Service) SocialAuthOnboardingProfile(ticket string) (*socialauth.OnboardingProfileView, error) {
	return s.socialAuthService().GetOnboardingProfile(ticket)
}

// CompleteSocialAuthOnboarding creates the user and signs them in after onboarding modal confirmation.
func (s *Service) CompleteSocialAuthOnboarding(r *http.Request, req socialauth.CompleteOnboardingRequest, contexts ...LoginContext) (*SocialAuthLoginResult, error) {
	available, err := s.SocialAuthPluginAvailable()
	if err != nil {
		return nil, err
	}
	if !available {
		return nil, kernel.Forbidden("第三方社交登录插件已被系统管理员停用")
	}
	user, session, err := s.socialAuthService().CompleteOnboarding(req)
	if err != nil {
		return nil, err
	}

	var context LoginContext
	if len(contexts) > 0 {
		context = contexts[0]
	}
	event := auth.NewLoginLog("social_onboarding", "login", context)
	auth.LoginLogUser(event, user)
	now := time.Now()
	user.LastLoginAt = &now
	_ = s.repo.UpdateUserLoginTime(user.ID, now)

	authSession, err := s.authDomain().CreateAuthSession(user, event)
	if err != nil {
		return nil, err
	}
	_ = session

	return &SocialAuthLoginResult{
		Session: authSession,
		Next:    "/create",
		IsNew:   true,
		User:    user,
	}, nil
}

// UserSocialIdentities returns connected accounts and password status for user settings.
func (s *Service) UserSocialIdentities(actor *model.User) (*socialauth.UserIdentitiesView, error) {
	return s.socialAuthService().GetUserIdentities(actor)
}

// BeginSocialAuthBind starts the OAuth flow to bind a provider to the logged in user.
func (s *Service) BeginSocialAuthBind(r *http.Request, actor *model.User, providerID string, nextPath ...string) (string, error) {
	available, err := s.SocialAuthPluginAvailable()
	if err != nil {
		return "", err
	}
	if !available {
		return "", kernel.Forbidden("第三方社交登录插件已被系统管理员停用")
	}
	return s.socialAuthService().BeginBind(r, actor, providerID, nextPath...)
}

// UnbindSocialAuth disconnects a social identity while guarding against orphaned accounts.
func (s *Service) UnbindSocialAuth(actor *model.User, providerID string) error {
	return s.socialAuthService().Unbind(actor, providerID)
}

// SocialAuthOperationsOverview returns operational dashboard statistics and current policies.
func (s *Service) SocialAuthOperationsOverview(r *http.Request, actor *model.User) (*socialauth.OperationsOverview, error) {
	return s.socialAuthService().GetOperationsOverview(r, actor)
}

// UpdateSocialAuthPolicies updates global operational policies.
func (s *Service) UpdateSocialAuthPolicies(actor *model.User, policies socialauth.OperationalPolicies) (*socialauth.OperationsOverview, error) {
	view, err := s.socialAuthService().UpdatePolicies(actor, policies)
	if err != nil {
		return nil, err
	}
	_ = s.appendAdminAudit(actor, "socialauth.policies.update", "plugin", PluginSupDanceSocialAuth, "更新第三方社交登录运营策略", map[string]any{
		"autoDirectRegistration":   policies.AutoDirectRegistration,
		"mandatoryEmailOnboarding": policies.MandatoryEmailOnboarding,
		"signupBonusCredits":       policies.SignupBonusCredits,
		"orphanAccountSafety":      policies.OrphanAccountSafety,
	})
	return view, nil
}

// SearchSocialAuthUsers queries users and their bound social identities.
func (s *Service) SearchSocialAuthUsers(actor *model.User, query string) ([]socialauth.UserSocialBindingAdminItem, error) {
	return s.socialAuthService().SearchUsers(actor, query)
}

// AdminUnbindSocialAuth unbinds a social identity for any user by administrator.
func (s *Service) AdminUnbindSocialAuth(actor *model.User, targetUserID string, providerID string) error {
	if err := s.socialAuthService().AdminUnbindUser(actor, targetUserID, providerID); err != nil {
		return err
	}
	_ = s.appendAdminAudit(actor, "socialauth.identity.unbind", "user", targetUserID, "管理员解绑用户社交登录身份", map[string]any{
		"targetUserId": targetUserID,
		"provider":     providerID,
	})
	return nil
}

// SocialAuthLoginLogs returns recent social login logs for auditing.
func (s *Service) SocialAuthLoginLogs(actor *model.User, limit int) ([]socialauth.SocialLoginLogItem, error) {
	return s.socialAuthService().GetLoginLogs(actor, limit)
}

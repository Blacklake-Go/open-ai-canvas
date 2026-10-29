package app

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"yingce/backend/internal/auth"
	"yingce/backend/internal/kernel"
	"yingce/backend/internal/model"
	"yingce/backend/internal/supdance/socialauth"
)

const (
	PluginSupDanceSocialAuth = socialauth.PluginID
)

type (
	SocialAuthAdminSettingsView     = socialauth.AdminSettingsView
	SocialAuthSettingsUpdateRequest = socialauth.UpdateSettingsRequest
	SocialAuthProviderTestResult    = socialauth.ProviderTestResult
	SocialAuthProvidersPublicView   = socialauth.PublicProvidersResponse
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
func (s *Service) BeginSocialAuth(r *http.Request, providerID string, nextPath string, acceptedTerms bool, isMock bool) (string, error) {
	available, err := s.SocialAuthPluginAvailable()
	if err != nil {
		return "", err
	}
	if !available {
		return "", kernel.Forbidden("第三方社交登录插件已被系统管理员停用")
	}
	return s.socialAuthService().BeginAuth(r, providerID, nextPath, acceptedTerms, isMock)
}

// SocialAuthLoginResult combines social auth callback with session creation and login logging.
type SocialAuthLoginResult struct {
	Session *AuthSessionResult
	Next    string
	IsNew   bool
	User    *model.User
}

// CompleteSocialAuth completes social login, binds user, and records login logs.
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
	if strings.HasPrefix(code, "mock_code_") {
		event.Source = "mock_social_" + providerID
	}

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

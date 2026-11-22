package user

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"one/backend/internal/domain/auth"
	"one/backend/internal/pkg/ids"
	"one/backend/internal/platform/coordination"
)

var (
	ErrNotImplemented = errors.New("user domain repository not yet implemented")
	ErrNotFound       = errors.New("USER_NOT_FOUND")
	ErrEmailConflict  = errors.New("EMAIL_CONFLICT")
	ErrPhoneConflict  = errors.New("PHONE_CONFLICT")
	ErrLastCredential = errors.New("LAST_CREDENTIAL")
)

const DefaultAvatarPath = "/assets/avatars/default-01.svg"

var oauthProviders = []string{"google", "github", "apple", "discord", "wechat", "qq", "douyin", "bilibili", "tiktok"}

type ServiceError struct {
	Status     int
	Code       string
	Message    string
	RetryAfter int
}

func (e *ServiceError) Error() string { return e.Message }

func svcErr(status int, code, msg string) *ServiceError {
	return &ServiceError{Status: status, Code: code, Message: msg}
}

type Profile struct {
	ID                 string         `json:"id"`
	UUID               string         `json:"uuid,omitempty"`
	UserNumber         string         `json:"userNumber"`
	Username           string         `json:"username,omitempty"`
	Email              string         `json:"email,omitempty"`
	Phone              string         `json:"phone,omitempty"`
	PhoneCountryCode   string         `json:"phoneCountryCode,omitempty"`
	Name               string         `json:"name,omitempty"`
	DisplayName        string         `json:"displayName"`
	AvatarURL          string         `json:"avatarUrl,omitempty"`
	AvatarFrame        string         `json:"avatarFrame,omitempty"`
	Bio                string         `json:"bio,omitempty"`
	Website            string         `json:"website,omitempty"`
	Locale             string         `json:"locale"`
	Role               string         `json:"role"`
	Status             string         `json:"status"`
	Credits            int64          `json:"credits"`
	EmailVerified      bool           `json:"email_verified"`
	HasPassword        bool           `json:"hasPassword"`
	FollowersCount     int            `json:"followersCount"`
	FollowingCount     int            `json:"followingCount"`
	CreationsCount     int            `json:"creationsCount"`
	PostsCount         int            `json:"postsCount"`
	TotalLikes         int            `json:"totalLikes"`
	IsActivityPublic   bool           `json:"isActivityPublic"`
	PrivacySettings    map[string]any `json:"privacySettings"`
	Preferences        map[string]any `json:"preferences"`
	SocialLinks        map[string]any `json:"socialLinks"`
	Zodiac             string         `json:"zodiac,omitempty"`
	Industry           string         `json:"industry,omitempty"`
	Occupation         string         `json:"occupation,omitempty"`
	Country            string         `json:"country,omitempty"`
	Gender             string         `json:"gender,omitempty"`
	OccupationCode     string         `json:"occupationCode,omitempty"`
	StyleCodes         []string       `json:"styleCodes,omitempty"`
	OnboardingComplete bool           `json:"onboardingCompleted"`
	OnboardingStep     int            `json:"onboardingStep"`
	PasswordHash       string         `json:"-"`
	PasswordSalt       string         `json:"-"`
	DeletionDueAt      *time.Time     `json:"deletionDueAt,omitempty"`
}

type NotificationItem struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	IsRead    bool      `json:"isRead"`
	Link      string    `json:"link,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

type OAuthAccountItem struct {
	Provider              string    `json:"provider"`
	ProviderUsername      string    `json:"provider_username,omitempty"`
	DisplayName           string    `json:"display_name,omitempty"`
	CreatedAt             time.Time `json:"created_at"`
	ProviderEmailVerified bool      `json:"provider_email_verified"`
}

type OnboardingPayload struct {
	Completed          bool     `json:"onboardingCompleted"`
	Step               int      `json:"onboardingStep"`
	Country            string   `json:"country,omitempty"`
	Gender             string   `json:"gender,omitempty"`
	OccupationCode     string   `json:"occupationCode,omitempty"`
	StyleCodes         []string `json:"styleCodes,omitempty"`
	CreatorPersonaCode string   `json:"creatorPersonaCode,omitempty"`
}

type ActivityDashboard struct {
	TotalCreations int              `json:"totalCreations"`
	TotalCredits   int64            `json:"totalCredits"`
	ActiveDays     int              `json:"activeDays"`
	Heatmap        map[string]int   `json:"heatmap"`
	TopModels      []map[string]any `json:"topModels"`
	IsPublic       bool             `json:"isPublic"`
}

type Repository interface {
	GetByID(ctx context.Context, userID string) (*Profile, error)
	GetProfileByIdentifier(ctx context.Context, identifier string) (*Profile, error)
	UpdateProfile(ctx context.Context, userID string, displayName, bio, website, avatarURL, username *string) (*Profile, error)
	SetAvatarFrame(ctx context.Context, userID string, frame string) error
	HasUnlockedAvatarFrame(ctx context.Context, userID string, frame string) (bool, error)

	GetOrInitAPIKey(ctx context.Context, userID string, generator func() string) (string, string, error)
	RotateAPIKey(ctx context.Context, userID string, newKey string) (string, string, error)

	UpdatePassword(ctx context.Context, userID, passwordHash, passwordSalt string) error
	BindEmail(ctx context.Context, userID, email string) error
	UnbindEmail(ctx context.Context, userID string) error
	IsEmailOwnedByAnother(ctx context.Context, email, userID string) (bool, error)
	UpdatePhone(ctx context.Context, userID, phone, countryCode string) error
	UnbindPhone(ctx context.Context, userID string) error
	ClearAvatar(ctx context.Context, userID string) (*Profile, error)

	GetPreferences(ctx context.Context, userID string) (map[string]any, error)
	UpdatePreferences(ctx context.Context, userID string, prefs map[string]any) (map[string]any, error)
	UpdatePrivacy(ctx context.Context, userID string, isPublic *bool, settings map[string]any) (bool, map[string]any, error)

	IsFollowing(ctx context.Context, userID, targetID string) (bool, error)
	ToggleFollow(ctx context.Context, userID, targetID string) (bool, error)

	ListNotifications(ctx context.Context, userID string, limit int) ([]NotificationItem, int, error)
	MarkAllNotificationsRead(ctx context.Context, userID string) error

	GetActivityDashboard(ctx context.Context, targetID string) (*ActivityDashboard, error)

	GetOnboarding(ctx context.Context, userID string) (*OnboardingPayload, error)
	SaveOnboarding(ctx context.Context, userID string, in OnboardingPayload) (*OnboardingPayload, error)

	ListOAuthAccounts(ctx context.Context, userID string) ([]OAuthAccountItem, error)
	CountValidCredentials(ctx context.Context, userID string) (total int, providerCount int, err error)
	UnbindOAuthProvider(ctx context.Context, userID, provider string) error

	ScheduleDeactivation(ctx context.Context, userID string, dueAt time.Time, reason string) error
	CancelDeactivation(ctx context.Context, userID string) error
}

type Service struct {
	Repo     Repository
	AuthRepo auth.AuthRepository
	Sender   auth.OutboundCodeSender
	Coord    *coordination.Coordinator
	Secret   string
	Now      func() time.Time
}

func (s *Service) now() time.Time {
	if s != nil && s.Now != nil {
		return s.Now()
	}
	return time.Now().UTC()
}

func (s *Service) codeSecret() string {
	if s != nil && strings.TrimSpace(s.Secret) != "" {
		return s.Secret
	}
	return "one-dev-verification-secret"
}

func (s *Service) checkLimit(ctx context.Context, scope, subject string, limit int, window time.Duration) error {
	if s.Coord == nil {
		return nil
	}
	res, err := s.Coord.ConsumeRateLimit(ctx, coordination.RateLimitRequest{
		Scope: scope, Subject: subject, Limit: limit, Window: window,
	})
	if err != nil {
		return err
	}
	if !res.Allowed {
		return &ServiceError{
			Status:     http.StatusTooManyRequests,
			Code:       "RATE_LIMITED",
			Message:    "请求过于频繁，请稍后再试",
			RetryAfter: res.RetryAfterSeconds,
		}
	}
	return nil
}

func (s *Service) GetProfile(ctx context.Context, userID string) (*Profile, error) {
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	return s.Repo.GetByID(ctx, userID)
}

func (s *Service) GetProfilePublicOrSelf(ctx context.Context, identifier string) (*Profile, error) {
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	p, err := s.Repo.GetProfileByIdentifier(ctx, identifier)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, svcErr(http.StatusNotFound, "USER_NOT_FOUND", "用户不存在")
	}
	return p, nil
}

type ProfilePatch struct {
	DisplayName    *string
	Bio            *string
	Website        *string
	AvatarURL      *string
	Username       *string
	SocialLinks    map[string]any
	Locale         *string
	Zodiac         *string
	Industry       *string
	Occupation     *string
	Country        *string
	Gender         *string
	OccupationCode *string
	StyleCodes     []string
	HasStyleCodes  bool
}

type ExtendedProfileUpdater interface {
	UpdateProfilePatch(ctx context.Context, userID string, patch ProfilePatch) (*Profile, error)
}

func (s *Service) UpdateProfile(ctx context.Context, userID string, displayName, bio, website, avatarURL, username *string) (*Profile, error) {
	return s.UpdateProfileFull(ctx, userID, ProfilePatch{
		DisplayName: displayName,
		Bio:         bio,
		Website:     website,
		AvatarURL:   avatarURL,
		Username:    username,
	})
}

func (s *Service) UpdateProfileFull(ctx context.Context, userID string, patch ProfilePatch) (*Profile, error) {
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	if err := s.checkLimit(ctx, "user_profile_update", userID, 30, time.Hour); err != nil {
		return nil, err
	}
	if patch.DisplayName != nil {
		t := strings.TrimSpace(*patch.DisplayName)
		if t == "" || len([]rune(t)) > 64 {
			return nil, svcErr(http.StatusBadRequest, "INVALID_DISPLAY_NAME", "昵称长度需在 1 到 64 个字符之间")
		}
		patch.DisplayName = &t
	}
	if patch.Website != nil && strings.TrimSpace(*patch.Website) != "" {
		u, err := url.ParseRequestURI(strings.TrimSpace(*patch.Website))
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
			return nil, svcErr(http.StatusBadRequest, "INVALID_WEBSITE", "个人主页链接必须以 http:// 或 https:// 开头")
		}
	}
	if ext, ok := s.Repo.(ExtendedProfileUpdater); ok {
		return ext.UpdateProfilePatch(ctx, userID, patch)
	}
	return s.Repo.UpdateProfile(ctx, userID, patch.DisplayName, patch.Bio, patch.Website, patch.AvatarURL, patch.Username)
}

func (s *Service) GetAvatarRedirectURL(ctx context.Context, userID string) string {
	if s.Repo == nil || strings.TrimSpace(userID) == "" {
		return DefaultAvatarPath
	}
	p, err := s.Repo.GetByID(ctx, userID)
	if err != nil || p == nil || strings.TrimSpace(p.AvatarURL) == "" {
		return DefaultAvatarPath
	}
	return p.AvatarURL
}

func (s *Service) UpdateAvatar(ctx context.Context, userID, avatarURL string) (*Profile, error) {
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	clean := strings.TrimSpace(avatarURL)
	if clean == "" {
		return nil, svcErr(http.StatusBadRequest, "INVALID_AVATAR", "头像地址不能为空")
	}
	if !strings.HasPrefix(clean, "/") && !strings.HasPrefix(clean, "https://") && !strings.HasPrefix(clean, "http://") && !strings.HasPrefix(clean, "data:image/") {
		return nil, svcErr(http.StatusBadRequest, "INVALID_AVATAR", "不支持的头像地址格式")
	}
	return s.Repo.UpdateProfile(ctx, userID, nil, nil, nil, &clean, nil)
}

func (s *Service) DeleteAvatar(ctx context.Context, userID string) (*Profile, error) {
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	return s.Repo.ClearAvatar(ctx, userID)
}

var validFrameRe = regexp.MustCompile(`^(coin-(gold|cyan)|zodiac-(aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces))$`)

func (s *Service) WearAvatarFrame(ctx context.Context, userID, frame string) (map[string]any, error) {
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	if err := s.checkLimit(ctx, "user_avatar_frame", userID, 60, time.Hour); err != nil {
		return nil, err
	}
	clean := strings.TrimSpace(frame)
	if clean != "" {
		if !validFrameRe.MatchString(clean) {
			return nil, svcErr(http.StatusBadRequest, "INVALID_FRAME", "无效的头像框样式")
		}
		unlocked, err := s.Repo.HasUnlockedAvatarFrame(ctx, userID, clean)
		if err != nil {
			return nil, err
		}
		if !unlocked {
			return nil, svcErr(http.StatusBadRequest, "FRAME_NOT_OWNED", "请先兑换该头像框后再佩戴")
		}
	}
	if err := s.Repo.SetAvatarFrame(ctx, userID, clean); err != nil {
		return nil, err
	}
	msg := "已摘下头像框"
	if clean != "" {
		msg = "头像框已佩戴"
	}
	return map[string]any{"success": true, "avatarFrame": clean, "message": msg}, nil
}

func generateAPIKey() string {
	return "sk-koyo-live-" + auth.GenerateRandomHex(20)
}

func (s *Service) GetAPIKey(ctx context.Context, userID string) (string, string, error) {
	if s.Repo == nil {
		return "", "", ErrNotImplemented
	}
	return s.Repo.GetOrInitAPIKey(ctx, userID, generateAPIKey)
}

func (s *Service) RotateAPIKey(ctx context.Context, userID string) (string, string, error) {
	if s.Repo == nil {
		return "", "", ErrNotImplemented
	}
	if err := s.checkLimit(ctx, "user.api-key", userID, 20, time.Minute); err != nil {
		return "", "", err
	}
	return s.Repo.RotateAPIKey(ctx, userID, generateAPIKey())
}

func (s *Service) ChangePassword(ctx context.Context, userID, currentPassword, newPassword string) error {
	if s.Repo == nil {
		return ErrNotImplemented
	}
	if err := s.checkLimit(ctx, "user_password", userID, 10, 15*time.Minute); err != nil {
		return err
	}
	if len(newPassword) < 8 || len(newPassword) > 128 {
		return svcErr(http.StatusBadRequest, "INVALID_PASSWORD", "新密码长度需在 8 到 128 位之间")
	}
	p, err := s.Repo.GetByID(ctx, userID)
	if err != nil {
		return err
	}
	if p == nil {
		return svcErr(http.StatusNotFound, "USER_NOT_FOUND", "用户不存在")
	}
	if p.HasPassword && !auth.VerifyPassword(currentPassword, p.PasswordHash, p.PasswordSalt) {
		return svcErr(http.StatusBadRequest, "INVALID_CURRENT_PASSWORD", "当前密码不正确")
	}
	hashHex, saltHex, err := auth.HashPassword(newPassword)
	if err != nil {
		return err
	}
	return s.Repo.UpdatePassword(ctx, userID, hashHex, saltHex)
}

func (s *Service) SendEmailBindCode(ctx context.Context, userID, email, ip string) error {
	clean := auth.NormalizeEmail(email)
	if !auth.IsValidEmail(clean) {
		return svcErr(http.StatusBadRequest, "INVALID_EMAIL", "请输入有效的邮箱地址")
	}
	if err := s.checkLimit(ctx, "user_email_code", userID, 5, time.Hour); err != nil {
		return err
	}
	if s.Repo != nil {
		taken, err := s.Repo.IsEmailOwnedByAnother(ctx, clean, userID)
		if err != nil {
			return err
		}
		if taken {
			return svcErr(http.StatusConflict, "EMAIL_ALREADY_EXISTS", "该邮箱已被其他账户绑定")
		}
	}
	if s.AuthRepo != nil {
		code := auth.GenerateNumericOTP(6)
		codeHash := auth.HashVerificationCode(s.codeSecret(), clean, "email_bind", code)
		id, _ := ids.NewPrefixedID("evc")
		if err := s.AuthRepo.ReplaceVerificationCode(ctx, id, clean, codeHash, "email_bind", s.now().Add(auth.EmailCodeLifetime), ip); err != nil {
			return err
		}
		if s.Sender != nil {
			if err := s.Sender.SendEmailCode(ctx, clean, code, "email_bind"); err != nil {
				_ = s.AuthRepo.MarkVerificationCodeUsed(ctx, id)
				return svcErr(http.StatusServiceUnavailable, "EMAIL_DELIVERY_FAILED", err.Error())
			}
		}
	}
	return nil
}

func (s *Service) BindEmail(ctx context.Context, userID, email, code string) error {
	clean := auth.NormalizeEmail(email)
	if !auth.IsValidEmail(clean) {
		return svcErr(http.StatusBadRequest, "INVALID_EMAIL", "请输入有效的邮箱地址")
	}
	if strings.TrimSpace(code) == "" {
		return svcErr(http.StatusBadRequest, "INVALID_CODE", "请输入邮箱验证码")
	}
	if s.Repo == nil {
		return ErrNotImplemented
	}
	taken, err := s.Repo.IsEmailOwnedByAnother(ctx, clean, userID)
	if err != nil {
		return err
	}
	if taken {
		return svcErr(http.StatusConflict, "EMAIL_ALREADY_EXISTS", "该邮箱已被其他账户绑定")
	}
	if s.AuthRepo != nil {
		rec, err := s.AuthRepo.FindLatestVerificationCode(ctx, clean, "email_bind")
		if err != nil {
			return err
		}
		if rec == nil || rec.UsedAt != nil || !rec.ExpiresAt.After(s.now()) || rec.Attempts >= auth.MaxVerifyAttempts {
			return svcErr(http.StatusBadRequest, "OTP_EXPIRED", "验证码无效或已过期")
		}
		if !auth.VerifyVerificationCode(s.codeSecret(), clean, "email_bind", strings.TrimSpace(code), rec.CodeHash) {
			_ = s.AuthRepo.IncrementVerificationAttempts(ctx, rec.ID)
			return svcErr(http.StatusBadRequest, "OTP_INCORRECT", "验证码错误，请重新输入")
		}
		_ = s.AuthRepo.MarkVerificationCodeUsed(ctx, rec.ID)
	}
	return s.Repo.BindEmail(ctx, userID, clean)
}

func (s *Service) BindPhone(ctx context.Context, userID, phone, countryCode, code string) (string, error) {
	e164, cc, ok := auth.NormalizePhoneE164(phone, countryCode)
	if !ok {
		return "", svcErr(http.StatusBadRequest, "INVALID_PHONE", "请输入有效的手机号")
	}
	if s.AuthRepo != nil && strings.TrimSpace(code) != "" {
		rec, err := s.AuthRepo.FindLatestVerificationCode(ctx, e164, "phone_bind")
		if err != nil {
			return "", err
		}
		if rec == nil || rec.UsedAt != nil || !rec.ExpiresAt.After(s.now()) || rec.Attempts >= auth.MaxVerifyAttempts {
			return "", svcErr(http.StatusBadRequest, "OTP_EXPIRED", "验证码无效或已过期")
		}
		if !auth.VerifyVerificationCode(s.codeSecret(), e164, "phone_bind", strings.TrimSpace(code), rec.CodeHash) {
			_ = s.AuthRepo.IncrementVerificationAttempts(ctx, rec.ID)
			return "", svcErr(http.StatusBadRequest, "OTP_INCORRECT", "验证码错误，请重新输入")
		}
		_ = s.AuthRepo.MarkVerificationCodeUsed(ctx, rec.ID)
	}
	if s.Repo == nil {
		return "", ErrNotImplemented
	}
	if err := s.Repo.UpdatePhone(ctx, userID, e164, cc); err != nil {
		if errors.Is(err, ErrPhoneConflict) {
			return "", svcErr(http.StatusConflict, "PHONE_ALREADY_BOUND", "该手机号已被其他账户绑定")
		}
		return "", err
	}
	return e164, nil
}

func (s *Service) UnbindEmail(ctx context.Context, userID string) error {
	if s.Repo == nil {
		return ErrNotImplemented
	}
	p, err := s.Repo.GetByID(ctx, userID)
	if err != nil || p == nil {
		return svcErr(http.StatusNotFound, "USER_NOT_FOUND", "用户不存在")
	}
	if strings.TrimSpace(p.Email) == "" {
		return svcErr(http.StatusBadRequest, "EMAIL_NOT_BOUND", "当前账号未绑定邮箱")
	}
	_, provCount, err := s.Repo.CountValidCredentials(ctx, userID)
	if err != nil {
		return err
	}
	if strings.TrimSpace(p.Phone) == "" && provCount == 0 {
		return svcErr(http.StatusBadRequest, "LAST_CREDENTIAL", "请先绑定手机号或第三方账号后再解绑邮箱")
	}
	return s.Repo.UnbindEmail(ctx, userID)
}

func (s *Service) UnbindPhone(ctx context.Context, userID string) error {
	if s.Repo == nil {
		return ErrNotImplemented
	}
	p, err := s.Repo.GetByID(ctx, userID)
	if err != nil || p == nil {
		return svcErr(http.StatusNotFound, "USER_NOT_FOUND", "用户不存在")
	}
	if strings.TrimSpace(p.Phone) == "" {
		return svcErr(http.StatusBadRequest, "PHONE_NOT_BOUND", "当前账号未绑定手机号")
	}
	_, provCount, err := s.Repo.CountValidCredentials(ctx, userID)
	if err != nil {
		return err
	}
	if strings.TrimSpace(p.Email) == "" && provCount == 0 {
		return svcErr(http.StatusBadRequest, "LAST_CREDENTIAL", "请先绑定邮箱或第三方账号后再解绑手机号")
	}
	return s.Repo.UnbindPhone(ctx, userID)
}

func (s *Service) GetPreferences(ctx context.Context, userID string) (map[string]any, error) {
	if s.Repo == nil {
		return map[string]any{}, nil
	}
	return s.Repo.GetPreferences(ctx, userID)
}

func (s *Service) UpdatePreferences(ctx context.Context, userID string, prefs map[string]any) (map[string]any, error) {
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	return s.Repo.UpdatePreferences(ctx, userID, prefs)
}

func (s *Service) GetPrivacy(ctx context.Context, userID string) (bool, map[string]any, error) {
	if s.Repo == nil {
		return false, map[string]any{}, nil
	}
	p, err := s.Repo.GetByID(ctx, userID)
	if err != nil {
		return false, nil, err
	}
	if p == nil {
		return false, nil, svcErr(http.StatusNotFound, "USER_NOT_FOUND", "用户不存在")
	}
	return p.IsActivityPublic, p.PrivacySettings, nil
}

func (s *Service) UpdatePrivacy(ctx context.Context, userID string, isPublic *bool, settings map[string]any) (bool, map[string]any, error) {
	if s.Repo == nil {
		return false, nil, ErrNotImplemented
	}
	return s.Repo.UpdatePrivacy(ctx, userID, isPublic, settings)
}

func (s *Service) IsFollowing(ctx context.Context, userID, targetID string) (bool, error) {
	if s.Repo == nil || strings.TrimSpace(userID) == "" || strings.TrimSpace(targetID) == "" {
		return false, nil
	}
	return s.Repo.IsFollowing(ctx, userID, targetID)
}

func (s *Service) ToggleFollow(ctx context.Context, userID, targetID string) (bool, error) {
	if strings.TrimSpace(targetID) == "" {
		return false, svcErr(http.StatusBadRequest, "INVALID_TARGET", "目标用户不能为空")
	}
	if userID == targetID {
		return false, svcErr(http.StatusBadRequest, "SELF_FOLLOW", "不能关注自己")
	}
	if err := s.checkLimit(ctx, "user_follow_user", userID, 120, time.Hour); err != nil {
		return false, err
	}
	if s.Repo == nil {
		return false, ErrNotImplemented
	}
	return s.Repo.ToggleFollow(ctx, userID, targetID)
}

func (s *Service) ListNotifications(ctx context.Context, userID string, limit int) ([]NotificationItem, int, error) {
	if s.Repo == nil || strings.TrimSpace(userID) == "" {
		return []NotificationItem{}, 0, nil
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	return s.Repo.ListNotifications(ctx, userID, limit)
}

func (s *Service) MarkAllNotificationsRead(ctx context.Context, userID string) error {
	if err := s.checkLimit(ctx, "user.notifications", userID, 60, time.Minute); err != nil {
		return err
	}
	if s.Repo == nil {
		return ErrNotImplemented
	}
	return s.Repo.MarkAllNotificationsRead(ctx, userID)
}

func (s *Service) GetActivityDashboard(ctx context.Context, targetID, viewerID string) (*ActivityDashboard, error) {
	if s.Repo == nil {
		return &ActivityDashboard{Heatmap: map[string]int{}, TopModels: []map[string]any{}}, nil
	}
	p, err := s.Repo.GetProfileByIdentifier(ctx, targetID)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, svcErr(http.StatusNotFound, "USER_NOT_FOUND", "用户不存在")
	}
	if !p.IsActivityPublic && p.ID != viewerID {
		return nil, svcErr(http.StatusForbidden, "ACTIVITY_PRIVATE", "该用户未公开创作活跃度")
	}
	return s.Repo.GetActivityDashboard(ctx, p.ID)
}

func (s *Service) GetOnboarding(ctx context.Context, userID string) (*OnboardingPayload, error) {
	if s.Repo == nil {
		return &OnboardingPayload{}, nil
	}
	return s.Repo.GetOnboarding(ctx, userID)
}

func (s *Service) SaveOnboarding(ctx context.Context, userID string, in OnboardingPayload) (*OnboardingPayload, error) {
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	return s.Repo.SaveOnboarding(ctx, userID, in)
}

func (s *Service) GetOAuthSecurity(ctx context.Context, userID string) (map[string]any, error) {
	if s.Repo == nil {
		return map[string]any{"accounts": []OAuthAccountItem{}, "policies": map[string]any{}}, nil
	}
	accounts, err := s.Repo.ListOAuthAccounts(ctx, userID)
	if err != nil {
		return nil, err
	}
	policies := make(map[string]any, len(oauthProviders))
	for _, p := range oauthProviders {
		policies[p] = map[string]any{"allowUnbind": true}
	}
	return map[string]any{
		"accounts": accounts,
		"policies": policies,
	}, nil
}

func (s *Service) SendOAuthStepUpCode(ctx context.Context, userID, email, ip string) error {
	if strings.TrimSpace(email) == "" {
		return svcErr(http.StatusBadRequest, "EMAIL_REQUIRED", "请先绑定邮箱后再进行安全验证")
	}
	if err := s.checkLimit(ctx, "oauth_security", userID, 10, time.Hour); err != nil {
		return err
	}
	if s.AuthRepo != nil {
		code := auth.GenerateNumericOTP(6)
		codeHash := auth.HashVerificationCode(s.codeSecret(), userID+":"+auth.NormalizeEmail(email), "oauth_step_up", code)
		id, _ := ids.NewPrefixedID("evc")
		return s.AuthRepo.ReplaceVerificationCode(ctx, id, userID+":"+auth.NormalizeEmail(email), codeHash, "oauth_step_up", s.now().Add(auth.OTPLifetime), ip)
	}
	return nil
}

func (s *Service) UnbindOAuthWithStepUp(ctx context.Context, userID, email, provider, code string) error {
	cleanProvider := strings.ToLower(strings.TrimSpace(provider))
	validProv := false
	for _, p := range oauthProviders {
		if p == cleanProvider {
			validProv = true
			break
		}
	}
	if !validProv {
		return svcErr(http.StatusBadRequest, "INVALID_PROVIDER", "操作无效")
	}
	if s.AuthRepo != nil {
		target := userID + ":" + auth.NormalizeEmail(email)
		rec, err := s.AuthRepo.FindLatestVerificationCode(ctx, target, "oauth_step_up")
		if err != nil {
			return err
		}
		if rec == nil || rec.UsedAt != nil || !rec.ExpiresAt.After(s.now()) || rec.Attempts >= auth.MaxVerifyAttempts {
			return svcErr(http.StatusBadRequest, "INVALID_CODE", "验证码无效或已过期")
		}
		if !auth.VerifyVerificationCode(s.codeSecret(), target, "oauth_step_up", strings.TrimSpace(code), rec.CodeHash) {
			_ = s.AuthRepo.IncrementVerificationAttempts(ctx, rec.ID)
			return svcErr(http.StatusBadRequest, "INVALID_CODE", "验证码无效或已过期")
		}
		_ = s.AuthRepo.MarkVerificationCodeUsed(ctx, rec.ID)
	}
	if s.Repo == nil {
		return ErrNotImplemented
	}
	totalCreds, _, err := s.Repo.CountValidCredentials(ctx, userID)
	if err != nil {
		return err
	}
	if totalCreds <= 1 {
		return svcErr(http.StatusBadRequest, "LAST_CREDENTIAL", "不能解绑最后一种登录方式，请先设置密码或验证手机号")
	}
	return s.Repo.UnbindOAuthProvider(ctx, userID, cleanProvider)
}

func (s *Service) DeactivateAccount(ctx context.Context, userID, password, reason string) (time.Time, error) {
	if s.Repo == nil {
		return time.Time{}, ErrNotImplemented
	}
	if err := s.checkLimit(ctx, "user_deactivate", userID, 5, time.Hour); err != nil {
		return time.Time{}, err
	}
	p, err := s.Repo.GetByID(ctx, userID)
	if err != nil {
		return time.Time{}, err
	}
	if p == nil {
		return time.Time{}, svcErr(http.StatusNotFound, "USER_NOT_FOUND", "用户不存在")
	}
	if password != "" && p.HasPassword && !auth.VerifyPassword(password, p.PasswordHash, p.PasswordSalt) {
		return time.Time{}, svcErr(http.StatusBadRequest, "INVALID_PASSWORD", "密码验证失败")
	}
	dueAt := s.now().Add(3 * 24 * time.Hour)
	if err := s.Repo.ScheduleDeactivation(ctx, userID, dueAt, reason); err != nil {
		return time.Time{}, err
	}
	return dueAt, nil
}

func (s *Service) CancelDeletion(ctx context.Context, userID string) error {
	if s.Repo == nil {
		return ErrNotImplemented
	}
	return s.Repo.CancelDeactivation(ctx, userID)
}

func mergeJSONMap(base json.RawMessage, patch map[string]any) map[string]any {
	out := map[string]any{}
	if len(base) > 0 {
		_ = json.Unmarshal(base, &out)
	}
	for k, v := range patch {
		out[k] = v
	}
	return out
}

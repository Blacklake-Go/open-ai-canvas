package handler

import (
	"encoding/base64"
	"io"
	"net/http"
	"strconv"
	"strings"

	"one/backend/internal/domain/auth"
	"one/backend/internal/domain/user"
	"one/backend/internal/middleware"
	"one/backend/internal/pkg/envelope"
)

func (d *Dependencies) userService() *user.Service {
	if d.User != nil {
		return d.User
	}
	return &user.Service{Secret: d.Config.AuthVerificationCodeSecret}
}

func (d *Dependencies) handleUserProfile(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	if r.Method == http.MethodGet {
		targetID := strings.TrimSpace(r.URL.Query().Get("userId"))
		if targetID == "" {
			if u == nil {
				envelope.DomainError(w, http.StatusUnauthorized, "未登录", "UNAUTHORIZED")
				return
			}
			p, err := d.userService().GetProfile(r.Context(), u.ID)
			if err != nil {
				writeDomainError(w, err, "获取用户资料失败")
				return
			}
			envelope.DomainJSON(w, http.StatusOK, map[string]any{"user": p, "profile": p})
			return
		}
		p, err := d.userService().GetProfilePublicOrSelf(r.Context(), targetID)
		if err != nil {
			writeDomainError(w, err, "获取用户资料失败")
			return
		}
		isOwner := u != nil && u.ID == p.ID
		if !isOwner {
			cp := *p
			cp.Email = ""
			cp.Phone = ""
			cp.PhoneCountryCode = ""
			cp.HasPassword = false
			cp.DeletionDueAt = nil
			p = &cp
		}
		envelope.DomainJSON(w, http.StatusOK, map[string]any{"user": p, "profile": p})
		return
	}
	if u == nil {
		envelope.DomainError(w, http.StatusUnauthorized, "未登录", "UNAUTHORIZED")
		return
	}
	var body struct {
		DisplayName    *string        `json:"displayName"`
		Bio            *string        `json:"bio"`
		Website        *string        `json:"website"`
		AvatarURL      *string        `json:"avatarUrl"`
		Username       *string        `json:"username"`
		SocialLinks    map[string]any `json:"socialLinks"`
		Locale         *string        `json:"locale"`
		Zodiac         *string        `json:"zodiac"`
		Industry       *string        `json:"industry"`
		Occupation     *string        `json:"occupation"`
		Country        *string        `json:"country"`
		Gender         *string        `json:"gender"`
		OccupationCode *string        `json:"occupationCode"`
		StyleCodes     []string       `json:"styleCodes"`
	}
	if !decodeJSONBody(w, r, 64*1024, &body) {
		return
	}
	p, err := d.userService().UpdateProfileFull(r.Context(), u.ID, user.ProfilePatch{
		DisplayName:    body.DisplayName,
		Bio:            body.Bio,
		Website:        body.Website,
		AvatarURL:      body.AvatarURL,
		Username:       body.Username,
		SocialLinks:    body.SocialLinks,
		Locale:         body.Locale,
		Zodiac:         body.Zodiac,
		Industry:       body.Industry,
		Occupation:     body.Occupation,
		Country:        body.Country,
		Gender:         body.Gender,
		OccupationCode: body.OccupationCode,
		StyleCodes:     body.StyleCodes,
		HasStyleCodes:  body.StyleCodes != nil,
	})
	if err != nil {
		writeDomainError(w, err, "更新个人资料失败")
		return
	}
	if body.Locale != nil && strings.TrimSpace(*body.Locale) != "" {
		auth.SetLocaleCookies(w, strings.TrimSpace(*body.Locale), d.Config.IsProduction)
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{"user": p, "profile": p})
}

func (d *Dependencies) handleUserAvatar(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		targetID := strings.TrimSpace(r.URL.Query().Get("userId"))
		if targetID == "" {
			if u, ok := middleware.UserFromContext(r.Context()); ok && u != nil {
				targetID = u.ID
			}
		}
		loc := d.userService().GetAvatarRedirectURL(r.Context(), targetID)
		http.Redirect(w, r, loc, http.StatusTemporaryRedirect)
	case http.MethodPost:
		u, _ := middleware.UserFromContext(r.Context())
		var avatarURL string
		ct := strings.ToLower(r.Header.Get("Content-Type"))
		if strings.Contains(ct, "multipart/form-data") {
			if err := r.ParseMultipartForm(6 << 20); err != nil {
				envelope.DomainError(w, http.StatusBadRequest, "头像文件解析失败", "INVALID_MULTIPART")
				return
			}
			file, _, err := r.FormFile("file")
			if err != nil {
				file, _, err = r.FormFile("avatar")
			}
			if err != nil {
				envelope.DomainError(w, http.StatusBadRequest, "请上传头像文件", "MISSING_FILE")
				return
			}
			defer file.Close()
			data, err := io.ReadAll(io.LimitReader(file, 5*1024*1024+1))
			if err != nil || len(data) == 0 {
				envelope.DomainError(w, http.StatusBadRequest, "读取头像文件失败", "INVALID_FILE")
				return
			}
			if len(data) > 5*1024*1024 {
				envelope.DomainError(w, http.StatusBadRequest, "头像大小不能超过 5MB", "FILE_TOO_LARGE")
				return
			}
			mime := http.DetectContentType(data)
			if !strings.HasPrefix(mime, "image/") {
				envelope.DomainError(w, http.StatusBadRequest, "仅支持 PNG/JPEG/GIF/WEBP 图片格式", "UNSUPPORTED_MEDIA_TYPE")
				return
			}
			avatarURL = "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(data)
		} else {
			var body struct {
				AvatarURL string `json:"avatarUrl"`
			}
			if !decodeJSONBody(w, r, 64*1024, &body) {
				return
			}
			avatarURL = body.AvatarURL
		}
		p, err := d.userService().UpdateAvatar(r.Context(), u.ID, avatarURL)
		if err != nil {
			writeDomainError(w, err, "更新头像失败")
			return
		}
		envelope.SuccessJSON(w, http.StatusOK, map[string]any{
			"avatarUrl": p.AvatarURL,
			"user":      p,
		})
	case http.MethodDelete:
		u, _ := middleware.UserFromContext(r.Context())
		p, err := d.userService().DeleteAvatar(r.Context(), u.ID)
		if err != nil {
			writeDomainError(w, err, "重置头像失败")
			return
		}
		envelope.SuccessJSON(w, http.StatusOK, map[string]any{
			"avatarUrl": nil,
			"user":      p,
			"message":   "已恢复系统默认头像",
		})
	}
}

func (d *Dependencies) handleUserAvatarFrame(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	var body struct {
		Frame string `json:"frame"`
	}
	if !decodeJSONBody(w, r, 16*1024, &body) {
		return
	}
	res, err := d.userService().WearAvatarFrame(r.Context(), u.ID, body.Frame)
	if err != nil {
		writeDomainError(w, err, "切换头像框失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, res)
}

func (d *Dependencies) handleUserPassword(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	var body struct {
		CurrentPassword string `json:"currentPassword"`
		OldPassword     string `json:"oldPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if !decodeJSONBody(w, r, 16*1024, &body) {
		return
	}
	cur := firstNonEmpty(body.CurrentPassword, body.OldPassword)
	if err := d.userService().ChangePassword(r.Context(), u.ID, cur, body.NewPassword); err != nil {
		writeDomainError(w, err, "修改密码失败")
		return
	}
	envelope.SuccessJSON(w, http.StatusOK, map[string]any{"message": "密码修改成功"})
}

func (d *Dependencies) handleUserEmail(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	if r.Method == http.MethodDelete {
		if err := d.userService().UnbindEmail(r.Context(), u.ID); err != nil {
			writeDomainError(w, err, "解绑邮箱失败")
			return
		}
		envelope.SuccessJSON(w, http.StatusOK, map[string]any{"message": "安全邮箱已解绑"})
		return
	}
	var body struct {
		Email string `json:"email"`
		Code  string `json:"code"`
	}
	if !decodeJSONBody(w, r, 16*1024, &body) {
		return
	}
	if strings.TrimSpace(body.Code) == "" {
		if err := d.userService().SendEmailBindCode(r.Context(), u.ID, body.Email, clientIP(r)); err != nil {
			writeDomainError(w, err, "发送邮箱验证码失败")
			return
		}
		envelope.SuccessJSON(w, http.StatusOK, map[string]any{
			"email":                strings.TrimSpace(body.Email),
			"verificationRequired": true,
			"expiresInSeconds":     900,
			"message":              "验证码已发送至邮箱",
		})
		return
	}
	if err := d.userService().BindEmail(r.Context(), u.ID, body.Email, body.Code); err != nil {
		writeDomainError(w, err, "绑定安全邮箱失败")
		return
	}
	envelope.SuccessJSON(w, http.StatusOK, map[string]any{
		"email":   strings.TrimSpace(body.Email),
		"message": "安全邮箱已成功绑定",
	})
}

func (d *Dependencies) handleUserPhone(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	if r.Method == http.MethodDelete {
		if err := d.userService().UnbindPhone(r.Context(), u.ID); err != nil {
			writeDomainError(w, err, "解绑手机号失败")
			return
		}
		envelope.SuccessJSON(w, http.StatusOK, map[string]any{"message": "手机号已解绑"})
		return
	}
	var body struct {
		Phone       string `json:"phone"`
		CountryCode string `json:"countryCode"`
		Code        string `json:"code"`
	}
	if !decodeJSONBody(w, r, 16*1024, &body) {
		return
	}
	e164, err := d.userService().BindPhone(r.Context(), u.ID, body.Phone, body.CountryCode, body.Code)
	if err != nil {
		writeDomainError(w, err, "绑定手机号失败")
		return
	}
	envelope.SuccessJSON(w, http.StatusOK, map[string]any{
		"phone":       e164,
		"countryCode": body.CountryCode,
		"message":     "手机号已成功绑定",
	})
}

func (d *Dependencies) handleUserPreferences(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	if r.Method == http.MethodGet {
		prefs, err := d.userService().GetPreferences(r.Context(), u.ID)
		if err != nil {
			writeDomainError(w, err, "读取偏好设置失败")
			return
		}
		envelope.SuccessJSON(w, http.StatusOK, map[string]any{"preferences": prefs})
		return
	}
	var body struct {
		Preferences        map[string]any `json:"preferences"`
		NotifyOnComplete   *bool          `json:"notifyOnComplete"`
		HighQualityPreview *bool          `json:"highQualityPreview"`
		Locale             *string        `json:"locale"`
	}
	if !decodeJSONBody(w, r, 32*1024, &body) {
		return
	}
	patch := map[string]any{}
	for k, v := range body.Preferences {
		patch[k] = v
	}
	if body.NotifyOnComplete != nil {
		patch["notifyOnComplete"] = *body.NotifyOnComplete
	}
	if body.HighQualityPreview != nil {
		patch["highQualityPreview"] = *body.HighQualityPreview
	}
	if body.Locale != nil && strings.TrimSpace(*body.Locale) != "" {
		patch["locale"] = strings.TrimSpace(*body.Locale)
	}
	prefs, err := d.userService().UpdatePreferences(r.Context(), u.ID, patch)
	if err != nil {
		writeDomainError(w, err, "保存偏好设置失败")
		return
	}
	if loc, ok := patch["locale"].(string); ok && loc != "" {
		auth.SetLocaleCookies(w, loc, d.Config.IsProduction)
	}
	envelope.SuccessJSON(w, http.StatusOK, map[string]any{"preferences": prefs})
}

func (d *Dependencies) handleUserPrivacy(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	if r.Method == http.MethodGet {
		pub, settings, err := d.userService().GetPrivacy(r.Context(), u.ID)
		if err != nil {
			writeDomainError(w, err, "读取隐私设置失败")
			return
		}
		envelope.SuccessJSON(w, http.StatusOK, map[string]any{"isActivityPublic": pub, "privacySettings": settings})
		return
	}
	var body struct {
		IsActivityPublic *bool          `json:"isActivityPublic"`
		PrivacySettings  map[string]any `json:"privacySettings"`
		HideActivity     *bool          `json:"hideActivity"`
		HideStats        *bool          `json:"hideStats"`
	}
	if !decodeJSONBody(w, r, 32*1024, &body) {
		return
	}
	settings := map[string]any{}
	for k, v := range body.PrivacySettings {
		settings[k] = v
	}
	if body.HideActivity != nil {
		settings["hide_activity"] = *body.HideActivity
	}
	if body.HideStats != nil {
		settings["hide_stats"] = *body.HideStats
	}
	pub, merged, err := d.userService().UpdatePrivacy(r.Context(), u.ID, body.IsActivityPublic, settings)
	if err != nil {
		writeDomainError(w, err, "更新隐私设置失败")
		return
	}
	envelope.SuccessJSON(w, http.StatusOK, map[string]any{"isActivityPublic": pub, "privacySettings": merged})
}

func (d *Dependencies) handleUserFollow(w http.ResponseWriter, r *http.Request) {
	u, hasUser := middleware.UserFromContext(r.Context())
	if r.Method == http.MethodGet {
		targetID := strings.TrimSpace(r.URL.Query().Get("targetUserId"))
		if targetID == "" {
			targetID = strings.TrimSpace(r.URL.Query().Get("userId"))
		}
		if !hasUser || u == nil || targetID == "" {
			envelope.SuccessJSON(w, http.StatusOK, map[string]any{"following": false, "isFollowing": false})
			return
		}
		following, err := d.userService().IsFollowing(r.Context(), u.ID, targetID)
		if err != nil {
			writeDomainError(w, err, "查询关注状态失败")
			return
		}
		envelope.SuccessJSON(w, http.StatusOK, map[string]any{"following": following, "isFollowing": following})
		return
	}
	if !hasUser || u == nil {
		envelope.DomainError(w, http.StatusUnauthorized, "请先登录", "UNAUTHORIZED")
		return
	}
	var body struct {
		TargetUserID string `json:"targetUserId"`
		UserID       string `json:"userId"`
	}
	if !decodeJSONBody(w, r, 16*1024, &body) {
		return
	}
	targetID := firstNonEmpty(body.TargetUserID, body.UserID)
	following, err := d.userService().ToggleFollow(r.Context(), u.ID, targetID)
	if err != nil {
		writeDomainError(w, err, "操作失败")
		return
	}
	envelope.SuccessJSON(w, http.StatusOK, map[string]any{"following": following, "isFollowing": following})
}

func (d *Dependencies) handleUserNotifications(w http.ResponseWriter, r *http.Request) {
	u, hasUser := middleware.UserFromContext(r.Context())
	if hasUser && u != nil && !coreExpectedOwner(w, r, envelope.FormatSuccessFlaggedJSON, u.ID, "NOTIFICATIONS_ACCOUNT_CHANGED") {
		return
	}
	if r.Method == http.MethodGet {
		if !hasUser || u == nil {
			envelope.SuccessJSON(w, http.StatusOK, map[string]any{
				"notifications": []any{},
				"unreadCount":   0,
			})
			return
		}
		limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
		items, unread, err := d.userService().ListNotifications(r.Context(), u.ID, limit)
		if err != nil {
			writeDomainError(w, err, "读取通知失败")
			return
		}
		envelope.SuccessJSON(w, http.StatusOK, map[string]any{
			"notifications": items,
			"unreadCount":   unread,
		})
		return
	}
	if !hasUser || u == nil {
		envelope.DomainError(w, http.StatusUnauthorized, "请先登录", "UNAUTHORIZED")
		return
	}
	if err := d.userService().MarkAllNotificationsRead(r.Context(), u.ID); err != nil {
		writeDomainError(w, err, "标记已读失败")
		return
	}
	envelope.SuccessJSON(w, http.StatusOK, map[string]any{"unreadCount": 0})
}

func (d *Dependencies) handleUserActivityDashboard(w http.ResponseWriter, r *http.Request) {
	viewerID := ""
	if u, ok := middleware.UserFromContext(r.Context()); ok && u != nil {
		viewerID = u.ID
	}
	targetID := firstNonEmpty(r.URL.Query().Get("userId"), r.URL.Query().Get("id"), viewerID)
	dash, err := d.userService().GetActivityDashboard(r.Context(), targetID, viewerID)
	if err != nil {
		writeDomainError(w, err, "读取创作者统计失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, dash)
}

func (d *Dependencies) handleUserOnboarding(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	var body user.OnboardingPayload
	if !decodeJSONBody(w, r, 16*1024, &body) {
		return
	}
	out, err := d.userService().SaveOnboarding(r.Context(), u.ID, body)
	if err != nil {
		writeDomainError(w, err, "保存新手引导失败")
		return
	}
	envelope.DomainJSON(w, http.StatusOK, out)
}

func (d *Dependencies) handleUserOAuthProvider(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	provider := strings.ToLower(strings.TrimSpace(r.PathValue("provider")))
	if r.Method == http.MethodDelete {
		envelope.DomainError(w, http.StatusForbidden, "请在账户安全页面完成二次验证后解绑", "REAUTH_REQUIRED")
		return
	}
	sec, err := d.userService().GetOAuthSecurity(r.Context(), u.ID)
	isBound := false
	if err == nil {
		if accounts, ok := sec["accounts"].([]user.OAuthAccountItem); ok {
			for _, a := range accounts {
				if strings.EqualFold(a.Provider, provider) {
					isBound = true
					break
				}
			}
		}
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{
		"provider": provider,
		"isBound":  isBound,
	})
}

func (d *Dependencies) handleUserOAuthSecurity(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	if r.Method == http.MethodGet {
		res, err := d.userService().GetOAuthSecurity(r.Context(), u.ID)
		if err != nil {
			writeDomainError(w, err, "读取账号安全状态失败")
			return
		}
		envelope.SuccessJSON(w, http.StatusOK, res)
		return
	}
	var body struct {
		Action   string `json:"action"`
		Provider string `json:"provider"`
		Code     string `json:"code"`
		Email    string `json:"email"`
	}
	if !decodeJSONBody(w, r, 16*1024, &body) {
		return
	}
	targetEmail := firstNonEmpty(body.Email, strPtrVal(u.Email))
	action := strings.ToLower(strings.TrimSpace(body.Action))
	switch {
	case action == "send-code" || action == "send_code" || (action == "" && strings.TrimSpace(body.Code) == ""):
		if err := d.userService().SendOAuthStepUpCode(r.Context(), u.ID, targetEmail, clientIP(r)); err != nil {
			writeDomainError(w, err, "发送二次验证邮件失败")
			return
		}
		envelope.SuccessJSON(w, http.StatusOK, map[string]any{
			"sent":    true,
			"message": "二次验证验证码已发送至邮箱",
		})
	case action == "unbind" || (action == "" && strings.TrimSpace(body.Code) != ""):
		if err := d.userService().UnbindOAuthWithStepUp(r.Context(), u.ID, targetEmail, body.Provider, body.Code); err != nil {
			writeDomainError(w, err, "解绑第三方账号失败")
			return
		}
		envelope.SuccessJSON(w, http.StatusOK, map[string]any{
			"provider": body.Provider,
			"message":  "已成功解绑第三方账号",
		})
	default:
		envelope.DomainError(w, http.StatusBadRequest, "不支持的操作", "INVALID_ACTION")
	}
}

func (d *Dependencies) handleUserDeactivate(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	var body struct {
		Password string `json:"password"`
		Reason   string `json:"reason"`
		Confirm  any    `json:"confirm"`
	}
	if !decodeJSONBody(w, r, 16*1024, &body) {
		return
	}
	dueAt, err := d.userService().DeactivateAccount(r.Context(), u.ID, body.Password, body.Reason)
	if err != nil {
		writeDomainError(w, err, "提交注销申请失败")
		return
	}
	envelope.SuccessJSON(w, http.StatusOK, map[string]any{
		"deletionDueAt": dueAt,
		"remainingDays": 3,
		"message":       "账号已进入 3 天注销冷静期",
	})
}

func (d *Dependencies) handleUserCancelDeletion(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	if err := d.userService().CancelDeletion(r.Context(), u.ID); err != nil {
		writeDomainError(w, err, "撤销注销失败")
		return
	}
	envelope.SuccessJSON(w, http.StatusOK, map[string]any{
		"message": "已撤销账号注销申请",
	})
}

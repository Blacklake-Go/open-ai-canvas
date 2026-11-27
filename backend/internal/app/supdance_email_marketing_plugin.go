package app

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"gorm.io/gorm"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
	"yingce/backend/internal/auth"
	"yingce/backend/internal/emailtpl"
	"yingce/backend/internal/kernel"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
	"yingce/backend/internal/supdance/emailcenter"
	"yingce/backend/internal/supdance/maillocale"
)

const PluginSupDanceEmailMarketing = emailcenter.PluginID
const EmailMarketingTemplatesSettingKey = "plugin.supdance-email-marketing.templates"

func init() {
	officialApplicationPolicies[PluginSupDanceEmailMarketing] = PluginManagementView{Origin: PluginOriginOfficial, Kind: PluginKindApplication, ActivationScope: PluginScopeSystem, ConfigurationScope: PluginConfigurationSystem}
}

type EmailCenterTemplateView struct {
	emailcenter.Event
	EffectiveTemplateID string                        `json:"effectiveTemplateId"`
	State               model.SupDanceEmailTemplate   `json:"state"`
	Draft               emailcenter.Document          `json:"draft"`
	Published           emailcenter.Document          `json:"published"`
	History             []model.SupDanceEmailRevision `json:"history"`
}
type EmailCenterOverview struct {
	Locale           string                       `json:"locale"`
	SupportedLocales []string                     `json:"supportedLocales"`
	SafeMode         bool                         `json:"safeMode"`
	PluginID         string                       `json:"pluginId"`
	Brand            emailcenter.Brand            `json:"brand"`
	Templates        []EmailCenterTemplateView    `json:"templates"`
	SMTP             *auth.PublicEmailSetting     `json:"smtp"`
	MarketingPaused  bool                         `json:"marketingPaused"`
	Contacts         []model.SupDanceEmailContact `json:"contacts"`
}
type EmailCenterEditRequest struct {
	Locale           string               `json:"locale"`
	PreviewVariables map[string]string    `json:"previewVariables"`
	Document         emailcenter.Document `json:"document"`
	ExpectedRevision int64                `json:"expectedRevision"`
	RevisionID       string               `json:"revisionId"`
	To               string               `json:"to"`
}

// Initialization preserves the legacy setting; immutable revisions are seeded once.
func (s *Service) InitializeEmailCenter(actor *model.User) error {
	if err := s.RequireAdmin(actor); err != nil {
		return err
	}
	var legacy map[string]json.RawMessage
	setting, err := s.repo.SystemSetting(EmailMarketingTemplatesSettingKey)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	if setting != nil && setting.ValueJSON != "" {
		if err := json.Unmarshal([]byte(setting.ValueJSON), &legacy); err != nil {
			return kernel.BadAuthRequest("旧邮件模板损坏；迁移未覆盖数据")
		}
	}
	for _, e := range emailcenter.AllEvents() {
		encoded, err := json.Marshal(emailcenter.DefaultDocument(e))
		if err != nil {
			return err
		}
		now := time.Now()
		id := kernel.NewID()
		rev := model.SupDanceEmailRevision{ID: id, Key: e.Key, Locale: e.Locale, ContentJSON: string(encoded), Kind: "builtin", ActorID: actor.ID, CreatedAt: now}
		var old *model.SupDanceEmailRevision
		if content, ok := legacy[e.Key]; ok && e.Locale == maillocale.Default {
			old = &model.SupDanceEmailRevision{ID: kernel.NewID(), Key: e.Key, Locale: e.Locale, ContentJSON: string(content), Kind: "legacy", ActorID: actor.ID, CreatedAt: now}
		}
		if err := s.repo.SeedEmailTemplate(model.SupDanceEmailTemplate{Key: e.Key, Locale: e.Locale, DraftID: id, PublishedID: id, Revision: 1, UpdatedAt: now}, rev, old); err != nil {
			return err
		}
	}
	return s.appendAdminAudit(actor, "email.center.initialize", "plugin", PluginSupDanceEmailMarketing, "初始化邮件中心并保留旧模板", nil)
}

func (s *Service) emailCenterDocument(key string, locales ...string) (emailcenter.Document, string, error) {
	e, ok := emailcenter.LocalizedEvent(key, strings.Join(locales, ","))
	if !ok {
		return emailcenter.Document{}, "", kernel.BadAuthRequest("邮件事件不存在")
	}
	state, err := s.repo.EmailTemplate(key, e.Locale)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return emailcenter.DefaultDocument(e), emailcenter.BuiltinVersion, nil
	}
	if err != nil {
		return emailcenter.Document{}, "", err
	}
	row, err := s.repo.EmailRevision(state.PublishedID)
	if err != nil {
		return emailcenter.Document{}, "", err
	}
	var doc emailcenter.Document
	if row.Kind == "legacy" {
		return doc, "", kernel.BadAuthRequest("历史 HTML 不可直接发布")
	}
	err = json.Unmarshal([]byte(row.ContentJSON), &doc)
	if err == nil {
		err = emailcenter.Validate(e, doc)
	}
	return doc, row.ID, err
}

func (s *Service) emailCenterBrand() (emailcenter.Brand, error) {
	setting, value, err := s.readAppearance()
	if err != nil {
		return emailcenter.Brand{}, err
	}
	public := publicAppearanceSetting(setting, value)
	footer, err := s.readStoredSiteFooterConfig()
	if err != nil {
		return emailcenter.Brand{}, err
	}
	brand := emailcenter.Brand{Name: public.BrandName, SiteURL: publicSiteURL(), SupportEmail: footer.SupportEmail, Footer: public.FooterCopyright, Color: public.ActiveSkin.Tokens.Light.Primary, Version: public.Revision}
	if strings.EqualFold(brand.Name, "supdance") {
		brand.Name = "SupDance"
	}
	if brand.SiteURL != "" {
		parsed, err := url.Parse(brand.SiteURL)
		if err != nil || parsed.Scheme != "https" {
			return brand, kernel.BadAuthRequest("邮件品牌站点地址必须为 HTTPS")
		}
	}
	var logo []byte
	if brand.Name == "SupDance" {
		logo = supDanceFooterMailLogo
	} else if public.LogoConfigured {
		slot := AppearanceAssetLogo
		if value.LogoResourceID == "" {
			slot = AppearanceAssetDarkLogo
		}
		stream, err := s.OpenAppearanceAsset(slot, "")
		if err != nil {
			return brand, err
		}
		defer stream.Body.Close()
		logo, err = io.ReadAll(io.LimitReader(stream.Body, appearanceLogoMaxBytes+1))
		if err != nil {
			return brand, err
		}
		if len(logo) > int(appearanceLogoMaxBytes) {
			return brand, kernel.BadAuthRequest("邮件 Logo 超出限制")
		}
	}
	if logo != nil {
		data, kind, err := normalizeMailLogo(logo)
		if err != nil {
			return brand, err
		}
		hash := sha256.Sum256(data)
		id := hex.EncodeToString(hash[:])
		if err := s.repo.StoreEmailBrandAsset(&model.SupDanceEmailBrandAsset{ID: id, ContentType: kind, Data: data, CreatedAt: time.Now()}); err != nil {
			return brand, err
		}
		if brand.SiteURL != "" {
			brand.LogoURL = brand.SiteURL + "/api/public/email-center/brand/" + id
		}
	}
	brand.Version = ""
	payload, err := json.Marshal(brand)
	if err != nil {
		return brand, err
	}
	hash := sha256.Sum256(payload)
	brand.Version = hex.EncodeToString(hash[:])
	if err := s.repo.StoreEmailBrandSnapshot(brand.Version, string(payload)); err != nil {
		return brand, err
	}
	return brand, nil
}

func (h authHost) EmailBrand() (emailcenter.Brand, error) { return h.svc.emailCenterBrand() }
func (h authHost) EmailDocument(key, locale string) (emailcenter.Document, string, error) {
	if e, ok := emailcenter.LocalizedEvent(key, locale); ok && !emailCenterUsesPublished(key) {
		return emailcenter.DefaultDocument(e), emailcenter.BuiltinVersion, nil
	}
	return h.svc.emailCenterDocument(key, locale)
}

func emailCenterUsesPublished(key string) bool {
	if os.Getenv("CANVAS_EMAIL_CENTER_SAFE_MODE") == "true" {
		return false
	}
	raw := strings.TrimSpace(os.Getenv("CANVAS_EMAIL_CENTER_ROLLOUT_EVENTS"))
	if raw == "" {
		return true
	}
	for _, event := range strings.Split(raw, ",") {
		if strings.TrimSpace(event) == key {
			return true
		}
	}
	return false
}

func (s *Service) AdminEmailBrand(actor *model.User) (emailcenter.Brand, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return emailcenter.Brand{}, err
	}
	return s.emailCenterBrand()
}

func (s *Service) AdminEmailCenter(actor *model.User, locales ...string) (*EmailCenterOverview, error) {
	requested := strings.Join(locales, ",")
	if requested != "" && !maillocale.Valid(requested) {
		return nil, kernel.BadAuthRequest("不支持的邮件语言")
	}
	locale := maillocale.Resolve(requested)
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	brand, err := s.emailCenterBrand()
	if err != nil {
		return nil, err
	}
	smtp, err := s.authDomain().AdminEmailSetting(actor)
	if err != nil {
		return nil, err
	}
	contacts, err := s.repo.EmailContacts()
	if err != nil {
		return nil, err
	}
	ready, err := s.authDomain().MarketingReady()
	if err != nil {
		return nil, err
	}
	view := &EmailCenterOverview{Locale: locale, SupportedLocales: maillocale.Supported(), PluginID: PluginSupDanceEmailMarketing, Brand: brand, SMTP: smtp, MarketingPaused: !ready, Contacts: contacts, Templates: []EmailCenterTemplateView{}}
	view.SafeMode = os.Getenv("CANVAS_EMAIL_CENTER_SAFE_MODE") == "true"
	for i := range view.Contacts {
		view.Contacts[i].Email = maskEmailForCenter(view.Contacts[i].Email)
	}
	for _, e := range emailcenter.EventsForLocale(locale) {
		item := EmailCenterTemplateView{Event: e, Draft: emailcenter.DefaultDocument(e), Published: emailcenter.DefaultDocument(e), History: []model.SupDanceEmailRevision{}}
		item.EffectiveTemplateID = emailcenter.BuiltinVersion
		state, err := s.repo.EmailTemplate(e.Key, e.Locale)
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		if err == nil {
			item.State = *state
			if emailCenterUsesPublished(e.Key) {
				item.EffectiveTemplateID = state.PublishedID
			}
			history, err := s.repo.EmailRevisions(e.Key, e.Locale)
			if err != nil {
				return nil, err
			}
			item.History = history
			for _, rev := range history {
				if rev.Kind == "legacy" {
					continue
				}
				if rev.ID == state.DraftID {
					if err := json.Unmarshal([]byte(rev.ContentJSON), &item.Draft); err != nil {
						return nil, err
					}
				}
				if rev.ID == state.PublishedID {
					if err := json.Unmarshal([]byte(rev.ContentJSON), &item.Published); err != nil {
						return nil, err
					}
				}
			}
			// The published pointer remains authoritative even after more than 100 drafts.
			published, _, err := s.emailCenterDocument(e.Key, locale)
			if err != nil {
				return nil, err
			}
			item.Published = published
		}
		view.Templates = append(view.Templates, item)
	}
	if err := s.appendAdminAudit(actor, "email.center.view", "plugin", PluginSupDanceEmailMarketing, "读取邮件中心与脱敏联系人", nil); err != nil {
		return nil, err
	}
	return view, nil
}
func maskEmailForCenter(email string) string {
	before, after, ok := strings.Cut(email, "@")
	if !ok {
		return "***"
	}
	if before == "" {
		return "***@" + after
	}
	return string([]rune(before)[0]) + "***@" + after
}

func (s *Service) SaveEmailCenterDraft(actor *model.User, key string, req EmailCenterEditRequest) error {
	if err := s.RequireAdmin(actor); err != nil {
		return err
	}
	e, ok := emailcenter.LocalizedEvent(key, req.Locale)
	if !ok {
		return kernel.BadAuthRequest("邮件事件不存在")
	}
	if err := emailcenter.Validate(e, req.Document); err != nil {
		return kernel.BadAuthRequest(err.Error())
	}
	encoded, err := json.Marshal(req.Document)
	if err != nil {
		return err
	}
	err = s.repo.SaveEmailDraft(key, e.Locale, req.ExpectedRevision, model.SupDanceEmailRevision{ID: kernel.NewID(), Key: key, Locale: e.Locale, ContentJSON: string(encoded), Kind: "draft", ActorID: actor.ID, CreatedAt: time.Now()})
	if errors.Is(err, repository.ErrEmailRevisionConflict) {
		return kernel.NewAppError(409, "模板已变化，请重新加载")
	}
	if err != nil {
		return err
	}
	return s.appendAdminAudit(actor, "email.template.draft", "email_template", key, "保存邮件草稿", nil)
}
func (s *Service) PublishEmailCenter(actor *model.User, key string, req EmailCenterEditRequest) error {
	if err := s.RequireAdmin(actor); err != nil {
		return err
	}
	e, ok := emailcenter.LocalizedEvent(key, req.Locale)
	if !ok {
		return kernel.BadAuthRequest("邮件事件不存在")
	}
	row, err := s.repo.EmailRevision(req.RevisionID)
	if err != nil {
		return err
	}
	if row.Key != key || row.Locale != e.Locale || row.Kind == "legacy" {
		return kernel.BadAuthRequest("不能发布此历史版本，请先转换为内容模块")
	}
	var doc emailcenter.Document
	if err := json.Unmarshal([]byte(row.ContentJSON), &doc); err != nil {
		return err
	}
	brand, err := s.emailCenterBrand()
	if err != nil {
		return err
	}
	if _, err := emailcenter.Render(e, doc, brand, emailcenter.Payload{Preview: true}); err != nil {
		return kernel.BadAuthRequest(err.Error())
	}
	if err := s.repo.PublishEmailRevision(key, e.Locale, row.ID, req.ExpectedRevision); err != nil {
		if errors.Is(err, repository.ErrEmailRevisionConflict) {
			return kernel.NewAppError(409, "模板已变化，请重新加载")
		}
		return err
	}
	return s.appendAdminAudit(actor, "email.template.publish", "email_template", key, "发布或回滚邮件版本", map[string]any{"revisionId": row.ID})
}
func (s *Service) PreviewEmailCenter(actor *model.User, key string, req EmailCenterEditRequest) (*emailtpl.Rendered, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	e, ok := emailcenter.LocalizedEvent(key, req.Locale)
	if !ok {
		return nil, kernel.BadAuthRequest("邮件事件不存在")
	}
	allowed := map[string]bool{}
	for _, variable := range e.Variables {
		if !variable.Protected {
			allowed[variable.Key] = true
		}
	}
	for name, value := range req.PreviewVariables {
		if !allowed[name] || len(value) > 16384 {
			return nil, kernel.BadAuthRequest("预览只能设置普通模板变量，不能覆盖认证或品牌数据")
		}
	}
	brand, err := s.emailCenterBrand()
	if err != nil {
		return nil, err
	}
	out, err := emailcenter.Render(e, req.Document, brand, emailcenter.Payload{Preview: true, Variables: req.PreviewVariables})
	if err != nil {
		return nil, kernel.BadAuthRequest(err.Error())
	}
	payload, err := json.Marshal(req.Document)
	if err != nil {
		return nil, err
	}
	hash := sha256.Sum256(payload)
	out.TemplateVersion = "test:" + hex.EncodeToString(hash[:])
	return &out, nil
}
func (s *Service) TestEmailCenter(actor *model.User, key string, req EmailCenterEditRequest) error {
	to := auth.NormalizeEmail(req.To)
	if err := auth.ValidateEmail(to); err != nil {
		return err
	}
	if err := s.authDomain().CheckTestDelivery(actor, to); err != nil {
		return err
	}
	mail, err := s.PreviewEmailCenter(actor, key, req)
	if err != nil {
		return err
	}
	if err := s.appendAdminAudit(actor, "email.template.test", "email_template", key, "发起白名单测试", nil); err != nil {
		return err
	}
	err = s.authDomain().SendSystemEmail(auth.EmailDelivery{Purpose: "marketing_test", Locale: maillocale.Resolve(req.Locale), LocaleResolved: true, UserID: actor.ID, Recipient: to, TemplateID: mail.TemplateVersion, TemplateKey: key, BrandVersion: mail.BrandVersion, Mail: auth.OutgoingMail{Subject: mail.Subject, HTML: mail.HTML, Text: mail.Text}})
	if err != nil {
		return kernel.NewAppError(503, "邮件测试未确认成功，请查看脱敏发送记录")
	}
	return nil
}
func (s *Service) EmailCenterBrandAsset(id string) (*model.SupDanceEmailBrandAsset, error) {
	if len(id) != 64 {
		return nil, kernel.NotFound("素材不存在")
	}
	if _, err := hex.DecodeString(id); err != nil {
		return nil, kernel.NotFound("素材不存在")
	}
	return s.repo.EmailBrandAsset(id)
}

func (s *Service) UploadEmailCenterAsset(actor *model.User, data []byte) (string, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return "", err
	}
	if len(data) == 0 || len(data) > int(appearanceLogoMaxBytes) {
		return "", kernel.BadAuthRequest("邮件素材大小必须在 5MB 以内")
	}
	kind := http.DetectContentType(data)
	if kind != "image/png" && kind != "image/jpeg" && kind != "image/gif" {
		return "", kernel.BadAuthRequest("邮件图片只支持 PNG、JPEG、GIF")
	}
	hash := sha256.Sum256(data)
	id := hex.EncodeToString(hash[:])
	if err := s.repo.StoreEmailBrandAsset(&model.SupDanceEmailBrandAsset{ID: id, ContentType: kind, Data: data, CreatedAt: time.Now()}); err != nil {
		return "", err
	}
	if err := s.appendAdminAudit(actor, "email.asset.upload", "email_asset", id, "保存邮件公开素材快照", nil); err != nil {
		return "", err
	}
	return publicSiteURL() + "/api/public/email-center/brand/" + id, nil
}

func (s *Service) EmailCenterPreference(actor *model.User) (bool, error) {
	if actor == nil || actor.ID == "" {
		return false, kernel.Forbidden("请先登录")
	}
	row, err := s.repo.EmailContact(auth.NormalizeEmail(actor.Email))
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return row.Marketing, nil
}

func (s *Service) AdminEmailCenterActivity(actor *model.User) ([]model.AdminAuditEvent, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	return s.repo.EmailActivity()
}

func (s *Service) SetEmailCenterPreference(actor *model.User, enabled bool) error {
	if actor == nil || actor.ID == "" || actor.EmailVerifiedAt == nil {
		return kernel.Forbidden("请先验证账号邮箱")
	}
	contact, err := s.repo.EmailContact(auth.NormalizeEmail(actor.Email))
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		contact = &model.SupDanceEmailContact{Email: auth.NormalizeEmail(actor.Email)}
	}
	if contact.Suppression != "" && enabled {
		return kernel.Forbidden("此邮箱受发送抑制策略限制")
	}
	return s.repo.SetEmailPreference(contact.Email, enabled)
}

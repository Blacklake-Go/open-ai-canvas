package app

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"gorm.io/gorm"
	"log/slog"
	"net/url"
	"os"
	"strings"
	"time"
	"yingce/backend/internal/auth"
	"yingce/backend/internal/kernel"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
	"yingce/backend/internal/supdance/emailcenter"
	"yingce/backend/internal/supdance/maillocale"
)

type EmailCampaignRequest struct {
	VariablesByLocale map[string]map[string]string `json:"variablesByLocale"`
	Name              string                       `json:"name"`
	TemplateKey       string                       `json:"templateKey"`
	Variables         map[string]string            `json:"variables"`
	SourceFilter      string                       `json:"sourceFilter"`
	ScheduleAt        time.Time                    `json:"scheduleAt"`
}
type EmailCampaignView struct {
	model.SupDanceEmailCampaign
	Stats map[string]int64 `json:"stats"`
}

func (s *Service) AdminEmailCampaigns(actor *model.User) ([]EmailCampaignView, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	rows, err := s.repo.EmailCampaigns()
	if err != nil {
		return nil, err
	}
	views := []EmailCampaignView{}
	for _, row := range rows {
		stats, err := s.repo.EmailJobStats(row.ID)
		if err != nil {
			return nil, err
		}
		views = append(views, EmailCampaignView{row, stats})
	}
	return views, nil
}
func (s *Service) CreateEmailCampaign(actor *model.User, req EmailCampaignRequest) error {
	if err := s.RequireAdmin(actor); err != nil {
		return err
	}
	e, ok := emailcenter.FindEvent(req.TemplateKey)
	if !ok || e.Category != "marketing" {
		return kernel.BadAuthRequest("活动只能使用营销模板")
	}
	if strings.TrimSpace(req.Name) == "" || len(req.Name) > 160 || len(req.SourceFilter) > 160 {
		return kernel.BadAuthRequest("活动名称或分组无效")
	}
	brand, err := s.emailCenterBrand()
	if err != nil {
		return err
	}
	for locale := range req.VariablesByLocale {
		if !maillocale.Valid(locale) {
			return kernel.BadAuthRequest("不支持的活动语言")
		}
	}
	revisions := map[string]string{}
	for _, locale := range maillocale.Supported() {
		state, err := s.repo.EmailTemplate(e.Key, locale)
		if err != nil {
			return kernel.BadAuthRequest("请先初始化全部语言的邮件模板")
		}
		localizedEvent, _ := emailcenter.LocalizedEvent(e.Key, locale)
		doc, _, err := s.emailCenterDocument(e.Key, locale)
		if err != nil {
			return err
		}
		variables, err := emailCampaignVariables(localizedEvent, req.Variables, req.VariablesByLocale, locale)
		if err != nil {
			return kernel.BadAuthRequest(err.Error())
		}
		if _, err = emailcenter.Render(localizedEvent, doc, brand, emailcenter.Payload{Variables: variables, UnsubscribeURL: brand.SiteURL + "/api/public/email-center/unsubscribe?token=validation"}); err != nil {
			return kernel.BadAuthRequest(locale + ": " + err.Error())
		}
		revisions[locale] = state.PublishedID
	}
	variables, err := json.Marshal(req.Variables)
	if err != nil {
		return err
	}
	localizedJSON, err := json.Marshal(req.VariablesByLocale)
	if err != nil {
		return err
	}
	if len(variables)+len(localizedJSON) > 65536 {
		return kernel.BadAuthRequest("活动变量过大")
	}
	revisionsJSON, err := json.Marshal(revisions)
	if err != nil {
		return err
	}
	now := time.Now()
	row := model.SupDanceEmailCampaign{ID: kernel.NewID(), Name: strings.TrimSpace(req.Name), TemplateKey: e.Key, RevisionID: revisions[maillocale.Default], RevisionsJSON: string(revisionsJSON), LocalizedVariablesJSON: string(localizedJSON), VariablesJSON: string(variables), SourceFilter: req.SourceFilter, Status: "draft", ScheduleAt: req.ScheduleAt, CreatedBy: actor.ID, CreatedAt: now, UpdatedAt: now}
	if err := s.repo.CreateEmailCampaign(&row); err != nil {
		return err
	}
	return s.appendAdminAudit(actor, "email.campaign.draft", "email_campaign", row.ID, "保存营销活动草稿", nil)
}
func (s *Service) ControlEmailCampaign(actor *model.User, id, action string, at time.Time) error {
	if err := s.RequireAdmin(actor); err != nil {
		return err
	}
	var err error
	switch action {
	case "schedule":
		if at.IsZero() {
			return kernel.BadAuthRequest("请选择发送时间")
		}
		err = s.repo.ScheduleEmailCampaign(id, at)
	case "pause":
		err = s.repo.SetEmailCampaignState(id, "paused")
	case "cancel":
		err = s.repo.SetEmailCampaignState(id, "cancelled")
	default:
		return kernel.BadAuthRequest("不支持的活动操作")
	}
	if err != nil {
		if errors.Is(err, repository.ErrEmailRevisionConflict) {
			return kernel.NewAppError(409, "活动状态已变化，请重新加载")
		}
		if errors.Is(err, repository.ErrEmailCampaignNoSubscribers) {
			return kernel.BadAuthRequest("没有符合分组条件的明确订阅者")
		}
		if errors.Is(err, repository.ErrEmailCampaignRecipientLimit) {
			return kernel.BadAuthRequest("单次活动最多 1000 位明确订阅者")
		}
		return err
	}
	return s.appendAdminAudit(actor, "email.campaign."+action, "email_campaign", id, "更新营销活动发送计划", nil)
}

type EmailQueueView struct {
	ID            string    `json:"id"`
	CampaignID    string    `json:"campaignId"`
	Recipient     string    `json:"recipient"`
	Status        string    `json:"status"`
	Attempts      int       `json:"attempts"`
	NextAttemptAt time.Time `json:"nextAttemptAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

func (s *Service) AdminEmailQueue(actor *model.User) ([]EmailQueueView, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	jobs, err := s.repo.EmailJobs()
	if err != nil {
		return nil, err
	}
	rows := []EmailQueueView{}
	for _, job := range jobs {
		rows = append(rows, EmailQueueView{job.ID, job.CampaignID, maskEmailForCenter(job.Recipient), job.Status, job.Attempts, job.NextAttemptAt, job.UpdatedAt})
	}
	if err := s.appendAdminAudit(actor, "email.queue.view", "email_job", "", "读取脱敏发送队列", nil); err != nil {
		return nil, err
	}
	return rows, nil
}

func (s *Service) emailUnsubscribeURL(email string, brand emailcenter.Brand, locales ...string) (string, error) {
	secret, err := s.encryptSettingSecret("email-marketing-unsubscribe:" + auth.NormalizeEmail(email))
	if err != nil {
		return "", err
	}
	return brand.SiteURL + "/api/public/email-center/unsubscribe?token=" + url.QueryEscape(base64.RawURLEncoding.EncodeToString([]byte(secret))) + "&lang=" + maillocale.Resolve(strings.Join(locales, ",")), nil
}
func (s *Service) UnsubscribeEmailCenter(token string) error {
	if len(token) > 2048 {
		return kernel.BadAuthRequest("退订令牌无效")
	}
	decoded, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return kernel.BadAuthRequest("退订令牌无效")
	}
	if !strings.HasPrefix(string(decoded), encryptedSettingPrefix) {
		return kernel.BadAuthRequest("退订令牌无效")
	}
	secret, err := s.decryptSettingSecret(string(decoded))
	if err != nil {
		return kernel.BadAuthRequest("退订令牌无效")
	}
	email, ok := strings.CutPrefix(secret, "email-marketing-unsubscribe:")
	if !ok || auth.ValidateEmail(email) != nil {
		return kernel.BadAuthRequest("退订令牌无效")
	}
	row, err := s.repo.EmailContact(email)
	if err != nil {
		return kernel.BadAuthRequest("退订令牌无效")
	}
	return s.repo.UnsubscribeEmailContact(row.Email)
}

func (s *Service) startEmailCenterWorker() {
	// A release alone never enables marketing. Provider readiness requires an explicit operator switch.
	if os.Getenv("CANVAS_EMAIL_MARKETING_ENABLED") != "true" {
		return
	}
	s.runWorkerLoop(func(ctx context.Context) {
		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case now := <-ticker.C:
				if err := s.runEmailCenterJob(ctx, now); err != nil && ctx.Err() == nil {
					slog.Warn("email center worker stopped an attempt", "error", err)
				}
			}
		}
	})
}
func (s *Service) runEmailCenterJob(ctx context.Context, now time.Time) error {
	if os.Getenv("CANVAS_EMAIL_MARKETING_ENABLED") != "true" {
		return nil
	}
	ready, err := s.authDomain().MarketingReady()
	if err != nil || !ready {
		return err
	}
	if err := s.repo.MarkAbandonedEmailJobs(now); err != nil {
		return err
	}
	job, err := s.repo.ClaimEmailJob(now)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	finish := func(status string) error { return s.repo.FinishEmailJob(job.ID, status, now) }
	contact, err := s.repo.EmailContact(job.Recipient)
	if err != nil {
		return finish("suppressed")
	}
	if !contact.Marketing || contact.Scope != "marketing" || contact.Suppression != "" {
		return finish("suppressed")
	}
	campaign, err := s.repo.EmailCampaign(job.CampaignID)
	if err != nil {
		return finish("failed")
	}
	if campaign.Status == "paused" {
		return s.repo.DeferEmailJob(job.ID, now.Add(time.Minute))
	}
	if campaign.Status != "scheduled" {
		return finish("cancelled")
	}
	if ctx.Err() != nil {
		return finish("cancelled")
	}
	locale, err := s.authDomain().ResolveEmailLocale(auth.EmailDelivery{Recipient: job.Recipient})
	if err != nil {
		return finish("failed")
	}
	revisions := map[string]string{}
	if campaign.RevisionsJSON != "" {
		if json.Unmarshal([]byte(campaign.RevisionsJSON), &revisions) != nil {
			return finish("failed")
		}
	} else {
		revisions[maillocale.Default] = campaign.RevisionID
	}
	id := revisions[locale]
	if id == "" {
		return finish("failed")
	}
	row, err := s.repo.EmailRevision(id)
	if err != nil {
		return finish("failed")
	}
	e, ok := emailcenter.LocalizedEvent(campaign.TemplateKey, locale)
	if !ok || e.Category != "marketing" || row.Kind == "legacy" || row.Key != e.Key || row.Locale != locale {
		return finish("failed")
	}
	var doc emailcenter.Document
	var common map[string]string
	var localized map[string]map[string]string
	if json.Unmarshal([]byte(row.ContentJSON), &doc) != nil || json.Unmarshal([]byte(campaign.VariablesJSON), &common) != nil {
		return finish("failed")
	}
	if campaign.LocalizedVariablesJSON != "" && json.Unmarshal([]byte(campaign.LocalizedVariablesJSON), &localized) != nil {
		return finish("failed")
	}
	variables, err := emailCampaignVariables(e, common, localized, locale)
	if err != nil {
		return finish("failed")
	}
	brand, err := s.emailCenterBrand()
	if err != nil {
		return finish("failed")
	}
	unsubscribe, err := s.emailUnsubscribeURL(job.Recipient, brand, locale)
	if err != nil {
		return finish("failed")
	}
	rendered, err := emailcenter.Render(e, doc, brand, emailcenter.Payload{Variables: variables, UnsubscribeURL: unsubscribe})
	if err != nil {
		return finish("failed")
	}
	err = s.authDomain().SendSystemEmail(auth.EmailDelivery{Purpose: "marketing", Locale: locale, LocaleResolved: true, EventID: job.ID, Recipient: job.Recipient, TemplateID: row.ID, TemplateKey: e.Key, BrandVersion: brand.Version, Mail: auth.OutgoingMail{Subject: rendered.Subject, HTML: rendered.HTML, Text: rendered.Text, UnsubscribeURL: unsubscribe}})
	if err == nil {
		return finish("smtp_accepted")
	}
	status, _ := auth.EmailDeliveryResult(err)
	if status == "retryable" && job.Attempts < 3 {
		return s.repo.FinishEmailJob(job.ID, "retrying", now.Add(time.Duration(job.Attempts*job.Attempts)*time.Minute))
	}
	if status == "retryable" {
		status = "failed"
	}
	return finish(status)
}

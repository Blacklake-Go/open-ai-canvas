package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"log/slog"
	"net"
	"net/textproto"
	"os"
	"strings"
	"time"
	"yingce/backend/internal/kernel"
	"yingce/backend/internal/model"
	"yingce/backend/internal/supdance/emailcenter"
	"yingce/backend/internal/supdance/maillocale"
)

type emailCenterHost interface {
	EmailBrand() (emailcenter.Brand, error)
	EmailDocument(string, string) (emailcenter.Document, string, error)
}

var securityEmailLane = make(chan struct{}, 4)
var marketingEmailLane = make(chan struct{}, 1)

func (s *Service) prepareCenterEmail(delivery *EmailDelivery) error {
	locale, localeErr := s.ResolveEmailLocale(*delivery)
	if localeErr != nil {
		return localeErr
	}
	delivery.Locale = locale
	e, ok := emailcenter.LocalizedEvent(delivery.Purpose, locale)
	if !ok {
		return kernel.BadAuthRequest("邮件事件未注册")
	}
	brand := emailcenter.Brand{Name: s.EmailBrandName()}
	doc := emailcenter.DefaultDocument(e)
	version := emailcenter.BuiltinVersion
	if h, ok := s.host.(emailCenterHost); ok {
		var err error
		resolvedBrand, brandErr := h.EmailBrand()
		if brandErr != nil {
			if e.Category != "security" {
				return brandErr
			}
			slog.Warn("email branding unavailable; using safety brand", "event", e.Key)
		} else {
			brand = resolvedBrand
		}
		published, id, err := h.EmailDocument(e.Key, locale)
		if err == nil {
			doc = published
			version = id
		} else if e.Category == "security" {
			slog.Warn("using email safety template", "event", e.Key)
		} else {
			return err
		}
	}
	payload := emailcenter.Payload{Code: delivery.Code, Action: delivery.SecurityAction, Recipient: delivery.Recipient, ExpiresAt: delivery.ExpiresAt, ProtectedText: delivery.Mail.Text, ProtectedHTML: delivery.Mail.HTML}
	if delivery.Purpose == EmailPurposeEmailChanged && delivery.ChangedEmail != "" {
		payload.ProtectedText = maillocale.Text(locale, "changed_notice", maskedEmail(delivery.ChangedEmail))
		payload.ProtectedHTML = ""
	}
	if delivery.Purpose == EmailPurposeConsumptionReport {
		payload.Variables = map[string]string{"report_subject": delivery.Mail.Subject}
	}
	if e.ProtectedModule == "code" {
		payload.ProtectedHTML = ""
		payload.ProtectedText = ""
	}
	if e.Category == "test" {
		payload.Preview = true
	}
	rendered, err := emailcenter.Render(e, doc, brand, payload)
	if err != nil && e.Category == "security" {
		slog.Warn("invalid security template; using safety template", "event", e.Key)
		rendered, err = emailcenter.Render(e, emailcenter.DefaultDocument(e), brand, payload)
		version = emailcenter.BuiltinVersion
	}
	if err != nil {
		return err
	}
	delivery.Mail = OutgoingMail{Subject: rendered.Subject, Text: rendered.Text, HTML: rendered.HTML}
	delivery.TemplateID = version
	delivery.TemplateKey = e.Key
	delivery.BrandVersion = brand.Version
	return nil
}
func (s *Service) CheckTestDelivery(actor *model.User, recipient string) error {
	if err := s.host.RequireAdmin(actor); err != nil {
		return err
	}
	if actor == nil || actor.ID == "" {
		return kernel.Forbidden("需要管理员身份")
	}
	allowed := false
	for _, email := range strings.Split(os.Getenv("CANVAS_EMAIL_TEST_RECIPIENTS"), ",") {
		if NormalizeEmail(email) == recipient && recipient != "" {
			allowed = true
		}
	}
	if !allowed {
		return kernel.Forbidden("测试邮箱不在服务器白名单内")
	}
	ok, err := s.host.AllowRequest(context.Background(), "email-center-test:"+actor.ID, 10, time.Hour)
	if err != nil {
		return err
	}
	if !ok {
		return kernel.RateLimited("测试发送每小时最多 10 次")
	}
	return nil
}
func receiptID(delivery EmailDelivery) string {
	h := sha256.Sum256([]byte(delivery.Purpose + "\x00" + NormalizeEmail(delivery.Recipient) + "\x00" + delivery.EventID))
	return hex.EncodeToString(h[:])
}
func (s *Service) claimCenterDelivery(delivery *EmailDelivery, from string) (bool, error) {
	if delivery.EventID == "" {
		delivery.EventID = kernel.NewID()
	}
	delivery.ReceiptID = receiptID(*delivery)
	domain := "email-center.invalid"
	if _, after, ok := strings.Cut(from, "@"); ok {
		domain = after
	}
	delivery.Mail.MessageID = "<" + delivery.ReceiptID + "@" + domain + ">"
	if s.repo == nil {
		return true, nil
	}
	return s.repo.ClaimEmailReceipt(&model.SupDanceEmailReceipt{Locale: delivery.Locale, ID: delivery.ReceiptID, LogID: delivery.ReceiptID[:32], Channel: "smtp", Event: delivery.Purpose, TemplateID: delivery.TemplateID, TemplateKey: delivery.TemplateKey, BrandVersion: delivery.BrandVersion, MessageID: delivery.Mail.MessageID, Status: "sending", CreatedAt: time.Now(), UpdatedAt: time.Now()})
}

type emailOutcomeError struct{ status, stage string }

func (e *emailOutcomeError) Error() string {
	return "邮件发送未确认，请查看脱敏发送记录"
}
func centerDeliveryStatus(err error) (status, stage string) {
	if err == nil {
		return "smtp_accepted", ""
	}
	var outcome *emailOutcomeError
	if errors.As(err, &outcome) {
		return outcome.status, outcome.stage
	}
	var staged *smtpStageError
	if errors.As(err, &staged) {
		stage = staged.stage
		var reply *textproto.Error
		if errors.As(err, &reply) {
			if reply.Code >= 400 && reply.Code < 500 {
				return "retryable", stage
			}
			return "failed", stage
		}
		if stage == "write_body" || stage == "finish_data" {
			return "unknown", stage
		}
		var dns *net.DNSError
		if errors.As(err, &dns) && dns.IsNotFound {
			return "failed", stage
		}
		var temporary net.Error
		if errors.As(err, &temporary) {
			return "retryable", stage
		}
	}
	return "failed", stage
}

func EmailDeliveryResult(err error) (string, string) { return centerDeliveryStatus(err) }

func (s *Service) MarketingReady() (bool, error) {
	_, setting, err := s.readEmailSetting()
	if err != nil {
		return false, err
	}
	if !setting.Enabled || !MarketingDeliveryReady(setting.FromEmail) {
		return false, nil
	}
	state, err := s.repo.PluginPlatformState(emailcenter.PluginID)
	if err != nil {
		return false, err
	}
	return state == nil || state.Available, nil
}

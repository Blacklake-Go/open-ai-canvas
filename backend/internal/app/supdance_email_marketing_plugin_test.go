package app

import (
	"strings"
	"testing"
	"time"

	"yingce/backend/internal/auth"
	"yingce/backend/internal/model"
)

func TestMarketingTemplatesIntegrity(t *testing.T) {
	templates := DefaultMarketingTemplates()
	expectedKeys := []string{"welcome", "newsletter", "credit_alert", "winback"}

	if len(templates) != len(expectedKeys) {
		t.Fatalf("expected %d templates, got %d", len(expectedKeys), len(templates))
	}

	for _, key := range expectedKeys {
		tmpl, exists := templates[key]
		if !exists {
			t.Fatalf("missing template: %s", key)
		}
		if tmpl.Key != key {
			t.Errorf("template key mismatch: expected %s, got %s", key, tmpl.Key)
		}
		if strings.TrimSpace(tmpl.Name) == "" {
			t.Errorf("template %s missing name", key)
		}
		if strings.TrimSpace(tmpl.Category) == "" {
			t.Errorf("template %s missing category", key)
		}
		if strings.TrimSpace(tmpl.Description) == "" {
			t.Errorf("template %s missing description", key)
		}
		if strings.TrimSpace(tmpl.DefaultSubject) == "" {
			t.Errorf("template %s missing defaultSubject", key)
		}
		if strings.TrimSpace(tmpl.DefaultHtml) == "" {
			t.Errorf("template %s missing defaultHtml", key)
		}
		if len(tmpl.SupportedVariables) == 0 {
			t.Errorf("template %s missing supportedVariables", key)
		}
		if len(tmpl.SampleVariables) == 0 {
			t.Errorf("template %s missing sampleVariables", key)
		}

		// 检查 HTML 响应式与暗黑风格关键标记
		if !strings.Contains(tmpl.DefaultHtml, "<!DOCTYPE html>") {
			t.Errorf("template %s missing DOCTYPE html", key)
		}
		if !strings.Contains(tmpl.DefaultHtml, "email-container") {
			t.Errorf("template %s missing email-container class", key)
		}
		if !strings.Contains(tmpl.DefaultHtml, "{{unsubscribe_url}}") {
			t.Errorf("template %s missing unsubscribe_url placeholder", key)
		}
	}
}

func TestMarketingTemplateRenderingAndPlainText(t *testing.T) {
	templates := DefaultMarketingTemplates()
	for key, tmpl := range templates {
		renderedSubject := RenderMarketingTemplate(tmpl.DefaultSubject, tmpl.SampleVariables, key)
		if strings.Contains(renderedSubject, "{{") || strings.Contains(renderedSubject, "}}") {
			t.Errorf("template %s subject has unresolved placeholders: %s", key, renderedSubject)
		}

		renderedHtml := RenderMarketingTemplate(tmpl.DefaultHtml, tmpl.SampleVariables, key)
		if strings.Contains(renderedHtml, "{{") || strings.Contains(renderedHtml, "}}") {
			t.Errorf("template %s html has unresolved placeholders: %s", key, renderedHtml)
		}

		plainText := HtmlToPlainText(renderedHtml)
		if len(plainText) < 50 {
			t.Errorf("template %s plain text output too short: %d", key, len(plainText))
		}
		if strings.Contains(plainText, "<style") || strings.Contains(plainText, "</style>") {
			t.Errorf("template %s plain text must not contain style block", key)
		}
		if strings.Contains(plainText, "<div") || strings.Contains(plainText, "</div>") {
			t.Errorf("template %s plain text must not contain html div tags", key)
		}
	}
}

func TestEmailMarketingAdminOverviewAndPersistence(t *testing.T) {
	svc, _, _, admin := newAppearanceTestService(t)
	normal := &model.User{ID: "normal-user", Role: model.UserRoleUser, Status: model.UserStatusActive}

	// 权限防护：普通用户不得读取或修改
	if _, err := svc.AdminEmailMarketingOverview(normal); err == nil {
		t.Fatal("normal user must not access email marketing overview")
	}
	if _, err := svc.AdminSaveEmailMarketingTemplates(normal, nil); err == nil {
		t.Fatal("normal user must not save email marketing templates")
	}
	if _, err := svc.AdminResetEmailMarketingTemplate(normal, "welcome"); err == nil {
		t.Fatal("normal user must not reset email marketing template")
	}

	// 管理员获取总览
	overview, err := svc.AdminEmailMarketingOverview(admin)
	if err != nil {
		t.Fatalf("AdminEmailMarketingOverview error: %v", err)
	}
	if overview.PluginID != PluginSupDanceEmailMarketing {
		t.Errorf("unexpected pluginID: %s", overview.PluginID)
	}
	if len(overview.Templates) != 4 {
		t.Errorf("expected 4 templates in overview, got %d", len(overview.Templates))
	}

	// 管理员修改并持久化
	welcomeTmpl := overview.Templates["welcome"]
	welcomeTmpl.Subject = "自定义欢迎邮件：{{brand_name}}"
	welcomeTmpl.HTML = "<html><body><h1>Hello, {{name}}</h1><a href=\"{{unsubscribe_url}}\">退订</a></body></html>"

	savedOverview, err := svc.AdminSaveEmailMarketingTemplates(admin, map[string]MarketingTemplate{
		"welcome": welcomeTmpl,
	})
	if err != nil {
		t.Fatalf("AdminSaveEmailMarketingTemplates error: %v", err)
	}
	if savedOverview.Templates["welcome"].Subject != welcomeTmpl.Subject {
		t.Errorf("subject not saved: %s", savedOverview.Templates["welcome"].Subject)
	}
	if savedOverview.Templates["welcome"].HTML != welcomeTmpl.HTML {
		t.Errorf("html not saved: %s", savedOverview.Templates["welcome"].HTML)
	}

	// 重置单套模板
	resetOverview, err := svc.AdminResetEmailMarketingTemplate(admin, "welcome")
	if err != nil {
		t.Fatalf("AdminResetEmailMarketingTemplate error: %v", err)
	}
	defWelcome := DefaultMarketingTemplates()["welcome"]
	if resetOverview.Templates["welcome"].Subject != defWelcome.DefaultSubject {
		t.Errorf("template welcome subject not reset to default: got %s", resetOverview.Templates["welcome"].Subject)
	}
}

func TestMarketingTestEmailRateLimitingAndValidation(t *testing.T) {
	svc, _, _, admin := newAppearanceTestService(t)
	resetMarketingRateLimiterForTest()

	// 邮箱格式校验
	_, err := svc.SendMarketingTestEmail(admin, EmailMarketingTestRequest{
		To:          "invalid-email",
		TemplateKey: "welcome",
	})
	if err == nil {
		t.Fatal("expected error for invalid email")
	}

	// 空邮箱校验
	_, err = svc.SendMarketingTestEmail(admin, EmailMarketingTestRequest{
		To:          "",
		TemplateKey: "welcome",
	})
	if err == nil {
		t.Fatal("expected error for empty email")
	}

	// 频次保护测试（每小时 10 封）
	actorID := "test-admin-rate-limit"
	for i := 0; i < MarketingRateLimitPerHour; i++ {
		allowed, count := checkAndConsumeMarketingRateLimit(actorID, MarketingRateLimitPerHour, time.Hour)
		if !allowed {
			t.Fatalf("attempt %d should be allowed", i+1)
		}
		if count != i+1 {
			t.Fatalf("expected count %d, got %d", i+1, count)
		}
	}

	// 第 11 次应被拦截
	allowed, count := checkAndConsumeMarketingRateLimit(actorID, MarketingRateLimitPerHour, time.Hour)
	if allowed {
		t.Fatal("11th attempt must be rejected by rate limiter")
	}
	if count != MarketingRateLimitPerHour {
		t.Fatalf("expected count %d, got %d", MarketingRateLimitPerHour, count)
	}
}

func TestSendMarketingTestEmailEndToEnd(t *testing.T) {
	svc, db, _, admin := newAppearanceTestService(t)
	resetMarketingRateLimiterForTest()

	if err := db.AutoMigrate(&model.EmailLog{}); err != nil {
		t.Fatal(err)
	}

	// 1. 配置 SMTP 邮件服务设置
	emailSettingJSON := `{"enabled":true,"host":"smtp.example.com","port":587,"username":"support@supdance.com","password":"secret","fromEmail":"support@supdance.com","fromName":"SupDance"}`
	if err := svc.repo.SaveSystemSetting(&model.SystemSetting{Key: "email", ValueJSON: emailSettingJSON}); err != nil {
		t.Fatal(err)
	}

	// 2. 注入测试发信拦截器
	var sentTo, sentSubject, sentBody string
	var callCount int
	svc.SetMarketingMailSenderForTest(func(setting auth.EmailSettingValue, to, subject, body string) error {
		callCount++
		sentTo = to
		sentSubject = subject
		sentBody = body
		return nil
	})

	// 3. 执行测试发信
	recipient := "creator@example.com"
	res, err := svc.SendMarketingTestEmail(admin, EmailMarketingTestRequest{
		To:          recipient,
		TemplateKey: "welcome",
		Variables: map[string]string{
			"name": "测试小溪",
		},
	})
	if err != nil {
		t.Fatalf("SendMarketingTestEmail failed: %v", err)
	}

	// 4. 断言发信返回结果
	if !res.Success {
		t.Fatal("expected success to be true")
	}
	if res.Recipient != recipient {
		t.Errorf("expected recipient %s, got %s", recipient, res.Recipient)
	}
	if callCount != 1 {
		t.Errorf("expected 1 mail sender call, got %d", callCount)
	}
	if sentTo != recipient {
		t.Errorf("expected sentTo %s, got %s", recipient, sentTo)
	}
	if !strings.Contains(sentSubject, "[测试]") {
		t.Errorf("expected subject to contain [测试], got: %s", sentSubject)
	}
	if !strings.Contains(sentSubject, "SupDance") {
		t.Errorf("expected subject to contain brand SupDance, got: %s", sentSubject)
	}
	if !strings.Contains(sentBody, "测试小溪") {
		t.Errorf("expected body to contain interpolated variable 测试小溪, got: %s", sentBody)
	}

	// 5. 校验 email_logs 数据库记录
	var log model.EmailLog
	if err := db.Where("recipient = ? AND purpose = ?", recipient, MarketingEmailPurpose).First(&log).Error; err != nil {
		t.Fatalf("email_logs record not found: %v", err)
	}
	if log.Status != "sent" {
		t.Errorf("expected email_log status sent, got %s", log.Status)
	}

	// 6. 校验 admin_audit_events 审计事件记录
	var audit model.AdminAuditEvent
	if err := db.Where("action = ? AND target_type = ?", "email.marketing.test_send", "email_template").First(&audit).Error; err != nil {
		t.Fatalf("admin_audit_event record not found: %v", err)
	}
	if audit.ActorUserID != admin.ID {
		t.Errorf("expected audit actorUserId %s, got %s", admin.ID, audit.ActorUserID)
	}
}

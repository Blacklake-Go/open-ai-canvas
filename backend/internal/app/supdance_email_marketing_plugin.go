package app

import (
	"encoding/json"
	"fmt"
	"html"
	"regexp"
	"strings"
	"sync"
	"time"

	"yingce/backend/internal/auth"
	"yingce/backend/internal/kernel"
	"yingce/backend/internal/model"
)

const (
	PluginSupDanceEmailMarketing      = "supdance-email-marketing"
	EmailMarketingTemplatesSettingKey = "plugin.supdance-email-marketing.templates"
	MarketingRateLimitPerHour         = 10
	MarketingEmailPurpose             = "marketing_test"
)

func init() {
	officialApplicationPolicies[PluginSupDanceEmailMarketing] = PluginManagementView{
		Origin:             PluginOriginOfficial,
		Kind:               PluginKindApplication,
		ActivationScope:    PluginScopeSystem,
		ConfigurationScope: PluginConfigurationSystem,
	}
}

// MarketingVariable 营销模板变量说明元数据
type MarketingVariable struct {
	Key     string `json:"key"`
	Label   string `json:"label"`
	Default string `json:"default"`
}

// MarketingTemplate 单个营销邮件模板结构
type MarketingTemplate struct {
	Key                string              `json:"key"`
	Name               string              `json:"name"`
	Category           string              `json:"category"`
	Description        string              `json:"description"`
	DefaultSubject     string              `json:"defaultSubject"`
	DefaultHtml        string              `json:"defaultHtml"`
	Subject            string              `json:"subject"`
	HTML               string              `json:"html"`
	SupportedVariables []MarketingVariable `json:"supportedVariables"`
	SampleVariables    map[string]string   `json:"sampleVariables"`
	UpdatedAt          time.Time           `json:"updatedAt"`
	UpdatedBy          string              `json:"updatedBy,omitempty"`
}

// EmailMarketingOverview 营销插件管理端总览
type EmailMarketingOverview struct {
	PluginID         string                       `json:"pluginId"`
	Available        bool                         `json:"available"`
	Templates        map[string]MarketingTemplate `json:"templates"`
	SMTPConfigured   bool                         `json:"smtpConfigured"`
	RateLimitPerHour int                          `json:"rateLimitPerHour"`
	UpdatedAt        time.Time                    `json:"updatedAt"`
}

// EmailMarketingTestRequest 测试邮件发送请求参数
type EmailMarketingTestRequest struct {
	To          string            `json:"to"`
	TemplateKey string            `json:"templateKey"`
	Subject     string            `json:"subject"`
	HTML        string            `json:"html"`
	Variables   map[string]string `json:"variables"`
}

// EmailMarketingTestResult 测试邮件发送结果
type EmailMarketingTestResult struct {
	Success   bool   `json:"success"`
	Message   string `json:"message"`
	Recipient string `json:"recipient"`
	LatencyMS int64  `json:"latencyMs"`
}

var (
	marketingRateLimiterMu sync.Mutex
	marketingRateLimitMap  = make(map[string][]time.Time)
)

// checkAndConsumeMarketingRateLimit 校验并扣除管理员营销测试发信额度（每小时限 10 封）
func checkAndConsumeMarketingRateLimit(actorID string, limit int, window time.Duration) (bool, int) {
	marketingRateLimiterMu.Lock()
	defer marketingRateLimiterMu.Unlock()

	now := time.Now()
	cutoff := now.Add(-window)

	var valid []time.Time
	for _, t := range marketingRateLimitMap[actorID] {
		if t.After(cutoff) {
			valid = append(valid, t)
		}
	}

	if len(valid) >= limit {
		marketingRateLimitMap[actorID] = valid
		return false, len(valid)
	}

	valid = append(valid, now)
	marketingRateLimitMap[actorID] = valid
	return true, len(valid)
}

// resetMarketingRateLimiterForTest 重置限流缓存，供测试使用
func resetMarketingRateLimiterForTest() {
	marketingRateLimiterMu.Lock()
	defer marketingRateLimiterMu.Unlock()
	marketingRateLimitMap = make(map[string][]time.Time)
}

// SetMarketingMailSenderForTest 设置用于测试的发信拦截函数
func (s *Service) SetMarketingMailSenderForTest(fn func(auth.EmailSettingValue, string, string, string) error) {
	if s != nil && s.authDomain() != nil {
		s.authDomain().SetMailSender(fn)
	}
}

// EmailMarketingPluginAvailable 检查邮件营销插件是否在平台开放
func (s *Service) EmailMarketingPluginAvailable() (bool, error) {
	if s.repo == nil {
		return false, fmt.Errorf("存储不可用")
	}
	state, err := s.repo.PluginPlatformState(PluginSupDanceEmailMarketing)
	if err != nil {
		return false, err
	}
	return state == nil || state.Available, nil
}

// AdminEmailMarketingOverview 获取营销邮件插件总览
func (s *Service) AdminEmailMarketingOverview(actor *model.User) (*EmailMarketingOverview, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	available, err := s.EmailMarketingPluginAvailable()
	if err != nil {
		return nil, err
	}

	templates, updatedAt, err := s.readStoredMarketingTemplates()
	if err != nil {
		templates = DefaultMarketingTemplates()
		updatedAt = time.Now()
	}

	smtpConfigured, _ := s.authDomain().EmailEnabled()

	return &EmailMarketingOverview{
		PluginID:         PluginSupDanceEmailMarketing,
		Available:        available,
		Templates:        templates,
		SMTPConfigured:   smtpConfigured,
		RateLimitPerHour: MarketingRateLimitPerHour,
		UpdatedAt:        updatedAt,
	}, nil
}

// AdminSaveEmailMarketingTemplates 保存自定义营销模板配置
func (s *Service) AdminSaveEmailMarketingTemplates(actor *model.User, incoming map[string]MarketingTemplate) (*EmailMarketingOverview, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	if s.repo == nil {
		return nil, fmt.Errorf("存储不可用")
	}

	defaults := DefaultMarketingTemplates()
	savedTemplates := make(map[string]MarketingTemplate, len(defaults))

	now := time.Now()
	for key, def := range defaults {
		item, exists := incoming[key]
		if !exists {
			item = def
		} else {
			// 补充并校验字段
			item.Key = key
			item.Name = def.Name
			item.Category = def.Category
			item.Description = def.Description
			item.DefaultSubject = def.DefaultSubject
			item.DefaultHtml = def.DefaultHtml
			item.SupportedVariables = def.SupportedVariables
			if item.SampleVariables == nil {
				item.SampleVariables = def.SampleVariables
			}
			if strings.TrimSpace(item.Subject) == "" {
				item.Subject = def.DefaultSubject
			}
			if strings.TrimSpace(item.HTML) == "" {
				item.HTML = def.DefaultHtml
			}
			item.UpdatedAt = now
			item.UpdatedBy = actor.ID
		}
		savedTemplates[key] = item
	}

	payloadBytes, err := json.Marshal(savedTemplates)
	if err != nil {
		return nil, fmt.Errorf("序列化营销模板失败: %w", err)
	}

	setting := &model.SystemSetting{
		Key:       EmailMarketingTemplatesSettingKey,
		ValueJSON: string(payloadBytes),
		UpdatedBy: actor.ID,
		UpdatedAt: now,
	}

	if err := s.repo.SaveSystemSetting(setting); err != nil {
		return nil, fmt.Errorf("持久化营销模板失败: %w", err)
	}

	_ = s.appendAdminAudit(actor, "email.marketing.templates.save", "plugin", PluginSupDanceEmailMarketing, "保存自定义营销邮件模板", map[string]any{
		"templateCount": len(savedTemplates),
		"updatedKeys":   getKeys(savedTemplates),
	})

	return s.AdminEmailMarketingOverview(actor)
}

// AdminResetEmailMarketingTemplate 将指定或全部模板重置为系统默认
func (s *Service) AdminResetEmailMarketingTemplate(actor *model.User, templateKey string) (*EmailMarketingOverview, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	if s.repo == nil {
		return nil, fmt.Errorf("存储不可用")
	}

	defaults := DefaultMarketingTemplates()
	current, _, err := s.readStoredMarketingTemplates()
	if err != nil {
		current = DefaultMarketingTemplates()
	}

	targetKey := strings.TrimSpace(templateKey)
	if targetKey == "" || targetKey == "all" {
		current = defaults
	} else {
		def, ok := defaults[targetKey]
		if !ok {
			return nil, kernel.BadAuthRequest(fmt.Sprintf("未知营销模板类型: %s", targetKey))
		}
		def.UpdatedAt = time.Now()
		def.UpdatedBy = actor.ID
		current[targetKey] = def
	}

	payloadBytes, err := json.Marshal(current)
	if err != nil {
		return nil, fmt.Errorf("序列化重置模板失败: %w", err)
	}

	setting := &model.SystemSetting{
		Key:       EmailMarketingTemplatesSettingKey,
		ValueJSON: string(payloadBytes),
		UpdatedBy: actor.ID,
		UpdatedAt: time.Now(),
	}

	if err := s.repo.SaveSystemSetting(setting); err != nil {
		return nil, fmt.Errorf("保存重置模板失败: %w", err)
	}

	_ = s.appendAdminAudit(actor, "email.marketing.template.reset", "plugin", PluginSupDanceEmailMarketing, fmt.Sprintf("重置营销模板: %s", targetKey), map[string]any{
		"templateKey": targetKey,
	})

	return s.AdminEmailMarketingOverview(actor)
}

// SendMarketingTestEmail 发送营销测试邮件（含管理员权限、格式校验、频次保护与审计）
func (s *Service) SendMarketingTestEmail(actor *model.User, req EmailMarketingTestRequest) (*EmailMarketingTestResult, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}

	recipient := strings.TrimSpace(req.To)
	if recipient == "" {
		return nil, kernel.BadAuthRequest("请输入有效的测试收件邮箱")
	}
	if err := auth.ValidateEmail(recipient); err != nil {
		return nil, kernel.BadAuthRequest(fmt.Sprintf("收件邮箱格式不正确: %v", err))
	}

	templateKey := strings.TrimSpace(req.TemplateKey)
	if templateKey == "" {
		templateKey = "welcome"
	}

	defaults := DefaultMarketingTemplates()
	defTmpl, exists := defaults[templateKey]
	if !exists {
		return nil, kernel.BadAuthRequest(fmt.Sprintf("不支持的营销邮件模板: %s", templateKey))
	}

	// 频次保护：每位管理员 1 小时最多 10 封测试邮件
	allowed, count := checkAndConsumeMarketingRateLimit(actor.ID, MarketingRateLimitPerHour, time.Hour)
	if !allowed {
		return nil, kernel.RateLimited(fmt.Sprintf("营销邮件测试发送过于频繁（近 1 小时已发送 %d 封，上限 %d 封），请稍后再试", count, MarketingRateLimitPerHour))
	}

	// 准备发信内容
	rawSubject := req.Subject
	if strings.TrimSpace(rawSubject) == "" {
		rawSubject = defTmpl.DefaultSubject
	}

	rawHtml := req.HTML
	if strings.TrimSpace(rawHtml) == "" {
		rawHtml = defTmpl.DefaultHtml
	}

	brandName := s.appearanceBrandName()
	if brandName == "" {
		brandName = "SupDance"
	}

	mergedVars := make(map[string]string)
	for k, v := range defTmpl.SampleVariables {
		mergedVars[k] = v
	}
	for k, v := range req.Variables {
		mergedVars[k] = v
	}
	mergedVars["brand_name"] = brandName
	mergedVars["email"] = recipient

	compiledSubject := fmt.Sprintf("[测试] %s", RenderMarketingTemplate(rawSubject, mergedVars, templateKey))
	compiledHtml := RenderMarketingTemplate(rawHtml, mergedVars, templateKey)
	plainText := HtmlToPlainText(compiledHtml)

	start := time.Now()
	err := s.authDomain().SendSystemEmail(auth.EmailDelivery{
		Purpose:   MarketingEmailPurpose,
		UserID:    actor.ID,
		Recipient: recipient,
		Mail: auth.OutgoingMail{
			Subject: compiledSubject,
			HTML:    compiledHtml,
			Text:    plainText,
		},
	})
	latency := time.Since(start).Milliseconds()

	if err != nil {
		_ = s.appendAdminAudit(actor, "email.marketing.test_send", "email_template", templateKey, fmt.Sprintf("发送营销测试邮件失败: %v", err), map[string]any{
			"recipient":   recipient,
			"templateKey": templateKey,
			"status":      "failed",
			"error":       err.Error(),
			"latencyMs":   latency,
		})
		return nil, fmt.Errorf("测试邮件发送失败: %w", err)
	}

	_ = s.appendAdminAudit(actor, "email.marketing.test_send", "email_template", templateKey, "发送营销测试邮件成功", map[string]any{
		"recipient":   recipient,
		"templateKey": templateKey,
		"status":      "success",
		"subject":     compiledSubject,
		"latencyMs":   latency,
	})

	return &EmailMarketingTestResult{
		Success:   true,
		Message:   fmt.Sprintf("测试邮件已成功发送至 %s", recipient),
		Recipient: recipient,
		LatencyMS: latency,
	}, nil
}

// readStoredMarketingTemplates 从数据库读取持久化营销模板，自动与系统默认合并
func (s *Service) readStoredMarketingTemplates() (map[string]MarketingTemplate, time.Time, error) {
	defaults := DefaultMarketingTemplates()
	if s.repo == nil {
		return defaults, time.Now(), nil
	}

	setting, err := s.repo.SystemSettingOptional(EmailMarketingTemplatesSettingKey)
	if err != nil {
		return defaults, time.Now(), err
	}
	if setting == nil || strings.TrimSpace(setting.ValueJSON) == "" {
		return defaults, time.Now(), nil
	}

	var stored map[string]MarketingTemplate
	if err := json.Unmarshal([]byte(setting.ValueJSON), &stored); err != nil {
		return defaults, time.Now(), nil
	}

	// 合并：确保系统默认 4 套模板完整，且含有全部元数据定义
	merged := make(map[string]MarketingTemplate, len(defaults))
	for key, def := range defaults {
		if st, ok := stored[key]; ok {
			def.Subject = st.Subject
			def.HTML = st.HTML
			def.UpdatedAt = st.UpdatedAt
			def.UpdatedBy = st.UpdatedBy
			if st.SampleVariables != nil {
				def.SampleVariables = st.SampleVariables
			}
		}
		if strings.TrimSpace(def.Subject) == "" {
			def.Subject = def.DefaultSubject
		}
		if strings.TrimSpace(def.HTML) == "" {
			def.HTML = def.DefaultHtml
		}
		merged[key] = def
	}

	return merged, setting.UpdatedAt, nil
}

func getKeys(m map[string]MarketingTemplate) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

// RenderMarketingTemplate 变量插值渲染函数：支持安全替换与默认保底
func RenderMarketingTemplate(templateStr string, variables map[string]string, templateKey string) string {
	if templateStr == "" {
		return ""
	}

	defaults := DefaultMarketingTemplates()
	def, hasDef := defaults[templateKey]

	systemDefaults := map[string]string{
		"brand_name":      "SupDance",
		"support_email":   "support@supdance.com",
		"action_url":      "https://www.supdance.com/studio",
		"unsubscribe_url": "https://www.supdance.com/account/notifications",
	}

	varPattern := regexp.MustCompile(`\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}`)

	return varPattern.ReplaceAllStringFunc(templateStr, func(match string) string {
		submatches := varPattern.FindStringSubmatch(match)
		if len(submatches) < 2 {
			return match
		}
		key := submatches[1]

		if val, exists := variables[key]; exists && val != "" {
			return val
		}
		if hasDef && def.SampleVariables != nil {
			if val, exists := def.SampleVariables[key]; exists && val != "" {
				return val
			}
		}
		if hasDef {
			for _, v := range def.SupportedVariables {
				if v.Key == key && v.Default != "" {
					return v.Default
				}
			}
		}
		if val, exists := systemDefaults[key]; exists {
			return val
		}

		return ""
	})
}

// HtmlToPlainText 将 HTML 转换为优雅的纯文本 fallback
func HtmlToPlainText(htmlContent string) string {
	if htmlContent == "" {
		return ""
	}

	text := htmlContent

	// 移除样式块与脚本块
	reStyle := regexp.MustCompile(`(?is)<style[^>]*>.*?</style>`)
	text = reStyle.ReplaceAllString(text, "")
	reScript := regexp.MustCompile(`(?is)<script[^>]*>.*?</script>`)
	text = reScript.ReplaceAllString(text, "")

	// 链接转为: 文本 (URL)
	reLink := regexp.MustCompile(`(?i)<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)</a>`)
	text = reLink.ReplaceAllString(text, "$2 ($1)")

	// 换行与段落
	reP := regexp.MustCompile(`(?i)</p>`)
	text = reP.ReplaceAllString(text, "\n\n")
	reDiv := regexp.MustCompile(`(?i)</div>`)
	text = reDiv.ReplaceAllString(text, "\n")
	reBr := regexp.MustCompile(`(?i)<br\s*/?>`)
	text = reBr.ReplaceAllString(text, "\n")
	reLiOpen := regexp.MustCompile(`(?i)<li[^>]*>`)
	text = reLiOpen.ReplaceAllString(text, "• ")
	reLiClose := regexp.MustCompile(`(?i)</li>`)
	text = reLiClose.ReplaceAllString(text, "\n")

	// 移除所有其余 HTML 标签
	reTags := regexp.MustCompile(`<[^>]+>`)
	text = reTags.ReplaceAllString(text, "")

	// 解码常用实体
	text = strings.ReplaceAll(text, "&nbsp;", " ")
	text = strings.ReplaceAll(text, "&amp;", "&")
	text = strings.ReplaceAll(text, "&lt;", "<")
	text = strings.ReplaceAll(text, "&gt;", ">")
	text = html.UnescapeString(text)

	// 收敛多余空行
	reMultipleNewlines := regexp.MustCompile(`\n{3,}`)
	text = reMultipleNewlines.ReplaceAllString(text, "\n\n")

	return strings.TrimSpace(text)
}

const emailBaseStyle = `
  :root { color-scheme: dark only; supported-color-schemes: dark; }
  body { margin: 0; padding: 0; background-color: #0a0b0d; color: #ededf0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
  table { border-collapse: collapse; }
  img { border: 0; line-height: 100%; outline: none; text-decoration: none; }
  .email-container { max-width: 600px; margin: 0 auto; background-color: #131519; border: 1px solid #23272f; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6); }
  .email-header { padding: 28px 32px 20px; text-align: center; border-bottom: 1px solid #23272f; background: linear-gradient(180deg, #181b22 0%, #131519 100%); }
  .email-body { padding: 32px; color: #ededf0; font-size: 15px; line-height: 1.6; }
  .email-title { font-size: 24px; font-weight: 700; color: #ededf0; margin: 0 0 16px; line-height: 1.3; }
  .email-subtitle { font-size: 15px; color: #9aa0a6; margin: 0 0 24px; }
  .card { background-color: #0d0e12; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #23272f; }
  .card-title { font-size: 15px; font-weight: 600; color: #ededf0; margin: 0 0 8px; }
  .card-text { font-size: 14px; color: #9aa0a6; margin: 0; line-height: 1.6; }
  .btn-primary { display: inline-block; background-color: #e11d74; color: #ffffff !important; font-weight: 600; font-size: 15px; text-decoration: none; padding: 12px 32px; border-radius: 10px; margin: 8px 0 24px; text-align: center; box-shadow: 0 4px 16px rgba(225, 29, 116, 0.35); }
  .email-footer { padding: 24px 32px 32px; text-align: center; font-size: 12px; color: #70757e; border-top: 1px solid #23272f; background-color: #0d0e12; line-height: 1.6; }
  .footer-link { color: #9aa0a6; text-decoration: underline; margin: 0 8px; }
  @media only screen and (max-width: 620px) {
    .email-container { width: 100% !important; border-radius: 0 !important; }
    .email-body { padding: 24px 16px !important; }
    .email-header { padding: 24px 16px 16px !important; }
  }
`

// DefaultMarketingTemplates 返回系统预置的 4 大核心营销邮件模板
func DefaultMarketingTemplates() map[string]MarketingTemplate {
	return map[string]MarketingTemplate{
		"welcome": {
			Key:            "welcome",
			Name:           "新用户注册欢迎",
			Category:       "用户激活",
			Description:    "用户通过邮箱注册成功后自动触发，引导新手体验核心创作功能与工作台",
			DefaultSubject: "欢迎加入 {{brand_name}}，开启您的智能创作之旅",
			Subject:        "欢迎加入 {{brand_name}}，开启您的智能创作之旅",
			SupportedVariables: []MarketingVariable{
				{Key: "name", Label: "用户昵称", Default: "创作者"},
				{Key: "email", Label: "注册邮箱", Default: "user@example.com"},
				{Key: "action_url", Label: "工作台链接", Default: "https://www.supdance.com/studio"},
				{Key: "initial_credits", Label: "初始赠送额度", Default: "10"},
				{Key: "brand_name", Label: "品牌名称", Default: "SupDance"},
				{Key: "support_email", Label: "支持邮箱", Default: "support@supdance.com"},
				{Key: "unsubscribe_url", Label: "退订链接", Default: "https://www.supdance.com/account/notifications"},
			},
			SampleVariables: map[string]string{
				"name":            "小溪",
				"email":           "creator@example.com",
				"action_url":      "https://www.supdance.com/studio",
				"initial_credits": "10",
				"brand_name":      "SupDance",
				"support_email":   "support@supdance.com",
				"unsubscribe_url": "https://www.supdance.com/account/notifications",
			},
			DefaultHtml: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark only">
  <meta name="supported-color-schemes" content="dark">
  <title>欢迎加入 {{brand_name}}</title>
  <style>` + emailBaseStyle + `</style>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0b0d;">
  <div style="background-color: #0a0b0d; padding: 24px 12px;">
    <div class="email-container">
      <div class="email-header">
        <div style="display: inline-flex; align-items: center; gap: 10px;">
          <div style="width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, #e11d74 0%, #ff2d88 100%); display: inline-block; vertical-align: middle; box-shadow: 0 4px 12px rgba(225, 29, 116, 0.4);"></div>
          <span style="font-size: 20px; font-weight: 800; color: #ededf0; letter-spacing: -0.5px; vertical-align: middle;">{{brand_name}}</span>
        </div>
      </div>
      <div class="email-body">
        <h1 class="email-title">嗨，{{name}}！欢迎启程 🚀</h1>
        <p class="email-subtitle">感谢您注册 {{brand_name}}。我们已为您准备好专属的工作空间与新手体验算力。</p>

        <div class="card">
          <div class="card-title" style="color: #e11d74;">🎁 新手专属礼：{{initial_credits}} 算力额度已到账</div>
          <p class="card-text">您已获赠 {{initial_credits}} 点永不过期的初始体验额度，随时可以用于调用前沿 AI 大模型与工作流创作。</p>
        </div>

        <div style="margin-bottom: 24px;">
          <p style="font-weight: 600; color: #ededf0; margin-bottom: 8px;">快速开始您的第一次创作：</p>
          <ul style="padding-left: 20px; margin: 0; color: #9aa0a6; font-size: 14px; line-height: 1.8;">
            <li><strong style="color: #ededf0;">智能工作台 Studio：</strong>体验多模型同台对话与提示词即时调试。</li>
            <li><strong style="color: #ededf0;">Design Agent 画布：</strong>一句话生成全栈 Web 页面、UI 组件与代码产物。</li>
            <li><strong style="color: #ededf0;">多端同步：</strong>跨设备实时同步历史对话与创作成果。</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 32px 0 16px;">
          <a href="{{action_url}}" class="btn-primary" target="_blank">进入工作台开启探索</a>
        </div>

        <p style="font-size: 13px; color: #70757e; text-align: center; margin: 0;">
          如果按钮无法点击，请复制并访问以下链接：<br>
          <a href="{{action_url}}" style="color: #e11d74; word-break: break-all;">{{action_url}}</a>
        </p>
      </div>

      <div class="email-footer">
        <p>本邮件由 {{brand_name}} 系统自动发送至您的注册邮箱 {{email}}。</p>
        <p>若有任何疑问或需要帮助，欢迎随时联系技术客服：<a href="mailto:{{support_email}}" class="footer-link">{{support_email}}</a></p>
        <p style="margin-top: 12px;">
          <a href="{{action_url}}" class="footer-link">官方主页</a> ·
          <a href="{{unsubscribe_url}}" class="footer-link">通知偏好设置</a> ·
          <a href="{{unsubscribe_url}}" class="footer-link">退订邮件</a>
        </p>
        <p style="margin-top: 16px; color: #70757e;">© 2026 {{brand_name}}. 保留所有权利。</p>
      </div>
    </div>
  </div>
</body>
</html>`,
			HTML: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark only">
  <meta name="supported-color-schemes" content="dark">
  <title>欢迎加入 {{brand_name}}</title>
  <style>` + emailBaseStyle + `</style>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0b0d;">
  <div style="background-color: #0a0b0d; padding: 24px 12px;">
    <div class="email-container">
      <div class="email-header">
        <div style="display: inline-flex; align-items: center; gap: 10px;">
          <div style="width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, #e11d74 0%, #ff2d88 100%); display: inline-block; vertical-align: middle; box-shadow: 0 4px 12px rgba(225, 29, 116, 0.4);"></div>
          <span style="font-size: 20px; font-weight: 800; color: #ededf0; letter-spacing: -0.5px; vertical-align: middle;">{{brand_name}}</span>
        </div>
      </div>
      <div class="email-body">
        <h1 class="email-title">嗨，{{name}}！欢迎启程 🚀</h1>
        <p class="email-subtitle">感谢您注册 {{brand_name}}。我们已为您准备好专属的工作空间与新手体验算力。</p>

        <div class="card">
          <div class="card-title" style="color: #e11d74;">🎁 新手专属礼：{{initial_credits}} 算力额度已到账</div>
          <p class="card-text">您已获赠 {{initial_credits}} 点永不过期的初始体验额度，随时可以用于调用前沿 AI 大模型与工作流创作。</p>
        </div>

        <div style="margin-bottom: 24px;">
          <p style="font-weight: 600; color: #ededf0; margin-bottom: 8px;">快速开始您的第一次创作：</p>
          <ul style="padding-left: 20px; margin: 0; color: #9aa0a6; font-size: 14px; line-height: 1.8;">
            <li><strong style="color: #ededf0;">智能工作台 Studio：</strong>体验多模型同台对话与提示词即时调试。</li>
            <li><strong style="color: #ededf0;">Design Agent 画布：</strong>一句话生成全栈 Web 页面、UI 组件与代码产物。</li>
            <li><strong style="color: #ededf0;">多端同步：</strong>跨设备实时同步历史对话与创作成果。</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 32px 0 16px;">
          <a href="{{action_url}}" class="btn-primary" target="_blank">进入工作台开启探索</a>
        </div>

        <p style="font-size: 13px; color: #70757e; text-align: center; margin: 0;">
          如果按钮无法点击，请复制并访问以下链接：<br>
          <a href="{{action_url}}" style="color: #e11d74; word-break: break-all;">{{action_url}}</a>
        </p>
      </div>

      <div class="email-footer">
        <p>本邮件由 {{brand_name}} 系统自动发送至您的注册邮箱 {{email}}。</p>
        <p>若有任何疑问或需要帮助，欢迎随时联系技术客服：<a href="mailto:{{support_email}}" class="footer-link">{{support_email}}</a></p>
        <p style="margin-top: 12px;">
          <a href="{{action_url}}" class="footer-link">官方主页</a> ·
          <a href="{{unsubscribe_url}}" class="footer-link">通知偏好设置</a> ·
          <a href="{{unsubscribe_url}}" class="footer-link">退订邮件</a>
        </p>
        <p style="margin-top: 16px; color: #70757e;">© 2026 {{brand_name}}. 保留所有权利。</p>
      </div>
    </div>
  </div>
</body>
</html>`,
		},

		"newsletter": {
			Key:            "newsletter",
			Name:           "产品更新与功能周报",
			Category:       "产品动态",
			Description:    "定期向创作者同步最新发布的模型工具、体验升级与优质创作示例",
			DefaultSubject: "[{{brand_name}} 周报] {{update_title}}",
			Subject:        "[{{brand_name}} 周报] {{update_title}}",
			SupportedVariables: []MarketingVariable{
				{Key: "name", Label: "用户昵称", Default: "创作者"},
				{Key: "update_title", Label: "更新主标题", Default: "多智能体工作流重磅升级，算力调度全方位提速"},
				{Key: "feature_1_title", Label: "新特性一标题", Default: "全新协同智能体体系"},
				{Key: "feature_1_desc", Label: "新特性一描述", Default: "支持多角色模型并发作业与自循环对齐验证，任务交付质量跃迁。"},
				{Key: "feature_2_title", Label: "新特性二标题", Default: "极速响应与全域热部署"},
				{Key: "feature_2_desc", Label: "新特性二描述", Default: "构建速度提升 60%，带来真正零等待的流式生成交互。"},
				{Key: "action_url", Label: "体验链接", Default: "https://www.supdance.com/studio"},
				{Key: "brand_name", Label: "品牌名称", Default: "SupDance"},
				{Key: "support_email", Label: "支持邮箱", Default: "support@supdance.com"},
				{Key: "unsubscribe_url", Label: "退订链接", Default: "https://www.supdance.com/account/notifications"},
			},
			SampleVariables: map[string]string{
				"name":            "创作者",
				"update_title":    "全新 AI 工作流引擎上线，带来更高效的协同体验",
				"feature_1_title": "多智能体自动化流水线",
				"feature_1_desc":  "复杂工程与长篇写作任务可由智能体团队分工处理，自纠错自交付。",
				"feature_2_title": "组件级沙箱双栏热预览",
				"feature_2_desc":  "支持在浏览器内实时构建与沙箱呈现，样式无污染。",
				"action_url":      "https://www.supdance.com/studio",
				"brand_name":      "SupDance",
				"support_email":   "support@supdance.com",
				"unsubscribe_url": "https://www.supdance.com/account/notifications",
			},
			DefaultHtml: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark only">
  <meta name="supported-color-schemes" content="dark">
  <title>{{brand_name}} 产品动态</title>
  <style>` + emailBaseStyle + `</style>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0b0d;">
  <div style="background-color: #0a0b0d; padding: 24px 12px;">
    <div class="email-container">
      <div class="email-header">
        <div style="display: inline-flex; align-items: center; gap: 10px;">
          <div style="width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(135deg, #e11d74 0%, #ff2d88 100%); display: inline-block; vertical-align: middle;"></div>
          <span style="font-size: 18px; font-weight: 800; color: #ededf0; letter-spacing: 0.5px; vertical-align: middle;">{{brand_name}} PRODUCT NEWSLETTER</span>
        </div>
      </div>
      <div class="email-body">
        <h1 class="email-title">{{update_title}}</h1>
        <p class="email-subtitle">尊敬的 {{name}}，我们在过去的一周里为你带来了多项重磅功能优化与效能提升。</p>

        <div class="card">
          <div class="card-title" style="color: #e11d74;">✨ {{feature_1_title}}</div>
          <p class="card-text">{{feature_1_desc}}</p>
        </div>

        <div class="card">
          <div class="card-title" style="color: #e11d74;">⚡ {{feature_2_title}}</div>
          <p class="card-text">{{feature_2_desc}}</p>
        </div>

        <div style="text-align: center; margin: 32px 0 16px;">
          <a href="{{action_url}}" class="btn-primary" target="_blank">立即上手体验新功能</a>
        </div>
      </div>
      <div class="email-footer">
        <p>您之所以收到此周报，是因为您订阅了 {{brand_name}} 的产品资讯。</p>
        <p>如不想继续接收此类动态，可随时 <a href="{{unsubscribe_url}}" class="footer-link">点击此处退订</a>。</p>
        <p style="margin-top: 16px; color: #70757e;">© 2026 {{brand_name}}. 保留所有权利。</p>
      </div>
    </div>
  </div>
</body>
</html>`,
			HTML: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark only">
  <meta name="supported-color-schemes" content="dark">
  <title>{{brand_name}} 产品动态</title>
  <style>` + emailBaseStyle + `</style>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0b0d;">
  <div style="background-color: #0a0b0d; padding: 24px 12px;">
    <div class="email-container">
      <div class="email-header">
        <div style="display: inline-flex; align-items: center; gap: 10px;">
          <div style="width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(135deg, #e11d74 0%, #ff2d88 100%); display: inline-block; vertical-align: middle;"></div>
          <span style="font-size: 18px; font-weight: 800; color: #ededf0; letter-spacing: 0.5px; vertical-align: middle;">{{brand_name}} PRODUCT NEWSLETTER</span>
        </div>
      </div>
      <div class="email-body">
        <h1 class="email-title">{{update_title}}</h1>
        <p class="email-subtitle">尊敬的 {{name}}，我们在过去的一周里为你带来了多项重磅功能优化与效能提升。</p>

        <div class="card">
          <div class="card-title" style="color: #e11d74;">✨ {{feature_1_title}}</div>
          <p class="card-text">{{feature_1_desc}}</p>
        </div>

        <div class="card">
          <div class="card-title" style="color: #e11d74;">⚡ {{feature_2_title}}</div>
          <p class="card-text">{{feature_2_desc}}</p>
        </div>

        <div style="text-align: center; margin: 32px 0 16px;">
          <a href="{{action_url}}" class="btn-primary" target="_blank">立即上手体验新功能</a>
        </div>
      </div>
      <div class="email-footer">
        <p>您之所以收到此周报，是因为您订阅了 {{brand_name}} 的产品资讯。</p>
        <p>如不想继续接收此类动态，可随时 <a href="{{unsubscribe_url}}" class="footer-link">点击此处退订</a>。</p>
        <p style="margin-top: 16px; color: #70757e;">© 2026 {{brand_name}}. 保留所有权利。</p>
      </div>
    </div>
  </div>
</body>
</html>`,
		},

		"credit_alert": {
			Key:            "credit_alert",
			Name:           "算力额度预警与充值礼遇",
			Category:       "运营转化",
			Description:    "当用户账户算力不足或促销节点时，推送专属充值优惠与加赠礼包",
			DefaultSubject: "您的 {{brand_name}} 算力额度提醒：专属福利已送达",
			Subject:        "您的 {{brand_name}} 算力额度提醒：专属福利已送达",
			SupportedVariables: []MarketingVariable{
				{Key: "name", Label: "用户昵称", Default: "创作者"},
				{Key: "current_credits", Label: "当前剩余额度", Default: "2"},
				{Key: "discount_rate", Label: "折扣力度", Default: "8折"},
				{Key: "promo_code", Label: "专属优惠码", Default: "KOYO2026"},
				{Key: "bonus_credits", Label: "限时加赠额度", Default: "50"},
				{Key: "action_url", Label: "充值中心链接", Default: "https://www.supdance.com/pricing"},
				{Key: "brand_name", Label: "品牌名称", Default: "SupDance"},
				{Key: "support_email", Label: "支持邮箱", Default: "support@supdance.com"},
				{Key: "unsubscribe_url", Label: "退订链接", Default: "https://www.supdance.com/account/notifications"},
			},
			SampleVariables: map[string]string{
				"name":            "小溪",
				"current_credits": "2",
				"discount_rate":   "8折",
				"promo_code":      "KOYO2026",
				"bonus_credits":   "50",
				"action_url":      "https://www.supdance.com/pricing",
				"brand_name":      "SupDance",
				"support_email":   "support@supdance.com",
				"unsubscribe_url": "https://www.supdance.com/account/notifications",
			},
			DefaultHtml: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark only">
  <meta name="supported-color-schemes" content="dark">
  <title>算力额度提醒 - {{brand_name}}</title>
  <style>` + emailBaseStyle + `</style>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0b0d;">
  <div style="background-color: #0a0b0d; padding: 24px 12px;">
    <div class="email-container">
      <div class="email-header">
        <div style="display: inline-flex; align-items: center; gap: 10px;">
          <div style="width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(135deg, #e11d74 0%, #ff2d88 100%); display: inline-block; vertical-align: middle;"></div>
          <span style="font-size: 18px; font-weight: 800; color: #ededf0; letter-spacing: -0.3px; vertical-align: middle;">{{brand_name}} 算力守护</span>
        </div>
      </div>
      <div class="email-body">
        <h1 class="email-title">额度即将耗尽，创作不掉线 ⚡</h1>
        <p class="email-subtitle">亲爱的 {{name}}，系统检测到您当前的算力额度仅剩 <strong style="color: #e11d74;">{{current_credits}} 点</strong>，为避免生成任务中断，建议提前补充算力。</p>

        <div class="card" style="border-color: rgba(225, 29, 116, 0.4); background-color: rgba(225, 29, 116, 0.05);">
          <div class="card-title" style="color: #ff2d88;">🎉 专属特惠礼：充值享 {{discount_rate}} 优惠并加赠 {{bonus_credits}} 点</div>
          <p class="card-text">在结算时输入专属优惠码 <strong style="color: #ffffff; background: #23272f; padding: 2px 8px; border-radius: 6px; font-family: monospace;">{{promo_code}}</strong> 即可立享权益，本周内有效。</p>
        </div>

        <div style="text-align: center; margin: 32px 0 16px;">
          <a href="{{action_url}}" class="btn-primary" target="_blank">立即前往充值算力</a>
        </div>
      </div>
      <div class="email-footer">
        <p>本邮件为系统额度预警通知。如需调整通知设置，请前往 <a href="{{unsubscribe_url}}" class="footer-link">通知中心</a>。</p>
        <p style="margin-top: 16px; color: #70757e;">© 2026 {{brand_name}}. 保留所有权利。</p>
      </div>
    </div>
  </div>
</body>
</html>`,
			HTML: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark only">
  <meta name="supported-color-schemes" content="dark">
  <title>算力额度提醒 - {{brand_name}}</title>
  <style>` + emailBaseStyle + `</style>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0b0d;">
  <div style="background-color: #0a0b0d; padding: 24px 12px;">
    <div class="email-container">
      <div class="email-header">
        <div style="display: inline-flex; align-items: center; gap: 10px;">
          <div style="width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(135deg, #e11d74 0%, #ff2d88 100%); display: inline-block; vertical-align: middle;"></div>
          <span style="font-size: 18px; font-weight: 800; color: #ededf0; letter-spacing: -0.3px; vertical-align: middle;">{{brand_name}} 算力守护</span>
        </div>
      </div>
      <div class="email-body">
        <h1 class="email-title">额度即将耗尽，创作不掉线 ⚡</h1>
        <p class="email-subtitle">亲爱的 {{name}}，系统检测到您当前的算力额度仅剩 <strong style="color: #e11d74;">{{current_credits}} 点</strong>，为避免生成任务中断，建议提前补充算力。</p>

        <div class="card" style="border-color: rgba(225, 29, 116, 0.4); background-color: rgba(225, 29, 116, 0.05);">
          <div class="card-title" style="color: #ff2d88;">🎉 专属特惠礼：充值享 {{discount_rate}} 优惠并加赠 {{bonus_credits}} 点</div>
          <p class="card-text">在结算时输入专属优惠码 <strong style="color: #ffffff; background: #23272f; padding: 2px 8px; border-radius: 6px; font-family: monospace;">{{promo_code}}</strong> 即可立享权益，本周内有效。</p>
        </div>

        <div style="text-align: center; margin: 32px 0 16px;">
          <a href="{{action_url}}" class="btn-primary" target="_blank">立即前往充值算力</a>
        </div>
      </div>
      <div class="email-footer">
        <p>本邮件为系统额度预警通知。如需调整通知设置，请前往 <a href="{{unsubscribe_url}}" class="footer-link">通知中心</a>。</p>
        <p style="margin-top: 16px; color: #70757e;">© 2026 {{brand_name}}. 保留所有权利。</p>
      </div>
    </div>
  </div>
</body>
</html>`,
		},

		"winback": {
			Key:            "winback",
			Name:           "沉睡促活与限时回归礼",
			Category:       "用户召回",
			Description:    "针对较长时间未登录的创作者，推送平台全新能力升级与专属回归体验金",
			DefaultSubject: "好久不见，{{brand_name}} 为您准备了专属回归礼包 🎁",
			Subject:        "好久不见，{{brand_name}} 为您准备了专属回归礼包 🎁",
			SupportedVariables: []MarketingVariable{
				{Key: "name", Label: "用户昵称", Default: "创作者"},
				{Key: "inactive_days", Label: "未登录天数", Default: "30"},
				{Key: "gift_credits", Label: "回归礼包额度", Default: "20"},
				{Key: "highlight_feature", Label: "主推亮点功能", Default: "全新 Design Agent 智能生成画布"},
				{Key: "action_url", Label: "立即回归链接", Default: "https://www.supdance.com/login?ref=winback"},
				{Key: "brand_name", Label: "品牌名称", Default: "SupDance"},
				{Key: "support_email", Label: "支持邮箱", Default: "support@supdance.com"},
				{Key: "unsubscribe_url", Label: "退订链接", Default: "https://www.supdance.com/account/notifications"},
			},
			SampleVariables: map[string]string{
				"name":              "小溪",
				"inactive_days":     "30",
				"gift_credits":      "20",
				"highlight_feature": "全新 Design Agent 智能生成画布与双栏极速预览",
				"action_url":        "https://www.supdance.com/login?ref=winback",
				"brand_name":        "SupDance",
				"support_email":     "support@supdance.com",
				"unsubscribe_url":   "https://www.supdance.com/account/notifications",
			},
			DefaultHtml: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark only">
  <meta name="supported-color-schemes" content="dark">
  <title>好久不见 - {{brand_name}}</title>
  <style>` + emailBaseStyle + `</style>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0b0d;">
  <div style="background-color: #0a0b0d; padding: 24px 12px;">
    <div class="email-container">
      <div class="email-header">
        <div style="display: inline-flex; align-items: center; gap: 10px;">
          <div style="width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(135deg, #e11d74 0%, #ff2d88 100%); display: inline-block; vertical-align: middle;"></div>
          <span style="font-size: 18px; font-weight: 800; color: #ededf0; letter-spacing: -0.3px; vertical-align: middle;">{{brand_name}} 创作者回归计划</span>
        </div>
      </div>
      <div class="email-body">
        <h1 class="email-title">好久不见，{{name}} ✨</h1>
        <p class="email-subtitle">距离您上次登录已过去 {{inactive_days}} 天，{{brand_name}} 已经进化得更加强大与敏捷！</p>

        <div class="card" style="border-color: rgba(225, 29, 116, 0.4); background-color: rgba(225, 29, 116, 0.05);">
          <div class="card-title" style="color: #ff2d88;">🎁 专属回归礼已入库：免费领取 {{gift_credits}} 点算力</div>
          <p class="card-text">只要点击下方链接登录，系统将自动向您的账户发放 {{gift_credits}} 点回归体验金，无门槛即可畅享全新模型能力。</p>
        </div>

        <div style="margin: 20px 0;">
          <p style="font-weight: 600; color: #ededf0; margin-bottom: 6px;">这段时间我们上线了：</p>
          <p style="color: #9aa0a6; font-size: 14px; margin: 0;">🚀 <strong style="color: #ededf0;">{{highlight_feature}}</strong>：从想法到可运行的产品仅需数秒，诚邀您立即体验！</p>
        </div>

        <div style="text-align: center; margin: 32px 0 16px;">
          <a href="{{action_url}}" class="btn-primary" target="_blank">一键登录并领取回归礼包</a>
        </div>
      </div>
      <div class="email-footer">
        <p>我们非常想念您的灵感与创作。若您不想再收到促活通知，可 <a href="{{unsubscribe_url}}" class="footer-link">点击退订</a>。</p>
        <p style="margin-top: 16px; color: #70757e;">© 2026 {{brand_name}}. 保留所有权利。</p>
      </div>
    </div>
  </div>
</body>
</html>`,
			HTML: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark only">
  <meta name="supported-color-schemes" content="dark">
  <title>好久不见 - {{brand_name}}</title>
  <style>` + emailBaseStyle + `</style>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0b0d;">
  <div style="background-color: #0a0b0d; padding: 24px 12px;">
    <div class="email-container">
      <div class="email-header">
        <div style="display: inline-flex; align-items: center; gap: 10px;">
          <div style="width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(135deg, #e11d74 0%, #ff2d88 100%); display: inline-block; vertical-align: middle;"></div>
          <span style="font-size: 18px; font-weight: 800; color: #ededf0; letter-spacing: -0.3px; vertical-align: middle;">{{brand_name}} 创作者回归计划</span>
        </div>
      </div>
      <div class="email-body">
        <h1 class="email-title">好久不见，{{name}} ✨</h1>
        <p class="email-subtitle">距离您上次登录已过去 {{inactive_days}} 天，{{brand_name}} 已经进化得更加强大与敏捷！</p>

        <div class="card" style="border-color: rgba(225, 29, 116, 0.4); background-color: rgba(225, 29, 116, 0.05);">
          <div class="card-title" style="color: #ff2d88;">🎁 专属回归礼已入库：免费领取 {{gift_credits}} 点算力</div>
          <p class="card-text">只要点击下方链接登录，系统将自动向您的账户发放 {{gift_credits}} 点回归体验金，无门槛即可畅享全新模型能力。</p>
        </div>

        <div style="margin: 20px 0;">
          <p style="font-weight: 600; color: #ededf0; margin-bottom: 6px;">这段时间我们上线了：</p>
          <p style="color: #9aa0a6; font-size: 14px; margin: 0;">🚀 <strong style="color: #ededf0;">{{highlight_feature}}</strong>：从想法到可运行的产品仅需数秒，诚邀您立即体验！</p>
        </div>

        <div style="text-align: center; margin: 32px 0 16px;">
          <a href="{{action_url}}" class="btn-primary" target="_blank">一键登录并领取回归礼包</a>
        </div>
      </div>
      <div class="email-footer">
        <p>我们非常想念您的灵感与创作。若您不想再收到促活通知，可 <a href="{{unsubscribe_url}}" class="footer-link">点击退订</a>。</p>
        <p style="margin-top: 16px; color: #70757e;">© 2026 {{brand_name}}. 保留所有权利。</p>
      </div>
    </div>
  </div>
</body>
</html>`,
		},
	}
}

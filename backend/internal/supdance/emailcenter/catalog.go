// Package emailcenter owns template contracts and presentation, never authentication or billing.
package emailcenter

import (
	"html/template"
	"time"
	"yingce/backend/internal/supdance/maillocale"
)

const Locale = "zh-CN"
const PluginID = "supdance-email-marketing"
const BuiltinVersion = "email-center-1.2.0"

type Variable struct {
	Key       string `json:"key"`
	Required  bool   `json:"required"`
	Protected bool   `json:"protected"`
}
type Event struct {
	Key             string     `json:"key"`
	Name            string     `json:"name"`
	Category        string     `json:"category"`
	Locale          string     `json:"locale"`
	Variables       []Variable `json:"variables"`
	ProtectedModule string     `json:"protectedModule,omitempty"`
	Trigger         string     `json:"trigger"`
	RatePolicy      string     `json:"ratePolicy"`
}
type Block struct {
	SafeHTML template.HTML `json:"-"`
	Type     string        `json:"type"`
	Title    string        `json:"title,omitempty"`
	Text     string        `json:"text,omitempty"`
	URL      string        `json:"url,omitempty"`
	Image    string        `json:"image,omitempty"`
	Alt      string        `json:"alt,omitempty"`
	Items    []string      `json:"items,omitempty"`
}
type Document struct {
	Subject   string  `json:"subject"`
	Preheader string  `json:"preheader"`
	Heading   string  `json:"heading"`
	Blocks    []Block `json:"blocks"`
}
type Brand struct {
	Name         string `json:"name"`
	LogoURL      string `json:"logoUrl"`
	SiteURL      string `json:"siteUrl"`
	SupportEmail string `json:"supportEmail"`
	Footer       string `json:"footer"`
	Color        string `json:"color"`
	Version      string `json:"version"`
}

// Payload is constructed by the business caller. It never comes from template operators.
type Payload struct {
	Variables      map[string]string
	Code           string
	Action         string
	Recipient      string
	ExpiresAt      time.Time
	ProtectedHTML  string
	ProtectedText  string
	UnsubscribeURL string
	Preview        bool
}

func Events() []Event {
	codeVars := []Variable{{"code", true, true}, {"expires_at", true, true}, {"recipient", true, true}}
	return []Event{
		{"registration", "注册验证码", "security", Locale, codeVars, "code", "注册及重发", "现有域名规则、60 秒冷却"},
		{"password_reset", "找回密码", "security", Locale, codeVars, "code", "已验证的密码账号申请重置", "现有限速、枚举保护及第三方账号限制"},
		{"verification", "身份验证码", "security", Locale, codeVars, "code", "现有登录或敏感操作验证", "共享配额、每小时 5 次、每天 20 次"},
		{"profile_email", "更换邮箱验证码", "security", Locale, codeVars, "code", "现有账号凭据及新邮箱验证", "共享配额、60 秒冷却"},
		{"email_changed", "旧邮箱变更通知", "security", Locale, []Variable{{"notice", true, true}}, "notice", "邮箱修改完成通知旧地址", "一次已完成变更"},
		{"consumption_report", "消费日报", "notification", Locale, []Variable{{"report", true, true}, {"report_subject", true, false}}, "report", "已订阅且当天有真实消费", "用户每天最多一次，原子领取"},
		{"test", "SMTP 测试", "test", Locale, nil, "", "管理员测试，白名单及限额", "每管理员每小时 10 次"},
		{"welcome", "新用户引导", "marketing", Locale, []Variable{{"name", true, false}}, "", "人工测试，或后续获同意的活动", "明确订阅、发送前复核"},
		{"newsletter", "产品更新与功能周报", "marketing", Locale, []Variable{{"update_title", true, false}, {"update_body", true, false}}, "", "人工测试，或后续获同意的活动", "明确订阅、发送前复核"},
		{"credit_alert", "额度与方案介绍", "marketing", Locale, []Variable{{"name", true, false}}, "", "仅方案介绍；不读取或虚构余额", "明确订阅、发送前复核"},
		{"winback", "回归创作邀请", "marketing", Locale, []Variable{{"name", true, false}}, "", "人工测试，或后续获同意的活动", "明确订阅、发送前复核"},
	}
}
func FindEvent(key string) (Event, bool) {
	for _, e := range Events() {
		if e.Key == key {
			return e, true
		}
	}
	return Event{}, false
}
func LocalizedEvent(key, locale string) (Event, bool) {
	if locale != "" && !maillocale.Valid(locale) {
		return Event{}, false
	}
	e, ok := FindEvent(key)
	if ok {
		e.Locale = maillocale.Resolve(locale)
		e.Name = maillocale.Text(e.Locale, key)
	}
	return e, ok
}
func AllEvents() []Event {
	var all []Event
	for _, locale := range maillocale.Supported() {
		all = append(all, EventsForLocale(locale)...)
	}
	return all
}
func EventsForLocale(locale string) []Event {
	events := Events()
	for i := range events {
		events[i], _ = LocalizedEvent(events[i].Key, locale)
	}
	return events
}
func DefaultDocument(e Event) Document {
	e, _ = LocalizedEvent(e.Key, e.Locale)
	t := func(key string) string { return maillocale.Text(e.Locale, key) }
	d := Document{Subject: "{{brand_name}} · " + e.Name, Preheader: e.Name, Heading: e.Name, Blocks: []Block{}}
	switch e.ProtectedModule {
	case "code":
		d.Blocks = []Block{{Type: "paragraph", Text: t("code_intro")}, {Type: "code"}, {Type: "notice", Text: t("security_tip")}}
		if e.Key == "registration" {
			d.Blocks[0].Text = t("register_intro")
		}
	case "notice":
		d.Blocks = []Block{{Type: "notice"}}
	case "report":
		d.Subject = "{{report_subject}}"
		d.Blocks = []Block{{Type: "report"}}
	default:
		switch e.Key {
		case "welcome":
			d.Heading = t("welcome_heading")
			d.Blocks = []Block{{Type: "paragraph", Text: t("welcome_text")}, {Type: "steps", Items: []string{t("step_open"), t("step_model"), t("step_save")}}, {Type: "button", Text: t("create"), URL: "{{site_url}}/create"}}
		case "newsletter":
			d.Heading = "{{update_title}}"
			d.Blocks = []Block{{Type: "paragraph", Text: "{{update_body}}"}, {Type: "button", Text: t("workbench"), URL: "{{site_url}}/create"}}
		case "credit_alert":
			d.Heading = t("credit_heading")
			d.Blocks = []Block{{Type: "paragraph", Text: t("credit_text")}, {Type: "notice", Text: t("credit_notice")}, {Type: "button", Text: t("pricing"), URL: "{{site_url}}/pricing"}}
		case "winback":
			d.Heading = t("winback_heading")
			d.Blocks = []Block{{Type: "paragraph", Text: t("winback_text")}, {Type: "button", Text: t("workbench"), URL: "{{site_url}}/create"}}
		default:
			d.Blocks = []Block{{Type: "notice", Text: t("smtp_notice")}}
		}
	}
	return d
}

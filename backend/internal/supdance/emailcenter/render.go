package emailcenter

import (
	"bytes"
	"errors"
	"fmt"
	"html"
	"html/template"
	"net/mail"
	"net/url"
	"regexp"
	"strings"
	"time"

	"yingce/backend/internal/emailtpl"
)

var token = regexp.MustCompile(`\{\{([a-z_][a-z_0-9]*)\}\}`)
var color = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)
var numericCode = regexp.MustCompile(`^[0-9]{6}$`)
var unverifiedBenefit = regexp.MustCompile(`(?i)赠送|赠予|到账|优惠|永不过期|免费积分|回归礼|bonus\s+credits|free\s+credits|discount|gift\s+credits`)

func SafeURL(raw string, brand Brand, image bool) bool {
	u, err := url.Parse(raw)
	if err != nil || u.User != nil || strings.ContainsAny(raw, "\r\n") {
		return false
	}
	if !image && u.Scheme == "mailto" {
		_, err := mail.ParseAddress(u.Opaque)
		return err == nil && u.Opaque == brand.SupportEmail && u.RawQuery == ""
	}
	b, err := url.Parse(brand.SiteURL)
	if err != nil || u.Scheme != "https" || u.Host == "" || !strings.EqualFold(u.Host, b.Host) || u.Opaque != "" || strings.HasPrefix(u.Path, "//") || strings.Contains(u.Path, "\\") {
		return false
	}
	path := u.Path
	for _, segment := range strings.Split(path, "/") {
		if segment == "." || segment == ".." {
			return false
		}
	}
	if strings.HasPrefix(path, "/api/public/email-center/brand/") {
		return u.RawQuery == ""
	}
	if !image && path == "/api/public/email-center/unsubscribe" {
		values := u.Query()
		return len(values) == 1 && values.Get("token") != ""
	}
	if u.RawQuery != "" {
		return false
	}
	prefixes := []string{"/create", "/pricing", "/wallet", "/account", "/settings", "/help", "/docs", "/terms", "/privacy", "/legal", "/projects", "/canvas", "/studio"}
	if image {
		prefixes = []string{"/images", "/email-assets"}
	}
	if !image && (path == "" || path == "/") {
		return true
	}
	for _, prefix := range prefixes {
		if path == prefix || strings.HasPrefix(path, prefix+"/") {
			return true
		}
	}
	return false
}

func Validate(e Event, d Document) error {
	if strings.TrimSpace(d.Subject) == "" || strings.TrimSpace(d.Heading) == "" || len(d.Subject) > 300 || len(d.Preheader) > 400 || len(d.Blocks) > 60 {
		return errors.New("invalid email document")
	}
	if strings.ContainsAny(d.Subject+d.Preheader, "\r\n") {
		return errors.New("email metadata must be a single line")
	}
	all := []string{d.Subject, d.Preheader, d.Heading}
	protected := 0
	for _, b := range d.Blocks {
		switch b.Type {
		case "heading", "paragraph", "image", "card", "steps", "notice", "summary", "button", "features", "cover", "code", "report", "html":
		default:
			return fmt.Errorf("unsupported module: %s", b.Type)
		}
		if b.Type == "code" || b.Type == "report" || (b.Type == "notice" && e.ProtectedModule == "notice" && b.Text == "") {
			if b.Type != e.ProtectedModule {
				return errors.New("protected module does not match event")
			}
			protected++
			if b.Text+b.Title+b.URL+b.Image+b.Alt != "" || len(b.Items) > 0 {
				return errors.New("protected module cannot be edited")
			}
		}
		all = append(all, b.Title, b.Text, b.URL, b.Image, b.Alt)
		all = append(all, b.Items...)
	}
	if e.ProtectedModule != "" && protected != 1 {
		return errors.New("exactly one protected module is required")
	}
	allowed := map[string]bool{"brand_name": true, "site_url": true, "support_email": true}
	for _, v := range e.Variables {
		if !v.Protected {
			allowed[v.Key] = true
		}
	}
	joined := strings.Join(all, "\n")
	if e.Category == "marketing" && unverifiedBenefit.MatchString(joined) {
		return errors.New("营销权益尚未接入真实账务验证，不能发布赠送或优惠承诺")
	}
	for _, v := range e.Variables {
		if v.Required && !v.Protected && !strings.Contains(joined, "{{"+v.Key+"}}") {
			return fmt.Errorf("required variable missing from template: %s", v.Key)
		}
	}
	if len(joined) > 100000 {
		return errors.New("email content is too large")
	}
	for _, m := range token.FindAllStringSubmatch(joined, -1) {
		if !allowed[m[1]] {
			return fmt.Errorf("unapproved variable: %s", m[1])
		}
	}
	// Unsupported syntax and embedded markup are never interpreted as templates or HTML.
	stripped := token.ReplaceAllString(joined, "")
	if strings.Contains(stripped, "{{") || strings.Contains(stripped, "}}") {
		return errors.New("invalid variable syntax")
	}
	return nil
}

func Samples(e Event) map[string]string {
	v := map[string]string{"name": "预览创作者", "update_title": "产品更新标题（预览）", "update_body": "填写已经核实的产品更新、教程或创作案例。", "report_subject": "消费日报（预览，真实数据由服务端生成）"}
	return v
}

func Render(e Event, d Document, b Brand, p Payload) (emailtpl.Rendered, error) {
	if err := Validate(e, d); err != nil {
		return emailtpl.Rendered{}, err
	}
	if strings.EqualFold(b.Name, "supdance") {
		b.Name = "SupDance"
	}
	vars := map[string]string{}
	for k, v := range p.Variables {
		vars[k] = v
	}
	if p.Preview {
		for k, v := range Samples(e) {
			if vars[k] == "" {
				vars[k] = v
			}
		}
	}
	vars["brand_name"] = b.Name
	vars["site_url"] = b.SiteURL
	vars["support_email"] = b.SupportEmail
	for _, v := range e.Variables {
		if !v.Protected && strings.TrimSpace(vars[v.Key]) == "" {
			return emailtpl.Rendered{}, fmt.Errorf("missing required variable: %s", v.Key)
		}
	}
	var expansionErr error
	expand := func(s string) string {
		return token.ReplaceAllStringFunc(s, func(m string) string {
			k := token.FindStringSubmatch(m)[1]
			v, ok := vars[k]
			if !ok {
				expansionErr = fmt.Errorf("missing variable: %s", k)
			}
			return v
		})
	}
	view := struct {
		Heading string
		Blocks  []Block
		Accent  string
	}{Heading: expand(d.Heading), Accent: b.Color}
	if !color.MatchString(view.Accent) {
		view.Accent = "#b72d6a"
	}
	var text strings.Builder
	text.WriteString(view.Heading + "\n\n")
	for _, block := range d.Blocks {
		block.Items = append([]string(nil), block.Items...)
		block.Title = expand(block.Title)
		if block.Type == "html" {
			// Escape substitutions before parsing raw operator HTML, then sanitize contexts.
			expanded := token.ReplaceAllStringFunc(block.Text, func(m string) string { return html.EscapeString(vars[token.FindStringSubmatch(m)[1]]) })
			clean, plain, err := SanitizeHTML(expanded, b)
			if err != nil {
				return emailtpl.Rendered{}, err
			}
			block.SafeHTML = template.HTML(clean)
			block.Text = plain
		} else {
			block.Text = expand(block.Text)
		}
		block.URL = expand(block.URL)
		block.Image = expand(block.Image)
		block.Alt = expand(block.Alt)
		for i, item := range block.Items {
			block.Items[i] = expand(item)
		}
		if block.URL != "" && !SafeURL(block.URL, b, false) {
			return emailtpl.Rendered{}, errors.New("link must use an allowed HTTPS site destination")
		}
		if block.Image != "" && !SafeURL(block.Image, b, true) {
			return emailtpl.Rendered{}, errors.New("image must use the HTTPS site origin")
		}
		if block.Type == "code" {
			if p.Preview {
				block.Text = "••••••"
				block.Title = "验证码仅在真实认证邮件正文中显示"
			} else {
				_, recipientErr := mail.ParseAddress(p.Recipient)
				if !numericCode.MatchString(p.Code) || !p.ExpiresAt.After(time.Now()) || recipientErr != nil {
					return emailtpl.Rendered{}, errors.New("invalid or expired authentication challenge")
				}
				block.Text = p.Code
				seconds := max(1, int(time.Until(p.ExpiresAt).Seconds()))
				action := p.Action
				if action == "" {
					action = e.Name
				}
				block.Title = fmt.Sprintf("%s · %d 秒内有效，只能使用一次", action, seconds)
				block.Title += " · " + p.Recipient
			}
			text.WriteString("验证码：" + block.Text + "\n" + block.Title + "\n")
		} else if block.Type == "report" || (block.Type == "notice" && e.ProtectedModule == "notice" && block.Text == "") {
			if p.ProtectedText == "" && !p.Preview {
				return emailtpl.Rendered{}, errors.New("missing protected business content")
			}
			block.Text = p.ProtectedText
			if p.Preview {
				block.Text = "真实业务内容由服务端生成；预览不含用户数据。"
			}
			text.WriteString(block.Text + "\n")
		} else {
			text.WriteString(block.Title + "\n" + block.Text + "\n" + strings.Join(block.Items, "\n") + "\n" + block.URL + "\n")
		}
		view.Blocks = append(view.Blocks, block)
	}
	subject := expand(d.Subject)
	preheader := expand(d.Preheader)
	if e.Category == "security" && p.Code != "" && (strings.Contains(subject, p.Code) || strings.Contains(preheader, p.Code)) {
		return emailtpl.Rendered{}, errors.New("authentication credential cannot appear in metadata")
	}
	if expansionErr != nil {
		return emailtpl.Rendered{}, expansionErr
	}
	if e.Category == "marketing" && unverifiedBenefit.MatchString(subject+"\n"+preheader+"\n"+text.String()) {
		return emailtpl.Rendered{}, errors.New("营销权益尚未接入真实账务验证，不能发送赠送或优惠承诺")
	}
	if strings.ContainsAny(subject+preheader, "\r\n") {
		return emailtpl.Rendered{}, errors.New("header injection rejected")
	}
	// Business callers may pass the server-rendered report only. Operators cannot supply HTML.
	var body bytes.Buffer
	if err := bodyTemplate.Execute(&body, view); err != nil {
		return emailtpl.Rendered{}, err
	}
	if e.ProtectedModule == "report" && p.ProtectedHTML != "" && !p.Preview {
		body.Reset()
		body.WriteString(p.ProtectedHTML)
	}
	footer := "这是必要的账户邮件，不受营销退订影响。"
	if e.Category == "notification" {
		footer = "你已订阅此通知，可在站内账号设置中管理。"
	}
	if e.Category == "marketing" {
		footer = "你收到此邮件是因为订阅了品牌资讯。"
		if !p.Preview && !SafeURL(p.UnsubscribeURL, b, false) {
			return emailtpl.Rendered{}, errors.New("marketing unsubscribe URL required")
		}
		if p.UnsubscribeURL != "" {
			body.WriteString(`<p style="padding:24px;"><a href="` + html.EscapeString(p.UnsubscribeURL) + `">退订营销邮件</a></p>`)
			text.WriteString("\n退订营销邮件：" + p.UnsubscribeURL)
		}
	}
	if e.Category == "test" || p.Preview {
		subject = "[测试] " + subject
		footer = "此内容用于测试，不含有效的认证凭证。"
	}
	if b.LogoURL != "" && !SafeURL(b.LogoURL, b, true) {
		return emailtpl.Rendered{}, errors.New("unsafe brand logo URL")
	}
	htmlBody, err := emailtpl.RenderMessage(emailtpl.Message{Brand: b.Name, LogoURL: b.LogoURL, SupportEmail: b.SupportEmail, Footer: b.Footer, Title: subject, Preheader: preheader, Body: body.String(), FooterNote: footer})
	return emailtpl.Rendered{Subject: subject, HTML: htmlBody, BrandVersion: b.Version, Text: strings.TrimSpace(text.String()) + "\n\n" + footer + "\n— " + b.Name + "\n" + b.Footer + "\n" + b.SupportEmail}, err
}

var bodyTemplate = template.Must(template.New("modules").Parse(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;overflow-wrap:anywhere;word-break:break-word;">
<tr><td style="padding:24px;font-size:24px;font-weight:700;">{{.Heading}}</td></tr>
{{range .Blocks}}<tr><td style="padding:12px 24px;font-size:15px;line-height:1.7;">
{{if .Image}}<img src="{{.Image}}" alt="{{.Alt}}" width="504" style="width:100%;max-width:504px;height:auto;display:block;">{{end}}
{{if .Title}}<p style="margin:0 0 8px;font-weight:600;">{{.Title}}</p>{{end}}
{{if eq .Type "html"}}{{.SafeHTML}}{{else if eq .Type "code"}}<p data-protected-code="true" style="font-family:Consolas,monospace;font-size:32px;letter-spacing:6px;">{{.Text}}</p>{{else}}<p style="margin:0;white-space:pre-line;">{{.Text}}</p>{{end}}
{{if .Items}}<ul>{{range .Items}}<li>{{.}}</li>{{end}}</ul>{{end}}
{{if .URL}}<a href="{{.URL}}" style="display:inline-block;padding:12px 20px;background:{{$.Accent}};color:#ffffff;text-decoration:none;border-radius:8px;">{{if .Text}}{{.Text}}{{else}}{{.Title}}{{end}}</a>{{end}}
</td></tr>{{end}}</table>`))

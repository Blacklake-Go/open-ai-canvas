package emailcenter

import (
	"strings"
	"testing"
	"time"
)

func testBrand() Brand {
	return Brand{Name: "Supdance", SiteURL: "https://mail.example.com", LogoURL: "https://mail.example.com/api/public/email-center/brand/abc", SupportEmail: "support@example.com", Color: "#151515"}
}
func TestProtectedCodeHasRealExpiryAndNeverMetadata(t *testing.T) {
	e, _ := FindEvent("password_reset")
	d := DefaultDocument(e)
	out, err := Render(e, d, testBrand(), Payload{Code: "093741", Recipient: "reader@example.com", ExpiresAt: time.Now().Add(73 * time.Second), Action: "重置密码"})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(out.Subject, "093741") || strings.Contains(out.HTML[:strings.Index(out.HTML, "<table")], "093741") {
		t.Fatal("code leaked to title or preheader")
	}
	if !strings.Contains(out.Text, "验证码：093741") || !strings.Contains(out.Text, "72 秒内有效") || !strings.Contains(out.HTML, "data-protected-code") {
		t.Fatal("protected challenge content missing")
	}
	preview, err := Render(e, d, testBrand(), Payload{Preview: true})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(preview.HTML, "093741") || numericCode.MatchString(preview.Text) || !strings.Contains(preview.Text, "••••••") {
		t.Fatal("preview contains a real credential")
	}
	if _, err := Render(e, d, testBrand(), Payload{Code: "093741", ExpiresAt: time.Now().Add(-time.Second)}); err == nil {
		t.Fatal("expired challenge accepted")
	}
	d.Subject = "093741"
	if _, err := Render(e, d, testBrand(), Payload{Code: "093741", Recipient: "reader@example.com", ExpiresAt: time.Now().Add(time.Minute)}); err == nil {
		t.Fatal("literal credential leaked into subject")
	}
}
func TestPublishRejectsProtectedVariableAndMissingOrDuplicateModule(t *testing.T) {
	e, _ := FindEvent("registration")
	for _, change := range []func(*Document){func(d *Document) { d.Subject = "{{code}}" }, func(d *Document) { d.Preheader = "{{expires_at}}" }, func(d *Document) { d.Blocks = []Block{{Type: "paragraph", Text: "no code"}} }, func(d *Document) { d.Blocks = append(d.Blocks, Block{Type: "code"}) }, func(d *Document) { d.Blocks[1].Text = "override" }, func(d *Document) { d.Subject = "ok\r\nBcc: attacker@example.com" }} {
		d := DefaultDocument(e)
		change(&d)
		if Validate(e, d) == nil {
			t.Fatalf("invalid security document accepted: %+v", d)
		}
	}
}
func TestMarketingHasNoFinancialSampleFallback(t *testing.T) {
	e, _ := FindEvent("newsletter")
	d := DefaultDocument(e)
	if _, err := Render(e, d, testBrand(), Payload{UnsubscribeURL: "https://mail.example.com/api/public/email-center/unsubscribe?token=x"}); err == nil {
		t.Fatal("missing real content silently defaulted")
	}
	if _, err := Render(e, d, testBrand(), Payload{Variables: map[string]string{"update_title": "赠送积分", "update_body": "automatic bonus credits"}, UnsubscribeURL: "https://mail.example.com/api/public/email-center/unsubscribe?token=x"}); err == nil {
		t.Fatal("unverified benefit injected through real variables")
	}
	for _, e := range Events() {
		if e.Category != "marketing" {
			continue
		}
		d := DefaultDocument(e)
		out, err := Render(e, d, testBrand(), Payload{Preview: true})
		if err != nil {
			t.Fatal(err)
		}
		for _, forbidden := range []string{"KOYO2026", "永不过期", "自动发放", "赠送额度", "8折", "50 积分"} {
			if strings.Contains(out.HTML, forbidden) {
				t.Fatal("unverified promise in template", e.Key, forbidden)
			}
		}
	}
}
func TestHTMLSanitizerAndContextEscaping(t *testing.T) {
	e, _ := FindEvent("welcome")
	d := DefaultDocument(e)
	d.Blocks = []Block{{Type: "html", Text: `<p style="color:#333; background:url(https://evil.example);position:fixed" onclick="steal()">{{name}}<a href="javascript:alert(1)">bad</a><a href="https://mail.example.com/create">good</a><script>secret()</script><iframe src="https://evil.example"></iframe><img src="https://evil.example/pixel" onerror="steal()"></p>`}}
	out, err := Render(e, d, testBrand(), Payload{Variables: map[string]string{"name": `<img src=x onerror=steal()>`}, UnsubscribeURL: "https://mail.example.com/api/public/email-center/unsubscribe?token=x"})
	if err != nil {
		t.Fatal(err)
	}
	for _, bad := range []string{"<script", "<iframe", "onclick=", "onerror=\"", "javascript:", "evil.example", "position:fixed", "background:url"} {
		if strings.Contains(out.HTML, bad) {
			t.Fatal("unsafe HTML survived", bad)
		}
	}
	if !strings.Contains(out.HTML, "&lt;img") || !strings.Contains(out.HTML, `href="https://mail.example.com/create"`) {
		t.Fatal("escaped variables or safe link missing")
	}
}
func TestURLPolicyAndTemplateImmutability(t *testing.T) {
	b := testBrand()
	for _, raw := range []string{"javascript:alert(1)", "https://evil.example/create", "//mail.example.com/create", "https://mail.example.com@evil.example/create", "https://mail.example.com/redirect?url=https://evil.example", "https://mail.example.com/create?next=https://evil.example", "https://mail.example.com/api/auth/logout", "https://mail.example.com/%2f%2fevil.example"} {
		if SafeURL(raw, b, false) {
			t.Fatal("unsafe URL accepted", raw)
		}
	}
	e, _ := FindEvent("welcome")
	d := DefaultDocument(e)
	d.Blocks = append(d.Blocks, Block{Type: "steps", Items: []string{"{{name}}"}})
	if _, err := Render(e, d, b, Payload{Preview: true}); err != nil {
		t.Fatal(err)
	}
	if d.Blocks[len(d.Blocks)-1].Items[0] != "{{name}}" {
		t.Fatal("render mutated the template")
	}
}

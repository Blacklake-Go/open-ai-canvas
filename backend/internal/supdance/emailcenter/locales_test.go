package emailcenter

import (
	"strings"
	"testing"
	"time"
	"yingce/backend/internal/supdance/maillocale"
)

func TestAll88TemplatesRenderLocalizedHTMLAndText(t *testing.T) {
	if len(AllEvents()) != 88 {
		t.Fatal("missing event/locale combinations")
	}
	for _, e := range AllEvents() {
		t.Run(e.Key+"/"+e.Locale, func(t *testing.T) {
			doc := DefaultDocument(e)
			out, err := Render(e, doc, testBrand(), Payload{Preview: true})
			if err != nil {
				t.Fatal(err)
			}
			if !strings.Contains(out.HTML, `lang="`+e.Locale+`"`) || !strings.HasPrefix(out.Subject, maillocale.Text(e.Locale, "test_prefix")) || !strings.Contains(out.Text, maillocale.Text(e.Locale, "test_footer")) {
				t.Fatal("locale did not reach full email")
			}
			if strings.Contains(out.HTML, "{{") || strings.Contains(out.Text, "%!") {
				t.Fatal("unexpanded translation")
			}
			if e.ProtectedModule == "code" {
				mail, err := Render(e, doc, testBrand(), Payload{Code: "012345", Recipient: "owner@example.com", ExpiresAt: time.Now().Add(45 * time.Second)})
				if err != nil {
					t.Fatal(err)
				}
				if !strings.Contains(mail.Text, "012345") || strings.Contains(mail.Subject, "012345") || !strings.Contains(mail.Text, maillocale.Text(e.Locale, "code_label")) {
					t.Fatal("localized challenge lost security contract")
				}
			}
		})
	}
}
func TestNoCrossLanguageBenefitClaimsOrUnapprovedLocales(t *testing.T) {
	claims := []string{"贈送點數", "free credits", "créditos gratis", "crédits gratuits", "kostenlose credits", "無料クレジット", "무료 크레딧"}
	for _, locale := range maillocale.Supported() {
		e, _ := LocalizedEvent("welcome", locale)
		for _, claim := range claims {
			d := DefaultDocument(e)
			d.Blocks[0].Text += " " + claim
			if Validate(e, d) == nil {
				t.Fatalf("unverified benefit accepted: %s", claim)
			}
		}
	}
	if _, ok := LocalizedEvent("welcome", "xx-YY"); ok {
		t.Fatal("unsupported language silently accepted")
	}
}

func TestMetadataLimitsCountUnicodeCharactersAndExpandedVariables(t *testing.T) {
	e, _ := LocalizedEvent("registration", "ja-JP")
	d := DefaultDocument(e)
	d.Subject = strings.Repeat("語", 120)
	if _, err := Render(e, d, testBrand(), Payload{Preview: true}); err != nil {
		t.Fatal("valid multibyte subject was counted as bytes", err)
	}
	e, _ = LocalizedEvent("welcome", "de-DE")
	d = DefaultDocument(e)
	d.Subject = "{{name}}"
	if _, err := Render(e, d, testBrand(), Payload{Preview: true, Variables: map[string]string{"name": strings.Repeat("x", 301)}}); err == nil {
		t.Fatal("expanded subject exceeded the limit")
	}
}

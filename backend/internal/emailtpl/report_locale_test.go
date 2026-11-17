package emailtpl

import (
	"strings"
	"testing"
	"yingce/backend/internal/supdance/maillocale"
)

func TestActualSpendingReportIsLocalizedWithoutChangingData(t *testing.T) {
	for _, locale := range maillocale.Supported() {
		t.Run(locale, func(t *testing.T) {
			report := ConsumptionReport{Locale: locale, Brand: "SupDance", UserName: "Creator-原名", Date: "2026-11-17", TotalMicro: 120000000, ConsumeMicro: 130000000, RefundMicro: 10000000, OrderCount: 12, AvailableMicro: 900000000, PreviousDayMicro: 60000000, Last7: []DayAmount{{Label: "11-17", Micro: 120000000}}, Capabilities: []Slice{{Label: "Actual capability", Micro: 130000000, Count: 12}}, Models: []Slice{{Label: "MODEL_原名", Micro: 130000000, Count: 12}}}
			report.Hourly[14] = 130000000
			out, err := RenderConsumptionReport(report)
			if err != nil {
				t.Fatal(err)
			}
			for _, value := range []string{"120", "900", "Creator-原名", "MODEL_原名", maillocale.Text(locale, "report_composition"), maillocale.Text(locale, "report_bill")} {
				if !strings.Contains(out.HTML, value) {
					t.Fatalf("missing real data or translation: %s", value)
				}
			}
			if !strings.Contains(out.HTML, `lang="`+locale+`"`) || strings.Contains(out.HTML, "<no value>") || strings.Contains(out.Text, "%!") {
				t.Fatal("malformed localized report")
			}
			if locale != "zh-CN" && locale != "zh-TW" {
				for _, chinese := range []string{"积分", "今日净消费", "消费日报", "当前余额", "消费构成", "星期"} {
					if strings.Contains(out.HTML, chinese) || strings.Contains(out.Text, chinese) {
						t.Fatalf("untranslated product label %s", chinese)
					}
				}
			}
		})
	}
}

func TestLocaleNumberFormattingPreservesCreditRounding(t *testing.T) {
	for locale, want := range map[string]string{"zh-CN": "1,234.5", "en-US": "1,234.5", "zh-TW": "1,234.5", "ja-JP": "1,234.5", "ko-KR": "1,234.5", "de-DE": "1.234,5", "es-ES": "1.234,5", "fr-FR": "1\u202f234,5"} {
		if got := FormatCreditsLocale(1234500000, locale); got != want {
			t.Errorf("%s: %q != %q", locale, got, want)
		}
	}
	if FormatCreditsLocale(-15000, "de-DE") != "-0,02" || FormatCreditsLocale(0, "fr-FR") != "0" {
		t.Fatal("localized formatting changed rounding or sign")
	}
}

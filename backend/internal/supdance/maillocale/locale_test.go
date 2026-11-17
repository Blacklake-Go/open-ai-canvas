package maillocale

import (
	"regexp"
	"strings"
	"testing"
)

func TestNativeEightLanguagesHaveCompleteMailVocabulary(t *testing.T) {
	if strings.Join(Supported(), ",") != "zh-CN,en-US,zh-TW,es-ES,fr-FR,de-DE,ja-JP,ko-KR" {
		t.Fatal("mail/native locale order changed")
	}
	format := regexp.MustCompile(`%[-+0-9.]*[sdvf]`)
	for key, row := range vocabulary {
		shape := strings.Join(format.FindAllString(row[0], -1), ",")
		for i, value := range row {
			if strings.TrimSpace(value) == "" {
				t.Fatalf("missing %s / %s", key, Supported()[i])
			}
			if strings.Join(format.FindAllString(value, -1), ",") != shape {
				t.Fatalf("format arguments changed: %s / %s", key, Supported()[i])
			}
		}
	}
}
func TestLocaleSelectionMatchesNativeLanguagesAndQuality(t *testing.T) {
	for input, want := range map[string]string{"en-GB": "en-US", "zh-Hant-HK": "zh-TW", "zh_CN": "zh-CN", "fr-CA, en-US;q=0.7": "fr-FR", ",ja-JP": "ja-JP", "xx;q=1,ko;q=0.8": "ko-KR", "en;q=0,fr;q=1": "fr-FR", "de-DE": "de-DE", "es-MX": "es-ES"} {
		if got := Match(input); got != want {
			t.Errorf("%q: %q, want %q", input, got, want)
		}
	}
	if Resolve("xx-YY", "de-AT") != "de-DE" || Resolve("invalid") != Default || Valid("xx-YY") {
		t.Fatal("locale fallback or validation failed")
	}
}

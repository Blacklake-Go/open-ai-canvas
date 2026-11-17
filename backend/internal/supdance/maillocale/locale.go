// Package maillocale owns the eight-language mail vocabulary and locale policy.
package maillocale

import (
	"fmt"
	"strings"

	"golang.org/x/text/language"
	appi18n "yingce/backend/internal/supdance/i18n"
)

const Default = "zh-CN"

func Supported() []string    { return append([]string(nil), appi18n.SupportedLocaleCodes...) }
func Valid(code string) bool { return appi18n.IsSupportedLocale(code) }

// Match also accepts browser language ranges. Explicit writes must use Valid.
func Match(raw string) string {
	ranges := []string{}
	for _, part := range strings.Split(strings.ReplaceAll(raw, "_", "-"), ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		if _, _, err := language.ParseAcceptLanguage(part); err == nil {
			ranges = append(ranges, part)
		}
	}
	tags, _, err := language.ParseAcceptLanguage(strings.Join(ranges, ","))
	if err != nil {
		return ""
	}
	for _, tag := range tags {
		base, _ := tag.Base()
		if base.String() == "zh" {
			region, _ := tag.Region()
			script, _ := tag.Script()
			if region.String() == "TW" || region.String() == "HK" || region.String() == "MO" || script.String() == "Hant" {
				return "zh-TW"
			}
			return Default
		}
		for _, code := range Supported() {
			if strings.EqualFold(strings.Split(code, "-")[0], base.String()) {
				return code
			}
		}
	}
	return ""
}
func Resolve(candidates ...string) string {
	for _, candidate := range candidates {
		if code := Match(candidate); code != "" {
			return code
		}
	}
	return Default
}
func Text(locale, key string, args ...any) string {
	row, ok := vocabulary[key]
	if !ok {
		panic("unregistered mail translation: " + key)
	}
	index := 0
	for i, code := range Supported() {
		if code == Resolve(locale) {
			index = i
			break
		}
	}
	value := row[index]
	if len(args) > 0 {
		return fmt.Sprintf(value, args...)
	}
	return value
}

// Labels returns a copy for server-rendered report templates.
func Labels(locale string) map[string]string {
	labels := make(map[string]string, len(vocabulary))
	for key := range vocabulary {
		labels[key] = Text(locale, key)
	}
	return labels
}

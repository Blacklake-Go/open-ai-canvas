package app

import (
	"fmt"
	"strings"
	"yingce/backend/internal/supdance/emailcenter"
)

// Editorial campaign content requires an explicit translation, never a sample
// or a silent Chinese fallback. Personal names remain common business data.
func emailCampaignVariables(e emailcenter.Event, common map[string]string, localized map[string]map[string]string, locale string) (map[string]string, error) {
	allowed := map[string]bool{}
	for _, v := range e.Variables {
		if !v.Protected {
			allowed[v.Key] = true
		}
	}
	result := map[string]string{}
	for key, value := range common {
		if !allowed[key] {
			return nil, fmt.Errorf("活动包含未批准变量")
		}
		result[key] = value
	}
	for key, value := range localized[locale] {
		if !allowed[key] {
			return nil, fmt.Errorf("活动包含未批准变量")
		}
		result[key] = value
	}
	if e.Key == "newsletter" {
		for _, key := range []string{"update_title", "update_body"} {
			if strings.TrimSpace(localized[locale][key]) == "" {
				return nil, fmt.Errorf("%s: 缺少 %s 的明确翻译", locale, key)
			}
		}
	}
	return result, nil
}

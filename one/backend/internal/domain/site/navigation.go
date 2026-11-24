package site

import (
	"encoding/json"
	"errors"
	"net/url"
	"strings"
	"unicode"
)

// DecodeNavigation accepts the older admin editor's path field on read and
// returns the canonical href field consumed by the public navigation.
func DecodeNavigation(raw []byte, strict bool) ([]NavItem, error) {
	var records []struct {
		NavItem
		Path string `json:"path"`
	}
	if err := json.Unmarshal(raw, &records); err != nil || records == nil {
		return nil, errors.New("navigation must be an array")
	}
	items := make([]NavItem, 0, len(records))
	ids := make(map[string]struct{}, len(records))
	for _, record := range records {
		item := record.NavItem
		item.ID = strings.TrimSpace(item.ID)
		item.Label = strings.TrimSpace(item.Label)
		item.LabelEn = strings.TrimSpace(item.LabelEn)
		item.Href = strings.TrimSpace(item.Href)
		if item.Href == "" {
			item.Href = strings.TrimSpace(record.Path)
		}
		_, duplicate := ids[item.ID]
		if item.ID == "" || duplicate || (item.Label == "" && item.LabelEn == "") || !validNavigationHref(item.Href) {
			if strict {
				return nil, errors.New("each navigation item needs a unique id, a label, and a valid site path or HTTP(S) URL")
			}
			continue
		}
		if item.Target != "_blank" {
			item.Target = "_self"
		}
		ids[item.ID] = struct{}{}
		item.Order = len(items) + 1
		items = append(items, item)
	}
	return items, nil
}

func validNavigationHref(value string) bool {
	if value == "" || strings.Contains(value, "\\") || strings.IndexFunc(value, unicode.IsControl) != -1 {
		return false
	}
	target, err := url.Parse(value)
	if err != nil {
		return false
	}
	if strings.HasPrefix(value, "/") {
		return !strings.HasPrefix(value, "//") && target.Host == "" && !strings.HasPrefix(target.Path, "//")
	}
	return (target.Scheme == "http" || target.Scheme == "https") && target.Hostname() != "" && target.User == nil
}

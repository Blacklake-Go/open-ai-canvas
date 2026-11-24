package site

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/mail"
	"sort"
	"strings"
)

type PublicSubscriptionFAQ struct {
	SubscriptionFAQPayload
	Configured bool `json:"configured"`
}

func SubscriptionFAQLocale(raw string) (string, string, bool) {
	locale, ok := NormalizeLocale(raw)
	if strings.TrimSpace(raw) == "" {
		locale, ok = "zh-CN", true
	}
	if !ok {
		return "", "", false
	}
	key := "subscription_faq_config"
	if locale != "zh-CN" {
		key += ":" + locale
	}
	return locale, key, true
}

func DecodeSubscriptionFAQ(raw []byte, locale string) (SubscriptionFAQPayload, error) {
	config := DefaultSubscriptionFAQ(locale)
	if len(raw) == 0 {
		return config, nil
	}
	if err := json.Unmarshal(raw, &config); err != nil {
		return SubscriptionFAQPayload{}, err
	}
	if config.Items == nil {
		config.Items = []FAQItem{}
	}
	sort.SliceStable(config.Items, func(i, j int) bool { return config.Items[i].Order < config.Items[j].Order })
	return config, nil
}

func ValidateSubscriptionFAQ(config SubscriptionFAQPayload) (SubscriptionFAQPayload, error) {
	config.Notice = strings.TrimSpace(config.Notice)
	config.InvoiceNotice = strings.TrimSpace(config.InvoiceNotice)
	config.SupportEmail = strings.TrimSpace(config.SupportEmail)
	if config.SupportEmail != "" {
		address, err := mail.ParseAddress(config.SupportEmail)
		if err != nil || address.Address != config.SupportEmail {
			return SubscriptionFAQPayload{}, errors.New("客服邮箱格式有误。")
		}
	}
	if config.Items == nil {
		return SubscriptionFAQPayload{}, errors.New("请提交完整的问答列表。")
	}
	ids := make(map[string]bool, len(config.Items))
	for index := range config.Items {
		item := &config.Items[index]
		item.ID = strings.TrimSpace(item.ID)
		item.Question = strings.TrimSpace(item.Question)
		item.Answer = strings.TrimSpace(item.Answer)
		item.Category = strings.TrimSpace(item.Category)
		if item.ID == "" || ids[item.ID] {
			return SubscriptionFAQPayload{}, fmt.Errorf("第 %d 条问答缺少唯一 ID。", index+1)
		}
		if item.Question == "" || item.Answer == "" {
			return SubscriptionFAQPayload{}, fmt.Errorf("第 %d 条问答需要问题和解答。", index+1)
		}
		if item.Category == "" {
			item.Category = "general"
		}
		if item.Order <= 0 {
			item.Order = index + 1
		}
		ids[item.ID] = true
	}
	sort.SliceStable(config.Items, func(i, j int) bool { return config.Items[i].Order < config.Items[j].Order })
	for i := range config.Items {
		config.Items[i].Order = i + 1
	}
	return config, nil
}

func (s *Service) GetSubscriptionFAQ(ctx context.Context, locale, key string) (PublicSubscriptionFAQ, error) {
	var raw json.RawMessage
	if s.Repo != nil {
		var err error
		raw, err = s.Repo.GetSetting(ctx, key)
		if err != nil {
			return PublicSubscriptionFAQ{}, err
		}
	}
	config, err := DecodeSubscriptionFAQ(raw, locale)
	if err != nil {
		return PublicSubscriptionFAQ{}, err
	}
	visible := make([]FAQItem, 0, len(config.Items))
	for _, item := range config.Items {
		if item.Enabled && strings.TrimSpace(item.Question) != "" && strings.TrimSpace(item.Answer) != "" {
			visible = append(visible, item)
		}
	}
	config.Items = visible
	return PublicSubscriptionFAQ{SubscriptionFAQPayload: config, Configured: len(raw) > 0}, nil
}

package site

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

type stubRepo struct {
	settings map[string]json.RawMessage
}

func (s *stubRepo) GetSetting(_ context.Context, key string) (json.RawMessage, error) {
	return s.settings[key], nil
}

func TestGenerateSitemapXML(t *testing.T) {
	svc := &Service{
		Repo: &stubRepo{
			settings: map[string]json.RawMessage{
				"site_seo": json.RawMessage(`{"canonicalBase":"https://one.supdance.com/"}`),
			},
		},
	}
	xml := svc.GenerateSitemapXML(context.Background(), "2026-11-15")
	if !strings.Contains(xml, `<?xml version="1.0" encoding="UTF-8"?>`) {
		t.Fatal("missing XML declaration")
	}
	if !strings.Contains(xml, `<loc>https://one.supdance.com/</loc>`) {
		t.Fatalf("missing canonical root URL in:\n%s", xml)
	}
	if !strings.Contains(xml, `<loc>https://one.supdance.com/studio</loc>`) {
		t.Fatal("missing /studio URL")
	}
	if strings.Contains(xml, "/api") || strings.Contains(xml, "/admin") {
		t.Fatal("sitemap must not contain /api or /admin paths")
	}

	custom := BuildSitemapXML("", "2026-11-15", []SitemapRoute{
		{Path: "/admin/secret"},
		{Path: "/api/health"},
		{Path: "/pricing?foo=bar#hash"},
	})
	if strings.Contains(custom, "/admin") || strings.Contains(custom, "/api") {
		t.Fatal("private routes must be filtered from sitemap")
	}
	if !strings.Contains(custom, "<loc>https://www.supdance.com/pricing</loc>") {
		t.Fatalf("expected stripped /pricing URL, got:\n%s", custom)
	}
}

func TestSubscriptionFAQPublicationDistinguishesDisabledAndUnpublished(t *testing.T) {
	locale, key, ok := SubscriptionFAQLocale("es-AR")
	if !ok || locale != "es" || key != "subscription_faq_config:es" {
		t.Fatalf("unexpected normalized settings key: %q %q", locale, key)
	}
	svc := Service{Repo: &stubRepo{settings: map[string]json.RawMessage{
		key: json.RawMessage(`{"items":[{"id":"disabled","question":"Q","answer":"A","enabled":false}]}`),
	}}}
	published, err := svc.GetSubscriptionFAQ(context.Background(), locale, key)
	if err != nil || !published.Configured || len(published.Items) != 0 {
		t.Fatalf("disabled questions must stay hidden: %+v, %v", published, err)
	}
	locale, key, _ = SubscriptionFAQLocale("ja-JP")
	unpublished, err := svc.GetSubscriptionFAQ(context.Background(), locale, key)
	if err != nil || unpublished.Configured || len(unpublished.Items) != 0 {
		t.Fatalf("unpublished locale should be distinct from saved settings: %+v, %v", unpublished, err)
	}
}

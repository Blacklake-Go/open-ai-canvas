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

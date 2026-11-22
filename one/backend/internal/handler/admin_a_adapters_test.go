package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

func TestEnrichCostAndProfitMetrics(t *testing.T) {
	costRow := map[string]any{"total_cost_usd": 2.0}
	enrichCostMetricsUSDToCNY(costRow)
	if costRow["total_cost_cny"] != 14.5 || costRow["total_cost_credits"] != int64(200) {
		t.Fatalf("unexpected cost metrics: %#v", costRow)
	}

	profitRow := map[string]any{"total_credits": 1000.0, "total_cost_usd": 2.0}
	enrichProfitMetrics(profitRow)
	if profitRow["revenue_cny"] != 70.0 || profitRow["cost_cny"] != 14.5 || profitRow["gross_profit_cny"] != 55.5 {
		t.Fatalf("unexpected profit metrics: %#v", profitRow)
	}
	if profitRow["gross_margin_pct"] != 79.29 {
		t.Fatalf("unexpected gross_margin_pct: %#v", profitRow["gross_margin_pct"])
	}
}

func TestComputeLanguageCoverageDiagnostics(t *testing.T) {
	merged := map[string]any{
		"en": map[string]any{
			"welcome": "Hello {name}",
			"empty":   "Not empty",
			"missing": "Must exist",
		},
		"zh-CN": map[string]any{
			"welcome": "你好 {wrongVar}",
			"empty":   "   ",
		},
	}
	diags := computeLanguageCoverageDiagnostics([]string{"en", "zh-CN"}, merged)
	if len(diags) != 2 {
		t.Fatalf("expected 2 diagnostics, got %d", len(diags))
	}
	zh := diags[1]
	if zh["coverage"] != 0 || zh["totalKeys"] != 3 {
		t.Fatalf("unexpected zh-CN coverage: %#v", zh)
	}
	if missing, _ := zh["missing"].([]string); len(missing) != 1 || missing[0] != "missing" {
		t.Fatalf("expected missing=[missing], got %#v", zh["missing"])
	}
	if fmtErr, _ := zh["formatErrors"].([]string); len(fmtErr) != 1 || fmtErr[0] != "welcome" {
		t.Fatalf("expected formatErrors=[welcome], got %#v", zh["formatErrors"])
	}
	if inv, _ := zh["invalid"].([]string); len(inv) != 1 || inv[0] != "empty" {
		t.Fatalf("expected invalid=[empty], got %#v", zh["invalid"])
	}
}

func TestExecuteTwitterCrawlHTTP(t *testing.T) {
	var gotAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"data": [{"id":"19001","text":"cinematic neon rain prompt","author_id":"u1","created_at":"2026-11-01T10:00:00Z"}],
			"includes": {"users": [{"id":"u1","username":"supdance_art"}]}
		}`))
	}))
	defer srv.Close()

	u, _ := url.Parse(srv.URL)
	t.Setenv("ONE_X_API_BASE", srv.URL)

	items, err := executeTwitterCrawlHTTP(context.Background(), []string{u.Hostname()}, "x_bearer_test", "video", 15, "@supdance_art")
	if err != nil {
		t.Fatalf("executeTwitterCrawlHTTP: %v", err)
	}
	if gotAuth != "Bearer x_bearer_test" || len(items) != 1 {
		t.Fatalf("unexpected X crawl result: auth=%q items=%#v", gotAuth, items)
	}
	if items[0]["author"] != "supdance_art" || items[0]["url"] != "https://x.com/supdance_art/status/19001" {
		t.Fatalf("unexpected normalized tweet item: %#v", items[0])
	}
}

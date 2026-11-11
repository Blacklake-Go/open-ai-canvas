package app

import (
	"strings"
	"testing"
)

func TestDefaultBuiltinHtmlPages(t *testing.T) {
	pages := defaultBuiltinHtmlPages()
	if len(pages) < 4 {
		t.Fatalf("预期至少提供 4 个内置页面模版，实际获得 %d 个", len(pages))
	}

	slugMap := make(map[string]bool)
	for _, p := range pages {
		if p.ID == "" {
			t.Errorf("页面 ID 不能为空: %+v", p)
		}
		if p.Slug == "" {
			t.Errorf("页面 Slug 不能为空: %+v", p)
		}
		if p.Title == "" {
			t.Errorf("页面 Title 不能为空: %+v", p)
		}
		if p.HTML == "" {
			t.Errorf("页面 HTML 内容不能为空: %s", p.Slug)
		}
		if !strings.Contains(p.HTML, "<!DOCTYPE html>") {
			t.Errorf("页面 HTML 必须为自包含标准 HTML 文档: %s", p.Slug)
		}
		if !strings.Contains(p.HTML, "id=\"theme-toggle\"") {
			t.Errorf("页面 HTML 必须内置明暗主题切换按钮 #theme-toggle: %s", p.Slug)
		}
		if !strings.Contains(p.HTML, "startViewTransition") {
			t.Errorf("页面 HTML 必须支持 View Transition 缩放动效: %s", p.Slug)
		}
		slugMap[p.Slug] = true
	}

	requiredSlugs := []string{"terms", "privacy", "legal", "refund", "aup"}
	for _, s := range requiredSlugs {
		if !slugMap[s] {
			t.Errorf("缺少核心必须的页面 slug: %s", s)
		}
	}
}

func TestHtmlPageManagerPolicies(t *testing.T) {
	policy, ok := officialApplicationPolicies[PluginSupDanceHtmlPageManager]
	if !ok {
		t.Fatalf("supdance-html-page-manager 必须在官方应用策略中注册")
	}
	if policy.Kind != PluginKindApplication {
		t.Errorf("预期插件类型为 application，实际为 %v", policy.Kind)
	}
	if policy.ActivationScope != PluginScopeSystem {
		t.Errorf("预期激活作用域为 system，实际为 %v", policy.ActivationScope)
	}
}

func TestDefaultHtmlSiteFooterConfig(t *testing.T) {
	cfg := DefaultHtmlSiteFooterConfig()
	if !cfg.Enabled {
		t.Fatal("预期默认页脚为启用状态")
	}
	if cfg.SupportEmail != "support@supdance.com" {
		t.Errorf("预期默认支持邮箱为 support@supdance.com，实际为 %s", cfg.SupportEmail)
	}
	if len(cfg.SocialLinks) < 5 {
		t.Errorf("预期至少包含 5 个官方社交入口，实际 %d", len(cfg.SocialLinks))
	}
	if len(cfg.Columns) < 2 {
		t.Errorf("预期至少包含 2 列链接组，实际 %d", len(cfg.Columns))
	}
	expectedPaths := map[string]bool{
		"/terms":        false,
		"/privacy":      false,
		"/aup":          false,
		"/legal":        false,
		"/mcp":          false,
		"/pricing.html": false,
	}
	for _, p := range cfg.SitePages {
		if _, ok := expectedPaths[p.Path]; ok {
			expectedPaths[p.Path] = true
			if !p.ShowFooter {
				t.Errorf("预期默认站点页面 %s 开启页脚显示", p.Path)
			}
		}
	}
	for path, found := range expectedPaths {
		if !found {
			t.Errorf("默认受管页面列表缺少: %s", path)
		}
	}

	normalized := normalizeHtmlSiteFooterConfig(HtmlSiteFooterConfig{Enabled: true})
	if normalized.BrandName == "" || len(normalized.SitePages) != len(cfg.SitePages) {
		t.Errorf("normalizeHtmlSiteFooterConfig 未正确填充默认字段")
	}
}

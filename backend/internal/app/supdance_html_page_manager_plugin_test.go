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
		slugMap[p.Slug] = true
	}

	requiredSlugs := []string{"terms", "privacy", "legal", "refund", "aup"}
	for _, s := range requiredSlugs {
		if !slugMap[s] {
			t.Errorf("缺少核心必须的页面 slug: %s", s)
		}
	}
}

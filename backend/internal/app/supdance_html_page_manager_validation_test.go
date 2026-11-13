package app

import (
	"testing"
	"yingce/backend/internal/model"
)

func TestValidateHtmlPages(t *testing.T) {
	valid := HtmlPageItem{ID: "page-1", Slug: "terms", Title: "Terms", HTML: "<p>Terms</p>"}
	for _, tc := range []struct {
		name      string
		pages     []HtmlPageItem
		wantError bool
	}{
		{"valid", []HtmlPageItem{valid}, false},
		{"empty list", nil, false},
		{"duplicate ID", []HtmlPageItem{valid, {ID: "page-1", Slug: "privacy", Title: "Privacy", HTML: "<p>Privacy</p>"}}, true},
		{"case insensitive duplicate slug", []HtmlPageItem{valid, {ID: "page-2", Slug: " TERMS ", Title: "Terms", HTML: "<p>Terms</p>"}}, true},
		{"missing ID", []HtmlPageItem{{Slug: "terms", Title: "Terms", HTML: "<p>Terms</p>"}}, true},
		{"invalid path", []HtmlPageItem{{ID: "page-1", Slug: "../terms", Title: "Terms", HTML: "<p>Terms</p>"}}, true},
		{"empty title", []HtmlPageItem{{ID: "page-1", Slug: "terms", HTML: "<p>Terms</p>"}}, true},
		{"empty HTML", []HtmlPageItem{{ID: "page-1", Slug: "terms", Title: "Terms"}}, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if err := validateHtmlPages(tc.pages); (err != nil) != tc.wantError {
				t.Fatalf("validateHtmlPages() = %v, wantError %v", err, tc.wantError)
			}
		})
	}
}

func TestHtmlPageManagerPersistenceAndAuthorization(t *testing.T) {
	svc, _, _, admin := newAppearanceTestService(t)
	normal := &model.User{ID: "html-reader", Role: model.UserRoleUser, Status: model.UserStatusActive}
	page := HtmlPageItem{ID: "html-test", Slug: "html-test", Title: "HTML test", HTML: "<p>Original</p>"}
	if _, err := svc.AdminSaveHtmlPages(normal, []HtmlPageItem{page}); err == nil {
		t.Fatal("ordinary user must not save pages")
	}
	if _, err := svc.AdminHtmlPagesOverview(normal); err == nil {
		t.Fatal("ordinary user must not read admin overview")
	}
	if _, err := svc.AdminSaveHtmlPages(admin, []HtmlPageItem{page}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.PublicHtmlPageBySlug(page.Slug); err == nil {
		t.Fatal("draft must not be public")
	}
	page.IsPublished = true
	if _, err := svc.AdminSaveHtmlPages(admin, []HtmlPageItem{page}); err != nil {
		t.Fatal(err)
	}
	if published, err := svc.PublicHtmlPageBySlug(page.Slug); err != nil || published.HTML != page.HTML {
		t.Fatalf("published page: %v, %v", published, err)
	}
	invalid := page
	invalid.ID = "another-id"
	invalid.Slug = " HTML-TEST "
	if _, err := svc.AdminSaveHtmlPages(admin, []HtmlPageItem{page, invalid}); err == nil {
		t.Fatal("duplicate path must fail")
	}
	overview, err := svc.AdminHtmlPagesOverview(admin)
	if err != nil {
		t.Fatal(err)
	}
	if len(overview.Pages) != 1 || overview.Pages[0].HTML != page.HTML {
		t.Fatal("failed save changed stored pages")
	}
	footer := overview.SiteFooter
	footer.BrandName = "HTML manager integration"
	if _, err := svc.AdminSaveHtmlSiteFooter(normal, footer); err == nil {
		t.Fatal("ordinary user must not save footer")
	}
	if _, err := svc.AdminSaveHtmlSiteFooter(admin, footer); err != nil {
		t.Fatal(err)
	}
	overview, err = svc.AdminHtmlPagesOverview(admin)
	if err != nil {
		t.Fatal(err)
	}
	if overview.SiteFooter.BrandName != footer.BrandName || overview.Pages[0].HTML != page.HTML {
		t.Fatal("footer save must preserve pages")
	}
	if _, err := svc.AdminResetHtmlPages(admin); err != nil {
		t.Fatal(err)
	}
	overview, err = svc.AdminHtmlPagesOverview(admin)
	if err != nil {
		t.Fatal(err)
	}
	if len(overview.Pages) < 4 || overview.SiteFooter.BrandName != footer.BrandName {
		t.Fatal("page reset must preserve footer")
	}
	if _, err := svc.AdminResetHtmlSiteFooter(admin); err != nil {
		t.Fatal(err)
	}
	overview, err = svc.AdminHtmlPagesOverview(admin)
	if err != nil || overview.SiteFooter.BrandName != DefaultHtmlSiteFooterConfig().BrandName {
		t.Fatalf("footer reset: %v", err)
	}
}

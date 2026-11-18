package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"yingce/backend/internal/auth"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
	"yingce/backend/internal/service"
	"yingce/backend/internal/supdance/compactpicker"
	"yingce/backend/internal/supdance/gallery"
)

func TestSupDanceCompactPickerHTTP(t *testing.T) {
	gin.SetMode(gin.TestMode)
	dir := t.TempDir()
	var dialector gorm.Dialector = sqlite.Open(filepath.Join(dir, "picker.db"))
	if dsn := os.Getenv("SUPDANCE_GALLERY_TEST_POSTGRES_DSN"); dsn != "" {
		u, err := url.Parse(dsn)
		if err != nil || !strings.HasPrefix(u.Path, "/supdance_gallery_test_") {
			t.Fatal("gallery PostgreSQL test requires a dedicated supdance_gallery_test_ database")
		}
		dialector = postgres.Open(dsn)
	}
	db, err := gorm.Open(dialector, &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })
	if err := db.AutoMigrate(&model.User{}, &model.AuthSession{}, &model.PluginPlatformState{}, &model.UserPluginState{}, &model.SystemSetting{}, &model.AdminAuditEvent{}, &model.InspirationFeedEntry{}); err != nil {
		t.Fatal(err)
	}
	for _, role := range []model.UserRole{model.UserRoleAdmin, model.UserRoleUser} {
		id := string(role)
		if err := db.Create(&model.User{ID: id, Username: id, Role: role, Status: model.UserStatusActive}).Error; err != nil {
			t.Fatal(err)
		}
		if err := db.Create(&model.AuthSession{ID: id, UserID: id, TokenHash: auth.HashToken("session"), ExpiresAt: time.Now().Add(time.Hour)}).Error; err != nil {
			t.Fatal(err)
		}
	}
	newRouter := func() *gin.Engine {
		svc := service.New(repository.New(db), dir)
		previousRuntime := runtimeService
		ConfigureRuntime(svc)
		t.Cleanup(func() { ConfigureRuntime(previousRuntime) })
		t.Cleanup(func() { _ = svc.Close() })
		router := gin.New()
		RegisterCanvasAPI(router.Group("/api"), svc)
		return router
	}
	router := newRouter()
	const public = "/api/supdance/compact-model-picker/settings"
	const admin = "/api/admin/supdance/compact-model-picker/settings"
	const toggle = "/api/admin/plugins/" + compactpicker.PluginID + "/availability"
	const adminCookie = "admin.session"
	const userCookie = "user.session"
	const saved = `{"enabled":false,"showDescription":true,"showPrice":false}`
	for _, tc := range []struct {
		method, path, body, cookie string
		status                     int
	}{
		{"GET", admin, "", "", http.StatusUnauthorized},
		{"PUT", admin, saved, "", http.StatusUnauthorized},
		{"GET", admin, "", userCookie, http.StatusForbidden},
		{"PUT", admin, saved, userCookie, http.StatusForbidden},
		{"PUT", public, saved, adminCookie, http.StatusNotFound},
		{"PUT", admin, `{}`, adminCookie, http.StatusBadRequest},
		{"PUT", admin, `{"enabled":true,"showDescription":true}`, adminCookie, http.StatusBadRequest},
		{"PUT", admin, `{"enabled":false,"showDescription":null,"showPrice":true}`, adminCookie, http.StatusBadRequest},
		{"PUT", admin, `{"enabled":true,"showDescription":false,"showPrice":"true"}`, adminCookie, http.StatusBadRequest},
		{"PUT", admin, `{"enabled":true,"showDescription":true,"showPrice":true,"other":false}`, adminCookie, http.StatusBadRequest},
		{"PUT", admin, saved + `{}`, adminCookie, http.StatusBadRequest},
	} {
		if rec := profileRequest(router, tc.method, tc.path, tc.body, tc.cookie); rec.Code != tc.status {
			t.Fatalf("%s %s %s: want %d, got %d %s", tc.method, tc.path, tc.body, tc.status, rec.Code, rec.Body)
		}
	}
	check := func(method, path, body, cookie string, enabled, description, price, inspirations bool) {
		t.Helper()
		rec := profileRequest(router, method, path, body, cookie)
		var result struct {
			Code int            `json:"code"`
			Data map[string]any `json:"data"`
		}
		want := map[string]any{"enabled": enabled, "showDescription": description, "showPrice": price, "showInspirations": inspirations, "homepageShowcaseEnabled": false, "complianceLock": true}
		decodeErr := json.Unmarshal(rec.Body.Bytes(), &result)
		delete(result.Data, "updatedAt")
		if rec.Code != 200 || decodeErr != nil || result.Code != 0 || !reflect.DeepEqual(result.Data, want) {
			t.Fatalf("%s %s: got %d %s, want %v", method, path, rec.Code, rec.Body, want)
		}
		if method == "GET" && rec.Header().Get("Cache-Control") != "no-store" {
			t.Fatal("settings GET must be revalidated after an administrator changes them")
		}
	}
	check("GET", public, "", "", true, true, true, false)
	check("GET", admin, "", adminCookie, true, true, true, false)
	check("PUT", admin, saved, adminCookie, false, true, false, false)
	rec := profileRequest(router, "GET", "/api/admin/plugins", "", adminCookie)
	var listing struct {
		Data struct {
			States map[string]struct {
				PlatformAvailable bool `json:"platformAvailable"`
				EffectiveEnabled  bool `json:"effectiveEnabled"`
			} `json:"states"`
		} `json:"data"`
	}
	if rec.Code != 200 || json.Unmarshal(rec.Body.Bytes(), &listing) != nil {
		t.Fatalf("plugin center: %d %s", rec.Code, rec.Body)
	}
	if state, ok := listing.Data.States[compactpicker.PluginID]; !ok || state.PlatformAvailable || state.EffectiveEnabled {
		t.Fatalf("plugin center did not see the disabled plugin: %+v", state)
	}
	router = newRouter()
	check("GET", public, "", "", false, true, false, false)
	if rec := profileRequest(router, "PUT", toggle, `{"available":true}`, adminCookie); rec.Code != 200 {
		t.Fatalf("plugin center toggle failed: %s", rec.Body)
	}
	check("GET", public, "", "", true, true, false, false)
	check("GET", admin, "", adminCookie, true, true, false, false)
	if rec := profileRequest(router, "PUT", admin, `{"enabled":true,"showDescription":true,"showPrice":true,"showInspirations":true}`, adminCookie); rec.Code != 400 {
		t.Fatalf("locked gallery reopened: %d %s", rec.Code, rec.Body)
	}
	check("GET", public, "", "", true, true, false, false)
	// Exercise the real HTTP routes, including anonymous reads and ordinary-user
	// writes. Recovery runs only against this disposable database and archive.
	archive := filepath.Join(dir, "inspiration-archive", "inspirations")
	if err := os.MkdirAll(archive, 0700); err != nil {
		t.Fatal(err)
	}
	seenAt := time.Now().UTC()
	feedFixtures := []model.InspirationFeedEntry{{
		ID: "youmind:older-feed", SourceID: "youmind", Mode: "image", Title: "Older feed",
		Prompt: "Older prompt", Image: "https://example.com/older.webp", FirstSeenAt: seenAt.Add(-time.Hour),
	}}
	for i := range 3000 {
		feedFixtures = append(feedFixtures, model.InspirationFeedEntry{
			ID: fmt.Sprintf("youmind:unselected-feed-%04d", i), SourceID: "youmind", Mode: "image", Title: "Unselected feed",
			Prompt: "Feed prompt", Image: "https://example.com/feed.webp", FirstSeenAt: seenAt,
		})
	}
	if err := db.CreateInBatches(feedFixtures, 100).Error; err != nil {
		t.Fatal(err)
	}
	entry := gallery.Entry{"id": "youmind:authorized", "sourceId": "youmind", "title": "Original landscape", "prompt": "original", "image": "/inspiration-thumbs/youmind/authorized.webp"}
	for _, source := range []string{"seedance", "haohaoxue", "youmind"} {
		entries := []gallery.Entry{}
		if source == "youmind" {
			entries = append(entries, entry)
		}
		payload, _ := json.Marshal(map[string]any{"entries": entries})
		if err := os.WriteFile(filepath.Join(archive, source+".json"), payload, 0600); err != nil {
			t.Fatal(err)
		}
	}
	const reviews = "/api/admin/supdance/compact-model-picker/inspirations"
	unlock := `{"enabled":true,"showDescription":true,"showPrice":false,"showInspirations":true,"homepageShowcaseEnabled":true,"complianceLock":false,"unlockConfirmed":true}`
	reviewPayload, _ := json.Marshal(map[string]string{"id": "youmind:authorized", "status": "approved", "evidence": "Original material, signed release TEST-HTTP-001", "hash": gallery.Digest(entry)})
	for _, tc := range []struct {
		method, path, body, cookie string
		status                     int
	}{
		{"GET", "/api/public/inspirations/feed", "", "", 404},
		{"GET", "/api/public/inspirations/catalog/youmind.json?public=true&admin=true", "", "", 404},
		{"GET", reviews, "", "", 401},
		{"GET", reviews, "", userCookie, 403},
		{"PUT", reviews, string(reviewPayload), userCookie, 403},
		{"PUT", admin, `{"enabled":true,"showDescription":true,"showPrice":false,"complianceLock":false}`, adminCookie, 400},
		{"PUT", admin, unlock, adminCookie, 200},
		{"GET", "/api/public/inspirations/feed", "", "", 200},
		{"GET", "/api/public/inspirations/catalog/youmind.json", "", "", 200},
		{"PUT", reviews, string(reviewPayload), adminCookie, 200},
		{"GET", "/api/public/inspirations/media/youmind/restricted.webp", "", "", 404},
		{"GET", "/api/public/inspirations/curation", "", "", 200},
		{"GET", "/api/admin/inspiration-curation", "", "", 401},
		{"GET", "/api/admin/inspiration-curation/catalog", "", userCookie, 403},
		{"POST", "/api/admin/inspiration-curation/publish", `{"expectedRevision":0}`, userCookie, 403},
		{"PUT", admin, `{"enabled":true,"showDescription":true,"showPrice":false,"showInspirations":false,"homepageShowcaseEnabled":true,"complianceLock":true}`, adminCookie, 200},
		{"GET", "/api/public/inspirations/feed?enabled=true", "", "", 404},
	} {
		rec := profileRequest(router, tc.method, tc.path, tc.body, tc.cookie)
		if rec.Code != tc.status {
			t.Fatalf("gallery %s %s: want %d got %d %s", tc.method, tc.path, tc.status, rec.Code, rec.Body)
		}
	}
	testCurationHTTP(t, router, admin, adminCookie, entry, reviewPayload)
	rejectAuditSQL := "CREATE TRIGGER reject_picker_audit BEFORE INSERT ON admin_audit_events BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END;"
	if db.Dialector.Name() == "postgres" {
		rejectAuditSQL = `CREATE FUNCTION reject_picker_audit_fn() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit unavailable'; END; $$; CREATE TRIGGER reject_picker_audit BEFORE INSERT ON admin_audit_events FOR EACH ROW EXECUTE FUNCTION reject_picker_audit_fn();`
	}
	if err := db.Exec(rejectAuditSQL).Error; err != nil {
		t.Fatal(err)
	}
	if rec := profileRequest(router, "PUT", admin, `{"enabled":false,"showDescription":false,"showPrice":true}`, adminCookie); rec.Code != 500 {
		t.Fatalf("audit failure must abort the save: %d %s", rec.Code, rec.Body)
	}
	check("GET", public, "", "", true, true, false, false)
}

func testCurationHTTP(t *testing.T, router *gin.Engine, admin, cookie string, entry gallery.Entry, review []byte) {
	t.Helper()
	const curation = "/api/admin/inspiration-curation"
	const public = "/api/public/inspirations/curation"
	const reviews = "/api/admin/supdance/compact-model-picker/inspirations"
	request := func(method, path, body, as string, status int, dest any) {
		t.Helper()
		rec := profileRequest(router, method, path, body, as)
		if rec.Code != status {
			t.Fatalf("%s %s: got %d want %d: %s", method, path, rec.Code, status, rec.Body)
		}
		if dest != nil && json.Unmarshal(rec.Body.Bytes(), dest) != nil {
			t.Fatalf("invalid response for %s", path)
		}
	}
	write := func(action string, rev int64, doc *gallery.CurationDocument, version string, status int) gallery.CurationState {
		body, _ := json.Marshal(gallery.CurationChange{ExpectedRevision: &rev, Document: doc, Version: version})
		var result struct{ Data gallery.CurationState }
		request("POST", curation+"/"+action, string(body), cookie, status, &result)
		return result.Data
	}
	published := func() gallery.CurationDocument {
		var result struct{ Data gallery.CurationDocument }
		request("GET", public, "", "", 200, &result)
		return result.Data
	}
	const open = `{"enabled":true,"showDescription":true,"showPrice":false,"showInspirations":true,"homepageShowcaseEnabled":true,"complianceLock":false,"unlockConfirmed":true}`
	const closed = `{"enabled":true,"showDescription":true,"showPrice":false,"showInspirations":false,"complianceLock":true}`
	request("GET", public, "", "", 404, nil)
	request("PUT", admin, open, cookie, 200, nil)
	var inventory struct{ Data []gallery.CurationCard }
	request("GET", curation+"/catalog?q=original", "", cookie, 200, &inventory)
	if len(inventory.Data) == 0 {
		t.Fatal("source inventory/search is empty")
	}
	id, original := gallery.ID(entry), "original:港风天台重逢"
	doc := gallery.CurationDocument{
		Styles:   []gallery.StyleTerm{{ID: "retro"}},
		Cases:    map[string]gallery.CaseTags{id: {Styles: []string{"retro"}, PromptType: "shot-script"}},
		Featured: []gallery.FeaturedCase{{ID: original, FocusX: 50, FocusY: 50}, {ID: id, Pinned: true, Title: "First feature", FocusX: 30, FocusY: 50}},
	}
	bad := doc
	bad.Featured = append(append([]gallery.FeaturedCase{}, doc.Featured...), doc.Featured[0])
	write("draft", 0, &bad, "", 400)
	v := write("draft", 0, &doc, "", 200)
	write("draft", 0, &doc, "", 409)
	if len(published().Featured) != 0 || v.Draft.Featured[0].ID != id {
		t.Fatal("draft leaked to public or the pin did not take precedence")
	}
	a := write("publish", v.Revision, nil, "", 200)
	p := published()
	if len(p.Featured) != 2 || p.Featured[0].Title != "First feature" || p.Cases[id].PromptType != "shot-script" {
		t.Fatal("published curation did not match the draft")
	}
	homeClosed := strings.Replace(open, `"homepageShowcaseEnabled":true`, `"homepageShowcaseEnabled":false`, 1)
	request("PUT", admin, homeClosed, cookie, 200, nil)
	if p = published(); len(p.Featured) != 0 || p.Cases[id].PromptType != "shot-script" {
		t.Fatal("homepage switch must hide featured order while leaving the gallery classification available")
	}
	request("PUT", admin, open, cookie, 200, nil)
	changed := a.Draft
	changed.Featured = []gallery.FeaturedCase{{ID: original, Title: "Second feature", FocusX: 50, FocusY: 50}}
	b := write("draft", a.Revision, &changed, "", 200)
	b = write("publish", b.Revision, nil, "", 200)
	if p = published(); len(p.Featured) != 1 || p.Featured[0].Title != "Second feature" {
		t.Fatal("second version not published")
	}
	restricted, _ := json.Marshal(map[string]string{"id": id, "status": "restricted", "hash": gallery.Digest(entry)})
	request("PUT", reviews, string(restricted), cookie, 200, nil)
	z := write("rollback", b.Revision, nil, a.Published, 200)
	p = published()
	if len(p.Featured) != 1 || p.Featured[0].ID != original || p.Cases[id].PromptType != "" || z.Draft.Featured[0].Title != "Second feature" || z.History[0].RestoredFrom != a.Published {
		t.Fatal("rollback crossed review policy or discarded the saved draft")
	}
	request("PUT", reviews, string(review), cookie, 200, nil)
	feedIDs := func() []string {
		var resp struct {
			Data struct{ Entries []gallery.Entry }
		}
		request("GET", "/api/public/inspirations/feed", "", "", 200, &resp)
		ids := []string{}
		for _, entry := range resp.Data.Entries {
			ids = append(ids, gallery.ID(entry))
		}
		return ids
	}
	catalogIDs := func(source string) []string {
		var pack struct{ Entries []gallery.Entry }
		request("GET", "/api/public/inspirations/catalog/"+source+".json", "", "", 200, &pack)
		ids := []string{}
		for _, entry := range pack.Entries {
			ids = append(ids, gallery.ID(entry))
		}
		return ids
	}
	const first = "original:雨夜霓虹 · 电影感开场"
	const older = "youmind:older-feed"
	manual := z.Draft
	manual.GalleryOrder = &[]string{first, first}
	write("draft", z.Revision, &manual, "", 400)
	manual.GalleryOrder = &[]string{"missing:case"}
	write("draft", z.Revision, &manual, "", 400)
	order := []string{original, id, older, first}
	manual.GalleryOrder = &order
	draft := write("draft", z.Revision, &manual, "", 200)
	if published().GalleryOrder != nil || len(catalogIDs("original")) != 22 || len(feedIDs()) != 3000 {
		t.Fatal("unpublished order changed the legacy catalog or feed")
	}
	release := write("publish", draft.Revision, nil, "", 200)
	p = published()
	if p.GalleryOrder == nil || !reflect.DeepEqual(*p.GalleryOrder, order) ||
		!reflect.DeepEqual(catalogIDs("original"), []string{original, first}) || !reflect.DeepEqual(feedIDs(), []string{older}) {
		t.Fatal("published order was not enforced across catalog and feed")
	}
	request("PUT", reviews, string(restricted), cookie, 200, nil)
	if p = published(); !reflect.DeepEqual(*p.GalleryOrder, []string{original, older, first}) || len(catalogIDs("youmind")) != 0 {
		t.Fatal("published order bypassed review restrictions")
	}
	manual.GalleryOrder = &[]string{}
	emptyDraft := write("draft", release.Revision, &manual, "", 200)
	emptyRelease := write("publish", emptyDraft.Revision, nil, "", 200)
	if p = published(); p.GalleryOrder == nil || len(*p.GalleryOrder) != 0 || len(catalogIDs("original")) != 0 {
		t.Fatal("explicit empty list unexpectedly fell back to the automatic catalog")
	}
	restored := write("rollback", emptyRelease.Revision, nil, release.Published, 200)
	if p = published(); !reflect.DeepEqual(*p.GalleryOrder, []string{original, older, first}) || restored.Draft.GalleryOrder == nil || len(*restored.Draft.GalleryOrder) != 0 {
		t.Fatal("restoring gallery order overrode review restrictions or replaced the draft")
	}
	request("PUT", admin, closed, cookie, 200, nil)
	request("GET", public, "", "", 404, nil)
}

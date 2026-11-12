package gallery

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
	"yingce/backend/internal/supdance/compactpicker"
)

func TestPublicIsolationAndReviewedRecovery(t *testing.T) {
	dir := t.TempDir()
	db, err := gorm.Open(sqlite.Open(filepath.Join(dir, "test.db")), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, _ := db.DB()
	defer sqlDB.Close()
	if err = db.AutoMigrate(&model.SystemSetting{}, &model.PluginPlatformState{}, &model.InspirationFeedEntry{}, &model.AdminAuditEvent{}); err != nil {
		t.Fatal(err)
	}
	repo := repository.New(db)
	svc := Service{repo, dir}
	actor := &model.User{ID: "authorized-admin"}
	if err = os.MkdirAll(filepath.Join(dir, "inspirations"), 0700); err != nil {
		t.Fatal(err)
	}
	good := Entry{"id": "youmind:good", "sourceId": "youmind", "title": "Original abstract landscape", "prompt": "original", "image": "/inspiration-thumbs/youmind/good.webp"}
	bad := Entry{"id": "youmind:restricted", "sourceId": "youmind", "title": "Unlicensed portrait", "prompt": "restricted", "image": "/inspiration-thumbs/youmind/bad.webp"}
	write := func(entries []Entry) {
		t.Helper()
		for _, source := range []string{"youmind", "seedance", "haohaoxue"} {
			pack := []Entry{}
			if source == "youmind" {
				pack = entries
			}
			b, _ := json.Marshal(map[string]any{"entries": pack})
			if err := os.WriteFile(filepath.Join(dir, "inspirations", source+".json"), b, 0600); err != nil {
				t.Fatal(err)
			}
		}
	}
	write([]Entry{good, bad})
	if rows, err := svc.Entries(false); err == nil || len(rows) > 0 {
		t.Fatal("missing config must deny public content")
	}
	if err = svc.RequireUnlock(); err == nil {
		t.Fatal("unreviewed gallery unlocked")
	}
	audit := func() *model.AdminAuditEvent {
		return &model.AdminAuditEvent{ID: Digest(Entry{"n": t.Name(), "counter": db.RowsAffected}), ActorUserID: actor.ID, Action: "review"}
	}
	a := audit()
	a.ID = "approve"
	if err = svc.SaveReview(actor, ID(good), "approved", "", Digest(good), a); err == nil {
		t.Fatal("approval without evidence succeeded")
	}
	if err = svc.SaveReview(actor, ID(good), "approved", "Original artwork, signed license reference TEST-001", Digest(good), a); err != nil {
		t.Fatal(err)
	}
	a.ID = "restrict"
	if err = svc.SaveReview(actor, ID(bad), "restricted", "Rights unverified", Digest(bad), a); err != nil {
		t.Fatal(err)
	}
	if err = svc.RequireUnlock(); err != nil {
		t.Fatal(err)
	}
	save := func(public, home, lock bool) {
		t.Helper()
		b, _ := json.Marshal(compactpicker.Display{ShowDescription: true, ShowPrice: true, ShowInspirations: public, HomepageShowcaseEnabled: home, ComplianceLock: lock})
		if err := repo.SaveSystemSetting(&model.SystemSetting{Key: "plugin." + compactpicker.PluginID + ".display", ValueJSON: string(b)}); err != nil {
			t.Fatal(err)
		}
	}
	for _, state := range []struct{ public, home, lock, want, wantHome bool }{{false, true, false, false, false}, {true, true, true, false, false}, {true, false, false, true, false}, {true, true, false, true, true}} {
		save(state.public, state.home, state.lock)
		rows, err := svc.Entries(false)
		if state.want {
			if err != nil || len(rows) != 1 || ID(rows[0]) != ID(good) {
				t.Fatalf("unexpected public catalog: %v %v", rows, err)
			}
		} else if err == nil || len(rows) > 0 {
			t.Fatal("public switch/lock bypassed")
		}
		_, err = svc.Entries(true)
		if (err == nil) != state.wantHome {
			t.Fatal("homepage policy bypassed")
		}
	}
	if _, err = svc.MediaPath("/inspiration-thumbs/youmind/bad.webp"); err == nil {
		t.Fatal("restricted direct media exposed")
	}
	if _, err = svc.MediaPath("/inspiration-thumbs/../../secret"); err == nil {
		t.Fatal("path traversal allowed")
	}
	if _, err = svc.MediaPath("/inspiration-thumbs/youmind/good.webp"); err != nil {
		t.Fatal(err)
	}
	if _, err = svc.LegacyPack("translations/en-US.json"); err == nil {
		t.Fatal("unreviewed translation pack exposed")
	}
	a.ID = "invalid-replacement"
	if err = svc.SaveReview(actor, ID(good), "approved", "Licensed original replacement TEST-002", Digest(good), a, "javascript:alert(1)"); err == nil {
		t.Fatal("unsafe replacement accepted")
	}
	if err = svc.SaveReview(actor, ID(good), "approved", "Licensed original replacement TEST-002", Digest(good), a, "https://example.com/cover.webp?token=private"); err == nil {
		t.Fatal("credential-bearing replacement accepted")
	}
	a.ID = "replace"
	if err = svc.SaveReview(actor, ID(good), "approved", "Licensed original replacement TEST-002", Digest(good), a, "https://example.com/authorized-cover.webp"); err != nil {
		t.Fatal(err)
	}
	rows, err := svc.Entries(false)
	if err != nil || len(rows) != 1 || rows[0]["image"] != "https://example.com/authorized-cover.webp" {
		t.Fatal("approved replacement not applied")
	}
	if _, err = svc.MediaPath("/inspiration-thumbs/youmind/good.webp"); err == nil {
		t.Fatal("replaced original media remains exposed")
	}
	changed := Entry{}
	for k, v := range good {
		changed[k] = v
	}
	changed["prompt"] = "upstream changed"
	write([]Entry{changed, bad})
	rows, err = svc.Entries(false)
	if err != nil || len(rows) != 0 {
		t.Fatal("changed content retained approval")
	}
	if err = svc.SaveReview(actor, ID(changed), "approved", "Original artwork license TEST-001", Digest(good), a); err == nil {
		t.Fatal("stale review approved changed content")
	}
	if err = repo.SaveSystemSetting(&model.SystemSetting{Key: "plugin." + compactpicker.PluginID + ".display", ValueJSON: `{"showInspirations":true,"complianceLock":"false"}`}); err != nil {
		t.Fatal(err)
	}
	if allowed, err := svc.Public(false); err == nil || allowed {
		t.Fatal("invalid configuration must fail closed")
	}
}

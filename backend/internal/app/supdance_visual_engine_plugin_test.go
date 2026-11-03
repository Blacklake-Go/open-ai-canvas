package app

import (
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"testing"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
	visualengine "yingce/backend/internal/supdance/visualengine"
)

func TestSupDanceVisualEngineConfigLifecycleAndRollback(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+newID()+"?mode=memory&cache=shared"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.PluginPlatformState{}, &model.SystemSetting{}, &model.AdminAuditEvent{}); err != nil {
		t.Fatal(err)
	}
	svc := &Service{repo: repository.New(db)}
	admin := &model.User{ID: "admin-ve", Role: model.UserRoleAdmin, Username: "ve-admin"}
	other := &model.User{ID: "other-ve", Role: model.UserRoleAdmin, Username: "other-admin"}
	user := &model.User{ID: "user-ve", Role: model.UserRoleUser}
	initial, err := svc.PublicVisualEngineBundle()
	if err != nil {
		t.Fatal(err)
	}
	same, _ := svc.PublicVisualEngineBundle()
	if same.Revision != initial.Revision {
		t.Fatal("default revisions are unstable")
	}
	config := visualengine.DefaultConfig()
	config.Components.ButtonRadius = 12
	if _, err := svc.AdminVisualEngineOverview(user); err == nil {
		t.Fatal("ordinary user read admin state")
	}
	if _, err := svc.SaveAdminVisualEngineDraft(user, config); err == nil {
		t.Fatal("ordinary user saved draft")
	}
	if _, err := svc.PublishAdminVisualEngine(user, config, "denied"); err == nil {
		t.Fatal("ordinary user published")
	}
	if _, err := svc.RollbackAdminVisualEngine(user, initial.Version); err == nil {
		t.Fatal("ordinary user rolled back")
	}
	if _, err := svc.SaveAdminVisualEngineDraft(admin, config); err != nil {
		t.Fatal(err)
	}
	afterDraft, _ := svc.PublicVisualEngineBundle()
	if afterDraft.Revision != initial.Revision {
		t.Fatal("draft affected published config")
	}
	overview, _ := svc.AdminVisualEngineOverview(admin)
	otherOverview, _ := svc.AdminVisualEngineOverview(other)
	if overview.Draft == nil || otherOverview.Draft != nil {
		t.Fatal("draft owner isolation failed")
	}
	published, err := svc.PublishAdminVisualEngine(admin, config, "radius test", initial.Revision)
	if err != nil {
		t.Fatal(err)
	}
	if published.Bundle.Config.Components.ButtonRadius != 12 || published.Bundle.Config.UpdatedBy != admin.Username || published.Bundle.Version == initial.Version || len(published.Snapshots) != 2 || published.Draft != nil {
		t.Fatal("publish contract failed")
	}
	if _, err := svc.PublishAdminVisualEngine(other, config, "stale", initial.Revision); err == nil {
		t.Fatal("stale publish succeeded")
	}
	invalid := visualengine.DefaultConfig()
	tokens := invalid.Tokens["dark"]
	tokens.Primary = "url(https://example.com/tracker)"
	invalid.Tokens["dark"] = tokens
	if _, err := svc.PublishAdminVisualEngine(admin, invalid, "invalid", published.Bundle.Revision); err == nil {
		t.Fatal("unsafe config accepted")
	}
	if err := db.Exec("CREATE TRIGGER reject_visual_audit BEFORE INSERT ON admin_audit_events BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END;").Error; err != nil {
		t.Fatal(err)
	}
	if _, err := svc.PublishAdminVisualEngine(admin, config, "must fail", published.Bundle.Revision); err == nil {
		t.Fatal("failed audit did not abort publish")
	}
	afterFailure, _ := svc.PublicVisualEngineBundle()
	if afterFailure.Revision != published.Bundle.Revision {
		t.Fatal("failed transaction changed published config")
	}
	if err := db.Exec("DROP TRIGGER reject_visual_audit").Error; err != nil {
		t.Fatal(err)
	}
	restored, err := svc.RollbackAdminVisualEngine(admin, initial.Version, published.Bundle.Revision)
	if err != nil {
		t.Fatal(err)
	}
	if restored.Bundle.Config.Components.ButtonRadius != initial.Config.Components.ButtonRadius || restored.Bundle.Version == initial.Version || restored.Bundle.Version == published.Bundle.Version {
		t.Fatal("rollback did not restore content as a unique new release")
	}
	if len(restored.AuditLogs) != 2 || restored.AuditLogs[0].Action != "config.rollback" {
		t.Fatal("server audit missing")
	}
	fresh := &Service{repo: repository.New(db)}
	persisted, err := fresh.PublicVisualEngineBundle()
	if err != nil || persisted.Revision != restored.Bundle.Revision {
		t.Fatal("fresh service did not read persisted release")
	}
	if _, err := svc.RollbackAdminVisualEngine(admin, "missing"); err == nil {
		t.Fatal("unknown rollback accepted")
	}
}

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

func TestSupDanceVisualEngineLifecycleAndPermissions(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+newID()+"?mode=memory&cache=shared"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	if err = db.AutoMigrate(&model.User{}, &model.PluginPlatformState{}, &model.SystemSetting{}, &model.AdminAuditEvent{}); err != nil {
		t.Fatal(err)
	}
	owner := &model.User{ID: "ve-owner", Username: "owner", Role: model.UserRoleAdmin, Status: model.UserStatusActive}
	viewer := &model.User{ID: "ve-viewer", Username: "viewer", Role: model.UserRoleAdmin, Status: model.UserStatusActive}
	for _, user := range []*model.User{owner, viewer} {
		if err = db.Create(user).Error; err != nil {
			t.Fatal(err)
		}
	}
	svc := &Service{repo: repository.New(db)}
	if err = svc.SaveAdminVisualEnginePermissions(owner, visualengine.PermissionPolicy{Grants: map[string][]string{viewer.ID: {"view"}}}); err != nil {
		t.Fatal(err)
	}
	if _, err = svc.AdminVisualEngineOverview(viewer); err != nil {
		t.Fatal(err)
	}
	config := visualengine.DefaultConfig()
	if _, err = svc.SaveAdminVisualEngineDraft(viewer, config); err == nil {
		t.Fatal("viewer edited")
	}
	if _, err = svc.PreviewAdminVisualEngine(viewer, config); err == nil {
		t.Fatal("viewer previewed")
	}
	if _, err = svc.PublishAdminVisualEngine(viewer, config, "denied"); err == nil {
		t.Fatal("viewer published")
	}
	if _, err = svc.RollbackAdminVisualEngine(viewer, "missing"); err == nil {
		t.Fatal("viewer rolled back")
	}
	if _, err = svc.ManageAdminVisualEngine(viewer, "uninstall", false); err == nil {
		t.Fatal("viewer managed lifecycle")
	}
	if _, err = svc.SetPluginPlatformAvailability(viewer, visualengine.PluginID, false); err == nil {
		t.Fatal("host route bypassed lifecycle permission")
	}
	state, err := svc.ManageAdminVisualEngine(owner, "update", true)
	if err != nil || state.Version != visualengine.BundledVersion {
		t.Fatalf("update failed: %v", err)
	}
	before, _ := svc.PublicVisualEngineBundle()
	state, err = svc.ManageAdminVisualEngine(owner, "uninstall", true)
	if err != nil || state.Installed {
		t.Fatalf("uninstall failed: %v", err)
	}
	disabled, _ := svc.PublicVisualEngineBundle()
	if disabled.Enabled {
		t.Fatal("uninstalled plugin remains available")
	}
	if _, err = svc.SetPluginPlatformAvailability(owner, visualengine.PluginID, true); err == nil {
		t.Fatal("activated uninstalled plugin")
	}
	if _, err = svc.ManageAdminVisualEngine(owner, "install", true); err != nil {
		t.Fatal(err)
	}
	after, _ := svc.PublicVisualEngineBundle()
	if !after.Enabled || after.Config.PublishedVersion != before.Config.PublishedVersion {
		t.Fatal("reinstall did not preserve config")
	}
	if _, err = svc.ManageAdminVisualEngine(owner, "uninstall", false); err != nil {
		t.Fatal(err)
	}
	setting, err := svc.repo.SystemSettingOptional(visualengine.ConfigSettingKey)
	if err != nil || setting != nil {
		t.Fatal("uninstall did not clear plugin config")
	}
	var users int64
	db.Model(&model.User{}).Count(&users)
	if users != 2 {
		t.Fatal("lifecycle affected host users")
	}
	if err = svc.SaveAdminVisualEnginePermissions(owner, visualengine.PermissionPolicy{Grants: map[string][]string{owner.ID: {"view"}}}); err == nil {
		t.Fatal("owner locked itself out")
	}
}

package app

import (
	"testing"

	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
	visualengine "yingce/backend/internal/supdance/visualengine"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestSupDanceVisualEngineConfigLifecycleAndRollback(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+newID()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.PluginPlatformState{}, &model.UserPluginState{}, &model.SystemSetting{}, &model.AdminAuditEvent{}); err != nil {
		t.Fatal(err)
	}
	svc := &Service{repo: repository.New(db)}
	user := &model.User{ID: "user-1", Role: model.UserRoleUser}
	admin := &model.User{ID: "admin-1", Role: model.UserRoleAdmin, Username: "root"}

	// 1. Default plugin state is available and serves the built-in dark/light token sets.
	available, err := svc.VisualEnginePluginAvailable()
	if err != nil {
		t.Fatal(err)
	}
	if !available {
		t.Fatal("expected supdance-visual-engine to be platform-available by default")
	}

	bundle, err := svc.PublicVisualEngineBundle()
	if err != nil {
		t.Fatal(err)
	}
	if bundle.PluginID != PluginSupDanceVisualEngine || !bundle.Enabled {
		t.Fatalf("unexpected public bundle: %#v", bundle)
	}
	if len(bundle.Config.Tokens["dark"].Primary) == 0 || len(bundle.Config.Tokens["light"].Primary) == 0 {
		t.Fatalf("expected built-in dark and light semantic tokens, got %#v", bundle.Config.Tokens)
	}
	if bundle.Revision == "" {
		t.Fatal("expected a non-empty config revision")
	}

	// 2. Ordinary users cannot read or mutate the admin visual engine config.
	if _, err := svc.AdminVisualEngineOverview(user); err == nil {
		t.Fatal("ordinary user accessed admin visual engine overview")
	}
	if _, err := svc.PublishAdminVisualEngine(user, bundle.Config, "unauthorized"); err == nil {
		t.Fatal("ordinary user published visual engine config")
	}
	if _, err := svc.RollbackAdminVisualEngine(user, "1.0.0"); err == nil {
		t.Fatal("ordinary user rolled back visual engine config")
	}

	// 3. Admin publishes a new config; a snapshot is recorded and cache invalidated.
	nextConfig := bundle.Config
	nextConfig.PublishedVersion = "2.1.0"
	nextConfig.ThemeMode = "light"
	nextConfig.Tokens["light"] = func() visualengine.SemanticTokens {
		tokens := nextConfig.Tokens["light"]
		tokens.Primary = "#1677ff"
		return tokens
	}()
	overview, err := svc.PublishAdminVisualEngine(admin, nextConfig, "切换默认浅色主题并更新品牌主色")
	if err != nil {
		t.Fatal(err)
	}
	if overview.Bundle.Config.PublishedVersion != "2.1.0" || overview.Bundle.Config.ThemeMode != "light" {
		t.Fatalf("unexpected published config: %#v", overview.Bundle.Config)
	}
	if overview.Bundle.Config.Tokens["light"].Primary != "#1677ff" {
		t.Fatalf("expected updated light primary token, got %s", overview.Bundle.Config.Tokens["light"].Primary)
	}
	if overview.Bundle.Config.UpdatedBy != "root" {
		t.Fatalf("expected updatedBy=root, got %s", overview.Bundle.Config.UpdatedBy)
	}
	if len(overview.Snapshots) != 1 || overview.Snapshots[0].Version != "2.1.0" {
		t.Fatalf("expected one snapshot for v2.1.0, got %#v", overview.Snapshots)
	}
	if !overview.CanRollback {
		t.Fatal("expected rollback to be available after the first publish")
	}

	// 4. Cache invalidation means a fresh public bundle immediately reflects the publish.
	refreshed, err := svc.PublicVisualEngineBundle()
	if err != nil {
		t.Fatal(err)
	}
	if refreshed.Config.PublishedVersion != "2.1.0" || refreshed.Revision == bundle.Revision {
		t.Fatalf("expected refreshed bundle for v2.1.0 with a new revision, got %#v", refreshed)
	}

	// 5. Rollback restores the previous stable snapshot content as a new publish.
	restored, err := svc.RollbackAdminVisualEngine(admin, "2.1.0")
	if err != nil {
		t.Fatal(err)
	}
	if restored.Bundle.Config.PublishedVersion != "2.1.0" {
		t.Fatalf("expected rollback to publish v2.1.0 content, got %#v", restored.Bundle.Config)
	}
	if len(restored.Snapshots) != 2 {
		t.Fatalf("expected rollback to append a new snapshot, got %#v", restored.Snapshots)
	}

	// 6. Rolling back to an unknown version fails without mutating the current config.
	if _, err := svc.RollbackAdminVisualEngine(admin, "9.9.9"); err == nil {
		t.Fatal("rollback to an unknown version succeeded")
	}
	after, err := svc.PublicVisualEngineBundle()
	if err != nil {
		t.Fatal(err)
	}
	if after.Config.PublishedVersion != "2.1.0" {
		t.Fatalf("failed rollback mutated the active config: %#v", after.Config)
	}
}

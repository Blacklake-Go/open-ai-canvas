package music_test

import (
	"context"
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"yingce/backend/internal/model"
	"yingce/backend/internal/supdance/adapters"
	"yingce/backend/internal/supdance/domain"
	"yingce/backend/internal/supdance/music"
)

func setupTestDB(t *testing.T) (*gorm.DB, music.Repository) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite in-memory db: %v", err)
	}

	repo := music.NewRepository(db)
	if err := repo.AutoMigrate(context.Background()); err != nil {
		t.Fatalf("failed to auto-migrate music repository: %v", err)
	}

	// Also migrate platform states and resources to verify retention
	if err := db.AutoMigrate(&model.PluginPlatformState{}, &model.UserPluginState{}, &model.Resource{}); err != nil {
		t.Fatalf("failed to auto-migrate host models: %v", err)
	}

	return db, repo
}

func TestMusicDomainIsolation(t *testing.T) {
	// 1. Validate Plugin ID Prefix Rule
	if err := domain.ValidateCustomPluginID("supdance-music-generation"); err != nil {
		t.Fatalf("expected valid plugin ID, got: %v", err)
	}
	if err := domain.ValidateCustomPluginID("music-generation"); err == nil {
		t.Fatal("expected error for plugin ID missing supdance- prefix")
	}

	// 2. Validate Table Name Prefix Rule
	if err := domain.ValidateCustomTableName("supdance_music_generations"); err != nil {
		t.Fatalf("expected valid table name, got: %v", err)
	}
	if err := domain.ValidateCustomTableName("music_generations"); err == nil {
		t.Fatal("expected error for table name missing supdance_ prefix")
	}

	// 3. Validate API Route Prefix Rule
	if err := domain.ValidateCustomAPIRoute("/api/v1/supdance/music/tasks"); err != nil {
		t.Fatalf("expected valid api route, got: %v", err)
	}
	if err := domain.ValidateCustomAPIRoute("/api/music/tasks"); err == nil {
		t.Fatal("expected error for route missing /api/v1/supdance/ prefix")
	}

	// 4. Validate Manifest Compatibility Check
	upstreamIDs := map[string]struct{}{"prompt-optimizer": {}}
	if err := adapters.CheckPluginManifestCompatibility("supdance-music-generation", "yingce.plugin/v2", upstreamIDs); err != nil {
		t.Fatalf("expected compatible manifest, got: %v", err)
	}
}

func TestMusicRepositoryCRUDAndDrainingQueries(t *testing.T) {
	ctx := context.Background()
	_, repo := setupTestDB(t)

	// 1. Create a task in submitted status
	gen := &music.SupDanceMusicGeneration{
		ID:                    "gen_test_001",
		UserID:                "user_100",
		TaskID:                "task_001",
		Model:                 "suno-v6",
		Mode:                  "custom",
		Prompt:                "Electronic synth wave track",
		Title:                 "Neon Highway",
		Lyrics:                "[Verse 1]\nFast cars and bright neon lights",
		Status:                music.StatusSubmitted,
		Stage:                 "submitted",
		DurationTargetSeconds: 180,
		CreatedAt:             time.Now().UTC(),
		UpdatedAt:             time.Now().UTC(),
	}

	if err := repo.Create(ctx, gen); err != nil {
		t.Fatalf("failed to create music generation: %v", err)
	}

	// Verify retrieval by ID and by TaskID
	byID, err := repo.GetByID(ctx, "gen_test_001")
	if err != nil || byID == nil {
		t.Fatalf("failed to get by ID: %v", err)
	}
	if byID.Title != "Neon Highway" {
		t.Fatalf("unexpected title: %s", byID.Title)
	}

	byTaskID, err := repo.GetByTaskID(ctx, "task_001")
	if err != nil || byTaskID == nil {
		t.Fatalf("failed to get by TaskID: %v", err)
	}

	// Check TableName satisfies supdance_ prefix
	if byID.TableName() != "supdance_music_generations" {
		t.Fatalf("expected table name supdance_music_generations, got %s", byID.TableName())
	}

	// 2. Test Active Task Count (gen_test_001 is in StatusSubmitted -> active)
	count, err := repo.ActiveMusicTaskCount(ctx)
	if err != nil {
		t.Fatalf("failed to count active tasks: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 active task, got %d", count)
	}

	// Update progress to generating
	if err := repo.UpdateProgress(ctx, "gen_test_001", music.StatusGenerating, "generating"); err != nil {
		t.Fatalf("failed to update progress: %v", err)
	}
	byID, _ = repo.GetByID(ctx, "gen_test_001")
	if byID.Status != music.StatusGenerating || byID.Stage != "generating" {
		t.Fatalf("expected generating status, got %s, %s", byID.Status, byID.Stage)
	}

	// Complete successfully
	if err := repo.CompleteSuccess(ctx, "gen_test_001", "https://oss.example.com/audio/neon.mp3", 180000, "res_audio_001"); err != nil {
		t.Fatalf("failed to complete success: %v", err)
	}

	byID, _ = repo.GetByID(ctx, "gen_test_001")
	if byID.Status != music.StatusCompleted || byID.ResultAudioURL != "https://oss.example.com/audio/neon.mp3" {
		t.Fatalf("expected completed status with audio URL, got %+v", byID)
	}

	// Now active count should be 0
	count, err = repo.ActiveMusicTaskCount(ctx)
	if err != nil || count != 0 {
		t.Fatalf("expected 0 active tasks after completion, got %d (err: %v)", count, err)
	}

	// 3. User Listing query
	list, total, err := repo.ListByUserID(ctx, "user_100", 0, 10)
	if err != nil || total != 1 || len(list) != 1 {
		t.Fatalf("expected 1 user item, got total=%d, len=%d, err=%v", total, len(list), err)
	}
}

func TestUserAssetAndHistoryRetentionOnUninstall(t *testing.T) {
	ctx := context.Background()
	db, repo := setupTestDB(t)

	// 1. Insert generation and resource data
	mockGen := &music.SupDanceMusicGeneration{
		ID:               "gen_perm_001",
		UserID:           "user_vip",
		TaskID:           "task_perm_001",
		Model:            "mureka-9.5",
		Prompt:           "Permanent history prompt",
		Status:           music.StatusCompleted,
		Stage:            "completed",
		ResultAudioURL:   "https://oss.example.com/audio/permanent.flac",
		ResultDurationMs: 240000,
		ResourceID:       "res_perm_001",
		CreatedAt:        time.Now().UTC(),
		UpdatedAt:        time.Now().UTC(),
	}
	if err := repo.Create(ctx, mockGen); err != nil {
		t.Fatalf("failed to create music generation: %v", err)
	}

	mockRes := &model.Resource{
		ID:        "res_perm_001",
		Kind:      "audio",
		Status:    "ready",
		PublicURL: "https://oss.example.com/audio/permanent.flac",
	}
	if err := db.Create(mockRes).Error; err != nil {
		t.Fatalf("failed to create resource: %v", err)
	}

	// Create plugin platform and user states
	platState := &model.PluginPlatformState{
		PluginID:  "supdance-music-generation",
		Available: true,
	}
	if err := db.Create(platState).Error; err != nil {
		t.Fatalf("failed to create platform state: %v", err)
	}

	userState := &model.UserPluginState{
		UserID:   "user_vip",
		PluginID: "supdance-music-generation",
		Enabled:  true,
	}
	if err := db.Create(userState).Error; err != nil {
		t.Fatalf("failed to create user state: %v", err)
	}

	// 2. Perform Uninstall action (simulating deleting state tables only)
	if err := db.Delete(&model.PluginPlatformState{}, "plugin_id = ?", "supdance-music-generation").Error; err != nil {
		t.Fatalf("failed to delete platform state: %v", err)
	}
	if err := db.Delete(&model.UserPluginState{}, "plugin_id = ?", "supdance-music-generation").Error; err != nil {
		t.Fatalf("failed to delete user state: %v", err)
	}

	// 3. Verify state rows are deleted
	var checkPlat model.PluginPlatformState
	if err := db.First(&checkPlat, "plugin_id = ?", "supdance-music-generation").Error; err != gorm.ErrRecordNotFound {
		t.Fatalf("expected platform state deleted, got err: %v", err)
	}

	// 4. CRITICAL: Verify supdance_music_generations and model.Resource are 100% INTACT!
	retainedGen, err := repo.GetByID(ctx, "gen_perm_001")
	if err != nil || retainedGen == nil {
		t.Fatalf("CRITICAL FAILURE: user music history was deleted or corrupted on uninstall! err: %v", err)
	}
	if retainedGen.ResultAudioURL != mockGen.ResultAudioURL {
		t.Fatalf("data mismatch in retained music generation: got %s, want %s", retainedGen.ResultAudioURL, mockGen.ResultAudioURL)
	}

	var retainedRes model.Resource
	if err := db.First(&retainedRes, "id = ?", "res_perm_001").Error; err != nil {
		t.Fatalf("CRITICAL FAILURE: media resource was deleted on uninstall! err: %v", err)
	}
	if retainedRes.PublicURL != mockRes.PublicURL {
		t.Fatalf("data mismatch in retained resource: got %s, want %s", retainedRes.PublicURL, mockRes.PublicURL)
	}
}

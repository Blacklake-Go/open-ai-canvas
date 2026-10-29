package app

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"yingce/backend/internal/model"
	"yingce/backend/internal/supdance/domain"
	"yingce/backend/internal/supdance/music"
)

// TestChallenger2_AssetAndHistoryRetentionAcrossAllLifecycleStates verifies that
// transitioning through ALL lifecycle states—specifically including error, disabled,
// and uninstalled—never deletes or mutates records in supdance_music_generations or model.Resource.
func TestChallenger2_AssetAndHistoryRetentionAcrossAllLifecycleStates(t *testing.T) {
	svc, db := setupMusicTestService(t)
	admin := &model.User{ID: "adm_challenger_2", Role: model.UserRoleAdmin}
	user := &model.User{ID: "usr_challenger_2", Role: model.UserRoleUser}
	musicRepo := music.NewRepository(db)
	ctx := context.Background()

	// 1. Seed diverse generation tasks across all possible statuses
	allStatuses := []struct {
		status music.MusicGenerationStatus
		stage  string
		hasRes bool
	}{
		{music.StatusSubmitted, "submitted", false},
		{music.StatusQueued, "queued", false},
		{music.StatusGenerating, "generating", false},
		{music.StatusTranscoding, "transcoding", false},
		{music.StatusCompleted, "completed", true},
		{music.StatusFailed, "failed", false},
		{music.StatusCancelled, "cancelled", false},
	}

	var seededGenIDs []string
	var seededResIDs []string

	for i, s := range allStatuses {
		genID := fmt.Sprintf("ch2_gen_%d", i)
		taskID := fmt.Sprintf("ch2_task_%d", i)
		resID := fmt.Sprintf("ch2_res_%d", i)
		audioURL := ""
		if s.hasRes {
			audioURL = fmt.Sprintf("https://oss.example.com/audio/ch2_%d.mp3", i)
		}

		gen := &music.SupDanceMusicGeneration{
			ID:                    genID,
			UserID:                user.ID,
			TaskID:                taskID,
			Model:                 "mureka-9.5",
			Mode:                  "custom",
			Prompt:                fmt.Sprintf("Prompt for task %s", genID),
			Title:                 fmt.Sprintf("Song Title %d", i),
			Lyrics:                "[Verse 1]\nLyrics here",
			Status:                s.status,
			Stage:                 s.stage,
			DurationTargetSeconds: 180,
			ResultAudioURL:        audioURL,
			ResultDurationMs:      180000,
			ResourceID:            resID,
			CreatedAt:             time.Now().UTC().Add(-time.Duration(i) * time.Minute),
			UpdatedAt:             time.Now().UTC(),
		}

		if err := musicRepo.Create(ctx, gen); err != nil {
			t.Fatalf("failed to seed music generation %s: %v", genID, err)
		}
		seededGenIDs = append(seededGenIDs, genID)

		if s.hasRes {
			res := &model.Resource{
				ID:        resID,
				Kind:      "audio",
				Status:    "ready",
				PublicURL: audioURL,
			}
			if err := db.Create(res).Error; err != nil {
				t.Fatalf("failed to seed resource %s: %v", resID, err)
			}
			seededResIDs = append(seededResIDs, resID)
		}
	}

	assertAssetsIntact := func(stageName string) {
		// Check total count in supdance_music_generations
		var count int64
		if err := db.Model(&music.SupDanceMusicGeneration{}).Count(&count).Error; err != nil {
			t.Fatalf("[%s] failed to count generations: %v", stageName, err)
		}
		if count != int64(len(seededGenIDs)) {
			t.Fatalf("[%s] CRITICAL BUG: expected %d generations in table, found %d", stageName, len(seededGenIDs), count)
		}

		// Check each generation record individually
		for _, gID := range seededGenIDs {
			g, err := musicRepo.GetByID(ctx, gID)
			if err != nil || g == nil {
				t.Fatalf("[%s] CRITICAL BUG: generation %s missing or corrupt: %v", stageName, gID, err)
			}
			if g.UserID != user.ID {
				t.Fatalf("[%s] generation %s UserID corrupted: got %s, want %s", stageName, gID, g.UserID, user.ID)
			}
		}

		// Check each resource record individually
		for _, rID := range seededResIDs {
			var r model.Resource
			if err := db.First(&r, "id = ?", rID).Error; err != nil {
				t.Fatalf("[%s] CRITICAL BUG: resource %s missing or corrupt: %v", stageName, rID, err)
			}
			if r.Kind != "audio" || !strings.Contains(r.PublicURL, "ch2_") {
				t.Fatalf("[%s] resource %s corrupted: %+v", stageName, rID, r)
			}
		}
	}

	// Baseline check: All items present
	assertAssetsIntact("Baseline Initial")

	// --- Transition 1: Transition to Error state ---
	// Start in enabled state
	ResetMusicLifecycleManagerForTest(MusicLifecycleEnabled)
	_ = svc.repo.SavePluginPlatformState(&model.PluginPlatformState{
		PluginID:  PluginSupDanceMusicGeneration,
		Available: true,
	})

	info, err := svc.SetMusicPluginLifecycle(admin, MusicLifecycleError)
	if err != nil {
		t.Fatalf("failed to transition to error: %v", err)
	}
	if info.State != MusicLifecycleError {
		t.Fatalf("expected state %s, got %s", MusicLifecycleError, info.State)
	}

	// Admission must be blocked in error state
	admissionErr := svc.CheckMusicTaskAdmission(user.ID)
	if admissionErr == nil {
		t.Fatal("expected admission rejection in error state")
	}
	appErr, ok := admissionErr.(*AppError)
	if !ok || appErr.Status != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden in error state, got: %+v", admissionErr)
	}
	if !strings.Contains(appErr.Message, "处于异常状态") {
		t.Fatalf("expected error message mentioning abnormal/error state, got: %s", appErr.Message)
	}

	// Empirical check: All generations and resources must be 100% intact after error transition
	assertAssetsIntact("After Transition to Error")

	// --- Transition 2: Recovery from Error to Disabled state ---
	info, err = svc.SetMusicPluginLifecycle(admin, MusicLifecycleDisabled)
	if err != nil {
		t.Fatalf("failed to transition from error to disabled: %v", err)
	}
	if info.State != MusicLifecycleDisabled {
		t.Fatalf("expected state %s, got %s", MusicLifecycleDisabled, info.State)
	}

	// Admission must be blocked in disabled state
	admissionErr = svc.CheckMusicTaskAdmission(user.ID)
	if admissionErr == nil {
		t.Fatal("expected admission rejection in disabled state")
	}
	appErr, ok = admissionErr.(*AppError)
	if !ok || appErr.Status != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden in disabled state, got: %+v", admissionErr)
	}

	// Empirical check: All generations and resources must be 100% intact after disabled transition
	assertAssetsIntact("After Transition to Disabled")

	// --- Transition 3: Transition from Disabled to Uninstalled state ---
	info, err = svc.SetMusicPluginLifecycle(admin, MusicLifecycleUninstalled)
	if err != nil {
		t.Fatalf("failed to transition to uninstalled: %v", err)
	}
	if info.State != MusicLifecycleUninstalled {
		t.Fatalf("expected state %s, got %s", MusicLifecycleUninstalled, info.State)
	}

	// Verify plugin platform state was removed from DB
	platState, err := svc.repo.PluginPlatformState(PluginSupDanceMusicGeneration)
	if err != nil {
		t.Fatalf("unexpected error reading platform state: %v", err)
	}
	if platState != nil {
		t.Fatalf("expected platform state to be deleted on uninstall, found: %+v", platState)
	}

	// Empirical check: CRITICAL assertion that supdance_music_generations and model.Resource are STILL INTACT!
	assertAssetsIntact("After Transition to Uninstalled")

	// --- Transition 4: Re-install to Installed and re-enable to Enabled ---
	info, err = svc.SetMusicPluginLifecycle(admin, MusicLifecycleInstalled)
	if err != nil {
		t.Fatalf("failed to transition from uninstalled to installed: %v", err)
	}
	if info.State != MusicLifecycleInstalled {
		t.Fatalf("expected state %s, got %s", MusicLifecycleInstalled, info.State)
	}

	info, err = svc.SetMusicPluginLifecycle(admin, MusicLifecycleEnabled)
	if err != nil {
		t.Fatalf("failed to transition from installed to enabled: %v", err)
	}
	if info.State != MusicLifecycleEnabled {
		t.Fatalf("expected state %s, got %s", MusicLifecycleEnabled, info.State)
	}

	// Verify user listing returns all items cleanly
	list, total, err := musicRepo.ListByUserID(ctx, user.ID, 0, 50)
	if err != nil {
		t.Fatalf("failed to list user generations after re-enable: %v", err)
	}
	if total != int64(len(seededGenIDs)) || len(list) != len(seededGenIDs) {
		t.Fatalf("expected %d user records after re-enable, got total=%d, len=%d", len(seededGenIDs), total, len(list))
	}

	// Final verification
	assertAssetsIntact("Final Restored State")
}

// TestChallenger2_TableNamespaceAdversarialIsolation rigorously stress-tests
// table name prefix enforcement and domain.ValidateCustomTableName against
// SQL injection attempts, malformed inputs, casing, and core table shadowing.
func TestChallenger2_TableNamespaceAdversarialIsolation(t *testing.T) {
	// 1. Model TableName conformance
	modelTableName := music.SupDanceMusicGeneration{}.TableName()
	if modelTableName != "supdance_music_generations" {
		t.Fatalf("model TableName mismatch: got %q, want 'supdance_music_generations'", modelTableName)
	}
	if !strings.HasPrefix(modelTableName, domain.TableNamespacePrefix) {
		t.Fatalf("model TableName %q does not start with %q", modelTableName, domain.TableNamespacePrefix)
	}
	if err := domain.ValidateCustomTableName(modelTableName); err != nil {
		t.Fatalf("model TableName failed ValidateCustomTableName: %v", err)
	}

	// 2. Adversarial table names that MUST FAIL validation
	adversarialNames := []struct {
		name      string
		reason    string
		errSubstr string
	}{
		{"", "empty string", "table name cannot be empty"},
		{"   ", "whitespace only", "table name cannot be empty"},
		{"\n\t", "control characters", "table name cannot be empty"},
		{"users", "shadows core users table", "must start with prefix \"supdance_\""},
		{"tasks", "shadows core tasks table", "must start with prefix \"supdance_\""},
		{"resources", "shadows core resources table", "must start with prefix \"supdance_\""},
		{"billing_orders", "shadows core billing table", "must start with prefix \"supdance_\""},
		{"plugins", "shadows core plugins table", "must start with prefix \"supdance_\""},
		{"supdance", "missing trailing underscore", "must start with prefix \"supdance_\""},
		{"supdance-music", "hyphen instead of underscore", "must start with prefix \"supdance_\""},
		{"supdance_", "prefix only with empty body", "must have a name after prefix \"supdance_\""},
		{"  supdance_  ", "prefix only with surrounding spaces", "must have a name after prefix \"supdance_\""},
		{"prefix_supdance_table", "prefix not at start", "must start with prefix \"supdance_\""},
		{"mysupdance_table", "prefix preceded by other characters", "must start with prefix \"supdance_\""},
		{"supdance:table", "colon separator", "must start with prefix \"supdance_\""},
	}

	for _, tc := range adversarialNames {
		t.Run("Reject_"+tc.reason, func(t *testing.T) {
			err := domain.ValidateCustomTableName(tc.name)
			if err == nil {
				t.Fatalf("expected %q to be rejected (reason: %s)", tc.name, tc.reason)
			}
			if !strings.Contains(err.Error(), tc.errSubstr) {
				t.Fatalf("expected error containing %q, got: %v", tc.errSubstr, err)
			}
		})
	}

	// 3. Permitted variations that MUST PASS validation
	validVariations := []string{
		"supdance_music_generations",
		"supdance_music_stems",
		"supdance_audio_cache",
		"SUPDANCE_MUSIC_GENERATIONS",
		"  supdance_music_generations  ",
		"supdance_v2_music_tasks",
	}

	for _, name := range validVariations {
		t.Run("Accept_"+strings.TrimSpace(name), func(t *testing.T) {
			if err := domain.ValidateCustomTableName(name); err != nil {
				t.Fatalf("expected valid table name for %q, got: %v", name, err)
			}
		})
	}
}

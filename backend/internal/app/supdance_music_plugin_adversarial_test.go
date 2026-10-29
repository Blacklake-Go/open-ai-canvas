package app

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"yingce/backend/internal/kernel"
	"yingce/backend/internal/model"
	"yingce/backend/internal/supdance/domain"
	"yingce/backend/internal/supdance/music"
)

// TestAdversarialUserAssetPreservationMultiUserLifecycleCycles stress-tests that
// across multiple users, diverse generation statuses, and full lifecycle cycles
// (installed -> enabled -> disabled -> uninstalled -> installed -> enabled),
// not a single generation or resource is deleted or corrupted.
func TestAdversarialUserAssetPreservationMultiUserLifecycleCycles(t *testing.T) {
	svc, db := setupMusicTestService(t)
	admin := &model.User{ID: "adm_adversary", Role: model.UserRoleAdmin}
	musicRepo := music.NewRepository(db)
	ctx := context.Background()

	const userCount = 5
	const genPerUser = 10
	totalGens := userCount * genPerUser

	var expectedGenIDs []string
	var expectedResIDs []string

	// Seed multi-user data
	for u := 0; u < userCount; u++ {
		userID := fmt.Sprintf("usr_adversary_%d", u)
		for g := 0; g < genPerUser; g++ {
			genID := fmt.Sprintf("gen_%d_%d", u, g)
			taskID := fmt.Sprintf("task_%d_%d", u, g)
			resID := fmt.Sprintf("res_%d_%d", u, g)

			status := music.StatusCompleted
			stage := "completed"
			audioURL := fmt.Sprintf("https://oss.example.com/audio/%d_%d.mp3", u, g)
			if g%3 == 1 {
				status = music.StatusFailed
				stage = "failed"
				audioURL = ""
			} else if g%3 == 2 {
				status = music.StatusSubmitted
				stage = "submitted"
				audioURL = ""
			}

			gen := &music.SupDanceMusicGeneration{
				ID:                    genID,
				UserID:                userID,
				TaskID:                taskID,
				Model:                 "mureka-9.5",
				Mode:                  "custom",
				Prompt:                fmt.Sprintf("Prompt for %s", genID),
				Title:                 fmt.Sprintf("Title for %s", genID),
				Lyrics:                "[Verse 1]\nLyrics content",
				Status:                status,
				Stage:                 stage,
				DurationTargetSeconds: 180,
				ResultAudioURL:        audioURL,
				ResultDurationMs:      180000,
				ResourceID:            resID,
				CreatedAt:             time.Now().UTC(),
				UpdatedAt:             time.Now().UTC(),
			}
			if err := musicRepo.Create(ctx, gen); err != nil {
				t.Fatalf("failed to insert gen: %v", err)
			}
			expectedGenIDs = append(expectedGenIDs, genID)

			if audioURL != "" {
				res := &model.Resource{
					ID:        resID,
					Kind:      "audio",
					Status:    "ready",
					PublicURL: audioURL,
				}
				if err := db.Create(res).Error; err != nil {
					t.Fatalf("failed to insert res: %v", err)
				}
				expectedResIDs = append(expectedResIDs, resID)
			}
		}
	}

	// Verify initial counts
	var initialGenCount int64
	db.Model(&music.SupDanceMusicGeneration{}).Count(&initialGenCount)
	if initialGenCount != int64(totalGens) {
		t.Fatalf("expected %d initial generations, got %d", totalGens, initialGenCount)
	}

	// Cycle 1: Transition to disabled
	ResetMusicLifecycleManagerForTest(MusicLifecycleDisabled)

	// Cycle 2: Transition to uninstalled
	info, err := svc.SetMusicPluginLifecycle(admin, MusicLifecycleUninstalled)
	if err != nil {
		t.Fatalf("failed to set lifecycle to uninstalled: %v", err)
	}
	if info.State != MusicLifecycleUninstalled {
		t.Fatalf("expected state uninstalled, got %s", info.State)
	}

	// EMPIRICAL VERIFICATION: Generations and Resources must remain 100% intact
	var postUninstallGenCount int64
	db.Model(&music.SupDanceMusicGeneration{}).Count(&postUninstallGenCount)
	if postUninstallGenCount != int64(totalGens) {
		t.Fatalf("CRITICAL BUG: generation rows deleted on uninstall! expected %d, got %d", totalGens, postUninstallGenCount)
	}

	for _, genID := range expectedGenIDs {
		gen, err := musicRepo.GetByID(ctx, genID)
		if err != nil || gen == nil {
			t.Fatalf("CRITICAL BUG: generation %s lost on uninstall", genID)
		}
	}

	for _, resID := range expectedResIDs {
		var res model.Resource
		if err := db.First(&res, "id = ?", resID).Error; err != nil {
			t.Fatalf("CRITICAL BUG: resource %s lost on uninstall", resID)
		}
	}

	// Cycle 3: Re-install and re-enable
	_, err = svc.SetMusicPluginLifecycle(admin, MusicLifecycleInstalled)
	if err != nil {
		t.Fatalf("failed to re-install: %v", err)
	}
	_, err = svc.SetMusicPluginLifecycle(admin, MusicLifecycleEnabled)
	if err != nil {
		t.Fatalf("failed to re-enable: %v", err)
	}

	// Verify user queries still return all records
	for u := 0; u < userCount; u++ {
		userID := fmt.Sprintf("usr_adversary_%d", u)
		list, total, err := musicRepo.ListByUserID(ctx, userID, 0, 50)
		if err != nil || total != genPerUser || len(list) != genPerUser {
			t.Fatalf("user %s records corrupted after re-enable: total=%d, len=%d, err=%v", userID, total, len(list), err)
		}
	}
}

// TestAdversarialActiveTaskCounterConcurrency executes 500 concurrent tasks
// doing rapid increment and decrement to test thread safety and race conditions.
func TestAdversarialActiveTaskCounterConcurrency(t *testing.T) {
	svc, _ := setupMusicTestService(t)
	ResetMusicLifecycleManagerForTest(MusicLifecycleEnabled)

	const concurrency = 500
	var wg sync.WaitGroup
	wg.Add(concurrency)

	for i := 0; i < concurrency; i++ {
		go func() {
			defer wg.Done()
			done := svc.TrackMusicTaskExecution()
			// Active count must be > 0 while in flight
			count := svc.ActiveMusicTaskCount()
			if count < 1 {
				t.Errorf("expected active tasks >= 1, got %d", count)
			}
			time.Sleep(time.Millisecond * 2)
			done()
		}()
	}

	wg.Wait()

	finalCount := svc.ActiveMusicTaskCount()
	if finalCount != 0 {
		t.Fatalf("expected final active task count 0, got %d", finalCount)
	}
}

// TestAdversarialDrainingRaceStuckState investigates the race condition where
// an active task finishes immediately after activeTasks is read in SetMusicPluginLifecycle.
func TestAdversarialDrainingRaceStuckState(t *testing.T) {
	svc, _ := setupMusicTestService(t)
	admin := &model.User{ID: "adm_race", Role: model.UserRoleAdmin}
	ResetMusicLifecycleManagerForTest(MusicLifecycleEnabled)

	// Simulate 1 task started
	done := svc.TrackMusicTaskExecution()
	if svc.ActiveMusicTaskCount() != 1 {
		t.Fatalf("expected 1 active task, got %d", svc.ActiveMusicTaskCount())
	}

	// Suppose the task finishes:
	done()

	// Task finished, active task count is now 0
	if svc.ActiveMusicTaskCount() != 0 {
		t.Fatalf("expected 0 active tasks, got %d", svc.ActiveMusicTaskCount())
	}

	// If admin now transitions to Draining with 0 active tasks:
	info, err := svc.SetMusicPluginLifecycle(admin, MusicLifecycleDraining)
	if err != nil {
		t.Fatalf("expected transition to succeed: %v", err)
	}

	// Implementation auto-converts to Disabled if activeTasks == 0
	if info.State != MusicLifecycleDisabled {
		t.Fatalf("expected state to be disabled when draining with 0 active tasks, got: %s", info.State)
	}
}

// TestAdversarialActiveTaskDoneIdempotency checks if calling done() twice causes negative active tasks.
func TestAdversarialActiveTaskDoneIdempotency(t *testing.T) {
	svc, _ := setupMusicTestService(t)
	ResetMusicLifecycleManagerForTest(MusicLifecycleEnabled)

	done := svc.TrackMusicTaskExecution()
	if svc.ActiveMusicTaskCount() != 1 {
		t.Fatalf("expected 1 active task, got %d", svc.ActiveMusicTaskCount())
	}

	done()
	if svc.ActiveMusicTaskCount() != 0 {
		t.Fatalf("expected 0 active tasks after first done(), got %d", svc.ActiveMusicTaskCount())
	}

	// Second invocation of done()
	done()
	countAfterSecondDone := svc.ActiveMusicTaskCount()
	if countAfterSecondDone != 0 {
		t.Fatalf("expected active task count to remain 0 after multiple done() calls, got: %d", countAfterSecondDone)
	}
}

// TestAdversarialLifecycleStateTransitionsMatrix exhaustively tests illegal state transitions
// across all 7x7 lifecycle state permutations, including edge cases with activeTasks > 0.
func TestAdversarialLifecycleStateTransitionsMatrix(t *testing.T) {
	allStates := []MusicPluginLifecycleState{
		MusicLifecycleInstalled,
		MusicLifecycleEnabled,
		MusicLifecycleDraining,
		MusicLifecycleDisabled,
		MusicLifecycleUpdating,
		MusicLifecycleError,
		MusicLifecycleUninstalled,
	}

	// 1. Same-state transitions must always succeed as no-ops
	for _, s := range allStates {
		if err := ValidateMusicLifecycleTransition(s, s, 0); err != nil {
			t.Errorf("expected no-op for %s -> %s, got: %v", s, s, err)
		}
		if err := ValidateMusicLifecycleTransition(s, s, 5); err != nil {
			t.Errorf("expected no-op for %s -> %s with activeTasks=5, got: %v", s, s, err)
		}
	}

	// 2. Specific illegal transitions requested by challenger mission:
	// 2a. draining -> disabled while activeTasks > 0 MUST FAIL with descriptive error
	err := ValidateMusicLifecycleTransition(MusicLifecycleDraining, MusicLifecycleDisabled, 3)
	if err == nil {
		t.Fatal("expected draining -> disabled to fail when activeTasks=3")
	}
	if !strings.Contains(err.Error(), "排空未完成") || !strings.Contains(err.Error(), "3") {
		t.Fatalf("expected descriptive error for draining->disabled with active tasks, got: %v", err)
	}

	// 2b. installed -> updating MUST FAIL
	err = ValidateMusicLifecycleTransition(MusicLifecycleInstalled, MusicLifecycleUpdating, 0)
	if err == nil {
		t.Fatal("expected installed -> updating to be rejected")
	}
	if !strings.Contains(err.Error(), "无效的生命周期状态跃迁") {
		t.Fatalf("expected invalid transition error, got: %v", err)
	}

	// 2c. uninstalled -> draining MUST FAIL
	err = ValidateMusicLifecycleTransition(MusicLifecycleUninstalled, MusicLifecycleDraining, 0)
	if err == nil {
		t.Fatal("expected uninstalled -> draining to be rejected")
	}
	if !strings.Contains(err.Error(), "无效的生命周期状态跃迁") {
		t.Fatalf("expected invalid transition error, got: %v", err)
	}

	// 3. Additional illegal transitions matrix
	illegalCases := []struct {
		from        MusicPluginLifecycleState
		to          MusicPluginLifecycleState
		activeTasks int64
		errSubstr   string
	}{
		// From installed
		{MusicLifecycleInstalled, MusicLifecycleDraining, 0, "无效的生命周期状态跃迁"},
		{MusicLifecycleInstalled, MusicLifecycleDisabled, 0, "无效的生命周期状态跃迁"},

		// From enabled
		{MusicLifecycleEnabled, MusicLifecycleDisabled, 2, "无法直接停用，请先进入排空模式"},
		{MusicLifecycleEnabled, MusicLifecycleInstalled, 0, "无效的生命周期状态跃迁"},
		{MusicLifecycleEnabled, MusicLifecycleUpdating, 0, "无效的生命周期状态跃迁"},
		{MusicLifecycleEnabled, MusicLifecycleUninstalled, 0, "无效的生命周期状态跃迁"},

		// From draining
		{MusicLifecycleDraining, MusicLifecycleInstalled, 0, "无效的生命周期状态跃迁"},
		{MusicLifecycleDraining, MusicLifecycleUpdating, 0, "无效的生命周期状态跃迁"},
		{MusicLifecycleDraining, MusicLifecycleUninstalled, 0, "无效的生命周期状态跃迁"},

		// From disabled
		{MusicLifecycleDisabled, MusicLifecycleInstalled, 0, "无效的生命周期状态跃迁"},
		{MusicLifecycleDisabled, MusicLifecycleDraining, 0, "无效的生命周期状态跃迁"},
		{MusicLifecycleDisabled, MusicLifecycleUpdating, 4, "无法进行升级"},
		{MusicLifecycleDisabled, MusicLifecycleUninstalled, 2, "无法卸载插件"},

		// From updating
		{MusicLifecycleUpdating, MusicLifecycleInstalled, 0, "无效的生命周期状态跃迁"},
		{MusicLifecycleUpdating, MusicLifecycleDraining, 0, "无效的生命周期状态跃迁"},
		{MusicLifecycleUpdating, MusicLifecycleUninstalled, 0, "无效的生命周期状态跃迁"},

		// From uninstalled
		{MusicLifecycleUninstalled, MusicLifecycleDisabled, 0, "无效的生命周期状态跃迁"},
		{MusicLifecycleUninstalled, MusicLifecycleUpdating, 0, "无效的生命周期状态跃迁"},

		// Unknown/bogus state
		{MusicPluginLifecycleState("corrupted"), MusicLifecycleEnabled, 0, "无效的生命周期状态跃迁"},
		{MusicLifecycleEnabled, MusicPluginLifecycleState("unknown"), 0, "无效的生命周期状态跃迁"},
	}

	for _, tc := range illegalCases {
		t.Run(fmt.Sprintf("%s->%s(tasks=%d)", tc.from, tc.to, tc.activeTasks), func(t *testing.T) {
			err := ValidateMusicLifecycleTransition(tc.from, tc.to, tc.activeTasks)
			if err == nil {
				t.Fatalf("expected error for transition %s -> %s with activeTasks=%d", tc.from, tc.to, tc.activeTasks)
			}
			if !strings.Contains(err.Error(), tc.errSubstr) {
				t.Fatalf("expected error containing %q, got %q", tc.errSubstr, err.Error())
			}
		})
	}
}

// TestAdversarialTaskAdmissionPreCreditDrainingRejections verifies that
// when IsMusicPluginDraining() == true or the plugin is disabled, CheckMusicTaskAdmission
// immediately rejects with 503 (or 403) before any downstream credit deduction or task creation.
func TestAdversarialTaskAdmissionPreCreditDrainingRejections(t *testing.T) {
	svc, _ := setupMusicTestService(t)
	user := &model.User{ID: "usr_drain_test", Role: model.UserRoleUser}
	admin := &model.User{ID: "adm_drain_test", Role: model.UserRoleAdmin}

	// 1. Initial enabled state: admission MUST pass
	ResetMusicLifecycleManagerForTest(MusicLifecycleEnabled)
	_ = svc.repo.SavePluginPlatformState(&model.PluginPlatformState{
		PluginID:  PluginSupDanceMusicGeneration,
		Available: true,
	})
	if err := svc.CheckMusicTaskAdmission(user.ID); err != nil {
		t.Fatalf("expected admission to succeed when enabled, got: %v", err)
	}

	// 2. Set plugin to draining state with 1 active task
	done := svc.TrackMusicTaskExecution()
	defer done()

	_, err := svc.SetMusicPluginLifecycle(admin, MusicLifecycleDraining)
	if err != nil {
		t.Fatalf("failed to transition to draining: %v", err)
	}
	if !svc.IsMusicPluginDraining() {
		t.Fatal("expected IsMusicPluginDraining() == true")
	}

	// EMPIRICAL CHECK: While draining, CheckMusicTaskAdmission MUST return HTTP 503
	// with kernel.ReasonUnavailable and Retryable = true BEFORE any credit reservation
	err = svc.CheckMusicTaskAdmission(user.ID)
	if err == nil {
		t.Fatal("expected CheckMusicTaskAdmission to reject during draining")
	}
	appErr, ok := err.(*AppError)
	if !ok {
		t.Fatalf("expected *AppError, got %T: %v", err, err)
	}
	if appErr.Status != http.StatusServiceUnavailable {
		t.Fatalf("expected HTTP status 503, got %d", appErr.Status)
	}
	if appErr.Code != 503 {
		t.Fatalf("expected code 503, got %d", appErr.Code)
	}
	if appErr.Reason != kernel.ReasonUnavailable {
		t.Fatalf("expected reason %s, got %s", kernel.ReasonUnavailable, appErr.Reason)
	}
	if !appErr.Retryable {
		t.Fatal("expected Retryable == true for draining 503 error")
	}
	if !strings.Contains(appErr.Message, "正在维护排空中") {
		t.Fatalf("expected message mentioning draining, got: %s", appErr.Message)
	}

	// 3. Disabled plugin platform: CheckMusicTaskAdmission MUST reject with Forbidden
	ResetMusicLifecycleManagerForTest(MusicLifecycleDisabled)
	_ = svc.repo.SavePluginPlatformState(&model.PluginPlatformState{
		PluginID:  PluginSupDanceMusicGeneration,
		Available: false,
	})
	err = svc.CheckMusicTaskAdmission(user.ID)
	if err == nil {
		t.Fatal("expected admission rejection when plugin disabled")
	}
	appErr, ok = err.(*AppError)
	if !ok || appErr.Status != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden when disabled, got: %+v", err)
	}

	// 4. User disabled plugin: CheckMusicTaskAdmission MUST reject with Forbidden
	ResetMusicLifecycleManagerForTest(MusicLifecycleEnabled)
	_ = svc.repo.SavePluginPlatformState(&model.PluginPlatformState{
		PluginID:  PluginSupDanceMusicGeneration,
		Available: true,
	})
	_, _ = svc.SetUserPluginEnabled(user, PluginSupDanceMusicGeneration, false)
	err = svc.CheckMusicTaskAdmission(user.ID)
	if err == nil {
		t.Fatal("expected admission rejection when user disabled plugin")
	}
	appErr, ok = err.(*AppError)
	if !ok || appErr.Status != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden when user disabled, got: %+v", err)
	}
}

// TestAdversarialTableNamingValidation tests that music.SupDanceMusicGeneration
// strictly adheres to the "supdance_" table prefix requirement.
func TestAdversarialTableNamingValidation(t *testing.T) {
	modelTableName := music.SupDanceMusicGeneration{}.TableName()
	if modelTableName != "supdance_music_generations" {
		t.Fatalf("expected SupDanceMusicGeneration TableName to be 'supdance_music_generations', got %q", modelTableName)
	}
	if !strings.HasPrefix(modelTableName, "supdance_") {
		t.Fatalf("table name %q violates supdance_ prefix isolation rule", modelTableName)
	}
	if err := domain.ValidateCustomTableName(modelTableName); err != nil {
		t.Fatalf("table name %q failed domain validation: %v", modelTableName, err)
	}
}


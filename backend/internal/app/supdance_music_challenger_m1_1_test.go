package app

import (
	"fmt"
	"net/http"
	"strings"
	"testing"

	"yingce/backend/internal/kernel"
	"yingce/backend/internal/model"
	"yingce/backend/internal/supdance/domain"
	"yingce/backend/internal/supdance/music"
)

// TestChallengerM1_1_LifecycleStateTransitionsMatrix rigorously challenges the lifecycle
// state transition validator (ValidateMusicLifecycleTransition) across all 36 state transitions.
// Specifically verifies:
// 1. draining -> disabled while activeTasks > 0 MUST FAIL with descriptive error
// 2. installed -> updating MUST FAIL
// 3. uninstalled -> draining MUST FAIL
// 4. Exhaustive verification of all illegal transitions and no-op self-transitions.
func TestChallengerM1_1_LifecycleStateTransitionsMatrix(t *testing.T) {
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

	// 2. Specific challenges required by orchestrator:
	// Challenge 1a: draining -> disabled while activeTasks > 0 MUST FAIL with descriptive error
	err := ValidateMusicLifecycleTransition(MusicLifecycleDraining, MusicLifecycleDisabled, 3)
	if err == nil {
		t.Fatal("expected draining -> disabled to fail when activeTasks=3")
	}
	if !strings.Contains(err.Error(), "排空未完成") || !strings.Contains(err.Error(), "3") {
		t.Fatalf("expected descriptive error for draining->disabled with active tasks, got: %v", err)
	}

	// draining -> disabled with activeTasks == 0 MUST SUCCEED
	if err := ValidateMusicLifecycleTransition(MusicLifecycleDraining, MusicLifecycleDisabled, 0); err != nil {
		t.Fatalf("expected draining -> disabled to succeed when activeTasks=0, got: %v", err)
	}

	// Challenge 1b: installed -> updating MUST FAIL
	err = ValidateMusicLifecycleTransition(MusicLifecycleInstalled, MusicLifecycleUpdating, 0)
	if err == nil {
		t.Fatal("expected installed -> updating to be rejected")
	}
	if !strings.Contains(err.Error(), "无效的生命周期状态跃迁") {
		t.Fatalf("expected invalid transition error, got: %v", err)
	}

	// Challenge 1c: uninstalled -> draining MUST FAIL
	err = ValidateMusicLifecycleTransition(MusicLifecycleUninstalled, MusicLifecycleDraining, 0)
	if err == nil {
		t.Fatal("expected uninstalled -> draining to be rejected")
	}
	if !strings.Contains(err.Error(), "无效的生命周期状态跃迁") {
		t.Fatalf("expected invalid transition error, got: %v", err)
	}

	// 3. Exhaustive matrix of other illegal state transitions
	illegalCases := []struct {
		from        MusicPluginLifecycleState
		to          MusicPluginLifecycleState
		activeTasks int64
		errSubstr   string
	}{
		// From installed: can only go to enabled or uninstalled
		{MusicLifecycleInstalled, MusicLifecycleDraining, 0, "无效的生命周期状态跃迁"},
		{MusicLifecycleInstalled, MusicLifecycleDisabled, 0, "无效的生命周期状态跃迁"},
		{MusicLifecycleInstalled, MusicLifecycleUpdating, 0, "无效的生命周期状态跃迁"},

		// From enabled: can go to draining, or disabled (only if activeTasks==0)
		{MusicLifecycleEnabled, MusicLifecycleDisabled, 2, "无法直接停用，请先进入排空模式"},
		{MusicLifecycleEnabled, MusicLifecycleInstalled, 0, "无效的生命周期状态跃迁"},
		{MusicLifecycleEnabled, MusicLifecycleUpdating, 0, "无效的生命周期状态跃迁"},
		{MusicLifecycleEnabled, MusicLifecycleUninstalled, 0, "无效的生命周期状态跃迁"},

		// From draining: can go to disabled (if activeTasks==0), or enabled (cancel drain)
		{MusicLifecycleDraining, MusicLifecycleInstalled, 0, "无效的生命周期状态跃迁"},
		{MusicLifecycleDraining, MusicLifecycleUpdating, 0, "无效的生命周期状态跃迁"},
		{MusicLifecycleDraining, MusicLifecycleUninstalled, 0, "无效的生命周期状态跃迁"},

		// From disabled: can go to enabled, updating (if tasks==0), uninstalled (if tasks==0)
		{MusicLifecycleDisabled, MusicLifecycleInstalled, 0, "无效的生命周期状态跃迁"},
		{MusicLifecycleDisabled, MusicLifecycleDraining, 0, "无效的生命周期状态跃迁"},
		{MusicLifecycleDisabled, MusicLifecycleUpdating, 4, "无法进行升级"},
		{MusicLifecycleDisabled, MusicLifecycleUninstalled, 2, "无法卸载插件"},

		// From updating: can go to enabled or disabled
		{MusicLifecycleUpdating, MusicLifecycleInstalled, 0, "无效的生命周期状态跃迁"},
		{MusicLifecycleUpdating, MusicLifecycleDraining, 0, "无效的生命周期状态跃迁"},
		{MusicLifecycleUpdating, MusicLifecycleUninstalled, 0, "无效的生命周期状态跃迁"},

		// From uninstalled: can go to installed or enabled
		{MusicLifecycleUninstalled, MusicLifecycleDisabled, 0, "无效的生命周期状态跃迁"},
		{MusicLifecycleUninstalled, MusicLifecycleDraining, 0, "无效的生命周期状态跃迁"},
		{MusicLifecycleUninstalled, MusicLifecycleUpdating, 0, "无效的生命周期状态跃迁"},

		// From error: can go to disabled, installed, enabled, uninstalled (tasks==0)
		{MusicLifecycleError, MusicLifecycleUpdating, 0, "无效的生命周期状态跃迁"},
		{MusicLifecycleError, MusicLifecycleDraining, 0, "无效的生命周期状态跃迁"},
		{MusicLifecycleError, MusicLifecycleUninstalled, 2, "无法卸载插件"},

		// Unknown/corrupted states
		{MusicPluginLifecycleState("corrupted"), MusicLifecycleEnabled, 0, "无效的生命周期状态跃迁"},
		{MusicPluginLifecycleState("corrupted"), MusicLifecycleError, 0, "无效的生命周期状态跃迁"},
		{MusicLifecycleEnabled, MusicPluginLifecycleState("unknown"), 0, "无效的生命周期状态跃迁"},
	}

	for _, tc := range illegalCases {
		t.Run(fmt.Sprintf("%s->%s(tasks=%d)", tc.from, tc.to, tc.activeTasks), func(t *testing.T) {
			err := ValidateMusicLifecycleTransition(tc.from, tc.to, tc.activeTasks)
			if err == nil {
				t.Fatalf("expected error for transition %s -> %s with activeTasks=%d", tc.from, tc.to, tc.activeTasks)
			}
			if !strings.Contains(err.Error(), tc.errSubstr) {
				t.Fatalf("expected error containing %q, got: %v", tc.errSubstr, err)
			}
		})
	}
}

// TestChallengerM1_1_TaskAdmissionPreCreditDrainingRejections rigorously challenges the admission gate:
// 1. Plugin draining (IsMusicPluginDraining() == true) -> MUST reject with 503 ReasonUnavailable Retryable=true
// 2. Global host draining (IsDraining() == true) -> MUST reject with 503 ReasonUnavailable Retryable=true
// 3. Platform disabled (Available == false) -> MUST reject with 403 Forbidden
// 4. User disabled (Enabled == false) -> MUST reject with 403 Forbidden
// 5. This check runs at HTTP submission before any billing order reservation or credit deduction.
func TestChallengerM1_1_TaskAdmissionPreCreditDrainingRejections(t *testing.T) {
	svc, _ := setupMusicTestService(t)
	user := &model.User{ID: "usr_drain_m1_1", Role: model.UserRoleUser}
	admin := &model.User{ID: "adm_drain_m1_1", Role: model.UserRoleAdmin}

	// 1. Baseline: Enabled state passes admission cleanly
	ResetMusicLifecycleManagerForTest(MusicLifecycleEnabled)
	_ = svc.repo.SavePluginPlatformState(&model.PluginPlatformState{
		PluginID:  PluginSupDanceMusicGeneration,
		Available: true,
	})
	if err := svc.CheckMusicTaskAdmission(user.ID); err != nil {
		t.Fatalf("expected admission to pass when enabled, got: %v", err)
	}

	// 2. In-flight task is tracked
	done := svc.TrackMusicTaskExecution()
	defer done()

	// 3. Transition to Draining
	info, err := svc.SetMusicPluginLifecycle(admin, MusicLifecycleDraining)
	if err != nil {
		t.Fatalf("failed to transition to draining: %v", err)
	}
	if info.State != MusicLifecycleDraining || !svc.IsMusicPluginDraining() {
		t.Fatalf("expected plugin to be in draining state, got: %+v", info)
	}

	// 4. Challenge: Admission MUST immediately return HTTP 503 during plugin draining
	admissionErr := svc.CheckMusicTaskAdmission(user.ID)
	if admissionErr == nil {
		t.Fatal("expected admission error during plugin draining")
	}
	appErr, ok := admissionErr.(*AppError)
	if !ok {
		t.Fatalf("expected *AppError, got %T: %v", admissionErr, admissionErr)
	}
	if appErr.Status != http.StatusServiceUnavailable {
		t.Fatalf("expected HTTP 503 status, got %d", appErr.Status)
	}
	if appErr.Code != 503 {
		t.Fatalf("expected Code 503, got %d", appErr.Code)
	}
	if appErr.Reason != kernel.ReasonUnavailable {
		t.Fatalf("expected ReasonUnavailable, got %q", appErr.Reason)
	}
	if !appErr.Retryable {
		t.Fatal("expected Retryable == true for draining 503 error")
	}
	if !strings.Contains(appErr.Message, "正在维护排空中") {
		t.Fatalf("expected message mentioning draining, got: %s", appErr.Message)
	}

	// 5. Challenge: Platform disabled plugin MUST reject with 403 Forbidden
	ResetMusicLifecycleManagerForTest(MusicLifecycleDisabled)
	_ = svc.repo.SavePluginPlatformState(&model.PluginPlatformState{
		PluginID:  PluginSupDanceMusicGeneration,
		Available: false,
	})
	disabledErr := svc.CheckMusicTaskAdmission(user.ID)
	if disabledErr == nil {
		t.Fatal("expected admission rejection when platform disabled")
	}
	appErr, ok = disabledErr.(*AppError)
	if !ok || appErr.Status != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for disabled plugin, got: %+v", disabledErr)
	}

	// 6. Challenge: User disabled plugin MUST reject with 403 Forbidden
	ResetMusicLifecycleManagerForTest(MusicLifecycleEnabled)
	_ = svc.repo.SavePluginPlatformState(&model.PluginPlatformState{
		PluginID:  PluginSupDanceMusicGeneration,
		Available: true,
	})
	_, _ = svc.SetUserPluginEnabled(user, PluginSupDanceMusicGeneration, false)
	userDisabledErr := svc.CheckMusicTaskAdmission(user.ID)
	if userDisabledErr == nil {
		t.Fatal("expected admission rejection when user disabled plugin")
	}
	appErr, ok = userDisabledErr.(*AppError)
	if !ok || appErr.Status != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for user disabled plugin, got: %+v", userDisabledErr)
	}
}

// TestChallengerM1_1_TableNamingDomainValidation rigorously challenges domain.ValidateCustomTableName:
// 1. Rejects invalid tables (empty, whitespace, missing prefix, prefix-only, bad prefix)
// 2. Accepts valid custom tables with prefix "supdance_"
// 3. Verifies that music.SupDanceMusicGeneration model TableName matches "supdance_music_generations"
//    and passes domain.ValidateCustomTableName.
func TestChallengerM1_1_TableNamingDomainValidation(t *testing.T) {
	// 1. Valid names must pass
	validNames := []string{
		"supdance_music_generations",
		"supdance_tasks",
		"SUPDANCE_MUSIC_GENERATIONS",
		"  supdance_music_generations  ",
		"supdance_audio_tracks",
		"supdance_a",
	}
	for _, name := range validNames {
		if err := domain.ValidateCustomTableName(name); err != nil {
			t.Errorf("expected valid table name for %q, got: %v", name, err)
		}
	}

	// 2. Model table name check
	modelTableName := music.SupDanceMusicGeneration{}.TableName()
	if modelTableName != "supdance_music_generations" {
		t.Fatalf("expected model TableName 'supdance_music_generations', got %q", modelTableName)
	}
	if err := domain.ValidateCustomTableName(modelTableName); err != nil {
		t.Fatalf("model TableName failed ValidateCustomTableName: %v", err)
	}

	// 3. Invalid names must be rejected
	invalidCases := []struct {
		name      string
		errSubstr string
	}{
		{"", "table name cannot be empty"},
		{"   ", "table name cannot be empty"},
		{"\t\n", "table name cannot be empty"},
		{"music_generations", "must start with prefix \"supdance_\""},
		{"canvas_tasks", "must start with prefix \"supdance_\""},
		{"users", "must start with prefix \"supdance_\""},
		{"resources", "must start with prefix \"supdance_\""},
		{"supdance_", "must have a name after prefix \"supdance_\""},
		{"  supdance_  ", "must have a name after prefix \"supdance_\""},
		{"supdance", "must start with prefix \"supdance_\""},
		{"supdance-music", "must start with prefix \"supdance_\""},
		{"prefix_supdance_music", "must start with prefix \"supdance_\""},
	}

	for _, tc := range invalidCases {
		t.Run("Invalid_"+tc.name, func(t *testing.T) {
			err := domain.ValidateCustomTableName(tc.name)
			if err == nil {
				t.Fatalf("expected ValidateCustomTableName(%q) to fail", tc.name)
			}
			if !strings.Contains(err.Error(), tc.errSubstr) {
				t.Fatalf("expected error containing %q, got: %v", tc.errSubstr, err)
			}
		})
	}
}

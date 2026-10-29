package app

import (
	"context"
	"net/http"
	"testing"
	"time"

	"yingce/backend/internal/kernel"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
	"yingce/backend/internal/supdance/music"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupMusicTestService(t *testing.T) (*Service, *gorm.DB) {
	db, err := gorm.Open(sqlite.Open("file:"+newID()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}

	if err := db.AutoMigrate(
		&model.PluginPlatformState{},
		&model.UserPluginState{},
		&model.SystemSetting{},
		&model.AdminAuditEvent{},
		&model.Resource{},
		&music.SupDanceMusicGeneration{},
	); err != nil {
		t.Fatal(err)
	}

	center, err := newPluginRuntime(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}

	svc := &Service{repo: repository.New(db), pluginRuntime: center}
	ResetMusicLifecycleManagerForTest(MusicLifecycleEnabled)
	return svc, db
}

func TestMusicPluginValidateLifecycleTransition(t *testing.T) {
	// 1. Same state is no-op
	if err := ValidateMusicLifecycleTransition(MusicLifecycleEnabled, MusicLifecycleEnabled, 0); err != nil {
		t.Fatalf("expected nil for same state transition, got: %v", err)
	}

	// 2. From installed
	if err := ValidateMusicLifecycleTransition(MusicLifecycleInstalled, MusicLifecycleEnabled, 0); err != nil {
		t.Fatalf("expected installed -> enabled OK, got: %v", err)
	}
	if err := ValidateMusicLifecycleTransition(MusicLifecycleInstalled, MusicLifecycleUninstalled, 0); err != nil {
		t.Fatalf("expected installed -> uninstalled OK, got: %v", err)
	}
	if err := ValidateMusicLifecycleTransition(MusicLifecycleInstalled, MusicLifecycleDraining, 0); err == nil {
		t.Fatal("expected installed -> draining to be invalid")
	}

	// 3. From enabled
	if err := ValidateMusicLifecycleTransition(MusicLifecycleEnabled, MusicLifecycleDraining, 2); err != nil {
		t.Fatalf("expected enabled -> draining OK even with active tasks, got: %v", err)
	}
	if err := ValidateMusicLifecycleTransition(MusicLifecycleEnabled, MusicLifecycleDisabled, 0); err != nil {
		t.Fatalf("expected enabled -> disabled OK when activeTasks=0, got: %v", err)
	}
	if err := ValidateMusicLifecycleTransition(MusicLifecycleEnabled, MusicLifecycleDisabled, 1); err == nil {
		t.Fatal("expected enabled -> disabled to fail when activeTasks > 0")
	}

	// 4. From draining
	if err := ValidateMusicLifecycleTransition(MusicLifecycleDraining, MusicLifecycleDisabled, 0); err != nil {
		t.Fatalf("expected draining -> disabled OK when activeTasks=0, got: %v", err)
	}
	if err := ValidateMusicLifecycleTransition(MusicLifecycleDraining, MusicLifecycleDisabled, 1); err == nil {
		t.Fatal("expected draining -> disabled to fail when activeTasks > 0")
	}
	if err := ValidateMusicLifecycleTransition(MusicLifecycleDraining, MusicLifecycleEnabled, 1); err != nil {
		t.Fatalf("expected draining -> enabled (cancel drain) OK, got: %v", err)
	}

	// 5. From disabled
	if err := ValidateMusicLifecycleTransition(MusicLifecycleDisabled, MusicLifecycleEnabled, 0); err != nil {
		t.Fatalf("expected disabled -> enabled OK, got: %v", err)
	}
	if err := ValidateMusicLifecycleTransition(MusicLifecycleDisabled, MusicLifecycleUpdating, 0); err != nil {
		t.Fatalf("expected disabled -> updating OK when activeTasks=0, got: %v", err)
	}
	if err := ValidateMusicLifecycleTransition(MusicLifecycleDisabled, MusicLifecycleUpdating, 1); err == nil {
		t.Fatal("expected disabled -> updating to fail when activeTasks > 0")
	}
	if err := ValidateMusicLifecycleTransition(MusicLifecycleDisabled, MusicLifecycleUninstalled, 0); err != nil {
		t.Fatalf("expected disabled -> uninstalled OK when activeTasks=0, got: %v", err)
	}
	if err := ValidateMusicLifecycleTransition(MusicLifecycleDisabled, MusicLifecycleUninstalled, 1); err == nil {
		t.Fatal("expected disabled -> uninstalled to fail when activeTasks > 0")
	}

	// 6. From updating
	if err := ValidateMusicLifecycleTransition(MusicLifecycleUpdating, MusicLifecycleEnabled, 0); err != nil {
		t.Fatalf("expected updating -> enabled OK, got: %v", err)
	}
	if err := ValidateMusicLifecycleTransition(MusicLifecycleUpdating, MusicLifecycleDisabled, 0); err != nil {
		t.Fatalf("expected updating -> disabled OK, got: %v", err)
	}

	// 7. To and From error state
	for _, st := range []MusicPluginLifecycleState{
		MusicLifecycleInstalled, MusicLifecycleEnabled, MusicLifecycleDraining,
		MusicLifecycleDisabled, MusicLifecycleUpdating, MusicLifecycleUninstalled,
	} {
		if err := ValidateMusicLifecycleTransition(st, MusicLifecycleError, 0); err != nil {
			t.Fatalf("expected %s -> error to be valid, got: %v", st, err)
		}
	}

	// From error recovery
	if err := ValidateMusicLifecycleTransition(MusicLifecycleError, MusicLifecycleDisabled, 0); err != nil {
		t.Fatalf("expected error -> disabled recovery OK, got: %v", err)
	}
	if err := ValidateMusicLifecycleTransition(MusicLifecycleError, MusicLifecycleInstalled, 0); err != nil {
		t.Fatalf("expected error -> installed recovery OK, got: %v", err)
	}
	if err := ValidateMusicLifecycleTransition(MusicLifecycleError, MusicLifecycleEnabled, 0); err != nil {
		t.Fatalf("expected error -> enabled recovery OK, got: %v", err)
	}
	if err := ValidateMusicLifecycleTransition(MusicLifecycleError, MusicLifecycleUninstalled, 0); err != nil {
		t.Fatalf("expected error -> uninstalled OK with 0 tasks, got: %v", err)
	}
	if err := ValidateMusicLifecycleTransition(MusicLifecycleError, MusicLifecycleUninstalled, 1); err == nil {
		t.Fatal("expected error -> uninstalled to fail with active tasks > 0")
	}
	if err := ValidateMusicLifecycleTransition(MusicLifecycleError, MusicLifecycleUpdating, 0); err == nil {
		t.Fatal("expected error -> updating to fail")
	}
	if err := ValidateMusicLifecycleTransition(MusicLifecycleError, MusicLifecycleDraining, 0); err == nil {
		t.Fatal("expected error -> draining to fail")
	}
}

func TestMusicPluginErrorStateAdmission(t *testing.T) {
	svc, _ := setupMusicTestService(t)
	user := &model.User{ID: "usr_error_test", Role: model.UserRoleUser}
	admin := &model.User{ID: "adm_error_test", Role: model.UserRoleAdmin}

	// Set plugin to error state
	info, err := svc.SetMusicPluginLifecycle(admin, MusicLifecycleError)
	if err != nil {
		t.Fatalf("failed to set lifecycle to error: %v", err)
	}
	if info.State != MusicLifecycleError {
		t.Fatalf("expected error state, got: %s", info.State)
	}

	// EffectiveEnabled must be false
	effective, err := svc.MusicPluginEffectiveEnabled(user.ID)
	if err != nil || effective {
		t.Fatalf("expected effective=false during error state, got: %v, err: %v", effective, err)
	}

	// CheckMusicTaskAdmission must be forbidden
	err = svc.CheckMusicTaskAdmission(user.ID)
	if err == nil {
		t.Fatal("expected admission rejection when plugin is in error state")
	}
	appErr, ok := err.(*AppError)
	if !ok || appErr.Status != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden during error state, got: %+v", err)
	}
}

func TestMusicPluginDualStateAndAdmission(t *testing.T) {
	svc, _ := setupMusicTestService(t)
	user := &model.User{ID: "usr_alice", Role: model.UserRoleUser}
	admin := &model.User{ID: "adm_bob", Role: model.UserRoleAdmin}

	// 1. Initial State: Unconfigured user gets userEnabled=true and effectiveEnabled=true
	states, err := svc.PluginStatesForUser(user)
	if err != nil {
		t.Fatalf("failed to query plugin states: %v", err)
	}
	state, ok := states[PluginSupDanceMusicGeneration]
	if !ok {
		t.Fatalf("expected plugin %s in user plugin states", PluginSupDanceMusicGeneration)
	}
	if !state.PlatformAvailable || !state.UserEnabled || !state.EffectiveEnabled {
		t.Fatalf("expected plugin to be enabled by default for user, got: %+v", state)
	}

	// Admission passes
	if err := svc.CheckMusicTaskAdmission(user.ID); err != nil {
		t.Fatalf("expected admission to pass, got: %v", err)
	}

	// 2. User disables plugin
	_, err = svc.SetUserPluginEnabled(user, PluginSupDanceMusicGeneration, false)
	if err != nil {
		t.Fatalf("failed to disable plugin for user: %v", err)
	}
	effective, err := svc.MusicPluginEffectiveEnabled(user.ID)
	if err != nil || effective {
		t.Fatalf("expected effective=false after user disables, got %v (err: %v)", effective, err)
	}

	err = svc.CheckMusicTaskAdmission(user.ID)
	if err == nil {
		t.Fatal("expected admission error when user has disabled the plugin")
	}

	// 3. User re-enables plugin
	_, err = svc.SetUserPluginEnabled(user, PluginSupDanceMusicGeneration, true)
	if err != nil {
		t.Fatalf("failed to re-enable plugin for user: %v", err)
	}
	if err := svc.CheckMusicTaskAdmission(user.ID); err != nil {
		t.Fatalf("expected admission to pass after re-enable, got: %v", err)
	}

	// 4. Admin disables plugin on platform level
	_, err = svc.SetPluginPlatformAvailability(admin, PluginSupDanceMusicGeneration, false)
	if err != nil {
		t.Fatalf("failed to set platform availability: %v", err)
	}

	available, err := svc.MusicPluginPlatformAvailable()
	if err != nil || available {
		t.Fatalf("expected platform available=false, got %v", available)
	}

	err = svc.CheckMusicTaskAdmission(user.ID)
	if err == nil {
		t.Fatal("expected admission error when platform disabled by admin")
	}
}

func TestMusicPluginTaskDrainingAndExecution(t *testing.T) {
	svc, _ := setupMusicTestService(t)
	user := &model.User{ID: "usr_carol", Role: model.UserRoleUser}
	admin := &model.User{ID: "adm_dave", Role: model.UserRoleAdmin}

	// Ensure enabled initially
	ResetMusicLifecycleManagerForTest(MusicLifecycleEnabled)
	_ = svc.repo.SavePluginPlatformState(&model.PluginPlatformState{
		PluginID:  PluginSupDanceMusicGeneration,
		Available: true,
	})

	// 1. Simulate in-flight task execution
	doneTask := svc.TrackMusicTaskExecution()
	if svc.ActiveMusicTaskCount() != 1 {
		t.Fatalf("expected 1 active task, got %d", svc.ActiveMusicTaskCount())
	}

	// 2. Admin sets lifecycle to draining
	info, err := svc.SetMusicPluginLifecycle(admin, MusicLifecycleDraining)
	if err != nil {
		t.Fatalf("failed to transition to draining: %v", err)
	}
	if info.State != MusicLifecycleDraining || !svc.IsMusicPluginDraining() {
		t.Fatalf("expected draining state, got: %+v", info)
	}

	// 3. Admission gate must reject new tasks with HTTP 503 and ReasonUnavailable during draining
	admissionErr := svc.CheckMusicTaskAdmission(user.ID)
	if admissionErr == nil {
		t.Fatal("expected admission error during draining")
	}
	appErr, ok := admissionErr.(*AppError)
	if !ok || appErr.Status != http.StatusServiceUnavailable || appErr.Reason != kernel.ReasonUnavailable || !appErr.Retryable {
		t.Fatalf("expected 503 retryable unavailable error, got: %+v", admissionErr)
	}

	// 4. In-flight task completes
	doneTask()
	if svc.ActiveMusicTaskCount() != 0 {
		t.Fatalf("expected 0 active tasks, got %d", svc.ActiveMusicTaskCount())
	}

	// Manager should have automatically dropped to disabled
	if svc.IsMusicPluginDraining() {
		t.Fatal("expected draining to be false after active tasks drained to 0")
	}
	currentInfo := svc.GetMusicPluginLifecycle()
	if currentInfo.State != MusicLifecycleDisabled {
		t.Fatalf("expected auto-transition to disabled, got: %s", currentInfo.State)
	}

	// 5. Admin lifecycle RBAC check: ordinary user cannot transition lifecycle
	_, err = svc.SetMusicPluginLifecycle(user, MusicLifecycleEnabled)
	if err == nil {
		t.Fatal("expected non-admin to be rejected from setting lifecycle")
	}
}

func TestMusicPluginUninstallPreservesGenerationsAndAssets(t *testing.T) {
	svc, db := setupMusicTestService(t)
	admin := &model.User{ID: "adm_eve", Role: model.UserRoleAdmin}
	musicRepo := music.NewRepository(db)

	// 1. Setup sample generation record and physical resource
	gen := &music.SupDanceMusicGeneration{
		ID:               "gen_retention_999",
		UserID:           "usr_alice",
		TaskID:           "task_retention_999",
		Model:            "mureka-9.5",
		Status:           music.StatusCompleted,
		Stage:            "completed",
		ResultAudioURL:   "https://oss.example.com/audio/retention.mp3",
		ResultDurationMs: 180000,
		ResourceID:       "res_audio_999",
		CreatedAt:        time.Now().UTC(),
		UpdatedAt:        time.Now().UTC(),
	}
	if err := musicRepo.Create(context.Background(), gen); err != nil {
		t.Fatalf("failed to insert generation record: %v", err)
	}

	res := &model.Resource{
		ID:        "res_audio_999",
		Kind:      "audio",
		Status:    "ready",
		PublicURL: "https://oss.example.com/audio/retention.mp3",
	}
	if err := db.Create(res).Error; err != nil {
		t.Fatalf("failed to insert resource record: %v", err)
	}

	// Ensure plugin is in disabled state before uninstall
	ResetMusicLifecycleManagerForTest(MusicLifecycleDisabled)

	// 2. Admin uninstalls the plugin
	info, err := svc.SetMusicPluginLifecycle(admin, MusicLifecycleUninstalled)
	if err != nil {
		t.Fatalf("failed to uninstall plugin: %v", err)
	}
	if info.State != MusicLifecycleUninstalled {
		t.Fatalf("expected uninstalled state, got: %s", info.State)
	}

	// 3. Verify platform and user states were purged
	var platState model.PluginPlatformState
	err = db.First(&platState, "plugin_id = ?", PluginSupDanceMusicGeneration).Error
	if err != gorm.ErrRecordNotFound {
		t.Fatalf("expected platform state to be deleted, got err: %v", err)
	}

	// 4. CRITICAL INVARIANT: Generation record and Resource record must be 100% retained
	retainedGen, err := musicRepo.GetByID(context.Background(), "gen_retention_999")
	if err != nil || retainedGen == nil {
		t.Fatalf("CRITICAL: user generation history was purged during uninstall! err: %v", err)
	}
	if retainedGen.ResultAudioURL != gen.ResultAudioURL {
		t.Fatalf("mismatch in retained generation audio URL: got %s, want %s", retainedGen.ResultAudioURL, gen.ResultAudioURL)
	}

	var retainedRes model.Resource
	if err := db.First(&retainedRes, "id = ?", "res_audio_999").Error; err != nil {
		t.Fatalf("CRITICAL: media resource asset was purged during uninstall! err: %v", err)
	}
	if retainedRes.PublicURL != res.PublicURL {
		t.Fatalf("mismatch in retained resource public URL: got %s, want %s", retainedRes.PublicURL, res.PublicURL)
	}
}

func TestMusicPluginLifecycleStatePersistenceAcrossRestart(t *testing.T) {
	svc, _ := setupMusicTestService(t)
	admin := &model.User{ID: "admin_restart_test", Role: model.UserRoleAdmin}
	user := &model.User{ID: "user_restart_test", Role: model.UserRoleUser}

	// 1. Admin sets lifecycle to disabled
	info, err := svc.SetMusicPluginLifecycle(admin, MusicLifecycleDisabled)
	if err != nil {
		t.Fatalf("failed to set disabled: %v", err)
	}
	if info.State != MusicLifecycleDisabled {
		t.Fatalf("expected state disabled, got %s", info.State)
	}

	// 2. Simulate server restart: in-memory state resets to MusicLifecycleInstalled
	ResetMusicLifecycleManagerForTest(MusicLifecycleInstalled)

	// 3. GetMusicPluginLifecycle should hydrate and recover MusicLifecycleDisabled
	recovered := svc.GetMusicPluginLifecycle()
	if recovered.State != MusicLifecycleDisabled {
		t.Fatalf("expected recovered state to be disabled across restart, got %s", recovered.State)
	}

	// 4. Admission check should reflect disabled state
	if err := svc.CheckMusicTaskAdmission(user.ID); err == nil {
		t.Fatal("expected admission check to fail for disabled plugin after restart")
	}

	// 5. Admin enables plugin
	info, err = svc.SetMusicPluginLifecycle(admin, MusicLifecycleEnabled)
	if err != nil {
		t.Fatalf("failed to set enabled: %v", err)
	}
	if info.State != MusicLifecycleEnabled {
		t.Fatalf("expected state enabled, got %s", info.State)
	}

	// 6. Simulate another server restart
	ResetMusicLifecycleManagerForTest(MusicLifecycleInstalled)

	// 7. GetMusicPluginLifecycle should hydrate to enabled
	recovered = svc.GetMusicPluginLifecycle()
	if recovered.State != MusicLifecycleEnabled {
		t.Fatalf("expected recovered state to be enabled across restart, got %s", recovered.State)
	}
}


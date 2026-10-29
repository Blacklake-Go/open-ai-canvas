package app

import (
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"yingce/backend/internal/model"
)

// TestChallengerM1_It2_1_Exhaustive7x7Matrix exhaustively asserts the 7x7 state transition matrix
// across all 49 transitions with activeTasks=0, all 49 transitions with activeTasks>0,
// and corrupted/unknown states.
func TestChallengerM1_It2_1_Exhaustive7x7Matrix(t *testing.T) {
	allStates := []MusicPluginLifecycleState{
		MusicLifecycleInstalled,
		MusicLifecycleEnabled,
		MusicLifecycleDraining,
		MusicLifecycleDisabled,
		MusicLifecycleUpdating,
		MusicLifecycleError,
		MusicLifecycleUninstalled,
	}

	// Definition of valid transitions with tasks=0
	validTransitionsZeroTasks := map[MusicPluginLifecycleState]map[MusicPluginLifecycleState]bool{
		MusicLifecycleInstalled: {
			MusicLifecycleInstalled:   true,
			MusicLifecycleEnabled:     true,
			MusicLifecycleError:       true,
			MusicLifecycleUninstalled: true,
		},
		MusicLifecycleEnabled: {
			MusicLifecycleEnabled:  true,
			MusicLifecycleDraining: true,
			MusicLifecycleDisabled: true, // tasks=0 allows direct disable
			MusicLifecycleError:    true,
		},
		MusicLifecycleDraining: {
			MusicLifecycleDraining: true,
			MusicLifecycleEnabled:  true, // cancel drain
			MusicLifecycleDisabled: true, // tasks=0 allows disable
			MusicLifecycleError:    true,
		},
		MusicLifecycleDisabled: {
			MusicLifecycleDisabled:    true,
			MusicLifecycleEnabled:     true,
			MusicLifecycleUpdating:    true, // tasks=0 allows update
			MusicLifecycleError:       true,
			MusicLifecycleUninstalled: true, // tasks=0 allows uninstall
		},
		MusicLifecycleUpdating: {
			MusicLifecycleUpdating: true,
			MusicLifecycleEnabled:  true,
			MusicLifecycleDisabled: true,
			MusicLifecycleError:    true,
		},
		MusicLifecycleError: {
			MusicLifecycleError:       true,
			MusicLifecycleDisabled:    true,
			MusicLifecycleInstalled:   true,
			MusicLifecycleEnabled:     true,
			MusicLifecycleUninstalled: true, // tasks=0 allows uninstall
		},
		MusicLifecycleUninstalled: {
			MusicLifecycleUninstalled: true,
			MusicLifecycleInstalled:   true,
			MusicLifecycleEnabled:     true,
			MusicLifecycleError:       true,
		},
	}

	// Definition of valid transitions with tasks>0 (activeTasks=5)
	validTransitionsActiveTasks := map[MusicPluginLifecycleState]map[MusicPluginLifecycleState]bool{
		MusicLifecycleInstalled: {
			MusicLifecycleInstalled:   true,
			MusicLifecycleEnabled:     true,
			MusicLifecycleError:       true,
			MusicLifecycleUninstalled: true,
		},
		MusicLifecycleEnabled: {
			MusicLifecycleEnabled:  true,
			MusicLifecycleDraining: true,
			MusicLifecycleError:    true,
			// enabled -> disabled is BLOCKED when tasks > 0
		},
		MusicLifecycleDraining: {
			MusicLifecycleDraining: true,
			MusicLifecycleEnabled:  true, // cancel drain
			MusicLifecycleError:    true,
			// draining -> disabled is BLOCKED when tasks > 0
		},
		MusicLifecycleDisabled: {
			MusicLifecycleDisabled: true,
			MusicLifecycleEnabled:  true,
			MusicLifecycleError:    true,
			// disabled -> updating is BLOCKED when tasks > 0
			// disabled -> uninstalled is BLOCKED when tasks > 0
		},
		MusicLifecycleUpdating: {
			MusicLifecycleUpdating: true,
			MusicLifecycleEnabled:  true,
			MusicLifecycleDisabled: true,
			MusicLifecycleError:    true,
		},
		MusicLifecycleError: {
			MusicLifecycleError:     true,
			MusicLifecycleDisabled:  true,
			MusicLifecycleInstalled: true,
			MusicLifecycleEnabled:   true,
			// error -> uninstalled is BLOCKED when tasks > 0
		},
		MusicLifecycleUninstalled: {
			MusicLifecycleUninstalled: true,
			MusicLifecycleInstalled:   true,
			MusicLifecycleEnabled:     true,
			MusicLifecycleError:       true,
		},
	}

	// 1. Test all 49 transitions with activeTasks = 0
	for _, from := range allStates {
		for _, to := range allStates {
			expectedValid := validTransitionsZeroTasks[from][to]
			err := ValidateMusicLifecycleTransition(from, to, 0)
			if expectedValid && err != nil {
				t.Errorf("[tasks=0] expected valid transition %s -> %s, got error: %v", from, to, err)
			} else if !expectedValid && err == nil {
				t.Errorf("[tasks=0] expected ILLEGAL transition %s -> %s to fail, but got nil", from, to)
			}
		}
	}

	// 2. Test all 49 transitions with activeTasks = 5
	for _, from := range allStates {
		for _, to := range allStates {
			expectedValid := validTransitionsActiveTasks[from][to]
			err := ValidateMusicLifecycleTransition(from, to, 5)
			if expectedValid && err != nil {
				t.Errorf("[tasks=5] expected valid transition %s -> %s, got error: %v", from, to, err)
			} else if !expectedValid && err == nil {
				t.Errorf("[tasks=5] expected ILLEGAL transition %s -> %s to fail with tasks=5, but got nil", from, to)
			}
		}
	}

	// 3. Specifically assert that illegal transitions from error are rejected
	illegalFromError := []struct {
		to        MusicPluginLifecycleState
		tasks     int64
		errSubstr string
	}{
		{MusicLifecycleUpdating, 0, "无效的生命周期状态跃迁"},
		{MusicLifecycleUpdating, 3, "无效的生命周期状态跃迁"},
		{MusicLifecycleDraining, 0, "无效的生命周期状态跃迁"},
		{MusicLifecycleDraining, 3, "无效的生命周期状态跃迁"},
		{MusicLifecycleUninstalled, 2, "无法卸载插件"},
	}
	for _, tc := range illegalFromError {
		err := ValidateMusicLifecycleTransition(MusicLifecycleError, tc.to, tc.tasks)
		if err == nil {
			t.Fatalf("expected error -> %s (tasks=%d) to be rejected", tc.to, tc.tasks)
		}
		if !strings.Contains(err.Error(), tc.errSubstr) {
			t.Fatalf("expected error substring %q, got: %v", tc.errSubstr, err)
		}
	}

	// 4. Assert corrupted / invalid string values are rejected
	corruptedCases := []struct {
		from  MusicPluginLifecycleState
		to    MusicPluginLifecycleState
		tasks int64
	}{
		{"corrupted", MusicLifecycleEnabled, 0},
		{"corrupted", MusicLifecycleError, 0},
		{"", MusicLifecycleError, 0},
		{MusicLifecycleEnabled, "unknown_state", 0},
		{MusicLifecycleError, "unknown_state", 0},
		{"bogus_from", "bogus_to", 0},
	}
	for _, tc := range corruptedCases {
		err := ValidateMusicLifecycleTransition(tc.from, tc.to, tc.tasks)
		if err == nil {
			t.Fatalf("expected corrupted transition %q -> %q to be rejected", tc.from, tc.to)
		}
	}
}

// TestChallengerM1_It2_1_DrainingConcurrencyRaceHarness stress-tests draining concurrency:
// Simulates 100 consecutive rapid draining cycles where multiple tasks finish concurrently
// with the admin calling SetMusicPluginLifecycle(admin, MusicLifecycleDraining).
// Asserts that the plugin NEVER gets stuck in `draining` with 0 active tasks.
func TestChallengerM1_It2_1_DrainingConcurrencyRaceHarness(t *testing.T) {
	svc, _ := setupMusicTestService(t)
	admin := &model.User{ID: "adm_race_challenger", Role: model.UserRoleAdmin}

	const iterations = 100
	const concurrentTasksPerCycle = 15

	for it := 0; it < iterations; it++ {
		// Reset to Enabled
		ResetMusicLifecycleManagerForTest(MusicLifecycleEnabled)
		_ = svc.repo.SavePluginPlatformState(&model.PluginPlatformState{
			PluginID:  PluginSupDanceMusicGeneration,
			Available: true,
		})

		var taskWg sync.WaitGroup
		taskWg.Add(concurrentTasksPerCycle)

		// Start concurrent tasks
		for i := 0; i < concurrentTasksPerCycle; i++ {
			go func(idx int) {
				defer taskWg.Done()
				done := svc.TrackMusicTaskExecution()
				// Jitter sleep between 0 and 2 milliseconds to simulate real async execution
				if idx%2 == 0 {
					time.Sleep(time.Duration(idx*100) * time.Microsecond)
				}
				done()
			}(i)
		}

		// Concurrently trigger Draining transition from admin thread
		drainErrCh := make(chan error, 1)
		go func() {
			time.Sleep(time.Duration(it%5*200) * time.Microsecond)
			_, err := svc.SetMusicPluginLifecycle(admin, MusicLifecycleDraining)
			drainErrCh <- err
		}()

		taskWg.Wait()
		drainErr := <-drainErrCh

		if drainErr != nil {
			// If all tasks finished and the state was already auto-disabled by done(),
			// transition from disabled -> draining is an illegal transition, which returns 400.
			// This is completely valid and expected when done() finishes first.
		}

		// EMPIRICAL CRITICAL INVARIANT:
		// Active task count MUST be 0.
		// If active task count is 0, state MUST NOT be draining!
		activeTasks := svc.ActiveMusicTaskCount()
		currentState := musicLifecycleManager().GetState()
		isDraining := svc.IsMusicPluginDraining()

		if activeTasks != 0 {
			t.Fatalf("[Iteration %d] CRITICAL BUG: ActiveMusicTaskCount leaked! expected 0, got %d", it, activeTasks)
		}

		if currentState == MusicLifecycleDraining {
			t.Fatalf("[Iteration %d] CRITICAL RACE BUG: Plugin is stranded in DRAINING state with 0 active tasks!", it)
		}

		if isDraining {
			t.Fatalf("[Iteration %d] CRITICAL RACE BUG: IsMusicPluginDraining() is true when 0 active tasks exist!", it)
		}

		if currentState != MusicLifecycleDisabled && currentState != MusicLifecycleEnabled {
			t.Fatalf("[Iteration %d] Unexpected state after drain cycle: %s", it, currentState)
		}
	}
}

// TestChallengerM1_It2_1_ConcurrentTaskDoneIdempotencyHarness stress-tests TrackMusicTaskExecution:
// 100 independent tasks registered. For each task, 20 goroutines call done() concurrently (2,000 calls).
// 10 concurrent monitor goroutines actively sample ActiveMusicTaskCount() and assert it NEVER drops below 0.
func TestChallengerM1_It2_1_ConcurrentTaskDoneIdempotencyHarness(t *testing.T) {
	svc, _ := setupMusicTestService(t)
	ResetMusicLifecycleManagerForTest(MusicLifecycleEnabled)

	const totalTasks = 100
	const concurrentCallsPerTask = 20

	var doneClosures []func()
	for i := 0; i < totalTasks; i++ {
		doneClosures = append(doneClosures, svc.TrackMusicTaskExecution())
	}

	initialCount := svc.ActiveMusicTaskCount()
	if initialCount != int64(totalTasks) {
		t.Fatalf("expected initial active tasks %d, got %d", totalTasks, initialCount)
	}

	// Underflow detector
	var underflowDetected atomic.Bool
	var minObserved atomic.Int64
	minObserved.Store(int64(totalTasks))

	stopMonitor := make(chan struct{})
	var monitorWg sync.WaitGroup
	const monitorCount = 10

	for m := 0; m < monitorCount; m++ {
		monitorWg.Add(1)
		go func() {
			defer monitorWg.Done()
			for {
				select {
				case <-stopMonitor:
					return
				default:
					c := svc.ActiveMusicTaskCount()
					if c < 0 {
						underflowDetected.Store(true)
					}
					for {
						currMin := minObserved.Load()
						if c >= currMin || minObserved.CompareAndSwap(currMin, c) {
							break
						}
					}
				}
			}
		}()
	}

	// Concurrently hammer done() on all tasks
	var workerWg sync.WaitGroup
	workerWg.Add(totalTasks * concurrentCallsPerTask)

	for _, done := range doneClosures {
		for c := 0; c < concurrentCallsPerTask; c++ {
			go func(cleanup func()) {
				defer workerWg.Done()
				cleanup()
			}(done)
		}
	}

	workerWg.Wait()
	close(stopMonitor)
	monitorWg.Wait()

	if underflowDetected.Load() {
		t.Fatalf("CRITICAL BUG: ActiveMusicTaskCount dropped below 0 during concurrent done() hammer! min=%d", minObserved.Load())
	}

	finalCount := svc.ActiveMusicTaskCount()
	if finalCount != 0 {
		t.Fatalf("expected final task count 0, got %d", finalCount)
	}

	// Sequential redundant done() calls: assert strict idempotency
	for _, done := range doneClosures {
		for extra := 0; extra < 5; extra++ {
			done()
			if c := svc.ActiveMusicTaskCount(); c != 0 {
				t.Fatalf("extra done() mutated task count to %d", c)
			}
		}
	}
}

// TestChallengerM1_It2_1_ErrorStateAdmissionAndPlatformState asserts error state admission gating:
// 1. Setting error state reflects Available = false in DB and state = error in memory.
// 2. Admission returns 403 Forbidden with kernel.ReasonForbidden.
// 3. Admin can safely recover from error to installed or enabled.
func TestChallengerM1_It2_1_ErrorStateAdmissionAndPlatformState(t *testing.T) {
	svc, _ := setupMusicTestService(t)
	user := &model.User{ID: "usr_err_challenge", Role: model.UserRoleUser}
	admin := &model.User{ID: "adm_err_challenge", Role: model.UserRoleAdmin}

	// 1. Set to error state
	info, err := svc.SetMusicPluginLifecycle(admin, MusicLifecycleError)
	if err != nil {
		t.Fatalf("failed to transition to error: %v", err)
	}
	if info.State != MusicLifecycleError {
		t.Fatalf("expected state error, got %s", info.State)
	}

	// 2. Database available state must be false
	avail, err := svc.MusicPluginPlatformAvailable()
	if err != nil {
		t.Fatalf("failed to check platform available: %v", err)
	}
	if avail {
		t.Fatal("expected platform available to be false during error state")
	}

	// 3. Admission must reject with 403 Forbidden
	err = svc.CheckMusicTaskAdmission(user.ID)
	if err == nil {
		t.Fatal("expected admission rejection in error state")
	}
	appErr, ok := err.(*AppError)
	if !ok || appErr.Status != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden in error state, got: %+v", err)
	}
	if !strings.Contains(appErr.Message, "异常状态") {
		t.Fatalf("expected message mentioning abnormal state, got: %s", appErr.Message)
	}

	// 4. Recovery to installed
	info, err = svc.SetMusicPluginLifecycle(admin, MusicLifecycleInstalled)
	if err != nil {
		t.Fatalf("failed to recover from error to installed: %v", err)
	}
	if info.State != MusicLifecycleInstalled {
		t.Fatalf("expected installed state, got %s", info.State)
	}

	// 5. Recovery to enabled
	info, err = svc.SetMusicPluginLifecycle(admin, MusicLifecycleEnabled)
	if err != nil {
		t.Fatalf("failed to enable from installed: %v", err)
	}
	if info.State != MusicLifecycleEnabled {
		t.Fatalf("expected enabled state, got %s", info.State)
	}

	// Admission should now succeed
	if err := svc.CheckMusicTaskAdmission(user.ID); err != nil {
		t.Fatalf("expected admission to succeed after recovery, got: %v", err)
	}
}

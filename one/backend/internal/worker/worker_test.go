package worker

import (
	"context"
	"testing"
	"time"
)

func TestNextBackoffAndWaitWakeup(t *testing.T) {
	if got := nextBackoff(2 * time.Second); got != 4*time.Second {
		t.Fatalf("expected 4s backoff, got %v", got)
	}
	if got := nextBackoff(10 * time.Second); got != maxPollInterval {
		t.Fatalf("expected capped %v, got %v", maxPollInterval, got)
	}

	wakeup := make(chan struct{}, 1)
	wakeup <- struct{}{}
	start := time.Now()
	waitForPoll(context.Background(), 5*time.Second, wakeup)
	if time.Since(start) > 500*time.Millisecond {
		t.Fatalf("expected wakeup channel to interrupt wait immediately")
	}
}

func TestManagerRunExitsCleanlyOnCancelWithNilPool(t *testing.T) {
	m := &Manager{}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		m.Run(ctx)
		close(done)
	}()
	cancel()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("worker.Manager.Run did not exit on context cancel")
	}
}

func TestManagerRunHousekeepingNilSafe(t *testing.T) {
	// Verifies RunHousekeeping (reservations, overdue creations, migrations,
	// pending payment order reconciliation, and expired deletions) never panics when unwired.
	m := &Manager{}
	m.RunHousekeeping(context.Background())
}

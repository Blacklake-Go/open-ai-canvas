package queue

import (
	"strings"
	"testing"
	"time"
)

func TestClaimNextCreationSQLHasSkipLockedAndLease(t *testing.T) {
	sql := strings.ToUpper(ClaimNextCreationSQL)
	if !strings.Contains(sql, "FOR UPDATE SKIP LOCKED") {
		t.Fatalf("missing FOR UPDATE SKIP LOCKED")
	}
	if !strings.Contains(sql, "POLL_LOCKED_UNTIL IS NULL OR POLL_LOCKED_UNTIL <= NOW()") {
		t.Fatalf("missing poll_locked_until lease takeover condition")
	}
	if !strings.Contains(sql, "ORDER BY CREATED_AT ASC") {
		t.Fatalf("missing FIFO created_at ordering")
	}
	for _, forbidden := range []string{"LEASE_EXPIRES_AT", "LEASE_OWNER", "C.MODEL_ID", "C.PROMPT"} {
		if strings.Contains(sql, forbidden) {
			t.Fatalf("ClaimNextCreationSQL references non-existent column %s", forbidden)
		}
	}
}

func TestEventHubFiltersByUserAndTask(t *testing.T) {
	hub := NewEventHub()
	chUser1All, unsub1 := hub.Subscribe("100001", "")
	defer unsub1()
	chUser1TaskA, unsub2 := hub.Subscribe("100001", "gen_a")
	defer unsub2()
	chUser2, unsub3 := hub.Subscribe("100002", "")
	defer unsub3()

	hub.PublishLocal(GenerationEvent{
		Type:   "generation_update",
		UserID: "100001",
		TaskID: "gen_a",
		Status: "COMPLETED",
	})
	hub.PublishLocal(GenerationEvent{
		Type:   "generation_update",
		UserID: "100001",
		TaskID: "gen_b",
		Status: "PROCESSING",
	})

	select {
	case ev := <-chUser1All:
		if ev.TaskID != "gen_a" {
			t.Fatalf("unexpected first event: %+v", ev)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for chUser1All")
	}

	select {
	case ev := <-chUser1TaskA:
		if ev.TaskID != "gen_a" || ev.Status != "COMPLETED" {
			t.Fatalf("unexpected taskA event: %+v", ev)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for chUser1TaskA")
	}

	select {
	case ev := <-chUser1TaskA:
		t.Fatalf("taskA subscriber should not receive taskB event: %+v", ev)
	default:
	}

	select {
	case ev := <-chUser2:
		t.Fatalf("user2 should not receive user1 event: %+v", ev)
	default:
	}
}

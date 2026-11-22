package handler

import (
	"context"
	"testing"
)

// TestAdminIdempotencySemantics pins the ops_bill.idempotency_keys protocol from
// Supdance Pro/lib/admin/idempotency.js. The in-memory fallback (Pool == nil) must behave
// identically to the PG path so write-route semantics are verifiable without a live DB.
func TestAdminIdempotencySemantics(t *testing.T) {
	s := (&Dependencies{}).idempotency()
	const scope, key, actor = "probe_scope", "key-12345678", "actor1"

	first, err := s.Check(context.Background(), scope, key, actor)
	if err != nil || !first.Allowed || first.KeyHash == "" {
		t.Fatalf("first check = %+v, %v", first, err)
	}
	dup, err := s.Check(context.Background(), scope, key, actor)
	if err != nil || dup.Allowed {
		t.Fatalf("duplicate must conflict = %+v, %v", dup, err)
	}
	if err := s.Complete(context.Background(), first.KeyHash, map[string]any{"id": "x"}); err != nil {
		t.Fatalf("complete: %v", err)
	}
	replay, err := s.Check(context.Background(), scope, key, actor)
	if err != nil || replay.Allowed || replay.CachedResponse == nil {
		t.Fatalf("completed key must replay cached response = %+v, %v", replay, err)
	}

	const releasedKey = "key-87654321"
	fresh, err := s.Check(context.Background(), scope, releasedKey, actor)
	if err != nil || !fresh.Allowed {
		t.Fatalf("fresh key = %+v, %v", fresh, err)
	}
	if err := s.Release(context.Background(), fresh.KeyHash); err != nil {
		t.Fatalf("release: %v", err)
	}
	again, err := s.Check(context.Background(), scope, releasedKey, actor)
	if err != nil || !again.Allowed {
		t.Fatalf("released processing key must be reusable = %+v, %v", again, err)
	}
}

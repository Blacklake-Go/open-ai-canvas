package coordination

import (
	"context"
	"sync"
	"testing"
	"time"
)

type fakePGStore struct {
	mu      sync.Mutex
	buckets map[string]struct {
		count     int
		startedAt time.Time
	}
	err error
}

func newFakePGStore() *fakePGStore {
	return &fakePGStore{
		buckets: make(map[string]struct {
			count     int
			startedAt time.Time
		}),
	}
}

func (f *fakePGStore) ConsumeRateLimitBucket(_ context.Context, keyHash, _, _ string, now, resetBefore time.Time) (int, time.Time, error) {
	if f.err != nil {
		return 0, time.Time{}, f.err
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	b, ok := f.buckets[keyHash]
	if !ok || !b.startedAt.After(resetBefore) {
		b.count = 1
		b.startedAt = now
	} else {
		b.count++
	}
	f.buckets[keyHash] = b
	return b.count, b.startedAt, nil
}

func (f *fakePGStore) GetRateLimitBucket(_ context.Context, keyHash string) (int, time.Time, bool, error) {
	if f.err != nil {
		return 0, time.Time{}, false, f.err
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	b, ok := f.buckets[keyHash]
	return b.count, b.startedAt, ok, nil
}

func (f *fakePGStore) DeleteRateLimitBucket(_ context.Context, keyHash string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.buckets, keyHash)
	return nil
}

func TestRateLimitPGAndMemoryFallbacks(t *testing.T) {
	now := time.Date(2026, 11, 15, 10, 0, 0, 0, time.UTC)
	pg := newFakePGStore()
	c, err := New(Options{
		PG:  pg,
		Now: func() time.Time { return now },
	})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	defer c.Close()

	req := RateLimitRequest{
		Scope:   "login_ip",
		Subject: "1.2.3.4",
		Limit:   2,
		Window:  time.Minute,
	}
	ctx := context.Background()

	res, err := c.ConsumeRateLimit(ctx, req)
	if err != nil || !res.Allowed || res.Remaining != 1 || res.Backend != "postgres" {
		t.Fatalf("1st consume = %+v, err=%v", res, err)
	}
	res, err = c.ConsumeRateLimit(ctx, req)
	if err != nil || !res.Allowed || res.Remaining != 0 {
		t.Fatalf("2nd consume = %+v, err=%v", res, err)
	}
	status, err := c.GetRateLimitStatus(ctx, req)
	if err != nil || status.Allowed || status.Remaining != 0 {
		t.Fatalf("status at limit = %+v, err=%v", status, err)
	}
	res, err = c.ConsumeRateLimit(ctx, req)
	if err != nil || res.Allowed || res.Remaining != 0 || res.RetryAfterSeconds < 1 {
		t.Fatalf("3rd consume should be blocked = %+v, err=%v", res, err)
	}

	// Advance past window
	now = now.Add(61 * time.Second)
	res, err = c.ConsumeRateLimit(ctx, req)
	if err != nil || !res.Allowed || res.Remaining != 1 {
		t.Fatalf("after window consume = %+v, err=%v", res, err)
	}

	if err := c.ResetRateLimitBucket(ctx, req.Scope, req.Subject); err != nil {
		t.Fatalf("ResetRateLimitBucket err = %v", err)
	}
	status, err = c.GetRateLimitStatus(ctx, req)
	if err != nil || !status.Allowed || status.Remaining != 2 {
		t.Fatalf("after reset status = %+v, err=%v", status, err)
	}

	// Memory fallback (nil PG & nil Redis)
	memCoord, err := New(Options{Now: func() time.Time { return now }})
	if err != nil {
		t.Fatalf("New memory coord err = %v", err)
	}
	res, err = memCoord.ConsumeRateLimit(ctx, req)
	if err != nil || !res.Allowed || res.Backend != "memory" {
		t.Fatalf("memory consume = %+v, err=%v", res, err)
	}

	if _, err := memCoord.ConsumeRateLimit(ctx, RateLimitRequest{Limit: 1}); err != ErrScopeRequired {
		t.Fatalf("expected ErrScopeRequired, got %v", err)
	}
}

func TestConcurrencySlots(t *testing.T) {
	now := time.Date(2026, 11, 15, 10, 0, 0, 0, time.UTC)
	c, err := New(Options{Now: func() time.Time { return now }})
	if err != nil {
		t.Fatalf("New error = %v", err)
	}
	ctx := context.Background()

	tok1, ok, err := c.AcquireConcurrencySlot(ctx, "user:100001", 2, 30*time.Second)
	if err != nil || !ok || tok1 == "" {
		t.Fatalf("slot 1 failed: ok=%v err=%v", ok, err)
	}
	tok2, ok, err := c.AcquireConcurrencySlot(ctx, "user:100001", 2, 30*time.Second)
	if err != nil || !ok || tok2 == "" {
		t.Fatalf("slot 2 failed: ok=%v err=%v", ok, err)
	}
	_, ok, err = c.AcquireConcurrencySlot(ctx, "user:100001", 2, 30*time.Second)
	if err != nil || ok {
		t.Fatalf("slot 3 should be denied: ok=%v err=%v", ok, err)
	}
	active, _ := c.ActiveConcurrencyCount(ctx, "user:100001")
	if active != 2 {
		t.Fatalf("active slots = %d, want 2", active)
	}

	_ = c.ReleaseConcurrencySlot(ctx, "user:100001", tok1)
	tok3, ok, err := c.AcquireConcurrencySlot(ctx, "user:100001", 2, 30*time.Second)
	if err != nil || !ok || tok3 == "" {
		t.Fatalf("slot 3 after release failed: ok=%v err=%v", ok, err)
	}

	// Expiry evicts stale slots
	now = now.Add(31 * time.Second)
	active, _ = c.ActiveConcurrencyCount(ctx, "user:100001")
	if active != 0 {
		t.Fatalf("expected expired slots cleared, got %d", active)
	}
}

func TestCircuitBreakerAndAtomicNonce(t *testing.T) {
	now := time.Date(2026, 11, 15, 10, 0, 0, 0, time.UTC)
	c, err := New(Options{Now: func() time.Time { return now }})
	if err != nil {
		t.Fatalf("New error = %v", err)
	}
	ctx := context.Background()
	cfg := CircuitConfig{FailureThreshold: 2, OpenDuration: 20 * time.Second, SuccessThreshold: 2}

	allowed, state, _ := c.AllowCircuit(ctx, "paypal", cfg)
	if !allowed || state != CircuitClosed {
		t.Fatalf("initial circuit = %v/%s", allowed, state)
	}
	state, _ = c.RecordCircuitFailure(ctx, "paypal", cfg)
	if state != CircuitClosed {
		t.Fatalf("after 1 failure = %s, want closed", state)
	}
	state, _ = c.RecordCircuitFailure(ctx, "paypal", cfg)
	if state != CircuitOpen {
		t.Fatalf("after 2 failures = %s, want open", state)
	}
	allowed, state, _ = c.AllowCircuit(ctx, "paypal", cfg)
	if allowed || state != CircuitOpen {
		t.Fatalf("open circuit allowed=%v state=%s", allowed, state)
	}

	// Half-open after OpenDuration
	now = now.Add(21 * time.Second)
	allowed, state, _ = c.AllowCircuit(ctx, "paypal", cfg)
	if !allowed || state != CircuitHalfOpen {
		t.Fatalf("after open duration = %v/%s, want true/half_open", allowed, state)
	}
	_ = c.RecordCircuitSuccess(ctx, "paypal", cfg)
	snap, _ := c.GetCircuitState(ctx, "paypal")
	if snap.State != CircuitHalfOpen {
		t.Fatalf("after 1 success in half_open = %s, want half_open", snap.State)
	}
	_ = c.RecordCircuitSuccess(ctx, "paypal", cfg)
	snap, _ = c.GetCircuitState(ctx, "paypal")
	if snap.State != CircuitClosed {
		t.Fatalf("after 2 successes = %s, want closed", snap.State)
	}

	// Atomic Nonce
	ok, err := c.ConsumeNonce(ctx, "oauth", "nonce-abc", 5*time.Minute)
	if err != nil || !ok {
		t.Fatalf("first nonce consume = %v, err=%v", ok, err)
	}
	ok, err = c.ConsumeNonce(ctx, "oauth", "nonce-abc", 5*time.Minute)
	if err != nil || ok {
		t.Fatalf("replay nonce should return false, got %v, err=%v", ok, err)
	}
	now = now.Add(6 * time.Minute)
	ok, err = c.ConsumeNonce(ctx, "oauth", "nonce-abc", 5*time.Minute)
	if err != nil || !ok {
		t.Fatalf("expired nonce should be consumable again, got %v, err=%v", ok, err)
	}
	if _, err := c.ConsumeNonce(ctx, "oauth", " ", 5*time.Minute); err != ErrNonceRequired {
		t.Fatalf("empty nonce err = %v, want ErrNonceRequired", err)
	}
}

func TestNewInvalidRedisURL(t *testing.T) {
	if _, err := New(Options{RedisURL: "not-a-valid-redis-url://foo"}); err == nil {
		t.Fatal("expected error for invalid REDIS_URL")
	}
	c, err := New(Options{RedisURL: "redis://localhost:6379/0", RedisPassword: "secret"})
	if err != nil {
		t.Fatalf("valid RedisURL error = %v", err)
	}
	defer c.Close()
	if !c.HasRedis() {
		t.Fatal("expected HasRedis() == true")
	}
}

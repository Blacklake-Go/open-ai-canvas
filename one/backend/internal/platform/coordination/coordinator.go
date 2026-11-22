package coordination

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

var (
	ErrScopeRequired = errors.New("coordination: rate limit scope is required")
	ErrNonceRequired = errors.New("coordination: nonce is required")
)

type RateLimitRequest struct {
	Scope   string
	Subject string
	Limit   int
	Window  time.Duration
}

type RateLimitResult struct {
	Allowed           bool
	Limit             int
	Remaining         int
	RetryAfterSeconds int
	Backend           string
}

type CircuitState string

const (
	CircuitClosed   CircuitState = "closed"
	CircuitOpen     CircuitState = "open"
	CircuitHalfOpen CircuitState = "half_open"
)

type CircuitConfig struct {
	FailureThreshold int
	OpenDuration     time.Duration
	SuccessThreshold int
}

type CircuitSnapshot struct {
	State       CircuitState
	Failures    int
	OpenedUntil time.Time
}

// PGStore abstracts sys_core.rate_limit_buckets persistence for testing and fallback.
type PGStore interface {
	ConsumeRateLimitBucket(ctx context.Context, keyHash, scope, subject string, now, resetBefore time.Time) (count int, windowStartedAt time.Time, err error)
	GetRateLimitBucket(ctx context.Context, keyHash string) (count int, windowStartedAt time.Time, found bool, err error)
	DeleteRateLimitBucket(ctx context.Context, keyHash string) error
}

type pgPoolStore struct {
	pool *pgxpool.Pool
}

func (s *pgPoolStore) ConsumeRateLimitBucket(ctx context.Context, keyHash, scope, subject string, now, resetBefore time.Time) (int, time.Time, error) {
	var count int
	var startedAt time.Time
	err := s.pool.QueryRow(ctx, `
		INSERT INTO sys_core.rate_limit_buckets
		  (key_hash, scope, subject, window_started_at, request_count, updated_at)
		VALUES ($1, $2, $3, $4, 1, $4)
		ON CONFLICT (key_hash) DO UPDATE SET
		  window_started_at = CASE
		    WHEN sys_core.rate_limit_buckets.window_started_at <= $5 THEN $4
		    ELSE sys_core.rate_limit_buckets.window_started_at
		  END,
		  request_count = CASE
		    WHEN sys_core.rate_limit_buckets.window_started_at <= $5 THEN 1
		    ELSE sys_core.rate_limit_buckets.request_count + 1
		  END,
		  updated_at = $4
		RETURNING request_count, window_started_at
	`, keyHash, scope, subject, now.UTC(), resetBefore.UTC()).Scan(&count, &startedAt)
	return count, startedAt, err
}

func (s *pgPoolStore) GetRateLimitBucket(ctx context.Context, keyHash string) (int, time.Time, bool, error) {
	var count int
	var startedAt time.Time
	err := s.pool.QueryRow(ctx, `
		SELECT request_count, window_started_at
		FROM sys_core.rate_limit_buckets
		WHERE key_hash = $1
	`, keyHash).Scan(&count, &startedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, time.Time{}, false, nil
		}
		return 0, time.Time{}, false, err
	}
	return count, startedAt, true, nil
}

func (s *pgPoolStore) DeleteRateLimitBucket(ctx context.Context, keyHash string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM sys_core.rate_limit_buckets WHERE key_hash = $1`, keyHash)
	return err
}

type Options struct {
	RedisURL      string
	RedisPassword string
	Pool          *pgxpool.Pool
	PG            PGStore
	Redis         redis.Cmdable
	Now           func() time.Time
}

type memBucket struct {
	count     int
	startedAt time.Time
}

type memSlotEntry struct {
	token     string
	expiresAt time.Time
}

type memCircuit struct {
	state       CircuitState
	failures    int
	successes   int
	openedUntil time.Time
}

type Coordinator struct {
	redis redis.Cmdable
	raw   *redis.Client
	pg    PGStore
	now   func() time.Time

	mu       sync.Mutex
	buckets  map[string]memBucket
	slots    map[string]map[string]time.Time
	circuits map[string]*memCircuit
	nonces   map[string]time.Time
}

var (
	rateLimitLua = redis.NewScript(`
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local pttl = redis.call("PTTL", KEYS[1])
if pttl < 0 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
  pttl = tonumber(ARGV[1])
end
return {current, pttl}
`)

	acquireSlotLua = redis.NewScript(`
local key = KEYS[1]
local nowMs = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local ttlMs = tonumber(ARGV[3])
local token = ARGV[4]
redis.call("ZREMRANGEBYSCORE", key, "-inf", nowMs)
local active = redis.call("ZCARD", key)
if active >= limit then
  return 0
end
redis.call("ZADD", key, nowMs + ttlMs, token)
redis.call("PEXPIRE", key, ttlMs)
return 1
`)

	activeSlotsLua = redis.NewScript(`
local key = KEYS[1]
local nowMs = tonumber(ARGV[1])
redis.call("ZREMRANGEBYSCORE", key, "-inf", nowMs)
return redis.call("ZCARD", key)
`)
)

func New(opts Options) (*Coordinator, error) {
	nowFn := opts.Now
	if nowFn == nil {
		nowFn = time.Now
	}
	var pgStore PGStore = opts.PG
	if pgStore == nil && opts.Pool != nil {
		pgStore = &pgPoolStore{pool: opts.Pool}
	}

	var rdb redis.Cmdable = opts.Redis
	var rawClient *redis.Client
	if rdb == nil && strings.TrimSpace(opts.RedisURL) != "" {
		parsed, err := redis.ParseURL(strings.TrimSpace(opts.RedisURL))
		if err != nil {
			return nil, fmt.Errorf("parse REDIS_URL: %w", err)
		}
		if parsed.Password == "" && strings.TrimSpace(opts.RedisPassword) != "" {
			parsed.Password = strings.TrimSpace(opts.RedisPassword)
		}
		rawClient = redis.NewClient(parsed)
		rdb = rawClient
	}

	return &Coordinator{
		redis:    rdb,
		raw:      rawClient,
		pg:       pgStore,
		now:      nowFn,
		buckets:  make(map[string]memBucket),
		slots:    make(map[string]map[string]time.Time),
		circuits: make(map[string]*memCircuit),
		nonces:   make(map[string]time.Time),
	}, nil
}

func (c *Coordinator) Close() error {
	if c != nil && c.raw != nil {
		return c.raw.Close()
	}
	return nil
}

func (c *Coordinator) HasRedis() bool {
	return c != nil && c.redis != nil
}

func (c *Coordinator) Ping(ctx context.Context) error {
	if c == nil || c.redis == nil {
		return nil
	}
	return c.redis.Ping(ctx).Err()
}

func RateLimitKeyHash(scope, subject string) string {
	cleanScope := strings.TrimSpace(scope)
	cleanSubject := strings.TrimSpace(subject)
	if cleanSubject == "" {
		cleanSubject = "unknown"
	}
	sum := sha256.Sum256([]byte(cleanScope + ":" + cleanSubject))
	return hex.EncodeToString(sum[:])
}

func normalizeRateLimitReq(req RateLimitRequest) (string, string, int, time.Duration, error) {
	scope := strings.TrimSpace(req.Scope)
	if scope == "" {
		return "", "", 0, 0, ErrScopeRequired
	}
	subject := strings.TrimSpace(req.Subject)
	if subject == "" {
		subject = "unknown"
	}
	limit := req.Limit
	if limit < 1 {
		limit = 1
	}
	window := req.Window
	if window < time.Second {
		window = 60 * time.Second
	}
	return scope, subject, limit, window, nil
}

func (c *Coordinator) ConsumeRateLimit(ctx context.Context, req RateLimitRequest) (RateLimitResult, error) {
	scope, subject, limit, window, err := normalizeRateLimitReq(req)
	if err != nil {
		return RateLimitResult{}, err
	}
	keyHash := RateLimitKeyHash(scope, subject)

	if c.redis != nil {
		res, rErr := rateLimitLua.Run(ctx, c.redis, []string{"one:rl:" + keyHash}, window.Milliseconds()).Slice()
		if rErr == nil && len(res) == 2 {
			count := toInt(res[0])
			pttlMs := toInt64(res[1])
			retrySec := int(math.Ceil(float64(pttlMs) / 1000.0))
			if retrySec < 1 {
				retrySec = 1
			}
			rem := limit - count
			if rem < 0 {
				rem = 0
			}
			return RateLimitResult{
				Allowed:           count <= limit,
				Limit:             limit,
				Remaining:         rem,
				RetryAfterSeconds: retrySec,
				Backend:           "redis",
			}, nil
		}
	}

	now := c.now()
	if c.pg != nil {
		resetBefore := now.Add(-window)
		count, startedAt, pgErr := c.pg.ConsumeRateLimitBucket(ctx, keyHash, scope, subject, now, resetBefore)
		if pgErr != nil {
			return RateLimitResult{}, pgErr
		}
		retrySec := int(math.Ceil(startedAt.Add(window).Sub(now).Seconds()))
		if retrySec < 1 {
			retrySec = 1
		}
		rem := limit - count
		if rem < 0 {
			rem = 0
		}
		return RateLimitResult{
			Allowed:           count <= limit,
			Limit:             limit,
			Remaining:         rem,
			RetryAfterSeconds: retrySec,
			Backend:           "postgres",
		}, nil
	}

	c.mu.Lock()
	defer c.mu.Unlock()
	b, ok := c.buckets[keyHash]
	if !ok || !b.startedAt.After(now.Add(-window)) {
		b = memBucket{count: 1, startedAt: now}
	} else {
		b.count++
	}
	c.buckets[keyHash] = b
	retrySec := int(math.Ceil(b.startedAt.Add(window).Sub(now).Seconds()))
	if retrySec < 1 {
		retrySec = 1
	}
	rem := limit - b.count
	if rem < 0 {
		rem = 0
	}
	return RateLimitResult{
		Allowed:           b.count <= limit,
		Limit:             limit,
		Remaining:         rem,
		RetryAfterSeconds: retrySec,
		Backend:           "memory",
	}, nil
}

func (c *Coordinator) GetRateLimitStatus(ctx context.Context, req RateLimitRequest) (RateLimitResult, error) {
	scope, subject, limit, window, err := normalizeRateLimitReq(req)
	if err != nil {
		return RateLimitResult{}, err
	}
	keyHash := RateLimitKeyHash(scope, subject)

	if c.redis != nil {
		redisKey := "one:rl:" + keyHash
		rawCount, gErr := c.redis.Get(ctx, redisKey).Int()
		if gErr == nil {
			pttl, _ := c.redis.PTTL(ctx, redisKey).Result()
			retrySec := int(math.Ceil(pttl.Seconds()))
			if retrySec < 1 {
				retrySec = 1
			}
			rem := limit - rawCount
			if rem < 0 {
				rem = 0
			}
			return RateLimitResult{
				Allowed:           rawCount < limit,
				Limit:             limit,
				Remaining:         rem,
				RetryAfterSeconds: retrySec,
				Backend:           "redis",
			}, nil
		}
		if errors.Is(gErr, redis.Nil) {
			return RateLimitResult{
				Allowed:           true,
				Limit:             limit,
				Remaining:         limit,
				RetryAfterSeconds: 1,
				Backend:           "redis",
			}, nil
		}
	}

	now := c.now()
	if c.pg != nil {
		count, startedAt, found, pgErr := c.pg.GetRateLimitBucket(ctx, keyHash)
		if pgErr != nil {
			return RateLimitResult{}, pgErr
		}
		if !found || !startedAt.After(now.Add(-window)) {
			return RateLimitResult{
				Allowed:           true,
				Limit:             limit,
				Remaining:         limit,
				RetryAfterSeconds: 1,
				Backend:           "postgres",
			}, nil
		}
		retrySec := int(math.Ceil(startedAt.Add(window).Sub(now).Seconds()))
		if retrySec < 1 {
			retrySec = 1
		}
		rem := limit - count
		if rem < 0 {
			rem = 0
		}
		return RateLimitResult{
			Allowed:           count < limit,
			Limit:             limit,
			Remaining:         rem,
			RetryAfterSeconds: retrySec,
			Backend:           "postgres",
		}, nil
	}

	c.mu.Lock()
	defer c.mu.Unlock()
	b, ok := c.buckets[keyHash]
	if !ok || !b.startedAt.After(now.Add(-window)) {
		return RateLimitResult{Allowed: true, Limit: limit, Remaining: limit, RetryAfterSeconds: 1, Backend: "memory"}, nil
	}
	retrySec := int(math.Ceil(b.startedAt.Add(window).Sub(now).Seconds()))
	if retrySec < 1 {
		retrySec = 1
	}
	rem := limit - b.count
	if rem < 0 {
		rem = 0
	}
	return RateLimitResult{Allowed: b.count < limit, Limit: limit, Remaining: rem, RetryAfterSeconds: retrySec, Backend: "memory"}, nil
}

func (c *Coordinator) ResetRateLimitBucket(ctx context.Context, scope, subject string) error {
	if strings.TrimSpace(scope) == "" {
		return ErrScopeRequired
	}
	keyHash := RateLimitKeyHash(scope, subject)
	if c.redis != nil {
		_ = c.redis.Del(ctx, "one:rl:"+keyHash).Err()
	}
	if c.pg != nil {
		if err := c.pg.DeleteRateLimitBucket(ctx, keyHash); err != nil {
			return err
		}
	}
	c.mu.Lock()
	delete(c.buckets, keyHash)
	c.mu.Unlock()
	return nil
}

func (c *Coordinator) AcquireConcurrencySlot(ctx context.Context, key string, limit int, ttl time.Duration) (string, bool, error) {
	cleanKey := strings.TrimSpace(key)
	if cleanKey == "" || limit < 1 {
		return "", false, nil
	}
	if ttl <= 0 {
		ttl = 5 * time.Minute
	}
	token := randomTokenHex(12)
	now := c.now()

	if c.redis != nil {
		res, err := acquireSlotLua.Run(ctx, c.redis, []string{"one:slot:" + cleanKey}, now.UnixMilli(), limit, ttl.Milliseconds(), token).Int()
		if err == nil {
			if res == 1 {
				return token, true, nil
			}
			return "", false, nil
		}
	}

	c.mu.Lock()
	defer c.mu.Unlock()
	m := c.slots[cleanKey]
	if m == nil {
		m = make(map[string]time.Time)
		c.slots[cleanKey] = m
	}
	for k, exp := range m {
		if !exp.After(now) {
			delete(m, k)
		}
	}
	if len(m) >= limit {
		return "", false, nil
	}
	m[token] = now.Add(ttl)
	return token, true, nil
}

func (c *Coordinator) ReleaseConcurrencySlot(ctx context.Context, key string, token string) error {
	cleanKey := strings.TrimSpace(key)
	if cleanKey == "" || token == "" {
		return nil
	}
	if c.redis != nil {
		_ = c.redis.ZRem(ctx, "one:slot:"+cleanKey, token).Err()
	}
	c.mu.Lock()
	if m := c.slots[cleanKey]; m != nil {
		delete(m, token)
		if len(m) == 0 {
			delete(c.slots, cleanKey)
		}
	}
	c.mu.Unlock()
	return nil
}

func (c *Coordinator) ActiveConcurrencyCount(ctx context.Context, key string) (int, error) {
	cleanKey := strings.TrimSpace(key)
	if cleanKey == "" {
		return 0, nil
	}
	now := c.now()
	if c.redis != nil {
		count, err := activeSlotsLua.Run(ctx, c.redis, []string{"one:slot:" + cleanKey}, now.UnixMilli()).Int()
		if err == nil {
			return count, nil
		}
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	m := c.slots[cleanKey]
	for k, exp := range m {
		if !exp.After(now) {
			delete(m, k)
		}
	}
	return len(m), nil
}

func normalizeCircuitConfig(cfg CircuitConfig) CircuitConfig {
	if cfg.FailureThreshold <= 0 {
		cfg.FailureThreshold = 5
	}
	if cfg.OpenDuration <= 0 {
		cfg.OpenDuration = 30 * time.Second
	}
	if cfg.SuccessThreshold <= 0 {
		cfg.SuccessThreshold = 1
	}
	return cfg
}

func (c *Coordinator) AllowCircuit(ctx context.Context, name string, cfg CircuitConfig) (bool, CircuitState, error) {
	cfg = normalizeCircuitConfig(cfg)
	now := c.now()
	cleanName := strings.TrimSpace(name)

	if c.redis != nil {
		key := "one:cb:" + cleanName
		vals, err := c.redis.HGetAll(ctx, key).Result()
		if err == nil {
			state := CircuitState(vals["state"])
			if state == "" {
				state = CircuitClosed
			}
			if state == CircuitOpen {
				openedUntilMs := toInt64(vals["opened_until_ms"])
				if now.UnixMilli() < openedUntilMs {
					return false, CircuitOpen, nil
				}
				_ = c.redis.HSet(ctx, key, "state", string(CircuitHalfOpen), "successes", 0).Err()
				return true, CircuitHalfOpen, nil
			}
			return true, state, nil
		}
	}

	c.mu.Lock()
	defer c.mu.Unlock()
	cb := c.circuits[cleanName]
	if cb == nil {
		return true, CircuitClosed, nil
	}
	if cb.state == CircuitOpen {
		if now.Before(cb.openedUntil) {
			return false, CircuitOpen, nil
		}
		cb.state = CircuitHalfOpen
		cb.successes = 0
		return true, CircuitHalfOpen, nil
	}
	return true, cb.state, nil
}

func (c *Coordinator) RecordCircuitFailure(ctx context.Context, name string, cfg CircuitConfig) (CircuitState, error) {
	cfg = normalizeCircuitConfig(cfg)
	now := c.now()
	cleanName := strings.TrimSpace(name)

	if c.redis != nil {
		key := "one:cb:" + cleanName
		failures, err := c.redis.HIncrBy(ctx, key, "failures", 1).Result()
		if err == nil {
			state := CircuitClosed
			if int(failures) >= cfg.FailureThreshold {
				state = CircuitOpen
				_ = c.redis.HSet(ctx, key,
					"state", string(CircuitOpen),
					"opened_until_ms", now.Add(cfg.OpenDuration).UnixMilli(),
					"successes", 0,
				).Err()
			} else {
				_ = c.redis.HSet(ctx, key, "state", string(CircuitClosed)).Err()
			}
			_ = c.redis.Expire(ctx, key, cfg.OpenDuration*4).Err()
			return state, nil
		}
	}

	c.mu.Lock()
	defer c.mu.Unlock()
	cb := c.circuits[cleanName]
	if cb == nil {
		cb = &memCircuit{state: CircuitClosed}
		c.circuits[cleanName] = cb
	}
	cb.failures++
	cb.successes = 0
	if cb.failures >= cfg.FailureThreshold || cb.state == CircuitHalfOpen {
		cb.state = CircuitOpen
		cb.openedUntil = now.Add(cfg.OpenDuration)
	}
	return cb.state, nil
}

func (c *Coordinator) RecordCircuitSuccess(ctx context.Context, name string, cfg CircuitConfig) error {
	cfg = normalizeCircuitConfig(cfg)
	cleanName := strings.TrimSpace(name)

	if c.redis != nil {
		key := "one:cb:" + cleanName
		vals, err := c.redis.HGetAll(ctx, key).Result()
		if err == nil {
			state := CircuitState(vals["state"])
			if state == CircuitHalfOpen {
				s, _ := c.redis.HIncrBy(ctx, key, "successes", 1).Result()
				if int(s) >= cfg.SuccessThreshold {
					_ = c.redis.Del(ctx, key).Err()
				}
				return nil
			}
			_ = c.redis.Del(ctx, key).Err()
			return nil
		}
	}

	c.mu.Lock()
	defer c.mu.Unlock()
	cb := c.circuits[cleanName]
	if cb == nil {
		return nil
	}
	if cb.state == CircuitHalfOpen {
		cb.successes++
		if cb.successes >= cfg.SuccessThreshold {
			delete(c.circuits, cleanName)
		}
		return nil
	}
	delete(c.circuits, cleanName)
	return nil
}

func (c *Coordinator) GetCircuitState(ctx context.Context, name string) (CircuitSnapshot, error) {
	cleanName := strings.TrimSpace(name)
	if c.redis != nil {
		vals, err := c.redis.HGetAll(ctx, "one:cb:"+cleanName).Result()
		if err == nil {
			state := CircuitState(vals["state"])
			if state == "" {
				state = CircuitClosed
			}
			var opened time.Time
			if ms := toInt64(vals["opened_until_ms"]); ms > 0 {
				opened = time.UnixMilli(ms).UTC()
			}
			return CircuitSnapshot{
				State:       state,
				Failures:    toInt(vals["failures"]),
				OpenedUntil: opened,
			}, nil
		}
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	cb := c.circuits[cleanName]
	if cb == nil {
		return CircuitSnapshot{State: CircuitClosed}, nil
	}
	return CircuitSnapshot{
		State:       cb.state,
		Failures:    cb.failures,
		OpenedUntil: cb.openedUntil,
	}, nil
}

// ConsumeNonce atomically claims a single-use nonce until ttl expires.
// Returns true on first consumption, false on replay.
func (c *Coordinator) ConsumeNonce(ctx context.Context, namespace, nonce string, ttl time.Duration) (bool, error) {
	cleanNonce := strings.TrimSpace(nonce)
	if cleanNonce == "" {
		return false, ErrNonceRequired
	}
	if ttl <= 0 {
		ttl = 10 * time.Minute
	}
	cleanNS := strings.TrimSpace(namespace)
	if cleanNS == "" {
		cleanNS = "default"
	}
	key := "one:nonce:" + RateLimitKeyHash(cleanNS, cleanNonce)

	if c.redis != nil {
		ok, err := c.redis.SetNX(ctx, key, "1", ttl).Result()
		if err == nil {
			return ok, nil
		}
	}

	now := c.now()
	c.mu.Lock()
	defer c.mu.Unlock()
	for k, exp := range c.nonces {
		if !exp.After(now) {
			delete(c.nonces, k)
		}
	}
	if exp, exists := c.nonces[key]; exists && exp.After(now) {
		return false, nil
	}
	c.nonces[key] = now.Add(ttl)
	return true, nil
}

func randomTokenHex(bytesLen int) string {
	b := make([]byte, bytesLen)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func toInt(v any) int {
	return int(toInt64(v))
}

func toInt64(v any) int64 {
	switch t := v.(type) {
	case int64:
		return t
	case int:
		return int64(t)
	case string:
		var n int64
		fmt.Sscan(t, &n)
		return n
	default:
		return 0
	}
}

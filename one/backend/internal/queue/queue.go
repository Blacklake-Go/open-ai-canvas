package queue

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	GenerationNotifyChannel = "one_generation_events"
	DefaultLeaseDuration    = 45 * time.Second
)

// ClaimNextCreationSQL uses PostgreSQL FOR UPDATE SKIP LOCKED with 45s lease recovery
// on `ai_studio.creations` (`poll_locked_until`, `metadata_json`) so multiple Go workers
// never collide or double-claim against Supdance Pro's real 4-schema DDL.
const ClaimNextCreationSQL = `
WITH candidate AS (
	SELECT id
	FROM ai_studio.creations
	WHERE status = 'queued'
	   OR (status = 'processing' AND (poll_locked_until IS NULL OR poll_locked_until <= NOW()) AND (next_poll_at IS NULL OR next_poll_at <= NOW()))
	ORDER BY created_at ASC
	LIMIT 1
	FOR UPDATE SKIP LOCKED
)
UPDATE ai_studio.creations c
SET status = 'processing',
	poll_locked_until = NOW() + ($2 * INTERVAL '1 second'),
	metadata_json = COALESCE(c.metadata_json, '{}'::jsonb) || jsonb_build_object('leaseOwner', $1::text),
	updated_at = NOW()
FROM candidate
WHERE c.id = candidate.id
RETURNING
	c.id,
	c.user_id,
	COALESCE(c.model, '') AS model_id,
	c.status,
	COALESCE(c.input_summary_json->>'prompt', c.label, '') AS prompt,
	c.created_at;
`

type ClaimedJob struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	ModelID   string    `json:"modelId"`
	Status    string    `json:"status"`
	Prompt    string    `json:"prompt"`
	CreatedAt time.Time `json:"createdAt"`
}

func ClaimNextCreation(ctx context.Context, pool *pgxpool.Pool, workerID string, lease time.Duration) (*ClaimedJob, error) {
	if pool == nil {
		return nil, errors.New("queue pool is nil")
	}
	if lease <= 0 {
		lease = DefaultLeaseDuration
	}
	var job ClaimedJob
	err := pool.QueryRow(ctx, ClaimNextCreationSQL, workerID, int(lease.Seconds())).Scan(
		&job.ID, &job.UserID, &job.ModelID, &job.Status, &job.Prompt, &job.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &job, nil
}

type GenerationEvent struct {
	Type      string `json:"type"`
	UserID    string `json:"userId"`
	TaskID    string `json:"taskId,omitempty"`
	Status    string `json:"status,omitempty"`
	Progress  int    `json:"progress,omitempty"`
	Timestamp int64  `json:"timestamp"`
}

type subscriber struct {
	userID string
	taskID string
	ch     chan GenerationEvent
}

// EventHub replaces Supdance Pro's single-process `InMemoryRealtimeEmitter`.
// Locally it fans out directly to connected SSE streams, and when wired to PG
// `LISTEN/NOTIFY` (`one_generation_events`) every backend replica receives events.
type EventHub struct {
	mu   sync.RWMutex
	subs map[uint64]*subscriber
	seq  uint64
}

func NewEventHub() *EventHub {
	return &EventHub{
		subs: make(map[uint64]*subscriber),
	}
}

func (h *EventHub) Subscribe(userID, taskID string) (<-chan GenerationEvent, func()) {
	h.mu.Lock()
	h.seq++
	id := h.seq
	ch := make(chan GenerationEvent, 32)
	h.subs[id] = &subscriber{userID: userID, taskID: taskID, ch: ch}
	h.mu.Unlock()

	unsub := func() {
		h.mu.Lock()
		if sub, ok := h.subs[id]; ok {
			delete(h.subs, id)
			close(sub.ch)
		}
		h.mu.Unlock()
	}
	return ch, unsub
}

func (h *EventHub) PublishLocal(ev GenerationEvent) {
	if ev.Timestamp == 0 {
		ev.Timestamp = time.Now().UnixMilli()
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, sub := range h.subs {
		if sub.userID != ev.UserID {
			continue
		}
		if sub.taskID != "" && ev.TaskID != sub.taskID {
			continue
		}
		select {
		case sub.ch <- ev:
		default:
			// drop slowest consumer frame instead of stalling publisher
		}
	}
}

func (h *EventHub) PublishPG(ctx context.Context, pool *pgxpool.Pool, ev GenerationEvent) error {
	if ev.Timestamp == 0 {
		ev.Timestamp = time.Now().UnixMilli()
	}
	if pool == nil {
		h.PublishLocal(ev)
		return nil
	}
	raw, err := json.Marshal(ev)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `SELECT pg_notify($1, $2)`, GenerationNotifyChannel, string(raw))
	return err
}

// ListenLoop subscribes to PostgreSQL `LISTEN one_generation_events` and routes
// notifications to local SSE subscribers until ctx is cancelled.
func (h *EventHub) ListenLoop(ctx context.Context, pool *pgxpool.Pool) error {
	if pool == nil {
		return errors.New("pool is required for PG LISTEN")
	}
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire listen conn: %w", err)
	}
	defer conn.Release()

	if _, err := conn.Exec(ctx, "LISTEN "+GenerationNotifyChannel); err != nil {
		return fmt.Errorf("listen %s: %w", GenerationNotifyChannel, err)
	}
	for {
		notif, err := conn.Conn().WaitForNotification(ctx)
		if err != nil {
			return err
		}
		var ev GenerationEvent
		if err := json.Unmarshal([]byte(notif.Payload), &ev); err != nil {
			continue
		}
		h.PublishLocal(ev)
	}
}

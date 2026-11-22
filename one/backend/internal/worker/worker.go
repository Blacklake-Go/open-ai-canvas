// Package worker implements the background generation queue runner, lease recovery,
// worker heartbeat, expired reservation reclamation, and periodic housekeepers.
package worker

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"one/backend/internal/domain/billing"
	"one/backend/internal/domain/generation"
	"one/backend/internal/pkg/ids"
	"one/backend/internal/queue"
	"one/backend/internal/storage"
)

const (
	defaultWorkerName   = "generation-worker"
	defaultPollInterval = 2 * time.Second
	maxPollInterval     = 15 * time.Second
	heartbeatInterval   = 15 * time.Second
	housekeepInterval   = 60 * time.Second
	providerProbeEvery  = 5 * time.Minute
	defaultJobTimeout   = 5 * time.Minute
	defaultConcurrency  = 3
)

type Manager struct {
	Pool          *pgxpool.Pool
	Generation    *generation.Service
	Storage       *storage.Service
	Billing       *billing.Service
	Wakeup        <-chan struct{}
	WorkerName    string
	InstanceID    string
	PollInterval  time.Duration
	LeaseDuration time.Duration
	JobTimeout    time.Duration
	Concurrency   int
	ProcessJob    func(ctx context.Context, creationID string) error
}

func defaultInstanceID() string {
	host, err := os.Hostname()
	if err != nil || host == "" {
		host = "node"
	}
	var b [4]byte
	_, _ = rand.Read(b[:])
	return fmt.Sprintf("%s-%d-%s", host, os.Getpid(), hex.EncodeToString(b[:]))
}

func (m *Manager) normalizeDefaults() {
	if m.WorkerName == "" {
		m.WorkerName = defaultWorkerName
	}
	if m.InstanceID == "" {
		m.InstanceID = defaultInstanceID()
	}
	if m.PollInterval <= 0 {
		m.PollInterval = defaultPollInterval
	}
	if m.LeaseDuration <= 0 {
		m.LeaseDuration = queue.DefaultLeaseDuration
	}
	if m.JobTimeout <= 0 {
		m.JobTimeout = defaultJobTimeout
	}
	if m.Concurrency <= 0 {
		m.Concurrency = defaultConcurrency
	}
}

// Run starts the heartbeat, claim/dispatch loop, and periodic housekeepers until ctx is cancelled,
// then waits for in-flight jobs to drain cleanly.
func (m *Manager) Run(ctx context.Context) {
	if m == nil || m.Pool == nil {
		<-ctx.Done()
		return
	}
	m.normalizeDefaults()

	startedAt := time.Now().UTC()
	m.recordHeartbeat(ctx, startedAt)

	sem := make(chan struct{}, m.Concurrency)
	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		hbTicker := time.NewTicker(heartbeatInterval)
		defer hbTicker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-hbTicker.C:
				hbCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
				m.recordHeartbeat(hbCtx, startedAt)
				cancel()
			}
		}
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		hkTicker := time.NewTicker(housekeepInterval)
		defer hkTicker.Stop()
		var lastProbe time.Time
		for {
			select {
			case <-ctx.Done():
				return
			case <-hkTicker.C:
				hkCtx, cancel := context.WithTimeout(ctx, 45*time.Second)
				m.RunHousekeeping(hkCtx)
				if time.Since(lastProbe) >= providerProbeEvery {
					m.probeStaleProviders(hkCtx)
					lastProbe = time.Now()
				}
				cancel()
			}
		}
	}()

	backoff := m.PollInterval
	for {
		if ctx.Err() != nil {
			break
		}
		select {
		case sem <- struct{}{}:
		case <-ctx.Done():
			goto drain
		}

		claimCtx, cancelClaim := context.WithTimeout(ctx, 5*time.Second)
		job, err := queue.ClaimNextCreation(claimCtx, m.Pool, m.InstanceID, m.LeaseDuration)
		cancelClaim()
		if err != nil {
			<-sem
			if ctx.Err() == nil {
				log.Printf("worker claim error: %v", err)
			}
			backoff = nextBackoff(backoff)
			waitForPoll(ctx, backoff, m.Wakeup)
			continue
		}
		if job == nil {
			<-sem
			backoff = nextBackoff(backoff)
			waitForPoll(ctx, backoff, m.Wakeup)
			continue
		}

		backoff = m.PollInterval
		wg.Add(1)
		go func(j *queue.ClaimedJob) {
			defer wg.Done()
			defer func() { <-sem }()
			m.runClaimedJob(ctx, j)
		}(job)
	}

drain:
	wg.Wait()
}

func (m *Manager) runClaimedJob(ctx context.Context, job *queue.ClaimedJob) {
	jobCtx, cancel := context.WithTimeout(ctx, m.JobTimeout)
	defer cancel()

	defer func() {
		if r := recover(); r != nil {
			log.Printf("worker panic handling creation %s: %v", job.ID, r)
			if m.Generation != nil {
				_ = m.Generation.FinalizeFailure(context.Background(), job.ID, "failed", "", "", "WORKER_PANIC", fmt.Sprint(r))
			}
		}
	}()

	fn := m.ProcessJob
	if fn == nil && m.Generation != nil {
		fn = m.Generation.ProcessCreation
	}
	if fn == nil {
		return
	}
	if err := fn(jobCtx, job.ID); err != nil && ctx.Err() == nil {
		log.Printf("worker job %s error: %v", job.ID, err)
	}
}

func (m *Manager) recordHeartbeat(ctx context.Context, startedAt time.Time) {
	if m.Pool == nil {
		return
	}
	_, _ = m.Pool.Exec(ctx, `
		INSERT INTO sys_core.worker_heartbeats (worker_name, instance_id, process_id, started_at, last_seen_at)
		VALUES ($1, $2, $3, $4, now())
		ON CONFLICT (worker_name, instance_id)
		DO UPDATE SET process_id = EXCLUDED.process_id, last_seen_at = now()`,
		m.WorkerName, m.InstanceID, os.Getpid(), startedAt)
}

// RunHousekeeping releases expired credit reservations, fails overdue queued/processing creations,
// and advances active storage migration runs.
func (m *Manager) RunHousekeeping(ctx context.Context) {
	if m == nil || m.Pool == nil {
		return
	}
	m.releaseExpiredReservations(ctx)
	m.expireOverdueCreations(ctx)
	m.advanceRunningMigration(ctx)
	m.reconcilePendingPaymentOrders(ctx)
	m.processExpiredDeletions(ctx)
}

func (m *Manager) releaseExpiredReservations(ctx context.Context) {
	rows, err := m.Pool.Query(ctx, `
		SELECT r.id
		FROM ops_bill.credit_reservations r
		WHERE r.status IN ('HELD', 'PENDING')
		  AND r.expires_at < now()
		  AND NOT EXISTS (
			SELECT 1 FROM ai_studio.creations c
			WHERE c.reservation_id = r.id AND c.status IN ('queued', 'processing')
		  )
		ORDER BY r.expires_at ASC
		LIMIT 50`)
	if err != nil {
		return
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil && id != "" {
			ids = append(ids, id)
		}
	}
	rows.Close()

	for _, id := range ids {
		tx, err := m.Pool.Begin(ctx)
		if err != nil {
			continue
		}
		_, err = generation.VoidCredits(ctx, tx, id, "expired reservation cleanup", false, false)
		if err == nil {
			_ = tx.Commit(ctx)
		} else {
			_ = tx.Rollback(ctx)
		}
	}
}

func (m *Manager) expireOverdueCreations(ctx context.Context) {
	if m.Generation == nil {
		return
	}
	rows, err := m.Pool.Query(ctx, `
		SELECT id FROM ai_studio.creations
		WHERE (status = 'queued' AND created_at < now() - interval '30 minutes')
		   OR (status = 'processing' AND COALESCE(started_at, created_at) < now() - interval '24 hours')
		ORDER BY created_at ASC
		LIMIT 25`)
	if err != nil {
		return
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil && id != "" {
			ids = append(ids, id)
		}
	}
	rows.Close()

	for _, id := range ids {
		_ = m.Generation.FinalizeFailure(ctx, id, "failed", "", "", "TASK_TIMEOUT", "生成任务超时未完成")
	}
}

func (m *Manager) advanceRunningMigration(ctx context.Context) {
	if m.Storage == nil {
		return
	}
	var runID string
	err := m.Pool.QueryRow(ctx, `
		SELECT id FROM ai_studio.storage_migration_runs
		WHERE status = 'running' ORDER BY created_at ASC LIMIT 1`).Scan(&runID)
	if err != nil || err == pgx.ErrNoRows || runID == "" {
		return
	}
	_, _ = m.Storage.AdvanceMigration(ctx, runID, 10)
}

func (m *Manager) probeStaleProviders(ctx context.Context) {
	if m.Generation == nil {
		return
	}
	rows, err := m.Pool.Query(ctx, `
		SELECT id FROM ai_studio.ai_providers
		WHERE enabled = true
		  AND (last_health_check_at IS NULL OR last_health_check_at < now() - interval '5 minutes')
		ORDER BY priority DESC, id ASC
		LIMIT 5`)
	if err != nil {
		return
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil && id != "" {
			ids = append(ids, id)
		}
	}
	rows.Close()

	for _, id := range ids {
		_, _ = m.Generation.ProbeProvider(ctx, id)
	}
}

func (m *Manager) reconcilePendingPaymentOrders(ctx context.Context) {
	if m.Billing == nil {
		return
	}
	_, _ = m.Billing.ReconcilePendingOrders(ctx, 20)
}

func (m *Manager) processExpiredDeletions(ctx context.Context) {
	rows, err := m.Pool.Query(ctx, `
		SELECT id FROM auth_usr.users
		WHERE status = 'deletion_pending'
		  AND deletion_due_at IS NOT NULL
		  AND deletion_due_at <= now()
		ORDER BY deletion_due_at ASC
		LIMIT 20`)
	if err != nil {
		return
	}
	defer rows.Close()

	var userIDs []string
	for rows.Next() {
		var uid string
		if rows.Scan(&uid) == nil && uid != "" {
			userIDs = append(userIDs, uid)
		}
	}
	rows.Close()

	for _, uid := range userIDs {
		tx, err := m.Pool.Begin(ctx)
		if err != nil {
			continue
		}
		_, _ = tx.Exec(ctx, `DELETE FROM auth_usr.sessions WHERE user_id = $1`, uid)
		_, _ = tx.Exec(ctx, `DELETE FROM auth_usr.auth_accounts WHERE user_id = $1`, uid)
		tag, err := tx.Exec(ctx, `
			UPDATE auth_usr.users
			SET status = 'deleted',
			    is_active = FALSE,
			    email = NULL,
			    phone = NULL,
			    password_hash = NULL,
			    password_salt = NULL,
			    avatar_url = NULL,
			    display_name = '已注销用户',
			    username = 'deleted_' || id,
			    updated_at = now()
			WHERE id = $1 AND status = 'deletion_pending'`, uid)
		if err != nil || tag.RowsAffected() == 0 {
			_ = tx.Rollback(ctx)
			continue
		}
		aeID, _ := ids.NewPrefixedID("ae")
		_, _ = tx.Exec(ctx, `
			INSERT INTO sys_core.auth_events (id, event_type, target, metadata_json, created_at)
			VALUES ($1, 'ACCOUNT_DELETION_COMPLETED', $2, '{"source":"worker"}'::jsonb, now())`, aeID, uid)
		_ = tx.Commit(ctx)
	}
}

func nextBackoff(current time.Duration) time.Duration {
	if current <= 0 {
		return defaultPollInterval
	}
	n := current * 2
	if n > maxPollInterval {
		return maxPollInterval
	}
	return n
}

func waitForPoll(ctx context.Context, d time.Duration, wakeup <-chan struct{}) {
	timer := time.NewTimer(d)
	defer timer.Stop()
	if wakeup == nil {
		select {
		case <-ctx.Done():
		case <-timer.C:
		}
		return
	}
	select {
	case <-ctx.Done():
	case <-wakeup:
	case <-timer.C:
	}
}

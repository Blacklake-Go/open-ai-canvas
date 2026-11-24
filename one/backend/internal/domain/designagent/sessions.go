package designagent

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"one/backend/internal/domain/agenttext"
)

var ErrHistoryConflict = errors.New("design agent history changed")
var ErrTurnPending = errors.New("design agent turn is running")

type Sessions struct {
	Pool *pgxpool.Pool
}

type Session struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type History struct {
	Messages json.RawMessage `json:"messages"`
	Revision int             `json:"revision"`
}

type Asset struct {
	Label string `json:"asset_label"`
	URL   string `json:"url"`
	Kind  string `json:"kind"`
}

func (s Sessions) List(ctx context.Context, owner string) ([]Session, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT id::text AS id, name, created_at, updated_at
		FROM ai_studio.design_agent_sessions WHERE user_id = $1
		ORDER BY updated_at DESC, id DESC`, owner)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByName[Session])
}

func (s Sessions) Create(ctx context.Context, owner, key, name string) (Session, error) {
	var item Session
	err := s.Pool.QueryRow(ctx, `
		INSERT INTO ai_studio.design_agent_sessions (user_id, creation_key, name)
		VALUES ($1, $2::uuid, $3)
		ON CONFLICT (user_id, creation_key) DO UPDATE SET creation_key = EXCLUDED.creation_key
		RETURNING id::text, name, created_at, updated_at`, owner, key, name).
		Scan(&item.ID, &item.Name, &item.CreatedAt, &item.UpdatedAt)
	return item, err
}

func (s Sessions) Rename(ctx context.Context, owner, id, name string) (Session, error) {
	var item Session
	err := s.Pool.QueryRow(ctx, `
		UPDATE ai_studio.design_agent_sessions SET name = $3, updated_at = now()
		WHERE user_id = $1 AND id = $2::uuid
		RETURNING id::text, name, created_at, updated_at`, owner, id, name).
		Scan(&item.ID, &item.Name, &item.CreatedAt, &item.UpdatedAt)
	return item, err
}

func (s Sessions) Delete(ctx context.Context, owner, id string) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := LockSession(ctx, tx, owner, id); err != nil {
		return err
	}
	var pending bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM ai_studio.creations WHERE user_id = $1 AND studio_id = 'design-agent:' || $2::uuid::text
			AND status IN ('queued','processing') AND deleted_at IS NULL)`, owner, id).Scan(&pending); err != nil {
		return err
	}
	if pending {
		return ErrTurnPending
	}
	if _, err := tx.Exec(ctx, `DELETE FROM ai_studio.design_agent_sessions WHERE user_id = $1 AND id = $2::uuid`, owner, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func LockSession(ctx context.Context, tx pgx.Tx, owner, id string) error {
	var found bool
	return tx.QueryRow(ctx, `SELECT true FROM ai_studio.design_agent_sessions WHERE user_id = $1 AND id = $2::uuid FOR UPDATE`, owner, id).
		Scan(&found)
}

func (s Sessions) GetHistory(ctx context.Context, owner, id string) (History, error) {
	var history History
	err := s.Pool.QueryRow(ctx, `
		SELECT messages, message_revision FROM ai_studio.design_agent_sessions
		WHERE user_id = $1 AND id = $2::uuid`, owner, id).Scan(&history.Messages, &history.Revision)
	return history, err
}

func (s Sessions) SaveHistory(ctx context.Context, owner, id string, revision int, messages json.RawMessage) (History, error) {
	var history History
	err := s.Pool.QueryRow(ctx, `
		UPDATE ai_studio.design_agent_sessions
		SET messages = $4::jsonb, message_revision = message_revision + 1, updated_at = now()
		WHERE user_id = $1 AND id = $2::uuid AND message_revision = $3
		RETURNING messages, message_revision`, owner, id, revision, messages).
		Scan(&history.Messages, &history.Revision)
	if errors.Is(err, pgx.ErrNoRows) {
		_, readErr := s.GetHistory(ctx, owner, id)
		if readErr == nil {
			return history, ErrHistoryConflict
		}
		return history, readErr
	}
	return history, err
}

func (s Sessions) Owns(ctx context.Context, owner, id string) error {
	var found bool
	return s.Pool.QueryRow(ctx, `
		SELECT true FROM ai_studio.design_agent_sessions WHERE user_id = $1 AND id = $2::uuid`,
		owner, id).Scan(&found)
}

func (s Sessions) ListAssets(ctx context.Context, owner, id string) ([]Asset, error) {
	if err := s.Owns(ctx, owner, id); err != nil {
		return nil, err
	}
	rows, err := s.Pool.Query(ctx, `
		SELECT a.id AS label, '/api/assets/' || a.id || '/download?inline=1' AS url,
		       COALESCE(NULLIF(a.kind, ''), a.asset_type) AS kind
		FROM ai_studio.user_assets a
		JOIN ai_studio.design_agent_sessions s ON s.user_id = a.user_id AND a.studio_id = 'design-agent:' || s.id::text
		WHERE s.user_id = $1 AND s.id = $2::uuid AND a.deleted_at IS NULL AND a.status = 'ready'
		ORDER BY a.created_at ASC, a.id ASC`, owner, id)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByName[Asset])
}

func (s Sessions) ListJobs(ctx context.Context, owner, id string) ([]agenttext.Job, error) {
	if err := s.Owns(ctx, owner, id); err != nil {
		return nil, err
	}
	return agenttext.ListJobs(ctx, s.Pool, owner, "design-agent:"+strings.ToLower(id))
}

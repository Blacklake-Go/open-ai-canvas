package community

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotImplemented = errors.New("community domain repository not initialized")
	ErrNotFound       = errors.New("community work not found")
	ErrForbidden      = errors.New("forbidden or missing community work")
)

type Work struct {
	ID       string `json:"id"`
	AuthorID string `json:"author_id"`
	Title    string `json:"title"`
	Status   string `json:"status"`
}

type Repository interface {
	GetWork(ctx context.Context, workID string) (*Work, error)
	DeleteWork(ctx context.Context, workID, actorUserID string, isAdmin bool) error
}

type PGRepository struct {
	Pool *pgxpool.Pool
}

func (r *PGRepository) GetWork(ctx context.Context, workID string) (*Work, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	var out Work
	err := r.Pool.QueryRow(ctx, `
		SELECT id, user_id, COALESCE(title, ''), COALESCE(status, 'published')
		FROM ai_studio.community_posts
		WHERE id = $1`, workID).
		Scan(&out.ID, &out.AuthorID, &out.Title, &out.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (r *PGRepository) DeleteWork(ctx context.Context, workID, actorUserID string, isAdmin bool) error {
	if r == nil || r.Pool == nil {
		return ErrNotImplemented
	}
	var deletedCount int64
	var err error
	if isAdmin {
		err = r.Pool.QueryRow(ctx, `WITH d AS (DELETE FROM ai_studio.community_posts WHERE id=$1 RETURNING 1) SELECT COUNT(*) FROM d`, workID).Scan(&deletedCount)
	} else {
		err = r.Pool.QueryRow(ctx, `WITH d AS (DELETE FROM ai_studio.community_posts WHERE id=$1 AND user_id=$2 RETURNING 1) SELECT COUNT(*) FROM d`, workID, actorUserID).Scan(&deletedCount)
	}
	if err != nil {
		return err
	}
	if deletedCount == 0 {
		return ErrForbidden
	}
	return nil
}

type Service struct {
	Repo Repository
}

func (s *Service) GetWork(ctx context.Context, workID string) (*Work, error) {
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	return s.Repo.GetWork(ctx, workID)
}

func (s *Service) DeleteWork(ctx context.Context, workID, actorUserID string, isAdmin bool) error {
	if s.Repo == nil {
		return ErrNotImplemented
	}
	return s.Repo.DeleteWork(ctx, workID, actorUserID, isAdmin)
}

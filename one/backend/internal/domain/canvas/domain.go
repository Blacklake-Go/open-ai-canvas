package canvas

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotImplemented = errors.New("canvas domain repository not initialized")
	ErrUnauthorized   = errors.New("canvas session token invalid or expired")
)

type TokenSession struct {
	UserID   string `json:"user_id"`
	Scopes   string `json:"scopes"`
	IssuedAt int64  `json:"issued_at"`
}

type Repository interface {
	ValidateCanvasToken(ctx context.Context, token string) (*TokenSession, error)
}

type PGRepository struct {
	Pool *pgxpool.Pool
}

func (r *PGRepository) ValidateCanvasToken(ctx context.Context, token string) (*TokenSession, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	if token == "" {
		return nil, ErrUnauthorized
	}
	sum := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(sum[:])

	var sess TokenSession
	err := r.Pool.QueryRow(ctx, `
		SELECT s.user_id, COALESCE(u.role, 'user'), EXTRACT(EPOCH FROM s.created_at)::bigint
		FROM auth_usr.sessions s
		JOIN auth_usr.users u ON u.id = s.user_id
		WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`, tokenHash).
		Scan(&sess.UserID, &sess.Scopes, &sess.IssuedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUnauthorized
	}
	if err != nil {
		return nil, err
	}
	return &sess, nil
}

type Service struct {
	Repo Repository
}

func (s *Service) ValidateToken(ctx context.Context, token string) (*TokenSession, error) {
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	return s.Repo.ValidateCanvasToken(ctx, token)
}

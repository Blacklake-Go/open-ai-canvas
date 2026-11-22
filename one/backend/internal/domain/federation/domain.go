package federation

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotImplemented = errors.New("federation domain repository not initialized")
	ErrUnauthorized   = errors.New("federation session token invalid or expired")
)

type FederationSession struct {
	ClientID string `json:"client_id"`
	UserID   string `json:"user_id"`
	Status   string `json:"status"`
}

type Repository interface {
	VerifyFederationToken(ctx context.Context, token string) (*FederationSession, error)
}

type PGRepository struct {
	Pool *pgxpool.Pool
}

func (r *PGRepository) VerifyFederationToken(ctx context.Context, token string) (*FederationSession, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	if token == "" {
		return nil, ErrUnauthorized
	}
	sum := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(sum[:])

	var sess FederationSession
	err := r.Pool.QueryRow(ctx, `
		SELECT s.id, s.user_id, COALESCE(u.status, 'active')
		FROM auth_usr.sessions s
		JOIN auth_usr.users u ON u.id = s.user_id
		WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`, tokenHash).
		Scan(&sess.ClientID, &sess.UserID, &sess.Status)
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

func (s *Service) VerifyToken(ctx context.Context, token string) (*FederationSession, error) {
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	return s.Repo.VerifyFederationToken(ctx, token)
}

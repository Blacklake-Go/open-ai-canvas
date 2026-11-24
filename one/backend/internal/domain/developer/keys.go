package developer

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const keyPrefix = "sk-one-"

var (
	ErrInvalidKey = errors.New("invalid developer key")
	ErrKeyChanged = errors.New("developer key has changed")
)

type KeyInfo struct {
	ID        string    `json:"id"`
	Suffix    string    `json:"suffix"`
	CreatedAt time.Time `json:"createdAt"`
}

type Store struct {
	Pool *pgxpool.Pool
}

func (s Store) CurrentKey(ctx context.Context, owner string) (*KeyInfo, error) {
	info, err := scanKeyInfo(s.Pool.QueryRow(ctx, `
		SELECT id::text, suffix, created_at
		FROM auth_usr.developer_api_keys WHERE user_id = $1`, owner))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return info, err
}

func (s Store) IssueKey(ctx context.Context, owner, previousID string) (*KeyInfo, string, error) {
	var entropy [32]byte
	if _, err := rand.Read(entropy[:]); err != nil {
		return nil, "", err
	}
	key := keyPrefix + hex.EncodeToString(entropy[:])
	digest := sha256.Sum256([]byte(key))
	suffix := key[len(key)-8:]
	var row pgx.Row
	if previousID == "" {
		row = s.Pool.QueryRow(ctx, `
			INSERT INTO auth_usr.developer_api_keys (user_id, token_hash, suffix)
			SELECT id, $2, $3 FROM auth_usr.users WHERE id = $1 AND status = 'active'
			ON CONFLICT (user_id) DO NOTHING
			RETURNING id::text, suffix, created_at`, owner, digest[:], suffix)
	} else {
		row = s.Pool.QueryRow(ctx, `
			UPDATE auth_usr.developer_api_keys k
			SET id = gen_random_uuid(), token_hash = $2, suffix = $3, created_at = now()
			FROM auth_usr.users u
			WHERE k.user_id = $1 AND k.id::text = $4 AND u.id = k.user_id AND u.status = 'active'
			RETURNING k.id::text, k.suffix, k.created_at`, owner, digest[:], suffix, previousID)
	}
	info, err := scanKeyInfo(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, "", ErrKeyChanged
	}
	if err != nil {
		return nil, "", err
	}
	return info, key, nil
}

func (s Store) RevokeKey(ctx context.Context, owner, id string) error {
	tag, err := s.Pool.Exec(ctx, `
		DELETE FROM auth_usr.developer_api_keys WHERE user_id = $1 AND id::text = $2`, owner, id)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrKeyChanged
	}
	return err
}

func (s Store) Authenticate(ctx context.Context, token string) (string, error) {
	suffix, ok := strings.CutPrefix(token, keyPrefix)
	if !ok || len(suffix) != 64 {
		return "", ErrInvalidKey
	}
	if _, err := hex.DecodeString(suffix); err != nil {
		return "", ErrInvalidKey
	}
	digest := sha256.Sum256([]byte(token))
	var owner string
	err := s.Pool.QueryRow(ctx, `
		SELECT k.user_id FROM auth_usr.developer_api_keys k
		JOIN auth_usr.users u ON u.id = k.user_id
		WHERE k.token_hash = $1 AND u.status = 'active'`, digest[:]).Scan(&owner)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrInvalidKey
	}
	return owner, err
}

func scanKeyInfo(row pgx.Row) (*KeyInfo, error) {
	var info KeyInfo
	if err := row.Scan(&info.ID, &info.Suffix, &info.CreatedAt); err != nil {
		return nil, err
	}
	return &info, nil
}

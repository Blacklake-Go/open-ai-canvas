package assets

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotImplemented = errors.New("assets domain repository not initialized")
	ErrNotFound       = errors.New("asset not found")
)

type Asset struct {
	ID                string `json:"id"`
	UserID            string `json:"user_id"`
	Kind              string `json:"kind"`
	StorageKey        string `json:"storage_key"`
	ObjectKey         string `json:"object_key,omitempty"`
	PublicURL         string `json:"public_url,omitempty"`
	Visibility        string `json:"visibility,omitempty"`
	StorageProvider   string `json:"storage_provider,omitempty"`
	StorageLocationID string `json:"storage_location_id,omitempty"`
	Bucket            string `json:"bucket,omitempty"`
	Region            string `json:"region,omitempty"`
	MIMEType          string `json:"mime_type,omitempty"`
	Filename          string `json:"-"`
	Size              int64  `json:"size,omitempty"`
}

type Repository interface {
	GetAsset(ctx context.Context, userID, assetID string) (*Asset, error)
}

type PGRepository struct {
	Pool *pgxpool.Pool
}

func (r *PGRepository) GetAsset(ctx context.Context, userID, assetID string) (*Asset, error) {
	if r == nil || r.Pool == nil {
		return nil, ErrNotImplemented
	}
	var out Asset
	err := r.Pool.QueryRow(ctx, `
		SELECT id, user_id,
		       COALESCE(asset_type, 'image'),
		       COALESCE(object_key, media_url, ''),
		       COALESCE(object_key, ''),
		       COALESCE(media_url, ''),
		       COALESCE(visibility, 'private'),
		       COALESCE(storage_provider, ''),
		       COALESCE(storage_location_id, ''),
		       COALESCE(bucket, ''),
		       COALESCE(region, ''),
		       COALESCE(mime_type, ''),
		       COALESCE(NULLIF(original_filename,''), NULLIF(filename,''), ''),
		       COALESCE(file_size_bytes, 0)
		FROM ai_studio.user_assets
		WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, assetID, userID).
		Scan(&out.ID, &out.UserID, &out.Kind, &out.StorageKey, &out.ObjectKey, &out.PublicURL,
			&out.Visibility, &out.StorageProvider, &out.StorageLocationID, &out.Bucket, &out.Region, &out.MIMEType, &out.Filename, &out.Size)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &out, nil
}

type Service struct {
	Repo Repository
}

func (s *Service) GetAsset(ctx context.Context, userID, assetID string) (*Asset, error) {
	if s.Repo == nil {
		return nil, ErrNotImplemented
	}
	return s.Repo.GetAsset(ctx, userID, assetID)
}

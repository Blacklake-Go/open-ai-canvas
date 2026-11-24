package assets

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotTrashed = errors.New("asset is not in trash")

type ReferenceError struct {
	Sources []string
}

func (e *ReferenceError) Error() string { return "asset is referenced" }

type DeleteObject func(context.Context, string, string, string, string, string) error

// Purge locks an owner's trashed asset, checks its references and removes its
// stored files before deleting the record. Storage deletion is idempotent so a
// retry can finish after a storage error or interrupted database commit.
func Purge(ctx context.Context, pool *pgxpool.Pool, owner, id string, deleteObject DeleteObject) error {
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		var status, provider, location, bucket, region, objectKey, previewKey, thumbnailKey string
		var projectID, creationID string
		err := tx.QueryRow(ctx, `
			SELECT status, COALESCE(storage_provider,''), COALESCE(storage_location_id,''), COALESCE(bucket,''),
			       COALESCE(region,''), COALESCE(object_key,''), COALESCE(preview_object_key,''),
			       COALESCE(thumbnail_object_key,''), COALESCE(asset_data->>'canvasProjectId',''), COALESCE(creation_id,'')
			FROM ai_studio.user_assets WHERE id=$1 AND user_id=$2 FOR UPDATE`, id, owner).
			Scan(&status, &provider, &location, &bucket, &region, &objectKey, &previewKey, &thumbnailKey, &projectID, &creationID)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		if status != "trash" {
			return ErrNotTrashed
		}
		var keys []string
		seen := map[string]bool{}
		for _, key := range []string{objectKey, previewKey, thumbnailKey} {
			if strings.TrimSpace(key) != "" && !seen[key] {
				keys = append(keys, key)
				seen[key] = true
			}
		}
		sources, err := assetReferences(ctx, tx, owner, id, projectID, creationID, keys)
		if err != nil {
			return err
		}
		if len(sources) != 0 {
			return &ReferenceError{Sources: sources}
		}
		for _, key := range keys {
			if err := deleteObject(ctx, provider, location, bucket, region, key); err != nil {
				return err
			}
		}
		_, err = tx.Exec(ctx, `DELETE FROM ai_studio.user_assets WHERE id=$1 AND user_id=$2 AND status='trash'`, id, owner)
		return err
	})
}

func assetReferences(ctx context.Context, tx pgx.Tx, owner, id, projectID, creationID string, keys []string) ([]string, error) {
	// The JSON snapshots store asset IDs both as scalar fields and in media
	// URLs, so search for the full identifier in the known reference fields.
	rows, err := tx.Query(ctx, `
		SELECT source FROM (VALUES
		  ('canvas', EXISTS (SELECT 1 FROM ai_studio.canvas_projects p
		    WHERE p.owner_user_id=$2 AND p.deleted_at IS NULL
		      AND (p.id=NULLIF($3,'') OR p.thumbnail_asset_id=$1 OR strpos(p.snapshot_json::text,$1)>0
		           OR EXISTS (SELECT 1 FROM ai_studio.canvas_project_versions v WHERE v.project_id=p.id AND strpos(v.snapshot_json::text,$1)>0)))
		    OR EXISTS (SELECT 1 FROM ai_studio.canvas_project_jobs j WHERE j.owner_user_id=$2 AND j.result_asset_id=$1)),
		  ('creation', EXISTS (SELECT 1 FROM ai_studio.creations c WHERE c.user_id=$2 AND c.deleted_at IS NULL
		    AND (c.asset_id=$1 OR strpos(c.input_summary_json::text,$1)>0 OR strpos(c.metadata_json::text,$1)>0
		         OR c.result_object_key=ANY($5) OR c.storage_preview_object_key=ANY($5) OR c.storage_thumbnail_object_key=ANY($5)))),
		  ('workflow', EXISTS (SELECT 1 FROM ai_studio.one_workflow_runs w WHERE w.owner_user_id=$2
		    AND (strpos(w.steps::text,$1)>0 OR strpos(w.input,$1)>0))),
		  ('agent', EXISTS (SELECT 1 FROM ai_studio.design_agent_sessions s WHERE s.user_id=$2 AND strpos(s.messages::text,$1)>0)),
		  ('community', EXISTS (SELECT 1 FROM ai_studio.community_posts p WHERE p.user_id=$2
		    AND (p.creation_id=NULLIF($4,'') OR strpos(p.media_url,$1)>0 OR strpos(p.cover_url,$1)>0 OR strpos(p.parameters::text,$1)>0))),
		  ('sync', EXISTS (SELECT 1 FROM ai_studio.asset_sync_links s WHERE s.asset_id=$1)),
		  ('asset', EXISTS (SELECT 1 FROM ai_studio.user_assets a WHERE a.id<>$1
		    AND (a.original_asset_id=$1 OR a.preview_asset_id=$1 OR a.thumbnail_asset_id=$1 OR a.object_key=ANY($5)
		         OR a.preview_object_key=ANY($5) OR a.thumbnail_object_key=ANY($5)
		         OR (a.user_id=$2 AND strpos(a.asset_data::text,$1)>0))))
		) AS references_found(source, present) WHERE present`, id, owner, projectID, creationID, keys)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return pgx.CollectRows(rows, pgx.RowTo[string])
}

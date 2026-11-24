package handler

import (
	"context"
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"one/backend/internal/domain/assets"
	"one/backend/internal/pkg/envelope"
)

type assetLibraryFacets struct{ kind, category, folder map[string]int }

func coreLibraryFacets(ctx context.Context, pool *pgxpool.Pool, owner, status string) (assetLibraryFacets, error) {
	result := assetLibraryFacets{kind: map[string]int{}, category: map[string]int{}, folder: map[string]int{}}
	rows, err := pool.Query(ctx, `
		SELECT CASE WHEN GROUPING(kind)=0 THEN 'kind' WHEN GROUPING(category)=0 THEN 'category' ELSE 'folder' END,
		       CASE WHEN GROUPING(kind)=0 THEN COALESCE(kind, asset_type, 'image')
		            WHEN GROUPING(category)=0 THEN COALESCE(category, 'other')
		            ELSE COALESCE(folder_id,'uncategorized') END,
		       COUNT(*)::int
		FROM ai_studio.user_assets
		WHERE user_id=$1 AND status=$2 AND ($2='trash' OR deleted_at IS NULL)
		GROUP BY GROUPING SETS ((kind, asset_type), (category), (folder_id))`, owner, status)
	if err != nil {
		return result, err
	}
	defer rows.Close()
	for rows.Next() {
		var facet, value string
		var count int
		if err := rows.Scan(&facet, &value, &count); err != nil {
			return result, err
		}
		switch facet {
		case "kind":
			result.kind[value] += count
			result.kind["all"] += count
		case "category":
			result.category[value] += count
			result.category["all"] += count
		case "folder":
			result.folder[value] += count
		}
	}
	return result, rows.Err()
}

type assetFolderReader interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}

func coreCheckAssetFolder(r *http.Request, w http.ResponseWriter, format envelope.Format, db assetFolderReader, owner, folder string) bool {
	if folder == "" {
		return true
	}
	var name string
	err := db.QueryRow(r.Context(), `SELECT name FROM ai_studio.asset_folders WHERE id=$1 AND user_id=$2`, folder, owner).Scan(&name)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		coreErr(w, r, format, http.StatusUnprocessableEntity, "FOLDER_NOT_FOUND", "目标文件夹不可用，请刷新后重新选择")
	case err != nil:
		coreErr(w, r, format, http.StatusServiceUnavailable, "FOLDER_READ_FAILED", "暂时无法验证目标文件夹")
	default:
		return true
	}
	return false
}

type assetPurgeFailure struct {
	ID         string   `json:"id"`
	Code       string   `json:"code"`
	References []string `json:"references,omitempty"`
}

func describeAssetPurgeFailure(id string, err error) (int, string, assetPurgeFailure) {
	detail := assetPurgeFailure{ID: id}
	var referenced *assets.ReferenceError
	switch {
	case errors.As(err, &referenced):
		detail.Code, detail.References = "ASSET_IN_USE", referenced.Sources
		return http.StatusConflict, "素材仍在使用，请先解除引用", detail
	case errors.Is(err, assets.ErrNotTrashed):
		detail.Code = "ASSET_NOT_TRASHED"
		return http.StatusConflict, "请先将素材移入回收站", detail
	case errors.Is(err, assets.ErrNotFound):
		detail.Code = "ASSET_NOT_FOUND"
		return http.StatusNotFound, "素材不存在或已删除", detail
	default:
		detail.Code = "ASSET_PURGE_UNAVAILABLE"
		return http.StatusServiceUnavailable, "素材清理未完成，请稍后重试", detail
	}
}

func (d *Dependencies) corePurgeAssets(w http.ResponseWriter, r *http.Request, pool *pgxpool.Pool, owner string, ids []string) {
	removed := []string{}
	failures := []assetPurgeFailure{}
	deleteObject := d.storageSvc(pool).DeleteObject
	for _, id := range ids {
		if err := assets.Purge(r.Context(), pool, owner, id, deleteObject); err != nil {
			_, _, failure := describeAssetPurgeFailure(id, err)
			failures = append(failures, failure)
		} else {
			removed = append(removed, id)
		}
	}
	envelope.DomainJSON(w, http.StatusOK, map[string]any{
		"affected": len(removed), "deleted": len(removed), "deletedIds": removed, "failures": failures,
	})
}

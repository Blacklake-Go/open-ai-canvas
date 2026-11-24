package generation

import (
	"context"
	"errors"
	"log"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"one/backend/internal/storage"
)

// DesignMediaKind limits the canvas composer to published image and video modes.
func DesignMediaKind(mode string) string {
	switch mode {
	case "t2i", "i2i":
		return "image"
	case "t2v", "i2v":
		return "video"
	default:
		return ""
	}
}

func (s *Service) validateDesignMedia(ctx context.Context, tx pgx.Tx, req *CreateTaskRequest, mode, kind string) error {
	invalid := &PricingError{Code: "DESIGN_AGENT_INVALID_INPUT", Status: 422, Message: "请提供提示词和此技能要求的会话素材"}
	referenceMode := mode == "i2i" || mode == "i2v"
	expected := 2
	if kind == "video" {
		expected++
		if seconds, ok := priceNum(req.Parameters["duration"]); !ok || seconds != 5 {
			return invalid
		}
	}
	if referenceMode {
		expected++
	}
	if len(req.Parameters) != expected {
		return invalid
	}
	if referenceMode {
		ref, _ := req.Parameters["image_url"].(string)
		m := reKoyoAssetRef.FindStringSubmatch(ref)
		if len(m) != 2 {
			return invalid
		}
		var provider string
		err := tx.QueryRow(ctx, `
			SELECT COALESCE(storage_provider,'') FROM ai_studio.user_assets
			WHERE id=$1 AND user_id=$2 AND studio_id=$3 AND deleted_at IS NULL
			  AND status='ready' AND storage_status='ready' AND NULLIF(object_key,'') IS NOT NULL
			  AND asset_type='image' AND mime_type IN ('image/png','image/jpeg','image/webp','image/gif','image/avif')`,
			m[1], req.UserID, req.StudioID).Scan(&provider)
		if errors.Is(err, pgx.ErrNoRows) {
			return &PricingError{Code: "DESIGN_AGENT_ASSET_UNAVAILABLE", Status: 422, Message: "请选择当前会话中可用的图片"}
		}
		if err != nil {
			return err
		}
		if storage.NormalizeProvider(provider) == "local" && designReferenceOrigin(s.Config) == nil {
			return &PricingError{Code: "DESIGN_AGENT_REFERENCE_UNAVAILABLE", Status: 503, Message: "当前存储无法向模型提供参考图"}
		}
	}
	var allowed bool
	err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM ai_studio.ai_models m
			JOIN ai_studio.provider_models pm ON pm.model_id=m.id
			JOIN ai_studio.ai_providers p ON p.id=pm.provider_id
			WHERE m.id=$1 AND (m.category=$2 OR ($3='i2i' AND m.category='image_edit'))
			  AND m.status='active' AND m.is_visible AND m.auto_route_eligible
			  AND (m.capabilities->'modes') ? $3
			  AND pm.enabled AND p.enabled AND NULLIF(BTRIM(pm.provider_endpoint),'') IS NOT NULL
			  AND COALESCE(p.circuit_state,'closed') NOT IN ('open','circuit_open'))`, req.ModelID, kind, mode).Scan(&allowed)
	if err != nil {
		return err
	}
	if !allowed {
		return &PricingError{Code: "DESIGN_AGENT_MODEL_UNAVAILABLE", Status: 422, Message: "此技能的模型当前不可用"}
	}
	return nil
}

func designMediaCreation(studioID, mode string) string {
	if strings.HasPrefix(studioID, "design-agent:") {
		return DesignMediaKind(mode)
	}
	return ""
}

func designMediaTypeMatches(kind, mime string) bool {
	switch mime {
	case "image/png", "image/jpeg", "image/webp", "image/gif", "image/avif":
		return kind == "image"
	case "video/mp4", "video/webm", "video/quicktime":
		return kind == "video"
	default:
		return false
	}
}

// Each ingest uses a fresh object key. Remove it after a failed finalization
// only when the database confirms that no committed task or asset points to it.
func (s *Service) discardUnpublishedDesignMedia(ctx context.Context, ing storage.IngestResult) {
	cleanup, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()
	var published bool
	err := s.Pool.QueryRow(cleanup, `
		SELECT EXISTS(SELECT 1 FROM ai_studio.creations WHERE result_object_key=$1)
		    OR EXISTS(SELECT 1 FROM ai_studio.user_assets WHERE object_key=$1)`, ing.ObjectKey).Scan(&published)
	if err != nil || published {
		return
	}
	adapter, _, err := s.Storage.AdapterForLocation(cleanup, ing.Provider, ing.StorageLocationID, ing.Bucket, ing.Region)
	if err != nil || adapter.Delete(cleanup, ing.ObjectKey) != nil {
		log.Print("could not remove unpublished design media")
	}
}

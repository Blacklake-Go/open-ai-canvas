package generation

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"

	"github.com/jackc/pgx/v5/pgxpool"

	"one/backend/internal/config"
	"one/backend/internal/queue"
	"one/backend/internal/storage"
)

var ErrUnsupportedSchemaVersion = errors.New("unsupported canvas schemaVersion")

type ActiveModel struct {
	ID                     string         `json:"id"`
	Name                   string         `json:"name"`
	DisplayName            string         `json:"displayName"`
	Description            string         `json:"description"`
	Badge                  *string        `json:"badge"`
	Category               string         `json:"category"`
	SubType                *string        `json:"subType"`
	Type                   string         `json:"type"`
	Tier                   string         `json:"tier"`
	Provider               string         `json:"provider"`
	CreditsPrice           float64        `json:"creditsPrice"`
	PricingType            *string        `json:"pricingType"`
	SortOrder              int            `json:"sortOrder"`
	IsActive               bool           `json:"isActive"`
	IsPinned               bool           `json:"isPinned"`
	IsFeatured             bool           `json:"isFeatured"`
	IsVisible              bool           `json:"isVisible"`
	AutoRouteEligible      bool           `json:"autoRouteEligible"`
	HasWorkingRoute        bool           `json:"hasWorkingRoute"`
	GenerationCapabilities map[string]any `json:"generationCapabilities"`
}

type ModelRepository interface {
	ListActiveModels(ctx context.Context, userID string) ([]ActiveModel, error)
}

type PGModelRepository struct {
	Pool *pgxpool.Pool
}

func (r *PGModelRepository) ListActiveModels(ctx context.Context, _ string) ([]ActiveModel, error) {
	if r == nil || r.Pool == nil {
		return nil, nil
	}
	// Aligned to Supdance Pro/lib/repositories/models.js (`ai_studio.ai_models` +
	// `ai_studio.model_pricing` + `ai_studio.provider_models` + `ai_studio.ai_providers`).
	const q = `
		WITH eligible_routes AS (
			SELECT
				pm.id AS provider_model_id,
				pm.model_id,
				pm.provider_id,
				pm.priority,
				pm.metadata
			FROM ai_studio.provider_models pm
			JOIN ai_studio.ai_providers p ON p.id = pm.provider_id
			WHERE pm.enabled = TRUE
			  AND NULLIF(BTRIM(pm.provider_endpoint), '') IS NOT NULL
			  AND p.enabled = TRUE
			  AND COALESCE(p.circuit_state, 'closed') NOT IN ('open', 'circuit_open')
		)
		SELECT
			m.id,
			m.name,
			COALESCE(NULLIF(m.display_name, ''), m.name) AS display_name,
			COALESCE(m.description, '') AS description,
			NULLIF(COALESCE(m.capabilities->>'badge', ''), '') AS badge,
			m.category,
			NULLIF(COALESCE(m.capabilities->>'sub_type', ''), '') AS sub_type,
			m.category AS type,
			COALESCE(NULLIF(m.tier, ''), 'backup') AS tier,
			COALESCE(pm.provider_id, 'muapi') AS provider,
			COALESCE(pr.base_credits, 0)::double precision AS credits_price,
			COALESCE(pr.pricing_type, 'fixed') AS pricing_type,
			COALESCE(m.sort, 0)::int AS sort_order,
			(m.status = 'active') AS is_active,
			COALESCE(m.is_pinned, (m.capabilities->>'is_pinned')::boolean, false) AS is_pinned,
			COALESCE((m.capabilities->>'is_featured')::boolean, false) AS is_featured,
			COALESCE(m.is_visible, true) AS is_visible,
			COALESCE(m.auto_route_eligible, false) AS auto_route_eligible,
			(pm.provider_id IS NOT NULL) AS has_working_route,
			COALESCE(m.capabilities, '{}'::jsonb) AS generation_capabilities
		FROM ai_studio.ai_models m
		LEFT JOIN ai_studio.model_pricing pr ON pr.model_id = m.id AND pr.is_active = TRUE
		LEFT JOIN LATERAL (
			SELECT provider_id
			FROM eligible_routes
			WHERE model_id = m.id
			ORDER BY COALESCE((metadata->>'primary')::boolean, false) DESC, priority DESC, provider_model_id ASC
			LIMIT 1
		) pm ON TRUE
		WHERE m.status != 'disabled'
		  AND COALESCE(m.is_visible, true) = TRUE
		ORDER BY
			CASE WHEN COALESCE(m.is_pinned, (m.capabilities->>'is_pinned')::boolean, false) THEN 0 ELSE 1 END,
			CASE m.tier WHEN 'core' THEN 0 WHEN 'backup' THEN 1 ELSE 2 END,
			m.sort ASC,
			m.created_at ASC
	`
	rows, err := r.Pool.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []ActiveModel
	for rows.Next() {
		var m ActiveModel
		var capsRaw json.RawMessage
		if err := rows.Scan(
			&m.ID, &m.Name, &m.DisplayName, &m.Description, &m.Badge, &m.Category, &m.SubType,
			&m.Type, &m.Tier, &m.Provider, &m.CreditsPrice, &m.PricingType,
			&m.SortOrder, &m.IsActive, &m.IsPinned, &m.IsFeatured, &m.IsVisible,
			&m.AutoRouteEligible, &m.HasWorkingRoute, &capsRaw,
		); err != nil {
			return nil, err
		}
		if len(capsRaw) > 0 {
			_ = json.Unmarshal(capsRaw, &m.GenerationCapabilities)
		}
		if m.GenerationCapabilities == nil {
			m.GenerationCapabilities = map[string]any{}
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

type Service struct {
	Repo    ModelRepository
	Pool    *pgxpool.Pool
	Storage *storage.Service
	Events  *queue.EventHub
	Config  config.Config
	Wakeup  chan<- struct{}
}

func ResolveSchemaVersion(raw string) (int, error) {
	if raw == "" {
		return 1, nil
	}
	v, err := strconv.Atoi(raw)
	if err != nil || (v != 1 && v != 2) {
		return 0, ErrUnsupportedSchemaVersion
	}
	return v, nil
}

type ActiveModelsResponse struct {
	Success       bool           `json:"success"`
	SchemaVersion int            `json:"schemaVersion"`
	LaunchScope   map[string]any `json:"launchScope"`
	Models        []ActiveModel  `json:"models"`
}

func (s *Service) GetActiveModels(ctx context.Context, rawSchemaVersion string, userID string) (*ActiveModelsResponse, error) {
	ver, err := ResolveSchemaVersion(rawSchemaVersion)
	if err != nil {
		return nil, err
	}
	var models []ActiveModel
	if s.Repo != nil {
		models, err = s.Repo.ListActiveModels(ctx, userID)
		if err != nil {
			return nil, err
		}
	}
	if models == nil {
		models = []ActiveModel{}
	}
	return &ActiveModelsResponse{
		Success:       true,
		SchemaVersion: ver,
		LaunchScope: map[string]any{
			"restricted": false,
			"categories": []string{},
		},
		Models: models,
	}, nil
}

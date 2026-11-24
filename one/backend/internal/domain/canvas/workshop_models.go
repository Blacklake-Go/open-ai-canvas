package canvas

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"slices"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const WorkshopDefaultsKey = "workshop_tool_defaults"

type WorkshopTool struct {
	ID     string `json:"id"`
	Label  string `json:"label"`
	Preset bool   `json:"preset"`
}

func WorkshopTools() []WorkshopTool {
	tools := []WorkshopTool{{ID: "outpaint", Label: "扩图"}, {ID: "upscale", Label: "智能超清"},
		{ID: "cutout", Label: "抠图"}, {ID: "view_control", Label: "多角度"}}
	for _, preset := range canvasPresets {
		tools = append(tools, WorkshopTool{ID: preset.ID, Label: preset.Label, Preset: true})
	}
	return tools
}

func WorkshopToolByID(id string) (WorkshopTool, bool) {
	for _, tool := range WorkshopTools() {
		if tool.ID == id {
			return tool, true
		}
	}
	return WorkshopTool{}, false
}

type WorkshopSelection struct {
	ModelID   string `json:"modelId"`
	VersionID string `json:"versionId"`
	Contract  string `json:"contract"`
}

type WorkshopVersion struct {
	WorkshopSelection
	ModelName   string   `json:"modelName"`
	VersionName string   `json:"versionName"`
	Provider    string   `json:"provider"`
	BaseCredits float64  `json:"baseCredits"`
	Ratios      []string `json:"ratios"`
	Resolutions []string `json:"resolutions"`
}

type WorkshopModelSettings struct {
	Version  int                          `json:"version"`
	Defaults map[string]WorkshopSelection `json:"defaults"`
}

func ReadWorkshopModelSettings(ctx context.Context, pool *pgxpool.Pool) (WorkshopModelSettings, error) {
	settings := WorkshopModelSettings{Defaults: map[string]WorkshopSelection{}}
	var raw []byte
	err := pool.QueryRow(ctx, `SELECT value_json, version FROM ops_bill.system_settings WHERE key=$1`, WorkshopDefaultsKey).
		Scan(&raw, &settings.Version)
	if errors.Is(err, pgx.ErrNoRows) {
		return settings, nil
	}
	if err != nil {
		return settings, err
	}
	err = json.Unmarshal(raw, &settings.Defaults)
	return settings, err
}

func ListWorkshopVersions(ctx context.Context, pool *pgxpool.Pool) ([]WorkshopVersion, error) {
	rows, err := pool.Query(ctx, `
		SELECT m.id, COALESCE(NULLIF(m.display_name,''),m.name,m.id), pm.id,
		       COALESCE(NULLIF(pm.provider_model_version,''),pm.provider_model_id),
		       pm.provider_id, CAST(mp.base_credits AS float8),
		       m.supported_ratios, COALESCE(pm.capabilities->'aspect_ratios','[]'::jsonb),
		       m.supported_resolutions, pm.supported_resolutions,
		       pm.provider_model_id, pm.provider_endpoint, pm.mapping_version
		FROM ai_studio.ai_models m
		JOIN ai_studio.model_pricing mp ON mp.model_id=m.id AND mp.is_active AND mp.base_credits>0
		JOIN ai_studio.provider_models pm ON pm.model_id=m.id AND pm.enabled
		JOIN ai_studio.ai_providers p ON p.id=pm.provider_id AND p.enabled
		WHERE m.status='active' AND m.is_visible AND m.auto_route_eligible
		  AND m.category IN ('image','image_edit')
		  AND (m.category='image_edit'
		       OR COALESCE(m.capabilities->'modes','[]'::jsonb) ?| ARRAY['i2i','image_to_image']
		       OR m.capabilities->>'supports_edit'='true')
		  AND pm.review_status='approved' AND NULLIF(BTRIM(pm.provider_endpoint),'') IS NOT NULL
		  AND pm.supported_task_types ?| ARRAY['i2i','image_to_image']
		  AND COALESCE(p.circuit_state,'closed') NOT IN ('open','circuit_open')
		ORDER BY m.sort, m.id, pm.priority DESC, pm.id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	versions := []WorkshopVersion{}
	for rows.Next() {
		var version WorkshopVersion
		var modelRatios, routeRatios, modelRes, routeRes json.RawMessage
		var upstreamID, endpoint string
		var mappingVersion int
		if err := rows.Scan(&version.ModelID, &version.ModelName, &version.VersionID, &version.VersionName, &version.Provider,
			&version.BaseCredits, &modelRatios, &routeRatios, &modelRes, &routeRes, &upstreamID, &endpoint, &mappingVersion); err != nil {
			return nil, err
		}
		version.Ratios = workshopOptions(AspectRatios, modelRatios, routeRatios, false)
		version.Resolutions = workshopOptions(Resolutions, modelRes, routeRes, true)
		if len(version.Ratios) == 0 || len(version.Resolutions) == 0 {
			continue
		}
		raw, err := json.Marshal([]any{version.ModelID, version.VersionID, version.VersionName, version.Provider,
			upstreamID, endpoint, mappingVersion, version.Ratios, version.Resolutions})
		if err != nil {
			return nil, err
		}
		contract := sha256.Sum256(raw)
		version.Contract = hex.EncodeToString(contract[:])
		versions = append(versions, version)
	}
	return versions, rows.Err()
}

func workshopOptions(allowed []string, model, route json.RawMessage, foldCase bool) []string {
	var modelOptions, routeOptions []string
	_ = json.Unmarshal(model, &modelOptions)
	_ = json.Unmarshal(route, &routeOptions)
	if foldCase {
		for i := range modelOptions {
			modelOptions[i] = strings.ToLower(modelOptions[i])
		}
		for i := range routeOptions {
			routeOptions[i] = strings.ToLower(routeOptions[i])
		}
	}
	if len(modelOptions) == 0 && len(routeOptions) == 0 {
		return []string{}
	}
	matches := func(options []string, value string) bool {
		return len(options) == 0 || slices.Contains(options, "*") || slices.Contains(options, value)
	}
	out := []string{}
	for _, option := range allowed {
		if matches(modelOptions, option) && matches(routeOptions, option) {
			out = append(out, option)
		}
	}
	return out
}

func WorkshopVersionSupports(tool WorkshopTool, version WorkshopVersion) bool {
	if tool.Preset && tool.ID != "scene_top_view" && !slices.Contains(version.Ratios, "16:9") {
		return false
	}
	return tool.Preset || tool.ID == "upscale" || slices.Contains(version.Resolutions, "2k")
}

func ResolveWorkshopVersion(tool WorkshopTool, versions []WorkshopVersion, defaults map[string]WorkshopSelection) (WorkshopVersion, bool) {
	choice, configured := defaults[tool.ID]
	for _, version := range versions {
		if WorkshopVersionSupports(tool, version) && (!configured || version.WorkshopSelection == choice) {
			return version, true
		}
	}
	return WorkshopVersion{}, false
}

func (v WorkshopVersion) ValidatePlan(plan *ToolPlan) error {
	ratio, _ := plan.Parameters["aspect_ratio"].(string)
	resolution, _ := plan.Parameters["resolution"].(string)
	if !slices.Contains(v.Ratios, ratio) || !slices.Contains(v.Resolutions, resolution) {
		return &ToolError{Code: "WORKSHOP_OPTIONS_UNSUPPORTED", Message: "当前模型版本不支持这组画幅或清晰度，请调整参数。"}
	}
	return nil
}

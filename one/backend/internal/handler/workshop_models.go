package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"

	"one/backend/internal/domain/canvas"
	"one/backend/internal/middleware"
)

func adminAWorkshopModels(_ http.ResponseWriter, r *http.Request, d *Dependencies, user *middleware.SessionUser, requestID string) (any, map[string]any, *adminError) {
	pool, aerr := adminADB(d)
	if aerr != nil {
		return nil, nil, aerr
	}
	ctx := r.Context()
	versions, err := canvas.ListWorkshopVersions(ctx, pool)
	if err != nil {
		return nil, nil, adminAInternal(err, "无法读取工作坊模型版本")
	}
	if r.Method == http.MethodGet {
		settings, err := canvas.ReadWorkshopModelSettings(ctx, pool)
		if err != nil {
			return nil, nil, adminAInternal(err, "无法读取工作坊模型配置")
		}
		return workshopModelsResponse(settings, versions), nil, nil
	}
	var input struct {
		Defaults         map[string]canvas.WorkshopSelection `json:"defaults"`
		ExpectedRevision *int                                `json:"expectedRevision"`
	}
	if e := adminABodyLenient(r, 16*1024, &input); e != nil {
		return nil, nil, e
	}
	if input.Defaults == nil || input.ExpectedRevision == nil || *input.ExpectedRevision < 0 {
		return nil, nil, adminErr("INVALID_WORKSHOP_DEFAULTS", "请提交工作坊默认模型与配置版本。", http.StatusUnprocessableEntity)
	}
	for id := range input.Defaults {
		tool, ok := canvas.WorkshopToolByID(id)
		if !ok {
			return nil, nil, adminErr("INVALID_WORKSHOP_TOOL", "工作坊工具不存在。", http.StatusUnprocessableEntity)
		}
		if _, valid := canvas.ResolveWorkshopVersion(tool, versions, input.Defaults); !valid {
			return nil, nil, adminErr("WORKSHOP_MODEL_VERSION_UNAVAILABLE", "所选模型和版本已停用、已更新或不支持此工具。", http.StatusUnprocessableEntity)
		}
	}
	raw, err := json.Marshal(input.Defaults)
	if err != nil {
		return nil, nil, adminAInternal(err, "无法保存工作坊模型配置")
	}
	settings := canvas.WorkshopModelSettings{Defaults: input.Defaults}
	actor := adminAActorEmail(user)
	if *input.ExpectedRevision == 0 {
		err = pool.QueryRow(ctx, `
			INSERT INTO ops_bill.system_settings (key,value_json,visibility,version,updated_by,updated_at)
			VALUES ($1,$2::jsonb,'private',1,$3,now()) ON CONFLICT (key) DO NOTHING RETURNING version`,
			canvas.WorkshopDefaultsKey, string(raw), actor).Scan(&settings.Version)
	} else {
		err = pool.QueryRow(ctx, `
			UPDATE ops_bill.system_settings SET value_json=$2::jsonb,version=version+1,updated_by=$3,updated_at=now()
			WHERE key=$1 AND version=$4 RETURNING version`,
			canvas.WorkshopDefaultsKey, string(raw), actor, *input.ExpectedRevision).Scan(&settings.Version)
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, adminErr("WORKSHOP_DEFAULTS_CONFLICT", "配置已被更新，请读取最新版本后再保存。", http.StatusConflict)
	}
	if err != nil {
		return nil, nil, adminAInternal(err, "无法保存工作坊模型配置")
	}
	adminAAuditAfter(ctx, pool, user, "workshop.models_update", "system_setting", canvas.WorkshopDefaultsKey, "medium", requestID, settings)
	return workshopModelsResponse(settings, versions), nil, nil
}

func workshopModelsResponse(settings canvas.WorkshopModelSettings, versions []canvas.WorkshopVersion) map[string]any {
	tools := make([]map[string]any, 0, len(canvas.WorkshopTools()))
	for _, tool := range canvas.WorkshopTools() {
		options := []canvas.WorkshopVersion{}
		for _, version := range versions {
			if canvas.WorkshopVersionSupports(tool, version) {
				options = append(options, version)
			}
		}
		tools = append(tools, map[string]any{"id": tool.ID, "label": tool.Label, "versions": options})
	}
	return map[string]any{"revision": settings.Version, "defaults": settings.Defaults, "tools": tools}
}

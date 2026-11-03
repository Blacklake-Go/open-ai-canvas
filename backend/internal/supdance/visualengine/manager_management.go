package visualengine

import (
	"encoding/json"
	"fmt"
	"log"
	"slices"
	"time"
	"yingce/backend/internal/kernel"
	"yingce/backend/internal/model"
)

func (s *Manager) visualEnginePermissions(actor *model.User) ([]string, error) {
	if err := s.requireAdmin(actor); err != nil {
		return nil, err
	}
	if s.repo == nil {
		return append([]string{}, PermissionNames...), nil
	}
	setting, err := s.repo.SystemSettingOptional(PermissionsSettingKey)
	if err != nil {
		return nil, err
	}
	if setting == nil {
		return append([]string{}, PermissionNames...), nil
	}
	var policy PermissionPolicy
	if err = json.Unmarshal([]byte(setting.ValueJSON), &policy); err != nil {
		return nil, err
	}
	if grants, found := policy.Grants[actor.ID]; found {
		return grants, nil
	}
	return append([]string{}, PermissionNames...), nil
}
func (s *Manager) RequirePermission(actor *model.User, permission string) error {
	permissions, err := s.visualEnginePermissions(actor)
	if err != nil {
		return err
	}
	if !slices.Contains(permissions, permission) {
		return kernel.Forbidden("缺少视觉引擎权限：" + permission)
	}
	return nil
}
func (s *Manager) AdminVisualEngineCapabilities(actor *model.User) ([]string, error) {
	return s.visualEnginePermissions(actor)
}
func (s *Manager) PreviewAdminVisualEngine(actor *model.User, config Config) (Config, error) {
	if err := s.RequirePermission(actor, "preview"); err != nil {
		return config, err
	}
	config = MigrateConfig(config)
	if err := ValidateConfig(config); err != nil {
		return config, kernel.NewAppError(400, err.Error())
	}
	return config, nil
}

func (s *Manager) VisualEngineLifecycle() (LifecycleState, error) {
	state := LifecycleState{Installed: true, Version: "2.0.0", AvailableVersion: BundledVersion, ConfigRetained: true}
	if s.repo == nil {
		return state, nil
	}
	setting, err := s.repo.SystemSettingOptional(LifecycleSettingKey)
	if err != nil {
		return state, err
	}
	if setting != nil {
		if err = json.Unmarshal([]byte(setting.ValueJSON), &state); err != nil {
			return state, err
		}
	}
	state.AvailableVersion = BundledVersion
	return state, nil
}
func (s *Manager) AdminVisualEnginePermissions(actor *model.User) (PermissionPolicy, error) {
	result := PermissionPolicy{Grants: map[string][]string{}}
	if err := s.RequirePermission(actor, "lifecycle"); err != nil {
		return result, err
	}
	setting, err := s.repo.SystemSettingOptional(PermissionsSettingKey)
	if err != nil {
		return result, err
	}
	if setting != nil {
		err = json.Unmarshal([]byte(setting.ValueJSON), &result)
	}
	return result, err
}
func (s *Manager) SaveAdminVisualEnginePermissions(actor *model.User, policy PermissionPolicy) error {
	if err := s.RequirePermission(actor, "lifecycle"); err != nil {
		return err
	}
	if policy.Grants == nil || len(policy.Grants) > 100 {
		return kernel.NewAppError(400, "权限条目不能超过 100")
	}
	for id, permissions := range policy.Grants {
		user, err := s.repo.User(id)
		if err != nil {
			return err
		}
		if user.Role != model.UserRoleAdmin {
			return kernel.NewAppError(400, "只能为宿主管理员设置视觉权限")
		}
		for _, permission := range permissions {
			if !slices.Contains(PermissionNames, permission) {
				return kernel.NewAppError(400, "未知视觉权限")
			}
		}
		if len(permissions) > 0 && !slices.Contains(permissions, "view") {
			return kernel.NewAppError(400, "其他能力必须同时具有查看权限")
		}
		if id == actor.ID && !slices.Contains(permissions, "lifecycle") {
			return kernel.NewAppError(400, "不能撤销自己的生命周期管理权限")
		}
	}
	raw, err := json.Marshal(policy)
	if err != nil {
		return err
	}
	return s.repo.SaveVisualEngineSettingsWithAudit([]*model.SystemSetting{{Key: PermissionsSettingKey, ValueJSON: string(raw), UpdatedBy: actor.ID, UpdatedAt: time.Now().UTC()}}, s.visualEngineAudit(actor, "permissions.update", "更新视觉引擎权限", `{"fields":["grants"],"success":true}`))
}
func (s *Manager) visualEngineAudit(actor *model.User, action, summary, metadata string) *model.AdminAuditEvent {
	return &model.AdminAuditEvent{ID: s.idGenerator(), ActorUserID: actor.ID, Action: action, TargetType: "visual_engine", TargetID: PluginID, Summary: summary, MetadataJSON: metadata, CreatedAt: time.Now().UTC()}
}
func (s *Manager) ManageAdminVisualEngine(actor *model.User, action string, retainConfig bool) (LifecycleState, error) {
	if err := s.RequirePermission(actor, "lifecycle"); err != nil {
		return LifecycleState{}, err
	}
	visualEngineWriteMu.Lock()
	defer visualEngineWriteMu.Unlock()
	state, err := s.VisualEngineLifecycle()
	if err != nil {
		return state, err
	}
	settings := []*model.SystemSetting{}
	available, err := s.VisualEnginePluginAvailable()
	if err != nil {
		return state, err
	}
	switch action {
	case "install":
		state.Installed = true
		state.Version = BundledVersion
		state.ConfigRetained = true
		available = true
	case "update":
		if !state.Installed {
			return state, kernel.NewAppError(400, "请先安装插件")
		}
		if state.Version == BundledVersion {
			return state, kernel.NewAppError(400, "已是当前插件版本")
		}
		if state.Version != "2.0.0" {
			return state, kernel.NewAppError(409, "当前插件版本没有经过验证的迁移路径，已保留原配置")
		}
		config, err := s.readVisualEngineConfig()
		if err != nil {
			return state, err
		}
		raw, err := json.Marshal(config)
		if err != nil {
			return state, err
		}
		settings = append(settings, &model.SystemSetting{Key: "supdance_visual_engine_migration_backup:" + state.Version, ValueJSON: string(raw), UpdatedBy: actor.ID, UpdatedAt: time.Now().UTC()}, &model.SystemSetting{Key: ConfigSettingKey, ValueJSON: string(raw), UpdatedBy: actor.ID, UpdatedAt: time.Now().UTC()})
		state.Version = BundledVersion
	case "uninstall":
		state.Installed = false
		state.ConfigRetained = retainConfig
		available = false
	case "activate":
		if !state.Installed {
			return state, kernel.NewAppError(400, "请先安装插件")
		}
		available = true
	case "deactivate":
		available = false
	default:
		return state, kernel.NewAppError(400, "未知生命周期操作")
	}
	state.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
	state.UpdatedBy = actor.Username
	raw, err := json.Marshal(state)
	if err != nil {
		return state, err
	}
	settings = append(settings, &model.SystemSetting{Key: LifecycleSettingKey, ValueJSON: string(raw), UpdatedBy: actor.ID, UpdatedAt: time.Now().UTC()})
	err = s.repo.SaveVisualEngineLifecycle(settings, &model.PluginPlatformState{PluginID: PluginID, Available: available, UpdatedBy: actor.ID, UpdatedAt: time.Now().UTC()}, action == "uninstall" && !retainConfig, s.visualEngineAudit(actor, "lifecycle."+action, fmt.Sprintf("视觉引擎 %s，保留配置：%t", action, retainConfig), string(raw)))
	return state, err
}
func (s *Manager) recordFailure(actor *model.User, action string, result error) {
	if result == nil || s.repo == nil || s.requireAdmin(actor) != nil {
		return
	}
	metadata := map[string]any{"success": false}
	if config, err := s.readVisualEngineConfig(); err == nil {
		metadata["version"] = config.PublishedVersion
	}
	raw, _ := json.Marshal(metadata)
	if err := s.repo.SaveVisualEngineSettingsWithAudit(nil, s.visualEngineAudit(actor, action+".failed", "操作失败；保留先前配置", string(raw))); err != nil {
		log.Printf("visual engine failure audit could not be persisted: %v", err)
	}
}

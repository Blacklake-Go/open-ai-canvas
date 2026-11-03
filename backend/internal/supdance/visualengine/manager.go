package visualengine

import (
	"encoding/json"
	"errors"
	"github.com/google/uuid"
	"slices"
	"strings"
	"sync"
	"time"
	"yingce/backend/internal/kernel"
	"yingce/backend/internal/model"
)

var visualEngineWriteMu sync.Mutex

func (s *Manager) VisualEnginePluginAvailable() (bool, error) {
	lifecycle, err := s.VisualEngineLifecycle()
	if err != nil {
		return false, err
	}
	if !lifecycle.Installed {
		return false, nil
	}
	if s.repo == nil {
		return true, nil
	}
	state, err := s.repo.PluginPlatformState(PluginID)
	if err != nil {
		return false, err
	}
	return state == nil || state.Available, nil
}

func (s *Manager) readVisualEngineConfig() (Config, error) {
	defaults := DefaultConfig()
	if s.repo == nil {
		return defaults, nil
	}
	setting, err := s.repo.SystemSettingOptional(ConfigSettingKey)
	if err != nil {
		return defaults, err
	}
	if setting == nil || strings.TrimSpace(setting.ValueJSON) == "" {
		return defaults, nil
	}
	var config Config
	if err := json.Unmarshal([]byte(setting.ValueJSON), &config); err != nil {
		return defaults, err
	}
	config = MigrateConfig(config)
	if err := ValidateConfig(config); err != nil {
		return defaults, err
	}
	return config, nil
}

func (s *Manager) readVisualEngineSnapshots() ([]Snapshot, error) {
	snapshots := []Snapshot{}
	if s.repo == nil {
		return snapshots, nil
	}
	setting, err := s.repo.SystemSettingOptional(SnapshotsSettingKey)
	if err != nil {
		return nil, err
	}
	if setting == nil {
		return snapshots, nil
	}
	if err := json.Unmarshal([]byte(setting.ValueJSON), &snapshots); err != nil {
		return nil, err
	}
	return snapshots, nil
}

func (s *Manager) PublicVisualEngineBundle() (PublicBundle, error) {
	enabled, err := s.VisualEnginePluginAvailable()
	if err != nil {
		return PublicBundle{}, err
	}
	config, err := s.readVisualEngineConfig()
	if err != nil {
		return PublicBundle{}, err
	}
	lifecycle, err := s.VisualEngineLifecycle()
	if err != nil {
		return PublicBundle{}, err
	}
	return PublicBundle{Installation: lifecycle, PluginID: PluginID, Enabled: enabled, Version: config.PublishedVersion, Config: config, Revision: ComputeRevision(config, enabled, lifecycle)}, nil
}

func visualEngineDraftKey(actor *model.User) string {
	return "supdance_visual_engine_draft:" + actor.ID
}

func (s *Manager) AdminVisualEngineOverview(actor *model.User) (AdminOverview, error) {
	if err := s.RequirePermission(actor, "view"); err != nil {
		return AdminOverview{}, err
	}
	bundle, err := s.PublicVisualEngineBundle()
	if err != nil {
		return AdminOverview{}, err
	}
	snapshots, err := s.readVisualEngineSnapshots()
	if err != nil {
		return AdminOverview{}, err
	}
	logs := []AuditLogEntry{}
	for _, snapshot := range snapshots {
		if snapshot.Action == "baseline" {
			continue
		}
		logs = append(logs, AuditLogEntry{ID: snapshot.Version, Timestamp: snapshot.Timestamp, Actor: snapshot.Actor, Module: "Versions", Action: snapshot.Action, Details: snapshot.Summary, Version: snapshot.Version, Success: true})
	}
	permissions, err := s.visualEnginePermissions(actor)
	if err != nil {
		return AdminOverview{}, err
	}
	result := AdminOverview{Permissions: permissions, Bundle: bundle, Snapshots: snapshots, AuditLogs: logs, CanPublish: slices.Contains(permissions, "publish") && bundle.Enabled, CanRollback: slices.Contains(permissions, "rollback") && len(snapshots) > 0 && bundle.Enabled}
	if s.repo != nil {
		setting, err := s.repo.SystemSettingOptional(visualEngineDraftKey(actor))
		if err != nil {
			return result, err
		}
		if setting != nil {
			var draft Config
			if err := json.Unmarshal([]byte(setting.ValueJSON), &draft); err != nil {
				return result, err
			}
			result.Draft = &draft
		}
		events, err := s.repo.VisualEngineAuditEvents()
		if err != nil {
			return result, err
		}
		result.AuditLogs = []AuditLogEntry{}
		for _, event := range events {
			metadata := map[string]interface{}{}
			_ = json.Unmarshal([]byte(event.MetadataJSON), &metadata)
			version, _ := metadata["version"].(string)
			if version == "" {
				version, _ = metadata["baseVersion"].(string)
			}
			details := event.Summary
			if fields, found := metadata["fields"]; found {
				raw, _ := json.Marshal(fields)
				details += " " + string(raw)
			}
			result.AuditLogs = append(result.AuditLogs, AuditLogEntry{ID: event.ID, Timestamp: event.CreatedAt.UTC().Format(time.RFC3339Nano), Actor: event.ActorUserID, Module: "Visual Engine", Action: event.Action, Details: details, Version: version, Success: metadata["success"] != false})
		}
	}
	return result, nil
}

func (s *Manager) SaveAdminVisualEngineDraft(actor *model.User, config Config) (result Config, err error) {
	defer func() { s.recordFailure(actor, "draft.save", err) }()
	if err := s.RequirePermission(actor, "edit"); err != nil {
		return config, err
	}
	config = MigrateConfig(config)
	if err := ValidateConfig(config); err != nil {
		return config, kernel.NewAppError(400, err.Error())
	}
	if s.repo == nil {
		return config, kernel.NewAppError(503, "配置存储不可用")
	}
	raw, err := json.Marshal(config)
	if err != nil {
		return config, err
	}
	stable, err := s.readVisualEngineConfig()
	if err != nil {
		return config, err
	}
	metadata, _ := json.Marshal(map[string]interface{}{"baseVersion": config.PublishedVersion, "fields": ChangedFields(stable, config)})
	err = s.repo.SaveVisualEngineSettingsWithAudit([]*model.SystemSetting{{Key: visualEngineDraftKey(actor), ValueJSON: string(raw), UpdatedBy: actor.ID, UpdatedAt: time.Now().UTC()}}, s.visualEngineAudit(actor, "draft.save", "保存视觉草稿", string(metadata)))
	return config, err
}

func (s *Manager) PublishAdminVisualEngine(actor *model.User, config Config, comment string, expectedRevision ...string) (result AdminOverview, err error) {
	defer func() { s.recordFailure(actor, "publish", err) }()
	if err := s.RequirePermission(actor, "publish"); err != nil {
		return AdminOverview{}, err
	}
	visualEngineWriteMu.Lock()
	defer visualEngineWriteMu.Unlock()
	return s.publishVisualEngine(actor, config, comment, "config.publish", expectedRevision)
}

func (s *Manager) publishVisualEngine(actor *model.User, config Config, comment, action string, expectedRevision []string) (AdminOverview, error) {
	empty := AdminOverview{}
	config = MigrateConfig(config)
	if err := ValidateConfig(config); err != nil {
		return empty, kernel.NewAppError(400, err.Error())
	}
	if len(comment) > 500 {
		return empty, kernel.NewAppError(400, "发布说明不能超过 500 字节")
	}
	if s.repo == nil {
		return empty, kernel.NewAppError(503, "配置存储不可用")
	}
	current, err := s.PublicVisualEngineBundle()
	if err != nil {
		return empty, err
	}
	if !current.Enabled {
		return empty, kernel.NewAppError(409, "视觉引擎已停用，请先在插件管理中启用")
	}
	if len(expectedRevision) > 0 && current.Revision != expectedRevision[0] {
		return empty, kernel.NewAppError(409, "配置已更新，请重新加载后再发布")
	}
	if action == "config.publish" && config.PublishedVersion != current.Version {
		return empty, kernel.NewAppError(409, "草稿基于旧版本，请对比最新配置后重新编辑")
	}
	previous, err := s.repo.SystemSettingOptional(ConfigSettingKey)
	if err != nil {
		return empty, err
	}
	previousJSON := ""
	if previous != nil {
		previousJSON = previous.ValueJSON
		var previousConfig Config
		if err := json.Unmarshal([]byte(previousJSON), &previousConfig); err != nil {
			return empty, err
		}
		if ComputeRevision(MigrateConfig(previousConfig), current.Enabled, current.Installation) != current.Revision {
			return empty, kernel.NewAppError(409, "配置已更新，请重新加载后再发布")
		}
	}
	snapshots, err := s.readVisualEngineSnapshots()
	if err != nil {
		return empty, err
	}
	if len(snapshots) == 0 {
		snapshots = append(snapshots, Snapshot{Version: current.Version, Timestamp: current.Config.UpdatedAt, Actor: current.Config.UpdatedBy, Summary: "首次发布前的稳定配置", Config: current.Config, Action: "baseline"})
	}
	now := time.Now().UTC()
	config.UpdatedAt = now.Format(time.RFC3339Nano)
	config.UpdatedBy = actor.ID
	config.PublishedVersion = "2.0.0-" + uuid.NewString()
	snapshot := Snapshot{Version: config.PublishedVersion, Timestamp: config.UpdatedAt, Actor: config.UpdatedBy, Summary: comment, Config: config, Action: action}
	snapshots = append([]Snapshot{snapshot}, snapshots...)
	if len(snapshots) > 50 {
		snapshots = snapshots[:50]
	}
	raw, err := json.Marshal(config)
	if err != nil {
		return empty, err
	}
	rawSnapshots, err := json.Marshal(snapshots)
	if err != nil {
		return empty, err
	}
	metadata, err := json.Marshal(map[string]interface{}{"version": config.PublishedVersion, "previousVersion": current.Version, "fields": ChangedFields(current.Config, config)})
	if err != nil {
		return empty, err
	}
	err = s.repo.SaveVisualEngineRelease(previousJSON,
		&model.SystemSetting{Key: ConfigSettingKey, ValueJSON: string(raw), UpdatedBy: actor.ID, UpdatedAt: now},
		&model.SystemSetting{Key: SnapshotsSettingKey, ValueJSON: string(rawSnapshots), UpdatedBy: actor.ID, UpdatedAt: now},
		&model.SystemSetting{Key: visualEngineDraftKey(actor)},
		&model.AdminAuditEvent{ID: s.idGenerator(), ActorUserID: actor.ID, Action: action, TargetType: "visual_engine", TargetID: PluginID, Summary: comment, MetadataJSON: string(metadata), CreatedAt: now})
	if errors.Is(err, ErrConflict) {
		return empty, kernel.NewAppError(409, err.Error())
	}
	if err != nil {
		return empty, err
	}
	return s.AdminVisualEngineOverview(actor)
}

func (s *Manager) RollbackAdminVisualEngine(actor *model.User, version string, expectedRevision ...string) (result AdminOverview, err error) {
	defer func() { s.recordFailure(actor, "rollback", err) }()
	if err := s.RequirePermission(actor, "rollback"); err != nil {
		return AdminOverview{}, err
	}
	visualEngineWriteMu.Lock()
	defer visualEngineWriteMu.Unlock()
	snapshots, err := s.readVisualEngineSnapshots()
	if err != nil {
		return AdminOverview{}, err
	}
	for _, snapshot := range snapshots {
		if snapshot.Version == version {
			return s.publishVisualEngine(actor, snapshot.Config, "回滚至历史版本 v"+version, "config.rollback", expectedRevision)
		}
	}
	return AdminOverview{}, kernel.NotFound("未找到目标回滚版本")
}

package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"yingce/backend/internal/kernel"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
	visualengine "yingce/backend/internal/supdance/visualengine"
)

const PluginSupDanceVisualEngine = visualengine.PluginID

var visualEngineWriteMu sync.Mutex

func init() {
	supdanceSystemApplicationPolicies[PluginSupDanceVisualEngine] = PluginManagementView{
		Origin: PluginOriginOfficial, Kind: PluginKindApplication,
		ActivationScope: PluginScopeSystem, ConfigurationScope: PluginConfigurationSystem,
	}
}

func (s *Service) VisualEnginePluginAvailable() (bool, error) {
	if s.repo == nil {
		return true, nil
	}
	state, err := s.repo.PluginPlatformState(PluginSupDanceVisualEngine)
	if err != nil {
		return false, err
	}
	return state == nil || state.Available, nil
}

func (s *Service) readVisualEngineConfig() (visualengine.Config, error) {
	defaults := visualengine.DefaultConfig()
	if s.repo == nil {
		return defaults, nil
	}
	setting, err := s.repo.SystemSettingOptional(visualengine.ConfigSettingKey)
	if err != nil {
		return defaults, err
	}
	if setting == nil || strings.TrimSpace(setting.ValueJSON) == "" {
		return defaults, nil
	}
	var config visualengine.Config
	if err := json.Unmarshal([]byte(setting.ValueJSON), &config); err != nil {
		return defaults, err
	}
	if err := visualengine.ValidateConfig(config); err != nil {
		return defaults, err
	}
	return config, nil
}

func (s *Service) readVisualEngineSnapshots() ([]visualengine.Snapshot, error) {
	snapshots := []visualengine.Snapshot{}
	if s.repo == nil {
		return snapshots, nil
	}
	setting, err := s.repo.SystemSettingOptional(visualengine.SnapshotsSettingKey)
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

func (s *Service) PublicVisualEngineBundle() (visualengine.PublicBundle, error) {
	enabled, err := s.VisualEnginePluginAvailable()
	if err != nil {
		return visualengine.PublicBundle{}, err
	}
	config, err := s.readVisualEngineConfig()
	if err != nil {
		return visualengine.PublicBundle{}, err
	}
	return visualengine.PublicBundle{PluginID: PluginSupDanceVisualEngine, Enabled: enabled, Version: config.PublishedVersion, Config: config, Revision: visualengine.ComputeRevision(config, enabled)}, nil
}

func visualEngineDraftKey(actor *model.User) string {
	return "supdance_visual_engine_draft:" + actor.ID
}

func (s *Service) AdminVisualEngineOverview(actor *model.User) (visualengine.AdminOverview, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return visualengine.AdminOverview{}, err
	}
	bundle, err := s.PublicVisualEngineBundle()
	if err != nil {
		return visualengine.AdminOverview{}, err
	}
	snapshots, err := s.readVisualEngineSnapshots()
	if err != nil {
		return visualengine.AdminOverview{}, err
	}
	logs := []visualengine.AuditLogEntry{}
	for _, snapshot := range snapshots {
		if snapshot.Action == "baseline" {
			continue
		}
		logs = append(logs, visualengine.AuditLogEntry{ID: snapshot.Version, Timestamp: snapshot.Timestamp, Actor: snapshot.Actor, Module: "Versions", Action: snapshot.Action, Details: snapshot.Summary, Version: snapshot.Version, Success: true})
	}
	result := visualengine.AdminOverview{Bundle: bundle, Snapshots: snapshots, AuditLogs: logs, CanPublish: true, CanRollback: len(snapshots) > 0}
	if s.repo != nil {
		setting, err := s.repo.SystemSettingOptional(visualEngineDraftKey(actor))
		if err != nil {
			return result, err
		}
		if setting != nil {
			var draft visualengine.Config
			if err := json.Unmarshal([]byte(setting.ValueJSON), &draft); err != nil {
				return result, err
			}
			result.Draft = &draft
		}
	}
	return result, nil
}

func (s *Service) SaveAdminVisualEngineDraft(actor *model.User, config visualengine.Config) (visualengine.Config, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return config, err
	}
	if err := visualengine.ValidateConfig(config); err != nil {
		return config, kernel.NewAppError(400, err.Error())
	}
	if s.repo == nil {
		return config, kernel.NewAppError(503, "配置存储不可用")
	}
	raw, err := json.Marshal(config)
	if err != nil {
		return config, err
	}
	err = s.repo.SaveSystemSetting(&model.SystemSetting{Key: visualEngineDraftKey(actor), ValueJSON: string(raw), UpdatedBy: actor.ID, UpdatedAt: time.Now().UTC()})
	return config, err
}

func (s *Service) PublishAdminVisualEngine(actor *model.User, config visualengine.Config, comment string, expectedRevision ...string) (visualengine.AdminOverview, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return visualengine.AdminOverview{}, err
	}
	visualEngineWriteMu.Lock()
	defer visualEngineWriteMu.Unlock()
	return s.publishVisualEngine(actor, config, comment, "config.publish", expectedRevision)
}

func (s *Service) publishVisualEngine(actor *model.User, config visualengine.Config, comment, action string, expectedRevision []string) (visualengine.AdminOverview, error) {
	empty := visualengine.AdminOverview{}
	if err := visualengine.ValidateConfig(config); err != nil {
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
	previous, err := s.repo.SystemSettingOptional(visualengine.ConfigSettingKey)
	if err != nil {
		return empty, err
	}
	previousJSON := ""
	if previous != nil {
		previousJSON = previous.ValueJSON
		var previousConfig visualengine.Config
		if err := json.Unmarshal([]byte(previousJSON), &previousConfig); err != nil {
			return empty, err
		}
		if visualengine.ComputeRevision(previousConfig, current.Enabled) != current.Revision {
			return empty, kernel.NewAppError(409, "配置已更新，请重新加载后再发布")
		}
	}
	snapshots, err := s.readVisualEngineSnapshots()
	if err != nil {
		return empty, err
	}
	if len(snapshots) == 0 {
		snapshots = append(snapshots, visualengine.Snapshot{Version: current.Version, Timestamp: current.Config.UpdatedAt, Actor: current.Config.UpdatedBy, Summary: "首次发布前的稳定配置", Config: current.Config, Action: "baseline"})
	}
	now := time.Now().UTC()
	config.UpdatedAt = now.Format(time.RFC3339Nano)
	config.UpdatedBy = actor.Username
	config.PublishedVersion = fmt.Sprintf("2.0.%d", now.UnixNano())
	snapshot := visualengine.Snapshot{Version: config.PublishedVersion, Timestamp: config.UpdatedAt, Actor: config.UpdatedBy, Summary: comment, Config: config, Action: action}
	snapshots = append([]visualengine.Snapshot{snapshot}, snapshots...)
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
	metadata, err := json.Marshal(map[string]string{"version": config.PublishedVersion, "previousVersion": current.Version})
	if err != nil {
		return empty, err
	}
	err = s.repo.SaveVisualEngineRelease(previousJSON,
		&model.SystemSetting{Key: visualengine.ConfigSettingKey, ValueJSON: string(raw), UpdatedBy: actor.ID, UpdatedAt: now},
		&model.SystemSetting{Key: visualengine.SnapshotsSettingKey, ValueJSON: string(rawSnapshots), UpdatedBy: actor.ID, UpdatedAt: now},
		&model.SystemSetting{Key: visualEngineDraftKey(actor)},
		&model.AdminAuditEvent{ID: newID(), ActorUserID: actor.ID, Action: action, TargetType: "visual_engine", TargetID: PluginSupDanceVisualEngine, Summary: comment, MetadataJSON: string(metadata), CreatedAt: now})
	if errors.Is(err, repository.ErrVisualEngineConflict) {
		return empty, kernel.NewAppError(409, err.Error())
	}
	if err != nil {
		return empty, err
	}
	return s.AdminVisualEngineOverview(actor)
}

func (s *Service) RollbackAdminVisualEngine(actor *model.User, version string, expectedRevision ...string) (visualengine.AdminOverview, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return visualengine.AdminOverview{}, err
	}
	visualEngineWriteMu.Lock()
	defer visualEngineWriteMu.Unlock()
	snapshots, err := s.readVisualEngineSnapshots()
	if err != nil {
		return visualengine.AdminOverview{}, err
	}
	for _, snapshot := range snapshots {
		if snapshot.Version == version {
			return s.publishVisualEngine(actor, snapshot.Config, "回滚至历史版本 v"+version, "config.rollback", expectedRevision)
		}
	}
	return visualengine.AdminOverview{}, kernel.NotFound("未找到目标回滚版本")
}

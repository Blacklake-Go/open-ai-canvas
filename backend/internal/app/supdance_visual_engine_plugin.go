package app

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"yingce/backend/internal/model"
	visualengine "yingce/backend/internal/supdance/visualengine"
)

type visualEngineBundleCache struct {
	sync.RWMutex
	bundle   visualengine.PublicBundle
	cachedAt time.Time
	valid    bool
}

var globalVisualEngineBundleCache visualEngineBundleCache

func invalidateVisualEngineBundleCache() {
	globalVisualEngineBundleCache.Lock()
	globalVisualEngineBundleCache.valid = false
	globalVisualEngineBundleCache.Unlock()
}

const (
	PluginSupDanceVisualEngine = visualengine.PluginID
)

func init() {
	officialApplicationPolicies[PluginSupDanceVisualEngine] = PluginManagementView{
		Origin:             PluginOriginOfficial,
		Kind:               PluginKindApplication,
		ActivationScope:    PluginScopeSystem,
		ConfigurationScope: PluginConfigurationSystem,
	}
}

// VisualEnginePluginAvailable reports whether supdance-visual-engine is currently available on the platform.
func (s *Service) VisualEnginePluginAvailable() (bool, error) {
	if s.repo == nil {
		return true, nil
	}
	state, err := s.repo.PluginPlatformState(PluginSupDanceVisualEngine)
	if err != nil {
		return false, fmt.Errorf("读取视觉引擎插件状态：%w", err)
	}
	if state == nil {
		return true, nil // default enabled
	}
	return state.Available, nil
}

func (s *Service) readVisualEngineConfig() (visualengine.Config, error) {
	defaults := visualengine.DefaultConfig()
	if s.repo == nil {
		return defaults, nil
	}
	setting, err := s.repo.SystemSettingOptional(visualengine.ConfigSettingKey)
	if err != nil {
		return defaults, fmt.Errorf("读取视觉引擎配置失败：%w", err)
	}
	if setting == nil || strings.TrimSpace(setting.ValueJSON) == "" {
		return defaults, nil
	}
	var parsed visualengine.Config
	if err := json.Unmarshal([]byte(setting.ValueJSON), &parsed); err != nil {
		return defaults, nil
	}
	return visualengine.NormalizeConfig(parsed), nil
}

func (s *Service) readVisualEngineSnapshots() ([]visualengine.Snapshot, error) {
	if s.repo == nil {
		return nil, nil
	}
	setting, err := s.repo.SystemSettingOptional(visualengine.SnapshotsSettingKey)
	if err != nil {
		return nil, err
	}
	if setting == nil || strings.TrimSpace(setting.ValueJSON) == "" {
		return nil, nil
	}
	var snapshots []visualengine.Snapshot
	if err := json.Unmarshal([]byte(setting.ValueJSON), &snapshots); err != nil {
		return nil, nil
	}
	return snapshots, nil
}

func (s *Service) PublicVisualEngineBundle() (visualengine.PublicBundle, error) {
	globalVisualEngineBundleCache.RLock()
	if globalVisualEngineBundleCache.valid && time.Since(globalVisualEngineBundleCache.cachedAt) < 15*time.Second {
		b := globalVisualEngineBundleCache.bundle
		globalVisualEngineBundleCache.RUnlock()
		return b, nil
	}
	globalVisualEngineBundleCache.RUnlock()

	enabled, err := s.VisualEnginePluginAvailable()
	if err != nil {
		return visualengine.PublicBundle{}, err
	}
	cfg, err := s.readVisualEngineConfig()
	if err != nil {
		return visualengine.PublicBundle{}, err
	}
	rev := visualengine.ComputeRevision(cfg, enabled)

	bundle := visualengine.PublicBundle{
		PluginID: PluginSupDanceVisualEngine,
		Enabled:  enabled,
		Version:  cfg.PublishedVersion,
		Config:   cfg,
		Revision: rev,
	}

	globalVisualEngineBundleCache.Lock()
	globalVisualEngineBundleCache.bundle = bundle
	globalVisualEngineBundleCache.cachedAt = time.Now()
	globalVisualEngineBundleCache.valid = true
	globalVisualEngineBundleCache.Unlock()

	return bundle, nil
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

	return visualengine.AdminOverview{
		Bundle:      bundle,
		Snapshots:   snapshots,
		CanPublish:  true,
		CanRollback: len(snapshots) > 0,
	}, nil
}

func (s *Service) PublishAdminVisualEngine(actor *model.User, newConfig visualengine.Config, comment string) (visualengine.AdminOverview, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return visualengine.AdminOverview{}, err
	}

	normalized := visualengine.NormalizeConfig(newConfig)
	normalized.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	normalized.UpdatedBy = actor.Username
	if normalized.UpdatedBy == "" {
		normalized.UpdatedBy = actor.Email
	}

	raw, err := json.Marshal(normalized)
	if err != nil {
		return visualengine.AdminOverview{}, fmt.Errorf("序列化视觉引擎配置失败：%w", err)
	}

	if s.repo != nil {
		if err := s.repo.SaveSystemSetting(&model.SystemSetting{
			Key:       visualengine.ConfigSettingKey,
			ValueJSON: string(raw),
			UpdatedAt: time.Now(),
		}); err != nil {
			return visualengine.AdminOverview{}, fmt.Errorf("保存视觉引擎配置失败：%w", err)
		}

		snapshots, _ := s.readVisualEngineSnapshots()
		newSnapshot := visualengine.Snapshot{
			Version:   normalized.PublishedVersion,
			Timestamp: normalized.UpdatedAt,
			Actor:     normalized.UpdatedBy,
			Summary:   comment,
			Config:    normalized,
		}
		updatedSnapshots := append([]visualengine.Snapshot{newSnapshot}, snapshots...)
		if len(updatedSnapshots) > 50 {
			updatedSnapshots = updatedSnapshots[:50]
		}
		rawSnapshots, _ := json.Marshal(updatedSnapshots)
		_ = s.repo.SaveSystemSetting(&model.SystemSetting{
			Key:       visualengine.SnapshotsSettingKey,
			ValueJSON: string(rawSnapshots),
			UpdatedAt: time.Now(),
		})
	}

	invalidateVisualEngineBundleCache()
	return s.AdminVisualEngineOverview(actor)
}

func (s *Service) RollbackAdminVisualEngine(actor *model.User, targetVersion string) (visualengine.AdminOverview, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return visualengine.AdminOverview{}, err
	}

	snapshots, err := s.readVisualEngineSnapshots()
	if err != nil {
		return visualengine.AdminOverview{}, err
	}

	var target *visualengine.Snapshot
	for _, snap := range snapshots {
		if snap.Version == targetVersion {
			target = &snap
			break
		}
	}

	if target == nil {
		return visualengine.AdminOverview{}, fmt.Errorf("未找到目标回滚版本：%s", targetVersion)
	}

	return s.PublishAdminVisualEngine(actor, target.Config, fmt.Sprintf("回滚至历史版本 v%s", targetVersion))
}

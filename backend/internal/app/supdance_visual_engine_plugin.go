package app

import (
	"fmt"
	"yingce/backend/internal/model"
	visualengine "yingce/backend/internal/supdance/visualengine"
)

const PluginSupDanceVisualEngine = visualengine.PluginID

func init() {
	officialApplicationPolicies[PluginSupDanceVisualEngine] = PluginManagementView{
		Origin: PluginOriginOfficial, Kind: PluginKindApplication,
		ActivationScope: PluginScopeSystem, ConfigurationScope: PluginConfigurationSystem,
	}
}

func (s *Service) VisualEnginePluginAvailable() (bool, error) {
	if s.repo == nil {
		return false, fmt.Errorf("视觉引擎存储不可用")
	}
	state, err := s.repo.PluginPlatformState(PluginSupDanceVisualEngine)
	if err != nil {
		return false, err
	}
	return state == nil || state.Available, nil
}

func (s *Service) PublicVisualEngineBundle() (visualengine.PublicBundle, error) {
	enabled, err := s.VisualEnginePluginAvailable()
	if err != nil {
		return visualengine.PublicBundle{}, err
	}
	config, err := visualengine.ReadConfig(s.repo)
	if err != nil {
		return visualengine.PublicBundle{}, err
	}
	return visualengine.PublicBundle{PluginID: PluginSupDanceVisualEngine, Enabled: enabled, Version: config.PublishedVersion, Config: config, Revision: visualengine.ComputeRevision(config, enabled)}, nil
}

func (s *Service) AdminVisualEngineOverview(actor *model.User) (visualengine.AdminOverview, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return visualengine.AdminOverview{}, err
	}
	bundle, err := s.PublicVisualEngineBundle()
	if err != nil {
		return visualengine.AdminOverview{}, err
	}
	snapshots, err := visualengine.ReadSnapshots(s.repo)
	if err != nil {
		return visualengine.AdminOverview{}, err
	}
	entries, err := visualengine.ReadAudit(s.repo)
	if err != nil {
		return visualengine.AdminOverview{}, err
	}
	return visualengine.AdminOverview{Bundle: bundle, Snapshots: snapshots, AuditLogs: entries, CanPublish: true, CanRollback: len(snapshots) > 0}, nil
}

func (s *Service) PublishAdminVisualEngine(actor *model.User, config visualengine.Config, comment string) (visualengine.AdminOverview, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return visualengine.AdminOverview{}, err
	}
	if err := visualengine.Publish(s.repo, actor.ID, config, comment, ""); err != nil {
		return visualengine.AdminOverview{}, err
	}
	return s.AdminVisualEngineOverview(actor)
}

func (s *Service) RollbackAdminVisualEngine(actor *model.User, version string) (visualengine.AdminOverview, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return visualengine.AdminOverview{}, err
	}
	if err := visualengine.Publish(s.repo, actor.ID, visualengine.Config{}, "", version); err != nil {
		return visualengine.AdminOverview{}, err
	}
	return s.AdminVisualEngineOverview(actor)
}

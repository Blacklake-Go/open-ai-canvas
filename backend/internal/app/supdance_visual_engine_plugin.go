package app

import (
	"yingce/backend/internal/model"
	visualengine "yingce/backend/internal/supdance/visualengine"
)

const PluginSupDanceVisualEngine = visualengine.PluginID

func init() {
	supdanceSystemApplicationPolicies[PluginSupDanceVisualEngine] = PluginManagementView{Origin: PluginOriginOfficial, Kind: PluginKindApplication, ActivationScope: PluginScopeSystem, ConfigurationScope: PluginConfigurationSystem}
}
func (s *Service) visualEngineManager() *visualengine.Manager {
	var storage visualengine.Repository
	if s.repo != nil {
		storage = s.repo
	}
	return visualengine.NewManager(storage, s.RequireAdmin, newID)
}
func (s *Service) VisualEnginePluginAvailable() (bool, error) {
	return s.visualEngineManager().VisualEnginePluginAvailable()
}
func (s *Service) PublicVisualEngineBundle() (visualengine.PublicBundle, error) {
	return s.visualEngineManager().PublicVisualEngineBundle()
}
func (s *Service) AdminVisualEngineOverview(actor *model.User) (visualengine.AdminOverview, error) {
	return s.visualEngineManager().AdminVisualEngineOverview(actor)
}
func (s *Service) SaveAdminVisualEngineDraft(actor *model.User, config visualengine.Config) (visualengine.Config, error) {
	return s.visualEngineManager().SaveAdminVisualEngineDraft(actor, config)
}
func (s *Service) PublishAdminVisualEngine(actor *model.User, config visualengine.Config, comment string, revision ...string) (visualengine.AdminOverview, error) {
	return s.visualEngineManager().PublishAdminVisualEngine(actor, config, comment, revision...)
}
func (s *Service) RollbackAdminVisualEngine(actor *model.User, version string, revision ...string) (visualengine.AdminOverview, error) {
	return s.visualEngineManager().RollbackAdminVisualEngine(actor, version, revision...)
}

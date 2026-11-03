package app

import (
	"yingce/backend/internal/model"
	visualengine "yingce/backend/internal/supdance/visualengine"
)

func (s *Service) requireVisualEnginePermission(actor *model.User, permission string) error {
	return s.visualEngineManager().RequirePermission(actor, permission)
}
func (s *Service) AdminVisualEngineCapabilities(actor *model.User) ([]string, error) {
	return s.visualEngineManager().AdminVisualEngineCapabilities(actor)
}
func (s *Service) PreviewAdminVisualEngine(actor *model.User, config visualengine.Config) (visualengine.Config, error) {
	return s.visualEngineManager().PreviewAdminVisualEngine(actor, config)
}
func (s *Service) VisualEngineLifecycle() (visualengine.LifecycleState, error) {
	return s.visualEngineManager().VisualEngineLifecycle()
}
func (s *Service) AdminVisualEnginePermissions(actor *model.User) (visualengine.PermissionPolicy, error) {
	return s.visualEngineManager().AdminVisualEnginePermissions(actor)
}
func (s *Service) SaveAdminVisualEnginePermissions(actor *model.User, policy visualengine.PermissionPolicy) error {
	return s.visualEngineManager().SaveAdminVisualEnginePermissions(actor, policy)
}
func (s *Service) ManageAdminVisualEngine(actor *model.User, action string, retainConfig bool) (visualengine.LifecycleState, error) {
	return s.visualEngineManager().ManageAdminVisualEngine(actor, action, retainConfig)
}

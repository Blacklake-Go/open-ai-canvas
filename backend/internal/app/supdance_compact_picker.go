package app

import (
	"yingce/backend/internal/model"
	"yingce/backend/internal/supdance/compactpicker"
)

func init() {
	supdanceSystemApplicationPolicies[compactpicker.PluginID] = PluginManagementView{
		Origin: PluginOriginOfficial, Kind: PluginKindApplication,
		ActivationScope: PluginScopeSystem, ConfigurationScope: PluginConfigurationSystem,
	}
}

func (s *Service) CompactPickerPluginAvailable() (bool, error) {
	return compactpicker.Available(s.repo)
}

func (s *Service) CompactPickerSettings() (compactpicker.Settings, error) {
	return compactpicker.Read(s.repo)
}

func (s *Service) AdminCompactPickerSettings(actor *model.User) (compactpicker.Settings, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return compactpicker.Settings{}, err
	}
	return s.CompactPickerSettings()
}

func (s *Service) SaveAdminCompactPickerSettings(actor *model.User, settings compactpicker.Settings) (compactpicker.Settings, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return compactpicker.Settings{}, err
	}
	audit, err := newAdminAuditEvent(actor, "supdance.compact-picker.update", "plugin", compactpicker.PluginID, "更新模型选择器显示设置", settings)
	if err != nil {
		return compactpicker.Settings{}, err
	}
	if err := compactpicker.Save(s.repo, settings, audit); err != nil {
		return compactpicker.Settings{}, err
	}
	return settings, nil
}

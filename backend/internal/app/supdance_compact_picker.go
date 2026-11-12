package app

import (
	"path/filepath"
	"yingce/backend/internal/model"
	"yingce/backend/internal/supdance/compactpicker"
	"yingce/backend/internal/supdance/gallery"
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
	before, err := s.CompactPickerSettings()
	if err != nil {
		return compactpicker.Settings{}, err
	}
	if before.ComplianceLock && !settings.ComplianceLock {
		if !settings.UnlockConfirmed {
			return compactpicker.Settings{}, BadAuthRequest("解除合规锁需要管理员明确确认")
		}
		if err := s.InspirationGallery().RequireUnlock(); err != nil {
			return compactpicker.Settings{}, err
		}
	}
	if settings.ShowInspirations && settings.ComplianceLock {
		return compactpicker.Settings{}, BadAuthRequest("合规锁开启时禁止恢复公开访问")
	}
	if !settings.ShowInspirations {
		settings.HomepageShowcaseEnabled = false
	}
	audit, err := newAdminAuditEvent(actor, "supdance.compact-picker.update", "plugin", compactpicker.PluginID, "更新模型选择器显示设置", settings)
	if err != nil {
		return compactpicker.Settings{}, err
	}
	if err := compactpicker.Save(s.repo, settings, audit); err != nil {
		return compactpicker.Settings{}, err
	}
	return s.CompactPickerSettings()
}

func (s *Service) InspirationGallery() gallery.Service {
	return gallery.Service{Repo: s.repo, Dir: filepath.Join(s.dataDir, "inspiration-archive")}
}

func (s *Service) AdminGalleryCandidates(actor *model.User, query string) ([]gallery.Candidate, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	return s.InspirationGallery().ListAdmin(query)
}
func (s *Service) ReviewGalleryCandidate(actor *model.User, id, status, evidence, hash, replacementImage string) error {
	if err := s.RequireAdmin(actor); err != nil {
		return err
	}
	audit, err := newAdminAuditEvent(actor, "supdance.inspiration.review", "inspiration", id, "审核灵感案例公开授权", map[string]string{"status": status, "hash": hash})
	if err != nil {
		return err
	}
	return s.InspirationGallery().SaveReview(actor, id, status, evidence, hash, audit, replacementImage)
}

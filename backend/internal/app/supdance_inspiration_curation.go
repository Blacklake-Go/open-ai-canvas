package app

import (
	"yingce/backend/internal/model"
	"yingce/backend/internal/supdance/gallery"
)

func (s *Service) AdminInspirationCuration(actor *model.User) (gallery.CurationState, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return gallery.CurationState{}, err
	}
	return s.InspirationGallery().Curation()
}

func (s *Service) AdminInspirationCurationCatalog(actor *model.User, query string) ([]gallery.CurationCard, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	return s.InspirationGallery().CurationCatalog(query)
}

func (s *Service) ChangeInspirationCuration(actor *model.User, action string, input gallery.CurationChange) (gallery.CurationState, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return gallery.CurationState{}, err
	}
	audit, err := newAdminAuditEvent(actor, "supdance.inspiration.curation."+action, "plugin", "supdance-inspiration-curation", "更新灵感中心策展", nil)
	if err != nil {
		return gallery.CurationState{}, err
	}
	return s.InspirationGallery().ChangeCuration(action, input, audit)
}

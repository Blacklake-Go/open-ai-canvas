package app

import (
	"strings"
	"yingce/backend/internal/auth"
	"yingce/backend/internal/kernel"
	"yingce/backend/internal/model"
	"yingce/backend/internal/supdance/maillocale"
)

func (h authHost) EmailDefaultLocale() (string, error) {
	settings, err := h.svc.readSupDanceI18nSettings()
	return maillocale.Resolve(settings.DefaultLocale), err
}
func (s *Service) UserEmailLocale(actor *model.User) (string, error) {
	if actor == nil || actor.ID == "" {
		return "", kernel.Unauthorized("请先登录")
	}
	return s.authDomain().ResolveEmailLocale(auth.EmailDelivery{UserID: actor.ID})
}
func (s *Service) SetUserEmailLocale(actor *model.User, locale string) (*model.User, error) {
	if actor == nil || actor.ID == "" {
		return nil, kernel.Unauthorized("请先登录")
	}
	locale = strings.TrimSpace(locale)
	if !maillocale.Valid(locale) {
		return nil, kernel.BadAuthRequest("不支持的用户语言")
	}
	if err := s.repo.SetUserEmailLocale(actor.ID, locale); err != nil {
		return nil, err
	}
	return s.repo.User(actor.ID)
}

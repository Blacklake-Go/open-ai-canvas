package auth

import (
	"errors"
	"gorm.io/gorm"
	"yingce/backend/internal/model"
	"yingce/backend/internal/supdance/maillocale"
)

// Stored recipient preference wins over anonymous request hints. Locale is not
// part of the sending intent, so a language change cannot replay an event.
func (s *Service) ResolveEmailLocale(delivery EmailDelivery) (string, error) {
	if delivery.LocaleResolved && maillocale.Valid(delivery.Locale) {
		return delivery.Locale, nil
	}
	if s.repo != nil {
		var user *model.User
		var err error
		if delivery.UserID != "" {
			user, err = s.repo.User(delivery.UserID)
		} else if delivery.Recipient != "" {
			user, err = s.repo.UserByEmail(NormalizeEmail(delivery.Recipient))
		}
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return "", err
		}
		if user != nil && maillocale.Valid(user.PreferredLocale) {
			return user.PreferredLocale, nil
		}
		if delivery.UserID == "" && delivery.Recipient != "" {
			contact, contactErr := s.repo.EmailContact(NormalizeEmail(delivery.Recipient))
			if contactErr != nil && !errors.Is(contactErr, gorm.ErrRecordNotFound) {
				return "", contactErr
			}
			if contactErr == nil && maillocale.Valid(contact.PreferredLocale) {
				return contact.PreferredLocale, nil
			}
		}
	}
	if code := maillocale.Match(delivery.Locale); code != "" {
		return code, nil
	}
	if h, ok := s.host.(interface{ EmailDefaultLocale() (string, error) }); ok {
		locale, err := h.EmailDefaultLocale()
		return maillocale.Resolve(locale), err
	}
	return maillocale.Default, nil
}

package repository

import (
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"time"
	"yingce/backend/internal/model"
)

func (r *Repository) SetUserEmailLocale(id, locale string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var user model.User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND status = ?", id, model.UserStatusActive).First(&user).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.User{}).Where("id = ?", id).Updates(map[string]any{"preferred_locale": locale, "updated_at": time.Now()}).Error; err != nil {
			return err
		}
		if user.Email != "" {
			return tx.Model(&model.SupDanceEmailContact{}).Where("email = ?", user.Email).Update("preferred_locale", locale).Error
		}
		return nil
	})
}

package repository

import (
	"errors"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"yingce/backend/internal/model"
)

var ErrVisualEngineConflict = errors.New("视觉配置已被其他管理员更新，请重新加载")

func (r *Repository) SaveVisualEngineRelease(previousJSON string, config, snapshots, draft *model.SystemSetting, audit *model.AdminAuditEvent) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if previousJSON == "" {
			result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(config)
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return ErrVisualEngineConflict
			}
		} else {
			result := tx.Model(&model.SystemSetting{}).Where("key = ? AND value_json = ?", config.Key, previousJSON).Updates(map[string]any{
				"value_json": config.ValueJSON, "updated_by": config.UpdatedBy, "updated_at": config.UpdatedAt,
			})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return ErrVisualEngineConflict
			}
		}
		if err := tx.Save(snapshots).Error; err != nil {
			return err
		}
		if err := tx.Where("key = ?", draft.Key).Delete(&model.SystemSetting{}).Error; err != nil {
			return err
		}
		return tx.Create(audit).Error
	})
}

package repository

import (
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"yingce/backend/internal/model"
	visualengine "yingce/backend/internal/supdance/visualengine"
)

var ErrVisualEngineConflict = visualengine.ErrConflict

func (r *Repository) SaveVisualEngineSettingsWithAudit(settings []*model.SystemSetting, audit *model.AdminAuditEvent) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		for _, setting := range settings {
			if err := tx.Save(setting).Error; err != nil {
				return err
			}
		}
		return tx.Create(audit).Error
	})
}
func (r *Repository) SaveVisualEngineLifecycle(settings []*model.SystemSetting, state *model.PluginPlatformState, clearConfig bool, audit *model.AdminAuditEvent) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		for _, setting := range settings {
			if err := tx.Save(setting).Error; err != nil {
				return err
			}
		}
		if err := tx.Save(state).Error; err != nil {
			return err
		}
		if clearConfig {
			if err := tx.Where("key IN ? OR key LIKE ? OR key LIKE ?", []string{"supdance_visual_engine_config", "supdance_visual_engine_snapshots"}, "supdance_visual_engine_draft:%", "supdance_visual_engine_migration_backup:%").Delete(&model.SystemSetting{}).Error; err != nil {
				return err
			}
		}
		return tx.Create(audit).Error
	})
}
func (r *Repository) VisualEngineAuditEvents() ([]model.AdminAuditEvent, error) {
	var events []model.AdminAuditEvent
	err := r.db.Where("target_id = ?", "supdance-visual-engine").Order("created_at DESC").Limit(200).Find(&events).Error
	return events, err
}

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

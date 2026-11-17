package database

import (
	"gorm.io/gorm"
	"yingce/backend/internal/model"
)

func migrateEmailLocales(tx *gorm.DB) error {
	// Add only owned fields, without re-migrating the full identity table.
	fields := []struct {
		table any
		name  string
	}{
		{&model.User{}, "PreferredLocale"},
		{&model.SupDanceEmailReceipt{}, "Locale"},
		{&model.SupDanceEmailContact{}, "PreferredLocale"},
		{&model.SupDanceEmailCampaign{}, "RevisionsJSON"},
		{&model.SupDanceEmailCampaign{}, "LocalizedVariablesJSON"},
	}
	for _, field := range fields {
		if !tx.Migrator().HasTable(field.table) {
			continue
		}
		if !tx.Migrator().HasColumn(field.table, field.name) {
			if err := tx.Migrator().AddColumn(field.table, field.name); err != nil {
				return err
			}
		}
	}
	return nil
}

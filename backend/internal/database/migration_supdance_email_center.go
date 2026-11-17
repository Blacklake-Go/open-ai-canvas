package database

import (
	"gorm.io/gorm"
	"yingce/backend/internal/model"
)

func migrateSupDanceEmailCenter(tx *gorm.DB) error {
	return tx.AutoMigrate(&model.SupDanceEmailTemplate{}, &model.SupDanceEmailRevision{}, &model.SupDanceEmailReceipt{}, &model.SupDanceEmailContact{}, &model.SupDanceEmailBrandAsset{}, &model.SupDanceEmailCampaign{}, &model.SupDanceEmailJob{})
}

package repository

import (
	"errors"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"time"
	"yingce/backend/internal/model"
)

var ErrEmailRevisionConflict = errors.New("email template changed; reload before saving")

func (r *Repository) EmailTemplate(key, locale string) (*model.SupDanceEmailTemplate, error) {
	var row model.SupDanceEmailTemplate
	err := r.db.Where("key = ? AND locale = ?", key, locale).First(&row).Error
	return &row, err
}
func (r *Repository) EmailRevision(id string) (*model.SupDanceEmailRevision, error) {
	var row model.SupDanceEmailRevision
	err := r.db.First(&row, "id = ?", id).Error
	return &row, err
}
func (r *Repository) EmailRevisions(key, locale string) ([]model.SupDanceEmailRevision, error) {
	rows := []model.SupDanceEmailRevision{}
	err := r.db.Where("key = ? AND locale = ?", key, locale).Order("created_at DESC, id DESC").Limit(100).Find(&rows).Error
	return rows, err
}
func (r *Repository) SeedEmailTemplate(row model.SupDanceEmailTemplate, rev model.SupDanceEmailRevision, legacy *model.SupDanceEmailRevision) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&row)
		if result.Error != nil || result.RowsAffected == 0 {
			return result.Error
		}
		if err := tx.Create(&rev).Error; err != nil {
			return err
		}
		if legacy != nil {
			return tx.Create(legacy).Error
		}
		return nil
	})
}
func (r *Repository) SaveEmailDraft(key, locale string, expected int64, rev model.SupDanceEmailRevision) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&model.SupDanceEmailTemplate{}).Where("key = ? AND locale = ? AND revision = ?", key, locale, expected).Updates(map[string]any{"draft_id": rev.ID, "revision": expected + 1, "updated_at": time.Now()})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected != 1 {
			return ErrEmailRevisionConflict
		}
		return tx.Create(&rev).Error
	})
}
func (r *Repository) PublishEmailRevision(key, locale, id string, expected int64) error {
	res := r.db.Model(&model.SupDanceEmailTemplate{}).Where("key = ? AND locale = ? AND revision = ?", key, locale, expected).Updates(map[string]any{"published_id": id, "revision": expected + 1, "updated_at": time.Now()})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected != 1 {
		return ErrEmailRevisionConflict
	}
	return nil
}
func (r *Repository) ClaimEmailReceipt(row *model.SupDanceEmailReceipt) (bool, error) {
	res := r.db.Clauses(clause.OnConflict{DoNothing: true}).Create(row)
	if res.Error == nil && res.RowsAffected == 0 {
		res = r.db.Model(&model.SupDanceEmailReceipt{}).Where("id = ? AND status = ?", row.ID, "retryable").Updates(map[string]any{"status": "sending", "updated_at": time.Now(), "template_id": row.TemplateID, "template_key": row.TemplateKey, "brand_version": row.BrandVersion, "message_id": row.MessageID, "locale": row.Locale})
	}
	return res.RowsAffected == 1, res.Error
}
func (r *Repository) FinishEmailReceipt(id, status, stage string, ms int64) error {
	return r.db.Model(&model.SupDanceEmailReceipt{}).Where("id = ?", id).Updates(map[string]any{"status": status, "stage": stage, "duration_ms": ms, "updated_at": time.Now()}).Error
}
func (r *Repository) EmailContact(email string) (*model.SupDanceEmailContact, error) {
	var row model.SupDanceEmailContact
	err := r.db.First(&row, "email = ?", email).Error
	return &row, err
}
func (r *Repository) SaveEmailContact(row *model.SupDanceEmailContact) error {
	return r.db.Save(row).Error
}

func (r *Repository) UnsubscribeEmailContact(email string) error {
	now := time.Now()
	return r.db.Model(&model.SupDanceEmailContact{}).Where("email = ?", email).Updates(map[string]any{"marketing": false, "unsubscribed_at": now, "updated_at": now}).Error
}
func (r *Repository) SetEmailPreference(email string, enabled bool) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		row := model.SupDanceEmailContact{Email: email, Scope: "marketing", Source: "authenticated_preference", UpdatedAt: now}
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&row).Error; err != nil {
			return err
		}
		query := tx.Model(&model.SupDanceEmailContact{}).Where("email = ?", email)
		updates := map[string]any{"marketing": enabled, "updated_at": now, "source": "authenticated_preference", "scope": "marketing"}
		if enabled {
			query = query.Where("suppression = ?", "")
			updates["consented_at"] = now
		} else {
			updates["unsubscribed_at"] = now
		}
		res := query.Updates(updates)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected != 1 {
			return errors.New("email preference suppressed")
		}
		return nil
	})
}
func (r *Repository) EmailReceipts(ids []string) (map[string]model.SupDanceEmailReceipt, error) {
	rows := []model.SupDanceEmailReceipt{}
	out := map[string]model.SupDanceEmailReceipt{}
	if len(ids) == 0 {
		return out, nil
	}
	err := r.db.Where("log_id IN ?", ids).Find(&rows).Error
	for _, row := range rows {
		out[row.LogID] = row
	}
	return out, err
}

func (r *Repository) EmailActivity() ([]model.AdminAuditEvent, error) {
	rows := []model.AdminAuditEvent{}
	err := r.db.Select("id, action, target_id, created_at").Where("action LIKE ?", "email.%").Order("created_at DESC").Limit(100).Find(&rows).Error
	return rows, err
}
func (r *Repository) EmailContacts() ([]model.SupDanceEmailContact, error) {
	rows := []model.SupDanceEmailContact{}
	err := r.db.Order("updated_at DESC").Limit(100).Find(&rows).Error
	return rows, err
}
func (r *Repository) StoreEmailBrandAsset(row *model.SupDanceEmailBrandAsset) error {
	return r.db.Clauses(clause.OnConflict{DoNothing: true}).Create(row).Error
}

func (r *Repository) StoreEmailBrandSnapshot(id, payload string) error {
	return r.db.Clauses(clause.OnConflict{DoNothing: true}).Create(&model.SystemSetting{Key: "sd.email.brand." + id, ValueJSON: payload, UpdatedAt: time.Now()}).Error
}
func (r *Repository) EmailBrandAsset(id string) (*model.SupDanceEmailBrandAsset, error) {
	var row model.SupDanceEmailBrandAsset
	err := r.db.First(&row, "id = ?", id).Error
	return &row, err
}

package repository

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"time"
	"yingce/backend/internal/model"
)

var ErrEmailCampaignNoSubscribers = errors.New("no explicitly subscribed recipients")
var ErrEmailCampaignRecipientLimit = errors.New("campaign recipient limit exceeded")

func (r *Repository) CreateEmailCampaign(row *model.SupDanceEmailCampaign) error {
	return r.db.Create(row).Error
}
func (r *Repository) EmailCampaign(id string) (*model.SupDanceEmailCampaign, error) {
	var row model.SupDanceEmailCampaign
	err := r.db.First(&row, "id = ?", id).Error
	return &row, err
}
func (r *Repository) EmailCampaigns() ([]model.SupDanceEmailCampaign, error) {
	rows := []model.SupDanceEmailCampaign{}
	err := r.db.Order("created_at DESC").Limit(100).Find(&rows).Error
	return rows, err
}
func (r *Repository) ScheduleEmailCampaign(id string, at time.Time) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var campaign model.SupDanceEmailCampaign
		if err := tx.First(&campaign, "id = ?", id).Error; err != nil {
			return err
		}
		res := tx.Model(&model.SupDanceEmailCampaign{}).Where("id = ? AND status IN ?", id, []string{"draft", "paused"}).Updates(map[string]any{"status": "scheduled", "schedule_at": at, "updated_at": time.Now()})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected != 1 {
			return ErrEmailRevisionConflict
		}
		query := tx.Model(&model.SupDanceEmailContact{}).Where("marketing = ? AND scope = ? AND suppression = ?", true, "marketing", "")
		if campaign.SourceFilter != "" {
			query = query.Where("source = ?", campaign.SourceFilter)
		}
		var contacts []model.SupDanceEmailContact
		if err := query.Limit(1001).Find(&contacts).Error; err != nil {
			return err
		}
		if len(contacts) > 1000 {
			return ErrEmailCampaignRecipientLimit
		}
		if len(contacts) == 0 {
			return ErrEmailCampaignNoSubscribers
		}
		for _, contact := range contacts {
			hash := sha256.Sum256([]byte(id + "\x00" + contact.Email + "\x00marketing"))
			now := time.Now()
			job := model.SupDanceEmailJob{ID: fmt.Sprintf("%x", hash), CampaignID: id, Recipient: contact.Email, Status: "pending", NextAttemptAt: at, CreatedAt: now, UpdatedAt: now}
			if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&job).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
func (r *Repository) SetEmailCampaignState(id, status string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&model.SupDanceEmailCampaign{}).Where("id = ? AND status IN ?", id, []string{"draft", "scheduled", "paused"}).Updates(map[string]any{"status": status, "updated_at": time.Now()})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected != 1 {
			return ErrEmailRevisionConflict
		}
		if status == "cancelled" {
			return tx.Model(&model.SupDanceEmailJob{}).Where("campaign_id = ? AND status IN ?", id, []string{"pending", "retrying"}).Update("status", "cancelled").Error
		}
		return nil
	})
}
func (r *Repository) ClaimEmailJob(now time.Time) (*model.SupDanceEmailJob, error) {
	var row model.SupDanceEmailJob
	scheduled := r.db.Model(&model.SupDanceEmailCampaign{}).Select("id").Where("status = ? AND schedule_at <= ?", "scheduled", now)
	err := r.db.Where("status IN ? AND next_attempt_at <= ? AND campaign_id IN (?)", []string{"pending", "retrying"}, now, scheduled).Order("next_attempt_at, id").First(&row).Error
	if err != nil {
		return nil, err
	}
	res := r.db.Model(&model.SupDanceEmailJob{}).Where("id = ? AND status IN ?", row.ID, []string{"pending", "retrying"}).Updates(map[string]any{"status": "sending", "attempts": gorm.Expr("attempts + 1"), "updated_at": now})
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected != 1 {
		return nil, ErrEmailRevisionConflict
	}
	row.Attempts++
	return &row, nil
}
func (r *Repository) FinishEmailJob(id, status string, next time.Time) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var job model.SupDanceEmailJob
		if err := tx.First(&job, "id = ?", id).Error; err != nil {
			return err
		}
		var campaign model.SupDanceEmailCampaign
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&campaign, "id = ?", job.CampaignID).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.SupDanceEmailJob{}).Where("id = ?", id).Updates(map[string]any{"status": status, "next_attempt_at": next, "updated_at": time.Now()}).Error; err != nil {
			return err
		}
		var remaining int64
		if err := tx.Model(&model.SupDanceEmailJob{}).Where("campaign_id = ? AND status IN ?", job.CampaignID, []string{"pending", "retrying", "sending"}).Count(&remaining).Error; err != nil {
			return err
		}
		if remaining == 0 {
			return tx.Model(&model.SupDanceEmailCampaign{}).Where("id = ? AND status = ?", job.CampaignID, "scheduled").Updates(map[string]any{"status": "completed", "updated_at": time.Now()}).Error
		}
		return nil
	})
}

func (r *Repository) DeferEmailJob(id string, at time.Time) error {
	return r.db.Model(&model.SupDanceEmailJob{}).Where("id = ? AND status = ?", id, "sending").Updates(map[string]any{"status": "pending", "attempts": gorm.Expr("CASE WHEN attempts > 0 THEN attempts - 1 ELSE 0 END"), "next_attempt_at": at, "updated_at": time.Now()}).Error
}
func (r *Repository) EmailJobs() ([]model.SupDanceEmailJob, error) {
	rows := []model.SupDanceEmailJob{}
	err := r.db.Order("updated_at DESC").Limit(100).Find(&rows).Error
	return rows, err
}
func (r *Repository) MarkAbandonedEmailJobs(now time.Time) error {
	// An abandoned sending attempt might already have reached SMTP. Never replay it.
	return r.db.Model(&model.SupDanceEmailJob{}).Where("status = ? AND updated_at < ?", "sending", now.Add(-5*time.Minute)).Updates(map[string]any{"status": "unknown", "updated_at": now}).Error
}
func (r *Repository) EmailJobStats(id string) (map[string]int64, error) {
	var rows []struct {
		Status string
		Count  int64
	}
	err := r.db.Model(&model.SupDanceEmailJob{}).Select("status,count(*) AS count").Where("campaign_id = ?", id).Group("status").Scan(&rows).Error
	stats := map[string]int64{}
	for _, row := range rows {
		stats[row.Status] = row.Count
	}
	return stats, err
}

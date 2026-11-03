package music

import (
	"context"
	"time"

	"gorm.io/gorm"
)

// Repository defines all database operations for the SupDance Music Plugin.
type Repository interface {
	// AutoMigrate applies GORM auto-migration for the isolated music tables.
	AutoMigrate(ctx context.Context) error

	// Task CRUD operations
	Create(ctx context.Context, generation *SupDanceMusicGeneration) error
	GetByID(ctx context.Context, id string) (*SupDanceMusicGeneration, error)
	GetByTaskID(ctx context.Context, taskID string) (*SupDanceMusicGeneration, error)
	Update(ctx context.Context, generation *SupDanceMusicGeneration) error
	UpdateProgress(ctx context.Context, id string, status MusicGenerationStatus, stage string) error
	CompleteSuccess(ctx context.Context, id string, audioURL string, durationMs int64, resourceID string) error
	CompleteFailure(ctx context.Context, id string, errorMsg string) error

	// User Queries
	ListByUserID(ctx context.Context, userID string, offset int, limit int) ([]*SupDanceMusicGeneration, int64, error)

	// Draining & Worker Operations
	ActiveMusicTaskCount(ctx context.Context) (int64, error)
	ListActiveTasks(ctx context.Context, limit int) ([]*SupDanceMusicGeneration, error)
	ListStaleTasks(ctx context.Context, olderThan time.Duration, limit int) ([]*SupDanceMusicGeneration, error)
}

// GormRepository implements Repository backed by GORM.
type GormRepository struct {
	db *gorm.DB
}

// NewRepository creates a new GormRepository.
func NewRepository(db *gorm.DB) *GormRepository {
	return &GormRepository{db: db}
}

func (r *GormRepository) AutoMigrate(ctx context.Context) error {
	return r.db.WithContext(ctx).AutoMigrate(&SupDanceMusicGeneration{})
}

func (r *GormRepository) Create(ctx context.Context, gen *SupDanceMusicGeneration) error {
	return r.db.WithContext(ctx).Create(gen).Error
}

func (r *GormRepository) GetByID(ctx context.Context, id string) (*SupDanceMusicGeneration, error) {
	var gen SupDanceMusicGeneration
	if err := r.db.WithContext(ctx).First(&gen, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &gen, nil
}

func (r *GormRepository) GetByTaskID(ctx context.Context, taskID string) (*SupDanceMusicGeneration, error) {
	var gen SupDanceMusicGeneration
	if err := r.db.WithContext(ctx).First(&gen, "task_id = ?", taskID).Error; err != nil {
		return nil, err
	}
	return &gen, nil
}

func (r *GormRepository) Update(ctx context.Context, gen *SupDanceMusicGeneration) error {
	return r.db.WithContext(ctx).Save(gen).Error
}

func (r *GormRepository) UpdateProgress(ctx context.Context, id string, status MusicGenerationStatus, stage string) error {
	return r.db.WithContext(ctx).Model(&SupDanceMusicGeneration{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"status":     status,
			"stage":      stage,
			"updated_at": time.Now(),
		}).Error
}

func (r *GormRepository) CompleteSuccess(ctx context.Context, id string, audioURL string, durationMs int64, resourceID string) error {
	updates := map[string]any{
		"status":             StatusCompleted,
		"stage":              "completed",
		"result_audio_url":   audioURL,
		"result_duration_ms": durationMs,
		"updated_at":         time.Now(),
	}
	if resourceID != "" {
		updates["resource_id"] = resourceID
	}
	return r.db.WithContext(ctx).Model(&SupDanceMusicGeneration{}).
		Where("id = ?", id).
		Updates(updates).Error
}

func (r *GormRepository) CompleteFailure(ctx context.Context, id string, errorMsg string) error {
	return r.db.WithContext(ctx).Model(&SupDanceMusicGeneration{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"status":        StatusFailed,
			"stage":         "failed",
			"error_message": errorMsg,
			"updated_at":    time.Now(),
		}).Error
}

func (r *GormRepository) ListByUserID(ctx context.Context, userID string, offset int, limit int) ([]*SupDanceMusicGeneration, int64, error) {
	var items []*SupDanceMusicGeneration
	var total int64
	query := r.db.WithContext(ctx).Model(&SupDanceMusicGeneration{}).Where("user_id = ?", userID)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := query.Order("created_at desc").Offset(offset).Limit(limit).Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *GormRepository) ActiveMusicTaskCount(ctx context.Context) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&SupDanceMusicGeneration{}).
		Where("status IN ?", NonTerminalStatuses).
		Count(&count).Error
	return count, err
}

func (r *GormRepository) ListActiveTasks(ctx context.Context, limit int) ([]*SupDanceMusicGeneration, error) {
	var items []*SupDanceMusicGeneration
	err := r.db.WithContext(ctx).
		Where("status IN ?", NonTerminalStatuses).
		Order("created_at asc").
		Limit(limit).
		Find(&items).Error
	return items, err
}

func (r *GormRepository) ListStaleTasks(ctx context.Context, olderThan time.Duration, limit int) ([]*SupDanceMusicGeneration, error) {
	var items []*SupDanceMusicGeneration
	cutoff := time.Now().Add(-olderThan)
	err := r.db.WithContext(ctx).
		Where("status IN ? AND updated_at < ?", NonTerminalStatuses, cutoff).
		Order("updated_at asc").
		Limit(limit).
		Find(&items).Error
	return items, err
}

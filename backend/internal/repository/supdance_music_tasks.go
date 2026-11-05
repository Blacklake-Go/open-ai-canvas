package repository

import "yingce/backend/internal/model"

func (r *Repository) ActiveMusicTaskCount() (int64, error) {
	var count int64
	err := r.db.Model(&model.Task{}).Where("type = ? AND input_json LIKE ? AND status IN ?", "canvas_audio", `%"source":"music-workbench"%`, []string{"queued", "running"}).Count(&count).Error
	return count, err
}

// MusicTaskPage reads host tasks by their persisted source, including renamed
// models. userID may be empty only for an already-authorized administrator.
func (r *Repository) MusicTaskPage(userID, status string, offset, limit int) ([]model.Task, int64, error) {
	query := r.db.Model(&model.Task{}).Where("type = ? AND input_json LIKE ?", "canvas_audio", `%"source":"music-workbench"%`)
	if userID != "" {
		query = query.Where("user_id = ?", userID)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var tasks []model.Task
	err := query.Order("created_at DESC, id DESC").Offset(offset).Limit(limit).Find(&tasks).Error
	return tasks, total, err
}

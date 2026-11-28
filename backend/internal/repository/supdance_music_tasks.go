package repository

import "yingce/backend/internal/model"

func (r *Repository) MusicCoverChildren(ids []string) (map[string]*model.Task, error) {
	children := make(map[string]*model.Task, len(ids))
	if len(ids) == 0 {
		return children, nil
	}
	var tasks []model.Task
	err := r.db.Select("id", "user_id", "type", "status", "result_json").Where("id IN ? AND type = ?", ids, "canvas_image").Find(&tasks).Error
	for i := range tasks {
		children[tasks[i].ID] = &tasks[i]
	}
	return children, err
}

func (r *Repository) MusicTasksAwaitingCover(limit int) ([]model.Task, error) {
	var tasks []model.Task
	err := r.db.Where("type = ? AND status = ? AND input_json LIKE ? AND input_json LIKE ?",
		"canvas_audio", model.TaskStatusSucceeded, `%"source":"music-workbench"%`, `%"musicCoverSelection":{%`).
		Where("(result_json NOT LIKE ? OR result_json LIKE ?)", `%"musicCover":{%`, `%"automaticPending":true%`).
		Order("updated_at ASC, id ASC").Limit(limit).Find(&tasks).Error
	return tasks, err
}

func (r *Repository) ActiveMusicTaskCount() (int64, error) {
	var count int64
	err := r.db.Model(&model.Task{}).Where("status IN ? AND ((type = ? AND input_json LIKE ?) OR (type = ? AND input_json LIKE ?))", []string{"queued", "running"}, "canvas_audio", `%"source":"music-workbench"%`, "canvas_image", `%"source":"music-cover"%`).Count(&count).Error
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

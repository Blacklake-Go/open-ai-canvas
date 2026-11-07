package repository

import (
	"errors"
	"time"

	"yingce/backend/internal/model"
)

// Mureka has no documented idempotency key for the paid song and stem POSTs.
// A lost upstream response must leave an uncertain task, not another automatic submission.
func (r *Repository) ClaimMusicToolDispatch(task *model.Task) error {
	result := taskLeaseWriter(r.db.Model(&model.Task{}), task.LeaseOwner).
		Where("id = ? AND user_id = ? AND status = ? AND COALESCE(provider_request_id, '') = '' AND COALESCE(poll_stage, '') = ''", task.ID, task.UserID, model.TaskStatusRunning).
		Updates(map[string]any{"poll_stage": "mureka_dispatching", "updated_at": time.Now()})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return errors.New("Mureka submission already started or the worker lease changed; verify the original request before resubmitting")
	}
	return nil
}

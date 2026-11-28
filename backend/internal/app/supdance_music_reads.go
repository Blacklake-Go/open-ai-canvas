package app

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"sort"
	"time"

	"gorm.io/gorm"

	"yingce/backend/internal/model"
	"yingce/backend/internal/supdance/music"
)

type MusicHostTask struct {
	*model.Task
	Billing        *TaskBillingSummary `json:"billing,omitempty"`
	PartiallySaved bool                `json:"partiallySaved,omitempty"`
	Cover          *MusicCoverView     `json:"cover,omitempty"`
}

type MusicTaskPage struct {
	Items       []*MusicHostTask                 `json:"items"`
	LegacyItems []*music.SupDanceMusicGeneration `json:"legacyItems"`
	Total       int64                            `json:"total"`
}

func (s *Service) musicHostTaskView(task *model.Task) (*MusicHostTask, error) {
	s.hydrateTaskProviderRequestID(task)
	view := &MusicHostTask{Task: taskForOutput(*task)}
	if task.ResultJSON == "" && task.MediaRecoveryJSON != "" {
		checkpoint, err := s.decodeMediaCheckpoint(task)
		if err != nil {
			return nil, err
		}
		outputs := []map[string]any{}
		for _, item := range checkpoint.Items {
			if item.ResourceID == "" {
				break
			}
			resource, err := s.repo.ResourceForUser(task.UserID, item.ResourceID)
			if err != nil {
				return nil, err
			}
			if resource.Status != model.ResourceStatusReady {
				break
			}
			outputs = append(outputs, map[string]any{"storageKey": "resource:" + resource.ID, "mimeType": resource.MimeType, "durationMs": resource.DurationMs, "bytes": resource.Size})
		}
		if len(outputs) > 0 {
			encoded, err := json.Marshal(map[string]any{"mode": "audio", "audios": outputs})
			if err != nil {
				return nil, err
			}
			view.ResultJSON, view.PartiallySaved = string(encoded), true
		}
	}
	if task.BillingOrderID != "" {
		order, err := s.repo.BillingOrder(task.BillingOrderID)
		if err != nil {
			return nil, err
		}
		if order.UserID != task.UserID || order.TaskID != task.ID {
			return nil, Forbidden("Music task billing owner mismatch")
		}
		view.Billing = taskBillingSummary(*order)
	}
	return view, nil
}

func (s *Service) MusicTaskView(ctx context.Context, actor *model.User, id string) (any, error) {
	if actor == nil {
		return nil, Unauthorized("Login is required")
	}
	task, err := s.repo.TaskForUser(actor.ID, id)
	if s.RequireAdmin(actor) == nil {
		task, err = s.repo.Task(id)
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return s.GetMusicTask(ctx, actor, id)
	}
	if err != nil {
		return nil, err
	}
	if task.Type != "canvas_audio" {
		return nil, NotFound("Music task not found")
	}
	view, err := s.musicHostTaskView(task)
	if err != nil || task.Status != model.TaskStatusSucceeded {
		return view, err
	}
	state, err := readMusicCoverState(task)
	if err != nil {
		return nil, err
	}
	cover, err := s.projectMusicCover(task, state)
	view.Cover = &cover
	return view, err
}

func (s *Service) MusicTaskPage(ctx context.Context, actor *model.User, status string, offset, limit int, admin bool) (*MusicTaskPage, error) {
	if actor == nil {
		return nil, Unauthorized("Login is required")
	}
	userID := actor.ID
	legacyStatus := status
	if admin {
		if err := s.RequireAdmin(actor); err != nil {
			return nil, err
		}
		userID = ""
	}
	if status == "completed" {
		status = "succeeded"
	}
	if status == "generating" {
		status = "running"
	}
	offset, limit = max(offset, 0), min(max(limit, 1), 100)
	// Merge the two histories before slicing, so pagination never skips or
	// repeats records when legacy and host tasks interleave in time.
	tasks, total, err := s.repo.MusicTaskPage(userID, status, 0, offset+limit)
	if err != nil {
		return nil, err
	}
	page := &MusicTaskPage{Items: []*MusicHostTask{}, LegacyItems: []*music.SupDanceMusicGeneration{}, Total: total}
	// The previous independent plugin records are read-only history. Never
	// rewrite their ledger or remove them during this incremental upgrade.
	var legacyTotal int64
	var legacy []*music.SupDanceMusicGeneration
	if s.repo.DB().Migrator().HasTable(&music.SupDanceMusicGeneration{}) {
		legacy, legacyTotal, err = music.NewRepository(s.repo.DB()).ListHistory(ctx, userID, legacyStatus, 0, offset+limit)
	}
	if err != nil {
		return nil, err
	}
	page.Total += legacyTotal
	type entry struct {
		host   *model.Task
		legacy *music.SupDanceMusicGeneration
		at     time.Time
		id     string
	}
	merged := make([]entry, 0, len(tasks)+len(legacy))
	for i := range tasks {
		merged = append(merged, entry{host: &tasks[i], at: tasks[i].CreatedAt, id: tasks[i].ID})
	}
	for _, item := range legacy {
		merged = append(merged, entry{legacy: item, at: item.CreatedAt, id: item.ID})
	}
	sort.Slice(merged, func(i, j int) bool {
		if merged[i].at.Equal(merged[j].at) {
			return merged[i].id > merged[j].id
		}
		return merged[i].at.After(merged[j].at)
	})
	entries := merged[min(offset, len(merged)):min(offset+limit, len(merged))]
	states := make(map[string]musicCoverState, len(entries))
	childIDs := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.host == nil || entry.host.Status != model.TaskStatusSucceeded {
			continue
		}
		state, err := readMusicCoverState(entry.host)
		if err != nil {
			slog.Warn("music cover metadata unavailable in history", "task_id", entry.host.ID, "error", err)
			continue
		}
		states[entry.host.ID] = state
		if state.ChildTaskID != "" {
			childIDs = append(childIDs, state.ChildTaskID)
		}
	}
	children, err := s.repo.WithContext(ctx).MusicCoverChildren(childIDs)
	if err != nil {
		return nil, err
	}
	for _, entry := range entries {
		if entry.legacy != nil {
			page.LegacyItems = append(page.LegacyItems, entry.legacy)
			continue
		}
		view, err := s.musicHostTaskView(entry.host)
		if err != nil {
			return nil, err
		}
		if state, ok := states[entry.host.ID]; ok {
			cover, err := musicCoverViewFromTasks(entry.host, state, children[state.ChildTaskID])
			if err != nil {
				slog.Warn("music cover image unavailable in history", "task_id", entry.host.ID, "error", err)
				cover = MusicCoverView{Status: "failed", StorageKey: state.StorageKey}
			}
			view.Cover = &cover
		}
		page.Items = append(page.Items, view)
	}
	return page, nil
}

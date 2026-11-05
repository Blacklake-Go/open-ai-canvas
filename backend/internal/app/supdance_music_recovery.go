package app

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"yingce/backend/internal/model"
)

// RecoverMusicAdminTest attaches an old, logged provider receipt to a durable
// host task. Its original owner and unbilled admin-test semantics are retained.
// The worker can only query this provider ID; it must never create a replacement.
func (s *Service) RecoverMusicAdminTest(ctx context.Context, actor *model.User, logID string) (*MusicHostTask, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	entry, err := s.repo.APICallLog(strings.TrimSpace(logID))
	if err != nil {
		return nil, err
	}
	if entry.Capability != "audio" || entry.Operation != "admin_model_test" || entry.ChannelID == "" {
		return nil, BadAuthRequest("Select a logged music model test receipt.")
	}
	if entry.TaskID != "" {
		existing, err := s.repo.TaskForUser(entry.UserID, entry.TaskID)
		if err != nil {
			return nil, err
		}
		return s.musicHostTaskView(existing)
	}
	providerID := entry.ProviderRequestID
	if providerID == "" {
		providerID, err = extractProviderTaskID([]byte(entry.ResponseBody))
	}
	if err != nil || strings.TrimSpace(providerID) == "" || len(providerID) > 160 {
		return nil, BadAuthRequest("This log has no recoverable provider task ID.")
	}
	cm, err := s.SystemChannelModel(entry.ChannelID, entry.Model)
	if err != nil {
		return nil, err
	}
	_, _, wired := musicProtocolProfile(string(cm.Protocol), firstNonEmpty(cm.ProviderModelKey, cm.ModelKey))
	if !wired {
		return nil, BadAuthRequest("This music operation is not connected.")
	}
	if _, err := s.repo.User(entry.UserID); err != nil {
		return nil, err
	}
	original := map[string]any{}
	if err := json.Unmarshal([]byte(entry.RequestBody), &original); err != nil {
		return nil, BadAuthRequest("The original request is unavailable.")
	}
	description, _ := original["description"].(string)
	lyrics, _ := original["lyrics"].(string)
	style, _ := original["prompt"].(string)
	mode := "simple"
	if lyrics != "" {
		mode = "custom"
	}
	music := map[string]any{"mode": mode, "lyrics": lyrics, "style": style, "billingOrigin": "legacy-admin-test"}
	if instrumental := original["make_instrumental"]; instrumental == true || instrumental == "true" {
		music["instrumental"] = true
	}
	prompt := firstNonEmpty(description, lyrics, "Recovered music test")
	input := map[string]any{"mode": "audio", "prompt": prompt, "config": map[string]any{"channelId": entry.ChannelID, "model": cm.ModelKey, "audioFormat": "mp3"}, "metadata": map[string]any{"source": "music-workbench", "music": music, "musicRecoveryOnly": true, "musicRecoveryLogId": entry.ID}}
	payload, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}
	id := uuid.NewSHA1(uuid.NameSpaceOID, []byte("music-test-recovery:"+entry.UserID+":"+entry.ChannelID+":"+providerID)).String()
	now := time.Now()
	task := &model.Task{ID: id, UserID: entry.UserID, Type: "canvas_audio", Operation: "audio", WorkbenchKind: "audio", Model: cm.ModelKey, ChannelModelID: cm.ID, ProviderRequestID: providerID, Status: model.TaskStatusQueued, Stage: "queued", Prompt: prompt, InputJSON: string(payload), RouteRun: 1, CreatedAt: now, UpdatedAt: now}
	err = s.repo.DB().WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(task).Error; err != nil {
			return err
		}
		return tx.Model(&model.ApiCallLog{}).Where("id = ? AND (task_id = '' OR task_id IS NULL)", entry.ID).Updates(map[string]any{"task_id": id, "provider_request_id": providerID}).Error
	})
	if err != nil {
		return nil, err
	}
	stored, err := s.repo.TaskForUser(entry.UserID, id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, NotFound("Recovered task was not persisted.")
	}
	if err != nil {
		return nil, err
	}
	_ = s.appendAdminAudit(actor, "music.recover_admin_test", "task", id, "Recover existing music provider receipt", map[string]any{"logId": entry.ID, "providerTaskId": providerID, "newGeneration": false, "userCharge": false})
	return s.musicHostTaskView(stored)
}

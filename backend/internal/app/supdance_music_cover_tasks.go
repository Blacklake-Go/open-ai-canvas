package app

import (
	"encoding/json"
	"errors"
	"image"
	"io"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"yingce/backend/internal/model"
)

type MusicCoverView struct {
	Status     string `json:"status"`
	StorageKey string `json:"storageKey,omitempty"`
}

type MusicCoverRequest struct {
	Model              string `json:"model"`
	QuotedMicrocredits *int64 `json:"quotedMicrocredits"`
	Nonce              string `json:"nonce"`
}

type musicCoverState struct {
	StorageKey  string    `json:"storageKey,omitempty"`
	ChildTaskID string    `json:"childTaskId,omitempty"`
	RequestedAt time.Time `json:"requestedAt,omitempty"`
}

const musicCoverSubmissionGrace = time.Minute

func (s *Service) musicCoverParent(actor *model.User, id string) (*model.Task, error) {
	if actor == nil {
		return nil, Unauthorized("Login is required.")
	}
	task, err := s.repo.TaskForUser(actor.ID, id)
	if errors.Is(err, gorm.ErrRecordNotFound) || err == nil && (task.Type != "canvas_audio" || task.Status != model.TaskStatusSucceeded) {
		return nil, NotFound("Completed song not found.")
	}
	return task, err
}

func readMusicCoverState(task *model.Task) (musicCoverState, error) {
	var payload struct {
		Cover musicCoverState `json:"musicCover"`
	}
	if task.ResultJSON == "" {
		return payload.Cover, nil
	}
	err := json.Unmarshal([]byte(task.ResultJSON), &payload)
	return payload.Cover, err
}

func (s *Service) projectMusicCover(parent *model.Task, cover musicCoverState) (MusicCoverView, error) {
	view := MusicCoverView{StorageKey: cover.StorageKey, Status: "none"}
	if cover.StorageKey != "" {
		view.Status = "ready"
	}
	if cover.ChildTaskID == "" {
		return view, nil
	}
	child, err := s.repo.TaskForUser(parent.UserID, cover.ChildTaskID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		view.Status = "failed"
		if time.Since(cover.RequestedAt) < musicCoverSubmissionGrace {
			view.Status = "pending"
		}
		return view, nil
	}
	if err != nil {
		return view, err
	}
	switch child.Status {
	case model.TaskStatusQueued, model.TaskStatusRunning:
		view.Status = "pending"
	case model.TaskStatusSucceeded:
		var result struct {
			Images []struct {
				StorageKey string `json:"storageKey"`
			} `json:"images"`
		}
		if err := json.Unmarshal([]byte(child.ResultJSON), &result); err != nil {
			return view, err
		}
		view.Status = "failed"
		if len(result.Images) > 0 && strings.HasPrefix(result.Images[0].StorageKey, "resource:") {
			view.Status, view.StorageKey = "ready", result.Images[0].StorageKey
		}
	default:
		view.Status = "failed"
	}
	return view, nil
}

func (s *Service) MusicCoverView(actor *model.User, id string) (MusicCoverView, error) {
	task, err := s.musicCoverParent(actor, id)
	if err != nil {
		return MusicCoverView{}, err
	}
	cover, err := readMusicCoverState(task)
	if err != nil {
		return MusicCoverView{}, err
	}
	return s.projectMusicCover(task, cover)
}

func (s *Service) writeMusicCover(task *model.Task, cover musicCoverState) error {
	payload := map[string]json.RawMessage{}
	if task.ResultJSON != "" {
		if err := json.Unmarshal([]byte(task.ResultJSON), &payload); err != nil {
			return err
		}
	}
	if payload == nil {
		return BadAuthRequest("The song result is unavailable.")
	}
	encoded, err := json.Marshal(cover)
	if err != nil {
		return err
	}
	payload["musicCover"] = encoded
	result, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	saved, err := s.repo.ReplaceCompletedAudioTaskResult(task.UserID, task.ID, task.ResultJSON, string(result))
	if err != nil {
		return err
	}
	if !saved {
		return NewAppError(409, "The cover changed. Reload the track before retrying.")
	}
	task.ResultJSON = string(result)
	return nil
}

func (s *Service) GenerateMusicCover(actor *model.User, id string, request MusicCoverRequest) (MusicCoverView, error) {
	parent, err := s.musicCoverParent(actor, id)
	if err != nil {
		return MusicCoverView{}, err
	}
	if err := s.CheckMusicTaskAdmission(actor.ID); err != nil {
		return MusicCoverView{}, err
	}
	if len(request.Nonce) < 8 || len(request.Nonce) > 128 || request.QuotedMicrocredits == nil || *request.QuotedMicrocredits < 0 {
		return MusicCoverView{}, BadAuthRequest("A current cover quote and request ID are required.")
	}
	cover, err := readMusicCoverState(parent)
	if err != nil {
		return MusicCoverView{}, err
	}
	current, err := s.projectMusicCover(parent, cover)
	if err != nil {
		return MusicCoverView{}, err
	}
	childID := uuid.NewSHA1(uuid.NameSpaceOID, []byte("supdance:music-cover:"+actor.ID+":"+id+":"+request.Nonce)).String()
	if current.Status == "pending" && cover.ChildTaskID != childID {
		return current, NewAppError(409, "A cover is already being generated for this song.")
	}
	if cover.ChildTaskID == childID {
		if _, lookupErr := s.repo.TaskForUser(actor.ID, childID); lookupErr == nil {
			return current, nil
		} else if !errors.Is(lookupErr, gorm.ErrRecordNotFound) {
			return current, lookupErr
		}
	}
	config, err := s.musicCoverConfig()
	if err != nil {
		return current, err
	}
	if !config.Enabled {
		return current, Forbidden("Cover generation is disabled.")
	}
	channelID, modelKey, ok := strings.Cut(request.Model, "::")
	if !ok || !slices.Contains(config.AllowedModels, request.Model) {
		return current, InvalidModelSelection("The cover model is unavailable.")
	}
	intent, err := s.musicCoverIntent(channelID, modelKey)
	if err != nil {
		return current, err
	}
	quoteRequest := ChannelModelQuoteRequest{ChannelID: channelID, ModelKey: modelKey, Intent: intent}
	quote, err := s.quoteChannelModel(actor.ID, quoteRequest, true)
	if err != nil {
		return current, err
	}
	if quote.AmountMicrocredits != *request.QuotedMicrocredits {
		return current, NewAppError(409, "The cover quote changed. Reload the price before generating.")
	}
	var input struct {
		Metadata struct {
			Music struct {
				Title  string `json:"title"`
				Lyrics string `json:"lyrics"`
			} `json:"music"`
		} `json:"metadata"`
	}
	if parent.InputJSON != "" {
		if err := json.Unmarshal([]byte(publicTaskInputJSON(parent.InputJSON)), &input); err != nil {
			return current, err
		}
	}
	shorten := func(value string, limit int) string {
		runes := []rune(strings.TrimSpace(value))
		return string(runes[:min(len(runes), limit)])
	}
	prompt := strings.NewReplacer(
		"{title}", shorten(firstNonEmpty(input.Metadata.Music.Title, parent.Prompt), 120),
		"{prompt}", shorten(parent.Prompt, 500),
		"{lyrics}", shorten(input.Metadata.Music.Lyrics, 500),
	).Replace(config.PromptTemplate)
	pending := musicCoverState{StorageKey: current.StorageKey, ChildTaskID: childID, RequestedAt: time.Now().UTC()}
	if err := s.writeMusicCover(parent, pending); err != nil {
		return current, err
	}
	taskInput := quoteInput(intent, modelKey)
	taskInput["config"].(map[string]any)["channelId"] = channelID
	taskInput["prompt"] = prompt
	taskInput["metadata"] = map[string]any{"source": "music-cover", "musicCoverParentId": parent.ID}
	_, createErr := s.CreateTask(actor.ID, CreateTaskRequest{Type: "canvas_image", Operation: intent.Operation, Model: modelKey, Prompt: prompt,
		admission: &taskAdmission{ID: childID, MaxCharge: *request.QuotedMicrocredits, MusicCover: true},
		Input:     taskInput,
	})
	if createErr != nil {
		if _, lookupErr := s.repo.TaskForUser(actor.ID, childID); lookupErr == nil {
			return MusicCoverView{StorageKey: current.StorageKey, Status: "pending"}, nil
		} else if !errors.Is(lookupErr, gorm.ErrRecordNotFound) {
			return current, errors.Join(createErr, lookupErr)
		}
		clearErr := s.writeMusicCover(parent, musicCoverState{StorageKey: current.StorageKey})
		return current, errors.Join(createErr, clearErr)
	}
	return MusicCoverView{StorageKey: current.StorageKey, Status: "pending"}, nil
}

func (s *Service) AttachMusicCover(actor *model.User, id, resourceID string) (MusicCoverView, error) {
	parent, err := s.musicCoverParent(actor, id)
	if err != nil {
		return MusicCoverView{}, err
	}
	if err := s.CheckMusicTaskAdmission(actor.ID); err != nil {
		return MusicCoverView{}, err
	}
	config, err := s.musicCoverConfig()
	if err != nil {
		return MusicCoverView{}, err
	}
	if !config.AllowUpload {
		return MusicCoverView{}, Forbidden("Custom covers are disabled.")
	}
	cover, err := readMusicCoverState(parent)
	if err != nil {
		return MusicCoverView{}, err
	}
	current, err := s.projectMusicCover(parent, cover)
	if err != nil {
		return current, err
	}
	if current.Status == "pending" {
		return current, NewAppError(409, "Wait for the current cover generation before uploading a replacement.")
	}
	resource, body, err := s.OpenResource(actor.ID, resourceID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return current, NotFound("Image resource not found.")
	}
	if err != nil {
		return current, err
	}
	defer body.Close()
	if resource.Kind != "image" || resource.Status != model.ResourceStatusReady || resource.Size <= 0 || resource.Size > config.MaxUploadBytes {
		return current, BadAuthRequest("The image exceeds the cover upload limits.")
	}
	dimensions, format, decodeErr := image.DecodeConfig(io.LimitReader(body, 1<<20))
	if decodeErr != nil || format != "jpeg" && format != "png" && format != "webp" || dimensions.Width > config.MaxDimension || dimensions.Height > config.MaxDimension {
		return current, BadAuthRequest("Choose a JPEG, PNG or WebP within the cover dimension limits.")
	}
	updated := musicCoverState{StorageKey: "resource:" + resource.ID}
	if err := s.writeMusicCover(parent, updated); err != nil {
		return current, err
	}
	return MusicCoverView{Status: "ready", StorageKey: updated.StorageKey}, nil
}

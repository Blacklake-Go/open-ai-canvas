package app

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"gorm.io/gorm"
	"yingce/backend/internal/supdance/music"
)

type StudioMusicDraft struct {
	Kind         string `json:"kind"`
	Model        string `json:"model"`
	Mode         string `json:"mode"`
	Prompt       string `json:"prompt"`
	Lyrics       string `json:"lyrics,omitempty"`
	Tags         string `json:"tags,omitempty"`
	SongLanguage string `json:"songLanguage,omitempty"`
	Instrumental bool   `json:"instrumental,omitempty"`
}

type StudioMusicSubmit struct {
	Generation StudioMusicDraft `json:"generation"`
	Quote      StudioQuote      `json:"quote"`
}

func (draft StudioMusicDraft) request() music.MusicGenerationRequest {
	return music.MusicGenerationRequest{
		Model: draft.Model, Mode: draft.Mode, Prompt: draft.Prompt, Lyrics: draft.Lyrics,
		Tags: draft.Tags, SongLanguage: draft.SongLanguage, Instrumental: draft.Instrumental,
	}
}

func (s *Service) StudioMusicModels(ctx context.Context, userID string) ([]music.ModelCapabilities, error) {
	enabled, err := s.MusicPluginEffectiveEnabled(userID)
	models := []music.ModelCapabilities{}
	if err != nil || !enabled {
		return models, err
	}
	catalog, err := s.MusicCapabilitiesForUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	for _, item := range catalog {
		if len(models) == 100 {
			break
		}
		if item.Available && len(item.Operations) == 0 && s.studioChannelConfigured(item.ChannelID) {
			models = append(models, item)
		}
	}
	return models, nil
}

func studioMusicQuoteSignature(userID string, secret []byte, draft StudioMusicDraft, quote StudioQuote) string {
	quote.ID = ""
	payload, _ := json.Marshal(struct {
		Account string
		Draft   StudioMusicDraft
		Quote   StudioQuote
	}{userID, draft, quote})
	key := hmac.New(sha256.New, secret)
	key.Write([]byte("supdance-studio-music\x00"))
	key.Write(payload)
	return base64.RawURLEncoding.EncodeToString(key.Sum(nil))
}

func (s *Service) StudioMusicEstimate(ctx context.Context, userID string, secret []byte, draft StudioMusicDraft) (StudioQuote, error) {
	if draft.Kind != "audio" || len(draft.Model) > 300 {
		return StudioQuote{}, BadAuthRequest("Invalid music request")
	}
	if err := s.CheckMusicTaskAdmission(userID); err != nil {
		return StudioQuote{}, err
	}
	models, err := s.StudioMusicModels(ctx, userID)
	if err != nil {
		return StudioQuote{}, err
	}
	for _, item := range models {
		if item.ID != draft.Model {
			continue
		}
		if err := validateSiteMusicRequest(draft.request(), item); err != nil {
			return StudioQuote{}, err
		}
		price, err := s.QuoteMusicTask(userID, item.ID)
		if err != nil {
			return StudioQuote{}, err
		}
		if !studioBillableMode(price.BillingMode) {
			return StudioQuote{}, studioError(http.StatusUnprocessableEntity, "studio_quote_required")
		}
		quote := StudioQuote{Microcredits: price.AmountMicrocredits, Estimated: price.Estimated, ExpiresAt: time.Now().Add(5 * time.Minute).UnixMilli()}
		quote.ID = studioMusicQuoteSignature(userID, secret, draft, quote)
		return quote, nil
	}
	return StudioQuote{}, studioError(http.StatusUnprocessableEntity, "studio_model_unavailable")
}

func (s *Service) StudioMusicOperation(userID string, key string, input StudioMusicSubmit) (StudioTask, error) {
	if !supdanceOpenAIID.MatchString(key) || len(key) < 8 || input.Generation.Kind != "audio" {
		return StudioTask{}, BadAuthRequest("Invalid music request ID")
	}
	req := input.Generation.request()
	req.IdempotencyNonce, req.QuotedMicrocredits = key, &input.Quote.Microcredits
	id, fingerprint, err := musicRequestIdentity(userID, req)
	if err != nil {
		return StudioTask{}, err
	}
	task, err := s.repo.TaskForUser(userID, id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return StudioTask{}, NotFound("Studio task unavailable")
	}
	if err != nil {
		return StudioTask{}, err
	}
	var stored canvasGenerationInput
	if json.Unmarshal([]byte(task.InputJSON), &stored) != nil || stored.Metadata["musicFingerprint"] != fingerprint {
		return StudioTask{}, studioError(http.StatusConflict, "studio_idempotency_conflict")
	}
	return s.studioTaskView(*task)
}

func (s *Service) StudioMusicCreate(ctx context.Context, userID string, secret []byte, key string, input StudioMusicSubmit) (StudioTask, error) {
	if previous, err := s.StudioMusicOperation(userID, key, input); err == nil || !studioNotFound(err) {
		return previous, err
	}
	quote := input.Quote
	if quote.ExpiresAt <= time.Now().UnixMilli() || !hmac.Equal([]byte(quote.ID), []byte(studioMusicQuoteSignature(userID, secret, input.Generation, quote))) {
		return StudioTask{}, studioError(http.StatusConflict, "studio_quote_changed")
	}
	current, err := s.StudioMusicEstimate(ctx, userID, secret, input.Generation)
	if err != nil {
		return StudioTask{}, err
	}
	if current.Microcredits != quote.Microcredits || current.Estimated != quote.Estimated {
		return StudioTask{}, studioError(http.StatusConflict, "studio_quote_changed")
	}
	req := input.Generation.request()
	req.IdempotencyNonce, req.QuotedMicrocredits = key, &quote.Microcredits
	receipt, err := s.SubmitMusicTask(ctx, userID, req)
	if err != nil {
		return StudioTask{}, err
	}
	return s.StudioTask(userID, receipt.TaskID)
}

func isStudioMusicTask(taskType, input string) bool {
	if taskType != "canvas_audio" {
		return false
	}
	var value canvasGenerationInput
	return strings.Contains(input, "music-workbench") && json.Unmarshal([]byte(input), &value) == nil &&
		value.Metadata["source"] == "music-workbench"
}

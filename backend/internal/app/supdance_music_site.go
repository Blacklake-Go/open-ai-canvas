package app

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os/exec"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"yingce/backend/internal/model"
	"yingce/backend/internal/supdance/music"
)

// Profiles describe the wired protocol, never a parallel model or price catalog.
// The selected channel, upstream SKU, availability and quote remain host-owned.
func musicProtocolProfile(protocol, upstream string) (music.ModelCapabilities, string, bool) {
	profile := music.ModelCapabilities{Formats: []string{"mp3"}, MaxPromptChars: 1500, MaxLyricsChars: 3000, OutputCount: 1}
	switch {
	case protocol == "mureka-music-tools":
		return musicToolProfile(upstream)
	case protocol == "runninghub-standard-audio-suno" || protocol == "runninghub-standard-audio" && strings.HasPrefix(upstream, "rhart-audio/suno-") && strings.HasSuffix(upstream, "/single"):
		profile.Modes = []string{"simple"}
		profile.InstrumentalSupported = true
		return profile, "runninghub-standard-audio-suno", true
	case protocol == "runninghub-standard-audio-mureka" || protocol == "runninghub-standard-audio" && strings.HasPrefix(upstream, "mureka-ai/") && strings.HasSuffix(upstream, "/generate-song"):
		profile.Modes = []string{"custom"}
		profile.LyricsSupported = true
		profile.StyleSupported = true
		return profile, "runninghub-standard-audio-mureka", true
	default:
		return profile, "", false
	}
}

func (s *Service) siteMusicCapabilities(userID string) ([]music.ModelCapabilities, error) {
	var access *userGroupAccess
	var err error
	if userID != "" {
		access, err = s.userGroupAccess(userID)
		if err != nil {
			return nil, err
		}
	}
	channels, err := s.systemChannelCatalog(access, nil, true)
	if err != nil {
		return nil, err
	}
	result := []music.ModelCapabilities{}
	for _, channel := range channels {
		var toolChannel *model.ModelChannel
		for _, item := range channel.Models {
			if item.Capability != "audio" {
				continue
			}
			stored, err := s.SystemChannelModel(channel.ID, item.ModelKey)
			if err != nil {
				return nil, err
			}
			caps, _, wired := musicProtocolProfile(string(item.Protocol), firstNonEmpty(stored.ProviderModelKey, stored.ModelKey))
			if !wired {
				continue
			}
			caps.ID = channel.ID + "::" + item.ModelKey
			caps.ChannelID, caps.ModelKey = channel.ID, item.ModelKey
			caps.Name, caps.Available, caps.BillingMode = item.DisplayName, item.Available, item.PricingMode
			if len(caps.Operations) != 0 {
				if toolChannel == nil {
					toolChannel, err = s.repo.SystemChannel(channel.ID)
					if err != nil {
						return nil, err
					}
				}
				_, registered := s.protocolRegistry().Resolve("mureka-music-tools")
				baseURL := strings.TrimRight(strings.TrimSpace(toolChannel.BaseURL), "/")
				caps.Available = caps.Available && registered && strings.TrimSpace(toolChannel.APIKey) != "" &&
					(baseURL == murekaAPIOrigin || baseURL == murekaAPIOrigin+"/v1") && mediaProbeAvailable() && hasDedicatedMusicToolPrice(stored, caps.Operations[0])
				if caps.Available && caps.Operations[0] == "region" {
					_, err := exec.LookPath("ffmpeg")
					caps.Available = err == nil
				}
			}
			if caps.Name == "" {
				caps.Name = item.ModelKey
			}
			result = append(result, caps)
		}
	}
	return result, nil
}

func (s *Service) MusicCapabilitiesForUser(ctx context.Context, userID string) ([]music.ModelCapabilities, error) {
	return s.siteMusicCapabilities(userID)
}

func (s *Service) QuoteMusicTask(userID, modelID string) (*LogicalModelQuote, error) {
	return s.QuoteMusicOperation(userID, modelID, "")
}

func (s *Service) QuoteMusicOperation(userID, modelID, operation string) (*LogicalModelQuote, error) {
	caps, err := s.siteMusicCapabilities(userID)
	if err != nil {
		return nil, err
	}
	for _, cap := range caps {
		if cap.ID == modelID && cap.Available {
			if !musicOperationMatches(cap, operation) {
				return nil, InvalidModelSelection("The selected model does not price this music operation.")
			}
			intent := ModelRequestIntent{Capability: "audio", Operation: "audio"}
			if operation != "" {
				intent.Inputs = map[string]int{"audio": 1}
			}
			quote, err := s.QuoteChannelModel(userID, ChannelModelQuoteRequest{ChannelID: cap.ChannelID, ModelKey: cap.ModelKey, Intent: intent})
			if err == nil && operation != "" && (quote.BillingMode != "fixed_request" || quote.Estimated || quote.Quantity != 1) {
				return nil, InvalidModelSelection("The music operation requires an explicit fixed price per request.")
			}
			return quote, err
		}
	}
	return nil, InvalidModelSelection("Music model is unavailable. Refresh the model catalog.")
}

func validateSiteMusicRequest(req music.MusicGenerationRequest, cap music.ModelCapabilities) error {
	if !cap.Available || !slices.Contains(cap.Modes, req.Mode) {
		return BadAuthRequest("The selected model does not support this creation mode.")
	}
	if !musicOperationMatches(cap, req.Operation) {
		return InvalidModelSelection("The selected model cannot perform this music operation.")
	}
	if req.Operation != "" {
		return validateMusicToolFields(req, cap)
	}
	if req.SourceResourceID != "" || req.EditStartMs != 0 || req.EditEndMs != 0 {
		return BadAuthRequest("Source audio and edit ranges require a music tool.")
	}
	if utf8.RuneCountInString(req.Prompt) > cap.MaxPromptChars || utf8.RuneCountInString(req.Lyrics) > cap.MaxLyricsChars {
		return BadAuthRequest("Music input exceeds the model limit.")
	}
	if utf8.RuneCountInString(req.Title) > 200 || utf8.RuneCountInString(req.Tags) > cap.MaxPromptChars || utf8.RuneCountInString(req.SongLanguage) > 80 {
		return BadAuthRequest("Music input exceeds the model limit.")
	}
	if req.Mode == "simple" && strings.TrimSpace(req.Prompt) == "" {
		return BadAuthRequest("Enter a music description.")
	}
	if req.Mode == "custom" && strings.TrimSpace(req.Lyrics) == "" {
		return BadAuthRequest("Enter custom lyrics.")
	}
	if req.Lyrics != "" && !cap.LyricsSupported || req.Instrumental && !cap.InstrumentalSupported || req.DurationSeconds != 0 && !cap.DurationSupported || req.Title != "" && !cap.TitleSupported || req.Tags != "" && !cap.StyleSupported {
		return BadAuthRequest("Unsupported music parameters. Review the selected model's capabilities.")
	}
	if req.VocalGender != "" || req.TempoBpm != 0 || req.KeySignature != "" || req.SynthIDWatermark != nil || len(req.Stems) != 0 || req.ContinuationClipID != "" {
		return BadAuthRequest("This music operation is not connected.")
	}
	if req.Format != "" && req.Format != "mp3" {
		return BadAuthRequest("The selected model returns MP3 audio.")
	}
	if req.SongLanguage != "" && !cap.StyleSupported {
		return BadAuthRequest("Song language preference is not supported by this operation.")
	}
	return nil
}

func (s *Service) submitSiteMusicTask(ctx context.Context, userID string, req music.MusicGenerationRequest) (*music.MusicGenerationResponse, error) {
	if len(req.IdempotencyNonce) < 8 || len(req.IdempotencyNonce) > 128 || req.QuotedMicrocredits == nil || *req.QuotedMicrocredits < 0 {
		return nil, BadAuthRequest("A current quote and submission ID are required.")
	}
	req.UserID, req.TaskID = "", ""
	encoded, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}
	sum := sha256.Sum256(encoded)
	fingerprint := hex.EncodeToString(sum[:])
	id := uuid.NewSHA1(uuid.NameSpaceOID, []byte("supdance-music:"+userID+":"+req.IdempotencyNonce)).String()
	if existing, err := s.repo.TaskForUser(userID, id); err == nil {
		var input struct {
			Metadata struct {
				MusicFingerprint string `json:"musicFingerprint"`
			} `json:"metadata"`
		}
		if err := json.Unmarshal([]byte(existing.InputJSON), &input); err != nil || input.Metadata.MusicFingerprint != fingerprint {
			return nil, BadAuthRequest("Submission ID already belongs to another request.")
		}
		return musicTaskReceipt(existing), nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if err := s.CheckMusicTaskAdmission(userID); err != nil {
		return nil, err
	}
	caps, err := s.siteMusicCapabilities(userID)
	if err != nil {
		return nil, err
	}
	var selected *music.ModelCapabilities
	for i := range caps {
		if caps[i].ID == req.Model {
			selected = &caps[i]
			break
		}
	}
	if selected == nil {
		return nil, InvalidModelSelection("Music model is unavailable.")
	}
	if err := validateSiteMusicRequest(req, *selected); err != nil {
		return nil, err
	}
	var source *model.Resource
	if req.Operation != "" {
		source, err = s.musicToolSource(userID, req)
		if err != nil {
			return nil, err
		}
	}
	quote, err := s.QuoteMusicOperation(userID, req.Model, req.Operation)
	if err != nil {
		return nil, err
	}
	if quote.AmountMicrocredits != *req.QuotedMicrocredits {
		failure := BadAuthRequest("Music price changed. Refresh the quote before submitting.")
		failure.Reason = "music_quote_changed"
		return nil, failure
	}
	if source != nil {
		if err := s.verifyMusicSourceAudio(ctx, req, source); err != nil {
			return nil, err
		}
	}
	prompt := req.Prompt
	if strings.TrimSpace(prompt) == "" {
		prompt = req.Lyrics
	}
	options := map[string]any{"mode": req.Mode, "title": req.Title, "lyrics": req.Lyrics, "style": req.Tags, "songLanguage": req.SongLanguage, "instrumental": req.Instrumental}
	metadata := map[string]any{"source": "music-workbench", "musicFingerprint": fingerprint, "music": options}
	input := map[string]any{"mode": "audio", "config": map[string]any{"channelId": selected.ChannelID, "model": selected.ModelKey, "audioFormat": selected.Formats[0]}, "metadata": metadata}
	if source != nil {
		options["operation"], options["sourceResourceId"] = req.Operation, source.ID
		options["editStartMs"], options["editEndMs"] = req.EditStartMs, req.EditEndMs
		options["style"] = firstNonEmpty(req.Tags, req.Prompt)
		input["referenceAudios"] = []any{map[string]any{"id": source.ID, "storageKey": "resource:" + source.ID, "mimeType": source.MimeType}}
		if strings.TrimSpace(prompt) == "" {
			prompt = req.Operation
		}
	}
	input["prompt"] = prompt
	task, err := s.CreateTask(userID, CreateTaskRequest{Type: "canvas_audio", Operation: "audio", Model: selected.ModelKey, Prompt: prompt,
		admission: &taskAdmission{ID: id, MaxCharge: *req.QuotedMicrocredits, MusicOperation: req.Operation},
		Input:     input,
	})
	if err != nil {
		// The host transaction rolls back duplicate task IDs and their reservation together.
		if existing, readErr := s.repo.TaskForUser(userID, id); readErr == nil {
			var input struct {
				Metadata struct {
					MusicFingerprint string `json:"musicFingerprint"`
				} `json:"metadata"`
			}
			if json.Unmarshal([]byte(existing.InputJSON), &input) == nil && input.Metadata.MusicFingerprint == fingerprint {
				return musicTaskReceipt(existing), nil
			}
		}
		return nil, err
	}
	return musicTaskReceipt(task), nil
}

func musicTaskReceipt(task *model.Task) *music.MusicGenerationResponse {
	return &music.MusicGenerationResponse{TaskID: task.ID, UpstreamTaskID: task.ProviderRequestID, Status: string(task.Status), Stage: task.Stage, Model: task.Model, CreatedAt: task.CreatedAt.Unix(), UpdatedAt: task.UpdatedAt.Unix()}
}

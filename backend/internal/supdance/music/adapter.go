package music

import (
	"errors"
	"fmt"
	"strings"
	"sync"
	"unicode/utf8"
)

// Supported canonical model IDs
const (
	ModelMurekaV95   = "mureka-9.5"
	ModelSunoV6      = "suno-v6"
	ModelLyria35     = "lyria-3.5"
	ModelElevenMusic = "music_v2_5"
)

// Supported audio formats
const (
	FormatMP3  = "mp3"
	FormatWAV  = "wav"
	FormatFLAC = "flac"
)

// Generation modes
const (
	ModeSimple = "simple"
	ModeCustom = "custom"
)

// MusicGenerationRequest is the unified internal request struct for music generation tasks.
type MusicGenerationRequest struct {
	UserID             string   `json:"userId,omitempty"`
	TaskID             string   `json:"taskId,omitempty"`
	Model              string   `json:"model" binding:"required"`
	Mode               string   `json:"mode" binding:"required,oneof=simple custom"`
	Prompt             string   `json:"prompt" binding:"required"`
	Title              string   `json:"title,omitempty"`
	Lyrics             string   `json:"lyrics,omitempty"`
	Tags               string   `json:"tags,omitempty"`
	Instrumental       bool     `json:"instrumental"`
	DurationSeconds    int      `json:"duration,omitempty"`
	Format             string   `json:"format,omitempty"`
	VocalGender        string   `json:"vocalGender,omitempty"`
	TempoBpm           int      `json:"tempoBpm,omitempty"`
	KeySignature       string   `json:"keySignature,omitempty"`
	SynthIDWatermark   *bool    `json:"synthIdWatermark,omitempty"`
	Stems              []string `json:"stems,omitempty"`
	ContinuationClipID string   `json:"continuationClipId,omitempty"`
	IdempotencyNonce   string   `json:"idempotencyNonce" binding:"required"`
}

// MusicGenerationResponse is the unified internal response struct for music generation queries.
type MusicGenerationResponse struct {
	TaskID           string            `json:"taskId"`
	UpstreamTaskID   string            `json:"upstreamTaskId"`
	Status           string            `json:"status"`
	Stage            string            `json:"stage"`
	Model            string            `json:"model"`
	Mode             string            `json:"mode"`
	DurationSeconds  int               `json:"duration"`
	AudioURL         string            `json:"audioUrl,omitempty"`
	AudioFormats     map[string]string `json:"audioFormats,omitempty"`
	StemURLs         map[string]string `json:"stems,omitempty"`
	SynthIDWatermark bool              `json:"synthIdWatermarked,omitempty"`
	ErrorMessage     string            `json:"errorMessage,omitempty"`
	CreatedAt        int64             `json:"createdAt"`
	UpdatedAt        int64             `json:"updatedAt"`
}

// ModelCapabilities encapsulates dynamic model capabilities, parameters, and availability.
type ModelCapabilities struct {
	ID                        string   `json:"id"`
	Name                      string   `json:"name"`
	Version                   string   `json:"version"`
	Modes                     []string `json:"modes"`
	MinDuration               int      `json:"minDuration"`
	MaxDuration               int      `json:"maxDuration"`
	Formats                   []string `json:"formats"`
	MaxPromptChars            int      `json:"maxPromptChars"`
	MaxLyricsChars            int      `json:"maxLyricsChars"`
	CostPerSecondMicrocredits int64    `json:"costPerSecondMicrocredits"`
	VocalGenders              []string `json:"vocalGenders,omitempty"`
	StemSeparation            bool     `json:"stemSeparation"`
	SupportedStems            []string `json:"supportedStems,omitempty"`
	TempoBpmRange             [2]int   `json:"tempoBpmRange,omitempty"`
	KeySignatures             []string `json:"keySignatures,omitempty"`
	SynthIDWatermarking       bool     `json:"synthIdWatermarking,omitempty"`
	ContinuationSupported     bool     `json:"continuationSupported,omitempty"`
	HighFidelityVocal         bool     `json:"highFidelityVocal,omitempty"`
	Available                 bool     `json:"available"`
	UnavailableReason         string   `json:"unavailableReason,omitempty"`
	Deprecated                bool     `json:"deprecated,omitempty"`
}

// ModelAdapter defines the contract for model-specific parameter transformation and validation.
type ModelAdapter interface {
	// ModelID returns canonical model ID string.
	ModelID() string
	// Capabilities returns capabilities specification for this model.
	Capabilities() ModelCapabilities
	// Validate verifies request constraints against model capabilities before dispatch.
	Validate(req *MusicGenerationRequest) error
	// TransformRequest converts unified request into upstream Koyosim JSON payload.
	TransformRequest(req *MusicGenerationRequest) (map[string]interface{}, error)
	// TransformResponse parses upstream Koyosim task data into unified response.
	TransformResponse(upstreamResp map[string]interface{}) (*MusicGenerationResponse, error)
}

// ---------------------------------------------------------------------------
// Mureka V9.5 Adapter
// ---------------------------------------------------------------------------

type MurekaAdapter struct {
	caps ModelCapabilities
}

func NewMurekaAdapter() *MurekaAdapter {
	return &MurekaAdapter{
		caps: ModelCapabilities{
			ID:                        ModelMurekaV95,
			Name:                      "Mureka V9.5",
			Version:                   "9.5.2",
			Modes:                     []string{ModeSimple, ModeCustom},
			MinDuration:               30,
			MaxDuration:               300,
			Formats:                   []string{FormatMP3, FormatWAV, FormatFLAC},
			MaxPromptChars:            2000,
			MaxLyricsChars:            5000,
			CostPerSecondMicrocredits: 50,
			VocalGenders:              []string{"male", "female", "auto"},
			StemSeparation:            false,
			Available:                 true,
		},
	}
}

func (a *MurekaAdapter) ModelID() string { return ModelMurekaV95 }
func (a *MurekaAdapter) Capabilities() ModelCapabilities { return a.caps }

func (a *MurekaAdapter) Validate(req *MusicGenerationRequest) error {
	if strings.TrimSpace(req.Prompt) == "" {
		return errors.New("empty_prompt: Generation prompt cannot be empty")
	}
	if utf8.RuneCountInString(req.Prompt) > a.caps.MaxPromptChars {
		return fmt.Errorf("prompt_too_long: Prompt exceeds maximum %d characters", a.caps.MaxPromptChars)
	}
	if utf8.RuneCountInString(req.Lyrics) > a.caps.MaxLyricsChars {
		return fmt.Errorf("lyrics_too_long: Lyrics exceed maximum %d characters", a.caps.MaxLyricsChars)
	}
	if req.Mode == ModeCustom && !req.Instrumental && strings.TrimSpace(req.Lyrics) == "" {
		return errors.New("lyrics_required: Custom mode vocal generation requires lyrics")
	}
	duration := req.DurationSeconds
	if duration == 0 {
		duration = 180
	}
	if duration < a.caps.MinDuration || duration > a.caps.MaxDuration {
		return fmt.Errorf("invalid_duration: Duration %ds must be between %ds and %ds", duration, a.caps.MinDuration, a.caps.MaxDuration)
	}
	if req.Format != "" && !containsString(a.caps.Formats, req.Format) {
		return fmt.Errorf("unsupported_format: Audio format '%s' is not supported by Mureka V9.5", req.Format)
	}
	if len(req.Stems) > 0 {
		return errors.New("stems_not_supported: Stem separation is not supported on Mureka V9.5")
	}
	if req.VocalGender != "" && !containsString(a.caps.VocalGenders, req.VocalGender) {
		return fmt.Errorf("invalid_vocal_gender: Vocal gender '%s' not supported (choose male, female, auto)", req.VocalGender)
	}
	return nil
}

func (a *MurekaAdapter) TransformRequest(req *MusicGenerationRequest) (map[string]interface{}, error) {
	duration := req.DurationSeconds
	if duration == 0 {
		duration = 180
	}
	format := req.Format
	if format == "" {
		format = FormatMP3
	}
	vocalGender := req.VocalGender
	if vocalGender == "" {
		vocalGender = "auto"
	}

	payload := map[string]interface{}{
		"model":            a.ModelID(),
		"mode":             req.Mode,
		"prompt":           req.Prompt,
		"instrumental":     req.Instrumental,
		"duration":         duration,
		"format":           format,
		"vocalGender":      vocalGender,
		"idempotencyNonce": req.IdempotencyNonce,
	}
	if req.Title != "" {
		payload["title"] = req.Title
	}
	if req.Lyrics != "" {
		payload["lyrics"] = req.Lyrics
	}
	return payload, nil
}

func (a *MurekaAdapter) TransformResponse(upstream map[string]interface{}) (*MusicGenerationResponse, error) {
	return parseStandardUpstreamResponse(upstream, a.ModelID())
}

// ---------------------------------------------------------------------------
// Suno v6 Adapter
// ---------------------------------------------------------------------------

type SunoAdapter struct {
	caps ModelCapabilities
}

func NewSunoAdapter() *SunoAdapter {
	return &SunoAdapter{
		caps: ModelCapabilities{
			ID:                        ModelSunoV6,
			Name:                      "Suno v6",
			Version:                   "6.0.1",
			Modes:                     []string{ModeSimple, ModeCustom},
			MinDuration:               15,
			MaxDuration:               240,
			Formats:                   []string{FormatMP3, FormatWAV}, // Strictly NO FLAC!
			MaxPromptChars:            1500,
			MaxLyricsChars:            3000,
			CostPerSecondMicrocredits: 60,
			ContinuationSupported:     true,
			StemSeparation:            false,
			Available:                 true,
		},
	}
}

func (a *SunoAdapter) ModelID() string { return ModelSunoV6 }
func (a *SunoAdapter) Capabilities() ModelCapabilities { return a.caps }

func (a *SunoAdapter) Validate(req *MusicGenerationRequest) error {
	if strings.TrimSpace(req.Prompt) == "" {
		return errors.New("empty_prompt: Generation prompt cannot be empty")
	}
	if utf8.RuneCountInString(req.Prompt) > a.caps.MaxPromptChars {
		return fmt.Errorf("prompt_too_long: Prompt exceeds maximum %d characters", a.caps.MaxPromptChars)
	}
	if utf8.RuneCountInString(req.Lyrics) > a.caps.MaxLyricsChars {
		return fmt.Errorf("lyrics_too_long: Lyrics exceed maximum %d characters", a.caps.MaxLyricsChars)
	}
	if req.Mode == ModeCustom && !req.Instrumental && strings.TrimSpace(req.Lyrics) == "" {
		return errors.New("lyrics_required: Custom mode vocal generation requires lyrics")
	}
	duration := req.DurationSeconds
	if duration == 0 {
		duration = 180
	}
	if duration < a.caps.MinDuration || duration > a.caps.MaxDuration {
		return fmt.Errorf("invalid_duration: Duration %ds must be between %ds and %ds", duration, a.caps.MinDuration, a.caps.MaxDuration)
	}
	// Strict format validation: reject FLAC on Suno
	if req.Format != "" && !containsString(a.caps.Formats, req.Format) {
		return fmt.Errorf("unsupported_format: Audio format '%s' is not supported by Suno v6 (supports mp3, wav)", req.Format)
	}
	if len(req.Stems) > 0 {
		return errors.New("stems_not_supported: Stem separation is not supported on Suno v6")
	}
	return nil
}

func (a *SunoAdapter) TransformRequest(req *MusicGenerationRequest) (map[string]interface{}, error) {
	duration := req.DurationSeconds
	if duration == 0 {
		duration = 180
	}
	format := req.Format
	if format == "" {
		format = FormatMP3
	}

	payload := map[string]interface{}{
		"model":            a.ModelID(),
		"mode":             req.Mode,
		"prompt":           req.Prompt,
		"instrumental":     req.Instrumental,
		"duration":         duration,
		"format":           format,
		"idempotencyNonce": req.IdempotencyNonce,
	}
	if req.Title != "" {
		payload["title"] = req.Title
	}
	if req.Lyrics != "" {
		payload["lyrics"] = req.Lyrics
	}
	if req.ContinuationClipID != "" {
		payload["continuationClipId"] = req.ContinuationClipID
	}
	return payload, nil
}

func (a *SunoAdapter) TransformResponse(upstream map[string]interface{}) (*MusicGenerationResponse, error) {
	return parseStandardUpstreamResponse(upstream, a.ModelID())
}

// ---------------------------------------------------------------------------
// Google Lyria 3.5 Adapter
// ---------------------------------------------------------------------------

type LyriaAdapter struct {
	caps ModelCapabilities
}

func NewLyriaAdapter() *LyriaAdapter {
	return &LyriaAdapter{
		caps: ModelCapabilities{
			ID:                        ModelLyria35,
			Name:                      "Google Lyria 3.5",
			Version:                   "3.5.0",
			Modes:                     []string{ModeSimple, ModeCustom},
			MinDuration:               10,
			MaxDuration:               180,
			Formats:                   []string{FormatMP3, FormatWAV, FormatFLAC},
			MaxPromptChars:            1000,
			MaxLyricsChars:            2000,
			CostPerSecondMicrocredits: 80,
			TempoBpmRange:             [2]int{40, 240},
			KeySignatures: []string{
				"C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B",
				"F# Minor", "A Minor", "D Minor",
			},
			SynthIDWatermarking: true,
			StemSeparation:      false,
			Available:           true,
		},
	}
}

func (a *LyriaAdapter) ModelID() string { return ModelLyria35 }
func (a *LyriaAdapter) Capabilities() ModelCapabilities { return a.caps }

func (a *LyriaAdapter) Validate(req *MusicGenerationRequest) error {
	if strings.TrimSpace(req.Prompt) == "" {
		return errors.New("empty_prompt: Generation prompt cannot be empty")
	}
	if utf8.RuneCountInString(req.Prompt) > a.caps.MaxPromptChars {
		return fmt.Errorf("prompt_too_long: Prompt exceeds maximum %d characters", a.caps.MaxPromptChars)
	}
	if utf8.RuneCountInString(req.Lyrics) > a.caps.MaxLyricsChars {
		return fmt.Errorf("lyrics_too_long: Lyrics exceed maximum %d characters", a.caps.MaxLyricsChars)
	}
	duration := req.DurationSeconds
	if duration == 0 {
		duration = 120
	}
	if duration < a.caps.MinDuration || duration > a.caps.MaxDuration {
		return fmt.Errorf("invalid_duration: Duration %ds must be between %ds and %ds", duration, a.caps.MinDuration, a.caps.MaxDuration)
	}
	if req.Format != "" && !containsString(a.caps.Formats, req.Format) {
		return fmt.Errorf("unsupported_format: Audio format '%s' is not supported by Google Lyria 3.5", req.Format)
	}
	if len(req.Stems) > 0 {
		return errors.New("stems_not_supported: Stem separation is not supported on Google Lyria 3.5")
	}
	if req.TempoBpm != 0 {
		if req.TempoBpm < a.caps.TempoBpmRange[0] || req.TempoBpm > a.caps.TempoBpmRange[1] {
			return fmt.Errorf("invalid_tempo: Tempo BPM %d must be between %d and %d", req.TempoBpm, a.caps.TempoBpmRange[0], a.caps.TempoBpmRange[1])
		}
	}
	if req.KeySignature != "" && !containsString(a.caps.KeySignatures, req.KeySignature) {
		return fmt.Errorf("invalid_key_signature: Key signature '%s' not recognized", req.KeySignature)
	}
	return nil
}

func (a *LyriaAdapter) TransformRequest(req *MusicGenerationRequest) (map[string]interface{}, error) {
	duration := req.DurationSeconds
	if duration == 0 {
		duration = 120
	}
	format := req.Format
	if format == "" {
		format = FormatFLAC
	}
	watermark := true
	if req.SynthIDWatermark != nil {
		watermark = *req.SynthIDWatermark
	}

	payload := map[string]interface{}{
		"model":            a.ModelID(),
		"mode":             req.Mode,
		"prompt":           req.Prompt,
		"instrumental":     req.Instrumental,
		"duration":         duration,
		"format":           format,
		"synthIdWatermark": watermark,
		"idempotencyNonce": req.IdempotencyNonce,
	}
	if req.Title != "" {
		payload["title"] = req.Title
	}
	if req.Lyrics != "" {
		payload["lyrics"] = req.Lyrics
	}
	if req.TempoBpm != 0 {
		payload["tempoBpm"] = req.TempoBpm
	}
	if req.KeySignature != "" {
		payload["keySignature"] = req.KeySignature
	}
	return payload, nil
}

func (a *LyriaAdapter) TransformResponse(upstream map[string]interface{}) (*MusicGenerationResponse, error) {
	resp, err := parseStandardUpstreamResponse(upstream, a.ModelID())
	if err != nil {
		return nil, err
	}
	if wm, ok := upstream["synth_id_watermarked"].(bool); ok {
		resp.SynthIDWatermark = wm
	}
	return resp, nil
}

// ---------------------------------------------------------------------------
// Eleven Music v2.5 Adapter
// ---------------------------------------------------------------------------

type ElevenMusicAdapter struct {
	caps ModelCapabilities
}

func NewElevenMusicAdapter() *ElevenMusicAdapter {
	return &ElevenMusicAdapter{
		caps: ModelCapabilities{
			ID:                        ModelElevenMusic,
			Name:                      "Eleven Music v2.5",
			Version:                   "2.5.4",
			Modes:                     []string{ModeCustom}, // Custom mode ONLY!
			MinDuration:               30,
			MaxDuration:               240,
			Formats:                   []string{FormatMP3, FormatWAV, FormatFLAC},
			MaxPromptChars:            1000,
			MaxLyricsChars:            4000,
			CostPerSecondMicrocredits: 100,
			HighFidelityVocal:         true,
			StemSeparation:            true,
			SupportedStems:            []string{"vocals", "drums", "bass", "other"},
			Available:                 true,
		},
	}
}

func (a *ElevenMusicAdapter) ModelID() string { return ModelElevenMusic }
func (a *ElevenMusicAdapter) Capabilities() ModelCapabilities { return a.caps }

func (a *ElevenMusicAdapter) Validate(req *MusicGenerationRequest) error {
	// Strict mode validation: Eleven Music ONLY supports custom mode
	if req.Mode != ModeCustom {
		return errors.New("unsupported_mode: Eleven Music v2.5 exclusively supports 'custom' mode")
	}
	if strings.TrimSpace(req.Prompt) == "" {
		return errors.New("empty_prompt: Generation prompt cannot be empty")
	}
	if utf8.RuneCountInString(req.Prompt) > a.caps.MaxPromptChars {
		return fmt.Errorf("prompt_too_long: Prompt exceeds maximum %d characters", a.caps.MaxPromptChars)
	}
	if utf8.RuneCountInString(req.Lyrics) > a.caps.MaxLyricsChars {
		return fmt.Errorf("lyrics_too_long: Lyrics exceed maximum %d characters", a.caps.MaxLyricsChars)
	}
	if !req.Instrumental && strings.TrimSpace(req.Lyrics) == "" {
		return errors.New("lyrics_required: Custom mode vocal generation requires lyrics")
	}
	duration := req.DurationSeconds
	if duration == 0 {
		duration = 180
	}
	if duration < a.caps.MinDuration || duration > a.caps.MaxDuration {
		return fmt.Errorf("invalid_duration: Duration %ds must be between %ds and %ds", duration, a.caps.MinDuration, a.caps.MaxDuration)
	}
	if req.Format != "" && !containsString(a.caps.Formats, req.Format) {
		return fmt.Errorf("unsupported_format: Audio format '%s' is not supported by Eleven Music v2.5", req.Format)
	}
	// Validate stems against supported stems
	for _, stem := range req.Stems {
		if !containsString(a.caps.SupportedStems, stem) {
			return fmt.Errorf("invalid_stem: Stem '%s' is not supported (choose from vocals, drums, bass, other)", stem)
		}
	}
	return nil
}

func (a *ElevenMusicAdapter) TransformRequest(req *MusicGenerationRequest) (map[string]interface{}, error) {
	duration := req.DurationSeconds
	if duration == 0 {
		duration = 180
	}
	format := req.Format
	if format == "" {
		format = FormatFLAC
	}

	payload := map[string]interface{}{
		"model":            a.ModelID(),
		"mode":             ModeCustom,
		"prompt":           req.Prompt,
		"instrumental":     req.Instrumental,
		"duration":         duration,
		"format":           format,
		"idempotencyNonce": req.IdempotencyNonce,
	}
	if req.Title != "" {
		payload["title"] = req.Title
	}
	if req.Lyrics != "" {
		payload["lyrics"] = req.Lyrics
	}
	if len(req.Stems) > 0 {
		payload["stems"] = req.Stems
	}
	return payload, nil
}

func (a *ElevenMusicAdapter) TransformResponse(upstream map[string]interface{}) (*MusicGenerationResponse, error) {
	resp, err := parseStandardUpstreamResponse(upstream, a.ModelID())
	if err != nil {
		return nil, err
	}
	if stemsRaw, ok := upstream["stems"].(map[string]interface{}); ok {
		resp.StemURLs = make(map[string]string, len(stemsRaw))
		for k, v := range stemsRaw {
			if urlStr, ok := v.(string); ok {
				resp.StemURLs[k] = urlStr
			}
		}
	}
	return resp, nil
}

// ---------------------------------------------------------------------------
// Adapter Registry
// ---------------------------------------------------------------------------

type AdapterRegistry struct {
	mu       sync.RWMutex
	adapters map[string]ModelAdapter
}

var (
	defaultRegistry     *AdapterRegistry
	defaultRegistryOnce sync.Once
)

func GetAdapterRegistry() *AdapterRegistry {
	defaultRegistryOnce.Do(func() {
		defaultRegistry = &AdapterRegistry{
			adapters: make(map[string]ModelAdapter),
		}
		defaultRegistry.Register(NewMurekaAdapter())
		defaultRegistry.Register(NewSunoAdapter())
		defaultRegistry.Register(NewLyriaAdapter())
		defaultRegistry.Register(NewElevenMusicAdapter())
	})
	return defaultRegistry
}

func (r *AdapterRegistry) Register(adapter ModelAdapter) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.adapters[adapter.ModelID()] = adapter
}

func (r *AdapterRegistry) Get(modelID string) (ModelAdapter, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	adapter, ok := r.adapters[modelID]
	return adapter, ok
}

func (r *AdapterRegistry) List() []ModelCapabilities {
	r.mu.RLock()
	defer r.mu.RUnlock()
	caps := make([]ModelCapabilities, 0, len(r.adapters))
	for _, adapter := range r.adapters {
		caps = append(caps, adapter.Capabilities())
	}
	return caps
}

// Helpers
func containsString(list []string, target string) bool {
	for _, item := range list {
		if strings.EqualFold(item, target) {
			return true
		}
	}
	return false
}

func parseStandardUpstreamResponse(upstream map[string]interface{}, modelID string) (*MusicGenerationResponse, error) {
	taskID, _ := upstream["task_id"].(string)
	stage, _ := upstream["stage"].(string)
	audioURL, _ := upstream["audio_url"].(string)
	errReason, _ := upstream["error_reason"].(string)

	var durationSec int
	switch d := upstream["duration"].(type) {
	case float64:
		durationSec = int(d)
	case int:
		durationSec = d
	case int64:
		durationSec = int(d)
	}

	resp := &MusicGenerationResponse{
		TaskID:          taskID,
		UpstreamTaskID:  taskID,
		Model:           modelID,
		Stage:           stage,
		DurationSeconds: durationSec,
		AudioURL:        audioURL,
		ErrorMessage:    errReason,
	}

	if formatsRaw, ok := upstream["audio_formats"].(map[string]interface{}); ok {
		resp.AudioFormats = make(map[string]string, len(formatsRaw))
		for k, v := range formatsRaw {
			if s, ok := v.(string); ok {
				resp.AudioFormats[k] = s
			}
		}
	}
	return resp, nil
}

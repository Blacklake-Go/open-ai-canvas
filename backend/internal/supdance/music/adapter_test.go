package music_test

import (
	"strings"
	"testing"

	"yingce/backend/internal/supdance/music"
)

func TestModelAdapterRegistry(t *testing.T) {
	registry := music.GetAdapterRegistry()
	if registry == nil {
		t.Fatal("expected non-nil default registry")
	}

	expectedModels := []string{
		music.ModelMurekaV95,
		music.ModelSunoV6,
		music.ModelLyria35,
		music.ModelElevenMusic,
	}

	for _, modelID := range expectedModels {
		adapter, ok := registry.Get(modelID)
		if !ok || adapter == nil {
			t.Errorf("expected adapter for %s to be registered", modelID)
		}
		if adapter.ModelID() != modelID {
			t.Errorf("adapter model ID mismatch: expected %s, got %s", modelID, adapter.ModelID())
		}
	}

	list := registry.List()
	if len(list) < 4 {
		t.Errorf("expected at least 4 registered capabilities, got %d", len(list))
	}
}

func TestMurekaAdapterValidationAndTransform(t *testing.T) {
	registry := music.GetAdapterRegistry()
	adapter, ok := registry.Get(music.ModelMurekaV95)
	if !ok {
		t.Fatal("mureka adapter not found")
	}

	// 1. Empty prompt validation
	req := &music.MusicGenerationRequest{
		Model: music.ModelMurekaV95,
		Mode:  music.ModeSimple,
	}
	if err := adapter.Validate(req); err == nil || !strings.Contains(err.Error(), "empty_prompt") {
		t.Errorf("expected empty_prompt error, got: %v", err)
	}

	// 2. Duration boundaries (30..300)
	req.Prompt = "valid pop track"
	req.DurationSeconds = 10 // too short
	if err := adapter.Validate(req); err == nil || !strings.Contains(err.Error(), "invalid_duration") {
		t.Errorf("expected invalid_duration error for 10s, got: %v", err)
	}

	req.DurationSeconds = 350 // too long
	if err := adapter.Validate(req); err == nil || !strings.Contains(err.Error(), "invalid_duration") {
		t.Errorf("expected invalid_duration error for 350s, got: %v", err)
	}

	// 3. Stems rejection on Mureka
	req.DurationSeconds = 180
	req.Stems = []string{"vocals"}
	if err := adapter.Validate(req); err == nil || !strings.Contains(err.Error(), "stems_not_supported") {
		t.Errorf("expected stems_not_supported error, got: %v", err)
	}
	req.Stems = nil

	// 4. Custom mode requires lyrics if !instrumental
	req.Mode = music.ModeCustom
	req.Instrumental = false
	req.Lyrics = ""
	if err := adapter.Validate(req); err == nil || !strings.Contains(err.Error(), "lyrics_required") {
		t.Errorf("expected lyrics_required error, got: %v", err)
	}

	// 5. Valid request & Transform
	req.Lyrics = "[Verse 1] Singing in the rain"
	req.Format = music.FormatFLAC
	req.VocalGender = "female"
	req.IdempotencyNonce = "nonce-123"
	if err := adapter.Validate(req); err != nil {
		t.Fatalf("expected valid req to pass, got: %v", err)
	}

	payload, err := adapter.TransformRequest(req)
	if err != nil {
		t.Fatalf("transform request failed: %v", err)
	}
	if payload["model"] != music.ModelMurekaV95 || payload["vocalGender"] != "female" || payload["format"] != "flac" {
		t.Errorf("unexpected payload: %+v", payload)
	}
}

func TestSunoAdapterRejectsFLAC(t *testing.T) {
	registry := music.GetAdapterRegistry()
	adapter, ok := registry.Get(music.ModelSunoV6)
	if !ok {
		t.Fatal("suno adapter not found")
	}

	req := &music.MusicGenerationRequest{
		Model:           music.ModelSunoV6,
		Mode:            music.ModeSimple,
		Prompt:          "Pop rock synth",
		DurationSeconds: 120,
		Format:          music.FormatFLAC, // Must be rejected!
	}

	err := adapter.Validate(req)
	if err == nil {
		t.Fatal("expected error rejecting FLAC on suno-v6, got nil")
	}
	if !strings.Contains(err.Error(), "unsupported_format") {
		t.Errorf("expected unsupported_format error, got: %v", err)
	}

	// Should accept MP3 and WAV
	req.Format = music.FormatMP3
	if err := adapter.Validate(req); err != nil {
		t.Errorf("expected MP3 to be valid on suno, got: %v", err)
	}
	req.Format = music.FormatWAV
	if err := adapter.Validate(req); err != nil {
		t.Errorf("expected WAV to be valid on suno, got: %v", err)
	}
}

func TestLyriaAdapterBPMAndKeySignatures(t *testing.T) {
	registry := music.GetAdapterRegistry()
	adapter, ok := registry.Get(music.ModelLyria35)
	if !ok {
		t.Fatal("lyria adapter not found")
	}

	req := &music.MusicGenerationRequest{
		Model:           music.ModelLyria35,
		Mode:            music.ModeSimple,
		Prompt:          "EDM drop",
		DurationSeconds: 60,
		TempoBpm:        30, // Out of range [40, 240]
	}

	if err := adapter.Validate(req); err == nil || !strings.Contains(err.Error(), "invalid_tempo") {
		t.Errorf("expected invalid_tempo error for 30 BPM, got: %v", err)
	}

	req.TempoBpm = 128 // Valid
	req.KeySignature = "X Major" // Invalid key
	if err := adapter.Validate(req); err == nil || !strings.Contains(err.Error(), "invalid_key_signature") {
		t.Errorf("expected invalid_key_signature error, got: %v", err)
	}

	req.KeySignature = "F# Minor" // Valid harmonic key
	if err := adapter.Validate(req); err != nil {
		t.Fatalf("expected valid Lyria request, got: %v", err)
	}

	payload, err := adapter.TransformRequest(req)
	if err != nil {
		t.Fatalf("transform failed: %v", err)
	}
	if payload["tempoBpm"] != 128 || payload["keySignature"] != "F# Minor" {
		t.Errorf("unexpected payload: %+v", payload)
	}
}

func TestElevenMusicAdapterCustomModeExclusivityAndStems(t *testing.T) {
	registry := music.GetAdapterRegistry()
	adapter, ok := registry.Get(music.ModelElevenMusic)
	if !ok {
		t.Fatal("eleven music adapter not found")
	}

	// 1. Simple mode must be strictly rejected
	req := &music.MusicGenerationRequest{
		Model:  music.ModelElevenMusic,
		Mode:   music.ModeSimple,
		Prompt: "Vocal ballad",
	}

	if err := adapter.Validate(req); err == nil || !strings.Contains(err.Error(), "unsupported_mode") {
		t.Errorf("expected unsupported_mode error for simple mode on eleven music, got: %v", err)
	}

	// 2. Custom mode with valid stems
	req.Mode = music.ModeCustom
	req.Lyrics = "I hear the sound"
	req.DurationSeconds = 180
	req.Stems = []string{"vocals", "drums", "bass", "other"}
	if err := adapter.Validate(req); err != nil {
		t.Fatalf("expected valid custom mode with stems, got: %v", err)
	}

	// 3. Invalid stem rejection
	req.Stems = []string{"guitar"}
	if err := adapter.Validate(req); err == nil || !strings.Contains(err.Error(), "invalid_stem") {
		t.Errorf("expected invalid_stem error, got: %v", err)
	}
}

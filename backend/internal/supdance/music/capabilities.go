package music

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"
)

// StaticKoyosimModelCatalog is the compile-time authoritative fallback catalog.
var StaticKoyosimModelCatalog = map[string]ModelCapabilities{
	ModelMurekaV95: {
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
	ModelSunoV6: {
		ID:                        ModelSunoV6,
		Name:                      "Suno v6",
		Version:                   "6.0.1",
		Modes:                     []string{ModeSimple, ModeCustom},
		MinDuration:               15,
		MaxDuration:               240,
		Formats:                   []string{FormatMP3, FormatWAV},
		MaxPromptChars:            1500,
		MaxLyricsChars:            3000,
		CostPerSecondMicrocredits: 60,
		ContinuationSupported:     true,
		StemSeparation:            false,
		Available:                 true,
	},
	ModelLyria35: {
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
	ModelElevenMusic: {
		ID:                        ModelElevenMusic,
		Name:                      "Eleven Music v2.5",
		Version:                   "2.5.4",
		Modes:                     []string{ModeCustom},
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

// CapabilityManager manages dynamic query, in-memory caching, and fallback resolution.
type CapabilityManager struct {
	mu           sync.RWMutex
	cachedCaps   map[string]ModelCapabilities
	lastFetched  time.Time
	cacheTTL     time.Duration
	fixedBaseURL string
}

func NewCapabilityManager(cacheTTL time.Duration) *CapabilityManager {
	if cacheTTL <= 0 {
		cacheTTL = 15 * time.Minute
	}
	m := &CapabilityManager{
		cachedCaps:   make(map[string]ModelCapabilities),
		cacheTTL:     cacheTTL,
		fixedBaseURL: KoyosimAPIBaseURL, // Immutable compile-time constant
	}
	m.loadStaticFallback()
	return m
}

func (m *CapabilityManager) loadStaticFallback() {
	for k, v := range StaticKoyosimModelCatalog {
		m.cachedCaps[k] = v
	}
}

// GetCapabilities returns the capability matrix for all 4 models, refreshing if cache expired.
func (m *CapabilityManager) GetCapabilities(ctx context.Context, apiKey string, httpClient *http.Client) []ModelCapabilities {
	m.mu.RLock()
	isFresh := time.Since(m.lastFetched) < m.cacheTTL && !m.lastFetched.IsZero()
	m.mu.RUnlock()

	if !isFresh && apiKey != "" && httpClient != nil {
		if err := m.RefreshRemoteCapabilities(ctx, apiKey, httpClient); err != nil {
			slog.Warn("Failed to refresh remote Koyosim capabilities; using cached fallback", "error", err)
		}
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]ModelCapabilities, 0, len(m.cachedCaps))
	for _, cap := range m.cachedCaps {
		result = append(result, cap)
	}
	return result
}

// GetModel retrieves capabilities for a specific model ID.
func (m *CapabilityManager) GetModel(modelID string) (ModelCapabilities, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	cap, ok := m.cachedCaps[modelID]
	return cap, ok
}

// RefreshRemoteCapabilities queries GET /v1/models from Koyosim and updates the in-memory cache.
func (m *CapabilityManager) RefreshRemoteCapabilities(ctx context.Context, apiKey string, httpClient *http.Client) error {
	reqURL := fmt.Sprintf("%s/v1/models", m.fixedBaseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return fmt.Errorf("create request failed: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("http request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected upstream status: %d", resp.StatusCode)
	}

	var envelope struct {
		Code int                 `json:"code"`
		Data []ModelCapabilities `json:"data"`
		Msg  string              `json:"msg"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		return fmt.Errorf("decode response failed: %w", err)
	}
	if envelope.Code != 0 {
		return fmt.Errorf("upstream error code: %d, msg: %s", envelope.Code, envelope.Msg)
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	// Track which static models were present upstream
	receivedModels := make(map[string]bool)
	for _, remoteCap := range envelope.Data {
		receivedModels[remoteCap.ID] = true
		remoteCap.Available = true
		m.cachedCaps[remoteCap.ID] = remoteCap
	}

	// Graceful Degradation: Mark any expected target models missing from upstream as unavailable
	for modelID, fallbackCap := range StaticKoyosimModelCatalog {
		if !receivedModels[modelID] {
			fallbackCap.Available = false
			fallbackCap.UnavailableReason = "Model currently unavailable on upstream Koyosim account tier"
			m.cachedCaps[modelID] = fallbackCap
		}
	}

	m.lastFetched = time.Now()
	return nil
}

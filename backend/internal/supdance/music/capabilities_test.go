package music_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"yingce/backend/internal/supdance/music"
)

func TestCapabilityManagerStaticFallback(t *testing.T) {
	mgr := music.NewCapabilityManager(15 * time.Minute)
	caps := mgr.GetCapabilities(context.Background(), "", nil)

	if len(caps) != 4 {
		t.Fatalf("expected 4 static fallback models, got %d", len(caps))
	}

	for _, cap := range caps {
		if !cap.Available {
			t.Errorf("expected static model %s to be available by default", cap.ID)
		}
	}

	suno, ok := mgr.GetModel(music.ModelSunoV6)
	if !ok || suno.Name != "Suno v6" {
		t.Errorf("expected suno-v6 in static catalog, got: %+v", suno)
	}
}

func TestCapabilityManagerRemoteRefreshAndDegradation(t *testing.T) {
	// Mock server that returns only 3 models (omitting eleven music)
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/models" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		if r.Header.Get("Authorization") != "Bearer test-key" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		responseJSON := `{
			"code": 0,
			"data": [
				{"id": "mureka-9.5", "name": "Mureka V9.5", "version": "9.5.3", "modes": ["simple", "custom"], "minDuration": 30, "maxDuration": 300, "formats": ["mp3", "wav", "flac"], "maxPromptChars": 2000, "maxLyricsChars": 5000, "costPerSecondMicrocredits": 50},
				{"id": "suno-v6", "name": "Suno v6", "version": "6.0.2", "modes": ["simple", "custom"], "minDuration": 15, "maxDuration": 240, "formats": ["mp3", "wav"], "maxPromptChars": 1500, "maxLyricsChars": 3000, "costPerSecondMicrocredits": 60, "continuationSupported": true},
				{"id": "lyria-3.5", "name": "Google Lyria 3.5", "version": "3.5.1", "modes": ["simple", "custom"], "minDuration": 10, "maxDuration": 180, "formats": ["mp3", "wav", "flac"], "maxPromptChars": 1000, "maxLyricsChars": 2000, "costPerSecondMicrocredits": 80, "synthIdWatermarking": true}
			],
			"msg": "ok"
		}`
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(responseJSON))
	}))
	defer mockServer.Close()

	// Use transport redirecting fixed base URL to mockServer
	rt := roundTripFunc(func(req *http.Request) (*http.Response, error) {
		mockReq, _ := http.NewRequestWithContext(req.Context(), req.Method, mockServer.URL+req.URL.Path, req.Body)
		mockReq.Header = req.Header
		return http.DefaultTransport.RoundTrip(mockReq)
	})

	httpClient := &http.Client{Transport: rt}
	mgr := music.NewCapabilityManager(15 * time.Minute)

	err := mgr.RefreshRemoteCapabilities(context.Background(), "test-key", httpClient)
	if err != nil {
		t.Fatalf("refresh remote capabilities failed: %v", err)
	}

	// Eleven Music should be marked Available: false
	eleven, ok := mgr.GetModel(music.ModelElevenMusic)
	if !ok {
		t.Fatal("expected eleven music to still be tracked in capability catalog")
	}
	if eleven.Available {
		t.Error("expected missing eleven music model to be flagged Available: false")
	}
	if eleven.UnavailableReason == "" {
		t.Error("expected explanatory UnavailableReason for omitted model")
	}

	// Mureka should be updated with new version
	mureka, ok := mgr.GetModel(music.ModelMurekaV95)
	if !ok || mureka.Version != "9.5.3" {
		t.Errorf("expected updated version for mureka, got %+v", mureka)
	}
}

func TestCapabilityManagerNetworkFailurePreservesStaticCatalog(t *testing.T) {
	// Transport returning error
	errRT := roundTripFunc(func(req *http.Request) (*http.Response, error) {
		return nil, http.ErrHandlerTimeout
	})
	httpClient := &http.Client{Transport: errRT}

	mgr := music.NewCapabilityManager(15 * time.Minute)
	// Refresh fails, but GetCapabilities returns static fallback without panicking
	caps := mgr.GetCapabilities(context.Background(), "test-key", httpClient)
	if len(caps) != 4 {
		t.Fatalf("expected 4 capabilities on network failure fallback, got %d", len(caps))
	}
}

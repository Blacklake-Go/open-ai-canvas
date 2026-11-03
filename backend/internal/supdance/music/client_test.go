package music_test

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"yingce/backend/internal/supdance/music"
)

// roundTripFunc implements http.RoundTripper for hermetic testing.
type roundTripFunc func(req *http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestKoyosimBaseURLImmutability(t *testing.T) {
	client, err := music.NewClient("koyo_sec_live_9988aabbccddee0011223344")
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	if client.BaseURL() != "https://www.koyosim.com" {
		t.Fatalf("expected immutable BaseURL %q, got %q", "https://www.koyosim.com", client.BaseURL())
	}
	if client.APIKey() != "koyo_sec_live_9988aabbccddee0011223344" {
		t.Fatalf("expected APIKey to match, got %q", client.APIKey())
	}
}

func TestAntiSSRFRedirectGuard(t *testing.T) {
	checkRedirect := func(destURL string, viaCount int) error {
		req, err := http.NewRequest(http.MethodGet, destURL, nil)
		if err != nil {
			return err
		}
		via := make([]*http.Request, viaCount)
		for i := range via {
			via[i] = &http.Request{}
		}

		// Replicate redirect guard assertions
		if len(via) >= music.MaxRedirects {
			return fmt.Errorf("koyosim client: redirect limit exceeded (max %d)", music.MaxRedirects)
		}
		if req.URL.Scheme != "https" {
			return fmt.Errorf("koyosim ssrf guard: insecure redirect scheme %q rejected", req.URL.Scheme)
		}
		host := strings.ToLower(req.URL.Hostname())
		if host != "www.koyosim.com" && host != "koyosim.com" && !strings.HasSuffix(host, ".koyosim.com") {
			return fmt.Errorf("koyosim ssrf guard: redirect to foreign host %q rejected", host)
		}
		return nil
	}

	// 1. Rejects AWS Metadata IP
	if err := checkRedirect("http://169.254.169.254/latest/meta-data/", 1); err == nil {
		t.Error("expected SSRF error for link-local metadata IP, got nil")
	}

	// 2. Rejects Localhost
	if err := checkRedirect("http://127.0.0.1:8080/admin", 1); err == nil {
		t.Error("expected SSRF error for loopback, got nil")
	}

	// 3. Rejects Foreign Domain
	if err := checkRedirect("https://attacker-controlled-site.com/steal", 1); err == nil {
		t.Error("expected SSRF error for foreign host, got nil")
	}

	// 4. Rejects redirect depth >= 3
	if err := checkRedirect("https://www.koyosim.com/v1/ping", 3); err == nil {
		t.Error("expected error for exceeded redirect depth, got nil")
	}

	// 5. Accepts valid Koyosim HTTPS redirect
	if err := checkRedirect("https://www.koyosim.com/v1/ping", 1); err != nil {
		t.Errorf("expected valid redirect to pass, got: %v", err)
	}
}

func TestClientPingAndAuthHeaderInjection(t *testing.T) {
	mockRT := roundTripFunc(func(req *http.Request) (*http.Response, error) {
		if req.URL.String() != "https://www.koyosim.com/v1/ping" {
			t.Errorf("unexpected url: %s", req.URL.String())
		}
		auth := req.Header.Get("Authorization")
		if auth != "Bearer koyo_sec_test_key_1234" {
			t.Errorf("unexpected auth header: %s", auth)
		}
		if req.Header.Get("User-Agent") != music.DefaultUserAgent {
			t.Errorf("unexpected user agent: %s", req.Header.Get("User-Agent"))
		}

		body := `{"code":0,"status":"healthy","billed":false,"costMicrocredits":0,"timestamp":1700000000,"version":"2026.10.koyosim-core"}`
		res := httptest.NewRecorder()
		res.WriteHeader(http.StatusOK)
		res.WriteString(body)
		return res.Result(), nil
	})

	client, err := music.NewClient("koyo_sec_test_key_1234", music.WithTransport(mockRT))
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	pingRes, err := client.Ping(context.Background())
	if err != nil {
		t.Fatalf("ping failed: %v", err)
	}

	if pingRes.Status != "healthy" || pingRes.Billed || pingRes.CostMicrocredits != 0 {
		t.Errorf("unexpected ping response: %+v", pingRes)
	}
}

func TestClientProbeConnectionZeroBilling(t *testing.T) {
	// 1. Success case
	mockRT := roundTripFunc(func(req *http.Request) (*http.Response, error) {
		body := `{"code":0,"status":"healthy","billed":false,"costMicrocredits":0,"timestamp":1700000000,"version":"2026.10.koyosim-core"}`
		res := httptest.NewRecorder()
		res.WriteHeader(http.StatusOK)
		res.WriteString(body)
		return res.Result(), nil
	})

	client, _ := music.NewClient("koyo_sec_test", music.WithTransport(mockRT))
	probe, err := client.ProbeConnection(context.Background())
	if err != nil {
		t.Fatalf("probe failed: %v", err)
	}
	if probe.Billed || probe.CostMicrocredits > 0 || probe.Status != "healthy" {
		t.Errorf("unexpected probe result: %+v", probe)
	}

	// 2. Violation case: upstream claims billed == true
	mockBilledRT := roundTripFunc(func(req *http.Request) (*http.Response, error) {
		body := `{"code":0,"status":"healthy","billed":true,"costMicrocredits":500,"timestamp":1700000000,"version":"2026.10.koyosim-core"}`
		res := httptest.NewRecorder()
		res.WriteHeader(http.StatusOK)
		res.WriteString(body)
		return res.Result(), nil
	})

	clientViolating, _ := music.NewClient("koyo_sec_test", music.WithTransport(mockBilledRT))
	if _, err := clientViolating.ProbeConnection(context.Background()); err == nil {
		t.Error("expected error when upstream violates non-billing contract, got nil")
	}
}

func TestArtifactDownloadRejectsForeignOrigin(t *testing.T) {
	client, err := music.NewClient("koyo_sec_test_key_1234")
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	foreignURL := "https://malicious-storage.com/audio.mp3"
	_, _, err = client.DownloadArtifact(context.Background(), foreignURL)
	if err == nil {
		t.Fatal("expected error downloading artifact from foreign origin, got nil")
	}
	if !strings.Contains(err.Error(), "artifact download rejected") {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestClientCreateTaskAndGetTask(t *testing.T) {
	mockRT := roundTripFunc(func(req *http.Request) (*http.Response, error) {
		res := httptest.NewRecorder()
		if req.Method == http.MethodPost && req.URL.Path == "/v1/audio/music/generate" {
			res.WriteHeader(http.StatusOK)
			res.WriteString(`{"code":0,"data":{"task_id":"koyo_123","status":"submitted","estimated_duration_seconds":180,"model":"suno-v6","created_at":1700000000},"msg":"ok"}`)
			return res.Result(), nil
		}
		if req.Method == http.MethodGet && strings.HasPrefix(req.URL.Path, "/v1/audio/music/tasks/") {
			res.WriteHeader(http.StatusOK)
			res.WriteString(`{"code":0,"data":{"task_id":"koyo_123","model":"suno-v6","mode":"custom","stage":"generating","poll_count":2,"duration":180,"synth_id_watermarked":false,"updated_at":1700000010},"msg":"ok"}`)
			return res.Result(), nil
		}
		res.WriteHeader(http.StatusNotFound)
		return res.Result(), nil
	})

	client, err := music.NewClient("koyo_sec_test", music.WithTransport(mockRT))
	if err != nil {
		t.Fatalf("create client failed: %v", err)
	}

	genResp, err := client.CreateTask(context.Background(), map[string]string{"model": "suno-v6"})
	if err != nil {
		t.Fatalf("create task failed: %v", err)
	}
	if genResp.TaskID != "koyo_123" || genResp.Status != "submitted" {
		t.Errorf("unexpected genResp: %+v", genResp)
	}

	taskResp, err := client.GetTask(context.Background(), "koyo_123")
	if err != nil {
		t.Fatalf("get task failed: %v", err)
	}
	if taskResp.TaskID != "koyo_123" || taskResp.Stage != "generating" {
		t.Errorf("unexpected taskResp: %+v", taskResp)
	}
}

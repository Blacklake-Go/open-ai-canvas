package ai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"one/backend/internal/config"
)

func TestBuildMuapiRequestPayload(t *testing.T) {
	p, err := BuildMuapiRequestPayload("nano-banana-pro", "a cat", map[string]any{
		"aspectRatio": "16:9",
		"resolution":  "2K",
	})
	if err != nil {
		t.Fatalf("expected valid payload, got %v", err)
	}
	if p["aspect_ratio"] != "16:9" || p["resolution"] != "2k" {
		t.Fatalf("unexpected canonical payload: %+v", p)
	}

	if _, err := BuildMuapiRequestPayload("hunyuan-fast-text-to-video", "run", map[string]any{"duration": 5}); err == nil {
		t.Fatalf("expected unsupported field error for hunyuan duration")
	}
	if _, err := BuildMuapiRequestPayload("gpt-image-2", "cat", map[string]any{"count": 2}); err == nil {
		t.Fatalf("expected count=2 rejection")
	}
}

func TestResolveEndpointSSRFAndOrigin(t *testing.T) {
	b := NewBaseClient("muapi", "https://api.muapi.ai", "key", nil, nil)
	if _, err := b.ResolveEndpoint("https://evil.example.com/steal", ""); err == nil {
		t.Fatalf("expected cross-origin rejection")
	}
	got, err := b.ResolveEndpoint("/api/v1/flux-schnell", "")
	if err != nil || got != "https://api.muapi.ai/api/v1/flux-schnell" {
		t.Fatalf("unexpected resolved URL %q err=%v", got, err)
	}

	// Localhost blocked unless explicitly allowlisted.
	bLocal := NewBaseClient("muapi", "http://127.0.0.1:9999", "key", nil, nil)
	if _, err := bLocal.ResolveEndpoint("/api/v1/test", ""); err == nil {
		t.Fatalf("expected loopback SSRF block when allowlist empty")
	}
}

func TestMuAPIAdapterWireLifecycle(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("x-api-key") != "secret-key" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-MuAPI-Cost-USD", "0.035")
		switch r.URL.Path {
		case "/api/v1/flux-schnell":
			_ = json.NewEncoder(w).Encode(map[string]any{"request_id": "req_123"})
		case "/api/v1/predictions/req_123/result":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"status":  "completed",
				"outputs": []string{"https://cdn.example.com/out.png"},
			})
		case "/api/v1/models":
			_ = json.NewEncoder(w).Encode(map[string]any{"models": []string{"flux-schnell"}})
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	adapter := NewMuAPIAdapter(srv.URL, "secret-key", nil, []string{"127.0.0.1"})
	res, err := adapter.CreateTask(context.Background(), TaskRequest{
		ProviderModelID: "flux-schnell",
		Prompt:          "sunset",
		IdempotencyKey:  "idem-1",
	})
	if err != nil {
		t.Fatalf("CreateTask error: %v", err)
	}
	if res.ProviderRequestID != "req_123" || res.Status != "processing" || res.ActualCostUSD == nil || *res.ActualCostUSD != 0.035 {
		t.Fatalf("unexpected CreateTask result: %+v", res)
	}

	poll, err := adapter.GetTask(context.Background(), "req_123", TaskRequest{})
	if err != nil {
		t.Fatalf("GetTask error: %v", err)
	}
	if poll.Status != "succeeded" || poll.ResultURL != "https://cdn.example.com/out.png" || poll.Progress != 100 {
		t.Fatalf("unexpected GetTask result: %+v", poll)
	}

	h, err := adapter.HealthCheck(context.Background())
	if err != nil || h.Healthy == nil || !*h.Healthy || h.ProbeKind != "http" {
		t.Fatalf("unexpected HealthCheck: %+v err=%v", h, err)
	}
}

func TestRunningHubTransientPollAndEmptyWalletHealth(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/openapi/run/workflow":
			_ = json.NewEncoder(w).Encode(map[string]any{"code": 0, "data": map[string]any{"taskId": "rh_1"}})
		case "/openapi/v2/query":
			_ = json.NewEncoder(w).Encode(map[string]any{"errorCode": "1003", "errorMessage": "rate limit"})
		case "/uc/openapi/accountStatus":
			_ = json.NewEncoder(w).Encode(map[string]any{"code": 0, "data": map[string]any{"remainMoney": "0", "remainCoins": "0", "currency": "CNY"}})
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	adapter := NewRunningHubAdapter(srv.URL, "rh-key", nil, []string{"127.0.0.1"})
	sub, err := adapter.CreateTask(context.Background(), TaskRequest{ProviderEndpoint: "/openapi/run/workflow", Prompt: "hi"})
	if err != nil || sub.ProviderRequestID != "rh_1" {
		t.Fatalf("CreateTask failed: %v %+v", err, sub)
	}
	poll, err := adapter.GetTask(context.Background(), "rh_1", TaskRequest{})
	if err != nil || poll.Status != "processing" {
		t.Fatalf("expected transient 1003 poll to stay processing, got %+v err=%v", poll, err)
	}
	h, err := adapter.HealthCheck(context.Background())
	if err != nil || h.Healthy == nil || *h.Healthy {
		t.Fatalf("expected empty wallet healthCheck=false, got %+v err=%v", h, err)
	}
}

func TestVolcengineAndBytePlusAdapters(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/api/v3/images/generations":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":   "ark_img_1",
				"data": []any{map[string]any{"url": "https://cdn.example.com/ark.png"}},
			})
		case "/api/v3/contents/generations/tasks":
			_ = json.NewEncoder(w).Encode(map[string]any{"id": "bp_vid_1"})
		case "/api/v3/contents/generations/tasks/bp_vid_1":
			_ = json.NewEncoder(w).Encode(map[string]any{"status": "succeeded", "content": map[string]any{"video_url": "https://cdn.example.com/bp.mp4"}})
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	volc := NewVolcengineAdapter(srv.URL+"/api/v3", "v-key", nil, []string{"127.0.0.1"})
	imgRes, err := volc.CreateTask(context.Background(), TaskRequest{
		ProviderModelID: "seedream-5.0",
		Prompt:          "dragon",
		Parameters:      map[string]any{"resolution": "2k", "aspect_ratio": "16:9"},
	})
	if err != nil || imgRes.ResultURL != "https://cdn.example.com/ark.png" {
		t.Fatalf("volc failed: %v %+v", err, imgRes)
	}

	bp := NewBytePlusAdapter(srv.URL+"/api/v3", "bp-key", nil, []string{"127.0.0.1"})
	vidSub, err := bp.CreateTask(context.Background(), TaskRequest{
		ProviderModelID: "seedance-2.5",
		Prompt:          "ocean",
	})
	if err != nil || vidSub.ProviderRequestID != "bp_vid_1" {
		t.Fatalf("bp create failed: %v %+v", err, vidSub)
	}
	vidPoll, err := bp.GetTask(context.Background(), "bp_vid_1", TaskRequest{})
	if err != nil || vidPoll.ResultURL != "https://cdn.example.com/bp.mp4" {
		t.Fatalf("bp poll failed: %v %+v", err, vidPoll)
	}
}

func TestResolveCredentialsEnvPrecedence(t *testing.T) {
	t.Setenv("DASHSCOPE_API_KEY", "dash-test-key")
	res := ResolveCredentials(context.Background(), nil, config.Config{}, "alibaba")
	if res.Status != "configured" || res.Source != "environment" || res.Value != "dash-test-key" {
		t.Fatalf("unexpected credential resolution: %+v", res)
	}
}

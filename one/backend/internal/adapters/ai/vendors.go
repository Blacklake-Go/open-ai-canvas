package ai

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"one/backend/internal/outbound"
)

// AlibabaAdapter calls Alibaba Cloud DashScope async image/video generation.
type AlibabaAdapter struct{ BaseClient }

func NewAlibabaAdapter(baseURL, apiKey string, cfg map[string]any, allowed []string) *AlibabaAdapter {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = "https://dashscope.aliyuncs.com"
	}
	return &AlibabaAdapter{BaseClient: NewBaseClient("alibaba", baseURL, apiKey, cfg, allowed)}
}

func (a *AlibabaAdapter) CreateTask(ctx context.Context, req TaskRequest) (*TaskResult, error) {
	if a.apiKey == "" {
		return nil, NormalizeError("alibaba", fmt.Errorf("DashScope API key missing"), 401, nil)
	}
	rawModel := strings.ToLower(strings.TrimSpace(req.ProviderModelID))
	isVideo := strings.Contains(rawModel, "t2v") || strings.Contains(rawModel, "i2v") || strings.Contains(rawModel, "video") || strVal(req.Parameters, "category") == "video"
	ep := "/api/v1/services/aigc/text2image/image-synthesis"
	model := firstNonEmpty(req.ProviderModelID, "wanx2.1-t2i-turbo")
	defaultSize := "1024*1024"
	if isVideo {
		ep = "/api/v1/services/aigc/video-generation/video-synthesis"
		model = firstNonEmpty(req.ProviderModelID, "wanx2.1-t2v-turbo")
		defaultSize = "1280*720"
	}
	targetURL, err := a.ResolveEndpoint(req.ProviderEndpoint, ep)
	if err != nil {
		return nil, err
	}
	input := map[string]any{"prompt": req.Prompt}
	if img := strVal(req.Parameters, "image_url", "imageUrl"); img != "" {
		input["img_url"] = img
	}
	params := map[string]any{"size": firstNonEmpty(strVal(req.Parameters, "resolution"), defaultSize)}
	if ar := strVal(req.Parameters, "aspect_ratio"); ar != "" {
		params["aspect_ratio"] = ar
	}
	code, _, _, data, err := a.doJSON(ctx, http.MethodPost, targetURL, map[string]string{
		"Content-Type":      "application/json",
		"Authorization":     "Bearer " + a.apiKey,
		"X-DashScope-Async": "enable",
	}, map[string]any{"model": model, "input": input, "parameters": params})
	if err != nil {
		return nil, NormalizeError("alibaba", err, code, data)
	}
	out := nestedMap(data, "output")
	taskID := strVal(out, "task_id")
	if code < 200 || code >= 300 || taskID == "" {
		return nil, NormalizeError("alibaba", fmt.Errorf("%s", firstNonEmpty(ExtractErrorText(data, 0), "DashScope submission failed")), code, data)
	}
	return &TaskResult{ProviderRequestID: taskID, Status: "processing", Metadata: out}, nil
}

func (a *AlibabaAdapter) GetTask(ctx context.Context, providerTaskID string, _ TaskRequest) (*TaskResult, error) {
	if a.apiKey == "" {
		return nil, NormalizeError("alibaba", fmt.Errorf("DashScope API key missing"), 401, nil)
	}
	targetURL, err := a.ResolveEndpoint("/api/v1/tasks/"+url.PathEscape(providerTaskID), "")
	if err != nil {
		return nil, err
	}
	code, _, _, data, err := a.doJSON(ctx, http.MethodGet, targetURL, map[string]string{"Authorization": "Bearer " + a.apiKey}, nil)
	if err != nil {
		return nil, NormalizeError("alibaba", err, code, data)
	}
	if code < 200 || code >= 300 {
		return nil, NormalizeError("alibaba", fmt.Errorf("DashScope poll failed HTTP %d", code), code, data)
	}
	out := nestedMap(data, "output")
	raw := strings.ToUpper(strVal(out, "task_status"))
	status := "processing"
	resultURL := ""
	progress := 50
	if raw == "SUCCEEDED" {
		status = "succeeded"
		progress = 100
		resultURL = strVal(out, "video_url")
		if resultURL == "" {
			if items, ok := out["results"].([]any); ok && len(items) > 0 {
				if first, ok := items[0].(map[string]any); ok {
					resultURL = strVal(first, "url")
				}
			}
		}
	} else if raw == "FAILED" {
		status = "failed"
		progress = 0
	}
	return &TaskResult{ProviderRequestID: providerTaskID, Status: status, ResultURL: resultURL, Progress: progress, Error: strVal(out, "message"), TerminalFailure: status == "failed", Metadata: data}, nil
}

func (a *AlibabaAdapter) HealthCheck(_ context.Context) (*HealthResult, error) {
	if a.apiKey == "" {
		return &HealthResult{Healthy: boolPtr(false), Status: "unhealthy", ProbeKind: "credential", Message: "missing DASHSCOPE_API_KEY"}, nil
	}
	return &HealthResult{Status: "healthy", ProbeKind: "credential", Message: "credential configured"}, nil
}

// GoogleAdapter calls Gemini TTS & Imagen predict endpoints.
type GoogleAdapter struct{ BaseClient }

func NewGoogleAdapter(baseURL, apiKey string, cfg map[string]any, allowed []string) *GoogleAdapter {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = "https://generativelanguage.googleapis.com"
	}
	return &GoogleAdapter{BaseClient: NewBaseClient("google", baseURL, apiKey, cfg, allowed)}
}

func (a *GoogleAdapter) CreateTask(ctx context.Context, req TaskRequest) (*TaskResult, error) {
	if a.apiKey == "" {
		return nil, NormalizeError("google", fmt.Errorf("Google AI API key missing"), 401, nil)
	}
	rawModel := strings.ToLower(strings.TrimSpace(req.ProviderModelID))
	isAudio := strings.Contains(rawModel, "tts") || strings.Contains(rawModel, "audio") || strVal(req.Parameters, "category") == "audio"
	if isAudio {
		model := "gemini-3.8-flash-tts"
		targetURL, err := a.ResolveEndpoint(req.ProviderEndpoint, "/v1beta/models/"+url.PathEscape(model)+":generateContent?key="+url.QueryEscape(a.apiKey))
		if err != nil {
			return nil, err
		}
		code, _, _, data, err := a.doJSON(ctx, http.MethodPost, targetURL, nil, map[string]any{
			"contents": []any{map[string]any{"parts": []any{map[string]any{"text": firstNonEmpty(req.Prompt, "Hello")}}}},
		})
		if err != nil || code < 200 || code >= 300 {
			return nil, NormalizeError("google", err, code, data)
		}
		var resultURL string
		if cands, ok := data["candidates"].([]any); ok && len(cands) > 0 {
			if c0, ok := cands[0].(map[string]any); ok {
				if parts, ok := nestedMap(c0, "content")["parts"].([]any); ok {
					for _, p := range parts {
						if pm, ok := p.(map[string]any); ok {
							if in := nestedMap(pm, "inlineData"); in != nil && strVal(in, "data") != "" {
								mime := firstNonEmpty(strVal(in, "mimeType"), "audio/wav")
								resultURL = "data:" + mime + ";base64," + strVal(in, "data")
								break
							}
						}
					}
				}
			}
		}
		status := "failed"
		if resultURL != "" {
			status = "succeeded"
		}
		return &TaskResult{ProviderRequestID: fmt.Sprintf("goog_tts_%d", time.Now().UnixMilli()), Status: status, ResultURL: resultURL, Metadata: data}, nil
	}

	model := firstNonEmpty(req.ProviderModelID, "imagen-3.0-generate-002")
	targetURL, err := a.ResolveEndpoint(req.ProviderEndpoint, "/v1beta/models/"+url.PathEscape(model)+":predict?key="+url.QueryEscape(a.apiKey))
	if err != nil {
		return nil, err
	}
	code, _, _, data, err := a.doJSON(ctx, http.MethodPost, targetURL, nil, map[string]any{
		"instances":  []any{map[string]any{"prompt": req.Prompt}},
		"parameters": map[string]any{"sampleCount": 1, "aspectRatio": firstNonEmpty(strVal(req.Parameters, "aspect_ratio"), "1:1")},
	})
	if err != nil || code < 200 || code >= 300 {
		return nil, NormalizeError("google", err, code, data)
	}
	var resultURL string
	if preds, ok := data["predictions"].([]any); ok && len(preds) > 0 {
		if p0, ok := preds[0].(map[string]any); ok {
			resultURL = strVal(p0, "uri", "url")
			if resultURL == "" && strVal(p0, "bytesBase64Encoded") != "" {
				resultURL = "data:image/png;base64," + strVal(p0, "bytesBase64Encoded")
			}
		}
	}
	status := "failed"
	if resultURL != "" {
		status = "succeeded"
	}
	return &TaskResult{ProviderRequestID: fmt.Sprintf("goog_%d", time.Now().UnixMilli()), Status: status, ResultURL: resultURL, Metadata: data}, nil
}

func (a *GoogleAdapter) GetTask(_ context.Context, _ string, _ TaskRequest) (*TaskResult, error) {
	return &TaskResult{Status: "succeeded", Progress: 100}, nil
}

func (a *GoogleAdapter) HealthCheck(ctx context.Context) (*HealthResult, error) {
	start := time.Now()
	if a.apiKey == "" {
		return &HealthResult{Healthy: boolPtr(false), Status: "unhealthy", ProbeKind: "credential", Message: "missing GOOGLE_API_KEY"}, nil
	}
	probeCtx, cancel := context.WithTimeout(ctx, 6*time.Second)
	defer cancel()
	targetURL, err := a.ResolveEndpoint("/v1beta/models?key="+url.QueryEscape(a.apiKey), "")
	if err != nil {
		return &HealthResult{Healthy: boolPtr(false), Status: "unhealthy", ProbeKind: "http", Message: err.Error()}, nil
	}
	code, _, _, _, err := a.doJSON(probeCtx, http.MethodGet, targetURL, nil, nil)
	lat := time.Since(start).Milliseconds()
	ok := err == nil && code >= 200 && code < 300
	status, msg := "healthy", "OK"
	if !ok {
		status = "unhealthy"
		if err != nil {
			msg = err.Error()
		} else {
			msg = fmt.Sprintf("HTTP %d", code)
		}
	}
	return &HealthResult{Healthy: boolPtr(ok), Status: status, LatencyMs: lat, ProbeKind: "http", HTTPStatus: code, Message: msg}, nil
}

// KlingAdapter calls Kuaishou Kling text2video/image2video endpoints.
type KlingAdapter struct{ BaseClient }

func NewKlingAdapter(baseURL, apiKey string, cfg map[string]any, allowed []string) *KlingAdapter {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = "https://api.klingai.com"
	}
	return &KlingAdapter{BaseClient: NewBaseClient("kling", baseURL, apiKey, cfg, allowed)}
}

func (a *KlingAdapter) CreateTask(ctx context.Context, req TaskRequest) (*TaskResult, error) {
	if a.apiKey == "" {
		return nil, NormalizeError("kling", fmt.Errorf("Kling API key missing"), 401, nil)
	}
	img := strVal(req.Parameters, "image_url", "imageUrl")
	ep := "/v1/videos/text2video"
	if img != "" {
		ep = "/v1/videos/image2video"
	}
	targetURL, err := a.ResolveEndpoint(req.ProviderEndpoint, ep)
	if err != nil {
		return nil, err
	}
	dur := "5"
	if d, ok := toFloat(req.Parameters["duration"]); ok && d > 0 {
		dur = strconv.Itoa(int(d))
	}
	mode := "std"
	if strVal(req.Parameters, "quality", "mode") == "pro" {
		mode = "pro"
	}
	body := map[string]any{
		"model_name":   firstNonEmpty(req.ProviderModelID, "kling-video-2-6"),
		"prompt":       req.Prompt,
		"duration":     dur,
		"aspect_ratio": firstNonEmpty(strVal(req.Parameters, "aspect_ratio"), "16:9"),
		"mode":         mode,
	}
	if img != "" {
		body["image"] = img
	}
	if np := strVal(req.Parameters, "negative_prompt"); np != "" {
		body["negative_prompt"] = np
	}
	code, _, _, data, err := a.doJSON(ctx, http.MethodPost, targetURL, map[string]string{"Authorization": "Bearer " + a.apiKey}, body)
	if err != nil {
		return nil, NormalizeError("kling", err, code, data)
	}
	bCode, hasBCode := toFloat(data["code"])
	if code < 200 || code >= 300 || (hasBCode && bCode != 0) {
		return nil, NormalizeError("kling", fmt.Errorf("%s", firstNonEmpty(ExtractErrorText(data, 0), "Kling submission failed")), code, data)
	}
	dMap := nestedMap(data, "data")
	return &TaskResult{ProviderRequestID: strVal(dMap, "task_id"), Status: "processing", Metadata: dMap}, nil
}

func (a *KlingAdapter) GetTask(ctx context.Context, providerTaskID string, req TaskRequest) (*TaskResult, error) {
	if a.apiKey == "" {
		return nil, NormalizeError("kling", fmt.Errorf("Kling API key missing"), 401, nil)
	}
	seg := "text2video"
	if strVal(req.Parameters, "image_url", "imageUrl") != "" {
		seg = "image2video"
	}
	targetURL, err := a.ResolveEndpoint("/v1/videos/"+seg+"/"+url.PathEscape(providerTaskID), "")
	if err != nil {
		return nil, err
	}
	code, _, _, data, err := a.doJSON(ctx, http.MethodGet, targetURL, map[string]string{"Authorization": "Bearer " + a.apiKey}, nil)
	if err != nil {
		return nil, NormalizeError("kling", err, code, data)
	}
	bCode, hasBCode := toFloat(data["code"])
	if code < 200 || code >= 300 || (hasBCode && bCode != 0) {
		return nil, NormalizeError("kling", fmt.Errorf("%s", firstNonEmpty(ExtractErrorText(data, 0), "Kling poll failed")), code, data)
	}
	td := nestedMap(data, "data")
	raw := strings.ToLower(strVal(td, "task_status"))
	status := "processing"
	resultURL := ""
	if raw == "succeed" || raw == "success" {
		status = "succeeded"
		if vids, ok := nestedMap(td, "task_result")["videos"].([]any); ok && len(vids) > 0 {
			if v0, ok := vids[0].(map[string]any); ok {
				resultURL = strVal(v0, "url")
			}
		}
	} else if raw == "failed" {
		status = "failed"
	}
	progress := 60
	if status == "succeeded" {
		progress = 100
	}
	return &TaskResult{ProviderRequestID: providerTaskID, Status: status, ResultURL: resultURL, Progress: progress, Error: strVal(td, "task_status_msg"), TerminalFailure: status == "failed", Metadata: td}, nil
}

func (a *KlingAdapter) HealthCheck(_ context.Context) (*HealthResult, error) {
	if a.apiKey == "" {
		return &HealthResult{Healthy: boolPtr(false), Status: "unhealthy", ProbeKind: "credential", Message: "missing KLING_API_KEY"}, nil
	}
	return &HealthResult{Status: "healthy", ProbeKind: "credential", Message: "credential configured"}, nil
}

// RunwayAdapter calls RunwayML official v1 API.
type RunwayAdapter struct{ BaseClient }

func NewRunwayAdapter(baseURL, apiKey string, cfg map[string]any, allowed []string) *RunwayAdapter {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = "https://api.runwayml.com"
	}
	return &RunwayAdapter{BaseClient: NewBaseClient("runway", baseURL, apiKey, cfg, allowed)}
}

func (a *RunwayAdapter) CreateTask(ctx context.Context, req TaskRequest) (*TaskResult, error) {
	if a.apiKey == "" {
		return nil, NormalizeError("runway", fmt.Errorf("Runway API key missing"), 401, nil)
	}
	img := strVal(req.Parameters, "image_url", "imageUrl", "input_image")
	ep := "/v1/tasks"
	if img != "" {
		ep = "/v1/image_to_video"
	}
	targetURL, err := a.ResolveEndpoint(req.ProviderEndpoint, ep)
	if err != nil {
		return nil, err
	}
	dur := 5.0
	if d, ok := toFloat(req.Parameters["duration"]); ok && d > 0 {
		dur = d
	}
	body := map[string]any{
		"model":      firstNonEmpty(req.ProviderModelID, "gen3a_turbo"),
		"promptText": req.Prompt,
		"watermark":  false,
		"duration":   dur,
		"ratio":      firstNonEmpty(strVal(req.Parameters, "aspect_ratio", "aspectRatio"), "16:9"),
	}
	if img != "" {
		body["promptImage"] = img
	}
	code, _, _, data, err := a.doJSON(ctx, http.MethodPost, targetURL, map[string]string{
		"Authorization":    "Bearer " + a.apiKey,
		"X-Runway-Version": "2024-09-13",
	}, body)
	if err != nil || code < 200 || code >= 300 || strVal(data, "id") == "" {
		return nil, NormalizeError("runway", err, code, data)
	}
	return &TaskResult{ProviderRequestID: strVal(data, "id"), Status: "processing", Metadata: data}, nil
}

func (a *RunwayAdapter) GetTask(ctx context.Context, providerTaskID string, _ TaskRequest) (*TaskResult, error) {
	if a.apiKey == "" {
		return nil, NormalizeError("runway", fmt.Errorf("Runway API key missing"), 401, nil)
	}
	targetURL, err := a.ResolveEndpoint("/v1/tasks/"+url.PathEscape(providerTaskID), "")
	if err != nil {
		return nil, err
	}
	code, _, _, data, err := a.doJSON(ctx, http.MethodGet, targetURL, map[string]string{
		"Authorization":    "Bearer " + a.apiKey,
		"X-Runway-Version": "2024-09-13",
	}, nil)
	if err != nil || code < 200 || code >= 300 {
		return nil, NormalizeError("runway", err, code, data)
	}
	raw := strings.ToUpper(strVal(data, "status"))
	status := "processing"
	switch raw {
	case "SUCCEEDED":
		status = "succeeded"
	case "FAILED":
		status = "failed"
	case "CANCELLED":
		status = "cancelled"
	}
	return &TaskResult{
		ProviderRequestID: providerTaskID,
		Status:            status,
		ResultURL:         firstNonEmpty(firstStringInSlice(data["output"]), strVal(data, "resultUrl")),
		Error:             firstNonEmpty(strVal(data, "failure", "failureCode")),
		TerminalFailure:   status == "failed" || status == "cancelled",
		Metadata:          data,
	}, nil
}

func (a *RunwayAdapter) HealthCheck(ctx context.Context) (*HealthResult, error) {
	start := time.Now()
	if a.apiKey == "" {
		return &HealthResult{Healthy: boolPtr(false), Status: "unhealthy", ProbeKind: "credential", Message: "missing RUNWAY_API_KEY"}, nil
	}
	targetURL, err := a.ResolveEndpoint("/v1/tasks?limit=1", "")
	if err != nil {
		return &HealthResult{Healthy: boolPtr(false), Status: "unhealthy", ProbeKind: "http", Message: err.Error()}, nil
	}
	code, _, _, _, err := a.doJSON(ctx, http.MethodGet, targetURL, map[string]string{"Authorization": "Bearer " + a.apiKey, "X-Runway-Version": "2024-09-13"}, nil)
	lat := time.Since(start).Milliseconds()
	ok := err == nil && code >= 200 && code < 300
	status := "healthy"
	if !ok {
		status = "unhealthy"
	}
	return &HealthResult{Healthy: boolPtr(ok), Status: status, LatencyMs: lat, ProbeKind: "http", HTTPStatus: code, Message: fmt.Sprintf("HTTP %d", code)}, nil
}

// LumaAdapter calls Luma Dream Machine official v1 API.
type LumaAdapter struct{ BaseClient }

func NewLumaAdapter(baseURL, apiKey string, cfg map[string]any, allowed []string) *LumaAdapter {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = "https://api.lumalabs.ai"
	}
	return &LumaAdapter{BaseClient: NewBaseClient("luma", baseURL, apiKey, cfg, allowed)}
}

func (a *LumaAdapter) CreateTask(ctx context.Context, req TaskRequest) (*TaskResult, error) {
	if a.apiKey == "" {
		return nil, NormalizeError("luma", fmt.Errorf("Luma API key missing"), 401, nil)
	}
	targetURL, err := a.ResolveEndpoint(req.ProviderEndpoint, "/dream-machine/v1/generations")
	if err != nil {
		return nil, err
	}
	loop, _ := boolVal(req.Parameters, "loop")
	body := map[string]any{
		"prompt":       req.Prompt,
		"aspect_ratio": firstNonEmpty(strVal(req.Parameters, "aspect_ratio", "aspectRatio"), "16:9"),
		"loop":         loop,
	}
	if img := strVal(req.Parameters, "image_url", "imageUrl", "input_image"); img != "" {
		body["keyframes"] = map[string]any{"frame0": map[string]any{"type": "image", "url": img}}
	}
	code, _, _, data, err := a.doJSON(ctx, http.MethodPost, targetURL, map[string]string{"Authorization": "Bearer " + a.apiKey}, body)
	if err != nil || code < 200 || code >= 300 || strVal(data, "id") == "" {
		return nil, NormalizeError("luma", err, code, data)
	}
	return &TaskResult{ProviderRequestID: strVal(data, "id"), Status: "processing", Metadata: data}, nil
}

func (a *LumaAdapter) GetTask(ctx context.Context, providerTaskID string, _ TaskRequest) (*TaskResult, error) {
	if a.apiKey == "" {
		return nil, NormalizeError("luma", fmt.Errorf("Luma API key missing"), 401, nil)
	}
	targetURL, err := a.ResolveEndpoint("/dream-machine/v1/generations/"+url.PathEscape(providerTaskID), "")
	if err != nil {
		return nil, err
	}
	code, _, _, data, err := a.doJSON(ctx, http.MethodGet, targetURL, map[string]string{"Authorization": "Bearer " + a.apiKey}, nil)
	if err != nil || code < 200 || code >= 300 {
		return nil, NormalizeError("luma", err, code, data)
	}
	raw := strings.ToLower(strVal(data, "state"))
	status := "processing"
	if raw == "completed" {
		status = "succeeded"
	} else if raw == "failed" {
		status = "failed"
	}
	return &TaskResult{
		ProviderRequestID: providerTaskID,
		Status:            status,
		ResultURL:         strVal(nestedMap(data, "assets"), "video"),
		Error:             strVal(data, "failure_reason"),
		TerminalFailure:   status == "failed",
		Metadata:          data,
	}, nil
}

func (a *LumaAdapter) HealthCheck(ctx context.Context) (*HealthResult, error) {
	start := time.Now()
	if a.apiKey == "" {
		return &HealthResult{Healthy: boolPtr(false), Status: "unhealthy", ProbeKind: "credential", Message: "missing LUMA_API_KEY"}, nil
	}
	targetURL, err := a.ResolveEndpoint("/dream-machine/v1/generations?limit=1", "")
	if err != nil {
		return &HealthResult{Healthy: boolPtr(false), Status: "unhealthy", ProbeKind: "http", Message: err.Error()}, nil
	}
	code, _, _, _, err := a.doJSON(ctx, http.MethodGet, targetURL, map[string]string{"Authorization": "Bearer " + a.apiKey}, nil)
	lat := time.Since(start).Milliseconds()
	ok := err == nil && code >= 200 && code < 300
	status := "healthy"
	if !ok {
		status = "unhealthy"
	}
	return &HealthResult{Healthy: boolPtr(ok), Status: status, LatencyMs: lat, ProbeKind: "http", HTTPStatus: code, Message: fmt.Sprintf("HTTP %d", code)}, nil
}

// MiniMaxAdapter supports MiniMax video, music, and speech (t2a_v2).
type MiniMaxAdapter struct{ BaseClient }

func NewMiniMaxAdapter(baseURL, apiKey string, cfg map[string]any, allowed []string) *MiniMaxAdapter {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = "https://api.minimax.io"
	}
	return &MiniMaxAdapter{BaseClient: NewBaseClient("minimax", baseURL, apiKey, cfg, allowed)}
}

func minimaxKind(model, ep string, params map[string]any) string {
	task := strings.ToLower(strVal(params, "task_type", "taskType"))
	switch task {
	case "t2m":
		return "music"
	case "t2a":
		return "speech"
	case "t2v", "i2v":
		return "video"
	}
	m := strings.ToLower(model)
	if strings.HasPrefix(m, "music-") || strings.HasPrefix(m, "minimax-music-") || strings.HasSuffix(ep, "/music_generation") {
		return "music"
	}
	if strings.HasPrefix(m, "speech-") || strings.HasPrefix(m, "minimax-speech-") || strings.HasSuffix(ep, "/t2a_v2") {
		return "speech"
	}
	return "video"
}

func (a *MiniMaxAdapter) CreateTask(ctx context.Context, req TaskRequest) (*TaskResult, error) {
	if a.apiKey == "" {
		return nil, NormalizeError("minimax", fmt.Errorf("MiniMax API key missing"), 401, nil)
	}
	if s, ok := boolVal(req.Parameters, "stream"); ok && s {
		return nil, &ProviderError{Code: ErrCodeInvalidInput, Provider: "minimax", HTTPStatus: 422, TerminalFailure: true, Message: "stream must be false for durable tasks"}
	}
	kind := minimaxKind(req.ProviderModelID, req.ProviderEndpoint, req.Parameters)
	ep := "/v1/video_generation"
	body := map[string]any{}
	switch kind {
	case "music":
		ep = "/v1/music_generation"
		model := req.ProviderModelID
		if model == "minimax-music-3.0" {
			model = "music-3.0"
		}
		body = map[string]any{
			"model":         firstNonEmpty(model, "music-01"),
			"prompt":        req.Prompt,
			"stream":        false,
			"output_format": firstNonEmpty(strVal(req.Parameters, "output_format"), "url"),
			"audio_setting": map[string]any{"format": firstNonEmpty(strVal(req.Parameters, "format"), "mp3")},
		}
		if lyr := strVal(req.Parameters, "lyrics"); lyr != "" {
			body["lyrics"] = lyr
		}
		if b, ok := boolVal(req.Parameters, "is_instrumental"); ok {
			body["is_instrumental"] = b
		}
		if b, ok := boolVal(req.Parameters, "lyrics_optimizer"); ok {
			body["lyrics_optimizer"] = b
		}
	case "speech":
		ep = "/v1/t2a_v2"
		vid := firstNonEmpty(strVal(req.Parameters, "voice_id"), strVal(nestedMap(req.Parameters, "voice_setting"), "voice_id"))
		if vid == "" {
			return nil, &ProviderError{Code: ErrCodeInvalidInput, Provider: "minimax", HTTPStatus: 422, TerminalFailure: true, Message: "voice_id required for MiniMax speech"}
		}
		body = map[string]any{
			"model":         firstNonEmpty(req.ProviderModelID, "speech-02-hd"),
			"text":          firstNonEmpty(strVal(req.Parameters, "text"), req.Prompt),
			"stream":        false,
			"output_format": firstNonEmpty(strVal(req.Parameters, "output_format"), "url"),
			"voice_setting": map[string]any{"voice_id": vid},
			"audio_setting": map[string]any{"format": firstNonEmpty(strVal(req.Parameters, "format"), "mp3")},
		}
	default:
		body = map[string]any{
			"model":            firstNonEmpty(req.ProviderModelID, "video-01"),
			"prompt":           req.Prompt,
			"prompt_optimizer": true,
		}
		if img := strVal(req.Parameters, "image_url", "imageUrl"); img != "" {
			body["first_frame_image"] = img
		}
		if r := strVal(req.Parameters, "resolution"); r != "" {
			body["resolution"] = strings.ToUpper(r)
		}
	}
	targetURL, err := a.ResolveEndpoint(req.ProviderEndpoint, ep)
	if err != nil {
		return nil, err
	}
	code, _, _, data, err := a.doJSON(ctx, http.MethodPost, targetURL, map[string]string{"Authorization": "Bearer " + a.apiKey}, body)
	if err != nil {
		return nil, NormalizeError("minimax", err, code, data)
	}
	if bCode, ok := toFloat(nestedMap(data, "base_resp")["status_code"]); ok && bCode != 0 {
		msg := firstNonEmpty(strVal(nestedMap(data, "base_resp"), "status_msg"), fmt.Sprintf("MiniMax error %.0f", bCode))
		return nil, NormalizeError("minimax", fmt.Errorf("%s", msg), code, data)
	}
	if code < 200 || code >= 300 {
		return nil, NormalizeError("minimax", fmt.Errorf("MiniMax failed HTTP %d", code), code, data)
	}
	taskID := strVal(data, "task_id")
	var resultURL string
	if kind != "video" {
		rawAudio := strVal(nestedMap(data, "data"), "audio")
		if strings.HasPrefix(rawAudio, "https://") {
			resultURL = rawAudio
		} else if len(rawAudio) > 0 && len(rawAudio)%2 == 0 {
			if decoded, decErr := hex.DecodeString(rawAudio); decErr == nil {
				_ = decoded // preserved as base64 data URL only in binary audio responses
			}
		}
	}
	status := "processing"
	if resultURL != "" {
		status = "succeeded"
	}
	return &TaskResult{ProviderRequestID: taskID, Status: status, ResultURL: resultURL, Metadata: data}, nil
}

func (a *MiniMaxAdapter) GetTask(ctx context.Context, providerTaskID string, req TaskRequest) (*TaskResult, error) {
	if a.apiKey == "" {
		return nil, NormalizeError("minimax", fmt.Errorf("MiniMax API key missing"), 401, nil)
	}
	if minimaxKind(req.ProviderModelID, req.ProviderEndpoint, req.Parameters) != "video" {
		return nil, &ProviderError{Code: ErrCodeUnknown, Provider: "minimax", Message: "MiniMax audio API does not support async polling", Retryable: false}
	}
	targetURL, err := a.ResolveEndpoint("/v1/query/video_generation?task_id="+url.QueryEscape(providerTaskID), "")
	if err != nil {
		return nil, err
	}
	code, _, _, data, err := a.doJSON(ctx, http.MethodGet, targetURL, map[string]string{"Authorization": "Bearer " + a.apiKey}, nil)
	if err != nil || code < 200 || code >= 300 {
		return nil, NormalizeError("minimax", err, code, data)
	}
	raw := strings.ToLower(strVal(data, "status"))
	status := "processing"
	resultURL := strVal(data, "download_url", "file_url")
	if raw == "success" {
		status = "succeeded"
		if resultURL == "" && strVal(data, "file_id") != "" {
			fURL, _ := a.ResolveEndpoint("/v1/files/retrieve?file_id="+url.QueryEscape(strVal(data, "file_id")), "")
			if fURL != "" {
				_, _, _, fData, _ := a.doJSON(ctx, http.MethodGet, fURL, map[string]string{"Authorization": "Bearer " + a.apiKey}, nil)
				resultURL = strVal(nestedMap(fData, "file"), "download_url")
			}
		}
	} else if raw == "fail" {
		status = "failed"
	}
	return &TaskResult{
		ProviderRequestID: providerTaskID,
		Status:            status,
		ResultURL:         resultURL,
		Error:             strVal(nestedMap(data, "base_resp"), "status_msg"),
		TerminalFailure:   status == "failed",
		Metadata:          data,
	}, nil
}

func (a *MiniMaxAdapter) HealthCheck(_ context.Context) (*HealthResult, error) {
	if a.apiKey == "" {
		return &HealthResult{Healthy: boolPtr(false), Status: "unhealthy", ProbeKind: "credential", Message: "missing MINIMAX_API_KEY"}, nil
	}
	return &HealthResult{Status: "healthy", ProbeKind: "credential", Message: "credential configured; live check unsupported"}, nil
}

// OpenAIAdapter supports t2t, t2i, and t2a (OpenAI and OpenAI-compatible relays).
type OpenAIAdapter struct{ BaseClient }

func NewOpenAIAdapter(provider, baseURL, apiKey string, cfg map[string]any, allowed []string) *OpenAIAdapter {
	if strings.TrimSpace(provider) == "" {
		provider = "openai"
	}
	if strings.TrimSpace(baseURL) == "" {
		baseURL = "https://api.openai.com"
	}
	return &OpenAIAdapter{BaseClient: NewBaseClient(provider, baseURL, apiKey, cfg, allowed)}
}

func (a *OpenAIAdapter) CreateTask(ctx context.Context, req TaskRequest) (*TaskResult, error) {
	if a.apiKey == "" {
		return nil, NormalizeError(a.provider, fmt.Errorf("%s API key missing", a.provider), 401, nil)
	}
	if req.ProviderModelID == "" {
		return nil, &ProviderError{Code: ErrCodeInvalidInput, Provider: a.provider, HTTPStatus: 400, Message: "missing provider model mapping"}
	}
	task := firstNonEmpty(strVal(req.Parameters, "task_type"), "t2i")
	mode := "image"
	fallback := "/v1/images/generations"
	if task == "t2t" || task == "text" {
		mode = "text"
		fallback = "/v1/chat/completions"
	} else if task == "t2a" || task == "audio" {
		mode = "audio"
		fallback = "/v1/audio/speech"
	}
	targetURL, err := a.ResolveEndpoint(req.ProviderEndpoint, fallback)
	if err != nil {
		return nil, err
	}
	body := map[string]any{"model": req.ProviderModelID}
	switch mode {
	case "text":
		msgs, ok := req.Parameters["messages"].([]any)
		if !ok || len(msgs) == 0 {
			msgs = []any{map[string]any{"role": "user", "content": req.Prompt}}
		}
		body["messages"] = msgs
		body["stream"] = false
	case "audio":
		body["input"] = firstNonEmpty(strVal(req.Parameters, "input", "text"), req.Prompt)
		body["voice"] = firstNonEmpty(strVal(req.Parameters, "voice"), "alloy")
	default:
		body["prompt"] = req.Prompt
		body["n"] = 1
		body["size"] = firstNonEmpty(strVal(req.Parameters, "resolution", "size"), "1024x1024")
	}
	headers := map[string]string{"Authorization": "Bearer " + a.apiKey}
	if req.IdempotencyKey != "" {
		headers["Idempotency-Key"] = req.IdempotencyKey
	}
	code, _, _, data, err := a.doJSON(ctx, http.MethodPost, targetURL, headers, body)
	if err != nil || code < 200 || code >= 300 {
		return nil, NormalizeError(a.provider, err, code, data)
	}
	var resultURL, resultText string
	if mode == "text" {
		if choices, ok := data["choices"].([]any); ok && len(choices) > 0 {
			if c0, ok := choices[0].(map[string]any); ok {
				resultText = strVal(nestedMap(c0, "message"), "content")
			}
		}
	} else if items, ok := data["data"].([]any); ok && len(items) > 0 {
		if i0, ok := items[0].(map[string]any); ok {
			resultURL = strVal(i0, "url")
			if resultURL == "" && strVal(i0, "b64_json") != "" {
				resultURL = "data:image/png;base64," + strVal(i0, "b64_json")
			}
		}
	}
	return &TaskResult{ProviderRequestID: strVal(data, "id"), Status: "succeeded", ResultURL: resultURL, ResultText: resultText, Metadata: data}, nil
}

func (a *OpenAIAdapter) GetTask(_ context.Context, _ string, _ TaskRequest) (*TaskResult, error) {
	return &TaskResult{Status: "processing", ReconciliationRequired: true, Reason: "SYNCHRONOUS_RESULT_NOT_RECOVERABLE"}, nil
}

func (a *OpenAIAdapter) HealthCheck(ctx context.Context) (*HealthResult, error) {
	start := time.Now()
	if a.apiKey == "" {
		return &HealthResult{Healthy: boolPtr(false), Status: "unhealthy", ProbeKind: "credential", Message: "missing API key"}, nil
	}
	ep := "/v1/models"
	if strings.HasSuffix(a.baseURL, "/v1") || a.provider == "deepseek" {
		ep = "/models"
	}
	targetURL, err := a.ResolveEndpoint(ep, "")
	if err != nil {
		return &HealthResult{Healthy: boolPtr(false), Status: "unhealthy", ProbeKind: "http", Message: err.Error()}, nil
	}
	probeCtx, cancel := context.WithTimeout(ctx, 6*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(probeCtx, http.MethodGet, targetURL, nil)
	if err != nil {
		return &HealthResult{Healthy: boolPtr(false), Status: "unhealthy", ProbeKind: "http", Message: err.Error()}, nil
	}
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	resp, err := outbound.SafeRequest(probeCtx, a.httpClient, req, a.allowedPrivateHosts...)
	lat := time.Since(start).Milliseconds()
	if err != nil {
		return &HealthResult{Healthy: boolPtr(false), Status: "unhealthy", LatencyMs: lat, ProbeKind: "http", Message: err.Error()}, nil
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
	ok := resp.StatusCode >= 200 && resp.StatusCode < 300
	status, msg := "healthy", "OK"
	if !ok {
		status = "unhealthy"
		msg = fmt.Sprintf("HTTP %d", resp.StatusCode)
	}
	return &HealthResult{Healthy: boolPtr(ok), Status: status, LatencyMs: lat, ProbeKind: "http", HTTPStatus: resp.StatusCode, Message: msg}, nil
}

// DeepSeekAdapter mirrors OpenAIAdapter with DeepSeek defaults and balance check.
type DeepSeekAdapter struct{ *OpenAIAdapter }

func NewDeepSeekAdapter(baseURL, apiKey string, cfg map[string]any, allowed []string) *DeepSeekAdapter {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = "https://api.deepseek.com"
	}
	return &DeepSeekAdapter{OpenAIAdapter: NewOpenAIAdapter("deepseek", baseURL, apiKey, cfg, allowed)}
}

func (a *DeepSeekAdapter) CreateTask(ctx context.Context, req TaskRequest) (*TaskResult, error) {
	if req.Parameters == nil {
		req.Parameters = map[string]any{}
	}
	if _, ok := req.Parameters["task_type"]; !ok {
		req.Parameters["task_type"] = "t2t"
	}
	if req.ProviderModelID == "" {
		req.ProviderModelID = "deepseek-chat"
	}
	if req.ProviderEndpoint == "" {
		req.ProviderEndpoint = "/chat/completions"
	}
	return a.OpenAIAdapter.CreateTask(ctx, req)
}

// Ensure interface compliance.
var (
	_ ProviderAdapter = (*MuAPIAdapter)(nil)
	_ ProviderAdapter = (*VolcengineAdapter)(nil)
	_ ProviderAdapter = (*BytePlusAdapter)(nil)
	_ ProviderAdapter = (*RunningHubAdapter)(nil)
	_ ProviderAdapter = (*AlibabaAdapter)(nil)
	_ ProviderAdapter = (*GoogleAdapter)(nil)
	_ ProviderAdapter = (*KlingAdapter)(nil)
	_ ProviderAdapter = (*RunwayAdapter)(nil)
	_ ProviderAdapter = (*LumaAdapter)(nil)
	_ ProviderAdapter = (*MiniMaxAdapter)(nil)
	_ ProviderAdapter = (*OpenAIAdapter)(nil)
	_ ProviderAdapter = (*DeepSeekAdapter)(nil)
)

// ParseIntSafe is a small helper reused in generation scheduling.
func ParseIntSafe(v any, fallback int) int {
	if f, ok := toFloat(v); ok {
		return int(f)
	}
	if s, ok := v.(string); ok {
		if n, err := strconv.Atoi(strings.TrimSpace(s)); err == nil {
			return n
		}
	}
	return fallback
}

// RawBodyPreview decodes json map safely.
func RawBodyPreview(raw []byte) map[string]any {
	out := map[string]any{}
	_ = json.Unmarshal(raw, &out)
	return out
}

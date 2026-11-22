package ai

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const minVolcHighResPixels = 3686400

var volcAliases = map[string]string{
	"seedream-5.0-pro": "doubao-seedream-5-0-pro-260628",
	"seedream-5.0":     "doubao-seedream-5-0-260128",
	"seedream-4.5":     "doubao-seedream-4-5-251128",
	"seedream-4.0":     "doubao-seedream-4-0-250828",
}

func ResolveVolcengineModelName(providerModelID string) string {
	raw := strings.TrimSpace(providerModelID)
	if raw == "" {
		return ""
	}
	if mapped, ok := volcAliases[strings.ToLower(raw)]; ok {
		return mapped
	}
	return raw
}

func normalizeArkSize(raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return "1024x1024"
	}
	return strings.ReplaceAll(s, "*", "x")
}

func escalateArkSize(size string) string {
	parts := strings.Split(strings.ToLower(size), "x")
	w, h := 1024, 1024
	if len(parts) == 2 {
		if pw, err := strconv.Atoi(parts[0]); err == nil && pw > 0 {
			w = pw
		}
		if ph, err := strconv.Atoi(parts[1]); err == nil && ph > 0 {
			h = ph
		}
	}
	if w*h >= minVolcHighResPixels {
		return size
	}
	ratio := float64(w) / float64(h)
	switch {
	case math.Abs(ratio-1) < 0.1:
		return "2048x2048"
	case ratio > 1.5:
		return "2560x1440"
	case ratio < 0.7:
		return "1440x2560"
	case ratio > 1.1:
		return "2304x1728"
	default:
		return "1728x2304"
	}
}

var (
	reRatio = regexp.MustCompile(`^\s*(\d{1,3})\s*:\s*(\d{1,3})\s*$`)
	reWxH   = regexp.MustCompile(`^\d{2,5}x\d{2,5}$`)
	reTierK = regexp.MustCompile(`^([124])k$`)
)

func resolveArkAspectRatioSize(size, aspectRatio string, highRes bool) string {
	m := reRatio.FindStringSubmatch(aspectRatio)
	if len(m) != 3 {
		return ""
	}
	rw, _ := strconv.Atoi(m[1])
	rh, _ := strconv.Atoi(m[2])
	if rw <= 0 || rh <= 0 {
		return ""
	}
	if reWxH.MatchString(strings.ReplaceAll(size, "*", "x")) {
		return ""
	}
	tk := reTierK.FindStringSubmatch(strings.ToLower(strings.TrimSpace(size)))
	if len(tk) != 2 {
		return ""
	}
	tierNum, _ := strconv.Atoi(tk[1])
	tierPx := float64(tierNum * 1024)
	area := tierPx * tierPx
	if highRes && area < float64(minVolcHighResPixels) {
		area = float64(minVolcHighResPixels)
	}
	ratio := float64(rw) / float64(rh)
	w := math.Sqrt(area * ratio)
	h := math.Sqrt(area / ratio)
	const maxSide, minSide = 4096.0, 1280.0
	if shrink := math.Min(1, maxSide/math.Max(w, h)); shrink < 1 {
		w *= shrink
		h *= shrink
	}
	snap := func(v float64) int {
		s := math.Round(v/8.0) * 8.0
		if s < minSide {
			s = minSide
		}
		if s > maxSide {
			s = maxSide
		}
		return int(s)
	}
	return fmt.Sprintf("%dx%d", snap(w), snap(h))
}

func extractImageInput(parameters map[string]any) any {
	keys := []string{
		"image_url", "imageUrl", "input_image", "inputImage",
		"reference_image", "referenceImage", "image",
		"reference_images", "image_urls", "images",
	}
	for _, k := range keys {
		v, ok := parameters[k]
		if !ok || v == nil {
			continue
		}
		switch val := v.(type) {
		case string:
			if t := strings.TrimSpace(val); t != "" {
				return t
			}
		case []any:
			var out []string
			for _, item := range val {
				if s, ok := item.(string); ok && strings.TrimSpace(s) != "" {
					out = append(out, strings.TrimSpace(s))
				}
			}
			if len(out) == 1 {
				return out[0]
			}
			if len(out) > 1 {
				return out
			}
		case []string:
			if len(val) == 1 {
				return strings.TrimSpace(val[0])
			}
			if len(val) > 1 {
				return val
			}
		}
	}
	return nil
}

type VolcengineAdapter struct {
	BaseClient
}

func NewVolcengineAdapter(baseURL, apiKey string, cfg map[string]any, allowedPrivateHosts []string) *VolcengineAdapter {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = "https://ark.cn-beijing.volces.com/api/v3"
	}
	return &VolcengineAdapter{BaseClient: NewBaseClient("volcengine", baseURL, apiKey, cfg, allowedPrivateHosts)}
}

func (a *VolcengineAdapter) CreateTask(ctx context.Context, req TaskRequest) (*TaskResult, error) {
	if a.apiKey == "" {
		return nil, NormalizeError("volcengine", fmt.Errorf("Volcengine Ark API key not configured"), http.StatusUnauthorized, nil)
	}
	cleanEp := strings.TrimSpace(req.ProviderEndpoint)
	if strings.HasPrefix(cleanEp, "/api/v3/") {
		cleanEp = strings.TrimPrefix(cleanEp, "/api/v3")
	} else if strings.HasPrefix(cleanEp, "api/v3/") {
		cleanEp = strings.TrimPrefix(cleanEp, "api/v3")
	}
	if cleanEp == "" || cleanEp == "/" || strings.Contains(cleanEp, "image_generation") || strings.Contains(cleanEp, "image") {
		cleanEp = "/images/generations"
	}
	targetURL, err := a.ResolveEndpoint(cleanEp, "/images/generations")
	if err != nil {
		return nil, err
	}

	model := ResolveVolcengineModelName(req.ProviderModelID)
	highRes := strings.Contains(model, "4-5") || strings.Contains(model, "5-0")
	size := normalizeArkSize(strVal(req.Parameters, "size", "resolution"))
	if arSize := resolveArkAspectRatioSize(size, strVal(req.Parameters, "aspect_ratio"), highRes); arSize != "" {
		size = arSize
	}
	if highRes {
		size = escalateArkSize(size)
	}

	watermark := false
	if wm, ok := boolVal(req.Parameters, "watermark"); ok {
		watermark = wm
	}
	body := map[string]any{
		"model":           model,
		"prompt":          req.Prompt,
		"size":            size,
		"response_format": "url",
		"watermark":       watermark,
	}
	if img := extractImageInput(req.Parameters); img != nil {
		body["image"] = img
	}

	code, _, _, data, err := a.doJSON(ctx, http.MethodPost, targetURL, map[string]string{
		"Content-Type":  "application/json",
		"Authorization": "Bearer " + a.apiKey,
	}, body)
	if err != nil {
		return nil, NormalizeError("volcengine", err, code, data)
	}
	var resultURL, itemID string
	if items, ok := data["data"].([]any); ok && len(items) > 0 {
		if first, ok := items[0].(map[string]any); ok {
			resultURL = strVal(first, "url")
			itemID = strVal(first, "id")
		}
	}
	if code < 200 || code >= 300 || resultURL == "" {
		msg := ExtractErrorText(data, 0)
		if msg == "" {
			msg = fmt.Sprintf("Volcengine image generation failed HTTP %d", code)
		}
		pe := NormalizeError("volcengine", fmt.Errorf("%s", msg), code, data)
		if errObj := nestedMap(data, "error"); errObj != nil {
			pe.ProviderErrorCode = strVal(errObj, "code")
		}
		return nil, pe
	}
	return &TaskResult{
		ProviderRequestID: firstNonEmpty(itemID, strVal(data, "id")),
		Status:            "succeeded",
		ResultURL:         resultURL,
		Metadata:          map[string]any{"model": model, "size": size, "requestedModel": req.ProviderModelID},
	}, nil
}

func (a *VolcengineAdapter) GetTask(_ context.Context, providerTaskID string, _ TaskRequest) (*TaskResult, error) {
	return &TaskResult{
		Status:                 "failed",
		TerminalFailure:        true,
		ReconciliationRequired: false,
		Error:                  fmt.Sprintf("Volcengine Ark images API is synchronous (providerTaskId=%s)", providerTaskID),
	}, nil
}

func (a *VolcengineAdapter) HealthCheck(ctx context.Context) (*HealthResult, error) {
	start := time.Now()
	if a.apiKey == "" {
		return &HealthResult{Healthy: boolPtr(false), Status: "unhealthy", ProbeKind: "credential", Message: "missing VOLCENGINE_API_KEY"}, nil
	}
	probeCtx, cancel := context.WithTimeout(ctx, 6*time.Second)
	defer cancel()
	targetURL, err := a.ResolveEndpoint("/models", "")
	if err != nil {
		return &HealthResult{Healthy: boolPtr(false), Status: "unhealthy", LatencyMs: time.Since(start).Milliseconds(), ProbeKind: "http", Message: err.Error()}, nil
	}
	code, _, _, data, err := a.doJSON(probeCtx, http.MethodGet, targetURL, map[string]string{"Authorization": "Bearer " + a.apiKey}, nil)
	lat := time.Since(start).Milliseconds()
	if err != nil {
		return &HealthResult{Healthy: boolPtr(false), Status: "unhealthy", LatencyMs: lat, ProbeKind: "http", Message: err.Error()}, nil
	}
	if code < 200 || code >= 300 {
		return &HealthResult{Healthy: boolPtr(false), Status: "unhealthy", LatencyMs: lat, ProbeKind: "http", HTTPStatus: code, Message: fmt.Sprintf("Volcengine auth failed HTTP %d", code)}, nil
	}
	count := 0
	if items, ok := data["data"].([]any); ok {
		count = len(items)
	}
	return &HealthResult{Healthy: boolPtr(true), Status: "healthy", LatencyMs: lat, ProbeKind: "http", HTTPStatus: code, Message: "connected to Volcengine Ark", ModelCount: count}, nil
}

var byteplusImageModels = map[string]string{
	"seedream-5.0-pro":             "dola-seedream-5-0-pro-260628",
	"dola-seedream-5-0-pro-260628": "dola-seedream-5-0-pro-260628",
	"seedream-5.0-flash":           "seedream-5-0-lite-260128",
	"seedream-5.0-lite":            "seedream-5-0-lite-260128",
	"seedream-5-0-lite-260128":     "seedream-5-0-lite-260128",
	"seedream-5.0":                 "dola-seedream-5-0-pro-260628",
	"seedream-5.0-edit":            "seededit-3-0-i2i-250628",
	"seededit-3-0-i2i-250628":      "seededit-3-0-i2i-250628",
	"seedream-4.5":                 "seedream-4-5-251128",
	"seedream-4-5-251128":          "seedream-4-5-251128",
	"seedream-4.0":                 "seedream-4-0-250828",
	"seedream-4-0-250828":          "seedream-4-0-250828",
}

var byteplusVideoModels = map[string]string{
	"seedance-2.5":                      "dreamina-seedance-2-5-260628",
	"seedance-2.5-image-to-video":       "dreamina-seedance-2-5-260628",
	"dreamina-seedance-2-5-260628":      "dreamina-seedance-2-5-260628",
	"seedance-2.0":                      "dreamina-seedance-2-0-260128",
	"dreamina-seedance-2-0-260128":      "dreamina-seedance-2-0-260128",
	"seedance-2.0-fast":                 "dreamina-seedance-2-0-fast-260128",
	"dreamina-seedance-2-0-fast-260128": "dreamina-seedance-2-0-fast-260128",
	"seedance-2.0-mini":                 "dreamina-seedance-2-0-mini-260615",
	"dreamina-seedance-2-0-mini-260615": "dreamina-seedance-2-0-mini-260615",
}

type BytePlusAdapter struct {
	BaseClient
}

func NewBytePlusAdapter(baseURL, apiKey string, cfg map[string]any, allowedPrivateHosts []string) *BytePlusAdapter {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = "https://ark.ap-southeast.bytepluses.com/api/v3"
	}
	return &BytePlusAdapter{BaseClient: NewBaseClient("byteplus", baseURL, apiKey, cfg, allowedPrivateHosts)}
}

func resolveBytePlusModel(providerModelID, category string) string {
	raw := strings.TrimSpace(providerModelID)
	lower := strings.ToLower(raw)
	if category == "video" {
		if m, ok := byteplusVideoModels[lower]; ok {
			return m
		}
		return raw
	}
	if m, ok := byteplusImageModels[lower]; ok {
		return m
	}
	return raw
}

func (a *BytePlusAdapter) CreateTask(ctx context.Context, req TaskRequest) (*TaskResult, error) {
	if a.apiKey == "" {
		return nil, NormalizeError("byteplus", fmt.Errorf("BytePlus ModelArk API key missing"), http.StatusUnauthorized, nil)
	}
	cat := strVal(req.Parameters, "category")
	if cat == "" && strings.Contains(strings.ToLower(req.ProviderModelID), "seedance") {
		cat = "video"
	}
	if cat == "" {
		cat = "image"
	}
	model := resolveBytePlusModel(req.ProviderModelID, cat)
	fallback := "/images/generations"
	if cat == "video" {
		fallback = "/contents/generations/tasks"
	}
	targetURL, err := a.ResolveEndpoint(req.ProviderEndpoint, fallback)
	if err != nil {
		return nil, err
	}

	watermark := false
	if wm, ok := boolVal(req.Parameters, "watermark"); ok {
		watermark = wm
	}
	var body map[string]any
	if cat == "video" {
		content := []map[string]any{{"type": "text", "text": req.Prompt}}
		if img := strVal(req.Parameters, "image_url", "imageUrl", "first_frame_image"); img != "" {
			content = append(content, map[string]any{"type": "image_url", "image_url": map[string]any{"url": img}, "role": "reference_image"})
		}
		if vid := strVal(req.Parameters, "video_url", "videoUrl"); vid != "" {
			content = append(content, map[string]any{"type": "video_url", "video_url": map[string]any{"url": vid}, "role": "reference_video"})
		}
		genAudio := true
		if ga, ok := boolVal(req.Parameters, "generate_audio"); ok {
			genAudio = ga
		}
		body = map[string]any{"model": model, "content": content, "generate_audio": genAudio, "watermark": watermark}
		if r := strVal(req.Parameters, "resolution"); r != "" {
			body["resolution"] = r
		}
		if r := strVal(req.Parameters, "ratio"); r != "" {
			body["ratio"] = r
		}
		if d, ok := toFloat(req.Parameters["duration"]); ok && d > 0 {
			body["duration"] = d
		}
	} else {
		body = map[string]any{
			"model":           model,
			"prompt":          req.Prompt,
			"size":            normalizeArkSize(strVal(req.Parameters, "size", "resolution")),
			"response_format": "url",
			"watermark":       watermark,
		}
		if img := strVal(req.Parameters, "image_url", "imageUrl"); img != "" {
			body["image"] = img
		}
	}

	code, _, _, data, err := a.doJSON(ctx, http.MethodPost, targetURL, map[string]string{
		"Content-Type":  "application/json",
		"Authorization": "Bearer " + a.apiKey,
	}, body)
	if err != nil {
		return nil, NormalizeError("byteplus", err, code, data)
	}
	resultURL := strVal(nestedMap(data, "content"), "video_url")
	itemID := ""
	if items, ok := data["data"].([]any); ok && len(items) > 0 {
		if first, ok := items[0].(map[string]any); ok {
			if resultURL == "" {
				resultURL = strVal(first, "url")
			}
			itemID = strVal(first, "id")
		}
	}
	taskID := firstNonEmpty(strVal(data, "id", "task_id"), itemID)
	if code < 200 || code >= 300 || (resultURL == "" && taskID == "") {
		msg := ExtractErrorText(data, 0)
		if msg == "" {
			msg = fmt.Sprintf("BytePlus submission failed HTTP %d", code)
		}
		return nil, NormalizeError("byteplus", fmt.Errorf("%s", msg), code, data)
	}
	status := "processing"
	if resultURL != "" {
		status = "succeeded"
	}
	return &TaskResult{
		ProviderRequestID: taskID,
		Status:            status,
		ResultURL:         resultURL,
		Metadata:          map[string]any{"model": model, "category": cat, "requestedModel": req.ProviderModelID, "response": data},
	}, nil
}

func (a *BytePlusAdapter) GetTask(ctx context.Context, providerTaskID string, _ TaskRequest) (*TaskResult, error) {
	if a.apiKey == "" {
		return nil, NormalizeError("byteplus", fmt.Errorf("BytePlus ModelArk API key missing"), http.StatusUnauthorized, nil)
	}
	targetURL, err := a.ResolveEndpoint("/contents/generations/tasks/"+url.PathEscape(providerTaskID), "")
	if err != nil {
		return nil, err
	}
	code, _, _, data, err := a.doJSON(ctx, http.MethodGet, targetURL, map[string]string{"Authorization": "Bearer " + a.apiKey}, nil)
	if err != nil {
		return nil, NormalizeError("byteplus", err, code, data)
	}
	if code < 200 || code >= 300 {
		return nil, NormalizeError("byteplus", fmt.Errorf("BytePlus poll failed HTTP %d", code), code, data)
	}
	status := NormalizeStatus(strVal(data, "status"))
	resultURL := strVal(nestedMap(data, "content"), "video_url")
	if resultURL == "" {
		if items, ok := data["data"].([]any); ok && len(items) > 0 {
			if first, ok := items[0].(map[string]any); ok {
				resultURL = strVal(first, "url")
			}
		}
	}
	progress := 0
	if status == "succeeded" {
		progress = 100
	} else if status == "processing" {
		progress = 50
	}
	return &TaskResult{
		ProviderRequestID: providerTaskID,
		Status:            status,
		ResultURL:         resultURL,
		Progress:          progress,
		Error:             ExtractErrorText(data, 0),
		TerminalFailure:   status == "failed" || status == "cancelled",
		Metadata:          data,
	}, nil
}

func (a *BytePlusAdapter) HealthCheck(ctx context.Context) (*HealthResult, error) {
	start := time.Now()
	if a.apiKey == "" {
		return &HealthResult{Healthy: boolPtr(false), Status: "unhealthy", ProbeKind: "credential", Message: "missing BYTEPLUS_API_KEY"}, nil
	}
	probeCtx, cancel := context.WithTimeout(ctx, 6*time.Second)
	defer cancel()
	targetURL, err := a.ResolveEndpoint("/models", "")
	if err != nil {
		return &HealthResult{Healthy: boolPtr(false), Status: "unhealthy", LatencyMs: time.Since(start).Milliseconds(), ProbeKind: "http", Message: err.Error()}, nil
	}
	code, _, _, data, err := a.doJSON(probeCtx, http.MethodGet, targetURL, map[string]string{"Authorization": "Bearer " + a.apiKey}, nil)
	lat := time.Since(start).Milliseconds()
	if err != nil {
		return &HealthResult{Healthy: boolPtr(false), Status: "unhealthy", LatencyMs: lat, ProbeKind: "http", Message: err.Error()}, nil
	}
	if code < 200 || code >= 300 {
		return &HealthResult{Healthy: boolPtr(false), Status: "unhealthy", LatencyMs: lat, ProbeKind: "http", HTTPStatus: code, Message: fmt.Sprintf("BytePlus auth failed HTTP %d", code)}, nil
	}
	count := 0
	if items, ok := data["data"].([]any); ok {
		count = len(items)
	}
	return &HealthResult{Healthy: boolPtr(true), Status: "healthy", LatencyMs: lat, ProbeKind: "http", HTTPStatus: code, Message: "connected to BytePlus ModelArk", ModelCount: count}, nil
}

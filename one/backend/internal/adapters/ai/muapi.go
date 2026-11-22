package ai

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type muapiContract struct {
	ids               []string
	name              string
	aspectRatios      []string
	resolutions       []string
	qualities         []string
	taskTypes         []string
	unsupportedFields []string
}

var muapiContracts = []muapiContract{
	{
		ids:          []string{"bytedance-seedream-v3"},
		name:         "Seedream 3",
		aspectRatios: []string{"1:1", "16:9", "9:16", "3:4", "4:3"},
		taskTypes:    []string{"t2i", "text_to_image", "text-to-image"},
	},
	{
		ids:          []string{"gpt-image-2", "gpt-image-2-text-to-image"},
		name:         "GPT Image 2",
		aspectRatios: []string{"auto", "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "5:4", "4:5"},
		resolutions:  []string{"1k", "2k", "4k"},
		qualities:    []string{"low", "medium", "high"},
		taskTypes:    []string{"t2i", "text_to_image", "text-to-image"},
	},
	{
		ids:          []string{"nano-banana-pro"},
		name:         "Nano Banana Pro",
		aspectRatios: []string{"1:1", "3:4", "4:3", "9:16", "16:9", "3:2", "2:3", "5:4", "4:5", "21:9"},
		resolutions:  []string{"1k", "2k", "4k"},
		taskTypes:    []string{"t2i", "text_to_image", "text-to-image"},
	},
	{
		ids:          []string{"bytedance-seedream-v5.0", "seedream-5.0"},
		name:         "Seedream 5.0 Lite",
		aspectRatios: []string{"1:1", "16:9", "9:16", "4:3", "3:4", "2:3", "3:2", "21:9"},
		qualities:    []string{"basic", "high"},
		taskTypes:    []string{"t2i", "text_to_image", "text-to-image"},
	},
	{
		ids:               []string{"hunyuan-fast-text-to-video"},
		name:              "HunyuanVideo Fast",
		aspectRatios:      []string{"16:9", "9:16", "1:1"},
		taskTypes:         []string{"t2v", "text_to_video", "text-to-video"},
		unsupportedFields: []string{"duration", "video_duration", "output_duration", "input_duration", "resolution", "size", "output_resolution", "quality", "quality_mode", "seed", "negative_prompt", "negativePrompt", "watermark"},
	},
}

var muapiContractIndex = func() map[string]muapiContract {
	m := make(map[string]muapiContract)
	for _, c := range muapiContracts {
		for _, id := range c.ids {
			m[strings.ToLower(id)] = c
		}
	}
	return m
}()

var (
	muapiCountKeys = []string{"n", "count", "num_images", "numImages", "batch_size", "batchSize", "output_count"}
	muapiRefKeys   = []string{
		"image", "image_url", "image_urls", "reference_image", "reference_images", "input_image",
		"image_base64", "init_image", "source_image", "images", "video", "video_url", "input_video",
		"source_video", "audio", "audio_url", "input_audio", "source_audio",
	}
)

func hasNonEmptyParam(v any) bool {
	if v == nil {
		return false
	}
	switch val := v.(type) {
	case string:
		return strings.TrimSpace(val) != ""
	case []any:
		return len(val) > 0
	case []string:
		return len(val) > 0
	default:
		return true
	}
}

func normalizeMuapiTask(raw string) string {
	t := strings.ToLower(strings.TrimSpace(raw))
	t = strings.NewReplacer(" ", "_", "-", "_").Replace(t)
	switch t {
	case "t2i", "text_to_image":
		return "t2i"
	case "t2v", "text_to_video":
		return "t2v"
	default:
		return t
	}
}

// BuildMuapiRequestPayload enforces strict payload contracts for validated MuAPI models.
func BuildMuapiRequestPayload(providerModelID, prompt string, parameters map[string]any) (map[string]any, error) {
	if parameters == nil {
		parameters = map[string]any{}
	}
	contract, hasContract := muapiContractIndex[strings.ToLower(strings.TrimSpace(providerModelID))]
	if !hasContract {
		out := make(map[string]any, len(parameters)+1)
		for k, v := range parameters {
			out[k] = v
		}
		out["prompt"] = prompt
		return out, nil
	}

	for _, k := range muapiCountKeys {
		if hasNonEmptyParam(parameters[k]) {
			if f, ok := toFloat(parameters[k]); !ok || f != 1 {
				return nil, &ProviderError{Code: ErrCodeInvalidInput, Provider: "muapi", Message: "MuAPI only supports count=1 per request"}
			}
		}
	}
	for _, k := range muapiRefKeys {
		if hasNonEmptyParam(parameters[k]) {
			return nil, &ProviderError{Code: ErrCodeInvalidInput, Provider: "muapi", Message: contract.name + " does not accept media reference inputs"}
		}
	}
	if f, ok := toFloat(parameters["reference_image_count"]); ok && f > 0 {
		return nil, &ProviderError{Code: ErrCodeInvalidInput, Provider: "muapi", Message: contract.name + " does not accept media reference inputs"}
	}
	for _, k := range contract.unsupportedFields {
		if hasNonEmptyParam(parameters[k]) {
			return nil, &ProviderError{Code: ErrCodeInvalidInput, Provider: "muapi", Message: fmt.Sprintf("%s does not support %s", contract.name, k)}
		}
	}
	if task := normalizeMuapiTask(strVal(parameters, "task_type", "taskType", "generation_mode")); task != "" {
		matched := false
		for _, allowed := range contract.taskTypes {
			if normalizeMuapiTask(allowed) == task {
				matched = true
				break
			}
		}
		if !matched {
			return nil, &ProviderError{Code: ErrCodeInvalidInput, Provider: "muapi", Message: contract.name + " does not support task type " + task}
		}
	}
	resolvedPrompt := prompt
	if resolvedPrompt == "" {
		resolvedPrompt = strVal(parameters, "prompt")
	}
	if strings.TrimSpace(resolvedPrompt) == "" {
		return nil, &ProviderError{Code: ErrCodeInvalidInput, Provider: "muapi", Message: contract.name + " requires prompt"}
	}
	payload := map[string]any{"prompt": resolvedPrompt}
	if err := applyContractChoice(contract.name, parameters, []string{"aspect_ratio", "aspectRatio"}, contract.aspectRatios, "aspect_ratio", payload); err != nil {
		return nil, err
	}
	if err := applyContractChoice(contract.name, parameters, []string{"resolution", "size", "output_resolution"}, contract.resolutions, "resolution", payload); err != nil {
		return nil, err
	}
	if err := applyContractChoice(contract.name, parameters, []string{"quality", "quality_mode"}, contract.qualities, "quality", payload); err != nil {
		return nil, err
	}
	return payload, nil
}

func applyContractChoice(name string, parameters map[string]any, keys, allowed []string, outKey string, payload map[string]any) error {
	var vals []string
	for _, k := range keys {
		if hasNonEmptyParam(parameters[k]) {
			vals = append(vals, strings.TrimSpace(fmt.Sprint(parameters[k])))
		}
	}
	if len(vals) == 0 {
		return nil
	}
	if len(allowed) == 0 {
		return &ProviderError{Code: ErrCodeInvalidInput, Provider: "muapi", Message: fmt.Sprintf("%s does not support %s", name, outKey)}
	}
	var canonicals []string
	for _, v := range vals {
		matched := ""
		for _, a := range allowed {
			if strings.EqualFold(a, v) {
				matched = a
				break
			}
		}
		if matched == "" {
			return &ProviderError{Code: ErrCodeInvalidInput, Provider: "muapi", Message: fmt.Sprintf("%s=%s is not supported by %s", outKey, v, name)}
		}
		canonicals = append(canonicals, matched)
	}
	for _, c := range canonicals[1:] {
		if c != canonicals[0] {
			return &ProviderError{Code: ErrCodeInvalidInput, Provider: "muapi", Message: outKey + " aliases specify conflicting values"}
		}
	}
	payload[outKey] = canonicals[0]
	return nil
}

type MuAPIAdapter struct {
	BaseClient
}

func NewMuAPIAdapter(baseURL, apiKey string, cfg map[string]any, allowedPrivateHosts []string) *MuAPIAdapter {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = "https://api.muapi.ai"
	}
	return &MuAPIAdapter{BaseClient: NewBaseClient("muapi", baseURL, apiKey, cfg, allowedPrivateHosts)}
}

func (a *MuAPIAdapter) CreateTask(ctx context.Context, req TaskRequest) (*TaskResult, error) {
	if a.apiKey == "" {
		return nil, NormalizeError("muapi", fmt.Errorf("MuAPI key not configured"), http.StatusUnauthorized, nil)
	}
	payload, err := BuildMuapiRequestPayload(req.ProviderModelID, req.Prompt, req.Parameters)
	if err != nil {
		return nil, NormalizeError("muapi", err, 400, nil)
	}
	fallback := "/api/v1/" + firstNonEmpty(req.ProviderModelID, "flux-schnell")
	targetURL, err := a.ResolveEndpoint(req.ProviderEndpoint, fallback)
	if err != nil {
		return nil, err
	}
	headers := map[string]string{"Content-Type": "application/json", "x-api-key": a.apiKey}
	if req.IdempotencyKey != "" {
		headers["Idempotency-Key"] = req.IdempotencyKey
	}
	statusCode, respHeaders, _, data, err := a.doJSON(ctx, http.MethodPost, targetURL, headers, payload)
	if err != nil {
		return nil, NormalizeError("muapi", err, statusCode, data)
	}
	if statusCode < 200 || statusCode >= 300 {
		msg := ExtractErrorText(data, 0)
		if msg == "" {
			msg = fmt.Sprintf("MuAPI submission failed HTTP %d", statusCode)
		}
		return nil, NormalizeError("muapi", fmt.Errorf("%s", msg), statusCode, data)
	}

	reqID := strVal(data, "request_id", "id")
	resultURL := firstNonEmpty(firstStringInSlice(data["outputs"]), strVal(data, "url"), strVal(nestedMap(data, "output"), "url"))
	status := "processing"
	if resultURL != "" {
		status = "succeeded"
	}
	return &TaskResult{
		ProviderRequestID: reqID,
		Status:            status,
		ResultURL:         resultURL,
		ActualCostUSD:     reportedCostUSD(data, respHeaders, "X-MuAPI-Cost-USD"),
		Metadata:          data,
	}, nil
}

func (a *MuAPIAdapter) GetTask(ctx context.Context, providerTaskID string, _ TaskRequest) (*TaskResult, error) {
	if a.apiKey == "" {
		return nil, NormalizeError("muapi", fmt.Errorf("MuAPI key not configured"), http.StatusUnauthorized, nil)
	}
	pollURL, err := a.ResolveEndpoint("/api/v1/predictions/"+providerTaskID+"/result", "")
	if err != nil {
		return nil, err
	}
	statusCode, respHeaders, _, data, err := a.doJSON(ctx, http.MethodGet, pollURL, map[string]string{
		"Content-Type": "application/json",
		"x-api-key":    a.apiKey,
	}, nil)
	if err != nil {
		return nil, NormalizeError("muapi", err, statusCode, data)
	}
	if statusCode < 200 || statusCode >= 300 {
		return nil, NormalizeError("muapi", fmt.Errorf("MuAPI poll failed HTTP %d", statusCode), statusCode, data)
	}
	status := NormalizeStatus(strVal(data, "status"))
	resultURL := firstNonEmpty(firstStringInSlice(data["outputs"]), strVal(data, "url"), strVal(nestedMap(data, "output"), "url"))
	progress := 50
	if p, ok := toFloat(data["progress"]); ok && p > 0 {
		progress = int(p)
	} else if status == "succeeded" {
		progress = 100
	}
	return &TaskResult{
		ProviderRequestID: providerTaskID,
		Status:            status,
		ResultURL:         resultURL,
		Progress:          progress,
		Error:             ExtractErrorText(data, 0),
		TerminalFailure:   status == "failed" || status == "cancelled",
		ActualCostUSD:     reportedCostUSD(data, respHeaders, "X-MuAPI-Cost-USD"),
		Metadata:          data,
	}, nil
}

func (a *MuAPIAdapter) HealthCheck(ctx context.Context) (*HealthResult, error) {
	start := time.Now()
	if a.apiKey == "" {
		return &HealthResult{Healthy: boolPtr(false), Status: "unhealthy", LatencyMs: 0, ProbeKind: "credential", Message: "missing MUAPI_API_KEY"}, nil
	}
	probeCtx, cancel := context.WithTimeout(ctx, 6*time.Second)
	defer cancel()
	targetURL, err := a.ResolveEndpoint("/api/v1/models", "")
	if err != nil {
		return &HealthResult{Healthy: boolPtr(false), Status: "unhealthy", LatencyMs: time.Since(start).Milliseconds(), ProbeKind: "http", Message: err.Error()}, nil
	}
	code, _, _, _, err := a.doJSON(probeCtx, http.MethodGet, targetURL, map[string]string{"x-api-key": a.apiKey}, nil)
	lat := time.Since(start).Milliseconds()
	if err != nil {
		return &HealthResult{Healthy: boolPtr(false), Status: "unhealthy", LatencyMs: lat, ProbeKind: "http", Message: err.Error()}, nil
	}
	ok := code >= 200 && code < 300
	status := "healthy"
	msg := "OK"
	if !ok {
		status = "unhealthy"
		msg = fmt.Sprintf("HTTP %d", code)
	}
	return &HealthResult{Healthy: boolPtr(ok), Status: status, LatencyMs: lat, ProbeKind: "http", HTTPStatus: code, Message: msg}, nil
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if t := strings.TrimSpace(v); t != "" {
			return t
		}
	}
	return ""
}

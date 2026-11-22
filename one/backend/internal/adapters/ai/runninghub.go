package ai

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"
)

var runningHubErrorMap = map[string]ProviderErrorCode{
	"301": ErrCodeInvalidInput, "PARAMS_INVALID": ErrCodeInvalidInput, "433": ErrCodeInvalidInput,
	"VALIDATE_PROMPT_FAILED": ErrCodeInvalidInput, "803": ErrCodeInvalidInput, "APIKEY_INVALID_NODE_INFO": ErrCodeInvalidInput,
	"809": ErrCodeInvalidInput, "APIKEY_FILE_SIZE_EXCEEDED": ErrCodeInvalidInput,
	"1001": ErrCodeInvalidInput, "1007": ErrCodeInvalidInput, "1008": ErrCodeInvalidInput, "1009": ErrCodeInvalidInput, "1013": ErrCodeInvalidInput, "1101": ErrCodeInvalidInput,

	"380": ErrCodeModelUnavailable, "WORKFLOW_NOT_EXISTS": ErrCodeModelUnavailable, "435": ErrCodeModelUnavailable,
	"TASK_USER_EXCLAPI_INSTANCE_NOT_FOUND": ErrCodeModelUnavailable, "436": ErrCodeModelUnavailable, "TASK_USER_EXCLAPI_REQUIRED": ErrCodeModelUnavailable,
	"810": ErrCodeModelUnavailable, "WORKFLOW_NOT_SAVED_OR_NOT_RUNNING": ErrCodeModelUnavailable, "901": ErrCodeModelUnavailable, "WEBAPP_NOT_EXISTS": ErrCodeModelUnavailable,

	"412": ErrCodeAuth, "TOKEN_INVALID": ErrCodeAuth, "801": ErrCodeAuth, "APIKEY_UNSUPPORTED_FREE_USER": ErrCodeAuth,
	"802": ErrCodeAuth, "APIKEY_UNAUTHORIZED": ErrCodeAuth, "806": ErrCodeAuth, "APIKEY_USER_NOT_FOUND": ErrCodeAuth,
	"811": ErrCodeAuth, "CORPAPIKEY_INVALID": ErrCodeAuth, "1002": ErrCodeAuth, "1014": ErrCodeAuth, "1602": ErrCodeAuth,

	"416": ErrCodeInsufficientProviderBalance, "TASK_CREATE_FAILED_BY_NOT_ENOUGH_WALLET": ErrCodeInsufficientProviderBalance,
	"812": ErrCodeInsufficientProviderBalance, "CORPAPIKEY_INSUFFICIENT_FUNDS": ErrCodeInsufficientProviderBalance,

	"415": ErrCodeRateLimit, "TASK_INSTANCE_MAXED": ErrCodeRateLimit, "421": ErrCodeRateLimit, "TASK_QUEUE_MAXED": ErrCodeRateLimit,
	"1003": ErrCodeRateLimit, "1011": ErrCodeRateLimit,

	"1006": ErrCodeTimeout, "1504": ErrCodeTimeout,
	"1501": ErrCodeContentPolicy, "1505": ErrCodeContentPolicy,

	"500": ErrCodeProviderInternalError, "UNKNOWN_ERROR": ErrCodeProviderInternalError, "805": ErrCodeProviderInternalError,
	"APIKEY_TASK_STATUS_ERROR": ErrCodeProviderInternalError, "808": ErrCodeProviderInternalError, "APIKEY_UPLOAD_FAILED": ErrCodeProviderInternalError,
	"1000": ErrCodeProviderInternalError, "1005": ErrCodeProviderInternalError, "1010": ErrCodeProviderInternalError, "1012": ErrCodeProviderInternalError, "1015": ErrCodeProviderInternalError,
}

var (
	rhInProgressCodes   = map[string]bool{"804": true, "APIKEY_TASK_IS_RUNNING": true, "813": true, "APIKEY_TASK_IS_QUEUED": true}
	rhTaskNotFoundCodes = map[string]bool{"423": true, "TASK_NOT_FOUNED": true, "807": true, "APIKEY_TASK_NOT_FOUND": true, "1004": true}
	rhTransientPollCode = map[ProviderErrorCode]bool{
		ErrCodeRateLimit:             true,
		ErrCodeNetworkError:          true,
		ErrCodeProviderInternalError: true,
		ErrCodeTimeout:               true,
		ErrCodeUnknown:               true,
	}
)

type RunningHubAdapter struct {
	BaseClient
}

func NewRunningHubAdapter(baseURL, apiKey string, cfg map[string]any, allowedPrivateHosts []string) *RunningHubAdapter {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = "https://www.runninghub.ai"
	}
	return &RunningHubAdapter{BaseClient: NewBaseClient("runninghub", baseURL, apiKey, cfg, allowedPrivateHosts)}
}

func rhErrorCodeKey(v any) string {
	if v == nil {
		return ""
	}
	return strings.ToUpper(strings.TrimSpace(fmt.Sprint(v)))
}

func rhResponseErrorCode(data map[string]any) string {
	for _, raw := range []any{data["errorCode"], nestedMap(data, "data")["errorCode"], data["code"]} {
		k := rhErrorCodeKey(raw)
		if k != "" && k != "0" && k != "200" {
			return k
		}
	}
	return ""
}

func rhNormalizeStatus(raw string) string {
	switch strings.ToUpper(strings.TrimSpace(raw)) {
	case "SUCCESS", "SUCCEEDED", "COMPLETED", "DONE", "FINISHED":
		return "succeeded"
	case "FAILED", "ERROR", "FAIL":
		return "failed"
	case "CANCELLED", "CANCELED":
		return "cancelled"
	case "QUEUED", "QUEUE", "PENDING", "CREATE", "CREATED", "SUBMITTED", "WAITING":
		return "submitted"
	default:
		return "processing"
	}
}

func rhExtractURLs(data map[string]any) []string {
	candidates := []any{data["results"], nestedMap(data, "data")["results"], data["outputs"], nestedMap(data, "data")["outputs"], data["data"]}
	for _, c := range candidates {
		arr, ok := c.([]any)
		if !ok {
			continue
		}
		var urls []string
		for _, item := range arr {
			switch v := item.(type) {
			case string:
				t := strings.TrimSpace(v)
				if strings.HasPrefix(t, "http://") || strings.HasPrefix(t, "https://") {
					urls = append(urls, t)
				}
			case map[string]any:
				u := strVal(v, "url", "fileUrl", "file_url", "download_url")
				if strings.HasPrefix(u, "http://") || strings.HasPrefix(u, "https://") {
					urls = append(urls, u)
				}
			}
		}
		if len(urls) > 0 {
			return urls
		}
	}
	var fallback []string
	collectURLsRecursive(data, &fallback, 0)
	return fallback
}

func collectURLsRecursive(v any, out *[]string, depth int) {
	if v == nil || depth > 5 {
		return
	}
	switch val := v.(type) {
	case string:
		t := strings.TrimSpace(val)
		if strings.HasPrefix(t, "http://") || strings.HasPrefix(t, "https://") {
			*out = append(*out, t)
		}
	case []any:
		for _, item := range val {
			collectURLsRecursive(item, out, depth+1)
		}
	case map[string]any:
		for _, item := range val {
			collectURLsRecursive(item, out, depth+1)
		}
	}
}

var reRHNormalizeKey = regexp.MustCompile(`[^a-z0-9]+`)

func rhNormalizeKey(s string) string {
	return reRHNormalizeKey.ReplaceAllString(strings.ToLower(s), "")
}

func buildRunningHubBody(req TaskRequest) map[string]any {
	body := make(map[string]any, len(req.Parameters)+1)
	for k, v := range req.Parameters {
		body[k] = v
	}
	for src, dst := range req.ParameterMapping {
		if v, ok := req.Parameters[src]; ok && dst != "" {
			body[dst] = v
		}
	}
	if req.Prompt != "" && body["prompt"] == nil {
		body["prompt"] = req.Prompt
	}
	// Map registry schema parameters when available on endpointConfig.params.
	if paramsRaw, ok := req.EndpointConfig["params"].([]any); ok && len(paramsRaw) > 0 {
		mapped := map[string]any{}
		for _, item := range paramsRaw {
			p, ok := item.(map[string]any)
			if !ok {
				continue
			}
			fk := strVal(p, "fieldKey")
			if fk == "" {
				continue
			}
			if v, ok := req.Parameters[fk]; ok {
				mapped[fk] = v
				continue
			}
			targetNorm := rhNormalizeKey(fk)
			for sk, sv := range req.Parameters {
				if rhNormalizeKey(sk) == targetNorm {
					mapped[fk] = sv
					break
				}
			}
			if mapped[fk] == nil && req.Prompt != "" {
				pType := strings.ToUpper(strVal(p, "type"))
				label := strings.ToLower(fk + " " + strVal(p, "label"))
				if strings.Contains(label, "prompt") || strings.Contains(label, "description") || pType == "TEXT" || pType == "STRING" {
					mapped[fk] = req.Prompt
				}
			}
		}
		if len(mapped) > 0 {
			for k, v := range body {
				if mapped[k] == nil {
					mapped[k] = v
				}
			}
			body = mapped
		}
	}
	return body
}

func (a *RunningHubAdapter) authHeaders() map[string]string {
	return map[string]string{
		"Content-Type":  "application/json",
		"Authorization": "Bearer " + a.apiKey,
	}
}

func (a *RunningHubAdapter) CreateTask(ctx context.Context, req TaskRequest) (*TaskResult, error) {
	if a.apiKey == "" {
		return nil, NormalizeError("runninghub", fmt.Errorf("RunningHub API key not configured"), http.StatusUnauthorized, nil)
	}
	ep := strings.TrimLeft(strings.TrimSpace(req.ProviderEndpoint), "/")
	if !strings.HasPrefix(ep, "openapi/") {
		ep = strings.TrimLeft(strings.TrimSpace(req.ProviderModelID), "/")
	}
	if !strings.HasPrefix(ep, "openapi/") {
		return nil, &ProviderError{Code: ErrCodeInvalidInput, Provider: "runninghub", ProviderErrorCode: "1001", Message: "RunningHub channel has no valid OpenAPI path", Retryable: false}
	}
	targetURL, err := a.ResolveEndpoint("/"+ep, "/"+ep)
	if err != nil {
		return nil, err
	}
	body := buildRunningHubBody(req)
	code, _, _, data, err := a.doJSON(ctx, http.MethodPost, targetURL, a.authHeaders(), body)
	if err != nil {
		return nil, NormalizeError("runninghub", err, code, data)
	}

	taskID := firstNonEmpty(strVal(data, "taskId", "id"), strVal(nestedMap(data, "data"), "taskId", "id"))
	errCode := rhResponseErrorCode(data)
	if taskID != "" && (errCode == "" || rhInProgressCodes[errCode]) {
		status := rhNormalizeStatus(firstNonEmpty(strVal(data, "status"), strVal(nestedMap(data, "data"), "status")))
		var urls []string
		if status == "succeeded" {
			urls = rhExtractURLs(data)
		}
		resStatus := "processing"
		resURL := ""
		if len(urls) > 0 {
			resStatus = "succeeded"
			resURL = urls[0]
		}
		return &TaskResult{
			ProviderRequestID: taskID,
			Status:            resStatus,
			ResultURL:         resURL,
			ResultURLs:        urls,
			Metadata:          map[string]any{"endpoint": ep, "clientId": strVal(data, "clientId")},
		}, nil
	}

	mapped := runningHubErrorMap[errCode]
	if mapped == "" {
		if code >= 200 && code < 300 {
			mapped = ErrCodeProviderInternalError
		} else {
			mapped = ErrCodeUnknown
		}
	}
	msg := firstNonEmpty(strVal(data, "errorMessage", "msg", "message"), strVal(nestedMap(data, "data"), "errorMessage"), fmt.Sprintf("RunningHub task submission failed HTTP %d", code))
	return nil, &ProviderError{
		Code:              mapped,
		Provider:          "runninghub",
		HTTPStatus:        code,
		ProviderErrorCode: errCode,
		Message:           msg,
		Retryable:         IsRetryableCode(mapped),
	}
}

func (a *RunningHubAdapter) GetTask(ctx context.Context, providerTaskID string, _ TaskRequest) (*TaskResult, error) {
	if a.apiKey == "" {
		return nil, NormalizeError("runninghub", fmt.Errorf("RunningHub API key not configured"), http.StatusUnauthorized, nil)
	}
	targetURL, err := a.ResolveEndpoint("/openapi/v2/query", "")
	if err != nil {
		return nil, err
	}
	code, _, _, data, err := a.doJSON(ctx, http.MethodPost, targetURL, a.authHeaders(), map[string]any{"taskId": providerTaskID})
	if err != nil {
		return &TaskResult{ProviderRequestID: providerTaskID, Status: "processing", Progress: 50, Error: err.Error()}, nil
	}
	rawStatus := firstNonEmpty(strVal(data, "status"), strVal(nestedMap(data, "data"), "status"))
	errCode := rhResponseErrorCode(data)
	if rawStatus == "" && (errCode != "" || code < 200 || code >= 300) {
		mapped := runningHubErrorMap[errCode]
		if mapped == "" {
			mapped = ErrCodeUnknown
		}
		notFound := rhTaskNotFoundCodes[errCode]
		if !notFound && rhTransientPollCode[mapped] {
			return &TaskResult{ProviderRequestID: providerTaskID, Status: "processing", Progress: 50}, nil
		}
		return nil, &ProviderError{
			Code:              mapped,
			Provider:          "runninghub",
			HTTPStatus:        code,
			ProviderErrorCode: errCode,
			TaskNotFound:      notFound,
			Message:           firstNonEmpty(strVal(data, "errorMessage", "msg", "message"), fmt.Sprintf("RunningHub task query failed HTTP %d", code)),
			Retryable:         IsRetryableCode(mapped),
		}
	}

	status := rhNormalizeStatus(rawStatus)
	if status == "failed" || status == "cancelled" {
		msg := firstNonEmpty(strVal(data, "errorMessage", "msg", "message"), "RunningHub task failed")
		return &TaskResult{
			ProviderRequestID: providerTaskID,
			Status:            status,
			Error:             msg,
			TerminalFailure:   true,
			Metadata:          data,
		}, nil
	}
	urls := rhExtractURLs(data)
	resultURL := ""
	if len(urls) > 0 {
		resultURL = urls[0]
	}
	if status == "succeeded" && resultURL == "" {
		return &TaskResult{ProviderRequestID: providerTaskID, Status: "processing", Progress: 90, Metadata: data}, nil
	}
	progress := 50
	if status == "succeeded" {
		progress = 100
	} else if status == "submitted" {
		progress = 5
	}
	return &TaskResult{
		ProviderRequestID: providerTaskID,
		Status:            status,
		ResultURL:         resultURL,
		ResultURLs:        urls,
		Progress:          progress,
		Metadata:          data,
	}, nil
}

func (a *RunningHubAdapter) HealthCheck(ctx context.Context) (*HealthResult, error) {
	start := time.Now()
	if a.apiKey == "" {
		return &HealthResult{Healthy: boolPtr(false), Status: "unhealthy", ProbeKind: "credential", Message: "missing RUNNINGHUB_API_KEY"}, nil
	}
	probeCtx, cancel := context.WithTimeout(ctx, 6*time.Second)
	defer cancel()
	targetURL, err := a.ResolveEndpoint("/uc/openapi/accountStatus", "")
	if err != nil {
		return &HealthResult{Healthy: boolPtr(false), Status: "unhealthy", LatencyMs: time.Since(start).Milliseconds(), ProbeKind: "http", Message: err.Error()}, nil
	}
	code, _, _, data, err := a.doJSON(probeCtx, http.MethodPost, targetURL, a.authHeaders(), map[string]any{"apikey": a.apiKey})
	lat := time.Since(start).Milliseconds()
	if err != nil {
		return &HealthResult{Healthy: boolPtr(false), Status: "unhealthy", LatencyMs: lat, ProbeKind: "http", Message: err.Error()}, nil
	}
	errCode := rhResponseErrorCode(data)
	acct := nestedMap(data, "data")
	if code < 200 || code >= 300 || errCode != "" || acct == nil {
		return &HealthResult{
			Healthy:    boolPtr(false),
			Status:     "unhealthy",
			LatencyMs:  lat,
			ProbeKind:  "http",
			HTTPStatus: code,
			ErrorCode:  string(runningHubErrorMap[errCode]),
			Message:    firstNonEmpty(strVal(data, "msg", "message", "errorMessage"), fmt.Sprintf("HTTP %d", code)),
		}, nil
	}
	money, hasMoney := toFloat(acct["remainMoney"])
	coins, hasCoins := toFloat(acct["remainCoins"])
	balanceKnown := hasMoney || hasCoins
	empty := balanceKnown && (!hasMoney || money <= 0) && (!hasCoins || coins <= 0)
	healthy := balanceKnown && !empty
	msg := "RunningHub connected and balance readable"
	status := "healthy"
	if empty {
		msg = "RunningHub wallet balance is zero"
		status = "unhealthy"
	} else if !balanceKnown {
		msg = "RunningHub wallet balance unreadable"
		status = "unhealthy"
	}
	res := &HealthResult{
		Healthy:    boolPtr(healthy),
		Status:     status,
		LatencyMs:  lat,
		ProbeKind:  "http",
		HTTPStatus: code,
		Currency:   firstNonEmpty(strVal(acct, "currency"), "CNY"),
		Message:    msg,
	}
	if hasMoney {
		res.Balance = &money
	}
	if hasCoins {
		res.Coins = &coins
	}
	return res, nil
}

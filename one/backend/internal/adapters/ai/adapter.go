package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"one/backend/internal/outbound"
)

// ProviderErrorCode matches Supdance Pro/lib/adapters/BaseAdapter.js.
type ProviderErrorCode string

const (
	ErrCodeAuth                        ProviderErrorCode = "AUTH_ERROR"
	ErrCodeInsufficientProviderBalance ProviderErrorCode = "INSUFFICIENT_PROVIDER_BALANCE"
	ErrCodeRateLimit                   ProviderErrorCode = "RATE_LIMIT"
	ErrCodeTimeout                     ProviderErrorCode = "TIMEOUT"
	ErrCodeContentPolicy               ProviderErrorCode = "CONTENT_POLICY"
	ErrCodeInvalidInput                ProviderErrorCode = "INVALID_INPUT"
	ErrCodeModelRouteUnavailable       ProviderErrorCode = "MODEL_ROUTE_UNAVAILABLE"
	ErrCodeModelUnavailable            ProviderErrorCode = "MODEL_UNAVAILABLE"
	ErrCodeProviderInternalError       ProviderErrorCode = "PROVIDER_INTERNAL_ERROR"
	ErrCodeNetworkError                ProviderErrorCode = "NETWORK_ERROR"
	ErrCodeUnknown                     ProviderErrorCode = "UNKNOWN_ERROR"
)

// IsRetryableCode mirrors NON_RETRYABLE_ERROR_CODES in BaseAdapter.js.
func IsRetryableCode(code ProviderErrorCode) bool {
	switch code {
	case ErrCodeContentPolicy, ErrCodeInvalidInput,
		"CANVAS_ASSET_URL_UNAVAILABLE", "CANVAS_ASSET_REFERENCE_INVALID", "CANVAS_ASSET_OWNER_REQUIRED":
		return false
	default:
		return true
	}
}

// ShouldTripCircuitBreaker mirrors shouldTripProviderCircuitBreaker in BaseAdapter.js.
func ShouldTripCircuitBreaker(code ProviderErrorCode) bool {
	return code != ErrCodeModelRouteUnavailable && IsRetryableCode(code)
}

// ProviderError carries normalized upstream error metadata across submit/poll/failover.
type ProviderError struct {
	Code              ProviderErrorCode
	Provider          string
	HTTPStatus        int
	ProviderErrorCode string
	Message           string
	Retryable         bool
	TerminalFailure   bool
	TaskNotFound      bool
	ActualCostUSD     *float64
	ProviderRequestID string
}

func (e *ProviderError) Error() string {
	if e == nil {
		return ""
	}
	if e.Message != "" {
		return e.Message
	}
	return fmt.Sprintf("provider %s failed (%s)", e.Provider, e.Code)
}

// TaskRequest contains normalized inputs passed to a ProviderAdapter.
type TaskRequest struct {
	ProviderModelID  string
	ProviderEndpoint string
	Prompt           string
	Parameters       map[string]any
	EndpointConfig   map[string]any
	ParameterMapping map[string]string
	IdempotencyKey   string
}

// TaskResult contains normalized outputs from CreateTask or GetTask.
type TaskResult struct {
	ProviderRequestID      string         `json:"providerRequestId,omitempty"`
	Status                 string         `json:"status"` // submitted | processing | succeeded | failed | cancelled
	ResultURL              string         `json:"resultUrl,omitempty"`
	ResultURLs             []string       `json:"resultUrls,omitempty"`
	ResultText             string         `json:"resultText,omitempty"`
	Progress               int            `json:"progress,omitempty"`
	Error                  string         `json:"error,omitempty"`
	TerminalFailure        bool           `json:"terminalFailure,omitempty"`
	ReconciliationRequired bool           `json:"reconciliationRequired,omitempty"`
	Reason                 string         `json:"reason,omitempty"`
	ActualCostUSD          *float64       `json:"actualCostUsd,omitempty"`
	Metadata               map[string]any `json:"metadata,omitempty"`
}

// HealthResult summarizes a live or credential probe for an AI provider.
type HealthResult struct {
	Healthy           *bool    `json:"healthy"` // nil => credential configured, upstream probe unsupported
	Status            string   `json:"status"`  // healthy | degraded | unhealthy
	LatencyMs         int64    `json:"latencyMs"`
	ProbeKind         string   `json:"probeKind"` // http | credential
	Message           string   `json:"message"`
	HTTPStatus        int      `json:"httpStatus,omitempty"`
	ModelCount        int      `json:"modelCount,omitempty"`
	Balance           *float64 `json:"balance,omitempty"`
	Coins             *float64 `json:"coins,omitempty"`
	Currency          string   `json:"currency,omitempty"`
	CurrentTaskCounts *int     `json:"currentTaskCounts,omitempty"`
	ErrorCode         string   `json:"errorCode,omitempty"`
}

// ProviderAdapter executes generation submissions, polling, and health probes.
type ProviderAdapter interface {
	ProviderID() string
	CreateTask(ctx context.Context, req TaskRequest) (*TaskResult, error)
	GetTask(ctx context.Context, providerTaskID string, req TaskRequest) (*TaskResult, error)
	HealthCheck(ctx context.Context) (*HealthResult, error)
}

// BaseClient holds common HTTP and endpoint resolution helpers for adapters.
type BaseClient struct {
	provider            string
	baseURL             string
	apiKey              string
	config              map[string]any
	allowedPrivateHosts []string
	httpClient          *http.Client
}

func NewBaseClient(provider, baseURL, apiKey string, cfg map[string]any, allowedPrivateHosts []string) BaseClient {
	cleanBase := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if cfg == nil {
		cfg = map[string]any{}
	}
	return BaseClient{
		provider:            strings.ToLower(strings.TrimSpace(provider)),
		baseURL:             cleanBase,
		apiKey:              strings.TrimSpace(apiKey),
		config:              cfg,
		allowedPrivateHosts: allowedPrivateHosts,
		httpClient:          outbound.NewSafeHTTPClient(90*time.Second, allowedPrivateHosts...),
	}
}

func (b BaseClient) ProviderID() string { return b.provider }
func (b BaseClient) BaseURL() string    { return b.baseURL }
func (b BaseClient) APIKey() string     { return b.apiKey }

// ResolveEndpoint resolves providerEndpoint against baseURL, enforcing same-origin
// and rejecting credentials/fragments/foreign hosts (SSRF protection).
func (b BaseClient) ResolveEndpoint(providerEndpoint, fallbackPath string) (string, error) {
	if b.baseURL == "" {
		return "", &ProviderError{Code: ErrCodeInvalidInput, Provider: b.provider, Message: "provider base URL missing", Retryable: false}
	}
	base, err := outbound.ValidateExternalURL(b.baseURL, b.allowedPrivateHosts...)
	if err != nil {
		return "", &ProviderError{Code: ErrCodeInvalidInput, Provider: b.provider, Message: "invalid provider base URL: " + err.Error(), Retryable: false}
	}
	raw := strings.TrimSpace(providerEndpoint)
	if raw == "" {
		raw = strings.TrimSpace(fallbackPath)
	}
	if raw == "" {
		return "", &ProviderError{Code: ErrCodeInvalidInput, Provider: b.provider, Message: "provider endpoint required", Retryable: false}
	}
	baseDirURL, err := url.Parse(strings.TrimRight(b.baseURL, "/") + "/")
	if err != nil {
		return "", &ProviderError{Code: ErrCodeInvalidInput, Provider: b.provider, Message: "invalid provider base URL", Retryable: false}
	}
	rel := raw
	if strings.HasPrefix(rel, "/") {
		rel = strings.TrimLeft(rel, "/")
	}
	target, err := baseDirURL.Parse(rel)
	if err != nil {
		return "", &ProviderError{Code: ErrCodeInvalidInput, Provider: b.provider, Message: "invalid provider endpoint", Retryable: false}
	}
	if !strings.EqualFold(target.Scheme, base.Scheme) || !strings.EqualFold(target.Host, base.Host) ||
		target.User != nil || target.Fragment != "" {
		return "", &ProviderError{
			Code:      ErrCodeInvalidInput,
			Provider:  b.provider,
			Message:   "provider endpoint must stay on configured provider origin",
			Retryable: false,
		}
	}
	return target.String(), nil
}

func (b BaseClient) doJSON(ctx context.Context, method, targetURL string, headers map[string]string, body any) (int, http.Header, []byte, map[string]any, error) {
	var bodyReader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return 0, nil, nil, nil, err
		}
		bodyReader = bytes.NewReader(raw)
	}
	req, err := http.NewRequestWithContext(ctx, method, targetURL, bodyReader)
	if err != nil {
		return 0, nil, nil, nil, err
	}
	if body != nil && (headers == nil || headers["Content-Type"] == "") {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range headers {
		if v != "" {
			req.Header.Set(k, v)
		}
	}
	resp, err := outbound.SafeRequest(ctx, b.httpClient, req, b.allowedPrivateHosts...)
	if err != nil {
		return 0, nil, nil, nil, err
	}
	defer resp.Body.Close()
	rawBytes, err := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
	if err != nil {
		return resp.StatusCode, resp.Header, nil, nil, err
	}
	parsed := map[string]any{}
	if len(bytes.TrimSpace(rawBytes)) > 0 {
		_ = json.Unmarshal(rawBytes, &parsed)
	}
	return resp.StatusCode, resp.Header, rawBytes, parsed, nil
}

// NormalizeStatus maps upstream task statuses to submitted|processing|succeeded|failed|cancelled.
func NormalizeStatus(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "completed", "succeeded", "success", "done", "finished":
		return "succeeded"
	case "failed", "error", "rejected", "fail":
		return "failed"
	case "cancelled", "canceled":
		return "cancelled"
	case "processing", "in_progress", "running", "generating", "dreaming":
		return "processing"
	default:
		return "submitted"
	}
}

var errorTextKeys = []string{"message", "msg", "error_message", "errorMessage", "detail", "reason", "error", "description"}

// ExtractErrorText recursively pulls the first meaningful error string from an upstream JSON body.
func ExtractErrorText(v any, depth int) string {
	if v == nil || depth > 3 {
		return ""
	}
	switch val := v.(type) {
	case string:
		trimmed := strings.TrimSpace(val)
		if trimmed != "" && trimmed != "[object Object]" {
			return trimmed
		}
	case map[string]any:
		for _, k := range errorTextKeys {
			if sub, ok := val[k]; ok {
				if txt := ExtractErrorText(sub, depth+1); txt != "" {
					return txt
				}
			}
		}
	}
	return ""
}

var (
	reRouteUnavailable1 = regexp.MustCompile(`(?i)invalidendpointormodel\.(?:notfound|modelidaccessdisabled)|model(?:[_.]|\s)?not[_.]?found|endpoint(?:[_.]|\s)?not[_.]?found|modelnotopen|endpointnotopen`)
	reRouteUnavailable2 = regexp.MustCompile(`(?i)\b(?:model|endpoint)\b.{0,200}\b(?:does not exist|doesn't exist|not found|not exist|do not have access|does not have access|not accessible|not enabled|not activated|not allowed|access disabled|not open|not opened)\b`)
	reBalanceErr        = regexp.MustCompile(`(?i)\binsufficient (?:balance|funds|credit)|corporate funds|top up|\bquota\b|\barrears\b`)
)

// NormalizeError converts raw Go / HTTP / JSON errors into ProviderError.
func NormalizeError(provider string, err error, httpStatus int, body map[string]any) *ProviderError {
	if err != nil {
		var pe *ProviderError
		if errors.As(err, &pe) {
			if pe.Provider == "" {
				pe.Provider = provider
			}
			if pe.HTTPStatus == 0 && httpStatus > 0 {
				pe.HTTPStatus = httpStatus
			}
			pe.Retryable = IsRetryableCode(pe.Code)
			return pe
		}
	}

	msg := ExtractErrorText(body, 0)
	if msg == "" && err != nil {
		msg = strings.TrimSpace(err.Error())
	}
	if msg == "" {
		msg = fmt.Sprintf("provider HTTP %d", httpStatus)
	}
	if len(msg) > 500 {
		msg = msg[:500]
	}
	lower := strings.ToLower(msg)
	code := ErrCodeUnknown

	switch {
	case reRouteUnavailable1.MatchString(lower) || reRouteUnavailable2.MatchString(lower):
		code = ErrCodeModelRouteUnavailable
	case httpStatus == http.StatusUnauthorized || httpStatus == http.StatusForbidden ||
		strings.Contains(lower, "unauthorized") || strings.Contains(lower, "forbidden") ||
		strings.Contains(lower, "api key") || strings.Contains(lower, "auth"):
		code = ErrCodeAuth
	case httpStatus == http.StatusPaymentRequired || reBalanceErr.MatchString(lower):
		code = ErrCodeInsufficientProviderBalance
	case httpStatus == http.StatusTooManyRequests || strings.Contains(lower, "rate limit") || strings.Contains(lower, "too many requests"):
		code = ErrCodeRateLimit
	case errors.Is(err, context.DeadlineExceeded) || httpStatus == http.StatusRequestTimeout || httpStatus == http.StatusGatewayTimeout ||
		strings.Contains(lower, "timeout") || strings.Contains(lower, "timed out"):
		code = ErrCodeTimeout
	case strings.Contains(lower, "nsfw") || strings.Contains(lower, "moderation") || strings.Contains(lower, "content policy") ||
		strings.Contains(lower, "sensitive") || strings.Contains(lower, "safety") || strings.Contains(lower, "violation"):
		code = ErrCodeContentPolicy
	case httpStatus == http.StatusBadRequest || httpStatus == http.StatusUnprocessableEntity ||
		strings.Contains(lower, "invalid") || strings.Contains(lower, "parameter") || strings.Contains(lower, "resolution"):
		code = ErrCodeInvalidInput
	case httpStatus == http.StatusServiceUnavailable || strings.Contains(lower, "maintenance") ||
		strings.Contains(lower, "unavailable") || strings.Contains(lower, "overloaded"):
		code = ErrCodeModelUnavailable
	case httpStatus >= 500 && httpStatus < 600:
		code = ErrCodeProviderInternalError
	case errors.Is(err, outbound.ErrPrivateHost) || errors.Is(err, outbound.ErrInvalidURL):
		code = ErrCodeInvalidInput
	case err != nil && (strings.Contains(lower, "connection refused") || strings.Contains(lower, "no such host") ||
		strings.Contains(lower, "eof") || strings.Contains(lower, "network")):
		code = ErrCodeNetworkError
	}

	return &ProviderError{
		Code:       code,
		Provider:   provider,
		HTTPStatus: httpStatus,
		Message:    msg,
		Retryable:  IsRetryableCode(code),
	}
}

func reportedCostUSD(body map[string]any, headers http.Header, extraHeaders ...string) *float64 {
	if body != nil {
		if costMap, ok := body["cost"].(map[string]any); ok {
			if f, ok := toFloat(costMap["amount_usd"]); ok && f >= 0 {
				return &f
			}
		}
		if f, ok := toFloat(body["cost_usd"]); ok && f >= 0 {
			return &f
		}
	}
	if headers != nil {
		for _, hdr := range extraHeaders {
			if raw := strings.TrimSpace(headers.Get(hdr)); raw != "" {
				if f, err := strconv.ParseFloat(raw, 64); err == nil && f >= 0 {
					return &f
				}
			}
		}
	}
	return nil
}

func toFloat(v any) (float64, bool) {
	switch val := v.(type) {
	case float64:
		return val, true
	case float32:
		return float64(val), true
	case int:
		return float64(val), true
	case int64:
		return float64(val), true
	case json.Number:
		f, err := val.Float64()
		return f, err == nil
	case string:
		f, err := strconv.ParseFloat(strings.TrimSpace(val), 64)
		return f, err == nil
	default:
		return 0, false
	}
}

func strVal(m map[string]any, keys ...string) string {
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			if s, ok := v.(string); ok {
				if t := strings.TrimSpace(s); t != "" {
					return t
				}
			} else if n, ok := v.(float64); ok {
				return strconv.FormatInt(int64(n), 10)
			} else if n, ok := v.(int64); ok {
				return strconv.FormatInt(n, 10)
			}
		}
	}
	return ""
}

func boolVal(m map[string]any, keys ...string) (bool, bool) {
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			if b, ok := v.(bool); ok {
				return b, true
			}
		}
	}
	return false, false
}

func firstStringInSlice(v any) string {
	arr, ok := v.([]any)
	if !ok || len(arr) == 0 {
		return ""
	}
	if s, ok := arr[0].(string); ok {
		return strings.TrimSpace(s)
	}
	return ""
}

func nestedMap(m map[string]any, key string) map[string]any {
	if m == nil {
		return nil
	}
	sub, _ := m[key].(map[string]any)
	return sub
}

func boolPtr(v bool) *bool { return &v }

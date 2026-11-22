package handler

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	ai "one/backend/internal/adapters/ai"
	"one/backend/internal/agentbridge"
	"one/backend/internal/domain/canvas"
	"one/backend/internal/domain/generation"
	"one/backend/internal/middleware"
	"one/backend/internal/outbound"
	"one/backend/internal/pkg/envelope"
	"one/backend/internal/queue"
)

func init() {
	registerBatch(mountAgentRoutes)
}

func mountAgentRoutes(d *Dependencies, mount mountFunc) {
	mount("POST", "/api/agent/runs", middleware.RequireAuth(d.SessionAuth)(http.HandlerFunc(d.handleAgentRuns)))
}

type agentRunPayload struct {
	Prompt            string           `json:"prompt"`
	SystemPrompt      string           `json:"systemPrompt,omitempty"`
	ModelID           string           `json:"modelId,omitempty"`
	Provider          string           `json:"provider,omitempty"`
	SessionID         string           `json:"sessionId,omitempty"`
	RunID             string           `json:"runId,omitempty"`
	MaxTurns          int              `json:"maxTurns,omitempty"`
	ApproveApprovalID string           `json:"approveApprovalId,omitempty"`
	Tools             []map[string]any `json:"tools,omitempty"`
	Messages          []map[string]any `json:"messages,omitempty"`
}

func defaultAgentTools() []map[string]any {
	return []map[string]any{
		{"name": "canvas_list_tools", "description": "List available canvas AI editing tools, aspect ratios, resolutions, and presets."},
		{"name": "canvas_plan_tool", "description": "Build a whitelisted i2i canvas tool generation plan (requires tool, sourceAssetId, optional params)."},
		{"name": "generation_list_models", "description": "List active generation models visible to the user."},
		{"name": "generation_create_quote", "description": "Create a credit quote before running a generation task (requires modelId, optional parameters, site)."},
		{"name": "generation_create_task", "description": "Submit a billed generation task (requires quoteId, modelId; pauses for user approval unless pre-approved)."},
	}
}

func newAgentRunID() string {
	var b [8]byte
	if _, err := rand.Read(b[:]); err == nil {
		return "run_" + hex.EncodeToString(b[:])
	}
	return fmt.Sprintf("run_%d", time.Now().UnixNano())
}

func deriveBridgeEndpoints(agentURL string) (listenAddr, advertiseHost string) {
	if envHost := strings.TrimSpace(os.Getenv("ONE_AGENT_BRIDGE_HOST")); envHost != "" {
		return "0.0.0.0:0", envHost
	}
	u, err := url.Parse(strings.TrimSpace(agentURL))
	if err == nil {
		host := strings.ToLower(u.Hostname())
		if host == "127.0.0.1" || host == "localhost" || host == "::1" {
			return "127.0.0.1:0", "127.0.0.1"
		}
	}
	if hn, err := os.Hostname(); err == nil && strings.TrimSpace(hn) != "" && !strings.ContainsAny(hn, ":/\\ ") {
		return "0.0.0.0:0", strings.TrimSpace(hn)
	}
	return "0.0.0.0:0", "backend"
}

func (d *Dependencies) handleAgentRuns(w http.ResponseWriter, r *http.Request) {
	u, ok := middleware.UserFromContext(r.Context())
	if !ok || u == nil {
		envelope.DomainError(w, http.StatusUnauthorized, "Authentication required", "UNAUTHORIZED")
		return
	}
	if strings.TrimSpace(d.Config.AgentURL) == "" || len(d.Config.AgentToken) < 32 {
		envelope.DomainError(w, http.StatusServiceUnavailable, "Agent runtime service is not configured", "AGENT_NOT_CONFIGURED")
		return
	}

	var body agentRunPayload
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		envelope.DomainError(w, http.StatusBadRequest, "Invalid JSON payload", "INVALID_JSON")
		return
	}
	prompt := strings.TrimSpace(body.Prompt)
	if prompt == "" {
		envelope.DomainError(w, http.StatusBadRequest, "prompt is required", "INVALID_INPUT")
		return
	}

	runID := strings.TrimSpace(body.RunID)
	if runID == "" {
		runID = newAgentRunID()
	}
	tools := body.Tools
	if len(tools) == 0 {
		tools = defaultAgentTools()
	}
	maxTurns := body.MaxTurns
	if maxTurns <= 0 {
		maxTurns = 8
	} else if maxTurns > 16 {
		maxTurns = 16
	}
	modelID := strings.TrimSpace(body.ModelID)
	if modelID == "" {
		modelID = strings.TrimSpace(os.Getenv("ONE_AGENT_LLM_MODEL"))
	}
	if modelID == "" {
		modelID = "gpt-4o-mini"
	}
	providerID := strings.TrimSpace(body.Provider)
	if providerID == "" {
		providerID = strings.TrimSpace(os.Getenv("ONE_AGENT_LLM_PROVIDER"))
	}
	if providerID == "" {
		providerID = "openai"
	}

	listenAddr, advertiseHost := deriveBridgeEndpoints(d.Config.AgentURL)
	approvalExpected := "apr_" + runID

	res, err := agentbridge.ExecuteAgentRun(r.Context(), agentbridge.SessionRunnerOptions{
		ListenAddr:    listenAddr,
		AdvertiseHost: advertiseHost,
		AgentURL:      d.Config.AgentURL,
		AgentToken:    d.Config.AgentToken,
		SessionID:     strings.TrimSpace(body.SessionID),
		UserID:        u.ID,
		RunID:         runID,
		Prompt:        prompt,
		SystemPrompt:  strings.TrimSpace(body.SystemPrompt),
		Model:         map[string]any{"id": modelID, "provider": providerID},
		Tools:         tools,
		Messages:      body.Messages,
		MaxTurns:      maxTurns,
		Handlers: agentbridge.Handlers{
			Model: func(ctx context.Context, payload map[string]json.RawMessage) (any, error) {
				if d.AgentModelCaller != nil {
					return d.AgentModelCaller(ctx, payload)
				}
				return d.callAgentOpenAICompatibleModel(ctx, payload, modelID, providerID, tools)
			},
			Tool: func(ctx context.Context, payload map[string]json.RawMessage) (any, error) {
				return d.executeAgentToolCall(ctx, u, runID, approvalExpected, body.ApproveApprovalID, payload)
			},
			Event: func(ctx context.Context, payload map[string]json.RawMessage) (any, error) {
				d.publishAgentBridgeEvent(ctx, u.ID, runID, payload)
				return map[string]any{"ok": true}, nil
			},
		},
	})
	if err != nil {
		var dispErr *agentbridge.AgentDispatchError
		if errors.As(err, &dispErr) && dispErr.StatusCode == http.StatusTooManyRequests {
			envelope.DomainError(w, http.StatusTooManyRequests, "Agent runtime is at capacity", "AGENT_BUSY")
			return
		}
		envelope.DomainError(w, http.StatusBadGateway, fmt.Sprintf("Agent execution failed: %v", err), "AGENT_RUN_FAILED")
		return
	}

	envelope.DomainJSON(w, http.StatusOK, map[string]any{
		"runId":  runID,
		"result": res,
	})
}

func (d *Dependencies) publishAgentBridgeEvent(ctx context.Context, userID, fallbackRunID string, payload map[string]json.RawMessage) {
	if d.Events == nil {
		return
	}
	var evType, runID string
	if raw, ok := payload["type"]; ok {
		_ = json.Unmarshal(raw, &evType)
	}
	if raw, ok := payload["runId"]; ok {
		_ = json.Unmarshal(raw, &runID)
	}
	if runID == "" {
		runID = fallbackRunID
	}
	status := evType
	progress := 0
	switch evType {
	case "run.started":
		progress = 10
	case "tool.called":
		progress = 50
	case "run.paused":
		progress = 75
	case "run.completed":
		progress = 100
	case "run.failed":
		progress = 100
	}
	ev := queue.GenerationEvent{
		Type:      "agent." + evType,
		UserID:    userID,
		TaskID:    runID,
		Status:    status,
		Progress:  progress,
		Timestamp: time.Now().UnixMilli(),
	}
	if d.Pool != nil {
		_ = d.Events.PublishPG(ctx, d.Pool, ev)
		return
	}
	d.Events.PublishLocal(ev)
}

func (d *Dependencies) executeAgentToolCall(ctx context.Context, u *middleware.SessionUser, runID, approvalExpected, approvedID string, payload map[string]json.RawMessage) (any, error) {
	var toolName string
	if raw, ok := payload["tool"]; ok {
		_ = json.Unmarshal(raw, &toolName)
	}
	args := map[string]any{}
	if raw, ok := payload["args"]; ok && len(raw) > 0 {
		_ = json.Unmarshal(raw, &args)
	}
	toolName = strings.TrimSpace(toolName)

	switch toolName {
	case "canvas_list_tools":
		modelID, _ := args["modelId"].(string)
		modelName, _ := args["modelName"].(string)
		return canvas.BuildToolSpec(modelID, modelName, "", 0, nil), nil

	case "canvas_plan_tool":
		toolID, _ := args["tool"].(string)
		sourceAssetID, _ := args["sourceAssetId"].(string)
		params, _ := args["params"].(map[string]any)
		plan, err := canvas.BuildToolPlan(toolID, params, sourceAssetID)
		if err != nil {
			return nil, err
		}
		return plan, nil

	case "generation_list_models":
		if d.Generation == nil {
			return nil, errors.New("generation service is unavailable")
		}
		schemaVer, _ := args["schemaVersion"].(string)
		return d.Generation.GetActiveModels(ctx, schemaVer, u.ID)

	case "generation_create_quote":
		if d.Generation == nil {
			return nil, errors.New("generation service is unavailable")
		}
		modelID, _ := args["modelId"].(string)
		siteName, _ := args["site"].(string)
		if siteName == "" {
			siteName = "studio"
		}
		idem, _ := args["idempotencyKey"].(string)
		params, _ := args["parameters"].(map[string]any)
		return d.Generation.CreateQuote(ctx, generation.QuoteRequest{
			UserID:            u.ID,
			ModelID:           strings.TrimSpace(modelID),
			Site:              siteName,
			Parameters:        params,
			IdempotencyKey:    idem,
			SubscriptionLevel: u.PlanID,
		})

	case "generation_create_task":
		if strings.TrimSpace(approvedID) == "" || strings.TrimSpace(approvedID) != approvalExpected {
			return map[string]any{
				"pause":      true,
				"reason":     "awaiting_approval",
				"approvalId": approvalExpected,
			}, nil
		}
		if d.Generation == nil {
			return nil, errors.New("generation service is unavailable")
		}
		quoteID, _ := args["quoteId"].(string)
		modelID, _ := args["modelId"].(string)
		studioID, _ := args["studioId"].(string)
		label, _ := args["label"].(string)
		idem, _ := args["idempotencyKey"].(string)
		params, _ := args["parameters"].(map[string]any)
		return d.Generation.CreateTask(ctx, generation.CreateTaskRequest{
			UserID:         u.ID,
			StudioID:       studioID,
			QuoteID:        strings.TrimSpace(quoteID),
			ModelID:        strings.TrimSpace(modelID),
			Label:          strings.TrimSpace(label),
			Parameters:     params,
			IdempotencyKey: idem,
		})

	default:
		return nil, fmt.Errorf("unsupported agent tool: %q", toolName)
	}
}

func (d *Dependencies) callAgentOpenAICompatibleModel(ctx context.Context, payload map[string]json.RawMessage, modelID, providerID string, tools []map[string]any) (any, error) {
	apiKey := strings.TrimSpace(os.Getenv("ONE_AGENT_LLM_API_KEY"))
	if apiKey == "" {
		cred := ai.ResolveCredentials(ctx, d.Pool, d.Config, providerID)
		apiKey = strings.TrimSpace(cred.Value)
	}
	if apiKey == "" {
		return nil, fmt.Errorf("LLM provider %q API key is not configured", providerID)
	}

	baseURL := strings.TrimSpace(os.Getenv("ONE_AGENT_LLM_BASE_URL"))
	if baseURL == "" {
		switch strings.ToLower(providerID) {
		case "deepseek":
			baseURL = "https://api.deepseek.com/v1"
		default:
			baseURL = "https://api.openai.com/v1"
		}
	}
	endpoint := strings.TrimRight(baseURL, "/") + "/chat/completions"
	if _, err := outbound.ValidateExternalURL(endpoint, d.Config.AllowedPrivateHosts...); err != nil {
		return nil, fmt.Errorf("invalid LLM upstream URL: %w", err)
	}

	var systemPrompt string
	if raw, ok := payload["systemPrompt"]; ok {
		_ = json.Unmarshal(raw, &systemPrompt)
	}
	var rawMessages []map[string]any
	if raw, ok := payload["messages"]; ok {
		_ = json.Unmarshal(raw, &rawMessages)
	}
	openAIMessages := make([]map[string]any, 0, len(rawMessages)+1)
	if systemPrompt != "" {
		openAIMessages = append(openAIMessages, map[string]any{"role": "system", "content": systemPrompt})
	}
	for _, m := range rawMessages {
		role, _ := m["role"].(string)
		if role == "tool" {
			openAIMessages = append(openAIMessages, map[string]any{
				"role":         "tool",
				"tool_call_id": m["toolCallId"],
				"content":      m["content"],
			})
			continue
		}
		entry := map[string]any{"role": role, "content": m["content"]}
		if tcs, ok := m["toolCalls"].([]any); ok && len(tcs) > 0 {
			formatted := make([]map[string]any, 0, len(tcs))
			for _, tcRaw := range tcs {
				tc, _ := tcRaw.(map[string]any)
				argsBytes, _ := json.Marshal(tc["args"])
				formatted = append(formatted, map[string]any{
					"id":   tc["id"],
					"type": "function",
					"function": map[string]any{
						"name":      tc["tool"],
						"arguments": string(argsBytes),
					},
				})
			}
			entry["tool_calls"] = formatted
		}
		openAIMessages = append(openAIMessages, entry)
	}

	openAITools := make([]map[string]any, 0, len(tools))
	for _, t := range tools {
		name, _ := t["name"].(string)
		desc, _ := t["description"].(string)
		params, ok := t["parameters"].(map[string]any)
		if !ok {
			params = map[string]any{"type": "object", "properties": map[string]any{}}
		}
		openAITools = append(openAITools, map[string]any{
			"type": "function",
			"function": map[string]any{
				"name":        name,
				"description": desc,
				"parameters":  params,
			},
		})
	}

	reqBody := map[string]any{
		"model":    modelID,
		"messages": openAIMessages,
	}
	if len(openAITools) > 0 {
		reqBody["tools"] = openAITools
	}
	rawReq, _ := json.Marshal(reqBody)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(rawReq))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)

	client := outbound.NewSafeHTTPClient(60*time.Second, d.Config.AllowedPrivateHosts...)
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respRaw, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("LLM upstream HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(respRaw)))
	}

	var parsed struct {
		Choices []struct {
			Message struct {
				Content   string `json:"content"`
				ToolCalls []struct {
					ID       string `json:"id"`
					Function struct {
						Name      string `json:"name"`
						Arguments string `json:"arguments"`
					} `json:"function"`
				} `json:"tool_calls"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(respRaw, &parsed); err != nil {
		return nil, fmt.Errorf("decode LLM response: %w", err)
	}
	if len(parsed.Choices) == 0 {
		return nil, errors.New("LLM returned empty choices")
	}

	msg := parsed.Choices[0].Message
	outCalls := make([]map[string]any, 0, len(msg.ToolCalls))
	for _, tc := range msg.ToolCalls {
		argsMap := map[string]any{}
		if strings.TrimSpace(tc.Function.Arguments) != "" {
			_ = json.Unmarshal([]byte(tc.Function.Arguments), &argsMap)
		}
		outCalls = append(outCalls, map[string]any{
			"id":   tc.ID,
			"tool": tc.Function.Name,
			"args": argsMap,
		})
	}
	return map[string]any{
		"ok":        true,
		"content":   msg.Content,
		"toolCalls": outCalls,
	}, nil
}

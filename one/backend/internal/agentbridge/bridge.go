package agentbridge

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"
)

const MaxBridgePayloadBytes = 32 << 20

type Handlers struct {
	Model func(context.Context, map[string]json.RawMessage) (any, error)
	Tool  func(context.Context, map[string]json.RawMessage) (any, error)
	Event func(context.Context, map[string]json.RawMessage) (any, error)
}

type BridgeServer struct {
	URL   string
	Token string
	Close func()
}

// StartBridge binds an ephemeral loopback/private-network HTTP server with a
// 32-byte (64-hex) cryptographically random Bearer token for one-agent callbacks.
func StartBridge(listenAddr, advertiseHost string, h Handlers) (*BridgeServer, error) {
	if h.Model == nil || h.Tool == nil || h.Event == nil {
		return nil, errors.New("agent bridge requires Model, Tool, and Event handlers")
	}
	advertiseHost = strings.TrimSpace(advertiseHost)
	if advertiseHost == "" || strings.ContainsAny(advertiseHost, `:/\ `) {
		return nil, errors.New("advertiseHost must be a bare host or IP")
	}

	var tokenBytes [32]byte
	if _, err := rand.Read(tokenBytes[:]); err != nil {
		return nil, fmt.Errorf("generate bridge token: %w", err)
	}
	token := hex.EncodeToString(tokenBytes[:])

	ln, err := net.Listen("tcp", listenAddr)
	if err != nil {
		return nil, fmt.Errorf("listen bridge: %w", err)
	}
	tcpAddr, ok := ln.Addr().(*net.TCPAddr)
	if !ok || tcpAddr.Port == 0 {
		_ = ln.Close()
		return nil, errors.New("bridge listener did not bind a TCP port")
	}

	mux := http.NewServeMux()
	mux.HandleFunc("POST /model", func(w http.ResponseWriter, r *http.Request) { handleCall(w, r, token, h.Model) })
	mux.HandleFunc("POST /tool", func(w http.ResponseWriter, r *http.Request) { handleCall(w, r, token, h.Tool) })
	mux.HandleFunc("POST /event", func(w http.ResponseWriter, r *http.Request) { handleCall(w, r, token, h.Event) })

	srv := &http.Server{
		Handler:           mux,
		ReadHeaderTimeout: 3 * time.Second,
		ReadTimeout:       2 * time.Minute,
	}
	go func() { _ = srv.Serve(ln) }()

	return &BridgeServer{
		URL:   fmt.Sprintf("http://%s:%d", advertiseHost, tcpAddr.Port),
		Token: token,
		Close: func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if err := srv.Shutdown(ctx); err != nil {
				_ = srv.Close()
			}
		},
	}, nil
}

func handleCall(w http.ResponseWriter, r *http.Request, expectedToken string, fn func(context.Context, map[string]json.RawMessage) (any, error)) {
	expected := "Bearer " + expectedToken
	actual := r.Header.Get("Authorization")
	if len(actual) != len(expected) || subtle.ConstantTimeCompare([]byte(actual), []byte(expected)) != 1 {
		http.Error(w, `{"error":"unauthorized bridge"}`, http.StatusUnauthorized)
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, MaxBridgePayloadBytes+1))
	if err != nil || len(body) > MaxBridgePayloadBytes {
		http.Error(w, `{"error":"bridge payload too large"}`, http.StatusRequestEntityTooLarge)
		return
	}
	var payload map[string]json.RawMessage
	if err := json.Unmarshal(body, &payload); err != nil {
		http.Error(w, `{"error":"invalid bridge json"}`, http.StatusBadRequest)
		return
	}
	res, err := fn(r.Context(), payload)
	w.Header().Set("Content-Type", "application/json")
	if err != nil {
		w.WriteHeader(http.StatusUnprocessableEntity)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	_ = json.NewEncoder(w).Encode(res)
}

type RunRequest struct {
	BridgeURL    string           `json:"bridgeUrl"`
	BridgeToken  string           `json:"bridgeToken"`
	SessionID    string           `json:"sessionId,omitempty"`
	UserID       string           `json:"userId,omitempty"`
	RunID        string           `json:"runId,omitempty"`
	Prompt       string           `json:"prompt"`
	SystemPrompt string           `json:"systemPrompt,omitempty"`
	Model        map[string]any   `json:"model"`
	Tools        []map[string]any `json:"tools,omitempty"`
	Messages     []map[string]any `json:"messages,omitempty"`
	MaxTurns     int              `json:"maxTurns,omitempty"`
}

type SessionRunnerOptions struct {
	ListenAddr    string
	AdvertiseHost string
	AgentURL      string
	AgentToken    string
	SessionID     string
	UserID        string
	RunID         string
	Prompt        string
	SystemPrompt  string
	Model         map[string]any
	Tools         []map[string]any
	Messages      []map[string]any
	MaxTurns      int
	Handlers      Handlers
}

type AgentRunResult struct {
	OK              bool             `json:"ok"`
	Status          string           `json:"status"`
	Turns           int              `json:"turns"`
	MaxTurnsReached bool             `json:"maxTurnsReached,omitempty"`
	ApprovalID      string           `json:"approvalId,omitempty"`
	ModelResp       map[string]any   `json:"modelResp,omitempty"`
	ToolResults     []map[string]any `json:"toolResults,omitempty"`
	Messages        []map[string]any `json:"messages,omitempty"`
	Error           string           `json:"error,omitempty"`
}

// AgentDispatchError captures a non-2xx HTTP status returned by one-agent.
type AgentDispatchError struct {
	StatusCode int
	Body       string
}

func (e *AgentDispatchError) Error() string {
	return fmt.Sprintf("one-agent returned HTTP %d: %s", e.StatusCode, e.Body)
}

func DispatchRun(ctx context.Context, agentURL, agentToken string, req RunRequest) (*http.Response, error) {
	if strings.TrimSpace(agentURL) == "" {
		return nil, errors.New("agentURL is required")
	}
	if len(agentToken) < 32 {
		return nil, errors.New("agentToken must contain at least 32 characters")
	}
	raw, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(agentURL, "/")+"/v1/runs", bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+agentToken)
	client := &http.Client{Timeout: 0}
	return client.Do(httpReq)
}

// ExecuteAgentRun starts an ephemeral authenticated BridgeServer, dispatches the run
// to one-agent, decodes the multi-turn ReAct result, and tears down the bridge.
func ExecuteAgentRun(ctx context.Context, opts SessionRunnerOptions) (*AgentRunResult, error) {
	listenAddr := strings.TrimSpace(opts.ListenAddr)
	if listenAddr == "" {
		listenAddr = "127.0.0.1:0"
	}
	advertiseHost := strings.TrimSpace(opts.AdvertiseHost)
	if advertiseHost == "" {
		advertiseHost = "127.0.0.1"
	}
	bridge, err := StartBridge(listenAddr, advertiseHost, opts.Handlers)
	if err != nil {
		return nil, err
	}
	defer bridge.Close()

	resp, err := DispatchRun(ctx, opts.AgentURL, opts.AgentToken, RunRequest{
		BridgeURL:    bridge.URL,
		BridgeToken:  bridge.Token,
		SessionID:    opts.SessionID,
		UserID:       opts.UserID,
		RunID:        opts.RunID,
		Prompt:       opts.Prompt,
		SystemPrompt: opts.SystemPrompt,
		Model:        opts.Model,
		Tools:        opts.Tools,
		Messages:     opts.Messages,
		MaxTurns:     opts.MaxTurns,
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, MaxBridgePayloadBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read one-agent response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, &AgentDispatchError{StatusCode: resp.StatusCode, Body: strings.TrimSpace(string(raw))}
	}
	var out AgentRunResult
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, fmt.Errorf("decode one-agent response: %w", err)
	}
	return &out, nil
}

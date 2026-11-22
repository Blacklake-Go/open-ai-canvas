package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"os/exec"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"one/backend/internal/config"
	"one/backend/internal/domain/generation"
	"one/backend/internal/middleware"
	"one/backend/internal/queue"
)

func TestHandleAgentRunsControlledLoopAndApprovalPause(t *testing.T) {
	// 1. Fail closed when unconfigured
	rUnconf, _ := newTestRouter(t, nil)
	req := httptest.NewRequest(http.MethodPost, "/api/agent/runs", bytes.NewBufferString(`{"prompt":"hello"}`))
	req.Header.Set("Origin", "http://127.0.0.1:3000")
	req.AddCookie(&http.Cookie{Name: "ko_session", Value: "valid-user-token"})
	rec := httptest.NewRecorder()
	rUnconf.ServeHTTP(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("unconfigured status = %d, want 503", rec.Code)
	}

	nodePath, err := exec.LookPath("node")
	if err != nil {
		t.Skip("node not installed")
	}

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	ln.Close()

	agentToken := "0123456789abcdef0123456789abcdef"
	serverScript := filepath.Clean(filepath.Join("..", "..", "..", "agent", "server.mjs"))
	ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, nodePath, serverScript)
	cmd.Env = []string{
		fmt.Sprintf("PORT=%d", port),
		"HOST=127.0.0.1",
		"ONE_AGENT_TOKEN=" + agentToken,
		"TMPDIR=" + t.TempDir(),
	}
	if err := cmd.Start(); err != nil {
		t.Fatalf("start node agent: %v", err)
	}
	defer func() {
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
			_, _ = cmd.Process.Wait()
		}
	}()

	agentURL := fmt.Sprintf("http://127.0.0.1:%d", port)
	deadline := time.Now().Add(4 * time.Second)
	ready := false
	for time.Now().Before(deadline) {
		resp, err := http.Get(agentURL + "/healthz")
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				ready = true
				break
			}
		}
		time.Sleep(50 * time.Millisecond)
	}
	if !ready {
		t.Fatalf("node agent did not become healthy at %s", agentURL)
	}

	var modelTurn int32
	hub := queue.NewEventHub()
	evCh, unsub := hub.Subscribe("100001", "")
	defer unsub()

	sessions := &stubSessionStore{
		users: map[string]*middleware.SessionUser{
			middleware.HashSessionToken("valid-user-token"): {
				ID:     "100001",
				Role:   "user",
				Status: "active",
				PlanID: "free",
			},
		},
	}

	router, err := NewRouter(Dependencies{
		Config: config.Config{
			PublicAppURL:       "http://127.0.0.1:3000",
			CSRFOriginRequired: true,
			AgentURL:           agentURL,
			AgentToken:         agentToken,
		},
		SessionAuth: sessions,
		Generation: &generation.Service{
			Repo: &stubModelRepo{
				models: []generation.ActiveModel{
					{ID: "seedream-4", Name: "seedream-4", DisplayName: "Seedream 4", Category: "image", IsActive: true, IsVisible: true},
				},
			},
		},
		Events: hub,
		AgentModelCaller: func(_ context.Context, payload map[string]json.RawMessage) (any, error) {
			n := atomic.AddInt32(&modelTurn, 1)
			if n == 1 {
				return map[string]any{
					"content": "checking canvas tools and models",
					"toolCalls": []map[string]any{
						{"id": "t1", "tool": "canvas_plan_tool", "args": map[string]any{"tool": "upscale", "sourceAssetId": "asset_12345678"}},
						{"id": "t2", "tool": "generation_list_models", "args": map[string]any{}},
					},
				}, nil
			}
			if n == 2 {
				return map[string]any{"content": "Canvas plan and active models verified."}, nil
			}
			// Turn 3+ used for approval pause subtest
			return map[string]any{
				"content": "requesting generation",
				"toolCalls": []map[string]any{
					{"id": "t3", "tool": "generation_create_task", "args": map[string]any{"modelId": "seedream-4", "quoteId": "q_1"}},
				},
			}, nil
		},
	})
	if err != nil {
		t.Fatalf("NewRouter: %v", err)
	}

	// 2. Completed ReAct run executing canvas_plan_tool + generation_list_models
	reqOK := httptest.NewRequest(http.MethodPost, "/api/agent/runs", bytes.NewBufferString(`{"runId":"run_react_http","prompt":"Plan upscale","maxTurns":4}`))
	reqOK.Header.Set("Origin", "http://127.0.0.1:3000")
	reqOK.AddCookie(&http.Cookie{Name: "ko_session", Value: "valid-user-token"})
	recOK := httptest.NewRecorder()
	router.ServeHTTP(recOK, reqOK)
	if recOK.Code != http.StatusOK {
		t.Fatalf("POST /api/agent/runs status=%d body=%s", recOK.Code, recOK.Body.String())
	}
	var bodyOK struct {
		RunID  string `json:"runId"`
		Result struct {
			Status      string           `json:"status"`
			Turns       int              `json:"turns"`
			ToolResults []map[string]any `json:"toolResults"`
		} `json:"result"`
	}
	if err := json.Unmarshal(recOK.Body.Bytes(), &bodyOK); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if bodyOK.RunID != "run_react_http" || bodyOK.Result.Status != "completed" || bodyOK.Result.Turns != 2 || len(bodyOK.Result.ToolResults) != 2 {
		t.Fatalf("unexpected run result: %+v", bodyOK)
	}

	// Verify EventHub received bridge telemetry events
	var gotStarted, gotCompleted bool
	for {
		select {
		case ev := <-evCh:
			if ev.Type == "agent.run.started" {
				gotStarted = true
			}
			if ev.Type == "agent.run.completed" {
				gotCompleted = true
			}
		default:
			goto doneEvents
		}
	}
doneEvents:
	if !gotStarted || !gotCompleted {
		t.Fatalf("expected agent.run.started and agent.run.completed on EventHub, got started=%v completed=%v", gotStarted, gotCompleted)
	}

	// 3. Approval pause check on generation_create_task without approveApprovalId
	reqPause := httptest.NewRequest(http.MethodPost, "/api/agent/runs", bytes.NewBufferString(`{"runId":"run_pause_http","prompt":"Generate image"}`))
	reqPause.Header.Set("Origin", "http://127.0.0.1:3000")
	reqPause.AddCookie(&http.Cookie{Name: "ko_session", Value: "valid-user-token"})
	recPause := httptest.NewRecorder()
	router.ServeHTTP(recPause, reqPause)
	if recPause.Code != http.StatusOK {
		t.Fatalf("POST /api/agent/runs pause status=%d body=%s", recPause.Code, recPause.Body.String())
	}
	var bodyPause struct {
		Result struct {
			Status     string `json:"status"`
			ApprovalID string `json:"approvalId"`
		} `json:"result"`
	}
	if err := json.Unmarshal(recPause.Body.Bytes(), &bodyPause); err != nil {
		t.Fatalf("decode pause response: %v", err)
	}
	if bodyPause.Result.Status != "paused" || bodyPause.Result.ApprovalID != "apr_run_pause_http" {
		t.Fatalf("expected paused with apr_run_pause_http, got %+v", bodyPause.Result)
	}
}

package agentbridge

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os/exec"
	"path/filepath"
	"testing"
	"time"
)

func TestStartBridgeTokenAndEndpoints(t *testing.T) {
	srv, err := StartBridge("127.0.0.1:0", "127.0.0.1", Handlers{
		Model: func(_ context.Context, _ map[string]json.RawMessage) (any, error) {
			return map[string]any{"text": "hello"}, nil
		},
		Tool: func(_ context.Context, _ map[string]json.RawMessage) (any, error) {
			return map[string]any{"pause": true, "reason": "awaiting_approval"}, nil
		},
		Event: func(_ context.Context, _ map[string]json.RawMessage) (any, error) {
			return map[string]any{"ok": true}, nil
		},
	})
	if err != nil {
		t.Fatalf("StartBridge: %v", err)
	}
	defer srv.Close()

	if len(srv.Token) != 64 {
		t.Fatalf("expected 64-char hex bearer token (32 bytes), got %d", len(srv.Token))
	}

	// Reject wrong token
	reqBad, _ := http.NewRequest(http.MethodPost, srv.URL+"/model", bytes.NewBufferString(`{}`))
	reqBad.Header.Set("Authorization", "Bearer wrong")
	respBad, err := http.DefaultClient.Do(reqBad)
	if err != nil {
		t.Fatal(err)
	}
	respBad.Body.Close()
	if respBad.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 for wrong bearer token, got %d", respBad.StatusCode)
	}

	// Accept valid token on /tool and return pause=true
	reqTool, _ := http.NewRequest(http.MethodPost, srv.URL+"/tool", bytes.NewBufferString(`{"name":"write_db"}`))
	reqTool.Header.Set("Authorization", "Bearer "+srv.Token)
	respTool, err := http.DefaultClient.Do(reqTool)
	if err != nil {
		t.Fatal(err)
	}
	defer respTool.Body.Close()
	if respTool.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", respTool.StatusCode)
	}
	var out map[string]any
	if err := json.NewDecoder(respTool.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	if out["pause"] != true || out["reason"] != "awaiting_approval" {
		t.Fatalf("unexpected tool response: %v", out)
	}
}

func TestDispatchRunLiveGoToNodeAgentBridge(t *testing.T) {
	nodePath, err := exec.LookPath("node")
	if err != nil {
		t.Skip("node not installed")
	}

	var modelCalled bool
	var events []string
	bridge, err := StartBridge("127.0.0.1:0", "127.0.0.1", Handlers{
		Model: func(_ context.Context, _ map[string]json.RawMessage) (any, error) {
			modelCalled = true
			return map[string]any{"text": "bridge-ok"}, nil
		},
		Tool: func(_ context.Context, _ map[string]json.RawMessage) (any, error) {
			return map[string]any{"ok": true}, nil
		},
		Event: func(_ context.Context, payload map[string]json.RawMessage) (any, error) {
			if raw, ok := payload["type"]; ok {
				var typ string
				_ = json.Unmarshal(raw, &typ)
				events = append(events, typ)
			}
			return map[string]any{"ok": true}, nil
		},
	})
	if err != nil {
		t.Fatalf("StartBridge: %v", err)
	}
	defer bridge.Close()

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	ln.Close()

	agentToken := "0123456789abcdef0123456789abcdef"
	serverScript := filepath.Clean(filepath.Join("..", "..", "..", "agent", "server.mjs"))
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
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

	resp, err := DispatchRun(ctx, agentURL, agentToken, RunRequest{
		BridgeURL:   bridge.URL,
		BridgeToken: bridge.Token,
		RunID:       "run_go_node_e2e",
		Prompt:      "verify bridgeUrl contract",
		Model:       map[string]any{"id": "test-model"},
	})
	if err != nil {
		t.Fatalf("DispatchRun: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("DispatchRun status = %d, body=%s", resp.StatusCode, string(body))
	}

	var runOut map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&runOut); err != nil {
		t.Fatalf("decode agent response: %v", err)
	}
	if runOut["ok"] != true || runOut["status"] != "completed" {
		t.Fatalf("unexpected agent response: %v", runOut)
	}
	if !modelCalled {
		t.Fatalf("expected Go Bridge /model callback from Node agent")
	}
	if len(events) < 2 || events[0] != "run.started" || events[len(events)-1] != "run.completed" {
		t.Fatalf("expected [run.started ... run.completed] bridge events, got %v", events)
	}

	// ExecuteAgentRun multi-turn ReAct tool execution over live Node bridge
	turnCount := 0
	var reactEvents []string
	res, err := ExecuteAgentRun(ctx, SessionRunnerOptions{
		AgentURL:   agentURL,
		AgentToken: agentToken,
		RunID:      "run_go_react_e2e",
		Prompt:     "plan a 2k upscale",
		MaxTurns:   4,
		Model:      map[string]any{"id": "test-model"},
		Handlers: Handlers{
			Model: func(_ context.Context, _ map[string]json.RawMessage) (any, error) {
				turnCount++
				if turnCount == 1 {
					return map[string]any{
						"content": "calling canvas tool",
						"toolCalls": []map[string]any{
							{"id": "call_1", "tool": "canvas_plan", "args": map[string]any{"tool": "upscale"}},
						},
					}, nil
				}
				return map[string]any{"content": "done"}, nil
			},
			Tool: func(_ context.Context, payload map[string]json.RawMessage) (any, error) {
				var toolName string
				_ = json.Unmarshal(payload["tool"], &toolName)
				return map[string]any{"ok": true, "tool": toolName}, nil
			},
			Event: func(_ context.Context, payload map[string]json.RawMessage) (any, error) {
				var typ string
				_ = json.Unmarshal(payload["type"], &typ)
				reactEvents = append(reactEvents, typ)
				return map[string]any{"ok": true}, nil
			},
		},
	})
	if err != nil {
		t.Fatalf("ExecuteAgentRun: %v", err)
	}
	if !res.OK || res.Status != "completed" || res.Turns != 2 || len(res.ToolResults) != 1 {
		t.Fatalf("unexpected ExecuteAgentRun result: %+v", res)
	}
	if len(reactEvents) != 3 || reactEvents[0] != "run.started" || reactEvents[1] != "tool.called" || reactEvents[2] != "run.completed" {
		t.Fatalf("unexpected reactEvents: %v", reactEvents)
	}
}

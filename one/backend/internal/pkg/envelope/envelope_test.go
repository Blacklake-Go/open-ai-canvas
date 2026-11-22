package envelope

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestLoadRouteContractsMatches238Baseline(t *testing.T) {
	contracts, err := LoadRouteContracts()
	if err != nil {
		t.Fatalf("LoadRouteContracts: %v", err)
	}
	if len(contracts) != 238 {
		t.Fatalf("expected 238 routes, got %d", len(contracts))
	}

	baselinePath := filepath.Join("testdata", "api-inventory.json")
	raw, err := os.ReadFile(baselinePath)
	if err != nil {
		t.Fatalf("read baseline api-inventory.json: %v", err)
	}
	var inv struct {
		Routes []RouteContract `json:"routes"`
	}
	if err := json.Unmarshal(raw, &inv); err != nil {
		t.Fatalf("unmarshal baseline: %v", err)
	}
	if len(inv.Routes) != len(contracts) {
		t.Fatalf("baseline count %d != embedded count %d", len(inv.Routes), len(contracts))
	}
	for i := range contracts {
		if contracts[i].RoutePath != inv.Routes[i].RoutePath || contracts[i].ResponseFormat != inv.Routes[i].ResponseFormat {
			t.Fatalf("mismatch at %d: %+v vs %+v", i, contracts[i], inv.Routes[i])
		}
	}
}

func TestSixEnvelopeHelpers(t *testing.T) {
	t.Run("admin ok & err", func(t *testing.T) {
		rec := httptest.NewRecorder()
		AdminOK(rec, http.StatusOK, map[string]int{"count": 3}, "req_123", nil)
		if rec.Code != 200 {
			t.Fatalf("status = %d", rec.Code)
		}
		var body map[string]any
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		if body["ok"] != true {
			t.Fatalf("expected ok=true, got %v", body)
		}

		recErr := httptest.NewRecorder()
		AdminError(recErr, http.StatusForbidden, "FORBIDDEN", "denied", "req_456")
		if recErr.Code != 403 {
			t.Fatalf("status = %d", recErr.Code)
		}
		if err := json.Unmarshal(recErr.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		if body["ok"] != false {
			t.Fatalf("expected ok=false, got %v", body)
		}
	})

	t.Run("domain json & success json & sse", func(t *testing.T) {
		rec := httptest.NewRecorder()
		DomainJSON(rec, http.StatusOK, map[string]any{"status": "live"})
		if rec.Code != 200 {
			t.Fatalf("status = %d", rec.Code)
		}

		recSucc := httptest.NewRecorder()
		SuccessJSON(recSucc, http.StatusOK, map[string]any{"schemaVersion": 2})
		var body map[string]any
		_ = json.Unmarshal(recSucc.Body.Bytes(), &body)
		if body["success"] != true || body["schemaVersion"] != float64(2) {
			t.Fatalf("unexpected success payload: %v", body)
		}

		recSSE := httptest.NewRecorder()
		SetSSEHeaders(recSSE)
		if recSSE.Header().Get("Content-Type") != "text/event-stream; charset=utf-8" {
			t.Fatalf("unexpected SSE header: %s", recSSE.Header().Get("Content-Type"))
		}
	})
}

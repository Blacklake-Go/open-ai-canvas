package main

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
)

func TestReviewBatch(t *testing.T) {
	valid := reviewCase{ID: "sample-order", OrderUnit: "5 秒一单", Basis: "verified", RetailUSD: "0.014", CostUSD: "0.52", CostSource: "fixture/cost", NetUSDPerPoint: "0.0097", RevenueSource: "fixture/payment", GrossUSDPerPoint: "0.01", MinMarginBPS: 4500}
	scenario := valid
	scenario.ID, scenario.Basis = "scenario", "scenario"
	blocked := valid
	blocked.ID, blocked.NetUSDPerPoint, blocked.RevenueSource = "missing-payment", "", ""
	free := valid
	free.ID, free.RetailUSD, free.CostUSD = "free", "0", "0"
	data, err := json.Marshal([]reviewCase{valid, scenario, blocked, free})
	if err != nil {
		t.Fatal(err)
	}
	var out bytes.Buffer
	if err := run(bytes.NewReader(data), &out); err == nil {
		t.Fatal("mixed batch must return a failure after writing receipts")
	}
	var report struct {
		Blocked  int
		Receipts []receipt
	}
	if err := json.Unmarshal(out.Bytes(), &report); err != nil {
		t.Fatal(err)
	}
	if report.Blocked != 1 || len(report.Receipts) != 4 {
		t.Fatalf("unexpected report: %s", out.String())
	}
	for i, v := range []struct {
		status string
		trial  int64
	}{{"verifiedTrial", 100}, {"scenarioOnly", 100}, {"blocked", 0}, {"verifiedTrial", 0}} {
		r := report.Receipts[i]
		if r.Status != v.status || r.CommercialPoints == nil {
			t.Fatalf("row %d: %+v", i, r)
		}
		if r.Status == "blocked" {
			if r.TrialPoints != nil || len(r.Reasons) == 0 || *r.CommercialPoints != 1 {
				t.Fatalf("incomplete row quoted: %+v", r)
			}
		} else if r.TrialPoints == nil || *r.TrialPoints != v.trial {
			t.Fatalf("row %d: %+v", i, r)
		}
	}
}

func TestReviewRequiresSourcesAndUnit(t *testing.T) {
	r := review(reviewCase{RetailUSD: "0.00", CostUSD: "0", NetUSDPerPoint: "0.01", Basis: "verified"})
	if r.Status != "blocked" || len(r.Reasons) != 3 || r.TrialPoints != nil {
		t.Fatalf("unverifiable free order %v", r)
	}
}

func TestRunRejectsInvalidFiles(t *testing.T) {
	for _, v := range []string{"", "[]", "null", "{}", "[] []", `[{"retailUSD":0.10}]`, `[{"typo":"value"}]`} {
		var out bytes.Buffer
		if err := run(strings.NewReader(v), &out); err == nil || out.Len() != 0 {
			t.Errorf("invalid %q produced %q: %v", v, out.String(), err)
		}
	}
}

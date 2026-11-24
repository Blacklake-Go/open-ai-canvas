package generation

import (
	"context"
	"encoding/json"
	"reflect"
	"testing"
	"time"
)

type modelDirectoryFixture []ActiveModel

func (f modelDirectoryFixture) ListActiveModels(context.Context, string) ([]ActiveModel, error) {
	return f, nil
}

func TestActiveModelVersionsExposeDeclaredStudioCapabilities(t *testing.T) {
	legacy := json.RawMessage(`{"modes":["t2v","i2v","i2v","cinema"],"parameters":["negative_prompt"],"internal_note":"private"}`)
	service := Service{Repo: modelDirectoryFixture{{
		ID: "mixed-video", GenerationCapabilities: legacy,
		options: publicModelOptions{
			inputTypes: json.RawMessage(`["image"]`), outputTypes: json.RawMessage(`["video"]`),
			resolutions: json.RawMessage(`["720p",null,1]`), durations: json.RawMessage(`["5",10,5]`),
			aspectRatios: json.RawMessage(`["16:9"]`),
		},
	}}}
	current, err := service.GetActiveModels(context.Background(), "2", "")
	if err != nil {
		t.Fatal(err)
	}
	var contract []publicGenerationCapability
	if err := json.Unmarshal(current.Models[0].GenerationCapabilities, &contract); err != nil {
		t.Fatal(err)
	}
	want := []publicGenerationCapability{
		{TaskType: "i2v", InputTypes: []string{"image"}, OutputTypes: []string{"video"},
			Resolutions: []string{"720p"}, Durations: []float64{5, 10}, AspectRatios: []string{"16:9"},
			Parameters: []string{"negative_prompt"}},
		{TaskType: "cinema"},
	}
	if !reflect.DeepEqual(contract, want) {
		t.Fatalf("unexpected capability contract: %s", current.Models[0].GenerationCapabilities)
	}
	previous, err := service.GetActiveModels(context.Background(), "", "")
	if err != nil {
		t.Fatal(err)
	}
	if string(previous.Models[0].GenerationCapabilities) != string(legacy) {
		t.Fatalf("legacy contract changed: %s", previous.Models[0].GenerationCapabilities)
	}
}

func TestAllocateCreditFundingPriorityAndExpiry(t *testing.T) {
	now := time.Date(2026, 11, 16, 10, 0, 0, 0, time.UTC)
	soon := now.Add(2 * time.Hour)
	expired := now.Add(-1 * time.Hour)

	lots := []ReturnedLot{
		{ID: "lot_sub_1", BucketType: "SUBSCRIPTION", Remaining: 25, ExpiresAt: &soon},
		{ID: "lot_exp_1", BucketType: "DAILY_FREE", Remaining: 50, ExpiresAt: &expired},
	}

	plan := AllocateCreditFunding(15, 20, 100, &soon, &soon, lots, 55, now)
	if !plan.IsSufficient {
		t.Fatalf("expected sufficient plan")
	}
	// Daily: 15 (expired lot skipped). Subscription: 20 wallet + 20 returned = 40 -> total 55.
	if plan.Split.Daily != 15 || plan.Split.Subscription != 40 || plan.Split.Perpetual != 0 {
		t.Fatalf("unexpected bucket split: %+v", plan.Split)
	}

	insufficient := AllocateCreditFunding(15, 20, 10, &soon, &soon, nil, 100, now)
	if insufficient.IsSufficient {
		t.Fatalf("expected insufficient plan")
	}
}

func TestResolveModelPricePolicy(t *testing.T) {
	now := time.Date(2026, 11, 16, 10, 0, 0, 0, time.UTC)
	siteCNY := 1.40
	pr := ResolveModelPricePolicy(PricingRecord{
		ModelID:      "flux",
		PricingType:  "fixed",
		BaseCredits:  20,
		MinCredits:   10,
		SitePriceCNY: &siteCNY,
	}, nil, FormulaMultipliers{Resolution: 1, Duration: 1, Quality: 1}, now)

	if len(pr.Blockers) != 0 || pr.Credits != 20 || pr.SitePriceCNY != 1.40 {
		t.Fatalf("unexpected price resolution: %+v", pr)
	}

	past := now.Add(-time.Minute)
	blocked := ResolveModelPricePolicy(PricingRecord{
		ModelID:         "flux",
		PricingType:     "fixed",
		BaseCredits:     20,
		SitePriceCNY:    &siteCNY,
		PriceValidUntil: &past,
	}, nil, FormulaMultipliers{}, now)
	if len(blocked.Blockers) != 1 || blocked.Blockers[0] != "SITE_PRICE_EXPIRED" {
		t.Fatalf("expected SITE_PRICE_EXPIRED blocker, got %+v", blocked.Blockers)
	}

	highCost := 2.0
	formula := ResolveModelPricePolicy(PricingRecord{
		ModelID:     "veo",
		PricingType: "formula",
		BaseCredits: 20,
		MinCredits:  10,
	}, &highCost, FormulaMultipliers{Duration: 2}, now)
	if formula.Credits <= 40 || formula.CreditsSource != "provider_cost_margin_ceiling" {
		t.Fatalf("expected formula floor above 40, got %+v", formula)
	}
}

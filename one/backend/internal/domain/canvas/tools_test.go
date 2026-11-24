package canvas

import (
	"strings"
	"testing"
)

func TestWorkshopDefaultsPinTheReviewedVersion(t *testing.T) {
	tool, ok := WorkshopToolByID("character_three_view")
	if !ok || len(WorkshopTools()) != 10 {
		t.Fatal("workshop tools must include all ten distinct entries")
	}
	unusable := WorkshopVersion{WorkshopSelection: WorkshopSelection{"model", "route-1", "contract-1"},
		Ratios: []string{"1:1"}, Resolutions: []string{"2k"}}
	oldVersion := WorkshopVersion{WorkshopSelection: WorkshopSelection{"model", "route-2", "old-contract"},
		Ratios: []string{"16:9"}, Resolutions: []string{"2k"}}
	newVersion := oldVersion
	newVersion.Contract = "new-contract"
	versions := []WorkshopVersion{unusable, newVersion}
	if result, ok := ResolveWorkshopVersion(tool, versions, nil); !ok || result.VersionID != newVersion.VersionID {
		t.Fatalf("automatic selection did not skip incompatible version: %#v", result)
	}
	if _, ok := ResolveWorkshopVersion(tool, versions, map[string]WorkshopSelection{tool.ID: oldVersion.WorkshopSelection}); ok {
		t.Fatal("a changed provider route must not replace a version explicitly selected by an administrator")
	}
	if err := newVersion.ValidatePlan(&ToolPlan{Parameters: map[string]any{"aspect_ratio": "16:9", "resolution": "4k"}}); err == nil {
		t.Fatal("the plan must reject resolution outside the selected version's contract")
	}
}

func TestBuildToolPlanAndValidation(t *testing.T) {
	if _, err := BuildToolPlan("outpaint", nil, "bad"); err == nil {
		t.Fatalf("expected invalid source error")
	}

	plan, err := BuildToolPlan("preset", map[string]any{
		"presetId":    "character_three_view",
		"resolution":  "4K",
		"aspectRatio": "1:1",
	}, "asset_12345678")
	if err != nil {
		t.Fatalf("unexpected preset error: %v", err)
	}
	if plan.Parameters["aspect_ratio"] != "16:9" || plan.Parameters["resolution"] != "4k" {
		t.Fatalf("expected forced 16:9 and 4k, got %+v", plan.Parameters)
	}
	if !strings.Contains(plan.Prompt, "角色三视图") {
		t.Fatalf("unexpected prompt %q", plan.Prompt)
	}

	up, err := BuildToolPlan("upscale", map[string]any{"mode": "standard", "detail": "high"}, "asset_12345678")
	if err != nil || up.Label != "画布超清" {
		t.Fatalf("upscale failed: %v %+v", err, up)
	}

	vc, err := BuildToolPlan("view_control", map[string]any{"yaw": 90, "pitch": 30, "distance": 0}, "asset_12345678")
	if err != nil || !strings.Contains(vc.Prompt, "右侧 90°") || !strings.Contains(vc.Prompt, "近景特写") {
		t.Fatalf("view_control failed: %v %+v", err, vc)
	}

	if _, err := BuildToolPlan("unknown_tool", nil, "asset_12345678"); err == nil {
		t.Fatalf("expected INVALID_TOOL")
	}
}

func TestBuildToolSpecFiltering(t *testing.T) {
	spec := BuildToolSpec("m1", "Seedream 5", "volcengine", 20, map[string]any{
		"aspectRatios": []any{"1:1", "16:9"},
		"resolutions":  []any{"2k"},
	})
	caps := spec["capabilities"].(map[string]any)
	ratios := caps["aspectRatios"].([]string)
	if len(ratios) != 2 || ratios[0] != "1:1" || ratios[1] != "16:9" {
		t.Fatalf("unexpected filtered ratios: %+v", ratios)
	}
}

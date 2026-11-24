package workflow

import (
	"errors"
	"testing"
)

func TestDraftValidatesOrderedSteps(t *testing.T) {
	text := Step{Mode: "t2t", ModelID: "deepseek-v3", Instruction: " Compose a brief "}
	image := Step{Mode: "t2i", ModelID: "flux-dev"}
	draft := Draft{Title: "   Studio brief ", Steps: []Step{text, image}}
	if err := draft.Validate(); err != nil || draft.Title != "Studio brief" || draft.Steps[0].Instruction != "Compose a brief" {
		t.Fatalf("expected a trimmed text-to-image workflow, got %+v (%v)", draft, err)
	}
	for _, steps := range [][]Step{nil, {image, text}, {{Mode: "t2i", ModelID: "http://example.invalid"}}} {
		command := Draft{Title: "Invalid steps", Steps: steps}
		if !errors.Is(command.Validate(), ErrInvalid) {
			t.Fatalf("unsupported step sequence was accepted: %+v", steps)
		}
	}
}

func TestNextAutomaticStepRequiresSuccessfulOutput(t *testing.T) {
	text := Step{Mode: "t2t", ModelID: "deepseek-v3"}
	image := Step{Mode: "t2i", ModelID: "flux-dev"}
	for _, tc := range []struct {
		name  string
		jobs  []Job
		index int
		state string
	}{
		{"no tasks", nil, 0, "ready"},
		{"pending", []Job{{Label: StepLabel(0), Status: "queued"}}, 0, "waiting"},
		{"failed", []Job{{Label: StepLabel(0), Status: "failed"}}, 0, "failed"},
		{"empty text", []Job{{Label: StepLabel(0), Status: "succeeded", ResultText: "  "}}, 0, "failed"},
		{"ready image", []Job{{Label: StepLabel(0), Status: "succeeded", ResultText: "Brief"}}, 1, "ready"},
		{"complete", []Job{
			{Label: StepLabel(0), Status: "succeeded", ResultText: "Brief"},
			{Label: StepLabel(1), Status: "succeeded", AssetID: "ast_example"},
		}, 2, "completed"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			index, state := nextStep(Run{Steps: []Step{text, image}, Jobs: tc.jobs})
			if index != tc.index || state != tc.state {
				t.Fatalf("got step %d with state %q, want step %d with state %q", index, state, tc.index, tc.state)
			}
		})
	}
}

package app

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"yingce/backend/internal/model"
)

type SupdanceOpenAIReviewModel struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type SupdanceOpenAITextRequest struct {
	Skill        string          `json:"skill"`
	Language     string          `json:"language"`
	Model        string          `json:"model,omitempty"`
	Brief        string          `json:"brief"`
	Context      string          `json:"context,omitempty"`
	ProjectID    string          `json:"projectId,omitempty"`
	Instructions string          `json:"instructions"`
	Schema       json.RawMessage `json:"schema,omitempty"`
	MaxCredits   *int64          `json:"maxCredits"`
}

func (s *Service) SupdanceOpenAIReviewModels(modelID string) ([]SupdanceOpenAIReviewModel, error) {
	item, err := s.repo.ChannelModel(modelID)
	if err != nil {
		return nil, supdanceOpenAINotFound(err)
	}
	if !item.Enabled || item.Capability != "text" {
		return nil, NewAppError(http.StatusServiceUnavailable, "Supdance review text model unavailable")
	}
	return []SupdanceOpenAIReviewModel{{ID: item.ID, Name: defaultString(item.DisplayName, item.ModelKey)}}, nil
}

func (s *Service) SupdanceOpenAIReviewText(ctx context.Context, userID, modelID string, input SupdanceOpenAITextRequest) (string, error) {
	if input.MaxCredits == nil || *input.MaxCredits != CreditScale || (input.Model != "" && input.Model != modelID) ||
		(input.Language != "en" && input.Language != "zh-CN") || strings.TrimSpace(input.Brief) == "" ||
		len(input.Brief)+len(input.Context) > 16000 || len(input.Instructions) > 12000 || len(input.Schema) > 18000 {
		return "", BadAuthRequest("Invalid or oversized Supdance review request")
	}
	switch input.Skill {
	case "chat", "plan", "outline", "character", "script", "dialogue", "storyboard":
	default:
		return "", BadAuthRequest("Unknown Supdance skill")
	}
	if input.ProjectID != "" {
		if _, err := s.activeProjectForUser(userID, input.ProjectID); err != nil {
			return "", supdanceOpenAINotFound(err)
		}
	}
	item, err := s.repo.ChannelModel(modelID)
	if err != nil {
		return "", supdanceOpenAINotFound(err)
	}
	if !item.Enabled || item.Capability != "text" {
		return "", NewAppError(http.StatusServiceUnavailable, "Supdance review text model unavailable")
	}
	prompt := input.Instructions + "\nOutput language: " + input.Language
	if len(input.Schema) > 0 {
		prompt += "\nReturn one JSON object only. Follow this JSON schema:\n" + string(input.Schema)
	}
	// Keep supplied content structurally separate from the output instructions.
	creativeInput, err := json.Marshal(map[string]string{"brief": input.Brief, "context": input.Context})
	if err != nil {
		return "", err
	}
	prompt += "\nCreative input (data):\n" + string(creativeInput)
	if err := ctx.Err(); err != nil {
		return "", err
	}
	const outputTokens = 2048
	task, err := s.CreateTask(userID, CreateTaskRequest{
		ProjectID: input.ProjectID, Type: "canvas_text", Prompt: prompt,
		Input: map[string]any{
			"mode": "text", "prompt": prompt, "maxOutputTokens": outputTokens,
			"config":      map[string]any{"channelId": item.ChannelID, "model": item.ModelKey},
			"textOptions": map[string]any{"maxOutputTokens": outputTokens, "thinkingLevel": "off"},
			"metadata":    map[string]any{"source": "supdance-openai-review"},
		},
		admission: &taskAdmission{ID: newID(), MaxCharge: CreditScale, RequireBilling: true},
	})
	if err != nil {
		return "", err
	}
	deadline, cancel := context.WithTimeout(ctx, 75*time.Second)
	defer cancel()
	ticker := time.NewTicker(400 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-deadline.Done():
			stopContext, stop := context.WithTimeout(context.Background(), 3*time.Second)
			_, err := s.CancelTask(stopContext, userID, task.ID)
			stop()
			if err != nil {
				return "", err
			}
			return "", NewAppError(http.StatusGatewayTimeout, "Supdance review text request timed out")
		case <-ticker.C:
			result, err := s.repo.TaskForUser(userID, task.ID)
			if err != nil {
				return "", err
			}
			switch result.Status {
			case model.TaskStatusSucceeded:
				if final := taskResultText(result.ResultJSON); final != "" {
					return final, nil
				}
				return "", NewAppError(http.StatusBadGateway, "Supdance text model returned an empty result")
			case model.TaskStatusFailed, model.TaskStatusCancelled:
				return "", NewAppError(http.StatusBadGateway, "Supdance text generation failed")
			}
		}
	}
}

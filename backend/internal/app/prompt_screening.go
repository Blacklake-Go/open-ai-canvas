package app

import (
	"context"
	"errors"
	"net/http"

	"yingce/backend/internal/kernel"
	"yingce/backend/internal/supdance/contentsafety"
)

// ScreenGenerationPrompt is applied after prompt expansion and before any image
// or video provider create request. Failed checks never permit route fallback.
func (s *Service) ScreenGenerationPrompt(ctx context.Context, mode, prompt string) error {
	if mode != "image" && mode != "video" {
		return nil
	}
	if s.promptScreenerErr != nil {
		return kernel.WrapAppError(503, "Content screening is not configured correctly. Please contact support.", &contentsafety.Error{Reason: "configuration"})
	}
	if s.promptScreener == nil {
		return nil
	}
	if err := s.promptScreener.Check(ctx, prompt); err != nil {
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			return err
		}
		status := 503
		var verdict *contentsafety.Error
		if errors.As(err, &verdict) && (verdict.Reason == "blocked" || verdict.Reason == "invalid_prompt") {
			status = 422
		}
		return kernel.WrapAppError(status, err.Error(), err)
	}
	return nil
}

// Arbitrary relay payloads do not have a trustworthy generation contract. When
// screening is enabled, creation must use the queue's validated image/video input.
func (s *Service) AuthorizeCustomRelayScreening(method string) error {
	if method == http.MethodGet || method == http.MethodHead || s.promptScreener == nil && s.promptScreenerErr == nil {
		return nil
	}
	return kernel.Forbidden("Direct custom relay creation is unavailable while prompt screening is enabled. Use queued generation.")
}

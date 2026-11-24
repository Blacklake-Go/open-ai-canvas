package generation

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"one/backend/internal/domain/agentpersona"
	"one/backend/internal/domain/agenttext"
	"one/backend/internal/domain/designagent"
)

func (s *Service) prepareConversationTurn(ctx context.Context, tx pgx.Tx, req *CreateTaskRequest, kind, id string) (*CreateTaskResult, error) {
	var err error
	systemPrompt := "You are the SupDance design assistant. Help users plan visual work, develop creative concepts and refine instructions. Reply in the user's language. Only claim media or canvas changes when they actually took place."
	code := "DESIGN_AGENT"
	if kind == "agent-chat" {
		code = "AGENT"
		systemPrompt, err = agentpersona.LockConversation(ctx, tx, req.UserID, id)
	} else {
		err = designagent.LockSession(ctx, tx, req.UserID, id)
	}
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, &PricingError{Code: code + "_SESSION_NOT_FOUND", Status: 404, Message: "找不到此会话"}
		}
		return nil, &PricingError{Code: code + "_UNAVAILABLE", Status: 503, Message: "暂时无法验证会话"}
	}

	var existing CreateTaskResult
	var matches bool
	err = tx.QueryRow(ctx, `
		SELECT id, status, credit_cost, COALESCE(idempotency_key = NULLIF($3,''), false) AS same_turn
		FROM ai_studio.creations WHERE user_id = $1 AND studio_id = $2 AND deleted_at IS NULL
		  AND (status IN ('queued','processing') OR idempotency_key = NULLIF($3,''))
		ORDER BY same_turn DESC, created_at DESC LIMIT 1`, req.UserID, req.StudioID, req.IdempotencyKey).
		Scan(&existing.CreationID, &existing.Status, &existing.Credits, &matches)
	switch {
	case err == nil && matches:
		existing.Idempotent = true
		return &existing, nil
	case err == nil:
		return nil, &PricingError{Code: code + "_TURN_PENDING", Status: 409, Message: "请等待当前回复完成"}
	case !errors.Is(err, pgx.ErrNoRows):
		return nil, &PricingError{Code: code + "_UNAVAILABLE", Status: 503, Message: "暂时无法读取对话"}
	}

	prompt, _ := req.Parameters["prompt"].(string)
	mode, _ := req.Parameters["task_type"].(string)
	if prompt != "" && kind == "design-agent" && DesignMediaKind(mode) != "" {
		if err := s.validateDesignMedia(ctx, tx, req, mode, DesignMediaKind(mode)); err != nil {
			var pricingErr *PricingError
			if errors.As(err, &pricingErr) {
				return nil, err
			}
			return nil, &PricingError{Code: code + "_UNAVAILABLE", Status: 503, Message: "暂时无法验证技能或参考素材"}
		}
		return nil, nil
	}
	if prompt == "" || mode != "t2t" {
		return nil, &PricingError{Code: code + "_INVALID_INPUT", Status: 422, Message: "请输入有效的对话内容"}
	}
	params, err := agenttext.Parameters(ctx, tx, req.UserID, req.StudioID, systemPrompt, prompt)
	if err != nil {
		return nil, &PricingError{Code: code + "_UNAVAILABLE", Status: 503, Message: "暂时无法读取对话"}
	}
	req.Parameters = params
	return nil, nil
}

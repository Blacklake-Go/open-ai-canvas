package generation

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
)

type WorkflowStepSubmission struct {
	Index      int
	ApprovalID string
}

// lockWorkflowStep serializes approval, stopping, and billing against the same run row.
func lockWorkflowStep(ctx context.Context, tx pgx.Tx, req CreateTaskRequest) (*int32, error) {
	runID, workflowRun := strings.CutPrefix(req.StudioID, "workflow:")
	if !workflowRun && req.WorkflowStep == nil {
		return nil, nil
	}
	step := req.WorkflowStep
	if !workflowRun || step == nil || step.Index < 0 || step.Index > 5 || !req.RequireExactQuote {
		return nil, &PricingError{Code: "WORKFLOW_STEP_REQUIRED", Status: 422, Message: "请通过工作流步骤提交任务"}
	}
	var state, approval string
	var cap *int32
	err := tx.QueryRow(ctx, `
		SELECT automation_state, COALESCE(automation_quote_id::text,''), automation_caps[$3::int+1]
		FROM ai_studio.one_workflow_runs WHERE id=$1::uuid AND owner_user_id=$2
		  AND $3::int < jsonb_array_length(steps) FOR UPDATE`, runID, req.UserID, step.Index).
		Scan(&state, &approval, &cap)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, &PricingError{Code: "WORKFLOW_NOT_FOUND", Status: 404, Message: "找不到工作流运行记录"}
	}
	if err != nil {
		return nil, &PricingError{Code: "WORKFLOW_UNAVAILABLE", Status: 503, Message: "暂时无法检查工作流运行状态"}
	}
	if step.ApprovalID == "" {
		if state == "active" {
			return nil, &PricingError{Code: "WORKFLOW_AUTO_ACTIVE", Status: 409, Message: "工作流正在自动运行"}
		}
		return nil, nil
	}
	if state != "active" || step.ApprovalID != approval || cap == nil {
		return nil, &PricingError{Code: "WORKFLOW_AUTO_INACTIVE", Status: 409, Message: "自动运行授权已结束"}
	}
	return cap, nil
}

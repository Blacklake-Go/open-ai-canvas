package workflow

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"one/backend/internal/domain/generation"
	"one/backend/internal/platform/coordination"
)

var (
	ErrAutoQuote = errors.New("automatic workflow quote expired or changed")
	ErrNotReady  = errors.New("no remaining workflow step is ready")
)

type Automation struct {
	Store      Store
	Generation *generation.Service
}

type AutoQuote struct {
	ID         string    `json:"quoteId"`
	StartStep  int       `json:"startStep"`
	StepCaps   []int32   `json:"stepCaps"`
	MaxCredits int64     `json:"maxCredits"`
	ExpiresAt  time.Time `json:"expiresAt"`
}

func (a Automation) Quote(ctx context.Context, owner, runID string) (AutoQuote, error) {
	run, err := a.Store.GetRun(ctx, owner, runID)
	if err != nil {
		return AutoQuote{}, err
	}
	if run.AutomationState == "active" {
		return AutoQuote{}, ErrActive
	}
	index, state := nextStep(run)
	if state != "ready" {
		return AutoQuote{}, ErrNotReady
	}
	quote := AutoQuote{StartStep: index, StepCaps: make([]int32, len(run.Steps)), ExpiresAt: time.Now().UTC().Add(5 * time.Minute)}
	for i := index; i < len(run.Steps); i++ {
		step := run.Steps[i]
		params := map[string]any{"task_type": step.Mode}
		if i == index {
			_, prompt, _, err := a.Store.planStep(ctx, run, i)
			if err != nil {
				return AutoQuote{}, err
			}
			if !generation.PromptAllowed(prompt) {
				return AutoQuote{}, &generation.PricingError{Code: "CONTENT_POLICY_VIOLATION", Status: 422, Message: "请调整此步骤的输入内容"}
			}
			params["prompt"] = prompt
		} else if err := a.Store.checkModel(ctx, step); err != nil {
			return AutoQuote{}, err
		}
		price, err := a.stepQuote(ctx, owner, step, params)
		if err != nil {
			return AutoQuote{}, err
		}
		quote.StepCaps[i] = int32(price.Credits)
		quote.MaxCredits += int64(price.Credits)
		if price.ExpiresAt.Before(quote.ExpiresAt) {
			quote.ExpiresAt = price.ExpiresAt
		}
	}
	err = a.Store.Pool.QueryRow(ctx, `
		INSERT INTO ai_studio.one_workflow_auto_quotes(run_id,start_step,step_caps,expires_at)
		VALUES ($1::uuid,$2,$3,$4) RETURNING id::text`, run.ID, quote.StartStep, quote.StepCaps, quote.ExpiresAt).
		Scan(&quote.ID)
	return quote, err
}

func (a Automation) stepQuote(ctx context.Context, owner string, step Step, params map[string]any) (*generation.QuoteResponse, error) {
	return a.Generation.CreateQuote(ctx, generation.QuoteRequest{UserID: owner, ModelID: step.ModelID, Site: "studio", Parameters: params})
}

func (s Store) Approve(ctx context.Context, owner, id, quoteID string) (Run, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return Run{}, err
	}
	defer tx.Rollback(ctx)
	// Coordinate with definition deletion, then with manual step submission and stopping.
	var definitionID string
	err = tx.QueryRow(ctx, `
		SELECT w.id::text FROM ai_studio.one_workflows w
		JOIN ai_studio.one_workflow_runs r ON r.workflow_id=w.id AND r.owner_user_id=w.owner_user_id
		WHERE r.id=$1::uuid AND r.owner_user_id=$2 AND w.deleted_at IS NULL FOR SHARE OF w`, id, owner).
		Scan(&definitionID)
	if err != nil {
		return Run{}, err
	}
	run, err := getRun(ctx, tx, owner, id, true)
	if err != nil {
		return Run{}, err
	}
	if run.automationID == quoteID {
		return run, tx.Commit(ctx)
	}
	if run.AutomationState == "active" {
		return Run{}, ErrActive
	}
	var start int
	var caps []int32
	err = tx.QueryRow(ctx, `
		SELECT start_step, step_caps FROM ai_studio.one_workflow_auto_quotes
		WHERE id=$1::uuid AND run_id=$2::uuid AND consumed_at IS NULL AND expires_at > now() FOR UPDATE`, quoteID, run.ID).
		Scan(&start, &caps)
	if errors.Is(err, pgx.ErrNoRows) {
		return Run{}, ErrAutoQuote
	}
	if err != nil {
		return Run{}, err
	}
	index, state := nextStep(run)
	if state != "ready" || start != index || len(caps) != len(run.Steps) {
		return Run{}, ErrAutoQuote
	}
	if _, err := tx.Exec(ctx, `
		UPDATE ai_studio.one_workflow_runs SET automation_state='active', automation_quote_id=$2::uuid,
		    automation_caps=$3, automation_reason=NULL, automation_poll_at=now() WHERE id=$1::uuid`, run.ID, quoteID, caps); err != nil {
		return Run{}, err
	}
	if _, err := tx.Exec(ctx, "UPDATE ai_studio.one_workflow_auto_quotes SET consumed_at=now() WHERE id=$1::uuid", quoteID); err != nil {
		return Run{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Run{}, err
	}
	run.AutomationState, run.AutomationCaps, run.AutomationError = "active", caps, ""
	return run, nil
}

func (s Store) Stop(ctx context.Context, owner, id string) (Run, error) {
	_, err := s.Pool.Exec(ctx, `
		UPDATE ai_studio.one_workflow_runs
		SET automation_state='stopped', automation_reason='WORKFLOW_USER_STOPPED', automation_poll_at=NULL
		WHERE id=$1::uuid AND owner_user_id=$2 AND automation_state='active'`, id, owner)
	if err != nil {
		return Run{}, err
	}
	return s.GetRun(ctx, owner, id)
}

type autoClaim struct {
	owner, run, approval string
}

// RunDue advances one approved run. Leases and idempotent step keys recover interrupted workers.
func (a Automation) RunDue(ctx context.Context) (bool, error) {
	var claim autoClaim
	err := a.Store.Pool.QueryRow(ctx, `
		WITH due AS (
			SELECT id FROM ai_studio.one_workflow_runs WHERE automation_state='active'
			  AND automation_poll_at <= now()
			ORDER BY automation_poll_at,id LIMIT 1 FOR UPDATE SKIP LOCKED
		)
		UPDATE ai_studio.one_workflow_runs r SET automation_poll_at=now()+interval '30 seconds'
		FROM due WHERE r.id=due.id
		RETURNING r.owner_user_id,r.id::text,r.automation_quote_id::text`).Scan(&claim.owner, &claim.run, &claim.approval)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	state, reason, retryErr := a.advance(ctx, claim)
	if state == "" {
		return true, retryErr
	}
	delay := 2
	if retryErr != nil {
		delay = 10
	}
	_, err = a.Store.Pool.Exec(ctx, `
		UPDATE ai_studio.one_workflow_runs SET automation_state=$3, automation_reason=NULLIF($4,''),
		  automation_poll_at=CASE WHEN $3='active' THEN now()+$5::int*interval '1 second' ELSE NULL END
		WHERE id=$1::uuid AND automation_quote_id=$2::uuid AND automation_state='active'`, claim.run, claim.approval, state, reason, delay)
	return true, errors.Join(retryErr, err)
}

func (a Automation) advance(ctx context.Context, claim autoClaim) (state, reason string, retry error) {
	run, err := a.Store.GetRun(ctx, claim.owner, claim.run)
	if err != nil {
		return "active", "", err
	}
	if run.AutomationState != "active" || run.automationID != claim.approval {
		return "", "", nil
	}
	index, state := nextStep(run)
	switch state {
	case "waiting":
		return "active", "", nil
	case "completed":
		return "completed", "", nil
	case "failed":
		return "stopped", "WORKFLOW_STEP_FAILED", nil
	}
	step, prompt, existing, err := a.Store.planStep(ctx, run, index)
	if err != nil {
		return automaticError(err)
	}
	if existing != nil {
		return "active", "", nil
	}
	if !generation.PromptAllowed(prompt) {
		return "stopped", "CONTENT_POLICY_VIOLATION", nil
	}
	params := map[string]any{"task_type": step.Mode, "prompt": prompt}
	quote, err := a.stepQuote(ctx, claim.owner, step, params)
	if err != nil {
		return automaticError(err)
	}
	if len(run.AutomationCaps) != len(run.Steps) || quote.Credits > int(run.AutomationCaps[index]) {
		return "stopped", "WORKFLOW_PRICE_CHANGED", nil
	}
	allowance, err := coordination.ConsumePostgresRateLimit(ctx, a.Store.Pool, coordination.RateLimitRequest{
		Scope: "generation_user", Subject: claim.owner, Limit: 60, Window: time.Hour,
	}, time.Now().UTC())
	if err != nil {
		return "active", "", err
	}
	if !allowance.Allowed {
		return "stopped", "WORKFLOW_RATE_LIMITED", nil
	}
	req := StepTaskRequest(claim.owner, run.ID, index, step, params, quote.QuoteID)
	req.WorkflowStep.ApprovalID = claim.approval
	if _, err := a.Generation.CreateTask(ctx, req); err != nil {
		return automaticError(err)
	}
	return "active", "", nil
}

func automaticError(err error) (string, string, error) {
	if errors.Is(err, ErrModel) {
		return "stopped", "WORKFLOW_MODEL_UNAVAILABLE", nil
	}
	if errors.Is(err, ErrBlocked) {
		return "stopped", "WORKFLOW_STEP_FAILED", nil
	}
	var pricing *generation.PricingError
	if errors.As(err, &pricing) && pricing.Status < 500 {
		if pricing.Code == "WORKFLOW_AUTO_INACTIVE" {
			return "", "", nil
		}
		return "stopped", pricing.Code, nil
	}
	return "active", "", err
}

func nextStep(run Run) (int, string) {
	jobs := make(map[string]Job, len(run.Jobs))
	for _, job := range run.Jobs {
		jobs[job.Label] = job
	}
	for i, step := range run.Steps {
		job, exists := jobs[StepLabel(i)]
		if !exists {
			return i, "ready"
		}
		switch job.Status {
		case "queued", "processing":
			return i, "waiting"
		case "succeeded":
			if (step.Mode == "t2t" && len(strings.TrimSpace(job.ResultText)) == 0) || (step.Mode == "t2i" && job.AssetID == "") {
				return i, "failed"
			}
		default:
			return i, "failed"
		}
	}
	return len(run.Steps), "completed"
}

func StepTaskRequest(owner, runID string, index int, step Step, params map[string]any, quoteID string) generation.CreateTaskRequest {
	studio, label := StudioPrefix+runID, StepLabel(index)
	return generation.CreateTaskRequest{
		UserID: owner, StudioID: studio, QuoteID: quoteID, ModelID: step.ModelID, Label: label,
		Parameters: params, RequireExactQuote: true, IdempotencyKey: studio + ":" + label,
		WorkflowStep: &generation.WorkflowStepSubmission{Index: index},
	}
}

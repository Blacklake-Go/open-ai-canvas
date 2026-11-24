package workflow

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrInvalid  = errors.New("invalid workflow")
	ErrConflict = errors.New("workflow revision changed")
	ErrBlocked  = errors.New("workflow step prerequisite unfinished")
	ErrModel    = errors.New("workflow model unavailable")
	ErrActive   = errors.New("workflow automatic execution is active")
	modelID     = regexp.MustCompile(`^[A-Za-z0-9._-]{1,128}$`)
)

const StudioPrefix = "workflow:"

type Step struct {
	Mode        string `json:"mode"`
	ModelID     string `json:"modelId"`
	Instruction string `json:"instruction"`
}

type Draft struct {
	Title string `json:"title"`
	Steps []Step `json:"steps"`
}

type Definition struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Steps     []Step    `json:"steps"`
	Revision  int       `json:"revision"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Run struct {
	ID              string    `json:"id"`
	WorkflowID      string    `json:"workflowId"`
	Revision        int       `json:"revision"`
	Title           string    `json:"title"`
	Input           string    `json:"input"`
	Steps           []Step    `json:"steps"`
	CreatedAt       time.Time `json:"createdAt"`
	Jobs            []Job     `json:"jobs"`
	AutomationState string    `json:"automationState"`
	AutomationCaps  []int32   `json:"automationCaps,omitempty"`
	AutomationError string    `json:"automationError,omitempty"`
	automationID    string
}

type Job struct {
	ID         string `json:"id"`
	Label      string `json:"label"`
	Status     string `json:"status"`
	Credits    int    `json:"credits"`
	ResultText string `json:"resultText"`
	AssetID    string `json:"assetId"`
	Error      string `json:"error"`
}

type Store struct {
	Pool *pgxpool.Pool
}

const definitionFields = "id::text, title, steps, revision, updated_at"
const runFields = "id::text, workflow_id::text, revision, title, input, steps, created_at, automation_state, automation_caps, COALESCE(automation_reason,''), COALESCE(automation_quote_id::text,'')"

func (d *Draft) Validate() error {
	d.Title = strings.TrimSpace(d.Title)
	if d.Title == "" || utf8.RuneCountInString(d.Title) > 120 || len(d.Steps) == 0 || len(d.Steps) > 6 {
		return ErrInvalid
	}
	for i := range d.Steps {
		step := &d.Steps[i]
		step.Instruction = strings.TrimSpace(step.Instruction)
		if (step.Mode != "t2t" && step.Mode != "t2i") || !modelID.MatchString(step.ModelID) || utf8.RuneCountInString(step.Instruction) > 2000 {
			return ErrInvalid
		}
		if i < len(d.Steps)-1 && step.Mode != "t2t" {
			return ErrInvalid
		}
	}
	return nil
}

func (s Store) List(ctx context.Context, owner string, offset int) ([]Definition, error) {
	rows, err := s.Pool.Query(ctx, "SELECT "+definitionFields+`
		FROM ai_studio.one_workflows WHERE owner_user_id=$1 AND deleted_at IS NULL
		ORDER BY updated_at DESC,id DESC LIMIT 25 OFFSET $2`, owner, offset)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByName[Definition])
}

func (s Store) Get(ctx context.Context, owner, id string) (Definition, error) {
	return scanDefinition(s.Pool.QueryRow(ctx, "SELECT "+definitionFields+
		" FROM ai_studio.one_workflows WHERE owner_user_id=$1 AND id=$2::uuid AND deleted_at IS NULL", owner, id))
}

func (s Store) Create(ctx context.Context, owner, key string, draft Draft) (Definition, error) {
	if err := draft.Validate(); err != nil {
		return Definition{}, err
	}
	return scanDefinition(s.Pool.QueryRow(ctx, `
		INSERT INTO ai_studio.one_workflows(owner_user_id,creation_key,title,steps)
		VALUES ($1,$2::uuid,$3,$4::jsonb)
		ON CONFLICT (owner_user_id,creation_key) DO UPDATE SET creation_key=EXCLUDED.creation_key
		WHERE ai_studio.one_workflows.deleted_at IS NULL
		RETURNING `+definitionFields, owner, key, draft.Title, draft.Steps))
}

func (s Store) Update(ctx context.Context, owner, id string, revision int, draft Draft) (Definition, error) {
	if err := draft.Validate(); err != nil {
		return Definition{}, err
	}
	result, err := scanDefinition(s.Pool.QueryRow(ctx, `
		UPDATE ai_studio.one_workflows SET title=$4,steps=$5::jsonb,revision=revision+1,updated_at=now()
		WHERE owner_user_id=$1 AND id=$2::uuid AND revision=$3 AND deleted_at IS NULL
		RETURNING `+definitionFields, owner, id, revision, draft.Title, draft.Steps))
	return result, s.resolveConflict(ctx, owner, id, err)
}

func (s Store) Delete(ctx context.Context, owner, id string, revision int) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var current int
	if err := tx.QueryRow(ctx, `
		SELECT revision FROM ai_studio.one_workflows WHERE owner_user_id=$1 AND id=$2::uuid
		AND deleted_at IS NULL FOR UPDATE`, owner, id).Scan(&current); err != nil {
		return err
	}
	if current != revision {
		return ErrConflict
	}
	var active bool
	err = tx.QueryRow(ctx, `
		SELECT EXISTS (SELECT 1 FROM ai_studio.one_workflow_runs WHERE workflow_id=$1::uuid
		AND owner_user_id=$2 AND automation_state='active')`, id, owner).Scan(&active)
	if err != nil {
		return err
	}
	if active {
		return ErrActive
	}
	if _, err := tx.Exec(ctx, "UPDATE ai_studio.one_workflows SET deleted_at=now() WHERE id=$1::uuid", id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s Store) resolveConflict(ctx context.Context, owner, id string, err error) error {
	if !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	if _, lookupErr := s.Get(ctx, owner, id); lookupErr != nil {
		return lookupErr
	}
	return ErrConflict
}

func scanDefinition(row pgx.Row) (Definition, error) {
	var result Definition
	err := row.Scan(&result.ID, &result.Title, &result.Steps, &result.Revision, &result.UpdatedAt)
	return result, err
}

func (s Store) CreateRun(ctx context.Context, owner, id, key string, revision int, input string) (Run, error) {
	input = strings.TrimSpace(input)
	if input == "" || utf8.RuneCountInString(input) > 2000 {
		return Run{}, ErrInvalid
	}
	existing, err := scanRun(s.Pool.QueryRow(ctx, "SELECT "+runFields+
		" FROM ai_studio.one_workflow_runs WHERE owner_user_id=$1 AND creation_key=$2::uuid", owner, key))
	if err == nil {
		if existing.WorkflowID != id || existing.Revision != revision || existing.Input != input {
			return Run{}, ErrConflict
		}
		return s.GetRun(ctx, owner, existing.ID)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return Run{}, err
	}
	run, err := scanRun(s.Pool.QueryRow(ctx, `
		INSERT INTO ai_studio.one_workflow_runs(workflow_id,owner_user_id,creation_key,revision,title,input,steps)
		SELECT id,owner_user_id,$4::uuid,revision,title,$5,steps FROM ai_studio.one_workflows
		WHERE owner_user_id=$1 AND id=$2::uuid AND revision=$3 AND deleted_at IS NULL
		ON CONFLICT (owner_user_id,creation_key) DO UPDATE SET creation_key=EXCLUDED.creation_key
		RETURNING `+runFields, owner, id, revision, key, input))
	if err == nil && (run.WorkflowID != id || run.Revision != revision || run.Input != input) {
		return Run{}, ErrConflict
	}
	return run, s.resolveConflict(ctx, owner, id, err)
}

func (s Store) Runs(ctx context.Context, owner, id string) ([]Run, error) {
	if _, err := s.Get(ctx, owner, id); err != nil {
		return nil, err
	}
	rows, err := s.Pool.Query(ctx, "SELECT "+runFields+`
		FROM ai_studio.one_workflow_runs WHERE owner_user_id=$1 AND workflow_id=$2::uuid
		ORDER BY created_at DESC,id DESC LIMIT 25`, owner, id)
	if err != nil {
		return nil, err
	}
	items := []Run{}
	defer rows.Close()
	for rows.Next() {
		run, err := scanRun(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, run)
	}
	return items, rows.Err()
}

func (s Store) GetRun(ctx context.Context, owner, id string) (Run, error) {
	return getRun(ctx, s.Pool, owner, id, false)
}

type runReader interface {
	QueryRow(context.Context, string, ...any) pgx.Row
	Query(context.Context, string, ...any) (pgx.Rows, error)
}

func getRun(ctx context.Context, db runReader, owner, id string, lock bool) (Run, error) {
	query := "SELECT " + runFields + " FROM ai_studio.one_workflow_runs WHERE owner_user_id=$1 AND id=$2::uuid"
	if lock {
		query += " FOR UPDATE"
	}
	run, err := scanRun(db.QueryRow(ctx, query, owner, id))
	if err != nil {
		return Run{}, err
	}
	rows, err := db.Query(ctx, `
		SELECT id, label, status, credit_cost AS credits, COALESCE(result_text,'') AS result_text,
		       COALESCE(asset_id,'') AS asset_id, COALESCE(error_reason,'') AS error
		FROM ai_studio.creations WHERE user_id=$1 AND studio_id=$2 AND label LIKE 'workflow-step-%'
		ORDER BY created_at ASC,id ASC`, owner, StudioPrefix+run.ID)
	if err != nil {
		return Run{}, err
	}
	run.Jobs, err = pgx.CollectRows(rows, pgx.RowToStructByName[Job])
	return run, err
}

func scanRun(row pgx.Row) (Run, error) {
	var result Run
	err := row.Scan(&result.ID, &result.WorkflowID, &result.Revision, &result.Title, &result.Input, &result.Steps, &result.CreatedAt,
		&result.AutomationState, &result.AutomationCaps, &result.AutomationError, &result.automationID)
	return result, err
}

func StepLabel(index int) string { return fmt.Sprintf("workflow-step-%d", index+1) }

func (s Store) Plan(ctx context.Context, owner, id string, index int) (Run, Step, string, *Job, error) {
	run, err := s.GetRun(ctx, owner, id)
	if err != nil {
		return Run{}, Step{}, "", nil, err
	}
	step, prompt, job, err := s.planStep(ctx, run, index)
	return run, step, prompt, job, err
}

func (s Store) planStep(ctx context.Context, run Run, index int) (Step, string, *Job, error) {
	if index < 0 || index >= len(run.Steps) {
		return Step{}, "", nil, ErrInvalid
	}
	step := run.Steps[index]
	var previous *Job
	for i := range run.Jobs {
		job := &run.Jobs[i]
		switch job.Label {
		case StepLabel(index):
			return step, "", job, nil
		case StepLabel(index - 1):
			previous = job
		}
	}
	input := run.Input
	if index > 0 {
		if previous == nil || previous.Status != "succeeded" || strings.TrimSpace(previous.ResultText) == "" {
			return Step{}, "", nil, ErrBlocked
		}
		input = strings.TrimSpace(previous.ResultText)
		if chars := []rune(input); len(chars) > 8000 {
			input = string(chars[:8000])
		}
	}
	if err := s.checkModel(ctx, step); err != nil {
		return Step{}, "", nil, err
	}
	if step.Instruction != "" {
		input = step.Instruction + "\n\n" + input
	}
	return step, input, nil, nil
}

func (s Store) checkModel(ctx context.Context, step Step) error {
	category := "text"
	if step.Mode == "t2i" {
		category = "image"
	}
	var available bool
	err := s.Pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM ai_studio.ai_models m
		JOIN ai_studio.provider_models pm ON pm.model_id=m.id
		JOIN ai_studio.ai_providers p ON p.id=pm.provider_id
		WHERE m.id=$1 AND m.category=$2 AND m.status='active' AND m.is_visible AND m.auto_route_eligible
		  AND ($3='t2t' OR (m.capabilities->'modes') ? $3) AND pm.enabled AND p.enabled
		  AND NULLIF(BTRIM(pm.provider_endpoint),'') IS NOT NULL AND COALESCE(p.circuit_state,'closed') NOT IN ('open','circuit_open'))`,
		step.ModelID, category, step.Mode).Scan(&available)
	if err != nil {
		return err
	}
	if !available {
		return ErrModel
	}
	return nil
}

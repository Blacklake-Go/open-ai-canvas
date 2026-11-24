package handler

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"one/backend/internal/domain/generation"
	"one/backend/internal/domain/workflow"
	"one/backend/internal/middleware"
	"one/backend/internal/pkg/envelope"
)

type oneWorkflows struct {
	deps  *Dependencies
	store workflow.Store
}

type workflowAction func(http.ResponseWriter, *http.Request, string) (any, error)

func init() {
	registerBatch(func(d *Dependencies, mount mountFunc) {
		api := oneWorkflows{deps: d, store: workflow.Store{Pool: d.Pool}}
		const base = "/api/one/workflows"
		mount("GET", base, api.protect(api.list))
		mount("POST", base, api.protect(api.create))
		mount("GET", base+"/[id]", api.protect(api.read))
		mount("PUT", base+"/[id]", api.protect(api.update))
		mount("DELETE", base+"/[id]", api.protect(api.remove))
		mount("GET", base+"/[id]/runs", api.protect(api.listRuns))
		mount("POST", base+"/[id]/runs", api.protect(api.createRun))
		mount("GET", base+"/runs/[id]", api.protect(api.readRun))
		mount("POST", base+"/runs/[id]/steps/[index]/quote", api.protect(api.quoteStep))
		mount("POST", base+"/runs/[id]/steps/[index]", api.protect(api.submitStep))
		mount("POST", base+"/runs/[id]/automatic/quote", api.protect(api.quoteAutomatic))
		mount("POST", base+"/runs/[id]/automatic", api.protect(api.approveAutomatic))
		mount("DELETE", base+"/runs/[id]/automatic", api.protect(api.stopAutomatic))
	})
}

func (api oneWorkflows) protect(next workflowAction) http.Handler {
	return middleware.RequireAuth(api.deps.SessionAuth)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "private, no-store")
		user, _ := middleware.UserFromContext(r.Context())
		if expected := r.Header.Get("X-ONE-Expected-User"); expected != "" && expected != user.ID {
			envelope.DomainError(w, 409, "登录账户已更改", "WORKFLOW_ACCOUNT_CHANGED")
			return
		}
		if api.store.Pool == nil {
			envelope.DomainError(w, 503, "工作流服务暂不可用", "WORKFLOW_UNAVAILABLE")
			return
		}
		if id := r.PathValue("id"); id != "" && !workshopUUID.MatchString(id) {
			writeWorkflowError(w, r, pgx.ErrNoRows)
			return
		}
		value, err := next(w, r, user.ID)
		if err != nil {
			writeWorkflowError(w, r, err)
		} else if value != nil {
			envelope.DomainJSON(w, http.StatusOK, value)
		}
	}))
}

func writeWorkflowError(w http.ResponseWriter, r *http.Request, err error) {
	var pricing *generation.PricingError
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		envelope.DomainError(w, 404, "找不到工作流或运行记录", "WORKFLOW_NOT_FOUND")
	case errors.Is(err, workflow.ErrInvalid):
		envelope.DomainError(w, 422, "工作流内容无效", "WORKFLOW_INVALID")
	case errors.Is(err, workflow.ErrConflict):
		envelope.DomainError(w, 409, "工作流已更新，请重新打开后再保存", "WORKFLOW_CONFLICT")
	case errors.Is(err, workflow.ErrBlocked):
		envelope.DomainError(w, 409, "请先完成上一步并获得文本结果", "WORKFLOW_STEP_BLOCKED")
	case errors.Is(err, workflow.ErrModel):
		envelope.DomainError(w, 422, "此步骤的模型当前不可用", "WORKFLOW_MODEL_UNAVAILABLE")
	case errors.Is(err, workflow.ErrActive):
		envelope.DomainError(w, 409, "请先停止自动运行", "WORKFLOW_AUTO_ACTIVE")
	case errors.Is(err, workflow.ErrAutoQuote):
		envelope.DomainError(w, 409, "自动运行报价已过期或状态已变化，请重新报价", "WORKFLOW_AUTO_QUOTE_EXPIRED")
	case errors.Is(err, workflow.ErrNotReady):
		envelope.DomainError(w, 409, "当前没有可以开始执行的工作流步骤", "WORKFLOW_AUTO_NOT_READY")
	case errors.As(err, &pricing):
		coreWriteGenErr(w, r, envelope.FormatDirectDomainJSON, err, "WORKFLOW_UNAVAILABLE", "工作流服务暂不可用")
	default:
		slog.Error("one workflow operation failed", "error", err)
		envelope.DomainError(w, 503, "工作流服务暂不可用", "WORKFLOW_UNAVAILABLE")
	}
}

func (api oneWorkflows) list(_ http.ResponseWriter, r *http.Request, owner string) (any, error) {
	var offset int
	if raw := r.URL.Query().Get("offset"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 0 || n > 10000 {
			return nil, workflow.ErrInvalid
		}
		offset = n
	}
	return api.store.List(r.Context(), owner, offset)
}

func (api oneWorkflows) create(w http.ResponseWriter, r *http.Request, owner string) (any, error) {
	var input struct {
		workflow.Draft
		CreationKey string `json:"creationKey"`
	}
	if !decodeWorkshopDraft(w, r, &input) || !workshopUUID.MatchString(input.CreationKey) {
		return nil, workflow.ErrInvalid
	}
	return api.store.Create(r.Context(), owner, input.CreationKey, input.Draft)
}

func (api oneWorkflows) read(_ http.ResponseWriter, r *http.Request, owner string) (any, error) {
	return api.store.Get(r.Context(), owner, r.PathValue("id"))
}

func (api oneWorkflows) update(w http.ResponseWriter, r *http.Request, owner string) (any, error) {
	var input struct {
		workflow.Draft
		Revision int `json:"revision"`
	}
	if !decodeWorkshopDraft(w, r, &input) || input.Revision < 1 || input.Revision >= 1<<31-1 {
		return nil, workflow.ErrInvalid
	}
	return api.store.Update(r.Context(), owner, r.PathValue("id"), input.Revision, input.Draft)
}

func (api oneWorkflows) remove(w http.ResponseWriter, r *http.Request, owner string) (any, error) {
	revision, err := strconv.ParseInt(r.URL.Query().Get("revision"), 10, 32)
	if err != nil || revision < 1 {
		return nil, workflow.ErrInvalid
	}
	if err := api.store.Delete(r.Context(), owner, r.PathValue("id"), int(revision)); err != nil {
		return nil, err
	}
	w.WriteHeader(http.StatusNoContent)
	return nil, nil
}

func (api oneWorkflows) listRuns(_ http.ResponseWriter, r *http.Request, owner string) (any, error) {
	return api.store.Runs(r.Context(), owner, r.PathValue("id"))
}

func (api oneWorkflows) createRun(w http.ResponseWriter, r *http.Request, owner string) (any, error) {
	var input struct {
		Revision    int    `json:"revision"`
		Input       string `json:"input"`
		CreationKey string `json:"creationKey"`
	}
	if !decodeWorkshopDraft(w, r, &input) || !workshopUUID.MatchString(input.CreationKey) || input.Revision < 1 || input.Revision >= 1<<31-1 {
		return nil, workflow.ErrInvalid
	}
	return api.store.CreateRun(r.Context(), owner, strings.ToLower(r.PathValue("id")), input.CreationKey, input.Revision, input.Input)
}

func (api oneWorkflows) readRun(_ http.ResponseWriter, r *http.Request, owner string) (any, error) {
	return api.store.GetRun(r.Context(), owner, r.PathValue("id"))
}

func (api oneWorkflows) quoteStep(w http.ResponseWriter, r *http.Request, owner string) (any, error) {
	const format = envelope.FormatDirectDomainJSON
	if !coreLimitOr503(w, r, api.deps, format, "generation_quote_user", owner, 60, time.Hour) {
		return nil, nil
	}
	key := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
	if !workshopUUID.MatchString(key) {
		return nil, workflow.ErrInvalid
	}
	run, step, params, existing, err := api.plan(r, owner)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return map[string]any{"job": existing}, nil
	}
	if run.AutomationState == "active" {
		return nil, workflow.ErrActive
	}
	result, err := api.deps.generationSvc(api.store.Pool).CreateQuote(r.Context(), generation.QuoteRequest{
		UserID: owner, ModelID: step.ModelID, Site: "studio", Parameters: params, IdempotencyKey: "workflow-quote:" + key,
	})
	if err != nil {
		return nil, err
	}
	return map[string]any{"quoteId": result.QuoteID, "credits": result.Credits, "modelId": result.ModelID, "expiresAt": result.ExpiresAt}, nil
}

func (api oneWorkflows) submitStep(w http.ResponseWriter, r *http.Request, owner string) (any, error) {
	const format = envelope.FormatDirectDomainJSON
	if !coreLimitOr503(w, r, api.deps, format, "generation_user", owner, 60, time.Hour) {
		return nil, nil
	}
	var input struct {
		QuoteID string `json:"quoteId"`
	}
	if !decodeWorkshopDraft(w, r, &input) || input.QuoteID == "" || len(input.QuoteID) > 160 {
		return nil, workflow.ErrInvalid
	}
	run, step, params, existing, err := api.plan(r, owner)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return map[string]any{"id": existing.ID, "status": existing.Status, "credits": existing.Credits, "idempotent": true}, nil
	}
	index, _ := strconv.Atoi(r.PathValue("index"))
	return api.deps.generationSvc(api.store.Pool).CreateTask(r.Context(),
		workflow.StepTaskRequest(owner, run.ID, index, step, params, input.QuoteID))
}

func (api oneWorkflows) quoteAutomatic(w http.ResponseWriter, r *http.Request, owner string) (any, error) {
	if !coreLimitOr503(w, r, api.deps, envelope.FormatDirectDomainJSON, "workflow_auto_quote", owner, 12, time.Hour) {
		return nil, nil
	}
	automation := workflow.Automation{Store: api.store, Generation: api.deps.generationSvc(api.store.Pool)}
	return automation.Quote(r.Context(), owner, r.PathValue("id"))
}

func (api oneWorkflows) approveAutomatic(w http.ResponseWriter, r *http.Request, owner string) (any, error) {
	var input struct {
		QuoteID string `json:"quoteId"`
	}
	if !decodeWorkshopDraft(w, r, &input) || !workshopUUID.MatchString(input.QuoteID) {
		return nil, workflow.ErrInvalid
	}
	return api.store.Approve(r.Context(), owner, r.PathValue("id"), strings.ToLower(input.QuoteID))
}

func (api oneWorkflows) stopAutomatic(_ http.ResponseWriter, r *http.Request, owner string) (any, error) {
	return api.store.Stop(r.Context(), owner, r.PathValue("id"))
}

func (api oneWorkflows) plan(r *http.Request, owner string) (workflow.Run, workflow.Step, map[string]any, *workflow.Job, error) {
	index, err := strconv.Atoi(r.PathValue("index"))
	if err != nil {
		return workflow.Run{}, workflow.Step{}, nil, nil, workflow.ErrInvalid
	}
	run, step, prompt, existing, err := api.store.Plan(r.Context(), owner, r.PathValue("id"), index)
	if err != nil || existing != nil {
		return run, step, nil, existing, err
	}
	if !corePromptOkay(prompt) {
		return run, step, nil, nil, &generation.PricingError{
			Code: "CONTENT_POLICY_VIOLATION", Status: 422, Message: "请调整此步骤的输入内容",
		}
	}
	return run, step, map[string]any{"task_type": step.Mode, "prompt": prompt}, nil, nil
}

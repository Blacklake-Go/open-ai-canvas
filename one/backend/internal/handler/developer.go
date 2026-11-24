package handler

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"one/backend/internal/domain/developer"
	"one/backend/internal/middleware"
	"one/backend/internal/pkg/envelope"
)

func init() {
	registerBatch(func(d *Dependencies, mount mountFunc) {
		handleKey := middleware.RequireAuth(d.SessionAuth)(http.HandlerFunc(d.handleUserAPIKey))
		for _, method := range []string{http.MethodGet, http.MethodPost, http.MethodDelete} {
			mount(method, "/api/user/api-key", handleKey)
		}
		const base = "/api/developer/v1"
		mount(http.MethodGet, base+"/models", d.requireDeveloperKey(http.HandlerFunc(d.handleModelsActive)))
		mount(http.MethodGet, base+"/wallet", d.requireDeveloperKey(http.HandlerFunc(d.handleFinancialCreditsWallet)))
		mount(http.MethodPost, base+"/generations/quote", d.developerGenerationWrite(d.coreGenerationQuote))
		mount(http.MethodPost, base+"/generations", d.developerGenerationWrite(d.coreGenerationsCreate))
		mount(http.MethodGet, base+"/generations/[id]", d.requireDeveloperKey(http.HandlerFunc(d.handleDeveloperGeneration)))
		mount(http.MethodGet, base+"/generations/[id]/result", d.requireDeveloperKey(http.HandlerFunc(d.handleDeveloperGenerationResult)))
	})
}

func (d *Dependencies) handleUserAPIKey(w http.ResponseWriter, r *http.Request) {
	const format = envelope.FormatSuccessFlaggedJSON
	w.Header().Set("Cache-Control", "private, no-store")
	u, _ := middleware.UserFromContext(r.Context())
	if !coreExpectedOwner(w, r, format, u.ID, "DEVELOPER_ACCOUNT_CHANGED") {
		return
	}
	pool, ok := coreDB(d, w, r, format)
	if !ok {
		return
	}
	store := developer.Store{Pool: pool}
	ctx := r.Context()
	if r.Method == http.MethodGet {
		info, err := store.CurrentKey(ctx, u.ID)
		if err != nil {
			d.writeDeveloperKeyError(w, r, err)
			return
		}
		envelope.SuccessJSON(w, http.StatusOK, map[string]any{"keyInfo": info})
		return
	}

	if r.Method == http.MethodPost && u.Status != "" && u.Status != "active" {
		coreErr(w, r, format, http.StatusForbidden, "DEVELOPER_ACCOUNT_INACTIVE", "账户当前无法签发 API 密钥")
		return
	}
	if !coreLimitOr503(w, r, d, format, "developer_key_write", u.ID, 20, time.Minute) {
		return
	}
	var body struct {
		PreviousKeyID string `json:"previousKeyId"`
	}
	if !decodeJSONBody(w, r, 4096, &body) {
		return
	}
	previousID := strings.TrimSpace(body.PreviousKeyID)
	if (previousID != "" && !workshopUUID.MatchString(previousID)) || (r.Method == http.MethodDelete && previousID == "") {
		coreErr(w, r, format, http.StatusBadRequest, "DEVELOPER_KEY_ID_INVALID", "API 密钥标识无效")
		return
	}
	if r.Method == http.MethodDelete {
		if err := store.RevokeKey(ctx, u.ID, previousID); err != nil {
			d.writeDeveloperKeyError(w, r, err)
			return
		}
		envelope.SuccessJSON(w, http.StatusOK, map[string]any{"keyInfo": nil})
		return
	}
	info, key, err := store.IssueKey(ctx, u.ID, previousID)
	if err != nil {
		d.writeDeveloperKeyError(w, r, err)
		return
	}
	envelope.SuccessJSON(w, http.StatusCreated, map[string]any{"keyInfo": info, "apiKey": key})
}

func (d *Dependencies) writeDeveloperKeyError(w http.ResponseWriter, r *http.Request, err error) {
	const format = envelope.FormatSuccessFlaggedJSON
	if errors.Is(err, developer.ErrKeyChanged) {
		coreErr(w, r, format, http.StatusConflict, "DEVELOPER_KEY_CHANGED", "API 密钥已变更，请刷新后重试")
		return
	}
	coreErr(w, r, format, http.StatusServiceUnavailable, "DEVELOPER_KEY_UNAVAILABLE", "API 密钥服务暂不可用")
}

func (d *Dependencies) requireDeveloperKey(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "private, no-store")
		const format = envelope.FormatDirectDomainJSON
		fields := strings.Fields(r.Header.Get("Authorization"))
		deny := func() {
			w.Header().Set("WWW-Authenticate", `Bearer realm="SupDance Developer API"`)
			coreErr(w, r, format, http.StatusUnauthorized, "DEVELOPER_KEY_REQUIRED", "需要有效的开发者 API 密钥")
		}
		if len(fields) != 2 || !strings.EqualFold(fields[0], "Bearer") || len(r.Header.Values("Authorization")) != 1 {
			deny()
			return
		}
		pool, ok := coreDB(d, w, r, format)
		if !ok {
			return
		}
		owner, err := (developer.Store{Pool: pool}).Authenticate(r.Context(), fields[1])
		if errors.Is(err, developer.ErrInvalidKey) {
			deny()
			return
		}
		if err != nil {
			coreErr(w, r, format, http.StatusServiceUnavailable, "DEVELOPER_KEY_UNAVAILABLE", "API 密钥服务暂不可用")
			return
		}
		u := &middleware.SessionUser{ID: owner, Role: "user", Status: "active"}
		next.ServeHTTP(w, r.WithContext(middleware.ContextWithUser(r.Context(), u)))
	})
}

func (d *Dependencies) developerGenerationWrite(handler func(http.ResponseWriter, *http.Request, *Dependencies, *middleware.SessionUser)) http.Handler {
	return d.requireDeveloperKey(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if key := strings.TrimSpace(r.Header.Get("Idempotency-Key")); len(key) < 8 || len(key) > 200 || len(r.Header.Values("Idempotency-Key")) != 1 {
			coreErr(w, r, envelope.FormatDirectDomainJSON, http.StatusUnprocessableEntity, "IDEMPOTENCY_REQUIRED", "请提供有效的 Idempotency-Key")
			return
		}
		u, _ := middleware.UserFromContext(r.Context())
		handler(w, r, d, u)
	}))
}

func (d *Dependencies) handleDeveloperGeneration(w http.ResponseWriter, r *http.Request) {
	const format = envelope.FormatDirectDomainJSON
	pool, ok := coreDB(d, w, r, format)
	if !ok {
		return
	}
	u, _ := middleware.UserFromContext(r.Context())
	id := pathParam(r, "id")
	var status, model, resultText, storageStatus string
	var hasStoredResult bool
	var credits int
	var createdAt time.Time
	var completedAt *time.Time
	err := pool.QueryRow(r.Context(), `
		SELECT status, COALESCE(model,''), COALESCE(credit_cost,0), created_at, completed_at,
		       COALESCE(result_object_key,'') <> '', COALESCE(result_text,''), COALESCE(storage_status,'')
		FROM ai_studio.creations WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, id, u.ID).
		Scan(&status, &model, &credits, &createdAt, &completedAt, &hasStoredResult, &resultText, &storageStatus)
	if coreIsNoRows(err) {
		coreErr(w, r, format, http.StatusNotFound, "TASK_NOT_FOUND", "找不到任务")
		return
	}
	if err != nil {
		coreErr(w, r, format, http.StatusServiceUnavailable, "GENERATION_READ_FAILED", "读取生成任务失败，请稍后重试")
		return
	}
	result := map[string]any{
		"id": id, "modelId": model, "status": status, "credits": credits,
		"createdAt": createdAt.UTC(), "completedAt": completedAt, "storageStatus": storageStatus,
	}
	if status == "succeeded" {
		if hasStoredResult {
			result["resultPath"] = "/api/developer/v1/generations/" + id + "/result"
		}
		if resultText != "" {
			result["resultText"] = resultText
		}
	}
	envelope.DomainJSON(w, http.StatusOK, result)
}

func (d *Dependencies) handleDeveloperGenerationResult(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserFromContext(r.Context())
	d.streamStoredGeneration(w, r, u, false)
}

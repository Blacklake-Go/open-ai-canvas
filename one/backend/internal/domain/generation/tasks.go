package generation

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	ai "one/backend/internal/adapters/ai"
	"one/backend/internal/config"
	"one/backend/internal/domain/canvas"
	"one/backend/internal/queue"
	"one/backend/internal/storage"
)

type CreateTaskRequest struct {
	UserID            string
	StudioID          string
	QuoteID           string
	ModelID           string
	Label             string
	Parameters        map[string]any
	IdempotencyKey    string
	ProjectID         string // optional canvas_project_jobs link
	NodeID            string // optional canvas_project_jobs link
	RequireExactQuote bool
	WorkflowStep      *WorkflowStepSubmission
}

type CreateTaskResult struct {
	CreationID    string `json:"id"`
	Status        string `json:"status"`
	Credits       int    `json:"credits"`
	ReservationID string `json:"reservationId,omitempty"`
	Idempotent    bool   `json:"idempotent,omitempty"`
}

// CreateTask atomically verifies/consumes quote, reserves user credits, writes creation +
// optional canvas_project_jobs row + initial event, and notifies worker wakeup channel.
func (s *Service) CreateTask(ctx context.Context, req CreateTaskRequest) (*CreateTaskResult, error) {
	if s == nil || s.Pool == nil {
		return nil, &PricingError{Code: "DB_UNAVAILABLE", Message: "数据库不可用", Status: 503}
	}
	pool := s.Pool
	kind, conversationID, hasConversationID := strings.Cut(req.StudioID, ":")
	isConversation := hasConversationID && (kind == "design-agent" || kind == "agent-chat")

	if req.IdempotencyKey != "" && !isConversation && !req.RequireExactQuote {
		var existingID, existingStatus string
		var credits int
		err := pool.QueryRow(ctx, `
			SELECT id, status, credit_cost FROM ai_studio.creations
			WHERE user_id = $1 AND idempotency_key = $2 LIMIT 1`, req.UserID, req.IdempotencyKey).
			Scan(&existingID, &existingStatus, &credits)
		if err == nil {
			return &CreateTaskResult{CreationID: existingID, Status: existingStatus, Credits: credits, Idempotent: true}, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, &PricingError{Code: "GENERATION_CREATE_FAILED", Message: "创建生成任务失败", Status: 503}
		}
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, &PricingError{Code: "GENERATION_CREATE_FAILED", Message: "创建生成任务失败", Status: 503}
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if req.RequireExactQuote && req.IdempotencyKey != "" {
		if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", req.UserID+":"+req.IdempotencyKey); err != nil {
			return nil, &PricingError{Code: "GENERATION_CREATE_FAILED", Message: "暂时无法同步任务，请重试", Status: 503}
		}
		var existing CreateTaskResult
		err := tx.QueryRow(ctx, `
			SELECT id,status,credit_cost FROM ai_studio.creations WHERE user_id=$1 AND idempotency_key=$2
			AND studio_id=$3 LIMIT 1`, req.UserID, req.IdempotencyKey, req.StudioID).
			Scan(&existing.CreationID, &existing.Status, &existing.Credits)
		if err == nil {
			existing.Idempotent = true
			return &existing, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, &PricingError{Code: "GENERATION_CREATE_FAILED", Message: "暂时无法读取任务，请重试", Status: 503}
		}
	}

	if isConversation {
		existing, err := s.prepareConversationTurn(ctx, tx, &req, kind, conversationID)
		if err != nil || existing != nil {
			return existing, err
		}
	}

	workflowCap, err := lockWorkflowStep(ctx, tx, req)
	if err != nil {
		return nil, err
	}

	var qModel string
	var qCredits int
	var qExpires time.Time
	var qConsumed *time.Time
	var qEstCost *float64
	var qMatches bool
	var rsRaw []byte
	var quotedParameters *string
	mode, _ := req.Parameters["task_type"].(string)
	workshop := req.StudioID == "workshop"
	if workshop || req.RequireExactQuote || designMediaCreation(req.StudioID, mode) != "" {
		raw, err := json.Marshal(req.Parameters)
		if err != nil {
			return nil, &PricingError{Code: "DESIGN_AGENT_INVALID_INPUT", Message: "技能参数无效", Status: 422}
		}
		serialized := string(raw)
		quotedParameters = &serialized
	}
	err = tx.QueryRow(ctx, `
		SELECT model_id, credits_quoted, expires_at, consumed_at, estimated_provider_cost_usd,
		       COALESCE(route_snapshot_json,'{}'::jsonb), $3::jsonb IS NULL OR parameters_json=$3::jsonb
		FROM ai_studio.generation_quotes
		WHERE id = $1 AND user_id = $2 FOR UPDATE`, req.QuoteID, req.UserID, quotedParameters).
		Scan(&qModel, &qCredits, &qExpires, &qConsumed, &qEstCost, &rsRaw, &qMatches)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, &PricingError{Code: "QUOTE_MISMATCH", Message: "报价不存在或不属于当前用户", Status: 422}
	}
	if err != nil {
		return nil, &PricingError{Code: "GENERATION_CREATE_FAILED", Message: "创建生成任务失败", Status: 503}
	}
	now := time.Now().UTC()
	if qConsumed != nil || qExpires.Before(now) {
		return nil, &PricingError{Code: "QUOTE_MISMATCH", Message: "报价已使用或已过期", Status: 409}
	}
	if !qMatches {
		return nil, &PricingError{Code: "QUOTE_MISMATCH", Message: "任务参数与报价不一致，请重新报价", Status: 409}
	}
	if workflowCap != nil && qCredits > int(*workflowCap) {
		return nil, &PricingError{Code: "WORKFLOW_PRICE_CHANGED", Status: 409, Message: "步骤报价超过已确认的积分上限"}
	}
	modelID := req.ModelID
	if modelID == "" {
		modelID = qModel
	}
	if modelID != qModel {
		return nil, &PricingError{Code: "QUOTE_MISMATCH", Message: "生成模型与报价不一致", Status: 409}
	}
	var routeSnap map[string]any
	_ = json.Unmarshal(rsRaw, &routeSnap)
	if isWorkshopQuote := routeSnap["site"] == "workshop"; workshop != isWorkshopQuote {
		return nil, &PricingError{Code: "QUOTE_MISMATCH", Message: "报价与当前工作台不一致，请重新报价。", Status: 422}
	}

	creationID := randomHexID("gen")
	var reservationID string
	if qCredits > 0 {
		resIdem := req.IdempotencyKey
		if resIdem == "" {
			resIdem = "create:" + creationID
		}
		res, err := ReserveCredits(ctx, tx, ReserveRequest{
			UserID:         req.UserID,
			StudioID:       req.StudioID,
			ModelID:        modelID,
			Amount:         qCredits,
			IdempotencyKey: "task:" + resIdem,
			CreationID:     creationID,
			TTL:            30 * time.Minute,
		})
		if err != nil {
			if errors.Is(err, ErrInsufficientCredits) {
				return nil, &PricingError{Code: "INSUFFICIENT_CREDITS", Message: "账户积分余额不足，请充值后再生成", Status: 402}
			}
			return nil, &PricingError{Code: "CREDIT_RESERVATION_FAILED", Message: "积分预扣失败: " + err.Error(), Status: 409}
		}
		reservationID = res.ReservationID
	}

	selProvider, _ := routeSnap["selectedProviderId"].(string)
	routingMode, _ := routeSnap["routingMode"].(string)

	studioID := req.StudioID
	if studioID == "" {
		studioID = "studio"
	}
	paramsBytes, _ := json.Marshal(req.Parameters)
	metaBytes, _ := json.Marshal(map[string]any{
		"parameters":    req.Parameters,
		"routeSnapshot": routeSnap,
	})

	_, err = tx.Exec(ctx, `
		INSERT INTO ai_studio.creations
			(id, user_id, studio_id, label, status, credit_cost, model, provider, selected_provider_id,
			 routing_mode, estimated_cost_usd, reservation_id, quote_id, idempotency_key,
			 input_summary_json, metadata_json, created_at, updated_at)
		VALUES ($1,$2,$3,$4,'queued',$5,$6,$7::text,$7::text,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15,$15)`,
		creationID, req.UserID, studioID, nullableStr(req.Label), qCredits, modelID, nullableStr(selProvider),
		nullableStr(routingMode), qEstCost, nullableStr(reservationID), req.QuoteID, nullableStr(req.IdempotencyKey),
		string(paramsBytes), string(metaBytes), now)
	if err != nil {
		return nil, &PricingError{Code: "GENERATION_CREATE_FAILED", Message: "创建生成任务失败", Status: 409}
	}

	if req.ProjectID != "" && req.NodeID != "" {
		_, err = tx.Exec(ctx, `
			INSERT INTO ai_studio.canvas_project_jobs
				(job_id, project_id, owner_user_id, node_id, model_id, idempotency_key, status, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,'queued',$7,$7)
			ON CONFLICT DO NOTHING`,
			creationID, req.ProjectID, req.UserID, req.NodeID, modelID, req.IdempotencyKey, now)
		if err != nil {
			return nil, &PricingError{Code: "GENERATION_CREATE_FAILED", Message: "创建画布任务记录失败", Status: 409}
		}
	}

	if _, err := tx.Exec(ctx, `UPDATE ai_studio.generation_quotes SET consumed_at = $2 WHERE id = $1 AND consumed_at IS NULL`, req.QuoteID, now); err != nil {
		return nil, err
	}
	recordGenerationEventPG(ctx, tx, creationID, req.UserID, "TASK_CREATED", "", "queued", reservationID, selProvider, "", req.IdempotencyKey, map[string]any{"credits": qCredits})
	if err := tx.Commit(ctx); err != nil {
		return nil, &PricingError{Code: "GENERATION_CREATE_FAILED", Message: "提交生成任务失败", Status: 409}
	}

	s.NotifyWorker()
	if s.Events != nil {
		_ = s.Events.PublishPG(ctx, pool, queue.GenerationEvent{
			Type: "generation.queued", UserID: req.UserID, TaskID: creationID, Status: "queued",
		})
	}
	return &CreateTaskResult{CreationID: creationID, Status: "queued", Credits: qCredits, ReservationID: reservationID}, nil
}

func (s *Service) NotifyWorker() {
	if s != nil && s.Wakeup != nil {
		select {
		case s.Wakeup <- struct{}{}:
		default:
		}
	}
}

func recordGenerationEventPG(ctx context.Context, exec interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, creationID, userID, eventType, fromStatus, toStatus, reservationID, provider, providerReqID, idem string, meta map[string]any) {
	metaBytes, _ := json.Marshal(meta)
	if len(metaBytes) == 0 {
		metaBytes = []byte("{}")
	}
	_ = exec.QueryRow(ctx, `
		INSERT INTO ai_studio.generation_events
			(id, creation_id, user_id, event_type, from_status, to_status,
			 reservation_id, provider, provider_request_id, idempotency_key, metadata_json, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,now())
		ON CONFLICT DO NOTHING
		RETURNING id`,
		randomHexID("evt"), creationID, userID, eventType, nullableStr(fromStatus), nullableStr(toStatus),
		nullableStr(reservationID), nullableStr(provider), nullableStr(providerReqID), nullableStr(idem), string(metaBytes)).Scan(new(string))
}

type CallbackInput struct {
	CreationID     string
	Status         string
	ResultURL      string
	ResultText     string
	ProviderReqID  string
	ErrorCode      string
	ErrorReason    string
	ActualCostUSD  *float64
	IdempotencyKey string
}

// FinalizeSuccess archives remote media into storage, marks creation succeeded, commits credits, and writes cost records.
func (s *Service) FinalizeSuccess(ctx context.Context, creationID, providerID, providerReqID, resultURL, resultText string, actualCostUSD *float64) error {
	if s == nil || s.Pool == nil {
		return errors.New("db unavailable")
	}
	var userID, modelID, studioID, status, taskMode, prompt string
	var reservationID, existingObjKey *string
	var credits int
	var estCostUSD *float64
	err := s.Pool.QueryRow(ctx, `
		SELECT user_id, COALESCE(model,''), studio_id, status, reservation_id, credit_cost, estimated_cost_usd, result_object_key,
		       COALESCE(input_summary_json->>'task_type',''), COALESCE(input_summary_json->>'prompt','')
		FROM ai_studio.creations WHERE id = $1`, creationID).
		Scan(&userID, &modelID, &studioID, &status, &reservationID, &credits, &estCostUSD, &existingObjKey, &taskMode, &prompt)
	if err != nil {
		return err
	}
	mediaKind := designMediaCreation(studioID, taskMode)
	if taskMode == "t2i" && strings.HasPrefix(studioID, "workflow:") {
		mediaKind = "image"
	}
	if studioID == "workshop" && taskMode == "i2i" {
		mediaKind = "image"
	}
	if mediaKind != "" && status != "queued" && status != "processing" {
		return nil
	}

	// Best-effort durable archival into object storage before finalizing so assets stay private & permanent.
	var storedObjKey, storedProvider, storedLocID, storedBucket, storedRegion, storedMIME, storedChecksum, storageErr string
	var storedSize int64
	storageStatus := "pending"
	keepDesignMedia := false
	if resultURL != "" && s.Storage != nil && (existingObjKey == nil || *existingObjKey == "") {
		assetType := "generated_image"
		if strings.Contains(strings.ToLower(resultURL), ".mp4") || strings.Contains(strings.ToLower(modelID), "video") || strings.Contains(strings.ToLower(modelID), "seedance") {
			assetType = "generated_video"
		}
		if mediaKind != "" {
			assetType = mediaKind
		}
		ing, ingErr := s.Storage.IngestRemoteURL(ctx, resultURL, userID, assetType, creationID)
		if ingErr == nil {
			if mediaKind != "" {
				defer func() {
					if !keepDesignMedia {
						s.discardUnpublishedDesignMedia(ctx, ing)
					}
				}()
			}
			storageStatus = "ready"
			storedObjKey = ing.ObjectKey
			storedProvider = ing.Provider
			storedLocID = ing.StorageLocationID
			storedBucket = ing.Bucket
			storedRegion = ing.Region
			storedMIME = ing.MIMEType
			storedChecksum = ing.Checksum
			storedSize = ing.SizeBytes
			if !strings.HasPrefix(resultURL, "http://") && !strings.HasPrefix(resultURL, "https://") {
				resultURL = "/api/canvas-tools/result/" + creationID
			}
		} else {
			storageStatus = "failed"
			storageErr = ingErr.Error()
		}
	} else if existingObjKey != nil && *existingObjKey != "" {
		storageStatus = "ready"
	}
	if mediaKind != "" && (storedObjKey == "" || !designMediaTypeMatches(mediaKind, storedMIME)) {
		if studioID == "workshop" {
			return s.FinalizeFailure(ctx, creationID, "failed", providerID, providerReqID,
				"WORKSHOP_IMAGE_ARCHIVE_FAILED", "无法保存工作坊输出，已释放本次预扣积分。")
		}
		return s.FinalizeFailure(ctx, creationID, "failed", providerID, providerReqID,
			"DESIGN_MEDIA_ARCHIVE_FAILED", "无法保存生成素材，已释放本次预扣积分")
	}

	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var curStatus string
	if err := tx.QueryRow(ctx, `SELECT status FROM ai_studio.creations WHERE id = $1 FOR UPDATE`, creationID).Scan(&curStatus); err != nil {
		return err
	}
	if curStatus == "succeeded" {
		return tx.Commit(ctx)
	}
	var assetID string
	if mediaKind != "" {
		if curStatus != "queued" && curStatus != "processing" {
			return tx.Commit(ctx)
		}
		assetID = randomHexID("ast")
		resultURL = "/api/assets/" + assetID + "/download?inline=1"
		_, err = tx.Exec(ctx, `
			INSERT INTO ai_studio.user_assets
			  (id,user_id,creation_id,asset_type,kind,studio_id,title,prompt,model_id,
			   source_type,source_provider,source_task_id,credit_cost,
			   object_key,mime_type,file_size_bytes,checksum,storage_provider,storage_location_id,bucket,region)
			VALUES ($1,$2,$3,$4,$4,$5,LEFT($6,160),$6,$7,'generation',NULLIF($8,''),$3,$9,
			        $10,$11,$12,$13,$14,$15,$16,$17)`,
			assetID, userID, creationID, mediaKind, studioID, prompt, modelID, providerID, credits,
			storedObjKey, storedMIME, storedSize, storedChecksum, storedProvider, storedLocID, storedBucket, storedRegion)
		if err != nil {
			return err
		}
	}

	if reservationID != nil && *reservationID != "" {
		if err := CommitCredits(ctx, tx, *reservationID, creationID); err != nil && !errors.Is(err, ErrReservationNotFound) {
			return err
		}
	}

	_, err = tx.Exec(ctx, `
		UPDATE ai_studio.creations
		SET status = 'succeeded',
		    result_url = COALESCE(NULLIF($2,''), result_url),
		    result_text = COALESCE(NULLIF($3,''), result_text),
		    provider = COALESCE(NULLIF($4,''), provider),
		    provider_request_id = COALESCE(NULLIF($5,''), provider_request_id),
		    actual_cost_usd = COALESCE($6, actual_cost_usd),
		    result_object_key = COALESCE(NULLIF($7,''), result_object_key),
		    storage_provider = COALESCE(NULLIF($8,''), storage_provider),
		    storage_location_id = COALESCE(NULLIF($9,''), storage_location_id),
		    storage_bucket = COALESCE(NULLIF($10,''), storage_bucket),
		    storage_region = COALESCE(NULLIF($11,''), storage_region),
		    storage_mime_type = COALESCE(NULLIF($12,''), storage_mime_type),
		    storage_size_bytes = CASE WHEN $13 > 0 THEN $13 ELSE storage_size_bytes END,
		    storage_status = $14,
		    storage_error_code = NULLIF($15,''),
		    asset_id = COALESCE(NULLIF($16,''), asset_id),
		    error_code = NULL,
		    error_reason = NULL,
		    next_poll_at = NULL,
		    poll_locked_until = NULL,
		    completed_at = COALESCE(completed_at, now()),
		    updated_at = now()
		WHERE id = $1`,
		creationID, resultURL, resultText, providerID, providerReqID, actualCostUSD,
		storedObjKey, storedProvider, storedLocID, storedBucket, storedRegion, storedMIME, storedSize, storageStatus, storageErr, assetID)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `UPDATE ai_studio.canvas_project_jobs SET status = 'succeeded', updated_at = now() WHERE job_id = $1`, creationID); err != nil {
		return err
	}

	if providerID != "" {
		est := 0.0
		if estCostUSD != nil {
			est = *estCostUSD
		}
		act := est
		if actualCostUSD != nil {
			act = *actualCostUSD
		}
		_, _ = tx.Exec(ctx, `
			INSERT INTO ai_studio.provider_cost_records
				(id, job_id, provider_id, model_id, credits_charged, estimated_cost_usd, actual_cost_usd, currency, created_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,'USD',now())`,
			randomHexID("pcr"), creationID, providerID, modelID, credits, est, act)
	}

	recordGenerationEventPG(ctx, tx, creationID, userID, "TASK_SUCCEEDED", curStatus, "succeeded",
		ptrVal(reservationID), providerID, providerReqID, "done:"+creationID, map[string]any{"storageStatus": storageStatus})

	if err := tx.Commit(ctx); err != nil {
		return err
	}
	keepDesignMedia = true

	if s.Events != nil {
		_ = s.Events.PublishPG(ctx, s.Pool, queue.GenerationEvent{
			Type: "generation.succeeded", UserID: userID, TaskID: creationID, Status: "succeeded", Progress: 100,
		})
	}
	return nil
}

// FinalizeFailure transitions a creation to failed/cancelled and voids any held credit reservation.
func (s *Service) FinalizeFailure(ctx context.Context, creationID, targetStatus, providerID, providerReqID, errCode, errReason string) error {
	if s == nil || s.Pool == nil {
		return errors.New("db unavailable")
	}
	if targetStatus != "cancelled" {
		targetStatus = "failed"
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var userID, curStatus string
	var reservationID *string
	err = tx.QueryRow(ctx, `SELECT user_id, status, reservation_id FROM ai_studio.creations WHERE id = $1 FOR UPDATE`, creationID).
		Scan(&userID, &curStatus, &reservationID)
	if err != nil {
		return err
	}
	if curStatus == "failed" || curStatus == "cancelled" || curStatus == "succeeded" {
		return tx.Commit(ctx)
	}

	if reservationID != nil && *reservationID != "" {
		if _, err := VoidCredits(ctx, tx, *reservationID, errReason, false, false); err != nil && !errors.Is(err, ErrReservationNotFound) {
			return err
		}
	}

	_, err = tx.Exec(ctx, `
		UPDATE ai_studio.creations
		SET status = $2,
		    provider = COALESCE(NULLIF($3,''), provider),
		    provider_request_id = COALESCE(NULLIF($4,''), provider_request_id),
		    error_code = COALESCE(NULLIF($5,''), 'GENERATION_FAILED'),
		    error_reason = COALESCE(NULLIF($6,''), '生成任务失败'),
		    storage_status = CASE WHEN $5::text = 'DESIGN_MEDIA_ARCHIVE_FAILED' THEN 'failed' ELSE storage_status END,
		    storage_error_code = CASE WHEN $5::text = 'DESIGN_MEDIA_ARCHIVE_FAILED' THEN $5::text ELSE storage_error_code END,
		    next_poll_at = NULL,
		    poll_locked_until = NULL,
		    completed_at = COALESCE(completed_at, now()),
		    updated_at = now()
		WHERE id = $1`, creationID, targetStatus, providerID, providerReqID, errCode, errReason)
	if err != nil {
		return err
	}

	_, _ = tx.Exec(ctx, `UPDATE ai_studio.canvas_project_jobs SET status = $2, updated_at = now() WHERE job_id = $1`, creationID, targetStatus)
	recordGenerationEventPG(ctx, tx, creationID, userID, "TASK_"+strings.ToUpper(targetStatus), curStatus, targetStatus,
		ptrVal(reservationID), providerID, providerReqID, "fail:"+creationID, map[string]any{"errorCode": errCode, "errorReason": errReason})

	if err := tx.Commit(ctx); err != nil {
		return err
	}
	if s.Events != nil {
		_ = s.Events.PublishPG(ctx, s.Pool, queue.GenerationEvent{
			Type: "generation." + targetStatus, UserID: userID, TaskID: creationID, Status: targetStatus,
		})
	}
	return nil
}

// ProcessCreation dispatches or polls a claimed creation using ai.ResolveAndBuild with automatic failover on retryable submit failures.
func (s *Service) ProcessCreation(ctx context.Context, creationID string) error {
	if s == nil || s.Pool == nil {
		return errors.New("db unavailable")
	}
	var userID, modelID, status, studioID, prompt string
	var providerID, providerReqID, quoteID *string
	var summaryRaw, metaRaw []byte
	err := s.Pool.QueryRow(ctx, `
		SELECT user_id, COALESCE(model,''), status, studio_id, COALESCE(provider, selected_provider_id),
		       provider_request_id, quote_id, COALESCE(input_summary_json,'{}'::jsonb), COALESCE(metadata_json,'{}'::jsonb)
		FROM ai_studio.creations WHERE id = $1`, creationID).
		Scan(&userID, &modelID, &status, &studioID, &providerID, &providerReqID, &quoteID, &summaryRaw, &metaRaw)
	if err != nil {
		return err
	}

	params := map[string]any{}
	_ = json.Unmarshal(summaryRaw, &params)
	meta := map[string]any{}
	_ = json.Unmarshal(metaRaw, &meta)
	if prompt == "" {
		if p, ok := params["prompt"].(string); ok {
			prompt = p
		}
	}
	var designJobID string
	mode, _ := params["task_type"].(string)
	if designMediaCreation(studioID, mode) != "" || studioID == "workshop" {
		designJobID = creationID
	}
	if err := s.resolveKoyoAssetURLs(ctx, userID, designJobID, params); err != nil {
		return s.FinalizeFailure(ctx, creationID, "failed", "", "", "ASSET_REFERENCE_UNAVAILABLE", "参考素材不可用，请重新选择后再生成")
	}

	candidates := extractCandidatesFromMeta(meta)
	contract, _ := params["workshop_contract"].(string)
	if studioID == "workshop" {
		delete(params, "workshop_contract")
		delete(params, "workshop_tool")
	}
	// If provider_request_id is already present, poll the active provider instead of re-submitting.
	if providerReqID != nil && *providerReqID != "" && providerID != nil && *providerID != "" {
		endpoint := ""
		if studioID == "workshop" && len(candidates) == 1 && candidates[0].ProviderID == *providerID {
			modelID, endpoint = candidates[0].ProviderModelName, candidates[0].ProviderEndpoint
		}
		return s.pollExistingCreation(ctx, creationID, userID, modelID, endpoint, *providerID, *providerReqID, params)
	}

	// Build candidate list from quote route snapshot or live DB routes.
	if studioID == "workshop" {
		versions, err := canvas.ListWorkshopVersions(ctx, s.Pool)
		valid := false
		if err == nil && len(candidates) == 1 {
			for _, version := range versions {
				if version.ModelID == modelID && version.VersionID == candidates[0].ProviderModelID && version.Contract == contract {
					valid = true
					break
				}
			}
		}
		if !valid {
			return s.FinalizeFailure(ctx, creationID, "failed", "", "", "WORKSHOP_MODEL_VERSION_UNAVAILABLE", "工作坊模型版本已不可用，已释放本次预扣积分。")
		}
	}
	if len(candidates) == 0 {
		candidates, err = s.listEligibleRouteCandidates(ctx, modelID, DefaultUSDToCNY, params)
		if err != nil || len(candidates) == 0 {
			return s.FinalizeFailure(ctx, creationID, "failed", "", "", "NO_ELIGIBLE_ROUTE", "没有可用的模型供应商渠道")
		}
	}

	var lastErr *ai.ProviderError
	for idx, cand := range candidates {
		adapter, cred := ai.ResolveAndBuild(ctx, s.Pool, s.Config, cand.ProviderID, "")
		if cred.Status != "configured" || cred.Value == "" {
			lastErr = &ai.ProviderError{Code: ai.ErrCodeAuth, Provider: cand.ProviderID, Message: "provider credential missing", Retryable: true}
			continue
		}

		res, err := adapter.CreateTask(ctx, ai.TaskRequest{
			ProviderModelID:  cand.ProviderModelName,
			ProviderEndpoint: cand.ProviderEndpoint,
			Prompt:           prompt,
			Parameters:       params,
			IdempotencyKey:   creationID,
		})
		if err == nil {
			attemptStatus := res.Status
			if attemptStatus != "succeeded" && attemptStatus != "failed" && attemptStatus != "cancelled" {
				attemptStatus = "processing"
			}
			s.recordAttempt(ctx, creationID, idx+1, cand.ProviderID, cand.ProviderModelName, res.ProviderRequestID, attemptStatus, "", "", res.ActualCostUSD)
			switch res.Status {
			case "succeeded":
				return s.FinalizeSuccess(ctx, creationID, cand.ProviderID, res.ProviderRequestID, res.ResultURL, res.ResultText, res.ActualCostUSD)
			case "failed", "cancelled":
				return s.FinalizeFailure(ctx, creationID, res.Status, cand.ProviderID, res.ProviderRequestID, "PROVIDER_TASK_FAILED", redactDesignReference(res.Error))
			}
			if strings.TrimSpace(res.ProviderRequestID) == "" {
				return s.FinalizeFailure(ctx, creationID, "failed", cand.ProviderID, "", "PROVIDER_TASK_ID_MISSING", "供应商未返回可跟踪的任务编号")
			}
			updated, err := s.Pool.Exec(ctx, `
				UPDATE ai_studio.creations
				SET status = 'processing', provider = $2::text, selected_provider_id = $2::text,
				    provider_request_id = $3, next_poll_at = now() + interval '4 seconds',
				    poll_locked_until = NULL, started_at = COALESCE(started_at, now()), updated_at = now()
				WHERE id = $1 AND status IN ('queued','processing') AND provider_request_id IS NULL`,
				creationID, cand.ProviderID, res.ProviderRequestID)
			if err != nil {
				return fmt.Errorf("persist provider task reference: %w", err)
			}
			if updated.RowsAffected() > 0 && s.Events != nil {
				_ = s.Events.PublishPG(ctx, s.Pool, queue.GenerationEvent{
					Type: "generation.processing", UserID: userID, TaskID: creationID, Status: "processing", Progress: 10,
				})
			}
			return nil
		}

		var pe *ai.ProviderError
		if !errors.As(err, &pe) {
			pe = ai.NormalizeError(cand.ProviderID, err, 0, nil)
		}
		pe.Message = redactDesignReference(pe.Message)
		lastErr = pe
		s.recordAttempt(ctx, creationID, idx+1, cand.ProviderID, cand.ProviderModelName, pe.ProviderRequestID, "failed", string(pe.Code), pe.Message, pe.ActualCostUSD)
		if !pe.Retryable {
			return s.FinalizeFailure(ctx, creationID, "failed", cand.ProviderID, pe.ProviderRequestID, string(pe.Code), pe.Message)
		}
	}

	errCode, errMsg, provID := "GENERATION_FAILED", "所有供应商渠道均提交失败", ""
	if lastErr != nil {
		errCode = string(lastErr.Code)
		errMsg = lastErr.Message
		provID = lastErr.Provider
	}
	return s.FinalizeFailure(ctx, creationID, "failed", provID, "", errCode, errMsg)
}

func (s *Service) pollExistingCreation(ctx context.Context, creationID, userID, modelID, endpoint, providerID, providerReqID string, params map[string]any) error {
	adapter, _ := ai.ResolveAndBuild(ctx, s.Pool, s.Config, providerID, "")
	res, err := adapter.GetTask(ctx, providerReqID, ai.TaskRequest{ProviderModelID: modelID, ProviderEndpoint: endpoint, Parameters: params})
	if err != nil {
		var pe *ai.ProviderError
		if errors.As(err, &pe) && (pe.TerminalFailure || !pe.Retryable) {
			return s.FinalizeFailure(ctx, creationID, "failed", providerID, providerReqID, string(pe.Code), redactDesignReference(pe.Message))
		}
		// Keep processing on transient poll error; push next_poll_at forward.
		_, _ = s.Pool.Exec(ctx, `
			UPDATE ai_studio.creations SET next_poll_at = now() + interval '8 seconds', poll_locked_until = NULL, updated_at = now() WHERE id = $1`, creationID)
		return nil
	}
	if res.ReconciliationRequired {
		recordGenerationEventPG(ctx, s.Pool, creationID, userID, "TASK_RECONCILIATION_REQUIRED", "processing", "processing",
			"", providerID, providerReqID, "reconcile:"+creationID, map[string]any{"reason": res.Reason})
		_, _ = s.Pool.Exec(ctx, `UPDATE ai_studio.creations SET next_poll_at = now() + interval '5 minutes', poll_locked_until = NULL, updated_at = now() WHERE id = $1`, creationID)
		return nil
	}
	switch res.Status {
	case "succeeded":
		return s.FinalizeSuccess(ctx, creationID, providerID, providerReqID, res.ResultURL, res.ResultText, res.ActualCostUSD)
	case "failed", "cancelled":
		return s.FinalizeFailure(ctx, creationID, res.Status, providerID, providerReqID, "PROVIDER_TASK_FAILED", redactDesignReference(res.Error))
	default:
		_, _ = s.Pool.Exec(ctx, `
			UPDATE ai_studio.creations SET next_poll_at = now() + interval '5 seconds', poll_locked_until = NULL, updated_at = now() WHERE id = $1`, creationID)
		return nil
	}
}

func (s *Service) recordAttempt(ctx context.Context, creationID string, num int, providerID, providerModel, reqID, status, errCode, errMsg string, cost *float64) {
	_, _ = s.Pool.Exec(ctx, `
		INSERT INTO ai_studio.generation_attempts
			(id, creation_id, attempt_number, provider_id, provider_model_id, provider_request_id, status, error_code, error_reason, actual_cost_usd, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
		ON CONFLICT (creation_id, attempt_number) DO UPDATE SET
			status = EXCLUDED.status, provider_request_id = COALESCE(EXCLUDED.provider_request_id, ai_studio.generation_attempts.provider_request_id),
			error_code = EXCLUDED.error_code, error_reason = EXCLUDED.error_reason, completed_at = now()`,
		randomHexID("att"), creationID, num, providerID, providerModel, nullableStr(reqID), status, nullableStr(errCode), nullableStr(errMsg), cost)
}

func extractCandidatesFromMeta(meta map[string]any) []RouteCandidate {
	rs, ok := meta["routeSnapshot"].(map[string]any)
	if !ok {
		return nil
	}
	raw, _ := json.Marshal(rs["candidates"])
	var out []RouteCandidate
	_ = json.Unmarshal(raw, &out)
	return out
}

var reKoyoAssetRef = regexp.MustCompile(`^koyo-asset:([A-Za-z0-9_-]{1,160})$`)
var reAssetDownloadRef = regexp.MustCompile(`^/api/assets/([A-Za-z0-9_-]{1,160})/download(?:\?inline=1)?$`)
var errAssetReferenceUnavailable = errors.New("asset reference unavailable")

func (s *Service) resolveKoyoAssetURLs(ctx context.Context, userID, designJobID string, params map[string]any) error {
	resolveOne := func(val string) (string, error) {
		clean := strings.TrimSpace(val)
		m := reKoyoAssetRef.FindStringSubmatch(clean)
		if len(m) != 2 {
			m = reAssetDownloadRef.FindStringSubmatch(clean)
		}
		if len(m) != 2 {
			return val, nil
		}
		if s.Storage == nil {
			return "", errAssetReferenceUnavailable
		}
		var prov, locID, bucket, region, objKey sqlNullStringVal
		err := s.Pool.QueryRow(ctx, `
			SELECT COALESCE(storage_provider,''), COALESCE(storage_location_id,''),
			       COALESCE(bucket,''), COALESCE(region,''), COALESCE(object_key,'')
			FROM ai_studio.user_assets WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, m[1], userID).
			Scan(&prov.s, &locID.s, &bucket.s, &region.s, &objKey.s)
		if err != nil || objKey.s == "" {
			return "", errAssetReferenceUnavailable
		}
		if designJobID != "" && storage.NormalizeProvider(prov.s) == "local" {
			return s.localDesignReferenceURL(designJobID, m[1])
		}
		if signed, err := s.Storage.SignedURL(ctx, prov.s, locID.s, bucket.s, region.s, objKey.s, "inline"); err == nil && signed != "" {
			if strings.HasPrefix(signed, "http://") || strings.HasPrefix(signed, "https://") {
				return signed, nil
			}
			if pub := strings.TrimRight(s.Config.PublicAppURL, "/"); pub != "" && strings.HasPrefix(signed, "/") {
				return pub + signed, nil
			}
		}
		return "", errAssetReferenceUnavailable
	}
	for _, k := range []string{"image_url", "imageUrl", "input_image", "first_frame_image", "first_frame_url", "end_frame_url", "audio_url", "video_url"} {
		if v, ok := params[k].(string); ok {
			resolved, err := resolveOne(v)
			if err != nil {
				return err
			}
			params[k] = resolved
		}
	}
	for _, k := range []string{"image_urls", "reference_images", "reference_urls"} {
		switch arr := params[k].(type) {
		case []any:
			for i, item := range arr {
				if str, ok := item.(string); ok {
					resolved, err := resolveOne(str)
					if err != nil {
						return err
					}
					arr[i] = resolved
				}
			}
		case []string:
			for i, item := range arr {
				resolved, err := resolveOne(item)
				if err != nil {
					return err
				}
				arr[i] = resolved
			}
		}
	}
	return nil
}

type sqlNullStringVal struct{ s string }

// ProbeProvider runs live/credential healthCheck via ai.Registry and updates provider health tables.
func (s *Service) ProbeProvider(ctx context.Context, providerID string) (map[string]any, error) {
	if s == nil || s.Pool == nil {
		return nil, errors.New("db unavailable")
	}
	adapter, cred := ai.ResolveAndBuild(ctx, s.Pool, s.Config, providerID, "")
	res, _ := adapter.HealthCheck(ctx)
	status := "healthy"
	errCode := ""
	if cred.Status != "configured" {
		status = "unhealthy"
		errCode = "CREDENTIALS_MISSING"
	} else if res != nil && res.Healthy != nil && !*res.Healthy {
		status = "unhealthy"
		errCode = firstNonEmptyStr(res.ErrorCode, "PROVIDER_UNAVAILABLE")
	} else if res != nil && res.Status != "" {
		status = res.Status
	}

	var lat int64
	probeKind, msg := "credential", "OK"
	if res != nil {
		lat = res.LatencyMs
		if res.ProbeKind != "" {
			probeKind = res.ProbeKind
		}
		if res.Message != "" {
			msg = res.Message
		}
	}
	_, _ = s.Pool.Exec(ctx, `
		UPDATE ai_studio.ai_providers
		SET health_status = $2, last_health_check_at = now(), updated_at = now()
		WHERE id = $1`, providerID, status)
	detailsBytes, _ := json.Marshal(map[string]any{
		"probeKind": probeKind, "message": msg, "credentialSource": cred.Source, "selectedEnv": cred.SelectedEnv,
	})
	_, _ = s.Pool.Exec(ctx, `
		INSERT INTO ops_bill.provider_health_checks
			(id, provider, status, latency_ms, error_code, details_json, checked_at)
		VALUES ($1,$2,$3,$4,$5,$6::jsonb,now())`,
		randomHexID("phc"), providerID, status, lat, nullableStr(errCode), string(detailsBytes))

	return map[string]any{
		"ok":           status == "healthy",
		"providerId":   providerID,
		"healthStatus": status,
		"latencyMs":    lat,
		"probeKind":    probeKind,
		"message":      msg,
		"errorCode":    nullableStr(errCode),
	}, nil
}

// Reconcile executes poll | confirm_failure | confirm_success | refund on an existing creation/reservation.
func (s *Service) Reconcile(ctx context.Context, creationID, reservationID, action, reason string) (map[string]any, error) {
	if s == nil || s.Pool == nil {
		return nil, errors.New("db unavailable")
	}
	switch action {
	case "poll":
		if creationID == "" {
			return nil, errors.New("creationId required for poll")
		}
		if err := s.ProcessCreation(ctx, creationID); err != nil {
			return nil, err
		}
		var st string
		_ = s.Pool.QueryRow(ctx, `SELECT status FROM ai_studio.creations WHERE id = $1`, creationID).Scan(&st)
		return map[string]any{"creationId": creationID, "action": action, "status": st}, nil

	case "confirm_failure", "refund":
		if reason == "" {
			reason = "管理员手动核对确认失败退费"
		}
		if creationID != "" {
			if err := s.FinalizeFailure(ctx, creationID, "failed", "", "", "RECONCILIATION_CONFIRMED_FAILED", reason); err != nil {
				return nil, err
			}
			return map[string]any{"creationId": creationID, "reservationId": reservationID, "action": action, "status": "failed"}, nil
		}
		tx, err := s.Pool.Begin(ctx)
		if err != nil {
			return nil, err
		}
		defer func() { _ = tx.Rollback(ctx) }()
		vr, err := VoidCredits(ctx, tx, reservationID, reason, false, false)
		if err != nil {
			return nil, err
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		return map[string]any{"reservationId": reservationID, "action": action, "status": "VOIDED", "released": vr.ReleasedAmount}, nil

	case "confirm_success":
		if creationID == "" {
			return nil, errors.New("creationId required for confirm_success")
		}
		var resURL, resText string
		_ = s.Pool.QueryRow(ctx, `SELECT COALESCE(result_url,''), COALESCE(result_text,'') FROM ai_studio.creations WHERE id = $1`, creationID).Scan(&resURL, &resText)
		if err := s.FinalizeSuccess(ctx, creationID, "", "", resURL, resText, nil); err != nil {
			return nil, err
		}
		return map[string]any{"creationId": creationID, "action": action, "status": "succeeded"}, nil

	default:
		return nil, fmt.Errorf("unsupported reconciliation action %s", action)
	}
}

func ptrVal(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func firstNonEmptyStr(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

// Keep unused imports clean: config/http/url helpers used across generation methods.
var (
	_ config.Config
	_ *http.Client
	_ *url.URL
)

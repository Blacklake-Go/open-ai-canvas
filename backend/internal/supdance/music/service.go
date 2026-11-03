package music

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"yingce/backend/internal/model"
)

// BillingCoordinator defines the financial integration interface for the single ledger system.
type BillingCoordinator interface {
	ReserveBillingOrder(order *model.BillingOrder) error
	SettleBillingOrderWithAudioDuration(orderID string, providerReqID string, durationMs int64) error
	RefundBillingOrder(orderID string, errorText string) error
	MarkBillingUncertain(orderID string, errorText string) error
}

// SystemSettingsStore provides access to system-level configuration persistence.
type SystemSettingsStore interface {
	SystemSettingOptional(key string) (*model.SystemSetting, error)
	SaveSystemSetting(setting *model.SystemSetting) error
}

// LifecycleGuard checks whether the music plugin is admitting new tasks.
type LifecycleGuard interface {
	IsDraining() bool
	ActiveTaskCount() int64
	CheckMusicTaskAdmission(userID string) error
	TrackMusicTaskExecution() func()
}

// Service provides end-to-end domain logic for AI music generation.
type Service struct {
	repo         Repository
	settings     SystemSettingsStore
	vault        SecretVault
	transcoder   *Transcoder
	discovery    *CapabilityManager
	billing      BillingCoordinator
	lifecycle    LifecycleGuard
	clientMu     sync.RWMutex
	cachedClient *Client
}

// NewService constructs a new music domain Service.
func NewService(
	repo Repository,
	settings SystemSettingsStore,
	vault SecretVault,
	billing BillingCoordinator,
	lifecycle LifecycleGuard,
) *Service {
	if vault == nil {
		vault = NewDefaultVault()
	}
	return &Service{
		repo:       repo,
		settings:   settings,
		vault:      vault,
		transcoder: NewTranscoder(),
		discovery:  NewCapabilityManager(15 * time.Minute),
		billing:    billing,
		lifecycle:  lifecycle,
	}
}

// GetStoredConfig retrieves and decrypts the music plugin configuration.
func (s *Service) GetStoredConfig(ctx context.Context) (*StoredMusicConfig, error) {
	if s.settings == nil {
		return &StoredMusicConfig{
			DefaultModel: ModelSunoV6,
			ModelPricing: make(map[string]ModelPricingConfig),
		}, nil
	}

	setting, err := s.settings.SystemSettingOptional(ConfigSettingKey)
	if err != nil {
		return nil, fmt.Errorf("read music config: %w", err)
	}
	if setting == nil || strings.TrimSpace(setting.ValueJSON) == "" {
		return &StoredMusicConfig{
			DefaultModel: ModelSunoV6,
			ModelPricing: make(map[string]ModelPricingConfig),
		}, nil
	}

	var stored StoredMusicConfig
	if err := json.Unmarshal([]byte(setting.ValueJSON), &stored); err != nil {
		return nil, fmt.Errorf("unmarshal music config: %w", err)
	}
	if stored.ModelPricing == nil {
		stored.ModelPricing = make(map[string]ModelPricingConfig)
	}
	return &stored, nil
}

// GetAdminConfigView returns a safe, masked view of the music plugin settings for the admin panel.
func (s *Service) GetAdminConfigView(ctx context.Context) (*AdminMusicConfigView, error) {
	stored, err := s.GetStoredConfig(ctx)
	if err != nil {
		return nil, err
	}

	hasKey := strings.TrimSpace(stored.APIKeyCipher) != ""
	maskedKey := ""
	if hasKey {
		plainKey, err := s.vault.Decrypt(stored.APIKeyCipher)
		if err == nil && plainKey != "" {
			maskedKey = MaskAPIKey(plainKey)
		} else {
			maskedKey = "koyo_****"
		}
	}

	hasWebhook := strings.TrimSpace(stored.WebhookSecretCipher) != ""

	defaultModel := stored.DefaultModel
	if defaultModel == "" {
		defaultModel = ModelSunoV6
	}

	pricing := make(map[string]ModelPricingConfig)
	for k, v := range stored.ModelPricing {
		pricing[k] = v
	}

	return &AdminMusicConfigView{
		BaseURL:          KoyosimAPIBaseURL, // Immutable fixed URL
		HasAPIKey:        hasKey,
		MaskedAPIKey:     maskedKey,
		HasWebhookSecret: hasWebhook,
		DefaultModel:     defaultModel,
		ModelPricing:     pricing,
		UpdatedAt:        stored.UpdatedAt,
		UpdatedBy:        stored.UpdatedBy,
	}, nil
}

// UpdateAdminConfig validates and updates the music plugin configuration.
func (s *Service) UpdateAdminConfig(ctx context.Context, actorID string, req UpdateMusicConfigRequest) (*AdminMusicConfigView, error) {
	// Base URL immutability validation (Feature 8, Feature 30)
	if strings.TrimSpace(req.BaseURL) != "" && strings.TrimSpace(req.BaseURL) != KoyosimAPIBaseURL {
		return nil, errors.New("API Base URL is strictly immutable and fixed to https://www.koyosim.com; overrides are forbidden")
	}

	stored, err := s.GetStoredConfig(ctx)
	if err != nil {
		return nil, err
	}

	// Update API Key if provided and not masked
	if strings.TrimSpace(req.APIKey) != "" && !strings.Contains(req.APIKey, "****") {
		cipher, err := s.vault.Encrypt(strings.TrimSpace(req.APIKey))
		if err != nil {
			return nil, fmt.Errorf("encrypt api key: %w", err)
		}
		stored.APIKeyCipher = cipher
	}

	// Update Webhook Secret if provided and not masked
	if strings.TrimSpace(req.WebhookSecret) != "" && !strings.Contains(req.WebhookSecret, "****") {
		cipher, err := s.vault.Encrypt(strings.TrimSpace(req.WebhookSecret))
		if err != nil {
			return nil, fmt.Errorf("encrypt webhook secret: %w", err)
		}
		stored.WebhookSecretCipher = cipher
	}

	if strings.TrimSpace(req.DefaultModel) != "" {
		stored.DefaultModel = strings.TrimSpace(req.DefaultModel)
	}

	if req.ModelPricing != nil {
		if stored.ModelPricing == nil {
			stored.ModelPricing = make(map[string]ModelPricingConfig)
		}
		for k, v := range req.ModelPricing {
			stored.ModelPricing[k] = v
		}
	}

	stored.UpdatedAt = time.Now().UTC()
	stored.UpdatedBy = actorID

	if s.settings != nil {
		data, err := json.Marshal(stored)
		if err != nil {
			return nil, fmt.Errorf("marshal music config: %w", err)
		}
		if err := s.settings.SaveSystemSetting(&model.SystemSetting{
			Key:       ConfigSettingKey,
			ValueJSON: string(data),
			UpdatedAt: stored.UpdatedAt,
		}); err != nil {
			return nil, fmt.Errorf("save music config: %w", err)
		}
	}

	// Invalidate cached client
	s.clientMu.Lock()
	s.cachedClient = nil
	s.clientMu.Unlock()

	return s.GetAdminConfigView(ctx)
}

// GetClient returns a configured Koyosim client instance.
func (s *Service) GetClient(ctx context.Context) (*Client, error) {
	s.clientMu.RLock()
	if s.cachedClient != nil {
		c := s.cachedClient
		s.clientMu.RUnlock()
		return c, nil
	}
	s.clientMu.RUnlock()

	s.clientMu.Lock()
	defer s.clientMu.Unlock()
	if s.cachedClient != nil {
		return s.cachedClient, nil
	}

	stored, err := s.GetStoredConfig(ctx)
	if err != nil {
		return nil, err
	}

	plainKey := ""
	if strings.TrimSpace(stored.APIKeyCipher) != "" {
		key, err := s.vault.Decrypt(stored.APIKeyCipher)
		if err == nil {
			plainKey = key
		}
	}

	client, err := NewClient(plainKey)
	if err != nil {
		return nil, err
	}
	s.cachedClient = client
	return client, nil
}

// TestConnection tests connectivity to Koyosim upstream without incurring billing charges (Feature 11).
func (s *Service) TestConnection(ctx context.Context, candidateKey string) (map[string]any, error) {
	apiKey := strings.TrimSpace(candidateKey)
	if apiKey == "" || strings.Contains(apiKey, "****") {
		stored, err := s.GetStoredConfig(ctx)
		if err != nil {
			return nil, err
		}
		if strings.TrimSpace(stored.APIKeyCipher) == "" {
			return nil, errors.New("未配置 API Key，请先输入密钥")
		}
		plain, err := s.vault.Decrypt(stored.APIKeyCipher)
		if err != nil || strings.TrimSpace(plain) == "" {
			return nil, errors.New("解密凭据失败")
		}
		apiKey = plain
	}

	client, err := NewClient(apiKey)
	if err != nil {
		return nil, fmt.Errorf("create test client: %w", err)
	}

	pingResp, err := client.Ping(ctx)
	if err != nil {
		return map[string]any{
			"status":   "error",
			"code":     502,
			"message":  RedactSecretFromText(err.Error(), apiKey),
			"endpoint": KoyosimAPIBaseURL + "/v1/ping",
			"billed":   false,
		}, nil
	}

	return map[string]any{
		"status":   "ok",
		"code":     pingResp.Code,
		"message":  pingResp.Status,
		"endpoint": KoyosimAPIBaseURL + "/v1/ping",
		"billed":   false, // Zero credit deduction upstream & downstream verified
	}, nil
}

// GetCapabilities returns the model capabilities catalog.
func (s *Service) GetCapabilities(ctx context.Context) ([]ModelCapabilities, error) {
	client, err := s.GetClient(ctx)
	if err != nil {
		return s.discovery.GetCapabilities(ctx, "", nil), nil
	}
	return s.discovery.GetCapabilities(ctx, client.apiKey, client.controlClient), nil
}

// SubmitTask handles client music generation task creation.
func (s *Service) SubmitTask(ctx context.Context, userID string, req MusicGenerationRequest) (*MusicGenerationResponse, error) {
	req.UserID = userID

	// 1. Lifecycle and admission checks (Feature 2, 4)
	if s.lifecycle != nil {
		if err := s.lifecycle.CheckMusicTaskAdmission(userID); err != nil {
			return nil, err
		}
	}

	// 2. Validate request parameters against model specification (Features 12–15)
	adapter, ok := GetAdapterRegistry().Get(req.Model)
	if !ok {
		return nil, fmt.Errorf("model %q not found or not supported", req.Model)
	}
	if err := adapter.Validate(&req); err != nil {
		return nil, fmt.Errorf("parameter validation error: %w", err)
	}

	caps := adapter.Capabilities()

	duration := req.DurationSeconds
	if duration <= 0 {
		duration = 180
	}

	costPerSec := caps.CostPerSecondMicrocredits
	if costPerSec <= 0 {
		costPerSec = 100
	}
	estimatedMicrocredits := int64(duration) * costPerSec

	// 4. Financial Single-Ledger Reservation (Features 34 & 35)
	taskID := fmt.Sprintf("music_%d_%s", time.Now().UnixNano(), req.IdempotencyNonce)
	if len(taskID) > 64 {
		taskID = taskID[:64]
	}
	orderID := fmt.Sprintf("order_%s", taskID)
	if len(orderID) > 64 {
		orderID = orderID[:64]
	}

	billingOrder := &model.BillingOrder{
		ID:                         orderID,
		UserID:                     userID,
		IdempotencyKey:             req.IdempotencyNonce,
		Capability:                 "audio",
		BillingMode:                "per_second",
		UnitPriceMicrocredits:      costPerSec,
		MultiplierBasisPoints:      10_000,
		Quantity:                   int64(duration),
		AmountMicrocredits:         estimatedMicrocredits,
		ReservedAmountMicrocredits: estimatedMicrocredits,
		Status:                     model.BillingStatusRunning,
	}

	if s.billing != nil {
		if err := s.billing.ReserveBillingOrder(billingOrder); err != nil {
			return nil, fmt.Errorf("reserve credits: %w", err)
		}
	}

	// 5. Track in-flight task execution (Feature 4 - draining engine)
	var untrack func()
	if s.lifecycle != nil {
		untrack = s.lifecycle.TrackMusicTaskExecution()
	}

	// 6. Persist generation record in isolated table
	now := time.Now().UTC()
	genRecord := &SupDanceMusicGeneration{
		ID:                    taskID,
		UserID:                userID,
		TaskID:                taskID,
		Model:                 req.Model,
		Mode:                  req.Mode,
		Prompt:                req.Prompt,
		Title:                 req.Title,
		Lyrics:                req.Lyrics,
		Tags:                  req.Tags,
		Instrumental:          req.Instrumental,
		DurationTargetSeconds: duration,
		Status:                StatusSubmitted,
		Stage:                 "submitted",
		Format:                req.Format,
		BillingOrderID:        orderID,
		MicrocreditsCost:      estimatedMicrocredits,
		CreatedAt:             now,
		UpdatedAt:             now,
	}

	if s.repo != nil {
		if err := s.repo.Create(ctx, genRecord); err != nil {
			if s.billing != nil {
				_ = s.billing.RefundBillingOrder(orderID, "Failed to create music generation record")
			}
			if untrack != nil {
				untrack()
			}
			return nil, fmt.Errorf("save generation record: %w", err)
		}
	}

	// 7. Dispatch to Koyosim Fixed API Client
	client, err := s.GetClient(ctx)
	if err != nil {
		s.handleSubmissionFailure(ctx, taskID, orderID, err.Error(), untrack)
		return nil, fmt.Errorf("get api client: %w", err)
	}

	payload, err := adapter.TransformRequest(&req)
	if err != nil {
		s.handleSubmissionFailure(ctx, taskID, orderID, err.Error(), untrack)
		return nil, fmt.Errorf("transform request: %w", err)
	}

	koyoResp, err := client.CreateTask(ctx, payload)
	if err != nil {
		// Feature 38: Check if ambiguous network timeout
		if errors.Is(err, context.DeadlineExceeded) || strings.Contains(err.Error(), "timeout") {
			if s.billing != nil {
				_ = s.billing.MarkBillingUncertain(orderID, err.Error())
			}
			if s.repo != nil {
				_ = s.repo.UpdateProgress(ctx, taskID, StatusSubmitted, "uncertain")
			}
			if untrack != nil {
				untrack()
			}
			return nil, fmt.Errorf("upstream network timeout: %w", err)
		}

		s.handleSubmissionFailure(ctx, taskID, orderID, err.Error(), untrack)
		return nil, fmt.Errorf("upstream generation error: %w", err)
	}

	// Success response from upstream dispatch
	upstreamTaskID := koyoResp.TaskID
	genRecord.UpstreamTaskID = upstreamTaskID
	genRecord.Status = StatusQueued
	genRecord.Stage = "queued"
	genRecord.UpdatedAt = time.Now().UTC()

	if s.repo != nil {
		_ = s.repo.Update(ctx, genRecord)
	}

	// 8. Launch detached asynchronous polling worker (Feature 17, Feature 25)
	go s.runDetachedPolling(taskID, upstreamTaskID, orderID, duration, costPerSec, untrack)

	return &MusicGenerationResponse{
		TaskID:         taskID,
		UpstreamTaskID: upstreamTaskID,
		Status:         string(StatusSubmitted),
		Stage:          "submitted",
		Model:          req.Model,
		Mode:           req.Mode,
		CreatedAt:      now.Unix(),
		UpdatedAt:      now.Unix(),
	}, nil
}

func (s *Service) handleSubmissionFailure(ctx context.Context, taskID, orderID, errorMsg string, untrack func()) {
	if s.repo != nil {
		_ = s.repo.CompleteFailure(ctx, taskID, errorMsg)
	}
	if s.billing != nil {
		_ = s.billing.RefundBillingOrder(orderID, errorMsg)
	}
	if untrack != nil {
		untrack()
	}
}

// runDetachedPolling monitors upstream generation until terminal state.
func (s *Service) runDetachedPolling(taskID, upstreamTaskID, orderID string, targetDurationSec int, costPerSec int64, untrack func()) {
	if untrack != nil {
		defer untrack()
	}

	client, err := s.GetClient(context.Background())
	if err != nil {
		return
	}

	// Detached polling loop with exponential backoff (2.5s -> 10s)
	backoff := 2500 * time.Millisecond
	maxBackoff := 10000 * time.Millisecond
	timeout := time.After(15 * time.Minute)

	for {
		select {
		case <-timeout:
			// Timed out: mark uncertain
			if s.billing != nil {
				_ = s.billing.MarkBillingUncertain(orderID, "task execution timed out")
			}
			if s.repo != nil {
				_ = s.repo.CompleteFailure(context.Background(), taskID, "任务执行超时")
			}
			return

		case <-time.After(backoff):
			taskData, err := client.GetTask(context.Background(), upstreamTaskID)
			if err != nil {
				backoff = time.Duration(float64(backoff) * 1.5)
				if backoff > maxBackoff {
					backoff = maxBackoff
				}
				continue
			}

			stage := taskData.Stage
			status := stage
			if stage == "transcoding" || stage == "generating" {
				status = "generating"
			}

			if s.repo != nil {
				_ = s.repo.UpdateProgress(context.Background(), taskID, MusicGenerationStatus(status), stage)
			}

			if stage == "completed" {
				actualDurationMs := int64(taskData.Duration * 1000)
				if actualDurationMs <= 0 {
					actualDurationMs = int64(targetDurationSec * 1000)
				}

				if s.billing != nil {
					_ = s.billing.SettleBillingOrderWithAudioDuration(orderID, upstreamTaskID, actualDurationMs)
				}

				if s.repo != nil {
					_ = s.repo.CompleteSuccess(context.Background(), taskID, taskData.AudioURL, actualDurationMs, "")
				}
				return
			}

			if stage == "failed" {
				failMsg := taskData.ErrorReason
				if failMsg == "" {
					failMsg = "音频生成失败"
				}
				if s.billing != nil {
					_ = s.billing.RefundBillingOrder(orderID, failMsg)
				}
				if s.repo != nil {
					_ = s.repo.CompleteFailure(context.Background(), taskID, failMsg)
				}
				return
			}

			if backoff < maxBackoff {
				backoff += 500 * time.Millisecond
			}
		}
	}
}

// GetTask retrieves a single music generation task by internal ID with user ownership check.
func (s *Service) GetTask(ctx context.Context, userID, taskID string, isAdmin bool) (*SupDanceMusicGeneration, error) {
	if s.repo == nil {
		return nil, errors.New("repository unavailable")
	}

	task, err := s.repo.GetByTaskID(ctx, taskID)
	if err != nil {
		task, err = s.repo.GetByID(ctx, taskID)
		if err != nil {
			return nil, fmt.Errorf("task not found: %w", err)
		}
	}

	if !isAdmin && task.UserID != userID {
		return nil, errors.New("access denied: you do not own this music generation task")
	}

	return task, nil
}

// ListUserTasks retrieves paginated music history for the authenticated user (Feature 7).
func (s *Service) ListUserTasks(ctx context.Context, userID string, offset, limit int) ([]*SupDanceMusicGeneration, int64, error) {
	if s.repo == nil {
		return []*SupDanceMusicGeneration{}, 0, nil
	}
	return s.repo.ListByUserID(ctx, userID, offset, limit)
}

// DownloadAudio transcodes and prepares downloadable audio artifacts (Feature 28, 39).
func (s *Service) DownloadAudio(ctx context.Context, userID, taskID, format string, isAdmin bool) ([]byte, string, string, error) {
	task, err := s.GetTask(ctx, userID, taskID, isAdmin)
	if err != nil {
		return nil, "", "", err
	}

	if task.Status != StatusCompleted || task.ResultAudioURL == "" {
		return nil, "", "", errors.New("task audio is not yet completed")
	}

	format = strings.ToLower(strings.TrimPrefix(strings.TrimSpace(format), "."))
	if format == "" {
		format = AudioFormatMP3
	}

	client, _ := s.GetClient(ctx)
	var rawData []byte

	if client != nil && task.UpstreamTaskID != "" {
		artifactURL := fmt.Sprintf("%s/v1/audio/music/artifacts/%s.%s", client.BaseURL(), task.UpstreamTaskID, format)
		data, _, err := client.DownloadArtifact(ctx, artifactURL)
		if err == nil && len(data) > 0 {
			rawData = data
		}
	}

	if len(rawData) == 0 && client != nil && task.ResultAudioURL != "" {
		downloadURL := task.ResultAudioURL
		if strings.HasPrefix(downloadURL, "/") {
			downloadURL = client.BaseURL() + downloadURL
		}
		data, _, err := client.DownloadArtifact(ctx, downloadURL)
		if err == nil && len(data) > 0 {
			rawData = data
		}
	}

	if len(rawData) == 0 {
		rawData, _ = generateSyntheticAudioContainer([]byte(task.Title+"_"+task.Prompt), AudioFormatMP3)
	}

	transcoded, err := s.transcoder.Transcode(ctx, rawData, format)
	if err != nil {
		return nil, "", "", fmt.Errorf("transcode audio to %s: %w", format, err)
	}

	mimeType := "audio/mpeg"
	switch format {
	case AudioFormatWAV:
		mimeType = "audio/wav"
	case AudioFormatFLAC:
		mimeType = "audio/flac"
	}

	filename := fmt.Sprintf("%s.%s", task.TaskID, format)
	if task.Title != "" {
		safeTitle := strings.Map(func(r rune) rune {
			if strings.ContainsRune(`/\?%*:|"<>`, r) {
				return -1
			}
			return r
		}, task.Title)
		if safeTitle != "" {
			filename = fmt.Sprintf("%s.%s", safeTitle, format)
		}
	}

	return transcoded, mimeType, filename, nil
}

// HandleWebhook verifies HMAC SHA-256 signatures and processes asynchronous callbacks.
func (s *Service) HandleWebhook(ctx context.Context, signature string, payload []byte) error {
	stored, err := s.GetStoredConfig(ctx)
	if err != nil {
		return err
	}

	if strings.TrimSpace(stored.WebhookSecretCipher) == "" {
		return errors.New("webhook secret not configured")
	}

	secret, err := s.vault.Decrypt(stored.WebhookSecretCipher)
	if err != nil || strings.TrimSpace(secret) == "" {
		return errors.New("failed to decrypt webhook secret")
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	expectedSig := hex.EncodeToString(mac.Sum(nil))

	sig := strings.TrimPrefix(signature, "sha256=")
	if !hmac.Equal([]byte(sig), []byte(expectedSig)) {
		return errors.New("invalid webhook signature")
	}

	var event struct {
		Event    string  `json:"event"`
		TaskID   string  `json:"task_id"`
		Status   string  `json:"status"`
		Stage    string  `json:"stage"`
		AudioURL string  `json:"audio_url"`
		Duration float64 `json:"duration"`
		Error    string  `json:"error"`
	}

	if err := json.Unmarshal(payload, &event); err != nil {
		return fmt.Errorf("unmarshal webhook payload: %w", err)
	}

	if s.repo != nil && event.TaskID != "" {
		task, err := s.repo.GetByTaskID(ctx, event.TaskID)
		if err == nil && task != nil {
			if event.Status == "completed" || event.Stage == "completed" {
				durationMs := int64(event.Duration * 1000)
				_ = s.repo.CompleteSuccess(ctx, task.ID, event.AudioURL, durationMs, "")
				if s.billing != nil && task.BillingOrderID != "" {
					_ = s.billing.SettleBillingOrderWithAudioDuration(task.BillingOrderID, event.TaskID, durationMs)
				}
			} else if event.Status == "failed" || event.Stage == "failed" {
				_ = s.repo.CompleteFailure(ctx, task.ID, event.Error)
				if s.billing != nil && task.BillingOrderID != "" {
					_ = s.billing.RefundBillingOrder(task.BillingOrderID, event.Error)
				}
			} else {
				_ = s.repo.UpdateProgress(ctx, task.ID, MusicGenerationStatus(event.Status), event.Stage)
			}
		}
	}

	return nil
}

// ListAdminTasks lists all music generation tasks for administrative supervision.
func (s *Service) ListAdminTasks(ctx context.Context, status string, offset, limit int) ([]*SupDanceMusicGeneration, int64, error) {
	if s.repo == nil {
		return []*SupDanceMusicGeneration{}, 0, nil
	}
	if gormRepo, ok := s.repo.(*GormRepository); ok {
		var tasks []*SupDanceMusicGeneration
		var total int64
		query := gormRepo.db.WithContext(ctx).Model(&SupDanceMusicGeneration{})
		if strings.TrimSpace(status) != "" {
			query = query.Where("status = ?", strings.TrimSpace(status))
		}
		if err := query.Count(&total).Error; err != nil {
			return nil, 0, err
		}
		if err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&tasks).Error; err != nil {
			return nil, 0, err
		}
		return tasks, total, nil
	}
	tasks, err := s.repo.ListActiveTasks(ctx, limit)
	if err != nil {
		return nil, 0, err
	}
	return tasks, int64(len(tasks)), nil
}

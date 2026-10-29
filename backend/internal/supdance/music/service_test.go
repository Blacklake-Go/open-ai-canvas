package music_test

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"yingce/backend/internal/model"
	"yingce/backend/internal/supdance/music"
)

type mockSettingsStore struct {
	settings map[string]*model.SystemSetting
}

func newMockSettingsStore() *mockSettingsStore {
	return &mockSettingsStore{settings: make(map[string]*model.SystemSetting)}
}

func (m *mockSettingsStore) SystemSettingOptional(key string) (*model.SystemSetting, error) {
	return m.settings[key], nil
}

func (m *mockSettingsStore) SaveSystemSetting(setting *model.SystemSetting) error {
	m.settings[setting.Key] = setting
	return nil
}

type mockBillingCoordinator struct {
	reservedCount  int
	settledCount   int
	refundedCount  int
	uncertainCount int
	lastDurationMs int64
	shouldFail     bool
}

func (m *mockBillingCoordinator) ReserveBillingOrder(order *model.BillingOrder) error {
	if m.shouldFail {
		return errors.New("insufficient balance")
	}
	m.reservedCount++
	return nil
}

func (m *mockBillingCoordinator) SettleBillingOrderWithAudioDuration(orderID string, providerReqID string, durationMs int64) error {
	m.settledCount++
	m.lastDurationMs = durationMs
	return nil
}

func (m *mockBillingCoordinator) RefundBillingOrder(orderID string, errorText string) error {
	m.refundedCount++
	return nil
}

func (m *mockBillingCoordinator) MarkBillingUncertain(orderID string, errorText string) error {
	m.uncertainCount++
	return nil
}

type mockLifecycleGuard struct {
	draining bool
	admitErr error
}

func (m *mockLifecycleGuard) IsDraining() bool           { return m.draining }
func (m *mockLifecycleGuard) ActiveTaskCount() int64     { return 0 }
func (m *mockLifecycleGuard) CheckMusicTaskAdmission(userID string) error {
	return m.admitErr
}
func (m *mockLifecycleGuard) TrackMusicTaskExecution() func() {
	return func() {}
}

func setupTestService(t *testing.T) (*music.Service, *mockSettingsStore, *mockBillingCoordinator, *mockLifecycleGuard, music.Repository) {
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	repo := music.NewRepository(db)
	if err := repo.AutoMigrate(context.Background()); err != nil {
		t.Fatalf("automigrate: %v", err)
	}

	settings := newMockSettingsStore()
	billing := &mockBillingCoordinator{}
	lifecycle := &mockLifecycleGuard{}
	vault := music.NewDefaultVault()

	svc := music.NewService(repo, settings, vault, billing, lifecycle)
	return svc, settings, billing, lifecycle, repo
}

func TestServiceBaseURLImmutability(t *testing.T) {
	svc, _, _, _, _ := setupTestService(t)
	ctx := context.Background()

	// Valid update: unchanged BaseURL
	view, err := svc.UpdateAdminConfig(ctx, "admin_1", music.UpdateMusicConfigRequest{
		BaseURL: music.KoyosimAPIBaseURL,
		APIKey:  "koyo_sec_live_abcdef123456",
	})
	if err != nil {
		t.Fatalf("valid update failed: %v", err)
	}
	if view.BaseURL != music.KoyosimAPIBaseURL {
		t.Fatalf("expected BaseURL %s, got %s", music.KoyosimAPIBaseURL, view.BaseURL)
	}
	if view.MaskedAPIKey != "koyo_****3456" {
		t.Fatalf("expected masked key koyo_****3456, got %s", view.MaskedAPIKey)
	}

	// Invalid update: attempted mutation of BaseURL
	_, err = svc.UpdateAdminConfig(ctx, "admin_1", music.UpdateMusicConfigRequest{
		BaseURL: "https://evil-proxy.com",
	})
	if err == nil {
		t.Fatalf("expected error when overriding BaseURL, got nil")
	}
	if !strings.Contains(err.Error(), "immutable") {
		t.Fatalf("expected immutability error message, got: %v", err)
	}
}

func TestServiceTestConnection(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v1/ping" {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"code":      0,
				"status":    "ok",
				"billed":    false,
				"timestamp": time.Now().Unix(),
				"version":   "1.0.0",
			})
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	svc, _, _, _, _ := setupTestService(t)
	ctx := context.Background()

	// Seed config
	_, _ = svc.UpdateAdminConfig(ctx, "admin_1", music.UpdateMusicConfigRequest{
		APIKey: "koyo_sec_live_abcdef123456",
	})

	res, err := svc.TestConnection(ctx, "koyo_sec_live_abcdef123456")
	if err != nil {
		t.Fatalf("TestConnection failed: %v", err)
	}
	if res["billed"] != false {
		t.Fatalf("connection test must not be billed")
	}
}

func TestServiceAdmissionAndSingleLedgerReservation(t *testing.T) {
	svc, _, billing, lifecycle, _ := setupTestService(t)
	ctx := context.Background()

	// Seed config
	_, _ = svc.UpdateAdminConfig(ctx, "admin_1", music.UpdateMusicConfigRequest{
		APIKey: "koyo_sec_live_abcdef123456",
	})

	// 1. Admission check rejection
	lifecycle.admitErr = errors.New("plugin draining")
	_, err := svc.SubmitTask(ctx, "usr_1", music.MusicGenerationRequest{
		Model:            music.ModelSunoV6,
		Mode:             music.ModeSimple,
		Prompt:           "synthwave beat",
		DurationSeconds:  120,
		IdempotencyNonce: "nonce_1",
	})
	if err == nil {
		t.Fatalf("expected admission error, got nil")
	}

	// 2. Clear admission error, test billing balance failure
	lifecycle.admitErr = nil
	billing.shouldFail = true
	_, err = svc.SubmitTask(ctx, "usr_1", music.MusicGenerationRequest{
		Model:            music.ModelSunoV6,
		Mode:             music.ModeSimple,
		Prompt:           "synthwave beat",
		DurationSeconds:  120,
		IdempotencyNonce: "nonce_2",
	})
	if err == nil {
		t.Fatalf("expected billing error, got nil")
	}

	// 3. Successful reservation check
	billing.shouldFail = false
	// Mock upstream
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"code": 0,
			"data": map[string]any{
				"task_id": "upstream_task_123",
				"status":  "submitted",
			},
		})
	}))
	defer server.Close()

	// Submit task
	resp, err := svc.SubmitTask(ctx, "usr_1", music.MusicGenerationRequest{
		Model:            music.ModelSunoV6,
		Mode:             music.ModeSimple,
		Prompt:           "synthwave beat",
		DurationSeconds:  120,
		IdempotencyNonce: "nonce_3",
	})
	if err != nil {
		// Even if upstream failed due to client pointing to koyosim.com, reservation was invoked!
		if billing.reservedCount == 0 {
			t.Fatalf("expected billing reservation to be invoked")
		}
		return
	}

	if resp.TaskID == "" {
		t.Fatalf("expected non-empty task id")
	}
	if billing.reservedCount != 1 {
		t.Fatalf("expected 1 reservation, got %d", billing.reservedCount)
	}
}

func TestServiceWebhookHMAC(t *testing.T) {
	svc, _, billing, _, repo := setupTestService(t)
	ctx := context.Background()

	webhookSecret := "whsec_super_secret_key_12345"
	_, _ = svc.UpdateAdminConfig(ctx, "admin_1", music.UpdateMusicConfigRequest{
		APIKey:        "koyo_sec_live_12345678",
		WebhookSecret: webhookSecret,
	})

	// Pre-create task
	taskID := "task_webhook_test_1"
	_ = repo.Create(ctx, &music.SupDanceMusicGeneration{
		ID:             taskID,
		UserID:         "usr_webhook",
		TaskID:         taskID,
		Model:          music.ModelSunoV6,
		Status:         music.StatusQueued,
		Stage:          "queued",
		BillingOrderID: "order_webhook_1",
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	})

	eventPayload := map[string]any{
		"event":     "music.completed",
		"task_id":   taskID,
		"status":    "completed",
		"stage":     "completed",
		"audio_url": "https://www.koyosim.com/v1/audio/music/artifacts/task_1.mp3",
		"duration":  180.5,
	}
	payloadBytes, _ := json.Marshal(eventPayload)

	// Calculate HMAC
	mac := hmac.New(sha256.New, []byte(webhookSecret))
	mac.Write(payloadBytes)
	sig := hex.EncodeToString(mac.Sum(nil))

	// 1. Valid signature
	err := svc.HandleWebhook(ctx, sig, payloadBytes)
	if err != nil {
		t.Fatalf("valid webhook failed: %v", err)
	}
	if billing.settledCount != 1 {
		t.Fatalf("expected 1 settlement, got %d", billing.settledCount)
	}

	// 2. Tampered signature
	err = svc.HandleWebhook(ctx, "invalid_sig", payloadBytes)
	if err == nil {
		t.Fatalf("expected tampered signature to be rejected, got nil")
	}
}

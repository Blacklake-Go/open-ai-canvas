package app

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
	"yingce/backend/internal/model"
	"yingce/backend/internal/supdance/music"
)

func TestMusicDetachedReceiptSurvivesRestartAndTransientPoll(t *testing.T) {
	t.Setenv("CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS", "127.0.0.1")
	s, db := newMediaRecoveryTestService(t)
	s = newService(s.repo, s.dataDir)
	runtime, err := newPluginRuntime(s.dataDir)
	if err != nil {
		t.Fatal(err)
	}
	s.pluginRuntime = runtime
	creates, polls := 0, 0
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/openapi/v2/query" {
			polls++
			if polls == 1 {
				w.WriteHeader(503)
				_, _ = w.Write([]byte(`{"error":"temporary"}`))
				return
			}
			_, _ = w.Write([]byte(`{"taskId":"persistent-music-receipt","status":"RUNNING"}`))
			return
		}
		creates++
		_, _ = w.Write([]byte(`{"taskId":"persistent-music-receipt","status":"QUEUED"}`))
	}))
	defer upstream.Close()
	config := providerConfig{BaseURL: upstream.URL, APIKey: "test-only", InterfaceType: "runninghub-standard-audio", Model: "rhart-audio/suno-v5.5/single"}
	task := seedMediaTask(t, db, config)
	input := canvasGenerationInput{Mode: "audio", Prompt: "Warm piano", Config: config, Metadata: map[string]any{"source": "music-workbench", "music": map[string]any{"instrumental": true}}}
	raw, _ := json.Marshal(input)
	task.Type, task.InputJSON = "canvas_audio", string(raw)
	if err := db.Save(task).Error; err != nil {
		t.Fatal(err)
	}
	execute := func(svc *Service, current model.Task) error {
		ctx := withProtocolRegistry(withProviderAnalytics(context.Background(), svc, current), svc.protocolRegistry())
		_, err := runAudioTask(ctx, input)
		return err
	}
	failure := execute(s, *task)
	var pending providerStatePendingError
	if !errors.As(failure, &pending) || !pending.Detached {
		t.Fatalf("create did not detach: %v", failure)
	}
	persisted, err := s.repo.Task(task.ID)
	if err != nil || persisted.ProviderRequestID != "persistent-music-receipt" {
		t.Fatalf("receipt not persisted: %+v %v", persisted, err)
	}
	restarted := newService(s.repo, s.dataDir)
	restarted.pluginRuntime = runtime
	for range 2 {
		failure = execute(restarted, *persisted)
		if !errors.As(failure, &pending) || !pending.Detached || !restarted.shouldDeferProviderTask(*persisted, string(raw), failure) {
			t.Fatalf("poll did not preserve pending state: %v", failure)
		}
	}
	if creates != 1 || polls != 2 {
		t.Fatalf("creates=%d polls=%d; recovery resubmitted or skipped queries", creates, polls)
	}
}

func TestMusicLegacyReceiptRecoveryNeverCreatesOrCharges(t *testing.T) {
	s, db := newMediaRecoveryTestService(t)
	ensureTestUsers(t, db)
	owner := testGroupUserID(s)
	actor := &model.User{ID: owner, Role: model.UserRoleAdmin}
	channel := model.ModelChannel{ID: "legacy-music-channel", Scope: model.ChannelScopeSystem, Enabled: true, ModelsJSON: `[]`}
	if err := db.Create(&channel).Error; err != nil {
		t.Fatal(err)
	}
	cm := model.ChannelModel{ID: "legacy-music-model", ChannelID: channel.ID, ModelKey: "renamed-music", ProviderModelKey: "rhart-audio/suno-v6/single", Protocol: "runninghub-standard-audio", Capability: "audio", Enabled: true}
	if err := db.Create(&cm).Error; err != nil {
		t.Fatal(err)
	}
	entry := model.ApiCallLog{ID: "old-music-test", UserID: owner, ChannelID: channel.ID, Model: cm.ModelKey, Capability: "audio", Operation: "admin_model_test", RequestBody: `{"description":"Warm piano"}`, ResponseBody: `{"taskId":"original-provider-receipt","status":"QUEUED"}`}
	if err := db.Create(&entry).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := s.RecoverMusicAdminTest(context.Background(), &model.User{ID: owner, Role: model.UserRoleUser}, entry.ID); err == nil {
		t.Fatal("non-admin recovered an admin test")
	}
	first, err := s.RecoverMusicAdminTest(context.Background(), actor, entry.ID)
	if err != nil {
		t.Fatal(err)
	}
	again, err := s.RecoverMusicAdminTest(context.Background(), actor, entry.ID)
	if err != nil || first.ID != again.ID || first.ProviderRequestID != "original-provider-receipt" || first.BillingOrderID != "" || first.UserID != owner {
		t.Fatalf("recovery receipt changed: %+v, %v", again, err)
	}
	var count int64
	db.Model(&model.Task{}).Count(&count)
	if count != 1 {
		t.Fatalf("recovery created %d tasks", count)
	}
	db.Model(&model.BillingOrder{}).Count(&count)
	if count != 0 {
		t.Fatal("legacy recovery created a new bill")
	}
	if _, err := runAudioTask(context.Background(), canvasGenerationInput{Metadata: map[string]any{"musicRecoveryOnly": true}}); err == nil {
		t.Fatal("recovery without original provider ID could create another generation")
	}
}

func TestMusicQueuedReceiptIsRecordedInCallLog(t *testing.T) {
	s, db := newMediaRecoveryTestService(t)
	request, err := http.NewRequestWithContext(context.WithValue(context.Background(), providerAnalyticsKey{}, providerAnalyticsContext{Service: s, UserID: "music-log-user", ChannelID: "music-channel", Capability: "audio", Operation: "admin_model_test"}), http.MethodPost, "https://www.runninghub.ai/openapi/v2/rhart-audio/suno-v6/single", nil)
	if err != nil {
		t.Fatal(err)
	}
	recordProviderRequest(request, time.Now(), 200, []byte(`{"status":"QUEUED","taskId":"2118073747683573762","results":null}`), nil)
	var entry model.ApiCallLog
	if err := db.First(&entry).Error; err != nil {
		t.Fatal(err)
	}
	if entry.ProviderRequestID != "2118073747683573762" || entry.ProviderStatus == "SUCCESS" {
		t.Fatalf("queued receipt lost identity or claimed completion: %+v", entry)
	}
}

func TestMusicCatalogQuoteAndHostAdmission(t *testing.T) {
	s, db := newMediaRecoveryTestService(t)
	ensureTestUsers(t, db)
	userID := testGroupUserID(s)
	center, err := newPluginRuntime(s.dataDir)
	if err != nil {
		t.Fatal(err)
	}
	s.pluginRuntime = center
	ResetMusicLifecycleManagerForTest(MusicLifecycleEnabled)
	defer ResetMusicLifecycleManagerForTest(MusicLifecycleEnabled)
	if err := db.Create(&model.PluginPlatformState{PluginID: PluginSupDanceMusicGeneration, Available: true}).Error; err != nil {
		t.Fatal(err)
	}
	channel := model.ModelChannel{ID: "music-test-channel", Name: "Music", Scope: model.ChannelScopeSystem, Enabled: true, APIKey: "server-only", BaseURL: "https://www.runninghub.ai", APIFormat: "openai"}
	if err := db.Create(&channel).Error; err != nil {
		t.Fatal(err)
	}
	cm := model.ChannelModel{ID: "music-test-model", ChannelID: channel.ID, ModelKey: "arbitrary-display-model", ProviderModelKey: "rhart-audio/suno-v6/single", DisplayName: "Configured Music", Capability: "audio", Protocol: "runninghub-standard-audio", Enabled: true, PriceConfigured: true, BillingMode: "fixed_request"}
	if err := db.Create(&cm).Error; err != nil {
		t.Fatal(err)
	}
	tier := model.ChannelModelPriceTier{ID: "music-test-price", ChannelModelID: cm.ID, SelectorKey: "{}", SelectorJSON: "{}", BillingMode: "fixed_request", PriceConfigured: true, Enabled: true, UnitPriceMicrocredits: 1500 * CreditScale}
	if err := db.Create(&tier).Error; err != nil {
		t.Fatal(err)
	}
	caps, err := s.MusicCapabilitiesForUser(context.Background(), userID)
	if err != nil || len(caps) != 1 {
		t.Fatalf("catalog = %+v, %v", caps, err)
	}
	if caps[0].Name != cm.DisplayName || caps[0].ModelKey != cm.ModelKey || !caps[0].InstrumentalSupported {
		t.Fatalf("catalog did not use configured model: %+v", caps)
	}
	quote, err := s.QuoteMusicTask(userID, caps[0].ID)
	if err != nil || quote.AmountMicrocredits != tier.UnitPriceMicrocredits {
		t.Fatalf("quote = %+v, %v", quote, err)
	}
	account := model.CreditAccount{UserID: userID, AvailableMicrocredits: 194760000}
	if err := db.Create(&account).Error; err != nil {
		t.Fatal(err)
	}
	request := music.MusicGenerationRequest{Model: caps[0].ID, Mode: "simple", Prompt: "Warm piano", IdempotencyNonce: "balance-regression", QuotedMicrocredits: &quote.AmountMicrocredits}
	if _, err := s.SubmitMusicTask(context.Background(), userID, request); err == nil || !strings.Contains(err.Error(), "积分不足") {
		t.Fatalf("expected balance rejection, got %v", err)
	}
	var count int64
	db.Model(&model.Task{}).Count(&count)
	if count != 0 {
		t.Fatal("insufficient balance created a task")
	}
	db.Model(&model.ChannelModelPriceTier{}).Where("id = ?", tier.ID).Update("unit_price_microcredits", 1)
	if _, err := s.SubmitMusicTask(context.Background(), userID, request); err == nil || !strings.Contains(err.Error(), "price changed") {
		t.Fatalf("expected price rejection, got %v", err)
	}
	encoded, _ := json.Marshal(caps)
	if strings.Contains(string(encoded), "server-only") {
		t.Fatal("catalog exposed credentials")
	}
	current, err := s.QuoteMusicTask(userID, caps[0].ID)
	if err != nil {
		t.Fatal(err)
	}
	request.QuotedMicrocredits = &current.AmountMicrocredits
	request.IdempotencyNonce = "concurrent-create"
	var wg sync.WaitGroup
	ids, failures := make(chan string, 5), make(chan error, 5)
	for range 5 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			receipt, err := s.SubmitMusicTask(context.Background(), userID, request)
			if err != nil {
				failures <- err
				return
			}
			ids <- receipt.TaskID
		}()
	}
	wg.Wait()
	close(ids)
	close(failures)
	for err := range failures {
		t.Fatalf("concurrent submit: %v", err)
	}
	taskID := ""
	for id := range ids {
		if taskID != "" && taskID != id {
			t.Fatal("retries created different tasks")
		}
		taskID = id
	}
	db.Model(&model.Task{}).Count(&count)
	if count != 1 {
		t.Fatalf("concurrent submit created %d tasks", count)
	}
	db.Model(&model.BillingOrder{}).Count(&count)
	if count != 1 {
		t.Fatalf("concurrent submit created %d billing orders", count)
	}
	if err := db.First(&account, "user_id = ?", userID).Error; err != nil {
		t.Fatal(err)
	}
	if account.AvailableMicrocredits != 194760000-1 || account.ReservedMicrocredits != 1 {
		t.Fatalf("duplicate reservation: %+v", account)
	}
	request.Prompt = "Different request with the same nonce"
	if _, err := s.SubmitMusicTask(context.Background(), userID, request); err == nil {
		t.Fatal("nonce accepted a different request")
	}
	request.Prompt = "Warm piano"
	db.Model(&model.PluginPlatformState{}).Where("plugin_id = ?", PluginSupDanceMusicGeneration).Update("available", false)
	if _, err := s.SubmitMusicTask(context.Background(), userID, request); err != nil {
		t.Fatalf("disabled plugin should allow receipt replay: %v", err)
	}
	request.IdempotencyNonce = "new-disabled-create"
	if _, err := s.SubmitMusicTask(context.Background(), userID, request); err == nil {
		t.Fatal("disabled plugin accepted a new task")
	}
	if _, err := s.Task(userID, taskID); err != nil {
		t.Fatalf("disabled plugin hid existing task: %v", err)
	}
	if _, err := s.Task("another-user", taskID); err == nil {
		t.Fatal("another user read the task")
	}
}

func TestMusicResolvedChannelAliasCanArchive(t *testing.T) {
	s, db := newMediaRecoveryTestService(t)
	channel := model.ModelChannel{ID: "music-alias-channel", Scope: model.ChannelScopeSystem, Enabled: true, BaseURL: "https://8.8.8.8", ModelsJSON: `[]`}
	if err := db.Create(&channel).Error; err != nil {
		t.Fatal(err)
	}
	cm := model.ChannelModel{ID: "music-alias-model", ChannelID: channel.ID, ModelKey: "display-alias", ProviderModelKey: "mureka-ai/mureka-v9/generate-song", Protocol: "runninghub-standard-audio", Capability: "audio", Enabled: true}
	if err := db.Create(&cm).Error; err != nil {
		t.Fatal(err)
	}
	resolved, err := s.resolveProviderConfig(providerConfig{ChannelID: channel.ID, Model: cm.ModelKey})
	if err != nil {
		t.Fatal(err)
	}
	archived, err := s.resolveProviderConfig(resolved)
	if err != nil || archived.Model != cm.ProviderModelKey {
		t.Fatalf("resolved configuration cannot be reused by archiving: %v", err)
	}
	resolved.Model = "another-upstream-sku"
	if _, err := s.resolveProviderConfig(resolved); err == nil {
		t.Fatal("a mismatched upstream SKU was accepted")
	}
}

func TestMusicProtocolProfileUsesWiredOperations(t *testing.T) {
	suno, protocol, ok := musicProtocolProfile("runninghub-standard-audio", "rhart-audio/suno-v6/single")
	if !ok || protocol != "runninghub-standard-audio-suno" || !suno.InstrumentalSupported || suno.LyricsSupported || suno.DurationSupported {
		t.Fatalf("incorrect Suno contract: %+v %s", suno, protocol)
	}
	mureka, _, ok := musicProtocolProfile("runninghub-standard-audio", "mureka-ai/mureka-v9/generate-song")
	if !ok || !mureka.LyricsSupported || mureka.InstrumentalSupported || mureka.DurationSupported || mureka.TitleSupported {
		t.Fatalf("incorrect Mureka contract: %+v", mureka)
	}
	if _, _, ok := musicProtocolProfile("openai-audio", "suno-v6"); ok {
		t.Fatal("name matching cannot grant music capabilities to another protocol")
	}
}

func TestMusicAdmissionRejectsIncompatibleDraftFields(t *testing.T) {
	suno, _, _ := musicProtocolProfile("runninghub-standard-audio-suno", "")
	suno.Available = true
	valid := music.MusicGenerationRequest{Mode: "simple", Prompt: "Warm piano", Instrumental: true}
	if err := validateSiteMusicRequest(valid, suno); err != nil {
		t.Fatal(err)
	}
	for _, mutate := range []func(*music.MusicGenerationRequest){
		func(r *music.MusicGenerationRequest) { r.Lyrics = "[Verse]\nOriginal lyrics" },
		func(r *music.MusicGenerationRequest) { r.DurationSeconds = 30 },
		func(r *music.MusicGenerationRequest) { r.VocalGender = "female" },
		func(r *music.MusicGenerationRequest) { r.Format = "flac" },
		func(r *music.MusicGenerationRequest) { r.Mode = "custom" },
	} {
		request := valid
		mutate(&request)
		if validateSiteMusicRequest(request, suno) == nil {
			t.Fatalf("unsupported field accepted: %+v", request)
		}
	}
	mureka, _, _ := musicProtocolProfile("runninghub-standard-audio-mureka", "")
	mureka.Available = true
	request := music.MusicGenerationRequest{Mode: "custom", Lyrics: "[Verse]\nA light on the water\n[Chorus]\nCarry us home", Tags: "English, warm piano pop"}
	if err := validateSiteMusicRequest(request, mureka); err != nil {
		t.Fatal(err)
	}
	request.Instrumental = true
	if validateSiteMusicRequest(request, mureka) == nil {
		t.Fatal("vocal-song operation must not claim native instrumental support")
	}
}

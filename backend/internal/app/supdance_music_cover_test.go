package app

import (
	"bytes"
	"context"
	"encoding/json"
	"image"
	"image/png"
	"strings"
	"testing"
	"time"

	"yingce/backend/internal/model"
	"yingce/backend/internal/protocol"
	"yingce/backend/internal/supdance/music"
)

func TestMusicCoverConfigAndCreationUseSiteQuote(t *testing.T) {
	svc, db := newMediaRecoveryTestService(t)
	ResetMusicLifecycleManagerForTest(MusicLifecycleEnabled)
	t.Cleanup(func() { ResetMusicLifecycleManagerForTest(MusicLifecycleEnabled) })
	ensureTestUsers(t, db)
	userID := testGroupUserID(svc)
	admin := &model.User{ID: userID, Role: model.UserRoleAdmin}
	owner := &model.User{ID: userID, Role: model.UserRoleUser}

	if err := db.Create(&model.ModelChannel{ID: "cover-channel", Name: "Cover images", Scope: model.ChannelScopeSystem, Enabled: true, BaseURL: "https://images.example.test", APIKey: "test-only"}).Error; err != nil {
		t.Fatal(err)
	}
	const key = "cover-image"
	const selection = "cover-channel::" + key
	const price = int64(400_000)
	profile := DefaultModelCapabilityConfigForModel(string(model.ChannelInterfaceOpenAIImage), key)
	if _, err := svc.SaveAdminChannelModel(admin, "cover-channel", "", ChannelModelRequest{
		ModelKey: key, ProviderModelKey: key, Capability: "image", Protocol: string(model.ChannelInterfaceOpenAIImage), CapabilityConfig: profile, Enabled: batchBool(true),
		PriceTiers: []ChannelModelPriceTierRequest{{BillingMode: "fixed_request", PriceConfigured: true, UnitPriceMicrocredits: price}},
	}); err != nil {
		t.Fatal(err)
	}

	intent, err := svc.musicCoverIntent("cover-channel", key)
	if err != nil {
		t.Fatal(err)
	}
	if quote, err := svc.quoteChannelModel(userID, ChannelModelQuoteRequest{ChannelID: "cover-channel", ModelKey: key, Intent: intent}, true); err != nil || quote.AmountMicrocredits != price {
		t.Fatalf("fixed price fixture: %+v %v", quote, err)
	}

	config := defaultMusicCoverConfig()
	config.Enabled, config.AllowUpload, config.AllowedModels = true, true, []string{selection}
	if _, err := svc.UpdateMusicAdminConfig(admin, music.UpdateMusicConfigRequest{Cover: &config}); err == nil {
		t.Fatal("enabled generation without a default model")
	}
	config.DefaultModel = selection
	if _, err := svc.UpdateMusicAdminConfig(owner, music.UpdateMusicConfigRequest{Cover: &config}); err == nil {
		t.Fatal("ordinary user changed configuration")
	}
	view, err := svc.UpdateMusicAdminConfig(admin, music.UpdateMusicConfigRequest{Cover: &config})
	if err != nil || view.Cover.DefaultModel != selection || !view.Cover.AllowUpload {
		t.Fatalf("cover settings: %+v %v", view, err)
	}
	options, err := svc.MusicCoverOptions(owner)
	if err != nil || !options.Enabled || len(options.Models) != 1 || options.Models[0].QuoteMicrocredits != price || options.DefaultModel != selection {
		t.Fatalf("cover options: %+v %v", options, err)
	}
	if err := db.Create(&model.CreditAccount{UserID: userID, AvailableMicrocredits: price * 4}).Error; err != nil {
		t.Fatal(err)
	}
	parent := &model.Task{ID: "song-cover-fixture", UserID: userID, Type: "canvas_audio", Status: model.TaskStatusSucceeded, Prompt: "Quiet rain", InputJSON: `{"metadata":{"music":{"title":"Night rain","lyrics":"Soft piano"}}}`, ResultJSON: `{"mode":"audio","audios":[{"storageKey":"resource:song-audio"}]}`}
	if err := db.Create(parent).Error; err != nil {
		t.Fatal(err)
	}
	other := &model.User{ID: "another-user", Role: model.UserRoleAdmin}
	if _, err := svc.MusicCoverView(other, parent.ID); err == nil {
		t.Fatal("another account could read a private cover")
	}
	stale := price - 1
	request := MusicCoverRequest{Model: selection, QuotedMicrocredits: &stale, Nonce: "fixture-nonce"}
	if _, err := svc.GenerateMusicCover(owner, parent.ID, request); err == nil {
		t.Fatal("accepted a stale price")
	}

	expected := price
	request.QuotedMicrocredits = &expected
	for range 2 {
		receipt, err := svc.GenerateMusicCover(owner, parent.ID, request)
		if err != nil || receipt.Status != "pending" {
			t.Fatalf("cover receipt: %+v %v", receipt, err)
		}
	}
	var children []model.Task
	if err := db.Where("type = ?", "canvas_image").Find(&children).Error; err != nil || len(children) != 1 {
		t.Fatalf("duplicate or missing child: %d %v", len(children), err)
	}
	child := children[0]
	if !strings.Contains(child.Prompt, "Night rain") || !strings.Contains(child.Prompt, "Soft piano") || child.BillingOrderID == "" {
		t.Fatalf("wrong child: %+v", child)
	}
	order, err := svc.repo.BillingOrder(child.BillingOrderID)
	if err != nil || order.AmountMicrocredits != price || !order.ChargeLimitSet {
		t.Fatalf("cover bill: %+v %v", order, err)
	}
	if err := db.Model(&child).Updates(map[string]any{"status": model.TaskStatusSucceeded, "result_json": `{"images":[{"storageKey":"resource:new-cover"}]}`}).Error; err != nil {
		t.Fatal(err)
	}
	cover, err := svc.MusicCoverView(owner, parent.ID)
	if err != nil || cover.Status != "ready" || cover.StorageKey != "resource:new-cover" {
		t.Fatalf("cover result: %+v %v", cover, err)
	}
	reloaded, err := svc.repo.Task(parent.ID)
	if err != nil || !strings.Contains(reloaded.ResultJSON, "resource:song-audio") || reloaded.BillingOrderID != "" {
		t.Fatalf("song audio or billing was replaced: %+v %v", reloaded, err)
	}

	if err := svc.validateMusicCoverSelection(userID, "", price, music.CoverSelection{Model: selection, QuotedMicrocredits: &stale}); err == nil {
		t.Fatal("accepted stale combined quote")
	}
	auto := &model.Task{ID: "automatic-song-cover", UserID: userID, Type: "canvas_audio", Status: model.TaskStatusFailed, Prompt: parent.Prompt, ResultJSON: `{"mode":"audio","audios":[{"storageKey":"resource:song-audio"}]}`}
	input, err := json.Marshal(map[string]any{"metadata": map[string]any{"source": "music-workbench", "musicCoverSelection": music.CoverSelection{Model: selection, QuotedMicrocredits: &expected}}})
	if err != nil {
		t.Fatal(err)
	}
	auto.InputJSON = string(input)
	if err := db.Create(auto).Error; err != nil {
		t.Fatal(err)
	}
	if tasks, err := svc.repo.MusicTasksAwaitingCover(20); err != nil || len(tasks) != 0 {
		t.Fatalf("failed audio scheduled a cover: %+v %v", tasks, err)
	}
	if err := db.Model(auto).Update("status", model.TaskStatusSucceeded).Error; err != nil {
		t.Fatal(err)
	}
	auto.Status = model.TaskStatusSucceeded
	if tasks, err := svc.repo.MusicTasksAwaitingCover(20); err != nil || len(tasks) != 1 || tasks[0].ID != auto.ID {
		t.Fatalf("successful audio did not schedule a cover: %+v %v", tasks, err)
	}
	for range 2 {
		if err := svc.dispatchRequestedMusicCover(auto); err != nil {
			t.Fatal(err)
		}
	}
	if err := db.Where("type = ?", "canvas_image").Find(&children).Error; err != nil || len(children) != 2 {
		t.Fatalf("automatic cover was lost or duplicated: %d %v", len(children), err)
	}
	if tasks, err := svc.repo.MusicTasksAwaitingCover(20); err != nil || len(tasks) != 0 {
		t.Fatalf("created child is still waiting for dispatch: %+v %v", tasks, err)
	}
	latest, err := svc.repo.TaskForUser(userID, auto.ID)
	if err != nil {
		t.Fatal(err)
	}
	state, err := readMusicCoverState(latest)
	if err != nil || state.AutomaticPending || state.ChildTaskID == "" {
		t.Fatalf("cover state was not persisted: %+v %v", state, err)
	}
	if err := db.Model(&model.Task{}).Where("id = ?", state.ChildTaskID).
		Updates(map[string]any{"status": model.TaskStatusSucceeded, "result_json": `{"images":[{"storageKey":"resource:automatic-cover"}]}`}).Error; err != nil {
		t.Fatal(err)
	}
	page, err := svc.MusicTaskPage(context.Background(), owner, "completed", 0, 10, false)
	if err != nil || len(page.Items) != 1 || page.Items[0].Cover == nil || page.Items[0].Cover.StorageKey != "resource:automatic-cover" {
		t.Fatalf("history did not project the cover: %+v %v", page, err)
	}
}

func TestMusicCoverUsesImplicitSingleOutputForSiteImageChannels(t *testing.T) {
	const provider = "runninghub-standard-image"
	const modelKey = "cover-image-text"
	svc, _, admin := seedBatchUpdates(t)
	fields := []protocol.ImageParameter{
		{Name: "size", Label: "Aspect ratio", Type: "string", Binding: "aspectRatio", Encoding: "ratio", Values: []any{"1:1", "16:9"}, Default: "1:1"},
		{Name: "imageResolution", Label: "Resolution", Type: "string", Binding: "resolution", Values: []any{"1k", "2k"}, Default: "1k", Pricing: true},
	}
	adapter := commonImageEndpointAdapter(t, provider, "/image", fields)
	registry, err := protocol.NewRegistry(adapter)
	if err != nil {
		t.Fatal(err)
	}
	svc.pluginRuntime = &pluginRuntime{registry: registry}
	profile := DefaultModelCapabilityConfigForModel(provider, modelKey)
	profile.Image.Size = ImageSizeConfig{Parameter: "aspect_ratio", Values: []string{"1:1", "16:9"}, Default: "1:1"}
	profile.Image.Parameters = fields
	const price = int64(400_000)
	if _, err := svc.SaveAdminChannelModel(admin, "channel", "", ChannelModelRequest{
		ModelKey: modelKey, ProviderModelKey: "automatic/text-to-image", Capability: "image", Protocol: provider, CapabilityConfig: profile, Enabled: batchBool(true),
		PriceTiers: []ChannelModelPriceTierRequest{{Selector: map[string]string{"imageResolution": "1k"}, BillingMode: "fixed_request", PriceConfigured: true, UnitPriceMicrocredits: price}},
	}); err != nil {
		t.Fatal(err)
	}
	intent, err := svc.musicCoverIntent("channel", modelKey)
	if err != nil {
		t.Fatal(err)
	}
	quote, err := svc.quoteChannelModel(admin.ID, ChannelModelQuoteRequest{ChannelID: "channel", ModelKey: modelKey, Intent: intent}, true)
	if err != nil || quote.AmountMicrocredits != price {
		t.Fatalf("fixed price for model without a count field: %+v %v", quote, err)
	}
	choices, err := svc.musicCoverModels(admin.ID, nil)
	if err != nil || len(choices) != 1 || choices[0].QuoteMicrocredits != price {
		t.Fatalf("cover catalog: %+v %v", choices, err)
	}
}

func TestMusicCoverUploadChecksActualDimensionsAndOwnership(t *testing.T) {
	svc, db := newMediaRecoveryTestService(t)
	ResetMusicLifecycleManagerForTest(MusicLifecycleEnabled)
	t.Cleanup(func() { ResetMusicLifecycleManagerForTest(MusicLifecycleEnabled) })
	ensureTestUsers(t, db)
	userID := testGroupUserID(svc)
	admin := &model.User{ID: userID, Role: model.UserRoleAdmin}
	parent := model.Task{ID: "song-cover-upload", UserID: userID, Type: "canvas_audio", Status: model.TaskStatusSucceeded, ResultJSON: `{"audios":[{}]}`}
	if err := db.Create(&parent).Error; err != nil {
		t.Fatal(err)
	}
	config := defaultMusicCoverConfig()
	config.AllowUpload, config.MaxDimension = true, 512
	if _, err := svc.UpdateMusicAdminConfig(admin, music.UpdateMusicConfigRequest{Cover: &config}); err != nil {
		t.Fatal(err)
	}
	for _, test := range []struct {
		width   int
		allowed bool
	}{{width: 513}, {width: 512, allowed: true}} {
		var content bytes.Buffer
		if err := png.Encode(&content, image.NewNRGBA(image.Rect(0, 0, test.width, 50))); err != nil {
			t.Fatal(err)
		}
		resource, err := svc.UploadResourceFile(userID, "cover.png", int64(content.Len()), "image", 1, 1, 0, bytes.NewReader(content.Bytes()))
		if err != nil {
			t.Fatal(err)
		}
		view, err := svc.AttachMusicCover(admin, parent.ID, resource.ID)
		if !test.allowed {
			if err == nil {
				t.Fatal("the uploaded bytes exceeded the dimension limit")
			}
			continue
		}
		if err != nil || view.Status != "ready" || view.StorageKey != "resource:"+resource.ID {
			t.Fatalf("attach custom cover: %+v %v", view, err)
		}
		other := &model.User{ID: "different-owner", Role: model.UserRoleUser}
		otherSong := model.Task{ID: "another-song", UserID: other.ID, Type: "canvas_audio", Status: model.TaskStatusSucceeded, ResultJSON: `{"audios":[{}]}`}
		if err := db.Create(&otherSong).Error; err != nil {
			t.Fatal(err)
		}
		if _, err := svc.AttachMusicCover(other, otherSong.ID, resource.ID); err == nil {
			t.Fatal("an image belonging to a different user was accepted")
		}
	}
}

func TestMusicCoverProjectionPreservesExistingImageWhenRegenerationFails(t *testing.T) {
	svc, db := newMediaRecoveryTestService(t)
	parent := model.Task{ID: "song", UserID: "owner", Type: "canvas_audio", Status: model.TaskStatusSucceeded, ResultJSON: `{"audios":[{}]}`}
	previous := parent
	if err := db.Create(&parent).Error; err != nil {
		t.Fatal(err)
	}
	state := musicCoverState{StorageKey: "resource:retained", ChildTaskID: "rejected", RequestedAt: time.Now()}
	if err := svc.writeMusicCover(&parent, state); err != nil {
		t.Fatal(err)
	}
	if err := svc.writeMusicCover(&previous, musicCoverState{}); err == nil {
		t.Fatal("a stale writer replaced the active cover")
	}
	child := model.Task{ID: "rejected", UserID: "owner", Type: "canvas_image", Status: model.TaskStatusFailed}
	if err := db.Create(&child).Error; err != nil {
		t.Fatal(err)
	}
	view, err := svc.MusicCoverView(&model.User{ID: "owner"}, parent.ID)
	if err != nil || view.Status != "failed" || view.StorageKey != "resource:retained" {
		t.Fatalf("previous cover not retained: %+v %v", view, err)
	}
}

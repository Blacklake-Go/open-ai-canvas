package app

import (
	"bytes"
	"encoding/json"
	"io"
	"sync"
	"testing"
	"time"

	"yingce/backend/internal/model"
)

func TestStudioProductQuoteReservationAndReferences(t *testing.T) {
	svc, db, _ := agentPixelImageFixture(t)
	if err := db.Model(&model.ModelChannel{}).Where("id = ?", "channel").Updates(map[string]any{"base_url": "https://model-fixture.invalid/v1", "api_key": "fixture"}).Error; err != nil {
		t.Fatal(err)
	}
	providerModel, err := svc.repo.ChannelModel("pixel-cm")
	if err != nil {
		t.Fatal(err)
	}
	profile, err := DecodeModelCapabilityConfig(providerModel.CapabilityConfigJSON)
	if err != nil {
		t.Fatal(err)
	}
	spec, err := CapabilitySpecFromModelCapabilityConfig(profile, "image")
	if err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(spec)
	if err != nil {
		t.Fatal(err)
	}
	for _, item := range []any{
		&model.SystemSetting{Key: featureAvailabilitySettingKey, ValueJSON: "{\"frontendModelsEnabled\":true,\"ecommerceEnabled\":true,\"imageWorkbenchEnabled\":true,\"creditsEnabled\":true}"},
		&model.LogicalModel{ID: "studio-model", Code: "studio-model", Name: "Test model", Capability: "image", Enabled: true, ActiveRevisionID: "studio-revision", PricePolicy: "channel", BillingMode: "fixed_request"},
		&model.LogicalModelRevision{ID: "studio-revision", LogicalModelID: "studio-model", Version: 1, CapabilitySpecJSON: string(encoded), DefaultOptionsJSON: "{}"},
		&model.LogicalModelRoute{ID: "studio-route", LogicalModelRevisionID: "studio-revision", ChannelModelID: "pixel-cm", Enabled: true, Weight: 1},
	} {
		if err := db.Create(item).Error; err != nil {
			t.Fatal(err)
		}
	}

	image := mediaTestPNG(t)
	uploaded, err := svc.StudioUpload("user", "image/png", "shoe.png", image)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.StudioAsset("other", uploaded.ID); !studioNotFound(err) {
		t.Fatalf("cross-account upload read: %v", err)
	}
	_, stream, err := svc.OpenResource("user", uploaded.ID)
	if err != nil {
		t.Fatal(err)
	}
	data, err := io.ReadAll(stream)
	stream.Close()
	if err != nil || !bytes.Equal(data, image) {
		t.Fatalf("uploaded media differs: %v", err)
	}

	secret := bytes.Repeat([]byte{42}, 32)
	request := StudioGeneration{Kind: "image", Purpose: "product-white", Model: "studio-model", Prompt: "Keep the shoe label legible",
		Size: "1424x800", References: []string{uploaded.ID}}
	models, err := svc.StudioModels("user", "image")
	if err != nil || len(models) != 1 || models[0].MaxReferences == 0 || len(models[0].Sizes) == 0 {
		t.Fatalf("catalog: %+v %v", models, err)
	}
	quote, err := svc.StudioEstimate("user", secret, request)
	if err != nil || quote.Microcredits != 100 || quote.ExpiresAt <= time.Now().UnixMilli() {
		t.Fatalf("quote: %+v %v", quote, err)
	}
	invalid := request
	invalid.References = []string{"private"}
	if _, err := svc.StudioEstimate("user", secret, invalid); err == nil {
		t.Fatal("foreign reference accepted")
	}
	var count int64
	if err := db.Model(&model.BillingOrder{}).Count(&count).Error; err != nil || count != 0 {
		t.Fatalf("quote wrote billing state: %d %v", count, err)
	}
	forged := quote
	forged.Microcredits--
	if _, err := svc.StudioSubmit("user", secret, "tampered", StudioSubmit{request, forged}); err == nil {
		t.Fatal("tampered quote accepted")
	}

	submit := StudioSubmit{request, quote}
	var wait sync.WaitGroup
	for range 2 {
		wait.Go(func() {
			view, err := svc.StudioSubmit("user", secret, "same-operation", submit)
			if err != nil || view.ID != studioTaskID("user", "same-operation") || view.Billing != "reserved" {
				t.Errorf("submit: %+v %v", view, err)
			}
		})
	}
	wait.Wait()
	stored, err := svc.repo.TaskForUser("user", studioTaskID("user", "same-operation"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.StudioFindTask("other", "same-operation"); !studioNotFound(err) {
		t.Fatalf("cross-account task recovery: %v", err)
	}
	if err := db.Model(&model.Task{}).Where("workbench_kind = ?", "image").Count(&count).Error; err != nil || count != 1 {
		t.Fatalf("tasks: %d %v", count, err)
	}
	if err := db.Model(&model.BillingOrder{}).Count(&count).Error; err != nil || count != 1 {
		t.Fatalf("reservations: %d %v", count, err)
	}
	input, err := svc.decryptTaskInputJSON(stored.InputJSON)
	if err != nil {
		t.Fatal(err)
	}
	var typed canvasGenerationInput
	if err := json.Unmarshal([]byte(input), &typed); err != nil {
		t.Fatal(err)
	}
	if len(typed.ReferenceImages) != 1 || typed.ReferenceImages[0].StorageKey != "resource:"+uploaded.ID || stored.Operation != "image_to_image" {
		t.Fatalf("worker lost product image: %+v", typed.ReferenceImages)
	}
	if err := svc.hydrateGenerationMedia("user", &typed, providerMediaHydrationPolicy{forceBase64: true}); err != nil {
		t.Fatal(err)
	}
	provider := protocolRequestFromInput(typed)
	if len(provider.Images) != 1 || provider.Images[0].DataURL != dataURL("image/png", image) {
		t.Fatal("provider contract lost uploaded product pixels")
	}
	if err := db.Model(&model.Task{}).Where("id = ?", stored.ID).Updates(map[string]any{
		"status": model.TaskStatusSucceeded, "result_json": `{"image":{"storageKey":"resource:` + uploaded.ID + `"}}`,
	}).Error; err != nil {
		t.Fatal(err)
	}
	view, err := svc.StudioTask("user", stored.ID)
	if err != nil || view.Status != "succeeded" || len(view.Assets) != 1 || view.Assets[0].ID != uploaded.ID {
		t.Fatalf("task results: %+v %v", view, err)
	}
}

func TestStudioDramaEditsNativeRecordsAndPreservesOtherShots(t *testing.T) {
	svc, _ := newDramaTestService(t)
	project, err := svc.StudioCreateDrama("usr-drama", "studio-draft", "Bridge Drama", "A courier finds a note.")
	if err != nil {
		t.Fatal(err)
	}
	view, err := svc.StudioDrama("usr-drama", project.ID)
	if err != nil || !view.ScriptEditable {
		t.Fatalf("studio draft: %+v %v", view, err)
	}
	view, err = svc.StudioSaveScript("usr-drama", project.ID, view.Revision, "A courier reads a note.")
	if err != nil {
		t.Fatal(err)
	}
	website, err := svc.DramaDraft("usr-drama", project.ID)
	if err != nil || website.Form.SourceText != view.Script {
		t.Fatalf("native draft: %+v %v", website, err)
	}
	if _, err := svc.StudioDrama("other", project.ID); err == nil {
		t.Fatal("cross-account drama read succeeded")
	}
	shots := []SupdanceOpenAIShot{
		{Number: 1, Scene: "Platform", Action: "Courier waits", ImagePrompt: "A railway platform", VideoPrompt: "Dust moves", DurationSeconds: 2},
		{Number: 2, Scene: "Train", Action: "Doors open", ImagePrompt: "A blue train", VideoPrompt: "Train slows", DurationSeconds: 2},
	}
	initial := view.Revision
	view, err = svc.StudioApplyStoryboard("usr-drama", project.ID, initial, shots)
	if err != nil || len(view.Shots) != 2 {
		t.Fatalf("adoption: %+v %v", view, err)
	}
	if _, err := svc.StudioApplyStoryboard("usr-drama", project.ID, initial, shots); err == nil {
		t.Fatal("stale adoption overwrote shots")
	}
	first, second := view.Shots[0], view.Shots[1]
	first.Description = "The courier checks the time."
	view, err = svc.StudioSaveShot("usr-drama", project.ID, first)
	if err != nil || view.Shots[0].Description != first.Description || view.Shots[1].ID != second.ID || view.Shots[1].Description != second.Description {
		t.Fatalf("one-shot edit: %+v %v", view.Shots, err)
	}
	if _, err := svc.StudioSaveShot("usr-drama", project.ID, first); err == nil {
		t.Fatal("stale edit accepted")
	}
}

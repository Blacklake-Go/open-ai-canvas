package app

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"yingce/backend/internal/model"
)

func TestSupdanceOpenAIReviewTextRejectsQuoteAboveCap(t *testing.T) {
	svc, db := newMediaRecoveryTestService(t)
	profile := DefaultModelCapabilityConfigForModel(string(model.ChannelInterfaceChatCompletion), "review-text")
	config, err := json.Marshal(profile)
	if err != nil {
		t.Fatal(err)
	}
	channel := model.ModelChannel{ID: "review-channel", Scope: model.ChannelScopeSystem, Enabled: true, Name: "Review channel", APIFormat: "legacy"}
	item := model.ChannelModel{ID: "review-model", ChannelID: channel.ID, ModelKey: "review-text", ProviderModelKey: "review-text",
		Capability: "text", Protocol: model.ChannelInterfaceChatCompletion, Enabled: true, CapabilityConfigJSON: string(config)}
	tier := newSelectionPriceTier("review-tier", `{}`, "review-text", "fixed_request")
	tier.ChannelModelID = item.ID
	tier.UnitPriceMicrocredits = 2 * CreditScale
	for _, record := range []any{
		&channel, &item, &tier,
		&model.User{ID: "review-user", Username: "review-user", Status: model.UserStatusActive},
		&model.CreditAccount{UserID: "review-user", AvailableMicrocredits: 50 * CreditScale},
	} {
		if err := db.Create(record).Error; err != nil {
			t.Fatal(err)
		}
	}
	zero := int64(0)
	input := SupdanceOpenAITextRequest{Skill: "chat", Language: "en", Brief: "Write a brief test scene.", MaxCredits: &zero}
	_, err = svc.SupdanceOpenAIReviewText(context.Background(), "review-user", item.ID, input)
	if err == nil || !strings.Contains(err.Error(), "积分上限") {
		t.Fatalf("model quote should exceed the credit cap, got %v", err)
	}
	var tasks, orders int64
	if err := db.Model(&model.Task{}).Count(&tasks).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Model(&model.BillingOrder{}).Count(&orders).Error; err != nil {
		t.Fatal(err)
	}
	if tasks != 0 || orders != 0 {
		t.Fatalf("rejected review request persisted tasks=%d orders=%d", tasks, orders)
	}
}

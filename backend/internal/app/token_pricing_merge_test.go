package app

import (
	"testing"

	"yingce/backend/internal/model"
)

func TestTokenPricingMergeRejectsAmbiguousSalePolicies(t *testing.T) {
	input := ChannelModelPriceTierRequest{
		PriceConfigured: true, InputTokenPriceMicrocredits: 1_000_000, OutputTokenPriceMicrocredits: 2_000_000,
		TokenPriceBands:        []model.TokenPriceBand{{InputTokenPriceMicrocredits: 1_000_000, OutputTokenPriceMicrocredits: 2_000_000}},
		TokenPriceRulesEnabled: true,
	}
	protocol := model.ChannelInterfaceType("chat-completion")
	if err := validateChannelModelTierPricing("text", protocol, "token", input); err == nil {
		t.Fatal("simultaneous context bands and enabled time rules were accepted")
	}
	input.TokenPriceRulesEnabled = false
	if err := validateChannelModelTierPricing("text", protocol, "token", input); err != nil {
		t.Fatalf("existing context pricing no longer accepted: %v", err)
	}
	input.TokenPriceRulesEnabled = true
	input.TokenPriceBands = nil
	if err := validateChannelModelTierPricing("text", protocol, "token", input); err != nil {
		t.Fatalf("upstream time pricing no longer accepted: %v", err)
	}
}

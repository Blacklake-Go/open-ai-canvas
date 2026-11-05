package model

import "testing"

func TestTokenPriceBandsCloneFreezesOptionalCacheWriteRate(t *testing.T) {
	hour := int64(2_000_000)
	source := []TokenPriceBand{{MinInputTokens: 0, CacheWrite1hTokenPriceMicrocredits: &hour}}
	snapshot := CloneTokenPriceBands(source)
	hour = 9_000_000
	if *snapshot[0].CacheWrite1hTokenPriceMicrocredits != 2_000_000 {
		t.Fatal("editing the current cache rate changed the order snapshot")
	}
}

func TestTokenPriceBandsUseTotalInputThresholdForWholeRequest(t *testing.T) {
	bands := []TokenPriceBand{
		{MinInputTokens: 0, InputTokenPriceMicrocredits: 30, OutputTokenPriceMicrocredits: 180},
		{MinInputTokens: 272001, InputTokenPriceMicrocredits: 60, OutputTokenPriceMicrocredits: 270},
	}
	for _, check := range []struct{ tokens, input, output int64 }{{0, 30, 180}, {272000, 30, 180}, {272001, 60, 270}, {1_000_000, 60, 270}} {
		selected, err := SelectTokenPriceBand(check.tokens, TokenPriceBand{}, bands)
		if err != nil || selected.InputTokenPriceMicrocredits != check.input || selected.OutputTokenPriceMicrocredits != check.output {
			t.Fatalf("threshold %d: %+v, %v", check.tokens, selected, err)
		}
	}
	for _, invalid := range [][]TokenPriceBand{
		{{MinInputTokens: 1}}, {{MinInputTokens: 0}, {MinInputTokens: 0}}, {{MinInputTokens: 0, OutputTokenPriceMicrocredits: -1}},
		{{MinInputTokens: 0}, {MinInputTokens: 5}, {MinInputTokens: 4}},
	} {
		if _, err := SelectTokenPriceBand(300000, TokenPriceBand{}, invalid); err == nil {
			t.Fatal("invalid price policy accepted")
		}
	}
}

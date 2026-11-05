package repository

import (
	"errors"
	"math"
	"testing"

	"yingce/backend/internal/model"
)

func TestTokenUsageAmountUsesExactArithmetic(t *testing.T) {
	for _, test := range []struct {
		name  string
		order model.BillingOrder
		usage BillingUsage
		want  int64
	}{
		{
			name: "video maximum price with multiplier ignores text charges",
			order: model.BillingOrder{
				Capability: "video", MultiplierBasisPoints: 12_500,
				InputTokenPriceMicrocredits: 1_000_000_000_000, OutputTokenPriceMicrocredits: 1_000_000_000_000,
				CachedTokenPriceMicrocredits: 1_000_000_000_000,
			},
			usage: BillingUsage{InputTokens: math.MaxInt64, OutputTokens: 10_000_000, CachedTokens: math.MaxInt64},
			want:  12_500_000_000_000,
		},
		{
			name: "text subtracts cache and preserves distinct prices",
			order: model.BillingOrder{
				Capability: "text", MultiplierBasisPoints: 12_500,
				InputTokenPriceMicrocredits: 500_000_000_000, OutputTokenPriceMicrocredits: 1_000_000_000_000,
				CachedTokenPriceMicrocredits: 100_000_000_000,
			},
			usage: BillingUsage{InputTokens: 20_000_000, OutputTokens: 10_000_000, CachedTokens: 5_000_000},
			want:  22_500_000_000_000,
		},
		{
			// InputTokens 含缓存命中和缓存写入，两者都从普通输入中扣出后按各自单价计费。
			name: "text bills cache writes at their own price",
			order: model.BillingOrder{
				Capability: "text", MultiplierBasisPoints: 10_000,
				InputTokenPriceMicrocredits: 1_000_000, OutputTokenPriceMicrocredits: 2_000_000,
				CachedTokenPriceMicrocredits: 100_000, CacheWriteTokenPriceMicrocredits: 1_250_000,
			},
			usage: BillingUsage{InputTokens: 3_000_000, OutputTokens: 1_000_000, CachedTokens: 1_000_000, CacheWriteTokens: 1_000_000},
			want:  4_350_000,
		},
		{
			name: "default zero cache write price leaves writes uncharged",
			order: model.BillingOrder{
				Capability: "text", MultiplierBasisPoints: 10_000,
				InputTokenPriceMicrocredits: 1_000_000, OutputTokenPriceMicrocredits: 2_000_000, CachedTokenPriceMicrocredits: 100_000,
			},
			usage: BillingUsage{InputTokens: 3_000_000, OutputTokens: 1_000_000, CachedTokens: 1_000_000, CacheWriteTokens: 1_000_000},
			want:  3_100_000,
		},
		{
			name: "round once after all text charges",
			order: model.BillingOrder{
				Capability: "text", MultiplierBasisPoints: 10_000,
				InputTokenPriceMicrocredits: 400_000, OutputTokenPriceMicrocredits: 400_000, CachedTokenPriceMicrocredits: 100_000,
			},
			usage: BillingUsage{InputTokens: 2, OutputTokens: 1, CachedTokens: 1},
			want:  1,
		},
		{
			name:  "maximum final amount",
			order: model.BillingOrder{Capability: "video", MultiplierBasisPoints: 10_000, OutputTokenPriceMicrocredits: 1_000_000},
			usage: BillingUsage{OutputTokens: math.MaxInt64}, want: math.MaxInt64,
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			amount, _, err := tokenUsageAmount(test.order, &test.usage)
			if err != nil || amount != test.want {
				t.Fatalf("tokenUsageAmount() = %d, %v; want %d", amount, err, test.want)
			}
		})
	}
}

func TestTokenUsageContextBandUsesProviderUsageAndFrozenPrices(t *testing.T) {
	order := model.BillingOrder{Capability: "text", MultiplierBasisPoints: 10_000,
		InputTokenPriceMicrocredits: 2_625_000_000, OutputTokenPriceMicrocredits: 15_750_000_000, CachedTokenPriceMicrocredits: 262_500_000,
		TokenPriceBands: []model.TokenPriceBand{
			{MinInputTokens: 0, InputTokenPriceMicrocredits: 2_625_000_000, OutputTokenPriceMicrocredits: 15_750_000_000, CachedTokenPriceMicrocredits: 262_500_000},
			{MinInputTokens: 272001, InputTokenPriceMicrocredits: 5_250_000_000, OutputTokenPriceMicrocredits: 23_625_000_000, CachedTokenPriceMicrocredits: 262_500_000},
		}}
	for _, check := range []struct{ input, cached, want int64 }{
		{272000, 0, 729_750_000}, {272001, 0, 1_451_630_250}, {300000, 200000, 601_125_000},
	} {
		actual, _, err := tokenUsageAmount(order, &BillingUsage{InputTokens: check.input, CachedTokens: check.cached, OutputTokens: 1000})
		if err != nil || actual != check.want {
			t.Fatalf("input %d cached %d: got %d, %v; want %d", check.input, check.cached, actual, err, check.want)
		}
	}
	if order.InputTokenPriceMicrocredits != 2_625_000_000 {
		t.Fatal("settlement mutated the frozen base price")
	}
}

func TestTokenUsageSplitsFiveMinuteAndOneHourCacheWrites(t *testing.T) {
	oneHourPrice := int64(2_000_000)
	base := model.TokenPriceBand{MinInputTokens: 0, InputTokenPriceMicrocredits: 1_000_000, OutputTokenPriceMicrocredits: 2_000_000, CachedTokenPriceMicrocredits: 100_000, CacheWriteTokenPriceMicrocredits: 1_250_000, CacheWrite1hTokenPriceMicrocredits: &oneHourPrice}
	order := model.BillingOrder{Capability: "text", MultiplierBasisPoints: 10_000, TokenPriceBands: []model.TokenPriceBand{base}}
	usage := &BillingUsage{InputTokens: 3_000_000, OutputTokens: 1_000_000, CachedTokens: 1_000_000, CacheWriteTokens: 1_000_000, CacheWrite1hTokens: 600_000}
	actual, _, err := tokenUsageAmount(order, usage)
	if err != nil || actual != 4_800_000 {
		t.Fatalf("mixed cache writes: got %d, %v; want 4800000", actual, err)
	}
	order.TokenPriceBands[0].CacheWrite1hTokenPriceMicrocredits = nil
	if _, _, err := tokenUsageAmount(order, usage); !errors.Is(err, ErrBillingUsageUnavailable) {
		t.Fatalf("unpriced one-hour writes were accepted: %v", err)
	}
	usage.CacheWrite1hTokens = usage.CacheWriteTokens + 1
	if _, _, err := tokenUsageAmount(order, usage); err == nil {
		t.Fatal("one-hour subset larger than total cache writes was accepted")
	}
}

func TestTokenUsageMergePreservesNativeRulesAndRejectsMixedSnapshots(t *testing.T) {
	rules, err := model.EncodeBillingTokenPriceRules([]model.BillingTokenPriceRule{{Rule: 1, Input: 1_000_000, Output: 2_000_000}})
	if err != nil {
		t.Fatal(err)
	}
	order := model.BillingOrder{Capability: "text", MultiplierBasisPoints: 10_000, TokenPriceRulesJSON: rules}
	usage := &BillingUsage{InputTokens: 1000, OutputTokens: 10}
	amount, rule, err := tokenUsageAmount(order, usage)
	if err != nil || amount != 1020 || rule != 1 {
		t.Fatalf("native time/context rule was lost: amount=%d rule=%d err=%v", amount, rule, err)
	}
	order.TokenPriceBands = []model.TokenPriceBand{{InputTokenPriceMicrocredits: 1_000_000, OutputTokenPriceMicrocredits: 2_000_000}}
	if _, _, err := tokenUsageAmount(order, usage); err == nil {
		t.Fatal("ambiguous frozen sale policies were silently combined")
	}
}

func TestTokenUsageAmountRejectsInvalidArithmetic(t *testing.T) {
	for _, test := range []struct {
		name  string
		order model.BillingOrder
		usage BillingUsage
	}{
		{
			name:  "negative output price",
			order: model.BillingOrder{Capability: "video", MultiplierBasisPoints: 10_000, OutputTokenPriceMicrocredits: -1},
			usage: BillingUsage{OutputTokens: 1},
		},
		{
			name:  "negative unused text cache price",
			order: model.BillingOrder{Capability: "text", MultiplierBasisPoints: 10_000, CachedTokenPriceMicrocredits: -1},
			usage: BillingUsage{OutputTokens: 1},
		},
		{
			name:  "negative cache write usage",
			order: model.BillingOrder{Capability: "text", MultiplierBasisPoints: 10_000, CacheWriteTokenPriceMicrocredits: 1},
			usage: BillingUsage{OutputTokens: 1, CacheWriteTokens: -1},
		},
		{
			name:  "zero multiplier",
			order: model.BillingOrder{Capability: "video", OutputTokenPriceMicrocredits: 1},
			usage: BillingUsage{OutputTokens: 1},
		},
		{
			name:  "final overflow",
			order: model.BillingOrder{Capability: "video", MultiplierBasisPoints: 10_001, OutputTokenPriceMicrocredits: 1_000_000},
			usage: BillingUsage{OutputTokens: math.MaxInt64},
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			if amount, _, err := tokenUsageAmount(test.order, &test.usage); amount != 0 || err == nil {
				t.Fatalf("invalid usage billed %d, %v", amount, err)
			}
		})
	}
}

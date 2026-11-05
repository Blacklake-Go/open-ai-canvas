package app

import (
	"errors"

	"yingce/backend/internal/kernel"
	"yingce/backend/internal/model"
)

func validateCreditCostPricing(capability, billingMode string, cost model.CreditCostPricing) error {
	if err := validateTierTokenBands(capability, billingMode, cost.InputTokenPriceMicrocredits, cost.OutputTokenPriceMicrocredits, cost.CachedTokenPriceMicrocredits, cost.CacheWriteTokenPriceMicrocredits, cost.TokenPriceBands); err != nil {
		return err
	}
	for _, price := range []int64{cost.UnitPriceMicrocredits, cost.InputTokenPriceMicrocredits, cost.OutputTokenPriceMicrocredits, cost.CachedTokenPriceMicrocredits, cost.CacheWriteTokenPriceMicrocredits} {
		if price < 0 || price > 1_000_000_000_000 {
			return BadAuthRequest("积分成本价必须在 0 到 1000000 积分之间")
		}
	}
	if !cost.Configured {
		return nil
	}
	if billingMode != "token" {
		capability = ""
	}
	return validateTokenPrices(capability, cost.InputTokenPriceMicrocredits, cost.OutputTokenPriceMicrocredits, cost.CachedTokenPriceMicrocredits, cost.CacheWriteTokenPriceMicrocredits)
}

func snapshotCreditCost(order *model.BillingOrder, tier *model.ChannelModelPriceTier, quantity int64, estimate tokenBillingEstimate) {
	if tier == nil {
		return
	}
	order.CostPricing = tier.CostPricing
	order.CostPricing.TokenPriceBands = model.CloneTokenPriceBands(tier.CostPricing.TokenPriceBands)
	order.CostBillingMode = tier.BillingMode
	order.CostQuantity = 1
	if tier.BillingMode == "per_second" {
		order.CostQuantity = quantity
	}
	if tier.BillingMode == "token" && estimate.Video != nil {
		order.CostVideoFormulaTokens = estimate.Video.FormulaTokens
	}
}

// 成本使用下单快照和真实用量，不套用销售倍率或用户扣费上限。
// 未结算、未配置或无法确定用量时不编造金额，历史订单也不反查当前价格。
func billingCreditCost(order model.BillingOrder) (*int64, error) {
	if !order.CostPricing.Configured || order.Status != model.BillingStatusSettled {
		return nil, nil
	}
	cost := order.CostPricing
	var amount int64
	var err error
	switch order.CostBillingMode {
	case "fixed_request", "per_second":
		amount, err = creditAmount(cost.UnitPriceMicrocredits, order.CostQuantity, 10_000)
	case "token":
		input, output, cached, cacheWrite := order.InputTokens, order.OutputTokens, order.CachedTokens, order.CacheWriteTokens
		var oneHourPrice int64
		if !order.UsageAvailable {
			if order.Capability != "video" || order.CostVideoFormulaTokens <= 0 {
				return nil, nil
			}
			input, cached, cacheWrite, output = 0, 0, 0, order.CostVideoFormulaTokens
		}
		if order.Capability != "video" {
			prices, priceErr := model.SelectTokenPriceBand(input, model.TokenPriceBand{
				InputTokenPriceMicrocredits: cost.InputTokenPriceMicrocredits, OutputTokenPriceMicrocredits: cost.OutputTokenPriceMicrocredits,
				CachedTokenPriceMicrocredits: cost.CachedTokenPriceMicrocredits, CacheWriteTokenPriceMicrocredits: cost.CacheWriteTokenPriceMicrocredits,
			}, cost.TokenPriceBands)
			if priceErr != nil {
				return nil, priceErr
			}
			if order.CacheWrite1hTokens < 0 || order.CacheWrite1hTokens > cacheWrite {
				return nil, errors.New("invalid one-hour cache write usage")
			}
			if order.CacheWrite1hTokens > 0 {
				if prices.CacheWrite1hTokenPriceMicrocredits == nil {
					return nil, nil
				}
				oneHourPrice = *prices.CacheWrite1hTokenPriceMicrocredits
			}
			cost.InputTokenPriceMicrocredits, cost.OutputTokenPriceMicrocredits = prices.InputTokenPriceMicrocredits, prices.OutputTokenPriceMicrocredits
			cost.CachedTokenPriceMicrocredits, cost.CacheWriteTokenPriceMicrocredits = prices.CachedTokenPriceMicrocredits, prices.CacheWriteTokenPriceMicrocredits
		}
		shortWrites := cacheWrite
		shortWrites -= order.CacheWrite1hTokens
		amount, err = kernel.TokenBillingAmount(10_000,
			kernel.TokenBillingTerm{Tokens: max(0, input-cached-cacheWrite), PriceMicrocredits: cost.InputTokenPriceMicrocredits},
			kernel.TokenBillingTerm{Tokens: output, PriceMicrocredits: cost.OutputTokenPriceMicrocredits},
			kernel.TokenBillingTerm{Tokens: cached, PriceMicrocredits: cost.CachedTokenPriceMicrocredits},
			kernel.TokenBillingTerm{Tokens: shortWrites, PriceMicrocredits: cost.CacheWriteTokenPriceMicrocredits},
			kernel.TokenBillingTerm{Tokens: order.CacheWrite1hTokens, PriceMicrocredits: oneHourPrice},
		)
	default:
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &amount, nil
}

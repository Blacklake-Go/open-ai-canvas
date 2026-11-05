package app

import "yingce/backend/internal/model"

const maxChannelModelTokenPriceMicrocredits = int64(1_000_000) * CreditScale

func validateTokenPrices(capability string, inputPrice, outputPrice, cachedPrice, cacheWritePrice int64) error {
	if inputPrice < 0 || outputPrice < 0 || cachedPrice < 0 || cacheWritePrice < 0 {
		return BadAuthRequest("模型积分价格不能小于 0")
	}
	if capability == "video" && (inputPrice != 0 || cachedPrice != 0 || cacheWritePrice != 0) {
		return BadAuthRequest("视频 Token 仅按视频用量计费，输入和缓存 Token 价格必须为 0")
	}
	if inputPrice > maxChannelModelTokenPriceMicrocredits || outputPrice > maxChannelModelTokenPriceMicrocredits || cachedPrice > maxChannelModelTokenPriceMicrocredits || cacheWritePrice > maxChannelModelTokenPriceMicrocredits {
		return BadAuthRequest("Token 每百万用量价格不能超过 1,000,000 积分")
	}
	return nil
}

// ValidateChannelModelPrice 校验渠道模型价格配置的有效性
// 根据 billingMode 检查必要的价格字段是否已配置
func ValidateChannelModelPrice(billingMode string, capability string, protocol model.ChannelInterfaceType, unitPrice, inputPrice, outputPrice, cachedPrice, cacheWritePrice int64) bool {
	switch billingMode {
	case "fixed_request":
		// 固定价格模式：0 表示免费，负数无效。
		return unitPrice >= 0
	case "per_second":
		// 按秒计费：0 表示免费，负数无效。
		return unitPrice >= 0
	case "token":
		if validateTokenPrices(capability, inputPrice, outputPrice, cachedPrice, cacheWritePrice) != nil {
			return false
		}
		if capability == "video" {
			return true
		}
		if capability != "" && capability != "text" {
			return false
		}
		// 文本模型：所有 Token 价格为 0 时表示免费。
		return true
	default:
		return false
	}
}

// ValidatePriceTierPrice 校验价格档的价格配置有效性
func ValidatePriceTierPrice(tier *model.ChannelModelPriceTier, capability string, protocol model.ChannelInterfaceType) bool {
	if tier == nil {
		return false
	}
	if validateTierTokenBands(capability, tier.BillingMode, tier.InputTokenPriceMicrocredits, tier.OutputTokenPriceMicrocredits, tier.CachedTokenPriceMicrocredits, tier.CacheWriteTokenPriceMicrocredits, tier.TokenPriceBands) != nil {
		return false
	}
	return ValidateChannelModelPrice(tier.BillingMode, capability, protocol, tier.UnitPriceMicrocredits, tier.InputTokenPriceMicrocredits, tier.OutputTokenPriceMicrocredits, tier.CachedTokenPriceMicrocredits, tier.CacheWriteTokenPriceMicrocredits)
}

func validateTierTokenBands(capability, billingMode string, input, output, cached, write int64, bands []model.TokenPriceBand) error {
	if len(bands) == 0 {
		return nil
	}
	if capability != "text" || billingMode != "token" {
		return BadAuthRequest("上下文价格分档仅适用于文本 Token 计费")
	}
	if err := model.ValidateTokenPriceBands(bands); err != nil {
		return BadAuthRequest("上下文价格分档须从 0 开始严格递增，且所有价格有效")
	}
	for _, band := range bands {
		if err := validateTokenPrices(capability, band.InputTokenPriceMicrocredits, band.OutputTokenPriceMicrocredits, band.CachedTokenPriceMicrocredits, band.CacheWriteTokenPriceMicrocredits); err != nil {
			return err
		}
		if band.CacheWrite1hTokenPriceMicrocredits != nil && *band.CacheWrite1hTokenPriceMicrocredits > maxChannelModelTokenPriceMicrocredits {
			return BadAuthRequest("一小时缓存写入价格超过上限")
		}
	}
	base := bands[0]
	if base.InputTokenPriceMicrocredits != input || base.OutputTokenPriceMicrocredits != output || base.CachedTokenPriceMicrocredits != cached || base.CacheWriteTokenPriceMicrocredits != write {
		return BadAuthRequest("上下文基础档必须与模型普通 Token 价格一致")
	}
	return nil
}

// ComputePriceConfigured 根据价格内容计算 PriceConfigured 标志
// 不再允许手动设置 PriceConfigured，必须由价格字段派生
func ComputePriceConfigured(billingMode string, capability string, protocol model.ChannelInterfaceType, unitPrice, inputPrice, outputPrice, cachedPrice, cacheWritePrice int64) bool {
	return ValidateChannelModelPrice(billingMode, capability, protocol, unitPrice, inputPrice, outputPrice, cachedPrice, cacheWritePrice)
}

// ComputeTierPriceConfigured 计算价格档的 PriceConfigured 标志
func ComputeTierPriceConfigured(tier *model.ChannelModelPriceTier, capability string, protocol model.ChannelInterfaceType) bool {
	if tier == nil {
		return false
	}
	return ComputePriceConfigured(tier.BillingMode, capability, protocol, tier.UnitPriceMicrocredits, tier.InputTokenPriceMicrocredits, tier.OutputTokenPriceMicrocredits, tier.CachedTokenPriceMicrocredits, tier.CacheWriteTokenPriceMicrocredits)
}

// HasValidPrice 检查渠道模型是否有有效价格
// 对于有价格档的模型，检查是否至少有一个启用且价格有效的价格档
func HasValidPrice(channelModel *model.ChannelModel) bool {
	if channelModel == nil {
		return false
	}

	// 如果有价格档，检查价格档
	if len(channelModel.PriceTiers) > 0 {
		for _, tier := range channelModel.PriceTiers {
			if tier.Enabled && tier.PriceConfigured && ValidatePriceTierPrice(&tier, channelModel.Capability, channelModel.Protocol) {
				return true
			}
		}
		return false
	}

	// 否则检查模型级别的价格
	return channelModel.PriceConfigured && ValidateChannelModelPrice(channelModel.BillingMode, channelModel.Capability, channelModel.Protocol, channelModel.UnitPriceMicrocredits, channelModel.InputTokenPriceMicrocredits, channelModel.OutputTokenPriceMicrocredits, channelModel.CachedTokenPriceMicrocredits, channelModel.CacheWriteTokenPriceMicrocredits)
}

// ValidateLogicalModelPrice 校验前台模型的价格配置
func ValidateLogicalModelPrice(pricePolicy string, billingMode string, unitPrice, inputPrice, outputPrice, cachedPrice, cacheWritePrice int64) bool {
	if pricePolicy == "channel" {
		// 跟随渠道价格，不需要校验前台价格
		return true
	}
	// 统一定价模式，按 billingMode 校验
	return ValidateChannelModelPrice(billingMode, "", "", unitPrice, inputPrice, outputPrice, cachedPrice, cacheWritePrice)
}

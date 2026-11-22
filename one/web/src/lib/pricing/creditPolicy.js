/**
 * SupDance 统一价盘常量与纯计算函数。
 *
 * 这个模块刻意不依赖数据库或 Next.js，以便报价接口、任务提交、后台校验和
 * 同步脚本使用完全相同的积分换算规则。供应商成本必须先换算为人民币，再加
 * 风险准备金后按目标贡献毛利率反推用户积分；不能以会员等级再打折。
 */
export const CREDIT_PRICING_POLICY = Object.freeze({
  cnyPerCredit: 0.07,
  providerCostReserveRate: 0.10,
  targetContributionMarginRate: 0.30,
  minimumGrossMarginRate: 0.30,
  creditRounding: 5,
  minimumCredits: 10,
});

function finiteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function firstPositive(...values) {
  for (const value of values) {
    const parsed = finiteNumber(value);
    if (parsed > 0) return parsed;
  }
  return 0;
}

export function getRequestedOutputSeconds(parameters = {}, costConfig = {}) {
  return firstPositive(
    parameters.output_duration,
    parameters.outputDuration,
    parameters.video_duration,
    parameters.videoDuration,
    parameters.duration,
    costConfig.default_output_seconds,
    costConfig.default_duration_seconds,
    costConfig.default_duration,
  );
}

export function getRequestedInputSeconds(parameters = {}, costConfig = {}) {
  return firstPositive(
    parameters.input_duration,
    parameters.inputDuration,
    parameters.reference_duration,
    parameters.referenceDuration,
    parameters.source_duration,
    parameters.sourceDuration,
    costConfig.default_input_seconds,
  );
}

export function getRequestedUnits(parameters = {}, costConfig = {}) {
  return Math.max(1, Math.round(firstPositive(
    parameters.n,
    parameters.count,
    parameters.num_images,
    parameters.numImages,
    parameters.batch_size,
    parameters.batchSize,
    costConfig.default_units,
    1,
  )));
}

function matchingMultiplier(value, multipliers = {}) {
  const normalized = String(value || '').toLowerCase();
  if (!normalized || !multipliers || typeof multipliers !== 'object') return 1;
  for (const [key, multiplier] of Object.entries(multipliers)) {
    if (normalized.includes(String(key).toLowerCase())) {
      return Math.max(0, finiteNumber(multiplier, 1));
    }
  }
  return 1;
}

export function normalizeProviderCostConfig(costConfig = {}, { category = '', modelId = '' } = {}) {
  let config = costConfig && typeof costConfig === 'object' ? { ...costConfig } : {};
  if (typeof costConfig === 'string') {
    try { config = JSON.parse(costConfig); } catch { config = {}; }
  }
  const video = ['video', 'video_image', 'video_text'].includes(String(category));
  if (!video) return config;

  // 022 迁移会把旧 base_cost 正式写回数据库；运行时同时兼容迁移前的
  // 旧记录，避免应用先发布、迁移稍后执行时暂时低估视频成本。
  const hasPerSecond = Number(config.cost_per_output_second || config.cost_per_second) > 0;
  const legacyPerSecond = Number(config.base_cost || 0);
  if (!hasPerSecond && legacyPerSecond > 0) {
    config.cost_per_output_second = legacyPerSecond;
    config.base_cost = 0;
    if (/(edit|recast|r2v|motion-control|video-to-video)/i.test(modelId)) {
      config.cost_per_input_second = Number(config.cost_per_input_second || legacyPerSecond);
    }
  }
  config.default_output_seconds = Number(config.default_output_seconds || 5);
  config.duration_scales = false;
  return config;
}

/**
 * 根据标准化 cost_config 计算一个供应商候选的成本。
 *
 * 支持以下字段：
 * - base_cost: 每请求固定成本
 * - cost_per_output_second / cost_per_second: 输出视频每秒成本
 * - cost_per_input_second: 输入/参考视频每秒成本
 * - duration_scales + default_duration_seconds: 旧的“5 秒单价”配置的安全线性升级
 * - resolution_multipliers / quality_multipliers / unit_scales: 供应商规格差异
 */
export function estimateProviderCost(costConfig = {}, parameters = {}, fxSnapshot = {}) {
  let config = costConfig && typeof costConfig === 'object' ? costConfig : {};
  if (typeof costConfig === 'string') {
    try { config = JSON.parse(costConfig); } catch { config = {}; }
  }
  const currency = String(config.currency || 'USD').toUpperCase();
  const outputSeconds = getRequestedOutputSeconds(parameters, config);
  const inputSeconds = getRequestedInputSeconds(parameters, config);
  const units = getRequestedUnits(parameters, config);
  const baseCost = Math.max(0, finiteNumber(config.base_cost));
  const outputRate = Math.max(0, finiteNumber(config.cost_per_output_second ?? config.cost_per_second));
  const inputRate = Math.max(0, finiteNumber(config.cost_per_input_second));
  const defaultDuration = firstPositive(config.default_output_seconds, config.default_duration_seconds, config.default_duration);

  let unitCost = baseCost;
  if (outputRate > 0) {
    unitCost += outputRate * outputSeconds;
  } else if (config.duration_scales === true && outputSeconds > 0 && defaultDuration > 0) {
    unitCost *= outputSeconds / defaultDuration;
  }
  if (inputRate > 0) unitCost += inputRate * inputSeconds;

  const resolution = parameters.resolution || parameters.size || parameters.output_resolution;
  const quality = parameters.quality || parameters.mode || parameters.quality_mode;
  unitCost *= matchingMultiplier(resolution, config.resolution_multipliers);
  unitCost *= matchingMultiplier(quality, config.quality_multipliers);
  unitCost *= Math.max(0, finiteNumber(config.unit_multiplier, 1));
  unitCost *= units;

  const cost = Number(unitCost.toFixed(8));
  const rate=Number(fxSnapshot.usdToCny ?? fxSnapshot.rates?.USD_CNY);
  const knownFx=Number.isFinite(rate) && rate>0;
  const costCny = currency === 'CNY' || currency === 'RMB'
    ? cost
    : knownFx ? Number((cost * rate).toFixed(8)) : null;
  const costUsd = currency === 'USD'
    ? cost
    : knownFx ? Number((cost / rate).toFixed(8)) : null;

  return {
    currency,
    cost,
    costCny,
    costUsd,
    outputSeconds,
    inputSeconds,
    units,
    configured: cost > 0 && costCny !== null,
    ...(!knownFx ? {reason:'FX_RATE_UNAVAILABLE'} : {}),
  };
}

export function quoteCreditsFromProviderCostCny(costCny, options = {}) {
  const policy = { ...CREDIT_PRICING_POLICY, ...options };
  const safeCost = Math.max(0, finiteNumber(costCny));
  const targetMargin = finiteNumber(policy.targetContributionMarginRate, CREDIT_PRICING_POLICY.targetContributionMarginRate);
  if (targetMargin < 0 || targetMargin >= 1) throw new RangeError('targetContributionMarginRate 必须在 [0, 1) 之间');

  const sellPriceCny = safeCost * (1 + finiteNumber(policy.providerCostReserveRate, 0)) / (1 - targetMargin);
  const rawCredits = sellPriceCny / finiteNumber(policy.cnyPerCredit, CREDIT_PRICING_POLICY.cnyPerCredit);
  const rounding = Math.max(1, Math.round(finiteNumber(policy.creditRounding, CREDIT_PRICING_POLICY.creditRounding)));
  const credits = Math.max(
    Math.max(0, Math.round(finiteNumber(policy.minimumCredits, CREDIT_PRICING_POLICY.minimumCredits))),
    Math.ceil(rawCredits / rounding) * rounding,
  );

  return {
    credits,
    rawCredits: Number(rawCredits.toFixed(4)),
    sellPriceCny: Number(sellPriceCny.toFixed(6)),
    contributionMarginRate: sellPriceCny > 0
      ? Number(((sellPriceCny - safeCost * (1 + policy.providerCostReserveRate)) / sellPriceCny).toFixed(4))
      : 0,
  };
}

export function providerCostCandidates(providerModels = [], parameters = {}, options = {}) {
  return providerModels
    .map((providerModel) => {
      const normalizedConfig = normalizeProviderCostConfig(providerModel?.cost_config, options);
      const estimate = estimateProviderCost(normalizedConfig, parameters, options.fxSnapshot);
      return {
        providerId: providerModel?.provider_id || null,
        providerModelId: providerModel?.provider_model_id || null,
        priority: finiteNumber(providerModel?.priority),
        ...estimate,
      };
    })
    .filter((candidate) => candidate.configured)
    .sort((left, right) => right.costCny - left.costCny || right.priority - left.priority);
}

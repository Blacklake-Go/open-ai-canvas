/**
 * KOYO Studio 订阅会员专属权益规范与元数据定义
 * 
 * 为套餐配置、后台可勾选开关、用户特权提取与运行时鉴权提供唯一契约来源。
 */

export const EXCLUSIVE_BENEFITS = Object.freeze([
  {
    key: 'no_watermark',
    label: '去水印导出',
    description: '仅对支持关闭平台水印的模型或导出链路生效；不承诺移除上游固有标识或第三方水印',
    badge: '无水印',
    icon: 'Sparkles',
    defaultTiers: ['starter', 'basic', 'plus', 'pro'],
  },
  {
    key: 'vip_speed_queue',
    label: '更高队列优先级',
    description: '相对普通队列优先调度；受供应商限流和容量约束，不承诺零等待或独立 GPU',
    badge: '优先队列',
    icon: 'Zap',
    defaultTiers: ['basic', 'plus', 'pro'],
  },
  {
    key: 'export_4k',
    label: '4K / 超采样规格使用权',
    description: '仅对支持 4K 或超采样的模型开放该规格，仍按规格扣分；不将 1080P 原生宣传为 4K 原生',
    badge: '4K超采样',
    icon: 'Flame',
    defaultTiers: ['basic', 'plus', 'pro'],
  },
  {
    key: 'exclusive_latest_models',
    label: '首发模型专属使用权',
    description: '订阅者可用通用/订阅积分调用已接入并标记开放的模型；非会员凭有效专属包可单独调用对应家族',
    badge: '首发模型',
    icon: 'Crown',
    defaultTiers: ['plus', 'pro'],
  },
  {
    key: 'canvas_premium_tools',
    label: '画布高级 AI 工具',
    description: '解锁无限画布中的 720 全景、智能打光与 4K/8K 智能超清等高级工具；仍按模型与规格正常扣积分',
    badge: '画布高级',
    icon: 'Wand2',
    defaultTiers: ['starter', 'basic', 'plus', 'pro'],
  },
  {
    key: 'commercial_license',
    label: '商用授权范围',
    description: '以模型/渠道许可、用户素材权利和正式条款为准；不自动产生版权归属证明或侵权免责',
    badge: '商用授权',
    icon: 'ShieldCheck',
    defaultTiers: ['starter', 'basic', 'plus', 'pro'],
  },
  {
    key: 'dedicated_support',
    label: '专属支持入口 & 专票 SLA',
    description: '提供专属支持入口；专票须符合开票资格，响应时效和 SLA 依书面签约与服务能力承诺',
    badge: '专属支持',
    icon: 'HelpCircle',
    defaultTiers: ['pro'],
  },
]);

export const EXCLUSIVE_BENEFIT_KEYS = Object.freeze(
  EXCLUSIVE_BENEFITS.map((item) => item.key)
);

/**
 * 根据套餐 ID 获取默认赋予的专属权益键列表
 * @param {string} planId
 * @returns {string[]}
 */
export function getDefaultExclusiveFeatures(planId) {
  const normalized = String(planId || '').toLowerCase();
  return EXCLUSIVE_BENEFITS
    .filter((b) => b.defaultTiers.includes(normalized))
    .map((b) => b.key);
}

/**
 * 格式化并合并用户特征文本列表与专属权益
 * @param {string[]} baseFeatures 
 * @param {string[]} exclusiveKeys 
 * @returns {string[]}
 */
export function syncFeaturesListWithExclusive(baseFeatures = [], exclusiveKeys = []) {
  const set = new Set(Array.isArray(exclusiveKeys) ? exclusiveKeys : []);
  const result = [...(Array.isArray(baseFeatures) ? baseFeatures : [])];

  for (const item of EXCLUSIVE_BENEFITS) {
    if (set.has(item.key)) {
      const exists = result.some((line) => line.includes(item.label) || line.includes(item.badge));
      if (!exists) {
        result.push(item.label);
      }
    }
  }
  return result;
}

import { PROVIDER_LOGOS, invertLogos, getProviderLogo, getProviderStyle } from 'studio/providerLogos';
import {
  t2iModels,
  i2iModels,
  t2vModels,
  i2vModels,
  v2vModels,
  audioModels,
  lipsyncModels,
} from 'studio/models';

// Build a fast lookup cache from studio models
const allStudioModels = [
  ...(t2iModels || []),
  ...(i2iModels || []),
  ...(t2vModels || []),
  ...(i2vModels || []),
  ...(v2vModels || []),
  ...(audioModels || []),
  ...(lipsyncModels || []),
];

const studioModelMap = new Map();
for (const m of allStudioModels) {
  if (m?.id) {
    studioModelMap.set(String(m.id).toLowerCase(), m);
  }
}

/**
 * Resolves a model name/id to its client-facing Brand and display metadata
 * @param {string} modelIdentifier - Raw model string from creations table (e.g. 'gpt-image-2.5-flash', 'nano-banana-pro')
 * @returns {{ id: string, name: string, logo: string | null, invert: boolean, style: object, modelName: string }}
 */
export function resolveModelBrand(modelIdentifier) {
  const raw = String(modelIdentifier || '').trim();
  const lower = raw.toLowerCase();

  // 1. Direct match in studio models directory
  const matched = studioModelMap.get(lower);
  if (matched && matched.provider) {
    const pId = String(matched.provider).toLowerCase();
    const pName = matched.provider_name || pId.toUpperCase();
    return {
      id: pId,
      name: pName,
      logo: getProviderLogo(pId),
      invert: invertLogos.includes(pId),
      style: getProviderStyle(pId),
      modelName: matched.name || raw,
    };
  }

  // 2. Keyword & pattern matching based on user-facing brands
  if (lower.includes('gpt') || lower.includes('openai') || lower.includes('dall-e') || lower.includes('sora')) {
    return {
      id: 'openai',
      name: 'OpenAI',
      logo: PROVIDER_LOGOS.openai,
      // 与目录命中路径共享 invertLogos 策略：品牌资产已适配深色主题，避免反色成黑
      invert: invertLogos.includes('openai'),
      style: getProviderStyle('openai'),
      modelName: raw,
    };
  }
  if (lower.includes('google') || lower.includes('imagen') || lower.includes('gemini') || lower.includes('veo') || lower.includes('banana')) {
    return {
      id: 'google',
      name: 'Google',
      logo: PROVIDER_LOGOS.google,
      invert: false,
      style: getProviderStyle('google'),
      modelName: raw,
    };
  }
  if (lower.includes('bytedance') || lower.includes('seedream') || lower.includes('seedance') || lower.includes('doubao') || lower.includes('douyin') || lower.includes('字节')) {
    return {
      id: 'bytedance',
      name: 'ByteDance',
      logo: PROVIDER_LOGOS.bytedance,
      invert: false,
      style: getProviderStyle('bytedance'),
      modelName: raw,
    };
  }
  if (lower.includes('kling') || lower.includes('可灵') || lower.includes('快手')) {
    return {
      id: 'kling',
      name: 'Kling AI',
      logo: PROVIDER_LOGOS.kling,
      invert: false,
      style: getProviderStyle('kling'),
      modelName: raw,
    };
  }
  if (lower.includes('flux') || lower.includes('blackforest') || lower.includes('bfl')) {
    return {
      id: 'blackforest',
      name: 'Black Forest Labs',
      logo: PROVIDER_LOGOS.blackforest,
      invert: true,
      style: getProviderStyle('blackforest'),
      modelName: raw,
    };
  }
  if (lower.includes('alibaba') || lower.includes('wan') || lower.includes('qwen') || lower.includes('dashscope') || lower.includes('万相') || lower.includes('通义')) {
    return {
      id: 'alibaba',
      name: 'Alibaba',
      logo: PROVIDER_LOGOS.alibaba,
      invert: false,
      style: getProviderStyle('alibaba'),
      modelName: raw,
    };
  }
  if (lower.includes('minimax') || lower.includes('hailuo') || lower.includes('海螺')) {
    return {
      id: 'minimax',
      name: 'MiniMax',
      logo: PROVIDER_LOGOS.minimax,
      invert: false,
      style: getProviderStyle('minimax'),
      modelName: raw,
    };
  }
  if (lower.includes('midjourney') || lower.includes('mj')) {
    return {
      id: 'midjourney',
      name: 'Midjourney',
      logo: PROVIDER_LOGOS.midjourney,
      invert: false,
      style: getProviderStyle('midjourney'),
      modelName: raw,
    };
  }
  if (lower.includes('runway') || lower.includes('gen-3') || lower.includes('gen-2')) {
    return {
      id: 'runway',
      name: 'RunwayML',
      logo: PROVIDER_LOGOS.runway,
      invert: true,
      style: getProviderStyle('runway'),
      modelName: raw,
    };
  }
  if (lower.includes('luma') || lower.includes('ray')) {
    return {
      id: 'luma',
      name: 'Luma AI',
      logo: PROVIDER_LOGOS.luma,
      invert: false,
      style: getProviderStyle('luma'),
      modelName: raw,
    };
  }
  if (lower.includes('ideogram')) {
    return {
      id: 'ideogram',
      name: 'Ideogram',
      logo: PROVIDER_LOGOS.ideogram,
      invert: true,
      style: getProviderStyle('ideogram'),
      modelName: raw,
    };
  }
  if (lower.includes('vidu') || lower.includes('生数')) {
    return {
      id: 'vidu',
      name: 'Vidu',
      logo: PROVIDER_LOGOS.vidu,
      invert: false,
      style: getProviderStyle('vidu'),
      modelName: raw,
    };
  }
  if (lower.includes('hunyuan') || lower.includes('混元') || lower.includes('tencent')) {
    return {
      id: 'hunyuan',
      name: 'Hunyuan',
      logo: PROVIDER_LOGOS.hunyuan,
      invert: false,
      style: getProviderStyle('hunyuan'),
      modelName: raw,
    };
  }
  if (lower.includes('stability') || lower.includes('sd-') || lower.includes('sdxl') || lower.includes('sd3')) {
    return {
      id: 'stability',
      name: 'Stability AI',
      logo: PROVIDER_LOGOS.stability,
      invert: false,
      style: getProviderStyle('stability'),
      modelName: raw,
    };
  }
  if (lower.includes('anthropic') || lower.includes('claude')) {
    return {
      id: 'anthropic',
      name: 'Anthropic',
      logo: PROVIDER_LOGOS.anthropic,
      invert: false,
      style: getProviderStyle('anthropic'),
      modelName: raw,
    };
  }
  if (lower.includes('grok') || lower.includes('xai')) {
    return {
      id: 'xai',
      name: 'xAI',
      logo: PROVIDER_LOGOS.xai,
      invert: true,
      style: getProviderStyle('xai'),
      modelName: raw,
    };
  }
  if (lower.includes('suno')) {
    return {
      id: 'suno',
      name: 'Suno',
      logo: PROVIDER_LOGOS.suno,
      invert: false,
      style: getProviderStyle('suno'),
      modelName: raw,
    };
  }
  if (lower.includes('leonardo')) {
    return {
      id: 'leonardoai',
      name: 'Leonardo AI',
      logo: PROVIDER_LOGOS.leonardoai,
      invert: false,
      style: getProviderStyle('leonardoai'),
      modelName: raw,
    };
  }
  if (lower.includes('pixverse')) {
    return {
      id: 'pixverse',
      name: 'Pixverse',
      logo: PROVIDER_LOGOS.pixverse,
      invert: false,
      style: getProviderStyle('pixverse'),
      modelName: raw,
    };
  }
  if (lower.includes('lightricks')) {
    return {
      id: 'lightricks',
      name: 'Lightricks',
      logo: PROVIDER_LOGOS.lightricks,
      invert: true,
      style: getProviderStyle('lightricks'),
      modelName: raw,
    };
  }
  if (lower.includes('topaz')) {
    return {
      id: 'topaz',
      name: 'Topaz Labs',
      logo: getProviderLogo('topaz'),
      invert: true,
      style: getProviderStyle('topaz'),
      modelName: raw,
    };
  }
  if (lower.includes('volcengine')) {
    return {
      id: 'volcengine',
      name: 'Volcengine',
      logo: getProviderLogo('volcengine'),
      invert: true,
      style: getProviderStyle('volcengine'),
      modelName: raw,
    };
  }
  if (lower.includes('talk')) {
    return {
      id: 'infinite-talk',
      name: 'Infinite Talk',
      logo: getProviderLogo('infinite-talk'),
      invert: true,
      style: getProviderStyle('infinite-talk'),
      modelName: raw,
    };
  }
  if (lower.includes('audio') || lower.includes('mmaudio')) {
    return {
      id: 'mmaudio',
      name: 'MMAudio',
      logo: getProviderLogo('mmaudio'),
      invert: true,
      style: getProviderStyle('mmaudio'),
      modelName: raw,
    };
  }

  // Fallback for custom or unknown providers
  const fallbackId = lower || 'custom';
  const fallbackName = raw ? raw.toUpperCase() : 'AI 品牌';
  return {
    id: fallbackId,
    name: fallbackName,
    logo: getProviderLogo(fallbackId),
    invert: invertLogos.includes(fallbackId),
    style: getProviderStyle(fallbackId),
    modelName: raw,
  };
}

export const BRAND_AURORA_GLOW = {
  google: {
    gradient: 'from-[#4285f4]/45 via-[#55e6ff]/35 to-[#8767ff]/40',
    haloColor: 'rgba(66, 133, 244, 0.45)',
    borderGlow: 'border-blue-400/50',
    ringGlow: 'ring-blue-400/30',
  },
  openai: {
    gradient: 'from-[#10a37f]/45 via-[#2dd4bf]/35 to-white/40',
    haloColor: 'rgba(16, 163, 127, 0.45)',
    borderGlow: 'border-emerald-400/50',
    ringGlow: 'ring-emerald-400/30',
  },
  bytedance: {
    gradient: 'from-[#3c8cff]/45 via-[#6366f1]/35 to-[#b16cff]/40',
    haloColor: 'rgba(60, 140, 255, 0.45)',
    borderGlow: 'border-sky-400/50',
    ringGlow: 'ring-sky-400/30',
  },
  alibaba: {
    gradient: 'from-[#ff6a00]/45 via-[#f59e0b]/35 to-[#fbbf24]/40',
    haloColor: 'rgba(255, 106, 0, 0.45)',
    borderGlow: 'border-amber-400/50',
    ringGlow: 'ring-amber-400/30',
  },
  blackforest: {
    gradient: 'from-[#f59e0b]/45 via-[#fbbf24]/35 to-[#d97706]/40',
    haloColor: 'rgba(245, 158, 11, 0.45)',
    borderGlow: 'border-amber-400/50',
    ringGlow: 'ring-amber-400/30',
  },
  kling: {
    gradient: 'from-[#e11d74]/45 via-[#f43f5e]/35 to-[#fb7185]/40',
    haloColor: 'rgba(225, 29, 116, 0.45)',
    borderGlow: 'border-rose-400/50',
    ringGlow: 'ring-rose-400/30',
  },
  minimax: {
    gradient: 'from-[#ec4899]/45 via-[#f43f5e]/35 to-[#a855f7]/40',
    haloColor: 'rgba(236, 72, 153, 0.45)',
    borderGlow: 'border-pink-400/50',
    ringGlow: 'ring-pink-400/30',
  },
  midjourney: {
    gradient: 'from-[#6366f1]/45 via-[#3b82f6]/35 to-[#8b5cf6]/40',
    haloColor: 'rgba(99, 102, 241, 0.45)',
    borderGlow: 'border-indigo-400/50',
    ringGlow: 'ring-indigo-400/30',
  },
  runway: {
    gradient: 'from-[#8b5cf6]/45 via-[#a855f7]/35 to-[#ec4899]/40',
    haloColor: 'rgba(139, 92, 246, 0.45)',
    borderGlow: 'border-violet-400/50',
    ringGlow: 'ring-violet-400/30',
  },
  luma: {
    gradient: 'from-[#14b8a6]/45 via-[#06b6d4]/35 to-[#3b82f6]/40',
    haloColor: 'rgba(20, 184, 166, 0.45)',
    borderGlow: 'border-teal-400/50',
    ringGlow: 'ring-teal-400/30',
  },
  ideogram: {
    gradient: 'from-[#eab308]/45 via-[#f59e0b]/35 to-[#ec4899]/40',
    haloColor: 'rgba(234, 179, 8, 0.45)',
    borderGlow: 'border-yellow-400/50',
    ringGlow: 'ring-yellow-400/30',
  },
};

export function getBrandAuroraGlow(brandId) {
  const key = String(brandId || '').toLowerCase().trim();
  return (
    BRAND_AURORA_GLOW[key] || {
      gradient: 'from-[#e11d74]/45 via-[#8767ff]/35 to-[#55e6ff]/40',
      haloColor: 'rgba(225, 29, 116, 0.45)',
      borderGlow: 'border-brand/50',
      ringGlow: 'ring-brand/30',
    }
  );
}

/**
 * Aggregates a list of model usage records into brand preference groups
 * @param {Array<{ model: string, count: number }>} modelUsageList
 * @param {number} [totalCount] - Optional total count override
 * @returns {Array<{ id: string, name: string, logo: string | null, invert: boolean, count: number, percentage: number, models: string[], modelDisplay: string, auroraGlow: object }>}
 */
export function aggregateBrands(modelUsageList = [], totalCount = null) {
  if (!Array.isArray(modelUsageList) || modelUsageList.length === 0) {
    return [];
  }

  const brandGroups = new Map();
  let calculatedTotal = 0;

  for (const item of modelUsageList) {
    const rawModel = item.model || item.model_name || '';
    const count = Number(item.count || item.usage_count || 0);
    if (!rawModel || count <= 0) continue;

    calculatedTotal += count;
    const brandInfo = resolveModelBrand(rawModel);

    let group = brandGroups.get(brandInfo.id);
    if (!group) {
      group = {
        id: brandInfo.id,
        name: brandInfo.name,
        logo: brandInfo.logo,
        invert: brandInfo.invert,
        style: brandInfo.style,
        auroraGlow: getBrandAuroraGlow(brandInfo.id),
        count: 0,
        percentage: 0,
        models: [],
        modelNames: [],
      };
      brandGroups.set(brandInfo.id, group);
    }

    group.count += count;
    if (!group.models.includes(rawModel)) {
      group.models.push(rawModel);
      group.modelNames.push(brandInfo.modelName || rawModel);
    }
  }

  const total = Number(totalCount || calculatedTotal) || 1;
  const result = Array.from(brandGroups.values()).map((g) => {
    const percentage = Math.round((g.count / total) * 100);
    let modelDisplay = '';
    if (g.modelNames.length === 1) {
      modelDisplay = g.modelNames[0];
    } else if (g.modelNames.length > 1) {
      modelDisplay = `${g.modelNames[0]} 等`;
    }
    return {
      id: g.id,
      name: g.name,
      logo: g.logo,
      invert: g.invert,
      style: g.style,
      auroraGlow: g.auroraGlow || getBrandAuroraGlow(g.id),
      count: g.count,
      percentage,
      models: g.models,
      modelDisplay,
    };
  });

  // Sort by count descending, then by name
  return result.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

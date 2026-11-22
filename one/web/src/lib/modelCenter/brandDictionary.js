/**
 * 统一品牌字典与识别引擎 (Isomorphic Brand Dictionary)
 * 供服务端、API 路由及客户端组件无缝共享使用。
 */

export const BRANDS = [
  {
    id: 'bytedance',
    name: '字节跳动 (ByteDance / 即梦 / 豆包)',
    shortName: '字节跳动',
    badge: '即梦/豆包',
    iconText: 'BD',
    tone: 'blue',
    tags: ['即梦', '豆包', 'Seedream', 'Seedance'],
    company: 'ByteDance',
    keywords: ['bytedance', 'seedream', 'seedance', 'doubao', 'douyin', '字节', 'volcengine', 'volces', 'byteplus'],
  },
  {
    id: 'kuaishou',
    name: '快手 (Kling / 可灵 AI)',
    shortName: '快手可灵',
    badge: 'Kling',
    iconText: 'KL',
    tone: 'rose',
    tags: ['可灵', 'Kling', '快手'],
    company: 'Kuaishou',
    keywords: ['kling', '可灵', 'kuaishou', '快手'],
  },
  {
    id: 'bfl',
    name: 'Black Forest Labs (FLUX 系列)',
    shortName: 'FLUX (BFL)',
    badge: 'FLUX',
    iconText: 'BFL',
    tone: 'amber',
    tags: ['FLUX', 'Black Forest Labs'],
    company: 'Black Forest Labs',
    keywords: ['flux', 'blackforest', 'bfl'],
  },
  {
    id: 'openai',
    name: 'OpenAI (GPT / Sora / DALL-E)',
    shortName: 'OpenAI',
    badge: 'GPT/Sora',
    iconText: 'OAI',
    tone: 'emerald',
    tags: ['GPT-4o', 'Sora', 'DALL-E'],
    company: 'OpenAI',
    keywords: ['openai', 'gpt', 'dall-e', 'dalle', 'sora', 'chatgpt'],
  },
  {
    id: 'minimax',
    name: 'MiniMax (海螺 AI / 语音)',
    shortName: 'MiniMax',
    badge: '海螺 AI',
    iconText: 'MM',
    tone: 'teal',
    tags: ['海螺', 'MiniMax', 'Speech'],
    company: 'MiniMax',
    keywords: ['minimax', 'hailuo', '海螺'],
  },
  {
    id: 'alibaba',
    name: '阿里巴巴 (通义万相 / 通义千问)',
    shortName: '阿里通义',
    badge: '万相/千问',
    iconText: 'ALI',
    tone: 'orange',
    tags: ['通义', '万相', '千问', 'Wan'],
    company: 'Alibaba Group',
    keywords: ['wan', 'qwen', 'alibaba', 'dashscope', '万相', '通义', 'aliyun', 'bailian'],
  },
  {
    id: 'google',
    name: 'Google (DeepMind / Veo / Imagen)',
    shortName: 'Google',
    badge: 'Google AI',
    iconText: 'GGL',
    tone: 'blue',
    tags: ['Gemini', 'Veo', 'Imagen'],
    company: 'Google',
    keywords: ['veo', 'imagen', 'google', 'gemini', 'deepmind'],
  },
  {
    id: 'luma',
    name: 'Luma AI (Dream Machine / Ray)',
    shortName: 'Luma AI',
    badge: 'Dream Machine',
    iconText: 'LMA',
    tone: 'purple',
    tags: ['Dream Machine', 'Ray', 'Luma'],
    company: 'Luma AI',
    keywords: ['luma', 'dream-machine', 'ray'],
  },
  {
    id: 'runway',
    name: 'Runway (Gen-3 / Gen-2)',
    shortName: 'Runway',
    badge: 'Gen-3',
    iconText: 'RW',
    tone: 'violet',
    tags: ['Gen-3', 'Gen-2', 'Runway'],
    company: 'Runway AI',
    keywords: ['runway', 'gen-3', 'gen-2', 'gen3', 'gen2'],
  },
  {
    id: 'midjourney',
    name: 'Midjourney (MJ v6 / Niji)',
    shortName: 'Midjourney',
    badge: 'MJ v6',
    iconText: 'MJ',
    tone: 'indigo',
    tags: ['Midjourney', 'Niji'],
    company: 'Midjourney Inc.',
    keywords: ['midjourney'],
  },
  {
    id: 'suno',
    name: 'Suno (AI 音乐创作)',
    shortName: 'Suno',
    badge: 'Suno',
    iconText: 'SUNO',
    tone: 'amber',
    tags: ['Suno', 'Music'],
    company: 'Suno Inc.',
    keywords: ['suno'],
  },
  {
    id: 'udio',
    name: 'Udio (AI 音乐创作)',
    shortName: 'Udio',
    badge: 'Udio',
    iconText: 'UDIO',
    tone: 'pink',
    tags: ['Udio', 'Music'],
    company: 'Udio Inc.',
    keywords: ['udio'],
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude 3.5 系列)',
    shortName: 'Claude',
    badge: 'Claude',
    iconText: 'ANT',
    tone: 'amber',
    tags: ['Claude', 'Anthropic'],
    company: 'Anthropic',
    keywords: ['claude', 'anthropic'],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek (深度求索 / V3 / R1)',
    shortName: 'DeepSeek',
    badge: 'DeepSeek',
    iconText: 'DS',
    tone: 'blue',
    tags: ['DeepSeek', '深度求索'],
    company: 'DeepSeek',
    keywords: ['deepseek'],
  },
  {
    id: 'tencent',
    name: '腾讯 (Tencent / 混元 Hunyuan)',
    shortName: '腾讯混元',
    badge: '混元',
    iconText: 'TX',
    tone: 'sky',
    tags: ['混元', 'Hunyuan', '腾讯'],
    company: 'Tencent',
    keywords: ['hunyuan', 'tencent', '混元'],
  },
  {
    id: 'zhipu',
    name: '智谱 AI (CogVideo / GLM)',
    shortName: '智谱 AI',
    badge: 'CogVideo',
    iconText: 'ZP',
    tone: 'indigo',
    tags: ['智谱', 'CogVideo', 'GLM'],
    company: 'Zhipu AI',
    keywords: ['cogvideo', 'glm', 'zhipu', '智谱'],
  },
  {
    id: 'stability',
    name: 'Stability AI (SD / SDXL / SD3.5)',
    shortName: 'Stability AI',
    badge: 'SD 3.5',
    iconText: 'SD',
    tone: 'purple',
    tags: ['Stable Diffusion', 'SDXL', 'Stability'],
    company: 'Stability AI',
    keywords: ['stability', 'stable-diffusion', 'sd-', 'sdxl'],
  },
  {
    id: 'vidu',
    name: '生数科技 (Vidu 视频生成)',
    shortName: '生数科技',
    badge: 'Vidu',
    iconText: 'VD',
    tone: 'teal',
    tags: ['Vidu', '生数科技'],
    company: 'Shengshu Tech',
    keywords: ['vidu', '生数'],
  },
  {
    id: 'pika',
    name: 'Pika Labs (Pika 2.0 / 1.0)',
    shortName: 'Pika',
    badge: 'Pika',
    iconText: 'PIKA',
    tone: 'orange',
    tags: ['Pika', 'Video'],
    company: 'Pika Labs',
    keywords: ['pika'],
  },
  {
    id: 'topaz',
    name: 'Topaz (高清超分与修复)',
    shortName: 'Topaz',
    badge: '超分修复',
    iconText: 'TPZ',
    tone: 'emerald',
    tags: ['Topaz', '超分'],
    company: 'Topaz Labs',
    keywords: ['topaz'],
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs (高拟真 AI 语音)',
    shortName: 'ElevenLabs',
    badge: 'TTS',
    iconText: 'EL',
    tone: 'gray',
    tags: ['ElevenLabs', 'Voice'],
    company: 'ElevenLabs',
    keywords: ['elevenlabs'],
  },
  {
    id: 'hidream',
    name: 'HiDream (智绘显视)',
    shortName: 'HiDream',
    badge: '智绘',
    iconText: 'HD',
    tone: 'violet',
    tags: ['HiDream'],
    company: 'HiDream',
    keywords: ['hidream'],
  },
  {
    id: 'runninghub',
    name: 'RunningHub (ComfyUI / 算力云)',
    shortName: 'RunningHub',
    badge: 'RunningHub',
    iconText: 'RH',
    tone: 'indigo',
    tags: ['RunningHub', 'ComfyUI'],
    company: 'RunningHub',
    keywords: ['runninghub', 'rh-'],
  },
  {
    id: 'other',
    name: '其他 / 社区独立模型',
    shortName: '其他品牌',
    badge: '社区',
    iconText: 'ETC',
    tone: 'neutral',
    tags: ['开源', '聚合'],
    company: 'Community / Custom',
    keywords: [],
  },
].map((b) => ({
  ...b,
  logoUrl: b.logoUrl || (b.id === 'suno' ? '/assets/brands/suno.png' : `/assets/brands/${b.id}.svg`),
}));

const BRAND_MAP = new Map(BRANDS.map((b) => [b.id, b]));

export function getBrandById(brandId) {
  if (!brandId) return BRAND_MAP.get('other');
  return BRAND_MAP.get(brandId) || BRAND_MAP.get('other');
}

export function getBrandLogoUrl(brandId) {
  const brand = getBrandById(brandId);
  return brand?.logoUrl || '/assets/brands/other.svg';
}

/**
 * 根据模型基础信息（ID、显示名、能力项等）智能归属品牌
 */
export function resolveBrand(model = {}) {
  if (!model || typeof model !== 'object') {
    return BRAND_MAP.get('other');
  }

  // 1. 显式配置的品牌标识
  if (model.brand && BRAND_MAP.has(model.brand)) {
    return BRAND_MAP.get(model.brand);
  }
  let caps = model.capabilities;
  if (typeof caps === 'string') {
    try { caps = JSON.parse(caps); } catch {}
  }
  const capBrand = (caps && typeof caps === 'object') ? caps.brand : undefined;
  if (capBrand && BRAND_MAP.has(capBrand)) {
    return BRAND_MAP.get(capBrand);
  }

  // 2. 文本模式匹配（ID、名称、供应商内部模型 ID 等）
  const id = String(model.id || model.model_id || '').toLowerCase();
  const name = String(model.name || '').toLowerCase();
  const disp = String(model.display_name || '').toLowerCase();
  const providerModelId = String(model.provider_model_id || '').toLowerCase();
  const providerId = String(model.provider_id || model.providerId || model.provider || '').toLowerCase();
  const fullText = `${id} ${name} ${disp} ${providerModelId} ${providerId}`;

  for (const b of BRANDS) {
    if (b.id === 'other') continue;
    for (const kw of b.keywords) {
      if (fullText.includes(kw)) {
        return b;
      }
    }
  }

  return BRAND_MAP.get('other');
}

/**
 * Model description metadata and capability tags for Image Studio models.
 * Aligns with high-quality UI representations (e.g. Figure 1).
 */

export const MODEL_DESCRIPTIONS = {
  // ── Seedream / ByteDance 系列 (规格矩阵 1:1 还原) ──
  "seedream-5.0-pro": {
    zh: "商业设计、影视、高密度图文等场景效果全面提升",
    en: "Comprehensive enhancement in commercial design, film, and dense text visuals.",
    tag: "Pro",
    badge: "✦",
    recommended: true,
  },
  "seedream-5.0-flash": {
    zh: "轻量化版 Seedream 5.0 Pro，更快更便宜",
    en: "Lightweight Seedream 5.0 Pro, faster and more affordable.",
    tag: "Flash",
    badge: null,
  },
  "image-aesthetic-v8.2": {
    zh: "专注美学创作，生成高美感、艺术感图片",
    en: "Dedicated to aesthetic creation, generating artistic and high-aesthetic visuals.",
    tag: "Aesthetic",
    badge: "✦",
    recommended: true,
  },
  "seedream-5.0-lite": {
    zh: "指令响应更精准，生成效果更智能",
    en: "More accurate prompt following and intelligent generative performance.",
    tag: "Lite",
    badge: null,
  },
  "seedream-4.5": {
    zh: "画质全面优化，指令响应能力再次提升",
    en: "Full image quality optimization, improved prompt response.",
    tag: "4.5",
    badge: null,
  },
  "seedream-5.0": {
    zh: "商业设计、影视、高密度图文等场景效果全面提升",
    en: "Comprehensive enhancement in commercial design, film, and dense text visuals.",
    tag: "Pro",
    badge: "✦",
    recommended: true,
  },
  "bytedance-seedream-5.0-pro": {
    zh: "商业设计、影视、高密度图文等场景效果全面提升",
    en: "Comprehensive enhancement in commercial design, film, and dense text visuals.",
    tag: "Pro",
    badge: "✦",
    recommended: true,
  },
  "bytedance-seedream-v5.0": {
    zh: "商业设计、影视、高密度图文等场景效果全面提升",
    en: "Comprehensive enhancement in commercial design, film, and dense text visuals.",
    tag: "Pro",
    badge: "✦",
    recommended: true,
  },
  // ── OpenAI / GPT 图像系列 ──
  "gpt-image-2.5-flash": {
    zh: "日常生成和编辑速度加快",
    en: "Accelerated everyday generation and editing.",
    tag: "Flash",
    badge: "新的",
  },
  "gpt-image-2.5-sunrise": {
    zh: "更精细的细节和更精确的编辑",
    en: "Finer details and more precise editing.",
    tag: "Sunrise",
    badge: "新的",
  },
  "gpt-image-2.5": {
    zh: "日常生成和编辑速度加快",
    en: "Accelerated everyday generation and editing.",
    tag: "Flash",
    badge: "新的",
  },
  "gpt-image-2": {
    zh: "细节逼真，文字渲染精准。",
    en: "Realistic details and accurate text rendering.",
    tag: "2.0",
    badge: "最新",
  },
  "gpt-image-1.5": {
    zh: "上一代高性价比，生成速度快。",
    en: "Previous generation, fast and economical.",
    tag: "1.5",
    badge: "经济",
  },
  // ── Nano Banana / Google 系列 ──
  "nano-banana-pro": {
    zh: "生成更准确、更具上下文信息的视觉效果。",
    en: "Generate more accurate, contextually relevant visuals.",
    tag: "Pro",
    badge: "新的",
  },
  "nano-banana": {
    zh: "生成更准确、更具上下文信息的视觉效果。",
    en: "Generate more accurate, contextually relevant visuals.",
    tag: "Base",
    badge: "新的",
  },
  "bytedance-seedream-v4.5": {
    zh: "强化一致性、风格与图文响应，画面质感细腻",
    en: "Enhanced consistency, style, and text-to-image response.",
    tag: "4.5",
    badge: "4.5",
  },
  "bytedance-seedream-v4": {
    zh: "支持多参考图、系列组图生成，美学多样性表现出众",
    en: "Supports multiple reference images and sequential image generation.",
    tag: "4.0",
    badge: "4.0",
  },
  "bytedance-seedream-v3": {
    zh: "影视质感，文字更准，直出 2K 高清图",
    en: "Cinematic texture, accurate text rendering, native 2K HD.",
    tag: "3.0",
    badge: "3.0",
  },

  // ── Flux 系列 ──
  "flux-2-klein": {
    zh: "极速高精度渲染，擅长超写实细节与复杂构图",
    en: "Ultra-fast high-precision rendering, realistic details and complex composition.",
    tag: "Klein",
    badge: "2.0",
    recommended: true,
  },
  "flux-2-klein-4b": {
    zh: "轻量高效，极速生成超高质感写实人像与概念设计",
    en: "Lightweight & efficient, rapid realistic portrait & concept design.",
    tag: "4B",
    badge: "Klein 4B",
  },
  "flux-2-klein-9b": {
    zh: "大参数量旗舰，顶尖美学表现与多风格自由探索",
    en: "Flagship 9B parameters, top-tier aesthetic performance.",
    tag: "9B",
    badge: "Klein 9B",
  },
  "flux-dev": {
    zh: "开源界顶尖生图基底，解剖结构与光影质感出众",
    en: "Top-tier open foundation model, superior anatomy and lighting.",
    tag: "Dev",
    badge: "Dev",
  },

  // ── Midjourney 系列 ──
  "midjourney-v7": {
    zh: "顶尖艺术质感与审美，支持角色一致性与风格参考",
    en: "Top artistic aesthetics, supports character and style references.",
    tag: "v7",
    badge: "v7",
    recommended: true,
  },
  "midjourney-v6": {
    zh: "经典高审美模型，真实光影与摄影级画质",
    en: "Classic high-aesthetic model, photorealistic lighting.",
    tag: "v6",
    badge: "v6",
  },

  // ── Stability AI / SDXL ──
  "sdxl": {
    zh: "经典高扩展性底模，支持丰富艺术风格与精准结构控制",
    en: "Classic high-extensibility base model with rich style support.",
    tag: "SDXL",
    badge: "1.0",
  },

  // ── Kling / 快手可灵 ──
  "kling-o1": {
    zh: "电影级镜头感与光影渲染，高保真人像表现",
    en: "Cinematic framing, lighting rendering, and high-fidelity portraits.",
    tag: "O1",
    badge: "O1",
  },
  "kling-o3": {
    zh: "新一代自研多模态图像生成，超高细节与材质真实度",
    en: "Next-gen multimodal generation with superior detail and textures.",
    tag: "O3",
    badge: "O3",
    recommended: true,
  },

  // ── Qwen / 阿里通义 ──
  "qwen-image-2.0": {
    zh: "强大的中英文文字渲染与复杂语义理解，支持高分辨率直出",
    en: "Superior bilingual text rendering & complex prompt comprehension.",
    tag: "2.0",
    badge: "2.0 Pro",
  },
  "qwen-plus": {
    zh: "专业级图像编辑与主体参考，保持元素高度一致",
    en: "Professional image editing and subject reference consistency.",
    tag: "Plus",
    badge: "Plus",
  },

  // ── MiniMax / 海螺 ──
  "minimax-image-01": {
    zh: "自研多模态生图底座，擅长主体参考与艺术视觉风格",
    en: "Proprietary multimodal model, strong subject reference & art styles.",
    tag: "01",
    badge: "01",
  },

  // ── Google Imagen ──
  "google-imagen4": {
    zh: "Google 最新 Imagen 4 引擎，超高画质与逼真照片感",
    en: "Google Imagen 4 engine, ultra-high fidelity and photorealism.",
    tag: "Imagen 4",
    badge: "Ultra",
  },

  // ── Wan ──
  "wan2.7": {
    zh: "超高分辨率图像生成与多风格创作，色彩表现亮丽",
    en: "Ultra-high resolution image generation with vibrant colors.",
    tag: "2.7",
    badge: "2.7",
  },
};

export const GLOBAL_SERVER_MODEL_META_KEY = '__SUPDANCE_SERVER_MODEL_META__';

/**
 * Register dynamic model metadata received from backend /api/models/active.
 */
export function setServerModelMeta(metaList, aliasesByServerId = {}) {
  if (!Array.isArray(metaList)) return;
  if (typeof globalThis === 'undefined') return;
  const map = new Map();
  for (const m of metaList) {
    if (!m || !m.id) continue;
    const lower = String(m.id).toLowerCase();
    map.set(lower, m);
    // Also index stripped variant suffixes (e.g. -t2i, -i2i, -edit)
    const cleanId = lower.replace(/-edit$/, '').replace(/-(t2i|i2i|t2v|i2v|v2v)$/, '');
    if (cleanId !== lower) {
      if (!map.has(cleanId)) map.set(cleanId, m);
    }
  }
  // Static Studio variants share capability metadata with their canonical server model.
  for (const m of metaList) {
    if (!m?.id) continue;
    for (const alias of aliasesByServerId[String(m.id)] || []) {
      const key = String(alias).toLowerCase();
      if (!map.has(key)) map.set(key, m);
    }
  }
  globalThis[GLOBAL_SERVER_MODEL_META_KEY] = map;
}

/**
 * Retrieve dynamic metadata for a model ID.
 */
export function getServerModelMeta(modelId) {
  if (!modelId || typeof globalThis === 'undefined') return null;
  const map = globalThis[GLOBAL_SERVER_MODEL_META_KEY];
  if (!map) return null;
  const lower = String(modelId).toLowerCase();
  if (map.has(lower)) return map.get(lower);
  const cleanId = lower.replace(/-edit$/, '').replace(/-(t2i|i2i|t2v|i2v|v2v)$/, '');
  return map.get(cleanId) || null;
}

/**
 * Get description for a model family or variant ID.
 * Priority: dynamic admin description from database -> local static dictionary -> default.
 */
export function getModelDescription(modelId, locale = "zh") {
  if (!modelId) return "";

  // 1. Dynamic Server Metadata
  const serverMeta = getServerModelMeta(modelId);
  if (serverMeta && serverMeta.description && serverMeta.description.trim()) {
    return serverMeta.description.trim();
  }

  // 2. Static Dictionary
  const cleanId = modelId.toLowerCase().replace(/-edit$/, "").replace(/-(t2i|i2i|t2v|i2v|v2v)$/, "");
  for (const [key, val] of Object.entries(MODEL_DESCRIPTIONS)) {
    if (cleanId === key || cleanId.includes(key) || key.includes(cleanId)) {
      return locale.startsWith("zh") ? val.zh : val.en;
    }
  }

  return locale.startsWith("zh")
    ? "专业多模态高品质创作底座，极速响应，细节丰富。"
    : "Professional multimodal high-quality generative foundation.";
}

/**
 * Get badge or tag for a model family.
 * Priority: dynamic admin badge -> local static dictionary -> null.
 */
export function getModelBadge(modelId) {
  if (!modelId) return null;

  // 1. Dynamic Server Metadata
  const serverMeta = getServerModelMeta(modelId);
  if (serverMeta && serverMeta.badge && serverMeta.badge.trim()) {
    return serverMeta.badge.trim();
  }

  // 2. Static Dictionary
  const cleanId = modelId.toLowerCase().replace(/-edit$/, "").replace(/-(t2i|i2i|t2v|i2v|v2v)$/, "");
  for (const [key, val] of Object.entries(MODEL_DESCRIPTIONS)) {
    if (cleanId === key || cleanId.includes(key) || key.includes(cleanId)) {
      return val.badge || val.tag || null;
    }
  }
  return null;
}

/**
 * Get display name for a model ID.
 * Priority: dynamic admin display name -> defaultName.
 */
export function getModelDisplayName(modelId, defaultName = "") {
  if (!modelId) return defaultName;
  const serverMeta = getServerModelMeta(modelId);
  if (serverMeta && serverMeta.displayName && serverMeta.displayName.trim()) {
    return serverMeta.displayName.trim();
  }
  return defaultName || modelId;
}

/**
 * Check if a model is pinned by admin.
 */
export function isModelPinned(modelId) {
  if (!modelId) return false;
  const serverMeta = getServerModelMeta(modelId);
  return Boolean(serverMeta && serverMeta.isPinned);
}

/**
 * Check if a model is marked as featured by admin.
 */
export function isModelFeatured(modelId) {
  if (!modelId) return false;
  const serverMeta = getServerModelMeta(modelId);
  return Boolean(serverMeta && serverMeta.isFeatured);
}

// Single source of truth for the `/studio/*` route segments.
// The server catch-all pages and the client shell both resolve against this list so a
// mistyped link 404s instead of silently rendering Image Studio (A-08).
export const STUDIO_TAB_IDS = Object.freeze([
  'image',
  'headshot',
  'layers',
  'ai-influencer',
  'cinema',
  'video',
  'clipping',
  'motion-control',
  'vibe-motion',
  'lipsync',
  'body-swap',
  'marketing',
  'audio',
  'agents',
  'workflows',
  'design-agent',
  'apps',
  'character',
  'motion-agent',
]);

export const STUDIO_TAB_ALIASES = Object.freeze({
  character: 'ai-influencer',
  'motion-agent': 'motion-control',
  workflow: 'workflows',
  canvas: 'layers',
  // Legacy deep link kept alive: the Body Swap nav shipped as `?tab=recast`
  // before the studio tab was registered as `body-swap`.
  recast: 'body-swap',
});

export function normalizeStudioTab(tab) {
  if (!tab) return 'image';
  const clean = String(tab).trim().toLowerCase();
  return STUDIO_TAB_ALIASES[clean] || clean;
}

export const resolveStudioTab = normalizeStudioTab;

// Kept because the shell also resolves the singular alias: /studio/workflow/<id>
export const STUDIO_ALIAS_SEGMENTS = Object.freeze(['workflow', 'character', 'motion-agent']);

export function isStudioSlug(slug) {
  if (!Array.isArray(slug) || slug.length === 0) return true;
  const [first] = slug;
  if (typeof first !== 'string') return false;
  const normalized = normalizeStudioTab(first);
  return STUDIO_TAB_IDS.includes(first) || STUDIO_TAB_IDS.includes(normalized) || STUDIO_ALIAS_SEGMENTS.includes(first);
}

// 核心大模型与工作室工作台的映射注册表
export const KNOWN_MODEL_TAB_MAP = Object.freeze({
  // 视频模型 (Video)
  'kling-v2.6-pro-t2v': 'video',
  'kling-v3.0-standard-text-to-video': 'video',
  'kling-v3.0-pro-text-to-video': 'video',
  'kling-v3.0-4k-text-to-video': 'video',
  'kling-v3.0-omni-standard-text-to-video': 'video',
  'kling-v3.0-omni-pro-text-to-video': 'video',
  'kling-v3.0-omni-4k-text-to-video': 'video',
  'minimax-hailuo-2.3-standard-t2v': 'video',
  'minimax-hailuo-2.3-pro-t2v': 'video',
  'minimax-h3-text-to-video': 'video',
  'veo3-text-to-video': 'video',
  'veo3-fast-text-to-video': 'video',
  'veo3.1-text-to-video': 'video',
  'veo3.1-fast-text-to-video': 'video',
  'veo3.1-lite-text-to-video': 'video',
  'veo-4-text-to-video': 'video',
  'seedance-2.5-text-to-video': 'video',
  'seedance-v1.5-pro-t2v': 'video',
  'seedance-2.0-t2v': 'video',
  'wan2.7-text-to-video': 'video',
  'wan2.5-text-to-video': 'video',
  'wan2.1-text-to-video': 'video',
  'wan3.0-text-to-video': 'video',
  'runway-image-to-video': 'video',
  'runway-text-to-video': 'video',
  'openai-sora-2-text-to-video': 'video',
  'openai-sora-2-pro-text-to-video': 'video',
  'openai-sora': 'video',
  'pixverse-v5.5-t2v': 'video',
  'pixverse-v6-t2v': 'video',
  'ltx-2.3-text-to-video': 'video',
  'luma-dream-machine': 'video',
  'happy-horse-1.1-text-to-video-1080p': 'video',
  'grok-imagine-text-to-video': 'video',

  // 音频模型 (Audio)
  'suno-create-music': 'audio',
  'suno-remix-music': 'audio',
  'minimax-music-3.0': 'audio',
  'minimax-speech-2.6-hd': 'audio',
  'minimax-speech-2.6-turbo': 'audio',
  'minimax-voice-clone': 'audio',
  'udio-v1.5': 'audio',
  'mmaudio-v2-text-to-audio': 'audio',
  'elevenlabs-text-to-dialogue-v3': 'audio',

  // 智能体与推理模型 (Agents / Workflows)
  'deepseek-r1': 'agents',
  'deepseek-v3': 'agents',
  'claude-3-7-sonnet': 'agents',
  'gpt-4o': 'agents',

  // 图像模型 (Image)
  'gpt-image-2.5-flash': 'image',
  'bytedance-seedream-v3': 'image',
  'bytedance-seedream-5.0-pro': 'image',
  'seedream-5.0': 'image',
  'midjourney-v7': 'image',
  'midjourney-v8': 'image',
  'nano-banana-pro': 'image',
  'nano-banana-2': 'image',
  'vidu-q2-text-to-image': 'image',
  'flux-dev': 'image',
  'flux-2-dev': 'image',
  'flux-2-pro': 'image',
  'flux-2-klein-4b': 'image',
  'flux-2-klein-9b': 'image',
  'wan2.1-text-to-image': 'image',
});

/**
 * 根据模型标识智能推断对应的工作室 Tab
 * @param {string} modelId 模型标识符或别名
 * @param {string} fallbackTab 兜底工作台，默认 'image'
 * @returns {string} 目标工作台 ID ('image' | 'video' | 'audio' | 'agents' | 'cinema' 等)
 */
export function inferStudioTabFromModel(modelId, fallbackTab = 'image') {
  if (!modelId) return fallbackTab;
  const clean = String(modelId).trim().toLowerCase();

  // 1. 精确注册表匹配
  if (KNOWN_MODEL_TAB_MAP[clean]) {
    return KNOWN_MODEL_TAB_MAP[clean];
  }

  // 2. 音频关键词匹配
  if (
    clean.includes('audio') ||
    clean.includes('music') ||
    clean.includes('speech') ||
    clean.includes('suno') ||
    clean.includes('udio') ||
    clean.includes('tts') ||
    clean.includes('voice') ||
    clean.includes('sound') ||
    clean.includes('dialogue')
  ) {
    return 'audio';
  }

  // 3. 智能体与 LLM 关键词匹配
  if (
    clean.includes('deepseek') ||
    clean.includes('claude') ||
    clean.startsWith('gpt-4') ||
    clean.includes('agent') ||
    clean.includes('reasoning')
  ) {
    return 'agents';
  }

  // 4. 影视级工坊
  if (clean.includes('cinema')) {
    return 'cinema';
  }

  // 5. 图像显式模式与品牌
  if (
    clean.includes('text-to-image') ||
    clean.includes('image-to-image') ||
    clean.includes('t2i') ||
    clean.includes('i2i') ||
    clean.includes('seedream') ||
    clean.includes('midjourney') ||
    clean.includes('flux') ||
    clean.includes('banana') ||
    clean.includes('drawing')
  ) {
    return 'image';
  }

  // 6. 视频显式模式与品牌
  if (
    clean.includes('text-to-video') ||
    clean.includes('image-to-video') ||
    clean.includes('reference-to-video') ||
    clean.includes('t2v') ||
    clean.includes('i2v') ||
    clean.includes('v2v') ||
    clean.includes('video') ||
    clean.includes('kling') ||
    clean.includes('veo') ||
    clean.includes('sora') ||
    clean.includes('wan') ||
    clean.includes('seedance') ||
    clean.includes('hailuo') ||
    clean.includes('runway') ||
    clean.includes('pixverse') ||
    clean.includes('ltx') ||
    clean.includes('luma') ||
    clean.includes('happy-horse')
  ) {
    return 'video';
  }

  return fallbackTab;
}

/**
 * 构造精准定位模型的工作室完整 URL
 * @param {string} modelId 模型标识
 * @param {Object} options 配置项
 * @param {string} options.tab 可选显式指定的 tab
 * @param {string} options.locale 语言代码 ('zh' | 'en' 等)
 * @param {Object} options.extraParams 额外 query 参数
 * @returns {string} 格式化 URL，例如 '/zh/studio?tab=video&model=kling-v2.6-pro-t2v'
 */
export function buildStudioUrl(modelId, { tab, locale = 'en', extraParams = {} } = {}) {
  const normLocale = String(locale || '').toLowerCase();
  const root = normLocale.startsWith('zh') ? '/zh/studio' : '/studio';
  const resolvedTab = tab || (modelId ? inferStudioTabFromModel(modelId) : 'image');
  const params = new URLSearchParams();
  if (resolvedTab) params.set('tab', resolvedTab);
  if (modelId) params.set('model', modelId);
  for (const [k, v] of Object.entries(extraParams)) {
    if (v !== undefined && v !== null && v !== '') {
      params.set(k, String(v));
    }
  }
  const qs = params.toString();
  return `${root}${qs ? `?${qs}` : ''}`;
}


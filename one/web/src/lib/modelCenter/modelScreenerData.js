/**
 * Static model identity fallback.
 *
 * Live availability, pricing, and usage come from the model directory and
 * telemetry APIs. This registry only supplies stable identity/description
 * fields when a detail page is rendered before those APIs resolve.
 */

export const SCREENER_MODELS = Object.freeze([
  {
    id: 'deepseek-v3',
    name: 'DeepSeek-V3',
    provider: 'DeepSeek',
    providerId: 'deepseek',
    category: 'llm',
    description: '开源混合专家语言模型，面向代码、数学与多语种推理场景。',
    descriptionEn: 'An open-weight mixture-of-experts language model for coding, math, and multilingual reasoning.',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    providerId: 'openai',
    category: 'multimodal',
    description: '面向文本、视觉与音频理解的多模态模型。',
    descriptionEn: "OpenAI's multimodal model for text, vision, and audio understanding.",
  },
  {
    id: 'flux-dev',
    name: 'FLUX.1 [dev]',
    provider: 'Black Forest Labs',
    providerId: 'bfl',
    category: 'image',
    description: 'Black Forest Labs 的开源权重图像生成模型，强调提示词遵循与画面质量。',
    descriptionEn: "Black Forest Labs' open-weight image model focused on prompt adherence and visual quality.",
  },
  {
    id: 'seedream-5.0',
    name: 'Seedream 5.0',
    provider: 'ByteDance',
    providerId: 'bytedance',
    category: 'image',
    description: '字节跳动的图像生成模型，支持细致视觉合成与中文提示词。',
    descriptionEn: "ByteDance's image generation model for detailed visual synthesis and Chinese-language prompts.",
  },
  {
    id: 'gpt-image-2.5-flash',
    name: 'GPT-Image 2.5 Flash',
    provider: 'OpenAI',
    providerId: 'openai',
    category: 'image',
    description: 'OpenAI 的快速图像生成模型，适合迭代式设计探索。',
    descriptionEn: "OpenAI's fast image generation model for iterative design exploration.",
  },
  {
    id: 'wan2.1-text-to-image',
    name: 'Wan 2.1',
    provider: 'Alibaba',
    providerId: 'alibaba',
    category: 'image',
    description: '阿里巴巴的双语图像生成模型，面向中文排版与商业视觉。',
    descriptionEn: "Alibaba's bilingual image model for Chinese typography and commercial visuals.",
  },
  {
    id: 'kling-v2.6-pro-t2v',
    name: 'Kling 2.6 Pro',
    provider: 'Kuaishou',
    providerId: 'kuaishou',
    category: 'video',
    description: '快手视频生成模型，面向人物动态、镜头运动与电影感场景。',
    descriptionEn: "Kuaishou's video generation model for motion, camera movement, and cinematic scenes.",
  },
  {
    id: 'midjourney-v7',
    name: 'Midjourney V7',
    provider: 'Midjourney',
    providerId: 'midjourney',
    category: 'image',
    description: 'Midjourney 的图像模型，常用于概念设计与风格化画面创作。',
    descriptionEn: "Midjourney's image model for concept art and stylized visual composition.",
  },
  {
    id: 'minimax-hailuo-2.3-standard-t2v',
    name: 'Hailuo 2.3',
    provider: 'MiniMax',
    providerId: 'minimax',
    category: 'video',
    description: 'MiniMax 的视频生成模型，支持文生视频与图生视频。',
    descriptionEn: "MiniMax's video model for text- and image-to-video generation.",
  },
  {
    id: 'suno-create-music',
    name: 'Suno V3.5',
    provider: 'Suno AI',
    providerId: 'suno',
    category: 'audio',
    description: 'Suno 的音乐生成模型，支持人声演唱与结构化歌曲编排。',
    descriptionEn: "Suno's music generation model for vocals and structured songs.",
  },
  {
    id: 'veo3-text-to-video',
    name: 'Google Veo 3',
    provider: 'Google DeepMind',
    providerId: 'google',
    category: 'video',
    description: 'Google DeepMind 的原生视听视频生成模型。',
    descriptionEn: "Google DeepMind's video model with native audio-visual generation.",
  },
  {
    id: 'minimax-music-3.0',
    name: 'MiniMax Music 3.0',
    provider: 'MiniMax',
    providerId: 'minimax',
    category: 'audio',
    description: 'MiniMax 的音乐生成模型，支持双语人声与多种编曲风格。',
    descriptionEn: "MiniMax's music model for bilingual vocal tracks and arrangements.",
  },
]);

export function getModelById(id) {
  if (!id) return null;
  const targetId = String(id).toLowerCase().trim();
  const direct = SCREENER_MODELS.find((model) => model.id.toLowerCase() === targetId);
  if (direct) return direct;

  return (
    SCREENER_MODELS.find(
      (model) => model.id.toLowerCase().includes(targetId) || targetId.includes(model.id.toLowerCase())
    ) || null
  );
}

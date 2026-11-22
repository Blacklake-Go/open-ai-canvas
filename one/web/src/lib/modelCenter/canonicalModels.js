/**
 * 权威核心规范模型家族与动作别名收敛字典 (Canonical Models & Action Aliases SSOT)
 * 用于模型管理三层心智架构：规范模型（货架）、动作变体（收敛）、渠道（多对一挂载）
 */

export const CANONICAL_GROUPS = [
  // === 快手可灵 Kling ===
  {
    targetId: 'kling-3.0',
    name: '快手 可灵 3.0',
    category: 'video',
    display_name: '快手 可灵 3.0 Pro 旗舰全能',
    sort: 1,
    baseCredits: 45,
    preferredProvider: 'kling',
    aliases: [
      'kling-3.0-pro', 'kling-v3.0-standard-text-to-video', 'kling-v3.0-standard-image-to-video',
      'kling-v3.0-pro-recast', 'kling-v3.0-4k-image-to-video', 'kling-v3.0-4k-text-to-video',
      'kling-v3.0-omni-4k-image-to-video', 'kling-v3.0-omni-4k-text-to-video',
      'kling-v3.0-omni-pro-image-to-video', 'kling-v3.0-omni-pro-text-to-video',
      'kling-v3.0-omni-standard-image-to-video', 'kling-v3.0-omni-standard-text-to-video'
    ],
  },
  {
    targetId: 'kling-2.6',
    name: '快手 可灵 2.6',
    category: 'video',
    display_name: '快手 可灵 2.6 (电影画质/多渠道调度)',
    sort: 2,
    baseCredits: 35,
    preferredProvider: 'kling',
    aliases: ['kling-v2.6-pro-t2v', 'kling-v2.6-pro-i2v', 'kling-v2.6-std-motion-control', 'kling-v2.6-pro-motion-control'],
  },
  {
    targetId: 'kling-2.5',
    name: '快手 可灵 2.5',
    category: 'video',
    display_name: '快手 可灵 2.5 Turbo',
    sort: 3,
    baseCredits: 28,
    preferredProvider: 'kling',
    aliases: ['kling-v2.5-turbo-pro-t2v', 'kling-v2.5-turbo-pro-i2v'],
  },
  {
    targetId: 'kling-2.1',
    name: '快手 可灵 2.1',
    category: 'video',
    display_name: '快手 可灵 2.1 Master',
    sort: 4,
    baseCredits: 25,
    preferredProvider: 'kling',
    aliases: ['kling-v2.1-master-t2v', 'kling-v2.1-master-i2v', 'kling-v2.1-standard-i2v'],
  },
  {
    targetId: 'kling-o1',
    name: '快手 可灵 O1',
    category: 'video',
    display_name: '快手 可灵 O1 全模态视觉模型',
    sort: 5,
    baseCredits: 40,
    preferredProvider: 'kling',
    aliases: [
      'kling-o1-text-to-video', 'kling-o1-image-to-video', 'kling-o1-reference-to-video',
      'kling-o1-standard-image-to-video', 'kling-o1-standard-reference-to-video',
      'kling-o1-video-edit', 'kling-o1-video-edit-fast', 'kling-o1-standard-video-edit',
      'kling-o1-text-to-image', 'kling-o1-edit-image', 'kling-o3-image'
    ],
  },

  // === 字节跳动 / 即梦 / 豆包 ===
  {
    targetId: 'seedream-5.0',
    name: 'Seedream 5.0',
    category: 'image',
    display_name: '字节跳动 Seedream 5.0 (商业摄影质感)',
    sort: 1,
    baseCredits: 15,
    preferredProvider: 'byteplus',
    aliases: [
      'bytedance-seedream-5.0-pro',
      'bytedance-seedream-5.0-pro-edit',
      'bytedance-seedream-v5.0',
      'bytedance-seedream-v5.0-edit'
    ],
  },
  {
    targetId: 'seedream-5.0-edit',
    name: 'Seedream 5.0 Edit',
    category: 'image',
    display_name: '字节跳动 Seedream 5.0 智能改图重绘',
    sort: 2,
    baseCredits: 15,
    preferredProvider: 'volcengine',
    aliases: [],
  },
  {
    targetId: 'seedream-4.5',
    name: 'Seedream 4.5',
    category: 'image',
    display_name: '字节跳动 Seedream 4.5',
    sort: 3,
    baseCredits: 12,
    preferredProvider: 'byteplus',
    aliases: [
      'seedream-3.0',
      'bytedance-seedream-v4.5',
      'bytedance-seedream-v4.5-edit',
      'bytedance-seedream-v4',
      'bytedance-seedream-v4-edit',
      'bytedance-seedream-edit-v4',
      'bytedance-seedream-v3'
    ],
  },
  {
    targetId: 'seedream-4.0',
    name: 'Seedream 4.0',
    category: 'image',
    display_name: '字节跳动 Seedream 4.0',
    sort: 4,
    baseCredits: 10,
    preferredProvider: 'volcengine',
    aliases: [],
  },
  {
    targetId: 'seedance-2.0',
    name: 'Seedance 2.0',
    category: 'video',
    display_name: '字节跳动 Seedance 2.0 动态视频',
    sort: 3,
    baseCredits: 28,
    preferredProvider: 'byteplus',
    aliases: [
      'seedance-2.5',
      'seedance-1.5',
      'seedance-v2.0-t2v',
      'seedance-v2.0-i2v',
      'bytedance-seedance-2.0',
      'seedance-2.5-image-to-video',
      'seedance-1.5-pro'
    ],
  },
  {
    targetId: 'doubao-1.5-pro',
    name: '豆包 1.5 Pro',
    category: 'text',
    display_name: '字节跳动 豆包 1.5 Pro',
    sort: 1,
    baseCredits: 5,
    preferredProvider: 'byteplus',
    aliases: ['bytedance-doubao-1.5-pro'],
  },

  // === MiniMax / 海螺 ===
  {
    targetId: 'hailuo-02',
    name: 'MiniMax 海螺 02',
    category: 'video',
    display_name: 'MiniMax 海螺 02 (原生高拟真动态)',
    sort: 9,
    baseCredits: 28,
    preferredProvider: 'minimax',
    aliases: ['minimax-hailuo-02', 'minimax-video-01-live', 'minimax-video-01'],
  },
  {
    targetId: 'hailuo-2.3',
    name: 'MiniMax 海螺 2.3',
    category: 'video',
    display_name: 'MiniMax 海螺 2.3 电影级视频生成',
    sort: 10,
    baseCredits: 30,
    preferredProvider: 'minimax',
    aliases: ['minimax-hailuo-2.3-standard-t2v', 'minimax-hailuo-2.3-standard-i2v', 'minimax-hailuo-2.3'],
  },
  {
    targetId: 'minimax-speech-2.6',
    name: 'MiniMax 语音 2.6',
    category: 'audio',
    display_name: 'MiniMax 语音合成 2.6 (高清拟真/情感表现)',
    sort: 1,
    baseCredits: 12,
    preferredProvider: 'minimax',
    aliases: ['minimax-speech-2.6-hd', 'minimax-speech-2.6-turbo'],
  },
  {
    targetId: 'minimax-voice-clone',
    name: 'MiniMax 声音克隆',
    category: 'audio',
    display_name: 'MiniMax 零样本声音复刻',
    sort: 2,
    baseCredits: 25,
    preferredProvider: 'minimax',
    aliases: [],
  },
  {
    targetId: 'minimax-music-3.0',
    name: 'MiniMax 音乐 3.0',
    category: 'music',
    display_name: 'MiniMax 音乐创作 3.0',
    sort: 3,
    baseCredits: 25,
    preferredProvider: 'minimax',
    aliases: [],
  },

  // === 阿里百炼 / DashScope (Wan 万相 & 通义千问) ===
  {
    targetId: 'wan2.1-text-to-image',
    name: '阿里 万相 2.1 生图',
    category: 'image',
    display_name: '阿里 万相 2.1 (通义万相极速生图)',
    sort: 10,
    baseCredits: 15,
    preferredProvider: 'alibaba',
    aliases: ['wanx2.1-t2i-turbo'],
  },
  {
    targetId: 'wan-2.1',
    name: '阿里 万相 2.1',
    category: 'video',
    display_name: '阿里 万相 2.1 (通义万相多模态矩阵)',
    sort: 11,
    baseCredits: 26,
    preferredProvider: 'alibaba',
    aliases: [
      'wanx-2.1',
      'wan2.1-image-to-video',
      'wan2.1-text-to-video',
      'wan2.1-i2v-720p',
      'wan2.1-t2v-720p',
      'wanx2.1-i2v-plus',
      'wanx2.1-t2v-plus',
      'wanx-2.1-plus'
    ],
  },
  {
    targetId: 'qwen-vl-max',
    name: '通义千问 VL Max',
    category: 'text',
    display_name: '阿里 通义千问 VL Max 顶级视觉理解',
    sort: 2,
    baseCredits: 8,
    preferredProvider: 'alibaba',
    aliases: ['qwen-vl-plus'],
  },
  {
    targetId: 'qwen-max',
    name: '通义千问 Max',
    category: 'text',
    display_name: '阿里 通义千问 Max 旗舰全能大语言模型',
    sort: 3,
    baseCredits: 5,
    preferredProvider: 'alibaba',
    aliases: ['qwen-plus', 'qwen-turbo'],
  },

  // === Black Forest Labs FLUX ===
  {
    targetId: 'flux-1.1-pro',
    name: 'FLUX 1.1 Pro',
    category: 'image',
    display_name: 'BFL FLUX 1.1 Pro 顶级真实画质',
    sort: 11,
    baseCredits: 25,
    preferredProvider: 'bfl',
    aliases: ['flux-pro-1.1', 'flux-1.1-pro-ultra'],
  },
  {
    targetId: 'flux-dev',
    name: 'FLUX.1 Dev',
    category: 'image',
    display_name: 'BFL FLUX.1 Dev 工业级微调生图',
    sort: 12,
    baseCredits: 18,
    preferredProvider: 'bfl',
    aliases: ['flux-schnell'],
  },
  {
    targetId: 'flux-3.0',
    name: 'FLUX 3.0',
    category: 'video',
    display_name: 'FLUX 3.0 下一代视频渲染',
    sort: 17,
    baseCredits: 35,
    preferredProvider: 'bfl',
    aliases: ['flux-3-text-to-video', 'flux-3-image-to-video'],
  },

  // === Luma ===
  {
    targetId: 'luma-dream-machine',
    name: 'Luma Dream Machine',
    category: 'video',
    display_name: 'Luma Dream Machine (Ray 2 摄影流)',
    sort: 18,
    baseCredits: 32,
    preferredProvider: 'luma',
    aliases: ['luma-ray-2'],
  },

  // === Runway ===
  {
    targetId: 'runway-image-to-video',
    name: 'Runway Gen-3',
    category: 'video',
    display_name: 'Runway Gen-3 Alpha 电影级视频生成',
    sort: 19,
    baseCredits: 35,
    preferredProvider: 'runway',
    aliases: ['runway-aleph-v2v', 'runway-act-two-recast', 'runway-gen-3'],
  },

  // === 生数科技 Vidu ===
  {
    targetId: 'vidu-2.0',
    name: 'Vidu 2.0',
    category: 'video',
    display_name: 'Vidu 2.0 生数科技',
    sort: 20,
    baseCredits: 28,
    preferredProvider: 'shengshu',
    aliases: ['vidu-2.0-t2v', 'vidu-2.0-i2v'],
  },

  // === Midjourney ===
  {
    targetId: 'midjourney-v7',
    name: 'Midjourney v7',
    category: 'image',
    display_name: 'Midjourney v7 极致艺术美学',
    sort: 13,
    baseCredits: 22,
    preferredProvider: 'midjourney',
    aliases: ['midjourney-v7.0'],
  },
  {
    targetId: 'midjourney-v6.1',
    name: 'Midjourney v6.1',
    category: 'image',
    display_name: 'Midjourney v6.1 真实光影质感',
    sort: 14,
    baseCredits: 18,
    preferredProvider: 'midjourney',
    aliases: [],
  },

  // === Suno ===
  {
    targetId: 'suno-v4',
    name: 'Suno v4',
    category: 'music',
    display_name: 'Suno v4 录音棚母带级全曲',
    sort: 4,
    baseCredits: 35,
    preferredProvider: 'suno',
    aliases: [
      'suno-v4-generate', 'suno-v4-extend', 'suno-create-music', 'suno-remix-music',
      'suno-extend-music', 'suno-add-vocals', 'suno-add-instrumental', 'suno-generate-mashup'
    ],
  },
  {
    targetId: 'suno-v3.5',
    name: 'Suno v3.5',
    category: 'music',
    display_name: 'Suno v3.5 流行音乐合成',
    sort: 5,
    baseCredits: 25,
    preferredProvider: 'suno',
    aliases: [
      'suno-v3-5-generate', 'suno-v3-5-extend', 'suno-v3-5', 'suno-chirp-v3.5',
      'suno-convert-to-wav', 'suno-generate-sounds'
    ],
  },

  // === Udio ===
  {
    targetId: 'udio-v1.5',
    name: 'Udio v1.5',
    category: 'music',
    display_name: 'Udio v1.5 高保真音频',
    sort: 6,
    baseCredits: 25,
    preferredProvider: 'udio',
    aliases: [],
  },

  // === DeepSeek ===
  {
    targetId: 'deepseek-v3',
    name: 'DeepSeek V3',
    category: 'text',
    display_name: 'DeepSeek V3 顶级推理',
    sort: 4,
    baseCredits: 5,
    preferredProvider: 'deepseek',
    aliases: [],
  },
  {
    targetId: 'deepseek-r1',
    name: 'DeepSeek R1',
    category: 'text',
    display_name: 'DeepSeek R1 深度思考',
    sort: 5,
    baseCredits: 8,
    preferredProvider: 'deepseek',
    aliases: [],
  },

  // === 腾讯混元 ===
  {
    targetId: 'hunyuan-video',
    name: '腾讯 混元 Video',
    category: 'video',
    display_name: '腾讯 混元开源视频大模型 (HunyuanVideo)',
    sort: 21,
    baseCredits: 25,
    preferredProvider: 'tencent',
    aliases: ['hunyuan-image-to-video', 'hunyuan-text-to-video'],
  },

  // === 智谱 AI ===
  {
    targetId: 'cogvideo-2b',
    name: '智谱 CogVideoX',
    category: 'video',
    display_name: '智谱 CogVideoX 视频生成',
    sort: 22,
    baseCredits: 25,
    preferredProvider: 'zhipu',
    aliases: [],
  },

  // === Stability AI ===
  {
    targetId: 'sd-3.5-large',
    name: 'Stable Diffusion 3.5 Large',
    category: 'image',
    display_name: 'Stability SD 3.5 Large 工业级',
    sort: 15,
    baseCredits: 14,
    preferredProvider: 'stability',
    aliases: ['stability-sd-3.5'],
  },

  // === Topaz ===
  {
    targetId: 'topaz-video-ai',
    name: 'Topaz Video AI',
    category: 'video',
    display_name: 'Topaz Video AI 4K/60fps 极限画质超分',
    sort: 23,
    baseCredits: 30,
    preferredProvider: 'topaz',
    aliases: [],
  },

  // === 口型数字人 ===
  {
    targetId: 'infinitetalk',
    name: 'InfiniteTalk 口型数字人',
    category: 'video',
    display_name: 'InfiniteTalk 极速口型驱动数字人',
    sort: 24,
    baseCredits: 20,
    preferredProvider: 'gateway',
    aliases: ['infinitetalk-image-to-video', 'infinitetalk-video-to-video'],
  },
];

export const CANONICAL_TARGET_MAP = new Map(CANONICAL_GROUPS.map((g) => [g.targetId, g]));

export const ALL_ALIASES_MAP = new Map();
CANONICAL_GROUPS.forEach((g) => {
  (g.aliases || []).forEach((alias) => {
    ALL_ALIASES_MAP.set(alias, g.targetId);
  });
});

/**
 * 判断某个模型 ID 是否为孤立待归并的动作别名变体
 */
export function isOrphanVariantCandidate(modelId, tier = '') {
  if (!modelId) return false;
  if (CANONICAL_TARGET_MAP.has(modelId)) return false;
  if (ALL_ALIASES_MAP.has(modelId)) return false;
  if (tier === 'core') return false;

  const lower = modelId.toLowerCase();
  return (
    lower.includes('-text-to-') ||
    lower.includes('-image-to-') ||
    lower.includes('-t2v') ||
    lower.includes('-i2v') ||
    lower.includes('-t2i') ||
    lower.includes('-i2i') ||
    lower.includes('-standard') ||
    lower.includes('-turbo')
  );
}

/**
 * 为孤立模型推荐目标规范模型
 */
export function suggestCanonicalTarget(modelId) {
  if (!modelId) return null;
  const lower = modelId.toLowerCase();

  // 1. 优先尝试版本与品牌双重精准匹配 (如 kling-v2.6-... 优先推荐 kling-2.6)
  for (const group of CANONICAL_GROUPS) {
    const parts = group.targetId.toLowerCase().split('-');
    const root = parts[0];
    const version = parts[1];
    if (lower.includes(root)) {
      if (version && (lower.includes(version) || lower.includes(`v${version}`))) {
        return group.targetId;
      }
    }
  }

  // 2. 回退至主品牌根前缀匹配 (如 kling-unknown-i2v 推荐 kling-3.0)
  for (const group of CANONICAL_GROUPS) {
    const root = group.targetId.split('-')[0].toLowerCase();
    if (lower.includes(root)) {
      return group.targetId;
    }
  }
  return null;
}

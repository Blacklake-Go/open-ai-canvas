// 即梦画布工具的承接定义：参数校验、提示词模板与对外规格都集中在这里。
// 上游统一走图生图（i2i）重绘，本模块只负责把画布语义翻译成受白名单约束的生成参数。

const ASPECT_RATIOS = Object.freeze(['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9']);
const RESOLUTIONS = Object.freeze(['2k', '4k']);
const DETAIL_LEVELS = Object.freeze(['low', 'medium', 'high']);
const UPSCALE_MODES = Object.freeze(['smart', 'standard']);
const OUTPAINT_SCALES = Object.freeze([1.5, 2, 3]);

const DETAIL_WORDS = Object.freeze({ low: '轻度', medium: '适中', high: '强力' });
const UPSCALE_MODE_WORDS = Object.freeze({ smart: '智能超清', standard: '超清' });

const CAMERA_PRESETS = Object.freeze([
  { id: 'top_left', label: '左上', yaw: -45, pitch: 30 },
  { id: 'top', label: '俯视', yaw: 0, pitch: 60 },
  { id: 'top_right', label: '右上', yaw: 45, pitch: 30 },
  { id: 'left', label: '左视', yaw: -90, pitch: 0 },
  { id: 'front', label: '正视', yaw: 0, pitch: 0 },
  { id: 'right', label: '右视', yaw: 90, pitch: 0 },
  { id: 'bottom_left', label: '左下', yaw: -45, pitch: -30 },
  { id: 'bottom', label: '仰视', yaw: 0, pitch: -60 },
  { id: 'bottom_right', label: '右下', yaw: 45, pitch: -30 },
]);

const CANVAS_PRESETS = Object.freeze([
  {
    id: 'scene_top_view',
    label: '场景俯视图',
    aspectRatio: 'source',
    resolutions: RESOLUTIONS,
    hint: '正上方俯视重建场景平面布局',
    prompt: () => [
      '以正上方垂直俯视的视角重绘该场景，输出场景的俯视布局图。',
      '保持原有空间结构、物体种类与数量、相对位置关系、材质和配色不变，采用均匀明亮的顶光，画面清晰、无透视畸变、无遮挡。',
      '不新增或删除主要物体，不出现文字、水印、尺寸标注与边框。',
    ].join(''),
  },
  {
    id: 'continuous_storyboard',
    label: '连续分镜图',
    aspectRatio: '16:9',
    resolutions: RESOLUTIONS,
    hint: '横向三格连续分镜',
    prompt: () => [
      '以该画面为起点，生成横向连续分镜：画面从左到右分为三个等宽分镜格，按时间顺序展示同一场景、同一角色的连续动作。',
      '角色造型、服装、场景、光线与色调在各格之间保持一致，镜头语言连贯，每格构图完整清晰。',
      '不出现文字、水印、对话气泡与边框。',
    ].join(''),
  },
  {
    id: 'multi_camera_nine_grid',
    label: '多机位九宫格',
    aspectRatio: '16:9',
    resolutions: RESOLUTIONS,
    hint: '3×3 九机位同一主体',
    prompt: () => [
      '以该主体为核心生成九宫格多机位画面：3×3 网格排列同一主体在九个不同机位与角度下的画面，覆盖正面、左侧、右侧、背面、俯视、仰视、近景、中景、远景。',
      '主体造型、服装、材质与配色在所有格子中保持一致，光线统一，格子等大对齐。',
      '不出现文字、水印与边框。',
    ].join(''),
  },
  {
    id: 'character_three_view',
    label: '人物三视图',
    aspectRatio: '16:9',
    resolutions: RESOLUTIONS,
    hint: '正面 / 侧面 / 背面全身',
    prompt: () => [
      '生成该人物的角色三视图：在同一画面中从左到右等距排列正面、侧面、背面三个全身视角。',
      '人物站姿自然、比例一致，三个视角朝向统一（正视镜头、侧面 90°、背对镜头），服装、发型、配饰、材质与配色完全一致。',
      '纯色浅灰背景，均匀柔光，无投影、无文字、无水印、无边框，16:9 横版构图。',
    ].join(''),
  },
  {
    id: 'face_three_view',
    label: '面部三视图',
    aspectRatio: '16:9',
    resolutions: RESOLUTIONS,
    hint: '正面 / 侧面 / 背面头部',
    prompt: () => [
      '生成该人物的面部三视图：同一画面中从左到右等距排列正面、侧面、背面三个头部视角。',
      '五官、发型、肤色、妆容与表情在各视角之间保持一致，角度过渡自然，头部比例不变。',
      '纯色浅灰背景，均匀柔光，无文字、无水印、无边框，16:9 横版构图。',
    ].join(''),
  },
  {
    id: 'product_three_view',
    label: '产品三视图',
    aspectRatio: '16:9',
    resolutions: RESOLUTIONS,
    hint: '正面 / 侧面 / 背面产品',
    prompt: () => [
      '生成该产品的产品三视图：同一画面中从左到右等距排列正面、侧面、背面三个视角。',
      '产品造型、比例、材质、颜色、logo 与细节完全一致，背景干净统一。',
      '纯色浅灰背景，均匀柔光，轻微地面接触阴影，无文字标注、无水印、无边框，16:9 横版构图。',
    ].join(''),
  },
]);

function fail(code, message) {
  throw Object.assign(new Error(message), { code });
}

function toBoundedNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeResolution(value, fallback = '2k') {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return fallback;
  if (!RESOLUTIONS.includes(raw)) fail('RESOLUTION_UNSUPPORTED', '不支持的超清档位');
  return raw;
}

function normalizeRatio(value, fallback = '1:1') {
  const raw = String(value || '').trim();
  if (!raw || raw === 'source' || raw === 'auto') return fallback;
  if (!ASPECT_RATIOS.includes(raw)) fail('ASPECT_RATIO_UNSUPPORTED', '不支持的目标画幅比例');
  return raw;
}

function normalizeUserPrompt(value, maxLength = 600) {
  if (typeof value !== 'string') return '';
  const clean = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim();
  if (clean.length > maxLength) fail('PROMPT_TOO_LONG', `补充描述不能超过 ${maxLength} 个字符`);
  return clean;
}

function describeYaw(yaw) {
  const angle = ((Number(yaw) % 360) + 360) % 360;
  if (angle <= 22 || angle >= 338) return '正面（0°）';
  if (angle < 67) return '右前侧 45°';
  if (angle <= 112) return '右侧 90°';
  if (angle < 157) return '右后侧 135°';
  if (angle <= 202) return '背面 180°';
  if (angle < 247) return '左后侧 225°';
  if (angle <= 292) return '左侧 270°';
  return '左前侧 315°';
}

function describePitch(pitch) {
  const angle = Number(pitch) || 0;
  if (angle >= 45) return '接近垂直的顶视俯拍';
  if (angle >= 20) return '高角度俯拍';
  if (angle > 8) return '略高于平视的俯拍';
  if (angle >= -8) return '平视（与主体视线齐平）';
  if (angle > -35) return '低角度仰拍';
  return '接近垂直的底视仰拍';
}

function buildOutpaintPrompt({ ratio, scale, extraPrompt }) {
  const lines = [
    `在保持原图主体、姿态、服装、材质、光照方向、色调与透视关系完全不变的前提下，将画面向外扩展约 ${scale} 倍，输出 ${ratio} 画幅。`,
    '补全扩展区域的环境、背景与场景细节，让扩展部分与原图无缝衔接；不新增人物或主要物体，不改变主体位置、大小与构图重心。',
    '不出现文字、水印、边框与拼贴痕迹。',
  ];
  if (extraPrompt) lines.push(`补充要求：${extraPrompt}`);
  return lines.join('');
}

function buildUpscalePrompt({ mode, resolution, detail, ratio }) {
  const level = DETAIL_WORDS[detail];
  if (mode === 'standard') {
    return [
      `对原图进行${UPSCALE_MODE_WORDS[mode]}重绘，将画面提升到 ${resolution.toUpperCase()} 分辨率。`,
      '完整保留原图的构图、主体、姿态、表情、服装、文字排版、色彩与光影，仅提升清晰度并补充边缘与纹理细节（细节强度：' + level + '）。',
      `输出画幅比例保持 ${ratio}，不得新增或删除物体，不得出现噪点、涂抹感、色偏、形变与重影。`,
    ].join('');
  }
  return [
    `对原图执行智能超分辨重建，将画面提升到 ${resolution.toUpperCase()} 分辨率。`,
    '完整保留原图的构图、主体、姿态、表情、服装、文字排版、色彩与光影，智能推理并补全被压缩的细节，强化边缘锐度、纹理与材质表现（细节强度：' + level + '）。',
    `输出画幅比例保持 ${ratio}，不得改变任何内容，不得新增或删除物体，不得出现噪点、涂抹感、色偏与形变。`,
  ].join('');
}

function buildCutoutPrompt({ ratio }) {
  return [
    '精确识别画面中的主体，完整保留主体轮廓、发丝、边缘与半透明细节，将背景替换为均匀的纯白色（#FFFFFF）影棚背景。',
    `主体位置、大小、角度、朝向、光照与色彩保持不变，输出画幅比例保持 ${ratio}。`,
    '不新增或删除物体，不裁切主体，不出现文字、水印与投影。',
  ].join('');
}

function buildViewControlPrompt({ yaw, pitch, distance, ratio }) {
  const distanceWord = distance === 0 ? '拉近为近景特写' : distance === 2 ? '拉远为全景' : '保持中景距离';
  return [
    `将摄像机方位调整到${describeYaw(yaw)}、${describePitch(pitch)}，并${distanceWord}。`,
    '保持原画面中的主体身份、造型、服装、场景、光照氛围与整体风格不变，仅改变拍摄角度与机位，输出自然、连续、无畸变的画面。',
    `输出画幅比例保持 ${ratio}，不新增或删除物体，不出现文字与水印。`,
  ].join('');
}

export function buildCanvasToolPlan({ tool, params = {}, sourceAssetId }) {
  const assetId = String(sourceAssetId || '').trim();
  if (!/^[A-Za-z0-9_-]{8,160}$/.test(assetId)) {
    fail('INVALID_SOURCE', '请先上传一张源图片');
  }
  const baseParameters = {
    task_type: 'i2i',
    image_urls: [`koyo-asset:${assetId}`],
  };
  const raw = params && typeof params === 'object' ? params : {};

  switch (String(tool || '').trim()) {
    case 'outpaint': {
      const ratio = normalizeRatio(raw.aspectRatio, '1:1');
      const scale = toBoundedNumber(raw.scale, 1.5, 1, 3);
      const extraPrompt = normalizeUserPrompt(raw.prompt);
      return {
        tool: 'outpaint',
        label: '画布扩图',
        prompt: buildOutpaintPrompt({ ratio, scale, extraPrompt }),
        parameters: { ...baseParameters, aspect_ratio: ratio, resolution: '2k' },
        meta: { aspectRatio: ratio, scale },
      };
    }
    case 'upscale': {
      const mode = UPSCALE_MODES.includes(raw.mode) ? raw.mode : 'smart';
      const detail = DETAIL_LEVELS.includes(raw.detail) ? raw.detail : 'medium';
      const resolution = normalizeResolution(raw.resolution, '2k');
      const ratio = normalizeRatio(raw.aspectRatio, '1:1');
      return {
        tool: 'upscale',
        label: originalUpscaleLabel(mode),
        prompt: buildUpscalePrompt({ mode, resolution, detail, ratio }),
        parameters: { ...baseParameters, aspect_ratio: ratio, resolution },
        meta: { aspectRatio: ratio, resolution, mode, detail },
      };
    }
    case 'cutout': {
      const ratio = normalizeRatio(raw.aspectRatio, '1:1');
      return {
        tool: 'cutout',
        label: '画布抠图',
        prompt: buildCutoutPrompt({ ratio }),
        parameters: { ...baseParameters, aspect_ratio: ratio, resolution: '2k' },
        meta: { aspectRatio: ratio, background: 'white' },
      };
    }
    case 'preset': {
      const preset = CANVAS_PRESETS.find((item) => item.id === raw.presetId);
      if (!preset) fail('PRESET_UNSUPPORTED', '不支持的预设');
      const resolution = normalizeResolution(raw.resolution, '2k');
      const ratio = preset.aspectRatio === '16:9'
        ? '16:9'
        : normalizeRatio(raw.aspectRatio, '16:9');
      return {
        tool: 'preset',
        label: `画布${preset.label}`,
        prompt: preset.prompt({ resolution, ratio }),
        parameters: { ...baseParameters, aspect_ratio: ratio, resolution },
        meta: { presetId: preset.id, presetLabel: preset.label, aspectRatio: ratio, resolution },
      };
    }
    case 'view_control': {
      const yaw = toBoundedNumber(raw.yaw, 0, -180, 180);
      const pitch = toBoundedNumber(raw.pitch, 0, -60, 60);
      const distance = [0, 1, 2].includes(Number(raw.distance)) ? Number(raw.distance) : 1;
      const ratio = normalizeRatio(raw.aspectRatio, '1:1');
      return {
        tool: 'view_control',
        label: '画布多角度',
        prompt: buildViewControlPrompt({ yaw, pitch, distance, ratio }),
        parameters: { ...baseParameters, aspect_ratio: ratio, resolution: '2k' },
        meta: { aspectRatio: ratio, yaw, pitch, distance },
      };
    }
    default:
      return fail('INVALID_TOOL', '不支持的工具');
  }
}

function originalUpscaleLabel(mode) {
  return mode === 'standard' ? '画布超清' : '画布智能超清';
}

export function buildCanvasToolSpec({ model, capabilities = {} }) {
  const declaredRatios = Array.isArray(capabilities.aspectRatios) ? capabilities.aspectRatios : [];
  const declaredResolutions = Array.isArray(capabilities.resolutions) ? capabilities.resolutions : [];
  const ratioOptions = ASPECT_RATIOS.filter((ratio) => !declaredRatios.length || declaredRatios.includes(ratio));
  const resolutionOptions = RESOLUTIONS.filter((value) => !declaredResolutions.length || declaredResolutions.includes(value));
  const usableResolutions = resolutionOptions.length ? resolutionOptions : [...RESOLUTIONS];
  const usableRatios = ratioOptions.length ? ratioOptions : [...ASPECT_RATIOS];

  return {
    version: 1,
    model: {
      id: model.id,
      name: model.display_name || model.name || model.id,
      provider: model.provider || '',
      creditsPrice: Number(model.credits_price ?? model.creditsPrice ?? 0) || 0,
    },
    capabilities: {
      aspectRatios: usableRatios,
      resolutions: usableResolutions,
    },
    tools: [
      {
        id: 'outpaint',
        label: '扩图',
        hint: '扩展画幅并补全场景',
        ratios: usableRatios,
        scales: [...OUTPAINT_SCALES],
        defaultScale: 1.5,
        promptPlaceholder: '描述你想如何修改图片',
      },
      {
        id: 'upscale',
        label: '智能超清',
        hint: '提升分辨率并补全细节',
        modes: [
          { id: 'smart', label: '智能超清' },
          { id: 'standard', label: '超清' },
        ],
        details: [
          { id: 'low', label: '低' },
          { id: 'medium', label: '中' },
          { id: 'high', label: '高' },
        ],
        resolutions: usableResolutions,
        defaultMode: 'smart',
        defaultDetail: 'medium',
        defaultResolution: '2k',
      },
      {
        id: 'cutout',
        label: '抠图',
        hint: '自动识别主体并移除背景',
        note: '当前上游不支持透明通道，输出为纯白背景；蒙版画笔等局部编辑暂不可用。',
      },
      {
        id: 'preset',
        label: '三视图 / 预设',
        hint: '场景俯视图、连续分镜与三视图',
        presets: CANVAS_PRESETS.map((preset) => ({
          id: preset.id,
          label: preset.label,
          hint: preset.hint,
          aspectRatio: preset.aspectRatio,
          resolutions: preset.resolutions.filter((value) => usableResolutions.includes(value)),
        })),
        resolutions: usableResolutions,
      },
      {
        id: 'view_control',
        label: '多角度',
        hint: '调整摄像机方位重绘同一画面',
        cameraPresets: CAMERA_PRESETS.map((preset) => ({ ...preset })),
        yaw: { min: -180, max: 180, step: 5 },
        pitch: { min: -60, max: 60, step: 5 },
        distances: [
          { value: 0, label: '近景' },
          { value: 1, label: '中景' },
          { value: 2, label: '远景' },
        ],
      },
    ],
    limitations: [
      '所有工具均由 Seedream 图生图重绘承接，结果为近似复刻，而非即梦原模型输出。',
      '每次生成固定输出 1 张图片；多张输出与 8K 超清暂不可用。',
      '抠图输出为纯白背景的不透明图片。',
      '三视图类预设强制 16:9 画幅，仅支持 2K / 4K。',
    ],
  };
}

export {
  ASPECT_RATIOS,
  RESOLUTIONS,
  CANVAS_PRESETS,
  CAMERA_PRESETS,
  DETAIL_LEVELS,
  UPSCALE_MODES,
  OUTPAINT_SCALES,
};

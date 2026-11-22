'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import StudioHeader from '@/components/site/StudioHeader';

const RATIO_OPTIONS = ['21:9', '16:9', '4:3', '1:1', '9:16'];
const FALLBACK_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'];
const SCALE_OPTIONS = [
  { value: 1.5, label: '1.5x' },
  { value: 2, label: '2x' },
  { value: 3, label: '3x' },
];
const UPSCALE_MODES = [
  { value: 'smart', label: '智能超清' },
  { value: 'standard', label: '超清' },
];
const DETAIL_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
];
const RESOLUTION_OPTIONS = ['2k', '4k', '8k'];
const MAX_PROMPT_LENGTH = 600;
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const ACCEPTED_IMAGE = /^image\/(?:jpeg|png|webp|gif)$/;

const TOOL_TABS = [
  { id: 'outpaint', label: '扩图', icon: ExpandIcon },
  { id: 'upscale', label: '智能超清', icon: SparkleIcon },
  { id: 'cutout', label: '抠图', icon: ScissorsIcon },
  { id: 'preset', label: '三视图', icon: LayoutIcon },
  { id: 'view_control', label: '多角度', icon: CameraIcon },
];

const FALLBACK_PRESETS = [
  { id: 'scene_top_view', label: '场景俯视图', hint: '正上方俯视重建场景平面布局', aspectRatio: 'source' },
  { id: 'continuous_storyboard', label: '连续分镜图', hint: '横向三格连续分镜', aspectRatio: '16:9' },
  { id: 'multi_camera_nine_grid', label: '多机位九宫格', hint: '3×3 九机位同一主体', aspectRatio: '16:9' },
  { id: 'character_three_view', label: '人物三视图', hint: '正面 / 侧面 / 背面全身', aspectRatio: '16:9' },
  { id: 'face_three_view', label: '面部三视图', hint: '正面 / 侧面 / 背面头部', aspectRatio: '16:9' },
  { id: 'product_three_view', label: '产品三视图', hint: '正面 / 侧面 / 背面产品', aspectRatio: '16:9' },
];

const FALLBACK_CAMERAS = [
  { id: 'top_left', label: '左上', yaw: -45, pitch: 30 },
  { id: 'top', label: '俯视', yaw: 0, pitch: 60 },
  { id: 'top_right', label: '右上', yaw: 45, pitch: 30 },
  { id: 'left', label: '左视', yaw: -90, pitch: 0 },
  { id: 'front', label: '正视', yaw: 0, pitch: 0 },
  { id: 'right', label: '右视', yaw: 90, pitch: 0 },
  { id: 'bottom_left', label: '左下', yaw: -45, pitch: -30 },
  { id: 'bottom', label: '仰视', yaw: 0, pitch: -60 },
  { id: 'bottom_right', label: '右下', yaw: 45, pitch: -30 },
];

const DEFAULT_SETTINGS = {
  outpaint: { scale: 1.5, ratio: 'original', prompt: '' },
  upscale: { mode: 'smart', detail: 'medium', resolution: '2k', ratio: 'original' },
  cutout: { ratio: 'original' },
  preset: { presetId: 'character_three_view', resolution: '2k' },
  view_control: { yaw: 0, pitch: 0, distance: 1, ratio: 'original' },
};

function nearestRatio(ratio, supported) {
  const list = Array.isArray(supported) && supported.length ? supported : FALLBACK_RATIOS;
  if (!Number.isFinite(ratio) || ratio <= 0) return list[0] || '1:1';
  let best = list[0] || '1:1';
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const item of list) {
    const [width, height] = String(item).split(':').map(Number);
    if (!width || !height) continue;
    const diff = Math.abs(Math.log(width / height / ratio));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = item;
    }
  }
  return best;
}

function ratioAspect(value) {
  const [width, height] = String(value || '').split(':').map(Number);
  if (!width || !height) return 1;
  return width / height;
}

function buildRawParams(toolId, current, sourceRatio, supportedRatios, presetMeta) {
  const ratio = current.ratio === 'original' || !current.ratio
    ? nearestRatio(sourceRatio, supportedRatios)
    : current.ratio;
  switch (toolId) {
    case 'outpaint':
      return { scale: current.scale, aspectRatio: ratio };
    case 'upscale':
      return { mode: current.mode, detail: current.detail, resolution: current.resolution, aspectRatio: ratio };
    case 'cutout':
      return { aspectRatio: ratio };
    case 'preset':
      return {
        presetId: current.presetId,
        resolution: current.resolution,
        aspectRatio: presetMeta?.aspectRatio === '16:9' ? '16:9' : ratio,
      };
    case 'view_control':
      return { yaw: current.yaw, pitch: current.pitch, distance: current.distance, aspectRatio: ratio };
    default:
      return { aspectRatio: ratio };
  }
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function randomKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `ct-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sleep(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

function readImageSize(file) {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth || 0, height: image.naturalHeight || 0 });
      URL.revokeObjectURL(objectUrl);
    };
    image.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(objectUrl);
    };
    image.src = objectUrl;
  });
}

function fileExtension(blob) {
  const type = String(blob?.type || '');
  if (type.includes('jpeg')) return 'jpg';
  if (type.includes('webp')) return 'webp';
  if (type.includes('gif')) return 'gif';
  return 'png';
}

function proxiedResultUrl(creationId, url) {
  if (!creationId || !url) return url;
  if (/^(?:https?:\/\/[^/]+)?\/uploads\/generated\//i.test(url)) {
    return `/api/canvas-tools/result/${encodeURIComponent(creationId)}`;
  }
  return url;
}

function IconBase({ children, size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function ExpandIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M9 4H4v5" />
      <path d="M15 4h5v5" />
      <path d="M15 20h5v-5" />
      <path d="M9 20H4v-5" />
    </IconBase>
  );
}

function SparkleIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      <path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" />
    </IconBase>
  );
}

function ScissorsIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="6" cy="6" r="2.4" />
      <circle cx="6" cy="18" r="2.4" />
      <path d="M8 7.6L20 18" />
      <path d="M8 16.4L20 6" />
    </IconBase>
  );
}

function LayoutIcon(props) {
  return (
    <IconBase {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2.2" />
      <path d="M3 9.5h18M3 15h18M9.5 3v18M15 3v18" />
    </IconBase>
  );
}

function CameraIcon(props) {
  return (
    <IconBase {...props}>
      <rect x="3" y="6" width="18" height="14" rx="2.2" />
      <circle cx="12" cy="13" r="3.4" />
      <path d="M8 6l1.4-2h5.2L16 6" />
    </IconBase>
  );
}

function UploadIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 16V4" />
      <path d="M7.5 8.5L12 4l4.5 4.5" />
      <path d="M4 15v4a1 1 0 001 1h14a1 1 0 001-1v-4" />
    </IconBase>
  );
}

function DownloadIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 4v12" />
      <path d="M7.5 11.5L12 16l4.5-4.5" />
      <path d="M4 19h16" />
    </IconBase>
  );
}

function RefreshIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M20 11a8 8 0 10-2.6 5.9" />
      <path d="M20 5v6h-6" />
    </IconBase>
  );
}

function ImageIcon(props) {
  return (
    <IconBase {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2.2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M21 16l-5-5-9 9" />
    </IconBase>
  );
}

function CheckIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M4.5 12.5l5 5 10-10" />
    </IconBase>
  );
}

function ChevronDownIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M6 9.5l6 6 6-6" />
    </IconBase>
  );
}

function CloseIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </IconBase>
  );
}

function BoltIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H13L13 2z" />
    </IconBase>
  );
}

function ArrowUpIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 20V5" />
      <path d="M5.5 11.5L12 5l6.5 6.5" />
    </IconBase>
  );
}

function PresetGlyph({ id }) {
  const size = 22;
  if (id === 'continuous_storyboard') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <rect x="2.5" y="5" width="5.4" height="14" rx="1.2" />
        <rect x="9.3" y="5" width="5.4" height="14" rx="1.2" />
        <rect x="16.1" y="5" width="5.4" height="14" rx="1.2" />
      </svg>
    );
  }
  if (id === 'multi_camera_nine_grid') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="1.6" />
        <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
      </svg>
    );
  }
  if (id === 'character_three_view') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
        <circle cx="6" cy="7" r="1.8" />
        <circle cx="12" cy="7" r="1.8" />
        <circle cx="18" cy="7" r="1.8" />
        <path d="M6 9.5v6M12 9.5v6M18 9.5v6M6 18v2M12 18v2M18 18v2M4.2 12h3.6M10.2 12h3.6M16.2 12h3.6" />
      </svg>
    );
  }
  if (id === 'face_three_view') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
        <circle cx="6" cy="10" r="3" />
        <circle cx="12" cy="10" r="3" />
        <circle cx="18" cy="10" r="3" />
        <path d="M6 13.2V16M12 13.2V16M18 13.2V16" />
      </svg>
    );
  }
  if (id === 'product_three_view') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="7" width="5" height="9" rx="0.8" />
        <rect x="9.5" y="7" width="5" height="9" rx="0.8" />
        <rect x="16" y="7" width="5" height="9" rx="0.8" />
        <path d="M3 7l1.5-3h5L11 7M9.5 7l1.5-3h5l1.5 3M16 7l1.5-3h5L23 7" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="1.6" />
      <rect x="7.5" y="7.5" width="9" height="9" rx="1" />
      <path d="M12 3v4.5M12 16.5V21M3 12h4.5M16.5 12H21" />
    </svg>
  );
}

function Dropdown({ value, options, onChange, label }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function handlePointerDown(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const selected = options.find((option) => String(option.value) === String(value)) || options[0];

  return (
    <div className="ct-select-wrap" ref={wrapRef}>
      <button
        type="button"
        className="ct-select"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>{selected?.label || ''}</span>
        <ChevronDownIcon size={14} />
      </button>
      {open ? (
        <div className="ct-menu" role="listbox" aria-label={label}>
          {options.map((option) => {
            const active = String(option.value) === String(value);
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                className="ct-menu-item"
                data-active={active}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                {active ? <span className="ct-menu-check"><CheckIcon size={14} /></span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function CanvasToolsStudio({ initialUser = null, initialTool = 'outpaint', initialPreset = null }) {
  const [user] = useState(initialUser);
  const [spec, setSpec] = useState(null);
  const [specError, setSpecError] = useState('');
  const [specVersion, setSpecVersion] = useState(0);
  const [toolId, setToolId] = useState(() => (TOOL_TABS.some((item) => item.id === initialTool) ? initialTool : 'outpaint'));
  const [settings, setSettings] = useState(() => (
    initialPreset
      ? { ...DEFAULT_SETTINGS, preset: { ...DEFAULT_SETTINGS.preset, presetId: initialPreset } }
      : DEFAULT_SETTINGS
  ));
  const [source, setSource] = useState(null);
  const [result, setResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [quote, setQuote] = useState({ status: 'idle', credits: null });
  const quoteCacheRef = useRef(new Map());
  const fileInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setSpecError('');
    fetch('/api/canvas-tools/spec', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.success) throw new Error(data?.error || '画布工具暂时不可用');
        if (!cancelled) setSpec(data);
      })
      .catch((fetchError) => {
        if (!cancelled) setSpecError(fetchError.message || '画布工具暂时不可用');
      });
    return () => { cancelled = true; };
  }, [specVersion]);

  useEffect(() => {
    if (TOOL_TABS.some((item) => item.id === initialTool)) setToolId(initialTool);
  }, [initialTool]);

  useEffect(() => {
    if (!initialPreset) return;
    setSettings((prev) => (
      prev.preset.presetId === initialPreset
        ? prev
        : { ...prev, preset: { ...prev.preset, presetId: initialPreset } }
    ));
  }, [initialPreset]);

  const supportedRatios = useMemo(() => (
    Array.isArray(spec?.capabilities?.aspectRatios) && spec.capabilities.aspectRatios.length
      ? spec.capabilities.aspectRatios
      : FALLBACK_RATIOS
  ), [spec]);

  const toolMeta = useMemo(() => spec?.tools?.find((item) => item.id === toolId) || null, [spec, toolId]);
  const presetList = useMemo(() => (
    spec?.tools?.find((item) => item.id === 'preset')?.presets || FALLBACK_PRESETS
  ), [spec]);
  const cameraPresets = useMemo(() => (
    spec?.tools?.find((item) => item.id === 'view_control')?.cameraPresets || FALLBACK_CAMERAS
  ), [spec]);
  const upscaleResolutions = useMemo(() => {
    const declared = spec?.tools?.find((item) => item.id === 'upscale')?.resolutions;
    return Array.isArray(declared) && declared.length ? declared : ['2k', '4k'];
  }, [spec]);
  const distanceOptions = useMemo(() => (
    spec?.tools?.find((item) => item.id === 'view_control')?.distances
    || [{ value: 0, label: '近景' }, { value: 1, label: '中景' }, { value: 2, label: '远景' }]
  ), [spec]);

  const sourceRatio = source?.width && source?.height ? source.width / source.height : 1;
  const current = settings[toolId];
  const presetMeta = presetList.find((item) => item.id === settings.preset.presetId) || presetList[0] || FALLBACK_PRESETS[0];

  const previewParams = useMemo(
    () => buildRawParams(toolId, current, sourceRatio, supportedRatios, presetMeta),
    [toolId, current, sourceRatio, supportedRatios, presetMeta],
  );
  const previewKey = JSON.stringify(previewParams);

  const basePrice = Number(spec?.model?.creditsPrice) || 0;

  useEffect(() => {
    if (!user || !source || !spec) {
      setQuote({ status: 'idle', credits: null });
      return undefined;
    }
    let cancelled = false;
    setQuote((prev) => ({ status: 'loading', credits: prev.credits }));

    async function loadQuote() {
      try {
        const plan = await requestPlan(toolId, previewParams, source.assetId);
        if (cancelled) return;
        const quoted = await requestQuote(plan.modelId, plan.parameters);
        if (cancelled) return;
        setQuote({ status: 'ready', credits: quoted.credits, quoteId: quoted.quoteId, expiresAt: quoted.expiresAt });
      } catch {
        if (!cancelled) setQuote({ status: 'error', credits: null });
      }
    }

    const timer = setTimeout(loadQuote, toolId === 'view_control' ? 1200 : 700);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, source?.assetId, sourceRatio, toolId, previewKey, spec?.model?.id]);

  async function requestPlan(tool, params, sourceAssetId) {
    const response = await fetch('/api/canvas-tools/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, params, sourceAssetId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.success || !data?.plan) {
      throw new Error(data?.error || '画布参数准备失败');
    }
    return data.plan;
  }

  async function requestQuote(modelId, parameters) {
    const cacheKey = `${modelId}|${stableStringify(parameters)}`;
    const cached = quoteCacheRef.current.get(cacheKey);
    if (cached && new Date(cached.expiresAt).getTime() - Date.now() > 15000) return cached;

    const response = await fetch('/api/generation/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomKey() },
      body: JSON.stringify({ modelId, parameters }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.quoteId) throw new Error(data?.error || '获取模型报价失败');
    const entry = {
      quoteId: data.quoteId,
      credits: Number(data.credits) || 0,
      expiresAt: data.expiresAt || new Date(Date.now() + 240000).toISOString(),
    };
    quoteCacheRef.current.set(cacheKey, entry);
    return entry;
  }

  function updateCurrent(patch) {
    setSettings((prev) => ({ ...prev, [toolId]: { ...prev[toolId], ...patch } }));
    setResult(null);
    setError('');
  }

  function selectTool(nextTool) {
    if (nextTool === toolId) return;
    setToolId(nextTool);
    setResult(null);
    setError('');
  }

  async function uploadFile(file) {
    if (!file) return;
    if (!user) {
      setError('请先登录后再上传图片');
      return;
    }
    if (!ACCEPTED_IMAGE.test(String(file.type || ''))) {
      setError('仅支持 JPG / PNG / WebP / GIF 格式的图片');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError('图片大小不能超过 30MB');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const size = await readImageSize(file);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'image');
      formData.append('studioId', 'canvas');
      formData.append('title', file.name || '画布源图');
      const response = await fetch('/api/assets/upload', { method: 'POST', body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.asset?.id) throw new Error(data?.error || '图片上传失败');
      setSource({
        assetId: data.asset.id,
        url: data.url || data.asset.url,
        width: size.width || data.asset.width || 0,
        height: size.height || data.asset.height || 0,
        name: file.name || data.asset.title || '画布源图',
      });
      setResult(null);
    } catch (uploadError) {
      setError(uploadError.message || '图片上传失败，请稍后重试');
    } finally {
      setUploading(false);
    }
  }

  function handleFileInput(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) uploadFile(file);
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    if (!user) return;
    const file = event.dataTransfer?.files?.[0];
    if (file) uploadFile(file);
  }

  function openFilePicker() {
    if (uploading) return;
    fileInputRef.current?.click();
  }

  async function pollCreation(creationId, onTick) {
    const startedAt = Date.now();
    const timeoutMs = 6 * 60 * 1000;
    let attempt = 0;
    while (Date.now() - startedAt < timeoutMs) {
      attempt += 1;
      await sleep(attempt === 1 ? 2500 : 4000);
      if (onTick) onTick(`正在生成… 已用时 ${Math.floor((Date.now() - startedAt) / 1000)}s`);
      const response = await fetch(`/api/generations?id=${encodeURIComponent(creationId)}`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || '查询生成进度失败');
      const creation = data?.creation || data?.trace?.creation || null;
      if (!creation) throw new Error('查询生成进度失败');
      const url = creation.result_url || creation.resultUrl || null;
      if (url) return url;
      if (creation.status === 'failed' || creation.status === 'cancelled') {
        throw new Error(creation.error_message || creation.error || '生成失败，请稍后重试');
      }
    }
    throw new Error('生成超时，请稍后到作品页查看结果');
  }

  async function handleGenerate() {
    if (!user || !source || !spec || generating) return;
    setGenerating(true);
    setError('');
    setProgress('正在创建任务…');
    try {
      const params = buildRawParams(toolId, current, sourceRatio, supportedRatios, presetMeta);
      const planParams = toolId === 'outpaint'
        ? { ...params, prompt: String(current.prompt || '').trim() }
        : params;
      const plan = await requestPlan(toolId, planParams, source.assetId);
      const cacheKey = `${plan.modelId}|${stableStringify(plan.parameters)}`;
      let quoted = await requestQuote(plan.modelId, plan.parameters);
      let response = null;
      let data = null;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        setProgress('正在提交生成任务…');
        response = await fetch('/api/generations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomKey() },
          body: JSON.stringify({
            modelId: plan.modelId,
            studioId: 'canvas',
            prompt: plan.prompt,
            parameters: plan.parameters,
            quoteId: quoted.quoteId,
            label: plan.label,
            routingMode: 'cost',
          }),
        });
        data = await response.json().catch(() => ({}));
        if (response.ok) break;
        const isQuoteIssue = response.status !== 401 && (
          String(data?.code || '').includes('QUOTE') || /报价/.test(String(data?.error || ''))
        );
        if (attempt === 0 && isQuoteIssue) {
          quoteCacheRef.current.delete(cacheKey);
          quoted = await requestQuote(plan.modelId, plan.parameters);
          continue;
        }
        break;
      }

      if (!response || !response.ok) {
        if (response?.status === 401) throw new Error('登录状态已失效，请刷新页面后重新登录');
        throw new Error(data?.error || '生成任务创建失败');
      }

      quoteCacheRef.current.delete(cacheKey);

      let resultUrl = data?.result_url || data?.creation?.result_url || null;
      const creationId = data?.creation?.id || data?.creation_id || data?.creationId || null;
      if (!resultUrl && creationId) {
        resultUrl = await pollCreation(creationId, setProgress);
      }
      if (!resultUrl) throw new Error('任务已完成，但没有返回图片地址');
      setResult({ url: proxiedResultUrl(creationId, resultUrl), creationId, sourceUrl: resultUrl });
      setProgress('');
    } catch (generateError) {
      setError(generateError.message || '生成失败，请稍后重试');
    } finally {
      setGenerating(false);
      setProgress('');
    }
  }

  async function handleDownload() {
    if (!result?.url) return;
    try {
      const response = await fetch(result.url);
      if (!response.ok) throw new Error('download failed');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `supdance-canvas-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${fileExtension(blob)}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
    } catch {
      window.open(result.url, '_blank', 'noopener');
    }
  }

  async function handleUseAsInput() {
    if (!result?.url) return;
    setError('');
    try {
      const response = await fetch(result.url);
      if (!response.ok) throw new Error('read failed');
      const blob = await response.blob();
      const file = new File([blob], `canvas-result.${fileExtension(blob)}`, { type: blob.type || 'image/png' });
      setResult(null);
      await uploadFile(file);
    } catch {
      setError('无法直接读取生成结果，请先下载图片再重新上传');
    }
  }

  const effectiveRatioValue = current.ratio === 'original' || !current.ratio
    ? nearestRatio(sourceRatio, supportedRatios)
    : current.ratio;
  const frameAspect = ratioAspect(effectiveRatioValue);
  const ratioChips = ['original', ...RATIO_OPTIONS.filter((item) => supportedRatios.includes(item))];
  const displayScale = SCALE_OPTIONS.find((item) => Number(item.value) === Number(settings.outpaint.scale))?.label || `${settings.outpaint.scale}x`;

  function renderRatioChips() {
    return (
      <div className="ct-section">
        <div className="ct-label"><span>画面比例</span></div>
        <div className="ct-chips">
          {ratioChips.map((item) => (
            <button
              key={item}
              type="button"
              className="ct-chip"
              data-active={current.ratio === item}
              onClick={() => updateCurrent({ ratio: item })}
            >
              {item === 'original' ? '原比例' : item}
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderPanelBody() {
    if (toolId === 'outpaint') {
      return (
        <>
          <div className="ct-section">
            <div className="ct-label"><span>扩展倍数</span></div>
            <Dropdown
              value={settings.outpaint.scale}
              options={SCALE_OPTIONS}
              onChange={(value) => updateCurrent({ scale: Number(value) })}
              label="扩展倍数"
            />
          </div>
          <div className="ct-section">
            <div className="ct-label"><span>目标画幅</span></div>
            <div className="ct-chips">
              {ratioChips.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="ct-chip"
                  data-active={settings.outpaint.ratio === item}
                  onClick={() => updateCurrent({ ratio: item })}
                >
                  {item === 'original' ? '原比例' : item}
                </button>
              ))}
            </div>
          </div>
          <div className="ct-section">
            <div className="ct-prompt">
              <textarea
                value={settings.outpaint.prompt}
                maxLength={MAX_PROMPT_LENGTH}
                placeholder="描述你想如何修改图片"
                onChange={(event) => updateCurrent({ prompt: event.target.value })}
              />
              <div className="ct-prompt-foot">
                <span>补充描述可选，留空则只做智能扩图</span>
                <span className="ct-counter" data-warn={settings.outpaint.prompt.length > MAX_PROMPT_LENGTH - 60}>
                  {settings.outpaint.prompt.length}/{MAX_PROMPT_LENGTH}
                </span>
              </div>
            </div>
          </div>
        </>
      );
    }

    if (toolId === 'upscale') {
      return (
        <>
          <div className="ct-section">
            <div className="ct-label"><span>超清模式</span></div>
            <Dropdown
              value={settings.upscale.mode}
              options={UPSCALE_MODES}
              onChange={(value) => updateCurrent({ mode: value })}
              label="超清模式"
            />
          </div>
          <div className="ct-section">
            <div className="ct-label"><span>细节强度</span></div>
            <Dropdown
              value={settings.upscale.detail}
              options={DETAIL_OPTIONS}
              onChange={(value) => updateCurrent({ detail: value })}
              label="细节强度"
            />
          </div>
          <div className="ct-section">
            <div className="ct-label"><span>输出分辨率</span></div>
            <div className="ct-segment">
              {RESOLUTION_OPTIONS.map((value) => {
                const supported = upscaleResolutions.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    className="ct-segment-item"
                    data-active={settings.upscale.resolution === value}
                    disabled={!supported}
                    title={supported ? `${value.toUpperCase()} 输出` : '8K 暂未开放'}
                    onClick={() => updateCurrent({ resolution: value })}
                  >
                    {value.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>
          {renderRatioChips()}
        </>
      );
    }

    if (toolId === 'cutout') {
      return (
        <>
          <div className="ct-section">
            <div className="ct-label"><span>选区方式</span></div>
            <div className="ct-chips">
              <button type="button" className="ct-chip" data-active="true" disabled>自动识别</button>
              <button type="button" className="ct-chip" disabled title="蒙版画笔暂未开放">蒙版画笔</button>
              <button type="button" className="ct-chip" disabled title="反向选区暂未开放">反向选区</button>
            </div>
          </div>
          <div className="ct-section">
            <div className="ct-note">
              自动识别主体并移除背景。当前上游不支持透明通道，输出为纯白背景的不透明图片；发丝与半透明边缘会由模型重绘近似保留。
            </div>
          </div>
          {renderRatioChips()}
        </>
      );
    }

    if (toolId === 'preset') {
      return (
        <>
          <div className="ct-section">
            <div className="ct-label"><span>选择预设</span><span className="ct-label-side">{presetMeta?.aspectRatio === '16:9' ? '16:9 横版' : '跟随原图比例'}</span></div>
            <div className="ct-preset-grid">
              {presetList.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="ct-preset"
                  data-active={settings.preset.presetId === preset.id}
                  onClick={() => updateCurrent({ presetId: preset.id })}
                >
                  <span className="ct-preset-icon"><PresetGlyph id={preset.id} /></span>
                  <span className="ct-preset-label">{preset.label}</span>
                  <span className="ct-preset-hint">{preset.hint}</span>
                  <span className="ct-preset-tag">{preset.aspectRatio === '16:9' ? '16:9 · 2K / 4K' : '原比例 · 2K / 4K'}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="ct-section">
            <div className="ct-label"><span>输出分辨率</span></div>
            <div className="ct-segment">
              {['2k', '4k'].map((value) => (
                <button
                  key={value}
                  type="button"
                  className="ct-segment-item"
                  data-active={settings.preset.resolution === value}
                  onClick={() => updateCurrent({ resolution: value })}
                >
                  {value.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="ct-section">
          <div className="ct-label"><span>机位方向</span></div>
          <div className="ct-camera-grid">
            {cameraPresets.map((camera) => {
              const active = current.yaw === camera.yaw && current.pitch === camera.pitch;
              return (
                <button
                  key={camera.id}
                  type="button"
                  className="ct-camera"
                  data-active={active}
                  onClick={() => updateCurrent({ yaw: camera.yaw, pitch: camera.pitch })}
                >
                  <span className="ct-camera-dot" />
                  {camera.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="ct-section">
          <div className="ct-label"><span>水平旋转</span><span className="ct-value">{current.yaw}°</span></div>
          <div className="ct-slider-row">
            <input
              type="range"
              min={-180}
              max={180}
              step={5}
              value={current.yaw}
              aria-label="水平旋转角度"
              onChange={(event) => updateCurrent({ yaw: Number(event.target.value) })}
            />
          </div>
        </div>

        <div className="ct-section">
          <div className="ct-label"><span>垂直俯仰</span><span className="ct-value">{current.pitch}°</span></div>
          <div className="ct-slider-row">
            <input
              type="range"
              min={-60}
              max={60}
              step={5}
              value={current.pitch}
              aria-label="垂直俯仰角度"
              onChange={(event) => updateCurrent({ pitch: Number(event.target.value) })}
            />
          </div>
        </div>

        <div className="ct-section">
          <div className="ct-label"><span>拍摄距离</span></div>
          <div className="ct-segment">
            {distanceOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className="ct-segment-item"
                data-active={Number(current.distance) === Number(option.value)}
                onClick={() => updateCurrent({ distance: Number(option.value) })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {renderRatioChips()}
      </>
    );
  }

  const toolTab = TOOL_TABS.find((item) => item.id === toolId) || TOOL_TABS[0];
  const panelTitle = toolId === 'preset' ? '三视图 / 预设' : toolTab.label;
  const panelHint = toolMeta?.hint || {
    outpaint: '扩展画幅并补全场景',
    upscale: '提升分辨率并补全细节',
    cutout: '自动识别主体并移除背景',
    preset: '场景俯视图、连续分镜与三视图',
    view_control: '调整摄像机方位重绘同一画面',
  }[toolId];

  return (
    <div className="ct-root">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        onChange={handleFileInput}
      />

      <StudioHeader locale="zh" initialUser={user} />

      <div className="ct-shell">
        <main
          className="ct-stage"
          onDragOver={(event) => {
            if (!user) return;
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <div className="ct-stage-glow" />

          {!user ? (
            <div className="ct-login-card">
              <span className="ct-dropzone-icon"><CameraIcon size={24} /></span>
              <h2>登录后使用画布工具</h2>
              <p>扩图、智能超清、抠图、三视图与多角度，全部由 Seedream 图生图承接。登录后按次消耗站点积分。</p>
              <Link className="ct-login" href={`/zh/login?redirect=${encodeURIComponent('/zh/canvas-tools')}`}>
                登录 / 注册
              </Link>
            </div>
          ) : null}

          {user && !source ? (
            <div
              className="ct-dropzone"
              data-active={dragging}
              role="button"
              tabIndex={0}
              onClick={openFilePicker}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openFilePicker();
                }
              }}
            >
              <span className="ct-dropzone-icon"><UploadIcon size={24} /></span>
              <span className="ct-dropzone-title">{uploading ? '上传中…' : '拖拽或点击上传图片'}</span>
              <span className="ct-dropzone-sub">支持 JPG / PNG / WebP / GIF，最大 30MB<br />上传后即可使用扩图、超清、抠图、三视图与多角度</span>
              <button type="button" className="ct-upload-btn" disabled={uploading} onClick={(event) => {
                event.stopPropagation();
                openFilePicker();
              }}>
                {uploading ? '上传中…' : '选择图片'}
              </button>
            </div>
          ) : null}

          {user && source && result ? (
            <>
              <span className="ct-result-badge"><span className="ct-dot" />生成结果</span>
              <div className="ct-result-actions">
                <button type="button" className="ct-action" onClick={handleDownload}>
                  <DownloadIcon size={14} />下载
                </button>
                <button type="button" className="ct-action" onClick={handleUseAsInput} disabled={generating}>
                  <ImageIcon size={14} />用作输入
                </button>
                <button type="button" className="ct-action ct-action-primary" onClick={handleGenerate} disabled={generating}>
                  <RefreshIcon size={14} />重新生成
                </button>
              </div>
              <div className="ct-canvas">
                <img className="ct-image" src={result.url} alt="生成结果" />
              </div>
            </>
          ) : null}

          {user && source && !result ? (
            <div className="ct-canvas">
              {toolId === 'outpaint' ? (
                <div
                  className="ct-outpaint-frame"
                  style={{
                    '--ct-ar': frameAspect,
                    aspectRatio: `${frameAspect}`,
                    width: `min(100%, 1080px, calc((100dvh - 200px) * ${frameAspect}))`,
                  }}
                >
                  <img className="ct-image" src={source.url} alt="源图片" />
                  <span className="ct-frame-tag">{displayScale} · {current.ratio === 'original' ? '原比例' : current.ratio}</span>
                  <span className="ct-handle ct-handle-tl" />
                  <span className="ct-handle ct-handle-tr" />
                  <span className="ct-handle ct-handle-bl" />
                  <span className="ct-handle ct-handle-br" />
                </div>
              ) : (
                <img className="ct-image" src={source.url} alt="源图片" />
              )}
            </div>
          ) : null}

          {user && source ? (
            <nav className="ct-toolbar" aria-label="画布工具">
              {TOOL_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className="ct-tool-tab"
                    data-active={toolId === tab.id}
                    disabled={generating}
                    onClick={() => selectTool(tab.id)}
                  >
                    <Icon size={15} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          ) : null}

          {generating ? (
            <div className="ct-generating">
              <span className="ct-generating-spinner" />
              <span className="ct-generating-title">正在生成，请稍候</span>
              <span className="ct-generating-sub">{progress || 'Seedream 图生图处理中…'}</span>
            </div>
          ) : null}

          {error ? (
            <div className="ct-error" role="alert">
              <span>{error}</span>
              <button type="button" aria-label="关闭提示" onClick={() => setError('')}>
                <CloseIcon size={14} />
              </button>
            </div>
          ) : null}
        </main>

        {user ? (
          <aside className="ct-panel">
            <div className="ct-panel-head">
              <div>
                <h1 className="ct-panel-title">{panelTitle}</h1>
                <p className="ct-panel-hint">{panelHint}</p>
              </div>
              <button type="button" className="ct-ghost-btn" onClick={openFilePicker} disabled={uploading}>
                <UploadIcon size={14} />{source ? '更换图片' : '上传图片'}
              </button>
            </div>

            {specError ? (
              <div className="ct-spec-error">
                <span>{specError}</span>
                <button type="button" className="ct-ghost-btn" onClick={() => setSpecVersion((prev) => prev + 1)}>
                  重试
                </button>
              </div>
            ) : null}

            {source ? (
              <div className="ct-source-chip">
                <span className="ct-source-thumb"><img src={source.url} alt="" /></span>
                <span className="ct-source-meta">
                  <span className="ct-source-name">{source.name}</span>
                  <span className="ct-source-dims">
                    {source.width && source.height ? `${source.width} × ${source.height}` : '图片已就绪'} · {toolId === 'upscale' ? `${settings.upscale.resolution.toUpperCase()} 输出` : '2K 输出'}
                  </span>
                </span>
              </div>
            ) : null}

            {renderPanelBody()}

            <div className="ct-model-line">
              {spec ? (
                <span>上游模型：{spec.model?.name || spec.model?.id} · 每次生成 1 张</span>
              ) : specError ? (
                <span>模型信息加载失败</span>
              ) : (
                <span>正在准备模型…</span>
              )}
            </div>

            <div className="ct-panel-foot">
              <span className="ct-price" title="按站点实时报价结算">
                <BoltIcon size={14} />
                {quote.status === 'ready' ? (
                  <><strong>{quote.credits}</strong><span>积分</span></>
                ) : quote.status === 'loading' ? (
                  <span className="ct-price-sub">计价中…</span>
                ) : basePrice > 0 ? (
                  <><strong>{basePrice}</strong><span>积分{quote.status === 'error' ? '起' : ''}</span></>
                ) : (
                  <span className="ct-price-sub">按实际结算</span>
                )}
              </span>

              {toolId === 'outpaint' ? (
                <button
                  type="button"
                  className="ct-send"
                  aria-label="生成"
                  onClick={handleGenerate}
                  disabled={!source || !spec || generating}
                >
                  {generating ? <span className="ct-spinner" /> : <ArrowUpIcon size={18} />}
                </button>
              ) : (
                <button
                  type="button"
                  className="ct-generate"
                  onClick={handleGenerate}
                  disabled={!source || !spec || generating}
                >
                  {generating ? <><span className="ct-spinner" />生成中</> : '生成'}
                </button>
              )}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

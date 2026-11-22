import { AudioLines, Box, Clapperboard, FileText, Image as ImageIcon, Layers, UserRound } from 'lucide-react';
import enCopy from '@/messages/en/assetLibraryV2.json';

export const ASSET_GRID_DENSITY_KEY = 'supdance:asset-grid-density';

export const ASSET_CATEGORY_VALUES = ['character', 'environment', 'prop', 'material', 'other'];

export const ASSET_KIND_ICONS = {
  text: FileText,
  image: ImageIcon,
  video: Clapperboard,
  audio: AudioLines,
  model: Box,
  entity: UserRound,
  canvas: Layers,
};

export function getAssetKindOptions(copy = enCopy) {
  return ['all', 'canvas', 'text', 'image', 'video', 'audio', 'model', 'entity']
    .map((value) => ({ value, label: copy.kindLabels[value] }));
}

export function getAssetCategoryOptions(copy = enCopy) {
  return [
    { label: copy.categoryAll, value: 'all' },
    ...ASSET_CATEGORY_VALUES.map((value) => ({ value, label: copy.categoryLabels[value] })),
  ];
}

export function normalizeAssetCategory(value) {
  return typeof value === 'string' && ASSET_CATEGORY_VALUES.includes(value) ? value : 'other';
}

export function assetCategoryLabel(value, copy = enCopy) {
  return copy.categoryLabels[normalizeAssetCategory(value)];
}

export function assetKindLabel(kind, category, copy = enCopy) {
  if (kind === 'entity' && (category === 'environment' || category === 'prop')) {
    return copy.entitySceneKind.replace('{category}', assetCategoryLabel(category, copy));
  }
  if (kind === 'entity') return copy.categoryLabels.character;
  return copy.kindLabels[kind] || copy.kindLabels.text;
}

export function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? Math.round(size) : size.toFixed(1)} ${units[unit]}`;
}

export function assetSummary(asset, copy = enCopy) {
  if (asset.kind === 'entity') {
    const definition = asset.data?.definition || {};
    if (asset.category === 'environment' || asset.category === 'prop') {
      return String(definition.description || copy.pendingImage);
    }
    const role = typeof definition.role === 'string' ? definition.role.trim() : '';
    const appearance = typeof definition.appearance === 'string' ? definition.appearance.trim() : '';
    return [role || appearance, copy.characterAsset].filter(Boolean).join(' · ');
  }
  if (asset.kind === 'canvas') return fillCopyVersion(copy.canvasProjectSummary, asset.data?.version);
  if (asset.kind === 'text') return asset.data?.content || copy.blankText;
  if (asset.kind === 'audio') {
    return `${formatAssetDuration(asset.data?.durationMs, copy)} · ${formatBytes(asset.data?.bytes)} · ${asset.data?.mimeType || copy.audioFallback}`;
  }
  if (asset.kind === 'model') {
    return `${asset.data?.fileName || copy.modelFile} · ${formatBytes(asset.data?.bytes)} · ${asset.data?.mimeType || copy.modelFallback}`;
  }
  return `${assetSizeLabel(asset.data?.width, asset.data?.height, copy)} · ${formatBytes(asset.data?.bytes)} · ${asset.data?.mimeType || copy.imageFallback}`;
}

function fillCopyVersion(template, version) {
  return String(template || '').replace('{version}', String(Number(version) || 1));
}

export function assetSizeLabel(width, height, copy = enCopy) {
  return width > 0 && height > 0 ? `${width}x${height}` : copy.unknown;
}

export function assetProjectLabel(asset, copy = enCopy) {
  const projectName = asset.metadata?.projectName;
  if (typeof projectName === 'string' && projectName.trim()) return projectName;
  return Array.isArray(asset.metadata?.projectIds) && asset.metadata.projectIds.length ? copy.linkedProject : copy.unlinkedProject;
}

export function assetDownloadLabel(asset, copy = enCopy) {
  if (asset.kind === 'video') return copy.downloadVideo;
  if (asset.kind === 'audio') return copy.downloadAudio;
  if (asset.kind === 'model') return copy.downloadModel;
  return copy.downloadImage;
}

export function assetMediaThumbnail(asset) {
  if (!asset) return '';
  if (asset.kind === 'canvas') return asset.coverUrl || '';
  if (asset.kind === 'text' || asset.kind === 'entity' || asset.kind === 'model') return '';
  return asset.coverUrl || asset.data?.thumbnailUrl || asset.data?.previewUrl || asset.data?.url || '';
}

const VIDEO_SOURCE_RE = /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i;

// 旧数据存在 asset_type=image 但文件是 mp4 的情况，按真实媒体类型渲染，避免 img 永远停在加载中。
export function assetMediaIsVideo(asset) {
  if (!asset) return false;
  if (asset.kind === 'video') return true;
  const mimeType = String(asset.data?.mimeType || '');
  if (mimeType.startsWith('video/')) return true;
  return VIDEO_SOURCE_RE.test(String(asset.data?.url || asset.coverUrl || ''));
}

export function formatAssetDuration(durationMs, copy = enCopy) {
  if (!durationMs) return copy.durationUnknown;
  return copy.durationSeconds.replace('{value}', String(Math.round(durationMs / 100) / 10));
}

export function formatAssetClock(durationMs) {
  if (!durationMs || durationMs < 1000) return null;
  const total = Math.round(durationMs / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function formatAssetTime(value, copy = enCopy) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString(copy.dateLocale, { month: '2-digit', day: '2-digit' });
}

export function formatAssetDateTime(value, copy = enCopy) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString(copy.dateLocale, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function assetCountMap(options, remote) {
  const result = new Map();
  options.forEach((option) => {
    if (remote) {
      result.set(option.value, option.value === 'all'
        ? options.reduce((sum, item) => (item.value === 'all' ? sum : sum + (remote[item.value] || 0)), 0)
        : remote[option.value] || 0);
    } else {
      result.set(option.value, 0);
    }
  });
  return result;
}

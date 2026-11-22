'use client';

import { unzipSync } from 'fflate';
import enCopy from '@/messages/en/assetLibraryV2.json';
import { fillCopy } from './asset-library-i18n';

export const ASSET_PACKAGE_APP = 'supdance';
export const ASSET_PACKAGE_VERSION = 1;
const MAX_PACKAGE_BYTES = 512 * 1024 * 1024;
const MAX_PACKAGE_ASSETS = 500;
const LIBRARY_KINDS = new Set(['text', 'image', 'video', 'audio', 'model', 'entity']);
const LIBRARY_CATEGORIES = new Set(['character', 'environment', 'prop', 'material', 'other']);

const MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/aac': 'aac',
  'audio/mp4': 'm4a',
  'audio/flac': 'flac',
  'audio/ogg': 'ogg',
  'model/gltf-binary': 'glb',
  'model/gltf+json': 'gltf',
};

export function packageExtensionForMime(mimeType) {
  return MIME_EXTENSIONS[String(mimeType || '').toLowerCase()] || '';
}

export function safePackageFileName(value, fallback = 'asset') {
  const name = String(value || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
  return name || fallback;
}

export async function beginAssetExport({ ids = [], copy = enCopy } = {}) {
  const params = new URLSearchParams();
  const selected = (ids || []).filter(Boolean);
  if (selected.length) params.set('ids', selected.join(','));
  const query = params.toString();
  const url = `/api/assets/library/export${query ? `?${query}` : ''}`;
  const response = await fetch(url, { headers: { 'x-asset-export': 'preflight' }, cache: 'no-store' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || copy.exportFailed);
  if (!payload.count) throw new Error(copy.noAssetsToExport);
  const link = document.createElement('a');
  link.href = url;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  return payload.count;
}

function readText(bytes) {
  return new TextDecoder().decode(bytes);
}

export function readAssetPackage(buffer, copy = enCopy) {
  const byteLength = buffer?.byteLength || 0;
  if (!byteLength) throw new Error(copy.packageEmpty);
  if (byteLength > MAX_PACKAGE_BYTES) throw new Error(copy.packageTooLarge);
  let entries;
  try {
    entries = unzipSync(new Uint8Array(buffer));
  } catch {
    throw new Error(copy.packageUnreadable);
  }
  const manifestBytes = entries['assets.json'];
  if (!manifestBytes) throw new Error(copy.packageMissingManifest);
  let manifest;
  try {
    manifest = JSON.parse(readText(manifestBytes));
  } catch {
    throw new Error(copy.packageInvalidManifest);
  }
  if (!manifest || manifest.app !== ASSET_PACKAGE_APP || manifest.version !== ASSET_PACKAGE_VERSION) {
    throw new Error(copy.packageUnsupported);
  }
  if (!Array.isArray(manifest.assets)) throw new Error(copy.packageUnsupported);
  if (manifest.assets.length > MAX_PACKAGE_ASSETS) {
    throw new Error(fillCopy(copy.packageTooMany, { count: MAX_PACKAGE_ASSETS }));
  }

  const fileIndex = new Map();
  for (const raw of Array.isArray(manifest.files) ? manifest.files : []) {
    if (!raw || typeof raw.path !== 'string' || !raw.path || typeof raw.mimeType !== 'string') {
      throw new Error(copy.packageInvalidFileIndex);
    }
    const bytes = entries[raw.path];
    if (!bytes) throw new Error(fillCopy(copy.packageMissingFile, { path: raw.path }));
    if (Number(raw.bytes) > 0 && Number(raw.bytes) !== bytes.byteLength) {
      throw new Error(fillCopy(copy.packageFileSizeMismatch, { path: raw.path }));
    }
    if (!raw.assetId || fileIndex.has(raw.assetId)) continue;
    fileIndex.set(raw.assetId, { path: raw.path, mimeType: raw.mimeType, bytes });
  }

  const assets = manifest.assets.map((raw) => {
    if (!raw || typeof raw.id !== 'string' || !LIBRARY_KINDS.has(raw.kind)) {
      throw new Error(copy.packageInvalidAsset);
    }
    const kind = raw.kind;
    const category = LIBRARY_CATEGORIES.has(raw.category) ? raw.category : 'other';
    if (kind === 'text' && typeof raw.data?.content !== 'string') throw new Error(copy.packageInvalidText);
    if (kind === 'entity' && (!raw.data?.definition || typeof raw.data.definition !== 'object')) {
      throw new Error(copy.packageInvalidEntity);
    }
    if (kind !== 'text' && kind !== 'entity' && !fileIndex.has(raw.id)) {
      throw new Error(fillCopy(copy.packageMissingAssetFile, { title: raw.title || raw.id }));
    }
    return {
      id: raw.id,
      kind,
      category,
      title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 255) : copy.untitledAsset,
      tags: Array.isArray(raw.tags) ? raw.tags.filter((tag) => typeof tag === 'string' && tag.trim()).slice(0, 40) : [],
      source: typeof raw.source === 'string' ? raw.source.slice(0, 255) : '',
      note: typeof raw.note === 'string' ? raw.note.slice(0, 20_000) : '',
      folderName: typeof raw.folderName === 'string' && raw.folderName.trim() ? raw.folderName.trim().slice(0, 40) : null,
      coverUrl: typeof raw.coverUrl === 'string' ? raw.coverUrl : null,
      data: raw.data,
    };
  });

  return {
    assets,
    files: fileIndex,
    skipped: Array.isArray(manifest.skipped) ? manifest.skipped : [],
  };
}

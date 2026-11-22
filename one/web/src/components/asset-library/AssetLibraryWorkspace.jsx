'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { localizeStudioPath } from '@/lib/locales';
import { QueryClient, QueryClientProvider, keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { App as AntApp, Button, ConfigProvider, Dropdown, Input, Modal, Popconfirm } from 'antd';
import antdEnUS from 'antd/locale/en_US';
import antdZhCN from 'antd/locale/zh_CN';
import antdZhTW from 'antd/locale/zh_TW';
import antdJaJP from 'antd/locale/ja_JP';
import antdKoKR from 'antd/locale/ko_KR';
import antdEsES from 'antd/locale/es_ES';
import { AlertTriangle, Download, FileUp, Folder, FolderPlus, Images, Layers, MoreHorizontal, PencilLine, Plus, RotateCcw, Sparkles, Trash2, Upload, User } from 'lucide-react';
import AssetCard from './asset-library-cards';
import AssetEditorModal from './asset-library-editor';
import {
  beginAssetExport,
  packageExtensionForMime,
  readAssetPackage,
  safePackageFileName,
} from './asset-library-transfer';
import {
  ASSET_GRID_DENSITY_KEY,
  assetCountMap,
  getAssetCategoryOptions,
  getAssetKindOptions,
} from './asset-library-format';
import {
  ASSET_GRID_CARD_MIN_WIDTH,
  getAssetGridDensityOptions,
  parseAssetGridDensity,
  readAssetGridDensity,
} from './asset-grid-density';
import {
  AssetDrawer,
  AssetFilterGroup,
  AssetsBatchBar,
  AssetsEmptyState,
  AssetToolbar,
  PaginationBar,
  WorkspaceState,
} from './asset-library-panels';
import AssetStorageUsage from './asset-storage-usage';
import { AssetLibraryCopyProvider, fillCopy, useAssetLibraryCopy } from './asset-library-i18n';
import './asset-library.css';

const ANTD_LOCALES = {
  en: antdEnUS,
  'zh-CN': antdZhCN,
  'zh-TW': antdZhTW,
  'ja-JP': antdJaJP,
  'ko-KR': antdKoKR,
  es: antdEsES,
};

/* AntD 表面映射到 KOYO 暗色语义 token（值与 app/globals.css :root 对齐）。 */
const ANTD_THEME = {
  token: {
    colorPrimary: '#e11d74',
    colorInfo: '#e11d74',
    colorLink: '#f472b6',
    colorSuccess: '#10b981',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorText: '#f3f4f6',
    colorTextSecondary: '#9ca3af',
    colorTextTertiary: '#868b8f',
    colorTextQuaternary: '#4b5563',
    colorBgContainer: '#0d0e12',
    colorBgElevated: '#181a22',
    colorBgLayout: '#070708',
    colorBgMask: 'rgba(3, 4, 5, 0.72)',
    colorBgSpotlight: 'rgba(24, 26, 34, 0.97)',
    colorBorder: 'rgba(255, 255, 255, 0.10)',
    colorBorderSecondary: 'rgba(255, 255, 255, 0.06)',
    colorFill: 'rgba(255, 255, 255, 0.10)',
    colorFillSecondary: 'rgba(255, 255, 255, 0.07)',
    colorFillTertiary: 'rgba(255, 255, 255, 0.04)',
    colorFillQuaternary: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    borderRadiusLG: 16,
    borderRadiusSM: 8,
    borderRadiusXS: 4,
    controlHeight: 38,
    controlHeightSM: 32,
    controlHeightLG: 44,
    fontSize: 14,
    fontSizeSM: 13,
    fontSizeLG: 15,
    boxShadowSecondary:
      '0 12px 32px -10px rgba(0, 0, 0, 0.74), 0 4px 12px -6px rgba(0, 0, 0, 0.48), 0 0 0 1px rgba(255, 255, 255, 0.025)',
    motionDurationFast: '0.12s',
    motionDurationMid: '0.18s',
    motionDurationSlow: '0.24s',
    motionEaseInOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
    motionEaseOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
  components: {
    Button: {
      primaryShadow: 'none',
      defaultShadow: 'none',
      dangerShadow: 'none',
      fontWeight: 500,
    },
    Drawer: {
      colorBgElevated: '#181a22',
      paddingLG: 24,
    },
    Modal: {
      colorBgElevated: '#181a22',
      borderRadiusLG: 20,
      titleFontSize: 18,
    },
    Input: {
      colorBgContainer: '#0f1015',
      borderRadius: 16,
      hoverBorderColor: 'rgba(255, 255, 255, 0.18)',
      activeBorderColor: '#e11d74',
      activeShadow: 'none',
    },
    Select: {
      colorBgContainer: '#0f1015',
      colorBgElevated: '#181a22',
      optionHeight: 32,
      optionFontSize: 14,
      hoverBorderColor: 'rgba(255, 255, 255, 0.18)',
      activeBorderColor: '#e11d74',
      activeOutlineColor: 'rgba(0, 0, 0, 0)',
    },
    Dropdown: {
      colorBgElevated: '#181a22',
      borderRadiusLG: 16,
      paddingBlock: 6,
    },
    Tag: {
      borderRadiusSM: 6,
    },
    Form: {
      labelColor: '#9ca3af',
      labelFontSize: 12,
    },
  },
};

async function fetchJson(url, signal, fallbackMessage = 'Request failed') {
  const response = await fetch(url, { signal, cache: 'no-store' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || fallbackMessage);
  return payload;
}

async function mutateJson(url, { method = 'POST', body } = {}, fallbackMessage = 'Operation failed') {
  const response = await fetch(url, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || fallbackMessage);
  return payload;
}

function buildLibraryParams({ viewMode, kind, category, folderFilter, page, pageSize, search }) {
  const params = new URLSearchParams();
  params.set('status', viewMode === 'trash' ? 'trash' : 'ready');
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  if (kind !== 'all') params.set('kind', kind);
  if (category !== 'all') params.set('category', category);
  if (folderFilter === 'uncategorized') params.set('uncategorized', 'true');
  else if (folderFilter !== 'all') params.set('folderId', folderFilter);
  if (search) params.set('q', search);
  return params;
}

function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function selectAssetIds(current, visibleIds, id, selected, anchorId) {
  const anchor = anchorId ? visibleIds.indexOf(anchorId) : -1;
  const target = visibleIds.indexOf(id);
  const affected = new Set(anchor >= 0 && target >= 0
    ? visibleIds.slice(Math.min(anchor, target), Math.max(anchor, target) + 1)
    : [id]);
  return selected ? [...new Set([...current, ...affected])] : current.filter((value) => !affected.has(value));
}

export default function AssetLibraryWorkspace(props) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }));

  return (
    <ConfigProvider locale={ANTD_LOCALES[props.copy?.locale] || antdEnUS} theme={ANTD_THEME}>
      <QueryClientProvider client={queryClient}>
        <AntApp component={false}>
          <AssetLibraryCopyProvider copy={props.copy}>
            <AssetLibraryWorkspaceInner {...props} />
          </AssetLibraryCopyProvider>
        </AntApp>
      </QueryClientProvider>
    </ConfigProvider>
  );
}

function AssetLibraryWorkspaceInner({ userId, studioHref, sideNav, onLibraryAssets }) {
  const copy = useAssetLibraryCopy();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = AntApp.useApp();
  const [viewMode, setViewMode] = useState('library');
  const [keyword, setKeyword] = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [folderFilter, setFolderFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(40);
  const [gridDensity, setGridDensity] = useState(readAssetGridDensity);
  const [previewAsset, setPreviewAsset] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [editorSaving, setEditorSaving] = useState(false);
  const [batchWorking, setBatchWorking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [archivingAsset, setArchivingAsset] = useState(null);
  const [deletingAsset, setDeletingAsset] = useState(null);
  const [batchArchiveOpen, setBatchArchiveOpen] = useState(false);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [folderEditor, setFolderEditor] = useState(null);
  const [folderName, setFolderName] = useState('');
  const [folderSaving, setFolderSaving] = useState(false);
  const selectionAnchor = useRef(undefined);
  const imageInputRef = useRef(null);
  const modelInputRef = useRef(null);
  const packageInputRef = useRef(null);
  const debouncedKeyword = useDebouncedValue(keyword.trim(), 250);

  const libraryQuery = useQuery({
    queryKey: ['asset-library-v2', userId, viewMode, kindFilter, categoryFilter, folderFilter, page, pageSize, debouncedKeyword],
    queryFn: ({ signal }) => fetchJson(`/api/assets/library?${buildLibraryParams({
      viewMode,
      kind: kindFilter,
      category: categoryFilter,
      folderFilter,
      page,
      pageSize,
      search: debouncedKeyword,
    })}`, signal, copy.requestFailed),
    enabled: Boolean(userId),
    placeholderData: keepPreviousData,
  });

  const trashCountQuery = useQuery({
    queryKey: ['asset-library-v2-trash-count', userId],
    queryFn: ({ signal }) => fetchJson('/api/assets/library?status=trash&page=1&pageSize=1', signal, copy.requestFailed),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  const usageQuery = useQuery({
    queryKey: ['asset-library-v2-usage', userId],
    queryFn: ({ signal }) => fetchJson('/api/assets/library/usage', signal, copy.requestFailed),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  const foldersQuery = useQuery({
    queryKey: ['asset-library-v2-folders', userId],
    queryFn: ({ signal }) => fetchJson('/api/assets/folders', signal, copy.requestFailed),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  const data = libraryQuery.data;
  const assets = data?.assets || [];
  const total = data?.total ?? 0;
  const folders = foldersQuery.data?.folders || [];
  const folderCounts = data?.folderCounts || {};
  const trashTotal = trashCountQuery.data?.total ?? 0;
  const folderTotal = useMemo(
    () => Object.values(folderCounts).reduce((sum, count) => sum + Number(count || 0), 0),
    [folderCounts],
  );

  const kindOptions = useMemo(() => getAssetKindOptions(copy), [copy]);
  const categoryOptions = useMemo(() => getAssetCategoryOptions(copy), [copy]);
  const densityOptions = useMemo(() => getAssetGridDensityOptions(copy), [copy]);
  const kindCounts = useMemo(() => assetCountMap(kindOptions, data?.kindCounts), [data?.kindCounts, kindOptions]);
  const categoryCounts = useMemo(() => assetCountMap(categoryOptions, data?.categoryCounts), [data?.categoryCounts, categoryOptions]);
  const visibleIds = useMemo(() => assets.map((asset) => asset.id), [assets]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const isSelecting = selectionMode || selectedIds.length > 0;
  const folderSelectOptions = useMemo(
    () => [{ label: copy.uncategorized, value: '' }, ...folders.map((folder) => ({ label: folder.name, value: folder.id }))],
    [copy.uncategorized, folders],
  );

  useEffect(() => {
    window.localStorage.setItem(ASSET_GRID_DENSITY_KEY, String(gridDensity));
  }, [gridDensity]);

  useEffect(() => {
    if (onLibraryAssets && data?.assets) onLibraryAssets(data.assets);
  }, [data?.assets, onLibraryAssets]);

  useEffect(() => {
    setPage(1);
  }, [debouncedKeyword]);

  useEffect(() => {
    setSelectedIds([]);
    setSelectionMode(false);
    selectionAnchor.current = undefined;
  }, [userId, viewMode, debouncedKeyword, kindFilter, categoryFilter, folderFilter]);

  const refreshLibrary = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['asset-library-v2'] }),
      queryClient.invalidateQueries({ queryKey: ['asset-library-v2-trash-count'] }),
      queryClient.invalidateQueries({ queryKey: ['asset-library-v2-usage'] }),
      queryClient.invalidateQueries({ queryKey: ['asset-library-v2-folders'] }),
    ]);
  };

  const resetFilters = () => {
    setKeyword('');
    setKindFilter('all');
    setCategoryFilter('all');
    setFolderFilter('all');
    setPage(1);
  };

  const switchKind = (value) => {
    setViewMode('library');
    setKindFilter(value);
    setPage(1);
  };

  const switchCategory = (value) => {
    setViewMode('library');
    setCategoryFilter(value);
    setPage(1);
  };

  const switchFolder = (value) => {
    setViewMode('library');
    setFolderFilter(value);
    setPage(1);
  };

  const toggleTrash = () => {
    setViewMode((current) => (current === 'trash' ? 'library' : 'trash'));
    setKindFilter('all');
    setCategoryFilter('all');
    setFolderFilter('all');
    setPage(1);
  };

  const openSession = (sess) => {
    const params = new URLSearchParams();
    params.set('tab', sess.tab);
    if (sess.prompt) params.set('prompt', sess.prompt);
    if (sess.model) params.set('model', sess.model);
    router.push(`${studioHref}?${params.toString()}`);
  };

  const openAsset = (asset) => {
    if (asset?.kind === 'canvas') {
      const target = asset.data?.url || (asset.data?.projectId ? `/canvas/${asset.data.projectId}` : null);
      if (target) {
        window.open(localizeStudioPath(target, copy.locale), '_blank', 'noopener');
        return;
      }
    }
    setPreviewAsset(asset);
  };

  const selectAsset = (id, selected, range = false) => {
    if (batchWorking || libraryQuery.isFetching) return;
    const anchorId = range ? selectionAnchor.current : undefined;
    setSelectionMode(true);
    setSelectedIds((current) => selectAssetIds(current, visibleIds, id, selected, anchorId));
    selectionAnchor.current = id;
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setSelectionMode(false);
    selectionAnchor.current = undefined;
  };

  const copyAssetText = async (asset) => {
    try {
      await navigator.clipboard.writeText(asset.data?.content || '');
      message.success(copy.textCopied);
    } catch {
      message.error(copy.copyFailedManual);
    }
  };

  const downloadAsset = (asset) => {
    if (!asset || asset.kind === 'text' || asset.kind === 'entity' || asset.kind === 'canvas') return;
    const link = document.createElement('a');
    link.href = `/api/assets/${encodeURIComponent(asset.id)}/download`;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const defaultCategory = categoryFilter !== 'all' ? categoryFilter : 'other';
  const defaultFolderId = folderFilter !== 'all' && folderFilter !== 'uncategorized' ? folderFilter : '';

  const openCreate = () => {
    setEditingAsset(null);
    setEditorOpen(true);
  };

  const openEdit = (asset) => {
    setEditingAsset(asset);
    setEditorOpen(true);
  };

  const saveAsset = async (payload) => {
    setEditorSaving(true);
    try {
      if (editingAsset) {
        await mutateJson(`/api/assets/library/${encodeURIComponent(editingAsset.id)}`, { method: 'PATCH', body: payload }, copy.operationFailed);
      } else {
        await mutateJson('/api/assets/library', { method: 'POST', body: payload }, copy.operationFailed);
      }
      message.success(editingAsset ? copy.assetUpdated : copy.assetSaved);
      setEditorOpen(false);
      setEditingAsset(null);
      setPreviewAsset(null);
      await refreshLibrary();
    } catch (error) {
      message.error(error.message);
    } finally {
      setEditorSaving(false);
    }
  };

  const changeStatus = async (ids, status) => {
    if (!ids.length || batchWorking) return;
    setBatchWorking(true);
    try {
      await mutateJson('/api/assets/library/batch', {
        body: { action: status === 'trash' ? 'trash' : 'restore', assetIds: ids },
      }, copy.operationFailed);
      message.success(fillCopy(status === 'trash' ? copy.movedToTrashToast : copy.restoredToast, { count: ids.length }));
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      setArchivingAsset(null);
      setBatchArchiveOpen(false);
      await refreshLibrary();
    } catch (error) {
      message.error(error.message);
    } finally {
      setBatchWorking(false);
    }
  };

  const purgeAssets = async (ids) => {
    if (!ids.length || batchWorking) return;
    setBatchWorking(true);
    try {
      if (ids.length === 1) {
        await mutateJson(`/api/assets/library/${encodeURIComponent(ids[0])}?purge=true`, { method: 'DELETE' }, copy.operationFailed);
      } else {
        await mutateJson('/api/assets/library/batch', { body: { action: 'purge', assetIds: ids } }, copy.operationFailed);
      }
      message.success(fillCopy(copy.purgedToast, { count: ids.length }));
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      setDeletingAsset(null);
      setBatchDeleteOpen(false);
      await refreshLibrary();
    } catch (error) {
      message.error(error.message);
    } finally {
      setBatchWorking(false);
    }
  };

  const emptyTrash = async () => {
    setBatchWorking(true);
    try {
      const result = await mutateJson('/api/assets/library/batch', { body: { action: 'empty' } }, copy.operationFailed);
      message.success(fillCopy(copy.trashEmptiedToast, { count: result.count || 0 }));
      clearSelection();
      await refreshLibrary();
    } catch (error) {
      message.error(error.message);
    } finally {
      setBatchWorking(false);
    }
  };

  const moveAssets = async (ids, targetFolderId) => {
    if (!ids.length) return;
    try {
      await mutateJson('/api/assets/library/batch', {
        body: { action: 'move', assetIds: ids, targetFolderId: targetFolderId || null },
      }, copy.operationFailed);
      message.success(fillCopy(copy.movedToast, { count: ids.length }));
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      await refreshLibrary();
    } catch (error) {
      message.error(error.message);
    }
  };

  const saveFolder = async () => {
    const name = folderName.trim();
    if (!name || !folderEditor) return;
    setFolderSaving(true);
    try {
      if (folderEditor === 'new') {
        await mutateJson('/api/assets/folders', { body: { name } }, copy.operationFailed);
      } else {
        await mutateJson(`/api/assets/folders/${encodeURIComponent(folderEditor.id)}`, { method: 'PATCH', body: { name } }, copy.operationFailed);
      }
      message.success(folderEditor === 'new' ? copy.folderCreated : copy.folderRenamed);
      setFolderEditor(null);
      setFolderName('');
      await refreshLibrary();
    } catch (error) {
      message.error(error.message);
    } finally {
      setFolderSaving(false);
    }
  };

  const removeFolder = async (folder) => {
    try {
      await mutateJson(`/api/assets/folders/${encodeURIComponent(folder.id)}`, { method: 'DELETE' }, copy.operationFailed);
      if (folderFilter === folder.id) setFolderFilter('all');
      message.success(fillCopy(copy.folderDeletedToast, { name: folder.name }));
      await refreshLibrary();
    } catch (error) {
      message.error(error.message);
    }
  };

  const uploadFiles = async (files, kind) => {
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length || uploading) return;
    setUploading(true);
    const key = 'asset-library-upload';
    const failed = [];
    let uploaded = 0;
    try {
      for (let index = 0; index < list.length; index += 1) {
        const file = list[index];
        message.loading({
          content: list.length > 1
            ? fillCopy(copy.uploadProgress, { current: index + 1, total: list.length, name: file.name })
            : (kind === 'model' ? copy.uploadingModel : copy.uploadingImage),
          key,
          duration: 0,
        });
        try {
          const form = new FormData();
          form.append('file', file);
          form.append('kind', kind);
          form.append('type', kind === 'model' ? 'other' : 'image');
          form.append('category', defaultCategory);
          form.append('folderId', defaultFolderId);
          form.append('studioId', 'library');
          form.append('title', file.name.replace(/\.[^.]+$/, '') || file.name);
          form.append('source', copy.sourceManualUpload);
          const response = await fetch('/api/assets/upload', { method: 'POST', body: form });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(payload.code === 'STORAGE_QUOTA_EXCEEDED' ? copy.quotaExceeded : (payload.error || copy.uploadFailed));
          }
          uploaded += 1;
        } catch (error) {
          failed.push({ name: file.name, message: error.message });
        }
      }
      if (uploaded) {
        const kindLabel = kind === 'model' ? copy.kindLabels.model : copy.kindLabels.image;
        message.success({
          content: failed.length
            ? fillCopy(copy.uploadSuccessPartial, { kind: kindLabel, count: uploaded, failed: failed.length })
            : fillCopy(copy.uploadSuccess, { kind: kindLabel, count: uploaded }),
          key,
          duration: 3,
        });
        await refreshLibrary();
      } else {
        message.error({ content: failed[0] ? fillCopy(copy.uploadFailedWith, { message: failed[0].message }) : copy.uploadFailed, key });
      }
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
      if (modelInputRef.current) modelInputRef.current.value = '';
    }
  };

  const exportAssets = async (ids = []) => {
    if (exporting) return;
    setExporting(true);
    try {
      const count = await beginAssetExport({ ids, copy });
      message.success(fillCopy(copy.exportStarted, { count }));
    } catch (error) {
      message.error(error.message);
    } finally {
      setExporting(false);
    }
  };

  const importAssetPackage = async (file) => {
    if (!file || importing) return;
    setImporting(true);
    const key = 'asset-library-import';
    message.loading({ content: copy.parsingPackage, key, duration: 0 });
    try {
      const buffer = await file.arrayBuffer();
      const { assets: incoming, files: packedFiles, skipped } = readAssetPackage(buffer, copy);
      if (!incoming.length) throw new Error(copy.noImportableAssets);

      const folderIdByName = new Map(folders.map((folder) => [folder.name, folder.id]));
      const ensureFolder = async (name) => {
        if (!name) return '';
        const existing = folderIdByName.get(name);
        if (existing) return existing;
        const result = await mutateJson('/api/assets/folders', { body: { name } }, copy.operationFailed);
        const id = result?.folder?.id || '';
        if (id) folderIdByName.set(name, id);
        return id;
      };

      let imported = 0;
      const failed = [];
      for (let index = 0; index < incoming.length; index += 1) {
        const item = incoming[index];
        message.loading({
          content: fillCopy(copy.importProgress, { current: index + 1, total: incoming.length, title: item.title }),
          key,
          duration: 0,
        });
        try {
          const folderId = await ensureFolder(item.folderName);
          if (item.kind === 'text' || item.kind === 'entity') {
            await mutateJson('/api/assets/library', {
              body: {
                kind: item.kind,
                category: item.category,
                title: item.title,
                tags: item.tags,
                source: item.source,
                note: item.note,
                coverUrl: item.kind === 'entity' ? item.coverUrl : null,
                folderId: folderId || null,
                data: item.data,
              },
            }, copy.operationFailed);
          } else {
            const packed = packedFiles.get(item.id);
            if (!packed) throw new Error(copy.missingAssetFile);
            const extension = packageExtensionForMime(packed.mimeType)
              || String(item.data?.fileName || '').split('.').pop()
              || 'bin';
            const mediaFile = new File(
              [packed.bytes],
              `${safePackageFileName(item.title)}.${extension}`,
              { type: packed.mimeType || 'application/octet-stream' },
            );
            const form = new FormData();
            form.append('file', mediaFile);
            form.append('kind', item.kind);
            form.append('type', item.kind === 'model' ? 'other' : item.kind);
            form.append('category', item.category);
            form.append('folderId', folderId);
            form.append('studioId', 'library');
            form.append('title', item.title);
            form.append('source', item.source || copy.sourcePackageImport);
            if (item.note) form.append('note', item.note);
            if (item.tags.length) form.append('tags', item.tags.join(','));
            const response = await fetch('/api/assets/upload', { method: 'POST', body: form });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
              throw new Error(payload.code === 'STORAGE_QUOTA_EXCEEDED' ? copy.quotaExceeded : (payload.error || copy.uploadFailed));
            }
          }
          imported += 1;
        } catch (error) {
          failed.push({ title: item.title, message: error.message });
        }
      }

      if (imported) {
        const partial = failed.length ? fillCopy(copy.importSummaryPartial, { failed: failed.length }) : '';
        const missing = skipped.length ? fillCopy(copy.importSummarySkipped, { skipped: skipped.length }) : '';
        message.success({
          content: `${fillCopy(copy.importSummary, { count: imported, partial })}${missing}`,
          key,
          duration: 4,
        });
      } else {
        message.error({ content: failed[0] ? fillCopy(copy.importFailedWith, { message: failed[0].message }) : copy.importFailed, key });
      }
      await refreshLibrary();
    } catch (error) {
      message.error({ content: error.message, key, duration: 4 });
    } finally {
      setImporting(false);
      if (packageInputRef.current) packageInputRef.current.value = '';
    }
  };

  const isFiltered = Boolean(keyword || kindFilter !== 'all' || categoryFilter !== 'all' || folderFilter !== 'all');
  const isInitialLoading = libraryQuery.isPending;
  const isError = libraryQuery.isError;
  const isEmpty = !isInitialLoading && !isError && total === 0;

  return (
    <div className="asset-library-v2">
      <div className="al-page">
        <header className="app-page-header al-header">
          <div className="al-header-main">
            <div className="al-title-row">
              <h1 className="app-page-header-title">{viewMode === 'trash' ? copy.trashTitle : copy.libraryTitle}</h1>
              <span className="al-header-meta">{isInitialLoading ? '…' : fillCopy(copy.assetCount, { count: total })}</span>
            </div>
            <p className="al-description">
              {viewMode === 'trash' ? copy.trashDescription : copy.libraryDescription}
            </p>
          </div>
          <div className="assets-header-actions">
            <div className="assets-header-action-buttons">
              {viewMode === 'trash' ? (
                <>
                  {trashTotal > 0 ? (
                    <Popconfirm
                      rootClassName="asset-library-overlay-root"
                      title={copy.clearTrashTitle}
                      description={copy.clearTrashDescription}
                      onConfirm={() => { void emptyTrash(); }}
                      okText={copy.clear}
                      okButtonProps={{ danger: true }}
                      cancelText={copy.cancel}
                    >
                      <Button danger icon={<Trash2 />} loading={batchWorking}>{copy.clearTrash}</Button>
                    </Popconfirm>
                  ) : null}
                  <Button icon={<RotateCcw />} onClick={() => { setViewMode('library'); setPage(1); clearSelection(); }}>{copy.backToLibrary}</Button>
                </>
              ) : (
                <>
                  <Button type="primary" icon={<Plus />} onClick={openCreate}>{copy.createAsset}</Button>
                  <Button icon={<Images />} loading={uploading} disabled={importing} onClick={() => imageInputRef.current?.click()}>{copy.uploadImage}</Button>
                  <Dropdown
                    rootClassName="asset-library-overlay-root"
                    trigger={['click']}
                    menu={{
                      items: [
                        { key: 'model', icon: <Upload />, label: copy.uploadModel, onClick: () => modelInputRef.current?.click() },
                        { type: 'divider' },
                        { key: 'import', icon: <FileUp />, label: importing ? copy.importing : copy.importPackage, disabled: importing || exporting, onClick: () => packageInputRef.current?.click() },
                        { key: 'export', icon: <Download />, label: exporting ? copy.preparingExport : copy.exportAll, disabled: exporting || importing, onClick: () => { void exportAssets(); } },
                      ],
                    }}
                  >
                    <Button type="text" aria-label={copy.moreAssetActions} icon={<MoreHorizontal />} />
                  </Dropdown>
                </>
              )}
            </div>
            <AssetStorageUsage
              usage={usageQuery.data}
              isPending={usageQuery.isPending}
              isError={usageQuery.isError}
              onRetry={() => usageQuery.refetch()}
            />
          </div>
        </header>

        <AssetToolbar
          keyword={keyword}
          onKeywordChange={setKeyword}
          density={gridDensity}
          onDensityChange={(value) => setGridDensity(parseAssetGridDensity(value))}
          densityOptions={densityOptions}
          onReset={resetFilters}
          isFiltered={isFiltered}
          selectionMode={isSelecting}
          onToggleSelection={() => (isSelecting ? clearSelection() : setSelectionMode(true))}
          selectionDisabled={batchWorking || isInitialLoading || isEmpty}
        />

        <div className="collection-content assets-collection-content">
          <div className="assets-collection-layout">
            <aside className="assets-collection-filters" aria-label={copy.filtersAria}>
              <div className="assets-collection-filter-scroll">
                {sideNav ? (
                  <section className="collection-filter-group assets-nav-group">
                    <div className="collection-filter-options">
                      <Link href={sideNav.studioHref} className="assets-filter-item" title={sideNav.labels.navStudio}>
                        <span className="assets-filter-item-label"><Sparkles />{sideNav.labels.navStudio}</span>
                      </Link>
                      <span className="assets-filter-item is-active" aria-current="page" title={sideNav.labels.navAssets}>
                        <span className="assets-filter-item-label"><Folder />{sideNav.labels.navAssets}</span>
                      </span>
                      <Link href={sideNav.subjectsHref} className="assets-filter-item" title={sideNav.labels.navSubjects}>
                        <span className="assets-filter-item-label"><User />{sideNav.labels.navSubjects}</span>
                      </Link>
                    </div>
                  </section>
                ) : null}
                <AssetFilterGroup
                  title={copy.filterType}
                  options={kindOptions}
                  value={viewMode === 'library' ? kindFilter : ''}
                  counts={kindCounts}
                  onChange={switchKind}
                />
                <AssetFilterGroup
                  title={copy.filterCategory}
                  options={categoryOptions}
                  value={viewMode === 'library' ? categoryFilter : ''}
                  counts={categoryCounts}
                  onChange={switchCategory}
                />
                <section className="collection-filter-group assets-folder-filter">
                  <div className="collection-folder-heading">
                    <span className="collection-filter-label">{copy.myCategories}</span>
                    <button
                      type="button"
                      className="assets-folder-add"
                      title={copy.newCategory}
                      aria-label={copy.newCategory}
                      onClick={() => { setFolderName(''); setFolderEditor('new'); }}
                    >
                      <FolderPlus />
                    </button>
                  </div>
                  <div className="collection-folder-list">
                    <button type="button" aria-pressed={folderFilter === 'all'} className={`assets-filter-item${folderFilter === 'all' ? ' is-active' : ''}`} onClick={() => switchFolder('all')}>
                      <span className="assets-filter-item-label"><Folder />{copy.kindLabels.all}</span>
                      <span className="assets-filter-count">{folderTotal}</span>
                    </button>
                    <button type="button" aria-pressed={folderFilter === 'uncategorized'} className={`assets-filter-item${folderFilter === 'uncategorized' ? ' is-active' : ''}`} onClick={() => switchFolder('uncategorized')}>
                      <span className="assets-filter-item-label">{copy.uncategorized}</span>
                      <span className="assets-filter-count">{folderCounts.uncategorized || 0}</span>
                    </button>
                    {folders.map((folder) => (
                      <div key={folder.id} className="assets-folder-row">
                        <button type="button" aria-pressed={folderFilter === folder.id} className={`assets-filter-item${folderFilter === folder.id ? ' is-active' : ''}`} onClick={() => switchFolder(folder.id)}>
                          <span className="assets-filter-item-label" title={folder.name}>{folder.name}</span>
                          <span className="assets-filter-count">{folderCounts[folder.id] || 0}</span>
                        </button>
                        <button
                          type="button"
                          className="assets-folder-more"
                          title={fillCopy(copy.renameCategoryAria, { name: folder.name })}
                          aria-label={fillCopy(copy.renameCategoryAria, { name: folder.name })}
                          onClick={() => { setFolderName(folder.name); setFolderEditor(folder); }}
                        >
                          <PencilLine />
                        </button>
                        <Popconfirm
                          rootClassName="asset-library-overlay-root"
                          title={fillCopy(copy.deleteCategoryTitle, { name: folder.name })}
                          description={copy.deleteCategoryDescription}
                          onConfirm={() => removeFolder(folder)}
                          okText={copy.delete}
                          okButtonProps={{ danger: true }}
                          cancelText={copy.cancel}
                        >
                          <button type="button" className="assets-folder-more" title={fillCopy(copy.deleteCategoryAria, { name: folder.name })} aria-label={fillCopy(copy.deleteCategoryAria, { name: folder.name })}>
                            <Trash2 />
                          </button>
                        </Popconfirm>
                      </div>
                    ))}
                  </div>
                </section>
                {sideNav ? (
                  <>
                    <section className="collection-filter-group assets-nav-group">
                      <div className="collection-filter-label">{sideNav.labels.recentChats}</div>
                      <div className="collection-filter-options assets-nav-sessions">
                        {sideNav.sessions.length === 0 ? (
                          <div className="assets-nav-empty">{sideNav.labels.noRecentChats}</div>
                        ) : (
                          sideNav.sessions.map((sess) => (
                            <button
                              key={sess.id}
                              type="button"
                              className="assets-filter-item assets-nav-session"
                              title={sess.fullTitle}
                              onClick={() => openSession(sess)}
                            >
                              <span className="assets-filter-item-label">{sess.title}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </section>
                    <section className="collection-filter-group assets-nav-group">
                      <div className="collection-filter-label">{sideNav.labels.canvases}</div>
                      <div className="collection-filter-options">
                        <Link href={sideNav.canvasHref || `${studioHref}?tab=layers`} className="assets-filter-item" title={sideNav.labels.canvasStudio}>
                          <span className="assets-filter-item-label"><Layers />{sideNav.labels.canvasStudio}</span>
                        </Link>
                      </div>
                    </section>
                  </>
                ) : null}
              </div>
              <div className="collection-trash-entry">
                <button
                  type="button"
                  aria-pressed={viewMode === 'trash'}
                  className={`assets-filter-item${viewMode === 'trash' ? ' is-active is-trash' : ''}`}
                  onClick={toggleTrash}
                >
                  <span className="assets-filter-item-label"><Trash2 />{copy.trash}</span>
                  <span className="assets-filter-count">{trashTotal}</span>
                </button>
              </div>
            </aside>

            <section className="al-content">
              {viewMode === 'trash' ? (
                <div className="al-trash-banner">
                  <AlertTriangle />
                  <span>{copy.trashBanner}</span>
                </div>
              ) : null}

              {isSelecting ? (
                <AssetsBatchBar
                  count={selectedIds.length}
                  isTrash={viewMode === 'trash'}
                  allSelected={allSelected}
                  busy={batchWorking}
                  pageLoading={libraryQuery.isFetching}
                  onSelectAll={() => setSelectedIds((current) => Array.from(new Set([...current, ...visibleIds])))}
                  onClear={clearSelection}
                  onExport={() => { void exportAssets(selectedIds); }}
                  onRestore={() => changeStatus(selectedIds, 'ready')}
                  onArchive={() => setBatchArchiveOpen(true)}
                  onDelete={() => setBatchDeleteOpen(true)}
                />
              ) : null}

              {isError ? (
                <WorkspaceState
                  title={copy.loadFailed}
                  description={libraryQuery.error?.message || copy.checkNetwork}
                  onRetry={() => libraryQuery.refetch()}
                />
              ) : isInitialLoading ? (
                <div className="al-loading" aria-busy="true">{copy.loadingAssets}</div>
              ) : isEmpty ? (
                isFiltered ? (
                  <WorkspaceState title={copy.noMatch} description={copy.noMatchHint} />
                ) : viewMode === 'trash' ? (
                  <WorkspaceState title={copy.trashEmpty} description={copy.trashEmptyHint} />
                ) : (
                  <AssetsEmptyState onNew={openCreate} onGoStudio={() => router.push(studioHref)} />
                )
              ) : assets.length === 0 ? (
                <WorkspaceState title={copy.noMatch} description={copy.noMatchHint} />
              ) : (
                <>
                  <div
                    className="assets-library-grid library-grid al-grid"
                    style={{ '--collection-grid-min-width': `${ASSET_GRID_CARD_MIN_WIDTH[gridDensity]}px` }}
                  >
                    {assets.map((asset) => (
                      <AssetCard
                        key={asset.id}
                        asset={asset}
                        selected={selectedIds.includes(asset.id)}
                        selectionMode={isSelecting}
                        isTrash={viewMode === 'trash'}
                        retentionDays={30}
                        folderOptions={folderSelectOptions}
                        onSelect={(selected, range) => selectAsset(asset.id, selected, range)}
                        onOpen={() => openAsset(asset)}
                        onEdit={() => openEdit(asset)}
                        onCopy={copyAssetText}
                        onDownload={downloadAsset}
                        onRestore={() => changeStatus([asset.id], 'ready')}
                        onArchive={() => setArchivingAsset(asset)}
                        onDelete={() => setDeletingAsset(asset)}
                        onMoveToFolder={(folderId) => moveAssets([asset.id], folderId)}
                      />
                    ))}
                  </div>
                  <PaginationBar
                    current={page}
                    pageSize={pageSize}
                    total={total}
                    onChange={(nextPage, nextPageSize) => {
                      setPage(nextPageSize !== pageSize ? 1 : nextPage);
                      setPageSize(nextPageSize);
                    }}
                  />
                </>
              )}
            </section>
          </div>
        </div>
      </div>

      <AssetDrawer
        asset={previewAsset}
        onClose={() => setPreviewAsset(null)}
        onCopy={copyAssetText}
        onEdit={(asset) => { setPreviewAsset(null); openEdit(asset); }}
        onDownload={downloadAsset}
      />

      <AssetEditorModal
        open={editorOpen}
        asset={editingAsset}
        defaultFolderId={defaultFolderId}
        folders={folders}
        saving={editorSaving}
        onCancel={() => { if (!editorSaving) { setEditorOpen(false); setEditingAsset(null); } }}
        onSave={saveAsset}
      />

      <Modal
        rootClassName="asset-library-overlay-root"
        className="library-modal library-confirm-modal"
        title={folderEditor === 'new' ? copy.newCategoryTitle : copy.renameCategoryTitle}
        open={Boolean(folderEditor)}
        confirmLoading={folderSaving}
        onCancel={() => { if (!folderSaving) setFolderEditor(null); }}
        onOk={() => { void saveFolder(); }}
        okText={copy.save}
        cancelText={copy.cancel}
      >
        <Input
          autoFocus
          value={folderName}
          maxLength={40}
          placeholder={copy.folderNamePlaceholder}
          onChange={(event) => setFolderName(event.target.value)}
          onPressEnter={() => { void saveFolder(); }}
        />
      </Modal>

      <Modal
        rootClassName="asset-library-overlay-root"
        className="library-modal library-confirm-modal"
        title={copy.archiveTitle}
        open={Boolean(archivingAsset)}
        onCancel={() => { if (!batchWorking) setArchivingAsset(null); }}
        onOk={() => { if (archivingAsset) void changeStatus([archivingAsset.id], 'trash'); }}
        confirmLoading={batchWorking}
        cancelButtonProps={{ disabled: batchWorking }}
        okText={copy.archiveTitle}
        cancelText={copy.cancel}
      >
        {fillCopy(copy.archiveConfirm, { title: archivingAsset?.title || '' })}
      </Modal>

      <Modal
        rootClassName="asset-library-overlay-root"
        className="library-modal library-confirm-modal"
        title={copy.archiveBatchTitle}
        open={batchArchiveOpen}
        onCancel={() => { if (!batchWorking) setBatchArchiveOpen(false); }}
        onOk={() => { void changeStatus(selectedIds, 'trash'); }}
        confirmLoading={batchWorking}
        cancelButtonProps={{ disabled: batchWorking }}
        okText={copy.archiveTitle}
        cancelText={copy.cancel}
      >
        {fillCopy(copy.archiveBatchConfirm, { count: selectedIds.length })}
      </Modal>

      <Modal
        rootClassName="asset-library-overlay-root"
        className="library-modal library-confirm-modal"
        title={copy.purgeTitle}
        open={Boolean(deletingAsset)}
        onCancel={() => { if (!batchWorking) setDeletingAsset(null); }}
        onOk={() => { if (deletingAsset) void purgeAssets([deletingAsset.id]); }}
        confirmLoading={batchWorking}
        cancelButtonProps={{ disabled: batchWorking }}
        okText={copy.purge}
        okButtonProps={{ danger: true }}
        cancelText={copy.cancel}
      >
        {fillCopy(copy.purgeConfirm, { title: deletingAsset?.title || '' })}
      </Modal>

      <Modal
        rootClassName="asset-library-overlay-root"
        className="library-modal library-confirm-modal"
        title={copy.purgeBatchTitle}
        open={batchDeleteOpen}
        onCancel={() => { if (!batchWorking) setBatchDeleteOpen(false); }}
        onOk={() => { void purgeAssets(selectedIds); }}
        confirmLoading={batchWorking}
        cancelButtonProps={{ disabled: batchWorking }}
        okText={copy.purge}
        okButtonProps={{ danger: true }}
        cancelText={copy.cancel}
      >
        {fillCopy(copy.purgeBatchConfirm, { count: selectedIds.length })}
      </Modal>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="asset-upload-input"
        onChange={(event) => { void uploadFiles(event.target.files, 'image'); }}
      />
      <input
        ref={modelInputRef}
        type="file"
        accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
        multiple
        className="asset-upload-input"
        onChange={(event) => { void uploadFiles(event.target.files, 'model'); }}
      />
      <input
        ref={packageInputRef}
        type="file"
        accept=".zip,application/zip"
        className="asset-upload-input"
        onChange={(event) => { const [file] = Array.from(event.target.files || []); if (file) void importAssetPackage(file); }}
      />
    </div>
  );
}

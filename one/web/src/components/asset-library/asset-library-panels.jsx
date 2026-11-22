'use client';

import { useRef, useState } from 'react';
import { Button, Drawer, Tag } from 'antd';
import {
  Box,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Copy,
  Download,
  FileText,
  Link2,
  Maximize2,
  PencilLine,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useAssetLibraryCopy, fillCopy } from './asset-library-i18n';
import {
  ASSET_KIND_ICONS,
  assetCategoryLabel,
  assetKindLabel,
  assetMediaIsVideo,
  assetProjectLabel,
  assetSizeLabel,
  formatAssetClock,
  formatAssetDateTime,
  formatBytes,
} from './asset-library-format';

export function AssetFilterGroup({ title, options, value, counts, onChange }) {
  return (
    <div className="collection-filter-group">
      <span className="collection-filter-label">{title}</span>
      <div className="collection-filter-options">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              className={`assets-filter-item${active ? ' is-active' : ''}`}
              onClick={() => onChange(option.value)}
            >
              <span className="assets-filter-item-label">{option.label}</span>
              <span className="assets-filter-count">{counts.get(option.value) || 0}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AssetsBatchBar({
  count,
  isTrash = false,
  allSelected,
  busy = false,
  pageLoading = false,
  onSelectAll,
  onClear,
  onExport,
  onRestore,
  onArchive,
  onDelete,
}) {
  const copy = useAssetLibraryCopy();
  return (
    <div className="assets-batch-bar" role="toolbar" aria-label={copy.batchOperations}>
      <span className="assets-batch-count">
        {copy.selectedPrefix} <strong>{count}</strong> {copy.selectedSuffix}
      </span>
      <div className="assets-batch-actions">
        <Button size="small" icon={<CheckCheck />} disabled={allSelected || busy || pageLoading} onClick={onSelectAll}>{copy.selectAllPage}</Button>
        <Button size="small" disabled={busy} onClick={onClear}>{copy.clearSelection}</Button>
        {isTrash ? (
          <>
            <Button size="small" type="primary" disabled={!count || busy} icon={<RotateCcw />} onClick={onRestore}>{copy.restoreSelected}</Button>
            <Button size="small" danger disabled={!count || busy} icon={<Trash2 />} onClick={onDelete}>{copy.purgeSelected}</Button>
          </>
        ) : (
          <>
            <Button size="small" disabled={!count || busy} icon={<Download />} onClick={onExport}>{copy.exportSelected}</Button>
            <Button size="small" disabled={!count || busy} icon={<Trash2 />} onClick={onArchive}>{copy.archiveTitle}</Button>
          </>
        )}
      </div>
    </div>
  );
}

const CHARACTER_PROFILE_KEYS = [
  'role',
  'appearance',
  'physique',
  'clothing',
  'personality',
  'props',
  'consistencyPrompt',
  'voiceLanguage',
  'voiceAge',
  'voiceTimbre',
];

function CharacterArchive({ asset }) {
  const copy = useAssetLibraryCopy();
  const definition = asset.data?.definition || {};
  const rows = CHARACTER_PROFILE_KEYS
    .map((key) => [copy.characterFields[key], typeof definition[key] === 'string' ? definition[key].trim() : ''])
    .filter(([, value]) => value);
  return (
    <div className="asset-archive-character">
      <UserRoundCover asset={asset} />
      {rows.length ? (
        <dl className="asset-archive-profile">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="asset-archive-muted">{copy.characterEmpty}</p>
      )}
    </div>
  );
}

function UserRoundCover({ asset }) {
  const copy = useAssetLibraryCopy();
  const initial = Array.from(String(asset.title || '').trim())[0] || copy.characterInitial;
  const [broken, setBroken] = useState(false);
  const coverUrl = asset.coverUrl && !broken ? asset.coverUrl : '';
  const aliases = Array.isArray(asset.data?.definition?.aliases)
    ? asset.data.definition.aliases.filter((item) => typeof item === 'string' && item.trim())
    : [];
  const listSeparator = copy.locale === 'zh-CN' || copy.locale === 'zh-TW' ? '、' : ', ';
  return (
    <div className="asset-archive-character-hero">
      {coverUrl ? (
        <>
          <img src={coverUrl} alt="" aria-hidden="true" className="asset-archive-character-blur" onError={() => setBroken(true)} />
          <img src={coverUrl} alt={asset.title} className="asset-archive-character-image" onError={() => setBroken(true)} />
        </>
      ) : (
        <span className="asset-archive-character-initial" aria-hidden="true"><span>{initial}</span></span>
      )}
      <span className="asset-archive-character-fade" aria-hidden="true" />
      <div className="asset-archive-character-caption">
        <span>{copy.characterCaption}{asset.data?.definition?.version ? ` · v${asset.data.definition.version}` : ''}</span>
        {aliases.length ? (
          <p>{fillCopy(copy.alsoKnownAs, { names: aliases.join(listSeparator) })}</p>
        ) : null}
      </div>
    </div>
  );
}

export function AssetDrawer({ asset, onClose, onCopy, onEdit, onDownload }) {
  const copy = useAssetLibraryCopy();
  const facts = asset ? assetArchiveFacts(asset, copy) : [];
  const KindIcon = asset ? (ASSET_KIND_ICONS[asset.kind] || FileText) : Clapperboard;

  return (
    <Drawer rootClassName="asset-library-drawer-root asset-library-overlay-root" className="library-drawer asset-library-drawer" title={copy.assetArchive} open={Boolean(asset)} size={400} onClose={onClose}>
      {asset ? (
        <div className="asset-archive">
          <div className="asset-archive-header">
            <span className="asset-archive-header-icon"><KindIcon /></span>
            <div className="asset-archive-heading">
              <h2 className="asset-archive-title">{asset.title}</h2>
              <p className="asset-archive-subtitle">
                {fillCopy(copy.createdAtText, {
                  category: assetCategoryLabel(asset.category, copy),
                  date: formatAssetDateTime(asset.createdAt, copy),
                })}
              </p>
            </div>
          </div>

          {asset.kind === 'entity' && (asset.category === 'environment' || asset.category === 'prop') ? (
            <div className="asset-archive-preview">
              <div className="asset-archive-preview-note">
                <p>{String(asset.data?.definition?.description || copy.pendingImage)}</p>
                <p>{String(asset.data?.definition?.prompt || '')}</p>
              </div>
            </div>
          ) : asset.kind === 'entity' ? (
            <CharacterArchive asset={asset} />
          ) : (
            <div className="asset-archive-preview">
              {asset.kind === 'text' ? (
                <div className="asset-archive-preview-note">{asset.data?.content}</div>
              ) : asset.kind === 'audio' ? (
                <div className="asset-archive-audio"><audio src={asset.data?.url} controls /></div>
              ) : asset.kind === 'model' ? (
                <div className="asset-archive-preview-model">
                  <Box />
                  <span>{asset.data?.fileName} · {formatBytes(asset.data?.bytes)}</span>
                </div>
              ) : asset.kind === 'video' || assetMediaIsVideo(asset) ? (
                <video src={asset.data?.url} controls className="asset-archive-preview-media" />
              ) : (
                <AssetImageZoom asset={asset} />
              )}
            </div>
          )}

          <div className="asset-archive-tags">
            {(asset.tags || []).map((tag) => <Tag key={tag} className="asset-archive-tag">{tag}</Tag>)}
          </div>

          <div className="asset-archive-facts">
            {facts.map((fact) => (
              <div key={fact.label} className="asset-archive-fact">
                <span className="asset-archive-fact-label">{fact.label}</span>
                <span className="asset-archive-fact-value" title={fact.value}>{fact.value}</span>
              </div>
            ))}
          </div>

          <div className="asset-archive-link">
            <Link2 />
            <span>{copy.belongingProject}</span>
            <strong>{assetProjectLabel(asset, copy)}</strong>
          </div>

          {asset.note ? (
            <div className="asset-archive-section">
              <span className="asset-archive-section-title">{copy.note}</span>
              <p className="asset-archive-section-body">{asset.note}</p>
            </div>
          ) : null}

          <div className="asset-archive-actions">
            {asset.kind === 'text' ? (
              <Button type="primary" icon={<Copy />} onClick={() => onCopy(asset)}>{copy.copyText}</Button>
            ) : asset.kind !== 'entity' && asset.data?.url ? (
              <Button type="primary" icon={<Download />} onClick={() => onDownload?.(asset)}>{copy.downloadSource}</Button>
            ) : null}
            {asset.kind === 'text' || asset.kind === 'entity' ? (
              <Button icon={<PencilLine />} onClick={() => onEdit?.(asset)}>{copy.edit}</Button>
            ) : null}
            {asset.kind !== 'text' && asset.kind !== 'entity' && asset.data?.url ? (
              <Button icon={<Maximize2 />} onClick={() => window.open(asset.data.url, '_blank', 'noopener,noreferrer')}>{copy.openSource}</Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}

export function AssetImageZoom({ asset }) {
  const copy = useAssetLibraryCopy();
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);
  const reset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };
  const src = asset.coverUrl || asset.data?.previewUrl || asset.data?.url;
  return (
    <div
      className="asset-zoom-viewer"
      onWheel={(event) => {
        event.preventDefault();
        setScale((value) => Math.min(4, Math.max(0.25, value * (event.deltaY < 0 ? 1.12 : 0.89))));
      }}
      onPointerDown={(event) => {
        if (scale <= 1) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag) return;
        setOffset({ x: drag.ox + event.clientX - drag.x, y: drag.oy + event.clientY - drag.y });
      }}
      onPointerUp={() => { dragRef.current = null; }}
      onPointerCancel={() => { dragRef.current = null; }}
    >
      <img
        src={src}
        alt={asset.title}
        loading="lazy"
        decoding="async"
        className="asset-archive-preview-media asset-zoom-image"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
      />
      <div className="asset-zoom-controls">
        <button type="button" title={copy.zoomOut} aria-label={copy.zoomOut} onClick={() => setScale((value) => Math.max(0.25, value / 1.25))}><ZoomOut /></button>
        <button type="button" title={copy.fitScale} aria-label={copy.fitScale} onClick={reset}>{Math.round(scale * 100)}%</button>
        <button type="button" title={copy.zoomIn} aria-label={copy.zoomIn} onClick={() => setScale((value) => Math.min(4, value * 1.25))}><ZoomIn /></button>
        <button type="button" title={copy.originalSize} aria-label={copy.originalSize} onClick={() => setScale(1)}><Maximize2 /></button>
      </div>
    </div>
  );
}

export function assetArchiveFacts(asset, copy) {
  const facts = [
    { label: copy.factKind, value: assetKindLabel(asset.kind, asset.category, copy) },
    { label: copy.factCategory, value: assetCategoryLabel(asset.category, copy) },
  ];
  if (asset.kind === 'image' || asset.kind === 'video') {
    facts.push({ label: copy.factDimensions, value: assetSizeLabel(asset.data?.width, asset.data?.height, copy) });
  }
  if (asset.kind === 'video' || asset.kind === 'audio') {
    facts.push({ label: copy.factDuration, value: formatAssetClock(asset.data?.durationMs) || copy.unknown });
  }
  if (asset.kind !== 'text' && asset.kind !== 'entity') {
    facts.push({ label: copy.factSize, value: formatBytes(asset.data?.bytes) });
    facts.push({ label: copy.factFormat, value: asset.data?.mimeType || copy.unknown });
  }
  if (asset.kind !== 'entity' || asset.source) facts.push({ label: copy.factSource, value: asset.source || copy.unattributed });
  facts.push({ label: copy.factCreated, value: formatAssetDateTime(asset.createdAt, copy) });
  facts.push({ label: copy.factUpdated, value: formatAssetDateTime(asset.updatedAt, copy) });
  return facts;
}

export function AssetsEmptyState({ onNew, onGoStudio }) {
  const copy = useAssetLibraryCopy();
  return (
    <div className="assets-empty">
      <div className="assets-empty-banner" aria-hidden="true">
        <figure className="assets-empty-banner-frame is-back" />
        <figure className="assets-empty-banner-frame is-main">
          <span>{copy.emptyCaptionTag}</span>
        </figure>
        <figure className="assets-empty-banner-frame is-front" />
        <span className="assets-empty-banner-caption">
          <span>{copy.emptyCaptionBrand}</span>{copy.emptyCaptionSlogan}
        </span>
      </div>
      <div className="assets-empty-intro">
        <strong>{copy.emptyTitle}</strong>
        <p>{copy.emptyDescription}</p>
        <div className="assets-empty-actions">
          {onNew ? <Button type="primary" icon={<Plus />} onClick={onNew}>{copy.createAsset}</Button> : null}
          <Button icon={<Clapperboard />} onClick={onGoStudio}>{copy.goCreate}</Button>
        </div>
      </div>
    </div>
  );
}

export function WorkspaceState({ title, description, onRetry }) {
  const copy = useAssetLibraryCopy();
  return (
    <div className="assets-state">
      <span className="assets-state-icon"><FileText /></span>
      <strong>{title}</strong>
      <p>{description}</p>
      {onRetry ? <Button icon={<RotateCcw />} onClick={onRetry}>{copy.retry}</Button> : null}
    </div>
  );
}

function pageItems(current, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '…', pages];
  if (current >= pages - 3) return [1, '…', pages - 4, pages - 3, pages - 2, pages - 1, pages];
  return [1, '…', current - 1, current, current + 1, '…', pages];
}

export function PaginationBar({ current, pageSize, total, pageSizeOptions = [40, 80, 120], onChange }) {
  const copy = useAssetLibraryCopy();
  if (total <= pageSize && current === 1) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const end = total === 0 ? 0 : Math.min(total, current * pageSize);
  return (
    <div className="app-pagination-bar">
      <span className="app-pagination-total">
        {total === 0 ? copy.paginationNone : fillCopy(copy.paginationRange, { start, end, total })}
      </span>
      <select className="app-pagination-size" value={pageSize} onChange={(event) => onChange(1, Number(event.target.value))} aria-label={copy.pageSizeAria}>
        {pageSizeOptions.map((size) => <option key={size} value={size}>{fillCopy(copy.pageSizeOption, { size })}</option>)}
      </select>
      <div className="app-pagination-pages" role="navigation" aria-label={copy.paginationAria}>
        <button type="button" className="app-pagination-btn" disabled={current <= 1} aria-label={copy.previousPage} onClick={() => onChange(current - 1, pageSize)}><ChevronLeft /></button>
        {pageItems(current, pages).map((item, index) => item === '…' ? (
          <span key={`ellipsis-${index}`} className="app-pagination-ellipsis">…</span>
        ) : (
          <button key={item} type="button" className={`app-pagination-btn${item === current ? ' is-active' : ''}`} aria-current={item === current ? 'page' : undefined} onClick={() => onChange(item, pageSize)}>{item}</button>
        ))}
        <button type="button" className="app-pagination-btn" disabled={current >= pages} aria-label={copy.nextPage} onClick={() => onChange(current + 1, pageSize)}><ChevronRight /></button>
      </div>
    </div>
  );
}

export function AssetToolbar({
  keyword,
  onKeywordChange,
  density,
  onDensityChange,
  densityOptions,
  onReset,
  isFiltered,
  selectionMode,
  onToggleSelection,
  selectionDisabled,
}) {
  const copy = useAssetLibraryCopy();
  return (
    <section className="collection-toolbar" aria-label={copy.searchAria}>
      <div className="collection-toolbar-controls">
        <label className="al-search">
          <Search aria-hidden="true" />
          <input
            type="search"
            value={keyword}
            placeholder={copy.searchPlaceholder}
            onChange={(event) => onKeywordChange(event.target.value)}
          />
        </label>
        <label className="al-density">
          <span className="sr-only">{copy.densityLabel}</span>
          <select value={density} onChange={(event) => onDensityChange(Number(event.target.value))} aria-label={copy.densityLabel}>
            {densityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>
      <div className="collection-toolbar-actions">
        {isFiltered ? <Button type="text" icon={<RotateCcw />} onClick={onReset}>{copy.reset}</Button> : null}
        <Button aria-pressed={selectionMode} disabled={selectionDisabled} onClick={onToggleSelection}>
          {selectionMode ? copy.exitSelection : copy.batchSelect}
        </Button>
      </div>
    </section>
  );
}

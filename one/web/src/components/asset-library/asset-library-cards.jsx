'use client';

import { useState } from 'react';
import { Dropdown } from 'antd';
import { AlertTriangle, AudioLines, Box, Copy, Download, ExternalLink, FileText, FolderOpen, MoreHorizontal, PencilLine, Play, RotateCcw, Trash2 } from 'lucide-react';
import { useAssetLibraryCopy, fillCopy } from './asset-library-i18n';
import {
  ASSET_KIND_ICONS,
  assetCategoryLabel,
  assetKindLabel,
  assetMediaIsVideo,
  assetMediaThumbnail,
  assetProjectLabel,
  assetSummary,
  formatAssetClock,
  formatAssetTime,
} from './asset-library-format';

function AssetThumbnail({ asset, alt }) {
  const [failed, setFailed] = useState(false);
  const thumbnail = assetMediaThumbnail(asset);
  if (failed || !thumbnail) {
    const KindIcon = ASSET_KIND_ICONS[asset.kind] || FileText;
    return (
      <div className="assets-cover-fallback">
        <KindIcon />
      </div>
    );
  }
  if (assetMediaIsVideo(asset)) {
    const poster = thumbnail !== asset.data?.url ? thumbnail : undefined;
    return (
      <video
        src={asset.data?.url || thumbnail}
        poster={poster}
        muted
        playsInline
        preload="metadata"
        aria-label={alt}
        className="assets-cover-media"
        onError={() => setFailed(true)}
      />
    );
  }
  return <img src={thumbnail} alt={alt} loading="lazy" decoding="async" className="assets-cover-media" onError={() => setFailed(true)} />;
}

export function AssetCover({ asset, selected = false, onSelect, onOpen, menuItems }) {
  const copy = useAssetLibraryCopy();
  const KindIcon = ASSET_KIND_ICONS[asset.kind] || FileText;
  const clock = asset.kind === 'video' || asset.kind === 'audio' ? formatAssetClock(asset.data?.durationMs) : null;
  const showPlay = assetMediaIsVideo(asset);
  const isLight = asset.kind === 'audio' || asset.kind === 'text' || asset.kind === 'model';

  return (
    <div className={`library-card-media assets-cover${isLight ? ' is-light' : ''}`}>
      <button type="button" className="assets-cover-link" onClick={onOpen} aria-label={fillCopy(copy.viewAssetAria, { title: asset.title })}>
        {asset.kind === 'audio' ? (
          <AudioWaveCover asset={asset} />
        ) : asset.kind === 'entity' ? (
          asset.category === 'environment' || asset.category === 'prop' ? (
            <div className="assets-cover-fallback">
              <span>{`${assetCategoryLabel(asset.category, copy)} · ${copy.pendingImage}`}</span>
            </div>
          ) : (
            <CharacterCover asset={asset} />
          )
        ) : asset.kind === 'text' ? (
          <TextCover asset={asset} />
        ) : asset.kind === 'model' ? (
          <ModelCover asset={asset} />
        ) : (
          <AssetThumbnail asset={asset} alt={asset.title} />
        )}
        {showPlay ? (
          <span className="assets-cover-play">
            <Play />
          </span>
        ) : null}
      </button>
      <span className="assets-cover-badges">
        <span className="assets-cover-badge is-kind">
          <KindIcon />
          {assetKindLabel(asset.kind, asset.category, copy)}
        </span>
        {asset.kind === 'entity' || asset.kind === 'canvas' ? null : <span className="assets-cover-badge is-category">{assetCategoryLabel(asset.category, copy)}</span>}
      </span>
      {clock ? <span className="assets-cover-clock">{clock}</span> : null}
      <input
        type="checkbox"
        checked={selected}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => onSelect?.(event.target.checked, event.nativeEvent.shiftKey)}
        className="assets-select-check"
        aria-label={fillCopy(copy.selectAssetAria, { title: asset.title })}
      />
      {menuItems?.length ? (
        <Dropdown rootClassName="asset-library-overlay-root" trigger={['click']} menu={{ items: menuItems }}>
          <button type="button" className="assets-cover-more" aria-label={copy.moreAssetActions} title={copy.moreActions}>
            <MoreHorizontal />
          </button>
        </Dropdown>
      ) : null}
    </div>
  );
}

function CharacterCover({ asset }) {
  const copy = useAssetLibraryCopy();
  const initial = Array.from(String(asset.title || '').trim())[0] || copy.characterInitial;
  const [broken, setBroken] = useState(false);
  const coverUrl = asset.coverUrl && !broken ? asset.coverUrl : '';
  return (
    <div className="assets-cover-character">
      {coverUrl ? (
        <>
          <img src={coverUrl} alt="" aria-hidden="true" className="assets-cover-character-blur" onError={() => setBroken(true)} />
          <img src={coverUrl} alt={asset.title} loading="lazy" decoding="async" className="assets-cover-character-image" onError={() => setBroken(true)} />
        </>
      ) : (
        <span className="assets-cover-character-initial" aria-hidden="true"><span>{initial}</span></span>
      )}
      <span className="assets-cover-character-fade" aria-hidden="true" />
    </div>
  );
}

export function AudioWaveCover({ asset }) {
  return (
    <div className="assets-cover-wave" aria-hidden="true">
      {audioWaveBars(asset.id).map((height, index) => (
        <span key={index} style={{ height: `${height}%` }} />
      ))}
      <AudioLines className="assets-cover-wave-glyph" />
    </div>
  );
}

function TextCover({ asset }) {
  const copy = useAssetLibraryCopy();
  return (
    <div className="assets-cover-text">
      <p>{asset.data?.content || copy.blankText}</p>
    </div>
  );
}

function ModelCover({ asset }) {
  const copy = useAssetLibraryCopy();
  return (
    <div className="assets-cover-model">
      <Box />
      <span>{asset.data?.fileName || copy.modelFallback}</span>
    </div>
  );
}

export function audioWaveBars(seed) {
  let hash = 0;
  for (const char of String(seed || '')) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const bars = [];
  for (let index = 0; index < 26; index += 1) {
    hash = (hash * 9301 + 49297) % 233280;
    const random = hash / 233280;
    const envelope = 0.35 + 0.65 * Math.abs(Math.sin(index * 0.55 + 1.2));
    bars.push(Math.round((0.18 + 0.82 * random * envelope) * 100));
  }
  return bars;
}

export function formatExpirationHint(updatedAt, retentionDays, copy) {
  if (!retentionDays || retentionDays <= 0) return copy.permanentRetention;
  const updatedTime = new Date(updatedAt).getTime();
  if (!Number.isFinite(updatedTime)) return fillCopy(copy.retentionDays, { days: retentionDays });
  const remainingDays = Math.ceil((updatedTime + retentionDays * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000));
  if (remainingDays <= 0) return copy.expiringSoon;
  return fillCopy(copy.expiringIn, { days: remainingDays });
}

export default function AssetCard({
  asset,
  selected = false,
  selectionMode = false,
  isTrash = false,
  retentionDays = 30,
  folderOptions = [],
  onSelect,
  onOpen,
  onEdit,
  onCopy,
  onDownload,
  onRestore,
  onArchive,
  onDelete,
  onMoveToFolder,
}) {
  const copy = useAssetLibraryCopy();
  const menuItems = isTrash
    ? [
        { key: 'restore', icon: <RotateCcw />, label: copy.restoreToLibrary, onClick: onRestore },
        { type: 'divider' },
        { key: 'delete', danger: true, icon: <Trash2 />, label: copy.purge, onClick: onDelete },
      ]
    : asset.kind === 'canvas'
      ? [
          { key: 'open-canvas', icon: <ExternalLink />, label: copy.openCanvas, onClick: () => onOpen?.() },
          {
            key: 'move',
            icon: <FolderOpen />,
            label: copy.moveToCategory,
            children: folderOptions.map((folder) => ({
              key: folder.value || 'uncategorized',
              label: folder.label,
              onClick: () => onMoveToFolder?.(folder.value),
            })),
          },
        ]
      : [
        ...(asset.kind === 'text' || asset.kind === 'entity' ? [{ key: 'edit', icon: <PencilLine />, label: copy.edit, onClick: onEdit }] : []),
        ...(asset.kind === 'text' ? [{ key: 'copy', icon: <Copy />, label: copy.copyText, onClick: () => onCopy?.(asset) }] : []),
        ...(asset.kind === 'image' || asset.kind === 'video' || asset.kind === 'audio' || asset.kind === 'model'
          ? [{ key: 'download', icon: <Download />, label: copy.download, onClick: () => onDownload?.(asset) }]
          : []),
        {
          key: 'move',
          icon: <FolderOpen />,
          label: copy.moveToCategory,
          children: folderOptions.map((folder) => ({
            key: folder.value || 'uncategorized',
            label: folder.label,
            onClick: () => onMoveToFolder?.(folder.value),
          })),
        },
        { type: 'divider' },
        { key: 'archive', icon: <Trash2 />, label: copy.archiveTitle, onClick: onArchive },
      ];

  const handleOpen = (event) => {
    if (selectionMode || event.shiftKey || event.ctrlKey || event.metaKey) {
      onSelect?.(!selected, event.shiftKey);
      return;
    }
    onOpen?.();
  };

  return (
    <article className={`asset-library-card library-card-surface${selected ? ' is-selected' : ''}${selectionMode ? ' is-selecting' : ''}`}>
      <AssetCover asset={asset} selected={selected} onSelect={onSelect} onOpen={handleOpen} menuItems={menuItems} />
      <button type="button" className="asset-collection-body" onClick={handleOpen}>
        <div className="asset-collection-heading">
          <h2 className="asset-collection-title" title={asset.title}>{asset.title}</h2>
          <span className="asset-collection-date">{formatAssetTime(asset.updatedAt || asset.createdAt, copy)}</span>
        </div>
        {isTrash ? (
          <div className="asset-collection-expiry">
            <AlertTriangle />
            <span>{formatExpirationHint(asset.trashedAt || asset.updatedAt, retentionDays, copy)}</span>
          </div>
        ) : (
          <div className="asset-collection-summary" title={assetSummary(asset, copy)}>{assetSummary(asset, copy)}</div>
        )}
        <div className="asset-collection-source">
          <span>{asset.source || copy.unattributedSource}</span>
          <span aria-hidden="true">·</span>
          <span>{assetProjectLabel(asset, copy)}</span>
        </div>
      </button>
    </article>
  );
}

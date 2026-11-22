'use client';

import { HardDrive } from 'lucide-react';
import { useAssetLibraryCopy, fillCopy } from './asset-library-i18n';
import { formatBytes } from './asset-library-format';

export default function AssetStorageUsage({ usage, isPending, isError, onRetry }) {
  const copy = useAssetLibraryCopy();
  const totalBytes = Number(usage?.quotaBytes || 0);
  const usedBytes = Number(usage?.usedBytes || 0);
  const percent = totalBytes > 0 ? Math.min(100, Math.round((usedBytes / totalBytes) * 100)) : 0;
  const full = percent >= 100;
  const warn = percent >= 90 && !full;

  return (
    <section className={`assets-storage-usage${full ? ' is-full' : ''}${warn ? ' is-warn' : ''}${usedBytes ? ' has-usage' : ''}`} aria-label={copy.storageAria} aria-busy={isPending}>
      <span className="assets-storage-usage-icon" aria-hidden="true">
        <HardDrive />
      </span>
      <span className="assets-storage-usage-title">{usage?.planName || copy.storageFallbackTitle}</span>
      {usage ? (
        <>
          <span className="assets-storage-usage-value">
            {formatBytes(usedBytes)} / {formatBytes(totalBytes)}
          </span>
          <span
            className="assets-storage-usage-track"
            role="progressbar"
            aria-label={copy.storageProgressAria}
            aria-valuemin={0}
            aria-valuemax={totalBytes}
            aria-valuenow={Math.min(usedBytes, totalBytes)}
            aria-valuetext={fillCopy(copy.storageUsedAria, { used: formatBytes(usedBytes), total: formatBytes(totalBytes) })}
          >
            <span style={{ width: `${percent}%` }} />
          </span>
          <span className="assets-storage-usage-percent">{percent}%</span>
        </>
      ) : isError ? (
        <span className="assets-storage-usage-status">
          {copy.storageUnavailable}
          <button type="button" onClick={onRetry}>{copy.retry}</button>
        </span>
      ) : (
        <span className="assets-storage-usage-status">{copy.storageLoading}</span>
      )}
    </section>
  );
}

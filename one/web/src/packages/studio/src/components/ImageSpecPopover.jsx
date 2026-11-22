"use client";

import React, { useMemo, useState } from "react";
import { Lock, Unlock } from "lucide-react";
import AspectWireframeIcon from "./AspectWireframeIcon";

/**
 * Computes standard pixel dimensions from aspect ratio string and quality string.
 */
export function computeImageDimensions(aspectRatio = "1:1", quality = "1K") {
  const q = String(quality || "").toUpperCase();
  let base = 1024;
  if (q.includes("4K")) {
    base = 4096;
  } else if (q.includes("2K")) {
    base = 2048;
  } else if (q.includes("1.5K")) {
    base = 1536;
  }

  const r = String(aspectRatio || "1:1").toLowerCase().trim();
  if (
    r === "auto" ||
    r.includes("自动") ||
    r.includes("smart") ||
    r.includes("自适应")
  ) {
    return { width: base, height: base };
  }
  if (r === "1:1") return { width: base, height: base };
  if (r === "16:9") {
    return base >= 4096
      ? { width: 3840, height: 2160 }
      : base >= 2048
        ? { width: 2560, height: 1440 }
        : { width: 1280, height: 720 };
  }
  if (r === "9:16") {
    return base >= 4096
      ? { width: 2160, height: 3840 }
      : base >= 2048
        ? { width: 1440, height: 2560 }
        : { width: 720, height: 1280 };
  }
  if (r === "4:3") {
    return base >= 4096
      ? { width: 3840, height: 2880 }
      : base >= 2048
        ? { width: 2048, height: 1536 }
        : { width: 1152, height: 864 };
  }
  if (r === "3:4") {
    return base >= 4096
      ? { width: 2880, height: 3840 }
      : base >= 2048
        ? { width: 1536, height: 2048 }
        : { width: 864, height: 1152 };
  }
  if (r === "21:9") {
    return base >= 4096
      ? { width: 4096, height: 1755 }
      : base >= 2048
        ? { width: 2560, height: 1080 }
        : { width: 1680, height: 720 };
  }
  if (r === "3:2") {
    return base >= 4096
      ? { width: 4096, height: 2730 }
      : base >= 2048
        ? { width: 2160, height: 1440 }
        : { width: 1200, height: 800 };
  }
  if (r === "2:3") {
    return base >= 4096
      ? { width: 2730, height: 4096 }
      : base >= 2048
        ? { width: 1440, height: 2160 }
        : { width: 800, height: 1200 };
  }

  const parts = r.split(":");
  if (parts.length === 2) {
    const w = parseFloat(parts[0]);
    const h = parseFloat(parts[1]);
    if (w && h) {
      if (w >= h) {
        return { width: base, height: Math.round((base * h) / w) };
      } else {
        return { width: Math.round((base * w) / h), height: base };
      }
    }
  }
  return { width: base, height: base };
}

export function ImageSpecPopover({
  aspectRatios = [],
  selectedAr = "1:1",
  onSelectAr,
  resolutions = [],
  qualityLabel = null,
  selectedQuality = "",
  onSelectQuality,
  showQuality = true,
  batchSize = 1,
  onChangeBatchSize,
  formatQuality = (value) => value,
  customWidth = null,
  customHeight = null,
  onChangeDimensions,
  copy = {},
}) {
  const [isLocked, setIsLocked] = useState(true);

  const baseDimensions = useMemo(
    () => computeImageDimensions(selectedAr, selectedQuality || resolutions[0]),
    [selectedAr, selectedQuality, resolutions],
  );

  const currentW = customWidth || baseDimensions.width;
  const currentH = customHeight || baseDimensions.height;

  const handleRatioClick = (ratio) => {
    const nextDims = computeImageDimensions(ratio, selectedQuality || resolutions[0]);
    onSelectAr?.(ratio);
    onChangeDimensions?.({
      width: nextDims.width,
      height: nextDims.height,
      aspectRatio: ratio,
    });
  };

  const handleWidthChange = (val) => {
    const num = parseInt(val, 10);
    if (isNaN(num)) return;
    const clampedW = Math.max(256, Math.min(4096, num));
    if (isLocked) {
      const ratio = currentW && currentH ? currentW / currentH : 1;
      const newH = Math.max(256, Math.min(4096, Math.round(clampedW / ratio)));
      onChangeDimensions?.({ width: clampedW, height: newH, aspectRatio: selectedAr });
    } else {
      onChangeDimensions?.({ width: clampedW, height: currentH, aspectRatio: 'custom' });
    }
  };

  const handleHeightChange = (val) => {
    const num = parseInt(val, 10);
    if (isNaN(num)) return;
    const clampedH = Math.max(256, Math.min(4096, num));
    if (isLocked) {
      const ratio = currentW && currentH ? currentW / currentH : 1;
      const newW = Math.max(256, Math.min(4096, Math.round(clampedH * ratio)));
      onChangeDimensions?.({ width: newW, height: clampedH, aspectRatio: selectedAr });
    } else {
      onChangeDimensions?.({ width: currentW, height: clampedH, aspectRatio: 'custom' });
    }
  };

  const t = copy.paramsPanel || {};

  return (
    <div className="flex flex-col gap-4 select-none w-full">
      {/* ── 1. Aspect Ratio Section ── */}
      <div>
        <div className="text-caption font-semibold text-ink-muted uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>{t.titleRatio || "长宽比例"}</span>
          <span className="text-micro text-ink-subtle font-normal">
            {selectedAr}
          </span>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-h-[160px] overflow-y-auto custom-scrollbar p-0.5">
          {aspectRatios.map((ratio) => {
            const isSelected = selectedAr === ratio;
            return (
              <button
                key={ratio}
                type="button"
                onClick={() => handleRatioClick(ratio)}
                className={`control-focus group flex flex-col items-center justify-center rounded-lg border p-2 transition-[background-color,border-color,color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-press cursor-pointer ${
                  isSelected
                    ? "border-line bg-wash-press text-ink"
                    : "border-line-subtle bg-wash text-ink-muted hover:border-line-strong hover:bg-wash-strong hover:text-ink"
                }`}
              >
                <AspectWireframeIcon ratio={ratio} active={isSelected} />
                <span
                  className={`mt-1.5 text-caption leading-none ${
                    isSelected ? "font-semibold text-ink" : "text-ink-muted"
                  }`}
                >
                  {ratio}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 2. Resolution / Quality Section ── */}
      {showQuality && resolutions.length > 0 && (
        <div>
          <div className="text-caption font-semibold text-ink-muted uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>{qualityLabel || t.titleResolution || "分辨率"}</span>
            <span className="text-micro text-ink-subtle font-normal">
              {formatQuality(selectedQuality || resolutions[0])}
            </span>
          </div>
          <div
            data-pill-segmented
            className="grid grid-flow-col auto-cols-fr gap-1 p-1 rounded-full bg-well border border-line-subtle"
          >
            {resolutions.map((res) => {
              const isSelected =
                selectedQuality === res ||
                (!selectedQuality && res === resolutions[0]);
              return (
                <button
                  key={res}
                  type="button"
                  data-pill-segment-item
                  onClick={() => onSelectQuality?.(res)}
                  className={`control-focus h-control-xs rounded-full px-2 text-center text-label font-medium transition-none active:scale-[0.98] active:duration-press cursor-pointer ${
                    isSelected
                      ? "bg-surface-inverse text-ink-inverse font-semibold shadow-elevation-1"
                      : "text-ink-muted hover:text-ink hover:bg-wash-strong"
                  }`}
                >
                  {formatQuality(res)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 3. Batch Size / Generation Quantity Section ── */}
      <div>
        <div className="text-caption font-semibold text-ink-muted uppercase tracking-wider mb-1.5 flex items-center justify-between">
          <span>{t.titleQuantity || "生成数量"}</span>
          <span className="text-micro text-ink-subtle font-normal">
            {t.batchCountUnit
              ? t.batchCountUnit.replace("{count}", batchSize)
              : `${batchSize} 张`}
          </span>
        </div>
        <div
          data-pill-segmented
          className="grid grid-cols-4 gap-1 p-1 rounded-full bg-well border border-line-subtle"
        >
          {[1, 2, 3, 4].map((num) => {
            const isSelected = batchSize === num;
            return (
              <button
                key={num}
                type="button"
                data-pill-segment-item
                onClick={() => onChangeBatchSize?.(num)}
                className={`control-focus h-control-xs rounded-full text-center text-label font-medium transition-none active:scale-[0.98] active:duration-press cursor-pointer ${
                  isSelected
                    ? "bg-surface-inverse text-ink-inverse font-semibold shadow-elevation-1"
                    : "text-ink-muted hover:text-ink hover:bg-wash-strong"
                }`}
              >
                {num}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 4. Dimensions & Custom Resolution Section ── */}
      <div className="pt-2.5 border-t border-line-subtle flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-caption font-semibold text-ink-muted uppercase tracking-wider">
            {t.titleDimensions || "尺寸规格 (自定义)"}
          </span>
          <button
            type="button"
            onClick={() => setIsLocked((v) => !v)}
            className={`control-focus flex h-control-xs items-center gap-1 rounded-md border px-2 text-caption transition-colors duration-fast cursor-pointer ${
              isLocked
                ? "border-brand-line bg-brand-soft font-medium text-ink"
                : "border-line-subtle bg-wash text-ink-muted hover:text-ink"
            }`}
            title={isLocked ? "比例已锁定 (Lock Aspect Ratio)" : "自由比例 (Free Aspect Ratio)"}
          >
            {isLocked ? <Lock className="size-3" /> : <Unlock className="size-3" />}
            <span>{isLocked ? "比例锁定" : "自由尺寸"}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="flex h-control-sm flex-1 items-center gap-1.5 rounded-xl border border-line bg-well px-2.5 transition-colors duration-fast focus-within:border-brand-line">
            <span className="text-micro font-semibold text-ink-subtle">W</span>
            <input
              type="number"
              min="256"
              max="4096"
              step="8"
              value={currentW}
              onChange={(e) => handleWidthChange(e.target.value)}
              className="w-full bg-transparent text-ink font-semibold focus:outline-none text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          <span className="text-ink-subtle shrink-0">×</span>

          <div className="flex h-control-sm flex-1 items-center gap-1.5 rounded-xl border border-line bg-well px-2.5 transition-colors duration-fast focus-within:border-brand-line">
            <span className="text-micro font-semibold text-ink-subtle">H</span>
            <input
              type="number"
              min="256"
              max="4096"
              step="8"
              value={currentH}
              onChange={(e) => handleHeightChange(e.target.value)}
              className="w-full bg-transparent text-ink font-semibold focus:outline-none text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          <span className="text-micro text-ink-subtle shrink-0 font-semibold">PX</span>
        </div>

        <div className="flex items-center justify-between text-micro text-ink-subtle">
          <span>最小 256px · 最大 4096px</span>
          <span>{currentW} × {currentH}</span>
        </div>
      </div>
    </div>
  );
}

export default ImageSpecPopover;

"use client";

import React from "react";
import AspectWireframeIcon from "./AspectWireframeIcon.jsx";

export function VideoSpecPopover({
  aspectRatios = [],
  selectedAr = "16:9",
  onSelectAr,
  aspectRatioHelp = null,
  resolutions = [],
  selectedResolution = "720p",
  onSelectResolution,
  copy = {},
}) {
  const arTitle = copy.dropdowns?.aspectRatio || "长宽比例";
  const resTitle = copy.dropdowns?.resolution || "分辨率";

  return (
    <div className="flex flex-col gap-4 select-none w-full">
      {/* ── 1. Aspect Ratio Section ── */}
      {aspectRatios.length > 0 && (
        <div>
          <div className="text-caption font-semibold text-ink-muted uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>{arTitle}</span>
            <span className="text-micro text-ink-subtle font-normal">
              {selectedAr}
            </span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 p-0.5">
            {aspectRatios.map((ratio) => {
              const isSelected = selectedAr === ratio;
              return (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => onSelectAr?.(ratio)}
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
          {aspectRatioHelp && (
            <p className="mt-2 text-micro text-ink-subtle leading-tight px-1">
              {aspectRatioHelp}
            </p>
          )}
        </div>
      )}

      {/* ── 2. Resolution Section ── */}
      {resolutions.length > 0 && (
        <div>
          <div className="text-caption font-semibold text-ink-muted uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>{resTitle}</span>
            <span className="text-micro text-ink-subtle font-normal">
              {(() => {
                const cur = resolutions.find(
                  (r) =>
                    r.value === selectedResolution ||
                    r === selectedResolution ||
                    r.id === selectedResolution,
                );
                return cur?.label || cur?.value || selectedResolution;
              })()}
            </span>
          </div>
          <div
            data-pill-segmented
            className="grid grid-flow-col auto-cols-fr gap-1 p-1 rounded-full bg-well border border-line-subtle"
          >
            {resolutions.map((opt) => {
              const val = typeof opt === "object" ? opt.value || opt.id : opt;
              const label =
                typeof opt === "object" ? opt.label || opt.name || val : opt;
              const disabled = typeof opt === "object" ? Boolean(opt.disabled) : false;
              const isSelected =
                val === selectedResolution ||
                String(val).toLowerCase() === String(selectedResolution).toLowerCase();

              return (
                <button
                  key={val}
                  type="button"
                  data-pill-segment-item
                  disabled={disabled}
                  onClick={() => !disabled && onSelectResolution?.(opt)}
                  className={`control-focus h-control-xs rounded-full px-2 text-center text-label font-medium transition-none active:scale-[0.98] active:duration-press cursor-pointer ${
                    isSelected
                      ? "bg-surface-inverse text-ink-inverse font-semibold shadow-elevation-1"
                      : disabled
                        ? "opacity-35 cursor-not-allowed text-ink-subtle"
                        : "text-ink-muted hover:text-ink hover:bg-wash-strong"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoSpecPopover;

"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import toast from "react-hot-toast";

async function downloadImage(url, filename) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank");
  }
}

export default function ImageDetailWorkbench({
  isOpen,
  onClose,
  item,
  batch,
  allHistoryItems = [],
  currentIndex = 0,
  onNavigate,
  onReEdit,
  onReGenerate,
  onUseAsReference,
  onInpaint,
  onUpscale,
  onDelete,
  locale = "zh",
  copy,
  selectedModelDisplayName = "",
}) {
  const isZh = String(locale || "").startsWith("zh");

  // Comparison state (for before/after upscale comparison)
  const [comparisonActive, setComparisonActive] = useState(false);
  const [comparisonBeforeUrl, setComparisonBeforeUrl] = useState(null);
  const [comparisonAfterUrl, setComparisonAfterUrl] = useState(null);
  const [sliderPos, setSliderPos] = useState(50); // 0 - 100%
  const isDraggingSlider = useRef(false);
  const containerRef = useRef(null);

  // Favorite toggle
  const [isFavorited, setIsFavorited] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [upscaling, setUpscaling] = useState(false);

  // Sync state when active item changes
  useEffect(() => {
    if (item?.url) {
      setIsFavorited(false);
      setMoreMenuOpen(false);
      // If item was generated as upscale, activate comparison
      if (item.originalUrl) {
        setComparisonBeforeUrl(item.originalUrl);
        setComparisonAfterUrl(item.url);
        setComparisonActive(true);
      } else {
        setComparisonActive(false);
        setComparisonBeforeUrl(null);
        setComparisonAfterUrl(null);
      }
    }
  }, [item?.url]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onNavigate?.(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onNavigate?.(1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, onNavigate]);

  // Slider drag handling
  const handleSliderMove = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = Math.round((x / rect.width) * 100);
    setSliderPos(percent);
  }, []);

  const handleMouseDown = useCallback((e) => {
    isDraggingSlider.current = true;
    handleSliderMove(e.clientX);
  }, [handleSliderMove]);

  const handleTouchStart = useCallback((e) => {
    if (e.touches[0]) {
      isDraggingSlider.current = true;
      handleSliderMove(e.touches[0].clientX);
    }
  }, [handleSliderMove]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDraggingSlider.current) {
        handleSliderMove(e.clientX);
      }
    };
    const handleMouseUp = () => {
      isDraggingSlider.current = false;
    };
    const handleTouchMove = (e) => {
      if (isDraggingSlider.current && e.touches[0]) {
        handleSliderMove(e.touches[0].clientX);
      }
    };
    const handleTouchEnd = () => {
      isDraggingSlider.current = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleSliderMove]);

  if (!isOpen || !item) return null;

  const currentPrompt = item.prompt || batch?.prompt || "";
  const currentModel = item.model || batch?.model || selectedModelDisplayName || "Image";
  const currentAr = item.aspect_ratio || batch?.aspect_ratio || "1:1";
  const currentQuality = item.quality || batch?.quality || "2K";

  // Actions
  const handleCopyPrompt = () => {
    if (currentPrompt) {
      navigator.clipboard.writeText(currentPrompt);
      toast.success(isZh ? "提示词已复制到剪贴板" : "Prompt copied to clipboard");
    }
  };

  const handleCopyImageUrl = () => {
    navigator.clipboard.writeText(item.url);
    toast.success(isZh ? "图片链接已复制" : "Image link copied");
    setMoreMenuOpen(false);
  };

  const handleTriggerUpscale = async () => {
    if (!item?.url) return;
    setUpscaling(true);
    try {
      if (onUpscale) {
        const result = await onUpscale(item);
        if (result?.url) {
          setComparisonBeforeUrl(item.url);
          setComparisonAfterUrl(result.url);
          setComparisonActive(true);
          setSliderPos(50);
          toast.success(isZh ? "智能超清已完成，支持滑动对比" : "Upscaling completed, comparison enabled");
        }
      } else {
        toast(isZh ? "正在进行智能超清处理..." : "Processing upscale...");
      }
    } catch (err) {
      toast.error(err.message || (isZh ? "超清处理失败" : "Upscaling failed"));
    } finally {
      setUpscaling(false);
    }
  };

  const handleJumpVideo = () => {
    try {
      sessionStorage.setItem("koyo_video_init_image", item.url);
      if (currentPrompt) {
        sessionStorage.setItem("koyo_video_init_prompt", currentPrompt);
      }
    } catch {}
    const targetUrl = `/${locale}/studio/video?init_image=${encodeURIComponent(item.url)}`;
    window.location.href = targetUrl;
  };

  const handleJumpCanvas = () => {
    try {
      sessionStorage.setItem("koyo_canvas_init_image", item.url);
    } catch {}
    const targetUrl = `/${locale}/studio/layers`;
    window.location.href = targetUrl;
  };

  const handleJumpLipSync = () => {
    const targetUrl = `/${locale}/studio/lipsync?face_image=${encodeURIComponent(item.url)}`;
    window.location.href = targetUrl;
  };

  return (
    <div
      className="fixed inset-0 z-modal flex flex-col lg:flex-row bg-scrim backdrop-blur-xl animate-in fade-in duration-modal ease-enter text-ink select-none overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      {/* ── LEFT / MAIN VIEWPORT AREA ── */}
      <div className="flex-1 flex flex-col relative h-[55vh] lg:h-full min-w-0 overflow-hidden">
        {/* Top Control Bar */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
          {/* Back Button */}
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3.5 rounded-full bg-surface/80 hover:bg-surface-raised backdrop-blur-md text-ink text-xs font-medium flex items-center gap-1.5 border border-line transition-[background-color,color,border-color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer shadow-elevation-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span>{isZh ? "返回" : "Back"}</span>
          </button>

          {/* Navigation count badge */}
          {allHistoryItems.length > 1 && (
            <div className="h-9 px-3 rounded-full bg-surface/50 backdrop-blur-md text-ink-muted text-xs font-mono flex items-center border border-line-subtle">
              {currentIndex + 1} / {allHistoryItems.length}
            </div>
          )}

          {/* Split comparison toggle if comparison exists */}
          {comparisonBeforeUrl && comparisonAfterUrl && (
            <button
              type="button"
              onClick={() => setComparisonActive(!comparisonActive)}
              className={`h-9 px-3.5 rounded-full backdrop-blur-md text-xs font-medium flex items-center gap-1.5 border transition-[background-color,color,border-color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer ${
                comparisonActive
                  ? "bg-brand text-ink-on-accent border-brand-line shadow-elevation-1"
                  : "bg-surface/80 text-ink-muted border-line hover:bg-surface-raised hover:text-ink"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8L22 12L18 16" />
                <path d="M6 8L2 12L6 16" />
                <line x1="2" y1="12" x2="22" y2="12" />
              </svg>
              <span>{isZh ? "分屏对比" : "Split Compare"}</span>
            </button>
          )}
        </div>

        {/* Previous Image Arrow */}
        {allHistoryItems.length > 1 && (
          <button
            type="button"
            onClick={() => onNavigate?.(-1)}
            disabled={currentIndex <= 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-surface/80 hover:bg-surface-raised disabled:opacity-20 backdrop-blur-md text-ink flex items-center justify-center border border-line transition-[background-color,color,border-color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer shadow-elevation-2"
            title={isZh ? "上一张 (← 键盘左键)" : "Previous (←)"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}

        {/* Next Image Arrow */}
        {allHistoryItems.length > 1 && (
          <button
            type="button"
            onClick={() => onNavigate?.(1)}
            disabled={currentIndex >= allHistoryItems.length - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-surface/80 hover:bg-surface-raised disabled:opacity-20 backdrop-blur-md text-ink flex items-center justify-center border border-line transition-[background-color,color,border-color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer shadow-elevation-2"
            title={isZh ? "下一张 (→ 键盘右键)" : "Next (→)"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}

        {/* Center Canvas / Image Container */}
        <div
          ref={containerRef}
          className="flex-1 w-full h-full flex items-center justify-center p-4 lg:p-12 relative overflow-hidden"
        >
          {comparisonActive && comparisonBeforeUrl && comparisonAfterUrl ? (
            /* Split View Comparison Mode (对标图3) */
            <div
              className="relative max-w-full max-h-[82vh] rounded-2xl overflow-hidden shadow-elevation-4 border border-line cursor-ew-resize select-none"
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
            >
              {/* After image (background layer) */}
              <img
                src={comparisonAfterUrl}
                alt="After HD"
                className="max-w-full max-h-[82vh] object-contain block pointer-events-none"
                draggable={false}
              />

              {/* Before image (clipped top layer) */}
              <div
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
              >
                <img
                  src={comparisonBeforeUrl}
                  alt="Before HD"
                  className="max-w-full max-h-[82vh] object-contain block pointer-events-none"
                  draggable={false}
                />
                {/* Before badge */}
                <span className="absolute bottom-4 left-4 px-2.5 py-1 rounded-md bg-overlay/80 backdrop-blur-md text-ink text-xs font-medium border border-line">
                  {isZh ? "高清前" : "Before"}
                </span>
              </div>

              {/* After badge */}
              <span className="absolute bottom-4 right-4 px-2.5 py-1 rounded-md bg-overlay/80 backdrop-blur-md text-ink text-xs font-medium border border-line pointer-events-none">
                {isZh ? "高清后" : "After"}
              </span>

              {/* Slider divider line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-brand shadow-[0_0_10px_rgba(225,29,116,0.8)] pointer-events-none"
                style={{ left: `${sliderPos}%` }}
              >
                {/* Circular handle */}
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-surface-raised text-ink border border-line shadow-elevation-3 flex items-center justify-center font-bold text-xs">
                  ↔
                </div>
              </div>
            </div>
          ) : (
            /* Standard Fullscreen Image View */
            <div className="relative max-w-full max-h-[85vh] flex items-center justify-center">
              <img
                src={item.url}
                alt={currentPrompt.slice(0, 30) || "Generated preview"}
                className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-elevation-4 border border-line"
              />
              {/* Subtle HD badge */}
              <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded bg-overlay/80 backdrop-blur-md text-[10px] font-mono text-ink-muted border border-line">
                HD 2K
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT WORKBENCH PANEL (对标图3 一体化衍生创作中枢) ── */}
      <div className="w-full lg:w-[380px] xl:w-[420px] shrink-0 bg-overlay border-t lg:border-t-0 lg:border-l border-line flex flex-col h-[45vh] lg:h-full overflow-y-auto custom-scrollbar p-5 sm:p-6 gap-5 shadow-elevation-4 text-ink">
        {/* Row 1: Primary Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Download button */}
          <button
            type="button"
            onClick={() => downloadImage(item.url, `supdance-${item.id || Date.now()}.jpg`)}
            className="flex-1 h-10 px-4 rounded-xl bg-surface hover:bg-surface-raised text-ink font-medium text-xs flex items-center justify-center gap-2 border border-line transition-[background-color,color,border-color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer shadow-elevation-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            <span>{isZh ? "下载原图" : "Download"}</span>
          </button>

          {/* Favorite button */}
          <button
            type="button"
            onClick={() => {
              setIsFavorited(!isFavorited);
              toast.success(
                !isFavorited
                  ? (isZh ? "已加入收藏" : "Added to favorites")
                  : (isZh ? "已取消收藏" : "Removed from favorites")
              );
            }}
            className={`h-10 w-10 rounded-xl flex items-center justify-center border transition-[background-color,color,border-color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer ${
              isFavorited
                ? "bg-amber-500/15 text-amber-400 border-amber-500/40"
                : "bg-surface hover:bg-surface-raised text-ink-muted hover:text-ink border-line"
            }`}
            title={isZh ? "收藏" : "Favorite"}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill={isFavorited ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>

          {/* More menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              className="h-10 w-10 rounded-xl bg-surface hover:bg-surface-raised text-ink-muted hover:text-ink flex items-center justify-center border border-line transition-[background-color,color,border-color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer"
              title={isZh ? "更多" : "More"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
                <circle cx="5" cy="12" r="2" />
              </svg>
            </button>

            {moreMenuOpen && (
              <div className="absolute right-0 top-12 w-44 rounded-xl bg-overlay border border-line shadow-elevation-3 py-1.5 z-30 animate-in fade-in duration-fast flex flex-col">
                <button
                  type="button"
                  onClick={handleCopyImageUrl}
                  className="px-3.5 py-2 text-left text-xs text-ink hover:bg-wash flex items-center gap-2 cursor-pointer transition-[background-color,color] duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  <span>{isZh ? "复制图片链接" : "Copy Image Link"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    onDelete?.(item);
                  }}
                  className="px-3.5 py-2 text-left text-xs text-danger hover:bg-danger/10 flex items-center gap-2 cursor-pointer transition-[background-color,color] duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-danger"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                  <span>{isZh ? "删除图片" : "Delete Image"}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Prompt text block (图片提示词) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink">
              {isZh ? "图片提示词" : "Image Prompt"}
            </span>
            <button
              type="button"
              onClick={handleCopyPrompt}
              className="text-[11px] text-brand hover:text-brand-hover font-medium flex items-center gap-1 cursor-pointer transition-[color] duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring rounded"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>{isZh ? "复制" : "Copy"}</span>
            </button>
          </div>
          <div className="rounded-xl bg-well border border-line-subtle p-3 text-xs text-ink-muted leading-relaxed font-normal max-h-32 overflow-y-auto custom-scrollbar select-text">
            {currentPrompt || (isZh ? "无提示词" : "No prompt")}
          </div>

          {/* Model info tags */}
          <div className="flex items-center flex-wrap gap-1.5 mt-1">
            <span className="px-2 py-0.5 rounded-md bg-surface border border-line-subtle text-ink-subtle font-mono text-[10px]">
              {currentModel}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-surface border border-line-subtle text-ink-subtle font-mono text-[10px]">
              {currentAr}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-surface border border-line-subtle text-ink-subtle font-mono text-[10px]">
              {currentQuality}
            </span>
          </div>
        </div>

        {/* Row 3: Workflow Jump Shortcuts (快捷工作流 - 对标图3) */}
        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-semibold text-ink">
            {isZh ? "快捷工作流" : "Quick Workflows"}
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* 生成视频 */}
            <button
              type="button"
              onClick={handleJumpVideo}
              className="h-10 px-3 rounded-xl bg-surface hover:bg-surface-raised border border-line text-ink text-xs font-medium flex items-center justify-center gap-2 transition-[background-color,color,border-color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant cursor-pointer hover:border-brand-line focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
              title={isZh ? "以该图作为首帧直接生成视频" : "Generate video with this image"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
              <span>{isZh ? "生成视频" : "To Video"}</span>
            </button>

            {/* 去画布编辑 */}
            <button
              type="button"
              onClick={handleJumpCanvas}
              className="h-10 px-3 rounded-xl bg-surface hover:bg-surface-raised border border-line text-ink text-xs font-medium flex items-center justify-center gap-2 transition-[background-color,color,border-color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant cursor-pointer hover:border-brand-line focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
              title={isZh ? "发送到无限画布多层自由编辑" : "Edit in infinite canvas"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-sky-400">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
              <span>{isZh ? "去画布编辑" : "Canvas"}</span>
            </button>

            {/* 用作参考图 */}
            <button
              type="button"
              onClick={() => {
                onUseAsReference?.(item.url);
                onClose?.();
              }}
              className="h-10 px-3 rounded-xl bg-surface hover:bg-surface-raised border border-line text-ink text-xs font-medium flex items-center justify-center gap-2 transition-[background-color,color,border-color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant cursor-pointer hover:border-brand-line focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
              title={isZh ? "载入下方输入框进行垫图创作" : "Use as reference image in composer"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span>{isZh ? "用作参考图" : "Reference"}</span>
            </button>
          </div>
        </div>

        {/* Row 4: AI Post-processing Tools (AI 后期工具箱 - 对标图3) */}
        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-semibold text-ink">
            {isZh ? "AI 后期工具箱" : "AI Tools Matrix"}
          </span>

          <div className="grid grid-cols-2 gap-2">
            {/* 智能超清 */}
            <button
              type="button"
              onClick={handleTriggerUpscale}
              disabled={upscaling}
              className="h-10 px-3 rounded-xl bg-surface hover:bg-surface-raised border border-line text-ink text-xs font-medium flex items-center gap-2 transition-[background-color,color,border-color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant cursor-pointer hover:border-line-strong disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
            >
              {upscaling ? (
                <span className="animate-spin inline-block text-brand">◌</span>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              )}
              <span>{isZh ? "智能超清" : "Smart Upscale"}</span>
            </button>

            {/* 局部重绘 */}
            <button
              type="button"
              onClick={() => {
                onInpaint?.(item.url);
                onClose?.();
              }}
              className="h-10 px-3 rounded-xl bg-surface hover:bg-surface-raised border border-line text-ink text-xs font-medium flex items-center gap-2 transition-[background-color,color,border-color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant cursor-pointer hover:border-line-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-400">
                <path d="M12 19l7-7 3 3-7 7-3-3z" />
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                <path d="M2 2l7.586 7.586" />
                <circle cx="11" cy="11" r="2" />
              </svg>
              <span>{isZh ? "局部重绘" : "Inpaint"}</span>
            </button>

            {/* 细节修复 */}
            <button
              type="button"
              onClick={handleTriggerUpscale}
              className="h-10 px-3 rounded-xl bg-surface hover:bg-surface-raised border border-line text-ink text-xs font-medium flex items-center gap-2 transition-[background-color,color,border-color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant cursor-pointer hover:border-line-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400">
                <circle cx="12" cy="12" r="10" />
                <path d="m4.93 4.93 4.24 4.24" />
                <path d="m14.83 9.17 4.24-4.24" />
                <path d="m14.83 14.83 4.24 4.24" />
                <path d="m9.17 14.83-4.24 4.24" />
                <circle cx="12" cy="12" r="4" />
              </svg>
              <span>{isZh ? "细节修复" : "Detail Repair"}</span>
            </button>

            {/* 消除笔 */}
            <button
              type="button"
              onClick={() => {
                onInpaint?.(item.url);
                onClose?.();
              }}
              className="h-10 px-3 rounded-xl bg-surface hover:bg-surface-raised border border-line text-ink text-xs font-medium flex items-center gap-2 transition-[background-color,color,border-color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant cursor-pointer hover:border-line-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-rose-400">
                <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
                <path d="M22 21H7" />
                <path d="m5 11 9 9" />
              </svg>
              <span>{isZh ? "消除笔" : "Eraser"}</span>
            </button>

            {/* 智能扩图 */}
            <button
              type="button"
              onClick={handleJumpCanvas}
              className="h-10 px-3 rounded-xl bg-surface hover:bg-surface-raised border border-line text-ink text-xs font-medium flex items-center gap-2 transition-[background-color,color,border-color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant cursor-pointer hover:border-line-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-teal-400">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
              <span>{isZh ? "智能扩图" : "Outpaint"}</span>
            </button>

            {/* 对口型 */}
            <button
              type="button"
              onClick={handleJumpLipSync}
              className="h-10 px-3 rounded-xl bg-surface hover:bg-surface-raised border border-line text-ink text-xs font-medium flex items-center gap-2 transition-[background-color,color,border-color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant cursor-pointer hover:border-line-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-pink-400">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
              <span>{isZh ? "对口型" : "Lip Sync"}</span>
            </button>
          </div>
        </div>

        {/* Row 5: Bottom Sticky Actions (重新编辑 / 再次生成) */}
        <div className="mt-auto pt-4 border-t border-line flex items-center gap-2.5">
          {/* 重新编辑 */}
          <button
            type="button"
            onClick={() => {
              onReEdit?.(batch || item);
              onClose?.();
            }}
            className="flex-1 h-10 px-3.5 rounded-full bg-surface hover:bg-surface-raised text-ink text-xs font-medium flex items-center justify-center gap-1.5 border border-line transition-[background-color,color,border-color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span>{isZh ? "重新编辑" : "Re-edit"}</span>
          </button>

          {/* 再次生成 */}
          <button
            type="button"
            onClick={() => {
              onReGenerate?.(batch || item);
              onClose?.();
            }}
            className="flex-1 h-10 px-3.5 rounded-full bg-brand hover:bg-brand-hover active:bg-brand-active text-ink-on-accent text-xs font-medium flex items-center justify-center gap-1.5 transition-[background-color,color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer shadow-elevation-1"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>{isZh ? "再次生成" : "Regenerate"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

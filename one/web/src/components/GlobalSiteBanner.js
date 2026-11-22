'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';

export default function GlobalSiteBanner({ banner }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const impressionLoggedRef = useRef(false);

  // 1. 客户端水合与持久化关闭状态检测 (基于 localStorage 与过期天数)
  useEffect(() => {
    if (!banner?.enabled) {
      setMounted(true);
      return;
    }

    try {
      const bannerId = banner.id || 'banner-default';
      const storageKey = `supdance_banner_dismissed_${bannerId}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const dismissedTime = parseInt(stored, 10);
        const hideDays = banner.autoHideDays ?? 7;
        const expiryTime = hideDays * 24 * 60 * 60 * 1000;
        if (!isNaN(dismissedTime) && Date.now() - dismissedTime < expiryTime) {
          setDismissed(true);
        } else {
          localStorage.removeItem(storageKey);
        }
      }
    } catch {
      // 容错处理
    }
    setMounted(true);
  }, [banner]);

  // 2. 检查 targetScope (all | studio | home)
  const isScopeMatched = useCallback(() => {
    if (!banner?.targetScope || banner.targetScope === 'all') return true;
    const isStudioPath = pathname?.startsWith('/studio') || pathname?.startsWith('/zh/studio');
    if (banner.targetScope === 'studio') return isStudioPath;
    if (banner.targetScope === 'home') return pathname === '/' || pathname === '/zh';
    return true;
  }, [banner, pathname]);

  // 3. 曝光埋点上报
  useEffect(() => {
    if (!mounted || !banner?.enabled || dismissed || isClosing || impressionLoggedRef.current) return;
    if (!isScopeMatched()) return;

    impressionLoggedRef.current = true;
    try {
      const payload = JSON.stringify({
        bannerId: banner.id || 'banner-default',
        eventType: 'impression',
        targetUrl: banner.linkUrl || '',
        pagePath: pathname || '/',
        locale: pathname?.startsWith('/zh') ? 'zh' : 'en',
      });
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/analytics/banner-event', payload);
      } else {
        fetch('/api/analytics/banner-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {}
  }, [mounted, banner, dismissed, isClosing, pathname, isScopeMatched]);

  // 4. 点击埋点
  const handleBannerClick = () => {
    if (!banner?.linkUrl || banner.linkUrl === '#') return;
    try {
      const payload = JSON.stringify({
        bannerId: banner.id || 'banner-default',
        eventType: 'click',
        targetUrl: banner.linkUrl,
        pagePath: pathname || '/',
        locale: pathname?.startsWith('/zh') ? 'zh' : 'en',
      });
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/analytics/banner-event', payload);
      } else {
        fetch('/api/analytics/banner-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {}
  };

  // 5. 关闭操作与平滑退出动效
  const handleDismiss = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsClosing(true);

    try {
      const bannerId = banner?.id || 'banner-default';
      localStorage.setItem(`supdance_banner_dismissed_${bannerId}`, String(Date.now()));
    } catch {}

    try {
      const payload = JSON.stringify({
        bannerId: banner?.id || 'banner-default',
        eventType: 'dismiss',
        targetUrl: banner?.linkUrl || '',
        pagePath: pathname || '/',
        locale: pathname?.startsWith('/zh') ? 'zh' : 'en',
      });
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/analytics/banner-event', payload);
      }
    } catch {}

    // 等待收起折叠动画执行完毕
    setTimeout(() => {
      setDismissed(true);
    }, 320);
  };

  // 状态检查
  if (!mounted || !banner?.enabled || !banner?.message || dismissed) {
    return null;
  }

  // 路径作用域检查
  if (!isScopeMatched()) {
    return null;
  }

  // 弥散光晕配色字典
  const glowStyleMap = {
    aurora: {
      leftOrb: 'from-cyan-500/35 via-indigo-500/40 to-transparent',
      rightOrb: 'from-purple-600/35 via-fuchsia-500/35 to-transparent',
      shadow: 'shadow-[0_12px_36px_-6px_rgba(129,140,248,0.25)]',
      border: 'border-white/10',
    },
    cyan: {
      leftOrb: 'from-cyan-400/40 via-sky-500/35 to-transparent',
      rightOrb: 'from-blue-600/35 via-teal-500/30 to-transparent',
      shadow: 'shadow-[0_12px_36px_-6px_rgba(225,29,116,0.25)]',
      border: 'border-cyan-500/20',
    },
    amber: {
      leftOrb: 'from-amber-400/40 via-orange-500/35 to-transparent',
      rightOrb: 'from-rose-600/35 via-red-500/30 to-transparent',
      shadow: 'shadow-[0_12px_36px_-6px_rgba(245,158,11,0.25)]',
      border: 'border-amber-500/20',
    },
    rose: {
      leftOrb: 'from-rose-500/40 via-pink-500/35 to-transparent',
      rightOrb: 'from-purple-600/35 via-indigo-500/30 to-transparent',
      shadow: 'shadow-[0_12px_36px_-6px_rgba(244,63,94,0.25)]',
      border: 'border-rose-500/20',
    },
  };

  const currentGlow = glowStyleMap[banner.glowStyle] || glowStyleMap.aurora;
  const showAmbientGlow = banner.ambientGlow !== false;
  const dynamicEffect = banner.dynamicEffect || 'breathe';
  const hasCta = Boolean(banner.ctaText && banner.ctaText.trim());
  const isInteractive = Boolean(banner.linkUrl && banner.linkUrl !== '#');

  const contentElement = (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-center transition-transform duration-200">
      {/* 呼吸脉冲雷达圆点 */}
      {banner.showPulseDot !== false && (
        <span className="relative flex h-2 w-2 flex-shrink-0 items-center justify-center">
          <span className="animate-banner-radar absolute inline-flex h-full w-full rounded-full bg-white opacity-80" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.95)]" />
        </span>
      )}

      {/* 动态胶囊徽章 (如 HOT / NEW) */}
      {banner.badgeText && (
        <span className="inline-flex items-center rounded-full border border-white/30 bg-white/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-[0_0_10px_rgba(255,255,255,0.2)] backdrop-blur-md transition-transform duration-300 group-hover:scale-105">
          {banner.badgeText}
        </span>
      )}

      {/* 前置高亮强调文案 (如 "上新特惠：") */}
      {banner.highlightText && (
        <span className="text-xs sm:text-[13px] font-bold text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.45)]">
          {banner.highlightText}
        </span>
      )}

      {/* 公告主要说明文本 */}
      <span className="text-xs sm:text-[13px] font-medium tracking-tight text-white/95 transition-colors group-hover:text-white">
        {banner.message}
      </span>

      {/* 右侧 CTA 行动胶囊按钮 (如 "立即订阅") */}
      {hasCta && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-sky-400 px-3 py-0.5 text-[11px] font-bold text-slate-950 shadow-[0_0_16px_rgba(56,189,248,0.5)] transition-all duration-200 group-hover:scale-105 group-hover:brightness-110 active:scale-95 ml-1"
        >
          <span>{banner.ctaText}</span>
          <svg className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </span>
      )}

      {/* 仅在没有 CTA 按钮且可交互时显示的简约箭头 */}
      {!hasCta && isInteractive && (
        <svg
          className="h-3.5 w-3.5 flex-shrink-0 text-white/80 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-white"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      )}
    </div>
  );

  return (
    <aside
      role="banner"
      aria-label="站点重要通知"
      className={`group relative z-header w-full border-b bg-[#07070b]/90 px-4 py-2 text-xs font-medium backdrop-blur-xl transition-all duration-300 ease-in-out select-none ${
        currentGlow.border
      } ${showAmbientGlow ? currentGlow.shadow : 'shadow-md'} ${
        isClosing
          ? 'max-h-0 opacity-0 -translate-y-full py-0 border-transparent overflow-hidden'
          : 'max-h-20 opacity-100 translate-y-0'
      }`}
    >
      {/* 1. 弥散光晕核心层 (Ambient Mesh Gradient Orbs) */}
      {showAmbientGlow && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* 左弥散光团 */}
          <div
            className={`absolute -left-1/4 -top-1/2 h-[200%] w-3/4 rounded-full bg-gradient-to-br ${currentGlow.leftOrb} blur-3xl ${
              dynamicEffect === 'breathe' || dynamicEffect === 'both' ? 'animate-banner-aura' : ''
            } ${dynamicEffect === 'drift' ? 'animate-banner-drift' : ''}`}
          />
          {/* 右弥散光团 */}
          <div
            className={`absolute -right-1/4 -bottom-1/2 h-[200%] w-3/4 rounded-full bg-gradient-to-tl ${currentGlow.rightOrb} blur-3xl ${
              dynamicEffect === 'breathe' || dynamicEffect === 'both' ? 'animate-banner-aura' : ''
            } ${dynamicEffect === 'drift' ? 'animate-banner-drift' : ''}`}
          />
          {/* 中间柔光弥散带 */}
          <div className="absolute inset-x-0 top-0 h-full bg-gradient-to-b from-white/[0.04] to-transparent" />
        </div>
      )}

      {/* 2. 科技感流光扫光层 (Aurora Shimmer) */}
      {(dynamicEffect === 'shimmer' || dynamicEffect === 'both') && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-35">
          <div className="h-full w-2/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-banner-shimmer" />
        </div>
      )}

      {/* 3. 前台主体内容区域 */}
      <div className="relative mx-auto flex max-w-7xl items-center justify-between">
        {/* 左侧占位平衡 */}
        <div className="w-6 flex-shrink-0 hidden sm:block" />

        {/* 主体交互区域 */}
        <div className="flex-1 min-w-0 flex items-center justify-center">
          {isInteractive ? (
            <a
              href={banner.linkUrl}
              target={banner.linkTarget || '_blank'}
              rel="noopener noreferrer"
              onClick={handleBannerClick}
              className="group inline-flex items-center justify-center max-w-full truncate py-0.5 cursor-pointer"
            >
              {contentElement}
            </a>
          ) : (
            <div className="group inline-flex items-center justify-center max-w-full truncate py-0.5">
              {contentElement}
            </div>
          )}
        </div>

        {/* 右侧关闭按钮 */}
        {banner.dismissible !== false ? (
          <button
            type="button"
            onClick={handleDismiss}
            className="group/close ml-3 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-white/70 hover:bg-white/15 hover:text-white transition-all active:scale-90"
            aria-label="关闭横幅公告"
            title="关闭公告"
          >
            <svg
              className="h-3.5 w-3.5 transition-transform duration-200 group-hover/close:rotate-90"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        ) : (
          <div className="w-6 flex-shrink-0 hidden sm:block" />
        )}
      </div>
    </aside>
  );
}


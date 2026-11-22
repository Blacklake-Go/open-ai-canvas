'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Globe, ChevronDown, Check } from 'lucide-react';
import BrandLogo from '@/components/site/BrandLogo';
import { useBranding } from '@/lib/hooks/useBranding';
import { SpatialBackground } from '@/components/spatial';
import { getAuthCopy, getAuthRoutes, normalizeAuthLocale } from '@/lib/authCopy';

const FLAG_BY_LOCALE = {
  en: ['/flags/en.svg', 'English'],
  'zh-CN': ['/flags/zh-cn.svg', 'Simplified Chinese'],
  'zh-TW': ['/flags/zh-tw.svg', 'Traditional Chinese'],
  'ja-JP': ['/flags/ja.svg', 'Japanese'],
  'ko-KR': ['/flags/ko.svg', 'Korean'],
  es: ['/flags/es.svg', 'Spanish'],
};

export default function AuthLayout({
  children,
  locale = 'en',
  title = '',
  subtitle = '',
}) {
  const { brand } = useBranding();
  const normalizedLocale = normalizeAuthLocale(locale);
  const copy = getAuthCopy(normalizedLocale).layout;
  const routes = getAuthRoutes(normalizedLocale);
  const currentLocale = routes.localeOptions.find((opt) => opt.active) || routes.localeOptions[0];

  const [showLangMenu, setShowLangMenu] = useState(false);
  const langMenuRef = useRef(null);

  const handleSelectLocale = (code) => {
    setShowLangMenu(false);
    try {
      document.cookie = `NEXT_LOCALE=${code}; path=/; max-age=31536000; SameSite=Lax`;
      document.cookie = `locale=${code}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {}
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target)) {
        setShowLangMenu(false);
      }
    };
    if (showLangMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLangMenu]);

  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-x-hidden bg-base text-ink select-none font-sans">
      {/* 1. 全局 AI 空间深暗光影与极光流体背景 */}
      <SpatialBackground variant="hero" isFixed showGrid showAurora showNoise />

      {/* 2. 顶部导航条 */}
      <header className="relative z-20 w-full px-4 sm:px-8 py-5 flex items-center justify-between">
        <Link
          href={routes.studioUrl}
          className="control-focus group inline-flex h-control-sm items-center gap-1.5 rounded-lg border border-line-subtle bg-wash px-3 text-label font-medium text-ink-muted transition-[background-color,border-color,color] duration-fast ease-standard hover:border-line hover:bg-wash-strong hover:text-ink active:scale-[0.98] active:duration-press"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform duration-fast group-hover:-translate-x-0.5"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>{copy.backToStudio}</span>
        </Link>

        <Link href={routes.studioUrl} className="flex items-center gap-2 opacity-95 hover:opacity-100 transition-opacity">
          <BrandLogo brand={brand} />
        </Link>

        {/* 语言切换辅助导航 (6 语言胶囊下拉器) */}
        <div className="relative" ref={langMenuRef}>
          <button
            type="button"
            onClick={() => setShowLangMenu((prev) => !prev)}
            className={`control-focus flex h-control-sm select-none items-center gap-1.5 rounded-lg border px-3 text-label font-medium transition-[background-color,border-color,color] duration-fast ease-standard active:scale-[0.98] active:duration-press cursor-pointer ${
              showLangMenu
                ? 'border-brand-line bg-brand-soft text-ink'
                : 'border-line-subtle bg-wash text-ink-muted hover:border-line hover:bg-wash-strong hover:text-ink'
            }`}
            aria-expanded={showLangMenu}
            aria-haspopup="menu"
            aria-label="Select Language"
          >
            <Globe className="size-3.5 shrink-0" strokeWidth={1.8} />
            <span className="text-ink">{currentLocale?.label || 'Language'}</span>
            <ChevronDown
              className={`size-3.5 shrink-0 text-ink-subtle transition-transform duration-fast ease-standard ${showLangMenu ? 'rotate-180' : ''}`}
              strokeWidth={1.8}
            />
          </button>

          {showLangMenu && (
            <div
              role="menu"
              data-state="open"
              aria-label="Language options"
              className="popover-surface absolute right-0 top-full z-dropdown mt-1.5 w-44 p-1.5"
            >
              {routes.localeOptions.map((opt) => {
                const [flag, flagAlt] = FLAG_BY_LOCALE[opt.code] || ['/flags/en.svg', opt.code];
                return (
                  <Link
                    key={opt.code}
                    href={opt.url}
                    role="menuitemradio"
                    aria-checked={opt.active}
                    onClick={() => handleSelectLocale(opt.code)}
                    className={`control-focus flex min-h-10 w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-body transition-none cursor-pointer ${
                      opt.active
                        ? 'bg-wash-press text-ink'
                        : 'text-ink-muted hover:bg-wash-strong hover:text-ink'
                    }`}
                  >
                    <img
                      src={flag}
                      alt={flagAlt}
                      className="h-4 w-5 shrink-0 rounded-sm object-cover ring-1 ring-line-subtle"
                    />
                    <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                    {opt.active && <Check className="size-3.5 shrink-0 text-ink-muted" strokeWidth={1.8} />}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </header>

      {/* 3. 中间核心毛玻璃认证卡片视口 */}
      <main className="relative z-20 flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-[450px] animate-fade-in">
          {/* 卡片外壳：严格遵循《UI_DESIGN_SYSTEM.md》深暗高斯毛玻璃、发丝高光边框与中性阴影 */}
          <div className="relative rounded-2xl bg-surface-glass backdrop-blur-2xl border border-line shadow-elevation-4 p-6 sm:p-8 overflow-hidden">
            {/* 顶部微透环境漫反射高光 */}
            <div
              className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-24 rounded-full pointer-events-none opacity-40 blur-2xl"
              style={{ background: 'radial-gradient(circle, rgba(225,29,116,0.35) 0%, transparent 70%)' }}
            />

            {/* 卡片标题区 */}
            {(title || subtitle) && (
              <div className="mb-6 text-center">
                {title && (
                  <h1 className="text-card-title sm:text-page-title font-semibold tracking-tight text-ink mb-1.5">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="text-body-sm text-ink-muted leading-relaxed">
                    {subtitle}
                  </p>
                )}
              </div>
            )}

            {/* 子表单插槽 */}
            {children}
          </div>
        </div>
      </main>

      {/* 4. 底部法务条款与版权说明 */}
      <footer className="relative z-20 w-full px-4 py-6 text-center text-label text-ink-muted flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
        <span>{copy.copyright}</span>
        <div className="flex items-center gap-3">
          <Link href={routes.termsUrl} className="hover:text-ink transition-colors underline-offset-4 hover:underline">
            {copy.terms}
          </Link>
          <span className="opacity-30">·</span>
          <Link href={routes.privacyUrl} className="hover:text-ink transition-colors underline-offset-4 hover:underline">
            {copy.privacy}
          </Link>
        </div>
      </footer>
    </div>
  );
}

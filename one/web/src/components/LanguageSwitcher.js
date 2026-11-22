'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { getLocaleFromPathname, LOCALE_CONFIGS, SUPPORTED_LOCALES, normalizeLocale } from '@/lib/locales';
import { switchLocale as switchLocaleVia } from '@/lib/client/localeSwitch';

const FLAG_BY_LOCALE = {
  en: ['/flags/en.svg', 'English'],
  'zh-CN': ['/flags/zh-cn.svg', 'Simplified Chinese'],
  'zh-TW': ['/flags/zh-tw.svg', 'Traditional Chinese'],
  'ja-JP': ['/flags/ja.svg', 'Japanese'],
  'ko-KR': ['/flags/ko.svg', 'Korean'],
  es: ['/flags/es.svg', 'Spanish'],
};

const LOCALE_OPTIONS = SUPPORTED_LOCALES.map((code) => {
  const [flag, flagAlt] = FLAG_BY_LOCALE[code] || ['/flags/en.svg', code];
  return {
    code,
    label: LOCALE_CONFIGS[code]?.nativeName || code,
    flag,
    flagAlt,
  };
});

export default function LanguageSwitcher({ className = '', showLabel = true }) {
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // 无前缀页上路径说不出语言，标签于是永远显示 English。首帧仍按路径渲染
  // （与服务端一致，避免 hydration 错位），挂载后再跟中间件真正使用的 cookie 对齐。
  const [cookieLocale, setCookieLocale] = useState(null);
  useEffect(() => {
    const hit = /(?:^|;\s*)(?:NEXT_LOCALE|locale)=([^;]+)/.exec(document.cookie);
    if (hit) setCookieLocale(normalizeLocale(decodeURIComponent(hit[1])));
  }, []);
  const pathLocale = getLocaleFromPathname(pathname);
  const currentLocale = pathLocale === 'en' && cookieLocale ? cookieLocale : pathLocale;
  const currentOption = LOCALE_OPTIONS.find((option) => option.code === currentLocale) || LOCALE_OPTIONS[0];

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function switchLocale(targetLocale) {
    setOpen(false);
    if (targetLocale === currentLocale) return;
    // cookie 写入、偏好落库、"换前缀导航还是原地刷新"全交给唯一实现：
    // 这里以前养着一份独立拷贝，在只有 /zh 真建了树的事实下必然与用户菜单那份分叉。
    const query = searchParams?.toString();
    switchLocaleVia({ targetLocale, pathname, search: query ? `?${query}` : '' });
  }

  function handleMenuKeyDown(event) {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open && (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown')) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    const currentIndex = Math.max(0, LOCALE_OPTIONS.findIndex((option) => option.code === currentLocale));
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const nextIndex = event.key === 'ArrowDown'
        ? (currentIndex + 1) % LOCALE_OPTIONS.length
        : (currentIndex - 1 + LOCALE_OPTIONS.length) % LOCALE_OPTIONS.length;
      switchLocale(LOCALE_OPTIONS[nextIndex].code);
    }
  }

  return (
    <div className={`relative inline-block ${className}`} ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleMenuKeyDown}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`control-focus group flex h-control-sm select-none items-center gap-1.5 rounded-lg border px-3 text-label font-medium transition-[background-color,border-color,color] duration-fast ease-standard cursor-pointer ${
          open
            ? 'border-brand-line bg-brand-soft text-ink'
            : 'border-line-subtle bg-wash text-ink-muted hover:border-line hover:bg-wash-strong hover:text-ink'
        }`}
        aria-label={`Switch language. Current language: ${currentOption.label}`}
      >
        <Globe className="size-3.5 shrink-0" strokeWidth={1.8} />
        {showLabel && <span className="text-ink">{currentOption.label}</span>}
        <ChevronDown
          className={`size-3.5 shrink-0 text-ink-subtle transition-transform duration-fast ease-standard ${open ? 'rotate-180' : ''}`}
          strokeWidth={1.8}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Language options"
          data-state="open"
          className="popover-surface absolute right-0 z-dropdown mt-1.5 w-44 p-1.5"
        >
          {LOCALE_OPTIONS.map((option) => {
            const selected = option.code === currentLocale;
            return (
              <button
                key={option.code}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => switchLocale(option.code)}
                className={`control-focus flex min-h-10 w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-body transition-none cursor-pointer ${
                  selected
                    ? 'bg-wash-press text-ink'
                    : 'text-ink-muted hover:bg-wash-strong hover:text-ink'
                }`}
              >
                <img
                  src={option.flag}
                  alt={option.flagAlt}
                  className="h-4 w-5 shrink-0 rounded-sm object-cover ring-1 ring-line-subtle"
                />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {selected && <Check className="size-3.5 shrink-0 text-ink-muted" strokeWidth={1.8} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

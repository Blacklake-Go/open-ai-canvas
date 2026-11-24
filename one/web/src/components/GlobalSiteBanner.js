'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { IconButton } from '@/components/ui/button';
import { matchPathLocale } from '@/lib/locales';

const appearanceClasses = {
  brand: 'border-brand-line bg-brand-soft text-brand',
  inverse: 'border-line-subtle bg-surface-inverse text-ink-inverse',
  neutral: 'border-line-subtle bg-surface text-ink-muted',
};
const bannerThemes = {
  brand: 'brand', cyan: 'brand', rose: 'brand', purple: 'brand',
  inverse: 'inverse', indigo: 'inverse',
  neutral: 'neutral', amber: 'neutral', emerald: 'neutral',
};
const glowStyles = {
  brand: 'bg-gradient-to-r from-transparent via-brand/20 to-transparent',
  cyan: 'bg-gradient-to-r from-transparent via-brand/20 to-transparent',
  amber: 'bg-gradient-to-r from-brand/15 to-transparent',
  rose: 'bg-gradient-to-l from-brand/15 to-transparent',
  aurora: 'bg-gradient-to-r from-brand/10 via-transparent to-brand/10',
};

export function bannerThemeAppearance(theme) {
  return bannerThemes[theme] || 'neutral';
}

function bannerHref(value) {
  if (!value || value === '#' || /[\\\s]/.test(value)) return null;
  if (value.startsWith('/')) return value.startsWith('//') ? null : value;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? value : null;
  } catch {
    return null;
  }
}

export function SiteAnnouncement({ banner, onClick, onDismiss, preview = false, pulse = true }) {
  const t = useTranslations('siteAnnouncement');
  const href = bannerHref(banner.linkUrl);
  const effect = banner.dynamicEffect;
  const theme = appearanceClasses[bannerThemeAppearance(banner.theme)];
  const glow = glowStyles[banner.glowStyle] || glowStyles.aurora;
  const breathe = effect === 'breathe' || effect === 'both';
  const shimmer = effect === 'shimmer' || effect === 'both';
  const actionClass = 'control-focus relative mx-auto flex h-full min-w-0 max-w-full items-center gap-2 rounded-md px-2';
  const content = (
    <>
      {banner.showPulseDot && <span aria-hidden="true" className="relative size-1.5 shrink-0 rounded-full bg-brand">
        {pulse && effect !== 'none' && <span className="absolute inset-0 rounded-full bg-brand animate-banner-radar" />}
      </span>}
      {banner.badgeText && <span className="hidden shrink-0 rounded-full bg-wash-strong px-2 text-caption font-semibold sm:inline">{banner.badgeText}</span>}
      <span className="min-w-0 truncate" title={[banner.highlightText, banner.message].filter(Boolean).join(' ')}>
        {banner.highlightText && <strong className="mr-1 font-semibold">{banner.highlightText}</strong>}
        {banner.message}
      </span>
      {href && <span className="inline-flex shrink-0 items-center gap-1 font-semibold">
        {banner.ctaText && <span className="max-w-24 truncate sm:max-w-none">{banner.ctaText}</span>}
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </span>}
    </>
  );
  const opensNewTab = banner.linkTarget === '_blank';
  return (
    <aside aria-label={t('label')} data-site-announcement={preview ? 'preview' : banner.id}
      className={`relative isolate flex h-[var(--announcement-h)] w-full items-center border-b px-2 text-body-sm ${theme}`}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {banner.ambientGlow && <div className={`absolute inset-0 ${glow} ${breathe ? 'animate-banner-aura' : effect === 'drift' ? 'animate-banner-drift' : ''}`} />}
        {shimmer && <div className="h-full w-2/3 bg-gradient-to-r from-transparent via-wash-strong to-transparent animate-banner-shimmer" />}
      </div>
      {href && !preview ? (
        <Link href={href} target={opensNewTab ? '_blank' : undefined}
          rel={opensNewTab ? 'noopener noreferrer' : undefined} onClick={onClick}
          className={`${actionClass} hover:bg-wash`}>
          {content}
        </Link>
      ) : <div className={actionClass}>{content}</div>}
      {banner.dismissible && <IconButton
        icon={X} label={t('dismiss')} variant="ghost" size="xs"
        className="relative h-full min-w-11 shrink-0 text-current"
        disabled={preview} onClick={onDismiss} />}
    </aside>
  );
}

function ActiveBanner({ banner, pathname, locale, pulse }) {
  const [dismissed, setDismissed] = useState(null);
  const impression = useRef(false);
  const storageKey = `supdance_banner_dismissed_${banner.id}`;

  useEffect(() => {
    let hidden = false;
    try {
      const timestamp = Number(localStorage.getItem(storageKey));
      const hideFor = (banner.autoHideDays ?? 7) * 86_400_000;
      hidden = banner.dismissible && timestamp > 0 && Date.now() - timestamp < hideFor;
    } catch {}
    setDismissed(hidden);
  }, [banner.autoHideDays, banner.dismissible, storageKey]);

  function track(eventType) {
    const payload = JSON.stringify({
      bannerId: banner.id, eventType, targetUrl: bannerHref(banner.linkUrl) || '',
      pagePath: pathname || '/', locale,
    });
    if (!navigator.sendBeacon?.('/api/analytics/banner-event', payload)) {
      void fetch('/api/analytics/banner-event', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true,
      }).catch(() => {});
    }
  }

  useEffect(() => {
    if (dismissed !== false || impression.current) return;
    impression.current = true;
    track('impression');
  }, [dismissed]); // The first visible impression is scoped to this mounted campaign.

  if (dismissed !== false) return null;
  return <SiteAnnouncement banner={banner} pulse={pulse}
    onClick={() => track('click')}
    onDismiss={() => {
      try { localStorage.setItem(storageKey, String(Date.now())); } catch {}
      setDismissed(true);
      track('dismiss');
    }} />;
}

export default function GlobalSiteBanner({ banner, pulse }) {
  const pathname = usePathname();
  const locale = useLocale();
  if (!banner?.enabled || !banner?.message) return null;
  const path = matchPathLocale(pathname) ? pathname.replace(/^\/[^/]+/, '') || '/' : pathname;
  if (/^\/admin(?:\/|$)/.test(path)) return null;
  const inScope = banner.targetScope === 'home' ? path === '/'
    : banner.targetScope === 'studio' ? /^\/studio(?:\/|$)/.test(path) : true;
  if (!inScope) return null;
  return <ActiveBanner key={banner.id} banner={banner} pathname={pathname} locale={locale} pulse={pulse} />;
}

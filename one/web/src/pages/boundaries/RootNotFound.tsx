import Link from 'next/link';
import { useLocation } from 'react-router';
import { Compass, Home, Sparkles } from 'lucide-react';
import { getLocaleConfig, localizeStudioPath, normalizeLocale, resolveStudioCopy } from '@/lib/locales';
import { getCookieLocaleClient } from '@/pages/helpers/pageHelpers';
import enCopy from '@/messages/en/not-found.json';
import zhCopy from '@/messages/zh/not-found.json';
import jaCopy from '@/messages/ja-JP/not-found.json';
import koCopy from '@/messages/ko-KR/not-found.json';
import zhTwCopy from '@/messages/zh-TW/not-found.json';
import esCopy from '@/messages/es/not-found.json';

const BUNDLES: Record<string, any> = {
  en: enCopy,
  'zh-CN': zhCopy,
  'ja-JP': jaCopy,
  'ko-KR': koCopy,
  'zh-TW': zhTwCopy,
  es: esCopy,
};

function detectNotFoundLocale(pathname: string): string {
  const seg = pathname.split('/').filter(Boolean)[0];
  if (seg === 'zh' || seg === 'zh-cn') return 'zh-CN';
  if (seg === 'ja-JP' || seg === 'ja') return 'ja-JP';
  if (seg === 'ko-KR' || seg === 'ko') return 'ko-KR';
  if (seg === 'zh-TW') return 'zh-TW';
  if (seg === 'es') return 'es';
  const cookieLoc = getCookieLocaleClient();
  if (cookieLoc) return getLocaleConfig(cookieLoc).code;
  if (typeof navigator !== 'undefined' && navigator.language) {
    return normalizeLocale(navigator.language);
  }
  return 'en';
}

export default function RootNotFound() {
  const { pathname } = useLocation();
  const locale = detectNotFoundLocale(pathname);
  const copy = resolveStudioCopy(enCopy, BUNDLES[locale], locale);
  const rootPath = getLocaleConfig(locale).rootPath;

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-6 py-24">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-10 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-xl border border-brand-line bg-brand-soft text-brand">
          <Compass className="size-7" />
        </div>
        <p className="mt-6 text-caption font-semibold uppercase tracking-widest text-brand">404</p>
        <h1 className="mt-2 text-section-title text-ink">{copy.title}</h1>
        <p className="mt-3 text-body-sm leading-6 text-ink-muted">{copy.description}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={localizeStudioPath(locale)}
            className="inline-flex h-control-md items-center gap-1.5 rounded-lg bg-brand px-5 text-label font-semibold text-ink-on-accent transition-colors duration-base hover:bg-brand-hover"
          >
            <Sparkles className="size-3.5" />
            {copy.openStudio}
          </Link>
          <Link
            href={rootPath || '/'}
            className="inline-flex h-control-md items-center gap-1.5 rounded-lg border border-line bg-raised px-5 text-label font-semibold text-ink transition-colors duration-base hover:border-brand-line"
          >
            <Home className="size-3.5" />
            {copy.backHome}
          </Link>
        </div>
      </div>
    </main>
  );
}

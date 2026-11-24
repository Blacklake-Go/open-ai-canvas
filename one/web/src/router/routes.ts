import baselinePages from './baseline-pages.json';

export type LocaleCode = 'en' | 'zh-CN' | 'ja-JP' | 'ko-KR' | 'zh-TW' | 'es';

export interface LocaleConfig {
  code: LocaleCode;
  nativeName: string;
  htmlLang: string;
  rootPath: '' | '/zh' | '/ja-JP' | '/ko-KR' | '/zh-TW' | '/es';
  aliases: string[];
}

export const LOCALE_CONFIGS: readonly LocaleConfig[] = [
  { code: 'en', nativeName: 'English', htmlLang: 'en', rootPath: '', aliases: [] },
  { code: 'zh-CN', nativeName: '简体中文', htmlLang: 'zh-CN', rootPath: '/zh', aliases: ['zh', 'zh-cn'] },
  { code: 'ja-JP', nativeName: '日本語', htmlLang: 'ja-JP', rootPath: '/ja-JP', aliases: ['ja'] },
  { code: 'ko-KR', nativeName: '한국어', htmlLang: 'ko-KR', rootPath: '/ko-KR', aliases: ['ko'] },
  { code: 'zh-TW', nativeName: '繁體中文', htmlLang: 'zh-TW', rootPath: '/zh-TW', aliases: ['zh-tw'] },
  { code: 'es', nativeName: 'Español', htmlLang: 'es', rootPath: '/es', aliases: ['es', 'es-es', 'es-la', 'es-mx', 'es-ar'] },
] as const;

export const NON_EN_LOCALE_ROOTS = ['/zh', '/ja-JP', '/ko-KR', '/zh-TW', '/es'] as const;

export const LOCALE_BY_SEGMENT: Record<string, LocaleConfig> = (() => {
  const map: Record<string, LocaleConfig> = {};
  for (const cfg of LOCALE_CONFIGS) {
    map[cfg.code.toLowerCase()] = cfg;
    if (cfg.rootPath) {
      map[cfg.rootPath.slice(1).toLowerCase()] = cfg;
    }
    for (const alias of cfg.aliases) {
      map[alias.toLowerCase()] = cfg;
    }
  }
  return map;
})();

export const STUDIO_TAB_IDS = [
  'image',
  'headshot',
  'layers',
  'ai-influencer',
  'cinema',
  'video',
  'clipping',
  'motion-control',
  'vibe-motion',
  'lipsync',
  'body-swap',
  'marketing',
  'audio',
  'agents',
  'workflows',
  'design-agent',
  'apps',
  'character',
  'motion-agent',
] as const;

export type StudioTabId = (typeof STUDIO_TAB_IDS)[number];

export const STUDIO_TAB_ALIASES: Record<string, StudioTabId> = {
  character: 'ai-influencer',
  'motion-agent': 'motion-control',
  workflow: 'workflows',
  canvas: 'layers',
  recast: 'body-swap',
};

export const STUDIO_ALIAS_SEGMENTS = ['workflow', 'character', 'motion-agent'] as const;

export const UNPREFIXED_TOP_SEGMENTS = [
  'about', 'account', 'admin', 'agents', 'assets', 'assistant', 'benefits', 'billing',
  'call-api', 'canvas-tools', 'change-password', 'community', 'coins',
  'content-policy', 'creations', 'credits', 'design-system', 'embed-auth',
  'feedback', 'forgot-password', 'lab', 'login', 'models', 'onboarding',
  'pricing', 'privacy', 'profile', 'refund', 'register', 'reset-password',
  'sitemap.xml', 'studio', 'subscription', 'terms', 'u', 'workflow',
] as const;

export interface BaselinePageRoute {
  file: string;
  urlPattern: string;
  basePath: string;
  isLocalizedTree: boolean;
  authLevel: string;
  indexPolicy: string;
}

export const BASELINE_PAGE_ROUTES: readonly BaselinePageRoute[] = baselinePages as BaselinePageRoute[];

export function resolveStudioTab(rawTab: string | null | undefined): StudioTabId | null {
  const clean = (rawTab || '').trim().toLowerCase();
  if (!clean) return 'image';
  if (clean in STUDIO_TAB_ALIASES) {
    return STUDIO_TAB_ALIASES[clean];
  }
  if ((STUDIO_TAB_IDS as readonly string[]).includes(clean)) {
    return clean as StudioTabId;
  }
  return null;
}

export function buildLocalizedPath(locale: LocaleCode, basePath: string): string {
  const cfg = LOCALE_CONFIGS.find((c) => c.code === locale);
  const rootPath = cfg ? cfg.rootPath : '';
  const cleanBase = basePath.startsWith('/') ? basePath : `/${basePath}`;
  if (cleanBase === '/') {
    return rootPath || '/';
  }
  return `${rootPath}${cleanBase}`;
}

export interface RedirectDecision {
  status: 307 | 308;
  location: string;
}

/**
 * Mirrors Supdance Pro/middleware.js exact canonicalization and redirect semantics.
 */
export function computeCanonicalRedirect(
  pathname: string,
  search = '',
  options?: { cookieLocale?: string }
): RedirectDecision | null {
  // 0.5. `/canvas`, `/canvas/*`, `/:locale/canvas*` -> https://canvas.supdance.com${canvasPath}${search} (308)
  if (
    pathname === '/canvas' ||
    pathname.startsWith('/canvas/') ||
    /^\/[a-zA-Z]{2}(?:-[a-zA-Z]{2})?\/canvas(?:\/.*)?$/.test(pathname)
  ) {
    const canvasPath = pathname.replace(/^\/[a-zA-Z]{2}(?:-[a-zA-Z]{2})?(?=\/|$)/, '') || '/canvas';
    return { status: 308, location: `https://canvas.supdance.com${canvasPath}${search}` };
  }

  // 0.6. `/:locale?/(image|video|audio|music)/?` -> `${rootPath}/studio?tab=...` preserving query params (307)
  const directTabMatch = pathname.match(/^(?:\/([a-zA-Z]{2}(?:-[a-zA-Z]{2})?))?\/(image|video|audio|music)\/?$/i);
  if (directTabMatch) {
    const pathLocale = directTabMatch[1];
    const rawTab = directTabMatch[2].toLowerCase();
    const tab = rawTab === 'music' ? 'audio' : rawTab;
    const matchedLocale = pathLocale ? LOCALE_BY_SEGMENT[pathLocale.toLowerCase()] : undefined;
    const rootPath = matchedLocale && matchedLocale.code !== 'en' ? matchedLocale.rootPath : '';
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    params.set('tab', tab);
    return { status: 307, location: `${rootPath}/studio?${params.toString()}` };
  }

  // `/en` or `/en/...` -> unprefixed default English (308)
  if (pathname === '/en' || pathname.startsWith('/en/')) {
    const rest = pathname.slice(3) || '/';
    return { status: 308, location: `${rest}${search}` };
  }

  // `/zh` or `/zh/` -> `/` (matching middleware.js lines 168-174)
  if (pathname === '/zh' || pathname === '/zh/') {
    return { status: 308, location: `/${search}` };
  }

  const parts = pathname.split('/').filter(Boolean);
  if (parts.length > 0) {
    const first = parts[0];
    const matchedLocale = LOCALE_BY_SEGMENT[first.toLowerCase()];

    // Check locale alias or non-canonical casing (e.g. `/zh-cn/pricing` -> `/zh/pricing`, `/ja/pricing` -> `/ja-JP/pricing`)
    if (matchedLocale) {
      const canonicalSeg = matchedLocale.rootPath ? matchedLocale.rootPath.slice(1) : '';
      const restPath = '/' + parts.slice(1).join('/');
      if (canonicalSeg && first !== canonicalSeg) {
        const target = parts.length === 1 ? matchedLocale.rootPath : `${matchedLocale.rootPath}${restPath}`;
        return { status: 308, location: `${target}${search}` };
      }
      // Localized routes like `/zh/studio` and `/zh/login` are served directly (never stripped).
      return null;
    }
  }

  // Step 5 in Supdance Pro/middleware.js: unprefixed `/studio*` or `/login` redirects to
  // localized root when query (?lang= / ?locale=) or cookie locale resolves to non-'en'.
  if (pathname === '/studio' || pathname.startsWith('/studio/') || pathname === '/login') {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const hint = params.get('lang') || params.get('locale') || options?.cookieLocale || '';
    const hintLocale = hint ? LOCALE_BY_SEGMENT[hint.trim().toLowerCase()] : undefined;
    if (hintLocale && hintLocale.code !== 'en' && hintLocale.rootPath) {
      return { status: 307, location: `${hintLocale.rootPath}${pathname}${search}` };
    }
  }

  return null;
}

/**
 * Expands Supdance Pro's 145 App Router `page.js` entries into React Router paths
 * across unprefixed English routes, `/admin/*`, and all non-English locale roots.
 */
export function expandReactRouterPatterns(): string[] {
  const out = new Set<string>();

  for (const page of BASELINE_PAGE_ROUTES) {
    if (page.isLocalizedTree) {
      const suffix = page.urlPattern.replace(/^\/:loc/, '') || '';
      for (const root of NON_EN_LOCALE_ROOTS) {
        const full = `${root}${suffix}`
          .replace(/\/\*\*$/, '/*')
          .replace(/\/\*$/, '/*');
        out.add(full);
      }
    } else {
      const rrPath = page.urlPattern
        .replace(/\/\*\*$/, '/*')
        .replace(/\/\*$/, '/*');
      out.add(rrPath);
    }
  }

  for (const tab of STUDIO_TAB_IDS) {
    out.add(`/studio/${tab}`);
  }
  for (const alias of STUDIO_ALIAS_SEGMENTS) {
    out.add(`/studio/${alias}`);
  }

  return [...out].sort();
}

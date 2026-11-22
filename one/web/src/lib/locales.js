// Locale registry for the standalone supdance studio app.
//
// This mirrors the additive-route architecture documented in the main
// muapi client (../../../docs/localization.md): English stays the
// default, unprefixed route tree; every other locale gets a parallel
// `/[[locale]]/...` route tree that reuses the same components with
// translated copy passed as a prop. There is no i18n routing library
// (no next-intl) — just a registry + plain JSON message bundles + a
// recursive merge so a partial translation still renders (falls back to
// English for any missing key).
//
// Adding a new locale: register it here with its message imports, then
// add a matching `app/<locale>/...` route wrapper tree that passes
// `locale="<locale>"` into the shared components. Do not add
// `locale === 'zh'`-style branches in shared components — read copy from
// this registry instead.
import enCommon from '../messages/en/common.json' with { type: 'json' };
import zhCommon from '../messages/zh/common.json' with { type: 'json' };
import jaCommon from '../messages/ja-JP/common.json' with { type: 'json' };
import koCommon from '../messages/ko-KR/common.json' with { type: 'json' };
import zhTwCommon from '../messages/zh-TW/common.json' with { type: 'json' };
import esCommon from '../messages/es/common.json' with { type: 'json' };

export const DEFAULT_LOCALE = 'en';

// Locale values are deliberately kept as stable English identifiers. The
// legacy `zh` value remains an input alias for backwards compatibility, but
// all new state and responses use the explicit BCP-47 locale `zh-CN`.
export const LOCALE_ALIASES = {
  zh: 'zh-CN',
  'zh-cn': 'zh-CN',
  'zh-tw': 'zh-TW',
  ja: 'ja-JP',
  ko: 'ko-KR',
  es: 'es',
  'es-es': 'es',
  'es-la': 'es',
  'es-mx': 'es',
  'es-ar': 'es',
};

export const LOCALE_CONFIGS = {
  en: {
    code: 'en',
    nativeName: 'English',
    htmlLang: 'en',
    rootPath: '',
    messages: {
      common: enCommon,
    },
  },
  'zh-CN': {
    code: 'zh-CN',
    nativeName: '简体中文',
    htmlLang: 'zh-CN',
    rootPath: '/zh',
    messages: {
      common: zhCommon,
    },
  },
  'ja-JP': {
    code: 'ja-JP',
    nativeName: '日本語',
    htmlLang: 'ja-JP',
    rootPath: '/ja-JP',
    messages: {
      common: jaCommon,
    },
  },
  'ko-KR': {
    code: 'ko-KR',
    nativeName: '한국어',
    htmlLang: 'ko-KR',
    rootPath: '/ko-KR',
    messages: {
      common: koCommon,
    },
  },
  'zh-TW': {
    code: 'zh-TW',
    nativeName: '繁體中文',
    htmlLang: 'zh-TW',
    rootPath: '/zh-TW',
    messages: {
      common: zhTwCommon,
    },
  },
  es: {
    code: 'es',
    nativeName: 'Español',
    htmlLang: 'es',
    rootPath: '/es',
    messages: {
      common: esCommon,
    },
  },
};

export const SUPPORTED_LOCALES = Object.keys(LOCALE_CONFIGS);

export function normalizeLocale(locale) {
  const value = String(locale || '').trim();
  if (LOCALE_CONFIGS[value]) return value;
  return LOCALE_ALIASES[value.toLowerCase()] || DEFAULT_LOCALE;
}

export function isSupportedLocale(locale) {
  const value = String(locale || '').trim();
  return Boolean(value) && (Object.prototype.hasOwnProperty.call(LOCALE_CONFIGS, value)
    || Object.prototype.hasOwnProperty.call(LOCALE_ALIASES, value.toLowerCase()));
}

// Registered locale prefixes, longest first, so `/zh-CN` (if ever added)
// would not falsely match under a shorter `/zh` prefix check.
const LOCALE_PREFIXES = Object.values(LOCALE_CONFIGS)
  .filter((config) => config.rootPath)
  .map((config) => config.rootPath)
  .sort((a, b) => b.length - a.length);

// Mirrors client/lib's getLocaleFromPathname pattern: derive the active
// locale purely from the URL path, no cookies/headers/negotiation.
export function getLocaleFromPathname(pathname) {
  if (!pathname) return DEFAULT_LOCALE;
  for (const prefix of LOCALE_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      const locale = Object.values(LOCALE_CONFIGS).find((c) => c.rootPath === prefix);
      return locale?.code || DEFAULT_LOCALE;
    }
  }
  const firstSegment = pathname.split('/')[1];
  if (firstSegment && isSupportedLocale(firstSegment)) {
    return normalizeLocale(firstSegment);
  }
  return DEFAULT_LOCALE;
}

export function getLocaleConfig(locale) {
  return LOCALE_CONFIGS[normalizeLocale(locale)] || LOCALE_CONFIGS[DEFAULT_LOCALE];
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Generic recursive merge: translated arrays replace the English array
// wholesale (locale-owned unit), plain objects merge key-by-key so a
// partial bundle still falls back to English per-key rather than
// per-namespace.
export function mergeCopy(base, override) {
  if (!override) return base;
  if (!base) return override;
  if (!isPlainObject(base) || !isPlainObject(override)) return override;

  const merged = { ...base };
  for (const key of Object.keys(override)) {
    merged[key] = isPlainObject(base[key]) && isPlainObject(override[key])
      ? mergeCopy(base[key], override[key])
      : override[key];
  }
  return merged;
}

// Returns the `common` namespace for a locale, merged over the English
// defaults so every key is always present.
export function getCommonCopy(locale) {
  const config = getLocaleConfig(locale);
  if (config.code === DEFAULT_LOCALE) return LOCALE_CONFIGS[DEFAULT_LOCALE].messages.common;
  return mergeCopy(LOCALE_CONFIGS[DEFAULT_LOCALE].messages.common, config.messages.common);
}

// Loads and merges a per-studio-tab namespace (messages/{locale}/studio/{tabId}.json)
// over its English default. Namespaces are loaded lazily by each Studio
// component (`getStudioCopy('imageStudio', enBundle, zhBundle, locale)`)
// so this file doesn't need to import every tab's bundle up front.
export function resolveStudioCopy(enBundle, localeBundle, locale) {
  if (locale === DEFAULT_LOCALE) return enBundle;
  return mergeCopy(enBundle, localeBundle);
}

// Builds the studio path for a given tab or path under the active locale's root,
// e.g. localizeStudioPath('zh', 'video') -> '/zh/studio/video'
//      localizeStudioPath('/studio?tab=video', 'zh') -> '/zh/studio?tab=video'
export function localizeStudioPath(localeOrPath, tabIdOrLocale) {
  // Pattern A: First argument is an absolute path, e.g. '/studio?tab=video'
  if (typeof localeOrPath === 'string' && localeOrPath.startsWith('/')) {
    const rawPath = localeOrPath;
    const targetLocale = tabIdOrLocale || DEFAULT_LOCALE;
    const config = getLocaleConfig(targetLocale);
    let cleanPath = rawPath;
    for (const prefix of LOCALE_PREFIXES) {
      if (cleanPath === prefix || cleanPath.startsWith(`${prefix}/`)) {
        cleanPath = cleanPath.slice(prefix.length) || '/';
        break;
      }
    }
    if (!cleanPath.startsWith('/')) cleanPath = `/${cleanPath}`;
    return config.rootPath ? `${config.rootPath}${cleanPath}` : cleanPath;
  }

  // Pattern B: First argument is tabId/query and second argument is locale, e.g. ('video', 'zh')
  if (
    typeof tabIdOrLocale === 'string' &&
    isSupportedLocale(tabIdOrLocale) &&
    !isSupportedLocale(localeOrPath)
  ) {
    const tabId = localeOrPath;
    const targetLocale = tabIdOrLocale;
    const config = getLocaleConfig(targetLocale);
    let suffix = '/studio';
    if (tabId) {
      if (tabId.startsWith('?')) {
        suffix = `/studio${tabId}`;
      } else if (tabId.startsWith('/')) {
        suffix = tabId;
      } else {
        suffix = `/studio/${tabId}`;
      }
    }
    return `${config.rootPath}${suffix}`;
  }

  // Pattern C: Standard (locale, tabId)
  const config = getLocaleConfig(localeOrPath);
  let suffix = '/studio';
  if (tabIdOrLocale) {
    if (typeof tabIdOrLocale === 'string') {
      if (tabIdOrLocale.startsWith('?')) {
        suffix = `/studio${tabIdOrLocale}`;
      } else if (tabIdOrLocale.startsWith('/')) {
        suffix = tabIdOrLocale;
      } else {
        suffix = `/studio/${tabIdOrLocale}`;
      }
    } else {
      suffix = `/studio/${tabIdOrLocale}`;
    }
  }
  return `${config.rootPath}${suffix}`;
}

/**
 * 路径自己声明的语言（无前缀的英文树返回 null）。
 *
 * 与 getLocaleFromPathname 的区别就是那个 null：语言切换器需要知道「这个 URL
 * 到底有没有带前缀」，才能决定是保留用户偏好还是被 URL 覆盖。把无前缀路径也
 * 报成 en 会让所有非英文用户在 /studio 里被踢回英文。
 */
export function matchPathLocale(pathname) {
  if (!pathname) return null;
  for (const prefix of LOCALE_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      const config = Object.values(LOCALE_CONFIGS).find((c) => c.rootPath === prefix);
      if (config) return config.code;
    }
  }
  const firstSegment = pathname.split('/')[1];
  return isSupportedLocale(firstSegment) ? normalizeLocale(firstSegment) : null;
}

function localeFromSearch(search) {
  if (!search) return null;
  const raw = String(search);
  const query = raw.startsWith('?') || raw.startsWith('#') ? raw.slice(1) : raw;
  for (const pair of query.split('&')) {
    const [key, value] = pair.split('=');
    if ((key === 'locale' || key === 'lang') && value) {
      const decoded = decodeURIComponent(value.replace(/\+/g, ' '));
      if (isSupportedLocale(decoded)) return normalizeLocale(decoded);
    }
  }
  return null;
}

/**
 * 客户端当前应视为激活的语言：显式 prop > URL 前缀 > ?locale= > 用户偏好 > 默认。
 *
 * URL 前缀排在用户偏好之前，因为带前缀的链接是用户刚点出来的；偏好只在无前缀
 * 路径上兜底（未登录时 userLocale 来自 NEXT_LOCALE cookie）。
 */
export function resolveClientLocale({ explicit, pathname, search, userLocale } = {}) {
  if (explicit && isSupportedLocale(explicit)) return normalizeLocale(explicit);
  const fromPath = matchPathLocale(pathname);
  if (fromPath) return fromPath;
  const fromSearch = localeFromSearch(search);
  if (fromSearch) return fromSearch;
  if (userLocale && isSupportedLocale(userLocale)) return normalizeLocale(userLocale);
  if (typeof document !== 'undefined') {
    const m = document.cookie.match(/(?:^|;\s*)(?:NEXT_LOCALE|locale)=([^;]+)/);
    if (m && isSupportedLocale(decodeURIComponent(m[1]))) {
      return normalizeLocale(decodeURIComponent(m[1]));
    }
  }
  return DEFAULT_LOCALE;
}

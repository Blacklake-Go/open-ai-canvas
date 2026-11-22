import { getRequestConfig } from 'next-intl/server';
import enMessages from '../messages/en/common.json' with { type: 'json' };
import zhMessages from '../messages/zh/common.json' with { type: 'json' };
import jaMessages from '../messages/ja-JP/common.json' with { type: 'json' };
import koMessages from '../messages/ko-KR/common.json' with { type: 'json' };
import zhTwMessages from '../messages/zh-TW/common.json' with { type: 'json' };
import esMessages from '../messages/es/common.json' with { type: 'json' };
import {
  DEFAULT_LOCALE,
  LOCALE_CONFIGS,
  normalizeLocale,
  resolveClientLocale,
} from '../lib/locales.js';

export const MESSAGES = {
  en: enMessages,
  'zh-CN': zhMessages,
  'ja-JP': jaMessages,
  'ko-KR': koMessages,
  'zh-TW': zhTwMessages,
  es: esMessages,
};

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base, override) {
  const result = { ...base };
  for (const [key, value] of Object.entries(override || {})) {
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = deepMerge(result[key], value);
    } else if (value !== undefined && value !== '') {
      result[key] = value;
    }
  }
  return result;
}

export function mergeCommonMessages(baseMessages, overrides = {}) {
  const result = deepMerge({}, baseMessages);
  for (const [dottedKey, value] of Object.entries(overrides || {})) {
    const cleanKey = dottedKey.startsWith('common.') ? dottedKey.slice('common.'.length) : dottedKey;
    if (!cleanKey || typeof value !== 'string' || !value) continue;
    const parts = cleanKey.split('.');
    let cursor = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!isPlainObject(cursor[parts[i]])) {
        cursor[parts[i]] = {};
      }
      cursor = cursor[parts[i]];
    }
    cursor[parts[parts.length - 1]] = value;
  }
  return result;
}

export function getMessagesForLocale(locale = DEFAULT_LOCALE, overrides = {}) {
  const normalized = normalizeLocale(locale);
  const resolved = LOCALE_CONFIGS[normalized] ? normalized : DEFAULT_LOCALE;
  const base = MESSAGES[resolved] || MESSAGES[DEFAULT_LOCALE];
  return mergeCommonMessages(base, overrides);
}

export default getRequestConfig(async (params) => {
  const requested = params?.requestLocale ? await params.requestLocale : undefined;
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const search = typeof window !== 'undefined' ? window.location.search : '';
  const locale = resolveClientLocale({
    explicit: requested,
    pathname,
    search,
  });
  const resolved = LOCALE_CONFIGS[locale] ? locale : DEFAULT_LOCALE;

  return {
    locale: resolved,
    messages: getMessagesForLocale(resolved),
  };
});

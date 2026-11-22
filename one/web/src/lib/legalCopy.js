/**
 * Legal copy registry for the four compliance pages.
 *
 * All six launch locales live in `messages/<locale>/legal.json`, so the same
 * bundles are read by three consumers at once: these pages, the admin
 * language workbench (`lib/i18nCatalog.js` walks `messages/<locale>/*.json`),
 * and the CI parity gate (`tests/i18n-coverage-gates.test.mjs`). Keeping the
 * copy in the catalog rather than inline in a component is what makes
 * "translated and published" verifiable instead of anecdotal.
 *
 * English is the key/shape source of truth: `mergeCopy` overlays the locale
 * bundle on top of it, so a partially translated locale still renders and a
 * key added to `en` can never surface as `undefined`.
 *
 * Deliberately not imported by `lib/locales.js`: that file is loaded by the
 * middleware on every request, and the legal bundles are ~90 KB of prose.
 */
import enLegal from '../messages/en/legal.json' with { type: 'json' };
import zhLegal from '../messages/zh/legal.json' with { type: 'json' };
import jaLegal from '../messages/ja-JP/legal.json' with { type: 'json' };
import koLegal from '../messages/ko-KR/legal.json' with { type: 'json' };
import zhTwLegal from '../messages/zh-TW/legal.json' with { type: 'json' };
import esLegal from '../messages/es/legal.json' with { type: 'json' };

import { DEFAULT_LOCALE, getLocaleConfig, mergeCopy } from './locales.js';

const LEGAL_MESSAGES = {
  [DEFAULT_LOCALE]: enLegal,
  'zh-CN': zhLegal,
  'ja-JP': jaLegal,
  'ko-KR': koLegal,
  'zh-TW': zhTwLegal,
  es: esLegal,
};

/** Page id → URL segment. `contentPolicy` is the only one that differs. */
export const LEGAL_PAGES = Object.freeze({
  terms: 'terms',
  privacy: 'privacy',
  refund: 'refund',
  contentPolicy: 'content-policy',
});

/**
 * Version stamps are language-neutral document metadata, not copy: putting
 * them in the catalog would make every locale byte-identical to English and
 * trip the "untranslated fallback" gate for no reason.
 */
export const LEGAL_VERSIONS = Object.freeze({
  terms: 'v2.4 · 2026-09-16',
  privacy: 'v2.6 · 2026-10-24',
  refund: 'v2.4 · 2026-09-16',
  contentPolicy: 'v2.4 · 2026-09-16',
});

/** Sections the footer of each page links to, in display order. */
export const LEGAL_FOOTER_LINKS = Object.freeze([
  { page: 'terms', linkKey: 'terms' },
  { page: 'privacy', linkKey: 'privacy' },
  { page: 'refund', linkKey: 'refund' },
  { page: 'contentPolicy', linkKey: 'contentPolicy' },
]);

export function getLegalCopy(locale) {
  const config = getLocaleConfig(locale);
  if (config.code === DEFAULT_LOCALE) return enLegal;
  return mergeCopy(enLegal, LEGAL_MESSAGES[config.code] || enLegal);
}

export function getLegalMetadata(locale, page) {
  const copy = getLegalCopy(locale);
  const title = copy?.meta?.[page]?.title;
  return { title: title || `${copy?.shared?.headerTitle || 'Legal'} | supdance` };
}

/**
 * `s1…s6` / `p1…p4` are ordered by letter group and then numeric suffix, not by
 * insertion order: JSON round-trips and hand edits reshuffle object keys, and a
 * legal document must not reorder its clauses because someone re-saved a file.
 * Grouping by prefix first keeps `p10` after `p2` without letting it jump ahead
 * of `s3`.
 */
export function orderedIds(container) {
  const group = (key) => key.replace(/\d+/g, '').toLowerCase();
  const number = (key) => Number(key.match(/\d+/)[0]);
  return Object.keys(container || {})
    .filter((key) => /^[a-z]+\d+$/i.test(key))
    .sort((a, b) => group(a).localeCompare(group(b), 'en') || number(a) - number(b) || a.localeCompare(b, 'en'));
}

/** Section list for one page, already resolved for the locale. */
export function getLegalSections(locale, page) {
  const copy = getLegalCopy(locale);
  const sections = copy?.[page]?.sections || {};
  return orderedIds(sections).map((id) => {
    const section = sections[id] || {};
    const body = section.body || {};
    return {
      id,
      title: section.title,
      paragraphs: orderedIds(body).map((paragraphId) => ({ id: paragraphId, text: body[paragraphId] })),
    };
  });
}

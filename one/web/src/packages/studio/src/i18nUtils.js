// Tiny, dependency-free locale-copy resolver shared by every Studio
// component in this package.
//
// Design: each component ships its own English default bundle (source of
// truth for keys/shape) plus one override bundle per additional locale.
// `resolveCopy` deep-merges the override over English so a partial
// translation still renders — missing keys fall back to English rather
// than showing `undefined`. This mirrors the merge behavior in the host
// app's `lib/locales.js` (see Open-Higgsfield-ai/lib/locales.js) but is
// duplicated here (not imported) so this package has no dependency on the
// consuming app's file layout — it only needs a `locale` string prop.
//
// Adding a new locale to a component: add `../messages/<locale>/<name>.json`
// next to the existing `en`/`zh` bundles, import it, and pass it into
// `resolveCopy(en, localeBundles[locale], locale)`. No changes needed here.

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const runtimeCatalogs = Object.create(null);

export function setRuntimeLocaleCatalog(locale, catalog) {
  if (!locale || !catalog || typeof catalog !== 'object') return;
  runtimeCatalogs[locale] = catalog;
}

function scoreBundle(candidate, reference) {
  if (!isPlainObject(candidate) || !isPlainObject(reference)) return 0;
  return Object.keys(reference).reduce((score, key) => score + (Object.prototype.hasOwnProperty.call(candidate, key) ? 1 : 0), 0);
}

function findRuntimeBundle(locale, reference) {
  const studioBundles = runtimeCatalogs[locale]?.studio;
  if (!studioBundles || !isPlainObject(reference)) return null;
  let best = null;
  let bestScore = 0;
  for (const candidate of Object.values(studioBundles)) {
    const score = scoreBundle(candidate, reference);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

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

// `en` is the required default bundle; `localeBundle` is the override for
// the active `locale` (or undefined/null when only English exists yet, or
// when locale === 'en'). Always returns a fully-populated copy object.
export function resolveCopy(en, localeBundle, locale) {
  if (!locale || locale === 'en') return en;

  // The host application uses explicit BCP-47 locale values while the
  // original Studio package used the legacy `zh` alias. Accept both without
  // ever applying Simplified Chinese to Japanese, Korean, or Traditional
  // Chinese screens. A component may pass either its legacy `zh` bundle or a
  // map such as `{ 'zh-CN': zh, 'ja-JP': ja }` while migrating bundles.
  const normalizedLocale = locale === 'zh' ? 'zh-CN' : locale;
  const runtimeBundle = findRuntimeBundle(normalizedLocale, en);
  if (runtimeBundle) return mergeCopy(en, runtimeBundle);

  if (!localeBundle) return en;

  // 1. Direct match on normalizedLocale
  if (Object.prototype.hasOwnProperty.call(localeBundle, normalizedLocale)) {
    return mergeCopy(en, localeBundle[normalizedLocale]);
  }

  // 2. Direct match on raw locale
  if (Object.prototype.hasOwnProperty.call(localeBundle, locale)) {
    return mergeCopy(en, localeBundle[locale]);
  }

  // 3. Match aliases: es <-> es-ES, ja <-> ja-JP, ko <-> ko-KR, zh <-> zh-CN
  const baseLang = String(locale).toLowerCase().split('-')[0];
  const aliasCandidates = [
    baseLang,
    `${baseLang}-${baseLang.toUpperCase()}`,
    baseLang === 'es' ? 'es-ES' : undefined,
    baseLang === 'ja' ? 'ja-JP' : undefined,
    baseLang === 'ko' ? 'ko-KR' : undefined,
    baseLang === 'zh' ? 'zh-CN' : undefined,
  ].filter(Boolean);

  for (const candidate of aliasCandidates) {
    if (Object.prototype.hasOwnProperty.call(localeBundle, candidate)) {
      return mergeCopy(en, localeBundle[candidate]);
    }
  }

  // 4. Case-insensitive key match
  for (const [key, val] of Object.entries(localeBundle)) {
    if (key.toLowerCase() === normalizedLocale.toLowerCase() || key.toLowerCase() === locale.toLowerCase()) {
      return mergeCopy(en, val);
    }
  }

  // 5. Legacy zh-CN bundle passed directly
  if (normalizedLocale === 'zh-CN' && !localeBundle['zh-CN']) {
    return mergeCopy(en, localeBundle);
  }

  return en;
}

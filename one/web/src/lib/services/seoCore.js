/**
 * SEO Core Module
 * Client-safe constants, schemas, tag normalization and validators.
 * Free of server-only / database dependencies.
 */

export const DEFAULT_SEO_CONFIG = {
  title: 'SupDance — Free AI Image & Video Studio',
  titleTemplate: '%s | SupDance AI Studio',
  description: 'Generate AI images and videos using 200+ models — Flux, Midjourney, Kling, Veo, Seedance and more.',
  keywords: ['AI Image Generator', 'AI Video', 'Flux AI', 'Midjourney Online', 'Kling AI', 'Text to Video', 'SupDance'],
  canonicalBase: 'https://www.supdance.com',
  openGraph: {
    title: 'SupDance — Free AI Image & Video Studio',
    description: 'Generate AI images and videos using 200+ models...',
    image: 'https://www.supdance.com/og-image.png',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@SupDanceAI',
    creator: '@SupDanceAI',
  },
  verification: {
    google: '',
    baidu: '',
    bing: '',
    yandex: '',
  },
};

export const DEFAULT_INDEXABLE_ROUTES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/studio', priority: '0.9', changefreq: 'daily' },
  { path: '/models', priority: '0.9', changefreq: 'daily' },
  { path: '/community', priority: '0.8', changefreq: 'daily' },
  { path: '/pricing', priority: '0.8', changefreq: 'weekly' },
  { path: '/creations', priority: '0.7', changefreq: 'daily' },
  { path: '/about', priority: '0.6', changefreq: 'monthly' },
  { path: '/feedback', priority: '0.5', changefreq: 'monthly' },
  { path: '/coins', priority: '0.6', changefreq: 'weekly' },
  { path: '/benefits', priority: '0.6', changefreq: 'weekly' },
  { path: '/credits', priority: '0.6', changefreq: 'weekly' },
  { path: '/privacy', priority: '0.3', changefreq: 'monthly' },
  { path: '/terms', priority: '0.3', changefreq: 'monthly' },
  { path: '/refund', priority: '0.3', changefreq: 'monthly' },
  { path: '/content-policy', priority: '0.3', changefreq: 'monthly' },
];

/**
 * Normalizes search engine meta verification tags.
 * If input contains `<meta ... content="TOKEN" ...>`, extracts pure TOKEN.
 * If raw token, strips surrounding whitespace, quotes and HTML tags.
 */
export function normalizeVerificationTag(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const contentMatch = trimmed.match(/content=["']([^"']+)["']/i);
  if (contentMatch && contentMatch[1]) {
    return contentMatch[1].trim();
  }

  const cleanToken = trimmed.replace(/^<[^>]+>|<\/[^>]+>$/g, '').trim();
  return cleanToken;
}

/**
 * Normalizes arbitrary SEO configuration into consistent schema.
 */
export function normalizeSeoConfig(input) {
  const c = input || {};
  let keywords = c.keywords;
  if (typeof keywords === 'string') {
    keywords = keywords
      .split(/[,，]/)
      .map((k) => k.trim())
      .filter(Boolean);
  } else if (!Array.isArray(keywords)) {
    keywords = DEFAULT_SEO_CONFIG.keywords;
  } else {
    keywords = keywords.map((k) => String(k).trim()).filter(Boolean);
  }

  let canonicalBase = String(c.canonicalBase || DEFAULT_SEO_CONFIG.canonicalBase).trim();
  if (canonicalBase.endsWith('/')) {
    canonicalBase = canonicalBase.slice(0, -1);
  }

  const customRules = c.robotsTxtCustom ?? c.customRules ?? '';

  return {
    title: String(c.title || DEFAULT_SEO_CONFIG.title).trim(),
    titleTemplate: String(c.titleTemplate || DEFAULT_SEO_CONFIG.titleTemplate).trim(),
    description: String(c.description || DEFAULT_SEO_CONFIG.description).trim(),
    keywords: keywords.length > 0 ? keywords : DEFAULT_SEO_CONFIG.keywords,
    canonicalBase,
    openGraph: {
      title: String(c.openGraph?.title || c.title || DEFAULT_SEO_CONFIG.openGraph.title).trim(),
      description: String(c.openGraph?.description || c.description || DEFAULT_SEO_CONFIG.openGraph.description).trim(),
      image: String(c.openGraph?.image || DEFAULT_SEO_CONFIG.openGraph.image).trim(),
      type: String(c.openGraph?.type || DEFAULT_SEO_CONFIG.openGraph.type).trim(),
    },
    twitter: {
      card: c.twitter?.card === 'summary' ? 'summary' : 'summary_large_image',
      site: String(c.twitter?.site || DEFAULT_SEO_CONFIG.twitter.site).trim(),
      creator: String(c.twitter?.creator || DEFAULT_SEO_CONFIG.twitter.creator).trim(),
    },
    verification: {
      google: normalizeVerificationTag(c.verification?.google || c.googleVerification || ''),
      baidu: normalizeVerificationTag(c.verification?.baidu || c.baiduVerification || ''),
      bing: normalizeVerificationTag(c.verification?.bing || c.bingVerification || ''),
      yandex: normalizeVerificationTag(c.verification?.yandex || c.yandexVerification || ''),
    },
    robotsTxtCustom: typeof customRules === 'string' ? customRules.trim() : '',
  };
}

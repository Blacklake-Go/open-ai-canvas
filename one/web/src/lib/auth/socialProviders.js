import { normalizeOAuthPolicy } from './oauthPolicy.js';
/**
 * Social login is split by geography, not by locale: a mainland visitor sees
 * 微信/QQ/抖音, everyone else sees Google/X/TikTok. Which channels are actually
 * offered inside each region is operator-managed (system_settings key
 * `social_login_display`), so this module stays pure — the caller resolves the
 * setting and the per-provider credential status and passes them in.
 */

export const SOCIAL_LOGIN_CATALOG = Object.freeze({
  mainland_china: Object.freeze(['qq', 'wechat', 'douyin', 'bilibili']),
  international: Object.freeze(['google', 'x', 'tiktok', 'instagram']),
});

export const SOCIAL_LOGIN_REGIONS = Object.freeze(Object.keys(SOCIAL_LOGIN_CATALOG));

export const SOCIAL_LOGIN_SETTING_KEY = 'social_login_display';

function defaultRegionEntries(region) {
  return SOCIAL_LOGIN_CATALOG[region].map((id) => ({ id, enabled: true }));
}

function normalizeRegionEntries(region, rawEntries) {
  const allowed = SOCIAL_LOGIN_CATALOG[region];
  const seen = new Set();
  const entries = [];

  for (const raw of Array.isArray(rawEntries) ? rawEntries : []) {
    const id = typeof raw === 'string' ? raw : raw?.id;
    if (typeof id !== 'string' || !allowed.includes(id) || seen.has(id)) continue;
    seen.add(id);
    entries.push({ id, enabled: raw?.enabled !== false, policy: normalizeOAuthPolicy(raw?.policy) });
  }

  for (const id of allowed) {
    if (!seen.has(id)) entries.push({ id, enabled: true });
  }
  return entries;
}

/** Accepts whatever is in the settings row and always returns a full, safe map. */
export function sanitizeSocialLoginConfig(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const config = {};
  for (const region of SOCIAL_LOGIN_REGIONS) {
    config[region] = normalizeRegionEntries(region, source[region] ?? source.enabled);
  }
  return config;
}

export function getDefaultSocialLoginConfig() {
  return Object.fromEntries(SOCIAL_LOGIN_REGIONS.map((region) => [region, defaultRegionEntries(region)]));
}

export function getSocialLoginProviderPlan(region, options = {}) {
  const catalog = SOCIAL_LOGIN_CATALOG[region];
  if (!catalog) return { providers: [], hidden: [] };

  const config = sanitizeSocialLoginConfig(options.config);
  const configured = options.configured || {};
  const providers = [];
  const hidden = [];

  for (const entry of config[region]) {
    if (!entry.enabled) {
      hidden.push({ id: entry.id, reason: 'disabled' });
      continue;
    }
    if (configured[entry.id] === false) {
      hidden.push({ id: entry.id, reason: 'unconfigured' });
      continue;
    }
    providers.push({
      id: entry.id,
      available: configured[entry.id] === true,
      configured: configured[entry.id] === true,
    });
  }

  return { providers, hidden };
}

export function getSocialLoginProviders(region, options = {}) {
  return getSocialLoginProviderPlan(region, options).providers;
}

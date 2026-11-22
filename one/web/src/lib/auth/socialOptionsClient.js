/**
 * Single client-side contract for `/api/auth/social-options`.
 *
 * Every login surface (page form, site-wide modal card, register form) used to
 * duplicate this fetch and filter, so a change in one place silently diverged
 * from the others. Keep the endpoint, retry and shape in this module only.
 */

export const SOCIAL_OPTIONS_ENDPOINT = '/api/auth/social-options';

export function normalizeSocialOptions(payload) {
  if (!payload || !Array.isArray(payload.providers)) return null;
  return {
    region: typeof payload.region === 'string' ? payload.region : null,
    detectedRegion: typeof payload.detectedRegion === 'string' ? payload.detectedRegion : null,
    providers: payload.providers.filter(
      (provider) => provider && typeof provider.id === 'string' && provider.enabled !== false
    ),
  };
}

/** One retry covers a cold-start/cold-cache miss without leaving the page empty. */
export async function fetchSocialOptions({ retries = 1, retryDelayMs = 600 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(SOCIAL_OPTIONS_ENDPOINT, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (res.ok) {
        const data = normalizeSocialOptions(await res.json());
        if (data) return data;
      }
    } catch {}
    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
  return null;
}

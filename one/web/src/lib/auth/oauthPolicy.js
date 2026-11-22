export const OAUTH_PROVIDERS = ['qq', 'wechat', 'douyin', 'bilibili', 'google', 'x', 'instagram', 'tiktok'];
export function normalizeOAuthPolicy(raw = {}) {
  return {
    enabled: raw.enabled !== false,
    allowPrefill: raw.allowPrefill !== false,
    allowBind: raw.allowBind !== false,
    allowUnbind: raw.allowUnbind !== false,
    allowReplace: raw.allowReplace !== false,
    requireLocalEmail: raw.requireLocalEmail === true,
    conflict: raw.conflict === 'reject' ? 'reject' : 'verify_existing',
    requiredFields: ['displayName', 'verifiedEmail'],
  };
}
export function safeOAuthPath(value, fallback = '/studio') {
  const path = String(value || '');
  return path.startsWith('/') && !path.startsWith('//') && !/[\\\x00-\x20]/.test(path) ? path : fallback;
}
export function trustedProviderEmail(provider, profile) {
  // Only Google's authenticated userinfo / verified ID token supplies this claim.
  return provider === 'google' && profile.emailVerified === true;
}

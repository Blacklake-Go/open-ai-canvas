const PARENT_ORIGINS = new Set(['https://canvas.supdance.com', 'https://www.supdance.com', 'https://supdance.com']);

function isProductionEnv(production) {
  if (typeof production === 'boolean') return production;
  if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
    return process.env.NODE_ENV === 'production';
  }
  return Boolean(import.meta.env?.PROD);
}

export function resolveAuthEmbedOptions(params = {}, { production } = {}) {
  const isProd = isProductionEnv(production);
  const parentOrigin = typeof params.parentOrigin === 'string' ? params.parentOrigin : '';
  const local = !isProd && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(parentOrigin);
  if (!PARENT_ORIGINS.has(parentOrigin) && !local) return null;
  return {
    parentOrigin,
    mode: ['login', 'register', 'forgot'].includes(params.mode) ? params.mode : 'login',
    tab: params.tab === 'phone' ? 'phone' : 'email',
    locale: typeof params.locale === 'string' ? params.locale : 'en',
  };
}

export function authEmbedFrameAncestors(production) {
  const isProd = isProductionEnv(production);
  return `frame-ancestors 'self' ${[...PARENT_ORIGINS].join(' ')}${isProd ? '' : ' http://localhost:* http://127.0.0.1:*'};`;
}

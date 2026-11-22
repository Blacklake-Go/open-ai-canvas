import { DEFAULT_LOCALE, getLocaleConfig, matchPathLocale, normalizeLocale, resolveClientLocale } from '../locales.js';
import { LOCALIZED_PATHS, PREFIX_AGNOSTIC_BASES } from '../routePolicy.js';

// 语言切换的唯一实现。之前有两份各自漂移的拷贝
// （components/LanguageSwitcher.js、components/UserDropdownMenu.js），
// 两边的"非 studio 路径就整页 reload"分支在只有 /zh 建了树的事实下必然分叉。

const COOKIE_MAX_AGE = 31536000;

/** 去掉路径自己声明的语言前缀，得到跨语言可复用的基路径。 */
export function stripLocalePrefix(pathname) {
  const path = pathname || '/';
  if (!matchPathLocale(path)) return path;
  const asserted = `/${path.split('/')[1]}`;
  return path.slice(asserted.length) || '/';
}

/**
 * 这个基路径在目标语言下能不能解析出路由：该前缀真建了字面树，或者它由
 * `app/[locale]/**` 服务。都不满足时返回 null —— 拼一个 `${prefix}${base}` 出去就是一发 404，
 * 而那正是旧实现里"非 studio 路径就 reload"想躲开又没躲开的东西。
 */
export function localizedPathFor(basePath, targetLocale) {
  const root = getLocaleConfig(targetLocale).rootPath;
  // 无前缀树就是整站，任何基路径都在它下面。
  if (!root) return basePath;
  const top = basePath.split('/')[1];
  if (!top) return root;
  const reachable = PREFIX_AGNOSTIC_BASES.includes(top) || (LOCALIZED_PATHS[root] || []).includes(top);
  return reachable ? `${root}${basePath}` : null;
}

/**
 * 组件侧的可直接用版本：解析当前激活语言，再给 basePath 拼前缀；
 * 该路径在当前语言下没有树时退回无前缀 canonical（由中间件 307 兜到该语言）。
 */
export function localizedHref(basePath, { explicit, pathname, search, userLocale } = {}) {
  const active = resolveClientLocale({ explicit, pathname, search, userLocale });
  return localizedPathFor(basePath, active) ?? basePath;
}

/** 写 cookie 与个人偏好：语言由 URL 表达的那些页面也依赖它，切前缀之外的路径要用。 */
export function persistLocale(targetLocale) {
  const norm = normalizeLocale(targetLocale);
  const value = encodeURIComponent(norm);

  if (typeof document !== 'undefined') {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const cookieDomain = hostname.endsWith('.supdance.com')
      ? '.supdance.com'
      : hostname === 'supdance.com'
        ? '.supdance.com'
        : '';

    if (cookieDomain) {
      document.cookie = `NEXT_LOCALE=${value}; path=/; max-age=${COOKIE_MAX_AGE}; domain=${cookieDomain}; SameSite=Lax`;
      document.cookie = `locale=${value}; path=/; max-age=${COOKIE_MAX_AGE}; domain=${cookieDomain}; SameSite=Lax`;
    }
    document.cookie = `NEXT_LOCALE=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    document.cookie = `locale=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  }

  // 1. 同步更新本地 localStorage 缓存的 ko_user 与独立 locale 键，杜绝首帧水合错位
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('NEXT_LOCALE', norm);
      localStorage.setItem('locale', norm);
      localStorage.setItem('infinite-canvas:locale', norm);
      const raw = localStorage.getItem('ko_user');
      if (raw) {
        const u = JSON.parse(raw);
        if (u && typeof u === 'object') {
          u.locale = norm;
          localStorage.setItem('ko_user', JSON.stringify(u));
        }
      }
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent('supdance-locale-changed', { detail: { locale: norm } }));
      window.dispatchEvent(new CustomEvent('koyosim-locale-changed', { detail: { locale: norm } }));
    } catch {}
  }

  // 2. 携带 keepalive: true 提交后端偏好持久化入库，杜绝页面跳转瞬间请求被浏览器 abort 导致落库失败
  const payload = JSON.stringify({ locale: norm });
  try {
    fetch('/api/user/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {}
  try {
    fetch('/api/user/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

/**
 * 就地换语言：支持 switchLocale({ targetLocale, pathname, search }) 与 switchLocale(targetLocale, pathname, search)。
 * 有本地化路由就整页导航过去（HTML 的 lang 与服务端文案都要重出），
 * 没有就留在当前 URL，写 cookie 后 refresh 让服务端按新语言重渲染。
 * 返回值说清走了哪条路，便于两边行为一致、也便于测试。
 */
export function switchLocale(input, secondPathname, thirdSearch = '') {
  let targetLocale;
  let pathname;
  let search = '';

  if (typeof input === 'string') {
    targetLocale = input;
    pathname = secondPathname || (typeof window !== 'undefined' ? window.location.pathname : '/');
    search = thirdSearch || (typeof window !== 'undefined' ? window.location.search : '');
  } else if (input && typeof input === 'object') {
    targetLocale = input.targetLocale;
    pathname = input.pathname || (typeof window !== 'undefined' ? window.location.pathname : '/');
    search = input.search || (typeof window !== 'undefined' ? window.location.search : '');
  } else {
    targetLocale = DEFAULT_LOCALE;
    pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
    search = typeof window !== 'undefined' ? window.location.search : '';
  }

  const locale = normalizeLocale(targetLocale);
  persistLocale(locale);

  const cleanBase = stripLocalePrefix(pathname);
  // 首页规范路由始终为根域名 /，写 cookie 后直达 /
  if (cleanBase === '/' || cleanBase === '') {
    window.location.href = `/${search}`;
    return { locale, navigated: true };
  }

  const target = localizedPathFor(cleanBase, locale);
  if (target === null) {
    window.location.reload();
    return { locale, navigated: false };
  }
  window.location.href = `${target === '/' ? '' : target}${search}` || '/';
  return { locale, navigated: true };
}

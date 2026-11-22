import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  getLocaleConfig,
  isSupportedLocale,
  matchPathLocale,
  mergeCopy,
  normalizeLocale,
} from '../../lib/locales.js';
import en from './messages/en.json' with { type: 'json' };
import zh from './messages/zh.json' with { type: 'json' };
import ja from './messages/ja-JP.json' with { type: 'json' };
import ko from './messages/ko-KR.json' with { type: 'json' };
import zhTw from './messages/zh-TW.json' with { type: 'json' };
import es from './messages/es.json' with { type: 'json' };

/**
 * 临时插件自带的六语言文案层 (plugin-owned i18n for the china-ip-block plugin)
 *
 * 为什么字典放在插件目录而不是站点的 messages/<locale>/：
 * 站点字典由后台「语言管理」和 CI 校验器共同拥有，插件文案则必须跟随插件本身
 * 生死——`uninstall.mjs` 删除插件目录时，它的文案也一起消失，核心侧不留残键。
 * tests/i18n-coverage-gates.test.mjs 会在插件存在时断言这里六份文件键集一致，
 * 插件被卸载后自动跳过，因此两种状态都不会把 CI 卡住。
 *
 * 语言注册表复用核心 lib/locales.js：插件不自己发明第二套 locale 规范化，
 * 否则同一个访客在中间件和插件里会被判定成两种语言。
 */

const PLUGIN_MESSAGES = {
  [DEFAULT_LOCALE]: en,
  'zh-CN': zh,
  'ja-JP': ja,
  'ko-KR': ko,
  'zh-TW': zhTw,
  es,
};

export const PLUGIN_LOCALES = SUPPORTED_LOCALES;

// 静态 import 而非读盘：这段代码跑在 Next.js 中间件里，且必须能随插件一起
// 被打包、一起被删除。文件在插件目录内，卸载即从 bundle 里消失。
export function getPluginCopy(locale) {
  const config = getLocaleConfig(locale);
  if (config.code === DEFAULT_LOCALE) return en;
  return mergeCopy(en, PLUGIN_MESSAGES[config.code] || en);
}

// 403 页面写给浏览器的 lang 属性取注册表的 htmlLang（en / zh-CN / ja-JP / …），
// 与站点根布局 <html lang> 同源，插件不再各写一个字符串。
export function getPluginHtmlLang(locale) {
  return getLocaleConfig(locale).htmlLang;
}

function readHeader(request, name) {
  const headers = request?.headers;
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(name);
  return headers[name] || headers[name.toLowerCase()] || null;
}

function readCookie(request, name) {
  const jar = request?.cookies;
  if (jar && typeof jar.get === 'function') {
    const value = jar.get(name)?.value;
    if (value) return decodeURIComponent(String(value).trim());
  }
  const raw = readHeader(request, 'cookie');
  if (!raw) return null;
  for (const part of String(raw).split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }
  return null;
}

function localeFromQuery(request) {
  const url = request?.nextUrl;
  const params = url?.searchParams;
  if (params && typeof params.get === 'function') {
    return params.get('lang') || params.get('locale') || null;
  }
  const search = typeof url?.search === 'string' ? url.search : '';
  if (!search) return null;
  for (const pair of search.replace(/^[?#]/, '').split('&')) {
    const [key, value] = pair.split('=');
    if ((key === 'lang' || key === 'locale') && value) {
      return decodeURIComponent(value.replace(/\+/g, ' '));
    }
  }
  return null;
}

function accept(candidate) {
  return candidate && isSupportedLocale(candidate) ? normalizeLocale(candidate) : null;
}

/**
 * 被拦截访客当前使用的语言：URL 前缀 > ?lang/?locale > x-locale 标头 >
 * NEXT_LOCALE/locale Cookie > 注册表默认。
 *
 * 刻意不看 Accept-Language：核心中间件的语言策略是「强制默认英语，不做浏览器
 * 协商」（middleware.js 里那条注释）。403 页属于同一站点的对外文案，插件自己
 * 加一层协商会让语言判定出现两套规则。
 */
export function resolvePluginLocale(request) {
  const fromPath = matchPathLocale(request?.nextUrl?.pathname);
  if (fromPath) return fromPath;
  return (
    accept(localeFromQuery(request))
    || accept(readHeader(request, 'x-locale'))
    || accept(readCookie(request, 'NEXT_LOCALE'))
    || accept(readCookie(request, 'locale'))
    || DEFAULT_LOCALE
  );
}

/**
 * 后台设置行（浏览器侧）使用的语言。
 *
 * 先读 <html lang>：它由核心根布局按 x-locale 渲染，代表「服务端认为这一页是
 * 什么语言」。管理后台目前整站仍是中文硬编码（任务 #10），插件跟随宿主页面
 * 声明的语言，而不是自己猜一个后台默认语言。
 */
export function resolvePluginBrowserLocale() {
  if (typeof document === 'undefined') return DEFAULT_LOCALE;
  const declared = typeof document.documentElement?.getAttribute === 'function'
    ? document.documentElement.getAttribute('lang')
    : document.documentElement?.lang;
  const fromHost = accept(declared);
  if (fromHost) return fromHost;
  // 宿主没声明可识别语言时，退到 URL + Cookie 的常规判定（此分支已在浏览器内）。
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  return resolvePluginLocale({
    nextUrl: { pathname: window.location.pathname, search: window.location.search },
    headers: { cookie: document.cookie },
  });
}

/** `{ip}` 形式的插值；未知占位符原样保留，避免文案改动造成运行时崩溃。 */
export function formatCopy(template, values = {}) {
  return String(template ?? '').replace(/\{\s*([\w.-]+)\s*\}/g, (match, key) => (
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match
  ));
}

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

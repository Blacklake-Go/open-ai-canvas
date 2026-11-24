/**
 * 路由策略声明 —— docs/route-map.md 里"推不出来"的那一半。
 *
 * 文件系统能回答"这条 URL 存在吗"，回答不了"谁能进"：守卫可能藏在客户端组件里，
 * grep 看不见。所以每条页面路由必须命中下面某一条策略，命中不了就判红，
 * 逼新页面在提交时做一次明确决定，而不是默认公开。
 *
 * 匹配的是**去语言前缀后的基路径**：/zh/credits 与 /credits 是同一个面，
 * 差别只在"这个前缀下真的建树了吗"，那一列由脚本从文件系统推导。
 *
 * 零 import：生成脚本、P0 测试与服务端路由三边都要加载它。
 * lib/locales.js 直链 messages/*.json，纯 node 下 import 会崩，所以这里不引用它。
 */

/** 服务端进入条件。`client` 是诚实记录：服务端不查，登录态由客户端组件自己决定。 */
export const AUTH_LEVELS = ['public', 'session', 'onboarding', 'admin', 'redirect', 'client'];

/**
 * 有序、首个命中即生效。放最后一条 `/**` 是因为它会把任何新无前缀页面
 * 悄悄吞成"跳转类"，所以那条策略用 onlyFiles 钉死到具体文件上。
 */
export const ROUTE_POLICIES = [
  { match: '/auth/onboarding', auth: 'client', index: 'none', note: '受限 OAuth 凭证确认页，接口验证短期 HttpOnly cookie；完成验证前无正式会话' },
  {
    match: '/admin/forbidden',
    auth: 'public',
    index: 'none',
    note: '权限拒绝页自己不能再被守卫拦；tests/p4/admin-operations.test.mjs 记录了这条豁免',
  },
  {
    match: '/admin/**',
    auth: 'admin',
    index: 'none',
    note: 'app/admin/layout.js 会话闸门 + 每页 requireAdminPagePermission 权限闸门',
  },
  {
    match: '/onboarding',
    auth: 'session',
    index: 'none',
    note: '无会话 redirect /；已完成者 redirect 进 studio',
  },
  {
    match: '/studio/**',
    auth: 'onboarding',
    index: 'index',
    note: '三处 studio 入口各自 await assertOnboardingComplete()；匿名放行，只挡未完成引导的用户',
  },
  { match: '/account', auth: 'redirect', index: 'none', note: '无条件 redirect /studio?account=open' },
  { match: '/embed-auth', auth: 'public', index: 'none', note: '嵌入式授权登录页：供无限画布 iframe 跨域嵌入登录' },
  { match: '/login', auth: 'public', index: 'none', note: '独立登录页，支持邮箱/密码与手机短信验证码' },
  { match: '/register', auth: 'public', index: 'none', note: '独立注册页，支持邮箱验证码与邀请码' },
  { match: '/forgot-password', auth: 'public', index: 'none', note: '独立找回密码与账号找回页' },
  { match: '/reset-password', auth: 'redirect', index: 'none', note: '别名页，规范重定向到 /forgot-password' },
  { match: '/change-password', auth: 'client', index: 'none', note: '独立修改密码页，客户端会话探测与新旧密码校验' },
  { match: '/assets', auth: 'redirect', index: 'none', note: '旧别名，按 x-locale 语言 redirect 进对应前缀的 studio 根' },
  { match: '/assistant', auth: 'redirect', index: 'none', note: '旧别名，redirect 进 studio' },
  { match: '/subscription', auth: 'redirect', index: 'none', note: '旧别名，redirect 进 /pricing' },
  { match: '/agents/**', auth: 'redirect', index: 'none', note: '5 个页面全是 /studio/agents* 的跳转' },
  { match: '/', auth: 'public', index: 'index', note: '首页门户：按 cookie/header 语言就地渲染 JimengHomePortal，首页永远是 https://www.Supdance.com' },
  { match: '/coins', auth: 'client', index: 'index', note: 'K 币兑换中心：服务端零检查，目录匿名可看、兑换与穿戴在客户端查会话（components/coins/CoinExchangeClient.js fetch /api/auth/me）；app/coins 与 app/zh/coins 共用同一份硬编码中文正文，无前缀变体暂无英文文案' },
  { match: '/credits', auth: 'client', index: 'index', note: '服务端零检查，客户端 fetch /api/auth/me；正文目前仍是硬编码中文' },
  { match: '/benefits', auth: 'client', index: 'index', note: '硬币权益页：匿名可看目录，兑换与明细在客户端各自查会话' },
  { match: '/creations', auth: 'client', index: 'index', note: '服务端零检查，客户端决定登录态' },
  { match: '/community/**', auth: 'public', index: 'index', note: '游客可浏览；发帖接口各自查会话' },
  { match: '/pricing', auth: 'public', index: 'index', note: '正文硬编码中文，无 locale prop' },
  { match: '/billing/orders', auth: 'session', index: 'none', note: '当前账号的订单记录与分页' },
  { match: '/billing/success', auth: 'session', index: 'none', note: '收银台返回与订单状态，可登录后回到原订单' },
  {
    match: '/call-api',
    auth: 'public',
    index: 'none',
    note: '营销落地页，零入链；正文硬编码中文，爬到了也没有对应语言版本',
  },
  {
    match: '/design-system',
    auth: 'public',
    index: 'none',
    note: '内部组件画廊，零入链、无鉴权，公开可爬所以必须 noindex',
  },
  { match: '/workflow/**', auth: 'client', index: 'none', note: '旧别名壳：locale 由 cookie/header 解析后传进 StandaloneShell，全部 noindex' },
  { match: '/profile', auth: 'session', index: 'none', note: '个人主页：展示创作者公开与个人作品、资料与活跃度' },
  { match: '/u/**', auth: 'public', index: 'index', note: '公开主页 getPublicProfile' },
  { match: '/privacy', auth: 'public', index: 'index', note: '法务页：正文全在 messages/<locale>/legal.json，六语齐备；无前缀=英文 canonical，/zh、/ja-JP、/ko-KR、/zh-TW、/es 由 app/[locale]/privacy 就地渲染' },
  { match: '/terms', auth: 'public', index: 'index', note: '法务页：六语字典 + app/[locale]/terms 就地渲染，非官方译本页脚已声明以简体中文原文为准' },
  { match: '/refund', auth: 'public', index: 'index', note: '法务页：六语字典 + app/[locale]/refund 就地渲染' },
  { match: '/content-policy', auth: 'public', index: 'index', note: '法务页：六语字典 + app/[locale]/content-policy 就地渲染，被其余三份法务页链入（链接按当前语言加前缀）' },
  { match: '/about', auth: 'public', index: 'index', note: '关于页：app/about 与 app/[locale]/about 共用同一份按路径语言出文案的正文' },
  {
    match: '/feedback',
    auth: 'client',
    index: 'index',
    note: '建议与需求：服务端只读支持邮箱，表单匿名可看，提交与「我的提交」由客户端查会话并调用 /api/feedback',
  },
  {
    match: '/models/**',
    auth: 'public',
    index: 'index',
    note: 'AI 模型总揽看板与专用模型详情页：公开索引，支持时调用量、生图数与性能折线图',
  },
  {
    match: '/canvas-tools/**',
    auth: 'client',
    index: 'index',
    note: '短剧工作坊与画布工具套件（扩图、超清、抠图、多角度、三视图与九宫格）：无前缀重定向至 /zh，中文下由 CanvasToolsStudio 承接',
  },
  {
    match: '/lab',
    auth: 'public',
    index: 'index',
    note: '短剧工作坊能力预览：展示扩图、超清、三视图等工作坊入口；无前缀重定向至 /zh，中文下渲染 LabPageClient',
  },
  {
    match: '/**',
    auth: 'redirect',
    index: 'none',
    onlyFiles: ['app/[locale]/[...slug]/page.js'],
    note: '语言前缀兜底：别名 308 规范化，前缀下没有的路径 307 回无前缀，都不存在则 notFound',
  },
];

/**
 * 每个语言前缀下**真实建了树**的子路径。运行时用它决定"能不能就地服务"，
 * P0 闸门用它对文件系统求差 —— 加一页 app/zh/foo 而忘了同步这里会判红。
 */
export const LOCALIZED_PATHS = {
  '/zh': [
    'about',
    'assets',
    'assistant',
    'benefits',
    'call-api',
    'canvas-tools',
    'change-password',
    'coins',
    'community',
    'credits',
    'forgot-password',
    'lab',
    'login',
    'models',
    'pricing',
    'profile',
    'register',
    'reset-password',
    'studio',
    'subscription',
    'workflow',
  ],
};

/**
 * `app/[locale]/**` 自己服务得起来的基路径：这些段对**全部**已注册前缀都能解析，
 * 不会因为某个前缀没建字面树就 404。语言切换据此决定"切过去"还是"留下并换 cookie"。
 *
 * 法务四页在列是因为它们的正文由 `messages/<locale>/legal.json` 提供，任何前缀都
 * 翻得动；`/coins`、`/pricing` 那类仍是硬编码中文的页面不能加进来，否则切换器会把
 * 用户送进一个"URL 换了语言、正文没换"的前缀。
 */
export const PREFIX_AGNOSTIC_BASES = [
  'assets',
  'billing',
  'call-api',
  'content-policy',
  'login',
  'privacy',
  'refund',
  'studio',
  'terms',
];

/**
 * 无前缀树里真实存在的顶层段，即 `/zh/x` 可以安全降级成 `/x` 的那些 x。
 * 故意不含 `api` 与 `uploads`：那是带鉴权/文件读的处理器，
 * 不该被一个语言前缀悄悄重路由过去。
 */
export const UNPREFIXED_TOP_SEGMENTS = [
  'about', 'account', 'admin', 'agents', 'assets', 'assistant', 'benefits', 'billing', 'call-api', 'canvas-tools', 'change-password', 'community', 'coins',
  'content-policy', 'creations', 'credits', 'design-system', 'embed-auth', 'feedback', 'forgot-password', 'lab', 'login', 'models', 'onboarding',
  'pricing', 'privacy', 'profile', 'refund', 'register', 'reset-password', 'sitemap.xml', 'studio', 'subscription', 'terms', 'u', 'workflow',
];

/** `/studio/<段>` 允许的工作台 id，与 components/StandaloneShell.js 的 TABS 同源。 */
export const STUDIO_TABS = [
  'image', 'headshot', 'layers', 'video', 'audio', 'clipping', 'motion-control',
  'vibe-motion', 'lipsync', 'body-swap', 'cinema', 'marketing', 'workflows',
  'agents', 'design-agent', 'apps', 'ai-influencer',
  'character', 'motion-agent',
];

/** TABS 之外、getInitialTab 用关键词识别的段（单数 workflow 指向 workflows 页签）。 */
export const STUDIO_ROUTE_KEYWORDS = ['workflow', 'character', 'motion-agent'];

/**
 * 免会话的接口、带签名校验的回调、以及转发到上游的捕获式代理。
 * 三张名单都要与 app/api/ 树逐项相等 —— 脚本正反两向都判红，
 * 所以"它其实免鉴权"这件事不能靠回忆，只能靠这里写没写。
 * 写法与生成器同源：捕获段写 `*`，具名动态段写 `[provider]`。
 */
export const API_POLICIES = {
  public: [
    '/api/auth/login', '/api/auth/register', '/api/auth/logout', '/api/auth/me',
    '/api/auth/social-options', '/api/auth/oauth/[provider]',
    '/api/auth/oauth/google/one-tap', '/api/auth/oauth/[provider]/callback', '/api/auth/phone/send-code', '/api/auth/phone/verify',
    '/api/billing/plans', '/api/billing/credit-packs',
    '/api/site/branding', '/api/site/content-config', '/api/site/subscription-faq',
    '/api/i18n', '/api/models/active', '/api/health', '/api/live',
    '/api/ready', '/api/analytics/track', '/api/analytics/banner-event',
  ],
  signature: [
    '/api/billing/webhooks/stripe', '/api/billing/webhooks/alipay',
    '/api/billing/webhooks/wechat', '/api/generations/[id]/callback',
  ],
  /** 遗留代理：迁移目标是收敛到 POST /api/generations；/api/api/v1 是 Studio 现在真实的生成链路。 */
  legacyProxy: [
    '/api/api/v1/*', '/api/v1/*', '/api/v1/creative-agent/*',
    '/api/agents/*', '/api/app/*', '/api/workflow/*',
  ],
};

/** 生成文档里"服务器 A 边缘层"一节的手写事实；脚本只搬运不推导。 */
export const EDGE_NOTES = [
  '入口只有 www.Supdance.com（go 域名按决定停用）；nginx 反代到 127.0.0.1:3100 的 `next start`。',
  'worker 是独立服务 supdance-worker.service（scripts/generation-worker.mjs）。',
  'public/robots.txt：Allow: /，Disallow: /admin/ 与 /api/；无 Sitemap 行。',
  'public/ 下的静态文件由 Next 先于 app/uploads/[...path] 服务，两条路径共存。',
];

/**
 * 命中判断：`*` 恰好一段，`**` 零或多段（只会出现在末尾）。
 * 路由的 URL 段里 `[x]`/`[...x]`/`[[...x]]` 已分别归一成 `*`/`*`/`**`。
 */
export function matchRoute(pattern, segments) {
  const parts = pattern.split('/').filter(Boolean);
  for (let i = 0; i < parts.length; i += 1) {
    if (parts[i] === '**') return true;
    if (i >= segments.length) return false;
    if (parts[i] !== '*' && parts[i] !== segments[i]) return false;
  }
  return parts.length === segments.length;
}

const LOCALE_SEGMENT = new Set(['[locale]', 'en', 'zh', 'zh-CN', 'zh-TW', 'ja-JP', 'ko-KR', 'es']);

/**
 * app/ 下的路径段 → URL 段序列，以及去掉语言前缀后的基路径段。
 * 语言段统一成 `:loc`，这样 /zh/credits 与 /credits 归到同一条策略。
 */
export function describeSegments(dirSegments) {
  const url = dirSegments.map((s) => {
    if (s === '[locale]') return ':loc';
    if (LOCALE_SEGMENT.has(s)) return ':loc';
    if (s.startsWith('[[...') && s.endsWith(']]')) return '**';
    if (s.startsWith('[...') || s.startsWith('[')) return '*';
    return s;
  });
  const params = dirSegments.filter((s) => s.startsWith('['));
  const base = url[0] === ':loc' ? url.slice(1) : url;
  return { url, base, params };
}

/** 一条路由解析到哪条策略；`/**` 之外的 onlyFiles 不参与，避免兜底吞掉新页面。 */
export function resolvePolicy(baseSegments) {
  for (const policy of ROUTE_POLICIES) {
    if (matchRoute(policy.match, baseSegments) && !policy.onlyFiles) return policy;
  }
  for (const policy of ROUTE_POLICIES) {
    if (matchRoute(policy.match, baseSegments)) return policy;
  }
  return null;
}

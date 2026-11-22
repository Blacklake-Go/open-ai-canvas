/**
 * 运营管理后台导航唯一配置源。
 * Sidebar / Breadcrumb / 权限过滤 / 旧路由重定向 / 路由契约测试全部由此生成。
 * 本文件必须保持纯数据 + 纯函数（不 import React / server-only），
 * 以便客户端组件与 Node 测试脚本共用。
 */

export const ADMIN_NAV_GROUPS = [
  {
    id: 'dashboard',
    label: '工作台',
    icon: 'LayoutDashboard',
    items: [
      { id: 'ops-overview', href: '/admin', label: '运营概览', permission: 'dashboard.read' },
    ],
  },
  {
    id: 'users-access',
    label: '用户与权限',
    icon: 'Users',
    items: [
      { id: 'users-dashboard', href: '/admin/users/dashboard', label: '用户数据看板', permission: 'users.read' },
      { id: 'users', href: '/admin/users', label: '用户管理', permission: 'users.read', detailLabel: '用户详情' },
      { id: 'invites', href: '/admin/invites', label: '邀请码与使用习惯', permission: 'users.read' },
      { id: 'admins', href: '/admin/admins', label: '管理员与角色', permission: 'admins.write' },
      { id: 'sessions', href: '/admin/security/sessions', label: '会话与安全', permission: 'sessions.revoke' },
    ],
  },
  {
    id: 'billing',
    label: '订阅与计费',
    icon: 'CreditCard',
    items: [
      { id: 'subscriptions', href: '/admin/subscriptions', label: '订阅管理', permission: 'billing.read' },
      { id: 'orders', href: '/admin/orders', label: '订单与支付', permission: 'billing.read' },
      { id: 'credits-ledger', href: '/admin/credits', label: '积分 / 额度账本', permission: 'credits.read' },
      { id: 'plans', href: '/admin/plans', label: '套餐与定价', permission: 'plans.read' },
      { id: 'coupons', href: '/admin/coupons', label: '卡密与兑换码', permission: 'coupons.read' },
      { id: 'payment-channels', href: '/admin/providers/payments', label: '支付渠道', permission: 'providers.read' },
      { id: 'cost-center', href: '/admin/cost-center', label: '成本中心', permission: 'dashboard.read' },
      { id: 'profit-center', href: '/admin/profit-center', label: '利润中心', permission: 'dashboard.read' },
      { id: 'subscription-faq', href: '/admin/subscription-faq', label: '订阅说明', permission: 'plans.read' },
    ],
  },
  {
    id: 'generation',
    label: '生成运营',
    icon: 'Clapperboard',
    items: [
      { id: 'generations', href: '/admin/generations', label: '生成任务', permission: 'generations.read' },
      { id: 'generation-failures', href: '/admin/generations/failures', label: '失败任务', permission: 'generations.read' },
      { id: 'generation-reconciliation', href: '/admin/generations/reconciliation', label: '待核对任务', permission: 'generations.read' },
      { id: 'moderation', href: '/admin/moderation', label: '内容审核', permission: 'moderation.read' },
      { id: 'feedback', href: '/admin/feedback', label: '建议与漏洞提交', permission: 'content.read', detailLabel: '提交详情' },
    ],
  },
  {
    id: 'ai-models',
    label: 'AI 模型与路由',
    icon: 'Cpu',
    items: [
      { id: 'model-overview', href: '/admin/models', label: '模型管理', permission: 'models.read' },
      { id: 'model-publication', href: '/admin/models/publication', label: '模型接入与发布', permission: 'models.read' },
      { id: 'canvas-model-config', href: '/admin/models/canvas', label: '无限画布配置', permission: 'models.read' },
      { id: 'model-providers', href: '/admin/models/providers', label: '供应商管理', permission: 'providers.read' },
      { id: 'model-routing', href: '/admin/models/routing', label: '智能路由与策略', permission: 'models.read' },
      { id: 'model-telemetry', href: '/admin/models/telemetry', label: '调用量与遥测', permission: 'models.read' },
    ],
  },
  {
    id: 'content',
    label: '内容与前台',
    icon: 'Megaphone',
    items: [
      { id: 'visitors', href: '/admin/content/visitors', label: '访客与 SEO', permission: 'users.read' },
      { id: 'x-prompts', href: '/admin/content/x-prompts', label: 'X 提示词灵感', permission: 'content.read' },
      { id: 'click-analytics', href: '/admin/content/analytics', label: '点击分析', permission: 'content.read' },
      { id: 'community-cases', href: '/admin/community', label: '社区案例作品', permission: 'content.read' },
    ],
  },
  {
    id: 'integrations',
    label: '系统集成',
    icon: 'Plug2',
    items: [
      { id: 'webhooks', href: '/admin/webhooks', label: 'Webhook 事件', permission: 'webhooks.read' },
    ],
  },
  {
    id: 'system',
    label: '系统与安全',
    icon: 'Shield',
    items: [
      { id: 'health', href: '/admin/health', label: '系统健康', permission: 'health.read' },
      { id: 'settings', href: '/admin/settings', label: '系统设置', permission: 'settings.read' },
      { id: 'storage', href: '/admin/settings/storage', label: '对象存储', permission: 'storage.read' },
      { id: 'login-methods', href: '/admin/system/login', label: '登录方式与连通性', permission: 'providers.read' },
      { id: 'email-sending', href: '/admin/system/email', label: '邮件发信设置', permission: 'providers.read' },
      { id: 'i18n', href: '/admin/i18n', label: '语言管理', permission: 'i18n.read' },
      { id: 'audit', href: '/admin/audit', label: '审计日志', permission: 'audit.read' },
    ],
  },
];

/**
 * 旧路由 → 新路由。仅做页内 redirect()，不删文件、不进菜单。
 * 社交/短信合并进登录方式页；邮箱 SMTP 独立单页设置。三者收进
 * 「系统与安全」，路径同步收敛到 /admin/system/* 命名空间。
 */
export const ADMIN_LEGACY_REDIRECTS = {
  '/admin/content/branding': '/admin/settings?tab=branding',
  '/admin/content/icon': '/admin/settings?tab=branding',
  '/admin/content/banners': '/admin/settings?tab=banner',
  '/admin/content/effects': '/admin/settings?tab=motion',
  '/admin/models/catalog': '/admin/models/providers',
  '/admin/models/cost-center': '/admin/cost-center',
  '/admin/models/profit-center': '/admin/profit-center',
  '/admin/models/frontend': '/admin/models',
  '/admin/models/brands': '/admin/models?brand=all',
  '/admin/models/pricing': '/admin/models/routing?tab=pricing',
  '/admin/providers': '/admin/models/providers',
  '/admin/providers/ai': '/admin/models/providers',
  '/admin/providers/models': '/admin/models/routing',
  '/admin/providers/social': '/admin/system/login?category=social',
  '/admin/providers/sms': '/admin/system/login?category=sms',
  '/admin/providers/email': '/admin/system/email',
  '/admin/system': '/admin/system/login',
  '/admin/login': '/admin/system/login',
  '/admin/email': '/admin/system/email',
  '/admin/routing': '/admin/models/routing',
  '/admin/routing/[modelId]': '/admin/models/routing',
  '/admin/models/health': '/admin/models/providers',
  '/admin/storage': '/admin/settings/storage',
  '/admin/visitors': '/admin/content/visitors',
};

/** 不进入菜单、但真实存在且需保留的后台路由（403/404/白名单功能页）。 */
export const ADMIN_NONAV_ROUTES = {
  '/admin/forbidden': '403 无权限提示页',
  '/admin/models/registry': '模型注册表，从二级导航收敛至模型管理内',
};

function segmentsOf(href) {
  return href.split('/').filter(Boolean);
}

/**
 * 最长前缀匹配：/admin/models/catalog 命中 model-catalog 而非 model-control；
 * /admin/users/123 命中 users；/admin/users-permissions 不命中 users。
 */
export function matchAdminRoute(pathname) {
  if (ADMIN_NONAV_ROUTES[pathname]) return null;
  const path = segmentsOf(pathname || '/');
  let best = null;
  let bestGroup = null;

  for (const group of ADMIN_NAV_GROUPS) {
    for (const item of group.items) {
      const target = segmentsOf(item.href);
      if (target.length > path.length) continue;
      const isPrefix = target.every((seg, i) => seg === path[i]);
      if (!isPrefix) continue;

      if (!best || target.length > segmentsOf(best.href).length) {
        best = item;
        bestGroup = group;
      }
    }
  }

  if (!best) return null;
  return {
    group: bestGroup,
    item: best,
    rest: path.slice(segmentsOf(best.href).length),
  };
}

export function isItemActive(item, currentPath) {
  const matched = matchAdminRoute(currentPath);
  return Boolean(matched && matched.item.id === item.id);
}

/**
 * 根据当前 pathname 生成完整面包屑层级。
 * 格式：[ { label, href }, ... ]。最后一级 href = null 表示当前页。
 */
export function getAdminBreadcrumbs(pathname) {
  const matched = matchAdminRoute(pathname);
  if (!matched) return null;

  const { group, item, rest } = matched;
  const crumbs = [];

  // 一级：分组名（纯文本，不跳路由，因为分组本身不是页面）
  crumbs.push({ label: group.label, href: null });

  // 二级：菜单项
  if (rest.length === 0) {
    crumbs.push({ label: item.label, href: null });
  } else {
    crumbs.push({ label: item.label, href: item.href });
    // 三级及以上：动态详情层
    const detailName = rest.length === 1 && item.detailLabel ? item.detailLabel : rest.join(' / ');
    crumbs.push({ label: detailName, href: null });
  }

  return crumbs;
}

export function serializeSearchParams(params) {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParams.append(key, String(v)));
      } else {
        searchParams.set(key, String(value));
      }
    }
  }
  const str = searchParams.toString();
  return str ? `?${str}` : '';
}

export function buildRedirectTarget(target, queryString = '') {
  if (!queryString) return target;
  const separator = target.includes('?') ? '&' : '?';
  const cleanQuery = queryString.startsWith('?') ? queryString.slice(1) : queryString;
  return `${target}${separator}${cleanQuery}`;
}

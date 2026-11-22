'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * AI 模型中心顶层下划线选项卡导航 (WeChat Underline Tabs Navigation)
 *
 * 遵循 docs/ADMIN_UI_DESIGN_SYSTEM.md 第 5 节规范及微信管理后台交互哲学：
 * 1. 严格去除任何外层卡片容器 (无 bg-surface-raised, 无 rounded-2xl, 无 p-2)
 * 2. 纯文字极简下划线标尺选项卡 (Underline Tabs)，活动项带 2px 品牌洋红指示标尺
 * 3. 严格锁定固定高度 (h-12 / 48px)，与底边分割线紧密嵌合，垂直居中
 * 4. 三大核心页面 (/admin/models, /admin/models/providers, /admin/models/routing) 高度与基准线 100% 绝对一致，消除切换抖动与页面割裂
 */
export default function ModelNavTabs({
  activeTab: propActiveTab,
  modelCount,
  rightAction,
  className = '',
}) {
  const pathname = usePathname();

  const tabs = [
    { id: 'models', label: '模型货架与全景', href: '/admin/models', count: modelCount },
    { id: 'providers', label: '供应商与通道', href: '/admin/models/providers' },
    { id: 'routing', label: '智能路由与价盘策略', href: '/admin/models/routing' },
  ];

  return (
    <div
      className={`flex items-center justify-between border-b border-line-subtle h-12 ${className}`}
    >
      {/* 左侧下划线选项卡 (WeChat Underline Tabs) */}
      <nav aria-label="模型中心二级导航" className="flex items-center gap-6 sm:gap-8 h-full overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const isActive = propActiveTab
            ? propActiveTab === tab.id
            : tab.id === 'models'
            ? pathname === '/admin/models' || pathname === '/admin/models/frontend' || pathname?.startsWith('/admin/models/brands')
            : tab.id === 'providers'
            ? pathname === '/admin/models/providers' || pathname?.startsWith('/admin/models/providers')
            : tab.id === 'routing'
            ? pathname === '/admin/models/routing' || pathname?.startsWith('/admin/models/routing') || pathname === '/admin/models/pricing' || pathname?.startsWith('/admin/models/pricing')
            : pathname === tab.href;

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`relative h-full inline-flex items-center gap-2 text-sm transition-colors select-none whitespace-nowrap ${
                isActive
                  ? 'text-brand font-semibold'
                  : 'text-ink-muted hover:text-ink font-medium'
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-mono font-medium ${
                    isActive
                      ? 'bg-brand/15 text-brand font-bold'
                      : 'bg-white/10 text-ink-subtle'
                  }`}
                >
                  {tab.count}
                </span>
              )}
              {isActive && (
                <span className="absolute bottom-0 inset-x-0 h-[2px] bg-brand rounded-full" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* 右侧业务操作 (统一在同一水平基准线) */}
      {rightAction ? (
        <div className="shrink-0 flex items-center gap-2">
          {rightAction}
        </div>
      ) : (
        <div className="shrink-0 h-9" />
      )}
    </div>
  );
}

import { Inbox } from 'lucide-react';
import { CopyableId, ConfirmActionDialog } from './AdminUiClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export { CopyableId, ConfirmActionDialog, Badge, Button };

export function PageHeader({ eyebrow = 'SupDance 运营后台', title, description, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line-subtle pb-5">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-brand">
          {eyebrow}
        </p>
        <h1 className="text-2xl font-bold tracking-[-0.02em] leading-8 sm:text-3xl sm:leading-9 text-ink">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-3xl text-sm leading-6 tracking-[-0.005em] text-ink-muted">
            {description}
          </p>
        )}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </div>
  );
}
export function Card({ children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-line-subtle bg-surface/90 p-5 shadow-elevation-1 backdrop-blur-md transition-all duration-200 ease-out hover:border-line ${className}`}>
      {children}
    </section>
  );
}
export function StatusBadge({ children, tone = 'neutral' }) {
  const styles = {
    good: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    warn: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    danger: 'border-red-500/30 bg-red-500/10 text-red-400',
    info: 'border-brand/30 bg-brand/10 text-brand',
    neutral: 'border-line-subtle bg-white/[0.04] text-ink-muted',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-[0.01em] leading-4 ${styles[tone] || styles.neutral}`}>
      {children}
    </span>
  );
}
export function MetricCard({ label, value, hint, tone = 'neutral' }) {
  return (
    <Card className="p-5 relative overflow-hidden group hover:border-brand/30 transition-all duration-200">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">{label}</p>
      <p className={`mt-2.5 text-3xl font-bold tracking-[-0.025em] leading-9 tabular-nums ${tone === 'info' ? 'text-brand' : tone === 'good' ? 'text-emerald-400' : tone === 'warn' ? 'text-amber-400' : tone === 'danger' ? 'text-red-400' : 'text-ink'}`}>
        {value}
      </p>
      {hint && <p className="mt-2 text-xs leading-5 tracking-[0.01em] text-ink-subtle">{hint}</p>}
    </Card>
  );
}
export function EmptyState({ title = '暂无数据', description = '当前范围内还没有可显示的记录。' }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-12 text-center backdrop-blur-sm">
      <div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-line-subtle bg-white/[0.04] text-ink-muted">
        <Inbox className="size-6 text-brand" />
      </div>
      <p className="mt-4 font-semibold text-ink text-sm tracking-[-0.01em] leading-5">{title}</p>
      <p className="mt-1 text-xs text-ink-muted max-w-sm mx-auto leading-5 tracking-[-0.005em]">{description}</p>
    </div>
  );
}

{/* ─── 微信标准四列设置行组件 (WeChat 4-Column Setting Row) ─── */}
export function AdminSettingRow({ label, value, context, action, onClickAction, className = '' }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-line-subtle hover:bg-white/[0.015] transition-colors text-sm gap-2 sm:gap-4 ${className}`}>
      {/* Col 1: Label */}
      <div className="w-44 shrink-0 text-ink-muted font-medium">
        {label}
      </div>

      {/* Col 2: Current Value */}
      <div className="w-56 shrink-0 text-ink font-semibold">
        {value}
      </div>

      {/* Col 3: Rules & Limits */}
      <div className="flex-1 text-xs text-ink-subtle leading-relaxed">
        {context}
      </div>

      {/* Col 4: Action */}
      <div className="w-28 shrink-0 text-left sm:text-right">
        {action && (
          <button
            type="button"
            onClick={onClickAction}
            className="text-xs font-semibold text-brand hover:underline transition-all cursor-pointer"
          >
            {action}
          </button>
        )}
      </div>
    </div>
  );
}

{/* ─── 微信分步流程网格卡片 (WeChat 3-Column Milestone Card) ─── */}
export function AdminCardGridItem({ title, badge, subtext, actionLabel, onAction, className = '' }) {
  return (
    <div className={`p-4 rounded-xl border border-line-subtle bg-surface-raised flex flex-col justify-between space-y-3 hover:border-line transition-all ${className}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-body-sm font-semibold text-ink flex items-center gap-2">
          <span>{title}</span>
          {badge && (
            <span className="rounded px-1.5 py-0.2 text-[10px] bg-white/[0.06] text-ink-subtle border border-line-subtle font-normal">
              {badge}
            </span>
          )}
        </h4>
        {actionLabel && (
          <button
            type="button"
            onClick={onAction}
            className="text-caption font-semibold text-brand hover:underline cursor-pointer"
          >
            {actionLabel}
          </button>
        )}
      </div>
      {subtext && (
        <p className="text-caption text-ink-subtle line-clamp-1">{subtext}</p>
      )}
    </div>
  );
}

{/* ─── 微信风格下划线选项卡 (WeChat Underline Sub-Nav Tabs) ─── */}
export function AdminUnderlineTabs({ tabs = [], activeTab, onTabChange, rightAction, className = '' }) {
  return (
    <div className={`flex items-center justify-between border-b border-line-subtle h-12 ${className}`}>
      <div className="flex items-center gap-6 sm:gap-8 h-full overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`relative h-full inline-flex items-center gap-2 text-sm transition-colors cursor-pointer select-none whitespace-nowrap ${
                isActive ? 'text-brand font-semibold' : 'text-ink-muted hover:text-ink font-medium'
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
            </button>
          );
        })}
      </div>
      {rightAction && (
        <div className="shrink-0 flex items-center gap-2">
          {rightAction}
        </div>
      )}
    </div>
  );
}
export function DataTable({ columns, rows, data, empty = '暂无记录', emptyText }) {
  const tableRows = rows || data || [];
  const emptyLabel = emptyText || empty;
  if (!tableRows?.length) return <EmptyState title={emptyLabel} />;

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-surface/90 shadow-xl shadow-black/40 backdrop-blur-md scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-white/[0.08] bg-white/[0.02] text-xs font-semibold uppercase tracking-[0.06em] text-gray-400">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="whitespace-nowrap px-4 py-3.5">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {tableRows.map((row, index) => (
            <tr key={row.id || index} className="transition-colors duration-150 hover:bg-white/[0.03]">
              {columns.map((column) => (
                <td key={column.key} className="px-4 py-3.5 text-gray-300 text-xs leading-5 tracking-[-0.005em]">
                  {column.render ? column.render(row) : (row[column.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ meta, searchParams }) {
  const currentParams = new URLSearchParams(searchParams || {});
  const hasCursor = Boolean(currentParams.get('cursor'));
  const hasMore = Boolean(meta?.hasMore);

  if (!hasCursor && !hasMore) return null;

  const nextParams = new URLSearchParams(searchParams || {});
  if (meta?.nextCursor) {
    nextParams.set('cursor', meta.nextCursor);
  }

  const resetParams = new URLSearchParams(searchParams || {});
  resetParams.delete('cursor');

  return (
    <div className="mt-5 flex items-center justify-between">
      <div className="text-xs text-ink-subtle">
        {hasCursor ? '当前处于后续分页结果' : '当前显示首屏结果'}
      </div>
      <div className="flex items-center gap-2.5">
        {hasCursor && (
          <a
            href={`?${resetParams.toString()}`}
            className="inline-flex h-[38px] items-center rounded-xl border border-line-subtle bg-white/[0.04] px-3.5 text-xs font-medium text-ink-muted tracking-[-0.005em] transition-all duration-150 hover:bg-white/[0.08] hover:text-ink"
          >
            ← 返回第一页
          </a>
        )}
        {hasMore && (
          <a
            href={`?${nextParams.toString()}`}
            className="inline-flex h-[38px] items-center rounded-xl border border-line-subtle bg-white/[0.06] px-4 text-xs font-semibold text-ink tracking-[-0.005em] transition-all duration-150 hover:border-brand/40 hover:bg-brand/10 hover:text-brand active:scale-[0.98]"
          >
            加载下一页 →
          </a>
        )}
      </div>
    </div>
  );
}

{/* ─── 微信 We分析 成对分析图表卡片组件 (WeAnalysis Paired Chart Card) ─── */}
export function AdminChartCard({
  title,
  subtitle,
  actions,
  filters,
  children,
  emptyText,
  className = '',
}) {
  return (
    <div className={`p-5 rounded-2xl border border-line-subtle bg-surface-raised flex flex-col justify-between ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-3 border-b border-line-subtle/50">
        <div>
          <h3 className="text-body font-semibold text-ink">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-caption font-mono text-ink-subtle">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0 text-caption">
            {actions}
          </div>
        )}
      </div>

      {/* In-Card Filters */}
      {filters && (
        <div className="py-2.5 flex items-center justify-between gap-3 text-caption flex-wrap">
          {filters}
        </div>
      )}

      {/* Main Chart Body or Silent Empty */}
      <div className="pt-3 min-h-[220px] flex items-center justify-center">
        {emptyText ? (
          <div className="flex items-center gap-1.5 text-caption text-ink-subtle font-mono">
            <span className="text-xs">ⓘ</span>
            <span>{emptyText}</span>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

{/* ─── 微信 We分析 时间单步微调器 (WeAnalysis Date Stepper) ─── */}
export function AdminDateStepper({ label, onPrev, onNext, canPrev = true, canNext = true }) {
  return (
    <div className="inline-flex items-center gap-1.5 text-caption text-ink-muted">
      <button
        type="button"
        onClick={onPrev}
        disabled={!canPrev}
        className="p-1 rounded hover:bg-white/[0.06] text-ink-subtle hover:text-ink disabled:opacity-20 transition-colors cursor-pointer"
      >
        ‹
      </button>
      <span className="font-mono text-ink font-medium px-1">{label}</span>
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        className="p-1 rounded hover:bg-white/[0.06] text-ink-subtle hover:text-ink disabled:opacity-20 transition-colors cursor-pointer"
      >
        ›
      </button>
    </div>
  );
}

import Link from 'next/link';
import { Card, MetricCard, PageHeader, StatusBadge, AdminChartCard } from '@/components/admin/AdminUi';
import { PERMISSIONS } from '@/lib/admin/permissions';
import { useAdminData, useAdminPermissionGuard, useDocumentTitle } from '@/pages/helpers/pageHelpers';

function formatDate(value?: string | null) {
  return value
    ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
    : '—';
}

const EMPTY_DASHBOARD = {
  metrics: {
    users: 0,
    todayNewUsers: 0,
    activeSessions: 0,
    subscriptions: 0,
    creations: 0,
    succeededCreations: 0,
    failedCreations: 0,
    incomeUsd: 0,
    incomeCny: 0,
    paidOrdersCount: 0,
    totalApiCostUsd: 0,
    grossProfitUsd: 0,
    grossMarginPct: 0,
  },
  trends: { last7Days: [] as Array<{ date: string; label: string; count: number }> },
  risks: [] as Array<{ id: string; title: string; count: number; link: string }>,
  recentAudit: [] as Array<any>,
  meta: { reportTimezone: 'Asia/Shanghai', degraded: false },
};

export default function AdminDashboardPage() {
  useDocumentTitle('运营概览 | SupDance 管理后台');
  const { redirectEl } = useAdminPermissionGuard(PERMISSIONS.dashboardRead);
  const { data: fetched } = useAdminData<any>('/api/admin/dashboard');

  if (redirectEl) return redirectEl;

  const data = {
    ...EMPTY_DASHBOARD,
    ...(fetched || {}),
    metrics: { ...EMPTY_DASHBOARD.metrics, ...(fetched?.metrics || {}) },
    trends: { ...EMPTY_DASHBOARD.trends, ...(fetched?.trends || {}) },
    risks: Array.isArray(fetched?.risks) ? fetched.risks : EMPTY_DASHBOARD.risks,
    recentAudit: Array.isArray(fetched?.recentAudit)
      ? fetched.recentAudit
      : EMPTY_DASHBOARD.recentAudit,
    meta: { ...EMPTY_DASHBOARD.meta, ...(fetched?.meta || {}) },
  };

  const { metrics, trends, risks, recentAudit } = data;
  const totalCreations = metrics.creations;
  const successRate =
    totalCreations > 0
      ? `${Math.round((metrics.succeededCreations / totalCreations) * 100)}%`
      : '100%';
  const maxDayCount = Math.max(...(trends?.last7Days?.map((d: any) => d.count) || [1]), 1);

  return (
    <>
      <PageHeader
        eyebrow="商业化运营与智能监控"
        title="运营概览 & 经营毛利看板"
        description="实时监控 SupDance AI Studio 平台注册增长、模型调用稳定性、商业化营收、上游 API 成本及综合毛利。"
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-white/[0.10] bg-white/[0.04] px-2.5 py-0.5 text-xs font-medium text-gray-400">
            时区：{data.meta.reportTimezone}
          </span>
          <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
            实时营收结算
          </span>
          {data.meta.degraded && (
            <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-300">
              部分指标暂不可用
            </span>
          )}
        </div>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard
          label="总注册用户"
          value={metrics.users}
          hint={`今日新增 +${metrics.todayNewUsers || 0} 位`}
          tone="neutral"
        />
        <MetricCard
          label="当前活跃用户"
          value={metrics.activeSessions}
          hint={`${metrics.subscriptions} 位付费订阅中`}
          tone="info"
        />
        <MetricCard
          label="生成总调用量"
          value={metrics.creations}
          hint={`成功率 ${successRate} (失败 ${metrics.failedCreations})`}
          tone={metrics.failedCreations > 0 ? 'warn' : 'info'}
        />
        <MetricCard
          label="平台总收入 (GMV)"
          value={`$${Number(metrics.incomeUsd || 0).toFixed(2)}`}
          hint={`CNY: ¥${Number(metrics.incomeCny || 0).toFixed(2)} (${metrics.paidOrdersCount || 0} 笔支付)`}
          tone="good"
        />
        <MetricCard
          label="上游 API 总成本"
          value={`$${Number(metrics.totalApiCostUsd || 0).toFixed(2)}`}
          hint="模型官方接口费用"
          tone={metrics.totalApiCostUsd > 0 ? 'warn' : 'neutral'}
        />
        <MetricCard
          label="综合毛利 (毛利率)"
          value={`$${Number(metrics.grossProfitUsd || 0).toFixed(2)}`}
          hint={`毛利率: ${metrics.grossMarginPct}%`}
          tone={metrics.grossProfitUsd >= 0 ? 'good' : 'danger'}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <AdminChartCard
          title="近 7 天生成调用走势"
          subtitle={`每日 AI 图像/视频生成请求总量 · 7天累计: ${trends?.last7Days?.reduce((acc: number, d: any) => acc + d.count, 0) || 0} 次`}
          filters={
            <div className="flex items-center justify-between w-full text-xs text-ink-muted">
              <span className="font-mono text-ink-subtle">每日调用频次分布</span>
              <span className="font-mono text-brand font-semibold">峰值: {maxDayCount} 次/日</span>
            </div>
          }
        >
          <div className="w-full flex h-48 items-end gap-3 sm:gap-6 px-2">
            {trends?.last7Days?.map((day: any) => {
              const heightPct = Math.max(8, Math.round((day.count / maxDayCount) * 100));
              return (
                <div key={day.date} className="group relative flex flex-1 flex-col items-center h-full justify-end">
                  <div className="absolute -top-9 opacity-0 group-hover:opacity-100 transition rounded-lg bg-surface-raised border border-line-subtle px-2 py-1 text-[10px] text-brand font-mono pointer-events-none whitespace-nowrap shadow-sm">
                    {day.date}: {day.count} 次
                  </div>
                  <div
                    style={{ height: `${heightPct}%` }}
                    className="w-full max-w-[42px] rounded-t-lg bg-gradient-to-t from-brand/25 via-brand/40 to-brand transition-all duration-200 group-hover:from-brand/40 group-hover:to-brand-hover"
                  />
                  <span className="mt-2 text-[11px] text-gray-400 font-mono">{day.label}</span>
                </div>
              );
            })}
          </div>
        </AdminChartCard>

        <Card>
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
            <div>
              <h2 className="text-base font-semibold text-white tracking-[-0.015em] leading-6">
                待处理风险队列
              </h2>
              <p className="mt-1 text-xs text-gray-400 tracking-[-0.005em] leading-5">
                系统检测到的生成失败或待审核异常项
              </p>
            </div>
            <StatusBadge tone={risks.length ? 'warn' : 'good'}>
              {risks.length ? `${risks.length} 项关注` : '健康平稳'}
            </StatusBadge>
          </div>

          <div className="mt-5 space-y-3">
            {risks.length ? (
              risks.map((risk: any) => (
                <div
                  key={risk.id}
                  className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 transition-all duration-200 hover:border-white/[0.16] hover:bg-white/[0.04]"
                >
                  <div>
                    <p className="text-sm font-semibold text-white tracking-[-0.005em]">
                      {risk.title}
                    </p>
                    <p className="mt-1 text-xs text-gray-400 tracking-[-0.005em]">
                      共有 <span className="font-bold text-amber-300">{risk.count}</span> 条记录待处理
                    </p>
                  </div>
                  <Link
                    href={risk.link}
                    className="inline-flex h-8 items-center rounded-lg border border-white/[0.10] bg-white/[0.04] px-3 text-xs font-medium text-gray-200 transition-all duration-200 hover:bg-white/[0.08] hover:text-white active:scale-[0.98]"
                  >
                    立即排查 →
                  </Link>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-white/[0.08] p-8 text-center">
                <p className="text-xs text-gray-400">当前暂无待处理风险，系统运行正常。</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
            <div>
              <h2 className="text-base font-semibold text-white tracking-[-0.015em] leading-6">
                最近管理员操作审计
              </h2>
              <p className="mt-1 text-xs text-gray-400 tracking-[-0.005em] leading-5">
                全站重要管理动作（调额、改价、封禁、切换角色）全自动留痕
              </p>
            </div>
            <Link
              href="/admin/audit"
              className="text-xs text-brand hover:underline font-semibold tracking-[-0.005em]"
            >
              全部审计记录 →
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {recentAudit.length ? (
              recentAudit.map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 border-b border-white/[0.05] pb-3 last:border-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-white/90 tracking-[-0.005em]">
                      {item.action}
                    </p>
                    <p className="mt-1 truncate text-[11px] text-gray-500">
                      {item.actor_email} · {item.target_type || '系统'} {item.target_id || ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <StatusBadge
                      tone={
                        item.risk_level === 'high'
                          ? 'danger'
                          : item.risk_level === 'medium'
                            ? 'warn'
                            : 'neutral'
                      }
                    >
                      {item.risk_level}
                    </StatusBadge>
                    <p className="mt-1 text-[10px] text-gray-500">{formatDate(item.created_at)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-gray-500">暂无管理员操作记录</div>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-white tracking-[-0.015em] leading-6 mb-2">
            快速调度与运维入口
          </h2>
          <p className="text-xs text-gray-400 tracking-[-0.005em] leading-5 mb-5">
            一键直达核心业务管控模块
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/admin/users"
              className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5 hover:border-brand/30 hover:bg-white/[0.05] transition-all duration-200"
            >
              <p className="text-xs font-semibold text-white tracking-[-0.005em]">👥 用户与角色</p>
              <p className="mt-1 text-[11px] text-gray-400">搜索、封禁、解封</p>
            </Link>
            <Link
              href="/admin/credits"
              className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5 hover:border-brand/30 hover:bg-white/[0.05] transition-all duration-200"
            >
              <p className="text-xs font-semibold text-white tracking-[-0.005em]">💰 额度流水台账</p>
              <p className="mt-1 text-[11px] text-gray-400">充值、扣减、明细</p>
            </Link>
            <Link
              href="/admin/models"
              className="rounded-xl border border-brand/30 bg-brand/10 p-3.5 hover:bg-brand/15 transition-all duration-200"
            >
              <p className="text-xs font-semibold text-brand tracking-[-0.005em]">
                🎛️ 模型开关与成本
              </p>
              <p className="mt-1 text-[11px] text-brand/70">成本价与 Credits 定价</p>
            </Link>
            <Link
              href="/admin/health"
              className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5 hover:border-brand/30 hover:bg-white/[0.05] transition-all duration-200"
            >
              <p className="text-xs font-semibold text-white tracking-[-0.005em]">
                🩺 系统健康 & 日志
              </p>
              <p className="mt-1 text-[11px] text-gray-400">PM2 日志、队列与内存</p>
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
}

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useLocation } from 'react-router';
import {
  Card,
  DataTable,
  MetricCard,
  PageHeader,
  Pagination,
  StatusBadge,
  CopyableId,
} from '@/components/admin/AdminUi';
import AdminActionForm from '@/components/admin/AdminActionForm';
import ExportButton from '@/components/admin/ExportButton';
import { hasPermission, PERMISSIONS } from '@/lib/admin/permissions';
import { CREDIT_PRICING_POLICY } from '@/lib/pricing/creditPolicy';
import CouponGeneratorClient from '@/pages/admin/client/coupons/CouponGeneratorClient';
import CouponRedemptionDetails from '@/pages/admin/client/coupons/CouponRedemptionDetails';
import PlansManagerClient from '@/pages/admin/client/plans/PlansManagerClient';
import CostCenterClient from '@/pages/admin/client/cost-center/CostCenterClient';
import ProfitPeriodSelector from '@/pages/admin/client/profit-center/ProfitPeriodSelector';
import PaymentProvidersPanel from '@/pages/admin/client/providers/payments/PaymentProvidersPanel';
import SubscriptionFaqManagerClient from '@/pages/admin/client/subscription-faq/SubscriptionFaqManagerClient';
import {
  AdminFilterForm,
  normalizeAdminListResponse,
  useAdminData,
  useAdminPermissionGuard,
  useAdminRawData,
  useDocumentTitle,
} from '@/pages/helpers/pageHelpers';

function formatDate(value?: string | null) {
  return value
    ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
    : '—';
}

export function AdminOrdersPage() {
  useDocumentTitle('订单与支付记录 | SupDance 管理后台');
  const { redirectEl } = useAdminPermissionGuard(PERMISSIONS.billingRead);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const { data: raw } = useAdminRawData(`/api/admin/orders${location.search}`, [location.search]);

  if (redirectEl) return redirectEl;
  const result = normalizeAdminListResponse(raw);

  const columns = [
    {
      key: 'id',
      label: '系统单号 / 外部流水号',
      render: (row: any) => (
        <div>
          <CopyableId id={row.id} />
          {row.provider_order_id && (
            <div className="mt-1 text-[11px] text-white/40">
              外部: <CopyableId id={row.provider_order_id} />
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'user',
      label: '支付用户',
      render: (row: any) => (
        <Link href={`/admin/users/${row.user_id}`} className="font-semibold text-white hover:text-brand">
          {row.email}
        </Link>
      ),
    },
    { key: 'provider', label: '渠道' },
    {
      key: 'amount',
      label: '金额',
      render: (row: any) => (
        <span className="font-mono font-bold text-white">
          {(row.amount_minor / 100).toFixed(2)} {row.currency}
        </span>
      ),
    },
    {
      key: 'status',
      label: '支付状态',
      render: (row: any) => (
        <StatusBadge
          tone={
            row.status === 'paid' || row.status === 'completed'
              ? 'good'
              : row.status === 'refunded'
                ? 'danger'
                : 'warn'
          }
        >
          {row.status}
        </StatusBadge>
      ),
    },
    {
      key: 'created_at',
      label: '下单时间',
      render: (row: any) => formatDate(row.created_at),
    },
    {
      key: 'action',
      label: '退款操作',
      render: (row: any) =>
        row.status === 'paid' ? (
          <AdminActionForm
            action={`/api/admin/orders/${row.id}/refund`}
            method="POST"
            fields={[{ name: 'reason', placeholder: '退款原因说明', required: true }]}
            label="退款"
            requiredPermission={PERMISSIONS.billingWrite}
            tone="danger"
            confirmMessage="确认申请退款？支付渠道确认成功后，系统会更新订单与账务记录。"
          />
        ) : row.status === 'refunded' ? (
          <span className="text-xs text-white/30">已退款</span>
        ) : (
          <span className="text-xs text-white/30">—</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="财务中心"
        title="订单与支付记录"
        description="所有线上交易、充值与退款历史订单。"
        actions={<ExportButton type="orders" label="导出订单 CSV" />}
      />

      <Card className="mb-6">
        <AdminFilterForm>
          <input
            name="q"
            defaultValue={params.get('q') || ''}
            placeholder="搜索单号、用户邮箱或外部流水…"
            className="min-w-[240px] flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-brand"
          />

          <select
            name="status"
            defaultValue={params.get('status') || ''}
            className="rounded-xl border border-white/10 bg-[#0a0a0a] px-3 py-2.5 text-xs text-white/70 outline-none focus:border-brand"
          >
            <option value="">全部状态</option>
            <option value="paid">已支付</option>
            <option value="completed">已完成</option>
            <option value="pending">待支付</option>
            <option value="refunded">已退款</option>
            <option value="failed">失败</option>
          </select>

          <button
            type="submit"
            className="rounded-xl bg-brand hover:bg-brand-hover px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-all"
          >
            筛选
          </button>
        </AdminFilterForm>
      </Card>

      <DataTable columns={columns} rows={result.rows} empty="未找到匹配的订单记录" />
      <Pagination meta={result.meta} searchParams={params} />
    </>
  );
}

export function AdminSubscriptionsPage() {
  useDocumentTitle('订阅管理 | SupDance 管理后台');
  const { redirectEl } = useAdminPermissionGuard(PERMISSIONS.billingRead);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const { data: raw } = useAdminRawData(`/api/admin/subscriptions${location.search}`, [
    location.search,
  ]);

  if (redirectEl) return redirectEl;
  const result = normalizeAdminListResponse(raw);

  const columns = [
    {
      key: 'user',
      label: '用户邮箱',
      render: (row: any) => (
        <div>
          <Link href={`/admin/users/${row.user_id}`} className="font-semibold text-white hover:text-brand">
            {row.email}
          </Link>
          <div className="mt-1">
            <CopyableId id={row.id} label="订阅号" />
          </div>
        </div>
      ),
    },
    { key: 'provider', label: '支付渠道' },
    { key: 'plan_id', label: '套餐 ID' },
    {
      key: 'status',
      label: '状态',
      render: (row: any) => (
        <StatusBadge
          tone={row.status === 'active' ? 'good' : row.status === 'past_due' ? 'danger' : 'warn'}
        >
          {row.status}
        </StatusBadge>
      ),
    },
    {
      key: 'current_period_end',
      label: '周期到期时间',
      render: (row: any) => formatDate(row.current_period_end),
    },
    {
      key: 'updated_at',
      label: '最近同步时间',
      render: (row: any) => formatDate(row.updated_at),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="计费与权益"
        title="订阅管理"
        description="管理平台用户的周期性订阅（包含 Stripe 等海外代扣订阅），查看周期到期时间与生效状态。"
      />

      <Card className="mb-6">
        <AdminFilterForm>
          <input
            name="q"
            defaultValue={params.get('q') || ''}
            placeholder="搜索用户邮箱、订阅 ID…"
            className="min-w-[240px] flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-brand"
          />

          <select
            name="status"
            defaultValue={params.get('status') || ''}
            className="rounded-xl border border-white/10 bg-[#0a0a0a] px-3 py-2.5 text-xs text-white/70 outline-none focus:border-brand"
          >
            <option value="">全部状态</option>
            <option value="active">Active (正常)</option>
            <option value="trialing">Trialing (试用)</option>
            <option value="past_due">Past Due (逾期)</option>
            <option value="canceled">Canceled (已取消)</option>
          </select>

          <button
            type="submit"
            className="rounded-xl bg-brand hover:bg-brand-hover px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-all"
          >
            筛选
          </button>
        </AdminFilterForm>
      </Card>

      <DataTable columns={columns} rows={result.rows} empty="未找到匹配的订阅记录" />
      <Pagination meta={result.meta} searchParams={params} />
    </>
  );
}

export function AdminCreditsPage() {
  useDocumentTitle('额度与资产账本 | SupDance 管理后台');
  const { redirectEl } = useAdminPermissionGuard(PERMISSIONS.creditsRead);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const { data: raw } = useAdminRawData(`/api/admin/credits/ledger${location.search}`, [
    location.search,
  ]);

  if (redirectEl) return redirectEl;
  const result = normalizeAdminListResponse(raw);

  const columns = [
    {
      key: 'user',
      label: '目标用户',
      render: (row: any) => (
        <div>
          <Link href={`/admin/users/${row.user_id}`} className="font-semibold text-white hover:text-brand">
            {row.email}
          </Link>
          <div className="mt-1">
            <CopyableId id={row.id} label="流水 ID" />
          </div>
        </div>
      ),
    },
    {
      key: 'bucket_type',
      label: '资产账户',
      render: (row: any) => {
        const type = String(row.bucket_type || '').toLowerCase();
        if (type === 'subscription') {
          return (
            <span className="rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[11px] font-semibold text-purple-300">
              💎 订阅专属额度
            </span>
          );
        }
        if (type === 'perpetual') {
          return (
            <span className="rounded-md border border-brand/30 bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">
              ⚡ 通用充值积分
            </span>
          );
        }
        if (type === 'currency' || type === 'k_coin') {
          return (
            <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
              🪙 平台 K 币
            </span>
          );
        }
        return (
          <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
            🎁 每日免费
          </span>
        );
      },
    },
    {
      key: 'delta',
      label: '变动量',
      render: (row: any) => (
        <span className={`font-mono font-bold text-sm ${row.delta > 0 ? 'text-emerald-300' : 'text-red-400'}`}>
          {row.delta > 0 ? `+${row.delta}` : row.delta}
        </span>
      ),
    },
    {
      key: 'balance_after',
      label: '变动后结余',
      render: (row: any) => (
        <span className="font-mono text-xs text-white/70">
          {row.balance_after !== null && row.balance_after !== undefined ? row.balance_after : '—'}
        </span>
      ),
    },
    { key: 'reason', label: '变动原因' },
    {
      key: 'reference_id',
      label: '关联单号 / 任务',
      render: (row: any) => <CopyableId id={row.reference_id} />,
    },
    {
      key: 'actor_user_id',
      label: '操作人',
      render: (row: any) =>
        row.actor_user_id ? (
          <CopyableId id={row.actor_user_id} />
        ) : (
          <span className="text-white/40">系统自动</span>
        ),
    },
    {
      key: 'created_at',
      label: '入账时间',
      render: (row: any) => formatDate(row.created_at),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="计费与资产中枢"
        title="额度与资产账本"
        description="不可篡改的追加型资产流水明细。区分订阅专属额度、通用充值积分与平台 K 币流动。"
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card className="border-purple-500/20 bg-purple-500/[0.03]">
          <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
            <span>💎 订阅专属额度 (Subscription Quota)</span>
          </div>
          <p className="mt-2 text-xs text-white/60 leading-relaxed">
            订阅制专属资产，按月或按年随套餐发放，具备账单周期自动重置机制。在所有 AI 生成任务中享有<strong>最高抵扣优先级</strong>。
          </p>
        </Card>

        <Card className="border-brand/20 bg-brand/[0.03]">
          <div className="flex items-center gap-2 text-brand font-bold text-sm">
            <span>⚡ 通用算力积分 (Credits)</span>
          </div>
          <p className="mt-2 text-xs text-white/60 leading-relaxed">
            平台通用按量算力，永久有效不过期。通过卡密充值、每日签到或单独购买获取，在订阅额度耗尽后自动作为次级池无缝补足扣除。
          </p>
        </Card>

        <Card className="border-amber-500/20 bg-amber-500/[0.03]">
          <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
            <span>🪙 平台 K 币钱包 (K-Coins)</span>
          </div>
          <p className="mt-2 text-xs text-white/60 leading-relaxed">
            网站独有的社区互动与激励硬币，不支持现金直接充值；通过每日登录、优质作品获投和官方活动获得，用于社区投币与 K 币兑换中心的专属权益。
          </p>
        </Card>
      </div>

      <Card className="mb-6">
        <AdminFilterForm>
          <input
            name="q"
            defaultValue={params.get('q') || ''}
            placeholder="搜索用户邮箱、变动原因或关联单号…"
            className="min-w-[240px] flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-brand/50"
          />
          <button
            type="submit"
            className="rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-white hover:bg-brand-hover transition shadow-lg shadow-brand/10"
          >
            筛选流水
          </button>
        </AdminFilterForm>
      </Card>

      <DataTable columns={columns} rows={result.rows} empty="暂无匹配的额度账本流水" />
      <Pagination meta={result.meta} searchParams={params} />
    </>
  );
}

export function AdminCouponsPage() {
  useDocumentTitle('卡密与兑换码 | SupDance 管理后台');
  const { redirectEl } = useAdminPermissionGuard(PERMISSIONS.couponsRead);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const { data: raw } = useAdminRawData(`/api/admin/coupons${location.search}`, [location.search]);

  if (redirectEl) return redirectEl;
  const result = normalizeAdminListResponse(raw);

  const columns = [
    {
      key: 'code',
      label: '兑换码 / 卡密',
      render: (row: any) => (
        <div className="font-mono font-bold text-brand">
          <CopyableId id={row.code} />
        </div>
      ),
    },
    {
      key: 'type',
      label: '权益类型',
      render: (row: any) => (
        <span className="text-xs text-white/80">
          {row.type === 'credits' ? '算力点卡' : '会员套餐'}
        </span>
      ),
    },
    {
      key: 'value',
      label: '面值 / 套餐',
      render: (row: any) => (
        <span className="font-semibold text-white">
          {row.type === 'credits' ? `${row.value} 积分` : row.value}
        </span>
      ),
    },
    {
      key: 'usage',
      label: '核销次数',
      render: (row: any) => (
        <span className="font-mono text-xs text-white/70">
          {row.used_count || 0} / {row.max_uses || 1}
        </span>
      ),
    },
    {
      key: 'redemptions',
      label: '兑换明细',
      render: (row: any) => (
        <CouponRedemptionDetails
          couponCode={row.code}
          redemptions={row.redemptions}
          usedCount={row.used_count}
          maxUses={row.max_uses}
          type={row.type}
          value={row.value}
        />
      ),
    },
    {
      key: 'status',
      label: '状态',
      render: (row: any) => (
        <StatusBadge
          tone={
            !row.is_active
              ? 'danger'
              : row.used_count >= row.max_uses
                ? 'neutral'
                : 'good'
          }
        >
          {!row.is_active ? '已停用' : row.used_count >= row.max_uses ? '已核销' : '有效'}
        </StatusBadge>
      ),
    },
    {
      key: 'created_at',
      label: '创建时间',
      render: (row: any) => formatDate(row.created_at),
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <PageHeader
          eyebrow="订阅与计费"
          title="卡密与兑换码"
          description="批量生成算力充值点卡与会员套餐激活码，实时监控卡密分发、核销人与生命周期状态。"
        />
        <div className="shrink-0">
          <CouponGeneratorClient />
        </div>
      </div>

      <Card className="mb-6">
        <AdminFilterForm>
          <input
            name="q"
            defaultValue={params.get('q') || ''}
            placeholder="搜索卡密码或创建人…"
            className="min-w-[260px] flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-brand/50"
          />

          <select
            name="type"
            defaultValue={params.get('type') || ''}
            className="rounded-xl border border-white/10 bg-[#0a0a0a] px-3.5 py-2.5 text-xs text-white/70 outline-none focus:border-brand/50"
          >
            <option value="">全部类型</option>
            <option value="credits">算力点卡</option>
            <option value="plan">会员套餐</option>
          </select>

          <button
            type="submit"
            className="rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-white hover:bg-brand-hover transition-colors"
          >
            筛选
          </button>
        </AdminFilterForm>
      </Card>

      <DataTable columns={columns} rows={result.rows} empty="暂无卡密与兑换码记录" />
      <Pagination meta={result.meta} searchParams={params} />
    </>
  );
}

export function AdminPlansPage() {
  const t = useTranslations('adminPlans');
  useDocumentTitle(`${t('title')} | SupDance`);
  const { user, redirectEl } = useAdminPermissionGuard(PERMISSIONS.plansRead);
  const { data, loading, error, reload } = useAdminData<any[]>(redirectEl ? null : '/api/admin/plans');

  if (redirectEl) return redirectEl;

  return (
    <PlansManagerClient initialPlans={data || []} loading={loading} error={error}
      reload={reload} canWrite={hasPermission(user?.role, PERMISSIONS.plansWrite)} />
  );
}

export function AdminSubscriptionFaqPage() {
  useDocumentTitle('订阅说明与QA问答管理 | SupDance 运营后台');
  const { user, redirectEl } = useAdminPermissionGuard(PERMISSIONS.plansRead);

  if (redirectEl) return redirectEl;

  return <SubscriptionFaqManagerClient canWrite={hasPermission(user?.role, PERMISSIONS.plansWrite)} />;
}

const PERIOD_LABELS: Record<string, string> = {
  today: '今天',
  yesterday: '昨天',
  '7d': '近 7 天',
  '30d': '近 30 天',
  month: '本月',
};

export function AdminCostCenterPage() {
  useDocumentTitle('成本中心 | SupDance 管理后台');
  const { redirectEl } = useAdminPermissionGuard(PERMISSIONS.dashboardRead);
  const location = useLocation();
  const period = new URLSearchParams(location.search).get('period') || '7d';
  const { data } = useAdminData<any>(`/api/admin/cost-center?period=${encodeURIComponent(period)}`, [
    period,
  ]);

  if (redirectEl) return redirectEl;

  const rows: any[] = Array.isArray(data) ? data : data?.rows || [];
  const totalRequests = rows.reduce((sum, r) => sum + (r.total_requests || 0), 0);
  const totalSuccess = rows.reduce((sum, r) => sum + (r.success_count || 0), 0);
  const pending = rows.reduce((sum, r) => sum + (r.pending_reconciliation || 0), 0);
  const usdComplete = rows.every((r) => r.total_cost_usd != null);
  const cnyComplete = rows.every((r) => r.total_cost_cny != null);
  const totalCostCny = rows.reduce((sum, r) => sum + Number(r.total_cost_cny || 0), 0);
  const totalCostUsd = rows.reduce((sum, r) => sum + Number(r.total_cost_usd || 0), 0);
  const overallSuccessRate =
    totalRequests > 0 ? ((totalSuccess / totalRequests) * 100).toFixed(1) : '0';

  const columns = [
    {
      key: 'model',
      label: '模型',
      render: (row: any) => (
        <span className="text-xs font-semibold text-white">{row.model_name || row.model_id}</span>
      ),
    },
    {
      key: 'provider',
      label: '供应商',
      render: (row: any) => (
        <span className="text-xs text-white/70">{row.provider_name || row.provider_id}</span>
      ),
    },
    {
      key: 'total',
      label: '请求数',
      render: (row: any) => (
        <span className="text-xs font-mono tabular-nums text-white">{row.total_requests}</span>
      ),
    },
    {
      key: 'success',
      label: '成功',
      render: (row: any) => (
        <span className="text-xs font-mono tabular-nums text-emerald-400">{row.success_count}</span>
      ),
    },
    {
      key: 'failure',
      label: '失败',
      render: (row: any) => (
        <span
          className={`text-xs font-mono tabular-nums ${
            row.failure_count > 0 ? 'text-red-400' : 'text-white/50'
          }`}
        >
          {row.failure_count}
        </span>
      ),
    },
    {
      key: 'rate',
      label: '成功率',
      render: (row: any) => (
        <StatusBadge
          tone={
            Number(row.success_rate) >= 95
              ? 'good'
              : Number(row.success_rate) >= 80
                ? 'warn'
                : 'danger'
          }
        >
          {row.success_rate}%
        </StatusBadge>
      ),
    },
    {
      key: 'latency',
      label: '平均耗时',
      render: (row: any) => (
        <span className="text-xs font-mono tabular-nums text-white/70">
          {row.avg_duration_ms > 0 ? `${(row.avg_duration_ms / 1000).toFixed(1)}s` : '—'}
        </span>
      ),
    },
    {
      key: 'cost',
      label: 'API 成本（含估算）',
      render: (row: any) => (
        <span className="text-xs font-mono tabular-nums text-white">
          {row.total_cost_usd == null ? '待核对' : `$${Number(row.total_cost_usd).toFixed(4)}`}
        </span>
      ),
    },
    {
      key: 'unit_cost',
      label: '单次成本',
      render: (row: any) => (
        <span className="text-xs font-mono tabular-nums text-white/70">
          {row.avg_cost_usd == null ? '待核对' : `$${Number(row.avg_cost_usd).toFixed(6)}`}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="财务分析"
        title="成本中心"
        description="按模型和供应商分析 API 调用成本。实际费用与待核对估算合并展示；历史人民币成本使用任务锁定汇率。"
      >
        <CostCenterClient currentPeriod={period} />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <MetricCard
          label="总请求数"
          value={totalRequests.toLocaleString()}
          hint={`${PERIOD_LABELS[period] || period}`}
          tone="neutral"
        />
        <MetricCard
          label="成功率"
          value={`${overallSuccessRate}%`}
          hint={`${totalSuccess} 次成功`}
          tone={Number(overallSuccessRate) >= 95 ? 'good' : 'warn'}
        />
        <MetricCard
          label="API 总成本（含估算）"
          value={usdComplete ? `$${totalCostUsd.toFixed(2)}` : '待核对'}
          hint={`${pending} 条费用待核对`}
          tone="info"
        />
        <MetricCard
          label="成本(CNY，含估算)"
          value={cnyComplete ? `¥${totalCostCny.toFixed(2)}` : '待核对'}
          hint="按任务锁定汇率；缺失费用或汇率时待核对"
          tone="neutral"
        />
      </div>

      <DataTable columns={columns} rows={rows} empty="该时间段暂无成本记录" />
    </>
  );
}

const CREDIT_TO_CNY = CREDIT_PRICING_POLICY.cnyPerCredit;

export function AdminProfitCenterPage() {
  useDocumentTitle('利润中心 | SupDance 管理后台');
  const { redirectEl } = useAdminPermissionGuard(PERMISSIONS.dashboardRead);
  const location = useLocation();
  const period = new URLSearchParams(location.search).get('period') || '7d';
  const { data } = useAdminData<any>(
    `/api/admin/profit-center?period=${encodeURIComponent(period)}`,
    [period]
  );

  if (redirectEl) return redirectEl;

  const rows: any[] = Array.isArray(data) ? data : data?.rows || [];
  const totalRevenue = rows.reduce((sum, r) => sum + Number(r.revenue_cny || 0), 0);
  const totalCostCny = rows.reduce((sum, r) => sum + Number(r.cost_cny_est || 0), 0);
  const complete = rows.every((r) => r.cost_cny_est != null);
  const pending = rows.reduce((sum, r) => sum + (r.pending_reconciliation || 0), 0);
  const totalProfit = totalRevenue - totalCostCny;
  const overallMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0';
  const totalCredits = rows.reduce((sum, r) => sum + (r.total_credits || 0), 0);

  const columns = [
    {
      key: 'model',
      label: '模型',
      render: (row: any) => (
        <div>
          <p className="text-xs font-semibold text-white">{row.model_name || row.model_id}</p>
          <p className="text-[11px] text-white/40">
            {row.category} · {row.generation_count} 次
          </p>
        </div>
      ),
    },
    {
      key: 'credits',
      label: '消费(Credits)',
      render: (row: any) => (
        <span className="text-xs font-mono tabular-nums text-white">
          {(row.total_credits || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'revenue',
      label: '积分折算收入(CNY)',
      render: (row: any) => (
        <span className="text-xs font-mono tabular-nums text-brand font-semibold">
          ¥{Number(row.revenue_cny || 0).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'cost_usd',
      label: 'API 成本(USD)',
      render: (row: any) => (
        <span className="text-xs font-mono tabular-nums text-white/70">
          {row.cost_usd == null ? '待核对' : `$${Number(row.cost_usd).toFixed(4)}`}
        </span>
      ),
    },
    {
      key: 'cost_cny',
      label: '成本(CNY)',
      render: (row: any) => (
        <span className="text-xs font-mono tabular-nums text-white/70">
          {row.cost_cny_est == null ? '待核对' : `¥${Number(row.cost_cny_est).toFixed(2)}`}
        </span>
      ),
    },
    {
      key: 'profit',
      label: '估算毛利(CNY)',
      render: (row: any) => (
        <span
          className={`text-xs font-mono tabular-nums ${
            Number(row.gross_profit_cny) >= 0 ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {row.gross_profit_cny == null ? '待核对' : `¥${Number(row.gross_profit_cny).toFixed(2)}`}
        </span>
      ),
    },
    {
      key: 'margin',
      label: '估算毛利率',
      render: (row: any) => {
        if (row.gross_margin_pct == null) return <StatusBadge tone="warn">待核对</StatusBadge>;
        const margin = Number(row.gross_margin_pct);
        const minMargin =
          Number(row.min_gross_margin_rate ?? CREDIT_PRICING_POLICY.minimumGrossMarginRate) * 100;
        const belowFloor = margin < minMargin && margin < 35;
        return (
          <div className="flex items-center gap-1.5">
            <StatusBadge tone={margin >= 50 ? 'good' : margin >= 30 ? 'warn' : 'danger'}>
              {margin.toFixed(1)}%
            </StatusBadge>
            {belowFloor && (
              <span className="text-[10px] text-red-400" title={`低于最低毛利率 ${minMargin}%`}>
                ⚠
              </span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="财务分析"
        title="利润中心"
        description={`按模型分析积分折算收入与 API 成本，监控估算毛利。积分换算：1 Credit = ¥${CREDIT_TO_CNY}。`}
      >
        <ProfitPeriodSelector currentPeriod={period} />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <MetricCard
          label="积分消费"
          value={totalCredits.toLocaleString()}
          hint={`${PERIOD_LABELS[period] || period}`}
          tone="neutral"
        />
        <MetricCard label="估算收入" value={`¥${totalRevenue.toFixed(2)}`} hint="CNY" tone="info" />
        <MetricCard
          label="API 成本（含估算）"
          value={complete ? `¥${totalCostCny.toFixed(2)}` : '待核对'}
          hint={`${pending} 条费用待核对`}
          tone={totalCostCny > totalRevenue ? 'danger' : 'neutral'}
        />
        <MetricCard
          label="综合估算毛利率"
          value={complete ? `${overallMargin}%` : '待核对'}
          hint={complete ? `估算毛利 ¥${totalProfit.toFixed(2)}` : '费用或任务汇率缺失'}
          tone={
            Number(overallMargin) >= 50
              ? 'good'
              : Number(overallMargin) >= 30
                ? 'warn'
                : 'danger'
          }
        />
      </div>

      <DataTable columns={columns} rows={rows} empty="该时间段暂无利润数据" />

      <div className="mt-6">
        <Card>
          <h3 className="text-xs font-bold text-white mb-2">计算说明</h3>
          <ul className="space-y-1 text-[11px] leading-4 text-white/50">
            <li>• 积分折算收入 = 用户消费积分 × ¥{CREDIT_TO_CNY}/Credit，不代表现金实收</li>
            <li>• 成本按每条记录优先取供应商实际费用，否则取估算费用；使用该任务锁定汇率</li>
            <li>• 估算毛利 = 积分折算收入 - 成本；费用或汇率缺失时显示待核对，估算费用仍需对账</li>
            <li>• ⚠ 标记表示毛利率低于该模型配置的最低毛利率阈值</li>
          </ul>
        </Card>
      </div>
    </>
  );
}

export function AdminPaymentProvidersPage() {
  useDocumentTitle('支付渠道与网关配置 | 管理后台');
  const { user, redirectEl } = useAdminPermissionGuard(PERMISSIONS.providersRead);
  const { data, loading } = useAdminData<any>('/api/admin/providers');

  if (redirectEl) return redirectEl;

  const canWrite = hasPermission(user?.role, PERMISSIONS.providersWrite);
  const allProviders = Array.isArray(data) ? data : data?.providers || [];
  const paymentProviders = allProviders.filter((item: any) => item.kind === 'payment');

  return (
    <>
      <PageHeader
        eyebrow="系统集成"
        title="支付渠道与网关配置"
        description="配置支付宝、微信支付与 Stripe 网关密钥、Webhook 回调验签密钥，并在启用的渠道下自动映射到用户前端收银台。仅完整配置且启用的渠道会对用户显示。"
      />
      {loading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-white/[0.03]" />
      ) : (
        <PaymentProvidersPanel providers={paymentProviders} canWrite={canWrite} />
      )}
    </>
  );
}

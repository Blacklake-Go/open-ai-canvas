import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useLocation } from 'react-router';
import {
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  Pagination,
  StatusBadge,
  CopyableId,
} from '@/components/admin/AdminUi';
import { hasPermission, PERMISSIONS } from '@/lib/admin/permissions';
import { UserGroupList } from '@/pages/admin/client/generations/UserGroupList';
import ReconciliationClient from '@/pages/admin/client/generations/reconciliation/ReconciliationClient';
import SystemHealthDashboard from '@/pages/admin/client/health/SystemHealthDashboard';
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

export function AdminGenerationsPage() {
  useDocumentTitle('生成任务 | SupDance 管理后台');
  const { redirectEl } = useAdminPermissionGuard(PERMISSIONS.generationsRead);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const view = params.get('view') || 'users';
  const userId = params.get('user_id') || '';

  const backParams = new URLSearchParams(params);
  backParams.delete('user_id');
  backParams.delete('cursor');
  const backHref = `?${backParams.toString()}`;

  const viewHref = (key: string) => {
    const next = new URLSearchParams(params);
    next.set('view', key);
    next.delete('cursor');
    return `?${next.toString()}`;
  };

  const apiParams = new URLSearchParams(params);
  apiParams.set('view', view);
  const { data: raw } = useAdminRawData(`/api/admin/generations?${apiParams.toString()}`, [
    location.search,
  ]);

  if (redirectEl) return redirectEl;

  const result = normalizeAdminListResponse(raw);

  const columns = [
    {
      key: 'id',
      label: '任务 ID / 用户',
      render: (row: any) => (
        <div>
          <CopyableId id={row.id} />
          <div className="mt-1">
            <Link href={`/admin/users/${row.user_id}`} className="text-xs text-white/50 hover:text-brand">
              {row.email}
            </Link>
          </div>
        </div>
      ),
    },
    { key: 'studio_id', label: 'Studio 模块' },
    {
      key: 'label',
      label: '提示词 / 模型',
      render: (row: any) => (
        <div className="max-w-[280px]">
          <p className="truncate text-xs font-semibold text-white/90">{row.label || '无描述'}</p>
          <p className="mt-0.5 text-[11px] text-ink-muted font-mono">
            {row.model || row.provider || '默认引擎'}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      label: '状态 / 诊断',
      render: (row: any) => {
        const isSuccess =
          row.status === 'succeeded' || row.status === 'completed' || row.status === 'success';
        return (
          <div>
            <StatusBadge tone={isSuccess ? 'good' : 'danger'}>{row.status}</StatusBadge>
            {!isSuccess && (row.error_reason || row.error_code) && (
              <p
                className="mt-1 max-w-[200px] truncate text-[11px] text-red-300 font-mono"
                title={row.error_reason || row.error_code}
              >
                {row.error_reason || row.error_code}
              </p>
            )}
            {row.duration_ms ? (
              <p className="mt-0.5 text-[10px] text-white/30 font-mono">
                耗时: {(row.duration_ms / 1000).toFixed(1)}s
              </p>
            ) : null}
          </div>
        );
      },
    },
    {
      key: 'costs',
      label: '额度 / 成本(USD)',
      render: (row: any) => (
        <div>
          <span className="font-mono font-bold text-brand">{row.credit_cost} Credits</span>
          <p className="text-[11px] font-mono text-amber-300/80">
            ${Number(row.actual_cost_usd || 0).toFixed(3)}
          </p>
        </div>
      ),
    },
    {
      key: 'result_url',
      label: '生成产物',
      render: (row: any) =>
        row.result_url ? (
          <a
            href={row.result_url}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-brand hover:bg-brand/10"
          >
            打开查看 ↗
          </a>
        ) : (
          <span className="text-xs text-white/30">—</span>
        ),
    },
    {
      key: 'created_at',
      label: '提交时间',
      render: (row: any) => formatDate(row.created_at),
    },
  ];

  const filterForm = (
    <Card className="mb-6">
      <AdminFilterForm>
        {view === 'tasks' && <input type="hidden" name="view" value="tasks" />}
        {userId && <input type="hidden" name="user_id" value={userId} />}
        <input
          name="q"
          defaultValue={params.get('q') || ''}
          placeholder={
            userId
              ? '在该用户的任务中搜索 ID、提示词或模型…'
              : '搜索任务 ID、用户邮箱、提示词或模型…'
          }
          className="min-w-[240px] flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-brand"
        />

        <select
          name="status"
          defaultValue={params.get('status') || ''}
          className="rounded-xl border border-white/10 bg-[#0a0a0a] px-3 py-2.5 text-xs text-white/70 outline-none focus:border-brand"
        >
          <option value="">全部状态</option>
          <option value="succeeded">Succeeded (成功)</option>
          <option value="processing">Processing (生成中)</option>
          <option value="queued">Queued (排队中)</option>
          <option value="failed">Failed (失败)</option>
        </select>

        <button
          type="submit"
          className="rounded-xl bg-brand hover:bg-brand-hover px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-all"
        >
          筛选任务
        </button>
      </AdminFilterForm>
    </Card>
  );

  return (
    <>
      <PageHeader
        eyebrow="内容与任务"
        title="生成任务"
        description="以用户为单位查看平台通过 AI Studio 提交的图像、视频和语音生成任务：默认展示每位用户最新的一条任务，展开可查看更早的记录。"
      >
        <Link
          href="/admin/generations/reconciliation"
          className="rounded-lg border border-line px-4 py-2 text-xs font-semibold text-ink hover:bg-wash"
        >
          待核对任务与冻结款
        </Link>
        <Link
          href="/admin/generations/failures"
          className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs font-bold text-amber-200 hover:bg-amber-400/20"
        >
          查看失败任务聚类排查 →
        </Link>
      </PageHeader>

      {userId ? (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Link
            href={backHref}
            className="inline-flex h-control-sm items-center gap-1.5 rounded-lg border border-line-subtle bg-wash px-3 text-label text-ink-muted transition-[background-color,border-color,color] duration-fast hover:border-line-strong hover:bg-wash-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" /> 返回用户列表
          </Link>
          <p className="text-body-sm text-ink-muted">
            正在查看 <span className="font-medium text-ink">{result.rows[0]?.email || userId}</span>{' '}
            的全部任务
          </p>
          <Link href={`/admin/users/${userId}`} className="text-label text-ink-subtle hover:text-ink">
            用户详情 →
          </Link>
        </div>
      ) : (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <nav
            aria-label="视图切换"
            data-pill-segmented
            className="inline-flex items-center gap-1 rounded-full border border-line-subtle bg-well p-1"
          >
            {[
              { key: 'users', label: '按用户' },
              { key: 'tasks', label: '按任务' },
            ].map((item) => {
              const active = view === item.key;
              return (
                <Link
                  key={item.key}
                  href={viewHref(item.key)}
                  data-pill-segment-item
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex h-control-xs items-center justify-center rounded-full px-4 text-body-sm font-semibold transition-[background-color,color] duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring ${
                    active
                      ? 'bg-surface-inverse text-ink-inverse shadow-elevation-1'
                      : 'text-ink-muted hover:bg-wash hover:text-ink'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <p className="text-caption text-ink-subtle">
            {view === 'users'
              ? '每位用户仅显示最新一条任务，点击行展开历史'
              : '按提交时间平铺全部任务'}
          </p>
        </div>
      )}

      {filterForm}

      {view === 'users' ? (
        result.rows.length ? (
          <UserGroupList groups={result.rows} baseParams={params.toString()} />
        ) : (
          <EmptyState title="未找到匹配的生成任务记录" />
        )
      ) : (
        <DataTable columns={columns} rows={result.rows} empty="未找到匹配的生成任务记录" />
      )}
      <Pagination meta={result.meta} searchParams={params} />
    </>
  );
}

export function AdminFailedGenerationsPage() {
  useDocumentTitle('失败任务分析 | SupDance 管理后台');
  const { redirectEl } = useAdminPermissionGuard(PERMISSIONS.generationsRead);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const apiParams = new URLSearchParams(params);
  apiParams.set('status', 'failed');
  apiParams.set('view', 'tasks');
  const { data: raw } = useAdminRawData(`/api/admin/generations?${apiParams.toString()}`, [
    location.search,
  ]);

  if (redirectEl) return redirectEl;

  const result = normalizeAdminListResponse(raw);
  const clusters: any[] = Array.isArray(raw?.data?.clusters)
    ? raw.data.clusters
    : Array.isArray(raw?.meta?.clusters)
      ? raw.meta.clusters
      : [];

  const columns = [
    {
      key: 'id',
      label: '失败任务 ID / 用户',
      render: (row: any) => (
        <div>
          <CopyableId id={row.id} />
          <div className="mt-1">
            <Link href={`/admin/users/${row.user_id}`} className="text-xs text-white/50 hover:text-brand">
              {row.email || row.user_id}
            </Link>
          </div>
        </div>
      ),
    },
    { key: 'studio_id', label: 'Studio' },
    {
      key: 'error_code',
      label: '错误代码 / 聚类',
      render: (row: any) => (
        <span className="rounded-md border border-red-400/30 bg-red-400/10 px-2 py-0.5 font-mono text-xs text-red-200">
          {row.error_code || 'UNKNOWN_ERROR'}
        </span>
      ),
    },
    { key: 'model', label: '请求模型', render: (row: any) => row.model || '—' },
    {
      key: 'created_at',
      label: '失败时间',
      render: (row: any) => formatDate(row.created_at),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="生成运营"
        title="失败任务分析"
        description="聚合各工作室 AI 生成任务的异常与中断日志，聚类错误代码并快速定位模型供应商或网络故障。"
      />

      {Array.isArray(clusters) && clusters.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {clusters.map((cluster: any) => (
            <Card key={cluster.error_code || 'unknown'} className="p-4">
              <div className="text-xs text-white/50">错误类型</div>
              <div className="mt-1 font-mono text-sm font-bold text-red-300">
                {cluster.error_code || 'UNKNOWN'}
              </div>
              <div className="mt-2 text-xl font-extrabold text-white">
                {cluster.count ?? cluster.total ?? 0}{' '}
                <span className="text-xs font-normal text-white/40">次</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="mb-6">
        <AdminFilterForm>
          <input
            name="q"
            defaultValue={params.get('q') || ''}
            placeholder="搜索任务 ID、模型名或用户…"
            className="min-w-[260px] flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-brand"
          />

          <button
            type="submit"
            className="rounded-xl bg-brand hover:bg-brand-hover px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-all"
          >
            筛选
          </button>
        </AdminFilterForm>
      </Card>

      <DataTable columns={columns} rows={result.rows} empty="暂无失败任务记录" />
      <Pagination meta={result.meta} searchParams={params} />
    </>
  );
}

export function AdminReconciliationPage() {
  useDocumentTitle('待核对任务 | SupDance 管理后台');
  const { user, redirectEl } = useAdminPermissionGuard(PERMISSIONS.generationsRead);
  const location = useLocation();
  const { data: raw } = useAdminRawData(
    `/api/admin/generations/reconciliation${location.search}`,
    [location.search]
  );

  if (redirectEl) return redirectEl;

  const result = normalizeAdminListResponse(raw);
  const canPoll = hasPermission(user?.role, PERMISSIONS.generationsWrite);
  const canRelease =
    hasPermission(user?.role, PERMISSIONS.generationsWrite) &&
    hasPermission(user?.role, PERMISSIONS.creditsAdjust);

  return (
    <>
      <PageHeader
        eyebrow="任务与资金核对"
        title="待核对任务"
        description="缺少上游终态时保留冻结额度。可以重新读取已有回执，或根据已核实的失败凭据处理资金；释放继续保留原有效期。"
      />
      <ReconciliationClient rows={result.rows} canPoll={canPoll} canRelease={canRelease} />
      <Pagination meta={result.meta} searchParams={new URLSearchParams(location.search)} />
    </>
  );
}

export function AdminModerationPage() {
  useDocumentTitle('内容安全与违规审核 | SupDance 管理后台');
  const { redirectEl } = useAdminPermissionGuard(PERMISSIONS.moderationRead);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const { data: raw } = useAdminRawData(`/api/admin/moderation${location.search}`, [
    location.search,
  ]);

  if (redirectEl) return redirectEl;

  const result = normalizeAdminListResponse(raw);

  const columns = [
    {
      key: 'id',
      label: '审核案件 / 生成 ID',
      render: (row: any) => (
        <div>
          <CopyableId id={row.id} label="案件" />
          <div className="mt-1">
            <CopyableId id={row.creation_id} label="产物" />
          </div>
        </div>
      ),
    },
    {
      key: 'user',
      label: '作者账号',
      render: (row: any) => (
        <Link href={`/admin/users/${row.user_id}`} className="font-semibold text-white hover:text-brand">
          {row.email || row.user_id}
        </Link>
      ),
    },
    {
      key: 'reason',
      label: '审核原因 / 命中敏感词',
      render: (row: any) => (
        <span className="text-xs text-white/70">
          {row.reason || row.category || '敏感词拦截'}
        </span>
      ),
    },
    {
      key: 'status',
      label: '状态',
      render: (row: any) => (
        <StatusBadge
          tone={
            row.status === 'approved'
              ? 'good'
              : row.status === 'rejected'
                ? 'danger'
                : 'warn'
          }
        >
          {row.status === 'approved' ? '已通过' : row.status === 'rejected' ? '已违规下架' : '待处理'}
        </StatusBadge>
      ),
    },
    {
      key: 'created_at',
      label: '触发时间',
      render: (row: any) => formatDate(row.created_at),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="生成运营"
        title="内容安全与违规审核"
        description="审核命中敏感词过滤、社区不良内容举报或大模型安全警报的 AI 生成图片与视频作品。"
      />

      <Card className="mb-6">
        <AdminFilterForm>
          <input
            name="q"
            defaultValue={params.get('q') || ''}
            placeholder="搜索案件 ID、产物 ID 或用户…"
            className="min-w-[260px] flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-brand/50"
          />

          <select
            name="status"
            defaultValue={params.get('status') || ''}
            className="rounded-xl border border-white/10 bg-[#0a0a0a] px-3.5 py-2.5 text-xs text-white/70 outline-none focus:border-brand/50"
          >
            <option value="">全部状态</option>
            <option value="pending">待处理</option>
            <option value="approved">已放行</option>
            <option value="rejected">已违规封禁</option>
          </select>

          <button
            type="submit"
            className="rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-white hover:bg-brand-hover transition-colors"
          >
            筛选
          </button>
        </AdminFilterForm>
      </Card>

      <DataTable columns={columns} rows={result.rows} empty="暂无待审核内容" />
      <Pagination meta={result.meta} searchParams={params} />
    </>
  );
}

export function AdminAuditPage() {
  useDocumentTitle('审计日志 | SupDance 管理后台');
  const { redirectEl } = useAdminPermissionGuard(PERMISSIONS.auditRead);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const { data: raw } = useAdminRawData(`/api/admin/audit${location.search}`, [location.search]);

  if (redirectEl) return redirectEl;

  const result = normalizeAdminListResponse(raw);

  const columns = [
    {
      key: 'action',
      label: '管理动作',
      render: (row: any) => (
        <div>
          <span className="font-semibold text-white font-mono text-xs">{row.action}</span>
          {row.request_id && (
            <div className="mt-0.5">
              <CopyableId id={row.request_id} label="ReqId" />
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'actor',
      label: '操作管理员',
      render: (row: any) => (
        <div>
          {row.actor_id && row.actor_id !== 'system' ? (
            <Link
              href={`/admin/users/${row.actor_id}`}
              className="text-caption text-ink transition-colors hover:text-brand"
            >
              {row.actor_email}
            </Link>
          ) : (
            <p className="text-white/90 text-xs">{row.actor_email}</p>
          )}
          <div className="mt-0.5">
            <CopyableId id={row.actor_id} />
          </div>
        </div>
      ),
    },
    {
      key: 'target',
      label: '变更目标',
      render: (row: any) => (
        <div>
          <span className="text-white/40 text-[11px] uppercase tracking-wider">
            {row.target_type || '系统'}
          </span>
          {row.target_id && (
            <div className="mt-0.5 flex items-center gap-2 font-mono text-xs text-white/70">
              <CopyableId id={row.target_id} />
              {row.target_type === 'user' && (
                <Link
                  href={`/admin/users/${row.target_id}`}
                  className="text-micro font-medium text-brand transition-colors hover:text-brand-hover"
                >
                  查看用户 →
                </Link>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'risk_level',
      label: '风险等级',
      render: (row: any) => (
        <StatusBadge
          tone={
            row.risk_level === 'high' ? 'danger' : row.risk_level === 'medium' ? 'warn' : 'neutral'
          }
        >
          {row.risk_level}
        </StatusBadge>
      ),
    },
    {
      key: 'details',
      label: '变更快照 (已自动脱敏)',
      render: (row: any) => (
        <div className="max-w-[280px] font-mono text-[11px]">
          {row.after ? (
            <pre
              className="truncate rounded-md bg-black/40 p-1.5 text-white/60"
              title={JSON.stringify(row.after, null, 2)}
            >
              {JSON.stringify(row.after)}
            </pre>
          ) : (
            <span className="text-white/30">—</span>
          )}
        </div>
      ),
    },
    {
      key: 'created_at',
      label: '记录时间',
      render: (row: any) => formatDate(row.created_at),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="系统审计"
        title="审计日志"
        description="追溯所有管理员在后台执行的额度调整、角色变更、订单退款、密钥轮换等敏感动作。敏感字段自动过滤脱敏。"
      />

      <Card className="mb-6">
        <AdminFilterForm>
          <input
            name="q"
            defaultValue={params.get('q') || ''}
            placeholder="搜索管理员邮箱、动作名称或目标 ID…"
            className="min-w-[260px] flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-brand/50"
          />

          <select
            name="risk"
            defaultValue={params.get('risk') || ''}
            className="rounded-xl border border-white/10 bg-[#0a0a0a] px-3.5 py-2.5 text-xs text-white/70 outline-none focus:border-brand/50"
          >
            <option value="">全部风险级别</option>
            <option value="high">High (高危操作)</option>
            <option value="medium">Medium (中等变动)</option>
            <option value="low">Low (日常动作)</option>
          </select>

          <button
            type="submit"
            className="rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-white hover:bg-brand-hover transition-colors"
          >
            筛选日志
          </button>
        </AdminFilterForm>
      </Card>

      <DataTable columns={columns} rows={result.rows} empty="未找到匹配的审计日志记录" />
      <Pagination meta={result.meta} searchParams={params} />
    </>
  );
}

export function AdminWebhooksPage() {
  useDocumentTitle('Webhook 事件记录 | SupDance 管理后台');
  const { redirectEl } = useAdminPermissionGuard(PERMISSIONS.webhooksRead);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const { data: raw } = useAdminRawData(`/api/admin/webhooks${location.search}`, [location.search]);

  if (redirectEl) return redirectEl;

  const result = normalizeAdminListResponse(raw);

  const columns = [
    {
      key: 'event_id',
      label: '外部事件 ID',
      render: (row: any) => <CopyableId id={row.event_id || row.id} />,
    },
    { key: 'provider', label: '供应商渠道', render: (row: any) => row.provider || '—' },
    {
      key: 'status',
      label: '处理状态',
      render: (row: any) => (
        <StatusBadge
          tone={
            row.status === 'processed' || row.status === 'received'
              ? 'good'
              : row.status === 'replayed'
                ? 'info'
                : 'danger'
          }
        >
          {row.status || 'unknown'}
        </StatusBadge>
      ),
    },
    {
      key: 'event_type',
      label: '事件类型',
      render: (row: any) => (
        <span className="font-mono text-xs text-white/70">
          {row.event_type || row.type || 'callback'}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: '接收时间',
      render: (row: any) => formatDate(row.created_at),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="系统集成"
        title="Webhook 事件记录"
        description="记录接收到的第三方支付平台、AI 供应商异步回调与通知事件流，支持排查丢单与异步投递重试。"
      />

      <Card className="mb-6">
        <AdminFilterForm>
          <input
            name="q"
            defaultValue={params.get('q') || ''}
            placeholder="搜索事件 ID 或渠道名…"
            className="min-w-[260px] flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-brand/50"
          />

          <select
            name="provider"
            defaultValue={params.get('provider') || ''}
            className="rounded-xl border border-white/10 bg-[#0a0a0a] px-3.5 py-2.5 text-xs text-white/70 outline-none focus:border-brand/50"
          >
            <option value="">全部渠道</option>
            <option value="wechat">微信支付</option>
            <option value="alipay">支付宝</option>
            <option value="stripe">Stripe</option>
            <option value="runninghub">RunningHub</option>
            <option value="volcengine">火山引擎</option>
          </select>

          <button
            type="submit"
            className="rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-white hover:bg-brand-hover transition-colors"
          >
            筛选
          </button>
        </AdminFilterForm>
      </Card>

      <DataTable columns={columns} rows={result.rows} empty="暂无 Webhook 事件记录" />
      <Pagination meta={result.meta} searchParams={params} />
    </>
  );
}

export function AdminHealthPage() {
  useDocumentTitle('系统健康与日志 | SupDance 管理后台');
  const { redirectEl } = useAdminPermissionGuard(PERMISSIONS.healthRead);
  const { data, loading } = useAdminData<any>('/api/admin/health');

  if (redirectEl) return redirectEl;

  if (loading || !data) {
    return <div className="h-64 animate-pulse rounded-2xl bg-white/[0.03]" />;
  }

  return <SystemHealthDashboard initial={data} />;
}

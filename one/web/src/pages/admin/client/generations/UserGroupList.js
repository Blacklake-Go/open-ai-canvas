import Link from 'next/link';
import { ChevronRight, ExternalLink, UserRound } from 'lucide-react';
import { CopyableId } from '@/components/admin/AdminUi';

const STATUS_META = {
  succeeded: { label: '成功', tone: 'success' },
  completed: { label: '成功', tone: 'success' },
  success: { label: '成功', tone: 'success' },
  failed: { label: '失败', tone: 'danger' },
  error: { label: '失败', tone: 'danger' },
  timeout: { label: '超时', tone: 'danger' },
  processing: { label: '生成中', tone: 'warning' },
  running: { label: '生成中', tone: 'warning' },
  queued: { label: '排队中', tone: 'info' },
  pending: { label: '排队中', tone: 'info' },
  cancelled: { label: '已取消', tone: 'neutral' },
  canceled: { label: '已取消', tone: 'neutral' },
};

const TONE_CLASSES = {
  success: 'border-success-line bg-success-soft text-success',
  danger: 'border-danger-line bg-danger-soft text-danger',
  warning: 'border-warning-line bg-warning-soft text-warning',
  info: 'border-info-line bg-info-soft text-info',
  neutral: 'border-line-subtle bg-wash text-ink-muted',
};

const LINK_CLASSES =
  'inline-flex h-control-xs items-center gap-1.5 rounded-lg border border-line-subtle bg-wash px-3 text-label text-ink-muted transition-[background-color,border-color,color] duration-fast hover:border-line-strong hover:bg-wash-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring';

export function isSuccessStatus(status) {
  return STATUS_META[status]?.tone === 'success';
}

export function StatusChip({ status }) {
  const meta = STATUS_META[status] || { label: status || '未知', tone: 'neutral' };
  return (
    <span
      title={status}
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-micro font-medium ${TONE_CLASSES[meta.tone]}`}
    >
      {meta.label}
    </span>
  );
}

function formatShortTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatUsd(value) {
  return `$${Number(value || 0).toFixed(3)}`;
}

function diagnosis(row) {
  if (isSuccessStatus(row.status)) return null;
  return row.error_reason || row.error_code || null;
}

function CountDot({ tone, label, value }) {
  if (!value) return null;
  const dot = { success: 'bg-success', danger: 'bg-danger', warning: 'bg-warning' }[tone];
  return (
    <span className="inline-flex items-center gap-1">
      <span aria-hidden="true" className={`size-1.5 rounded-full ${dot}`} />
      {label} {value}
    </span>
  );
}

function HistoryRow({ row }) {
  const reason = diagnosis(row);
  return (
    <li className="grid grid-cols-1 gap-1 px-3 py-2.5 lg:grid-cols-12 lg:items-center lg:gap-3">
      <div className="lg:col-span-2">
        <CopyableId id={row.id} />
      </div>
      <div className="min-w-0 lg:col-span-4">
        <p className="truncate text-body-sm text-ink">{row.label || '无描述'}</p>
        <p className="truncate text-mono text-ink-subtle">
          {row.model || row.provider || '默认引擎'} · {row.studio_id || '—'}
        </p>
      </div>
      <div className="flex min-w-0 items-center gap-2 lg:col-span-3">
        <StatusChip status={row.status} />
        {reason && (
          <span className="truncate text-caption text-danger" title={reason}>
            {reason}
          </span>
        )}
      </div>
      <div className="text-mono text-ink-muted lg:col-span-1">{row.credit_cost ?? 0} Cr</div>
      <div className="flex items-center gap-2 lg:col-span-2 lg:justify-end">
        {row.result_url && (
          <a href={row.result_url} target="_blank" rel="noreferrer" className={LINK_CLASSES}>
            产物 <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        )}
        <span className="text-caption text-ink-subtle tabular-nums">{formatShortTime(row.created_at)}</span>
      </div>
    </li>
  );
}

function UserGroup({ group, userTasksHref }) {
  const taskCount = Number(group.task_count || 0);
  const succeeded = Number(group.succeeded_count || 0);
  const failed = Number(group.failed_count || 0);
  const active = Number(group.active_count || 0);
  const reason = diagnosis(group);
  const remaining = taskCount - 1 - group.history.length;

  return (
    <details className="group" data-user-group={group.user_id}>
      <summary className="grid cursor-pointer list-none grid-cols-1 gap-2 px-4 py-3.5 transition-[background-color] duration-fast hover:bg-wash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ring lg:grid-cols-12 lg:items-center lg:gap-4 [&::-webkit-details-marker]:hidden">
        {/* 用户 + 汇总 */}
        <div className="flex min-w-0 items-start gap-2.5 lg:col-span-3">
          <ChevronRight
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-ink-subtle transition-transform duration-fast group-open:rotate-90"
          />
          <div className="min-w-0">
            <p className="truncate text-body-sm font-medium text-ink" title={group.email}>
              {group.email || group.user_id}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-caption text-ink-subtle">
              <span>{taskCount} 个任务</span>
              <CountDot tone="success" label="成功" value={succeeded} />
              <CountDot tone="danger" label="失败" value={failed} />
              <CountDot tone="warning" label="进行中" value={active} />
            </p>
          </div>
        </div>

        {/* 最新任务 */}
        <div className="min-w-0 pl-6 lg:col-span-4 lg:pl-0">
          <p className="truncate text-body-sm text-ink" title={group.label || ''}>
            {group.label || '无描述'}
          </p>
          <p className="truncate text-mono text-ink-subtle">
            {group.model || group.provider || '默认引擎'} · {group.studio_id || '—'}
          </p>
        </div>

        {/* 状态 / 诊断 */}
        <div className="flex min-w-0 items-center gap-2 pl-6 lg:col-span-2 lg:pl-0">
          <StatusChip status={group.status} />
          {reason && (
            <span className="truncate text-caption text-danger" title={reason}>
              {reason}
            </span>
          )}
        </div>

        {/* 额度 / 成本 */}
        <div className="pl-6 lg:col-span-2 lg:pl-0">
          <p className="text-mono text-ink">{group.credit_cost ?? 0} Credits</p>
          <p className="text-caption text-ink-subtle">
            累计 {Number(group.total_credits || 0)} Cr · {formatUsd(group.total_cost_usd)}
          </p>
        </div>

        {/* 时间 */}
        <div className="pl-6 text-caption text-ink-muted tabular-nums lg:col-span-1 lg:pl-0 lg:text-right">
          {formatShortTime(group.created_at)}
        </div>
      </summary>

      {/* 抽屉：最新任务操作 + 历史任务 */}
      <div className="px-4 pb-4 lg:pl-10">
        <div className="rounded-lg border border-line-subtle bg-well">
          <div className="flex flex-wrap items-center gap-2 border-b border-line-subtle px-3 py-2.5">
            <span className="text-label text-ink-subtle">最新任务</span>
            <CopyableId id={group.task_id} />
            {group.duration_ms ? (
              <span className="text-caption text-ink-subtle">耗时 {(group.duration_ms / 1000).toFixed(1)}s</span>
            ) : null}
            <span className="text-caption text-ink-subtle">{formatUsd(group.actual_cost_usd)}</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {group.result_url && (
                <a href={group.result_url} target="_blank" rel="noreferrer" className={LINK_CLASSES}>
                  打开产物 <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              )}
              <Link href={`/admin/users/${group.user_id}`} className={LINK_CLASSES}>
                <UserRound className="size-3" aria-hidden="true" /> 用户详情
              </Link>
            </div>
          </div>

          {reason && (
            <p className="border-b border-line-subtle px-3 py-2.5 text-caption text-danger break-all">{reason}</p>
          )}

          {group.history.length > 0 ? (
            <>
              <p className="px-3 pt-2.5 text-label text-ink-subtle">更早的任务（最近 {group.history.length} 条）</p>
              <ul className="divide-y divide-line-subtle">
                {group.history.map((row) => (
                  <HistoryRow key={row.id} row={row} />
                ))}
              </ul>
            </>
          ) : (
            <p className="px-3 py-3 text-caption text-ink-subtle">当前筛选下该用户没有更早的任务。</p>
          )}

          {taskCount > 1 && (
            <div className="flex items-center justify-between gap-2 border-t border-line-subtle px-3 py-2.5">
              <span className="text-caption text-ink-subtle">
                {remaining > 0 ? `还有 ${remaining} 条未显示` : '已显示全部任务'}
              </span>
              <Link href={userTasksHref} className={LINK_CLASSES}>
                查看全部 {taskCount} 个任务 →
              </Link>
            </div>
          )}
        </div>
      </div>
    </details>
  );
}

/**
 * User-first generation list: one collapsible row per user showing the latest task,
 * with older tasks tucked into a native <details> drawer (no overlay, keyboard accessible).
 */
export function UserGroupList({ groups, baseParams }) {
  const hrefFor = (userId) => {
    const params = new URLSearchParams(baseParams);
    params.delete('cursor');
    params.delete('view');
    params.set('user_id', userId);
    return `?${params.toString()}`;
  };

  return (
    <div className="rounded-xl border border-line bg-surface shadow-elevation-2">
      <div className="hidden grid-cols-12 gap-4 border-b border-line-subtle px-4 py-3 text-label text-ink-subtle lg:grid">
        <span className="col-span-3 pl-6">用户</span>
        <span className="col-span-4">最新任务 / 模型</span>
        <span className="col-span-2">状态 / 诊断</span>
        <span className="col-span-2">额度 / 成本</span>
        <span className="col-span-1 text-right">最近提交</span>
      </div>
      <div className="divide-y divide-line-subtle">
        {groups.map((group) => (
          <UserGroup key={group.user_id} group={group} userTasksHref={hrefFor(group.user_id)} />
        ))}
      </div>
    </div>
  );
}

export default UserGroupList;

import { Suspense } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Coins,
  ExternalLink,
  FileText,
  Film,
  GitPullRequest,
  ImageIcon,
  Music,
  Paperclip,
  UserRound,
} from 'lucide-react';
import { useLocation, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  CopyableId,
  DataTable,
  MetricCard,
  PageHeader,
  Pagination,
  StatusBadge,
} from '@/components/admin/AdminUi';
import AdminBreadcrumbs from '@/components/admin/AdminBreadcrumbs';
import FeedbackReviewForm from '@/components/admin/FeedbackReviewForm';
import StorageSettingsClient from '@/components/admin/settings/StorageSettingsClient';
import { UserSubject } from '@/components/admin/UserSubject';
import { hasPermission, PERMISSIONS } from '@/lib/admin/permissions';
import {
  SOCIAL_LOGIN_CATALOG,
  SOCIAL_LOGIN_REGIONS,
} from '@/lib/auth/socialProviders';
import {
  FEEDBACK_ATTACHMENT_KIND_LABELS,
  formatFeedbackBytes,
} from '@/lib/feedback/attachments';
import {
  FEEDBACK_KINDS,
  FEEDBACK_STATUS_LABELS,
  findFeedbackKind,
} from '@/lib/feedback/catalog';
import { PROVIDER_CATALOG, S3_PRESETS } from '@/lib/storage/providers';
import CommunityCasesManager from '@/pages/admin/client/community/CommunityCasesManager';
import BannerAnalyticsClient from '@/pages/admin/client/content/analytics/BannerAnalyticsClient';
import VisitorsWorkbenchClient from '@/pages/admin/client/content/visitors/VisitorsWorkbenchClient';
import XPromptsConsoleClient from '@/pages/admin/client/content/x-prompts/XPromptsConsoleClient';
import LanguageManagementClient from '@/pages/admin/client/i18n/LanguageManagementClient';
import SettingsEditorClient from '@/pages/admin/client/settings/SettingsEditorClient';
import EmailLogDetailButton from '@/pages/admin/client/system/email/EmailLogDetailButton';
import EmailSettingsClient from '@/pages/admin/client/system/email/EmailSettingsClient';
import MarketingEmailSection from '@/pages/admin/client/system/email/MarketingEmailSection';
import LoginMethodsClient from '@/pages/admin/client/system/login/LoginMethodsClient';
import AdminNotFound from '@/pages/boundaries/AdminNotFound';
import {
  AdminFilterForm,
  normalizeAdminListResponse,
  useAdminData,
  useAdminRawData,
  useAdminPermissionGuard,
  useDocumentTitle,
} from '@/pages/helpers/pageHelpers';
import { ApiClientError, apiRequest } from '@/services/api/http';

function formatDate(value?: string | null) {
  return value
    ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
    : '—';
}

export function AdminCommunityPage() {
  useDocumentTitle('案例作品管理 | SupDance 管理后台');
  const { user, redirectEl } = useAdminPermissionGuard(PERMISSIONS.contentRead);

  if (redirectEl) return redirectEl;

  const canWrite = hasPermission(user?.role, PERMISSIONS.contentWrite);

  return (
    <>
      <PageHeader
        eyebrow="内容管理 / 社区"
        title="案例作品管理"
        description="从真实社区作品中筛选精选案例，维护前台案例展示位、作品文案、标签与发布状态。前台只展示已发布并标记为精选的作品。"
      />
      <CommunityCasesManager canWrite={canWrite} />
    </>
  );
}

export function AdminBannerAnalyticsPage() {
  useDocumentTitle('横幅用户点击与转化记录 | SupDance 管理后台');
  const { redirectEl } = useAdminPermissionGuard(PERMISSIONS.contentRead);
  const { data, loading } = useAdminData<any>('/api/admin/content/analytics?limit=50&offset=0');

  if (redirectEl) return redirectEl;

  return (
    <>
      <PageHeader
        eyebrow="内容管理"
        title="横幅用户点击与转化记录"
        description="实时监控 Studio 顶部横幅的真实用户展示（Impression）、点击（Click）与主动关闭（Dismiss）全链路埋点数据，核算真实商业转化率 (CTR)，并提供点击流水日志审计。"
      />
      {loading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-white/[0.03]" />
      ) : (
        <BannerAnalyticsClient initialData={data || { summary: {}, rows: [] }} />
      )}
    </>
  );
}

export function AdminVisitorsPage() {
  useDocumentTitle('访客与 SEO | 管理后台');
  const { redirectEl } = useAdminPermissionGuard(PERMISSIONS.usersRead);

  if (redirectEl) return redirectEl;

  return (
    <div className="space-y-6">
      <AdminBreadcrumbs pathname="/admin/content/visitors" />
      <PageHeader
        eyebrow="内容与前台"
        title="访客与 SEO"
        description="管理第三方访客统计分析代码配置，以及网站全局 SEO 规则、搜索引擎主动推送与收录连通性。"
      />
      <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-white/[0.03]" />}>
        <VisitorsWorkbenchClient />
      </Suspense>
    </div>
  );
}

export function AdminXPromptsPage() {
  useDocumentTitle('X 提示词灵感与控制台 | SupDance 运营后台');
  const { redirectEl } = useAdminPermissionGuard(PERMISSIONS.contentRead);
  const { data: listData, loading: loadingList } = useAdminData<any>(
    '/api/admin/content/x-prompts?category=all&page=1&pageSize=24'
  );
  const { data: configData, loading: loadingCfg } = useAdminData<any>(
    '/api/admin/content/x-prompts/config'
  );

  if (redirectEl) return redirectEl;

  if (loadingList || loadingCfg) {
    return <div className="h-48 animate-pulse rounded-2xl bg-white/[0.03]" />;
  }

  const rawCfg = configData || {};
  const safeConfig = {
    ...rawCfg,
    cookies: {
      hasAuthToken: Boolean(rawCfg.cookies?.hasAuthToken ?? rawCfg.cookies?.authToken),
      authTokenPreview: rawCfg.cookies?.authTokenPreview || '',
      hasCt0: Boolean(rawCfg.cookies?.hasCt0 ?? rawCfg.cookies?.ct0),
      ct0Preview: rawCfg.cookies?.ct0Preview || '',
    },
  };

  return (
    <XPromptsConsoleClient
      initialData={listData || { items: [], total: 0, page: 1, pageSize: 24 }}
      initialConfig={safeConfig}
    />
  );
}

const KIND_LABELS = Object.fromEntries(FEEDBACK_KINDS.map((kind: any) => [kind.id, kind.label]));

export function AdminFeedbackPage() {
  useDocumentTitle('建议与漏洞提交 | SupDance 管理后台');
  const { user, allowed, redirectEl } = useAdminPermissionGuard(PERMISSIONS.contentRead);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const { data, loading, error, reload } = useAdminRawData(user && allowed ? `/api/admin/feedback${location.search}` : null, [user?.id]);
  const result = normalizeAdminListResponse(data);

  if (redirectEl) return redirectEl;

  const columns = [
    {
      key: 'id',
      label: '提交编号',
      render: (row: any) => <CopyableId id={row.id} label="提交" />,
    },
    {
      key: 'user',
      label: '提交人',
      render: (row: any) => <UserSubject row={row} href={`/admin/users/${row.user_id}`} />,
    },
    {
      key: 'kind',
      label: '类型',
      render: (row: any) => (
        <StatusBadge
          tone={
            row.kind === 'security' ? 'danger' : row.kind === 'improvement' ? 'good' : 'warn'
          }
        >
          {KIND_LABELS[row.kind] || row.kind}
        </StatusBadge>
      ),
    },
    {
      key: 'title',
      label: '反馈标题与描述',
      render: (row: any) => (
        <div className="max-w-xs">
          <Link
            href={`/admin/feedback/${row.id}`}
            className="focus-ring rounded-sm font-semibold text-ink transition-colors hover:text-brand"
          >
            {row.title}
          </Link>
          <p className="mt-1 line-clamp-2 text-caption text-ink-muted">{row.detail}</p>
        </div>
      ),
    },
    {
      key: 'assets',
      label: '附件 / GitHub',
      render: (row: any) => (
        <div className="flex items-center gap-2 text-ink-muted">
          <span className="inline-flex items-center gap-1" title="附件数量">
            <Paperclip className="size-3.5" />
            {Number(row.attachment_count || 0)}
          </span>
          {row.github_url ? (
            <a
              href={row.github_url}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring inline-flex items-center gap-1 rounded-sm text-brand hover:underline"
              title="打开关联的 GitHub 链接"
            >
              <GitPullRequest className="size-3.5" />
              GitHub
            </a>
          ) : (
            <span className="text-ink-subtle">—</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: '处理状态',
      render: (row: any) => (
        <StatusBadge
          tone={
            row.status === 'accepted' ? 'good' : row.status === 'rejected' ? 'danger' : 'warn'
          }
        >
          {(FEEDBACK_STATUS_LABELS as Record<string, string>)[row.status] || row.status}
        </StatusBadge>
      ),
    },
    {
      key: 'reward_coins',
      label: '奖励硬币',
      render: (row: any) => (row.reward_coins ? `${row.reward_coins} 币` : '—'),
    },
    {
      key: 'created_at',
      label: '提交时间',
      render: (row: any) => formatDate(row.created_at),
    },
    {
      key: 'actions',
      label: '操作',
      render: (row: any) => (
        <Link
          href={`/admin/feedback/${row.id}`}
          className="focus-ring inline-flex items-center rounded-lg border border-line bg-well px-3 py-1.5 text-label font-semibold text-ink-muted transition-colors hover:border-brand-line hover:text-brand"
        >
          {row.status === 'pending' ? '审核' : '查看'}
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="运营管理"
        title="建议与漏洞提交"
        description="管理用户反馈的功能体验建议、体验缺陷与安全漏洞报告，支持查看附件、关联 GitHub 并在线裁决与核发硬币奖励。"
      />

      <Card className="mb-6">
        <AdminFilterForm>
          <input
            name="q"
            defaultValue={params.get('q') || ''}
            placeholder="搜索标题、内容、页面、GitHub、用户邮箱…"
            className="focus-ring min-w-0 flex-1 rounded-xl border border-line bg-well px-4 py-2.5 text-label text-ink placeholder:text-ink-subtle sm:min-w-64"
          />

          <select
            name="kind"
            defaultValue={params.get('kind') || ''}
            className="focus-ring rounded-xl border border-line bg-well px-3.5 py-2.5 text-label text-ink-muted"
          >
            <option value="">全部类型</option>
            {FEEDBACK_KINDS.map((kind: any) => (
              <option key={kind.id} value={kind.id}>
                {kind.label}
              </option>
            ))}
          </select>

          <select
            name="status"
            defaultValue={params.get('status') || ''}
            className="focus-ring rounded-xl border border-line bg-well px-3.5 py-2.5 text-label text-ink-muted"
          >
            <option value="">全部状态</option>
            <option value="pending">待处理</option>
            <option value="accepted">已采纳</option>
            <option value="rejected">已驳回</option>
          </select>

          <Button type="submit" variant="primary" size="md">
            筛选
          </Button>
        </AdminFilterForm>
      </Card>

      {loading ? <p role="status" className="p-4 text-body-sm text-ink-muted">正在读取反馈列表…</p> : error ? (
        <Card className="flex flex-wrap items-center gap-3">
          <p role="alert" className="text-body-sm text-danger">{error}</p>
          <Button onClick={reload}>重试</Button>
        </Card>
      ) : (
        <>
          <DataTable columns={columns} rows={result.rows} empty="未找到匹配的反馈记录" />
          <Pagination meta={result.meta} searchParams={params} />
        </>
      )}
    </>
  );
}

const FEEDBACK_STATUS_TONES: Record<string, 'warn' | 'good' | 'danger'> = {
  pending: 'warn',
  accepted: 'good',
  rejected: 'danger',
};

function AttachmentIcon({ kind }: { kind: string }) {
  if (kind === 'image') return <ImageIcon className="size-4" />;
  if (kind === 'video') return <Film className="size-4" />;
  if (kind === 'audio') return <Music className="size-4" />;
  return <FileText className="size-4" />;
}

export function AdminFeedbackDetailPage() {
  useDocumentTitle('建议与漏洞详情 | SupDance 管理后台');
  const { id } = useParams<{ id?: string }>();
  const { user, allowed, redirectEl } = useAdminPermissionGuard(PERMISSIONS.contentRead);
  const client = useQueryClient();
  const queryKey = ['admin-feedback-detail', user?.id, id];
  const query = useQuery({
    queryKey,
    enabled: Boolean(user && allowed && id),
    queryFn: ({ signal }) => apiRequest<{ feedback: any }>(`/api/admin/feedback/${encodeURIComponent(id!)}`, { contract: 'admin', cache: 'no-store', signal }),
    retry: false,
  });
  const feedback = query.data?.feedback;

  if (redirectEl) return redirectEl;
  if (!id) return <AdminNotFound />;
  if (query.isPending) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/20 border-t-brand" />
      </div>
    );
  }
  if (query.isError) {
    if (query.error instanceof ApiClientError && query.error.status === 404) return <AdminNotFound />;
    return (
      <Card className="flex flex-wrap items-center gap-3">
        <p role="alert" className="text-body-sm text-danger">{query.error.message}</p>
        <Button disabled={query.isFetching} onClick={() => void query.refetch()}>重试</Button>
      </Card>
    );
  }
  if (!feedback) return <AdminNotFound />;

  const kind = findFeedbackKind(feedback.kind);
  const pending = feedback.status === 'pending';
  const statusLabel =
    (FEEDBACK_STATUS_LABELS as Record<string, string>)[feedback.status] || feedback.status;
  const attachments: any[] = Array.isArray(feedback.attachments) ? feedback.attachments : [];

  return (
    <>
      <PageHeader
        eyebrow="建议与漏洞提交"
        title={feedback.title}
        description={`${kind?.label || feedback.kind} · 提交于 ${formatDate(feedback.createdAt || feedback.created_at)}`}
      >
        <Link
          href="/admin/feedback"
          className="focus-ring inline-flex items-center gap-2 rounded-xl border border-line bg-well px-4 py-2 text-label font-semibold text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          返回列表
        </Link>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-caption text-ink-muted">提交编号</p>
          <div className="mt-2">
            <CopyableId id={feedback.id} label="提交" />
          </div>
        </Card>
        <Card>
          <p className="text-caption text-ink-muted">处理状态</p>
          <div className="mt-2">
            <StatusBadge tone={FEEDBACK_STATUS_TONES[feedback.status] || 'neutral'}>
              {statusLabel}
            </StatusBadge>
          </div>
        </Card>
        <Card>
          <p className="text-caption text-ink-muted">已发硬币</p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-section-title font-bold text-brand tabular-nums">
            <Coins className="size-4" />
            {feedback.rewardCoins ?? feedback.reward_coins ?? 0}
          </p>
        </Card>
        <Card>
          <p className="text-caption text-ink-muted">附件数量</p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-section-title font-bold text-ink tabular-nums">
            <Paperclip className="size-4 text-ink-muted" />
            {attachments.length}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="space-y-5">
            <div>
              <h2 className="text-section-title font-semibold text-ink">问题描述</h2>
              <p className="mt-3 whitespace-pre-wrap break-words text-body leading-relaxed text-ink">
                {feedback.detail}
              </p>
            </div>

            <dl className="grid gap-4 border-t border-line-subtle pt-4 sm:grid-cols-2">
              <div>
                <dt className="text-caption text-ink-muted">涉及页面</dt>
                <dd className="mt-1 break-all font-mono text-body-sm text-ink">
                  {feedback.pageUrl || feedback.page_url || (
                    <span className="text-ink-subtle">未填写</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-ink-muted">GitHub 链接</dt>
                <dd className="mt-1 break-all text-body-sm">
                  {feedback.githubUrl || feedback.github_url ? (
                    <a
                      href={feedback.githubUrl || feedback.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="focus-ring inline-flex items-center gap-1 rounded-sm text-brand hover:underline"
                    >
                      {feedback.githubUrl || feedback.github_url}
                      <ExternalLink className="size-3.5 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-ink-subtle">未填写</span>
                  )}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-section-title font-semibold text-ink">附件</h2>
              <span className="text-caption text-ink-muted">{attachments.length} 个文件</span>
            </div>

            {attachments.length === 0 ? (
              <p className="mt-3 text-body-sm text-ink-muted">本次提交没有上传附件。</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {attachments.map((attachment: any, index: number) => {
                  const preview = attachment.previewUrl || attachment.url;
                  return (
                    <li
                      key={`${attachment.objectKey || attachment.url}-${index}`}
                      className="rounded-xl border border-line bg-well p-3"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        {attachment.kind === 'image' && preview ? (
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="focus-ring shrink-0 overflow-hidden rounded-lg border border-line"
                          >
                            <img src={preview} alt={attachment.name} className="size-16 object-cover" />
                          </a>
                        ) : (
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-line bg-scrim text-ink-muted">
                            <AttachmentIcon kind={attachment.kind} />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body-sm font-medium text-ink">
                            {attachment.name}
                          </p>
                          <p className="text-caption text-ink-muted">
                            {(FEEDBACK_ATTACHMENT_KIND_LABELS as Record<string, string>)[
                              attachment.kind
                            ] || '文件'}{' '}
                            · {formatFeedbackBytes(attachment.sizeBytes)}
                          </p>
                        </div>
                        {attachment.url && <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="focus-ring inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-label font-semibold text-ink-muted transition-colors hover:border-brand-line hover:text-brand"
                        >
                          下载
                          <ExternalLink className="size-3.5" />
                        </a>}
                      </div>

                      {attachment.kind === 'video' && preview && (
                        <video
                          src={preview}
                          controls
                          preload="metadata"
                          className="mt-3 w-full rounded-lg border border-line"
                        />
                      )}
                      {attachment.kind === 'audio' && preview && (
                        <audio src={preview} controls preload="metadata" className="mt-3 w-full" />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="text-card-title font-semibold text-ink">提交人</h2>
            <div className="mt-3 space-y-2 text-body-sm">
              <p className="flex items-start gap-2 break-all text-ink">
                <UserRound className="mt-0.5 size-4 shrink-0 text-ink-muted" />
                {feedback.userEmail || feedback.email || '—'}
              </p>
              {(feedback.userNumber || feedback.user_number) && (
                <p className="text-ink-muted">
                  用户编号 {feedback.userNumber || feedback.user_number}
                </p>
              )}
              <p className="text-ink-muted">
                提交于 {formatDate(feedback.createdAt || feedback.created_at)}
              </p>
              <Link
                href={`/admin/users/${feedback.userId || feedback.user_id}`}
                className="focus-ring inline-flex items-center gap-1 rounded-sm text-label font-semibold text-brand hover:underline"
              >
                查看用户详情
                <ExternalLink className="size-3.5" />
              </Link>
            </div>
          </Card>

          {pending && hasPermission(user?.role, PERMISSIONS.contentWrite) ? (
            <Card>
              <h2 className="text-card-title font-semibold text-ink">审核裁决</h2>
              <p className="mt-1 text-caption leading-relaxed text-ink-muted">
                采纳会立即发放硬币并通知提交人；裁决写入审计日志，提交后不可撤销。
              </p>
              <div className="mt-4">
                <FeedbackReviewForm
                  key={feedback.id}
                  feedbackId={feedback.id}
                  defaultReward={kind?.rewardDefault || 0}
                  onReviewed={(reviewed: any) => client.setQueryData<{ feedback: any }>(queryKey, (current) => current ? { feedback: { ...current.feedback, ...reviewed } } : current)}
                />
              </div>
            </Card>
          ) : (
            <Card>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-card-title font-semibold text-ink">审核结果</h2>
                <StatusBadge tone={FEEDBACK_STATUS_TONES[feedback.status] || 'neutral'}>
                  {statusLabel}
                </StatusBadge>
              </div>
              <dl className="mt-3 space-y-2.5 text-body-sm">
                <div>
                  <dt className="text-caption text-ink-muted">审核人</dt>
                  <dd className="mt-0.5 break-all text-ink">{feedback.reviewerEmail || '—'}</dd>
                </div>
                <div>
                  <dt className="text-caption text-ink-muted">审核时间</dt>
                  <dd className="mt-0.5 text-ink">{formatDate(feedback.reviewedAt)}</dd>
                </div>
                <div>
                  <dt className="text-caption text-ink-muted">发放硬币</dt>
                  <dd className="mt-0.5 text-brand tabular-nums">
                    {feedback.rewardCoins ?? feedback.reward_coins ?? 0} 枚
                  </dd>
                </div>
                {feedback.rewardTransactionId && (
                  <div>
                    <dt className="text-caption text-ink-muted">奖励流水</dt>
                    <dd className="mt-1">
                      <CopyableId id={feedback.rewardTransactionId} label="流水" />
                    </dd>
                  </div>
                )}
              </dl>
              {feedback.reviewNote && (
                <div className="mt-4 rounded-xl border border-line bg-well px-3 py-2.5">
                  <p className="text-caption font-medium text-ink-muted">审核备注</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-body-sm leading-relaxed text-ink">
                    {feedback.reviewNote}
                  </p>
                </div>
              )}
            </Card>
          )}

          <Card>
            <h2 className="text-card-title font-semibold text-ink">流程提示</h2>
            <ul className="mt-3 space-y-2 text-body-sm leading-relaxed text-ink-muted">
              <li className="flex items-start gap-2">
                <GitPullRequest className="mt-0.5 size-4 shrink-0 text-ink-subtle" />
                安全类提交请先确认影响面，避免在公开 Issue 中披露可利用细节。
              </li>
              <li className="flex items-start gap-2">
                <Coins className="mt-0.5 size-4 shrink-0 text-ink-subtle" />
                奖励数量可按实际价值调整，采纳后立即入账且不可重复发放。
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

export function AdminI18nPage() {
  useDocumentTitle('语言管理 | SupDance 管理后台');
  const { redirectEl } = useAdminPermissionGuard(PERMISSIONS.i18nRead);
  const { data, loading } = useAdminData<any>('/api/admin/i18n');

  if (redirectEl) return redirectEl;

  return (
    <>
      <PageHeader
        eyebrow="系统与前端管理"
        title="语言管理"
        description="编辑多语言字段、检查占位符与缺失项，并在真实用户端发布前查看每种语言的有效覆盖率。English 是基准语言。"
      />
      {loading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-white/[0.03]" />
      ) : (
        <LanguageManagementClient initialSnapshot={data || { locales: [], entries: [] }} />
      )}
    </>
  );
}

export function AdminSettingsPage() {
  useDocumentTitle('系统设置与前台总控 | SupDance 运营后台');
  const { user, redirectEl } = useAdminPermissionGuard(PERMISSIONS.settingsRead);
  const { data: settingsData, loading: l1 } = useAdminData<any>('/api/admin/settings');
  const { data: brandingData, loading: l2 } = useAdminData<any>('/api/admin/content/branding');
  const { data: motionData } = useAdminData<any>('/api/admin/content/motion');

  if (redirectEl) return redirectEl;

  const loading = l1 || l2;
  const settings = Array.isArray(settingsData)
    ? settingsData
    : settingsData?.settings || settingsData?.rows || [];
  const brand = brandingData?.brand || brandingData || {};
  const navigation = brandingData?.navigation || [];
  const motion = motionData?.motion || motionData || {};

  return (
    <>
      <PageHeader
        eyebrow="系统与安全"
        title="系统设置与前台总控"
        description="一站式管理品牌标识、网站图标、全站顶栏导航、顶部推广公告、视觉动效能耗以及系统维护模式与访问安全。"
      />
      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-white/[0.03]" />
      ) : (
        <SettingsEditorClient
          initialSettings={settings}
          initialBrand={brand}
          initialNavigation={navigation}
          canWriteContent={hasPermission(user?.role, PERMISSIONS.contentWrite)}
          initialMotion={motion}
        />
      )}
    </>
  );
}

export function AdminStorageSettingsPage() {
  useDocumentTitle('对象存储 | SupDance 运营后台');
  const { user, redirectEl } = useAdminPermissionGuard(PERMISSIONS.storageRead);
  const { data, loading } = useAdminData<any>('/api/admin/storage');

  if (redirectEl) return redirectEl;

  const canWrite = hasPermission(user?.role, PERMISSIONS.storageWrite);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="系统与安全"
        title="对象存储"
        description="为新生成的图片、视频、音乐与头像选择存储位置，并把历史资源复制到新位置。保存只改变新增资源；历史资源始终按自己记录的 provider、Endpoint 和 Bucket 读取。"
      />
      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-white/[0.03]" />
      ) : (
        <StorageSettingsClient
          initial={data || {}}
          catalog={PROVIDER_CATALOG}
          s3Presets={S3_PRESETS}
          canWrite={canWrite}
        />
      )}
    </div>
  );
}

const PURPOSE_LABELS: Record<string, string> = {
  verification: '验证码通道',
  test: '连通性测试',
  system: '系统通知',
  marketing: '营销触达',
};

export function AdminEmailSettingsPage() {
  useDocumentTitle('邮件发信设置 | 管理后台');
  const { user, redirectEl } = useAdminPermissionGuard(PERMISSIONS.providersRead);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const statusFilter = params.get('status') || '';
  const purposeFilter = params.get('purpose') || '';

  const { data: emailData, loading } = useAdminData<any>(
    `/api/admin/providers/email${location.search}`,
    [location.search]
  );

  if (redirectEl) return redirectEl;

  const canWrite = hasPermission(user?.role, PERMISSIONS.providersWrite);
  const initial = emailData?.initial || emailData?.config || emailData || {};
  const stats = emailData?.stats || {};
  const logs = emailData?.logs || { rows: [], pagination: {} };

  const columns = [
    {
      key: 'created_at',
      label: '投递时间',
      render: (row: any) => (
        <span className="font-mono text-xs text-ink-muted">
          {row.created_at
            ? new Date(row.created_at).toLocaleString('zh-CN', {
                timeZone: 'Asia/Shanghai',
                hour12: false,
              })
            : '—'}
        </span>
      ),
    },
    {
      key: 'purpose',
      label: '业务用途',
      render: (row: any) => (
        <span className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-ink-muted border border-line-subtle">
          {PURPOSE_LABELS[row.purpose] || row.purpose}
        </span>
      ),
    },
    {
      key: 'recipient',
      label: '收件人',
      render: (row: any) => <div className="font-mono text-xs text-ink">{row.recipient}</div>,
    },
    {
      key: 'subject',
      label: '邮件主题与脱敏预览',
      render: (row: any) => (
        <div className="max-w-md truncate">
          <span className="font-medium text-ink">{row.subject || '（无主题）'}</span>
          {row.body_preview && (
            <span className="ml-2 font-mono text-[11px] text-ink-subtle truncate">
              {row.body_preview}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: '状态',
      render: (row: any) => (
        <StatusBadge tone={row.status === 'success' ? 'good' : 'danger'}>
          {row.status === 'success' ? '已投递' : row.error_code || '投递失败'}
        </StatusBadge>
      ),
    },
    {
      key: 'latency_ms',
      label: '耗时',
      render: (row: any) => (
        <span className="font-mono text-xs text-ink-subtle">
          {row.latency_ms != null ? `${row.latency_ms} ms` : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: (row: any) => <EmailLogDetailButton log={row} />,
    },
  ];

  const todaySuccessRate = stats?.summary?.today_total
    ? `${Math.round(((stats.summary.today_success || 0) / stats.summary.today_total) * 100)}%`
    : '100%';

  const weekAvgLatency = stats?.summary?.week_avg_latency_ms
    ? `${stats.summary.week_avg_latency_ms} ms`
    : '185 ms';

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-16">
      <PageHeader
        eyebrow="SupDance 运营后台"
        title="邮件发信设置"
        description="配置 SMTP 邮件发信服务器、主备线路自动容灾、长连接复用池、投递质量诊断与发信流水审计大盘。"
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-[-0.01em] text-ink flex items-center gap-2">
            <span>发信统计</span>
            <span className="rounded px-1.5 py-0.2 text-[10px] bg-white/[0.06] text-ink-subtle border border-line-subtle font-mono font-normal">
              实时汇总
            </span>
          </h2>
          <span className="text-xs text-ink-subtle font-mono">统计周期：近 7 天 / 今日</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="今日发信总量"
            value={stats?.summary?.today_total || 0}
            hint={`今日送达成功率 ${todaySuccessRate}`}
            tone="info"
          />
          <MetricCard
            label="近 7 日发信总量"
            value={stats?.summary?.week_total || 0}
            hint={`累计失败 ${stats?.summary?.week_failed || 0} 封`}
            tone="neutral"
          />
          <MetricCard
            label="近 7 日平均耗时"
            value={weekAvgLatency}
            hint="SMTP 连接池持久长连接复用压降握手开销"
            tone="good"
          />
          <MetricCard
            label="全站累计投递记录"
            value={stats?.summary?.all_total || 0}
            hint={`全周期成功率 ${
              stats?.summary?.all_total
                ? Math.round(((stats.summary.all_success || 0) / stats.summary.all_total) * 100)
                : 100
            }%`}
            tone="good"
          />
        </div>
      </section>

      {loading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-white/[0.03]" />
      ) : (
        <EmailSettingsClient initial={initial} canWrite={canWrite} />
      )}

      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line-subtle pb-3">
          <div>
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              <span>发信内容明细</span>
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-mono font-bold text-brand">
                {logs?.pagination?.total || logs?.rows?.length || 0}
              </span>
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              基于 auth_usr.email_send_logs 的发信流水审计日志，敏感凭证已脱敏，点击「查看详情」可打开单封排障抽屉。
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Link
              href="/admin/system/email"
              className={`rounded-lg px-2.5 py-1 transition-colors ${
                !statusFilter && !purposeFilter
                  ? 'bg-brand/15 text-brand font-semibold'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              全部
            </Link>
            <Link
              href="/admin/system/email?status=success"
              className={`rounded-lg px-2.5 py-1 transition-colors ${
                statusFilter === 'success'
                  ? 'bg-brand/15 text-brand font-semibold'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              成功
            </Link>
            <Link
              href="/admin/system/email?status=failed"
              className={`rounded-lg px-2.5 py-1 transition-colors ${
                statusFilter === 'failed'
                  ? 'bg-red-500/15 text-red-400 font-semibold'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              失败
            </Link>
            <span className="text-line-subtle">|</span>
            <Link
              href="/admin/system/email?purpose=verification"
              className={`rounded-lg px-2.5 py-1 transition-colors ${
                purposeFilter === 'verification'
                  ? 'bg-brand/15 text-brand font-semibold'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              验证码
            </Link>
            <Link
              href="/admin/system/email?purpose=test"
              className={`rounded-lg px-2.5 py-1 transition-colors ${
                purposeFilter === 'test'
                  ? 'bg-brand/15 text-brand font-semibold'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              测试
            </Link>
          </div>
        </div>

        <DataTable columns={columns} rows={logs?.rows || []} empty="暂无发信记录" />
        <Pagination meta={logs?.pagination} searchParams={params} />
      </section>

      <section className="space-y-4 pt-4 border-t border-line-subtle">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-ink">邮件营销系统</h2>
            <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/20">
              待定计划
            </span>
          </div>
          <p className="text-xs text-ink-subtle">
            当前处于功能预留与模板验证阶段，仅供单封预览与受控测试发信
          </p>
        </div>

        <MarketingEmailSection canWrite={canWrite} />
      </section>
    </div>
  );
}

const REGION_META: Record<string, { label: string; description: string }> = {
  mainland_china: {
    label: '中国大陆',
    description: '命中境内 IP 段的访客只会看到这一组扫码/快捷登录。',
  },
  international: {
    label: '海外',
    description: '其余全部 IP（含港澳台与境外节点）看到这一组 OAuth 登录。',
  },
};

const CREDENTIAL_PROVIDER_ID: Record<string, string> = { wechat: 'wechat_oauth' };

export function AdminLoginMethodsPage() {
  useDocumentTitle('登录方式与连通性 | 管理后台');
  const { user, redirectEl } = useAdminPermissionGuard(PERMISSIONS.providersRead);
  const { data: providersData, loading: l1 } = useAdminData<any>('/api/admin/providers');
  const { data: socialRegionsData, loading: l2 } = useAdminData<any>(
    '/api/admin/login/social-regions'
  );
  const { data: smsOverview, loading: l3 } = useAdminData<any>('/api/admin/providers/sms');

  if (redirectEl) return redirectEl;

  const canWrite = hasPermission(user?.role, PERMISSIONS.providersWrite);
  const loading = l1 || l2 || l3;

  const allProviders = Array.isArray(providersData)
    ? providersData
    : providersData?.providers || [];
  const socialProviders = allProviders.filter((p: any) => p.kind === 'social');
  const socialConfig = socialRegionsData?.config || socialRegionsData || {};

  const regions = (SOCIAL_LOGIN_REGIONS || []).map((regionId: string) => {
    const configEntries: any[] = socialConfig[regionId] || [];
    const enabledIds = new Set(
      configEntries.filter((entry) => entry.enabled !== false).map((entry) => entry.id)
    );
    const catalogProviders: string[] = (SOCIAL_LOGIN_CATALOG as any)[regionId] || [];
    const channels = catalogProviders.map((pId) => {
      const mappedId = CREDENTIAL_PROVIDER_ID[pId] || pId;
      const p = socialProviders.find((sp: any) => sp.id === mappedId) || {};
      const providerData = {
        ...p,
        id: mappedId,
        channelId: pId,
        name: p.name || pId,
        description: p.description || '',
        mode: p.mode || 'OAuth 2.0',
        configured: Boolean(p.configured),
        callbackPath: p.callbackPath || `/api/auth/oauth/${pId}/callback`,
        secretKeys: p.secretKeys || [
          { name: 'client_id', label: 'Client ID 客户端标识', placeholder: '输入 Client ID' },
          {
            name: 'client_secret',
            label: 'Client Secret 客户端密钥',
            placeholder: '输入 Client Secret',
          },
        ],
        lastCheck: p.lastCheck || null,
      };
      return {
        id: pId,
        providerId: mappedId,
        name: p.name || pId,
        description: p.description || '',
        enabled: enabledIds.has(pId),
        policy: configEntries.find((e) => e.id === pId)?.policy,
        configured: Boolean(p.configured),
        keys: p.keys || [],
        lastCheck: p.lastCheck || null,
        callbackPath: p.callbackPath || `/api/auth/oauth/${pId}/callback`,
        provider: providerData,
      };
    });
    return {
      id: regionId,
      label: REGION_META[regionId]?.label || regionId,
      description: REGION_META[regionId]?.description || '',
      channels,
    };
  });

  const diagnostics = socialRegionsData?.diagnostics || {
    clientIp: '127.0.0.1',
    ipSource: 'client',
    isChinaIp: false,
    region: 'international',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="登录方式与连通性"
        description="管理境内外 OAuth 社交登录渠道、短信线路配置与连通性探针。"
      />
      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-white/[0.03]" />
      ) : (
        <LoginMethodsClient
          regions={regions}
          diagnostics={diagnostics}
          smsInitial={smsOverview || { providers: [] }}
          canWrite={canWrite}
        />
      )}
    </div>
  );
}

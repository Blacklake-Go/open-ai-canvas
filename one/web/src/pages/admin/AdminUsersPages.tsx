import Link from 'next/link';
import { useLocation, useParams } from 'react-router';
import {
  Card,
  DataTable,
  PageHeader,
  Pagination,
  StatusBadge,
  CopyableId,
  MetricCard,
} from '@/components/admin/AdminUi';
import ExportButton from '@/components/admin/ExportButton';
import AdminActionForm from '@/components/admin/AdminActionForm';
import { ProviderBadgeList } from '@/components/admin/ProviderBadges';
import { formatAdminDateTime } from '@/components/admin/formatters';
import { UserAvatar } from '@/components/admin/UserAvatar';
import { resolveUserAvatarUrl } from '@/lib/avatar';
import { hasPermission, PERMISSIONS, roleLabel } from '@/lib/admin/permissions';
import { LOGIN_PROVIDER_OPTIONS, USER_ROLE_OPTIONS } from '@/lib/admin/userFilters';
import AdminsManagerClient from '@/pages/admin/client/admins/AdminsManagerClient';
import InvitesManagerClient from '@/pages/admin/client/invites/InvitesManagerClient';
import UserDetailTabs from '@/pages/admin/client/users/[id]/UserDetailTabs';
import UserDashboardClient from '@/pages/admin/client/users/dashboard/UserDashboardClient';
import AdminNotFound from '@/pages/boundaries/AdminNotFound';
import {
  AdminFilterForm,
  normalizeAdminListResponse,
  useAdminData,
  useAdminPermissionGuard,
  useAdminRawData,
  useDocumentTitle,
} from '@/pages/helpers/pageHelpers';

function renderTagBadges(tags: any[] = [], preferredModality: string | null = null) {
  const hasTags = tags && tags.length > 0;
  const hasModality = Boolean(preferredModality);

  if (!hasTags && !hasModality) {
    return <span className="text-white/30 text-xs">无标签</span>;
  }

  const modalityBadge =
    preferredModality === 'video' ? (
      <span
        key="mod_video"
        className="inline-flex items-center gap-1 rounded-full border border-pink-500/30 bg-pink-500/10 px-2 py-0.5 text-[11px] font-medium text-pink-300"
      >
        <span>🎬 偏好视频</span>
      </span>
    ) : preferredModality === 'audio' ? (
      <span
        key="mod_audio"
        className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300"
      >
        <span>🎵 偏好音频</span>
      </span>
    ) : preferredModality === 'image' ? (
      <span
        key="mod_image"
        className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand"
      >
        <span>🎨 偏好生图</span>
      </span>
    ) : null;

  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span
          key={t.id}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm"
          style={{
            backgroundColor: `${t.color}25`,
            borderColor: `${t.color}50`,
            borderWidth: 1,
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.color }} />
          <span>{t.name}</span>
        </span>
      ))}
      {modalityBadge}
    </div>
  );
}

export function AdminUsersPage() {
  useDocumentTitle('用户运营管理 | SupDance 管理后台');
  const { redirectEl } = useAdminPermissionGuard(PERMISSIONS.usersRead);
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  const { data: usersRaw } = useAdminRawData(`/api/admin/users${location.search}`, [
    location.search,
  ]);
  const { data: summaryData } = useAdminData<any>('/api/admin/users/dashboard?range=day');

  if (redirectEl) return redirectEl;

  const result = normalizeAdminListResponse(usersRaw);
  const summary = {
    totalUsers: summaryData?.metrics?.totalUsers ?? result.meta?.total ?? 0,
    todayNewUsers: summaryData?.metrics?.todayNewUsers ?? 0,
    activeSessions: summaryData?.metrics?.activeSessions ?? 0,
    payingUsers: summaryData?.metrics?.payingUsers ?? 0,
    suspendedUsers: summaryData?.metrics?.suspendedUsers ?? 0,
  };
  const tags: any[] = Array.isArray(usersRaw?.data?.tags) ? usersRaw.data.tags : [];

  const columns = [
    {
      key: 'user_info',
      label: '用户主体',
      render: (row: any) => {
        const displayName =
          row.display_name ||
          (row.phone ? `用户${row.phone.slice(-4)}` : row.email?.split('@')[0]) ||
          '用户';
        const letter = (
          row.display_name ||
          row.email ||
          row.phone ||
          row.user_number ||
          row.id ||
          'U'
        )
          .slice(0, 1)
          .toUpperCase();
        const avatarUrl = resolveUserAvatarUrl(row);

        return (
          <div className="flex items-center gap-3 min-w-[210px]">
            <Link
              href={`/admin/users/${row.id}`}
              className="group relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-surface-raised text-xs font-bold text-brand shadow-sm transition hover:border-brand/40"
              title={`查看 ${displayName} 的用户画像`}
            >
              <UserAvatar
                src={avatarUrl}
                alt={displayName}
                letter={letter}
                seed={row.id || row.user_number}
                fallbackType="svg"
                className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
              />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/users/${row.id}`}
                  className="font-semibold text-white transition hover:text-brand truncate max-w-[150px]"
                  title={displayName}
                >
                  {displayName}
                </Link>
                {row.registration_source && (
                  <span className="shrink-0 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.2 text-[10px] text-white/50">
                    {row.registration_source}
                  </span>
                )}
              </div>
              <div className="mt-0.5 space-y-0.5 text-xs text-white/50">
                {row.email && <div className="truncate max-w-[180px]">✉️ {row.email}</div>}
                {row.phone && (
                  <div>
                    📱 {row.phone_country_code || '+86'} {row.phone}
                  </div>
                )}
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-[11px] font-mono text-brand/80">
                  #{row.user_number || row.id}
                </span>
                <CopyableId id={row.id} />
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'login_providers',
      label: '绑定登录凭据',
      render: (row: any) => <ProviderBadgeList providers={row.loginProviders} />,
    },
    {
      key: 'tags',
      label: '运营标签 / 创作偏好',
      render: (row: any) => renderTagBadges(row.tags, row.preferredModality),
    },
    {
      key: 'role',
      label: '角色',
      render: (row: any) => (
        <StatusBadge tone={row.role === 'user' ? 'neutral' : 'info'}>
          {roleLabel(row.role)}
        </StatusBadge>
      ),
    },
    {
      key: 'status',
      label: '账户状态',
      render: (row: any) => (
        <StatusBadge tone={row.status === 'suspended' ? 'danger' : 'good'}>
          {row.status === 'suspended' ? '已封禁' : '正常'}
        </StatusBadge>
      ),
    },
    {
      key: 'credits',
      label: '模型额度 / 生成活跃',
      render: (row: any) => (
        <div>
          <span className="font-mono font-bold text-brand">{row.credits} 点</span>
          <p className="text-[11px] text-white/40 mt-0.5">
            累计 {row.creationsCount || 0} 次生成
          </p>
        </div>
      ),
    },
    {
      key: 'created_at',
      label: '注册 / 最近登录',
      render: (row: any) => (
        <div className="text-xs">
          <p className="text-white/70">{formatAdminDateTime(row.created_at)}</p>
          <p className="text-white/40 text-[11px] mt-0.5">
            最近: {formatAdminDateTime(row.last_login_at)}
          </p>
        </div>
      ),
    },
    {
      key: 'action',
      label: '操作',
      render: (row: any) => (
        <Link
          href={`/admin/users/${row.id}`}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-brand transition hover:bg-brand/10 hover:text-brand-hover"
        >
          查看画像与运营 →
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="用户与权限"
        title="用户运营管理"
        description="检索平台多渠道注册用户，查看绑定凭据、运营标签、模型额度，并执行封禁、调额与打标。"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/users/dashboard"
            className="inline-flex items-center gap-1.5 rounded-xl border border-brand/30 bg-brand/10 px-3.5 py-2 text-xs font-semibold text-brand hover:bg-brand/20 transition"
          >
            <span>📊 用户数据看板 (实时大屏) →</span>
          </Link>
          <ExportButton
            type="users"
            label="导出用户 CSV"
            requiredPermission={PERMISSIONS.exportsWrite}
          />
        </div>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          label="平台总用户"
          value={summary.totalUsers}
          hint={`今日新入驻 +${summary.todayNewUsers} 位`}
          tone="neutral"
        />
        <MetricCard
          label="当前活跃会话"
          value={summary.activeSessions}
          hint="在线创作中会话"
          tone="good"
        />
        <MetricCard
          label="付费用户客群"
          value={summary.payingUsers}
          hint={`${summary.totalUsers > 0 ? ((summary.payingUsers / summary.totalUsers) * 100).toFixed(1) : 0}% 商业转化率`}
          tone="info"
        />
        <MetricCard
          label="风控封禁账号"
          value={summary.suspendedUsers}
          hint="受控异常账户"
          tone={summary.suspendedUsers > 0 ? 'warn' : 'neutral'}
        />
        <MetricCard
          label="当前检索命中"
          value={result.meta?.total || 0}
          hint="符合当前组合条件"
          tone="neutral"
        />
      </div>

      <Card className="mb-6">
        <AdminFilterForm>
          <input
            name="q"
            defaultValue={params.get('q') || ''}
            placeholder="搜索手机号、邮箱、昵称或用户 ID…"
            className="min-w-[220px] flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-brand"
          />

          <select
            name="timeRange"
            defaultValue={params.get('timeRange') || ''}
            className="rounded-xl border border-white/10 bg-[#0a0a0a] px-3 py-2.5 text-xs text-white/70 outline-none focus:border-brand"
          >
            <option value="">全部注册时间</option>
            <option value="today">今日新注册</option>
            <option value="7d">近 7 天新注册</option>
            <option value="30d">近 30 天新注册</option>
          </select>

          <select
            name="commercial"
            defaultValue={params.get('commercial') || ''}
            className="rounded-xl border border-white/10 bg-[#0a0a0a] px-3 py-2.5 text-xs text-white/70 outline-none focus:border-brand"
          >
            <option value="">全部付费层级</option>
            <option value="paid">付费会员客群</option>
            <option value="free">免费体验用户</option>
          </select>

          <select
            name="provider"
            defaultValue={params.get('provider') || ''}
            className="rounded-xl border border-white/10 bg-[#0a0a0a] px-3 py-2.5 text-xs text-white/70 outline-none focus:border-brand"
          >
            <option value="">全部登录方式</option>
            {LOGIN_PROVIDER_OPTIONS.map((option: any) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            name="tag"
            defaultValue={params.get('tag') || ''}
            className="rounded-xl border border-white/10 bg-[#0a0a0a] px-3 py-2.5 text-xs text-white/70 outline-none focus:border-brand"
          >
            <option value="">全部运营标签</option>
            {tags.map((tag: any) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>

          <select
            name="role"
            defaultValue={params.get('role') || ''}
            className="rounded-xl border border-white/10 bg-[#0a0a0a] px-3 py-2.5 text-xs text-white/70 outline-none focus:border-brand"
          >
            <option value="">全部角色</option>
            {USER_ROLE_OPTIONS.map((option: any) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            name="status"
            defaultValue={params.get('status') || ''}
            className="rounded-xl border border-white/10 bg-[#0a0a0a] px-3 py-2.5 text-xs text-white/70 outline-none focus:border-brand"
          >
            <option value="">全部账户状态</option>
            <option value="active">正常</option>
            <option value="suspended">已封禁</option>
          </select>

          <select
            name="order"
            defaultValue={params.get('order') || ''}
            className="rounded-xl border border-white/10 bg-[#0a0a0a] px-3 py-2.5 text-xs text-white/70 outline-none focus:border-brand"
          >
            <option value="">注册时间倒序 (默认)</option>
            <option value="login_desc">最近登录倒序</option>
            <option value="credits_desc">模型额度由高到低</option>
            <option value="created_asc">注册时间正序</option>
          </select>

          <button
            type="submit"
            className="rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-white transition hover:bg-brand-hover shadow-sm"
          >
            筛选
          </button>

          {Array.from(params.keys()).length > 0 && (
            <Link
              href="/admin/users"
              className="rounded-xl border border-white/10 px-3 py-2.5 text-xs text-white/50 hover:bg-white/5 hover:text-white"
            >
              重置
            </Link>
          )}
        </AdminFilterForm>
      </Card>

      <DataTable columns={columns} rows={result.rows} empty="未找到匹配的用户记录" />
      <Pagination meta={result.meta} searchParams={params} />
    </>
  );
}

export function AdminUserDetailPage() {
  useDocumentTitle('用户全景画像 | SupDance 管理后台');
  const { id } = useParams<{ id?: string }>();
  const { user: actor, redirectEl } = useAdminPermissionGuard(PERMISSIONS.usersRead);
  const { data: detail, loading, error } = useAdminData<any>(
    id ? `/api/admin/users/${encodeURIComponent(id)}` : null,
    [id]
  );

  if (redirectEl) return redirectEl;
  if (!id) return <AdminNotFound />;
  if (loading) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/20 border-t-brand" />
      </div>
    );
  }
  if (error || !detail?.user) {
    return <AdminNotFound />;
  }

  const { user } = detail;
  const rawTitle =
    user.display_name ||
    user.email ||
    (user.phone ? `${user.phone_country_code || '+86'} ${user.phone}` : user.id);
  const letter = (user.display_name || user.email || user.phone || user.id || 'U')
    .slice(0, 1)
    .toUpperCase();
  const avatarUrl = resolveUserAvatarUrl(user);

  const titleDisplay = (
    <span className="inline-flex items-center gap-3">
      <span className="inline-flex size-9 sm:size-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-surface-raised shadow-md align-middle">
        <UserAvatar
          src={avatarUrl}
          alt={rawTitle}
          letter={letter}
          seed={user.id}
          fallbackType="svg"
          className="size-full object-cover"
        />
      </span>
      <span>{rawTitle}</span>
    </span>
  );

  return (
    <>
      <PageHeader
        eyebrow="用户全景画像"
        title={titleDisplay}
        description={`用户 ID: ${user.id} · 注册渠道: ${user.registration_source || 'web'} · 注册于 ${formatAdminDateTime(user.created_at)}`}
      >
        <Link
          href="/admin/users"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/10"
        >
          ← 返回用户列表
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <p className="text-xs text-white/40">账户状态</p>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge tone={user.status === 'suspended' ? 'danger' : 'good'}>
              {user.status === 'suspended' ? '已封禁' : '正常'}
            </StatusBadge>
            <StatusBadge tone={user.role === 'user' ? 'neutral' : 'info'}>
              {roleLabel(user.role)}
            </StatusBadge>
          </div>
        </Card>

        <Card>
          <p className="text-xs text-white/40">可用模型额度</p>
          <p className="mt-2 text-3xl font-extrabold text-brand">{user.credits}</p>
          <p className="mt-1 text-[11px] text-white/35">可直接用于 AI 图像/视频生成</p>
        </Card>

        <Card>
          <p className="text-xs text-white/40">活跃会话数</p>
          <p className="mt-2 text-2xl font-bold text-white">{detail.sessions?.length || 0}</p>
          <p className="mt-1 text-[11px] text-white/35">未过期的合法 HttpOnly 凭据</p>
        </Card>

        <Card>
          <p className="text-xs text-white/40">生成记录总计</p>
          <p className="mt-2 text-2xl font-bold text-white">{detail.creations?.length || 0}</p>
          <p className="mt-1 text-[11px] text-white/35">涵盖所有 Studio 模块</p>
        </Card>
      </div>

      <UserDetailTabs
        detail={detail}
        canManageAdmins={hasPermission(actor?.role, PERMISSIONS.adminsWrite)}
      />
    </>
  );
}

export function AdminUserDashboardPage() {
  useDocumentTitle('用户数据看板 · 运营大屏 - SupDance 后台');
  const { redirectEl } = useAdminPermissionGuard(PERMISSIONS.usersRead);
  const { data } = useAdminData<any>('/api/admin/users/dashboard?range=day');

  if (redirectEl) return redirectEl;

  const initialData = data || {
    metrics: {},
    trends: [],
    distribution: {},
    stream: [],
  };

  return <UserDashboardClient initialData={initialData} />;
}

export function AdminAdminsPage() {
  useDocumentTitle('管理员团队与角色权限 | SupDance 管理后台');
  const { redirectEl } = useAdminPermissionGuard(PERMISSIONS.adminsWrite);
  const { data, loading } = useAdminData<any>('/api/admin/admins');

  if (redirectEl) return redirectEl;

  const admins = Array.isArray(data) ? data : data?.admins || data?.rows || [];

  return (
    <>
      <PageHeader
        eyebrow="用户与权限"
        title="管理员团队与角色权限"
        description="管理平台内部管理团队成员与其内置 RBAC 权限。支持快捷调权、账号启用/停用控制，以及从现有用户库检索授权。"
      />
      {loading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-white/[0.03]" />
      ) : (
        <AdminsManagerClient initialAdmins={admins} />
      )}
    </>
  );
}

export function AdminInvitesPage() {
  useDocumentTitle('邀请码与使用习惯分析 | SupDance 管理后台');
  const { redirectEl } = useAdminPermissionGuard(PERMISSIONS.usersRead);
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  const status = params.get('status') || null;
  const search = params.get('search') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const pageSize = Math.max(1, Math.min(100, Number(params.get('pageSize')) || 20));

  const { data, loading } = useAdminData<any>(`/api/admin/invites${location.search}`, [
    location.search,
  ]);

  if (redirectEl) return redirectEl;

  const listData = data?.listData || {
    items: data?.items || data?.rows || [],
    total: data?.total || 0,
    page,
    pageSize,
  };
  const overview = data?.overview || {};

  return loading ? (
    <div className="h-48 animate-pulse rounded-2xl bg-white/[0.03]" />
  ) : (
    <InvitesManagerClient
      initialListData={listData}
      initialOverview={overview}
      initialQuery={{ status, search, page, pageSize }}
    />
  );
}

export function AdminSessionsPage() {
  useDocumentTitle('会话与安全监控 | SupDance 管理后台');
  const { redirectEl } = useAdminPermissionGuard(PERMISSIONS.sessionsRevoke);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const { data: raw } = useAdminRawData(`/api/admin/security/sessions${location.search}`, [
    location.search,
  ]);

  if (redirectEl) return redirectEl;

  const result = normalizeAdminListResponse(raw);

  const columns = [
    {
      key: 'user',
      label: '账户主体 / 角色',
      render: (row: any) => (
        <div>
          <Link
            href={`/admin/users/${row.user_id}`}
            className="font-semibold text-white transition-colors hover:text-brand"
          >
            {row.display_name ||
              row.email ||
              (row.phone ? `用户${row.phone.slice(-4)}` : row.user_id)}
          </Link>
          <div className="mt-0.5 text-xs text-white/50 space-y-0.5">
            {row.email && <div>✉️ {row.email}</div>}
            {row.phone && (
              <div>
                📱 {row.phone_country_code || '+86'} {row.phone}
              </div>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge tone={row.role === 'user' ? 'neutral' : 'info'}>
              {roleLabel(row.role)}
            </StatusBadge>
            <CopyableId id={row.user_id} label="用户 ID" />
          </div>
        </div>
      ),
    },
    {
      key: 'token_hash',
      label: '会话 Token 哈希',
      render: (row: any) => (
        <div>
          <CopyableId id={row.token_hash} />
          {row.last_seen_at && (
            <p className="mt-1 text-[11px] text-white/40">
              活跃: {formatAdminDateTime(row.last_seen_at)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'created_at',
      label: '登录创建时间',
      render: (row: any) => formatAdminDateTime(row.created_at),
    },
    {
      key: 'expires_at',
      label: '凭据有效期至',
      render: (row: any) => (
        <span className="text-white/60">{formatAdminDateTime(row.expires_at)}</span>
      ),
    },
    {
      key: 'action',
      label: '管理操作',
      render: (row: any) => (
        <div className="flex flex-wrap items-center gap-2">
          <AdminActionForm
            action={`/api/admin/security/sessions/${row.token_hash}`}
            method="DELETE"
            fields={[]}
            label="下线此设备"
            tone="secondary"
            confirmMessage="确认下线该单条设备会话？该设备需重新登录。"
          />
          <AdminActionForm
            action={`/api/admin/users/${row.user_id}/sessions`}
            method="POST"
            fields={[]}
            label="强制全量下线"
            tone="danger"
            confirmMessage="确认强制撤销该用户的所有活跃会话？用户所有终端均将被踢下线。"
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="用户与权限"
        title="会话与安全监控"
        description="实时监控平台所有有效登录会话。支持按照用户邮箱、手机号或昵称快速定位，并在检测到异常时支持单设备下线或全量会话注销。"
      />

      <Card className="mb-6">
        <AdminFilterForm>
          <input
            name="q"
            defaultValue={params.get('q') || ''}
            placeholder="搜索邮箱、手机号、昵称或用户 ID…"
            className="min-w-[280px] flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-brand"
          />
          <button
            type="submit"
            className="rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-white hover:bg-brand-hover transition shadow-sm"
          >
            查询会话
          </button>
          {Array.from(params.keys()).length > 0 && (
            <Link
              href="/admin/security/sessions"
              className="rounded-xl border border-white/10 px-3 py-2.5 text-xs text-white/50 hover:bg-white/5 hover:text-white"
            >
              重置
            </Link>
          )}
        </AdminFilterForm>
      </Card>

      <DataTable columns={columns} rows={result.rows} empty="当前没有匹配的有效会话" />
      <Pagination meta={result.meta} searchParams={params} />
    </>
  );
}

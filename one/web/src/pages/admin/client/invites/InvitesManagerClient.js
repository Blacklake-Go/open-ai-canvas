'use client';

import React, { useState, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Key,
  Users,
  Sparkles,
  Check,
  Copy,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Plus,
  Search,
  ArrowUpRight,
  Loader2,
  X,
  CreditCard,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { PageHeader, Card, MetricCard, StatusBadge, DataTable, Button, CopyableId } from '@/components/admin/AdminUi';
import ExportButton from '@/components/admin/ExportButton';
import { PermissionGate } from '@/components/admin/AdminPermissions';
import { PERMISSIONS } from '@/lib/admin/permissions';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function InvitesManagerClient({
  initialListData,
  initialOverview,
  initialQuery = {},
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 1. 全局大盘与注册开关状态
  const [overview, setOverview] = useState(initialOverview || {});
  const [isSwitchBusy, setIsSwitchBusy] = useState(false);
  const [switchFeedback, setSwitchFeedback] = useState('');

  // 2. 列表数据与查询参数
  const [listData, setListData] = useState(initialListData || { codes: [], total: 0, page: 1, pageSize: 20 });
  const [statusFilter, setStatusFilter] = useState(initialQuery.status || '');
  const [searchInput, setSearchInput] = useState(initialQuery.search || '');
  const [activeSearch, setActiveSearch] = useState(initialQuery.search || '');
  const [listError, setListError] = useState('');
  const [actionFeedback, setActionFeedback] = useState(null); // { tone: 'good' | 'danger', text }

  // 3. 批量发码器状态
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [genCount, setGenCount] = useState(10);
  const [genMaxUses, setGenMaxUses] = useState(1);
  const [genNotes, setGenNotes] = useState('');
  const [genExpiresDays, setGenExpiresDays] = useState('0'); // 0 为永久
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState('');
  const [genResult, setGenResult] = useState(null);
  const [copiedBatch, setCopiedBatch] = useState(false);
  const [copiedBatchLinks, setCopiedBatchLinks] = useState(false);

  // 4. 用户习惯穿透弹窗状态
  const [selectedHabitsCode, setSelectedHabitsCode] = useState(null);
  const [habitsUsers, setHabitsUsers] = useState([]);
  const [habitsLoading, setHabitsLoading] = useState(false);
  const [habitsError, setHabitsError] = useState('');
  const [copiedCodeId, setCopiedCodeId] = useState(null);

  // 切换全局强制注册开关
  const handleToggleGlobalSwitch = async () => {
    const nextState = !overview.is_invite_code_required;
    setIsSwitchBusy(true);
    setSwitchFeedback('');

    try {
      const res = await fetch('/api/admin/invites/switch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({ enabled: nextState }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || '更新开关失败');

      setOverview((prev) => ({
        ...prev,
        is_invite_code_required: nextState,
      }));
      setSwitchFeedback(nextState ? '已开启强制邀请码注册' : '已开放自由注册（邀请码可选）');
      setTimeout(() => setSwitchFeedback(''), 3000);
      router.refresh();
    } catch (err) {
      setSwitchFeedback(`错误: ${err.message}`);
    } finally {
      setIsSwitchBusy(false);
    }
  };

  // 刷新/查询列表
  const fetchCodes = useCallback(async (params = {}) => {
    const page = params.page ?? listData.page ?? 1;
    const status = params.status !== undefined ? params.status : statusFilter;
    const search = params.search !== undefined ? params.search : activeSearch;

    const query = new URLSearchParams();
    if (page) query.set('page', page);
    if (status) query.set('status', status);
    if (search) query.set('search', search);

    try {
      const res = await fetch(`/api/admin/invites?${query.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || '邀请码列表加载失败');
      if (data.data) {
        setListData(data.data);
        if (data.data.overview) setOverview(data.data.overview);
        setListError('');
      }
    } catch (e) {
      setListError(e.message || '邀请码列表加载失败，请稍后重试');
    }
  }, [listData.page, statusFilter, activeSearch]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setActiveSearch(searchInput);
    fetchCodes({ search: searchInput, page: 1 });
  };

  const handleStatusChange = (newStatus) => {
    setStatusFilter(newStatus);
    fetchCodes({ status: newStatus, page: 1 });
  };

  // 批量生成邀请码
  const handleGenerate = async (e) => {
    e.preventDefault();
    setGenLoading(true);
    setGenResult(null);
    setGenError('');

    try {
      const res = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          count: genCount,
          maxUses: genMaxUses,
          notes: genNotes,
          expiresDays: genExpiresDays === '0' ? null : Number(genExpiresDays),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || '批量生成失败');

      setGenResult(data.data.codes || []);
      fetchCodes({ page: 1 });
    } catch (err) {
      setGenError(err.message || '批量生成失败，请稍后重试');
    } finally {
      setGenLoading(false);
    }
  };

  // 更改单码状态（启用/停用）
  const handleToggleCodeStatus = async (row) => {
    const nextStatus = row.status === 'active' ? 'disabled' : 'active';
    setActionFeedback(null);
    try {
      const res = await fetch(`/api/admin/invites/${row.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': globalThis.crypto?.randomUUID?.() || `invite-${row.id}-${Date.now()}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || '邀请码状态更新失败');
      setActionFeedback({ tone: 'good', text: `邀请码 ${row.code} 已${nextStatus === 'active' ? '启用' : '停用'}` });
      fetchCodes();
    } catch (e) {
      setActionFeedback({ tone: 'danger', text: e.message || '邀请码状态更新失败，请稍后重试' });
    }
  };

  // 打开用户习惯画像穿透弹窗
  const handleOpenHabits = async (row) => {
    setSelectedHabitsCode(row);
    setHabitsLoading(true);
    setHabitsUsers([]);
    setHabitsError('');

    try {
      const res = await fetch(`/api/admin/invites/${row.id}/users`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || '用户习惯画像加载失败');
      if (data.data?.users) {
        setHabitsUsers(data.data.users);
      }
    } catch (e) {
      setHabitsError(e.message || '用户习惯画像加载失败，请稍后重试');
    } finally {
      setHabitsLoading(false);
    }
  };

  // 复制推广专属链接
  const handleCopyLink = (code) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.Supdance.com';
    const link = `${origin}/account?auth=register&invite=${encodeURIComponent(code)}`;
    navigator.clipboard.writeText(link);
    setCopiedCodeId(code);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  // 复制所有生成的码
  const handleCopyAllGenerated = () => {
    if (!genResult?.length) return;
    const text = genResult.map((c) => c.code).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedBatch(true);
    setTimeout(() => setCopiedBatch(false), 2000);
  };

  // 复制所有生成的专属链接
  const handleCopyAllLinks = () => {
    if (!genResult?.length) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.Supdance.com';
    const text = genResult
      .map((c) => `${origin}/account?auth=register&invite=${encodeURIComponent(c.code)}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopiedBatchLinks(true);
    setTimeout(() => setCopiedBatchLinks(false), 2000);
  };

  const isInviteRequired = Boolean(overview.is_invite_code_required);

  const columns = [
    {
      key: 'code',
      label: '邀请码 / 推广链接',
      render: (row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-brand text-sm tracking-wide select-all">
              {row.code}
            </span>
            <button
              type="button"
              onClick={() => handleCopyLink(row.code)}
              className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-brand transition-colors"
              title="复制专属推广链接"
            >
              {copiedCodeId === row.code ? (
                <span className="text-emerald-400 font-medium">已复制链接!</span>
              ) : (
                <Copy className="size-3.5" />
              )}
            </button>
          </div>
          <p className="text-[11px] text-gray-500 font-mono truncate max-w-[200px]">
            ID: {row.id}
          </p>
        </div>
      ),
    },
    {
      key: 'notes',
      label: '渠道 / 批次备注',
      render: (row) => (
        <div className="max-w-[180px]">
          {row.notes ? (
            <span className="inline-block rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-xs text-gray-200 truncate">
              🏷️ {row.notes}
            </span>
          ) : (
            <span className="text-gray-500 text-xs">—</span>
          )}
          <p className="mt-1 text-[11px] text-gray-500 truncate">
            由 {row.created_by || 'admin'} 发出
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      label: '状态',
      render: (row) => {
        const isExpired = row.expires_at && new Date(row.expires_at).getTime() < Date.now();
        const isExhausted = row.used_count >= row.max_uses;
        if (row.status === 'disabled') return <StatusBadge tone="danger">已停用</StatusBadge>;
        if (isExpired) return <StatusBadge tone="warn">已过期</StatusBadge>;
        if (isExhausted) return <StatusBadge tone="neutral">已用尽</StatusBadge>;
        return <StatusBadge tone="good">正常有效</StatusBadge>;
      },
    },
    {
      key: 'usage',
      label: '兑换使用进度',
      render: (row) => {
        const percent = Math.min(100, Math.round((row.used_count / row.max_uses) * 100));
        return (
          <div className="w-28 space-y-1">
            <div className="flex items-center justify-between text-xs font-mono font-medium">
              <span className="text-white">{row.used_count}</span>
              <span className="text-gray-400">/ {row.max_uses}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  percent >= 100 ? 'bg-gray-500' : 'bg-brand'
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: 'habits',
      label: '用户习惯特征 (AI创作偏好)',
      render: (row) => {
        const creations = Number(row.total_creations || 0);
        const favModel = row.favorite_model;
        if (creations === 0) {
          return (
            <div className="text-xs text-gray-500">
              <span>暂无衍生创作</span>
            </div>
          );
        }
        return (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-200">
              <Sparkles className="size-3.5 text-pink-400 shrink-0" />
              <span>衍生 {creations} 次创作</span>
            </div>
            {favModel && (
              <p className="text-[11px] text-brand font-mono truncate max-w-[190px]" title={favModel}>
                偏好: {favModel}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: 'revenue',
      label: '商业付费贡献',
      render: (row) => {
        const rev = Number(row.total_revenue_cny || 0);
        return (
          <div className="font-mono text-xs">
            <span className={rev > 0 ? 'text-emerald-400 font-bold' : 'text-gray-400'}>
              ¥ {rev.toFixed(2)}
            </span>
          </div>
        );
      },
    },
    {
      key: 'created_at',
      label: '创建 / 最近兑换时间',
      render: (row) => (
        <div className="space-y-0.5 text-xs text-gray-400 font-mono">
          <p>创建: {formatDate(row.created_at)}</p>
          {row.latest_redeemed_at && (
            <p className="text-brand/80 text-[11px]">
              活跃: {formatDate(row.latest_redeemed_at)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      label: '操作',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenHabits(row)}
            className="rounded-md border border-brand/30 bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand hover:bg-brand/20 transition-colors"
          >
            习惯画像
          </button>
          <PermissionGate permission={PERMISSIONS.usersUpdate}>
            <button
              type="button"
              onClick={() => handleToggleCodeStatus(row)}
              className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                row.status === 'active'
                  ? 'border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                  : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
              }`}
            >
              {row.status === 'active' ? '停用' : '启用'}
            </button>
          </PermissionGate>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="用户与权限"
        title="邀请注册码与使用习惯分析"
        description="管理内测期准入邀请码与全站强制注册开关，多维度洞察渠道拉新、创作偏好与商业化付费习惯。"
      >
        <ExportButton type="invites" label="导出邀请码分析 CSV" requiredPermission={PERMISSIONS.exportsWrite} />
      </PageHeader>

      {/* 模块一：全局准入开关面板 */}
      <Card className="border border-white/[0.08] bg-surface/90 p-5 shadow-elevation-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-[-0.01em]">
                全站用户注册准入开关
              </span>
              <StatusBadge tone={isInviteRequired ? 'warn' : 'good'}>
                {isInviteRequired ? '强制邀请码保护中 (内测准入)' : '开放自由注册中 (公测开放)'}
              </StatusBadge>
            </div>
            <p className="text-xs text-gray-400 max-w-2xl leading-relaxed">
              {isInviteRequired
                ? '当前处于内测保护模式：未填写有效邀请码的访客无法完成注册。适合控制算力负荷与封闭测试。'
                : '当前处于公测模式：访客可免邀请码直接注册；若携带专属邀请链接（?invite=），系统将自动记录归因并分析习惯。'}
            </p>
            {switchFeedback && (
              <p className="text-xs font-semibold text-brand animate-in fade-in">
                {switchFeedback}
              </p>
            )}
          </div>

          <div className="shrink-0 flex items-center gap-3">
            <PermissionGate permission={PERMISSIONS.settingsWrite}>
              <button
                type="button"
                disabled={isSwitchBusy}
                onClick={handleToggleGlobalSwitch}
                className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 ${
                  isInviteRequired ? 'bg-amber-500' : 'bg-emerald-500'
                } ${isSwitchBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                aria-label="切换全局邀请码开关"
              >
                <span
                  className={`pointer-events-none inline-block size-7 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    isInviteRequired ? 'translate-x-0' : 'translate-x-6'
                  }`}
                />
              </button>
            </PermissionGate>
            <span className="text-xs font-medium text-gray-300">
              {isSwitchBusy ? '切换中...' : isInviteRequired ? '要求邀请码' : '开放注册'}
            </span>
          </div>
        </div>
      </Card>

      {/* 模块二：宏观大盘看板 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="已生成邀请码总数"
          value={overview.total_codes ?? 0}
          hint={`有效: ${overview.active_codes ?? 0} · 用尽: ${overview.exhausted_codes ?? 0} · 停用: ${overview.disabled_codes ?? 0}`}
          tone="info"
        />
        <MetricCard
          label="邀请成功激活用户"
          value={overview.total_invited_users ?? 0}
          hint={`近7日活跃: ${overview.active_users_7d ?? 0} 人`}
          tone="good"
        />
        <MetricCard
          label="衍生 AI 创作任务"
          value={overview.total_creations ?? 0}
          hint="邀请注册用户提交的图像与视频总生成数"
          tone="warn"
        />
        <MetricCard
          label="带来充值付费总额"
          value={`¥ ${Number(overview.total_revenue_cny || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`}
          hint="邀请注册用户完成的订单与会员订阅转化"
          tone="good"
        />
      </div>

      {/* 模块三：批量发码控制器 */}
      <Card className="p-5 shadow-elevation-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="size-4 text-brand" />
            <h3 className="text-sm font-bold text-white">批量发码与渠道分发器</h3>
          </div>
          <PermissionGate permission={PERMISSIONS.usersUpdate}>
            <button
              type="button"
              onClick={() => setGeneratorOpen(!generatorOpen)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/20 transition-colors"
            >
              {generatorOpen ? <ChevronUp className="size-3.5" /> : <Plus className="size-3.5" />}
              <span>{generatorOpen ? '收起发码器' : '创建新批次邀请码'}</span>
            </button>
          </PermissionGate>
        </div>

        {generatorOpen && (
          <form onSubmit={handleGenerate} className="mt-4 pt-4 border-t border-white/[0.08] space-y-4">
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  生成数量 (1 ~ 100 张)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={genCount}
                  onChange={(e) => setGenCount(Number(e.target.value))}
                  className="w-full rounded-xl border border-white/[0.10] bg-surface px-3 py-2 text-xs text-white focus:border-brand focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  单码可用人次上限
                </label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={genMaxUses}
                  onChange={(e) => setGenMaxUses(Number(e.target.value))}
                  className="w-full rounded-xl border border-white/[0.10] bg-surface px-3 py-2 text-xs text-white focus:border-brand focus:outline-none"
                  required
                />
                <span className="text-[11px] text-gray-500 mt-1 block">
                  1 = 独享单人码；50+ = 渠道通用码
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  渠道 / 运营归因备注
                </label>
                <input
                  type="text"
                  placeholder="如: 2026-Q4-影视UP主合作"
                  value={genNotes}
                  onChange={(e) => setGenNotes(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.10] bg-surface px-3 py-2 text-xs text-white focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  有效期限制
                </label>
                <select
                  value={genExpiresDays}
                  onChange={(e) => setGenExpiresDays(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.10] bg-surface px-3 py-2 text-xs text-white focus:border-brand focus:outline-none"
                >
                  <option value="0">永久有效</option>
                  <option value="7">7 天内有效</option>
                  <option value="30">30 天内有效</option>
                  <option value="90">90 天内有效</option>
                </select>
              </div>
            </div>

            {genError && (
              <p className="rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-caption text-danger">
                {genError}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="submit"
                disabled={genLoading}
                className="h-[38px] rounded-lg bg-brand text-white font-semibold text-xs hover:bg-brand-hover active:scale-[0.98]"
              >
                {genLoading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    批量生成中...
                  </>
                ) : (
                  '立即生成并入库'
                )}
              </Button>
            </div>

            {/* 生成结果快速复制面板 */}
            {genResult && genResult.length > 0 && (
              <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="size-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-300">
                      成功生成 {genResult.length} 个邀请码！
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCopyAllGenerated}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/20 px-2.5 py-1 text-xs text-emerald-200 hover:bg-emerald-500/30 transition-colors"
                    >
                      {copiedBatch ? <Check className="size-3" /> : <Copy className="size-3" />}
                      <span>{copiedBatch ? '已复制邀请码' : '复制全部邀请码'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyAllLinks}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/20 px-2.5 py-1 text-xs text-emerald-200 hover:bg-emerald-500/30 transition-colors"
                    >
                      {copiedBatchLinks ? <Check className="size-3" /> : <ExternalLink className="size-3" />}
                      <span>{copiedBatchLinks ? '已复制链接' : '复制全部推广链接'}</span>
                    </button>
                  </div>
                </div>
                <div className="max-h-32 overflow-y-auto rounded-lg bg-black/40 p-2 font-mono text-xs text-brand grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {genResult.map((c) => (
                    <div key={c.id || c.code} className="truncate select-all">
                      {c.code}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        )}
      </Card>

      {/* 模块四：搜索过滤与主列表 */}
      <Card className="p-5 space-y-4 shadow-elevation-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* 状态筛选 Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: '', label: '全部' },
              { id: 'active', label: '正常有效' },
              { id: 'exhausted', label: '已用尽' },
              { id: 'disabled', label: '已停用' },
              { id: 'expired', label: '已过期' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleStatusChange(tab.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === tab.id
                    ? 'bg-brand/20 text-brand border border-brand/30 font-semibold'
                    : 'bg-white/[0.04] text-gray-400 hover:text-white border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 搜索框 */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="搜索邀请码或渠道备注..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-56 sm:w-64 rounded-xl border border-white/[0.10] bg-surface pl-8 pr-3 py-1.5 text-xs text-white focus:border-brand focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg border border-white/[0.10] bg-white/[0.05] px-3 py-1.5 text-xs text-gray-200 hover:bg-white/[0.10] transition-colors"
            >
              查询
            </button>
          </form>
        </div>

        {(listError || actionFeedback) && (
          <p
            role={listError || actionFeedback?.tone === 'danger' ? 'alert' : 'status'}
            className={`rounded-lg border px-3 py-2 text-caption ${
              listError || actionFeedback?.tone === 'danger'
                ? 'border-danger-line bg-danger-soft text-danger'
                : 'border-success-line bg-success-soft text-success'
            }`}
          >
            {listError || actionFeedback?.text}
          </p>
        )}

        {/* 邀请码与习惯主表格 */}
        <DataTable columns={columns} rows={listData.codes} emptyText="未查找到匹配的邀请码记录" />

        {/* 简易分页 */}
        {listData.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-white/[0.08] pt-3 text-xs text-gray-400">
            <span>
              共 {listData.total} 条记录 · 第 {listData.page} / {listData.totalPages} 页
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={listData.page <= 1}
                onClick={() => fetchCodes({ page: listData.page - 1 })}
                className="rounded-md border border-white/[0.10] bg-white/[0.04] px-2.5 py-1 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/[0.08]"
              >
                上一页
              </button>
              <button
                type="button"
                disabled={listData.page >= listData.totalPages}
                onClick={() => fetchCodes({ page: listData.page + 1 })}
                className="rounded-md border border-white/[0.10] bg-white/[0.04] px-2.5 py-1 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/[0.08]"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* 模块五：用户习惯画像穿透弹窗 */}
      {selectedHabitsCode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedHabitsCode(null);
          }}
        >
          <div className="relative w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl border border-white/[0.10] bg-surface p-6 shadow-elevation-4 overflow-hidden">
            {/* 弹窗头部 */}
            <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-bold text-brand">
                    {selectedHabitsCode.code}
                  </span>
                  <StatusBadge tone="info">渠道用户习惯画像</StatusBadge>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  渠道备注: {selectedHabitsCode.notes || '未填写'} · 已兑换人次: {selectedHabitsCode.used_count} / {selectedHabitsCode.max_uses}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHabitsCode(null)}
                className="size-8 rounded-lg border border-white/[0.10] bg-white/[0.04] flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* 用户列表主内容区 */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {habitsLoading ? (
                <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
                  <Loader2 className="size-5 animate-spin text-brand" />
                  <span className="text-xs">加载用户使用习惯分析中...</span>
                </div>
              ) : habitsError ? (
                <div className="rounded-xl border border-danger-line bg-danger-soft px-4 py-6 text-center text-caption text-danger">
                  {habitsError}
                </div>
              ) : habitsUsers.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-xs">
                  暂无用户兑换该邀请码
                </div>
              ) : (
                <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-black/30 overflow-hidden">
                  <div className="grid grid-cols-12 bg-white/[0.02] px-4 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    <span className="col-span-4">用户账号</span>
                    <span className="col-span-2">注册与活跃</span>
                    <span className="col-span-2">当前积分</span>
                    <span className="col-span-2">AI 创作习惯</span>
                    <span className="col-span-2 text-right">付费与订阅</span>
                  </div>
                  {habitsUsers.map((user) => {
                    const isRecentActive = user.last_login_at && new Date(user.last_login_at).getTime() > Date.now() - 7 * 86400 * 1000;
                    return (
                      <div
                        key={user.redemption_id || user.user_id}
                        className="grid grid-cols-12 items-center px-4 py-3 text-xs text-gray-200 hover:bg-white/[0.02] transition-colors"
                      >
                        {/* 账号 */}
                        <div className="col-span-4 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white truncate max-w-[180px]" title={user.email}>
                              {user.email || user.display_name}
                            </span>
                            <a
                              href={`/admin/users/${user.user_id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-brand hover:text-brand-hover"
                              title="在新标签页查看用户详情"
                            >
                              <ArrowUpRight className="size-3.5" />
                            </a>
                          </div>
                          <p className="text-[11px] text-gray-500 font-mono truncate">
                            UID: {user.user_id}
                          </p>
                        </div>

                        {/* 注册与活跃 */}
                        <div className="col-span-2 text-[11px] font-mono space-y-0.5">
                          <p className="text-gray-400">{formatDate(user.redeemed_at)}</p>
                          <span
                            className={`inline-block rounded px-1.5 py-0.2 text-[10px] ${
                              isRecentActive
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'text-gray-500'
                            }`}
                          >
                            {isRecentActive ? '7日活跃' : '待活跃'}
                          </span>
                        </div>

                        {/* 积分 */}
                        <div className="col-span-2 font-mono text-brand font-semibold">
                          {user.credits ?? 0} pts
                        </div>

                        {/* 创作习惯 */}
                        <div className="col-span-2 space-y-0.5">
                          <p className="font-semibold text-white">
                            {user.creation_count ?? 0} 次任务
                          </p>
                          {user.favorite_model && (
                            <p className="text-[11px] text-pink-300 truncate font-mono" title={user.favorite_model}>
                              {user.favorite_model}
                            </p>
                          )}
                        </div>

                        {/* 付费与订阅 */}
                        <div className="col-span-2 text-right space-y-0.5">
                          <p className="font-mono font-bold text-emerald-400">
                            ¥ {Number(user.paid_amount_cny || 0).toFixed(2)}
                          </p>
                          {user.active_subscription_plan && (
                            <span className="inline-block rounded-full bg-brand/20 px-2 py-0.5 text-[10px] text-brand font-semibold uppercase">
                              {user.active_subscription_plan}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 弹窗底部 */}
            <div className="flex justify-between items-center border-t border-white/[0.08] pt-3 text-xs text-gray-400">
              <span>共计 {habitsUsers.length} 位注册用户</span>
              <button
                type="button"
                onClick={() => setSelectedHabitsCode(null)}
                className="rounded-lg border border-white/[0.10] bg-white/[0.05] px-4 py-1.5 text-xs text-white hover:bg-white/[0.10] transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  UserCheck,
  UserX,
  Search,
  KeyRound,
  Check,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Edit3,
  ExternalLink,
} from 'lucide-react';
import { Card, StatusBadge, CopyableId, Button } from '@/components/admin/AdminUi';
import { roleLabel } from '@/lib/admin/permissions';

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

export default function AdminsManagerClient({ initialAdmins = [] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [admins, setAdmins] = useState(initialAdmins);
  const [targetUserId, setTargetUserId] = useState('');
  const [targetUserDisplay, setTargetUserDisplay] = useState('');
  const [role, setRole] = useState('operations_admin');
  const [adminPassword, setAdminPassword] = useState('');

  // 搜索现有用户以快速授权为管理员
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);

  // 提交状态
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [statusTogglingId, setStatusTogglingId] = useState(null);

  // 防抖检索用户
  useEffect(() => {
    const query = userSearchQuery.trim();
    if (!query) {
      setUserSearchResults([]);
      setSearchDropdownOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}&limit=8`);
        const json = await res.json();
        if (res.ok && json.data) {
          setUserSearchResults(json.data);
          setSearchDropdownOpen(true);
        }
      } catch (err) {
        console.error('搜索用户失败:', err);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [userSearchQuery]);

  // 选择搜索出来的用户
  const handleSelectUser = (user) => {
    setTargetUserId(user.id);
    const display = user.display_name || user.email || (user.phone ? `用户${user.phone.slice(-4)}` : user.id);
    setTargetUserDisplay(`${display} (${user.id})`);
    setRole(user.role !== 'user' ? user.role : 'operations_admin');
    setUserSearchQuery('');
    setSearchDropdownOpen(false);
    setFeedback({ type: '', text: '' });
  };

  // 点击现有管理员卡片快捷预填
  const handleQuickEditAdmin = (admin) => {
    setTargetUserId(admin.id);
    setTargetUserDisplay(`${admin.email || admin.display_name} (${admin.id})`);
    setRole(admin.role);
    setFeedback({
      type: 'info',
      text: `已选中管理员【${admin.email}】，请在右侧选择新角色并输入您的密码确认。`,
    });
    // 平滑滚动至右侧表单
    const formEl = document.getElementById('admin-role-form');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  // 快捷切换管理员账号状态 (封禁/启用)
  const handleToggleStatus = async (admin) => {
    const nextStatus = admin.status === 'suspended' ? 'active' : 'suspended';
    const actionLabel = nextStatus === 'active' ? '启用恢复' : '停用封禁';

    if (!window.confirm(`确定要${actionLabel}管理员【${admin.email}】的后台权限？`)) {
      return;
    }

    setStatusTogglingId(admin.id);
    setFeedback({ type: '', text: '' });

    try {
      const res = await fetch(`/api/admin/users/${admin.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || json?.error || '状态切换失败');
      }

      setAdmins((prev) =>
        prev.map((item) => (item.id === admin.id ? { ...item, status: nextStatus } : item))
      );
      setFeedback({
        type: 'success',
        text: `管理员【${admin.email}】已成功${actionLabel}。`,
      });
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setStatusTogglingId(null);
    }
  };

  // 提交角色变更
  const handleSubmitRoleChange = async (e) => {
    e.preventDefault();
    const cleanId = targetUserId.trim();
    if (!cleanId) {
      setFeedback({ type: 'error', text: '请先指定目标用户 ID 或从搜索列表中选择' });
      return;
    }
    if (!adminPassword) {
      setFeedback({ type: 'error', text: '请输入当前登录超级管理员密码以完成二次认证' });
      return;
    }

    if (
      !window.confirm(
        `高风险权限变更提醒：即将把用户【${cleanId}】的角色设置为【${roleLabel(role)}】。此操作将写入安全审计流水并强制该用户下线。是否确认继续？`
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    setFeedback({ type: '', text: '' });

    try {
      const res = await fetch(`/api/admin/admins/${cleanId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          role,
          adminPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.error || '角色更新失败');
      }

      setFeedback({
        type: 'success',
        text: '管理员角色已成功更新生效，已强制刷新该用户会话凭据。',
      });
      setAdminPassword('');

      // 若是更新已有管理员，本地即时更新
      setAdmins((prev) => {
        if (role === 'user') {
          // 降级为普通用户，从管理员列表中移出
          return prev.filter((a) => a.id !== cleanId);
        }
        const exists = prev.some((a) => a.id === cleanId);
        if (exists) {
          return prev.map((a) => (a.id === cleanId ? { ...a, role } : a));
        }
        return prev;
      });

      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1.1fr]">
      {/* 左侧：管理员团队成员列表 */}
      <Card>
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-[#f3f4f6]">当前后台管理员名单</h2>
            <p className="mt-0.5 text-xs text-gray-400">已授权持有后台 RBAC 权限的在编人员</p>
          </div>
          <StatusBadge tone="info">{admins.length} 位团队成员</StatusBadge>
        </div>

        <div className="space-y-3">
          {admins.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">暂无管理员记录</div>
          ) : (
            admins.map((admin) => (
              <div
                key={admin.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-black/20 p-4 transition-all duration-150 hover:border-white/[0.16] hover:bg-white/[0.02]"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[#f3f4f6]">
                      {admin.email || admin.display_name || admin.id}
                    </p>
                    {admin.display_name && admin.email && (
                      <span className="text-xs text-white/40">({admin.display_name})</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <CopyableId id={admin.id} />
                    <span className="text-white/20">·</span>
                    <span className="text-xs text-gray-400">创建于 {formatDate(admin.created_at)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={admin.role === 'super_admin' ? 'info' : 'neutral'}>
                      {roleLabel(admin.role)}
                    </StatusBadge>
                    <StatusBadge tone={admin.status === 'suspended' ? 'danger' : 'good'}>
                      {admin.status === 'suspended' ? '已停用' : '活跃'}
                    </StatusBadge>
                  </div>

                    {/* 快捷操作区 */}
                  <div className="flex items-center gap-1.5 border-l border-white/[0.08] pl-3">
                    <button
                      type="button"
                      onClick={() => handleQuickEditAdmin(admin)}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand/10 hover:text-brand-hover"
                      title="点击预填角色修改"
                    >
                      <Edit3 className="size-3" />
                      <span>调权</span>
                    </button>

                    <button
                      type="button"
                      disabled={statusTogglingId === admin.id}
                      onClick={() => handleToggleStatus(admin)}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                        admin.status === 'suspended'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                          : 'border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                      }`}
                      title={admin.status === 'suspended' ? '恢复管理员权限' : '暂停管理员权限'}
                    >
                      {statusTogglingId === admin.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : admin.status === 'suspended' ? (
                        <UserCheck className="size-3" />
                      ) : (
                        <UserX className="size-3" />
                      )}
                      <span>{admin.status === 'suspended' ? '启用' : '停用'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* 右侧：权限与角色分配面板 */}
      <Card id="admin-role-form">
        <div className="border-b border-white/[0.08] pb-3 mb-4">
          <h2 className="text-sm font-semibold text-[#f3f4f6]">分配与变更管理员角色</h2>
          <p className="mt-0.5 text-xs text-gray-400">
            支持从现有用户快速检索并授权；若选择“普通用户”，将即时解除该用户的后台管理权限。
          </p>
        </div>

        {/* 反馈提示 */}
        {feedback.text && (
          <div
            className={`mb-4 rounded-xl border p-3 text-xs leading-5 ${
              feedback.type === 'error'
                ? 'border-red-500/30 bg-red-500/10 text-red-300'
                : feedback.type === 'info'
                ? 'border-brand/30 bg-brand/10 text-brand'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* 1. 用户检索与快捷选择 */}
        <div className="mb-4 relative">
          <label className="block text-xs font-medium text-gray-400 mb-1.5">
            🔍 从用户库快速检索（支持手机号 / 邮箱 / 昵称 / ID）
          </label>
          <div className="relative">
            <input
              type="text"
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              placeholder="输入关键词搜索现有注册用户…"
              className="w-full rounded-xl border border-white/10 bg-black/40 pl-9 pr-4 py-2.5 text-xs text-white outline-none focus:border-brand"
            />
            <Search className="absolute left-3 top-3 size-3.5 text-white/40" />
            {isSearchingUsers && (
              <Loader2 className="absolute right-3 top-3 size-3.5 animate-spin text-brand" />
            )}
          </div>

          {/* 搜索结果浮层下拉 */}
          {searchDropdownOpen && userSearchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-white/15 bg-[#121214] p-1.5 shadow-2xl shadow-black/80">
              {userSearchResults.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleSelectUser(u)}
                  className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition hover:bg-white/[0.08]"
                >
                  <div>
                    <p className="font-semibold text-white">
                      {u.display_name || u.email || (u.phone ? `用户${u.phone.slice(-4)}` : u.id)}
                    </p>
                    <p className="text-[11px] text-white/45">
                      {u.email || u.phone || u.id} · 当前角色: {roleLabel(u.role)}
                    </p>
                  </div>
                  <span className="rounded bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">
                    选择此人
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 2. 角色更新表单 */}
        <form onSubmit={handleSubmitRoleChange} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-400">
                目标用户 ID (usr_xxx) <span className="text-red-400">*</span>
              </label>
              {targetUserDisplay && (
                <span className="text-[11px] text-brand truncate max-w-[200px]">
                  已选: {targetUserDisplay}
                </span>
              )}
            </div>
            <input
              type="text"
              required
              value={targetUserId}
              onChange={(e) => {
                setTargetUserId(e.target.value);
                setTargetUserDisplay('');
              }}
              placeholder="usr_..."
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs text-white font-mono outline-none focus:border-brand"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              分配管理角色 <span className="text-red-400">*</span>
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-3.5 py-2.5 text-xs text-white outline-none focus:border-brand"
            >
              <option value="operations_admin">运营管理员 (内容、生成、用户管理)</option>
              <option value="finance_admin">财务管理员 (订阅、订单、调额、套餐)</option>
              <option value="support_admin">支持管理员 (用户排查、工单、受限调额)</option>
              <option value="auditor">审计员 (全站只读访问、安全日志核查)</option>
              <option value="super_admin">超级管理员 (最高全权控制)</option>
              <option value="user">降级为普通用户 (即时剥离后台所有权限)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              您的超级管理员登录密码（安全二次校验） <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="验证当前操作人的超管密码"
                className="w-full rounded-xl border border-white/10 bg-black/40 pl-9 pr-3.5 py-2.5 text-xs text-white outline-none focus:border-brand"
              />
              <KeyRound className="absolute left-3 top-3 size-3.5 text-white/40" />
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={isSubmitting || !targetUserId}
            loading={isSubmitting}
            className="w-full mt-2 font-bold text-xs"
          >
            {isSubmitting ? '正在执行角色变更与审计…' : '确认变更角色并强制其会话下线'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

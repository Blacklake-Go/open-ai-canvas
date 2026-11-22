'use client';

import React, { useState } from 'react';
import { ShieldAlert, RefreshCw, LogOut, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * 注销 3 天后悔保护期弹窗
 * 当检测到已登录用户的状态为 `deletion_pending` 时主动弹出
 * 给予用户【撤销注销恢复使用】或【保持注销退出登录】的明确选择
 */
export default function DeletionGracePeriodModal({
  user,
  onCancelled,
  onLogout,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!user || !user.isDeletionPending) return null;

  const remainingHours = Number(user.deletionRemainingHours ?? 72);
  const remainingDays = Math.max(1, Math.ceil(remainingHours / 24));

  const handleCancelDeletion = async () => {
    if (busy) return;
    setBusy(true);
    setError('');

    try {
      const res = await fetch('/api/user/cancel-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || '撤销注销失败，请稍后重试');
      }

      setSuccess(true);
      setTimeout(() => {
        onCancelled?.();
      }, 1200);
    } catch (err) {
      setError(err?.message || '网络连接异常');
    } finally {
      setBusy(false);
    }
  };

  const handleKeepDeletionAndLogout = async () => {
    if (onLogout) {
      onLogout();
      return;
    }
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    window.location.href = '/';
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-scrim backdrop-blur-xl transition-opacity duration-base ease-enter animate-fade-in">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-line bg-overlay shadow-elevation-4 p-6 text-white sm:p-8 animate-scale-in">
        {/* 背景光效 */}
        <div className="pointer-events-none absolute -top-24 -left-24 size-60 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 size-60 rounded-full bg-danger/10 blur-3xl" />

        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 shadow-inner">
            <ShieldAlert className="size-7 text-amber-400" />
          </div>

          <h3 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            账户处于注销保护期中
          </h3>

          <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-amber-200/90 text-left">
            <p className="font-semibold text-amber-300">
              ⏳ 距离所有数据永久物理清除还剩约 {remainingDays} 天 ({remainingHours} 小时)
            </p>
            <p className="mt-1 text-ink-muted">
              根据创作者权益保障规范，系统为您保留 3 天后悔期限。期间您的作品、积分及资产完整保留；到期未撤销将自动彻底清除，此后可重新注册。
            </p>
          </div>

          {error && (
            <div className="mt-3 w-full rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger text-left">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-3 flex w-full items-center gap-2 rounded-xl border border-good/30 bg-good/10 p-3 text-xs text-good text-left">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>注销申请已撤销！欢迎回来，正在恢复使用...</span>
            </div>
          )}

          <div className="mt-6 flex w-full flex-col gap-2.5">
            <Button
              type="button"
              onClick={handleCancelDeletion}
              disabled={busy || success}
              className="w-full h-11 bg-brand text-ink-on-accent font-semibold hover:bg-brand-hover active:bg-brand-active active:scale-[0.98] active:duration-instant transition-[background-color,transform] duration-fast ease-standard shadow-elevation-2 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
            >
              {busy ? (
                <>
                  <RefreshCw className="mr-2 size-4 animate-spin" />
                  正在恢复账户...
                </>
              ) : (
                '撤销注销，继续使用'
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleKeepDeletionAndLogout}
              disabled={busy}
              className="w-full h-10 border-line bg-surface text-ink-muted hover:text-ink hover:bg-wash active:scale-[0.98] active:duration-instant transition-[background-color,color,transform] duration-fast ease-standard cursor-pointer text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
            >
              <LogOut className="mr-1.5 size-3.5" />
              保持注销，退出登录
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

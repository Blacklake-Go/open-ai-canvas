'use client';

import { useEffect } from 'react';
import { X, Mail, Clock, Shield, AlertCircle, CheckCircle2, User, Globe, FileText } from 'lucide-react';
import { StatusBadge } from '@/components/admin/AdminUi';

export default function EmailLogDrawer({ isOpen, onClose, log }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !log) return null;

  const isSuccess = log.status === 'success';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-line-subtle bg-surface-raised shadow-elevation-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line-subtle px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg border border-line-subtle bg-white/[0.04]">
              <Mail className="size-4 text-brand" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">发信流水审计明细</h3>
              <p className="font-mono text-[11px] text-ink-subtle">{log.id}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg border border-line-subtle text-ink-muted hover:bg-white/[0.06] hover:text-ink cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* Status Banner */}
          <div className={`rounded-xl border p-4 ${
            isSuccess
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-red-500/30 bg-red-500/10 text-red-400'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                {isSuccess ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
                <span>{isSuccess ? '投递成功 (Accepted)' : '投递失败 (Failed)'}</span>
              </div>
              <span className="font-mono text-xs">{log.latency_ms != null ? `${log.latency_ms} ms` : '—'}</span>
            </div>
            {log.error_code && (
              <p className="mt-2 font-mono text-[11px] text-red-300">
                错误代码：{log.error_code}
              </p>
            )}
          </div>

          {/* Properties Grid */}
          <div className="rounded-xl border border-line-subtle bg-canvas/40 divide-y divide-line-subtle">
            <div className="flex items-center justify-between p-3.5">
              <span className="text-ink-muted">业务用途</span>
              <span className="font-semibold text-ink uppercase tracking-wide">
                {log.purpose === 'verification' ? '验证码通道' : log.purpose === 'test' ? '连通性测试' : log.purpose === 'marketing' ? '营销触达' : '系统通知'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3.5">
              <span className="text-ink-muted">发信线路</span>
              <span className="font-mono font-medium text-ink">{log.provider || 'email_smtp'}</span>
            </div>
            <div className="flex items-center justify-between p-3.5">
              <span className="text-ink-muted">收件人</span>
              <span className="font-mono font-medium text-ink">{log.recipient}</span>
            </div>
            <div className="flex items-center justify-between p-3.5">
              <span className="text-ink-muted">收件方域名</span>
              <span className="font-mono text-ink-muted">{log.recipient_domain || '—'}</span>
            </div>
            <div className="flex items-center justify-between p-3.5">
              <span className="text-ink-muted">投递时间</span>
              <span className="font-mono text-ink-muted">
                {log.created_at ? new Date(log.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '—'}
              </span>
            </div>
            {log.user_id && (
              <div className="flex items-center justify-between p-3.5">
                <span className="text-ink-muted">关联用户 ID</span>
                <span className="font-mono text-ink-muted">{log.user_id}</span>
              </div>
            )}
            {log.actor_id && (
              <div className="flex items-center justify-between p-3.5">
                <span className="text-ink-muted">操作管理员 ID</span>
                <span className="font-mono text-ink-muted">{log.actor_id}</span>
              </div>
            )}
          </div>

          {/* Subject */}
          <div className="rounded-xl border border-line-subtle bg-canvas/40 p-4">
            <span className="text-ink-muted font-medium">邮件主题</span>
            <p className="mt-1.5 font-semibold text-ink text-sm">
              {log.subject || '（无主题）'}
            </p>
          </div>

          {/* Redacted Body Preview */}
          <div className="rounded-xl border border-line-subtle bg-canvas/40 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-ink-muted font-medium flex items-center gap-1.5">
                <Shield className="size-3.5 text-brand" />
                <span>脱敏正文预览 (Redacted Preview)</span>
              </span>
              <span className="text-[10px] text-ink-subtle">
                敏感凭证/验证码已过滤
              </span>
            </div>
            <div className="rounded-lg border border-line-subtle/60 bg-black/40 p-3 font-mono text-[11px] text-ink-muted whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
              {log.body_preview || '（无正文预览）'}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-line-subtle px-6 py-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-lg border border-line-subtle bg-white/[0.04] px-4 text-xs font-medium text-ink hover:bg-white/[0.08] cursor-pointer"
          >
            关闭详情
          </button>
        </div>
      </div>
    </div>
  );
}

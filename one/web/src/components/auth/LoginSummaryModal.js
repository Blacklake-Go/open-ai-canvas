'use client';

import { useState } from 'react';
import { BarChart3, CheckCircle2, X } from 'lucide-react';
import ActivityTab from '@/components/account/tabs/ActivityTab';
import UsageTab from '@/components/account/tabs/UsageTab';

const PANELS = [
  { id: 'activity', label: '创作活跃度' },
  { id: 'usage', label: '当前使用量明细' },
];

export default function LoginSummaryModal({ user, onComplete, onClose }) {
  const [activePanel, setActivePanel] = useState('activity');

  const finish = () => {
    onComplete?.();
  };

  return (
    <div
      className="fixed inset-0 z-toast flex items-center justify-center bg-scrim px-4 py-5 backdrop-blur-xl transition-opacity duration-base ease-enter animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-summary-title"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-line-strong bg-overlay shadow-elevation-4 text-ink animate-scale-in">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line-subtle px-5 py-5 sm:px-7">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-400">
              <CheckCircle2 className="size-4" />
              <span>登录成功</span>
            </div>
            <h2 id="login-summary-title" className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
              你的创作账户概览
            </h2>
            <p className="mt-1 text-xs text-ink-muted">登录后数据直接来自账户接口，未同步的数据会明确显示为空状态。</p>
          </div>
          <button
            type="button"
            onClick={onClose || finish}
            aria-label="关闭账户概览"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition-[background-color,color,transform] duration-fast ease-standard hover:bg-wash hover:text-ink active:scale-95 active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-line-subtle px-5 py-3 sm:px-7">
          {PANELS.map((panel) => (
            <button
              key={panel.id}
              type="button"
              onClick={() => setActivePanel(panel.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition-[background-color,color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring ${activePanel === panel.id ? 'bg-brand-soft text-brand border border-brand-line shadow-elevation-1' : 'text-ink-muted hover:bg-wash hover:text-ink border border-transparent'}`}
            >
              {panel.id === 'activity' ? <BarChart3 className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
              {panel.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {activePanel === 'activity' ? <ActivityTab user={user} /> : <UsageTab />}
        </div>

        <div className="flex shrink-0 justify-end border-t border-line-subtle px-5 py-4 sm:px-7">
          <button
            type="button"
            onClick={finish}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-ink-on-accent transition-[background-color,transform] duration-fast ease-standard hover:bg-brand-hover active:bg-brand-active active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
          >
            进入创作
          </button>
        </div>
      </div>
    </div>
  );
}

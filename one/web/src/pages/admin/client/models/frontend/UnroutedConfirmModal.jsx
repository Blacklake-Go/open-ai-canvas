'use client';

import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/admin/AdminUi';

export default function UnroutedConfirmModal({ model, onCancel, onSmartMatch }) {
  if (!model) return null;
  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/70 p-4" role="presentation">
      <section role="dialog" aria-modal="true" aria-label="模型渠道待审核"
        className="w-full max-w-md rounded-2xl border border-line-strong bg-overlay p-6 shadow-elevation-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-warning"><AlertTriangle className="size-5" /><h2 className="text-card-title font-semibold text-ink">渠道待审核</h2></div>
          <button type="button" onClick={onCancel} aria-label="关闭" className="rounded-lg p-1 text-ink-muted hover:text-ink"><X className="size-4" /></button>
        </div>
        <p className="mt-4 text-body-sm text-ink-muted">
          {model.display_name || model.name}（{model.id}）没有已审核渠道。请核实准确的上游模型、端点、输入输出能力及价格，再提交映射审核。
        </p>
        <p className="mt-2 text-caption text-ink-subtle">展示开关不会让此模型变成可下单模型。</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-line-subtle pt-4">
          <Button variant="secondary" size="sm" onClick={onCancel}>关闭</Button>
          <Button variant="secondary" size="sm" onClick={() => onSmartMatch?.(model)}>查看候选</Button>
          <a href="/admin/models/routing" className="inline-flex items-center rounded-lg bg-brand px-3 text-label font-medium text-ink-on-accent">前往映射审核</a>
        </div>
      </section>
    </div>
  );
}

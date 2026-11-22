'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useHasPermission } from './AdminPermissions';

export default function AdminActionForm({
  action,
  method = 'POST',
  fields = [],
  label,
  submitLabel,
  tone = 'secondary',
  confirmMessage,
  confirmText,
  requiredPermission,
  onSuccess,
}) {
  const router = useRouter();
  const canExecute = useHasPermission(requiredPermission);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const effectiveLabel = submitLabel || label || '提交';
  const effectiveConfirm = confirmText || confirmMessage || '确认执行此管理操作？操作会写入审计日志。';

  if (!canExecute) return null;

  async function submit(event) {
    event.preventDefault();
    if (effectiveConfirm && !window.confirm(effectiveConfirm)) return;

    setBusy(true);
    setMessage('');
    setIsError(false);

    const form = new FormData(event.currentTarget);
    const body = {};

    for (const [key, value] of form.entries()) {
      // 数值字段尝试类型转换
      const fieldDef = fields.find((f) => f.name === key);
      if (fieldDef && fieldDef.type === 'number') {
        const num = Number(value);
        body[key] = Number.isNaN(num) ? value : num;
      } else {
        body[key] = value;
      }
    }

    try {
      const response = await fetch(action, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message || data?.error || '操作失败');
      }

      setMessage('操作成功已生效');
      if (onSuccess) {
        onSuccess(data);
      }
      setTimeout(() => {
        router.refresh();
      }, 500);
    } catch (error) {
      setIsError(true);
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  const toneClass = {
    primary: 'bg-brand text-white hover:bg-brand-hover active:scale-[0.98]',
    good: 'border border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 active:scale-[0.98]',
    attention: 'border border-amber-400/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 active:scale-[0.98]',
    danger: 'border border-red-400/40 bg-red-400/15 text-red-200 hover:bg-red-400/25 active:scale-[0.98]',
    secondary: 'border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 active:scale-[0.98]',
  }[tone] || 'border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 active:scale-[0.98]';

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        {fields.map((field) => {
          if (field.type === 'hidden') {
            return (
              <input
                key={field.name}
                type="hidden"
                name={field.name}
                defaultValue={field.defaultValue || ''}
              />
            );
          }

          if (field.type === 'select') {
            return (
              <div key={field.name} className="min-w-[160px] flex-1">
                {field.label && (
                  <label className="block text-[11px] font-medium text-white/50 mb-1">
                    {field.label}
                  </label>
                )}
                <select
                  required={field.required !== false}
                  name={field.name}
                  defaultValue={field.defaultValue || ''}
                  className="w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-3.5 py-2 text-xs text-white outline-none focus:border-brand/50"
                >
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            );
          }

          if (field.type === 'textarea') {
            return (
              <div key={field.name} className="w-full">
                {field.label && (
                  <label className="block text-[11px] font-medium text-white/50 mb-1">
                    {field.label}
                  </label>
                )}
                <textarea
                  required={field.required !== false}
                  name={field.name}
                  rows={field.rows || 3}
                  defaultValue={field.defaultValue || ''}
                  placeholder={field.placeholder}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-xs text-white outline-none focus:border-brand/50"
                />
              </div>
            );
          }

          return (
            <div key={field.name} className="min-w-[140px] flex-1">
              {field.label && (
                <label className="block text-[11px] font-medium text-white/50 mb-1">
                  {field.label}
                </label>
              )}
              <input
                required={field.required !== false}
                name={field.name}
                type={field.type || 'text'}
                defaultValue={field.defaultValue || ''}
                placeholder={field.placeholder}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-xs text-white outline-none focus:border-brand/50"
              />
            </div>
          );
        })}

        <button
          disabled={busy}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all duration-150 ${toneClass} disabled:opacity-50`}
        >
          {busy ? '处理中…' : effectiveLabel}
        </button>
      </div>

      {message && (
        <p className={`text-xs ${isError ? 'text-red-400' : 'text-emerald-400'}`}>
          {message}
        </p>
      )}
    </form>
  );
}

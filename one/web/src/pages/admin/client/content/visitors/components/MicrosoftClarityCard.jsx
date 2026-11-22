'use client';

import { Card, StatusBadge } from '@/components/admin/AdminUi';
import { Sparkles, ExternalLink, HelpCircle, AlertCircle } from 'lucide-react';

const CLARITY_PROJECT_ID_REGEX = /^[0-9a-zA-Z]{8,16}$/;

export default function MicrosoftClarityCard({ value, onChange, disabled }) {
  const clarity = value || { enabled: false, projectId: '' };
  const id = clarity.projectId?.trim() || '';
  const hasError = clarity.enabled && Boolean(id) && !CLARITY_PROJECT_ID_REGEX.test(id);

  const handleToggle = (nextEnabled) => {
    onChange({ ...clarity, enabled: nextEnabled });
  };

  const handleIdChange = (e) => {
    onChange({ ...clarity, projectId: e.target.value.trim() });
  };

  return (
    <Card className="flex flex-col justify-between p-6">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-purple-400">
              <Sparkles className="size-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">微软 Clarity</h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusBadge tone={clarity.enabled ? 'good' : 'neutral'}>
              {clarity.enabled ? '已启用' : '未启用'}
            </StatusBadge>
            <button
              type="button"
              role="switch"
              aria-checked={clarity.enabled}
              aria-label="启用微软 Clarity"
              disabled={disabled}
              onClick={() => handleToggle(!clarity.enabled)}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-40 ${
                clarity.enabled ? 'border-brand bg-brand' : 'border-white/[0.12] bg-white/[0.08]'
              }`}
            >
              <span
                aria-hidden="true"
                className={`size-3.5 rounded-full bg-white transition-transform duration-200 shadow-sm ${
                  clarity.enabled ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/30 p-3.5 space-y-2">
          <label htmlFor="clarity-id-input" className="block text-xs font-medium text-gray-300">
            Project ID (项目标识)
          </label>
          <input
            id="clarity-id-input"
            type="text"
            disabled={disabled}
            value={clarity.projectId || ''}
            onChange={handleIdChange}
            placeholder="例如：cl89abcd12"
            className={`w-full rounded-xl border px-3 py-2 text-xs text-white placeholder-white/20 outline-none transition-colors ${
              hasError
                ? 'border-red-500/60 bg-red-500/[0.04] focus:border-red-500'
                : 'border-white/10 bg-black/40 focus:border-brand'
            }`}
          />
          {hasError && (
            <p className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle className="size-3.5 shrink-0" />
              <span>Microsoft Clarity 项目 ID 格式错误，必须为 8-16 位字母数字组合</span>
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-white/[0.08] pt-4">
        <a
          href="https://clarity.microsoft.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-brand font-semibold hover:underline transition-colors"
        >
          <span>Microsoft Clarity 控制台</span>
          <ExternalLink className="size-3" />
        </a>
      </div>
    </Card>
  );
}

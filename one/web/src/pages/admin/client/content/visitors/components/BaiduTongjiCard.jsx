'use client';

import { Card, StatusBadge } from '@/components/admin/AdminUi';
import { BarChart3, ExternalLink, HelpCircle, AlertCircle } from 'lucide-react';

const BAIDU_SITE_ID_REGEX = /^[0-9a-fA-F]{32}$/;

export default function BaiduTongjiCard({ value, onChange, disabled }) {
  const baidu = value || { enabled: false, siteId: '' };
  const id = baidu.siteId?.trim() || '';
  const hasError = baidu.enabled && Boolean(id) && !BAIDU_SITE_ID_REGEX.test(id);

  const handleToggle = (nextEnabled) => {
    onChange({ ...baidu, enabled: nextEnabled });
  };

  const handleIdChange = (e) => {
    onChange({ ...baidu, siteId: e.target.value.trim() });
  };

  return (
    <Card className="flex flex-col justify-between p-6">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-blue-400">
              <BarChart3 className="size-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">百度统计</h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusBadge tone={baidu.enabled ? 'good' : 'neutral'}>
              {baidu.enabled ? '已启用' : '未启用'}
            </StatusBadge>
            <button
              type="button"
              role="switch"
              aria-checked={baidu.enabled}
              aria-label="启用百度统计"
              disabled={disabled}
              onClick={() => handleToggle(!baidu.enabled)}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-40 ${
                baidu.enabled ? 'border-brand bg-brand' : 'border-white/[0.12] bg-white/[0.08]'
              }`}
            >
              <span
                aria-hidden="true"
                className={`size-3.5 rounded-full bg-white transition-transform duration-200 shadow-sm ${
                  baidu.enabled ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/30 p-3.5 space-y-2">
          <label htmlFor="baidu-id-input" className="block text-xs font-medium text-gray-300">
            Site ID (站点代码哈希)
          </label>
          <input
            id="baidu-id-input"
            type="text"
            disabled={disabled}
            value={baidu.siteId || ''}
            onChange={handleIdChange}
            placeholder="例如：e0c656d0124d262a4b86895b6c318ab4"
            className={`w-full rounded-xl border px-3 py-2 text-xs text-white placeholder-white/20 outline-none transition-colors ${
              hasError
                ? 'border-red-500/60 bg-red-500/[0.04] focus:border-red-500'
                : 'border-white/10 bg-black/40 focus:border-brand'
            }`}
          />
          {hasError && (
            <p className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle className="size-3.5 shrink-0" />
              <span>百度统计站点 ID 格式错误，必须为 32 位十六进制哈希</span>
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-white/[0.08] pt-4">
        <a
          href="https://tongji.baidu.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-brand font-semibold hover:underline transition-colors"
        >
          <span>百度统计控制台</span>
          <ExternalLink className="size-3" />
        </a>
      </div>
    </Card>
  );
}

'use client';

import { useState } from 'react';
import { ShieldCheck, Save, CheckCircle2, ExternalLink } from 'lucide-react';
import { Card, StatusBadge } from '@/components/admin/AdminUi';
import { PermissionGate } from '@/components/admin/AdminPermissions';
import { PERMISSIONS } from '@/lib/admin/permissions';
import { normalizeVerificationTag } from '@/lib/services/seoCore';

const VERIFICATION_PLATFORMS = [
  {
    id: 'google',
    name: 'Google Search Console',
    metaTag: 'google-site-verification',
    placeholder: '粘贴 Token 或 <meta> 标签',
    consoleUrl: 'https://search.google.com/search-console',
  },
  {
    id: 'baidu',
    name: '百度搜索资源平台',
    metaTag: 'baidu-site-verification',
    placeholder: '粘贴 Token 或 <meta> 标签',
    consoleUrl: 'https://ziyuan.baidu.com/site',
  },
  {
    id: 'bing',
    name: '必应 Bing Webmaster Tools',
    metaTag: 'msvalidate.01',
    placeholder: '粘贴 Token 或 <meta> 标签',
    consoleUrl: 'https://www.bing.com/webmasters',
  },
  {
    id: 'yandex',
    name: 'Yandex Webmaster',
    metaTag: 'yandex-verification',
    placeholder: '粘贴 Token 或 <meta> 标签',
    consoleUrl: 'https://webmaster.yandex.com',
  },
];

export default function SearchVerificationCard({ config, onSave, isSaving }) {
  const [tokens, setTokens] = useState({
    google: config?.verification?.google || '',
    baidu: config?.verification?.baidu || '',
    bing: config?.verification?.bing || '',
    yandex: config?.verification?.yandex || '',
  });

  const [extractedHints, setExtractedHints] = useState({});
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleInputChange = (id, rawValue) => {
    setSavedSuccess(false);
    const normalized = normalizeVerificationTag(rawValue);
    const wasHtmlTag = /<meta/i.test(rawValue);

    setTokens((prev) => ({ ...prev, [id]: normalized }));

    if (wasHtmlTag && normalized) {
      setExtractedHints((prev) => ({ ...prev, [id]: normalized }));
    } else {
      setExtractedHints((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (onSave) {
      await onSave({
        verification: {
          google: tokens.google,
          baidu: tokens.baidu,
          bing: tokens.bing,
          yandex: tokens.yandex,
        },
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  const configuredCount = Object.values(tokens).filter(Boolean).length;

  return (
    <Card className="flex flex-col justify-between p-6">
      <form onSubmit={handleFormSubmit} className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-brand">
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">站长平台所有权验证</h3>
            </div>
          </div>
          <StatusBadge tone={configuredCount > 0 ? 'good' : 'neutral'}>
            {configuredCount > 0 ? `已激活 ${configuredCount} 个` : '待配置'}
          </StatusBadge>
        </div>

        {/* Platform Verification Inputs */}
        <div className="space-y-3">
          {VERIFICATION_PLATFORMS.map((platform) => {
            const currentToken = tokens[platform.id] || '';
            const isConfigured = Boolean(currentToken);


            return (
              <div
                key={platform.id}
                className="rounded-xl border border-white/[0.06] bg-black/30 p-3 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-white">{platform.name}</span>
                    <span className="font-mono text-[10px] text-gray-400">({platform.metaTag})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] ${
                        isConfigured ? 'text-emerald-400 font-medium' : 'text-gray-400'
                      }`}
                    >
                      {isConfigured ? '● 已填入' : '○ 未配置'}
                    </span>
                    <a
                      href={platform.consoleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-[11px] text-brand font-semibold hover:underline"
                    >
                      <span>控制台</span>
                      <ExternalLink className="size-2.5" />
                    </a>
                  </div>
                </div>

                <input
                  type="text"
                  value={currentToken}
                  onChange={(e) => handleInputChange(platform.id, e.target.value)}
                  placeholder={platform.placeholder}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-xs text-white placeholder-white/30 outline-none focus:border-brand transition-colors"
                />

                {extractedHints[platform.id] && (
                  <p className="flex items-center gap-1 text-[11px] text-emerald-400">
                    <CheckCircle2 className="size-3 shrink-0" />
                    <span>已自动从 HTML 标签提取纯 Token: <strong>{extractedHints[platform.id]}</strong></span>
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-white/[0.08] pt-4">
          <div className="flex items-center gap-2">
            {savedSuccess && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                <CheckCircle2 className="size-3.5" />
                验证代码已持久化并注入前台 Head
              </span>
            )}
          </div>
          <PermissionGate permission={PERMISSIONS.settingsWrite}>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand hover:bg-brand-hover text-white px-5 py-2 text-xs font-semibold shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <Save className="size-3.5" />
              <span>{isSaving ? '正在保存...' : '保存验证配置'}</span>
            </button>
          </PermissionGate>
        </div>
      </form>
    </Card>
  );
}

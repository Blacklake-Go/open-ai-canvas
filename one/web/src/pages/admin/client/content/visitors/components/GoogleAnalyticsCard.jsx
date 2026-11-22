'use client';

import { useState } from 'react';
import { Card, StatusBadge } from '@/components/admin/AdminUi';
import { BarChart3, ExternalLink, HelpCircle, AlertCircle, KeyRound, ChevronDown, ChevronUp, CheckCircle2, Loader2, Sparkles } from 'lucide-react';

const GA4_REGEX = /^G-[A-Za-z0-9]+$/;

export default function GoogleAnalyticsCard({ value, onChange, disabled }) {
  const ga4 = value || {
    enabled: false,
    measurementId: '',
    propertyId: '',
    serviceAccountEmail: '',
    serviceAccountPrivateKey: '',
  };

  const [showAdvanced, setShowAdvanced] = useState(Boolean(ga4.propertyId || ga4.serviceAccountEmail));
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { ok: boolean, message: string }

  const id = ga4.measurementId?.trim() || '';
  const hasError = ga4.enabled && Boolean(id) && !GA4_REGEX.test(id);

  const handleToggle = (nextEnabled) => {
    onChange({ ...ga4, enabled: nextEnabled });
  };

  const handleFieldChange = (field, val) => {
    onChange({ ...ga4, [field]: val });
  };

  // 支持直接粘贴 Google Service Account 完整 JSON 自动解析
  const handleJsonPaste = (text) => {
    try {
      const parsed = JSON.parse(text);
      if (parsed.client_email && parsed.private_key) {
        onChange({
          ...ga4,
          serviceAccountEmail: parsed.client_email,
          serviceAccountPrivateKey: parsed.private_key,
        });
        setTestResult({
          ok: true,
          message: `已自动解析服务账号凭证: ${parsed.client_email}`,
        });
        return true;
      }
    } catch {}
    return false;
  };

  // 测试与 GA4 Data API 的连通性
  const handleTestConnection = async () => {
    if (!ga4.propertyId) {
      setTestResult({ ok: false, message: '请先填入 GA4 媒体资源 ID (Property ID)' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/visitors/analytics/ga4', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: ga4.propertyId,
          serviceAccountEmail: ga4.serviceAccountEmail,
          serviceAccountPrivateKey: ga4.serviceAccountPrivateKey,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.data?.ok) {
        setTestResult({
          ok: false,
          message: json.data?.message || json.error?.message || '连通性测试未通过，请核对凭证与 GA4 权限设置',
        });
      } else {
        setTestResult({
          ok: true,
          message: json.data.message || '连通成功！GA4 数据源已就绪。',
        });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message: err?.message || '测试网络请求失败',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="flex flex-col justify-between p-6">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-brand">
              <BarChart3 className="size-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Google Analytics 4</h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusBadge tone={ga4.enabled ? 'good' : 'neutral'}>
              {ga4.enabled ? '已启用' : '未启用'}
            </StatusBadge>
            <button
              type="button"
              role="switch"
              aria-checked={ga4.enabled}
              aria-label="启用 Google Analytics 4"
              disabled={disabled}
              onClick={() => handleToggle(!ga4.enabled)}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-40 ${
                ga4.enabled ? 'border-brand bg-brand' : 'border-white/[0.12] bg-white/[0.08]'
              }`}
            >
              <span
                aria-hidden="true"
                className={`size-3.5 rounded-full bg-white transition-transform duration-200 shadow-sm ${
                  ga4.enabled ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* 基础配置：衡量 ID 与 媒体资源 ID */}
        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="ga4-id-input" className="block text-xs font-medium text-gray-300 mb-1">
              Measurement ID (衡量 ID)
            </label>
            <input
              id="ga4-id-input"
              type="text"
              disabled={disabled}
              value={ga4.measurementId || ''}
              onChange={(e) => handleFieldChange('measurementId', e.target.value.trim())}
              placeholder="G-XXXXXXXXXX"
              className={`w-full rounded-xl border px-3 py-2 text-xs text-white placeholder-white/20 outline-none transition-colors ${
                hasError
                  ? 'border-red-500/60 bg-red-500/[0.04] focus:border-red-500'
                  : 'border-white/10 bg-black/40 focus:border-brand'
              }`}
            />
            {hasError && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-red-400">
                <AlertCircle className="size-3.5 shrink-0" />
                <span>格式错误，必须形如 G-XXXXXXXXXX</span>
              </p>
            )}
          </div>

          <div>
            <label htmlFor="ga4-prop-id-input" className="block text-xs font-medium text-gray-300 mb-1">
              Property ID (媒体资源数字 ID)
            </label>
            <input
              id="ga4-prop-id-input"
              type="text"
              disabled={disabled}
              value={ga4.propertyId || ''}
              onChange={(e) => handleFieldChange('propertyId', e.target.value.trim())}
              placeholder="例如：558360595"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder-white/20 outline-none transition-colors focus:border-brand"
            />
          </div>

          {/* 高级设置开关：Google Analytics Data API 服务账号密钥 */}
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex w-full items-center justify-between text-xs font-medium text-gray-300 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <KeyRound className="size-3.5 text-brand" />
                <span>Data API 服务账号凭据</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-gray-400">
                <span>{showAdvanced ? '收起' : '展开'}</span>
                {showAdvanced ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              </div>
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-2.5 pt-2.5 border-t border-white/[0.06]">
                <div>
                  <label className="text-[11px] font-medium text-gray-400 block mb-1">
                    Service Account Client Email
                  </label>
                  <input
                    type="text"
                    disabled={disabled}
                    value={ga4.serviceAccountEmail || ''}
                    onChange={(e) => {
                      const text = e.target.value.trim();
                      if (!handleJsonPaste(text)) {
                        handleFieldChange('serviceAccountEmail', text);
                      }
                    }}
                    placeholder="ga4-reader@project.iam.gserviceaccount.com"
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-gray-400 block mb-1">
                    Private Key (支持直接粘贴 JSON)
                  </label>
                  <textarea
                    rows={2}
                    disabled={disabled}
                    value={ga4.serviceAccountPrivateKey || ''}
                    onChange={(e) => {
                      const text = e.target.value;
                      if (!handleJsonPaste(text)) {
                        handleFieldChange('serviceAccountPrivateKey', text);
                      }
                    }}
                    placeholder="-----BEGIN PRIVATE KEY----- 或直接粘贴 JSON 密钥"
                    className="w-full rounded-lg border border-white/10 bg-black/40 p-2 font-mono text-[11px] text-white/80 placeholder-white/20 outline-none focus:border-brand resize-y"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    disabled={disabled || testing || !ga4.propertyId}
                    onClick={handleTestConnection}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand/20 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                  >
                    {testing ? (
                      <>
                        <Loader2 className="size-3 animate-spin" />
                        <span>校验中...</span>
                      </>
                    ) : (
                      <>
                        <BarChart3 className="size-3" />
                        <span>测试 API 连通性</span>
                      </>
                    )}
                  </button>

                  <a
                    href="https://console.cloud.google.com/iam-admin/serviceaccounts"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-gray-400 hover:text-brand transition-colors inline-flex items-center gap-1"
                  >
                    <span>Google Cloud 凭据</span>
                    <ExternalLink className="size-2.5" />
                  </a>
                </div>

                {testResult && (
                  <div
                    className={`rounded-lg border p-2 text-xs flex items-start gap-1.5 ${
                      testResult.ok
                        ? 'border-emerald-500/30 bg-emerald-500/[0.05] text-emerald-300'
                        : 'border-red-500/30 bg-red-500/[0.05] text-red-300'
                    }`}
                  >
                    {testResult.ok ? (
                      <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400 mt-0.5" />
                    ) : (
                      <AlertCircle className="size-3.5 shrink-0 text-red-400 mt-0.5" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-white/[0.08] pt-4">
        <a
          href="https://analytics.google.com/analytics/web/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-brand font-semibold hover:underline transition-colors"
        >
          <span>Google Analytics 控制台</span>
          <ExternalLink className="size-3" />
        </a>
      </div>
    </Card>
  );
}

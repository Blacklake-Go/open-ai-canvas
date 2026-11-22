'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Save, RefreshCw, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';
import { validateVisitorAnalyticsConfig, DEFAULT_VISITOR_ANALYTICS } from '@/lib/services/visitorAnalyticsCore';
import { useHasPermission } from '@/components/admin/AdminPermissions';
import { PERMISSIONS } from '@/lib/admin/permissions';
import Ga4MetricsDashboardCard from '../components/Ga4MetricsDashboardCard';
import GoogleAnalyticsCard from '../components/GoogleAnalyticsCard';
import BaiduTongjiCard from '../components/BaiduTongjiCard';
import MicrosoftClarityCard from '../components/MicrosoftClarityCard';
import CustomScriptCard from '../components/CustomScriptCard';

export default function AnalyticsTab() {
  const canWrite = useHasPermission(PERMISSIONS.settingsWrite);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(DEFAULT_VISITOR_ANALYTICS);
  const [savedConfig, setSavedConfig] = useState(DEFAULT_VISITOR_ANALYTICS);
  const [links, setLinks] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success' | 'error', text: string }

  // 初始加载配置
  const loadConfig = useCallback(async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/admin/visitors/analytics');
      if (!res.ok) throw new Error(`加载配置失败 (${res.status})`);
      const json = await res.json();
      const fetchedConfig = json?.data?.config || DEFAULT_VISITOR_ANALYTICS;
      setConfig(fetchedConfig);
      setSavedConfig(fetchedConfig);
      if (json?.data?.links) {
        setLinks(json.data.links);
      }
    } catch (err) {
      console.warn('[AnalyticsTab] Load error:', err?.message || err);
      // Fallback to defaults
      setConfig(DEFAULT_VISITOR_ANALYTICS);
      setSavedConfig(DEFAULT_VISITOR_ANALYTICS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // 脏状态计算
  const isDirty = useMemo(() => {
    return JSON.stringify(config) !== JSON.stringify(savedConfig);
  }, [config, savedConfig]);

  // 客户端实时校验
  const validation = useMemo(() => {
    return validateVisitorAnalyticsConfig(config);
  }, [config]);

  // 放弃修改重置
  const handleReset = () => {
    setConfig(savedConfig);
    setStatusMessage(null);
  };

  // 保存配置
  const handleSave = async () => {
    if (!validation.valid) {
      setStatusMessage({
        type: 'error',
        text: `配置校验未通过：${validation.errors.join('；')}`,
      });
      return;
    }

    setSaving(true);
    setStatusMessage(null);

    try {
      const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `idemp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      const res = await fetch('/api/admin/visitors/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ config }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || json?.message || '保存访客分析配置失败');
      }

      const updated = json?.data?.config || config;
      setConfig(updated);
      setSavedConfig(updated);
      setStatusMessage({
        type: 'success',
        text: '访客统计分析配置已成功保存并同步，全站前台将以无阻塞策略异步注水。',
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err?.message || '保存过程出现网络或服务端异常，请稍后重试',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 顶部操作与反馈栏 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-white tracking-[-0.01em]">访客统计与分析</h2>
        </div>

        {canWrite ? (
        <div className="flex items-center gap-2.5">
          {isDirty && (
            <button
              type="button"
              disabled={saving}
              onClick={handleReset}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-gray-300 hover:bg-white/[0.08] hover:text-white transition-all active:scale-[0.98] disabled:opacity-40"
            >
              <RotateCcw className="size-3" />
              <span>放弃更改</span>
            </button>
          )}

          <button
            type="button"
            disabled={saving || !isDirty || !validation.valid}
            onClick={handleSave}
            className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-brand hover:bg-brand-hover text-white px-4 text-xs font-semibold shadow-sm transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? (
              <>
                <RefreshCw className="size-3 animate-spin" />
                <span>保存中...</span>
              </>
            ) : (
              <>
                <Save className="size-3" />
                <span>保存配置</span>
              </>
            )}
          </button>
        </div>
        ) : (
          <span className="text-caption text-ink-subtle">当前角色仅可查看配置，无法保存变更</span>
        )}
      </div>

      {/* 状态提示反馈条 */}
      {statusMessage && (
        <div
          className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs transition-all ${
            statusMessage.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-red-500/30 bg-red-500/10 text-red-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400 mt-0.5" />
          ) : (
            <AlertCircle className="size-3.5 shrink-0 text-red-400 mt-0.5" />
          )}
          <span className="leading-5">{statusMessage.text}</span>
        </div>
      )}

      {/* Google Analytics 4 数据源指标拉取看板 */}
      <Ga4MetricsDashboardCard ga4Config={config?.googleAnalytics} />

      {/* 4 大分析工具卡片网格 */}
      <div className="pt-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">统计工具与代码集成</h3>
        <div className="grid gap-4 lg:grid-cols-2">
        <GoogleAnalyticsCard
          value={config.googleAnalytics}
          disabled={loading || saving || !canWrite}
          onChange={(val) => setConfig((prev) => ({ ...prev, googleAnalytics: val }))}
        />

        <BaiduTongjiCard
          value={config.baiduTongji}
          disabled={loading || saving || !canWrite}
          onChange={(val) => setConfig((prev) => ({ ...prev, baiduTongji: val }))}
        />

        <MicrosoftClarityCard
          value={config.microsoftClarity}
          disabled={loading || saving || !canWrite}
          onChange={(val) => setConfig((prev) => ({ ...prev, microsoftClarity: val }))}
        />

        <CustomScriptCard
          value={config.customScript}
          disabled={loading || saving || !canWrite}
          onChange={(val) => setConfig((prev) => ({ ...prev, customScript: val }))}
        />
      </div>
    </div>
  </div>
);
}


'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, MetricCard, StatusBadge, Button, EmptyState } from '@/components/admin/AdminUi';
import BrandLogo from '@/components/admin/BrandLogo';
import { buildCredentialView, buildExecutionView, buildVerificationView } from '@/lib/services/providerCredentialView';
import {
  Server,
  Zap,
  Plus,
  CheckCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Clock,
  Search,
  Check,
  Copy,
  Sliders,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

function formatAdminTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
}

const VERIFICATION_TONE_CLASS = {
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  danger: 'text-red-400',
  neutral: 'text-gray-400',
};

/**
 * 凭据来源与四维验证等级。
 *
 * 只消费服务端证据（credential / storedSecrets / envNames / 探针与生成时间），
 * 文案与等级全部由 providerCredentialView 计算；这里不做任何「有密钥就等于可用」的推断。
 */
function CredentialVerificationPanel({ channel }) {
  const credential = buildCredentialView({
    snapshot: channel.credential,
    storedSecrets: channel.storedSecrets,
    envNames: channel.envNames,
  });
  const verification = buildVerificationView({
    credential,
    probe: channel.lastProbeAt
      ? { probeKind: channel.lastProbeKind, healthStatus: channel.lastProbeStatus, checkedAt: channel.lastProbeAt }
      : null,
    generation: { lastSuccessAt: channel.lastSuccessAt, lastAttemptAt: channel.lastAttemptAt },
  });
  const execution = buildExecutionView({
    credential,
    lastAttemptAt: channel.lastAttemptAt,
    lastAttemptCredentialSource: channel.lastAttemptCredentialSource,
    lastAttemptSecretName: channel.lastAttemptCredentialSecretName,
  });
  const tiers = [verification.config, verification.auth, verification.modelAccess, verification.generation];
  const sourceTone = credential.readError ? 'danger' : credential.configured ? 'success' : 'warning';

  return (
    <div className="mt-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-gray-500">凭据来源:</span>
        <span className={`font-semibold ${VERIFICATION_TONE_CLASS[sourceTone]}`}>{credential.sourceLabel}</span>
        <span className="text-gray-500">环境 {credential.environmentLabel}</span>
        <span className="text-gray-500">
          {credential.updatedAt
            ? `变更于 ${formatAdminTime(credential.updatedAt)}`
            : credential.source === 'environment'
              ? '变更时间不可得（环境变量随进程）'
              : credential.hasStoredSecret
                ? '变更时间未知'
                : '无存盘记录'}
        </span>
        <span className="text-gray-500">解密 {credential.decryptStatusLabel}</span>
      </div>

      {credential.envNames.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-gray-500">
          <span>已设置环境变量:</span>
          {credential.envNames.map((name) => (
            <span key={name} className="rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-gray-300">
              {name}
            </span>
          ))}
          <span className="text-gray-500">（值仅在服务端读取）</span>
        </div>
      )}

      {credential.overrideNote && (
        <p className="mt-1 rounded border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300">
          {credential.overrideNote}
        </p>
      )}
      {credential.readErrorNote && (
        <p className="mt-1 rounded border border-red-500/20 bg-red-500/10 px-2 py-1 text-[11px] text-red-300">
          {credential.readErrorNote}
        </p>
      )}

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-white/[0.06] pt-1.5">
        <span className="text-gray-500">实际执行:</span>
        <span className={`font-medium ${VERIFICATION_TONE_CLASS[execution.tone] || 'text-gray-400'}`}>
          {execution.label}
        </span>
        {execution.at ? (
          <span className="text-gray-500">
            最近执行 {formatAdminTime(execution.at)}
            {execution.attemptedSourceLabel ? ` · 当时来源 ${execution.attemptedSourceLabel}` : ''}
          </span>
        ) : null}
        {execution.note ? <span className="text-gray-500" title={execution.note}>· {execution.note}</span> : null}
      </div>

      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-white/[0.06] pt-1.5">
        {tiers.map((t) => (
          <div key={t.key} className="flex items-center justify-between gap-2" title={t.note}>
            <span className="text-gray-500">{t.label}</span>
            <span className={`font-medium ${VERIFICATION_TONE_CLASS[t.tone] || 'text-gray-400'}`}>
              {t.stateLabel}
              {t.at ? <span className="ml-1 font-normal text-gray-500">{formatAdminTime(t.at)}</span> : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 编辑弹窗里的凭据来源摘要。
 *
 * 与卡片面板共用同一份 buildCredentialView 口径，避免两处文案各自演化。
 */
function CredentialSourceHint({ provider }) {
  const credential = buildCredentialView({
    snapshot: provider?.credential,
    storedSecrets: provider?.storedSecrets,
    envNames: provider?.envNames,
  });
  const toneClass = credential.readError ? 'text-red-300' : credential.configured ? 'text-gray-400' : 'text-amber-300';

  return (
    <div className="space-y-1">
      <p className={`text-xs ${toneClass}`}>
        生效来源：<span className="font-medium">{credential.sourceLabel}</span>
        {credential.source !== 'none' ? ` · 环境 ${credential.environmentLabel}` : ''}
        {credential.updatedAt ? ` · 变更于 ${formatAdminTime(credential.updatedAt)}` : ''}
        {credential.configured ? ' · 上游鉴权与生成能力仍需单独验证' : ''}
      </p>
      {credential.overrideNote && (
        <p className="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300">
          {credential.overrideNote}
        </p>
      )}
      {credential.readErrorNote && (
        <p className="rounded border border-red-500/20 bg-red-500/10 px-2 py-1 text-[11px] text-red-300">
          {credential.readErrorNote}
        </p>
      )}
    </div>
  );
}

export default function ProvidersManagerClient({ initialChannels = [] }) {
  const [channels, setChannels] = useState(initialChannels);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | healthy | tripped | missing_key | disabled
  const [editingProvider, setEditingProvider] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncingId, setSyncingId] = useState(null); // null | 'all' | providerId
  const [probingId, setProbingId] = useState(null);
  const [resettingId, setResettingId] = useState(null);
  const [probeResults, setProbeResults] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  // 刷新所有渠道最新状态
  const refreshChannels = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/admin/models/health');
      const json = await res.json();
      if (res.ok && json.data?.channels) {
        // 保留原有的 hasApiKey 状态并合并最新健康遥测
        const freshMap = new Map(json.data.channels.map((c) => [c.id, c]));
        setChannels((prev) =>
          prev.map((p) => {
            const fresh = freshMap.get(p.id);
            if (!fresh) return p;
            return {
              ...p,
              ...fresh,
              hasApiKey: p.hasApiKey,
              maskedApiKey: p.maskedApiKey,
              modelCatalogApiUrl: fresh.modelCatalogApiUrl !== undefined ? fresh.modelCatalogApiUrl : p.modelCatalogApiUrl,
              brandStats: fresh.brandStats || p.brandStats,
            };
          })
        );
      }
    } catch (err) {
      console.error('刷新渠道状态失败:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // 单通道模型拉取与目录抽取
  const handleSyncModels = async (providerId) => {
    setSyncingId(providerId);
    try {
      const res = await fetch('/api/admin/models/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `sync_cat_${providerId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        },
        body: JSON.stringify({
          action: 'sync_models',
          providerId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.data) {
        const result = data.data;
        const msg = result.message || (result.status === 'empty' ? '渠道返回空目录（0 个模型）' : `已成功拉取 ${result.fetched || 0} 个模型`);
        setProbeResults((prev) => ({
          ...prev,
          [providerId]: {
            type: result.status === 'empty' ? 'warning' : 'good',
            text: msg,
          },
        }));
        await refreshChannels();
      } else {
        const rawErr = typeof data.error === 'string' ? data.error : data.error?.message;
        const errMsg = rawErr || data.data?.message || '模型目录拉取失败';
        setProbeResults((prev) => ({
          ...prev,
          [providerId]: {
            type: 'danger',
            text: `模型抽取异常：${errMsg}`,
          },
        }));
      }
    } catch (err) {
      setProbeResults((prev) => ({
        ...prev,
        [providerId]: {
          type: 'danger',
          text: `模型抽取网络异常：${err.message}`,
        },
      }));
    } finally {
      setSyncingId(null);
    }
  };

  // 全量通道模型拉取
  const handleSyncAllModels = async () => {
    setSyncingId('all');
    try {
      for (const c of channels) {
        if (c.enabled) {
          try {
            const res = await fetch('/api/admin/models/control', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Idempotency-Key': `sync_cat_${c.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              },
              body: JSON.stringify({
                action: 'sync_models',
                providerId: c.id,
              }),
            });
            const data = await res.json();
            if (res.ok && data.data) {
              const resData = data.data;
              const msg = resData.message || (resData.status === 'empty' ? '渠道返回空目录（0 个模型）' : `已成功拉取 ${resData.fetched || 0} 个模型`);
              setProbeResults((prev) => ({
                ...prev,
                [c.id]: {
                  type: resData.status === 'empty' ? 'warning' : 'good',
                  text: msg,
                },
              }));
            } else {
              const rawErr = typeof data.error === 'string' ? data.error : data.error?.message;
              const errMsg = rawErr || data.data?.message || '拉取失败';
              setProbeResults((prev) => ({
                ...prev,
                [c.id]: {
                  type: 'danger',
                  text: `模型抽取异常：${errMsg}`,
                },
              }));
            }
          } catch (err) {
            setProbeResults((prev) => ({
              ...prev,
              [c.id]: {
                type: 'danger',
                text: `模型抽取网络异常：${err.message}`,
              },
            }));
          }
        }
      }
      await refreshChannels();
    } finally {
      setSyncingId(null);
    }
  };

  // 单通道健康探测
  const handleProbe = async (providerId) => {
    setProbingId(providerId);
    try {
      const res = await fetch('/api/admin/models/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId }),
      });
      const data = await res.json();
      if (res.ok && data.data?.success) {
        setProbeResults((prev) => ({
          ...prev,
          [providerId]: {
            type: 'good',
            text: `探测成功：${data.data.message || '响应正常'} (${data.data.latencyMs}ms)`,
          },
        }));
        await refreshChannels();
      } else {
        setProbeResults((prev) => ({
          ...prev,
          [providerId]: {
            type: 'danger',
            text: `探测异常：${data.data?.message || data.error?.message || '无法连接'}`,
          },
        }));
      }
    } catch (err) {
      setProbeResults((prev) => ({
        ...prev,
        [providerId]: {
          type: 'danger',
          text: `网络连接异常：${err.message}`,
        },
      }));
    } finally {
      setProbingId(null);
    }
  };

  // 全量通道探测
  const handleProbeAll = async () => {
    setIsRefreshing(true);
    for (const c of channels) {
      if (c.enabled) {
        await handleProbe(c.id);
      }
    }
    setIsRefreshing(false);
  };

  // 复位熔断器
  const handleResetCircuit = async (providerId) => {
    setResettingId(providerId);
    try {
      const res = await fetch('/api/admin/models/health/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId }),
      });
      const data = await res.json();
      if (res.ok) {
        setProbeResults((prev) => ({
          ...prev,
          [providerId]: { type: 'good', text: '熔断器已成功复位闭合 (Closed)' },
        }));
        await refreshChannels();
      } else {
        setProbeResults((prev) => ({
          ...prev,
          [providerId]: { type: 'danger', text: data.error?.message || '复位失败' },
        }));
      }
    } catch (err) {
      setProbeResults((prev) => ({
        ...prev,
        [providerId]: { type: 'danger', text: err.message || '网络异常' },
      }));
    } finally {
      setResettingId(null);
    }
  };

  // 启/禁用切换
  const handleToggleEnabled = async (channel) => {
    const nextEnabled = !channel.enabled;
    try {
      const res = await fetch('/api/admin/models/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: channel.id,
          name: channel.name,
          enabled: nextEnabled,
        }),
      });
      if (res.ok) {
        setChannels((prev) =>
          prev.map((c) => (c.id === channel.id ? { ...c, enabled: nextEnabled } : c))
        );
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error?.message || '切换状态失败');
      }
    } catch (e) {
      alert('切换状态失败: ' + e.message);
    }
  };

  // 保存供应商配置
  const handleSaveProvider = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const form = e.target;
    const payload = {
      id: form.id.value.trim().toLowerCase(),
      name: form.name.value.trim(),
      providerType: form.providerType.value,
      priority: Number(form.priority.value || 100),
      baseUrl: form.baseUrl.value.trim(),
      modelCatalogApiUrl: form.modelCatalogApiUrl ? form.modelCatalogApiUrl.value.trim() : '',
      apiMode: form.apiMode.value,
      apiKey: form.apiKey.value.trim() || undefined,
      enabled: form.enabled.checked,
    };

    try {
      const res = await fetch('/api/admin/models/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        const saved = data.data.provider;
        setChannels((prev) => {
          const idx = prev.findIndex((p) => p.id === saved.id);
          const maskedApiKey = saved.maskedApiKey || '';
          const hasApiKey = saved.hasApiKey === true;
          const merged = {
            ...saved,
            hasApiKey,
            maskedApiKey,
            modelCatalogApiUrl: saved.modelCatalogApiUrl !== undefined ? saved.modelCatalogApiUrl : (payload.modelCatalogApiUrl || ''),
            boundModelsCount: idx >= 0 ? prev[idx].boundModelsCount : 0,
            successRate24h: idx >= 0 ? prev[idx].successRate24h : 100,
            totalAttempts24h: idx >= 0 ? prev[idx].totalAttempts24h : 0,
            avgLatencyMs24h: idx >= 0 ? prev[idx].avgLatencyMs24h : 0,
            consecutiveFailures: idx >= 0 ? prev[idx].consecutiveFailures : 0,
            circuitState: idx >= 0 ? prev[idx].circuitState : 'closed',
            brandStats: idx >= 0 ? prev[idx].brandStats : { totalModels: 0, totalBrands: 0, topBrands: [] },
          };
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...merged };
            return next;
          }
          return [...prev, merged];
        });
        setEditingProvider(null);
        setIsCreating(false);
        if (saved.credentialSavedAsFallback) alert('密钥已加密保存为备用配置。当前执行仍使用环境变量中的密钥，本次保存未切换执行凭据。');
      } else {
        alert(data.error?.message || '保存供应商配置失败');
      }
    } catch (err) {
      alert('保存出错: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const copyEndpoint = (text, id) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // 统计指标
  const totalCount = channels.length;
  const enabledCount = channels.filter((c) => c.enabled).length;
  const closedBreakers = channels.filter((c) => c.circuitState === 'closed').length;
  const openBreakers = channels.filter((c) => c.circuitState === 'open').length;
  const halfOpenBreakers = channels.filter((c) => c.circuitState === 'half_open').length;
  const avgLatency24h = Math.round(
    channels.reduce((acc, c) => acc + (c.avgLatencyMs24h || 0), 0) / (channels.length || 1)
  );
  const overallSuccessRate = (
    channels.reduce((acc, c) => acc + (c.successRate24h ?? 100), 0) / (channels.length || 1)
  ).toFixed(1);

  // 过滤后的列表
  const filteredChannels = useMemo(() => {
    return channels.filter((c) => {
      // 搜索词匹配
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchName = c.name?.toLowerCase().includes(query);
        const matchId = c.id?.toLowerCase().includes(query);
        const matchUrl = c.baseUrl?.toLowerCase().includes(query);
        if (!matchName && !matchId && !matchUrl) return false;
      }

      // 状态过滤
      if (statusFilter === 'healthy') {
        return c.circuitState === 'closed' && c.enabled;
      }
      if (statusFilter === 'tripped') {
        return c.circuitState === 'open' || c.circuitState === 'half_open' || (c.consecutiveFailures || 0) > 0;
      }
      if (statusFilter === 'missing_key') {
        return !c.hasApiKey;
      }
      if (statusFilter === 'disabled') {
        return !c.enabled;
      }

      return true;
    });
  }, [channels, searchTerm, statusFilter]);

  return (
    <div className="space-y-6">
      {/* 顶部指标卡片 (Zone 1) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="接入渠道总数"
          value={`${enabledCount} / ${totalCount}`}
          hint="已启用服务 / 平台接入总数"
          tone="info"
        />
        <MetricCard
          label="正常承接 (Closed)"
          value={closedBreakers}
          hint="断路器闭合，正常参与智能路由"
          tone="good"
        />
        <MetricCard
          label="熔断告警 (Open)"
          value={openBreakers}
          hint={
            openBreakers > 0
              ? `已触发隔离保护${halfOpenBreakers > 0 ? ` (另有 ${halfOpenBreakers} 个半开)` : ''}`
              : halfOpenBreakers > 0
              ? `${halfOpenBreakers} 个通道半开试探中`
              : '全部通道通信健康，无熔断'
          }
          tone={openBreakers > 0 ? 'danger' : halfOpenBreakers > 0 ? 'warn' : 'neutral'}
        />
        <MetricCard
          label="24h 总体成功率"
          value={`${overallSuccessRate}%`}
          hint={`全网通道平均响应耗时 ${avgLatency24h} ms`}
          tone={Number(overallSuccessRate) >= 95 ? 'good' : 'warn'}
        />
      </div>

      {/* 综合控制工具栏 (Zone 2) */}
      <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-surface/80 p-3.5 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* 搜索框 */}
          <div className="relative min-w-[220px] max-w-xs">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索渠道、ID 或 URL..."
              className="h-8 w-full rounded-lg border border-white/[0.1] bg-white/[0.03] pl-8 pr-3 text-xs text-white placeholder-gray-500 focus:border-brand focus:outline-none"
            />
          </div>

          {/* 状态过滤 Pill 按钮组 */}
          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: 'all', label: '全部渠道' },
              { id: 'healthy', label: '正常闭合' },
              { id: 'tripped', label: '熔断异常' },
              { id: 'missing_key', label: '待配密钥' },
              { id: 'disabled', label: '已禁用' },
            ].map((f) => {
              const active = statusFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={`h-7 rounded-full px-2.5 text-xs font-medium transition-all ${
                    active
                      ? 'bg-brand text-white font-semibold shadow-sm'
                      : 'border border-white/[0.08] bg-white/[0.03] text-gray-400 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 右侧动作按钮组 */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isRefreshing || syncingId !== null}
            onClick={refreshChannels}
            className="h-8 text-xs border-white/[0.1] hover:bg-white/[0.05]"
          >
            <RefreshCw className={`mr-1.5 size-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            刷新状态
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={isRefreshing || syncingId !== null}
            onClick={handleSyncAllModels}
            className="h-8 text-xs border-brand/30 text-brand hover:bg-brand/10"
            title="一键拉取所有启用渠道的最新模型目录并自动适配"
          >
            {syncingId === 'all' ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin text-brand" />
            ) : (
              <RefreshCw className="mr-1.5 size-3.5 text-brand" />
            )}
            全量拉取模型
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={isRefreshing || syncingId !== null}
            onClick={handleProbeAll}
            className="h-8 text-xs border-brand/30 text-brand hover:bg-brand/10"
          >
            <Zap className="mr-1.5 size-3.5 text-brand" />
            全量通道探针扫描
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setIsCreating(true);
              setEditingProvider({
                id: '',
                name: '',
                provider_type: 'aggregator',
                priority: 100,
                base_url: '',
                model_catalog_api_url: '',
                api_mode: 'async',
                enabled: true,
              });
            }}
            className="h-8 bg-brand hover:bg-brand-hover text-white text-xs font-semibold shadow-sm"
          >
            <Plus className="mr-1 size-3.5" />
            新增供应商
          </Button>
        </div>
      </div>

      {/* 融合型渠道卡片网格 (Zone 3) */}
      {filteredChannels.length === 0 ? (
        <EmptyState
          title="未找到匹配的渠道"
          description={searchTerm ? `没有符合「${searchTerm}」条件的供应商` : '当前筛选分类下暂无记录'}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredChannels.map((c) => {
            const isOpen = c.circuitState === 'open';
            const isHalfOpen = c.circuitState === 'half_open';
            const isProbing = probingId === c.id;
            const isResetting = resettingId === c.id;
            const feedback = probeResults[c.id];

            return (
              <Card
                key={c.id}
                className={`relative flex flex-col justify-between overflow-hidden border p-5 transition-all duration-200 ${
                  isOpen
                    ? 'border-red-500/40 bg-red-950/10'
                    : isHalfOpen
                    ? 'border-amber-500/30 bg-amber-950/10'
                    : !c.enabled
                    ? 'border-white/[0.04] bg-surface/50 opacity-80'
                    : 'border-white/[0.08] hover:border-white/[0.14]'
                }`}
              >
                <div>
                  {/* 卡片头部 */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-gray-400">[{c.id}]</span>
                        <h3 className="text-base font-bold text-white truncate">{c.name}</h3>
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase border border-white/[0.1] bg-white/[0.04] text-gray-300">
                          {c.providerType || 'aggregator'}
                        </span>
                      </div>

                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-400 font-mono">
                        <span className="truncate max-w-[280px]">
                          {c.baseUrl || '官方默认 Endpoint'}
                        </span>
                        {c.baseUrl && (
                          <button
                            type="button"
                            onClick={() => copyEndpoint(c.baseUrl, c.id)}
                            className="text-gray-500 hover:text-white transition-colors"
                            title="复制 Endpoint"
                          >
                            {copiedId === c.id ? (
                              <Check className="size-3 text-emerald-400" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </button>
                        )}
                      </div>

                      <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[11px]">
                        <span className="text-gray-500">已填密钥:</span>
                        {c.hasApiKey && c.maskedApiKey ? (
                          <span className="font-semibold text-emerald-400" title={c.maskedApiKey}>
                            {c.maskedApiKey}
                          </span>
                        ) : (
                          <span className="text-amber-400/80">待配置密钥</span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <StatusBadge tone={c.enabled ? 'good' : 'neutral'}>
                        {c.enabled ? '已启用' : '已禁用'}
                      </StatusBadge>
                      <StatusBadge tone={isOpen ? 'danger' : isHalfOpen ? 'warn' : 'good'}>
                        {isOpen
                          ? '🔴 熔断阻断'
                          : isHalfOpen
                          ? '🟡 半开试探'
                          : c.healthStatus === 'degraded'
                          ? '🟡 性能降级'
                          : '🟢 闭合正常'}
                      </StatusBadge>
                    </div>
                  </div>

                  {/* 属性与指标矩阵 */}
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs">
                    {/* 左侧：连接配置属性 */}
                    <div className="space-y-1.5 border-r border-white/[0.06] pr-2">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">API 密钥:</span>
                        <span>
                          {c.hasApiKey ? (
                            <span className="inline-flex items-center font-medium text-emerald-400 font-mono">
                              <CheckCircle className="mr-1 size-3" /> {c.maskedApiKey || '已加密配置'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center font-medium text-amber-400 font-mono">
                              <AlertTriangle className="mr-1 size-3" /> 待配置密钥
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">基础优先级:</span>
                        <span className="font-semibold text-brand">{c.priority ?? 100}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">调用模式:</span>
                        <span className="text-gray-300">
                          {c.apiMode === 'sync' || c.apiMode === 'sync_direct'
                            ? '同步直出'
                            : c.apiMode === 'stream'
                            ? '实时流式'
                            : c.apiMode === 'webhook'
                            ? '异步回调'
                            : '异步轮询'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">抽取端点:</span>
                        <span
                          className="truncate max-w-[130px] font-mono text-[11px]"
                          title={c.modelCatalogApiUrl || '使用渠道官方默认端点'}
                        >
                          {c.modelCatalogApiUrl ? (
                            <span className="text-brand">{c.modelCatalogApiUrl}</span>
                          ) : (
                            <span className="text-gray-500">默认驱动推断</span>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center justify-between group">
                        <span className="text-gray-500">品牌模型:</span>
                        <Link
                          href={`/admin/models/brands?provider=${c.id}`}
                          className="inline-flex items-center gap-1.5 rounded-md border border-brand/20 bg-brand/10 px-2 py-0.5 font-mono text-xs font-medium text-brand shadow-sm transition-all hover:border-brand/40 hover:bg-brand/15 hover:text-brand"
                          title={`点击跳转进入【${c.name}】品牌模型明细页面`}
                        >
                          {c.brandStats?.topBrands?.slice(0, 3).map((b) => (
                            <BrandLogo key={b.id} brandId={b.id} size="xs" className="rounded-sm" />
                          ))}
                          <span>
                            {c.boundModelsCount || 0} 个
                            {c.brandStats?.totalBrands > 0 && (
                              <span className="ml-1 text-[11px] text-brand/80">
                                ({c.brandStats.totalBrands} 品牌)
                              </span>
                            )}
                          </span>
                          <ChevronRight className="size-3 text-brand transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      </div>
                    </div>

                    {/* 右侧：健康遥测数据 */}
                    <div className="space-y-1.5 pl-1">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">24h 成功率:</span>
                        <span
                          className={`font-mono font-bold ${
                            (c.successRate24h ?? 100) >= 95
                              ? 'text-emerald-400'
                              : (c.successRate24h ?? 100) >= 80
                              ? 'text-amber-400'
                              : 'text-red-400'
                          }`}
                        >
                          {c.successRate24h ?? 100}%
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">24h 调用量:</span>
                        <span className="text-gray-300 font-mono">{c.totalAttempts24h || 0} 次</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">平均耗时:</span>
                        <span className="font-mono font-semibold text-white">
                          {c.avgLatencyMs24h || 0} ms
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">连续失败:</span>
                        <span
                          className={`font-mono font-bold ${
                            (c.consecutiveFailures || 0) > 0 ? 'text-red-400' : 'text-gray-400'
                          }`}
                        >
                          {c.consecutiveFailures || 0} / 5 次
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 上游余额/配额：未知必须显示为未知，禁止用数据库默认 0 冒充真实余额 */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs">
                    <span className="shrink-0 text-gray-500">上游余额:</span>
                    {c.balance === null || c.balance === undefined ? (
                      <span className="font-semibold text-gray-400">未知</span>
                    ) : (
                      <span className="font-mono font-semibold text-white">
                        {Number(c.balance).toLocaleString('zh-CN', { maximumFractionDigits: 4 })}
                        {c.currency ? ` ${c.currency}` : ''}
                      </span>
                    )}
                    {c.availableQuota !== null && c.availableQuota !== undefined && (
                      <span className="shrink-0 text-gray-500">
                        配额{' '}
                        <span className="font-mono text-gray-300">
                          {Number(c.availableQuota).toLocaleString('zh-CN', { maximumFractionDigits: 4 })}
                        </span>
                      </span>
                    )}
                    <span
                      className="min-w-0 flex-1 truncate text-caption text-gray-500"
                      title={c.balanceApi?.reason || c.balanceApi?.url || '未登记余额接口'}
                      suppressHydrationWarning
                    >
                      {c.balanceApi?.url
                        ? `来源 ${c.balanceApi.url}`
                        : c.balanceApi?.supported === false
                          ? '通道未提供余额接口'
                          : '余额来源未登记'}
                      {c.balanceCheckedAt ? ` · 观测于 ${formatAdminTime(c.balanceCheckedAt)}` : ' · 未观测'}
                    </span>
                  </div>

                  {/* 凭据来源、解密结果与四维验证等级 */}
                  <CredentialVerificationPanel channel={c} />

                  {/* 探测信息展开条 */}
                  {feedback && (
                    <div
                      className={`mt-3 rounded-lg p-2.5 text-xs transition-all ${
                        feedback.type === 'good'
                          ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                          : 'border border-red-500/20 bg-red-500/10 text-red-400'
                      }`}
                    >
                      {feedback.text}
                    </div>
                  )}
                </div>

                {/* 底部操作与状态 */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-xs">
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <Clock className="size-3" />
                    <span suppressHydrationWarning>
                      {c.lastHealthCheckAt
                        ? `探测于 ${new Date(c.lastHealthCheckAt).toLocaleTimeString('zh-CN', {
                            timeZone: 'Asia/Shanghai',
                            hour12: false,
                          })}`
                        : '暂未主动探测'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* 启/禁用切换 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleEnabled(c)}
                      className="h-7 text-xs text-gray-400 hover:text-white"
                    >
                      {c.enabled ? '禁用' : '启用'}
                    </Button>

                    {/* 复位熔断器（异常时才显示） */}
                    {(isOpen || isHalfOpen || (c.consecutiveFailures || 0) > 0) && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isResetting}
                        onClick={() => handleResetCircuit(c.id)}
                        className="h-7 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs"
                      >
                        {isResetting ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                        复位熔断
                      </Button>
                    )}

                    {/* 单通道模型拉取刷新 */}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={syncingId === c.id || syncingId === 'all'}
                      onClick={() => handleSyncModels(c.id)}
                      className="h-7 border-brand/20 text-brand hover:bg-brand/10 text-xs"
                      title="从该渠道抽取最新可用模型列表并自动关联适配"
                    >
                      {syncingId === c.id ? (
                        <>
                          <Loader2 className="mr-1 size-3 animate-spin" />
                          拉取中...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-1 size-3 text-brand" />
                          拉取模型
                        </>
                      )}
                    </Button>

                    {/* 单通道健康探测 */}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isProbing}
                      onClick={() => handleProbe(c.id)}
                      className="h-7 border-white/[0.1] text-xs hover:bg-white/[0.05]"
                    >
                      {isProbing ? (
                        <>
                          <Loader2 className="mr-1 size-3 animate-spin" />
                          探测中...
                        </>
                      ) : (
                        <>
                          <Zap className="mr-1 size-3 text-brand" />
                          健康探测
                        </>
                      )}
                    </Button>

                    {/* 编辑配置 */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsCreating(false);
                        setEditingProvider(c);
                      }}
                      className="h-7 border-white/[0.1] text-xs hover:bg-white/[0.05]"
                    >
                      编辑配置
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 新增 / 编辑供应商弹窗 (Modal) */}
      {editingProvider && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSaving) {
              setEditingProvider(null);
              setIsCreating(false);
            }
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-white/[0.12] bg-surface p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">
              {isCreating ? '新增 AI 供应商驱动' : `编辑供应商: ${editingProvider.name}`}
            </h3>
            <p className="mt-1 text-xs text-gray-400">
              配置驱动连接参数，API Key 写入后将通过 AES-256-GCM 独立加密。
            </p>

            <form onSubmit={handleSaveProvider} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300">供应商 ID (Slug)</label>
                <input
                  name="id"
                  defaultValue={editingProvider.id}
                  disabled={!isCreating}
                  required
                  placeholder="例如: kling, openai, custom-gateway"
                  className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-brand focus:outline-none disabled:opacity-50 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300">显示名称</label>
                <input
                  name="name"
                  defaultValue={editingProvider.name}
                  required
                  placeholder="例如: 快手可灵官方 API"
                  className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300">类型 (Provider Type)</label>
                  <select
                    name="providerType"
                    defaultValue={
                      (editingProvider.provider_type || editingProvider.providerType) === 'official'
                        ? 'official'
                        : (editingProvider.provider_type || editingProvider.providerType) === 'direct' ||
                          (editingProvider.provider_type || editingProvider.providerType) === 'custom'
                        ? 'direct'
                        : 'aggregator'
                    }
                    className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#161820] px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
                  >
                    <option value="aggregator">Aggregator (聚合网关)</option>
                    <option value="official">Official (原厂官方 API)</option>
                    <option value="direct">Direct (直连推理集群)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300">路由基础优先级 (0-200)</label>
                  <input
                    type="number"
                    name="priority"
                    defaultValue={editingProvider.priority ?? 100}
                    className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300">Base URL (留空使用驱动默认)</label>
                <input
                  name="baseUrl"
                  defaultValue={editingProvider.base_url || editingProvider.baseUrl || ''}
                  placeholder="https://api.example.com/v1"
                  className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-brand focus:outline-none font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-gray-300">
                    模型抽取端点 (Catalog Endpoint)
                  </label>
                  <span className="text-[10px] text-brand font-mono">模型拉取设置</span>
                </div>
                <input
                  name="modelCatalogApiUrl"
                  defaultValue={editingProvider.model_catalog_api_url || editingProvider.modelCatalogApiUrl || ''}
                  placeholder="留空自动匹配 (例如: /v1/models 或完整 URL)"
                  className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-brand focus:outline-none font-mono"
                />
                <p className="mt-1 text-[11px] text-gray-500">
                  仅需此项设置即可自动抽取最新模型列表；支持相对路径或完整 URL，留空使用官方默认。
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300">调用模式 (API Mode)</label>
                  <select
                    name="apiMode"
                    defaultValue={
                      (editingProvider.api_mode || editingProvider.apiMode) === 'sync' ||
                      (editingProvider.api_mode || editingProvider.apiMode) === 'sync_direct'
                        ? 'sync'
                        : (editingProvider.api_mode || editingProvider.apiMode) === 'stream'
                        ? 'stream'
                        : 'async'
                    }
                    className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-[#161820] px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
                  >
                    <option value="async">异步轮询 (Async Poll)</option>
                    <option value="sync">同步直出 (Sync Direct)</option>
                    <option value="stream">实时流式 (Stream)</option>
                  </select>
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      name="enabled"
                      defaultChecked={editingProvider.enabled !== false}
                      className="size-4 rounded border-white/[0.2] bg-white/[0.05] text-brand focus:ring-0"
                    />
                    启用该供应商
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300">
                  API Key / Secret Token{' '}
                  {editingProvider.hasApiKey && (
                    <span className="text-gray-500">
                      (当前已配置: {editingProvider.maskedApiKey ? editingProvider.maskedApiKey : '已加密存盘'}，输入新值以覆盖)
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  name="apiKey"
                  placeholder={
                    editingProvider.hasApiKey
                      ? editingProvider.maskedApiKey
                        ? `${editingProvider.maskedApiKey} (留空保持现有凭证)`
                        : '•••••••••••••••• (留空保持现有凭证)'
                      : '输入供应商 API Key'
                  }
                  className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-brand focus:outline-none font-mono"
                />
                <CredentialSourceHint provider={editingProvider} />
              </div>

              {/* 品牌模型关联与管理通道 */}
              {!isCreating && editingProvider.id && (
                <div className="space-y-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-200">挂载品牌模型</span>
                    <span className="font-mono font-medium text-brand">
                      {editingProvider.boundModelsCount || 0} 个模型
                      {editingProvider.brandStats?.totalBrands > 0 && ` (${editingProvider.brandStats.totalBrands} 个品牌)`}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    管理该供应商所承载的品牌模型规格（如 字节跳动、快手可灵、OpenAI、FLUX、MiniMax 等）。
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex flex-wrap gap-1.5">
                      {editingProvider.brandStats?.topBrands?.map((b) => (
                        <span key={b.id} className="inline-flex items-center gap-1 rounded bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 text-[10px] text-gray-300">
                          <BrandLogo brandId={b.id} size="xs" className="rounded-sm" />
                          <span>{b.shortName}: {b.count}</span>
                        </span>
                      ))}
                    </div>
                    <Link
                      href={`/admin/models/brands?provider=${editingProvider.id}`}
                      className="inline-flex items-center gap-1 font-medium text-[11px] text-brand transition-colors hover:underline"
                    >
                      前往品牌模型明细 <ChevronRight className="size-3" />
                    </Link>
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-white/[0.08]">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditingProvider(null);
                    setIsCreating(false);
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-brand hover:bg-brand-hover text-white font-semibold shadow-sm"
                >
                  {isSaving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
                  保存配置
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

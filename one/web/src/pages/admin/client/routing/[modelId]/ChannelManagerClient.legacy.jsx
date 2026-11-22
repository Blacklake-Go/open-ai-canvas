'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, PageHeader, StatusBadge, MetricCard } from '@/components/admin/AdminUi';
import { Star, CheckCircle2, AlertCircle, RefreshCw, Power, ArrowLeft } from 'lucide-react';

function formatDate(value) {
  return value
    ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
    : '—';
}

function healthTone(status) {
  return status === 'healthy' ? 'good' : status === 'degraded' ? 'warn' : 'danger';
}

function circuitTone(state) {
  return state === 'closed' ? 'good' : state === 'half_open' ? 'warn' : 'danger';
}

const ROUTING_MODE_LABELS = {
  cost: '成本优先',
  quality: '质量优先',
  stability: '稳定优先',
  balanced: '智能平衡',
};

export default function ChannelManagerClient({ initialChannels = [], model = {}, modelId = '' }) {
  const [channels, setChannels] = useState(initialChannels);
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 3500);
  };

  const handleSetPrimary = async (channelId) => {
    const target = channels.find((c) => c.id === channelId);
    if (!target) return;
    setBusyId(channelId);

    try {
      const res = await fetch(`/api/admin/routing/${encodeURIComponent(modelId)}/channels`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: channelId,
          is_primary: true,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || json.error || '切换主渠道失败');
      }

      // Optimistic update: mark target as primary, others as non-primary
      setChannels((prev) =>
        prev.map((c) => ({
          ...c,
          is_primary: c.id === channelId,
        }))
      );

      showToast(`已成功将「${target.provider_name}」设为默认主选渠道`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleEnabled = async (channelId, currentEnabled) => {
    const target = channels.find((c) => c.id === channelId);
    if (!target) return;
    setBusyId(channelId);

    const nextEnabled = !currentEnabled;
    try {
      const res = await fetch(`/api/admin/routing/${encodeURIComponent(modelId)}/channels`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: channelId,
          enabled: nextEnabled,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || json.error || '更新渠道状态失败');
      }

      setChannels((prev) =>
        prev.map((c) => (c.id === channelId ? { ...c, enabled: nextEnabled } : c))
      );

      showToast(`已${nextEnabled ? '启用' : '禁用'}渠道「${target.provider_name}」`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const primaryChannel = channels.find((c) => c.is_primary) || channels[0];
  const healthyCount = channels.filter((c) => c.health_status === 'healthy' && c.enabled).length;
  const enabledCount = channels.filter((c) => c.enabled).length;

  return (
    <>
      <PageHeader
        eyebrow="AI 模型路由"
        title={`${model.display_name || model.name} — 渠道管理`}
        description={`管理 ${model.display_name || model.name} 的供应商渠道映射、主选切换与运行健康状态。`}
      >
        <Link
          href="/admin/routing"
          className="inline-flex h-[32px] items-center gap-1.5 rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 text-xs font-medium text-gray-300 transition-all hover:bg-white/[0.08] hover:text-white active:scale-[0.98]"
        >
          <ArrowLeft className="size-3.5" />
          返回路由列表
        </Link>
      </PageHeader>

      {/* 提示通知条 */}
      {toast && (
        <div
          className={`mb-5 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs font-medium transition-all duration-300 ${
            toast.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-red-500/30 bg-red-500/10 text-red-300'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="size-4 shrink-0 text-red-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* 状态统计卡片 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <MetricCard
          label="当前默认主选渠道"
          value={primaryChannel ? primaryChannel.provider_name : '暂无主渠道'}
          hint={primaryChannel ? `模型ID: ${primaryChannel.provider_model_id}` : '未挂载可用渠道'}
          tone="info"
        />
        <MetricCard
          label="渠道健康度"
          value={`${healthyCount} / ${enabledCount}`}
          hint={`已挂载共 ${channels.length} 个渠道`}
          tone={healthyCount === enabledCount && healthyCount > 0 ? 'good' : healthyCount > 0 ? 'warn' : 'danger'}
        />
        <MetricCard
          label="分流调度模式"
          value={ROUTING_MODE_LABELS[model.routing_mode] || '智能平衡'}
          hint={model.failover_enabled !== false ? '故障转移已开启 (Failover)' : '故障转移已关闭'}
          tone="neutral"
        />
        <MetricCard
          label="模型类别 / 状态"
          value={model.category || '—'}
          hint={`状态: ${model.status === 'active' ? '正常上架' : model.status}`}
          tone="neutral"
        />
      </div>

      {/* 渠道列表与切换管理 */}
      <Card>
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">已挂载供应商渠道与主选切换</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              点击「设为主选」可立即切换运行时第一选路供应商；支持即时启用/停用与容灾排序。
            </p>
          </div>
          <span className="text-xs font-mono text-gray-400">
            共 {channels.length} 个可用通道
          </span>
        </div>

        {channels.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-400">
            暂无挂载的供应商渠道
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.06] text-[11px] font-medium text-gray-400">
                  <th className="py-3 px-3">供应商 / 渠道信息</th>
                  <th className="py-3 px-3">主选路由 (Primary)</th>
                  <th className="py-3 px-3">运行状态</th>
                  <th className="py-3 px-3">健康诊断</th>
                  <th className="py-3 px-3">熔断保护</th>
                  <th className="py-3 px-3">优先级</th>
                  <th className="py-3 px-3">成功率</th>
                  <th className="py-3 px-3">平均延迟</th>
                  <th className="py-3 px-3">并发监控</th>
                  <th className="py-3 px-3">最后巡检</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-xs">
                {channels.map((row) => {
                  const isPrimary = Boolean(row.is_primary);
                  const isBusy = busyId === row.id;

                  return (
                    <tr
                      key={row.id}
                      className={`group transition-colors ${
                        isPrimary
                          ? 'bg-brand/[0.04] hover:bg-brand/[0.08]'
                          : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      {/* 供应商信息 */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-white">{row.provider_name}</span>
                              <span className="inline-flex items-center rounded px-1.5 py-0.2 text-[10px] font-mono text-white/50 bg-white/[0.05] border border-white/[0.08]">
                                {row.provider_type === 'official' ? '官方直连' : '聚合网关'}
                              </span>
                            </div>
                            <p className="text-[11px] text-white/40 font-mono mt-0.5">
                              {row.provider_model_id}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* 切换主渠道按钮 */}
                      <td className="py-3.5 px-3">
                        {isPrimary ? (
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand/15 border border-brand/35 px-3 py-1 text-[11px] font-semibold text-brand shadow-sm">
                            <Star className="size-3 fill-amber-400 text-amber-400" />
                            <span>默认主选 (Active)</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSetPrimary(row.id)}
                            disabled={isBusy || !row.enabled}
                            className="inline-flex h-[28px] items-center gap-1.5 rounded-lg border border-white/[0.12] bg-white/[0.04] px-2.5 text-[11px] font-medium text-gray-300 transition-all hover:border-brand/40 hover:bg-brand/10 hover:text-brand active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
                            title={!row.enabled ? '请先启用该渠道再设为主选' : '点击设为默认主选渠道'}
                          >
                            {isBusy ? (
                              <RefreshCw className="size-3 animate-spin text-brand" />
                            ) : (
                              <Star className="size-3 text-gray-400 group-hover:text-brand" />
                            )}
                            <span>设为主选</span>
                          </button>
                        )}
                      </td>

                      {/* 启用/禁用切换 */}
                      <td className="py-3.5 px-3">
                        <button
                          type="button"
                          onClick={() => handleToggleEnabled(row.id, row.enabled)}
                          disabled={isBusy}
                          className={`inline-flex h-[24px] items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium transition-all ${
                            row.enabled
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                              : 'bg-white/[0.05] text-gray-400 border border-white/[0.10] hover:bg-white/[0.10]'
                          }`}
                        >
                          <span className={`size-1.5 rounded-full ${row.enabled ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                          {row.enabled ? '已启用' : '已禁用'}
                        </button>
                      </td>

                      {/* 健康诊断 */}
                      <td className="py-3.5 px-3">
                        <StatusBadge tone={healthTone(row.health_status)}>
                          {row.health_status === 'healthy' ? '正常' : row.health_status === 'degraded' ? '降级' : '异常'}
                        </StatusBadge>
                      </td>

                      {/* 熔断状态 */}
                      <td className="py-3.5 px-3">
                        <StatusBadge tone={circuitTone(row.circuit_state)}>
                          {row.circuit_state === 'closed' ? '闭合正常' : row.circuit_state === 'half_open' ? '半开放' : '已熔断'}
                        </StatusBadge>
                      </td>

                      {/* 优先级 */}
                      <td className="py-3.5 px-3 font-mono tabular-nums text-white/90">
                        {row.priority}
                      </td>

                      {/* 成功率 */}
                      <td className="py-3.5 px-3 font-mono tabular-nums">
                        <span
                          className={
                            Number(row.success_rate) >= 0.9
                              ? 'text-emerald-400 font-semibold'
                              : Number(row.success_rate) >= 0.7
                              ? 'text-amber-400'
                              : 'text-red-400'
                          }
                        >
                          {row.total_recent_attempts > 0
                            ? `${(Number(row.success_rate) * 100).toFixed(1)}%`
                            : '—'}
                        </span>
                      </td>

                      {/* 延迟 */}
                      <td className="py-3.5 px-3 font-mono tabular-nums text-white/70">
                        {Number(row.average_latency_ms) > 0
                          ? `${Math.round(Number(row.average_latency_ms))}ms`
                          : '—'}
                      </td>

                      {/* 并发与排队 */}
                      <td className="py-3.5 px-3 font-mono tabular-nums text-white/70">
                        {row.active_attempt_count}/{row.concurrency_limit}
                      </td>

                      {/* 最后巡检时间 */}
                      <td className="py-3.5 px-3 text-[11px] text-white/40">
                        {formatDate(row.last_health_check_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

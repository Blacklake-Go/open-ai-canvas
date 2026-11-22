'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Activity, CheckCircle2, AlertTriangle, Clock, DollarSign,
  Coins, Layers, RefreshCw, Search, ShieldAlert, Zap,
  ExternalLink, BarChart3, Filter, ArrowUpRight
} from 'lucide-react';
import { Card, MetricCard, StatusBadge, Button } from '@/components/admin/AdminUi';
import BrandLogo from '@/components/admin/BrandLogo';

const TIME_RANGES = [
  { id: '24h', label: '过去 24 小时' },
  { id: '7d', label: '过去 7 天' },
  { id: '30d', label: '过去 30 天' },
];

const CATEGORY_NAMES = {
  image: '图像',
  video: '视频',
  audio: '音频',
  text: '智能体',
};

function formatMs(ms) {
  if (!ms || ms <= 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function ModelTelemetryClient({ initialData, initialRange = '24h' }) {
  const [range, setRange] = useState(initialRange);
  const [data, setData] = useState(initialData || {});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expandedErrorKey, setExpandedErrorKey] = useState(null);

  const fetchTelemetry = useCallback(async (selectedRange) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/models/telemetry?timeRange=${selectedRange}&limit=50`);
      const json = await res.json();
      if (res.ok && json.data) {
        setData(json.data);
      }
    } catch (err) {
      console.error('[ModelTelemetryClient] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRangeChange = (r) => {
    setRange(r);
    fetchTelemetry(r);
  };

  const kpi = data?.kpi || {
    totalCalls: 0,
    successCalls: 0,
    failedCalls: 0,
    successRate: 100,
    avgDurationMs: 0,
    p50DurationMs: 0,
    p90DurationMs: 0,
    totalCostUsd: 0,
    totalCostCny: 0,
    totalCreditsDeducted: 0,
    activeModelsCount: 0,
  };

  const topModels = data?.topModels || [];
  const errorTaxonomy = data?.errorTaxonomy || [];

  // Filter models
  const filteredModels = useMemo(() => {
    return topModels.filter((m) => {
      if (categoryFilter !== 'all' && m.category !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          m.model_name?.toLowerCase().includes(q) ||
          m.model_id?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [topModels, categoryFilter, search]);

  return (
    <div className="space-y-6">
      {/* ─── Top Control & Range Bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-surface-raised border border-line-subtle shadow-elevation-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Activity className="size-4" />
            </span>
            <h2 className="text-body font-bold text-ink">全网模型调用与遥测大盘</h2>
            <span className="rounded-full bg-emerald-500/15 text-emerald-400 px-2.5 py-0.5 text-micro font-semibold border border-emerald-500/30">
              PostgreSQL 真实链路直读
            </span>
          </div>
          <p className="mt-1 text-caption text-ink-muted leading-relaxed">
            直连生产级调用记录表，真实度量各模型吞吐调用量、成功率、P50/P90 耗时分布、上游真实账单与失败归因。
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Time Range Pills */}
          <div className="inline-flex items-center gap-1 rounded-full border border-line-subtle bg-well p-1">
            {TIME_RANGES.map((t) => {
              const active = range === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleRangeChange(t.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                    active
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-ink-muted hover:text-ink hover:bg-wash'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Refresh Button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchTelemetry(range)}
            disabled={loading}
            className="rounded-lg h-9 px-3"
            title="重新聚合拉取最新数据"
          >
            <RefreshCw className={`size-3.5 mr-1 ${loading ? 'animate-spin text-brand' : ''}`} />
            刷新数据
          </Button>
        </div>
      </div>

      {/* ─── Real KPI Metrics Grid ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard
          label="总调用量"
          value={kpi.totalCalls.toLocaleString()}
          hint={`成功 ${kpi.successCalls.toLocaleString()} · 失败 ${kpi.failedCalls.toLocaleString()}`}
          tone={kpi.totalCalls > 0 ? 'info' : 'neutral'}
        />

        <MetricCard
          label="成功率"
          value={`${kpi.successRate}%`}
          hint={kpi.failedCalls === 0 ? '全量 100% 成功' : `异常率 ${(100 - kpi.successRate).toFixed(1)}%`}
          tone={kpi.successRate >= 95 ? 'good' : kpi.successRate >= 80 ? 'warn' : 'danger'}
        />

        <MetricCard
          label="P50 耗时"
          value={formatMs(kpi.p50DurationMs)}
          hint={`P90: ${formatMs(kpi.p90DurationMs)} · 均值: ${formatMs(kpi.avgDurationMs)}`}
          tone="neutral"
        />

        <MetricCard
          label="P90 耗时"
          value={formatMs(kpi.p90DurationMs)}
          hint="90% 请求在此耗时内完成"
          tone={kpi.p90DurationMs > 30000 ? 'warn' : 'neutral'}
        />

        <MetricCard
          label="上游总成本"
          value={`$${kpi.totalCostUsd.toFixed(2)}`}
          hint={`≈ ¥${kpi.totalCostCny} (扣减点: ${kpi.totalCreditsDeducted})`}
          tone="neutral"
        />

        <MetricCard
          label="活跃模型数"
          value={kpi.activeModelsCount}
          hint={`窗口期内接收到任务的模型`}
          tone="good"
        />
      </div>

      {/* ─── Top Models Calling Leaderboard ─────────────────────────────────── */}
      <Card className="p-0 overflow-hidden">
        {/* Table Controls Header */}
        <div className="p-4 border-b border-line-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-raised">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink text-card-title flex items-center gap-2">
              <BarChart3 className="size-4 text-brand" />
              模型调用热度与性能排行
            </span>
            <span className="rounded-full bg-brand/10 text-brand px-2 py-0.5 text-micro font-semibold border border-brand/20">
              共 {filteredModels.length} 个模型
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Category Filter */}
            <div className="inline-flex items-center gap-1 rounded-full border border-line-subtle bg-well p-0.5 text-xs">
              {['all', 'image', 'video', 'audio', 'text'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoryFilter(c)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                    categoryFilter === c
                      ? 'bg-brand text-white font-semibold shadow-sm'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {c === 'all' ? '全部' : CATEGORY_NAMES[c] || c}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-48 sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-ink-subtle" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索模型名称或ID..."
                className="w-full rounded-xl border border-line-subtle bg-well pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-ink-subtle outline-none focus:border-brand"
              />
            </div>
          </div>
        </div>

        {/* Table Content */}
        {filteredModels.length === 0 ? (
          <div className="py-16 text-center text-sm text-ink-muted">
            <p>在所选时间窗口（{TIME_RANGES.find((r) => r.id === range)?.label}）内暂无模型调用记录</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line-subtle bg-white/[0.02] text-xs font-semibold text-ink-muted">
                <tr>
                  <th className="py-3 pl-4 pr-2 w-12 text-center">排名</th>
                  <th className="py-3 px-3">模型名称 / ID</th>
                  <th className="py-3 px-3">分类模态</th>
                  <th className="py-3 px-3 text-right">调用次数</th>
                  <th className="py-3 px-3 text-right">成功率</th>
                  <th className="py-3 px-3 text-right">P90 耗时</th>
                  <th className="py-3 px-3 text-right">平均耗时</th>
                  <th className="py-3 px-3 text-right">上游成本 (USD)</th>
                  <th className="py-3 pr-4 pl-3 text-right">点数扣减</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {filteredModels.map((m, idx) => {
                  const sRate = Number(m.success_rate || 100);
                  return (
                    <tr
                      key={`${m.model_id}-${idx}`}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      <td className="py-3 pl-4 pr-2 text-center">
                        <span
                          className={`inline-flex items-center justify-center size-6 rounded-full text-xs font-bold ${
                            idx === 0
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : idx === 1
                              ? 'bg-slate-300/20 text-slate-200 border border-slate-300/30'
                              : idx === 2
                              ? 'bg-amber-700/20 text-amber-500 border border-amber-700/30'
                              : 'text-ink-subtle'
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <BrandLogo model={{ id: m.model_id, name: m.model_name }} size="sm" className="rounded-md shrink-0" />
                          <div className="min-w-0">
                            <div className="font-semibold text-ink flex items-center gap-2">
                              <span className="truncate">{m.model_name}</span>
                              {m.tier === 'core' && (
                                <span className="rounded-full bg-brand/15 text-brand px-1.5 py-0.2 text-[10px] font-bold shrink-0">
                                  Core
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-caption text-ink-subtle truncate">{m.model_id}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="rounded bg-white/[0.04] px-2 py-0.5 text-xs text-ink-muted">
                          {CATEGORY_NAMES[m.category] || m.category}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-semibold text-ink">
                        {Number(m.total_calls).toLocaleString()}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span
                            className={`font-mono font-semibold text-xs ${
                              sRate >= 95
                                ? 'text-emerald-400'
                                : sRate >= 80
                                ? 'text-amber-400'
                                : 'text-red-400'
                            }`}
                          >
                            {sRate}%
                          </span>
                          <span className="text-micro text-ink-subtle">
                            ({m.success_calls}/{m.total_calls})
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-ink-muted text-xs">
                        {formatMs(m.p90_duration_ms)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-ink-muted text-xs">
                        {formatMs(m.avg_duration_ms)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-ink-muted text-xs">
                        ${Number(m.cost_usd || 0).toFixed(4)}
                      </td>

                      <td className="py-3 pr-4 pl-3 text-right font-mono text-brand font-medium text-xs">
                        {Number(m.credits_deducted || 0).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ─── Real Error Attribution & Taxonomy Cluster ─────────────────────── */}
      <Card className="p-5">
        <div className="flex items-center justify-between pb-4 border-b border-line-subtle mb-4">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
              <ShieldAlert className="size-4" />
            </span>
            <div>
              <h3 className="text-body font-bold text-ink">真实失败归因聚类分析 (Error Taxonomy)</h3>
              <p className="text-caption text-ink-muted mt-0.5">
                实时聚合生产环境失败请求，按合规拦截、并发限流、超时等维度归因聚类，杜绝盲目调试。
              </p>
            </div>
          </div>

          <span className="rounded-full bg-white/[0.04] px-3 py-1 text-xs text-ink-muted">
            累计异常: <span className="font-bold text-red-400">{kpi.failedCalls}</span> 次
          </span>
        </div>

        {errorTaxonomy.length === 0 ? (
          <div className="py-8 text-center text-sm text-emerald-400 flex items-center justify-center gap-2 bg-emerald-500/[0.05] rounded-xl border border-emerald-500/20">
            <CheckCircle2 className="size-4 text-emerald-400" />
            <span>在所选时间窗口（{TIME_RANGES.find((r) => r.id === range)?.label}）内零调用异常，全网通道运行极其稳定！</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {errorTaxonomy.map((item) => {
              const isExpanded = expandedErrorKey === item.categoryKey;
              return (
                <div
                  key={item.categoryKey}
                  className="rounded-xl border border-line-subtle bg-surface p-4 flex flex-col justify-between space-y-3 hover:border-line transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-ink text-sm flex items-center gap-1.5">
                        <AlertTriangle className="size-3.5 text-amber-400 shrink-0" />
                        {item.label}
                      </span>
                      <span className="font-mono text-xs font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                        {item.count} 次 ({item.percentage}%)
                      </span>
                    </div>

                    {/* Ratio Bar */}
                    <div className="w-full bg-white/[0.06] rounded-full h-1.5 mt-2 overflow-hidden">
                      <div
                        className="bg-red-400 h-full rounded-full"
                        style={{ width: `${Math.min(100, Math.max(5, item.percentage))}%` }}
                      />
                    </div>
                  </div>

                  {/* Sample Errors */}
                  {item.examples?.length > 0 && (
                    <div className="pt-2 border-t border-line-subtle space-y-1">
                      <div className="text-[11px] text-ink-subtle flex items-center justify-between">
                        <span>真实样例错误:</span>
                        <button
                          type="button"
                          onClick={() => setExpandedErrorKey(isExpanded ? null : item.categoryKey)}
                          className="text-brand font-semibold hover:underline"
                        >
                          {isExpanded ? '收起' : '展开'}
                        </button>
                      </div>
                      <div className="space-y-1">
                        {(isExpanded ? item.examples : item.examples.slice(0, 1)).map((ex, i) => (
                          <div
                            key={i}
                            className="font-mono text-[10px] text-ink-muted bg-white/[0.03] p-1.5 rounded border border-white/[0.04] break-all"
                          >
                            {ex}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

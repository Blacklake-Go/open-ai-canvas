'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/admin/AdminUi';
import {
  BarChart3,
  RefreshCw,
  Users,
  Eye,
  Clock,
  ArrowUpRight,
  Globe,
  Radio,
  ExternalLink,
  ShieldCheck,
  Activity,
  Layers,
} from 'lucide-react';

export default function Ga4MetricsDashboardCard({ ga4Config }) {
  const [range, setRange] = useState('7d');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  const fetchMetrics = useCallback(async (selectedRange) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/visitors/analytics/ga4?range=${selectedRange}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.data) {
        setData(json.data);
        setLastFetched(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.warn('[Ga4MetricsDashboard] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics(range);
  }, [fetchMetrics, range]);

  const isConfigured = Boolean(data?.configured);
  const realtime = data?.realtime || { activeUsers: 0, topPages: [] };
  const summary = data?.summary || {
    activeUsers: 0,
    newUsers: 0,
    screenPageViews: 0,
    averageSessionDuration: 0,
    bounceRate: 0,
  };
  const topPages = data?.topPages || [];
  const topCountries = data?.topCountries || [];

  // 格式化秒数为分秒
  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '0 秒';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s} 秒`;
    return `${m} 分 ${s} 秒`;
  };

  return (
    <Card className="p-6 border border-white/10 bg-black/40">
      {/* 头部与操作区 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-brand">
            <Activity className="size-4" />
          </div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white text-sm">GA4 核心数据看板</h3>
            <span className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] text-brand font-semibold">
              <Radio className="size-2 animate-pulse text-brand" />
              <span>Data API 直连</span>
            </span>
          </div>
        </div>

        {/* 范围选择与刷新 */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-white/10 bg-black/40 p-0.5">
            {[
              { id: 'today', label: '今日' },
              { id: '7d', label: '近 7 天' },
              { id: '30d', label: '近 30 天' },
            ].map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setRange(btn.id)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  range === btn.id
                    ? 'bg-brand text-white shadow-sm font-semibold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => fetchMetrics(range)}
            aria-label="刷新 GA4 数据源"
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-gray-300 hover:bg-white/[0.08] hover:text-white disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`size-3 ${loading ? 'animate-spin text-brand' : ''}`} />
            <span>{loading ? '拉取中...' : '刷新'}</span>
          </button>
        </div>
      </div>

      {/* 未配置或凭据缺失时的引导卡片 */}
      {!isConfigured ? (
        <div className="my-6 rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 text-center">
          <div className="mx-auto flex size-10 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-brand mb-2.5">
            <BarChart3 className="size-5" />
          </div>
          <h4 className="font-semibold text-white text-sm">尚未连接 GA4 数据源</h4>
          <p className="mx-auto mt-1 max-w-md text-xs text-gray-400">
            请在下方配置 GA4 Property ID 与服务账号密钥以激活数据看板。
          </p>
        </div>
      ) : (
        <>
          {/* 指标卡片网格 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 my-4">
            {/* 实时活跃访客 */}
            <div className="rounded-xl border border-brand/30 bg-gradient-to-b from-brand/[0.08] to-transparent p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-brand font-semibold">
                <span className="text-xs font-medium flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>实时访客</span>
                </span>
                <Users className="size-3.5" />
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-white tabular-nums">
                {realtime.activeUsers || 0}
              </div>
            </div>

            {/* 周期活跃用户 */}
            <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-xs font-medium">总活跃用户</span>
                <Users className="size-3.5 text-brand" />
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-white tabular-nums">
                {(summary.activeUsers || 0).toLocaleString()}
              </div>
            </div>

            {/* 新用户 */}
            <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-xs font-medium">新访客</span>
                <ArrowUpRight className="size-3.5 text-emerald-400" />
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-white tabular-nums">
                {(summary.newUsers || 0).toLocaleString()}
              </div>
            </div>

            {/* 浏览量 PV */}
            <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-xs font-medium">页面浏览量</span>
                <Eye className="size-3.5 text-indigo-400" />
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-white tabular-nums">
                {(summary.screenPageViews || 0).toLocaleString()}
              </div>
            </div>

            {/* 平均停留时长 */}
            <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-xs font-medium">平均停留</span>
                <Clock className="size-3.5 text-amber-400" />
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-white tabular-nums">
                {formatDuration(summary.averageSessionDuration)}
              </div>
            </div>

            {/* 跳出率 */}
            <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-xs font-medium">跳出率</span>
                <BarChart3 className="size-3.5 text-rose-400" />
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-white tabular-nums">
                {summary.bounceRate || 0}%
              </div>
            </div>
          </div>

          {/* 深度榜单：热门受访路径 Top 5 与 访客国家分布 Top 5 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            {/* 热门受访路径 */}
            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Layers className="size-3.5 text-brand" />
                  <span>热门受访路径</span>
                </h5>
                <span className="text-[11px] text-gray-500 font-mono">Top 5</span>
              </div>
              {topPages.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-500">暂无该周期页面访问记录</div>
              ) : (
                <div className="space-y-2">
                  {topPages.map((page, idx) => {
                    const maxViews = topPages[0]?.views || 1;
                    const percent = Math.min(100, Math.round((page.views / maxViews) * 100));
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono text-gray-300 truncate max-w-[200px]" title={page.path}>
                            {page.path}
                          </span>
                          <span className="font-semibold text-white">{page.views.toLocaleString()} 次</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-brand to-brand-hover transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 访客国家/地区分布 */}
            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Globe className="size-3.5 text-indigo-400" />
                  <span>访客国家 / 地区分布 (Top 5)</span>
                </h5>
                <span className="text-[11px] text-gray-400">按活跃用户排序</span>
              </div>
              {topCountries.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-500">暂无该周期地域分布数据</div>
              ) : (
                <div className="space-y-2">
                  {topCountries.map((c, idx) => {
                    const maxUsers = topCountries[0]?.users || 1;
                    const percent = Math.min(100, Math.round((c.users / maxUsers) * 100));
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-300 truncate max-w-[200px]">{c.country}</span>
                          <span className="font-semibold text-white">{c.users.toLocaleString()} 人</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-brand transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 底部状态条 */}
      <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-gray-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-3.5 text-emerald-400" />
          <span>
            {isConfigured
              ? `已连接 GA4 媒体资源 (ID: ${data.propertyId})`
              : 'GA4 数据源等待授权'}
          </span>
        </div>
        {lastFetched && <div>最后同步时间：{lastFetched}</div>}
      </div>
    </Card>
  );
}

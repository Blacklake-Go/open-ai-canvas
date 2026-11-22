'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import {
  Users,
  Radio,
  RefreshCw,
  Pause,
  Play,
  TrendingUp,
  CreditCard,
  Sparkles,
  Zap,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Layers,
  Film,
  Music,
  Image as ImageIcon,
} from 'lucide-react';
import { Card, PageHeader, StatusBadge } from '@/components/admin/AdminUi';
import { ProviderBadge } from '@/components/admin/ProviderBadges';

const PERIOD_OPTIONS = [
  { id: 'day', label: '今日 (24H)' },
  { id: 'week', label: '近 7 天 (周)' },
  { id: 'month', label: '近 30 天 (月)' },
  { id: 'year', label: '近 1 年 (年)' },
  { id: 'all', label: '历史全量' },
];

function formatTimeAgo(dateString) {
  if (!dateString) return '刚刚';
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffSec = Math.max(1, Math.floor(diffMs / 1000));
  if (diffSec < 60) return `${diffSec}秒前`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}小时前`;
  return `${Math.floor(diffHour / 24)}天前`;
}

export default function UserDashboardClient({ initialData }) {
  const [data, setData] = useState(initialData);
  const [period, setPeriod] = useState(initialData?.meta?.period || 'day');
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(10);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTrendMetric, setActiveTrendMetric] = useState('users'); // 'users' or 'creations'
  const [, startTransition] = useTransition();

  const fetchData = useCallback(async (currentPeriod, manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const res = await fetch(`/api/admin/users/dashboard?period=${currentPeriod}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.data) {
          setData(json.data);
          setCountdown(10);
        }
      }
    } catch (err) {
      console.error('[UserDashboard] Fetch failed:', err);
    } finally {
      if (manual) setIsRefreshing(false);
    }
  }, []);

  // 10 秒倒计时与自动轮询
  useEffect(() => {
    if (!isAutoRefresh) return;

    const timer = setInterval(() => {
      // 页面隐藏时暂停轮询，避免后台标签页持续请求
      if (document.visibilityState === 'hidden') return;

      setCountdown((prev) => {
        if (prev <= 1) {
          fetchData(period);
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isAutoRefresh, period, fetchData]);

  // 页面切回可见时立即补充刷新
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAutoRefresh) {
        fetchData(period);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [period, isAutoRefresh, fetchData]);

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    startTransition(() => {
      fetchData(newPeriod, true);
    });
  };

  const { metrics = {}, trends = [], distribution = {}, stream = [] } = data || {};
  const parsedGrowthRate = Number(metrics.growthRate ?? NaN);
  const growthRate = Number.isFinite(parsedGrowthRate) ? parsedGrowthRate : null;
  const maxTrendVal = Math.max(
    ...(trends?.map((t) => (activeTrendMetric === 'users' ? t.newUsers : t.creations)) || [1]),
    1
  );

  return (
    <div className="space-y-6">
      {/* 顶部标题栏与实时心跳控制 */}
      <PageHeader
        eyebrow="用户与权限 · 实时全景大屏"
        title="用户运营数据看板"
        description="全景监控创作者增长、实时 10 秒在线活跃、多时间切片演进、商业化转化与全模态偏好。"
      >
        <div className="flex flex-wrap items-center gap-3">
          {/* 10秒实时心跳胶囊 */}
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span>10s 实时监控</span>
            {isAutoRefresh && (
              <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 font-mono text-[11px] text-emerald-200">
                {countdown}s
              </span>
            )}
          </div>

          {/* 自动刷新开关 */}
          <button
            type="button"
            onClick={() => setIsAutoRefresh((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              isAutoRefresh
                ? 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
            }`}
          >
            {isAutoRefresh ? (
              <>
                <Pause size={13} />
                <span>暂停轮询</span>
              </>
            ) : (
              <>
                <Play size={13} />
                <span>恢复轮询</span>
              </>
            )}
          </button>

          {/* 手动即时刷新 */}
          <button
            type="button"
            onClick={() => fetchData(period, true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            <span>刷新</span>
          </button>
        </div>
      </PageHeader>

      {/* 日、周、月、年时间粒度切换胶囊栏 */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-surface/80 p-2 backdrop-blur-md">
        <div className="flex items-center gap-1">
          <span className="px-3 text-xs font-semibold uppercase tracking-wider text-white/40">
            时间维度
          </span>
          {/* 契约 40px Track 与 32px Item 连续胶囊 */}
          <div className="inline-flex h-10 items-center rounded-full bg-black/40 p-1 border border-white/10">
            {PERIOD_OPTIONS.map((opt) => {
              const active = period === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handlePeriodChange(opt.id)}
                  className={`h-8 rounded-full px-4 text-xs font-semibold transition-all ${
                    active
                      ? 'bg-white text-black shadow-md'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-3 text-xs text-white/40 font-mono">
          最新聚合: {data?.meta?.updatedAt ? new Date(data.meta.updatedAt).toLocaleTimeString('zh-CN', { hour12: false }) : '—'}
        </div>
      </div>

      {/* 5 大核心实时 KPI 卡片 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {/* 1. 实时在线 */}
        <Card className="p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/50">实时在线 (10s)</span>
            <Radio size={16} className="text-emerald-400 animate-pulse" />
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight text-emerald-400 font-mono">
            {metrics.onlineSessions || 0}
          </p>
          <p className="mt-1 text-[11px] text-white/40">
            近15分钟活跃: {metrics.active15mCount || 0} 人
          </p>
        </Card>

        {/* 2. 时段新增注册 */}
        <Card className="p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/50">时段新增注册</span>
            <TrendingUp size={16} className="text-brand" />
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight text-white font-mono">
            +{metrics.periodNewUsers || 0}
          </p>
          <p className="mt-1 text-[11px] text-white/40 flex items-center gap-1">
            总用户 {metrics.totalUsers || 0} · 环比
            {growthRate === null ? (
              <span className="text-white/40">—</span>
            ) : (
              <span className={growthRate >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400'}>
                {growthRate >= 0 ? `+${growthRate}%` : `${growthRate}%`}
              </span>
            )}
          </p>
        </Card>

        {/* 3. 付费转化与会员 */}
        <Card className="p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/50">付费转化率</span>
            <CreditCard size={16} className="text-purple-400" />
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight text-purple-300 font-mono">
            {metrics.payingConversionRate || '0.0'}%
          </p>
          <p className="mt-1 text-[11px] text-white/40">
            {metrics.payingUsers || 0} 位付费 · {metrics.activeSubscribers || 0} 订阅有效
          </p>
        </Card>

        {/* 4. 活跃创作者规模 */}
        <Card className="p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/50">活跃创作者</span>
            <Sparkles size={16} className="text-pink-400" />
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight text-pink-300 font-mono">
            {metrics.activeCreators || 0}
          </p>
          <p className="mt-1 text-[11px] text-white/40">
            时段内生成 {metrics.periodCreations || 0} 次任务
          </p>
        </Card>

        {/* 5. 算力总消耗 */}
        <Card className="p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/50">消耗算力点数</span>
            <Zap size={16} className="text-amber-400" />
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight text-amber-300 font-mono">
            {(metrics.periodCredits || 0).toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] text-white/40">
            流失预警: {metrics.churnRiskUsers || 0} 位用户
          </p>
        </Card>
      </div>

      {/* 中层：动态趋势柱图与走势 */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-base font-semibold text-white tracking-tight">
              用户增长与创作调用趋势
            </h2>
            <p className="mt-0.5 text-xs text-white/50">
              {period === 'day' ? '按小时分布 (00:00 - 23:00)' : period === 'week' ? '按近 7 天每日分布' : period === 'month' ? '按近 30 天每日分布' : '按月份分布'}
            </p>
          </div>

          {/* 指标切换胶囊 */}
          <div className="inline-flex rounded-full border border-white/10 bg-black/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveTrendMetric('users')}
              className={`rounded-full px-3 py-1 font-medium transition ${
                activeTrendMetric === 'users' ? 'bg-brand text-white font-bold' : 'text-white/60 hover:text-white'
              }`}
            >
              新增用户
            </button>
            <button
              type="button"
              onClick={() => setActiveTrendMetric('creations')}
              className={`rounded-full px-3 py-1 font-medium transition ${
                activeTrendMetric === 'creations' ? 'bg-pink-400 text-black font-bold' : 'text-white/60 hover:text-white'
              }`}
            >
              生成任务数
            </button>
          </div>
        </div>

        {/* 趋势图表条 */}
        <div className="mt-6 flex h-48 items-end gap-1.5 sm:gap-2">
          {trends && trends.length > 0 ? (
            trends.map((item, idx) => {
              const val = activeTrendMetric === 'users' ? item.newUsers : item.creations;
              const heightPct = Math.max(Math.round((val / maxTrendVal) * 100), 4);
              return (
                <div key={idx} className="group relative flex flex-1 flex-col items-center h-full justify-end">
                  {/* 悬停气泡 */}
                  <div className="pointer-events-none absolute -top-12 z-20 hidden rounded-lg border border-white/20 bg-surface/95 px-2.5 py-1 text-center shadow-xl backdrop-blur group-hover:block whitespace-nowrap">
                    <p className="text-[11px] text-white/60">{item.label}</p>
                    <p className="text-xs font-bold text-white">
                      {activeTrendMetric === 'users' ? `新增用户: ${item.newUsers}` : `生成任务: ${item.creations} (消耗 ${item.creditsUsed} 点)`}
                    </p>
                  </div>

                  {/* 柱状主体 */}
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full rounded-t-md transition-all duration-300 group-hover:opacity-100 ${
                      val > 0
                        ? activeTrendMetric === 'users'
                          ? 'bg-gradient-to-t from-brand/30 to-brand opacity-80'
                          : 'bg-gradient-to-t from-pink-500/30 to-pink-400 opacity-80'
                        : 'bg-white/5 opacity-30'
                    }`}
                  />
                  {/* X 轴标签 */}
                  <span className="mt-2 text-[10px] text-white/40 font-mono truncate w-full text-center">
                    {item.label}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-white/40">
              当前时段暂无趋势数据
            </div>
          )}
        </div>
      </Card>

      {/* 下层：多维度分布画像与生命周期矩阵 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 1. 登录凭据与注册来源 */}
        <Card className="p-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-sm font-semibold text-white">登录凭据与渠道分布</h3>
            <span className="text-xs text-white/40">注册入口来源</span>
          </div>
          <div className="mt-4 space-y-3">
            {distribution?.channels && distribution.channels.length > 0 ? (
              distribution.channels.map((c, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <ProviderBadge provider={c.provider} />
                    <span className="text-white/50 font-mono">
                      {c.count} 人 ({c.percentage}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${c.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-white/40">暂无渠道数据</p>
            )}
          </div>
        </Card>

        {/* 2. 创作模态偏好 */}
        <Card className="p-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-sm font-semibold text-white">AI 创作模态偏好</h3>
            <span className="text-xs text-white/40">调用频次占比</span>
          </div>
          <div className="mt-4 space-y-4">
            {distribution?.modality && distribution.modality.length > 0 ? (
              distribution.modality.map((m, i) => {
                const IconComponent = m.modality === 'video' ? Film : m.modality === 'audio' ? Music : ImageIcon;
                const colorClass = m.modality === 'video' ? 'bg-pink-400' : m.modality === 'audio' ? 'bg-amber-400' : 'bg-brand';
                return (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-white/80">
                        <IconComponent size={14} className="text-white/60" />
                        <span className="font-medium">{m.label}</span>
                      </div>
                      <span className="text-white/50 font-mono">
                        {m.creationCount} 次 ({m.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                      <div
                        className={`h-full rounded-full ${colorClass}`}
                        style={{ width: `${m.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-white/40">暂无生成偏好数据</p>
            )}
          </div>
        </Card>

        {/* 3. 用户生命周期金字塔 */}
        <Card className="p-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-sm font-semibold text-white">用户生命周期分层</h3>
            <span className="text-xs text-white/40">漏斗健康度</span>
          </div>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-300">新手期 (0-3天)</p>
                <p className="text-[11px] text-white/40">新入驻平台探索中</p>
              </div>
              <span className="text-base font-bold text-emerald-400 font-mono">
                {distribution?.lifecycle?.newUsers || 0}
              </span>
            </div>

            <div className="rounded-xl border border-brand/20 bg-brand/5 p-2.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-brand">激活期 (有创作出片)</p>
                <p className="text-[11px] text-white/40">已打通 AI 创作闭环</p>
              </div>
              <span className="text-base font-bold text-brand font-mono">
                {distribution?.lifecycle?.activated || 0}
              </span>
            </div>

            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-2.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-purple-300">成熟期 (付费会员)</p>
                <p className="text-[11px] text-white/40">高价值稳定创作者</p>
              </div>
              <span className="text-base font-bold text-purple-300 font-mono">
                {distribution?.lifecycle?.paying || 0}
              </span>
            </div>

            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-2.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-red-300">沉睡预警 (&gt;14天未登)</p>
                <p className="text-[11px] text-white/40">需定向发放召回额度</p>
              </div>
              <span className="text-base font-bold text-red-400 font-mono">
                {distribution?.lifecycle?.churnRisk || 0}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* 底层：10秒级实时用户动态脉冲流 (Live Stream) */}
      <Card className="p-5">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand" />
            </span>
            <h3 className="text-base font-semibold text-white">实时用户动态脉冲流 (10s Live Stream)</h3>
          </div>
          <span className="text-xs text-white/40">自动滚屏记录</span>
        </div>

        <div className="mt-4 divide-y divide-white/5 max-h-80 overflow-y-auto">
          {stream && stream.length > 0 ? (
            stream.map((evt) => (
              <div key={evt.id} className="py-2.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                      evt.type === 'signup'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : evt.type === 'payment'
                        ? 'border-purple-500/30 bg-purple-500/10 text-purple-300'
                        : 'border-brand/30 bg-brand/10 text-brand'
                    }`}
                  >
                    {evt.type === 'signup' ? '新注册' : evt.type === 'payment' ? '支付充值' : '任务生成'}
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-white mr-2">{evt.userName}</span>
                    <span className="text-xs text-white/60">{evt.summary}</span>
                  </div>
                </div>
                <span className="shrink-0 text-[11px] text-white/40 font-mono">
                  {formatTimeAgo(evt.createdAt)}
                </span>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-xs text-white/40">暂无实时动态事件</p>
          )}
        </div>
      </Card>
    </div>
  );
}

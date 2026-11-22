'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff, Layers, Activity, Zap, Cpu, BarChart2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { aggregateBrands } from '@/lib/utils/modelBrands.js';

export default function ActivityTab({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPublic, setIsPublic] = useState(true);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [hoveredDay, setHoveredDay] = useState(null);
  const [activeBrandId, setActiveBrandId] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    window.setTimeout(() => setToastMessage(''), 3000);
  };

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/user/activity-dashboard', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('获取活跃数据失败');
      }
      const json = await res.json();
      setData(json);
      setIsPublic(json.user?.isActivityPublic !== false);
    } catch (err) {
      setError(err.message || '网络连接异常');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleTogglePrivacy = async (checked) => {
    setIsPublic(checked);
    setSavingPrivacy(true);
    try {
      const res = await fetch('/api/user/privacy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActivityPublic: checked }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error || '保存隐私设置失败');
        setIsPublic(!checked);
      } else {
        showToast(checked ? '活跃记录已设为公开' : '活跃记录已设为私密');
      }
    } catch {
      showToast('网络连接错误');
      setIsPublic(!checked);
    } finally {
      setSavingPrivacy(false);
    }
  };

  const scrollContainerRef = React.useRef(null);
  const matrixContainerRef = React.useRef(null);

  const weeks = data?.heatmap?.weeks || [];

  const todayStr = React.useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const dateRangeText = React.useMemo(() => {
    if (!weeks.length) return '';
    const firstDay = weeks[0]?.days?.[0]?.date;
    const lastWeek = weeks[weeks.length - 1];
    const validDays = lastWeek?.days?.filter((d) => !d.isFuture) || [];
    const lastDay = validDays[validDays.length - 1]?.date || lastWeek?.days?.[lastWeek.days.length - 1]?.date;
    if (!firstDay || !lastDay) return '';
    return `${firstDay.slice(0, 7).replace('-', '.')} — ${lastDay.slice(0, 7).replace('-', '.')}`;
  }, [weeks]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
    }
  }, [weeks]);

  const totalCreationsCount = data?.metrics?.totalCreations || 0;
  const topBrands = React.useMemo(() => {
    if (Array.isArray(data?.topBrands) && data.topBrands.length > 0) {
      return data.topBrands;
    }
    if (Array.isArray(data?.topModels) && data.topModels.length > 0) {
      return aggregateBrands(data.topModels, totalCreationsCount);
    }
    return [];
  }, [data?.topBrands, data?.topModels, totalCreationsCount]);

  const getDayName = (dayOfWeek) => {
    const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return names[dayOfWeek] || '';
  };

  const WEEKDAYS = [
    { label: '周日', show: true },
    { label: '周一', show: false },
    { label: '周二', show: true },
    { label: '周三', show: false },
    { label: '周四', show: true },
    { label: '周五', show: false },
    { label: '周六', show: true },
  ];

  if (loading) {
    return (
      <div className="flex flex-col gap-6 w-full animate-pulse">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-64 bg-white/[0.05] rounded-xl" />
          <Skeleton className="h-8 w-36 bg-white/[0.04] rounded-full" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-24 bg-white/[0.05] rounded-2xl" />
          <Skeleton className="h-24 bg-white/[0.05] rounded-2xl" />
          <Skeleton className="h-24 bg-white/[0.05] rounded-2xl" />
        </div>
        <Skeleton className="h-64 w-full bg-white/[0.05] rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48 bg-white/[0.05] rounded-2xl" />
          <Skeleton className="h-48 bg-white/[0.05] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-line-subtle bg-surface/90 p-8 shadow-elevation-1">
        <p className="text-body-sm text-ink-muted">{error}</p>
        <button
          type="button"
          onClick={fetchDashboardData}
          className="mt-4 px-5 py-2 rounded-full text-xs font-semibold bg-brand text-white hover:bg-brand-hover transition-colors cursor-pointer"
        >
          重新尝试加载
        </button>
      </div>
    );
  }

  const fallbackUserNumber = user?.user_number ? String(user.user_number) : (user?.userNumber ? String(user.userNumber) : (user?.id ? String(user.id) : '创作者'));
  const currentUser = data?.user || {
    userNumber: fallbackUserNumber,
    daysActive: 1,
  };
  const metrics = data?.metrics || { totalCreations: 0, activeDays: 0, totalCredits: 0 };
  const topModels = data?.topModels || [];
  const preferences = data?.preferences || [];

  return (
    <div className="flex flex-col gap-6 w-full text-ink animate-in fade-in duration-300">
      {/* 1. 顶部工作台问候与极简隐私开关 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-line-subtle/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink font-sans">
              你好，用户{currentUser.userNumber}
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-micro font-medium border border-line-subtle bg-wash text-ink-muted">
              <span className="size-1.5 rounded-full bg-brand animate-pulse" />
              创作者
            </span>
          </div>
          <p className="mt-1 text-caption text-ink-muted">
            已探索 SupDance 第 <span className="font-semibold text-ink font-mono">{currentUser.daysActive}</span> 天 · 持续记录创作脚印与模型算力
          </p>
        </div>

        {/* 极简流线型隐私控制 */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-surface border border-line-subtle shrink-0 shadow-elevation-1">
          {isPublic ? (
            <Eye className="size-3.5 text-brand" />
          ) : (
            <EyeOff className="size-3.5 text-ink-muted" />
          )}
          <span className="text-caption text-ink-muted select-none">
            {isPublic ? '主页公开活跃' : '仅自己可见'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isPublic}
            disabled={savingPrivacy}
            onClick={() => handleTogglePrivacy(!isPublic)}
            className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
              isPublic ? 'bg-brand' : 'bg-wash-strong'
            }`}
            title="切换主页活跃记录公开状态"
          >
            <span
              className={`pointer-events-none inline-block size-3 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out mt-0.5 ml-0.5 ${
                isPublic ? 'translate-x-3' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 2. 核心 3 大指标卡（解耦为独立顶层卡片，带悬停微浮与边缘高光动效） */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* KPI 1 */}
        <div className="group relative overflow-hidden rounded-2xl border border-line-subtle bg-surface/90 p-4 transition-all duration-300 hover:border-brand-line/60 hover:bg-surface-raised hover:-translate-y-0.5 shadow-elevation-1">
          <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-brand/5 blur-2xl transition-opacity duration-500 group-hover:opacity-100 opacity-0" />
          <div className="flex items-center justify-between text-xs text-ink-muted mb-2">
            <span className="font-medium">AI 创作与作品生成</span>
            <div className="size-7 rounded-lg bg-brand-soft border border-brand-line flex items-center justify-center text-brand transition-transform group-hover:scale-110">
              <Layers className="size-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-ink tracking-tight group-hover:text-brand transition-colors">
              {metrics.totalCreations || 0}
            </span>
            <span className="text-caption text-ink-muted font-normal">次</span>
          </div>
          <p className="mt-1 text-micro text-ink-subtle">
            统计过去 365 天创作生成总量
          </p>
        </div>

        {/* KPI 2 */}
        <div className="group relative overflow-hidden rounded-2xl border border-line-subtle bg-surface/90 p-4 transition-all duration-300 hover:border-brand-line/60 hover:bg-surface-raised hover:-translate-y-0.5 shadow-elevation-1">
          <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-brand/5 blur-2xl transition-opacity duration-500 group-hover:opacity-100 opacity-0" />
          <div className="flex items-center justify-between text-xs text-ink-muted mb-2">
            <span className="font-medium">累计活跃创作天数</span>
            <div className="size-7 rounded-lg bg-brand-soft border border-brand-line flex items-center justify-center text-brand transition-transform group-hover:scale-110">
              <Activity className="size-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-ink tracking-tight group-hover:text-brand transition-colors">
              {metrics.activeDays || 0}
            </span>
            <span className="text-caption text-ink-muted font-normal">天</span>
          </div>
          <p className="mt-1 text-micro text-ink-subtle">
            全年占比 {Math.min(100, Math.round(((metrics.activeDays || 0) / 365) * 100))}% 创作日
          </p>
        </div>

        {/* KPI 3 */}
        <div className="group relative overflow-hidden rounded-2xl border border-line-subtle bg-surface/90 p-4 transition-all duration-300 hover:border-brand-line/60 hover:bg-surface-raised hover:-translate-y-0.5 shadow-elevation-1">
          <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-brand/5 blur-2xl transition-opacity duration-500 group-hover:opacity-100 opacity-0" />
          <div className="flex items-center justify-between text-xs text-ink-muted mb-2">
            <span className="font-medium">已消耗创作积分</span>
            <div className="size-7 rounded-lg bg-brand-soft border border-brand-line flex items-center justify-center text-brand transition-transform group-hover:scale-110">
              <Zap className="size-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-ink tracking-tight group-hover:text-brand transition-colors">
              {metrics.totalCredits || 0}
            </span>
            <span className="text-caption text-ink-muted font-normal">积分</span>
          </div>
          <p className="mt-1 text-micro text-ink-subtle">
            平均每次生成高效产出
          </p>
        </div>
      </div>

      {/* 3. 365 天创作活跃矩阵 (沉浸式宽幅热力图，带微光悬停即时反馈) */}
      <Card className="rounded-2xl border border-line-subtle bg-surface/90 p-6 shadow-elevation-1 overflow-hidden">
        <CardHeader className="p-0 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line-subtle/50">
          <div>
            <CardTitle className="text-sm font-bold text-ink tracking-tight flex items-center gap-2">
              <Activity className="size-4 text-brand" />
              <span>365 天创作活跃矩阵</span>
            </CardTitle>
            <p className="mt-0.5 text-micro text-ink-subtle">
              按 52 周追踪每日的作品生成、交互及模型调度记录
            </p>
          </div>
          <div className="flex items-center gap-3">
            {dateRangeText && (
              <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-micro font-mono border border-line-subtle bg-wash text-ink-muted select-none">
                {dateRangeText}
              </span>
            )}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-raised border border-line-subtle text-caption font-mono shadow-elevation-1 select-none">
              <span className="text-ink-muted">活动 <span className="font-bold text-ink">{data?.heatmap?.totalContributions || 0}</span> 次</span>
              <span className="text-line-subtle">/</span>
              <span className="text-ink-muted">活跃 <span className="font-bold text-brand">{metrics.activeDays || 0}</span> 天</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 pt-4 space-y-4">
          {/* 热力图网格容器 (横向滚动条遵守 UI 规范：可见且精致的 scrollbar-rail) */}
          <div
            ref={scrollContainerRef}
            className="overflow-x-auto scrollbar-rail pb-2"
          >
            <div ref={matrixContainerRef} className="relative w-fit min-w-full">
              {/* 月份刻度：左侧固定占位 w-8 与星期列绝对对齐 */}
              <div className="flex items-center gap-2 mb-2 select-none text-[11px] font-mono text-ink-subtle">
                <div className="w-8 shrink-0" />
                <div className="flex gap-1 flex-1 relative h-4">
                  {weeks.map((week, idx) => (
                    <div key={idx} className="w-3.5 shrink-0 text-left relative">
                      {week.monthName && (
                        <span className="absolute left-0 top-0 whitespace-nowrap font-medium text-ink-muted">
                          {week.monthName}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 52 周矩阵：星期标签与格子行 1:1 绝对对齐 */}
              <div className="flex gap-2 items-start">
                {/* 星期标签列：每行高度与格子完全锁定为 h-3.5，行距 gap-1 */}
                <div className="w-8 shrink-0 flex flex-col gap-1 pr-2 select-none font-mono text-[10px] text-ink-subtle">
                  {WEEKDAYS.map((wd, i) => (
                    <div key={i} className="h-3.5 flex items-center justify-end leading-none">
                      {wd.show ? <span>{wd.label}</span> : null}
                    </div>
                  ))}
                </div>

                {/* 52 周方格矩阵 */}
                <div className="flex gap-1 flex-1">
                  {weeks.map((week, wIndex) => (
                    <div key={week.weekIndex ?? wIndex} className="flex flex-col gap-1 shrink-0">
                      {week.days.map((day, dIndex) => {
                        const isToday = day.date === todayStr;

                        if (day.isFuture) {
                          return (
                            <div
                              key={day.date || dIndex}
                              className="w-3.5 h-3.5 rounded-[3px] border border-white/[0.03] bg-white/[0.02] opacity-30 pointer-events-none"
                            />
                          );
                        }

                        // KOYO 3.5.0 洋红艺术调色板
                        let colorClass = '';
                        if (day.count === 0 || day.level === 0) {
                          colorClass = 'bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:border-white/[0.2]';
                        } else if (day.level === 1) {
                          colorClass = 'bg-[#e11d74]/20 border border-[#e11d74]/35 hover:bg-[#e11d74]/30 hover:border-[#e11d74]/55';
                        } else if (day.level === 2) {
                          colorClass = 'bg-[#e11d74]/45 border border-[#e11d74]/60 hover:bg-[#e11d74]/55 hover:border-[#e11d74]/75';
                        } else if (day.level === 3) {
                          colorClass = 'bg-[#e11d74]/75 border border-[#e11d74]/85 hover:bg-[#e11d74]/85 hover:border-[#e11d74] text-white';
                        } else {
                          colorClass = 'bg-[#e11d74] border border-rose-300/40 shadow-elevation-1 hover:brightness-110 text-white';
                        }

                        return (
                          <div
                            key={day.date || dIndex}
                            data-date={day.date}
                            className={`relative w-3.5 h-3.5 rounded-[3px] transition-all duration-150 cursor-pointer ${colorClass} ${
                              isToday ? 'ring-2 ring-brand ring-offset-1.5 ring-offset-[#131519] z-10' : ''
                            }`}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const containerRect = matrixContainerRef.current?.getBoundingClientRect() || rect;
                              const cellCenterX = rect.left - containerRect.left + rect.width / 2;
                              const cellTopY = rect.top - containerRect.top;
                              const containerWidth = matrixContainerRef.current?.offsetWidth || 900;
                              // 浮层半宽约 75px，边缘安全边界防溢出
                              const clampedCardX = Math.max(75, Math.min(containerWidth - 75, cellCenterX));
                              const arrowOffset = Math.max(-60, Math.min(60, cellCenterX - clampedCardX));

                              setHoveredDay({
                                ...day,
                                x: clampedCardX,
                                y: cellTopY,
                                arrowOffset,
                              });
                            }}
                            onMouseLeave={() => setHoveredDay(null)}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* 实时悬浮微气泡 (Floating Tooltip：防边缘溢出 + 箭头微距对齐) */}
              {hoveredDay && (
                <div
                  className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-full -mt-2 pb-1.5 animate-in fade-in zoom-in-95 duration-100"
                  style={{ left: `${hoveredDay.x}px`, top: `${hoveredDay.y}px` }}
                >
                  <div className="relative rounded-lg border border-line-strong bg-overlay/95 px-3 py-2 text-center shadow-elevation-3 backdrop-blur-md min-w-[140px]">
                    <div className="text-[11px] font-mono text-ink-muted">
                      {hoveredDay.date} · {getDayName(hoveredDay.dayOfWeek)}
                    </div>
                    <div className="mt-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-ink">
                      {hoveredDay.count > 0 ? (
                        <>
                          <span className="size-1.5 rounded-full bg-brand animate-pulse" />
                          <span className="font-mono text-brand font-bold">{hoveredDay.count}</span>
                          <span>次创作互动</span>
                        </>
                      ) : (
                        <span className="text-micro font-normal text-ink-subtle">暂无创作生成记录</span>
                      )}
                    </div>
                    {/* 小三角：始终精准指向当前方格中心 */}
                    <div
                      className="absolute -bottom-1 size-2 rotate-45 border-r border-b border-line-strong bg-overlay"
                      style={{ left: `calc(50% + ${hoveredDay.arrowOffset || 0}px - 4px)` }}
                    />
                  </div>
                </div>
              )}

              {/* 底部悬停状态摘要与 5 阶图例 */}
              <div className="flex items-center justify-between mt-4 pt-3 text-caption text-ink-muted border-t border-line-subtle/50">
                <div className="h-5 flex items-center">
                  {hoveredDay ? (
                    <div className="flex items-center gap-2 text-caption text-ink font-mono animate-in fade-in duration-150">
                      <span className="font-semibold text-brand">{hoveredDay.date}</span>
                      <span className="text-line-subtle">·</span>
                      <span>{getDayName(hoveredDay.dayOfWeek)}</span>
                      <span className="text-line-subtle">·</span>
                      <span>
                        {hoveredDay.count > 0 ? (
                          <>记录 <span className="font-bold text-brand">{hoveredDay.count}</span> 次作品调度与交互</>
                        ) : (
                          <span className="text-ink-subtle">该日未记录创作行为</span>
                        )}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-micro text-ink-subtle">
                      <span className="size-1.5 rounded-full bg-brand/50" />
                      <span>悬停矩阵方格查看每日创作明细</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 select-none text-micro text-ink-subtle">
                  <span>较少</span>
                  <span className="w-3.5 h-3.5 rounded-[3px] bg-white/[0.04] border border-white/[0.06]" title="0 次" />
                  <span className="w-3.5 h-3.5 rounded-[3px] bg-[#e11d74]/20 border border-[#e11d74]/35" title="1-2 次" />
                  <span className="w-3.5 h-3.5 rounded-[3px] bg-[#e11d74]/45 border border-[#e11d74]/60" title="3-5 次" />
                  <span className="w-3.5 h-3.5 rounded-[3px] bg-[#e11d74]/75 border border-[#e11d74]/85 text-white" title="6-10 次" />
                  <span className="w-3.5 h-3.5 rounded-[3px] bg-[#e11d74] border border-rose-300/40 shadow-elevation-1 text-white" title=">10 次" />
                  <span>更多</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. 底部双卡片：品牌偏好 & 创作分类偏好 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 左卡片：模型品牌偏好 */}
        <Card className="rounded-2xl border border-line-subtle bg-surface/90 p-5 shadow-elevation-1 flex flex-col justify-between min-h-[220px]">
          <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between border-b border-line-subtle/40">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-brand" />
              <CardTitle className="text-card-title font-semibold text-ink tracking-tight">
                品牌
              </CardTitle>
            </div>
            <span className="text-micro font-mono text-ink-subtle">BRANDS</span>
          </CardHeader>

          <CardContent className="p-0 pt-3 flex-1 flex flex-col justify-center">
            {topBrands.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Sparkles className="size-6 text-ink-subtle mb-2 opacity-40" />
                <p className="text-body-sm text-ink-muted">暂无品牌调用数据</p>
                <p className="text-caption text-ink-subtle mt-0.5">在工作台生成作品后将自动记录</p>
              </div>
            ) : (
              <div className="space-y-3 py-1">
                {topBrands.map((item, idx) => {
                  const isActive = activeBrandId === item.id;
                  return (
                    <div
                      key={item.id || idx}
                      role="button"
                      tabIndex={0}
                      onClick={() => setActiveBrandId(isActive ? null : item.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setActiveBrandId(isActive ? null : item.id);
                        }
                      }}
                      className={`group relative flex flex-col gap-2 p-2 rounded-xl transition-all duration-300 select-none cursor-pointer ${
                        isActive
                          ? 'bg-wash/90 ring-1 ring-line-subtle shadow-elevation-1 -translate-y-0.5'
                          : 'hover:bg-wash/60'
                      }`}
                      title={item.count ? `${item.name} · ${item.count} 次调用 · 偏好比重 ${item.percentage}% (点击查看详情)` : undefined}
                    >
                      <div className="flex items-center justify-between text-xs">
                        {/* 左侧：品牌 Logo 与品牌名称 */}
                        <div className="flex items-center gap-3 min-w-0">
                          {/* 极光光晕徽标容器 */}
                          <div className="relative shrink-0">
                            {/* 极光高斯漫反射层 (参考首页背景动效规范，360° 高斯漫射 + 呼吸) */}
                            <div
                              className={`absolute -inset-2 rounded-2xl bg-gradient-to-tr ${
                                item.auroraGlow?.gradient || 'from-[#e11d74]/40 via-[#8767ff]/30 to-[#55e6ff]/35'
                              } blur-xl pointer-events-none transition-all duration-500 ${
                                isActive
                                  ? 'opacity-100 scale-125 animate-pulse'
                                  : 'opacity-0 group-hover:opacity-45 scale-100'
                              }`}
                              style={{
                                boxShadow: isActive
                                  ? `0 0 24px 2px ${item.auroraGlow?.haloColor || 'rgba(225, 29, 116, 0.4)'}`
                                  : undefined,
                              }}
                            />

                            {/* 1:1 对齐前台图像模型切换器的品牌徽标外壳 */}
                            <div
                              className={`relative size-9 rounded-xl border flex items-center justify-center p-1.5 transition-all duration-300 ease-out ${
                                isActive
                                  ? `bg-white/[0.12] ${item.auroraGlow?.borderGlow || 'border-brand/60'} shadow-elevation-2 scale-105 -translate-y-0.5 ring-1 ${item.auroraGlow?.ringGlow || 'ring-brand/30'}`
                                  : 'bg-white/[0.05] border-white/[0.08] group-hover:border-white/[0.16] group-hover:bg-white/[0.08] group-hover:-translate-y-0.5'
                              }`}
                            >
                              {item.logo ? (
                                <img
                                  src={item.logo}
                                  alt={item.name}
                                  className={`w-full h-full object-contain ${item.invert ? 'invert' : ''}`}
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const fallback = e.currentTarget.parentElement?.querySelector('.brand-fallback-badge');
                                    if (fallback) fallback.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <span
                                className="brand-fallback-badge text-[10px] font-bold uppercase w-full h-full items-center justify-center text-ink-muted"
                                style={{ display: item.logo ? 'none' : 'flex' }}
                              >
                                {item.name ? item.name.slice(0, 2) : 'AI'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`font-medium transition-colors truncate ${
                                isActive ? 'text-brand font-semibold' : 'text-ink group-hover:text-brand'
                              }`}
                            >
                              {item.name}
                            </span>
                            {item.modelDisplay && (
                              <span
                                className="text-[11px] text-ink-subtle truncate max-w-[130px] hidden sm:inline"
                                title={item.models?.join(', ')}
                              >
                                ({item.modelDisplay})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 右侧：偏好比重 */}
                        <div className="flex items-center gap-1.5 shrink-0 pl-2">
                          <span className="text-micro text-ink-subtle font-sans">偏好比重</span>
                          <span
                            className={`font-mono font-medium transition-colors ${
                              isActive ? 'text-brand font-bold' : 'text-ink'
                            }`}
                          >
                            {item.percentage}%
                          </span>
                        </div>
                      </div>

                      {/* 进度条 */}
                      <div className="w-full h-1.5 rounded-full bg-wash-strong overflow-hidden relative">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ease-out ${
                            isActive
                              ? `bg-gradient-to-r ${item.auroraGlow?.gradient || 'from-rose-500 to-[#e11d74]'} brightness-125 shadow-sm`
                              : 'bg-gradient-to-r from-rose-500 to-[#e11d74] group-hover:brightness-125'
                          }`}
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>

                      {/* 浮动微光信息展开（点击呈现品牌深度调用与专属模型家族清单） */}
                      {isActive && (
                        <div className="flex items-center justify-between pt-1 text-[11px] text-ink-muted animate-in fade-in slide-in-from-top-1 duration-200">
                          <span className="flex items-center gap-1.5 truncate">
                            <span className="size-1.5 rounded-full bg-brand animate-pulse" />
                            <span className="truncate">
                              已调用 {item.models?.length || 1} 款模型：{item.models?.join(', ') || item.name}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-ink-subtle pl-2">
                            共 {item.count} 次创作
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 右卡片：模型调用分类偏好 */}
        <Card className="rounded-2xl border border-line-subtle bg-surface/90 p-5 shadow-elevation-1 flex flex-col justify-between min-h-[220px]">
          <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between border-b border-line-subtle/40">
            <div className="flex items-center gap-2">
              <BarChart2 className="size-4 text-brand" />
              <CardTitle className="text-card-title font-semibold text-ink tracking-tight">
                模型调用分类偏好
              </CardTitle>
            </div>
            <span className="text-micro font-mono text-ink-subtle">DISTRIBUTION</span>
          </CardHeader>

          <CardContent className="p-0 pt-3 flex-1 flex flex-col justify-center">
            {preferences.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <BarChart2 className="size-6 text-ink-subtle mb-2 opacity-40" />
                <p className="text-body-sm text-ink-muted">暂无偏好分类数据</p>
                <p className="text-caption text-ink-subtle mt-0.5">在工作台生成作品后将自动记录</p>
              </div>
            ) : (
              <div className="space-y-3 py-1">
                {preferences.map((item, idx) => {
                  const categoryLabels = {
                    image: '图像生图与超清',
                    video: '动态视频运镜',
                    audio: 'AI 音乐与音效',
                    workflow: '设计智能体与工作流',
                  };
                  return (
                    <div key={idx} className="group flex flex-col gap-1.5 p-1.5 rounded-lg hover:bg-wash transition-colors">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-ink group-hover:text-brand transition-colors">
                          {categoryLabels[item.category] || item.category}
                        </span>
                        <span className="text-ink-muted font-mono">{item.percentage}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-wash-strong overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-rose-500 to-[#e11d74] rounded-full transition-all duration-700 ease-out group-hover:brightness-125"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {toastMessage && (
        <div
          role="status"
          className="fixed top-6 left-1/2 -translate-x-1/2 z-toast flex items-center gap-2 rounded-full border border-line bg-overlay px-5 py-2 text-xs font-medium text-ink shadow-elevation-4 backdrop-blur-md animate-in fade-in slide-in-from-top-2"
        >
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

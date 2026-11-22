'use client';

import { useState, useCallback } from 'react';
import { Card, StatusBadge, Button as AdminUiButton } from '@/components/admin/AdminUi';
import StandardButton from '@/components/ui/button';

// 防御性组件：确保无论导入形态如何，Button 100% 存在且有效
const Button = AdminUiButton || StandardButton || (({ children, className = '', ...props }) => (
  <button className={`inline-flex items-center justify-center rounded-lg px-4 py-2 font-medium transition ${className}`} {...props}>
    {children}
  </button>
));
import {
  MousePointerClick,
  Eye,
  Percent,
  XCircle,
  Users,
  RefreshCw,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

export default function BannerAnalyticsClient({ initialData }) {
  const [data, setData] = useState(initialData || { kpi: {}, events: [], pagination: {} });
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const fetchData = useCallback(async (currentOffset = 0) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/content/analytics?limit=${limit}&offset=${currentOffset}`);
      if (!res.ok) throw new Error('拉取分析数据失败');
      const json = await res.json();
      setData(json.data || {});
      setOffset(currentOffset);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  const handleReset = async () => {
    if (!confirm('确定要清空当前的横幅统计数据与点击流水吗？此操作不可逆，将留存高风险审计日志。')) {
      return;
    }

    setIsResetting(true);
    try {
      const res = await fetch('/api/admin/content/analytics', {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('重置失败');
      await fetchData(0);
      alert('横幅统计数据已成功清空');
    } catch (err) {
      alert(err.message);
    } finally {
      setIsResetting(false);
    }
  };

  const { kpi = {}, events = [], pagination = {} } = data;
  const total = pagination.total || 0;
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  return (
    <div className="space-y-6">
      {/* 顶部统计卡片 (KPIs) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="p-4 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-brand/10 text-brand">
            <Eye className="size-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-white/50">累计曝光展示</div>
            <div className="text-xl font-extrabold text-white mt-0.5">
              {kpi.impressions?.toLocaleString() ?? 0}
            </div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
            <MousePointerClick className="size-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-white/50">真实点击次数</div>
            <div className="text-xl font-extrabold text-white mt-0.5">
              {kpi.clicks?.toLocaleString() ?? 0}
            </div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
            <Percent className="size-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-white/50">点击转化率 (CTR)</div>
            <div className="text-xl font-extrabold text-brand mt-0.5">
              {kpi.ctr ?? 0}%
            </div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
            <XCircle className="size-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-white/50">用户主动关闭</div>
            <div className="text-xl font-extrabold text-white mt-0.5">
              {kpi.dismissals?.toLocaleString() ?? 0}
            </div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400">
            <Users className="size-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-white/50">独立访客 (UV)</div>
            <div className="text-xl font-extrabold text-white mt-0.5">
              {kpi.uniqueVisitors?.toLocaleString() ?? 0}
            </div>
          </div>
        </Card>
      </div>

      {/* 点击与事件流水明细卡片 */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div>
            <h2 className="text-sm font-bold text-white">用户点击与交互流水明细</h2>
            <p className="text-[11px] text-white/40 mt-0.5">
              记录每一次真实发生的用户点击、曝光或关闭操作（共 {total} 条记录）
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchData(offset)}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>刷新</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              disabled={isResetting || total === 0}
              className="flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/20 transition-all disabled:opacity-50"
            >
              <Trash2 className="size-3.5" />
              <span>清空测试数据</span>
            </button>
          </div>
        </div>

        {/* 流水表格 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] text-white/40">
                <th className="pb-3 font-semibold">事件类型</th>
                <th className="pb-3 font-semibold">发生时间</th>
                <th className="pb-3 font-semibold">触发页面</th>
                <th className="pb-3 font-semibold">目标链接</th>
                <th className="pb-3 font-semibold">语言环境</th>
                <th className="pb-3 font-semibold">用户属性</th>
                <th className="pb-3 font-semibold">访客 IP (脱敏)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-white/80">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-white/30">
                    暂无交互埋点记录（可在前台点击顶部横幅测试产生流水）
                  </td>
                </tr>
              ) : (
                events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3">
                      {evt.eventType === 'click' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          点击 CLICK
                        </span>
                      ) : evt.eventType === 'dismiss' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          关闭 DISMISS
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-brand/10 text-brand border border-brand/20">
                          曝光 VIEW
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-white/60 font-mono text-[11px]">
                      {new Date(evt.createdAt).toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3 font-mono text-[11px] text-ink">
                      {evt.pagePath}
                    </td>
                    <td className="py-3 font-mono text-[11px] text-white/50 max-w-[200px] truncate" title={evt.targetUrl}>
                      {evt.targetUrl ? (
                        <span className="flex items-center gap-1">
                          <span className="truncate">{evt.targetUrl}</span>
                          <ExternalLink className="size-3 flex-shrink-0 opacity-40" />
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-3">
                      <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] font-mono text-white/70">
                        {evt.locale || 'zh-CN'}
                      </span>
                    </td>
                    <td className="py-3 text-[11px]">
                      {evt.userId ? (
                        <span className="text-brand font-mono font-bold" title={evt.userId}>
                          用户 #{evt.userId.slice(0, 8)}
                        </span>
                      ) : (
                        <span className="text-white/40">匿名访客</span>
                      )}
                    </td>
                    <td className="py-3 font-mono text-[11px] text-white/40">
                      {evt.ip}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页导航 */}
        {total > limit && (
          <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs text-white/50">
            <span>
              显示第 {offset + 1} - {Math.min(offset + limit, total)} 条，共 {total} 条
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!hasPrev || isLoading}
                onClick={() => fetchData(offset - limit)}
                className="flex items-center gap-1 rounded px-2.5 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all text-white"
              >
                <ChevronLeft className="size-3.5" />
                <span>上一页</span>
              </button>
              <button
                type="button"
                disabled={!hasNext || isLoading}
                onClick={() => fetchData(offset + limit)}
                className="flex items-center gap-1 rounded px-2.5 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all text-white"
              >
                <span>下一页</span>
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

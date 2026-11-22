'use client';

import { Card } from '@/components/admin/AdminUi';
import { Activity, Sparkles, Layers, ShieldCheck, ExternalLink } from 'lucide-react';

export default function AnalyticsOverviewCard({ config, links }) {
  const c = config || {};
  const activeCount = [
    Boolean(c.googleAnalytics?.enabled && c.googleAnalytics?.measurementId),
    Boolean(c.baiduTongji?.enabled && c.baiduTongji?.siteId),
    Boolean(c.microsoftClarity?.enabled && c.microsoftClarity?.projectId),
    Boolean(c.customScript?.enabled && (c.customScript?.code || c.customScript?.customCode)),
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* 4 核心状态指示卡 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-400">已就绪平台</span>
            <Activity className="size-4 text-brand" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-white tabular-nums">
            {activeCount} / 4
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {activeCount > 0 ? `已激活 ${activeCount} 个分析工具` : '当前尚未启用第三方分析工具'}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-400">加载性能策略</span>
            <Sparkles className="size-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-400">零阻塞</p>
          <p className="mt-1 text-xs text-gray-400">afterInteractive & lazyOnload</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-400">单页无刷新追踪</span>
            <Layers className="size-4 text-brand" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-brand">全自动</p>
          <p className="mt-1 text-xs text-gray-400">路由监听器自动分发 PV 命中</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-400">数据与隐私安全</span>
            <ShieldCheck className="size-4 text-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-white">安全合规</p>
          <p className="mt-1 text-xs text-gray-400">未启用平台 0 DOM / 0 脚本请求</p>
        </Card>
      </div>

      {/* 官方实时控制台快捷跳转通道 */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.08] bg-surface/70 px-4 py-3">
        <span className="text-xs font-medium text-gray-400">控制台直达通道：</span>
        <a
          href={links?.googleAnalytics?.dashboardUrl || 'https://analytics.google.com/analytics/web/#/realtime'}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-brand hover:border-brand/30 hover:bg-brand/10 transition-colors"
        >
          <span>GA4 实时看板</span>
          <ExternalLink className="size-3" />
        </a>
        <a
          href={links?.baiduTongji?.dashboardUrl || 'https://tongji.baidu.com/web/welcome/login'}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-brand hover:border-brand/30 hover:bg-brand/10 transition-colors"
        >
          <span>百度统计概览</span>
          <ExternalLink className="size-3" />
        </a>
        <a
          href={links?.microsoftClarity?.dashboardUrl || 'https://clarity.microsoft.com/projects'}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-brand hover:border-brand/30 hover:bg-brand/10 transition-colors"
        >
          <span>Clarity 热力图</span>
          <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  );
}

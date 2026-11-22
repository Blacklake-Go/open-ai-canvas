'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { BarChart3, Globe } from 'lucide-react';
import { SegmentedControl } from 'studio/ui/navigation';
import AnalyticsTab from './tabs/AnalyticsTab';
import SeoTab from './tabs/SeoTab';

const TAB_OPTIONS = [
  {
    value: 'analytics',
    label: '访客统计与分析',
    icon: <BarChart3 className="size-4 shrink-0" aria-hidden="true" />,
  },
  {
    value: 'seo',
    label: 'SEO 与搜索引擎链接',
    icon: <Globe className="size-4 shrink-0" aria-hidden="true" />,
  },
];

export default function VisitorsWorkbenchClient() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const tabParam = searchParams?.get('tab');
  const initialTab = tabParam === 'seo' ? 'seo' : 'analytics';
  const [tab, setTab] = useState(initialTab);

  // 当外部导航或浏览器前进/后退变更 URL 时同步选项卡
  useEffect(() => {
    const current = searchParams?.get('tab');
    if (current === 'seo' || current === 'analytics') {
      setTab(current);
    } else if (!current) {
      setTab('analytics');
    }
  }, [searchParams]);

  // 选项卡切换处理：浅层更新 URL Query 参数且不触发页面重新加载与布局跳动
  const handleTabChange = useCallback(
    (nextTab) => {
      setTab(nextTab);
      if (typeof window !== 'undefined') {
        const currentParams = new URLSearchParams(window.location.search);
        if (nextTab === 'analytics') {
          currentParams.delete('tab');
        } else {
          currentParams.set('tab', nextTab);
        }
        const query = currentParams.toString();
        const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
        window.history.replaceState(null, '', nextUrl);
      }
    },
    []
  );

  return (
    <div className="space-y-6">
      {/* 顶部分段选择胶囊导航 */}
      <div className="w-full max-w-sm">
        <SegmentedControl
          ariaLabel="访客与 SEO 工作台分区"
          value={tab}
          onValueChange={handleTabChange}
          options={TAB_OPTIONS}
        />
      </div>

      {/* 选项卡内容区：采用 hidden 控制无闪烁/无 DOM 重挂载切换 */}
      <div hidden={tab !== 'analytics'} aria-hidden={tab !== 'analytics'}>
        <AnalyticsTab />
      </div>

      <div hidden={tab !== 'seo'} aria-hidden={tab !== 'seo'}>
        <SeoTab />
      </div>
    </div>
  );
}

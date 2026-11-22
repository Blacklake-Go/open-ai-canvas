'use client';

import { useState } from 'react';
import ProviderCard from '../ProviderCard';
import { StatusBadge } from '@/components/admin/AdminUi';
import { CreditCard, ShieldCheck } from 'lucide-react';

const REGION_TABS = [
  { value: 'all', label: '全部渠道' },
  { value: 'mainland_china', label: '中国大陆渠道' },
  { value: 'international', label: '海外国际渠道' },
];

export default function PaymentProvidersPanel({ providers = [], canWrite = true }) {
  const [activeTab, setActiveTab] = useState('all');

  const filteredProviders = providers.filter((p) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'mainland_china') return p.region === 'mainland_china' || p.id === 'wechat' || p.id === 'alipay';
    if (activeTab === 'international') return p.region === 'international' || p.id === 'stripe' || p.id === 'paypal';
    return true;
  });

  const configuredCount = providers.filter((p) => p.configured).length;
  const enabledCount = providers.filter((p) => p.channelEnabled !== false).length;

  return (
    <div className="flex flex-col gap-4">
      {/* 顶部渠道统计与分区切换控制台 */}
      <div className="rounded-xl border border-white/[0.08] bg-surface/90 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
          {/* 分区 Tab 药丸胶囊 */}
          <div
            role="radiogroup"
            aria-label="支付渠道分区"
            className="flex items-stretch gap-1 rounded-full border border-white/[0.08] bg-black/30 p-1"
          >
            {REGION_TABS.map((tab) => {
              const selected = tab.value === activeTab;
              const count = tab.value === 'all'
                ? providers.length
                : tab.value === 'mainland_china'
                  ? providers.filter((p) => p.id === 'wechat' || p.id === 'alipay').length
                  : providers.filter((p) => p.id === 'stripe' || p.id === 'paypal').length;

              return (
                <button
                  key={tab.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setActiveTab(tab.value)}
                  className={`h-7 rounded-full px-3.5 text-label font-medium transition-colors duration-200 ${
                    selected
                      ? 'bg-white/[0.12] text-white shadow-elevation-1'
                      : 'text-gray-400 hover:bg-white/[0.05] hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                  <span className="ml-1.5 opacity-60 font-mono text-[11px]">{count}</span>
                </button>
              );
            })}
          </div>

          {/* 状态统计指示徽标 */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-caption text-gray-500">
              就绪渠道: <strong className="font-mono text-emerald-400">{configuredCount}</strong> / {providers.length}
            </span>
            <span className="text-caption text-gray-500">
              前台展示: <strong className="font-mono text-white">{enabledCount}</strong> / {providers.length}
            </span>
            <StatusBadge tone={configuredCount === providers.length ? 'good' : 'neutral'}>
              {configuredCount === providers.length ? '全网关已就绪' : '部分待配置'}
            </StatusBadge>
          </div>
        </div>

        <p className="mt-2 text-body-sm text-gray-500">
          支付渠道仅在凭证配置完整且前台开关启用时向终端用户展现。点击卡片右下角「渠道配置浮窗」可随时录入商户密钥、一键切换生产与沙盒 API 模式，并排查实时 Webhook 投递日志。
        </p>
      </div>

      {/* 支付渠道卡片网格组 */}
      <div className="grid gap-3.5 sm:grid-cols-2 2xl:grid-cols-4">
        {filteredProviders.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            canWrite={canWrite}
          />
        ))}
      </div>
    </div>
  );
}

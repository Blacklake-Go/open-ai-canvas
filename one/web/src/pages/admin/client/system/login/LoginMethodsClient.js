'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SegmentedControl } from 'studio/ui/navigation';
import SocialLoginPanel from './SocialLoginPanel';
import SmsProvidersClient from './SmsProvidersClient';

const CATEGORIES = [
  { value: 'social', label: '社交登录' },
  { value: 'sms', label: '短信登录' },
];

const CATEGORY_HINTS = {
  social: '按访客 IP 分区管理境内外 OAuth 渠道、凭据与网关探针',
  sms: '短信线路、密钥、健康探针与真实测试投递',
};

function summarize(category, data) {
  if (category === 'social') {
    const ready = data.regions
      .flatMap((region) => region.channels)
      .filter((channel) => channel.enabled && channel.configured).length;
    const total = data.regions.flatMap((region) => region.channels).length;
    return { tone: ready > 0 ? 'good' : 'warn', text: `${ready}/${total} 个渠道可用` };
  }
  const providers = Array.isArray(data.smsInitial?.providers) ? data.smsInitial.providers : [];
  const ready = providers.filter((item) => item?.enabled !== false && item?.configured).length;
  return {
    tone: ready > 0 ? 'good' : 'warn',
    text: ready > 0 ? `${ready} 条线路就绪` : '短信线路待配置',
  };
}

export default function LoginMethodsClient({ regions, diagnostics, smsInitial, canWrite }) {
  const searchParams = useSearchParams();
  const requested = searchParams.get('category');
  const [category, setCategory] = useState(
    CATEGORIES.some((item) => item.value === requested) ? requested : 'social'
  );

  const data = { regions, smsInitial };
  const summary = summarize(category, data);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <SegmentedControl
          ariaLabel="登录方式类别"
          value={category}
          onValueChange={setCategory}
          options={CATEGORIES.map((item) => {
            const itemSummary = summarize(item.value, data);
            return {
              ...item,
              icon: (
                <span
                  aria-hidden="true"
                  className={`size-2 rounded-full ${itemSummary.tone === 'good' ? 'bg-success' : 'bg-warning'}`}
                />
              ),
            };
          })}
        />
        <p className="text-body-sm text-ink-muted">
          {CATEGORY_HINTS[category]}
          <span className="text-ink-subtle"> · {summary.text}</span>
        </p>
      </div>

      <div hidden={category !== 'social'}>
        <SocialLoginPanel regions={regions} diagnostics={diagnostics} canWrite={canWrite} />
      </div>
      <div hidden={category !== 'sms'}>
        <SmsProvidersClient initial={smsInitial} canWrite={canWrite} />
      </div>
    </div>
  );
}

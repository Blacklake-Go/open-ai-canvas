'use client';

import { useState } from 'react';
import { normalizeOAuthPolicy } from '@/lib/auth/oauthPolicy';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';
import { StatusBadge } from '@/components/admin/AdminUi';
import SocialProviderCard, { Toggle } from './SocialProviderCard';
import { getSocialIcon } from '@/components/SocialIcons';
import { Zap } from 'lucide-react';

const REGION_TABS = [
  { value: 'mainland_china', label: '中国大陆渠道' },
  { value: 'international', label: '海外渠道' },
];

function initialEnabled(regions) {
  const map = {};
  for (const region of regions) {
    for (const channel of region.channels) map[channel.id] = channel.enabled;
  }
  return map;
}

export default function SocialLoginPanel({ regions, diagnostics, canWrite }) {
  const [region, setRegion] = useState(regions[0]?.id || 'mainland_china');
  const [enabled, setEnabled] = useState(() => initialEnabled(regions));
  const [savedEnabled, setSavedEnabled] = useState(() => initialEnabled(regions));
  const [policies,setPolicies] = useState(() => Object.fromEntries(regions.flatMap(r => r.channels.map(c => [c.id,normalizeOAuthPolicy(c.policy)]))));
  const [policyDirty,setPolicyDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');

  const active = regions.find((item) => item.id === region) || regions[0];
  const tabs = REGION_TABS.filter((tab) => regions.some((item) => item.id === tab.value));
  const dirty = policyDirty || regions.some((item) =>
    item.channels.some((channel) => Boolean(enabled[channel.id]) !== Boolean(savedEnabled[channel.id]))
  );

  const setChannelEnabled = (id, next) => setEnabled((current) => ({ ...current, [id]: next }));

  const save = async () => {
    setBusy(true);
    setMessage('');
    try {
      const config = Object.fromEntries(
        regions.map((item) => [
          item.id,
          item.channels.map((channel) => ({ id: channel.id, enabled: Boolean(enabled[channel.id]), policy: policies[channel.id] })),
        ])
      );
      const response = await fetch('/api/admin/login/social-regions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({ config }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || '分区配置保存失败');
      setSavedEnabled({ ...enabled });
      setPolicyDirty(false);
      setNotice('前台展示分区已更新，下一次访客打开登录框即生效。');
      setTimeout(() => setNotice(''), 4000);
    } catch (error) {
      setMessage(error.message || '分区配置保存失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-white/[0.08] bg-surface/90 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div
            role="radiogroup"
            aria-label="社交登录分区"
            className="flex items-stretch gap-1 rounded-full border border-white/[0.08] bg-black/30 p-1"
          >
            {tabs.map((tab) => {
              const selected = tab.value === region;
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setRegion(tab.value)}
                  className={`h-7 rounded-full px-3.5 text-label font-medium transition-colors duration-200 ${
                    selected
                      ? 'bg-white/[0.12] text-white shadow-elevation-1'
                      : 'text-gray-400 hover:bg-white/[0.05] hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span
              className="font-mono text-caption text-gray-500"
              title="识别到的来访 IP 与来源请求头"
            >
              {`${diagnostics.clientIp || '未知 IP'} · ${diagnostics.ipSource || '未知来源'}`}
            </span>
            <StatusBadge tone={diagnostics.region === 'mainland_china' ? 'info' : 'neutral'}>
              {diagnostics.region === 'mainland_china' ? '本次访问：中国大陆' : '本次访问：海外'}
            </StatusBadge>
          </div>
        </div>

        <p className="mt-2 text-body-sm text-gray-500">
          分区只认访客的网络 IP，语言、时区与账号资料都不会改变它。
          <span className="text-gray-400">{active?.description}</span>
        </p>

        {(diagnostics.ipSource === 'unknown-defaults' || diagnostics.ipSource === 'missing-headers') && (
          <p className="mt-1.5 text-body-sm text-amber-400">
            来访 IP 落到了回环默认值，说明 nginx 没有透传真实 IP（<span className="font-mono text-caption">proxy_set_header X-Real-IP $remote_addr</span>）。
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        {active?.channels.map((channel) => {
          const provider = channel.provider || channel;
          return provider ? (
            <SocialProviderCard
              key={channel.id}
              provider={provider}
              enabled={Boolean(enabled[channel.id])}
              configured={channel.configured}
              canWrite={canWrite}
              onToggleEnabled={(next) => setChannelEnabled(channel.id, next)}
            />
          ) : (
            <div
              key={channel.id}
              className="flex flex-col rounded-xl border border-red-500/25 bg-red-500/[0.06] p-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
                    {(() => {
                      const Icon = getSocialIcon(channel.id) || Zap;
                      return <Icon size={18} />;
                    })()}
                  </span>
                  <h3 className="min-w-0 truncate text-card-title text-white" title={channel.id}>
                    {channel.id}
                  </h3>
                </div>
                <StatusBadge tone="danger">记录缺失</StatusBadge>
              </div>
              <p className="mt-2 text-body-sm text-red-400">
                缺少后台凭据记录，无法在此配置密钥，请检查供应商中台数据。
              </p>
              <div className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-2.5">
                <Toggle
                  checked={Boolean(enabled[channel.id])}
                  disabled={!canWrite}
                  onChange={(next) => setChannelEnabled(channel.id, next)}
                  label="前台展示"
                />
                <span className="text-label text-gray-400">前台展示</span>
              </div>
            </div>
          );
        })}
      </div>

      <section className="rounded-xl border border-line bg-surface p-4 space-y-4">
        <h3 className="text-card-title text-ink">授权后入站与账号安全策略</h3>
        <p className="text-body-sm text-ink-muted">首次授权必须确认账号名和已验证邮箱。安全必填字段不可关闭；已有账户关联始终需要本地验证。策略保存后即时生效。</p>
        {active?.channels.map(channel => <fieldset key={channel.id} disabled={!canWrite || busy} className="rounded-xl border border-line p-4 space-y-2">
          <legend className="text-label text-ink">{channel.name || channel.id}</legend>
          {Object.entries({allowPrefill:'允许预填提供者资料',requireLocalEmail:'始终要求本地邮箱验证',allowBind:'允许绑定',allowUnbind:'允许解绑',allowReplace:'允许换绑'}).map(([key,label]) => <label key={key} className="flex items-center gap-2 text-body-sm text-ink-muted"><Switch aria-label={`${channel.id} ${label}`} checked={policies[channel.id]?.[key] || false} onCheckedChange={checked=>{setPolicies(p=>({...p,[channel.id]:{...p[channel.id],[key]:checked}}));setPolicyDirty(true);}} />{label}</label>)}
          <label className="flex items-center gap-2 text-body-sm text-ink-muted"><Switch aria-label={`${channel.id} 邮箱冲突时拒绝关联`} checked={policies[channel.id]?.conflict === 'reject'} onCheckedChange={checked=>{setPolicies(p=>({...p,[channel.id]:{...p[channel.id],conflict:checked?'reject':'verify_existing'}}));setPolicyDirty(true);}} />邮箱冲突时拒绝关联（关闭则验证后关联）</label>
        </fieldset>)}
      </section>

      {canWrite && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-surface/90 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-body-sm text-gray-500">
              {dirty ? '存在未保存的分区展示变更' : '分区展示与线上一致'}
            </span>
            {notice && <span className="text-body-sm text-emerald-400">{notice}</span>}
            {message && <span className="text-body-sm text-red-400">{message}</span>}
          </div>
          <button
            type="button"
            onClick={save}
            disabled={busy || !dirty}
            className="inline-flex h-8 items-center rounded-full bg-brand px-4 text-body-sm font-semibold text-white transition hover:bg-brand-hover active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? '保存中…' : '保存分区设置'}
          </button>
        </div>
      )}
    </div>
  );
}

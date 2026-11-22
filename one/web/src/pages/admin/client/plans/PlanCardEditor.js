'use client';

import { useState } from 'react';
import { Card, StatusBadge } from '@/components/admin/AdminUi';
import { Sparkles, Check, Crown, Zap, Flame, ShieldCheck, HelpCircle, Trash2, Wand2 } from 'lucide-react';
import { EXCLUSIVE_BENEFITS, getDefaultExclusiveFeatures } from '@/lib/pricing/exclusiveBenefits';
import { CREDIT_PRICING_POLICY } from '@/lib/pricing/creditPolicy';

const ICON_MAP = {
  Sparkles,
  Crown,
  Zap,
  Flame,
  ShieldCheck,
  HelpCircle,
  Wand2,
};

export default function PlanCardEditor({ plan }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(plan.name || '');
  const [monthlyCny, setMonthlyCny] = useState(plan.monthly_cny ?? plan.monthlyCny ?? 0);
  const [monthlyUsd, setMonthlyUsd] = useState(plan.monthly_usd ?? plan.monthlyUsd ?? 0);
  const [quarterlyCny, setQuarterlyCny] = useState(plan.quarterlyCny ?? (plan.monthlyCny ? Math.round(plan.monthlyCny * 3 * 0.9) : 0));
  const [quarterlyUsd, setQuarterlyUsd] = useState(plan.quarterlyUsd ?? (plan.monthlyUsd ? Math.round(plan.monthlyUsd * 3 * 0.9) : 0));
  const [yearlyCny, setYearlyCny] = useState(plan.yearlyCny ?? (plan.monthlyCny ? plan.monthlyCny * 10 : 0));
  const [yearlyUsd, setYearlyUsd] = useState(plan.yearlyUsd ?? (plan.monthlyUsd ? plan.monthlyUsd * 10 : 0));
  const [quotaBase, setQuotaBase] = useState(plan.quotaBase ?? (plan.id === 'starter' ? 2000 : plan.id === 'basic' ? 5000 : plan.id === 'plus' ? 10000 : plan.id === 'pro' ? 20000 : 0));
  const [concurrency, setConcurrency] = useState(plan.concurrency ?? 5);
  const [asyncConcurrency, setAsyncConcurrency] = useState(plan.asyncConcurrency ?? 10);
  const [portraitCapacity, setPortraitCapacity] = useState(plan.portraitCapacity ?? 2);
  const [storageGb, setStorageGb] = useState(plan.storageGb ?? plan.meta?.storageGb ?? 5);
  const [badge, setBadge] = useState(plan.badge || '');
  const [exclusiveFeatures, setExclusiveFeatures] = useState(
    Array.isArray(plan.exclusiveFeatures) && plan.exclusiveFeatures.length > 0
      ? plan.exclusiveFeatures
      : (Array.isArray(plan.meta?.exclusiveFeatures) ? plan.meta.exclusiveFeatures : getDefaultExclusiveFeatures(plan.id))
  );
  const [features, setFeatures] = useState(Array.isArray(plan.features) ? plan.features.join('\n') : '');
  const [enabled, setEnabled] = useState(Boolean(plan.enabled));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const toggleExclusive = (key) => {
    setExclusiveFeatures((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      const res = await fetch(`/api/admin/plans/${plan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          name,
          monthlyCny: Number(monthlyCny),
          monthlyUsd: Number(monthlyUsd),
          quarterlyCny: Number(quarterlyCny),
          quarterlyUsd: Number(quarterlyUsd),
          yearlyCny: Number(yearlyCny),
          yearlyUsd: Number(yearlyUsd),
          quotaBase: Number(quotaBase),
          quotaBonus: 0,
          concurrency: Number(concurrency),
          asyncConcurrency: Number(asyncConcurrency),
          portraitCapacity: Number(portraitCapacity),
          storageGb: Number(storageGb),
          badge,
          exclusiveFeatures,
          features: features.split('\n').map((s) => s.trim()).filter(Boolean),
          enabled,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.error || '保存失败');

      setMessage('配置已成功持久化并同步至前台！');
      setEditing(false);
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`确定要停用或删除套餐 "${plan.name || plan.id}" 吗？`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/plans/${plan.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d?.error?.message || d?.error || '删除失败');
      }
      window.location.reload();
    } catch (err) {
      alert(err.message);
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col justify-between border-white/[0.1] bg-[#121622]/80 backdrop-blur-md">
      <div>
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-brand">
              {plan.id}
            </span>
            {badge && (
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand border border-brand/20">
                {badge}
              </span>
            )}
          </div>
          <StatusBadge tone={enabled ? 'good' : 'neutral'}>
            {enabled ? '前台展示中' : '已隐藏'}
          </StatusBadge>
        </div>

        {!editing ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-bold text-white">{name}</h3>
              <div className="mt-2 flex flex-wrap items-baseline gap-2">
                <div>
                  <span className="text-2xl font-extrabold text-brand">¥{monthlyCny}</span>
                  <span className="text-xs text-white/40"> /月 (${monthlyUsd})</span>
                </div>
                <div className="text-[11px] text-amber-300 font-medium bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  季付: ¥{quarterlyCny}
                </div>
                <div className="text-[11px] text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  包年: ¥{yearlyCny} (${yearlyUsd})
                </div>
              </div>
            </div>

            {/* 额度资产信息 */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
              <p className="text-[11px] font-semibold text-white/40 mb-1.5">每月订阅额度资产：</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/80">月度积分: <strong className="font-mono text-brand">{quotaBase}</strong></span>
                <span className="text-white/50">兑换率: <strong className="font-mono text-amber-200">¥{CREDIT_PRICING_POLICY.cnyPerCredit} / 积分</strong></span>
              </div>
            </div>

            {/* 并发与特权限制 */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2">
                <div className="text-[10px] text-white/40">单模型并发</div>
                <div className="font-mono font-bold text-white mt-0.5">{concurrency}</div>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2">
                <div className="text-[10px] text-white/40">异步并发池</div>
                <div className="font-mono font-bold text-white mt-0.5">{asyncConcurrency}</div>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2">
                <div className="text-[10px] text-white/40">授权人像库</div>
                <div className="font-mono font-bold text-white mt-0.5">{portraitCapacity}个</div>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2">
                <div className="text-[10px] text-white/40">云端资产库</div>
                <div className="font-mono font-bold text-brand mt-0.5">{storageGb}GB</div>
              </div>
            </div>

            {/* 专属权益徽标（可勾选配置成果） */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-brand flex items-center gap-1">
                <Sparkles className="size-3 text-brand" />
                <span>已开通专属特权：</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {EXCLUSIVE_BENEFITS.map((benefit) => {
                  const active = exclusiveFeatures.includes(benefit.key);
                  const IconComponent = ICON_MAP[benefit.icon] || Sparkles;
                  return (
                    <span
                      key={benefit.key}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium border ${
                        active
                          ? 'border-brand/20 bg-brand/10 text-brand'
                          : 'border-white/5 bg-white/[0.02] text-white/30 line-through opacity-60'
                      }`}
                    >
                      <IconComponent className="size-3" />
                      <span>{benefit.label}</span>
                    </span>
                  );
                })}
              </div>
            </div>

            {/* 权益列表 */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-white/50">包含权益矩阵：</p>
              <ul className="space-y-1.5 text-xs text-white/70">
                {(Array.isArray(plan.features) ? plan.features : []).map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-brand text-[11px] mt-0.5">✔</span>
                    <span className="leading-tight">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-white/50 mb-1">套餐名称</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-white/50 mb-1">活动角标 (Badge)</label>
                <input
                  type="text"
                  placeholder="如: 推荐"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white outline-none focus:border-brand"
                />
              </div>
            </div>

            {/* 价格配置 */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-white/50 mb-1">连续包月 (CNY)</label>
                <input
                  type="number"
                  required
                  value={monthlyCny}
                  onChange={(e) => setMonthlyCny(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-white/50 mb-1">包月 USD</label>
                <input
                  type="number"
                  required
                  value={monthlyUsd}
                  onChange={(e) => setMonthlyUsd(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white outline-none focus:border-brand"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-white/50 mb-1">季付价格 (CNY)</label>
                <input
                  type="number"
                  value={quarterlyCny}
                  onChange={(e) => setQuarterlyCny(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-white/50 mb-1">季付 USD</label>
                <input
                  type="number"
                  value={quarterlyUsd}
                  onChange={(e) => setQuarterlyUsd(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white outline-none focus:border-brand"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-white/50 mb-1">连续包年 (CNY)</label>
                <input
                  type="number"
                  required
                  value={yearlyCny}
                  onChange={(e) => setYearlyCny(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-white/50 mb-1">包年 USD</label>
                <input
                  type="number"
                  required
                  value={yearlyUsd}
                  onChange={(e) => setYearlyUsd(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white outline-none focus:border-brand"
                />
              </div>
            </div>

            {/* 额度与资产库存储 */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-white/50 mb-1">每月基础额度积分</label>
                <input
                  type="number"
                  required
                  value={quotaBase}
                  onChange={(e) => setQuotaBase(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-xs font-mono text-brand outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-white/50 mb-1">云端资产库 (GB)</label>
                <input
                  type="number"
                  value={storageGb}
                  onChange={(e) => setStorageGb(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-xs font-mono text-brand outline-none focus:border-brand"
                />
              </div>
            </div>

            {/* 并发与人像容量 */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-white/50 mb-1">单模型并发</label>
                <input
                  type="number"
                  value={concurrency}
                  onChange={(e) => setConcurrency(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-xs font-mono text-white outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-white/50 mb-1">异步并发池</label>
                <input
                  type="number"
                  value={asyncConcurrency}
                  onChange={(e) => setAsyncConcurrency(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-xs font-mono text-white outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-white/50 mb-1">人像容量</label>
                <input
                  type="number"
                  value={portraitCapacity}
                  onChange={(e) => setPortraitCapacity(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-xs font-mono text-white outline-none focus:border-brand"
                />
              </div>
            </div>

            {/* 专属权益配置（可勾选） */}
            <div className="rounded-xl border border-brand/20 bg-brand/[0.03] p-3 space-y-2">
              <label className="block text-[11px] font-bold text-brand flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-brand" />
                <span>专属权益配置（可勾选开关）：</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {EXCLUSIVE_BENEFITS.map((benefit) => {
                  const checked = exclusiveFeatures.includes(benefit.key);
                  const IconComponent = ICON_MAP[benefit.icon] || Sparkles;
                  return (
                    <label
                      key={benefit.key}
                      className={`flex items-start gap-2 p-1.5 rounded-lg border cursor-pointer select-none transition ${
                        checked
                          ? 'border-brand/40 bg-brand/10 text-white'
                          : 'border-white/10 bg-black/30 text-white/50 hover:border-white/20'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => toggleExclusive(benefit.key)}
                      />
                      <div
                        className={`mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded border transition ${
                          checked
                            ? 'border-brand bg-brand text-white'
                            : 'border-white/30 bg-transparent'
                        }`}
                      >
                        {checked && <Check className="size-2.5 stroke-[3]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 text-[11px] font-semibold">
                          <IconComponent className="size-3 text-brand shrink-0" />
                          <span>{benefit.label}</span>
                        </div>
                        <p className="text-[9px] text-white/40 leading-tight">
                          {benefit.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-white/50 mb-1">权益列表（每行一项）</label>
              <textarea
                rows={4}
                value={features}
                onChange={(e) => setFeatures(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/40 p-2 text-xs text-white outline-none focus:border-brand font-sans"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id={`enabled_${plan.id}`}
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded border-white/20 bg-black/40"
              />
              <label htmlFor={`enabled_${plan.id}`} className="text-xs text-white/70">
                在前台展示此套餐
              </label>
            </div>

            <div className="flex justify-between items-center gap-2 pt-2 border-t border-white/10">
              {['starter', 'basic', 'plus', 'pro'].includes(plan.id) ? (
                <span className="text-[10px] text-white/40">系统内置商业档位</span>
              ) : (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="inline-flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300"
                >
                  <Trash2 className="size-3.5" />
                  <span>删除套餐</span>
                </button>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:bg-white/10"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-brand px-4 py-1.5 text-xs font-bold text-white hover:bg-brand-hover transition-colors shadow-sm"
                >
                  {busy ? '保存中…' : '保存更新'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {!editing && (
        <div className="mt-6 pt-4 border-t border-white/[0.06] flex justify-end">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white transition"
          >
            编辑定价与专属特权
          </button>
        </div>
      )}

      {message && <p className="mt-2 text-xs text-brand">{message}</p>}
    </Card>
  );
}

'use client';

import { useState } from 'react';
import { X, Plus, Sparkles, Check, Crown, Zap, Flame, ShieldCheck, HelpCircle, Wand2 } from 'lucide-react';
import { EXCLUSIVE_BENEFITS } from '@/lib/pricing/exclusiveBenefits';
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

export default function CreatePlanModal({ isOpen, onClose, onCreated }) {
  const [planId, setPlanId] = useState('');
  const [name, setName] = useState('');
  const [badge, setBadge] = useState('');
  const [displayOrder, setDisplayOrder] = useState(50);
  const [monthlyCny, setMonthlyCny] = useState(299);
  const [monthlyUsd, setMonthlyUsd] = useState(42);
  const [quarterlyCny, setQuarterlyCny] = useState(807);
  const [quarterlyUsd, setQuarterlyUsd] = useState(113);
  const [yearlyCny, setYearlyCny] = useState(2990);
  const [yearlyUsd, setYearlyUsd] = useState(420);
  const [quotaBase, setQuotaBase] = useState(4000);
  const [concurrency, setConcurrency] = useState(4);
  const [asyncConcurrency, setAsyncConcurrency] = useState(4);
  const [portraitCapacity, setPortraitCapacity] = useState(5);
  const [storageGb, setStorageGb] = useState(20);
  const [exclusiveFeatures, setExclusiveFeatures] = useState(['no_watermark', 'vip_speed_queue', 'canvas_premium_tools', 'commercial_license']);
  const [featuresText, setFeaturesText] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  // 价格联动计算
  const handleMonthlyCnyChange = (val) => {
    const num = Number(val) || 0;
    setMonthlyCny(num);
    setQuarterlyCny(Math.round(num * 3 * 0.9));
    setYearlyCny(Math.round(num * 10));
    setQuotaBase(Math.round(num / CREDIT_PRICING_POLICY.cnyPerCredit));
  };

  const handleMonthlyUsdChange = (val) => {
    const num = Number(val) || 0;
    setMonthlyUsd(num);
    setQuarterlyUsd(Math.round(num * 3 * 0.9));
    setYearlyUsd(Math.round(num * 10));
  };

  const toggleExclusive = (key) => {
    setExclusiveFeatures((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      const customFeatures = featuresText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          id: planId,
          name,
          badge,
          displayOrder: Number(displayOrder),
          monthlyCny: Number(monthlyCny),
          monthlyUsd: Number(monthlyUsd),
          quarterlyCny: Number(quarterlyCny),
          quarterlyUsd: Number(quarterlyUsd),
          yearlyCny: Number(yearlyCny),
          yearlyUsd: Number(yearlyUsd),
          quotaBase: Number(quotaBase),
          concurrency: Number(concurrency),
          asyncConcurrency: Number(asyncConcurrency),
          portraitCapacity: Number(portraitCapacity),
          storageGb: Number(storageGb),
          exclusiveFeatures,
          features: customFeatures,
          enabled,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.error || '创建套餐失败');
      }

      onCreated?.(data.data || data);
      onClose();
      window.location.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/15 bg-[#121622] p-6 shadow-2xl text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-brand/10 border border-brand/30 text-brand">
              <Plus className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">新增订阅套餐</h2>
              <p className="text-xs text-white/50">配置前台展示的订阅计划、价格体系、并发配额与专属特权可选项</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 基础标识与命名 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-white/60 mb-1">
                套餐标识 ID <span className="text-brand">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="如 team / enterprise"
                value={planId}
                onChange={(e) => setPlanId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs font-mono text-brand outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-white/60 mb-1">
                套餐显示名称 <span className="text-brand">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="如 Team (企业团队版)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-white/60 mb-1">
                活动角标 Badge
              </label>
              <input
                type="text"
                placeholder="如: 团队首选 / 限时特惠"
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-brand"
              />
            </div>
          </div>

          {/* 定价体系 */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white/80">阶梯周期定价 (CNY / USD)</span>
              <span className="text-[11px] text-brand/80">月付¥{CREDIT_PRICING_POLICY.cnyPerCredit}/分 · 季付9折 · 年付8.3折</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] text-white/50 mb-1">连续包月 (CNY / USD)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    required
                    value={monthlyCny}
                    onChange={(e) => handleMonthlyCnyChange(e.target.value)}
                    className="w-1/2 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white font-mono"
                    placeholder="¥"
                  />
                  <input
                    type="number"
                    required
                    value={monthlyUsd}
                    onChange={(e) => handleMonthlyUsdChange(e.target.value)}
                    className="w-1/2 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white font-mono"
                    placeholder="$"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-white/50 mb-1">季付价格 (CNY / USD)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={quarterlyCny}
                    onChange={(e) => setQuarterlyCny(e.target.value)}
                    className="w-1/2 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                  <input
                    type="number"
                    value={quarterlyUsd}
                    onChange={(e) => setQuarterlyUsd(e.target.value)}
                    className="w-1/2 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-white/50 mb-1">年付价格 (CNY / USD)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={yearlyCny}
                    onChange={(e) => setYearlyCny(e.target.value)}
                    className="w-1/2 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                  <input
                    type="number"
                    value={yearlyUsd}
                    onChange={(e) => setYearlyUsd(e.target.value)}
                    className="w-1/2 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 额度资产与并发容量 */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
            <div>
              <label className="block text-[10px] text-white/50 mb-1">每月额度积分</label>
              <input
                type="number"
                required
                value={quotaBase}
                onChange={(e) => setQuotaBase(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 font-mono text-brand"
              />
            </div>
            <div>
              <label className="block text-[10px] text-white/50 mb-1">单模型并发</label>
              <input
                type="number"
                value={concurrency}
                onChange={(e) => setConcurrency(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] text-white/50 mb-1">异步并发池</label>
              <input
                type="number"
                value={asyncConcurrency}
                onChange={(e) => setAsyncConcurrency(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] text-white/50 mb-1">人像容量 (个)</label>
              <input
                type="number"
                value={portraitCapacity}
                onChange={(e) => setPortraitCapacity(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] text-white/50 mb-1">资产存储 (GB)</label>
              <input
                type="number"
                value={storageGb}
                onChange={(e) => setStorageGb(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 font-mono text-white"
              />
            </div>
          </div>

          {/* 专属权益可选项（可勾选） */}
          <div className="rounded-xl border border-brand/20 bg-brand/[0.03] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-brand flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-brand" />
                <span>专属权益配置（可勾选）</span>
              </span>
              <span className="text-[10px] text-white/40">勾选后将自动生效并赋予订购该套餐的用户</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EXCLUSIVE_BENEFITS.map((benefit) => {
                const checked = exclusiveFeatures.includes(benefit.key);
                const IconComponent = ICON_MAP[benefit.icon] || Sparkles;
                return (
                  <label
                    key={benefit.key}
                    className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer select-none transition ${
                      checked
                        ? 'border-brand/40 bg-brand/10 text-white'
                        : 'border-white/10 bg-black/30 text-white/60 hover:border-white/20'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => toggleExclusive(benefit.key)}
                    />
                    <div
                      className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition ${
                        checked
                          ? 'border-brand bg-brand text-white'
                          : 'border-white/30 bg-transparent'
                      }`}
                    >
                      {checked && <Check className="size-3 stroke-[3]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <IconComponent className="size-3.5 text-brand shrink-0" />
                        <span className="text-xs font-semibold">{benefit.label}</span>
                      </div>
                      <p className="text-[10px] text-white/50 leading-tight mt-0.5">
                        {benefit.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 额外前台展示文案（每行一项） */}
          <div>
            <label className="block text-[11px] font-semibold text-white/60 mb-1">
              前台展示文案（每行一项，专属权益已自动同步包含）
            </label>
            <textarea
              rows={3}
              placeholder="每月 4,000 创作积分&#10;任务并发: 4 路同时生成&#10;专享优先通道"
              value={featuresText}
              onChange={(e) => setFeaturesText(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/40 p-2.5 text-xs text-white outline-none focus:border-brand font-sans"
            />
          </div>

          {/* 排序与展示状态 */}
          <div className="flex items-center justify-between border-t border-white/10 pt-3">
            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="rounded border-white/20 bg-black/40"
                />
                <span className="text-white/80">立即在前台展示</span>
              </label>

              <div className="flex items-center gap-1.5">
                <span className="text-white/50">排序序号:</span>
                <input
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                  className="w-14 rounded border border-white/15 bg-black/40 px-1.5 py-0.5 text-center text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-brand px-4 py-1.5 text-xs font-bold text-white hover:bg-brand-hover transition shadow-sm"
              >
                {busy ? '创建中…' : '立即创建套餐'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

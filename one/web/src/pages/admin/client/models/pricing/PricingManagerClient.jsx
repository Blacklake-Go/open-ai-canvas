'use client';

import { useState, useMemo, useTransition } from 'react';
import Link from 'next/link';
import { CREDIT_PRICING_POLICY } from '@/lib/pricing/creditPolicy';
import { Card, MetricCard, StatusBadge, Button } from '@/components/admin/AdminUi';
import BrandLogo from '@/components/admin/BrandLogo';
import {
  Coins,
  Search,
  Edit3,
  Loader2,
  Lock,
  Unlock,
  Percent,
  Settings,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  Check,
} from 'lucide-react';

const CATEGORY_LABELS = { image: '图像', video: '视频', audio: '音乐', workflow: '工作流', text: '文本' };
const MODE_LABELS = { auto: '自动倍率', manual: '手动锁价', locked: '已锁定' };
const MODE_TONES = { auto: 'good', manual: 'warn', locked: 'danger' };

export default function PricingManagerClient({
  initialTab = 'rules',
  initialPricing = [],
  initialStrategy = {},
  initialBreakdown = [],
  initialPendingPrices = [],
  canWrite = false,
}) {
  const [activeTab, setActiveTab] = useState(initialTab === 'frontend' ? 'rules' : initialTab); // 'rules' | 'breakdown' | 'pending'

  // Tab 1 状态
  const [pricingList, setPricingList] = useState(initialPricing);
  const [strategy, setStrategy] = useState({
    baseMultiplier: initialStrategy.baseMultiplier ?? 1.5,
    minMarginRate: initialStrategy.minMarginRate ?? 0.3,
    categoryMultipliers: initialStrategy.categoryMultipliers ?? {},
    tierMultipliers: initialStrategy.tierMultipliers ?? {},
  });
  const [searchRulesKeyword, setSearchRulesKeyword] = useState('');
  const [editingPricing, setEditingPricing] = useState(null);
  const [showStrategy, setShowStrategy] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingStrategy, setIsSavingStrategy] = useState(false);

  // Tab 2 状态 (模型价格明细)
  const [breakdownList, setBreakdownList] = useState(initialBreakdown);
  const [breakdownSearch, setBreakdownSearch] = useState('');
  const [breakdownCategory, setBreakdownCategory] = useState('');
  const [breakdownMarginFilter, setBreakdownMarginFilter] = useState('');
  const [quickEditModel, setQuickEditModel] = useState(null); // 快速调价

  // Tab 3 状态 (待审价格版本)
  const [pendingPrices, setPendingPrices] = useState(initialPendingPrices);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [batchApproving, setBatchApproving] = useState(false);
  const [pendingSearch, setPendingSearch] = useState('');
  const [pendingProviderFilter, setPendingProviderFilter] = useState('');

  // ================= Tab 1 统计与计算 =================
  const statsRules = useMemo(() => ({
    total: pricingList.length,
    auto: pricingList.filter((p) => (p.pricingMode || 'auto') === 'auto').length,
    manual: pricingList.filter((p) => p.pricingMode === 'manual' || p.pricingMode === 'locked').length,
    active: pricingList.filter((p) => p.isActive).length,
  }), [pricingList]);

  const filteredRulesList = useMemo(() => {
    const kw = searchRulesKeyword.toLowerCase();
    return pricingList.filter((p) =>
      !kw || p.modelId.toLowerCase().includes(kw) || p.modelName.toLowerCase().includes(kw)
    );
  }, [pricingList, searchRulesKeyword]);

  // ================= Tab 2 统计与计算 (价格明细) =================
  const statsBreakdown = useMemo(() => {
    const validMargins = breakdownList.filter((b) => b.marginRate !== null);
    const avgMargin = validMargins.length > 0
      ? (validMargins.reduce((sum, b) => sum + b.marginRate, 0) / validMargins.length).toFixed(1)
      : '0.0';
    const lossCount = breakdownList.filter((b) => b.marginStatus === 'loss').length;
    const highCount = breakdownList.filter((b) => b.marginStatus === 'high').length;
    return {
      total: breakdownList.length,
      avgMargin,
      lossCount,
      highCount,
    };
  }, [breakdownList]);

  const filteredBreakdownList = useMemo(() => {
    return breakdownList.filter((item) => {
      if (breakdownSearch) {
        const kw = breakdownSearch.toLowerCase();
        if (!item.modelId.toLowerCase().includes(kw) && !item.modelName.toLowerCase().includes(kw) && !item.brand.toLowerCase().includes(kw)) {
          return false;
        }
      }
      if (breakdownCategory && item.category !== breakdownCategory) return false;
      if (breakdownMarginFilter && item.marginStatus !== breakdownMarginFilter) return false;
      return true;
    });
  }, [breakdownList, breakdownSearch, breakdownCategory, breakdownMarginFilter]);


  // ================= Tab 3 统计与计算 (待审核价格) =================
  const pendingProviders = useMemo(() => {
    const set = new Set();
    for (const p of pendingPrices) {
      if (p.provider_id) set.add(p.provider_id);
    }
    return Array.from(set).sort();
  }, [pendingPrices]);

  const statsPending = useMemo(() => {
    const modelsSet = new Set(pendingPrices.map((p) => p.model_id).filter(Boolean));
    const providersSet = new Set(pendingPrices.map((p) => p.provider_id).filter(Boolean));
    return {
      total: pendingPrices.length,
      modelsCount: modelsSet.size,
      providersCount: providersSet.size,
    };
  }, [pendingPrices]);

  const filteredPendingPrices = useMemo(() => {
    return pendingPrices.filter((p) => {
      if (pendingSearch) {
        const kw = pendingSearch.toLowerCase();
        const matchModel = (p.model_id && p.model_id.toLowerCase().includes(kw)) ||
          (p.modelName && p.modelName.toLowerCase().includes(kw));
        const matchProvider = (p.provider_id && p.provider_id.toLowerCase().includes(kw)) ||
          (p.providerModelId && p.providerModelId.toLowerCase().includes(kw)) ||
          (p.provider_model_id && String(p.provider_model_id).toLowerCase().includes(kw)) ||
          (p.providerName && p.providerName.toLowerCase().includes(kw));
        if (!matchModel && !matchProvider) return false;
      }
      if (pendingProviderFilter && p.provider_id !== pendingProviderFilter) {
        return false;
      }
      return true;
    });
  }, [pendingPrices, pendingSearch, pendingProviderFilter]);

  const parsePriceConfig = (config) => {
    if (!config) return {};
    if (typeof config === 'object') return config;
    try {
      return JSON.parse(config);
    } catch {
      return {};
    }
  };

  const formatPendingPrice = (price) => {
    const cfg = parsePriceConfig(price.price_config);
    const cost = cfg.base_cost ?? cfg.amount ?? cfg.unit_cost ?? cfg.cost;
    if (cost !== null && cost !== undefined) {
      return `${price.currency || 'USD'} ${cost} / ${price.billing_unit || '次'}`;
    }
    return JSON.stringify(cfg);
  };

  const refreshPendingPrices = async () => {
    setPendingLoading(true);
    try {
      const res = await fetch('/api/admin/models/control');
      if (res.ok) {
        const body = await res.json();
        const raw = body.data?.pendingPrices || body.pendingPrices;
        if (Array.isArray(raw)) {
          setPendingPrices(raw);
        }
      }
    } catch (err) {
      console.error('Failed to refresh pending prices:', err);
    } finally {
      setPendingLoading(false);
    }
  };

  const handleApprovePrice = async (versionId) => {
    if (!canWrite) return;
    setApprovingId(versionId);
    try {
      const res = await fetch('/api/admin/models/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `approve_price_${versionId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        },
        body: JSON.stringify({
          action: 'approve_price',
          versionId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || '批准价格版本失败');
      }
      setPendingPrices((prev) => prev.filter((p) => p.id !== versionId));
      alert('价格版本已成功批准激活，已成为最新生效底价！');
    } catch (err) {
      alert(`审批失败: ${err.message}`);
    } finally {
      setApprovingId(null);
    }
  };

  const handleBatchApprove = async () => {
    if (!canWrite || filteredPendingPrices.length === 0) return;
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        `确定要批量批准并通过当前筛选的 ${filteredPendingPrices.length} 个待审价格版本吗？批准后将立即生效为活动成本版本，解除价格缺失状态。`
      )
    ) {
      return;
    }
    setBatchApproving(true);
    let successCount = 0;
    let failCount = 0;
    const targets = [...filteredPendingPrices];
    for (const item of targets) {
      try {
        const res = await fetch('/api/admin/models/control', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': `approve_price_${item.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          },
          body: JSON.stringify({
            action: 'approve_price',
            versionId: item.id,
          }),
        });
        if (res.ok) {
          successCount++;
          setPendingPrices((prev) => prev.filter((p) => p.id !== item.id));
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }
    setBatchApproving(false);
    alert(`批量审批完成：成功批准 ${successCount} 个价格版本${failCount > 0 ? `，失败 ${failCount} 个` : ''}。`);
  };

  // 保存策略
  const handleSaveStrategy = async () => {
    setIsSavingStrategy(true);
    try {
      const res = await fetch('/api/admin/models/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `strat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        },
        body: JSON.stringify({
          action: 'save_pricing_strategy',
          ...strategy,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowStrategy(false);
      } else {
        alert(data.error?.message || '保存定价策略失败');
      }
    } catch (err) {
      alert('保存异常: ' + err.message);
    } finally {
      setIsSavingStrategy(false);
    }
  };

  // 保存规则定价
  const handleSavePricing = async (e) => {
    e.preventDefault();
    const form = e.target;
    const enteredCredits = Number(form.baseCredits.value);
    if (!Number.isInteger(enteredCredits) || enteredCredits <= 0) {
      alert('请填写已核实的正整数积分价格');
      return;
    }
    setIsSaving(true);

    let formulaConfig = editingPricing.formulaConfig || {};
    if (form.formulaConfig) {
      try {
        formulaConfig = JSON.parse(form.formulaConfig.value || '{}');
      } catch (err) {
        alert('公式配置 JSON 格式错误: ' + err.message);
        setIsSaving(false);
        return;
      }
    }

    const payload = {
      modelId: editingPricing.modelId,
      pricingType: form.pricingType.value,
      pricingMode: form.pricingMode.value,
      baseCredits: enteredCredits,
      minCredits: Number(form.minCredits.value || 10),
      minGrossMarginRate: Math.max(Number(form.minGrossMarginRate.value || 30) / 100, 0.1),
      isActive: form.isActive.checked,
      manualOverridePriceCny: form.manualOverridePriceCny?.value ? Number(form.manualOverridePriceCny.value) : null,
      lockReason: form.lockReason?.value || '',
      formulaConfig,
    };

    try {
      const res = await fetch('/api/admin/models/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `prc_${payload.modelId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        },
        body: JSON.stringify({
          action: 'save_model_pricing',
          ...payload,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPricingList((prev) =>
          prev.map((item) =>
            item.modelId === payload.modelId
              ? {
                  ...item,
                  pricingType: payload.pricingType,
                  pricingMode: payload.pricingMode,
                  baseCredits: payload.baseCredits ?? item.baseCredits,
                  minCredits: payload.minCredits,
                  minGrossMarginRate: payload.minGrossMarginRate,
                  isActive: payload.isActive,
                  manualOverridePriceCny: payload.manualOverridePriceCny,
                  manuallyLocked: payload.pricingMode === 'locked',
                  formulaConfig: payload.formulaConfig,
                }
              : item
          )
        );
        // 同步更新明细大表
        setBreakdownList((prev) =>
          prev.map((item) =>
            item.modelId === payload.modelId
              ? {
                  ...item,
                  baseCredits: payload.baseCredits,
                  userPriceCny: Number((payload.baseCredits * CREDIT_PRICING_POLICY.cnyPerCredit).toFixed(4)),
                  pricingMode: payload.pricingMode,
                }
              : item
          )
        );
        setEditingPricing(null);
      } else {
        alert(data.error?.message || '保存定价失败');
      }
    } catch (err) {
      alert('保存异常: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 快速调价
  const handleQuickSavePrice = async (e) => {
    e.preventDefault();
    if (!quickEditModel) return;
    const form = e.target;
    const baseCredits = Number(form.baseCredits.value);
    if (!Number.isInteger(baseCredits) || baseCredits <= 0) {
      alert('请填写已核实的正整数积分价格');
      return;
    }
    const pricingMode = form.pricingMode.value;

    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/models/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `qprc_${quickEditModel.modelId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        },
        body: JSON.stringify({
          action: 'save_model_pricing',
          modelId: quickEditModel.modelId,
          baseCredits,
          pricingMode,
          pricingType: quickEditModel.pricingType || 'fixed',
          isActive: true,
        }),
      });
      if (res.ok) {
        setBreakdownList((prev) =>
          prev.map((b) => {
            if (b.modelId !== quickEditModel.modelId) return b;
            const userPriceCny = Number((baseCredits * CREDIT_PRICING_POLICY.cnyPerCredit).toFixed(4));
            const grossMarginCny = b.minCostCny !== null ? Number((userPriceCny - b.minCostCny).toFixed(4)) : null;
            const marginRate = userPriceCny > 0 && grossMarginCny !== null ? Number(((grossMarginCny / userPriceCny) * 100).toFixed(1)) : null;
            const marginStatus = marginRate === null ? 'unknown' : marginRate < 0 ? 'loss' : marginRate < 30 ? 'low' : marginRate < 50 ? 'healthy' : 'high';
            return {
              ...b,
              baseCredits,
              userPriceCny,
              grossMarginCny,
              marginRate,
              marginStatus,
              pricingMode,
            };
          })
        );
        setQuickEditModel(null);
      } else {
        alert('更新价格失败');
      }
    } catch (err) {
      alert('保存异常: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <div className="space-y-6">
      {/* 待审价格警示 Banner */}
      {pendingPrices.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-elevation-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="size-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <div className="text-body font-bold text-ink flex items-center gap-2">
                <span>有 {pendingPrices.length} 个渠道价格版本待审核 (pending_review)</span>
                <span className="rounded-full bg-amber-500/20 text-amber-300 px-2 py-0.5 text-micro font-bold border border-amber-500/30">
                  解除 PRICE_MISSING
                </span>
              </div>
              <p className="text-caption text-ink-muted mt-0.5">
                渠道价格版本处于待审核状态时不会成为活动成本，导致计价路由引擎报 PRICE_MISSING。请核验并批准发布。
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setActiveTab('pending')}
              className="rounded-lg"
            >
              前往审核 ({pendingPrices.length}) →
            </Button>
          </div>
        </div>
      )}

      {/* 顶部下划线选项卡导航 (WeChat Underline Tabs 契约，消除卡片割裂) */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line-subtle h-12">
        <div className="flex items-center gap-6 sm:gap-8 h-full overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`relative h-full inline-flex items-center gap-1.5 text-xs sm:text-sm transition-colors select-none whitespace-nowrap cursor-pointer ${
              activeTab === 'rules'
                ? 'text-brand font-semibold'
                : 'text-ink-muted hover:text-ink font-medium'
            }`}
          >
            <span>定价策略与规则</span>
            {activeTab === 'rules' && (
              <span className="absolute bottom-0 inset-x-0 h-[2px] bg-brand rounded-full" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('breakdown')}
            className={`relative h-full inline-flex items-center gap-1.5 text-xs sm:text-sm transition-colors select-none whitespace-nowrap cursor-pointer ${
              activeTab === 'breakdown'
                ? 'text-brand font-semibold'
                : 'text-ink-muted hover:text-ink font-medium'
            }`}
          >
            <span>模型价格明细 (多渠道底价)</span>
            {activeTab === 'breakdown' && (
              <span className="absolute bottom-0 inset-x-0 h-[2px] bg-brand rounded-full" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`relative h-full inline-flex items-center gap-1.5 text-xs sm:text-sm transition-colors select-none whitespace-nowrap cursor-pointer ${
              activeTab === 'pending'
                ? 'text-brand font-semibold'
                : 'text-ink-muted hover:text-ink font-medium'
            }`}
          >
            <span>待审价格版本</span>
            {pendingPrices.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === 'pending' ? 'bg-amber-500 text-white' : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {pendingPrices.length}
              </span>
            )}
            {activeTab === 'pending' && (
              <span className="absolute bottom-0 inset-x-0 h-[2px] bg-brand rounded-full" />
            )}
          </button>
        </div>

        {/* 右侧外链: 成本中心与利润中心 */}
        <div className="flex items-center gap-2">
          <Link
            href="/admin/cost-center"
            className="rounded-lg border border-line-subtle bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-white/[0.08] hover:text-ink transition"
          >
            成本中心 →
          </Link>
          <Link
            href="/admin/profit-center"
            className="rounded-lg border border-line-subtle bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-white/[0.08] hover:text-ink transition"
          >
            利润中心 →
          </Link>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: 定价策略与规则 (Rules) */}
      {/* ========================================================================= */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          {/* 指标卡 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <MetricCard label="定价模型总数" value={statsRules.total} hint="已配置定价规则的模型" tone="info" />
            <MetricCard label="自动倍率定价" value={statsRules.auto} hint="按全局/分类倍率自动计算" tone="good" />
            <MetricCard label="手动锁价" value={statsRules.manual} hint="管理员手动覆盖的价格" tone="warn" />
            <MetricCard
              label="全局基准倍率"
              value={`${strategy.baseMultiplier}x`}
              hint={`最低毛利 ${(strategy.minMarginRate * 100).toFixed(0)}%`}
              tone="neutral"
            />
          </div>

          {/* 全局策略折叠卡 */}
          <Card>
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-brand" />
                <h3 className="text-sm font-semibold text-white">全局定价策略</h3>
                <span className="text-xs text-gray-400">
                  基准 {strategy.baseMultiplier}x · 最低毛利 {(strategy.minMarginRate * 100).toFixed(0)}%
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowStrategy(!showStrategy)}
                className="text-xs text-brand hover:underline font-semibold"
              >
                {showStrategy ? '收起' : '配置策略'}
              </Button>
            </div>

            {showStrategy && (
              <div className="mt-4 space-y-4 pt-2">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <div>
                    <label className="text-xs text-gray-400">基准倍率 (成本 × 倍率 = 建议售价)</label>
                    <input
                      type="number"
                      step="0.05"
                      min="1.0"
                      value={strategy.baseMultiplier}
                      onChange={(e) => setStrategy({ ...strategy, baseMultiplier: Number(e.target.value) })}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white"
                      disabled={!canWrite}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">最低毛利率 (%)</label>
                    <input
                      type="number"
                      step="1"
                      min="10"
                      max="90"
                      value={strategy.minMarginRate * 100}
                      onChange={(e) => setStrategy({ ...strategy, minMarginRate: Number(e.target.value) / 100 })}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white"
                      disabled={!canWrite}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">图像类倍率覆盖</label>
                    <input
                      type="number"
                      step="0.05"
                      placeholder={`基准 (${strategy.baseMultiplier}x)`}
                      value={strategy.categoryMultipliers?.image ?? ''}
                      onChange={(e) =>
                        setStrategy({
                          ...strategy,
                          categoryMultipliers: {
                            ...strategy.categoryMultipliers,
                            image: e.target.value ? Number(e.target.value) : undefined,
                          },
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white"
                      disabled={!canWrite}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">视频类倍率覆盖</label>
                    <input
                      type="number"
                      step="0.05"
                      placeholder={`基准 (${strategy.baseMultiplier}x)`}
                      value={strategy.categoryMultipliers?.video ?? ''}
                      onChange={(e) =>
                        setStrategy({
                          ...strategy,
                          categoryMultipliers: {
                            ...strategy.categoryMultipliers,
                            video: e.target.value ? Number(e.target.value) : undefined,
                          },
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white"
                      disabled={!canWrite}
                    />
                  </div>
                </div>

                <p className="text-xs text-white/40">
                  自动定价公式：建议售价 = max(渠道最低成本 × 有效倍率, 渠道成本 ÷ (1 - 最低毛利率))。留空的类别将使用基准倍率。手动锁价的模型不受倍率影响。
                </p>

                {canWrite && (
                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleSaveStrategy} disabled={isSavingStrategy} size="sm" className="bg-brand hover:bg-brand-hover text-white rounded-lg">
                      {isSavingStrategy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                      保存定价策略
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowStrategy(false)} className="rounded-lg">
                      取消
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* 搜索与表格 */}
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-white">模型定价规则表</h2>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="搜索模型标识或名称..."
                value={searchRulesKeyword}
                onChange={(e) => setSearchRulesKeyword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-surface/80 py-1.5 pl-9 pr-3 text-xs text-white placeholder-gray-500 focus:border-brand focus:outline-none"
              />
            </div>
          </div>

          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02] text-gray-400">
                    <th className="px-4 py-3 font-medium">模型</th>
                    <th className="px-4 py-3 font-medium">类型</th>
                    <th className="px-4 py-3 font-medium">计费模式</th>
                    <th className="px-4 py-3 font-medium">定价方式</th>
                    <th className="px-4 py-3 font-medium">基础积分</th>
                    <th className="px-4 py-3 font-medium">最低毛利</th>
                    <th className="px-4 py-3 font-medium">状态</th>
                    <th className="px-4 py-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {filteredRulesList.map((p) => (
                    <tr key={p.modelId} className="transition-colors hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <BrandLogo model={{ id: p.modelId, name: p.modelName }} size="sm" className="rounded-md shrink-0" />
                          <div className="min-w-0">
                            <div className="font-medium text-white truncate">{p.modelName}</div>
                            <div className="text-[11px] text-gray-500 font-mono truncate">{p.modelId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone="neutral">{CATEGORY_LABELS[p.category] || p.category}</StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {p.pricingType === 'formula' ? '动态公式' : '固定扣费'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={MODE_TONES[p.pricingMode] || 'neutral'}>
                          {MODE_LABELS[p.pricingMode] || p.pricingMode}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-brand">
                        {p.baseCredits == null ? '未定价' : p.baseCredits}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-300">
                        {(p.minGrossMarginRate * 100).toFixed(0)}%
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={p.isActive ? 'good' : 'warn'}>
                          {p.isActive ? '生效中' : '已停用'}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canWrite && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingPricing(p)}
                            className="h-7 text-xs text-brand hover:underline font-semibold"
                          >
                            <Edit3 className="mr-1 h-3 w-3" /> 编辑定价
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: 模型价格明细 (Breakdown Table with Provider Costs & Gross Margin) */}
      {/* ========================================================================= */}
      {activeTab === 'breakdown' && (
        <div className="space-y-6">
          {/* 指标卡 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <MetricCard label="接入模型总数" value={statsBreakdown.total} hint="穿透全渠道成本底价" tone="info" />
            <MetricCard label="平均综合毛利率" value={`${statsBreakdown.avgMargin}%`} hint="基于最低有效采购价" tone="good" />
            <MetricCard
              label="成本倒挂亏损"
              value={statsBreakdown.lossCount}
              hint={statsBreakdown.lossCount > 0 ? "需立即调整售价" : "零倒挂风险"}
              tone={statsBreakdown.lossCount > 0 ? 'danger' : 'good'}
            />
            <MetricCard label="高毛利模型 (≥50%)" value={statsBreakdown.highCount} hint="健康高利润模型" tone="neutral" />
          </div>

          {/* 筛选与搜索工具条 */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-surface/80 p-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索模型标识、名称或品牌..."
                  value={breakdownSearch}
                  onChange={(e) => setBreakdownSearch(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 py-1.5 pl-9 pr-3 text-xs text-white placeholder-gray-500 focus:border-brand focus:outline-none"
                />
              </div>

              {/* 类别筛选 */}
              <select
                value={breakdownCategory}
                onChange={(e) => setBreakdownCategory(e.target.value)}
                className="rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white/70 outline-none focus:border-brand"
              >
                <option value="">全部模态类型</option>
                <option value="image">图像生成</option>
                <option value="video">视频生成</option>
                <option value="audio">音频音乐</option>
                <option value="text">语言/推理</option>
              </select>

              {/* 毛利状态筛选 */}
              <select
                value={breakdownMarginFilter}
                onChange={(e) => setBreakdownMarginFilter(e.target.value)}
                className="rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white/70 outline-none focus:border-brand"
              >
                <option value="">全部毛利状态</option>
                <option value="high">🟢 高毛利 (≥50%)</option>
                <option value="healthy">🔵 健康毛利 (30%~50%)</option>
                <option value="low">🟡 偏低毛利 (0%~30%)</option>
                <option value="loss">🔴 成本倒挂亏损 (&lt;0%)</option>
              </select>
            </div>

            <div className="text-xs text-white/40 font-mono">
              命中 {filteredBreakdownList.length} / {breakdownList.length} 个模型
            </div>
          </div>

          {/* 价格明细大表 */}
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02] text-gray-400">
                    <th className="px-4 py-3 font-medium">模型主体 / 品牌</th>
                    <th className="px-4 py-3 font-medium">类型</th>
                    <th className="px-4 py-3 font-medium">渠道底价 (USD/CNY)</th>
                    <th className="px-4 py-3 font-medium">平台售价 (积分 / 折算)</th>
                    <th className="px-4 py-3 font-medium">预估单次毛利</th>
                    <th className="px-4 py-3 font-medium">毛利率</th>
                    <th className="px-4 py-3 font-medium">定价方式</th>
                    <th className="px-4 py-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {filteredBreakdownList.map((item) => (
                    <tr key={item.modelId} className="transition-colors hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{item.modelName}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-gray-500 font-mono">{item.modelId}</span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.2 text-[10px] text-white/60">
                            {item.brand}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone="neutral">{CATEGORY_LABELS[item.category] || item.category}</StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        {item.minCostCny !== null ? (
                          <div>
                            <span className="font-mono font-medium text-white">¥{item.minCostCny.toFixed(2)}</span>
                            <span className="text-[11px] text-white/40 font-mono block">(${item.minCostUsd?.toFixed(3)})</span>
                            <span className="text-[10px] text-emerald-400/80">{item.channelCount}条可用通道</span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-white/30 font-mono block">— (暂无渠道)</span>
                            {pendingPrices.some((p) => p.model_id === item.modelId) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPendingSearch(item.modelId);
                                  setActiveTab('pending');
                                }}
                                className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold hover:bg-amber-500/25 transition-colors"
                              >
                                待审价格 ({pendingPrices.filter((p) => p.model_id === item.modelId).length}) →
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-brand text-sm">{item.baseCredits == null ? '未定价' : `${item.baseCredits} 算力`}</span>
                        {item.userPriceCny != null && <span className="text-[11px] text-white/40 font-mono block">≈ ¥{item.userPriceCny.toFixed(2)}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {item.grossMarginCny !== null ? (
                          <span className={`font-mono font-semibold ${item.grossMarginCny >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {item.grossMarginCny >= 0 ? `+¥${item.grossMarginCny.toFixed(2)}` : `-¥${Math.abs(item.grossMarginCny).toFixed(2)}`}
                          </span>
                        ) : (
                          <span className="text-white/30">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.marginRate !== null ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              item.marginStatus === 'high'
                                ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                : item.marginStatus === 'healthy'
                                ? 'border border-brand/20 bg-brand/10 text-brand'
                                : item.marginStatus === 'low'
                                ? 'border border-amber-500/30 bg-amber-500/10 text-amber-300'
                                : 'border border-red-500/30 bg-red-500/15 text-red-300 animate-pulse'
                            }`}
                          >
                            {item.marginRate}%
                          </span>
                        ) : (
                          <span className="text-white/30">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={MODE_TONES[item.pricingMode] || 'neutral'}>
                          {MODE_LABELS[item.pricingMode] || item.pricingMode}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canWrite && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setQuickEditModel(item)}
                              className="h-7 text-xs text-brand hover:underline font-semibold"
                            >
                              调价
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: 待审价格版本 (Pending Price Versions & Approval) */}
      {/* ========================================================================= */}
      {activeTab === 'pending' && (
        <div className="space-y-6">
          {/* 指标卡 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <MetricCard
              label="待审核价格版本"
              value={statsPending.total}
              hint="等待管理员核准生效"
              tone={statsPending.total > 0 ? 'warning' : 'good'}
            />
            <MetricCard
              label="涉及规范模型"
              value={statsPending.modelsCount}
              hint="受影响模型数"
              tone="info"
            />
            <MetricCard
              label="涉及供应商数"
              value={statsPending.providersCount}
              hint="渠道商品来源"
              tone="neutral"
            />
            <MetricCard
              label="准入影响说明"
              value={statsPending.total > 0 ? 'PRICE_MISSING 阻断' : '价盘全量已激活'}
              hint="审批通过后解除阻断"
              tone={statsPending.total > 0 ? 'danger' : 'good'}
            />
          </div>

          {/* 工具条与筛选 */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-surface/80 p-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索模型ID、名称或渠道商品..."
                  value={pendingSearch}
                  onChange={(e) => setPendingSearch(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 py-1.5 pl-9 pr-3 text-xs text-white placeholder-gray-500 focus:border-brand focus:outline-none"
                />
              </div>

              {/* 供应商筛选 */}
              <select
                value={pendingProviderFilter}
                onChange={(e) => setPendingProviderFilter(e.target.value)}
                className="rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white/70 outline-none focus:border-brand"
              >
                <option value="">全部供应商渠道 ({pendingPrices.length})</option>
                {pendingProviders.map((prov) => (
                  <option key={prov} value={prov}>
                    {prov}
                  </option>
                ))}
              </select>

              <Button
                variant="secondary"
                size="sm"
                onClick={refreshPendingPrices}
                disabled={pendingLoading}
                className="h-8 rounded-lg"
              >
                <RefreshCw className={`size-3.5 mr-1 ${pendingLoading ? 'animate-spin' : ''}`} />
                刷新
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-white/40 font-mono">
                命中 {filteredPendingPrices.length} / {pendingPrices.length} 个版本
              </span>
              {canWrite && filteredPendingPrices.length > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleBatchApprove}
                  disabled={batchApproving}
                  className="h-8 rounded-lg"
                >
                  {batchApproving ? (
                    <Loader2 className="size-3.5 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-3.5 mr-1" />
                  )}
                  一键批量批准 ({filteredPendingPrices.length})
                </Button>
              )}
            </div>
          </div>

          {/* 待审版本数据表 */}
          <Card className="overflow-hidden p-0 rounded-2xl border border-white/10 shadow-elevation-2">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[900px]">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02] text-gray-400">
                    <th className="px-4 py-3 font-medium">规范模型</th>
                    <th className="px-4 py-3 font-medium">渠道商品 / 供应商</th>
                    <th className="px-4 py-3 font-medium">版本 / 类型 / 状态</th>
                    <th className="px-4 py-3 font-medium">底价配置与单位</th>
                    <th className="px-4 py-3 font-medium">观测时间与来源</th>
                    <th className="px-4 py-3 font-medium">差异摘要</th>
                    <th className="px-4 py-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {filteredPendingPrices.map((price) => {
                    const isApproving = approvingId === price.id;
                    const priceFormatted = formatPendingPrice(price);
                    return (
                      <tr key={price.id} className="transition-colors hover:bg-white/[0.02]">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">
                            {price.modelName || price.model_name || price.model_id}
                          </div>
                          <div className="font-mono text-caption text-ink-subtle mt-0.5">
                            {price.model_id}
                          </div>
                          {price.category && (
                            <span className="mt-1 inline-block rounded bg-white/[0.06] px-1.5 py-0.2 text-[10px] text-ink-muted">
                              {CATEGORY_LABELS[price.category] || price.category}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">
                            {price.providerName || price.provider_name || price.provider_id}
                          </div>
                          <div className="font-mono text-caption text-ink-subtle mt-0.5">
                            {price.providerModelId || price.provider_model_id}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-ink">v{price.version_no}</span>
                            <span className="rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 text-micro font-medium">
                              {price.status}
                            </span>
                          </div>
                          <span className="text-caption text-ink-muted mt-1 block">
                            {price.price_type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono font-bold text-brand text-body-sm">
                            {priceFormatted}
                          </div>
                          <div className="text-caption text-ink-subtle mt-0.5">
                            计费单位: {price.billing_unit} · 币种: {price.currency}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-muted">
                          <div className="flex items-center gap-1 text-caption">
                            <Clock className="size-3 text-ink-subtle" />
                            <span>
                              {price.source_observed_at
                                ? new Date(price.source_observed_at).toLocaleString()
                                : price.fetched_at
                                ? new Date(price.fetched_at).toLocaleString()
                                : '无来源时间'}
                            </span>
                          </div>
                          {price.source_url && (
                            <a
                              href={price.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-flex items-center gap-1 text-brand hover:underline text-micro"
                            >
                              <span>来源核验证据</span>
                              <ExternalLink className="size-2.5" />
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-3 text-ink-subtle max-w-[14rem] truncate">
                          {price.change_summary
                            ? (typeof price.change_summary === 'object'
                                ? JSON.stringify(price.change_summary)
                                : String(price.change_summary))
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canWrite && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleApprovePrice(price.id)}
                              disabled={isApproving || batchApproving}
                              className="h-8 rounded-lg"
                            >
                              {isApproving ? (
                                <Loader2 className="size-3.5 mr-1 animate-spin" />
                              ) : (
                                <Check className="size-3.5 mr-1" />
                              )}
                              批准发布
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredPendingPrices.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-ink-muted">
                        <CheckCircle2 className="size-8 mx-auto mb-2 text-emerald-400/60" />
                        <div className="text-body font-medium text-ink">没有待审核的价格版本</div>
                        <div className="text-caption text-ink-subtle mt-1">
                          所有渠道成本版本均已核准生效，定价引擎处于就绪状态。
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 弹窗 1: 编辑规则定价 Modal (Tab 1) */}
      {/* ========================================================================= */}
      {editingPricing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div>
                <h3 className="text-base font-bold text-white">编辑模型定价</h3>
                <p className="text-xs text-gray-400 font-mono">{editingPricing.modelId}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPricing(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePricing} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400">计费模式</label>
                  <select
                    name="pricingType"
                    defaultValue={editingPricing.pricingType}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white"
                  >
                    <option value="fixed">固定单次扣费</option>
                    <option value="formula">按规格公式计费</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-400">定价策略模式</label>
                  <select
                    name="pricingMode"
                    defaultValue={editingPricing.pricingMode}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white"
                  >
                    <option value="auto">自动倍率计算</option>
                    <option value="manual">手动锁价覆盖</option>
                    <option value="locked">锁定保护 (防自动调价)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400">基础积分 (Credits 扣除点数)</label>
                  <input
                    name="baseCredits"
                    type="number"
                    min="1"
                    defaultValue={editingPricing.baseCredits ?? ''}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white font-mono text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-gray-400">最低毛利率 (%)</label>
                  <input
                    name="minGrossMarginRate"
                    type="number"
                    min="10"
                    max="90"
                    defaultValue={(editingPricing.minGrossMarginRate * 100).toFixed(0)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white font-mono text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-400">手动覆盖法币价格 (CNY，留空表示按积分比例换算)</label>
                <input
                  name="manualOverridePriceCny"
                  type="number"
                  step="0.01"
                  defaultValue={editingPricing.manualOverridePriceCny ?? ''}
                  placeholder="如 1.50"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-gray-400">多规格公式配置 JSON (可选)</label>
                <textarea
                  name="formulaConfig"
                  rows={3}
                  defaultValue={JSON.stringify(editingPricing.formulaConfig || {}, null, 2)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 p-2 font-mono text-[11px] text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="pricingIsActive"
                  name="isActive"
                  type="checkbox"
                  defaultChecked={editingPricing.isActive}
                  className="rounded border-white/20 bg-black/40 text-brand focus:ring-brand"
                />
                <label htmlFor="pricingIsActive" className="text-white">定价规则启用状态</label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.08]">
                <Button type="button" variant="ghost" onClick={() => setEditingPricing(null)} className="rounded-lg">
                  取消
                </Button>
                <Button type="submit" disabled={isSaving} className="bg-brand hover:bg-brand-hover text-white rounded-lg">
                  {isSaving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                  保存规则
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 弹窗 2: 快速调价 Modal (Tab 2) */}
      {/* ========================================================================= */}
      {quickEditModel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div>
                <h3 className="text-base font-bold text-white">快速调整模型售价</h3>
                <p className="text-xs text-gray-400">{quickEditModel.modelName}</p>
              </div>
              <button
                type="button"
                onClick={() => setQuickEditModel(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickSavePrice} className="space-y-4 text-xs">
              <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-1.5">
                <div className="flex justify-between text-white/60">
                  <span>最优渠道成本:</span>
                  <span className="font-mono text-white font-semibold">
                    {quickEditModel.minCostCny !== null ? `¥${quickEditModel.minCostCny.toFixed(2)} (${quickEditModel.minCostUsd?.toFixed(3)} USD)` : '暂无渠道'}
                  </span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>当前基础积分:</span>
                  <span className="font-mono text-brand font-bold">{quickEditModel.baseCredits == null ? '未定价' : `${quickEditModel.baseCredits} 算力`}</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>当前折算售价:</span>
                  <span className="font-mono text-white font-semibold">{quickEditModel.userPriceCny == null ? '未定价' : `¥${quickEditModel.userPriceCny.toFixed(2)}`}</span>
                </div>
              </div>

              <div>
                <label className="text-gray-400">调整为基础积分 (Credits)</label>
                <input
                  name="baseCredits"
                  type="number"
                  min="1"
                  defaultValue={quickEditModel.baseCredits ?? ''}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white font-mono text-base font-bold"
                  required
                />
                <p className="mt-1 text-[11px] text-white/40">1 算力基准价值按 {CREDIT_PRICING_POLICY.cnyPerCredit} 元换算</p>
              </div>

              <div>
                <label className="text-gray-400">定价模式</label>
                <select
                  name="pricingMode"
                  defaultValue={quickEditModel.pricingMode || 'auto'}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white"
                >
                  <option value="auto">自动倍率计算</option>
                  <option value="manual">手动锁价覆盖</option>
                  <option value="locked">锁定保护</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.08]">
                <Button type="button" variant="ghost" onClick={() => setQuickEditModel(null)} className="rounded-lg">
                  取消
                </Button>
                <Button type="submit" disabled={isSaving} className="bg-brand hover:bg-brand-hover text-white rounded-lg">
                  {isSaving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                  确认更新价格
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

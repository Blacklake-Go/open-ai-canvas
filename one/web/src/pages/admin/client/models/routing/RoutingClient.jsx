'use client';

import { CREDIT_PRICING_POLICY } from '@/lib/pricing/creditPolicy';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Card, MetricCard, StatusBadge, Button } from '@/components/admin/AdminUi';
import BrandLogo from '@/components/admin/BrandLogo';
import {
  Route, Play, Search, Shield, Scale, Zap, Clock,
  Loader2, RefreshCw, AlertTriangle, CheckCircle2,
  Settings, Edit3, Check, ExternalLink, SlidersHorizontal,
  DollarSign, Table as TableIcon,
} from 'lucide-react';

/* ── helpers ── */
function money(value, currency = 'CNY', digits = 4) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '未知';
  return `${Number(value).toFixed(digits)} ${currency}`;
}

function channelLabel(providerId, providers = []) {
  return providers.find((p) => p.id === providerId)?.name || providerId || '—';
}

function makeIdempotencyKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const CATEGORY_LABELS = {
  image: '图像生成',
  video: '视频生成',
  audio: '音乐音频',
  workflow: '工作流',
  text: '文本/推理',
};

const MODE_LABELS = {
  auto: '自动倍率',
  manual: '手动锁价',
  locked: '锁定保护',
};

const MODE_TONES = {
  auto: 'good',
  manual: 'warn',
  locked: 'danger',
};

const ROUTING_MODES = [
  { value: 'cost', label: '成本优先', icon: Scale, desc: '优先选择预估成本最低的健康渠道' },
  { value: 'priority', label: '管理员优先级', icon: SlidersHorizontal, desc: '按线路管理员优先级排序，同优先级再比成本与稳定性' },
  { value: 'quality', label: '质量优先', icon: Shield, desc: '优先选择质量评分最高的渠道' },
  { value: 'stability', label: '稳定优先', icon: Clock, desc: '优先选择成功率最高、延迟最低的渠道' },
  { value: 'balanced', label: '智能平衡', icon: Zap, desc: '综合成本、质量和稳定性多因素智能调度' },
];

const ROUTING_FALLBACK_MODE = 'balanced';
const ROUTING_MODE_VALUES = ROUTING_MODES.map((mode) => mode.value);
const ROUTING_FALLBACK_LABEL =
  ROUTING_MODES.find((mode) => mode.value === ROUTING_FALLBACK_MODE)?.label || ROUTING_FALLBACK_MODE;

/**
 * 存量配置可能仍是早期写入的未知值。下拉框不能把它显示成“成本优先”，
 * 否则管理员会误以为该策略已生效；未知值单独列出并说明执行时的回退策略。
 */
function routingModeSelection(model) {
  const stored = String(model?.routing_mode || '').trim().toLowerCase();
  if (!stored) return { value: 'cost', stored: '', unknown: false };
  if (ROUTING_MODE_VALUES.includes(stored)) return { value: stored, stored, unknown: false };
  return { value: '__unknown__', stored, unknown: true };
}


function defaultSimulationParameters(model) {
  if (model?.id === 'bytedance-seedream-v3') {
    return { task_type: 't2i', num_images: 1, aspect_ratio: '1:1' };
  }
  return model?.category?.includes('video')
    ? { task_type: 't2v', duration: 5, resolution: '720p', quality: 'standard' }
    : { task_type: 't2i', num_images: 1, resolution: '1024x1024' };
}

export default function RoutingClient({
  initialTab = 'topology',
  initialSnapshot = { models: [], providers: [] },
  initialPricing = [],
  initialStrategy = {},
  initialBreakdown = [],
  initialPendingPrices = [],
  canWrite = false,
}) {
  const [activeTab, setActiveTab] = useState(
    ['topology', 'pricing', 'pending'].includes(initialTab) ? initialTab : 'topology'
  );

  // 反馈提示
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // ================= Tab 1: 路由拓扑与模拟器 =================
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [search, setSearch] = useState('');
  const [simModelId, setSimModelId] = useState(initialSnapshot.models?.[0]?.id || '');
  const initialSimulatorModel = initialSnapshot.models?.find((m) => m.id === simModelId);
  const [paramsText, setParamsText] = useState(() =>
    JSON.stringify(defaultSimulationParameters(initialSimulatorModel), null, 2)
  );
  const [simulation, setSimulation] = useState(null);

  // ================= Tab 2: 全站价盘策略与安全红线 =================
  const [pricingSubView, setPricingSubView] = useState('rules'); // 'rules' | 'breakdown'
  const [pricingList, setPricingList] = useState(initialPricing);
  const [strategy, setStrategy] = useState({
    baseMultiplier: initialStrategy.baseMultiplier ?? 1.5,
    minMarginRate: initialStrategy.minMarginRate ?? 0.3,
    categoryMultipliers: initialStrategy.categoryMultipliers ?? {},
    tierMultipliers: initialStrategy.tierMultipliers ?? {},
  });
  const [showStrategy, setShowStrategy] = useState(false);
  const [isSavingStrategy, setIsSavingStrategy] = useState(false);
  const [searchRulesKeyword, setSearchRulesKeyword] = useState('');
  const [editingPricing, setEditingPricing] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // 明细大表
  const [breakdownList, setBreakdownList] = useState(initialBreakdown);
  const [breakdownSearch, setBreakdownSearch] = useState('');
  const [breakdownCategory, setBreakdownCategory] = useState('');
  const [breakdownMarginFilter, setBreakdownMarginFilter] = useState('');
  const [quickEditModel, setQuickEditModel] = useState(null);

  // ================= Tab 3: 待审价格版本集中核准 =================
  const [pendingPrices, setPendingPrices] = useState(initialPendingPrices);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [batchApproving, setBatchApproving] = useState(false);
  const [pendingSearch, setPendingSearch] = useState('');
  const [pendingProviderFilter, setPendingProviderFilter] = useState('');

  // URL 状态双向同步
  const switchTab = (tabId) => {
    setActiveTab(tabId);
    setError('');
    setNotice('');
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tabId);
      window.history.replaceState(null, '', url.toString());
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const sp = new URLSearchParams(window.location.search);
      const tab = sp.get('tab');
      if (tab && ['topology', 'pricing', 'pending'].includes(tab)) {
        setActiveTab(tab);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 刷新路由快照
  async function refreshSnapshot() {
    try {
      const res = await fetch('/api/admin/models/control', { cache: 'no-store' });
      const payload = await res.json();
      if (res.ok && payload.data) setSnapshot(payload.data);
    } catch (e) {
      console.error('Failed to refresh snapshot', e);
    }
  }

  // 执行模型管理/路由通用动作
  async function action(actionName, values = {}, { readOnly = false } = {}) {
    if (!readOnly && !canWrite) return null;
    setBusy(actionName);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/admin/models/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(readOnly ? {} : { 'Idempotency-Key': makeIdempotencyKey() }),
        },
        body: JSON.stringify({ action: actionName, ...values }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error?.message || '操作失败');
      const result = payload.data?.result || payload.data;
      if (actionName === 'simulate') {
        setSimulation(result.simulation || result);
      } else if (!readOnly) {
        setNotice(result.message || `${actionName} 已成功完成`);
        await refreshSnapshot();
      }
      return result;
    } catch (cause) {
      setError(cause.message || '操作失败');
      return null;
    } finally {
      setBusy('');
    }
  }

  // 容灾备用开关切换
  const handleToggleFailover = async (model) => {
    if (!canWrite) return;
    const nextVal = !model.failover_enabled;
    // 只提交本次要改的字段：路由策略由服务端按已存配置沿用，
    // 避免把存量未知策略值回传后被判为非法而卡住容灾开关。
    const res = await action('routing_policy', {
      modelId: model.id,
      failoverEnabled: nextVal,
    });
    if (res) {
      setSnapshot((prev) => ({
        ...prev,
        models: (prev.models || []).map((m) =>
          m.id === model.id ? { ...m, failover_enabled: nextVal } : m
        ),
      }));
    }
  };

  // 路由策略切换
  const handleRoutingModeChange = async (modelId, newMode) => {
    if (!canWrite) return;
    const res = await action('routing_policy', { modelId, routingMode: newMode });
    if (res) {
      setSnapshot((prev) => ({
        ...prev,
        models: (prev.models || []).map((m) =>
          m.id === modelId ? { ...m, routing_mode: newMode } : m
        ),
      }));
    }
  };

  // ================= Tab 1 统计与计算 =================
  const filteredModels = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return (snapshot.models || []).filter((m) => {
      if (!kw) return true;
      return [m.id, m.name, m.display_name].some((v) =>
        String(v || '').toLowerCase().includes(kw)
      );
    });
  }, [snapshot.models, search]);

  const routingStats = useMemo(() => {
    const models = snapshot.models || [];
    return {
      total: models.length,
      cost: models.filter((m) => (m.routing_mode || 'cost') === 'cost').length,
      priority: models.filter((m) => m.routing_mode === 'priority').length,
      balanced: models.filter((m) => m.routing_mode === 'balanced').length,
      quality: models.filter((m) => m.routing_mode === 'quality').length,
      stability: models.filter((m) => m.routing_mode === 'stability').length,
    };
  }, [snapshot.models]);

  // ================= Tab 2 统计与计算 =================
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
        if (
          !item.modelId.toLowerCase().includes(kw) &&
          !item.modelName.toLowerCase().includes(kw) &&
          !item.brand.toLowerCase().includes(kw)
        ) {
          return false;
        }
      }
      if (breakdownCategory && item.category !== breakdownCategory) return false;
      if (breakdownMarginFilter && item.marginStatus !== breakdownMarginFilter) return false;
      return true;
    });
  }, [breakdownList, breakdownSearch, breakdownCategory, breakdownMarginFilter]);

  // 保存全局定价策略
  const handleSaveStrategy = async () => {
    setIsSavingStrategy(true);
    try {
      const res = await fetch('/api/admin/models/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': makeIdempotencyKey(),
        },
        body: JSON.stringify({
          action: 'save_pricing_strategy',
          ...strategy,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowStrategy(false);
        setNotice('全局基准倍率与最低毛利率安全红线已更新保存');
        await refreshSnapshot();
      } else {
        setError(data.error?.message || '保存定价策略失败');
      }
    } catch (err) {
      setError('保存异常: ' + err.message);
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
      setError('请填写已核实的正整数积分价格');
      return;
    }
    setIsSaving(true);

    let formulaConfig = editingPricing.formulaConfig || {};
    if (form.formulaConfig) {
      try {
        formulaConfig = JSON.parse(form.formulaConfig.value || '{}');
      } catch (err) {
        setError('公式配置 JSON 格式错误: ' + err.message);
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
      formulaConfig,
    };

    try {
      const res = await fetch('/api/admin/models/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': makeIdempotencyKey(),
        },
        body: JSON.stringify({
          action: 'save_model_pricing',
          ...payload,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotice(`模型 ${payload.modelId} 定价规则已更新`);
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
        setError(data.error?.message || '保存定价失败');
      }
    } catch (err) {
      setError('保存异常: ' + err.message);
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
      setError('请填写已核实的正整数积分价格');
      return;
    }
    const pricingMode = form.pricingMode.value;

    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/models/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': makeIdempotencyKey(),
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
        setNotice(`模型 ${quickEditModel.modelId} 售价已更新为 ${baseCredits} 算力`);
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
        setPricingList((prev) =>
          prev.map((p) =>
            p.modelId === quickEditModel.modelId
              ? { ...p, baseCredits, pricingMode }
              : p
          )
        );
        setQuickEditModel(null);
      } else {
        setError('更新价格失败');
      }
    } catch (err) {
      setError('保存异常: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ================= Tab 3 统计与计算 =================
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
        const modelName = p.modelName || p.model_name || '';
        const providerName = p.providerName || p.provider_name || '';
        const providerModelId = p.providerModelId || p.provider_model_id || '';
        const matchModel =
          (p.model_id && p.model_id.toLowerCase().includes(kw)) ||
          modelName.toLowerCase().includes(kw);
        const matchProvider =
          (p.provider_id && p.provider_id.toLowerCase().includes(kw)) ||
          String(providerModelId).toLowerCase().includes(kw) ||
          providerName.toLowerCase().includes(kw);
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
      setNotice('价格版本已成功批准激活，已成为最新生效底价！');
      await refreshSnapshot();
    } catch (err) {
      setError(`审批失败: ${err.message}`);
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
    const CHUNK_SIZE = 5;

    for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
      const chunk = targets.slice(i, i + CHUNK_SIZE);
      const results = await Promise.allSettled(
        chunk.map((item) =>
          fetch('/api/admin/models/control', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': `approve_price_${item.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            },
            body: JSON.stringify({
              action: 'approve_price',
              versionId: item.id,
            }),
          }).then(async (res) => {
            if (!res.ok) {
              const d = await res.json().catch(() => ({}));
              throw new Error(d.error?.message || 'Failed');
            }
            return item.id;
          })
        )
      );

      for (const r of results) {
        if (r.status === 'fulfilled') {
          successCount++;
          const approvedId = r.value;
          setPendingPrices((prev) => prev.filter((p) => p.id !== approvedId));
        } else {
          failCount++;
        }
      }
    }

    setBatchApproving(false);
    setNotice(`批量审批完成：成功批准 ${successCount} 个价格版本${failCount > 0 ? `，失败 ${failCount} 个` : ''}。`);
    await refreshSnapshot();
  };

  const SUB_TABS = [
    { id: 'topology', label: '模型路由拓扑与故障转移' },
    { id: 'pricing', label: '全站价盘策略与安全红线' },
    { id: 'pending', label: '待审价格版本集中核准', count: pendingPrices.length },
  ];

  return (
    <div className="space-y-6">
      {/* 待审价格警示 Banner (非 pending 标签页时显示) */}
      {pendingPrices.length > 0 && activeTab !== 'pending' && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-elevation-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="size-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>有 {pendingPrices.length} 个渠道价格版本待审核 (pending_review)</span>
                <span className="rounded-full bg-amber-500/20 text-amber-300 px-2 py-0.5 text-[10px] font-bold border border-amber-500/30">
                  防 PRICE_MISSING
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                渠道价格版本处于待审核状态时不会成为活动成本，导致计价路由引擎报 PRICE_MISSING。请核验并批准发布。
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => switchTab('pending')}
              className="rounded-lg"
            >
              前往审核 ({pendingPrices.length}) →
            </Button>
          </div>
        </div>
      )}

      {/* 顶部次级下划线选项卡导航 (WeChat Underline Tabs 契约) */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line-subtle h-12">
        <div className="flex items-center gap-6 sm:gap-8 h-full overflow-x-auto scrollbar-none">
          {SUB_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => switchTab(tab.id)}
                className={`relative h-full inline-flex items-center gap-2 text-xs sm:text-sm transition-colors select-none whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'text-brand font-semibold'
                    : 'text-ink-muted hover:text-ink font-medium'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-brand text-white' : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
                {isActive && (
                  <span className="absolute bottom-0 inset-x-0 h-[2px] bg-brand rounded-full" />
                )}
              </button>
            );
          })}
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

      {/* 消息反馈 */}
      {notice && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400 flex items-center justify-between">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="text-emerald-400 hover:text-emerald-300 ml-2">✕</button>
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="text-red-400 hover:text-red-300 ml-2">✕</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 1: 模型路由拓扑与故障转移 (topology) */}
      {/* ========================================================================= */}
      {activeTab === 'topology' && (
        <div className="space-y-6">
          {/* 指标卡 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard label="路由模型数" value={routingStats.total} hint="所有已注册的规范模型" tone="info" />
            <MetricCard label="成本优先" value={routingStats.cost} hint="按最低预估成本选路" tone="neutral" />
            <MetricCard label="管理员优先级" value={routingStats.priority} hint="按线路优先级排序，同级再比成本" tone="neutral" />
            <MetricCard label="智能平衡" value={routingStats.balanced} hint="综合多因素智能调度" tone="good" />
            <MetricCard label="质量/稳定" value={routingStats.quality + routingStats.stability} hint="偏重质量或稳定性" tone="neutral" />
          </div>

          {/* 路由策略参考 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {ROUTING_MODES.map((mode) => {
              const Icon = mode.icon;
              return (
                <Card key={mode.value} className="border-white/[0.06] hover:border-white/[0.12] transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="size-4 text-brand" />
                    <h3 className="text-xs font-semibold text-white">{mode.label}</h3>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-5">{mode.desc}</p>
                </Card>
              );
            })}
          </div>

          {/* 搜索栏 */}
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-gray-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索模型名称或 ID..."
                className="w-full rounded-lg border border-white/[0.1] bg-white/[0.03] pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"
              />
            </div>
            <span className="text-xs text-gray-500 font-mono">{filteredModels.length} 个模型</span>
          </div>

          {/* 路由拓扑与容灾表 */}
          <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-surface/90 shadow-xl backdrop-blur-md">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/[0.08] bg-white/[0.02] uppercase tracking-[0.06em] text-gray-400">
                <tr>
                  <th className="px-4 py-3.5">模型主体</th>
                  <th className="px-4 py-3.5">类型</th>
                  <th className="px-4 py-3.5">路由策略</th>
                  <th className="px-4 py-3.5">已审核健康通道</th>
                  <th className="px-4 py-3.5">容灾故障转移 (Failover)</th>
                  <th className="px-4 py-3.5 text-right">选路模拟</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredModels.map((model) => {
                  const routes = model.routes || [];
                  const routeMode = routingModeSelection(model);
                  const approvedHealthyRoutes = routes.filter(
                    (r) => r.review_status === 'approved' && r.health_status !== 'unhealthy' && r.enabled !== false
                  );
                  return (
                    <tr key={model.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <BrandLogo model={model} size="sm" className="rounded-md shrink-0" />
                          <div>
                            <span className="block font-semibold text-white">{model.display_name || model.name}</span>
                            <span className="block font-mono text-[10px] text-gray-500 mt-0.5">{model.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 capitalize">
                        {CATEGORY_LABELS[model.category] || model.category}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          aria-label={`${model.display_name || model.name || model.id} 路由策略`}
                          value={routeMode.value}
                          onChange={(e) => handleRoutingModeChange(model.id, e.target.value)}
                          disabled={!canWrite || busy === 'routing_policy'}
                          className="rounded-lg border border-white/[0.12] bg-surface-raised px-2.5 py-1 text-xs text-white focus:border-brand focus:outline-none disabled:opacity-50"
                        >
                          {routeMode.unknown && (
                            <option value="__unknown__" disabled>
                              未知策略（执行时按{ROUTING_FALLBACK_LABEL}）
                            </option>
                          )}
                          {ROUTING_MODES.map((mode) => (
                            <option key={mode.value} value={mode.value}>{mode.label}</option>
                          ))}
                        </select>
                        {routeMode.unknown && (
                          <span className="mt-1 block max-w-[16rem] font-mono text-[10px] leading-4 text-amber-300/80">
                            存量值 “{routeMode.stored}” 无法识别，重新选择后生效
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white">{approvedHealthyRoutes.length}</span>
                          <span className="text-gray-500"> / {routes.length} 条</span>
                          {approvedHealthyRoutes.length === 0 ? (
                            <span className="rounded-full bg-red-500/15 border border-red-500/30 text-red-300 px-2 py-0.5 text-[10px] font-bold">
                              ⚠️ 0 可用通道
                            </span>
                          ) : (
                            <span className="text-[11px] text-emerald-400/80 font-mono">
                              (最低 ¥{approvedHealthyRoutes[0]?.cost_cny ? Number(approvedHealthyRoutes[0].cost_cny).toFixed(2) : '—'})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleToggleFailover(model)}
                          disabled={!canWrite || busy === 'routing_policy'}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                            model.failover_enabled
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                              : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                          } disabled:opacity-50`}
                        >
                          <span className={`size-1.5 rounded-full ${model.failover_enabled ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                          <span>{model.failover_enabled ? '已启用自动容灾' : '未开启容灾'}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSimModelId(model.id);
                            setParamsText(JSON.stringify(defaultSimulationParameters(model), null, 2));
                            document.getElementById('route-simulator')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-white/[0.06] hover:text-brand transition-colors"
                          title="运行选路模拟"
                        >
                          <Play className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!filteredModels.length && (
              <p className="px-4 py-10 text-center text-xs text-gray-500">当前搜索无匹配模型。</p>
            )}
          </div>

          {/* 路由模拟器 */}
          <Card id="route-simulator" className="border-white/[0.08]">
            <div className="grid gap-5 lg:grid-cols-[minmax(16rem,.75fr)_minmax(20rem,1.25fr)]">
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Route className="size-4 text-brand" />
                  模拟报价与选路解释
                </h2>
                <p className="text-xs text-gray-400 leading-5">
                  只运行服务端报价和路由计算，不提交生成任务、不预扣积分。模拟与用户报价共用同一计价与候选筛选逻辑。
                </p>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">规范模型</label>
                  <select
                    value={simModelId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSimModelId(id);
                      const model = (snapshot.models || []).find((m) => m.id === id);
                      setParamsText(JSON.stringify(defaultSimulationParameters(model), null, 2));
                      setSimulation(null);
                    }}
                    className="w-full rounded-lg border border-white/[0.12] bg-surface-raised px-3 py-2 text-xs text-white focus:border-brand focus:outline-none"
                  >
                    {(snapshot.models || []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.display_name || m.name} · {m.id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">本次规格 JSON</label>
                  <textarea
                    value={paramsText}
                    onChange={(e) => setParamsText(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-white/[0.1] bg-white/[0.03] p-3 font-mono text-xs text-white focus:border-brand focus:outline-none"
                    spellCheck="false"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    onClick={async () => {
                      try {
                        await action('simulate', { modelId: simModelId, parameters: JSON.parse(paramsText) }, { readOnly: true });
                      } catch {
                        setError('规格 JSON 格式无效');
                      }
                    }}
                    disabled={busy === 'simulate'}
                    className="rounded-xl bg-brand hover:bg-brand-hover text-white px-5 py-2 text-xs font-semibold shadow-sm transition-all"
                  >
                    {busy === 'simulate' ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Play className="mr-1 size-3" />}
                    模拟报价与选路
                  </Button>
                  {simulation?.selectedProviderId && (
                    <StatusBadge tone="good">
                      选中 {channelLabel(simulation.selectedProviderId, snapshot.providers)} ·{' '}
                      {money(simulation.candidates?.find((c) => c.providerId === simulation.selectedProviderId)?.estimatedCostCny)}
                    </StatusBadge>
                  )}
                </div>
                {simulation && (
                  <div className="grid gap-2 border-t border-white/[0.06] pt-3 text-xs">
                    <p className="text-gray-200">
                      <span className="font-medium">为什么选这家：</span>
                      {simulation.selectionReason || '无合格渠道'}
                    </p>
                    <p className="text-gray-400">
                      站点售价 {simulation.sitePriceCny === null ? '未知' : money(simulation.sitePriceCny)} ·
                      用户扣减 {simulation.credits ?? '未知'} 积分 ·
                      毛利 {simulation.marginCheck?.grossMarginRate == null ? '未知' : `${(simulation.marginCheck.grossMarginRate * 100).toFixed(1)}%`}
                    </p>
                    {simulation.pricingError && (
                      <p className="text-amber-400">报价状态：{simulation.pricingError.message}</p>
                    )}
                    <div className="grid gap-2 pt-1">
                      {(simulation.candidates || []).map((c) => (
                        <div
                          key={`${c.providerId}:${c.providerModelId}`}
                          className="flex flex-wrap justify-between gap-2 rounded-lg border border-white/[0.06] px-3 py-2"
                        >
                          <span className="text-gray-200">
                            {channelLabel(c.providerId, snapshot.providers)} · {c.providerModelId}
                          </span>
                          <span className="font-mono text-gray-400">
                            {money(c.estimatedCostCny)} · 成功率 {(c.successRate * 100).toFixed(0)}% · {Math.round(c.latencyMs)} ms
                          </span>
                        </div>
                      ))}
                    </div>
                    {!!simulation.rejectedCandidates?.length && (
                      <details className="pt-1 text-gray-500">
                        <summary className="cursor-pointer text-xs">
                          查看 {simulation.rejectedCandidates.length} 个被拒候选与原因
                        </summary>
                        <ul className="mt-2 grid gap-1">
                          {simulation.rejectedCandidates.map((item, i) => (
                            <li key={`${item.providerId}-${i}`} className="text-[11px]">
                              {item.providerId} / {item.providerModelId}：{item.reason}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: 全站价盘策略与安全红线 (pricing) */}
      {/* ========================================================================= */}
      {activeTab === 'pricing' && (
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

          {/* 全局安全红线折叠配置卡 */}
          <Card className="border-white/[0.08]">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Settings className="size-4 text-brand" />
                <h3 className="text-sm font-semibold text-white">全站全局定价策略与安全红线</h3>
                <span className="text-xs text-gray-400">
                  基准 {strategy.baseMultiplier}x · 最低毛利率安全红线 {(strategy.minMarginRate * 100).toFixed(0)}%
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowStrategy(!showStrategy)}
                className="text-xs text-brand hover:underline font-semibold"
              >
                {showStrategy ? '收起配置' : '配置安全红线'}
              </Button>
            </div>

            {showStrategy && (
              <div className="mt-4 space-y-4 pt-2">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <div>
                    <label className="text-xs text-gray-400">基准倍率 (建议售价 = 成本 × 倍率)</label>
                    <input
                      type="number"
                      step="0.05"
                      min="1.0"
                      value={strategy.baseMultiplier}
                      onChange={(e) => setStrategy({ ...strategy, baseMultiplier: Number(e.target.value) })}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white focus:border-brand focus:outline-none"
                      disabled={!canWrite}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">最低毛利率安全红线 (%)</label>
                    <input
                      type="number"
                      step="1"
                      min="10"
                      max="90"
                      value={strategy.minMarginRate * 100}
                      onChange={(e) => setStrategy({ ...strategy, minMarginRate: Number(e.target.value) / 100 })}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white focus:border-brand focus:outline-none"
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
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white focus:border-brand focus:outline-none"
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
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white focus:border-brand focus:outline-none"
                      disabled={!canWrite}
                    />
                  </div>
                </div>

                <p className="text-xs text-gray-400">
                  自动定价公式：建议售价 = max(渠道最低成本 × 有效倍率, 渠道成本 ÷ (1 - 最低毛利率))。留空的类别将使用基准倍率。手动锁价的模型不受倍率影响。
                </p>

                {canWrite && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handleSaveStrategy}
                      disabled={isSavingStrategy}
                      size="sm"
                      className="bg-brand hover:bg-brand-hover text-white rounded-lg"
                    >
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

          {/* 视图切换 (规则表 / 穿透明细表) */}
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPricingSubView('rules')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  pricingSubView === 'rules'
                    ? 'bg-brand text-white shadow-sm'
                    : 'bg-white/[0.04] text-gray-400 hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                <SlidersHorizontal className="size-3.5" />
                <span>模型定价规则表 ({pricingList.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setPricingSubView('breakdown')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  pricingSubView === 'breakdown'
                    ? 'bg-brand text-white shadow-sm'
                    : 'bg-white/[0.04] text-gray-400 hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                <TableIcon className="size-3.5" />
                <span>多渠道底价与毛利透视表 ({breakdownList.length})</span>
              </button>
            </div>
          </div>

          {/* 视图 A: 定价规则表 */}
          {pricingSubView === 'rules' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-xs font-semibold text-gray-300">各规范模型定价模式与扣点</h3>
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

              <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-surface/90 shadow-xl backdrop-blur-md">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/[0.08] bg-white/[0.02] text-gray-400 uppercase tracking-[0.06em]">
                    <tr>
                      <th className="px-4 py-3 font-medium">模型</th>
                      <th className="px-4 py-3 font-medium">类型</th>
                      <th className="px-4 py-3 font-medium">计费模式</th>
                      <th className="px-4 py-3 font-medium">定价方式</th>
                      <th className="px-4 py-3 font-medium">基础积分</th>
                      <th className="px-4 py-3 font-medium">最低毛利安全线</th>
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
                              <div className="font-semibold text-white truncate">{p.modelName}</div>
                              <div className="text-[10px] text-gray-500 font-mono truncate">{p.modelId}</div>
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
                          {p.baseCredits == null ? '未定价' : `${p.baseCredits} 算力`}
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
                              <Edit3 className="mr-1 size-3" /> 编辑规则
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!filteredRulesList.length && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                          无匹配模型定价规则
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 视图 B: 穿透底价与毛利透视表 */}
          {pricingSubView === 'breakdown' && (
            <div className="space-y-4">
              {/* 明细指标 */}
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

              {/* 筛选与搜索 */}
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

              {/* 明细大表 */}
              <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-surface/90 shadow-xl backdrop-blur-md">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/[0.08] bg-white/[0.02] text-gray-400 uppercase tracking-[0.06em]">
                    <tr>
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
                            <span className="text-[10px] text-gray-500 font-mono">{item.modelId}</span>
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
                                    switchTab('pending');
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
                          <span className="font-mono font-bold text-brand text-sm">
                            {item.baseCredits == null ? '未定价' : `${item.baseCredits} 算力`}
                          </span>
                          {item.userPriceCny != null && (
                            <span className="text-[11px] text-white/40 font-mono block">≈ ¥{item.userPriceCny.toFixed(2)}</span>
                          )}
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: 待审价格版本集中核准 (pending) */}
      {/* ========================================================================= */}
      {activeTab === 'pending' && (
        <div className="space-y-6">
          {/* 指标卡 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <MetricCard
              label="待审核价格版本"
              value={statsPending.total}
              hint="等待管理员核准生效"
              tone={statsPending.total > 0 ? 'warn' : 'good'}
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
                  className="h-8 rounded-lg bg-brand hover:bg-brand-hover text-white"
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
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-surface/90 shadow-xl backdrop-blur-md">
            <table className="w-full text-left text-xs min-w-[900px]">
              <thead className="border-b border-white/[0.08] bg-white/[0.02] text-gray-400 uppercase tracking-[0.06em]">
                <tr>
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
                        <div className="font-mono text-[10px] text-gray-500 mt-0.5">
                          {price.model_id}
                        </div>
                        {price.category && (
                          <span className="mt-1 inline-block rounded bg-white/[0.06] px-1.5 py-0.2 text-[10px] text-gray-400">
                            {CATEGORY_LABELS[price.category] || price.category}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">
                          {price.providerName || price.provider_name || price.provider_id}
                        </div>
                        <div className="font-mono text-[10px] text-gray-500 mt-0.5">
                          {price.providerModelId || price.provider_model_id}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-white">v{price.version_no}</span>
                          <span className="rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 text-[10px] font-medium">
                            {price.status}
                          </span>
                        </div>
                        <span className="text-[11px] text-gray-400 mt-1 block">
                          {price.price_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono font-bold text-brand text-sm">
                          {priceFormatted}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          单位: {price.billing_unit} · 币种: {price.currency}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        <div className="flex items-center gap-1 text-[11px]">
                          <Clock className="size-3 text-gray-500" />
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
                            className="mt-1 inline-flex items-center gap-1 text-brand hover:underline text-[10px]"
                          >
                            <span>来源核验证据</span>
                            <ExternalLink className="size-2.5" />
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 max-w-[14rem] truncate">
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
                            className="h-8 rounded-lg bg-brand hover:bg-brand-hover text-white"
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
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      <CheckCircle2 className="size-8 mx-auto mb-2 text-emerald-400/60" />
                      <div className="text-sm font-medium text-white">没有待审核的价格版本</div>
                      <div className="text-xs text-gray-500 mt-1">
                        所有渠道成本版本均已核准生效，定价引擎处于就绪状态。
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 弹窗 1: 编辑规则定价 Modal (Tab 2) */}
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
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white focus:border-brand focus:outline-none"
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
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white focus:border-brand focus:outline-none"
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
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white font-mono text-sm focus:border-brand focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-gray-400">最低毛利率安全线 (%)</label>
                  <input
                    name="minGrossMarginRate"
                    type="number"
                    min="10"
                    max="90"
                    defaultValue={(editingPricing.minGrossMarginRate * 100).toFixed(0)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white font-mono text-sm focus:border-brand focus:outline-none"
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
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white font-mono focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="text-gray-400">多规格公式配置 JSON (可选)</label>
                <textarea
                  name="formulaConfig"
                  rows={3}
                  defaultValue={JSON.stringify(editingPricing.formulaConfig || {}, null, 2)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 p-2 font-mono text-[11px] text-white focus:border-brand focus:outline-none"
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
      {/* 弹窗 2: 快速调价 Modal (Tab 2 Breakdown) */}
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
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white font-mono text-base font-bold focus:border-brand focus:outline-none"
                  required
                />
                <p className="mt-1 text-[11px] text-white/40">1 算力基准价值按 {CREDIT_PRICING_POLICY.cnyPerCredit} 元换算</p>
              </div>

              <div>
                <label className="text-gray-400">定价模式</label>
                <select
                  name="pricingMode"
                  defaultValue={quickEditModel.pricingMode || 'auto'}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white focus:border-brand focus:outline-none"
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

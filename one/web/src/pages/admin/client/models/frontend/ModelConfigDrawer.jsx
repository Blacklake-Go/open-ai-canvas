'use client';

import { CREDIT_PRICING_POLICY } from '@/lib/pricing/creditPolicy';
import { useState, useEffect, useMemo } from 'react';
import {
  X, Save, Loader2, RefreshCw, CheckCircle2, XCircle,
  Eye, Pin, Star, Sparkles, Check, AlertTriangle, Layers,
  DollarSign, Zap, Sliders, Server, ShieldCheck, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/admin/AdminUi';
import BrandLogo from '@/components/admin/BrandLogo';
import { resolveBrand } from '@/lib/modelCenter/brandDictionary.js';
import ModelDisplayRow from '@/packages/studio/src/components/ModelDisplayRow.jsx';
import { getStaticModelDisplayMeta } from '@/packages/studio/src/modelDisplayFormat.js';

const PRESET_BADGES = ['最新', '经济', '旗舰', '极速', 'New', 'Best', 'Hot', 'Pro', 'Fast', '4.5 旗舰', '3.0', '置顶'];
const PRESET_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '3:2', '2:3'];
const PRESET_RESOLUTIONS = ['1024x1024', '1280x720', '720x1280', '1920x1080', '1080x1920', '2048x2048', '3840x2160'];
const PRESET_DURATIONS = [3, 5, 10, 15, 30, 60];

const CATEGORY_MAP = {
  image: '图像模型',
  video: '视频模型',
  audio: '音频模型',
  text: '智能体 / 语言',
};

const SUBTYPE_OPTIONS = {
  image: [
    { id: 't2i', label: '文生图 (T2I)' },
    { id: 'i2i', label: '图生图 (I2I)' },
  ],
  video: [
    { id: 't2v', label: '文生视频 (T2V)' },
    { id: 'i2v', label: '图生视频 (I2V)' },
    { id: 'v2v', label: '视频编辑 (V2V)' },
  ],
  audio: [
    { id: 'music', label: '音乐生成' },
    { id: 'tts', label: '语音 (TTS)' },
    { id: 'sfx', label: '音效 (SFX)' },
  ],
  text: [
    { id: 'chat', label: '智能对话' },
    { id: 'reasoning', label: '深度推理' },
  ],
};

/**
 * 工业级高精度状态开关 (Precision Switch)
 * 严格遵循 UI_DESIGN_SYSTEM.md §4.15.3 规范：
 * 24px 高度、44px 宽度、纯白正圆滚珠、--ease-bounce 缓动滑动与键盘无障碍支持
 */
function PrecisionSwitch({
  checked = false,
  onChange,
  disabled = false,
  size = 'md',
  id,
  'aria-label': ariaLabel,
}) {
  const isSm = size === 'sm';
  const trackHeight = isSm ? 'h-5 w-9' : 'h-6 w-11';
  const thumbSize = isSm ? 'size-3.5' : 'size-4';
  const translate = checked
    ? (isSm ? 'translate-x-4' : 'translate-x-5')
    : 'translate-x-1';

  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-label={ariaLabel}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative inline-flex items-center shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-40 disabled:cursor-not-allowed ${trackHeight} ${
        checked ? 'bg-brand shadow-elevation-1' : 'bg-white/10 hover:bg-white/15'
      }`}
    >
      <span
        className={`pointer-events-none block rounded-full bg-white shadow-md transform transition-transform duration-200 ease-out ${thumbSize} ${translate}`}
      />
    </button>
  );
}

export default function ModelConfigDrawer({
  isOpen,
  onClose,
  model,
  isNew = false,
  allModels = [],
  activeCategory = 'image',
  canWrite = false,
  onSave,
  onSmartMatch,
  onRunCheck,
}) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'pricing' | 'capabilities'
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [inlineCandidates, setInlineCandidates] = useState([]);
  const [channelRoutes, setChannelRoutes] = useState([]);

  useEffect(() => {
    if (!isOpen) return;

    if (isNew) {
      setFormData({
        model_id: '',
        display_name: '',
        pricing_hint: '',
        description: '',
        badge: 'New',
        sub_type: activeCategory === 'image' ? 't2i' : activeCategory === 'video' ? 't2v' : '',
        sort: 1,
        tier: 'core',
        is_featured: false,
        is_pinned: false,
        is_visible: true,
        credits: 50,
        category: activeCategory === 'all' ? 'image' : activeCategory,
        supported_ratios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
        supported_resolutions: ['1024x1024', '1280x720', '720x1280'],
        supported_durations: [5, 10],
        capabilities: {},
        min_cost_cny: null,
        min_cost_usd: null,
        primary_provider: '',
        backup_provider_id: '',
        backup_model_id: '',
        approved_routes: 0,
        healthy_routes: 0,
      });
      setChannelRoutes([]);
    } else if (model) {
      const initialCredits = Number(model.base_credits) > 0
        ? Number(model.base_credits)
        : (Number(model.credits_price) > 0 ? Number(model.credits_price) : 10);

      const routesList = Array.isArray(model.routes) ? model.routes : [];
      setChannelRoutes(routesList.map((r) => ({ ...r })));

      const primaryRoute = routesList.find((r) => r.provider_id === model.provider || r.provider_id === model.default_provider) || routesList[0];
      const backupRoute = routesList.find((r) => r.provider_id === model.backup_provider_id);

      setFormData({
        model_id: model.id,
        display_name: model.display_name || model.name || '',
        pricing_hint: model.pricing_hint || (model.capabilities?.pricing_hint) || '',
        description: model.description || '',
        badge: model.badge || '',
        sub_type: model.sub_type || (model.capabilities?.sub_type) || '',
        sort: model.sort ?? 1,
        tier: model.tier || 'core',
        is_featured: Boolean(model.is_featured),
        is_pinned: Boolean(model.is_pinned),
        is_visible: Boolean(model.is_visible),
        credits: initialCredits,
        category: model.category || 'image',
        supported_ratios: Array.isArray(model.supported_ratios) && model.supported_ratios.length > 0
          ? model.supported_ratios
          : ['1:1', '16:9', '9:16', '4:3', '3:4'],
        supported_resolutions: Array.isArray(model.supported_resolutions) && model.supported_resolutions.length > 0
          ? model.supported_resolutions
          : ['1024x1024', '1280x720', '720x1280'],
        supported_durations: Array.isArray(model.supported_durations) && model.supported_durations.length > 0
          ? model.supported_durations
          : [5, 10],
        capabilities: typeof model.capabilities === 'object' && model.capabilities ? model.capabilities : {},
        min_cost_cny: model.min_cost_cny !== undefined && model.min_cost_cny !== null ? Number(model.min_cost_cny) : null,
        min_cost_usd: model.min_cost_usd !== undefined && model.min_cost_usd !== null ? Number(model.min_cost_usd) : null,
        primary_provider: model.provider || model.default_provider || (routesList[0]?.provider_id) || '',
        primary_route_id: primaryRoute?.id || '',
        backup_provider_id: model.backup_provider_id || '',
        backup_route_id: backupRoute?.id || '',
        approved_routes: model.approved_routes ?? routesList.filter((r) => r.review_status === 'approved').length,
        healthy_routes: model.healthy_routes ?? routesList.filter((r) => r.enabled && r.review_status === 'approved').length,
        provider_ids: model.provider_ids || [],
      });

      // Proactively fetch smart candidates if no routes
      if (!model.approved_routes || Number(model.approved_routes) === 0) {
        fetch('/api/admin/models/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'match_channel_candidates',
            modelId: model.id,
            category: model.category || 'image',
            limit: 3,
          }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (Array.isArray(d.data?.candidates)) {
              setInlineCandidates(d.data.candidates);
            }
          })
          .catch(() => {});
      } else {
        setInlineCandidates([]);
      }
    }
    setCheckResult(null);
  }, [isOpen, isNew, model, activeCategory]);

  // 键盘 Escape 监听与底层画布滚动锁定
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !saving) {
        onClose?.();
      }
    };
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, saving, onClose]);

  const brandInfo = useMemo(() => {
    return resolveBrand(model || { id: formData.model_id, name: formData.display_name });
  }, [model, formData.model_id, formData.display_name]);

  // Margin calculation with real-time recalculation & loss detection
  const marginMetrics = useMemo(() => {
    let costCny = formData.min_cost_cny !== null && formData.min_cost_cny !== undefined ? Number(formData.min_cost_cny) : null;
    if (costCny === null || !Number.isFinite(costCny) || costCny <= 0) {
      const validRouteCosts = channelRoutes
        .map((r) => Number(r.cost_cny))
        .filter((c) => Number.isFinite(c) && c > 0);
      if (validRouteCosts.length > 0) {
        costCny = Math.min(...validRouteCosts);
      }
    }
    const credits = Number(formData.credits || 0);
    const userPriceCny = credits * CREDIT_PRICING_POLICY.cnyPerCredit; // Shared with the quote engine.

    if (costCny !== null && costCny > 0 && userPriceCny > 0) {
      const marginCny = userPriceCny - costCny;
      const rate = Number(((marginCny / userPriceCny) * 100).toFixed(1));
      let status = 'healthy';
      if (rate < 0) status = 'loss';
      else if (rate < 30) status = 'low';
      else if (rate >= 30) status = 'healthy';

      return {
        hasData: true,
        userPriceCny: userPriceCny.toFixed(2),
        costCny: costCny.toFixed(3),
        marginCny: marginCny.toFixed(2),
        rate,
        status,
      };
    }
    return { hasData: false, userPriceCny: userPriceCny.toFixed(2), costCny: '—', rate: null, status: 'unknown' };
  }, [formData.min_cost_cny, formData.credits, channelRoutes]);

  const handleRunCheck = async () => {
    const id = formData.model_id;
    if (!id) return;
    setChecking(true);
    setCheckResult(null);
    try {
      if (onRunCheck) {
        const res = await onRunCheck(id);
        setCheckResult(res);
      } else {
        const res = await fetch('/api/admin/models/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'simulate', modelId: id }),
        });
        const d = await res.json();
        if (res.ok && !d.data?.simulation?.blocked) {
          setCheckResult({ ok: true, msg: `路由通畅：选中 ${d.data?.simulation?.selectedProviderId || '已就绪'}` });
        } else {
          setCheckResult({ ok: false, msg: d.data?.simulation?.selectionReason || '当前无可用路由通道' });
        }
      }
    } catch (err) {
      setCheckResult({ ok: false, msg: `检测失败: ${err.message}` });
    } finally {
      setChecking(false);
    }
  };

  const handleRoutePriorityChange = (routeId, newPriority) => {
    setChannelRoutes((prev) =>
      prev.map((r) => (r.id === routeId ? { ...r, priority: Number(newPriority) } : r))
    );
  };

  const handleCategoryChange = (newCat) => {
    const validSubTypes = SUBTYPE_OPTIONS[newCat] || [];
    const currentSubType = formData.sub_type;
    const isValid = validSubTypes.some((s) => s.id === currentSubType);
    const nextSubType = isValid ? currentSubType : (validSubTypes[0]?.id || '');
    setFormData((f) => {
      const nextDurations = (newCat === 'video' || newCat === 'audio')
        ? ((f.supported_durations && f.supported_durations.length > 0) ? f.supported_durations : [5, 10])
        : f.supported_durations;
      return {
        ...f,
        category: newCat,
        sub_type: nextSubType,
        supported_durations: nextDurations,
      };
    });
  };

  const handleRouteEnabledToggle = (routeId) => {
    setChannelRoutes((prev) =>
      prev.map((r) => (r.id === routeId ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const handleSetPrimaryRoute = (route) => {
    setFormData((f) => ({
      ...f,
      primary_provider: route.provider_id,
      primary_route_id: route.id,
      backup_provider_id: (f.backup_route_id === route.id || f.backup_provider_id === route.provider_id) ? '' : f.backup_provider_id,
      backup_route_id: f.backup_route_id === route.id ? '' : f.backup_route_id,
    }));
    setChannelRoutes((prev) => {
      const maxPriority = prev.reduce((m, r) => Math.max(m, Number(r.priority) || 0), 0);
      return prev.map((r) => {
        if (r.id === route.id) {
          return {
            ...r,
            priority: Math.max(maxPriority + 10, 60),
            enabled: true,
          };
        }
        return r;
      });
    });
  };

  const handleSetBackupRoute = (route) => {
    const isCurBackup = formData.backup_route_id === route.id || formData.backup_provider_id === route.provider_id;
    if (isCurBackup) {
      setFormData((f) => ({ ...f, backup_provider_id: '', backup_route_id: '' }));
    } else {
      setFormData((f) => ({
        ...f,
        backup_provider_id: route.provider_id,
        backup_route_id: route.id,
        primary_provider: f.primary_route_id === route.id ? '' : f.primary_provider,
        primary_route_id: f.primary_route_id === route.id ? '' : f.primary_route_id,
      }));
    }
  };

  const handleSave = async () => {
    if (!canWrite) return;
    const targetId = formData.model_id;
    if (!targetId) return;

    const credits = Number(formData.credits);
    if (!Number.isInteger(credits) || credits <= 0) {
      alert('单次生成积分必须为大于0的正整数');
      return;
    }

    // 计算当前健康可用通道数
    const healthyRoutesCount = channelRoutes.filter(
      (r) => r.enabled && (r.review_status === 'approved' || !r.review_status) && (r.health_status === 'healthy' || !r.health_status)
    ).length;
    const activeHealthyCount = channelRoutes.length > 0 ? healthyRoutesCount : Number(formData.healthy_routes || 0);
    const isZeroRoutes = activeHealthyCount <= 0;

    // 负毛利安全红线拦截与二次确认
    if (marginMetrics.hasData && marginMetrics.status === 'loss') {
      const ok = typeof window === 'undefined' ? true : window.confirm(
        `【⚠️ 赤红负毛利安全警示】当前单次积分定价 (${credits} 积分 ≈ ¥${marginMetrics.userPriceCny}) 低于采购底价 (¥${marginMetrics.costCny})，每笔生成将亏损 ¥${Math.abs(Number(marginMetrics.marginCny)).toFixed(2)}。确定仍要保存吗？`
      );
      if (!ok) return;
    }

    // 0 渠道阻断安全警示与二次确认
    if (isZeroRoutes && formData.is_visible) {
      const ok = typeof window === 'undefined' ? true : window.confirm(
        '【🔴 0 渠道阻断警示】当前模型可用通道数为 0。若开启前台展示，用户下单时将无法成功路由。确定仍要开启展示并保存吗？'
      );
      if (!ok) return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        category: formData.category,
        sub_type: formData.sub_type,
        primary_provider: formData.primary_provider,
        backup_provider_id: formData.backup_provider_id,
        backup_model_id: formData.backup_model_id,
        channel_routes: channelRoutes,
        supported_ratios: formData.supported_ratios || [],
        supported_resolutions: formData.supported_resolutions || [],
        supported_durations: formData.supported_durations || [],
        capabilities: {
          ...(formData.capabilities || {}),
          pricing_hint: (formData.pricing_hint || '').trim(),
        },
      };
      await onSave(payload);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const previewModelId = formData.model_id || model?.id || '';
  const previewFallback = getStaticModelDisplayMeta(previewModelId, 'zh');
  const previewName = formData.display_name || model?.name || previewModelId || '模型展示名称';
  const previewBadge = formData.badge || previewFallback.badge || '';
  const previewDesc = formData.description || previewFallback.description;
  const previewProvider = formData.primary_provider || model?.provider || model?.default_provider || brandInfo?.id;
  const activeHealthyCount = channelRoutes.length > 0
    ? channelRoutes.filter((r) => r.enabled && (r.review_status === 'approved' || !r.review_status) && (r.health_status === 'healthy' || !r.health_status)).length
    : Number(formData.healthy_routes || 0);
  const hasZeroRoutes = activeHealthyCount <= 0;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-3 sm:p-5 lg:p-6 xl:p-8 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      {/* Floating Modal Window (Responsive Mission-Control Dual-Column Workbench) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl max-h-[92vh] bg-[#131519] border border-white/10 rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden text-ink animate-modal-enter"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] bg-[#191c21] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <BrandLogo model={formData} size="md" className="rounded-xl shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-body-lg font-bold text-ink truncate">
                  {isNew ? '引入前台新模型' : `一站式配置 · ${formData.display_name || formData.model_id}`}
                </h2>
                <span className="rounded-full bg-brand/15 text-brand px-2 py-0.5 text-[10px] font-bold border border-brand/30">
                  {brandInfo.shortName}
                </span>
                {activeHealthyCount > 0 ? (
                  <span className="rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono font-medium flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {activeHealthyCount}/{channelRoutes.length} 通道就绪
                  </span>
                ) : (
                  <span className="rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 px-2 py-0.5 text-[10px] font-medium flex items-center gap-1">
                    <AlertTriangle className="size-2.5" />
                    0 渠道阻断
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 font-mono text-caption text-ink-subtle">
                <span>ID: {formData.model_id || '未绑定'}</span>
                <span>·</span>
                <span>分类: {CATEGORY_MAP[formData.category] || formData.category}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {!isNew && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRunCheck}
                disabled={checking || saving}
                className="h-8 text-xs font-mono bg-white/[0.04] hover:bg-white/[0.08] text-ink"
              >
                {checking ? <Loader2 className="size-3 animate-spin mr-1 text-brand" /> : <RefreshCw className="size-3 mr-1 text-brand" />}
                模拟路由
              </Button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="p-1.5 rounded-xl text-ink-subtle hover:text-ink hover:bg-white/[0.08] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="关闭浮窗"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Check Result Alert */}
        {checkResult && (
          <div className={`px-6 py-2.5 border-b text-caption flex items-center gap-2 ${
            checkResult.ok
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-red-500/10 border-red-500/20 text-red-300'
          }`}>
            {checkResult.ok ? <CheckCircle2 className="size-4 shrink-0 text-emerald-400" /> : <XCircle className="size-4 shrink-0 text-red-400" />}
            <span className="font-medium font-mono">{checkResult.msg}</span>
          </div>
        )}

        {/* Drawer Body (Two-Column Linked Canvas) */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <fieldset disabled={saving} className={`border-0 p-0 m-0 transition-opacity duration-150 ${saving ? 'opacity-50 pointer-events-none select-none' : ''}`}>
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              
              {/* ─── 左栏：高聚合配置区 (580px) ─── */}
              <div className="flex-1 min-w-0 w-full space-y-5">
                {/* 微信标准下划线标尺选项卡 (WeChat Underline Tabs) */}
                <div className="flex items-center gap-8 border-b border-white/[0.08] h-11 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab('overview')}
                    className={`relative h-full inline-flex items-center gap-2 text-sm transition-colors ${
                      activeTab === 'overview'
                        ? 'font-semibold text-brand'
                        : 'font-medium text-ink-muted hover:text-ink'
                    }`}
                  >
                    <span>呈现与运营</span>
                    {activeTab === 'overview' && (
                      <span className="absolute bottom-0 inset-x-0 h-[2px] bg-brand rounded-full" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('pricing')}
                    className={`relative h-full inline-flex items-center gap-2 text-sm transition-colors ${
                      activeTab === 'pricing'
                        ? 'font-semibold text-brand'
                        : 'font-medium text-ink-muted hover:text-ink'
                    }`}
                  >
                    <span>商业与路由</span>
                    {activeTab === 'pricing' && (
                      <span className="absolute bottom-0 inset-x-0 h-[2px] bg-brand rounded-full" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('capabilities')}
                    className={`relative h-full inline-flex items-center gap-2 text-sm transition-colors ${
                      activeTab === 'capabilities'
                        ? 'font-semibold text-brand'
                        : 'font-medium text-ink-muted hover:text-ink'
                    }`}
                  >
                    <span>工作台规格</span>
                    {activeTab === 'capabilities' && (
                      <span className="absolute bottom-0 inset-x-0 h-[2px] bg-brand rounded-full" />
                    )}
                  </button>
                </div>

                {/* Tab 1: 前台呈现与运营 (C 端呈现) */}
                {activeTab === 'overview' && (
                  <div className="space-y-5 animate-fade-in">
                    {/* Model ID (If New) */}
                    {isNew && (
                      <div className="rounded-xl border border-white/10 bg-surface-raised p-4 space-y-1.5">
                        <label className="text-caption text-ink-muted block font-medium">
                          模型唯一标识符 (Model ID / Slug) <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.model_id || ''}
                          onChange={(e) => setFormData((f) => ({ ...f, model_id: e.target.value.toLowerCase().replace(/[^a-z0-9-_.]/g, '') }))}
                          placeholder="例如: seedream-5.0 或 kling-v2.0"
                          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-body-sm text-ink outline-none focus:border-brand font-mono font-bold"
                        />
                        <span className="text-[11px] text-ink-subtle">全站路由与数据库调用的唯一键名，保存后不可随意更改。</span>
                      </div>
                    )}

                    {/* Section: 基础标识与分类归属 */}
                    <div className="rounded-xl border border-white/10 bg-surface-raised p-4 space-y-4">
                      <h4 className="text-body-sm font-semibold text-ink flex items-center gap-2">
                        <Layers className="size-4 text-brand" />
                        基础标识与分类归属
                      </h4>

                      {/* Display Name */}
                      <div>
                        <label className="text-caption text-ink-muted block mb-1">
                          前台展示名称 (Display Name)
                        </label>
                        <input
                          type="text"
                          value={formData.display_name || ''}
                          onChange={(e) => setFormData((f) => ({ ...f, display_name: e.target.value }))}
                          placeholder="例如: 字节跳动 Seedream 5.0 (商业摄影质感)"
                          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-body-sm text-ink outline-none focus:border-brand font-semibold"
                        />
                      </div>

                      {/* Category Pills */}
                      <div>
                        <label className="text-caption text-ink-muted block mb-1.5">
                          模型分类归属 (Category)
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(CATEGORY_MAP).map(([catKey, catLabel]) => {
                            const isSelected = formData.category === catKey;
                            return (
                              <button
                                key={catKey}
                                type="button"
                                onClick={() => handleCategoryChange(catKey)}
                                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all border ${
                                  isSelected
                                    ? 'bg-brand text-white border-brand shadow-elevation-1 font-bold'
                                    : 'bg-black/40 border-white/10 text-ink-muted hover:text-ink hover:bg-white/[0.04]'
                                }`}
                              >
                                {catLabel}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Sub-Type Pills */}
                      {SUBTYPE_OPTIONS[formData.category]?.length > 0 && (
                        <div>
                          <label className="text-caption text-ink-muted block mb-1.5">
                            工作台子场景 (Sub-Type)
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {SUBTYPE_OPTIONS[formData.category].map((st) => {
                              const isCur = formData.sub_type === st.id;
                              return (
                                <button
                                  key={st.id}
                                  type="button"
                                  onClick={() => setFormData((f) => ({ ...f, sub_type: st.id }))}
                                  className={`rounded-full px-3 py-1 text-xs font-mono transition-all border ${
                                    isCur
                                      ? 'bg-brand/15 text-brand border-brand/40 font-bold shadow-elevation-1'
                                      : 'bg-black/40 border-white/10 text-ink-muted hover:text-ink'
                                  }`}
                                >
                                  {st.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Tier & Sort Grid */}
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/[0.06]">
                        <div>
                          <label className="text-caption text-ink-muted block mb-1">模型分级 (Tier)</label>
                          <select
                            value={formData.tier || 'core'}
                            onChange={(e) => setFormData((f) => ({ ...f, tier: e.target.value }))}
                            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-body-sm text-ink outline-none focus:border-brand"
                          >
                            <option value="core">Core (核心主力推荐)</option>
                            <option value="backup">Backup (备用储备池)</option>
                            <option value="experimental">Experimental (实验探索)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-caption text-ink-muted block mb-1">排序权重 (越小越靠前)</label>
                          <input
                            type="number"
                            min="1"
                            max="999"
                            value={formData.sort ?? 1}
                            onChange={(e) => setFormData((f) => ({ ...f, sort: e.target.value === '' ? '' : Number(e.target.value) }))}
                            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-body-sm text-ink outline-none focus:border-brand font-mono font-bold"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section: 运营策略与上下架控制 (微信四列设置行模式) */}
                    <div className="rounded-xl border border-white/10 bg-surface-raised p-4 space-y-3">
                      <h4 className="text-body-sm font-semibold text-ink flex items-center gap-2 border-b border-white/[0.06] pb-2.5">
                        <Sliders className="size-4 text-brand" />
                        运营策略与上下架控制
                      </h4>

                      {/* Row 1: is_visible */}
                      <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04]">
                        <div className="min-w-0 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-ink">前台模型库展示</span>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.2 text-[10px] font-mono font-medium ${
                              formData.is_visible ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-ink-subtle'
                            }`}>
                              {formData.is_visible ? '展示中' : '已隐藏'}
                            </span>
                          </div>
                          <p className="text-caption text-ink-subtle mt-0.5">
                            开启后将在 Studio 创作工作台及前台模型库中开放给 C 端用户调用。
                          </p>
                        </div>
                        <PrecisionSwitch
                          checked={Boolean(formData.is_visible)}
                          onChange={(val) => setFormData((f) => ({ ...f, is_visible: val }))}
                          aria-label="前台模型库展示"
                        />
                      </div>

                      {/* Row 2: is_pinned */}
                      <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04]">
                        <div className="min-w-0 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-ink flex items-center gap-1.5">
                              <Pin className="size-3.5 text-amber-400" /> 前台列表置顶
                            </span>
                            {formData.is_pinned && (
                              <span className="inline-flex items-center rounded-full px-2 py-0.2 text-[10px] font-medium bg-amber-500/15 text-amber-300">
                                已置顶首位
                              </span>
                            )}
                          </div>
                          <p className="text-caption text-ink-subtle mt-0.5">
                            在前台所有分类列表中优先置顶于第一行显示。
                          </p>
                        </div>
                        <PrecisionSwitch
                          checked={Boolean(formData.is_pinned)}
                          onChange={(val) => setFormData((f) => ({ ...f, is_pinned: val }))}
                          aria-label="前台列表置顶"
                        />
                      </div>

                      {/* Row 3: is_featured */}
                      <div className="flex items-center justify-between py-2.5">
                        <div className="min-w-0 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-ink flex items-center gap-1.5">
                              <Star className="size-3.5 text-yellow-400" /> 标记官方推荐
                            </span>
                            {formData.is_featured && (
                              <span className="inline-flex items-center rounded-full px-2 py-0.2 text-[10px] font-medium bg-yellow-500/15 text-yellow-300">
                                推荐中
                              </span>
                            )}
                          </div>
                          <p className="text-caption text-ink-subtle mt-0.5">
                            在前台模型卡片上附加金色推荐标识，并加入精选推荐池。
                          </p>
                        </div>
                        <PrecisionSwitch
                          checked={Boolean(formData.is_featured)}
                          onChange={(val) => setFormData((f) => ({ ...f, is_featured: val }))}
                          aria-label="标记官方推荐"
                        />
                      </div>
                    </div>

                    {/* Section: 运营角标与前台文案 */}
                    <div className="rounded-xl border border-white/10 bg-surface-raised p-4 space-y-3.5">
                      <h4 className="text-body-sm font-semibold text-ink flex items-center gap-2">
                        <Sparkles className="size-4 text-brand" />
                        运营角标与前台描述
                      </h4>

                      {/* Badge Selection */}
                      <div>
                        <label className="text-caption text-ink-muted block mb-1.5">预设运营角标 (点击切换或反选)</label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {PRESET_BADGES.map((b) => {
                            const isCur = formData.badge === b;
                            return (
                              <button
                                key={b}
                                type="button"
                                onClick={() => setFormData((f) => ({ ...f, badge: isCur ? '' : b }))}
                                className={`rounded-full px-2.5 py-1 text-caption transition-all font-medium ${
                                  isCur
                                    ? 'bg-brand text-white shadow-elevation-1 font-bold'
                                    : 'bg-black/40 border border-white/10 text-ink-muted hover:text-ink'
                                }`}
                              >
                                {b}
                              </button>
                            );
                          })}
                        </div>
                        <input
                          type="text"
                          value={formData.badge || ''}
                          onChange={(e) => setFormData((f) => ({ ...f, badge: e.target.value }))}
                          placeholder="或直接输入自定义角标文本..."
                          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-caption text-ink outline-none focus:border-brand"
                        />
                      </div>

                      {/* Description */}
                      <div>
                        <label className="text-caption text-ink-muted block mb-1">前台能力描述 (Description)</label>
                        <textarea
                          rows={2}
                          value={formData.description || ''}
                          onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                          placeholder="给 C 端用户展示的模型核心卖点或特性描述..."
                          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-body-sm text-ink outline-none focus:border-brand leading-relaxed"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 2: 商业定价与通道调度 (商业与路由) */}
                {activeTab === 'pricing' && (
                  <div className="space-y-5 animate-fade-in">
                    {/* Section: 采购成本与定价毛利测算器 */}
                    <div className="rounded-xl border border-white/10 bg-surface-raised p-4 space-y-4">
                      <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                        <h4 className="text-body-sm font-semibold text-ink flex items-center gap-2">
                          <DollarSign className="size-4 text-brand" />
                          采购成本与定价毛利测算器
                        </h4>
                        <span className="text-caption text-ink-subtle font-mono">
                          基准汇率: 1 积分 = ¥0.10
                        </span>
                      </div>

                      {/* KPI 3-Box Strip */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Cost Box */}
                        <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-1">
                          <span className="text-micro text-ink-subtle uppercase">官方采购底价 (成本)</span>
                          <div className="font-mono font-bold text-body-lg text-white">
                            {formData.min_cost_cny !== null && formData.min_cost_cny !== undefined
                              ? `¥${Number(formData.min_cost_cny).toFixed(3)}`
                              : '—'}
                          </div>
                          <span className="text-[10px] text-ink-muted font-mono block">
                            {formData.min_cost_usd !== null && formData.min_cost_usd !== undefined
                              ? `($${Number(formData.min_cost_usd).toFixed(4)})`
                              : '暂无通道底价'}
                          </span>
                        </div>

                        {/* Price Input */}
                        <div className="rounded-xl border border-brand/30 bg-brand/[0.03] p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-micro text-brand uppercase font-bold">单次积分售价</span>
                            <span className="text-[10px] text-ink-subtle font-mono">C 端单价</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <input
                              type="number"
                              min="1"
                              max="10000"
                              step="1"
                              value={formData.credits ?? ''}
                              onChange={(e) => setFormData((f) => ({ ...f, credits: e.target.value === '' ? '' : Number(e.target.value) }))}
                              className="w-full rounded-lg border border-brand/40 bg-black/50 px-2.5 py-1 text-body font-bold font-mono text-brand outline-none focus:border-brand"
                            />
                            <span className="text-caption font-bold text-brand shrink-0">积分</span>
                          </div>
                          <span className="text-[10px] text-ink-muted font-mono block">
                            折合: ¥{marginMetrics.userPriceCny} / 次
                          </span>
                        </div>

                        {/* Real-time Margin */}
                        <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-1">
                          <span className="text-micro text-ink-subtle uppercase">实时预估毛利率</span>
                          <div className="font-mono font-bold text-body-lg flex items-center gap-1">
                            {marginMetrics.hasData ? (
                              <span className={
                                marginMetrics.status === 'loss' ? 'text-rose-400 font-black'
                                  : marginMetrics.status === 'low' ? 'text-amber-400'
                                  : 'text-emerald-400'
                              }>
                                {marginMetrics.rate}%
                              </span>
                            ) : (
                              <span className="text-ink-subtle">—</span>
                            )}
                          </div>
                          <span className="text-[10px] text-ink-muted font-mono block">
                            {marginMetrics.hasData
                              ? `每单利润: ${Number(marginMetrics.marginCny) >= 0 ? '+' : ''}¥${marginMetrics.marginCny}`
                              : '待关联通道成本后计算'}
                          </span>
                        </div>
                      </div>

                      {/* Negative Margin Alert */}
                      {marginMetrics.hasData && marginMetrics.status === 'loss' && (
                        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-start gap-2 animate-pulse">
                          <AlertTriangle className="size-4 text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">⚠️ 赤红负毛利阻断警告：</span>
                            <span>当前单次积分定价 ({formData.credits} 积分 ≈ ¥${marginMetrics.userPriceCny}) 低于采购底价 (¥${marginMetrics.costCny})，每笔生成将亏损 ¥${Math.abs(Number(marginMetrics.marginCny)).toFixed(2)}。</span>
                          </div>
                        </div>
                      )}

                      {/* Pricing Hint Input */}
                      <div>
                        <label className="text-caption text-ink-muted block mb-1">
                          前台扣费文案说明 (Pricing Hint)
                        </label>
                        <input
                          type="text"
                          value={formData.pricing_hint || ''}
                          onChange={(e) => setFormData((f) => ({ ...f, pricing_hint: e.target.value }))}
                          placeholder="例如: 基础 10 算力 (5秒视频) 或 旗舰出图 20 积分"
                          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-body-sm text-ink outline-none focus:border-brand font-mono"
                        />
                        <span className="text-[11px] text-ink-subtle mt-1 block">
                          展示在 Studio 模型选择器副标题。若留空，前台将默认显示为“{formData.credits || 10} 积分 / 次”。
                        </span>
                      </div>
                    </div>

                    {/* Section: 卡片式通道调度矩阵 (Route Channel Cards) */}
                    <div className="rounded-xl border border-white/10 bg-surface-raised p-4 space-y-3.5">
                      <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                        <h4 className="text-body-sm font-semibold text-ink flex items-center gap-2">
                          <Zap className="size-4 text-brand" />
                          就地供应通道与主备快速调度 (Fast Route Switcher)
                        </h4>
                        {activeHealthyCount > 0 ? (
                          <span className="rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono font-bold flex items-center gap-1">
                            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            {activeHealthyCount}/{channelRoutes.length} 通道就绪
                          </span>
                        ) : (
                          <span className="rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold flex items-center gap-1">
                            <AlertTriangle className="size-3" />
                            0 渠道阻断
                          </span>
                        )}
                      </div>

                      {/* Channel Cards List */}
                      {channelRoutes.length > 0 ? (
                        <div className="space-y-2.5">
                          {channelRoutes.map((route) => {
                            const isPrimary = formData.primary_route_id ? formData.primary_route_id === route.id : formData.primary_provider === route.provider_id;
                            const isBackup = formData.backup_route_id ? formData.backup_route_id === route.id : (Boolean(formData.backup_provider_id) && formData.backup_provider_id === route.provider_id);
                            const isHealthy = route.health_status === 'healthy';

                            return (
                              <div
                                key={route.id}
                                className={`rounded-xl border p-3.5 transition-all ${
                                  isPrimary
                                    ? 'border-brand/40 bg-brand/[0.03] shadow-elevation-1'
                                    : isBackup
                                    ? 'border-amber-500/30 bg-amber-500/[0.02]'
                                    : 'border-white/10 bg-black/30 hover:border-white/20'
                                }`}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  {/* Left: Provider info */}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-semibold text-white text-sm truncate">
                                        {route.provider_name || route.provider_id}
                                      </span>
                                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.2 text-[10px] font-mono ${
                                        route.review_status === 'approved' && isHealthy
                                          ? 'bg-emerald-500/15 text-emerald-300'
                                          : 'bg-amber-500/15 text-amber-300'
                                      }`}>
                                        <span className={`size-1.5 rounded-full ${isHealthy ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                        {route.review_status === 'approved' ? '已核准' : '待审核'}
                                      </span>
                                      {isPrimary && (
                                        <span className="rounded-full bg-brand text-white px-2 py-0.2 text-[10px] font-bold shadow-elevation-1">
                                          主通道
                                        </span>
                                      )}
                                      {isBackup && (
                                        <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.2 text-[10px] font-bold">
                                          备用通道
                                        </span>
                                      )}
                                    </div>
                                    <div className="font-mono text-caption text-ink-subtle mt-0.5 truncate">
                                      {route.provider_model_id}
                                    </div>
                                  </div>

                                  {/* Right: Metrics & Actions */}
                                  <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap self-end sm:self-center justify-end">
                                    <div className="text-right font-mono shrink-0">
                                      <div className="text-caption text-ink-muted">单价底价</div>
                                      <div className="text-sm font-bold text-ink">
                                        {Number(route.cost_cny) > 0 ? `¥${Number(route.cost_cny).toFixed(3)}` : '—'}
                                      </div>
                                    </div>

                                    {/* Priority Weight Input */}
                                    <div className="flex items-center gap-1 text-caption text-ink-subtle shrink-0">
                                      <span>权重</span>
                                      <input
                                        type="number"
                                        min="0"
                                        max="1000"
                                        value={route.priority ?? 50}
                                        onChange={(e) => handleRoutePriorityChange(route.id, e.target.value)}
                                        className="w-14 rounded-lg bg-black/60 border border-white/10 px-1 py-1 text-center font-mono text-xs text-ink outline-none focus:border-brand font-bold"
                                      />
                                    </div>

                                    {/* Primary Switch Button */}
                                    <button
                                      type="button"
                                      onClick={() => handleSetPrimaryRoute(route)}
                                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all border shrink-0 ${
                                        isPrimary
                                          ? 'bg-brand/20 text-brand border-brand font-bold'
                                          : 'bg-white/[0.04] text-ink-muted border-white/10 hover:text-ink hover:bg-white/[0.08]'
                                      }`}
                                    >
                                      {isPrimary ? '当前主' : '设为主'}
                                    </button>

                                    {/* Backup Switch Button */}
                                    <button
                                      type="button"
                                      onClick={() => handleSetBackupRoute(route)}
                                      disabled={isPrimary}
                                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all border shrink-0 ${
                                        isBackup
                                          ? 'bg-amber-500/20 text-amber-300 border-amber-500 font-bold'
                                          : 'bg-white/[0.04] text-ink-muted border-white/10 hover:text-ink hover:bg-white/[0.08] disabled:opacity-20'
                                      }`}
                                    >
                                      {isBackup ? '当前备' : '设为备'}
                                    </button>

                                    {/* Enable Switch */}
                                    <PrecisionSwitch
                                      size="sm"
                                      checked={Boolean(route.enabled)}
                                      onChange={() => handleRouteEnabledToggle(route.id)}
                                      aria-label={`启用通道 ${route.provider_name}`}
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-white/10 bg-black/30 p-5 text-center space-y-2">
                          <p className="text-caption text-ink-muted">当前模型暂无绑定的上游通道</p>
                          {onSmartMatch && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => onSmartMatch(model || formData)}
                              className="h-8 text-xs font-semibold text-brand hover:text-white"
                            >
                              <Sparkles className="size-3.5 mr-1 text-brand" />
                              匹配候选上游渠道
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Smart Match recommendations */}
                      {inlineCandidates.length > 0 && (
                        <div className="rounded-xl border border-brand/30 bg-brand/[0.04] p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-brand flex items-center gap-1">
                              <Sparkles className="size-3.5" /> 智能备选渠道推荐
                            </span>
                            {onSmartMatch && (
                              <button
                                type="button"
                                onClick={() => onSmartMatch(model || formData)}
                                className="text-micro text-brand hover:underline font-medium"
                              >
                                去智能匹配中心 →
                              </button>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            {inlineCandidates.slice(0, 2).map((cand, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between rounded-lg bg-black/40 border border-white/5 p-2 text-xs"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-white truncate">{cand.providerName || cand.providerId}</div>
                                  <div className="font-mono text-[10px] text-gray-400 truncate">{cand.providerModelId}</div>
                                </div>
                                <span className="rounded bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 text-[10px] font-bold shrink-0 ml-2">
                                  匹配度 {Math.round(cand.confidence * 100)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tab 3: 工作台规格与能力矩阵 (规格与参数) */}
                {activeTab === 'capabilities' && (
                  <div className="space-y-5 animate-fade-in">
                    {/* Supported Ratios */}
                    <div className="rounded-xl border border-white/10 bg-surface-raised p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                        <label className="text-body-sm font-semibold text-ink flex items-center gap-2">
                          <Layers className="size-4 text-brand" />
                          支持画幅比例 (Ratios)
                        </label>
                        <div className="flex items-center gap-2 text-caption">
                          <button
                            type="button"
                            onClick={() => setFormData((f) => ({ ...f, supported_ratios: ['1:1', '16:9', '9:16'] }))}
                            className="text-brand hover:underline text-xs font-medium"
                          >
                            常用预设
                          </button>
                          <span className="text-white/20">|</span>
                          <button
                            type="button"
                            onClick={() => setFormData((f) => ({ ...f, supported_ratios: [...PRESET_RATIOS] }))}
                            className="text-ink-subtle hover:text-ink text-xs font-medium"
                          >
                            全选
                          </button>
                          <span className="text-white/20">|</span>
                          <button
                            type="button"
                            onClick={() => setFormData((f) => ({ ...f, supported_ratios: [] }))}
                            className="text-ink-subtle hover:text-ink text-xs font-medium"
                          >
                            清空
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {PRESET_RATIOS.map((ratio) => {
                          const isSelected = (formData.supported_ratios || []).includes(ratio);
                          return (
                            <button
                              key={ratio}
                              type="button"
                              onClick={() => {
                                const cur = formData.supported_ratios || [];
                                const next = isSelected ? cur.filter((r) => r !== ratio) : [...cur, ratio];
                                setFormData((f) => ({ ...f, supported_ratios: next }));
                              }}
                              className={`rounded-full px-3 py-1 text-xs font-mono transition-all ${
                                isSelected
                                  ? 'bg-brand text-white font-bold shadow-elevation-1'
                                  : 'bg-black/40 border border-white/10 text-ink-muted hover:text-ink'
                              }`}
                            >
                              {ratio}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Supported Resolutions */}
                    <div className="rounded-xl border border-white/10 bg-surface-raised p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                        <label className="text-body-sm font-semibold text-ink flex items-center gap-2">
                          <Sliders className="size-4 text-brand" />
                          支持分辨率规格 (Resolutions)
                        </label>
                        <div className="flex items-center gap-2 text-caption">
                          <button
                            type="button"
                            onClick={() => setFormData((f) => ({ ...f, supported_resolutions: [...PRESET_RESOLUTIONS] }))}
                            className="text-ink-subtle hover:text-ink text-xs font-medium"
                          >
                            全选
                          </button>
                          <span className="text-white/20">|</span>
                          <button
                            type="button"
                            onClick={() => setFormData((f) => ({ ...f, supported_resolutions: [] }))}
                            className="text-ink-subtle hover:text-ink text-xs font-medium"
                          >
                            清空
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {PRESET_RESOLUTIONS.map((res) => {
                          const isSelected = (formData.supported_resolutions || []).includes(res);
                          return (
                            <button
                              key={res}
                              type="button"
                              onClick={() => {
                                const cur = formData.supported_resolutions || [];
                                const next = isSelected ? cur.filter((r) => r !== res) : [...cur, res];
                                setFormData((f) => ({ ...f, supported_resolutions: next }));
                              }}
                              className={`rounded-full px-2.5 py-1 text-[11px] font-mono transition-all ${
                                isSelected
                                  ? 'bg-brand/15 text-brand border border-brand/30 font-bold shadow-elevation-1'
                                  : 'bg-black/40 border border-white/10 text-ink-muted hover:text-ink'
                              }`}
                            >
                              {res}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Supported Durations (video or audio) */}
                    {(formData.category === 'video' || formData.category === 'audio') && (
                      <div className="rounded-xl border border-white/10 bg-surface-raised p-4 space-y-3">
                        <label className="text-body-sm font-semibold text-ink block border-b border-white/[0.06] pb-2">
                          可选生成时长 (秒)
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {PRESET_DURATIONS.map((dur) => {
                            const isSelected = (formData.supported_durations || []).includes(dur);
                            return (
                              <button
                                key={dur}
                                type="button"
                                onClick={() => {
                                  const cur = formData.supported_durations || [];
                                  const next = isSelected ? cur.filter((d) => d !== dur) : [...cur, dur];
                                  setFormData((f) => ({ ...f, supported_durations: next }));
                                }}
                                className={`rounded-full px-3 py-1 text-xs font-mono transition-all ${
                                  isSelected
                                    ? 'bg-brand text-white font-bold shadow-elevation-1'
                                    : 'bg-black/40 border border-white/10 text-ink-muted hover:text-ink'
                                }`}
                              >
                                {dur}s
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Capabilities Switches */}
                    <div className="rounded-xl border border-white/10 bg-surface-raised p-4 space-y-3">
                      <h4 className="text-body-sm font-semibold text-ink border-b border-white/[0.06] pb-2">
                        生成能力特性开关
                      </h4>

                      {/* Hires Fix */}
                      <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                        <div>
                          <div className="text-sm font-semibold text-ink">高清修复 (Hires Fix)</div>
                          <div className="text-caption text-ink-subtle">允许前台启用超清细节放大算法与重采样</div>
                        </div>
                        <PrecisionSwitch
                          checked={Boolean(formData.capabilities?.hires_fix)}
                          onChange={(val) => setFormData((f) => ({
                            ...f,
                            capabilities: { ...(f.capabilities || {}), hires_fix: val }
                          }))}
                          aria-label="高清修复"
                        />
                      </div>

                      {/* Seed Control */}
                      <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                        <div>
                          <div className="text-sm font-semibold text-ink">支持指定种子 (Seed Control)</div>
                          <div className="text-caption text-ink-subtle">在前台高级参数栏中展示 Seed 输入框以便结果复现</div>
                        </div>
                        <PrecisionSwitch
                          checked={Boolean(formData.capabilities?.seed_control !== false)}
                          onChange={(val) => setFormData((f) => ({
                            ...f,
                            capabilities: { ...(f.capabilities || {}), seed_control: val }
                          }))}
                          aria-label="支持指定种子"
                        />
                      </div>

                      {/* Camera Control */}
                      <div className="flex items-center justify-between py-2">
                        <div>
                          <div className="text-sm font-semibold text-ink">运镜与控制 (Camera Control)</div>
                          <div className="text-caption text-ink-subtle">展示平移、推拉、环绕等摄影机运动控制面板（视频模型）</div>
                        </div>
                        <PrecisionSwitch
                          checked={Boolean(formData.capabilities?.camera_control)}
                          onChange={(val) => setFormData((f) => ({
                            ...f,
                            capabilities: { ...(f.capabilities || {}), camera_control: val }
                          }))}
                          aria-label="运镜与控制"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ─── 右栏：常驻实时看板 (340px-360px Sticky Inspector) ─── */}
              <div className="w-full lg:w-[340px] xl:w-[360px] shrink-0 lg:sticky lg:top-0 space-y-4">
                
                {/* 前台模型下拉项实时预览 */}
                <div className="space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-elevation-2">
                  <div className="flex items-center justify-between border-b border-line-subtle pb-2">
                    <span className="text-micro font-semibold text-ink-subtle uppercase tracking-wider flex items-center gap-1.5">
                      <Eye className="size-3 text-brand" />
                      前台模型项实时预览
                    </span>
                    <span className="shrink-0 rounded-full border border-line bg-wash px-2 py-0.5 text-micro text-ink-muted">
                      实时联动
                    </span>
                  </div>

                  <div className="rounded-lg bg-wash-strong">
                    <ModelDisplayRow
                      name={previewName}
                      modelId={previewModelId}
                      provider={previewProvider}
                      badge={previewBadge}
                      description={previewDesc}
                      selected
                    />
                  </div>
                </div>

                {/* 商业测算微雷达 (Margin KPI Mini-Radar) */}
                <div className="rounded-2xl border border-white/10 bg-surface-raised p-4 space-y-2.5 shadow-elevation-1">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
                    <span className="text-micro font-semibold text-ink-subtle uppercase flex items-center gap-1">
                      <DollarSign className="size-3 text-brand" /> 商业毛利微雷达
                    </span>
                    <span className={`rounded-full px-2 py-0.2 text-[10px] font-mono font-bold shrink-0 ${
                      marginMetrics.status === 'loss' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : marginMetrics.status === 'low' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}>
                      {marginMetrics.hasData ? `${marginMetrics.rate}% 毛利` : '待测算'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex items-center justify-between gap-2 text-ink-muted">
                      <span className="shrink-0">单次售价</span>
                      <span className="text-ink font-semibold truncate text-right">
                        {formData.credits || 0} 积分 {marginMetrics.hasData ? `(¥${marginMetrics.userPriceCny})` : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-ink-muted">
                      <span className="shrink-0">采购成本</span>
                      <span className="text-ink font-semibold truncate text-right">¥{marginMetrics.costCny}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-ink-muted pt-1 border-t border-white/[0.04]">
                      <span className="shrink-0">预估每单利润</span>
                      <span className={`font-bold truncate text-right ${
                        Number(marginMetrics.marginCny) < 0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}>
                        {marginMetrics.hasData ? `${Number(marginMetrics.marginCny) >= 0 ? '+' : ''}¥${marginMetrics.marginCny}` : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 路由快速就绪看板 (Route Health Radar) */}
                <div className="rounded-2xl border border-white/10 bg-surface-raised p-4 space-y-2.5 shadow-elevation-1">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
                    <span className="text-micro font-semibold text-ink-subtle uppercase flex items-center gap-1">
                      <Server className="size-3 text-brand" /> 路由快速就绪度
                    </span>
                    <span className="text-caption font-mono text-ink-subtle shrink-0">
                      {channelRoutes.length} 条通道
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-ink-muted shrink-0">主通道状态</span>
                      <span className="font-semibold text-white font-mono truncate text-right max-w-[180px]" title={formData.primary_provider || (channelRoutes[0]?.provider_name) || '未设定'}>
                        {formData.primary_provider || (channelRoutes[0]?.provider_name) || '未设定'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-ink-muted shrink-0">备用通道</span>
                      <span className="text-ink-subtle font-mono truncate text-right max-w-[180px]" title={formData.backup_provider_id || '未设备用'}>
                        {formData.backup_provider_id || '未设备用'}
                      </span>
                    </div>
                  </div>

                  {/* Warning if 0 channels and is_visible */}
                  {hasZeroRoutes && formData.is_visible && (
                    <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-[11px] text-rose-300 flex items-start gap-1.5">
                      <AlertTriangle className="size-3 text-rose-400 shrink-0 mt-0.5" />
                      <span>无可用健康通道。前台展示将面临调用阻断！</span>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </fieldset>
        </div>

        {/* Sticky Footer */}
        <div className="px-6 py-4 border-t border-white/[0.08] bg-[#191c21] flex items-center justify-between shrink-0">
          <div className="text-caption text-ink-muted font-mono">
            ID: <span className="text-white font-bold">{formData.model_id || '未设定'}</span>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={saving} className="text-ink-muted hover:text-ink">
              取消
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={saving || !canWrite || (!formData.model_id && isNew)}
              className="bg-brand hover:bg-brand-hover text-white rounded-lg px-4 font-semibold"
            >
              {saving ? (
                <>
                  <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                  正在保存...
                </>
              ) : (
                <>
                  <Save className="size-3.5 mr-1.5" />
                  保存一站式配置
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

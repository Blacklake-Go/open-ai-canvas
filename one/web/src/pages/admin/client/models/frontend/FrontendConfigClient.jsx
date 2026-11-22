'use client';

import { CREDIT_PRICING_POLICY } from '@/lib/pricing/creditPolicy';
import { useState, useMemo, useCallback, useEffect, Fragment } from 'react';
import Link from 'next/link';
import {
  Eye, EyeOff, Search, ChevronDown, ChevronUp,
  X, Save, Loader2, Layers, Pin, Sparkles, Filter,
  Check, ShieldCheck, Zap, DollarSign, Plus, Copy,
  CheckCircle2, ArrowRight, ExternalLink, RefreshCw, AlertTriangle,
  GitMerge, Server,
  Image as ImageIcon, Video, Music, MessageSquare
} from 'lucide-react';
import { Card, Button } from '@/components/admin/AdminUi';
import ModelRepositoryDrawer from './ModelRepositoryDrawer';
import ModelConfigDrawer from './ModelConfigDrawer';
import ModelHygieneDrawer from './ModelHygieneDrawer';
import UnroutedConfirmModal from './UnroutedConfirmModal';
import SmartMatchModal from './SmartMatchModal';
import BrandLogo from '@/components/admin/BrandLogo';
import ModelNavTabs from '@/components/admin/ModelNavTabs';
import { BRANDS, resolveBrand } from '@/lib/modelCenter/brandDictionary.js';

// ─── 任务场景定义 ───────────────────────────────────────────────
const TASK_SCENES = [
  { id: 'all', label: '全部场景', desc: '全库所有模型' },
  { id: 't2i', label: '文生图', desc: '文本描述生成高质量图像' },
  { id: 'i2i', label: '图生图', desc: '参考图片风格与结构变体生成' },
  { id: 't2v', label: '文生视频', desc: '提示词直接驱动动态视频' },
  { id: 'i2v', label: '图生视频', desc: '首帧/参考图生成高帧率视频' },
  { id: 'v2v', label: '视频编辑', desc: '视频换装、风格重绘与转绘' },
  { id: 'audio', label: '音乐 / 语音', desc: '全能 AI 编曲与拟真 TTS 语音' },
];

function getModelSceneLabel(model) {
  const cat = String(model.category || '').toLowerCase();
  const sub = String(model.sub_type || model.capabilities?.sub_type || '').toLowerCase();
  const name = String(model.display_name || model.name || '').toLowerCase();
  const id = String(model.id || '').toLowerCase();

  if (cat === 'audio') {
    if (sub === 'tts' || name.includes('语音') || name.includes('tts')) return '语音 (TTS)';
    return '音乐生成';
  }
  if (cat === 'image_edit' || sub === 'i2i' || id.includes('i2i') || name.includes('图生图')) {
    return '图生图';
  }
  if (cat === 'image') {
    return '文生图';
  }
  if (sub === 'v2v' || id.includes('v2v') || name.includes('编辑')) {
    return '视频编辑';
  }
  if (cat === 'video_image' || sub === 'i2v' || id.includes('i2v') || name.includes('图生视频')) {
    return '图生视频';
  }
  if (cat === 'video') {
    return '文生视频';
  }
  return '通用场景';
}

function getModelSceneBadge(model) {
  const label = getModelSceneLabel(model);
  const cat = String(model?.category || '').toLowerCase();
  const sub = String(model?.sub_type || model?.capabilities?.sub_type || '').toLowerCase();

  let Icon = ImageIcon;
  if (cat === 'audio' || sub === 'music' || sub === 'tts') Icon = Music;
  else if (cat.includes('video') || sub.includes('v') || sub === 'i2v' || sub === 't2v') Icon = Video;
  else if (cat === 'text') Icon = MessageSquare;
  else if (sub === 'i2i' || cat === 'image_edit') Icon = Sparkles;

  return { label, Icon };
}

function matchesScene(model, sceneId) {
  if (!sceneId || sceneId === 'all') return true;
  const cat = String(model.category || '').toLowerCase();
  const sub = String(model.sub_type || model.capabilities?.sub_type || '').toLowerCase();
  const name = String(model.display_name || model.name || '').toLowerCase();
  const id = String(model.id || '').toLowerCase();

  if (sceneId === 't2i') {
    return cat === 'image' && sub !== 'i2i';
  }
  if (sceneId === 'i2i') {
    return cat === 'image_edit' || sub === 'i2i' || id.includes('i2i') || name.includes('图生图') || (cat === 'image' && Boolean(model.capabilities?.supports_image_input));
  }
  if (sceneId === 't2v') {
    return cat === 'video' && sub !== 'i2v' && sub !== 'v2v';
  }
  if (sceneId === 'i2v') {
    return cat === 'video_image' || sub === 'i2v' || id.includes('i2v') || name.includes('图生视频') || (cat === 'video' && Boolean(model.capabilities?.supports_first_frame));
  }
  if (sceneId === 'v2v') {
    return sub === 'v2v' || id.includes('v2v') || name.includes('编辑');
  }
  if (sceneId === 'audio') {
    return cat === 'audio';
  }
  return true;
}

export default function FrontendConfigClient({
  initialModels = [],
  initialBrand = 'all',
  pendingPricesCount = 0,
  canWrite = false,
}) {
  const [models, setModels] = useState(initialModels);
  const [publicDirectory, setPublicDirectory] = useState(null);
  const [selectedBrand, setSelectedBrand] = useState(initialBrand || 'all'); // 'all' | brand.id
  const [activeScene, setActiveScene] = useState('all'); // 'all' | 't2i' | ...
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'visible' | 'hidden'
  const [channelBlockFilter, setChannelBlockFilter] = useState(false); // 0 渠道阻断
  const [negativeMarginFilter, setNegativeMarginFilter] = useState(false); // 负毛利预警
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(null);
  const [toast, setToast] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Deep Config Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerModel, setDrawerModel] = useState(null);
  const [isDrawerNew, setIsDrawerNew] = useState(false);

  // Quick Price Modal State
  const [quickPriceModal, setQuickPriceModal] = useState(null); // { model, credits }
  const [quickPriceInput, setQuickPriceInput] = useState('');
  const [savingQuickPrice, setSavingQuickPrice] = useState(false);

  // Operational Drawers & Safety Modals
  const [repoDrawerOpen, setRepoDrawerOpen] = useState(false);
  const [hygieneDrawerOpen, setHygieneDrawerOpen] = useState(false);
  const [unroutedConfirmModel, setUnroutedConfirmModel] = useState(null);
  const [smartMatchModel, setSmartMatchModel] = useState(null);

  // In-shelf Accordion Sub-row Expansion & Inline 1-Click Merge States
  const [expandedVariants, setExpandedVariants] = useState(new Set());
  const [mergeConfirmModel, setMergeConfirmModel] = useState(null);
  const [inlineTargetOverride, setInlineTargetOverride] = useState('');
  const [mergingInline, setMergingInline] = useState(false);

  useEffect(() => {
    if (!mergeConfirmModel) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !mergingInline) {
        setMergeConfirmModel(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mergeConfirmModel, mergingInline]);

  const toggleExpandVariants = useCallback((modelId) => {
    setExpandedVariants((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) {
        next.delete(modelId);
      } else {
        next.add(modelId);
      }
      return next;
    });
  }, []);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const refreshPublicDirectory = useCallback(async () => {
    try {
      const response = await fetch('/api/models/active?nocache=1', { cache: 'no-store' });
      if (!response.ok) throw new Error('公开目录暂不可读取');
      const body = await response.json();
      if (!Array.isArray(body.models)) throw new Error('公开目录格式无效');
      setPublicDirectory(new Map(body.models.map((model) => [String(model.id), model])));
    } catch {
      setPublicDirectory(null);
    }
  }, []);

  useEffect(() => {
    refreshPublicDirectory();
  }, [refreshPublicDirectory]);

  useEffect(() => {
    if (initialBrand) {
      setSelectedBrand(initialBrand);
    }
  }, [initialBrand]);

  // URL ?brand=[id] sync on mount and popstate
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const b = url.searchParams.get('brand');
      if (b && b !== selectedBrand) {
        setSelectedBrand(b);
      }
    }
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        const b = url.searchParams.get('brand') || 'all';
        setSelectedBrand(b);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedBrand]);

  // 通用 API 调用 (带安全幂等键)
  const callAPI = useCallback(async (body) => {
    const action = String(body?.action || 'action').replace(/[^a-zA-Z0-9_]/g, '_');
    const idempotencyKey = `ctrl_${action}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const res = await fetch('/api/admin/models/control', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || '操作失败');
    }
    return data;
  }, []);

  // 厂商统计 & 过滤项列表 (排序按模型数量递减)
  const brandStats = useMemo(() => {
    const counts = {};
    models.forEach((m) => {
      const b = resolveBrand(m);
      if (b && b.id) {
        counts[b.id] = (counts[b.id] || 0) + 1;
      }
    });
    return counts;
  }, [models]);

  const activeBrands = useMemo(() => {
    return BRANDS.filter((b) => (brandStats[b.id] || 0) > 0)
      .sort((a, b) => (brandStats[b.id] || 0) - (brandStats[a.id] || 0));
  }, [brandStats]);

  // 场景统计
  const sceneCounts = useMemo(() => {
    const counts = {};
    const brandScoped = selectedBrand === 'all'
      ? models
      : models.filter((m) => resolveBrand(m)?.id === selectedBrand);

    TASK_SCENES.forEach((scene) => {
      counts[scene.id] = brandScoped.filter((m) => matchesScene(m, scene.id)).length;
    });
    return counts;
  }, [models, selectedBrand]);

  // 切换品牌时，双向同步 URL 参数 ?brand=[id]
  const handleBrandSelect = useCallback((brandId) => {
    setSelectedBrand(brandId);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (brandId === 'all') {
        url.searchParams.delete('brand');
      } else {
        url.searchParams.set('brand', brandId);
      }
      window.history.replaceState(null, '', url.pathname + url.search);
    }
    if (brandId !== 'all' && activeScene !== 'all') {
      const brandModels = models.filter((m) => resolveBrand(m)?.id === brandId);
      const hasInScene = brandModels.some((m) => matchesScene(m, activeScene));
      if (!hasInScene) {
        setActiveScene('all');
      }
    }
  }, [models, activeScene]);

  // 计算单模型预估毛利率
  const computeModelMargin = useCallback((model, overrideCredits = null) => {
    const costCny = model.min_cost_cny !== null && model.min_cost_cny !== undefined ? Number(model.min_cost_cny) : null;
    const credits = overrideCredits !== null ? overrideCredits : Number(model.base_credits || 0);
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
        costCny: costCny.toFixed(3),
        userPriceCny: userPriceCny.toFixed(2),
        marginCny: marginCny.toFixed(2),
        rate,
        status,
      };
    }
    return {
      hasData: false,
      costCny: null,
      userPriceCny: userPriceCny.toFixed(2),
      marginCny: null,
      rate: null,
      status: 'unknown',
    };
  }, []);

  // 顶栏状态指标计算 (At-a-Glance Status Bar Metrics)
  const statusMetrics = useMemo(() => {
    let activeCount = 0;
    let standbyCount = 0;
    let unroutedCount = 0;
    let lossCount = 0;

    models.forEach((m) => {
      const isVis = Boolean(m.is_visible);
      const healthy = Number(m.healthy_routes || 0);
      if (isVis) activeCount++;
      else standbyCount++;

      if (!healthy || healthy <= 0) unroutedCount++;

      const margin = computeModelMargin(m);
      if (margin.hasData && margin.status === 'loss') {
        lossCount++;
      }
    });

    return {
      activeCount,
      standbyCount,
      unroutedCount,
      lossCount,
    };
  }, [models, computeModelMargin]);

  // 规范治理与变体指标 (Hygiene & Consolidation Metrics)
  const hygieneMetrics = useMemo(() => {
    let orphanCount = 0;
    let canonicalCount = 0;
    let aliasCount = 0;

    models.forEach((m) => {
      if (m.is_orphan_candidate) orphanCount++;
      if (m.is_canonical || (m.aliases && m.aliases.length > 0)) {
        canonicalCount++;
        aliasCount += (m.aliases?.length || 0);
      }
    });

    return {
      orphanCount,
      canonicalCount,
      aliasCount,
    };
  }, [models]);

  // 可供孤立变体归并的目标规范模型列表
  const canonicalOptions = useMemo(() => {
    const list = models.filter((m) => m.is_canonical || (m.aliases && m.aliases.length > 0));
    if (list.length > 0) return list;
    return models.filter((m) => m.tier === 'core' || m.is_visible);
  }, [models]);

  // 最终过滤后的模型列表
  const currentModels = useMemo(() => {
    let list = models;

    // 1. 厂商筛选
    if (selectedBrand !== 'all') {
      list = list.filter((m) => resolveBrand(m)?.id === selectedBrand);
    }

    // 2. 任务场景筛选
    if (activeScene !== 'all') {
      list = list.filter((m) => matchesScene(m, activeScene));
    }

    // 3. 展示状态筛选
    if (statusFilter === 'visible') {
      list = list.filter((m) => Boolean(m.is_visible));
    } else if (statusFilter === 'hidden') {
      list = list.filter((m) => !m.is_visible);
    }

    // 4. 0 渠道阻断筛选
    if (channelBlockFilter) {
      list = list.filter((m) => (!m.healthy_routes || Number(m.healthy_routes) <= 0));
    }

    // 5. 负毛利预警筛选
    if (negativeMarginFilter) {
      list = list.filter((m) => computeModelMargin(m).status === 'loss');
    }

    // 6. 关键词搜索
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (m) =>
          (m.display_name || m.name || '').toLowerCase().includes(q) ||
          (m.id || '').toLowerCase().includes(q) ||
          resolveBrand(m)?.shortName.toLowerCase().includes(q)
      );
    }

    // 排序: 置顶优先 -> 展示优先 -> sort -> created_at
    return list.sort((a, b) => {
      const aPinned = Boolean(a.is_pinned);
      const bPinned = Boolean(b.is_pinned);
      if (aPinned !== bPinned) return aPinned ? -1 : 1;

      const aVis = Boolean(a.is_visible);
      const bVis = Boolean(b.is_visible);
      if (aVis !== bVis) return aVis ? -1 : 1;

      if ((a.sort ?? 0) !== (b.sort ?? 0)) return (a.sort ?? 0) - (b.sort ?? 0);
      return String(a.created_at || '').localeCompare(String(b.created_at || ''));
    });
  }, [models, selectedBrand, activeScene, statusFilter, channelBlockFilter, negativeMarginFilter, search, computeModelMargin]);

  // 前台展示开关切换
  const toggleVisibility = useCallback(
    async (model) => {
      if (!canWrite) return;
      const newVisible = !model.is_visible;

      // 0 渠道模型上线安全拦截：无可用已审核正常通道时拦截开启，避免用户下单遇阻
      if (newVisible && (!model.healthy_routes || Number(model.healthy_routes) <= 0)) {
        setUnroutedConfirmModel(model);
        return;
      }

      const previous = [...models];
      setSaving(model.id);

      setModels((prev) =>
        prev.map((m) =>
          m.id === model.id
            ? {
                ...m,
                is_visible: newVisible,
                ...(newVisible ? { auto_route_eligible: true, status: 'active', tier: 'core' } : {}),
              }
            : m
        )
      );

      try {
        await callAPI({
          action: 'update_model_tiering',
          modelId: model.id,
          isVisible: newVisible,
          autoRouteEligible: newVisible ? true : undefined,
          isActive: newVisible ? true : undefined,
          tier: newVisible ? 'core' : undefined,
        });
        showToast(`${model.display_name || model.name} 已${newVisible ? '开启前台展示' : '关闭前台展示'}`);
        refreshPublicDirectory();
      } catch (err) {
        setModels(previous);
        showToast(err.message, 'error');
      } finally {
        setSaving(null);
      }
    },
    [canWrite, models, callAPI, showToast, refreshPublicDirectory]
  );

  // 置顶切换
  const togglePinned = useCallback(
    async (model) => {
      if (!canWrite) return;
      const newPinned = !model.is_pinned;
      const previous = [...models];
      setSaving(model.id);
      setModels((prev) => prev.map((m) => (m.id === model.id ? { ...m, is_pinned: newPinned } : m)));
      try {
        await callAPI({ action: 'update_model_tiering', modelId: model.id, isPinned: newPinned });
        showToast(`${model.display_name || model.name} ${newPinned ? '已置顶到首位 📌' : '已取消置顶'}`);
      } catch (err) {
        setModels(previous);
        showToast(err.message, 'error');
      } finally {
        setSaving(null);
      }
    },
    [canWrite, models, callAPI, showToast]
  );

  // 排序上移下移
  const moveModel = useCallback(
    async (model, direction) => {
      if (!canWrite) return;
      const currentList = currentModels;
      const idx = currentList.findIndex((m) => m.id === model.id);
      if (idx < 0) return;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= currentList.length) return;

      const targetModel = currentList[targetIdx];
      const oldSortA = model.sort ?? idx + 1;
      const oldSortB = targetModel.sort ?? targetIdx + 1;
      const newSortA = oldSortB;
      const newSortB = oldSortA === oldSortB ? (direction === 'up' ? oldSortA - 1 : oldSortA + 1) : oldSortA;

      const previous = [...models];
      setModels((prev) =>
        prev.map((m) => {
          if (m.id === model.id) return { ...m, sort: newSortA };
          if (m.id === targetModel.id) return { ...m, sort: newSortB };
          return m;
        })
      );

      try {
        await callAPI({
          action: 'bulk_update_sort',
          items: [
            { modelId: model.id, sort: newSortA },
            { modelId: targetModel.id, sort: newSortB },
          ],
        });
        showToast('排序调整已保存 ✓');
      } catch (err) {
        setModels(previous);
        showToast(`排序调整失败: ${err.message}`, 'error');
      }
    },
    [canWrite, currentModels, models, callAPI, showToast]
  );

  // 复制模型 ID
  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    showToast(`已复制模型 ID: ${id}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 打开右侧高级配置抽屉 (编辑模式)
  const startEdit = useCallback((model) => {
    setDrawerModel(model);
    setIsDrawerNew(false);
    setDrawerOpen(true);
  }, []);

  // 打开右侧高级配置抽屉 (新建/引入模式)
  const startCreate = useCallback(() => {
    setDrawerModel(null);
    setIsDrawerNew(true);
    setDrawerOpen(true);
  }, []);

  // 抽屉保存全要素配置
  const handleDrawerSave = useCallback(
    async (formData) => {
      if (!canWrite) return;
      const targetId = formData.model_id;
      if (!targetId) return;

      const isVisible = formData.is_visible !== undefined ? formData.is_visible : true;
      const creditsPrice = Number(formData.credits);

      setSaving(targetId);
      try {
        const isNewModel = isDrawerNew || !models.some((m) => m.id === targetId);
        if (isNewModel) {
          await callAPI({
            action: 'create_model',
            modelId: targetId,
            name: formData.display_name || targetId,
            displayName: formData.display_name || targetId,
            category: formData.category || 'image',
            description: formData.description || '',
            badge: formData.badge || '',
            subType: formData.sub_type || '',
            pricingHint: formData.pricing_hint || '',
            sort: Number(formData.sort) || 1,
            creditsPrice,
            isVisible,
            isPinned: formData.is_pinned,
            isFeatured: formData.is_featured,
            tier: formData.tier || (isVisible ? 'core' : 'backup'),
            supportedRatios: formData.supported_ratios,
            supportedResolutions: formData.supported_resolutions,
            supportedDurations: formData.supported_durations,
            capabilities: formData.capabilities,
          });
        }

        await callAPI({
          action: 'update_model_tiering',
          modelId: targetId,
          displayName: formData.display_name,
          description: formData.description,
          badge: formData.badge || '',
          subType: formData.sub_type || '',
          category: formData.category,
          pricingHint: formData.pricing_hint || '',
          sort: Number(formData.sort),
          tier: formData.tier || (isVisible ? 'core' : 'backup'),
          isFeatured: formData.is_featured,
          isPinned: formData.is_pinned,
          isVisible,
          autoRouteEligible: isVisible ? true : undefined,
          isActive: isVisible ? true : undefined,
          creditsPrice,
          provider: formData.primary_provider,
          backupProviderId: formData.backup_provider_id,
          backupModelId: formData.backup_model_id,
          channelRoutes: formData.channel_routes,
          supportedRatios: formData.supported_ratios,
          supportedResolutions: formData.supported_resolutions,
          supportedDurations: formData.supported_durations,
          capabilities: formData.capabilities,
        });

        setModels((prev) => {
          const idx = prev.findIndex((m) => m.id === targetId);
          const newRoutes = formData.channel_routes || [];
          const newApprovedCount = newRoutes.filter((r) => r.review_status === 'approved' || !r.review_status).length;
          const newHealthyCount = newRoutes.filter((r) => r.enabled && (r.review_status === 'approved' || !r.review_status) && (r.health_status === 'healthy' || !r.health_status)).length;
          const validRouteCosts = newRoutes
            .map((r) => Number(r.cost_cny))
            .filter((c) => Number.isFinite(c) && c > 0);
          const newMinCostCny = validRouteCosts.length > 0 ? Math.min(...validRouteCosts) : null;
          const userPriceCny = creditsPrice * CREDIT_PRICING_POLICY.cnyPerCredit;
          const newMarginRate = (newMinCostCny !== null && userPriceCny > 0)
            ? Number((((userPriceCny - newMinCostCny) / userPriceCny) * 100).toFixed(1))
            : null;

          if (idx >= 0) {
            const updated = [...prev];
            const prevItem = updated[idx];
            updated[idx] = {
              ...prevItem,
              display_name: formData.display_name,
              category: formData.category || prevItem.category,
              pricing_hint: formData.pricing_hint,
              description: formData.description,
              badge: formData.badge,
              sub_type: formData.sub_type,
              sort: Number(formData.sort) || prevItem.sort,
              tier: formData.tier || (isVisible ? 'core' : 'backup'),
              is_featured: formData.is_featured,
              is_pinned: formData.is_pinned,
              is_visible: isVisible,
              base_credits: creditsPrice,
              provider: formData.primary_provider || prevItem.provider,
              backup_provider_id: formData.backup_provider_id,
              backup_model_id: formData.backup_model_id,
              routes: newRoutes.length > 0 ? newRoutes : prevItem.routes,
              approved_routes: newRoutes.length > 0 ? newApprovedCount : prevItem.approved_routes,
              healthy_routes: newRoutes.length > 0 ? newHealthyCount : prevItem.healthy_routes,
              min_cost_cny: newMinCostCny !== null ? newMinCostCny : prevItem.min_cost_cny,
              gross_margin_rate: newMarginRate !== null ? newMarginRate : prevItem.gross_margin_rate,
              supported_ratios: formData.supported_ratios,
              supported_resolutions: formData.supported_resolutions,
              supported_durations: formData.supported_durations,
              capabilities: formData.capabilities,
            };
            return updated;
          } else {
            return [
              {
                id: targetId,
                name: formData.display_name || targetId,
                display_name: formData.display_name || targetId,
                category: formData.category || 'image',
                pricing_hint: formData.pricing_hint,
                description: formData.description,
                badge: formData.badge,
                sub_type: formData.sub_type,
                sort: Number(formData.sort) || 1,
                tier: formData.tier || (isVisible ? 'core' : 'backup'),
                is_featured: formData.is_featured,
                is_pinned: formData.is_pinned,
                is_visible: isVisible,
                base_credits: creditsPrice,
                provider: formData.primary_provider,
                backup_provider_id: formData.backup_provider_id,
                backup_model_id: formData.backup_model_id,
                routes: newRoutes,
                approved_routes: newApprovedCount,
                healthy_routes: newHealthyCount,
                min_cost_cny: newMinCostCny,
                gross_margin_rate: newMarginRate,
                supported_ratios: formData.supported_ratios,
                supported_resolutions: formData.supported_resolutions,
                supported_durations: formData.supported_durations,
                capabilities: formData.capabilities,
              },
              ...prev,
            ];
          }
        });

        showToast(`模型【${formData.display_name || targetId}】全生命周期配置已保存 ✓`);
        refreshPublicDirectory();
      } catch (err) {
        showToast(`保存失败: ${err.message}`, 'error');
        throw err;
      } finally {
        setSaving(null);
      }
    },
    [canWrite, models, isDrawerNew, callAPI, showToast, refreshPublicDirectory]
  );

  // 极速改价保存
  const handleSaveQuickPrice = useCallback(async () => {
    if (!quickPriceModal) return;
    const model = quickPriceModal.model;
    const credits = Number(quickPriceInput);
    if (!Number.isInteger(credits) || credits <= 0) {
      showToast('单次生成积分必须为大于0的正整数', 'error');
      return;
    }
    setSavingQuickPrice(true);
    try {
      await callAPI({
        action: 'update_model_tiering',
        modelId: model.id,
        creditsPrice: credits,
      });
      setModels((prev) => prev.map((m) => (m.id === model.id ? { ...m, base_credits: credits } : m)));
      showToast(`模型【${model.display_name || model.name}】积分定价已调整为 ${credits} 积分 ✓`);
      setQuickPriceModal(null);
      refreshPublicDirectory();
    } catch (err) {
      showToast(`调价失败: ${err.message}`, 'error');
    } finally {
      setSavingQuickPrice(false);
    }
  }, [quickPriceModal, quickPriceInput, callAPI, showToast, refreshPublicDirectory]);

  // 从模型库引入
  const handleDrawerAddModel = useCallback(
    async (model, targetCategory) => {
      setSaving(model.id);
      const previous = [...models];

      setModels((prev) => {
        const exists = prev.some((m) => m.id === model.id);
        if (exists) {
          return prev.map((m) =>
            m.id === model.id
              ? { ...m, is_visible: true, auto_route_eligible: true, status: 'active', tier: 'core', category: targetCategory, sort: 1 }
              : m
          );
        }
        return [
          { ...model, is_visible: true, auto_route_eligible: true, status: 'active', tier: 'core', category: targetCategory, sort: 1 },
          ...prev,
        ];
      });

      try {
        await callAPI({
          action: 'update_model_tiering',
          modelId: model.id,
          isVisible: true,
          autoRouteEligible: true,
          isActive: true,
          tier: 'core',
          category: targetCategory,
          sort: 1,
        });
        showToast(`已成功引入模型【${model.display_name || model.name}】✓`);
        refreshPublicDirectory();
      } catch (err) {
        setModels(previous);
        showToast(`引入失败: ${err.message}`, 'error');
      } finally {
        setSaving(null);
      }
    },
    [models, callAPI, showToast, refreshPublicDirectory]
  );

  // 孤立候选变体一键就地吸收归并
  const handleInlineMergeClick = useCallback((model) => {
    if (!canWrite) {
      showToast('当前账号无权执行模型归并写操作', 'error');
      return;
    }
    const defaultTarget = model.suggested_target || canonicalOptions[0]?.id || 'kling-3.0';
    setInlineTargetOverride(defaultTarget);
    setMergeConfirmModel(model);
  }, [canWrite, showToast, canonicalOptions]);

  const handleExecuteInlineMerge = useCallback(async (sourceModelId, targetModelId) => {
    if (!sourceModelId || !targetModelId) return;
    setMergingInline(true);
    setSaving(sourceModelId);
    try {
      await callAPI({
        action: 'hygiene_merge',
        sourceModelId,
        targetModelId,
      });
      showToast(`已成功将【${sourceModelId}】合并至规范模型【${targetModelId}】✓`);
      setMergeConfirmModel(null);
      refreshPublicDirectory();
      setModels((prev) =>
        prev.map((m) =>
          m.id === sourceModelId
            ? { ...m, is_visible: false, status: 'disabled', tier: 'backup', is_orphan_candidate: false }
            : m
        )
      );
      setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (err) {
      showToast(`归并失败: ${err.message}`, 'error');
    } finally {
      setMergingInline(false);
      setSaving(null);
    }
  }, [callAPI, showToast, refreshPublicDirectory]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-6 right-6 z-toast flex items-center gap-2 rounded-xl bg-surface-raised border px-4 py-2.5 text-body-sm shadow-elevation-3 animate-fade-in font-medium ${
          toast.type === 'error' ? 'border-rose-500/40 text-rose-300' : 'border-line text-ink'
        }`}>
          {toast.type === 'error' ? (
            <AlertTriangle className="size-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="size-4 text-brand shrink-0" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* ─── ROW 1: 顶层业务选项卡 (WeChat Underline Tabs) ─── */}
      <ModelNavTabs
        activeTab="models"
        modelCount={models.length}
      />

      {/* ─── ROW 1.5: 顶栏全景状态指标条 (At-a-Glance Status Bar) ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-surface-raised border border-line-subtle shadow-elevation-1 text-xs">
        {/* 左侧指标状态胶囊 */}
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          {/* 🟢 在架运行 */}
          <button
            type="button"
            onClick={() => {
              setStatusFilter((f) => f === 'visible' ? 'all' : 'visible');
              setChannelBlockFilter(false);
              setNegativeMarginFilter(false);
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all border ${
              statusFilter === 'visible' && !channelBlockFilter && !negativeMarginFilter
                ? 'bg-emerald-500/20 text-emerald-300 font-bold border-emerald-500/30'
                : 'bg-black/30 border-white/5 text-ink-muted hover:text-ink hover:bg-white/[0.04]'
            }`}
            title="筛选正在前台展示运行的模型"
          >
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>在架运行</span>
            <span className="font-mono font-bold text-ink">{statusMetrics.activeCount}</span>
          </button>

          {/* ⚪ 备用储备 */}
          <button
            type="button"
            onClick={() => {
              setStatusFilter((f) => f === 'hidden' ? 'all' : 'hidden');
              setChannelBlockFilter(false);
              setNegativeMarginFilter(false);
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all border ${
              statusFilter === 'hidden'
                ? 'bg-white/10 text-ink font-bold border-white/20'
                : 'bg-black/30 border-white/5 text-ink-muted hover:text-ink hover:bg-white/[0.04]'
            }`}
            title="筛选尚未在前台展示的备用模型"
          >
            <span className="size-2 rounded-full bg-gray-400" />
            <span>备用储备</span>
            <span className="font-mono font-bold text-ink">{statusMetrics.standbyCount}</span>
          </button>

          {/* 🔴 0渠道阻断 */}
          <button
            type="button"
            onClick={() => {
              setChannelBlockFilter((b) => !b);
              if (!channelBlockFilter) {
                setStatusFilter('all');
                setNegativeMarginFilter(false);
              }
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all border ${
              channelBlockFilter
                ? 'bg-rose-500/20 text-rose-300 font-bold border-rose-500/40'
                : statusMetrics.unroutedCount > 0
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/25 hover:bg-rose-500/15'
                : 'bg-black/30 border-white/5 text-ink-subtle'
            }`}
            title="筛选缺少正常可用通道的模型（需配置或匹配渠道）"
          >
            <span className="size-2 rounded-full bg-rose-500" />
            <span>0渠道阻断</span>
            <span className="font-mono font-bold">{statusMetrics.unroutedCount}</span>
          </button>

          {/* 🟡 待审价盘 */}
          <Link
            href="/admin/models/routing?tab=pending"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all border bg-amber-500/10 text-amber-300 border-amber-500/25 hover:bg-amber-500/20 group"
            title="查看上游待审核变价版本列表"
          >
            <span className="size-2 rounded-full bg-amber-400" />
            <span>待审价盘</span>
            <span className="font-mono font-bold">{pendingPricesCount}</span>
            <ArrowRight className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>

          {/* ⚠️ 负毛利预警 */}
          <button
            type="button"
            onClick={() => {
              setNegativeMarginFilter((n) => !n);
              if (!negativeMarginFilter) {
                setStatusFilter('all');
                setChannelBlockFilter(false);
              }
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all border ${
              negativeMarginFilter
                ? 'bg-rose-500/20 text-rose-300 font-bold border-rose-500/40'
                : statusMetrics.lossCount > 0
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/25 hover:bg-rose-500/15'
                : 'bg-black/30 border-white/5 text-ink-subtle'
            }`}
            title="筛选定价低于成本的负毛利模型"
          >
            <span>⚠️ 负毛利预警</span>
            <span className="font-mono font-bold">{statusMetrics.lossCount}</span>
          </button>

          {/* 🛡️ 规范治理健康指标胶囊 (融入大盘状态条，点击呼出规范治理与去重抽屉) */}
          <button
            type="button"
            onClick={() => setHygieneDrawerOpen(true)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all border text-xs font-semibold cursor-pointer ${
              hygieneMetrics.orphanCount > 0
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/35 hover:bg-amber-500/25 shadow-sm'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20'
            }`}
            title="全库体检与去重：规范模型与动作变体收敛治理"
          >
            <ShieldCheck className={`size-3.5 ${hygieneMetrics.orphanCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`} />
            <span>规范治理:</span>
            {hygieneMetrics.orphanCount > 0 ? (
              <span className="font-mono font-bold text-amber-300">{hygieneMetrics.orphanCount} 个待归并别名</span>
            ) : (
              <span className="font-mono font-bold text-emerald-400">
                {hygieneMetrics.canonicalCount}家族 / {hygieneMetrics.aliasCount}变体收敛
              </span>
            )}
          </button>
        </div>

        {/* 右侧核心动作 */}
        {canWrite && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setHygieneDrawerOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-semibold shrink-0"
            >
              <ShieldCheck className="size-3 text-brand" />
              全库体检与去重
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={startCreate}
              className="inline-flex items-center justify-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-semibold shrink-0 border-brand/30 text-brand hover:bg-brand/10 hover:text-white"
            >
              <Sparkles className="size-3 text-brand" />
              一站式新建
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setRepoDrawerOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 h-7 px-3 rounded-lg text-xs font-semibold shadow-elevation-1 shrink-0 bg-brand hover:bg-brand-hover text-white transition-all active:scale-[0.98]"
            >
              <Plus className="size-3" />
              从模型库引入
            </Button>
          </div>
        )}
      </div>

      {/* ─── ROW 2: 厂商 / 品牌直选过滤条 (极简 Brand Dock 视觉规范) ─── */}
      <div className="flex flex-wrap items-center gap-2 p-2 rounded-2xl bg-surface-raised/70 border border-line-subtle shadow-elevation-1">
        <button
          type="button"
          onClick={() => handleBrandSelect('all')}
          title={`全部厂商 · 共 ${models.length} 个模型`}
          aria-label={`全部厂商 · 共 ${models.length} 个模型`}
          className={`inline-flex items-center justify-center rounded-full px-4 h-[42px] text-xs font-semibold whitespace-nowrap transition-all border shrink-0 ${
            selectedBrand === 'all'
              ? 'bg-white text-black border-white shadow-elevation-1 font-bold'
              : 'bg-surface-raised border-line text-ink-muted hover:text-ink hover:bg-white/[0.06]'
          }`}
        >
          <span>全部厂商</span>
        </button>

        {activeBrands.map((brand) => {
          const isSelected = selectedBrand === brand.id;
          const count = brandStats[brand.id] || 0;
          const isMonochrome = ['openai', 'bfl', 'midjourney', 'stability', 'anthropic', 'elevenlabs', 'deepseek'].includes(brand.id);

          return (
            <button
              key={brand.id}
              type="button"
              onClick={() => handleBrandSelect(brand.id)}
              title={`${brand.name} (${brand.shortName}) · 共 ${count} 个模型`}
              aria-label={`${brand.shortName} · ${count} 个模型`}
              className={`relative inline-flex items-center justify-center size-[42px] rounded-full transition-all border shrink-0 group ${
                isSelected
                  ? 'bg-white text-black border-white shadow-elevation-2 scale-[1.02]'
                  : 'bg-surface-raised border-line text-ink-muted hover:text-ink hover:border-white/20 hover:bg-white/[0.08] hover:scale-105 active:scale-95'
              }`}
            >
              <BrandLogo
                brand={brand}
                size="pill"
                className="rounded-full shrink-0 pointer-events-none"
                imageClassName={`transition-transform duration-200 ${
                  isSelected && isMonochrome ? 'invert' : ''
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* ─── ROW 3: 业务任务场景单行过滤条 ─── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-2 rounded-2xl bg-surface-raised/70 border border-line-subtle shadow-elevation-1">
        {/* Left: Task Scene Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
          {TASK_SCENES.map((scene) => {
            const isActive = activeScene === scene.id;
            const count = sceneCounts[scene.id] || 0;
            return (
              <button
                key={scene.id}
                type="button"
                onClick={() => setActiveScene(scene.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 h-[42px] text-xs font-medium whitespace-nowrap transition-all border shrink-0 ${
                  isActive
                    ? 'bg-brand text-white font-bold border-brand shadow-elevation-1'
                    : 'bg-surface-raised border-line text-ink-muted hover:text-ink hover:bg-white/[0.06]'
                }`}
              >
                <span>{scene.label}</span>
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                  isActive ? 'bg-black/20 text-white font-bold' : 'bg-white/10 text-ink-subtle'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right: Search + Status Selector + Result Count */}
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setChannelBlockFilter(false);
              setNegativeMarginFilter(false);
            }}
            className="rounded-xl border border-line bg-well px-3 h-[42px] text-xs text-ink outline-none cursor-pointer focus:border-brand"
          >
            <option value="all">全部展示状态</option>
            <option value="visible">仅看展示已开</option>
            <option value="hidden">仅看展示已关</option>
          </select>

          <div className="relative w-48 sm:w-56 h-[42px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-ink-subtle" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索模型名称或ID..."
              className="w-full rounded-xl border border-line bg-well pl-8 pr-7 h-[42px] text-xs text-ink placeholder:text-ink-subtle outline-none focus:border-brand"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <span className="text-caption text-ink-subtle hidden sm:inline-block font-mono">
            共 {currentModels.length} 个
          </span>
        </div>
      </div>

      {/* ─── ROW 4: 核心所见即所得管理大表 (8 列一体化货架大盘) ─── */}
      <Card className="overflow-hidden p-0 border border-line shadow-elevation-1">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-line bg-surface-raised/80 text-caption font-semibold text-ink-muted">
                <th className="px-3.5 py-3 min-w-[280px] lg:min-w-[320px]">模型主体</th>
                <th className="px-3 py-3 w-[130px] min-w-[120px] whitespace-nowrap">归属工作台</th>
                <th className="px-3.5 py-3 w-[140px] min-w-[130px] whitespace-nowrap">通道状态</th>
                <th className="px-3 py-3 w-[120px] min-w-[110px] text-right whitespace-nowrap">采购底价</th>
                <th className="px-3.5 py-3 w-[130px] min-w-[130px] text-center whitespace-nowrap">C 端售价</th>
                <th className="px-3 py-3 w-[110px] min-w-[110px] text-center whitespace-nowrap">实时毛利率</th>
                <th className="px-3 py-3 w-[120px] min-w-[120px] text-center whitespace-nowrap">前台可见性</th>
                <th className="px-3.5 py-3 w-[180px] min-w-[180px] text-right whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle text-body-sm">
              {currentModels.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-ink-muted space-y-2">
                    <p>{search ? '未检索到匹配的模型' : '当前筛选条件下暂无模型'}</p>
                    {(selectedBrand !== 'all' || activeScene !== 'all' || statusFilter !== 'all' || channelBlockFilter || negativeMarginFilter) && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          handleBrandSelect('all');
                          setActiveScene('all');
                          setStatusFilter('all');
                          setChannelBlockFilter(false);
                          setNegativeMarginFilter(false);
                          setSearch('');
                        }}
                        className="text-xs"
                      >
                        清除所有筛选条件
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                currentModels.map((model, idx) => {
                  const brand = resolveBrand(model);
                  const isVisible = Boolean(model.is_visible);
                  const isSavingThis = saving === model.id;
                  const sceneLabel = getModelSceneLabel(model);
                  const marginInfo = computeModelMargin(model);
                  const credits = Number(model.base_credits || 0);
                  const healthyRoutes = Number(model.healthy_routes || 0);
                  const isExpanded = expandedVariants.has(model.id);

                  return (
                    <Fragment key={model.id}>
                      <tr
                        key={model.id}
                        className={`group transition-colors ${
                          isVisible
                            ? 'hover:bg-white/[0.02]'
                            : 'bg-white/[0.005] opacity-75 hover:opacity-100 hover:bg-white/[0.02]'
                        }`}
                      >
                      {/* Col 1: 模型主体 (BrandLogo + display_name + 徽章 + modelId + 品牌标签) */}
                      <td className="px-3.5 py-3 align-middle">
                        <div className="flex items-start gap-2.5">
                          <BrandLogo brand={brand} size="sm" className="rounded-lg shrink-0 mt-0.5" />
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-ink text-body-sm">
                                {model.display_name || model.name}
                              </span>
                              {model.badge && (
                                <span className="rounded-md bg-brand/15 text-brand border border-brand/25 px-1.5 py-0.2 text-[10px] font-bold">
                                  {model.badge}
                                </span>
                              )}
                              {model.aliases?.length > 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleExpandVariants(model.id);
                                  }}
                                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.2 text-[10px] font-semibold transition-all border cursor-pointer ${
                                    expandedVariants.has(model.id)
                                      ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/40 shadow-sm'
                                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20'
                                  }`}
                                  title={`已收敛 ${model.aliases.length} 个动作变体。点击${expandedVariants.has(model.id) ? '收起' : '展开'}变体与通道下钻明细`}
                                >
                                  <span>+{model.aliases.length} 变体</span>
                                  {expandedVariants.has(model.id) ? (
                                    <ChevronUp className="size-2.5" />
                                  ) : (
                                    <ChevronDown className="size-2.5" />
                                  )}
                                </button>
                              )}
                              {model.is_orphan_candidate && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleInlineMergeClick(model);
                                  }}
                                  className="rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 text-[10px] font-semibold hover:bg-amber-500/25 transition-colors cursor-pointer"
                                  title={
                                    model.suggested_target
                                      ? `疑似孤立动作别名，点击一键吸收归并至规范模型: ${model.suggested_target}`
                                      : '疑似孤立动作别名，点击打开治理抽屉手动指定规范目标'
                                  }
                                >
                                  ⚠️ 待归并别名
                                </button>
                              )}
                              {model.is_pinned && (
                                <span className="text-[11px]" title="已置顶首位 📌">
                                  📌
                                </span>
                              )}
                              {model.is_featured && (
                                <span className="text-[11px]" title="推荐模型 ⭐">
                                  ⭐
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-ink-subtle">
                              <span className="font-mono text-caption">{model.id}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyId(model.id)}
                                className="opacity-0 group-hover:opacity-100 hover:text-ink p-0.5 transition-opacity"
                                title="复制模型 ID"
                              >
                                <Copy className="size-2.5" />
                              </button>
                              {copiedId === model.id && (
                                <span className="text-[10px] text-emerald-400 font-sans">已复制</span>
                              )}
                              <span className="rounded bg-white/5 border border-white/10 px-1.5 py-0.2 text-[9px] text-ink-muted">
                                {brand?.shortName || '通用'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Col 2: 归属工作台 (Studio 场景图标与分类) */}
                      <td className="px-3 py-3 align-middle whitespace-nowrap">
                        {(() => {
                          const badge = getModelSceneBadge(model);
                          const BadgeIcon = badge.Icon;
                          return (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/10 px-2.5 py-0.5 text-xs text-ink-muted whitespace-nowrap">
                              <BadgeIcon className="size-3 text-brand shrink-0" />
                              <span>{badge.label}</span>
                            </span>
                          );
                        })()}
                      </td>

                      {/* Col 3: 通道状态 (healthy_routes 状态圆点) */}
                      <td className="px-3.5 py-3 align-middle whitespace-nowrap">
                        {healthyRoutes > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <span className="size-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                            <span className="font-mono text-emerald-400 font-semibold text-xs whitespace-nowrap">
                              {healthyRoutes}/{model.approved_routes || healthyRoutes} 正常
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="size-2 rounded-full bg-rose-500 shrink-0" />
                            <span className="text-rose-400 font-semibold text-xs whitespace-nowrap">
                              无可用通道
                            </span>
                            {canWrite && (
                              <button
                                type="button"
                                onClick={() => setSmartMatchModel(model)}
                                className="ml-1 text-[10px] text-brand hover:underline font-bold shrink-0"
                                title="为该模型智能匹配候选通道"
                              >
                                匹配
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Col 4: 采购底价 (采购底价 Mono 小字) */}
                      <td className="px-3 py-3 align-middle text-right font-mono whitespace-nowrap">
                        {Number(model.min_cost_cny) > 0 ? (
                          <div>
                            <span className="text-ink font-semibold text-caption">¥{Number(model.min_cost_cny).toFixed(3)}</span>
                            <span className="block text-[10px] text-ink-subtle">/次调用</span>
                          </div>
                        ) : Number(model.min_cost_usd) > 0 ? (
                          <div>
                            <span className="text-ink font-semibold text-caption">${Number(model.min_cost_usd).toFixed(4)}</span>
                            <span className="block text-[10px] text-ink-subtle">/次调用</span>
                          </div>
                        ) : (
                          <span className="text-ink-subtle text-caption">暂无底价</span>
                        )}
                      </td>

                      {/* Col 5: C 端售价 (一键就地气泡快速改积分) */}
                      <td className="px-3.5 py-3 align-middle text-center whitespace-nowrap">
                        {canWrite ? (
                          <button
                            type="button"
                            onClick={() => {
                              setQuickPriceModal({ model, credits });
                              setQuickPriceInput(String(credits || 50));
                            }}
                            className="inline-flex flex-col items-center justify-center px-2.5 py-1 rounded-xl bg-brand/5 hover:bg-brand/15 border border-brand/20 transition-all group/price"
                            title="点击一键就地气泡快速改积分"
                          >
                            <span className="font-mono font-bold text-brand text-xs group-hover/price:underline">
                              {credits} 积分 ✏️
                            </span>
                            <span className="font-mono text-[10px] text-ink-subtle">
                              ≈ ¥{(credits * CREDIT_PRICING_POLICY.cnyPerCredit).toFixed(2)}
                            </span>
                          </button>
                        ) : (
                          <div className="font-mono font-semibold text-brand text-xs">
                            {credits} 积分
                          </div>
                        )}
                      </td>

                      {/* Col 6: 实时毛利率 (彩色徽章: <0% 赤红 / <30% 琥珀 / >=30% 翠绿) */}
                      <td className="px-3 py-3 align-middle text-center whitespace-nowrap">
                        {marginInfo.hasData ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-mono font-bold border ${
                              marginInfo.status === 'loss'
                                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                : marginInfo.status === 'low'
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {marginInfo.rate}%
                          </span>
                        ) : (
                          <span className="text-ink-subtle text-caption">—</span>
                        )}
                      </td>

                      {/* Col 7: 前台可见性 (开关，0 通道拦截) */}
                      <td className="px-3 py-3 align-middle text-center whitespace-nowrap">
                        {canWrite ? (
                          <button
                            type="button"
                            onClick={() => toggleVisibility(model)}
                            disabled={isSavingThis}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-label font-medium transition-all border ${
                              isVisible
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25 shadow-elevation-1'
                                : 'bg-white/[0.04] text-ink-subtle border-line-subtle hover:bg-white/[0.08] hover:text-ink'
                            }`}
                            title={isVisible ? '展示已开 (点击关闭)' : '展示已关 (点击开启)'}
                          >
                            {isSavingThis ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : isVisible ? (
                              <>
                                <Eye className="size-3 text-emerald-400" />
                                <span>展示已开</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="size-3" />
                                <span>展示已关</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-ink-subtle text-caption">
                            {isVisible ? '展示中' : '已隐藏'}
                          </span>
                        )}
                      </td>

                      {/* Col 8: 操作 (一站式配置唤起全能抽屉) */}
                      <td className="px-3.5 py-3 align-middle text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                          {canWrite && (
                            <>
                              {/* 快速置顶 */}
                              <button
                                type="button"
                                onClick={() => togglePinned(model)}
                                disabled={isSavingThis}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  model.is_pinned
                                    ? 'text-amber-400 bg-amber-400/15 hover:bg-amber-400/25'
                                    : 'text-ink-subtle hover:text-ink hover:bg-white/[0.06]'
                                }`}
                                title={model.is_pinned ? '取消置顶' : '置顶到首位'}
                              >
                                <Pin className={`size-3.5 ${model.is_pinned ? 'fill-amber-400' : ''}`} />
                              </button>

                              {/* 快速上移/下移 */}
                              <button
                                type="button"
                                onClick={() => moveModel(model, 'up')}
                                disabled={idx === 0}
                                className="p-1.5 rounded-lg text-ink-subtle hover:text-ink hover:bg-white/[0.06] disabled:opacity-20"
                                title="上移"
                              >
                                <ChevronUp className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveModel(model, 'down')}
                                disabled={idx === currentModels.length - 1}
                                className="p-1.5 rounded-lg text-ink-subtle hover:text-ink hover:bg-white/[0.06] disabled:opacity-20"
                                title="下移"
                              >
                                <ChevronDown className="size-3.5" />
                              </button>

                              {/* 孤立别名一键归并快捷操作 */}
                              {model.is_orphan_candidate && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleInlineMergeClick(model)}
                                  disabled={isSavingThis || mergingInline}
                                  className="h-7 text-xs px-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30 font-semibold shrink-0"
                                  title={model.suggested_target ? `一键将此孤立别名归并入规范模型【${model.suggested_target}】` : '一键将此孤立别名归并入规范模型'}
                                >
                                  <GitMerge className="size-3 mr-1" />
                                  归并入 {model.suggested_target || '规范模型'}
                                </Button>
                              )}

                              {/* 一站式配置 */}
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => startEdit(model)}
                                className="h-7 text-xs px-2.5 bg-white/[0.04] hover:bg-white/[0.08] text-ink ml-1 font-semibold"
                              >
                                一站式配置
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Accordion Sub-row: 动作变体与挂载渠道拓扑明细 */}
                    {isExpanded && (
                      <tr key={`${model.id}-variants-accordion`} className="bg-well/40 border-b border-line-subtle animate-fade-in">
                        <td colSpan={8} className="px-5 py-3.5">
                          <div className="space-y-3 pl-8">
                            {/* Sub-row Header */}
                            <div className="flex items-center justify-between border-b border-line-subtle/60 pb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Layers className="size-4 text-emerald-400 shrink-0" />
                                <span className="text-xs font-semibold text-ink">
                                  【{model.display_name || model.name}】已收敛动作变体与渠道拓扑
                                </span>
                                <span className="rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.2 text-[10px] font-mono font-bold">
                                  {model.aliases.length} 个已收敛别名
                                </span>
                                <span className="rounded-full bg-white/5 text-ink-subtle border border-white/10 px-2 py-0.2 text-[10px] font-mono">
                                  {model.routes?.length || 0} 个聚合通道
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setHygieneDrawerOpen(true)}
                                  className="h-6 text-[11px] px-2 text-ink-muted hover:text-ink"
                                >
                                  全库治理抽屉
                                </Button>
                                <button
                                  type="button"
                                  onClick={() => toggleExpandVariants(model.id)}
                                  className="p-1 rounded text-ink-subtle hover:text-ink hover:bg-white/5 transition-colors"
                                  title="收起变体明细"
                                >
                                  <ChevronUp className="size-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* 1. Aliases Pills (with channel count calculation) */}
                            <div className="space-y-1.5">
                              <div className="text-[11px] font-medium text-ink-muted">
                                历史动作别名 (对外统一收敛至本模型，由智能路由统一调度):
                              </div>
                              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto custom-scrollbar p-1">
                                {model.aliases.map((alias) => {
                                  const aliasRouteCount = (Array.isArray(model.routes) ? model.routes : []).filter(
                                    (r) => r.provider_model_id === alias || (r.provider_model_id && r.provider_model_id.includes(alias))
                                  ).length;
                                  return (
                                    <span
                                      key={alias}
                                      onClick={() => handleCopyId(alias)}
                                      className="inline-flex items-center gap-1.5 text-[11px] font-mono text-ink-muted bg-surface-raised border border-line-subtle px-2 py-0.5 rounded-md hover:text-ink hover:border-line transition-colors cursor-pointer group/alias"
                                      title="点击复制别名 ID"
                                    >
                                      <code className="text-[10px] text-ink">{alias}</code>
                                      {aliasRouteCount > 0 ? (
                                        <span className="text-[9px] text-brand font-medium">({aliasRouteCount}通道)</span>
                                      ) : (
                                        <span className="text-[9px] text-emerald-400/80 font-sans">已收敛</span>
                                      )}
                                      <Copy className="size-2 text-ink-subtle opacity-0 group-hover/alias:opacity-100 transition-opacity" />
                                    </span>
                                  );
                                })}
                              </div>
                            </div>

                            {/* 2. Mounted Channels */}
                            <div className="space-y-1.5 pt-1">
                              <div className="text-[11px] font-medium text-ink-muted flex items-center justify-between">
                                <span>已挂载上游多通道 ({model.routes?.length || 0}):</span>
                                <Link
                                  href={['', 'admin', 'models', 'routing'].join('/')}
                                  className="text-[11px] text-brand hover:underline inline-flex items-center gap-0.5"
                                >
                                  <span>价盘与路由拓扑</span>
                                  <ExternalLink className="size-2.5" />
                                </Link>
                              </div>
                              {model.routes && model.routes.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {model.routes.map((route, rIdx) => {
                                    const isHealthy = (route.health_status === 'healthy' || !route.health_status) && route.enabled;
                                    return (
                                      <div
                                        key={route.id || rIdx}
                                        className="rounded-lg border border-line-subtle bg-surface-raised/70 p-2.5 flex items-center justify-between text-xs hover:border-line transition-colors"
                                      >
                                        <div className="min-w-0 space-y-0.5">
                                          <div className="flex items-center gap-1.5">
                                            <span className={`size-1.5 rounded-full ${isHealthy ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                            <span className="font-semibold text-ink truncate text-[11px]">
                                              {route.provider_name || route.provider_id}
                                            </span>
                                            <span className="rounded bg-white/5 px-1 py-0.2 text-[9px] font-mono text-ink-subtle">
                                              P{route.priority ?? 0}
                                            </span>
                                            {route.review_status && route.review_status !== 'approved' && (
                                              <span className="rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1 py-0.2 text-[9px]">
                                                待审
                                              </span>
                                            )}
                                          </div>
                                          <div className="font-mono text-[10px] text-ink-subtle truncate">
                                            {route.provider_model_id || '默认上游模型'}
                                          </div>
                                        </div>
                                        <div className="text-right shrink-0 font-mono text-[11px] pl-2">
                                          <span className="text-ink font-semibold">
                                            {Number(route.cost_cny) > 0 ? `¥${Number(route.cost_cny).toFixed(3)}` : Number(route.cost_usd) > 0 ? `$${Number(route.cost_usd).toFixed(4)}` : '免计费'}
                                          </span>
                                          <span className="block text-[9px] text-ink-subtle">/次</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="p-3 rounded-lg border border-line-subtle bg-surface-raised/40 text-center text-xs text-ink-subtle">
                                  ⓘ 当前规范模型尚未绑定任何活跃上游通道。可通过【一站式配置】或【智能匹配】挂载通道。
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ─── 极速调价浮层 (Quick Price Modal) ─── */}
      {quickPriceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-surface-raised border border-line p-5 shadow-elevation-3 space-y-4">
            <div className="flex items-center justify-between border-b border-line-subtle pb-3">
              <div className="flex items-center gap-2">
                <BrandLogo model={quickPriceModal.model} size="sm" className="rounded-md" />
                <h3 className="text-body font-semibold text-ink">极速调整积分定价</h3>
              </div>
              <button
                type="button"
                onClick={() => setQuickPriceModal(null)}
                className="text-ink-subtle hover:text-ink p-1 rounded-md"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-body-sm font-semibold text-ink">
                  {quickPriceModal.model.display_name || quickPriceModal.model.name}
                </p>
                <p className="font-mono text-caption text-ink-subtle">
                  {quickPriceModal.model.id}
                </p>
              </div>

              {/* Reference Cost info */}
              <div className="p-2.5 rounded-xl bg-well/60 border border-line-subtle flex items-center justify-between text-caption">
                <span className="text-ink-muted">官方渠道成本参考</span>
                <span className="font-mono text-ink font-semibold">
                  {Number(quickPriceModal.model.min_cost_cny) > 0
                    ? `¥${Number(quickPriceModal.model.min_cost_cny).toFixed(3)}/次`
                    : Number(quickPriceModal.model.min_cost_usd) > 0
                    ? `$${Number(quickPriceModal.model.min_cost_usd).toFixed(4)}/次`
                    : '暂无成本报价'}
                </span>
              </div>

              {/* Credits input */}
              <div className="space-y-1.5">
                <label className="text-label text-ink-muted block font-medium">
                  单次生成扣除积分 (10 积分 = ¥1.00)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={quickPriceInput}
                    onChange={(e) => setQuickPriceInput(e.target.value)}
                    className="w-full rounded-xl bg-field border border-line-subtle px-3 py-2 text-body font-mono text-ink focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand font-bold"
                    placeholder="如 50"
                    autoFocus
                  />
                  <span className="absolute right-3 top-2.5 text-caption text-ink-subtle font-mono">
                    ≈ ¥{((Number(quickPriceInput) || 0) * CREDIT_PRICING_POLICY.cnyPerCredit).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Estimated Margin */}
              {(() => {
                const margin = computeModelMargin(quickPriceModal.model, Number(quickPriceInput));
                if (!margin.hasData) return null;
                const isHealthy = margin.status === 'healthy';
                const isLoss = margin.status === 'loss';
                return (
                  <div className={`p-2.5 rounded-xl border flex items-center justify-between text-caption ${
                    isLoss
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      : isHealthy
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  }`}>
                    <span>预估毛利率</span>
                    <span className="font-mono font-bold">
                      {margin.rate}% {isLoss ? '(亏损警告)' : isHealthy ? '(健康毛利)' : '(微利)'}
                    </span>
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line-subtle">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setQuickPriceModal(null)}
                disabled={savingQuickPrice}
              >
                取消
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveQuickPrice}
                disabled={savingQuickPrice}
              >
                {savingQuickPrice ? (
                  <Loader2 className="size-3.5 mr-1 animate-spin" />
                ) : (
                  <Save className="size-3.5 mr-1" />
                )}
                确认调整
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 孤立别名一键吸收归并确认浮层 (Inline Merge Modal) ─── */}
      {mergeConfirmModel && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !mergingInline) {
              setMergeConfirmModel(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="一键吸收归并孤立变体"
            className="w-full max-w-md rounded-2xl bg-surface-raised border border-line p-5 shadow-elevation-4 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-line-subtle pb-3">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/25">
                  <GitMerge className="size-4" />
                </span>
                <h3 className="text-body font-semibold text-ink">一键吸收归并孤立别名</h3>
              </div>
              <button
                type="button"
                onClick={() => setMergeConfirmModel(null)}
                className="text-ink-subtle hover:text-ink p-1 rounded-md"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-well/60 border border-line-subtle space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">待归并源别名</span>
                  <span className="font-mono font-bold text-amber-300">{mergeConfirmModel.id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">显示名称</span>
                  <span className="text-ink font-medium">{mergeConfirmModel.display_name || mergeConfirmModel.name}</span>
                </div>
                <div className="space-y-1.5 border-t border-line-subtle/50 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted">归并目标规范模型</span>
                    {mergeConfirmModel.suggested_target && (
                      <span className="text-[10px] text-brand font-medium">推荐: {mergeConfirmModel.suggested_target}</span>
                    )}
                  </div>
                  <select
                    value={inlineTargetOverride || mergeConfirmModel.suggested_target || canonicalOptions[0]?.id || ''}
                    onChange={(e) => setInlineTargetOverride(e.target.value)}
                    className="w-full rounded-lg bg-surface border border-line-subtle px-2.5 py-1.5 text-xs text-ink font-mono focus:border-brand outline-none cursor-pointer"
                  >
                    {canonicalOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.display_name || opt.name} ({opt.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 space-y-1">
                <div className="font-semibold flex items-center gap-1">
                  <AlertTriangle className="size-3.5" />
                  <span>非破坏性治理操作</span>
                </div>
                <p className="text-[11px] text-amber-400/90 leading-relaxed">
                  执行后，该别名名下的全部供应商通道将自动迁移至【{inlineTargetOverride || mergeConfirmModel.suggested_target || '目标规范模型'}】名下，原模型将转为备用下沉并禁用，历史任务记录与前台调度完全不受影响。
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line-subtle">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMergeConfirmModel(null)}
                disabled={mergingInline}
              >
                取消
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleExecuteInlineMerge(mergeConfirmModel.id, inlineTargetOverride || mergeConfirmModel.suggested_target || canonicalOptions[0]?.id)}
                disabled={mergingInline}
                className="bg-amber-600 hover:bg-amber-500 text-white font-semibold"
              >
                {mergingInline ? (
                  <>
                    <Loader2 className="size-3.5 mr-1 animate-spin" />
                    正在归并...
                  </>
                ) : (
                  <>
                    <GitMerge className="size-3.5 mr-1" />
                    确认一键归并
                  </>
                )}
              </Button>
            </div>
          </section>
        </div>
      )}

      {/* ─── 右侧抽屉式全生命周期一站式配置面板 (ModelConfigDrawer) ─── */}
      <ModelConfigDrawer
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setDrawerModel(null);
        }}
        model={drawerModel}
        isNew={isDrawerNew}
        allModels={models}
        activeCategory={drawerModel?.category || 'image'}
        canWrite={canWrite}
        onSave={handleDrawerSave}
        onSmartMatch={(m) => {
          setDrawerOpen(false);
          setSmartMatchModel(m);
        }}
      />

      {/* ─── 模型库引入抽屉 (ModelRepositoryDrawer) ─── */}
      <ModelRepositoryDrawer
        isOpen={repoDrawerOpen}
        onClose={() => setRepoDrawerOpen(false)}
        activeCategory={activeScene === 'all' ? 'image' : activeScene}
        categoryLabel={TASK_SCENES.find((s) => s.id === activeScene)?.label || '模型库'}
        allModels={models}
        canWrite={canWrite}
        onAddModel={handleDrawerAddModel}
        onCreateCustomModel={async (data) => {
          await callAPI({ action: 'create_model', ...data });
          showToast(`已注册模型【${data.displayName || data.name}】✓`);
          window.location.reload();
        }}
        onSelectForEdit={(m) => startEdit(m)}
        onOpenCreateDrawer={startCreate}
      />

      {/* ─── 全库规范治理与去重抽屉 (ModelHygieneDrawer) ─── */}
      <ModelHygieneDrawer
        isOpen={hygieneDrawerOpen}
        onClose={() => setHygieneDrawerOpen(false)}
        onHygieneCompleted={() => {
          refreshPublicDirectory();
          window.location.reload();
        }}
        callAPI={callAPI}
      />

      {/* ─── 0 渠道上线拦截确认弹窗 (UnroutedConfirmModal) ─── */}
      <UnroutedConfirmModal
        model={unroutedConfirmModel}
        onCancel={() => setUnroutedConfirmModel(null)}
        onSmartMatch={(m) => {
          setUnroutedConfirmModel(null);
          setSmartMatchModel(m);
        }}
      />

      {/* ─── 智能候选匹配弹窗 (SmartMatchModal) ─── */}
      <SmartMatchModal
        isOpen={Boolean(smartMatchModel)}
        onClose={() => setSmartMatchModel(null)}
        initialModel={smartMatchModel}
        allModels={models}
        activeCategory={activeScene === 'all' ? 'all' : activeScene}
      />
    </div>
  );
}

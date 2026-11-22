'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Layers, Search, X, Plus, Check, AlertTriangle, ShieldCheck,
  Sparkles, Filter, ChevronRight, CheckCircle2, ArrowRight, Loader2,
  Tag, Zap, Radio
} from 'lucide-react';
import { Button } from '@/components/admin/AdminUi';
import BrandLogo from '@/components/admin/BrandLogo';

const PRESET_BADGES = ['New', 'Best', 'Hot', 'Pro', 'Fast', '4.5 旗舰', '3.0', '旗舰'];

const CATEGORY_MAP = {
  image: '图像模型',
  video: '视频模型',
  audio: '音频模型',
  text: '智能体 / 语言',
};

const SUBTYPE_DEFAULTS = {
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

function normalizeProviders(provs) {
  if (!provs) return [];
  if (Array.isArray(provs)) return provs;
  try {
    const parsed = typeof provs === 'string' ? JSON.parse(provs) : provs;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function ModelRepositoryDrawer({
  isOpen,
  onClose,
  activeCategory,
  categoryLabel,
  allModels = [],
  canWrite,
  onAddModel,
  onCreateCustomModel,
  onSelectForEdit,
  onOpenCreateDrawer,
}) {
  const [activeTab, setActiveTab] = useState('browse'); // browse | register
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('current'); // current | all | other
  const [statusFilter, setStatusFilter] = useState('all'); // all | unexposed | exposed
  const [operatingId, setOperatingId] = useState(null);

  // Custom Register Form State
  const [customForm, setCustomForm] = useState({
    model_id: '',
    name: '',
    display_name: '',
    category: activeCategory === 'all' ? 'image' : activeCategory,
    sub_type: 't2i',
    badge: 'New',
    credits_price: '',
    description: '',
    is_visible: false,
    is_pinned: false,
  });
  const [registering, setRegistering] = useState(false);

  // Filtered candidate models from the full system repository
  const repositoryCandidates = useMemo(() => {
    let list = allModels;

    // 1. Category Filter
    if (categoryFilter === 'current' && activeCategory !== 'all') {
      list = list.filter((m) => (m.category || '').startsWith(activeCategory));
    } else if (categoryFilter === 'other' && activeCategory !== 'all') {
      list = list.filter((m) => !(m.category || '').startsWith(activeCategory));
    }

    // 2. Status Filter
    if (statusFilter === 'unexposed') {
      list = list.filter((m) => !m.is_visible);
    } else if (statusFilter === 'exposed') {
      list = list.filter((m) => Boolean(m.is_visible));
    }

    // 3. Search Filter
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((m) =>
        (m.display_name || '').toLowerCase().includes(q) ||
        (m.name || '').toLowerCase().includes(q) ||
        (m.id || '').toLowerCase().includes(q) ||
        (m.description || '').toLowerCase().includes(q) ||
        normalizeProviders(m.provider_ids).some((p) => String(p).toLowerCase().includes(q))
      );
    }

    // Sort: unexposed first (so admin sees models available to add), then by name
    return list.sort((a, b) => {
      const aInCurrent = (a.category || '').startsWith(activeCategory);
      const bInCurrent = (b.category || '').startsWith(activeCategory);
      if (aInCurrent !== bInCurrent) return aInCurrent ? -1 : 1;

      // Hidden models shown before already visible models when adding
      if (Boolean(a.is_visible) !== Boolean(b.is_visible)) {
        return a.is_visible ? 1 : -1;
      }
      return (a.display_name || a.name || '').localeCompare(b.display_name || b.name || '');
    });
  }, [allModels, activeCategory, categoryFilter, statusFilter, search]);

  const handleQuickAdd = useCallback(async (model) => {
    if (!canWrite) return;
    setOperatingId(model.id);
    try {
      await onAddModel(model, activeCategory === 'all' ? (model.category || 'image') : activeCategory);
    } finally {
      setOperatingId(null);
    }
  }, [canWrite, onAddModel, activeCategory]);

  const handleRegisterSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    if (!customForm.model_id.trim()) return;

    setRegistering(true);
    try {
      await onCreateCustomModel({
        modelId: customForm.model_id.trim(),
        name: customForm.name.trim() || customForm.model_id.trim(),
        displayName: customForm.display_name.trim() || customForm.name.trim() || customForm.model_id.trim(),
        category: customForm.category,
        subType: customForm.sub_type,
        badge: customForm.badge,
        creditsPrice: customForm.credits_price === '' ? undefined : Number(customForm.credits_price),
        description: customForm.description.trim(),
        isVisible: false,
        isPinned: Boolean(customForm.is_pinned),
        sort: 1,
      });
      // Reset form
      setCustomForm({
        model_id: '',
        name: '',
        display_name: '',
        category: activeCategory === 'all' ? 'image' : activeCategory,
        sub_type: 't2i',
        badge: 'New',
        credits_price: '',
        description: '',
        is_visible: false,
        is_pinned: false,
      });
      setActiveTab('browse');
    } finally {
      setRegistering(false);
    }
  }, [canWrite, customForm, onCreateCustomModel, activeCategory]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-modal flex justify-end bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#14161a] border-l border-line-subtle shadow-[-20px_0_60px_rgba(0,0,0,0.8)] flex flex-col h-full animate-slide-left">
        {/* Drawer Header */}
        <div className="p-5 border-b border-line-subtle bg-surface-raised flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-brand/15 border border-brand/30 flex items-center justify-center text-brand">
              <Layers className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-body-lg font-bold text-ink">模型库 · 资产引入中心</h2>
                <span className="rounded-full bg-brand/15 text-brand px-2.5 py-0.5 text-micro font-bold border border-brand/30">
                  随时引入
                </span>
              </div>
              <p className="text-caption text-ink-muted mt-0.5">
                目标分类：<strong className="text-ink">{categoryLabel}</strong> · 从底层资产库（{allModels.length} 个模型）一键导入前台
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-ink-subtle hover:text-ink hover:bg-white/[0.08] transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-line-subtle bg-well/40 text-body-sm">
          <button
            type="button"
            onClick={() => setActiveTab('browse')}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 font-medium transition-all ${
              activeTab === 'browse'
                ? 'bg-surface-raised text-ink shadow-elevation-1 font-semibold border border-line'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Search className="size-3.5" />
            <span>从底层资产库挑选</span>
            <span className="rounded-full bg-brand/10 text-brand px-1.5 py-0.2 text-[10px] font-mono">
              {repositoryCandidates.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 font-medium transition-all ${
              activeTab === 'register'
                ? 'bg-surface-raised text-ink shadow-elevation-1 font-semibold border border-line'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Plus className="size-3.5" />
            <span>注册全新模型 ID</span>
          </button>
        </div>

        {/* TAB 1: BROWSE REPOSITORY */}
        {activeTab === 'browse' && (
          <div className="flex-1 flex flex-col min-h-0 p-5 space-y-4">
            {/* Filter toolbar */}
            <div className="space-y-3">
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-subtle" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索模型库 ID、显示名、供应商或描述..."
                  className="w-full rounded-xl border border-line-strong bg-well pl-9 pr-8 py-2 text-body-sm text-ink placeholder:text-ink-subtle outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Scope & Status chips */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-caption">
                <div className="flex items-center gap-1.5">
                  <span className="text-ink-subtle">范围:</span>
                  <div className="inline-flex rounded-full bg-well p-0.5 border border-line-subtle">
                    {[
                      { id: 'current', label: `当前类别 (${categoryLabel})` },
                      { id: 'all', label: '全库模型' },
                      { id: 'other', label: '跨类别资产' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setCategoryFilter(f.id)}
                        className={`rounded-full px-2.5 py-0.5 transition-colors ${
                          categoryFilter === f.id
                            ? 'bg-surface-raised text-ink font-semibold border border-line'
                            : 'text-ink-muted hover:text-ink'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-ink-subtle">状态:</span>
                  <div className="inline-flex rounded-full bg-well p-0.5 border border-line-subtle">
                    {[
                      { id: 'all', label: '全部' },
                      { id: 'unexposed', label: '仅看未上架 (可加)' },
                      { id: 'exposed', label: '已在上架' },
                    ].map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setStatusFilter(s.id)}
                        className={`rounded-full px-2.5 py-0.5 transition-colors ${
                          statusFilter === s.id
                            ? 'bg-surface-raised text-ink font-semibold border border-line'
                            : 'text-ink-muted hover:text-ink'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Candidates Card List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
              {repositoryCandidates.length === 0 ? (
                <div className="py-16 text-center text-body-sm text-ink-muted">
                  没有找到匹配的模型资产
                </div>
              ) : (
                repositoryCandidates.map((m) => {
                  const isVisibleInActiveCategory =
                    Boolean(m.is_visible) && (m.category || '').startsWith(activeCategory);
                  const isHiddenInActiveCategory =
                    !m.is_visible && (m.category || '').startsWith(activeCategory);
                  const isOtherCategory =
                    !(m.category || '').startsWith(activeCategory);
                  const hasRoutes = (m.approved_routes ?? 0) > 0;
                  const providers = normalizeProviders(m.provider_ids);
                  const isOperating = operatingId === m.id;

                  return (
                    <div
                      key={m.id}
                      className={`rounded-xl border p-3.5 transition-all ${
                        isVisibleInActiveCategory
                          ? 'bg-emerald-500/[0.03] border-emerald-500/20'
                          : 'bg-surface-raised border-line-subtle hover:border-line-strong hover:bg-well/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        {/* Left: Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <BrandLogo model={m} size="sm" className="rounded-md shrink-0" />
                            <span className="font-bold text-body text-ink">
                              {m.display_name || m.name}
                            </span>
                            {m.badge && (
                              <span className="rounded-full bg-brand/15 text-brand px-1.5 py-0.2 text-[9px] font-bold border border-brand/25">
                                {m.badge}
                              </span>
                            )}
                            <span className="rounded bg-white/[0.04] px-1.5 py-0.2 text-[10px] text-ink-subtle font-mono">
                              {m.category}
                            </span>
                            {hasRoutes ? (
                              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                                <span className="size-1.5 rounded-full bg-emerald-400" />
                                {m.approved_routes} 个渠道
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[11px] text-red-400 font-medium">
                                <AlertTriangle className="size-3" />
                                无可用渠道
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex items-center gap-2 text-caption text-ink-muted flex-wrap">
                            <span className="font-mono text-ink-subtle">{m.id}</span>
                            {providers.length > 0 && (
                              <>
                                <span>·</span>
                                <span className="text-ink-subtle">
                                  提供商: {providers.slice(0, 2).join(', ')}
                                </span>
                              </>
                            )}
                            {m.base_credits > 0 && (
                              <>
                                <span>·</span>
                                <span className="text-brand font-medium">
                                  {m.base_credits} 积分
                                </span>
                              </>
                            )}
                          </div>

                          {m.description && (
                            <p className="mt-1 text-caption text-ink-muted line-clamp-1">
                              {m.description}
                            </p>
                          )}
                        </div>

                        {/* Right: Action */}
                        <div className="shrink-0 flex items-center gap-2">
                          {isVisibleInActiveCategory ? (
                            <div className="flex items-center gap-1.5">
                              <span className="flex items-center gap-1 text-caption text-emerald-400 font-semibold px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                <CheckCircle2 className="size-3.5" />
                                前台展示中
                              </span>
                              {canWrite && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    onSelectForEdit(m);
                                    onClose();
                                  }}
                                  className="text-xs h-8 px-2 text-ink-muted hover:text-ink"
                                >
                                  编辑配置
                                </Button>
                              )}
                            </div>
                          ) : isHiddenInActiveCategory ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={isOperating || !canWrite}
                              onClick={() => handleQuickAdd(m)}
                              className="text-xs h-8 px-3 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/15"
                            >
                              {isOperating ? (
                                <Loader2 className="size-3 animate-spin mr-1" />
                              ) : (
                                <Plus className="size-3 mr-1" />
                              )}
                              一键上架展示
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={isOperating || !canWrite}
                              onClick={() => handleQuickAdd(m)}
                              className="text-xs h-8 px-3 text-brand border-brand/30 hover:bg-brand/10"
                            >
                              {isOperating ? (
                                <Loader2 className="size-3 animate-spin mr-1" />
                              ) : (
                                <Plus className="size-3 mr-1" />
                              )}
                              引入至当前分类
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 2: REGISTER CUSTOM MODEL */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
            <div className="rounded-xl bg-brand/10 border border-brand/20 p-3 text-caption text-brand leading-relaxed flex items-center justify-between gap-2">
              <div className="flex items-start gap-2">
                <Sparkles className="size-4 shrink-0 mt-0.5" />
                <div>
                  <strong>自定义模型注册</strong>：当上游服务商上线了新模型 ID，您可在此快速注册并直接暴露到前台展示池中。
                </div>
              </div>
              {onOpenCreateDrawer && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCreateDrawer();
                  }}
                  className="rounded-lg bg-brand/20 hover:bg-brand/30 text-brand border border-brand/40 px-2.5 py-1 text-micro font-bold shrink-0 whitespace-nowrap transition-colors"
                >
                  去全能抽屉配置 →
                </button>
              )}
            </div>

            {/* Model ID */}
            <div>
              <label className="text-label text-ink-muted block font-medium mb-1">
                模型 ID (唯一标识，对应供应商映射) *
              </label>
              <input
                type="text"
                required
                value={customForm.model_id}
                onChange={(e) => setCustomForm((f) => ({ ...f, model_id: e.target.value }))}
                placeholder="例如：kling-v3.0-pro-t2v 或 flux-2.0-pro"
                className="w-full rounded-xl border border-line-strong bg-surface-raised px-3 py-2 text-body text-ink font-mono outline-none focus:border-brand"
              />
            </div>

            {/* Display Name */}
            <div>
              <label className="text-label text-ink-muted block font-medium mb-1">
                前台友好展示名称 *
              </label>
              <input
                type="text"
                required
                value={customForm.display_name}
                onChange={(e) => setCustomForm((f) => ({ ...f, display_name: e.target.value }))}
                placeholder="例如：快手可灵 Kling 3.0 旗舰版"
                className="w-full rounded-xl border border-line-strong bg-surface-raised px-3 py-2 text-body text-ink outline-none focus:border-brand"
              />
            </div>

            {/* Category & Subtype */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-label text-ink-muted block font-medium mb-1">归属主分类</label>
                <select
                  value={customForm.category}
                  onChange={(e) => {
                    const cat = e.target.value;
                    const subOptions = SUBTYPE_DEFAULTS[cat] || [];
                    setCustomForm((f) => ({
                      ...f,
                      category: cat,
                      sub_type: subOptions[0]?.id || '',
                    }));
                  }}
                  className="w-full rounded-xl border border-line-strong bg-surface-raised px-3 py-2 text-body text-ink outline-none focus:border-brand [&>option]:bg-[#14161a]"
                >
                  <option value="image">图像模型 (Image)</option>
                  <option value="video">视频模型 (Video)</option>
                  <option value="audio">音频模型 (Audio)</option>
                  <option value="text">智能体 / 语言 (Text)</option>
                </select>
              </div>

              <div>
                <label className="text-label text-ink-muted block font-medium mb-1">子类型</label>
                <select
                  value={customForm.sub_type}
                  onChange={(e) => setCustomForm((f) => ({ ...f, sub_type: e.target.value }))}
                  className="w-full rounded-xl border border-line-strong bg-surface-raised px-3 py-2 text-body text-ink outline-none focus:border-brand [&>option]:bg-[#14161a]"
                >
                  {(SUBTYPE_DEFAULTS[customForm.category] || []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Badges Presets & Input */}
            <div>
              <label className="text-label text-ink-muted block font-medium mb-1">前台高光徽章</label>
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {PRESET_BADGES.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setCustomForm((f) => ({ ...f, badge: f.badge === b ? '' : b }))}
                    className={`rounded-full px-2.5 py-1 text-label transition-all ${
                      customForm.badge === b
                        ? 'bg-brand text-white shadow-elevation-1 font-bold'
                        : 'bg-surface-raised border border-line text-ink-muted hover:text-ink'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={customForm.badge}
                onChange={(e) => setCustomForm((f) => ({ ...f, badge: e.target.value }))}
                placeholder="或自定义徽章文本（如 4.5 旗舰）"
                className="w-full rounded-xl border border-line-subtle bg-surface-raised px-3 py-1.5 text-body-sm text-ink outline-none focus:border-brand"
              />
            </div>

            {/* Base Credits Price */}
            <div>
              <label className="text-label text-ink-muted block font-medium mb-1">
                固定积分价格（可留空，待成本与售价审核）
              </label>
              <input
                type="number"
                min="0"
                value={customForm.credits_price}
                onChange={(e) => setCustomForm((f) => ({ ...f, credits_price: e.target.value }))}
                className="w-full rounded-xl border border-line-strong bg-surface-raised px-3 py-2 text-body text-ink outline-none focus:border-brand"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-label text-ink-muted block font-medium mb-1">
                前台特性描述
              </label>
              <textarea
                rows={2}
                value={customForm.description}
                onChange={(e) => setCustomForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="例如：极速秒出图，高清写实人像增强，适合快速创意。"
                className="w-full rounded-xl border border-line-strong bg-surface-raised px-3 py-2 text-body text-ink outline-none resize-none focus:border-brand"
              />
            </div>

            {/* Switches */}
            <div className="flex items-center gap-4 pt-2">
              <label className="flex items-center gap-2 text-body-sm text-ink cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={false}
                  disabled
                  className="rounded accent-brand size-4"
                />
                <span className="font-semibold text-brand">申请前台展示（审核前保持隐藏）</span>
              </label>

              <label className="flex items-center gap-2 text-body-sm text-amber-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={customForm.is_pinned}
                  onChange={(e) => setCustomForm((f) => ({ ...f, is_pinned: e.target.checked }))}
                  className="rounded accent-amber-500 size-4"
                />
                <span>前台列表置顶 📌</span>
              </label>
            </div>

            {/* Submit */}
            <div className="pt-4 border-t border-line-subtle flex justify-end gap-2">
              <Button variant="ghost" size="sm" type="button" onClick={() => setActiveTab('browse')}>
                取消
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={registering}>
                {registering ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Plus className="size-3.5 mr-1" />}
                创建并引入前台展示池
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

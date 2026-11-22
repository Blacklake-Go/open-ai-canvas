'use client';

import { useState, useMemo } from 'react';
import { Search, X, Check, Pin, Sparkles, Eye, Zap, Layers } from 'lucide-react';
import { Button } from '@/components/admin/AdminUi';

const PREVIEW_SUBTYPES = {
  image: [
    { id: 'all', label: '全部' },
    { id: 't2i', label: '文生图 (T2I)' },
    { id: 'i2i', label: '图生图 (I2I)' },
  ],
  video: [
    { id: 'all', label: '全部' },
    { id: 't2v', label: '文生视频 (T2V)' },
    { id: 'i2v', label: '图生视频 (I2V)' },
    { id: 'v2v', label: '视频编辑 (V2V)' },
  ],
  audio: [
    { id: 'all', label: '全部' },
    { id: 'music', label: '音乐生成' },
    { id: 'tts', label: '语音 (TTS)' },
  ],
  text: [
    { id: 'all', label: '全部' },
    { id: 'chat', label: '智能对话' },
    { id: 'reasoning', label: '深度推理' },
  ],
};

export default function StudioLivePreviewer({
  isOpen,
  onClose,
  activeCategory,
  categoryLabel,
  visibleModels = [],
}) {
  const [search, setSearch] = useState('');
  const [selectedSubtype, setSelectedSubtype] = useState('all');
  const [selectedModelId, setSelectedModelId] = useState(null);

  const subtypes = PREVIEW_SUBTYPES[activeCategory] || [{ id: 'all', label: '全部' }];

  const filteredModels = useMemo(() => {
    let list = visibleModels;
    if (selectedSubtype !== 'all') {
      list = list.filter((m) => {
        const sub = m.sub_type || (m.capabilities && m.capabilities.sub_type) || '';
        return sub.toLowerCase() === selectedSubtype.toLowerCase();
      });
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((m) =>
        (m.display_name || m.name || '').toLowerCase().includes(q) ||
        (m.id || '').toLowerCase().includes(q)
      );
    }
    // Sort pinned models to the top
    return list.sort((a, b) => {
      const aPinned = Boolean(a.is_pinned);
      const bPinned = Boolean(b.is_pinned);
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      return (a.sort ?? 0) - (b.sort ?? 0);
    });
  }, [visibleModels, selectedSubtype, search]);

  // Set default selected model if none selected
  const activeSelectedModel = useMemo(() => {
    if (selectedModelId) {
      const found = visibleModels.find((m) => m.id === selectedModelId);
      if (found) return found;
    }
    return filteredModels[0] || visibleModels[0] || null;
  }, [selectedModelId, visibleModels, filteredModels]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-modal w-full max-w-md bg-[#131519]/98 border-l border-line-subtle shadow-[-16px_0_48px_rgba(0,0,0,0.7)] backdrop-blur-xl flex flex-col animate-slide-left">
      {/* Header */}
      <div className="p-4 border-b border-line-subtle flex items-center justify-between bg-surface-raised/40">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-brand/15 border border-brand/30 flex items-center justify-center text-brand">
            <Eye className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-body font-bold text-ink">公开目录展示预览</h3>
              <span className="rounded-full bg-brand/10 text-brand px-2 py-0.2 text-[10px] font-bold border border-brand/20">
                参考图2
              </span>
            </div>
            <p className="text-caption text-ink-muted">
              {categoryLabel} · 仅显示当前目录可选模型，真实生成仍需验收
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-ink-subtle hover:text-ink hover:bg-white/[0.08] transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Trigger Button Mockup (how it looks in Studio toolbar) */}
      <div className="p-4 border-b border-line-subtle bg-well/30">
        <label className="text-caption font-semibold text-ink-subtle uppercase tracking-wider block mb-2">
          工作室顶部触发按钮外观 (Trigger Button)
        </label>
        {activeSelectedModel ? (
          <div className="inline-flex items-center gap-2.5 rounded-full border border-line-strong bg-surface-raised px-3.5 py-2 shadow-elevation-2 cursor-pointer hover:border-brand/40 transition-all">
            {/* Emblem */}
            <div className="size-5 rounded-full bg-brand/20 text-brand font-black text-[11px] flex items-center justify-center border border-brand/30">
              {(activeSelectedModel.display_name || activeSelectedModel.name || 'M').charAt(0)}
            </div>
            <span className="text-body-sm font-bold text-ink">
              {activeSelectedModel.display_name || activeSelectedModel.name}
            </span>
            {activeSelectedModel.badge && (
              <span className="rounded-full bg-brand/20 text-brand px-2 py-0.2 text-[10px] font-bold border border-brand/30">
                {activeSelectedModel.badge}
              </span>
            )}
            {activeSelectedModel.is_pinned && (
              <span className="rounded-full bg-amber-500/20 text-amber-300 px-1.5 py-0.2 text-[9px] font-bold border border-amber-500/30 flex items-center gap-0.5">
                <Pin className="size-2 fill-amber-300" />
              </span>
            )}
            <span className="text-ink-subtle text-caption ml-1 font-mono">
              {Number(activeSelectedModel.base_credits) > 0 ? `${activeSelectedModel.base_credits} 积分` : '价格待核验'}
            </span>
          </div>
        ) : (
          <div className="text-caption text-ink-subtle py-2">当前分类暂无前台可见模型</div>
        )}
      </div>

      {/* Fig 2 Clean Dropdown Container */}
      <div className="p-4 flex-1 flex flex-col min-h-0 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-caption font-semibold text-ink-subtle uppercase tracking-wider">
            点击弹出的模型下拉菜单 (Fig 2 Clean Picker)
          </label>
          <span className="text-caption text-brand font-medium">
            {visibleModels.length} 个目录可选
          </span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-ink-subtle" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`搜索 ${categoryLabel}...`}
            className="w-full rounded-xl border border-line-strong bg-well pl-8 pr-7 py-2 text-body-sm text-ink placeholder:text-ink-subtle outline-none focus:border-brand/40"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        {/* Subtype Chips */}
        {subtypes.length > 1 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-1 custom-scrollbar">
            {subtypes.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => setSelectedSubtype(sub.id)}
                className={`rounded-full px-2.5 py-1 text-label font-medium whitespace-nowrap transition-colors ${
                  selectedSubtype === sub.id
                    ? 'bg-brand text-white shadow-elevation-1 font-semibold'
                    : 'bg-well text-ink-muted hover:text-ink border border-line-subtle'
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>
        )}

        {/* Scrollable Model Items List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {filteredModels.length === 0 ? (
            <div className="py-12 text-center text-body-sm text-ink-muted">
              {search ? '未检索到匹配的可见模型' : '当前分类暂无可见模型（请在左侧开启）'}
            </div>
          ) : (
            filteredModels.map((model) => {
              const isSelected = activeSelectedModel?.id === model.id;
              const name = model.display_name || model.name;
              const badge = model.badge;
              const subType = model.sub_type || (model.category === 'video' ? 'T2V' : 'T2I');
              const credits = model.base_credits || 50;

              return (
                <div
                  key={model.id}
                  onClick={() => setSelectedModelId(model.id)}
                  className={`rounded-xl border p-3 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-brand/[0.08] border-brand/50 shadow-elevation-2'
                      : 'bg-surface-raised border-line hover:border-line-strong hover:bg-well'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Emblem Avatar */}
                    <div className="size-8 rounded-lg border border-line flex items-center justify-center bg-brand/10 text-brand font-black text-xs shrink-0 shadow-elevation-1">
                      {name.charAt(0) || 'M'}
                    </div>

                    {/* Title & Badges */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-body-sm font-bold text-ink truncate">{name}</span>
                        {badge && (
                          <span className="rounded-full bg-brand/20 text-brand px-1.5 py-0.2 text-[9px] font-bold border border-brand/30">
                            {badge}
                          </span>
                        )}
                        {model.is_pinned && (
                          <span className="rounded-full bg-amber-500/20 text-amber-300 px-1.5 py-0.2 text-[8px] font-bold border border-amber-500/30 flex items-center gap-0.5">
                            <Pin className="size-2 fill-amber-300" /> 置顶
                          </span>
                        )}
                      </div>

                      {/* Subtype & Credits */}
                      <div className="flex items-center gap-1.5 mt-0.5 text-caption text-ink-subtle">
                        <span className="font-mono text-[10px] text-ink-muted">
                          {subType.toUpperCase()}
                        </span>
                        <span>·</span>
                        <span className="text-brand/80 font-mono text-[11px] font-medium">
                          {credits} 积分
                        </span>
                      </div>

                      {/* Description */}
                      {model.description && (
                        <p className="mt-1 text-caption text-ink-muted leading-relaxed line-clamp-1">
                          {model.description}
                        </p>
                      )}
                    </div>

                    {/* Selection Indicator */}
                    {isSelected && (
                      <div className="size-4 rounded-full bg-brand flex items-center justify-center text-white shrink-0 shadow-elevation-1">
                        <Check className="size-2.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-line-subtle bg-surface-raised/30 flex items-center justify-between text-caption text-ink-subtle">
        <span className="flex items-center gap-1">
          <Zap className="size-3 text-brand" />
          左侧任何配置更改实时同步渲染
        </span>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-xs h-7">
          收起预览
        </Button>
      </div>
    </div>
  );
}

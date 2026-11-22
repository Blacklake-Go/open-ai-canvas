'use client';

/**
 * 创作类型选择器 — 类 Dreamina 风格。
 *
 * 用户选择生成类型（图像/视频/音乐/工作流），
 * 类型切换后加载该类型的可用模型列表。
 * 工作流类型点击后跳转到已有 /workflow 页面。
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Image, Video, Music, Workflow, Sparkles, Loader2 } from 'lucide-react';

const CREATION_TYPES = [
  { id: 'image', label: '图像', icon: Image },
  { id: 'video', label: '视频', icon: Video },
  { id: 'audio', label: '音乐', icon: Music },
  { id: 'workflow', label: '工作流', icon: Workflow, href: '/workflow' },
];

export default function CreationTypeSelector({ activeType = 'image', onTypeChange, onModelSelect }) {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState(activeType);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchModels = useCallback(async (type) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/app/models/available?type=${type}`);
      const data = await res.json();
      if (res.ok && data.data?.models) {
        setModels(data.data.models);
        // 自动选择推荐模型或第一个
        const recommended = data.data.models.find((m) => m.recommended) || data.data.models[0];
        if (recommended) {
          setSelectedModel(recommended);
          onModelSelect?.(recommended);
        }
      } else {
        setModels([]);
      }
    } catch {
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, [onModelSelect]);

  useEffect(() => {
    if (selectedType && selectedType !== 'workflow') {
      fetchModels(selectedType);
    }
  }, [selectedType, fetchModels]);

  const handleTypeChange = (type) => {
    // 工作流跳转到独立页面
    if (type.href) {
      router.push(type.href);
      return;
    }
    setSelectedType(type.id);
    setSelectedModel(null);
    onTypeChange?.(type.id);
  };

  const handleModelSelect = (model) => {
    setSelectedModel(model);
    onModelSelect?.(model);
  };

  return (
    <div className="space-y-4">
      {/* 类型切换 Tab */}
      <div className="flex flex-wrap gap-2">
        {CREATION_TYPES.map((type) => {
          const Icon = type.icon;
          const isActive = selectedType === type.id;
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => handleTypeChange(type)}
              className={`control-focus flex h-control-md items-center gap-2 rounded-lg border px-4 text-label font-medium transition-[background-color,border-color,color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-press cursor-pointer ${
                isActive
                  ? 'border-line bg-wash-press font-semibold text-ink'
                  : 'border-line-subtle bg-wash text-ink-muted hover:border-line hover:bg-wash-strong hover:text-ink'
              }`}
            >
              <Icon className="size-4" strokeWidth={1.8} />
              {type.label}
            </button>
          );
        })}
      </div>

      {/* 模型选择器 */}
      {selectedType !== 'workflow' && (
        <div className="rounded-card border border-line-subtle bg-surface p-4">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-body-sm text-ink-muted">
              <Loader2 className="mr-2 size-4 animate-spin" strokeWidth={1.8} />
              加载可用模型...
            </div>
          ) : models.length === 0 ? (
            <p className="py-6 text-center text-body-sm text-ink-subtle">暂无可用的{CREATION_TYPES.find((t) => t.id === selectedType)?.label}模型</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {models.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => handleModelSelect(model)}
                  className={`control-focus group relative flex flex-col items-start rounded-lg border p-3.5 text-left transition-[background-color,border-color,color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-press cursor-pointer ${
                    selectedModel?.id === model.id
                      ? 'border-brand-line bg-brand-soft'
                      : 'border-line-subtle bg-wash hover:border-line hover:bg-wash-strong'
                  }`}
                >
                  {model.recommended && (
                    <span className="absolute -top-1.5 right-2 flex items-center gap-1 rounded-full border border-brand-line bg-brand-soft px-2 py-0.5 text-micro font-medium text-brand-text">
                      <Sparkles className="size-2.5" strokeWidth={1.8} />
                      推荐
                    </span>
                  )}
                  <span className="text-label font-semibold text-ink">{model.displayName || model.name}</span>
                  <span className="mt-1 line-clamp-2 text-caption leading-4 text-ink-muted">{model.description || ''}</span>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(model.tags || []).slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-full bg-wash px-2 py-0.5 text-micro text-ink-muted">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2.5 flex items-center gap-1.5 text-caption">
                    {model.quoteRequired === false
                      && Number.isFinite(Number(model.credits))
                      && Number(model.credits) > 0 ? (
                        <>
                          <span className="font-mono font-semibold text-brand-text">{Number(model.credits)}</span>
                          <span className="text-ink-subtle">积分/次</span>
                        </>
                      ) : (
                        <span className="text-ink-muted">生成前确认报价</span>
                      )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

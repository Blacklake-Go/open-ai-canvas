import React from 'react';
import Link from 'next/link';
import NavBadge from './NavBadge';
import NavIcon from './NavIcon';
import { getMegaNavCopy } from '../../config/mega-navigation';

/**
 * 双栏 Mega Menu 浮层内容面板组件 (严格遵循 UI_DESIGN_SYSTEM.md 规范)
 * 
 * @param {Object} props
 * @param {Object} props.category 当前选中的分类数据 (包含 features 和 models)
 * @param {string} props.locale 语言代码 ('zh' | 'en')
 * @param {Function} props.onItemClick 点击条目时的回调
 */
export default function MegaMenuPanel({ category, locale = 'zh', onItemClick }) {
  if (!category) return null;

  const copy = getMegaNavCopy(locale);
  const hasModels = Array.isArray(category.models) && category.models.length > 0;

  return (
    <div className="w-screen max-w-3xl overflow-hidden rounded-xl border border-line bg-overlay text-ink shadow-elevation-3">
      <div className="flex flex-col divide-y divide-line md:flex-row md:divide-x md:divide-y-0">
        
        {/* 左栏：Features (功能与工具) */}
        <div className={`${hasModels ? 'w-full md:w-1/2' : 'w-full'} flex flex-col p-3`}>
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-caption font-bold uppercase tracking-wider text-ink-muted">
              {copy.features}
            </span>
          </div>

          <div className="mt-1 space-y-1 overflow-y-auto max-h-96 pr-1 scrollbar-rail">
            {category.features?.map((feat) => {
              const label = feat.label;
              const desc = feat.description;

              return (
                <Link
                  key={feat.id}
                  href={feat.href}
                  prefetch={false}
                  onClick={(e) => onItemClick?.(e, feat)}
                  className="group flex min-h-10 items-start gap-3 rounded-md p-2.5 transition-none hover:bg-wash-strong"
                >
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-line bg-wash text-ink-muted group-hover:border-line-strong group-hover:bg-wash-strong group-hover:text-ink">
                    <NavIcon name={feat.icon} className="size-4" />
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-body-sm font-semibold text-ink">
                        {label}
                      </span>
                      {feat.badge && <NavBadge badge={feat.badge} />}
                    </div>
                    {desc && (
                      <p className="mt-0.5 truncate text-caption text-ink-subtle group-hover:text-ink-muted">
                        {desc}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* 右栏：Models (模型矩阵) */}
        {hasModels && (
          <div className="w-full md:w-1/2 flex flex-col p-3 bg-wash">
            <div className="flex items-center justify-between px-3 py-1.5">
              <span className="text-caption font-bold uppercase tracking-wider text-ink-muted">
                {copy.models}
              </span>
              <span className="text-micro text-ink-subtle">
                {category.models.length} {copy.modelsReady}
              </span>
            </div>

            <div className="mt-1 space-y-1 overflow-y-auto max-h-96 pr-1 scrollbar-rail">
              {category.models.map((model) => {
                const desc = model.description;

                return (
                  <Link
                    key={model.id}
                    href={model.href}
                    prefetch={false}
                    onClick={(e) => onItemClick?.(e, model, category)}
                    className="group flex min-h-10 items-start gap-3 rounded-md p-2.5 transition-none hover:bg-wash-strong"
                  >
                    <NavIcon isModel className="size-4" />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-body-sm font-semibold text-ink">
                          {model.name}
                        </span>
                        {model.badge && <NavBadge badge={model.badge} />}
                      </div>
                      {desc && (
                        <p className="mt-0.5 line-clamp-1 text-caption text-ink-subtle group-hover:text-ink-muted">
                          {desc}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

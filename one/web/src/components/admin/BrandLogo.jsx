'use client';

import { useState } from 'react';
import { getBrandById, resolveBrand } from '@/lib/modelCenter/brandDictionary.js';

const SIZE_MAP = {
  xs: 'size-3.5',
  sm: 'size-5',
  pill: 'w-[35px] h-[35px]',
  md: 'size-9',
  lg: 'size-12',
};

const TONE_BG_MAP = {
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  brand: 'bg-brand/10 text-brand border-brand/20',
  orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  sky: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  teal: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  neutral: 'bg-white/[0.05] text-ink-muted border-white/[0.1]',
};

/**
 * 品牌官方标识规范化渲染组件 (Brand Logo Component)
 * - 纯矢量 SVG / 高清透明 PNG 无损渲染
 * - 暗黑背景高对比度与光学留白
 * - 支持直接传入 model 对象、brandId、或已解析的 brand 对象
 * - onError 智能自动平滑降级为品牌双字母微标，杜绝页面破图
 */
export default function BrandLogo({
  brand,
  brandId,
  model,
  size = 'md',
  className = '',
  imageClassName = '',
}) {
  const [hasError, setHasError] = useState(false);

  const brandObj =
    brand ||
    (model ? resolveBrand(model) : null) ||
    (brandId ? getBrandById(brandId) : null) || {
      id: 'other',
      name: '其他品牌',
      shortName: '其他',
      iconText: 'AI',
      tone: 'neutral',
      logoUrl: '/assets/brands/other.svg',
    };

  const logoUrl = brandObj.logoUrl || `/assets/brands/${brandObj.id}.svg`;
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;
  const toneClass = TONE_BG_MAP[brandObj.tone] || TONE_BG_MAP.neutral;

  if (hasError || !logoUrl) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center font-mono font-bold select-none border ${sizeClass} ${toneClass} ${className}`}
        title={brandObj.name}
      >
        <span className={size === 'pill' || size === 'md' || size === 'lg' ? 'text-xs leading-none' : 'text-[10px] leading-none'}>
          {brandObj.iconText || brandObj.shortName?.slice(0, 2) || 'AI'}
        </span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden select-none ${sizeClass} ${className}`}
      title={brandObj.name}
    >
      <img
        src={logoUrl}
        alt={brandObj.name || 'Brand Logo'}
        loading="lazy"
        onError={() => setHasError(true)}
        className={`size-full object-contain pointer-events-none transition-transform duration-200 ${imageClassName}`}
      />
    </span>
  );
}

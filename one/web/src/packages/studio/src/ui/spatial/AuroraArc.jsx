'use client';

import React from 'react';

/**
 * AuroraArc — 宏大天际弧形光幕
 * 
 * 创造出超大能量场从屏幕外穿过页面的地平线弧光（Horizon Arc）。
 * 主体尺寸 140vw~160vw，椭圆外凸轮廓 + 边缘色彩遮罩，模拟数字地平线。
 */
export default function AuroraArc({
  variant = 'hero',
  className = '',
}) {
  if (variant === 'minimal') return null;

  const isHero = variant === 'hero';
  const arcOpacity = isHero ? 0.72 : 0.42;

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none overflow-hidden select-none z-[3] ${className}`}
      style={{ opacity: arcOpacity }}
    >
      {/* 1. 主地平线大弧 (Primary Sweeping Aurora Arc - Cyan to Violet) */}
      <div
        className="absolute -bottom-[42vw] left-1/2 -translate-x-1/2 w-[150vw] h-[82vw] rounded-[50%] animate-aurora-arc"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 100%, transparent 64%, rgba(85, 230, 255, 0.42) 74%, rgba(135, 103, 255, 0.35) 86%, rgba(90, 124, 255, 0.12) 94%, transparent 100%)',
          filter: 'blur(36px)',
          transform: 'translate3d(-50%, 0, 0)',
        }}
      />

      {/* 2. 左侧低频反光弧 (Asymmetric Left-side Arc Highlight) */}
      <div
        className="absolute -bottom-[32vw] -left-[20vw] w-[110vw] h-[65vw] rounded-[48%] animate-aurora-drift-a"
        style={{
          background: 'radial-gradient(ellipse 70% 40% at 40% 100%, transparent 66%, rgba(85, 230, 255, 0.38) 78%, rgba(90, 124, 255, 0.15) 90%, transparent 100%)',
          filter: 'blur(28px)',
        }}
      />

      {/* 3. 右侧深紫渐变弧 (Asymmetric Right-side Deep Violet Arc) */}
      <div
        className="absolute -bottom-[38vw] -right-[15vw] w-[120vw] h-[70vw] rounded-[52%] animate-aurora-drift-b"
        style={{
          background: 'radial-gradient(ellipse 75% 45% at 60% 100%, transparent 68%, rgba(135, 103, 255, 0.45) 80%, rgba(217, 131, 255, 0.22) 92%, transparent 100%)',
          filter: 'blur(32px)',
        }}
      />

      {/* 4. 弧线光幕上方向外围柔化遮罩 (Prevents sharp borders at top) */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to top, transparent 0%, rgba(5, 5, 7, 0.6) 65%, #050507 100%)',
          mixBlendMode: 'multiply',
        }}
      />
    </div>
  );
}

'use client';

import React from 'react';

/**
 * NoiseOverlay — 极微胶片颗粒层
 * 
 * 使用内联 SVG 噪点防止超大深色光场在低位宽屏幕上产生阶梯状色彩断层（color banding）。
 * 强度控制在 0.03 左右，肉眼几乎无法分辨单独噪点，但整体空间感更加浑厚饱满。
 */
export default function NoiseOverlay({
  opacity = 0.032,
  className = '',
}) {
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none select-none z-[6] mix-blend-overlay ${className}`}
      style={{
        opacity,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
      }}
    />
  );
}

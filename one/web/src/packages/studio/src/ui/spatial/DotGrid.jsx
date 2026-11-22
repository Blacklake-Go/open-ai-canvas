'use client';

import React from 'react';

/**
 * DotGrid — 极细微空间点阵矩阵
 * 
 * 区别于生硬的方格线，采用 1px 精密发光圆点晶格，形成数字深空与 AI 坐标感。
 * 纯 CSS radial-gradient 渲染，零外部图片请求。
 */
export default function DotGrid({
  size = 24,
  opacity = 0.26,
  className = '',
  fadeMask = true,
}) {
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none select-none z-[1] ${className}`}
      style={{
        backgroundImage: `radial-gradient(circle, rgba(135, 175, 255, ${opacity}) 1.2px, transparent 1.6px)`,
        backgroundSize: `${size}px ${size}px`,
        maskImage: fadeMask
          ? 'radial-gradient(ellipse 90% 85% at 50% 45%, black 40%, rgba(0, 0, 0, 0.4) 75%, transparent 100%)'
          : undefined,
        WebkitMaskImage: fadeMask
          ? 'radial-gradient(ellipse 90% 85% at 50% 45%, black 40%, rgba(0, 0, 0, 0.4) 75%, transparent 100%)'
          : undefined,
      }}
    />
  );
}

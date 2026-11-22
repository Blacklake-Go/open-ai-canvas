'use client';

import React from 'react';

/**
 * AuroraField — 核心多频极光光场
 * 
 * 由 4 组超大独立光晕组合：
 * - Aurora A: Ice Cyan (#55e6ff) — 左下天际线
 * - Aurora B: Electric Violet (#8767ff) — 右下弧光
 * - Aurora C: Soft Indigo (#5a7cff) — 纵深环境光
 * - Aurora D: Subtle Rose (#d983ff) — 边缘高光微光
 * 
 * 尺寸 120vw~160vw，超大高斯泛光，异步非同步慢速位移（18s~28s），具备空气感与呼吸感。
 */
export default function AuroraField({
  variant = 'hero', // 'hero' | 'studio' | 'canvas' | 'minimal'
  simplified = false,
  className = '',
}) {
  const isMinimal = variant === 'minimal';
  const isStudio = variant === 'studio';
  const isCanvas = variant === 'canvas';

  // 基础透明度按场景分层，管理台与工作区更加克制沉静，提供清晰可感知的深空光场
  const baseOpacity = isMinimal
    ? 0.15
    : isCanvas
    ? 0.28
    : isStudio
    ? 0.55
    : 0.65;

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none overflow-hidden select-none z-[2] ${className}`}
      style={{ opacity: baseOpacity }}
    >
      {/* Aurora A: Ice Cyan (左下天际光场) */}
      <div
        className="absolute -bottom-[25vw] -left-[20vw] w-[110vw] h-[85vw] rounded-[48%] animate-aurora-drift-a"
        style={{
          background: 'radial-gradient(ellipse 65% 55% at 45% 60%, rgba(85, 230, 255, 0.42) 0%, rgba(85, 230, 255, 0.15) 40%, rgba(90, 124, 255, 0.04) 70%, transparent 100%)',
          filter: simplified ? 'blur(60px)' : 'blur(120px)',
          transform: 'translate3d(0,0,0)',
        }}
      />

      {/* Aurora B: Electric Violet (右下深空光场) */}
      <div
        className="absolute -bottom-[30vw] -right-[25vw] w-[130vw] h-[95vw] rounded-[52%] animate-aurora-drift-b"
        style={{
          background: 'radial-gradient(ellipse 70% 60% at 55% 55%, rgba(135, 103, 255, 0.46) 0%, rgba(177, 108, 255, 0.18) 45%, rgba(90, 124, 255, 0.05) 75%, transparent 100%)',
          filter: simplified ? 'blur(70px)' : 'blur(140px)',
          transform: 'translate3d(0,0,0)',
        }}
      />

      {/* Aurora C: Soft Indigo (中央底部纵深光场 - 仅在非极简模式下开启) */}
      {!isMinimal && (
        <div
          className="absolute -bottom-[15vw] left-[15vw] w-[90vw] h-[65vw] rounded-full animate-aurora-breathe-c"
          style={{
            background: 'radial-gradient(circle at 50% 60%, rgba(90, 124, 255, 0.28) 0%, rgba(135, 103, 255, 0.12) 50%, transparent 80%)',
            filter: simplified ? 'blur(60px)' : 'blur(110px)',
            transform: 'translate3d(0,0,0)',
          }}
        />
      )}

      {/* Aurora D: Subtle Rose Violet (右侧边缘薄雾高光 - 仅在 hero 与 studio 模式开启) */}
      {!isMinimal && !simplified && !isCanvas && (
        <div
          className="absolute top-[10vw] -right-[15vw] w-[75vw] h-[75vw] rounded-full opacity-60 animate-aurora-drift-a"
          style={{
            background: 'radial-gradient(circle at 60% 40%, rgba(217, 131, 255, 0.24) 0%, rgba(135, 103, 255, 0.08) 55%, transparent 75%)',
            filter: 'blur(130px)',
            transform: 'translate3d(0,0,0)',
          }}
        />
      )}
    </div>
  );
}

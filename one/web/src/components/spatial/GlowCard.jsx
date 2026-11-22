'use client';

import React, { useRef, useState, useCallback } from 'react';

/**
 * GlowCard — 微交互空间高光卡片
 * 
 * 严格恪守克制、高级原则：
 * - 默认态：深色半透明基底，极细 1px 微弱边界，几乎无强阴影
 * - Hover 态：轻微向上微抬 translateY(-2px)，边框微增亮
 * - 鼠标游标光：在鼠标悬浮位置产生极其柔和的局域 Radial Highlight（半径 140px，透明度约 0.08）
 * - 杜绝大面积粗糙霓虹发光与 3D 翻转
 */
export default function GlowCard({
  children,
  className = '',
  glowColor = 'rgba(85, 230, 255, 0.09)',
  borderGlowColor = 'rgba(135, 103, 255, 0.28)',
  onClick,
  ...props
}) {
  const cardRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: -999, y: -999, isHovered: false });

  const handleMouseMove = useCallback((e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      isHovered: true,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setMousePos((prev) => ({ ...prev, isHovered: false }));
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={`group relative rounded-xl border border-white/[0.08] bg-[#0d0e14]/85 backdrop-blur-md overflow-hidden transition-[transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-white/[0.18] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)] ${className}`}
      {...props}
    >
      {/* 鼠标跟随局部微光 (Radial Spotlight Highlight) */}
      {mousePos.isHovered && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
          style={{
            background: `radial-gradient(180px circle at ${mousePos.x}px ${mousePos.y}px, ${glowColor} 0%, transparent 80%)`,
          }}
        />
      )}

      {/* 边缘微高光 (Delicate Top Rim Highlight) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.12] to-transparent opacity-50 group-hover:opacity-100 transition-opacity"
      />

      {/* 内容层 */}
      <div className="relative z-[1]">
        {children}
      </div>
    </div>
  );
}

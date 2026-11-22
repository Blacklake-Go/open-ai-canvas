'use client';

import React, { useEffect, useRef } from 'react';

/**
 * PointerGlow — 桌面端微交互光场
 * 
 * 极轻微跟随鼠标移动的漫反射空间光源：
 * - 强度严格控制在 5%~10%，坚决不做游戏手电筒
 * - 纯 requestAnimationFrame + lerp 惯性平滑插值，零重排（zero reflow），稳定 60FPS
 * - 移动设备与 prefers-reduced-motion 自动降级停用
 */
export default function PointerGlow({
  disabled = false,
  className = '',
}) {
  const glowRef = useRef(null);
  const rafId = useRef(null);
  const coords = useRef({
    currentX: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
    currentY: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
    targetX: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
    targetY: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
  });

  useEffect(() => {
    if (disabled || typeof window === 'undefined') return;

    // 触控设备或开启减少动态效果时直接跳过
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isTouch || prefersReducedMotion) return;

    const el = glowRef.current;
    if (!el) return;

    const handleMouseMove = (e) => {
      coords.current.targetX = e.clientX;
      coords.current.targetY = e.clientY;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    const animate = () => {
      const c = coords.current;
      // 灵敏流畅的阻尼追踪 (lerp factor = 0.12)
      c.currentX += (c.targetX - c.currentX) * 0.12;
      c.currentY += (c.targetY - c.currentY) * 0.12;

      if (el) {
        el.style.transform = `translate3d(${c.currentX - 350}px, ${c.currentY - 350}px, 0)`;
      }

      rafId.current = requestAnimationFrame(animate);
    };

    rafId.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [disabled]);

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none overflow-hidden select-none z-[4] ${className}`}
    >
      <div
        ref={glowRef}
        className="absolute top-0 left-0 w-[700px] h-[700px] rounded-full opacity-60 will-change-transform"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(85, 230, 255, 0.07) 0%, rgba(135, 103, 255, 0.04) 35%, transparent 70%)',
          filter: 'blur(80px)',
          transform: 'translate3d(-9999px, -9999px, 0)',
        }}
      />
    </div>
  );
}

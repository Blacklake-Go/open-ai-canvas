'use client';

import React, { useState, useEffect } from 'react';
import StitchCanvasGrid from './StitchCanvasGrid';
import AuroraVideoLayer from './AuroraVideoLayer';
import AuroraField from './AuroraField';
import AuroraArc from './AuroraArc';
import PointerGlow from './PointerGlow';
import NoiseOverlay from './NoiseOverlay';

/**
 * SpatialBackground — SupDance AI 空间光影视觉系统核心容器 (Stitch 原版高保真升级版)
 * 
 * 7 层原版流体光场与物理仿真引擎：
 * - Layer 0: Obsidian Deep Space (#050507) + Radial Space Vignette
 * - Layer 1: Volumetric Fluid Aurora Video (2304x1440 20s 丝滑流体缎带影片，硬件GPU加速解码)
 * - Layer 2: Interactive Dot Grid Canvas (Stitch 原版 16px Perlin 噪声 + 725px 鼠标高斯斥力位移)
 * - Layer 3: Horizon Fade Overlay (底部渐隐遮罩，平滑融入操作台与卡片)
 * - Layer 4: Ambient Aurora Complementary Field (环境次级微光弥散)
 * - Layer 5: Horizon Aurora Arc (天际超大弧形光幕)
 * - Layer 6: Noise Texture Overlay (抗色阶断层微晶噪点)
 * - Layer 7: Foreground UI (完全由子节点承载，背景所有层严格 pointer-events: none)
 * 
 * @param {'hero' | 'studio' | 'canvas' | 'minimal'} variant 场景模式
 * @param {boolean} showGrid 是否显示点阵
 * @param {boolean} showAurora 是否显示极光视频与光场
 * @param {boolean} showArc 是否显示天际大弧
 * @param {boolean} showPointer 是否开启鼠标微交互光
 * @param {boolean} showNoise 是否显示微噪点
 * @param {boolean} isFixed 是否全屏固定（默认 true）
 * @param {{x: number, y: number}} parallaxOffset 无限画布视口偏移
 */
export default function SpatialBackground({
  variant = 'hero',
  showGrid = true,
  showAurora = true,
  showArc = null,
  showPointer = null,
  showNoise = true,
  isFixed = true,
  parallaxOffset = null,
  className = '',
  children,
}) {
  const [isMobile, setIsMobile] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkViewport = () => {
      setIsMobile(window.innerWidth < 768);
    };
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(motionQuery.matches);

    checkViewport();
    window.addEventListener('resize', checkViewport, { passive: true });
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  const arcEnabled =
    showArc !== null
      ? showArc
      : (variant === 'hero' || variant === 'studio') && !isMobile;

  const pointerEnabled =
    showPointer !== null
      ? showPointer
      : (variant === 'hero' || variant === 'studio') && !isMobile && !isReducedMotion;

  // 无限画布视差平移计算
  const parallaxTransform = parallaxOffset
    ? `translate3d(${parallaxOffset.x * 0.06}px, ${parallaxOffset.y * 0.06}px, 0)`
    : undefined;

  const containerClasses = isFixed
    ? `fixed inset-0 pointer-events-none select-none overflow-hidden ${className}`
    : `relative w-full h-full overflow-hidden ${className}`;

  const isStudio = variant === 'studio';
  const isMinimal = variant === 'minimal';

  return (
    <>
      <div
        aria-hidden="true"
        className={containerClasses}
        style={{
          zIndex: 0,
          backgroundColor: '#050507',
        }}
      >
        {/* Layer 0: Obsidian Deep Space + Subtle Radial Vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 130% 110% at 50% 15%, #080a12 0%, #06070a 45%, #050507 85%)',
          }}
        />

        {/* 可受视差平移控制的光影子容器 */}
        <div
          className="absolute inset-0 pointer-events-none will-change-transform"
          style={{ transform: parallaxTransform }}
        >
          {/* Layer 1: Stitch 原版 3D 丝滑流体极光影片 (硬件 GPU 解码，零 CPU 开销) */}
          {showAurora && !isMinimal && !isReducedMotion && (
            <AuroraVideoLayer
              opacity={isStudio ? 0.85 : 0.95}
              videoSrc="/branding/videos/spatial-aurora.mp4"
              posterSrc="/branding/videos/spatial-aurora-poster.jpg"
            />
          )}

          {/* Layer 2: Stitch 原版动态物理点阵 (16px 网格 + 725px 鼠标物理斥力 + Perlin 噪声) */}
          {showGrid && (
            <StitchCanvasGrid
              opacity={isMinimal ? 0.35 : isStudio ? 0.75 : 0.85}
              dotScale={isMobile ? 0.85 : 1.0}
            />
          )}

          {/* Layer 3: 地平线渐隐遮罩 (使流体光带自然融入操作台与卡片) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-64 bg-gradient-to-b from-transparent to-[#050507]"
          />

          {/* Layer 4: 次级柔和环境微光 (与视频光场形成纵深互补) */}
          {showAurora && isMobile && (
            <AuroraField variant={variant} simplified={true} />
          )}

          {/* Layer 5: 天际大弧光 (Horizon Aurora Arc) */}
          {arcEnabled && !isReducedMotion && (
            <AuroraArc variant={variant} />
          )}

          {/* 桌面端微交互光晕 */}
          {pointerEnabled && <PointerGlow />}

          {/* Layer 6: 微噪点纹理 (抗色彩断层) */}
          {showNoise && (
            <NoiseOverlay opacity={isMobile ? 0.02 : 0.028} />
          )}
        </div>
      </div>

      {/* Layer 7: Foreground UI */}
      {children}
    </>
  );
}

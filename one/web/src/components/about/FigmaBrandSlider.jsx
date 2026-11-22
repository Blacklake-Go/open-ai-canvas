'use client';

import React, { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { localizeStudioPath } from '@/lib/locales';

// 深度融合全域前沿大模型矩阵 (包含官方图标、实时性能指标与路由映射)
export const TOP_MODELS = [
  {
    id: 'flux-pro',
    name: 'FLUX.1 Pro',
    fullName: 'FLUX.1 Pro (Black Forest Labs)',
    shortName: 'FLUX.1',
    provider: 'BFL',
    category: 'image',
    badge: 'State-of-Art',
    iconSrc: '/assets/about/models/flux_exact.png',
    accentColor: '#00f5d4',
    highlight: {
      zh: 'Black Forest Labs · 全球顶尖开源美学质量与精确语义对齐',
      en: 'Black Forest Labs · State-of-the-art visual quality & prompt alignment',
    },
    href: '/studio?tab=image&model=flux-1-pro',
  },
  {
    id: 'wan-video',
    name: 'Wan Video',
    fullName: 'Wan Video Models (阿里万象 2.7)',
    shortName: 'Wan 2.7',
    provider: 'Alibaba',
    category: 'video',
    badge: 'Wan 2.7',
    iconSrc: '/assets/about/models/wan_exact.png',
    accentColor: '#e11d74',
    highlight: {
      zh: '阿里万象 · 物理流体模拟与高动态长运镜连续性',
      en: 'Alibaba Wanx · Physical fluid simulation & temporal coherence',
    },
    href: '/studio?tab=video&model=wan2.7-text-to-video',
  },
  {
    id: 'hailuo-ai',
    name: '海螺AI',
    fullName: '海螺AI (MiniMax 2.3 Pro)',
    shortName: 'Hailuo 2.3',
    provider: 'MiniMax',
    category: 'video',
    badge: '2.3 Pro',
    iconSrc: '/assets/about/models/hailuo_exact.png',
    accentColor: '#38bdf8',
    highlight: {
      zh: 'MiniMax 海螺 · 电影级微表情神态与自然肢体动作叙事',
      en: 'MiniMax Hailuo · Micro-expressions & cinematic body dynamics',
    },
    href: '/studio?tab=video&model=minimax-hailuo-2.3-standard-t2v',
  },
  {
    id: 'sora-video',
    name: 'OpenAI Sora',
    fullName: 'OpenAI Sora Video Engine',
    shortName: 'Sora',
    provider: 'OpenAI',
    category: 'video',
    badge: 'World Sim',
    iconSrc: '/assets/about/models/openai_exact.png',
    accentColor: '#10b981',
    highlight: {
      zh: 'OpenAI · 物理世界常识仿真与超长时空镜头生成',
      en: 'OpenAI · Physical world simulation & continuous cinematic shots',
    },
    href: '/studio?tab=video',
  },
  {
    id: 'kling-ai',
    name: '可灵 Kling',
    fullName: '快手可灵 Kling AI 1.5',
    shortName: 'Kling 1.5',
    provider: 'Kuaishou',
    category: 'video',
    badge: '1.5 Motion',
    iconSrc: '/assets/about/models/kling_exact.png',
    accentColor: '#f59e0b',
    highlight: {
      zh: '快手可灵 · 大幅度动作运镜与复杂动态物理交互',
      en: 'Kuaishou Kling · Dynamic motion control & physical interaction',
    },
    href: '/studio?tab=motion-control',
  },
  {
    id: 'hunyuan-3d',
    name: '腾讯混元 3D',
    fullName: '混元 3D (Tencent Hunyuan)',
    shortName: 'Hunyuan 3D',
    provider: 'Tencent',
    category: '3d',
    badge: '3D Spatial',
    iconSrc: '/assets/about/models/hunyuan_exact.png',
    accentColor: '#c084fc',
    highlight: {
      zh: '腾讯混元 · 工业级神经隐式三维几何重建与拓扑网格',
      en: 'Tencent Hunyuan · Implicit neural 3D mesh reconstruction',
    },
    href: '/studio?tab=video',
  },
  {
    id: 'vidu',
    name: '生数 Vidu',
    fullName: '生数科技 Vidu Q2 / 2.0',
    shortName: 'Vidu Q2',
    provider: 'ShengShu',
    category: 'video',
    badge: 'Q2 Vivid',
    iconSrc: '/assets/about/models/vidu_exact.png',
    accentColor: '#e879f9',
    highlight: {
      zh: '生数科技 · 多视角光影动态一致性与大幅度位移镜头',
      en: 'ShengShu Vidu · Multi-view optical continuity & dynamic displacement',
    },
    href: '/studio?tab=image&model=vidu-q2-text-to-image',
  },
  {
    id: 'veo-3-1',
    name: 'Google Veo',
    fullName: 'Veo 3.1 (Google DeepMind)',
    shortName: 'Veo 3.1',
    provider: 'Google',
    category: 'video',
    badge: 'Cinema 3.1',
    iconSrc: '/assets/about/models/veo_exact.png',
    accentColor: '#34d399',
    highlight: {
      zh: 'Google DeepMind · 电影级精密 6-DOF 运镜轨迹与高动态光影',
      en: 'Google DeepMind · Cinematic 6-DOF camera controls & HDR',
    },
    href: '/studio?tab=video&model=veo3.1-text-to-video',
  },
  {
    id: 'nano-banana',
    name: 'Nano Banana',
    fullName: 'Nano Banana Models (Google DeepMind)',
    shortName: 'Banana Pro',
    provider: 'Google',
    category: 'image',
    badge: '4K Micro',
    iconSrc: '/assets/about/models/banana_exact.png',
    accentColor: '#facc15',
    highlight: {
      zh: 'Google DeepMind · 微距纳米写实光影与超高保真质感',
      en: 'Google DeepMind · Micro-detail optical physics & photorealism',
    },
    href: '/studio?tab=image&model=nano-banana-pro',
  },
  {
    id: 'midjourney',
    name: 'Midjourney',
    fullName: 'Midjourney v6.1 API',
    shortName: 'MJ v6.1',
    provider: 'Midjourney',
    category: 'image',
    badge: 'v6.1 Aesthetic',
    iconSrc: '/assets/about/models/midjourney_exact.png',
    accentColor: '#3772FF',
    highlight: {
      zh: 'Midjourney · 电影级构图、绝美艺术质感与丰富色彩表现力',
      en: 'Midjourney · Cinematic composition, painterly aesthetics & color depth',
    },
    href: '/studio?tab=image',
  },
  {
    id: 'suno-v4',
    name: 'Suno v4',
    fullName: 'Suno v4 (AI Music & Stem Master)',
    shortName: 'Suno v4',
    provider: 'Suno',
    category: 'audio',
    badge: 'v4 Master',
    iconSrc: '/assets/about/models/suno_exact.png',
    accentColor: '#e11d48',
    highlight: {
      zh: 'Suno · 全曲高保真编曲与极富感染力的人声演唱生成',
      en: 'Suno · Full-length audio composition & emotive vocal performance',
    },
    href: '/studio?tab=audio',
  },
  {
    id: 'grok-vision',
    name: 'xAI Grok',
    fullName: 'Grok Vision Models (xAI)',
    shortName: 'Grok',
    provider: 'xAI',
    category: 'video',
    badge: 'World Vision',
    iconSrc: '/assets/about/models/grok_exact.png',
    accentColor: '#f97316',
    highlight: {
      zh: 'xAI Grok · 真实物理定律常识仿真与因果时序推理',
      en: 'xAI Grok · Real physical causality & temporal dynamics',
    },
    href: '/studio?tab=video',
  },
];

export default function FigmaBrandSlider({ locale = 'zh' }) {
  const isChinese = Boolean(locale?.includes("zh"));
  const [selectedModel, setSelectedModel] = useState(TOP_MODELS[0]);
  const [showDetail, setShowDetail] = useState(false);
  const scrollRef = useRef(null);
  const marqueeModels = [...TOP_MODELS, ...TOP_MODELS];

  const stepPrev = () => {
    const currentIndex = TOP_MODELS.findIndex((m) => m.id === selectedModel.id);
    const prevIndex = (currentIndex - 1 + TOP_MODELS.length) % TOP_MODELS.length;
    setSelectedModel(TOP_MODELS[prevIndex]);
    setShowDetail(true);
  };

  const stepNext = () => {
    const currentIndex = TOP_MODELS.findIndex((m) => m.id === selectedModel.id);
    const nextIndex = (currentIndex + 1) % TOP_MODELS.length;
    setSelectedModel(TOP_MODELS[nextIndex]);
    setShowDetail(true);
  };

  const handleSelect = (model) => {
    setSelectedModel(model);
    setShowDetail(true);
  };

  return (
    <div className="w-full max-w-6xl mx-auto my-6 px-2 select-none">
      {/* 模块头部标签 */}
      <div className="flex items-center justify-between mb-3 px-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#00f5d4] animate-pulse" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-white/80">
            {isChinese ? '基础模型矩阵' : 'FOUNDATION MODEL MATRIX'}
          </span>
        </div>
        <div className="text-[11px] font-mono text-white/40 hidden sm:block">
          {isChinese ? '● 12 个工业级引擎全线就绪' : '● 12 Production Engines Ready'}
        </div>
      </div>

      {/* 核心：Figma 级别高保真悬浮毛玻璃胶囊浮岛 (从左向右平滑流动，品牌图标放大) */}
      <div
        className="group relative flex items-center justify-between rounded-full border border-white/10 bg-[#0d1015]/90 p-2 shadow-elevation-4 backdrop-blur-2xl transition-all hover:border-white/20 overflow-hidden"
        style={{
          boxShadow: '0 20px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px -8px rgba(0, 245, 212, 0.12)',
        }}
      >
        {/* 左侧平滑渐隐遮罩 */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#0d1015] to-transparent z-10" />
        {/* 右侧平滑渐隐遮罩 */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#0d1015] to-transparent z-10" />

        {/* 左控制导航 */}
        <button
          type="button"
          onClick={stepPrev}
          aria-label={isChinese ? '上一个模型' : 'Previous model'}
          className="relative z-20 flex w-9 h-9 shrink-0 items-center justify-center rounded-full text-white/60 hover:text-white bg-black/40 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer mr-1"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* 水平滑动模型轨道：从左到右平滑滑动 (animate-marquee-ltr) */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-hidden relative select-none"
        >
          <div
            className="animate-marquee-ltr flex items-center gap-3 py-1 will-change-transform"
            data-paused={showDetail}
          >
            {marqueeModels.map((model, idx) => {
              const isChosen = selectedModel.id === model.id && showDetail;
              return (
                <button
                  key={`${model.id}-${idx}`}
                  type="button"
                  onClick={() => handleSelect(model)}
                  className={cn(
                    'group/item relative flex shrink-0 items-center gap-3 rounded-2xl px-4 py-2.5 transition-all cursor-pointer border',
                    isChosen
                      ? 'bg-white/15 text-white border-white/40 shadow-[0_0_20px_rgba(0,245,212,0.3)] ring-1 ring-[#00f5d4]/50'
                      : 'bg-white/[0.04] text-white/80 border-white/10 hover:bg-white/[0.09] hover:border-white/25 hover:text-white hover:scale-[1.03]'
                  )}
                >
                  {/* 真实官方品牌放大图标 */}
                  <div className="flex w-11 h-11 shrink-0 items-center justify-center rounded-xl p-1 bg-black/60 border border-white/15 shadow-md group-hover/item:scale-110 group-hover/item:border-white/30 transition-transform">
                    <img
                      src={model.iconSrc}
                      alt={model.name}
                      className="w-8 h-8 object-contain"
                      loading="lazy"
                    />
                  </div>

                  <div className="flex flex-col items-start leading-tight text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold tracking-tight text-white group-hover/item:text-[#00f5d4] transition-colors whitespace-nowrap">
                        {model.shortName}
                      </span>
                    </div>
                  </div>

                  {/* 选中高光指示条 */}
                  {isChosen && (
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-1 left-4 right-4 h-[2px] rounded-full bg-[#00f5d4]"
                      style={{
                        boxShadow: '0 0 10px rgba(0, 245, 212, 0.7)',
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 右控制导航 */}
        <button
          type="button"
          onClick={stepNext}
          aria-label={isChinese ? '下一个模型' : 'Next model'}
          className="relative z-20 flex w-9 h-9 shrink-0 items-center justify-center rounded-full text-white/60 hover:text-white bg-black/40 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer ml-1"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 展开的悬浮 HUD 遥测与直达卡片 (Cinematic Telemetry HUD) */}
      {showDetail && selectedModel && (
        <div className="relative mt-4 rounded-2xl border border-white/15 bg-[#131519]/95 p-5 sm:p-6 shadow-elevation-4 backdrop-blur-2xl animate-scale-in">
          <button
            type="button"
            onClick={() => setShowDetail(false)}
            aria-label={isChinese ? '关闭详情' : 'Close detail'}
            className="absolute right-4 top-4 flex w-7 h-7 items-center justify-center rounded-full bg-white/5 text-white/50 hover:bg-white/15 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div className="flex items-start gap-4">
              {/* 官方大图标展示 */}
              <div
                className="flex w-14 h-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#0a0b0d] p-2.5 shadow-lg"
                style={{ borderColor: `${selectedModel.accentColor}30` }}
              >
                <img
                  src={selectedModel.iconSrc}
                  alt={selectedModel.name}
                  className="w-9 h-9 object-contain"
                />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    {selectedModel.fullName}
                  </h3>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-bold border"
                    style={{
                      backgroundColor: `${selectedModel.accentColor}20`,
                      color: selectedModel.accentColor,
                      borderColor: `${selectedModel.accentColor}40`,
                    }}
                  >
                    {selectedModel.badge}
                  </span>
                </div>
                <p className="mt-1 text-xs sm:text-sm text-white/70 max-w-2xl leading-relaxed">
                  {selectedModel.highlight[isChinese ? 'zh' : 'en']}
                </p>
              </div>
            </div>

            {/* 参数指标与一键启动 CTA */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link
                href={localizeStudioPath(selectedModel.href, locale)}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-[#3772FF] hover:bg-[#2e62de] px-5 text-xs sm:text-sm font-semibold text-white transition-all shadow-elevation-2 cursor-pointer hover:scale-[1.02]"
              >
                <span>{isChinese ? '在工作台中启动' : 'Launch Studio'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

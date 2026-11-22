'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, X } from 'lucide-react';

export const MODEL_CATALOG = [
  {
    id: 'wan-video',
    name: 'Wan Video Models',
    fullName: 'Wan Video Models (万象 2.7)',
    shortName: 'Wan 2.7',
    provider: 'Alibaba',
    category: 'video',
    badge: 'Wan 2.7',
    iconType: 'wan',
    iconSrc: '/assets/about/models/wan_exact.png',
    accentColor: '#e11d74',
    highlight: {
      zh: '阿里万象 · 物理流体模拟与高动态长运镜',
      en: 'Alibaba Wanx · Physical fluid simulation & temporal stability',
    },
    specs: {
      resolution: '4K Native',
      fps: '60 FPS',
      latency: '< 420ms',
      modality: 'Text-to-Video / I2V',
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
    iconType: 'hailuo',
    iconSrc: '/assets/about/models/hailuo_exact.png',
    accentColor: '#38bdf8',
    highlight: {
      zh: 'MiniMax 海螺 · 电影级微表情神态与自然肢体叙事',
      en: 'MiniMax Hailuo · Cinematic micro-expressions & narrative depth',
    },
    specs: {
      resolution: '1080p Ultra',
      fps: '30 FPS',
      latency: '< 380ms',
      modality: 'T2V / I2V',
    },
    href: '/studio?tab=video&model=minimax-hailuo-2.3-standard-t2v',
  },
  {
    id: 'hunyuan-3d',
    name: '混元 3D',
    fullName: '混元 3D (Tencent Hunyuan)',
    shortName: 'Hunyuan 3D',
    provider: 'Tencent',
    category: '3d',
    badge: '3D Spatial',
    iconType: 'hunyuan',
    iconSrc: '/assets/about/models/hunyuan_exact.png',
    accentColor: '#c084fc',
    highlight: {
      zh: '腾讯混元 · 工业级神经隐式三维几何重建与拓扑',
      en: 'Tencent Hunyuan · Implicit neural 3D geometric reconstruction',
    },
    specs: {
      resolution: 'Mesh / NeRF',
      fps: 'Realtime',
      latency: '< 850ms',
      modality: 'I2-3D / T2-3D',
    },
    href: '/studio?tab=video&model=hunyuan-text-to-video',
  },
  {
    id: 'vidu',
    name: 'Vidu',
    fullName: '生数科技 Vidu Q2 / 2.0',
    shortName: 'Vidu Q2',
    provider: 'ShengShu',
    category: 'video',
    badge: 'Q2 Vivid',
    iconType: 'vidu',
    iconSrc: '/assets/about/models/vidu_exact.png',
    accentColor: '#e879f9',
    highlight: {
      zh: '生数科技 · 多视角光影动态一致性与大幅度位移',
      en: 'ShengShu Vidu · Multi-view optical continuity & dynamic motion',
    },
    specs: {
      resolution: '2K Cinema',
      fps: '60 FPS',
      latency: '< 360ms',
      modality: 'T2V / T2I',
    },
    href: '/studio?tab=image&model=vidu-q2-text-to-image',
  },
  {
    id: 'grok-video',
    name: 'Grok Video Models',
    fullName: 'Grok Video Models (xAI)',
    shortName: 'Grok Vision',
    provider: 'xAI',
    category: 'video',
    badge: 'World Model',
    iconType: 'grok',
    iconSrc: '/assets/about/models/grok_exact.png',
    accentColor: '#f97316',
    highlight: {
      zh: 'xAI Grok · 真实物理定律常识仿真与因果时序理解',
      en: 'xAI Grok · Physical world simulation & causal reasoning',
    },
    specs: {
      resolution: '1080p HD',
      fps: '30 FPS',
      latency: '< 450ms',
      modality: 'T2V / Vision',
    },
    href: '/studio?tab=video&model=grok-imagine-text-to-video',
  },
  {
    id: 'nano-banana',
    name: 'Nano Banana Models',
    fullName: 'Nano Banana Models (Google DeepMind)',
    shortName: 'Banana Pro',
    provider: 'Google DeepMind',
    category: 'image',
    badge: '4K Micro',
    iconType: 'banana',
    iconSrc: '/assets/about/models/banana_exact.png',
    accentColor: '#facc15',
    highlight: {
      zh: 'Google DeepMind · 微距纳米写实光影与超高保真质感',
      en: 'Google DeepMind · Micro-detail optical physics & photorealism',
    },
    specs: {
      resolution: '4K Ultra',
      fps: 'Static',
      latency: '< 290ms',
      modality: 'T2I / Edit',
    },
    href: '/studio?tab=image&model=nano-banana-pro',
  },
  {
    id: 'veo-3-1',
    name: 'Veo 3.1 Models',
    fullName: 'Veo 3.1 Models (Google DeepMind)',
    shortName: 'Veo 3.1',
    provider: 'Google DeepMind',
    category: 'video',
    badge: 'Cinema 3.1',
    iconType: 'veo',
    iconSrc: '/assets/about/models/veo_exact.png',
    accentColor: '#34d399',
    highlight: {
      zh: 'Google DeepMind · 电影级精密运镜轨迹与高动态范围光影',
      en: 'Google DeepMind · Cinematic 6-DOF camera control & high dynamic range',
    },
    specs: {
      resolution: '4K Cinema',
      fps: '60 FPS',
      latency: '< 480ms',
      modality: 'T2V / I2V',
    },
    href: '/studio?tab=video&model=veo3.1-text-to-video',
  },
  {
    id: 'flux-tools',
    name: 'Flux Image Tools',
    fullName: 'Flux Image Tools (Black Forest Labs)',
    shortName: 'FLUX.2 Klein',
    provider: 'Black Forest Labs',
    category: 'image',
    badge: 'Klein 9B',
    iconType: 'flux',
    iconSrc: '/assets/about/models/flux_exact.png',
    accentColor: '#f43f5e',
    highlight: {
      zh: 'Black Forest Labs · 复杂构图解析、精准文字渲染与解剖结构',
      en: 'Black Forest Labs · Precise text rendering & anatomical realism',
    },
    specs: {
      resolution: '2K Native',
      fps: 'Sub-second',
      latency: '< 260ms',
      modality: 'T2I / Inpaint',
    },
    href: '/studio?tab=image&model=flux-2-klein-4b',
  },
  {
    id: 'kling-3-0',
    name: 'Kling 3.0 Pro',
    fullName: 'Kling 3.0 Pro (快手可灵)',
    shortName: 'Kling 3.0',
    provider: 'Kuaishou',
    category: 'video',
    badge: '3.0 Pro',
    iconType: 'kling',
    iconSrc: '/assets/about/models/kling_exact.png',
    accentColor: '#2dd4bf',
    highlight: {
      zh: '快手可灵 · 大幅度连贯动作运动与自然透视缩放',
      en: 'Kuaishou Kling · Coherent large-scale motion & lens perspective',
    },
    specs: {
      resolution: '1080p Ultra',
      fps: '30 FPS',
      latency: '< 390ms',
      modality: 'T2V / I2V',
    },
    href: '/studio?tab=video&model=kling-v3.0-standard-text-to-video',
  },
  {
    id: 'midjourney-v7',
    name: 'Midjourney v7',
    fullName: 'Midjourney v7 (SOTA Aesthetic)',
    shortName: 'MJ v7',
    provider: 'Midjourney',
    category: 'image',
    badge: 'v7 SOTA',
    iconType: 'midjourney',
    iconSrc: '/assets/about/models/midjourney_exact.png',
    accentColor: '#818cf8',
    highlight: {
      zh: 'Midjourney · 摄影级美学审美、角色一致性锁定与风格参考',
      en: 'Midjourney · Photographic aesthetic & character consistency',
    },
    specs: {
      resolution: '4K Native',
      fps: 'Static',
      latency: '< 310ms',
      modality: 'T2I / Style',
    },
    href: '/studio?tab=image&model=midjourney-v7',
  },
  {
    id: 'openai-sora',
    name: 'OpenAI Sora 2',
    fullName: 'OpenAI Sora 2 / GPT Image 2.5',
    shortName: 'Sora 2',
    provider: 'OpenAI',
    category: 'video',
    badge: 'Sora 2',
    iconType: 'openai',
    iconSrc: '/assets/about/models/openai_exact.png',
    accentColor: '#10b981',
    highlight: {
      zh: 'OpenAI · 物理世界模拟与超长连续时空镜头生成',
      en: 'OpenAI · Physical world simulation & continuous long-shot generation',
    },
    specs: {
      resolution: '1080p Full HD',
      fps: '60 FPS',
      latency: '< 520ms',
      modality: 'T2V / World Sim',
    },
    href: '/studio?tab=video&model=openai-sora-2-text-to-video',
  },
  {
    id: 'suno-v4',
    name: 'Suno v4',
    fullName: 'Suno v4 (AI Music & Stem Master)',
    shortName: 'Suno v4',
    provider: 'Suno',
    category: 'audio',
    badge: 'v4 Master',
    iconType: 'suno',
    iconSrc: '/assets/about/models/suno_exact.png',
    accentColor: '#e11d48',
    highlight: {
      zh: 'Suno · 全曲高保真编曲与极富感染力的人声演唱',
      en: 'Suno · Full-song composition & emotive vocal synthesis',
    },
    specs: {
      resolution: '48kHz / 24-bit',
      fps: 'Lossless Audio',
      latency: '< 380ms',
      modality: 'T2Audio / Voice',
    },
    href: '/studio?tab=audio&model=suno-create-music',
  },
];

export default function ModelEcosystemSlider({ locale = 'zh' }) {
  const isChinese = String(locale).toLowerCase().startsWith('zh');
  const [selectedModel, setSelectedModel] = useState(MODEL_CATALOG[0]);
  const [showDetail, setShowDetail] = useState(false);
  const scrollRef = useRef(null);

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -260, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 260, behavior: 'smooth' });
    }
  };

  const handleSelect = (model) => {
    setSelectedModel(model);
    setShowDetail(true);
  };

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      {/* 视觉稿核心：悬浮式毛玻璃模型胶囊 Dock (Floating Glassmorphism Dock) */}
      <div
        data-pill-segmented="true"
        className="group relative flex items-center justify-between rounded-full border border-white/10 bg-[#0d1015]/85 p-2 shadow-elevation-4 backdrop-blur-2xl transition-all duration-fast hover:border-brand-line/60"
        style={{
          boxShadow: '0 20px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px -8px rgba(34, 211, 238, 0.15)',
        }}
      >
        {/* 左箭头导航 */}
        <button
          type="button"
          onClick={scrollLeft}
          aria-label={isChinese ? '向左查看模型' : 'Scroll left'}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors duration-fast hover:bg-wash-strong hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand"
        >
          <ChevronLeft className="size-4" />
        </button>

        {/* 水平滑动模型轨道 */}
        <div
          ref={scrollRef}
          className="flex flex-1 items-center gap-1.5 overflow-x-auto px-1 scrollbar-none sm:gap-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {MODEL_CATALOG.map((model) => {
            const isChosen = selectedModel.id === model.id;
            return (
              <button
                key={model.id}
                type="button"
                data-pill-segment-item="true"
                onClick={() => handleSelect(model)}
                className={`group/item relative flex shrink-0 items-center gap-2.5 rounded-full px-3.5 py-2 transition-all duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand ${
                  isChosen
                    ? 'bg-wash-strong text-white'
                    : 'text-ink-muted hover:bg-wash hover:text-ink'
                }`}
              >
                {/* 真实官方品牌图标 (Official Brand Logo) */}
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full p-0.5 transition-transform duration-fast group-hover/item:scale-110">
                  <img
                    src={model.iconSrc}
                    alt={model.name}
                    className="size-5 object-contain"
                    loading="lazy"
                  />
                </div>

                <div className="flex flex-col items-start leading-none">
                  <span className="text-body-sm font-semibold tracking-tight text-ink group-hover/item:text-white">
                    {model.name}
                  </span>
                </div>

                {/* 选中高光指示条 */}
                {isChosen && (
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-1 left-3 right-3 h-[2px] rounded-full bg-brand"
                    style={{
                      boxShadow: '0 0 10px rgba(225, 29, 116, 0.45)',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* 右箭头导航 */}
        <button
          type="button"
          onClick={scrollRight}
          aria-label={isChinese ? '向右查看模型' : 'Scroll right'}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors duration-fast hover:bg-wash-strong hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* 展开的悬浮 HUD 遥测与直达卡片 (Interactive HUD Telemetry) */}
      {showDetail && selectedModel && (
        <div className="relative mt-4 animate-scale-in rounded-2xl border border-brand-line/40 bg-surface/95 p-5 shadow-elevation-3 backdrop-blur-xl sm:p-6">
          <button
            type="button"
            onClick={() => setShowDetail(false)}
            aria-label={isChinese ? '关闭详情' : 'Close detail'}
            className="absolute right-4 top-4 flex size-7 items-center justify-center rounded-full bg-wash text-ink-subtle hover:bg-wash-strong hover:text-ink"
          >
            <X className="size-3.5" />
          </button>

          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3.5">
              {/* 官方大图标展示 */}
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-line bg-wash p-2">
                <img
                  src={selectedModel.iconSrc}
                  alt={selectedModel.name}
                  className="size-8 object-contain"
                />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-section-title font-bold text-ink">
                    {selectedModel.fullName}
                  </h3>
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-micro font-medium text-brand">
                    {selectedModel.badge}
                  </span>
                  <span className="inline-flex items-center gap-1 text-micro text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {isChinese ? '就绪' : 'Live'}
                  </span>
                </div>
                <p className="mt-1 text-body-sm text-ink-muted">
                  {selectedModel.highlight[isChinese ? 'zh' : 'en']}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-3 rounded-lg border border-line-subtle bg-well px-3 py-1.5 text-micro font-mono text-ink-subtle">
                <span>{selectedModel.specs.resolution}</span>
                <span>·</span>
                <span>{selectedModel.specs.fps}</span>
                <span>·</span>
                <span className="text-emerald-400">{selectedModel.specs.latency}</span>
              </div>

              <Link
                href={isChinese ? selectedModel.href.replace(/^\/studio/, '/zh/studio') : selectedModel.href}
                className="inline-flex h-control-sm items-center justify-center gap-1.5 rounded-full bg-brand px-4 text-body-sm font-semibold text-ink-on-accent transition-colors duration-fast hover:bg-brand-hover shadow-elevation-1"
              >
                <span>{isChinese ? '在工作台中启动' : 'Launch Studio'}</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

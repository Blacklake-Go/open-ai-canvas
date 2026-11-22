'use client';

import React from 'react';
import { GlowCard } from '@/components/spatial';

const FEATURES = [
  {
    id: 'image-studio',
    title: 'Image Studio · 图像工坊',
    subtitle: '文生图 / 图生图 / 超写真渲染',
    desc: '聚合 Midjourney v6.1、FLUX.1 Pro 与 Stable Diffusion 3.5。支持超高精度手部与面部毛孔细节、智能提示词补全与多风格自由切换。',
    badge: '旗舰生图',
    badgeColor: 'bg-brand-soft text-brand border-brand-line',
    link: '/studio/image',
    buttonText: '进入生图工坊',
    stats: '200+ 顶尖模型支持',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2" />
        <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="2" />
        <polyline points="21 15 16 10 5 21" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: 'video-studio',
    title: 'Video Studio · 视界工坊',
    subtitle: '图生视频 / 运镜控制 / 4K 动态',
    desc: '让静态大作一键化身电影级分镜。搭载 Google Veo 3.1、快手可灵 1.5 HD 与字节 Seedance 2.5，精准掌控推拉摇移、首尾帧与角色一致性。',
    badge: '电影级动态',
    badgeColor: 'bg-info-soft text-info border-info-line',
    link: '/studio/video',
    buttonText: '进入视频工坊',
    stats: '支持 4K 极清运镜',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <polygon points="23 7 16 12 23 17 23 7" strokeWidth="2" />
        <rect x="1" y="5" width="15" height="14" rx="2" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: 'layers-studio',
    title: 'Layers Studio · 图层工坊',
    subtitle: '局部重绘 / 画幅拓展 / 消除笔',
    desc: '无损分层编辑画布。支持指定区域精准 Inpaint 局部重绘、Outpaint 无限扩展画幅边界、一键扣图去除杂物与智能高清放大（Upscale）。',
    badge: '精准精修',
    badgeColor: 'bg-warning-soft text-warning border-warning-line',
    link: '/studio/layers',
    buttonText: '进入图层工坊',
    stats: '毫秒级无损重绘',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <polygon points="12 2 2 7 12 12 22 7 12 2" strokeWidth="2" />
        <polyline points="2 17 12 22 22 17" strokeWidth="2" />
        <polyline points="2 12 12 17 22 12" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: 'workflow-studio',
    title: 'Vibe Workflow · 节点工坊',
    subtitle: 'ComfyUI 架构 / 可视化连线',
    desc: '专为高级创作者打造的无限连线工作台。拖拽节点串联文生图、脸部修复、画质增强与批量导出，将创意管线自动化提速 10 倍。',
    badge: '自动化管线',
    badgeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    link: '/studio/workflows',
    buttonText: '开启工作流',
    stats: 'ComfyUI 完全兼容',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth="2" />
        <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth="2" />
        <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth="2" />
        <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth="2" />
        <path d="M10 6.5h4m-7 3.5v4m14-4v4m-7 3.5h4" strokeWidth="1.5" />
      </svg>
    ),
  },
];

export default function StudioFeatureGrid() {
  return (
    <section className="py-20 max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8">
      {/* 区域标题 */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
        <div>
          <span className="text-brand font-mono text-xs font-semibold tracking-wider uppercase">
            STUDIO CREATIVE SUITE
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-ink mt-1.5 tracking-tight">
            全模态生图工作台 · 为极致灵感而生
          </h2>
        </div>
        <p className="text-sm text-ink-muted max-w-md mt-3 md:mt-0">
          深度整合首页核心工坊，从灵感迸发、超清成图到分层精修与动画化，一站式无缝流转。
        </p>
      </div>

      {/* 4 大核心工坊卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {FEATURES.map((item) => (
          <GlowCard
            key={item.id}
            className="p-6 flex flex-col justify-between"
          >
            <div>
              {/* 顶部图标与 Badge */}
              <div className="flex items-center justify-between mb-5">
                <div className="w-12 h-12 rounded-xl bg-wash border border-line flex items-center justify-center text-brand group-hover:scale-110 group-hover:text-brand-hover transition-all shadow-inner">
                  {item.icon}
                </div>
                <span className={`px-2 py-0.5 rounded text-micro font-mono border ${item.badgeColor}`}>
                  {item.badge}
                </span>
              </div>

              {/* 标题与描述 */}
              <h3 className="text-lg font-bold text-ink mb-1 group-hover:text-brand-hover transition-colors">
                {item.title}
              </h3>
              <p className="text-xs text-ink-muted font-mono mb-3">{item.subtitle}</p>
              <p className="text-xs text-ink-muted leading-relaxed">{item.desc}</p>
            </div>

            {/* 底部跳转与指标 */}
            <div className="pt-6 mt-6 border-t border-line-subtle flex items-center justify-between">
              <span className="text-[11px] font-mono text-ink-subtle">{item.stats}</span>
              <a
                href={item.link}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-hover transition-colors group-hover:translate-x-0.5"
              >
                <span>{item.buttonText}</span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </GlowCard>
        ))}
      </div>
    </section>
  );
}

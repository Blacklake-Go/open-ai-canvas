'use client';

import React from 'react';
import { GlowCard } from '@/components/spatial';

const COMMUNITY_ARTWORKS = [
  {
    id: 1,
    title: '赛博霓虹少女 · 8K光影',
    model: 'FLUX.1 [pro]',
    author: 'CyberArtist_99',
    likes: '2.4k',
    prompt: '超精细未来机械少女面部特写，发丝被霓虹蓝紫光线打亮，微距景深，光追反光',
    imageUrl: '/assets/cinema/full_frame_cine_digital.webp',
    ratio: 'aspect-[3/4]',
  },
  {
    id: 2,
    title: '未来星际航行者',
    model: 'Midjourney v6.1',
    author: 'AeroCosmos',
    likes: '1.8k',
    prompt: '浩瀚星云背景中的巨型探索飞船，金色星尘与离子尾焰，哈苏电影画质',
    imageUrl: '/assets/cinema/modular_8k_digital.webp',
    ratio: 'aspect-[16/9]',
  },
  {
    id: 3,
    title: '水墨山海神兽',
    model: '通义万相 2.1',
    author: 'OrientalInk',
    likes: '3.1k',
    prompt: '传统青绿山水意境，白泽神兽傲立悬崖，晨雾缭绕，金色朝霞穿透流云',
    imageUrl: '/assets/cinema/classic_16mm_film.webp',
    ratio: 'aspect-[4/5]',
  },
  {
    id: 4,
    title: '微缩魔法植物温室',
    model: 'SD 3.5 Large',
    author: 'BotanicalAI',
    likes: '940',
    prompt: '透明玻璃球中的微缩夜光森林，发光蘑菇与露珠折射，超清微距摄影',
    imageUrl: '/assets/cinema/creative_tilt_lens.webp',
    ratio: 'aspect-[1/1]',
  },
  {
    id: 5,
    title: '电影级机械机甲分镜',
    model: 'Google Veo 3.1',
    author: 'MechaDirector',
    likes: '4.2k',
    prompt: '重型机甲雨中待命，蒸汽从排气孔喷薄而出，红外扫描镜头缓缓转动',
    imageUrl: '/assets/cinema/grand_format_70mm_film.webp',
    ratio: 'aspect-[16/9]',
  },
  {
    id: 6,
    title: '巴洛克古典油画肖像',
    model: 'FLUX.1 [pro]',
    author: 'ClassicalRevive',
    likes: '1.5k',
    prompt: '伦勃朗光线肖像，华丽金线刺绣天鹅绒长袍，厚涂油画肌理质感',
    imageUrl: '/assets/cinema/swirl_bokeh_portrait.webp',
    ratio: 'aspect-[3/4]',
  },
];

export default function CreativeGallery() {
  return (
    <section className="py-20 max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8">
      {/* 标题 */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
        <div>
          <span className="text-brand font-mono text-xs font-semibold tracking-wider uppercase">
            COMMUNITY SHOWCASE & REMIX
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-ink mt-1.5 tracking-tight">
            全球创作者灵感广场 · 一键同款创作
          </h2>
        </div>
        <a
          href="/community"
          className="text-xs font-semibold text-brand hover:text-brand-hover flex items-center gap-1 mt-3 md:mt-0"
        >
          <span>进入社区探索 100,000+ 热门作品</span>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>

      {/* 瀑布流/网格布局 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {COMMUNITY_ARTWORKS.map((art) => (
          <GlowCard
            key={art.id}
            className="flex flex-col"
          >
            {/* 画面容器 */}
            <div className={`relative w-full ${art.ratio} overflow-hidden bg-canvas`}>
              <img
                src={art.imageUrl}
                alt={art.title}
                className="w-full h-full object-cover transition-transform duration-page group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-canvas via-transparent to-black/30 opacity-80 group-hover:opacity-90 transition-opacity" />

              {/* 顶部标签 */}
              <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between pointer-events-none">
                <span className="px-2 py-0.5 rounded bg-scrim backdrop-blur-md text-micro font-mono text-brand-hover border border-line">
                  {art.model}
                </span>
                <span className="px-2 py-0.5 rounded bg-scrim backdrop-blur-md text-micro font-mono text-ink flex items-center gap-1 border border-line">
                  ❤️ {art.likes}
                </span>
              </div>

              {/* 悬浮一键 Remix 按钮 */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-scrim opacity-0 backdrop-blur-xs transition-opacity duration-page group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 max-sm:pointer-events-auto max-sm:opacity-100">
                <a
                  href="/studio"
                  className="px-5 py-2.5 rounded-xl bg-brand-active hover:bg-brand text-ink-inverse font-bold text-xs shadow-elevation-3 shadow-brand-line transition-all hover:scale-105 btn-spatial-glow flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Remix 同款提示词</span>
                </a>
              </div>
            </div>

            {/* 底部信息 */}
            <div className="p-4 bg-base flex items-center justify-between border-t border-line-subtle">
              <div>
                <h4 className="text-sm font-bold text-ink group-hover:text-brand-hover transition-colors">
                  {art.title}
                </h4>
                <p className="text-[11px] text-ink-subtle font-mono mt-0.5">by @{art.author}</p>
              </div>
              <a
                href="/studio"
                className="text-xs text-ink-muted group-hover:text-brand transition-colors flex items-center gap-0.5 font-medium"
              >
                <span>创作</span>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

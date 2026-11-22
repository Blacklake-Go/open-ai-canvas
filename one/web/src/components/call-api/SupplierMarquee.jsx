'use client';

import React from 'react';

// 专为 AI 生图与视觉创作打造的全球顶尖模型引擎
const ROW1_IMAGE_MODELS = [
  {
    id: 'midjourney',
    name: 'Midjourney',
    badge: 'v6.1 Omni',
    badgeColor: 'bg-brand-pressed text-brand-hover border-brand-line',
    desc: '艺术质感与大师级光影构图',
    tag: '顶级生图',
    logo: (
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-brand">
        <path d="M12 2L2 19.5h20L12 2zm0 4.2L18.6 17H5.4L12 6.2z" />
      </svg>
    ),
  },
  {
    id: 'flux',
    name: 'FLUX.1 [pro]',
    badge: '1.1 Ultra',
    badgeColor: 'bg-warning-soft text-warning border-warning-line',
    desc: '超写实人像与文字精准排版',
    tag: '超写真画质',
    logo: (
      <span className="font-black text-warning font-sans text-xs tracking-tighter">FLUX</span>
    ),
  },
  {
    id: 'stablediffusion',
    name: 'Stable Diffusion',
    badge: 'SD 3.5 Large',
    badgeColor: 'bg-success-soft text-success border-success-line',
    desc: '高度可控与丰富 LoRA 风格融合',
    tag: '开源旗舰',
    logo: (
      <span className="font-black text-success font-sans text-[11px] tracking-tight">SD3.5</span>
    ),
  },
  {
    id: 'dalle',
    name: 'OpenAI DALL·E',
    badge: 'DALL·E 3',
    badgeColor: 'bg-info-soft text-info border-info-line',
    desc: '极致自然语言语义与创意构图理解',
    tag: '智能联想',
    logo: (
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-info">
        <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1683a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4947z" />
      </svg>
    ),
  },
  {
    id: 'qwen',
    name: '通义万相 Qwen',
    badge: 'Wanxiang 2.1',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    desc: '东方美学意境与电商商业视觉',
    tag: '国风与设计',
    logo: (
      <span className="font-black text-purple-400 font-sans text-[11px] tracking-tight">QWEN</span>
    ),
  },
  {
    id: 'google-imagen',
    name: 'Google Imagen',
    badge: 'Imagen 3',
    badgeColor: 'bg-danger-hover text-danger border-danger-line',
    desc: '丰富微观纹理与细腻光泽材质',
    tag: '超高分辨率',
    logo: (
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-ink">
        <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
      </svg>
    ),
  },
];

const ROW2_VIDEO_MODELS = [
  {
    id: 'veo',
    name: 'Google Veo',
    badge: 'Veo 3.1 4K',
    badgeColor: 'bg-info-soft text-info border-info-line',
    desc: '电影级动态与多镜头摄影连贯性',
    tag: '旗舰视频',
    logo: (
      <span className="font-black text-info font-sans text-xs tracking-tight">VEO</span>
    ),
  },
  {
    id: 'kling',
    name: '快手可灵 Kling',
    badge: 'v1.5 HD',
    badgeColor: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    desc: '高拟真物理运动与图生视频运镜',
    tag: '真实物理',
    logo: (
      <span className="font-black text-violet-400 font-sans text-[11px] tracking-tight">KLING</span>
    ),
  },
  {
    id: 'seedance',
    name: '字节跳动 Seedance',
    badge: 'v2.5 Global',
    badgeColor: 'bg-brand-pressed text-brand-hover border-brand-line',
    desc: '角色面部动作一致性与多镜头衔接',
    tag: '角色一致性',
    logo: (
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-brand">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-4h2v4zm0-6H9V8h2v2zm4 6h-2V8h2v8z" />
      </svg>
    ),
  },
  {
    id: 'hailuo',
    name: 'MiniMax 海螺',
    badge: 'Video 01',
    badgeColor: 'bg-success-soft text-success border-success-line',
    desc: '长镜头连贯叙事与自然肢体动态',
    tag: '长镜头叙事',
    logo: (
      <span className="font-black text-success font-sans text-micro tracking-tight">HAILUO</span>
    ),
  },
  {
    id: 'runway',
    name: 'Runway',
    badge: 'Gen-3 Alpha',
    badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    desc: '精细化摄像机运镜轨迹与动作画笔',
    tag: '镜头运动控制',
    logo: (
      <span className="font-black text-pink-400 font-sans text-xs tracking-tight">RW</span>
    ),
  },
  {
    id: 'sora',
    name: 'OpenAI Sora',
    badge: 'Turbo Preview',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    desc: '世界模拟器级的复杂场景三维理解',
    tag: '世界模拟',
    logo: (
      <span className="font-black text-purple-400 font-sans text-[11px] tracking-tight">SORA</span>
    ),
  },
];

export default function SupplierMarquee() {
  return (
    <section className="relative py-16 border-y border-line-subtle bg-canvas/70 overflow-hidden select-none">
      {/* 头部标题指引 */}
      <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 mb-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-soft border border-brand-soft text-[11px] font-mono text-brand mb-2">
          <span>POWERED BY WORLD-CLASS GENERATIVE ENGINES</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">
          聚合全球顶尖生图与视觉引擎 · 在同一画布中自由调度
        </h2>
        <p className="text-xs sm:text-sm text-ink-muted mt-2 max-w-xl mx-auto">
          无需在不同平台间反复切换或配置繁复环境，从写实摄影、动漫二次元到 4K 电影分镜，任由你的想象力驰骋。
        </p>
      </div>

      <style>{`
        @keyframes marqueeLeft {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        @keyframes marqueeRight {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0%); }
        }
        .marquee-left-track {
          animation: marqueeLeft 42s linear infinite;
        }
        .marquee-right-track {
          animation: marqueeRight 48s linear infinite;
        }
        .marquee-wrap:hover .marquee-left-track,
        .marquee-wrap:hover .marquee-right-track {
          animation-play-state: paused;
        }
        .marquee-mask {
          mask-image: linear-gradient(to right, transparent, #000 10%, #000 90%, transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, #000 10%, #000 90%, transparent);
        }
      `}</style>

      {/* 第一排向左平滑滑动：顶尖生图引擎 */}
      <div className="marquee-wrap marquee-mask relative w-full overflow-hidden mb-5">
        <div className="marquee-left-track flex gap-5 w-max">
          {[...ROW1_IMAGE_MODELS, ...ROW1_IMAGE_MODELS].map((item, idx) => (
            <div
              key={`row1-${item.id}-${idx}`}
              className="flex items-center gap-3.5 px-6 py-4 rounded-xl bg-surface/80 backdrop-blur-md border border-line hover:border-brand-ring hover:bg-raised transition-all cursor-pointer group shadow-elevation-2 hover:shadow-brand-soft hover:-translate-y-0.5"
            >
              <div className="w-9 h-9 rounded-lg bg-surface border border-line flex items-center justify-center p-1.5 shadow-inner">
                {item.logo}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-ink tracking-tight group-hover:text-brand-hover transition-colors">
                    {item.name}
                  </span>
                  <span className={`px-1.5 py-0.2 text-micro rounded font-mono border ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                  <span className="text-micro px-1.5 py-0.2 rounded bg-wash text-ink-muted font-sans border border-line-subtle">
                    {item.tag}
                  </span>
                </div>
                <span className="text-xs text-ink-muted mt-0.5">{item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 第二排反向/向右平滑滑动：电影级视频与动态引擎 */}
      <div className="marquee-wrap marquee-mask relative w-full overflow-hidden">
        <div className="marquee-right-track flex gap-5 w-max">
          {[...ROW2_VIDEO_MODELS, ...ROW2_VIDEO_MODELS].map((item, idx) => (
            <div
              key={`row2-${item.id}-${idx}`}
              className="flex items-center gap-3.5 px-6 py-4 rounded-xl bg-surface/80 backdrop-blur-md border border-line hover:border-violet-400/50 hover:bg-raised transition-all cursor-pointer group shadow-elevation-2 hover:shadow-violet-500/10 hover:-translate-y-0.5"
            >
              <div className="w-9 h-9 rounded-lg bg-surface border border-line flex items-center justify-center p-1.5 shadow-inner">
                {item.logo}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-ink tracking-tight group-hover:text-violet-300 transition-colors">
                    {item.name}
                  </span>
                  <span className={`px-1.5 py-0.2 text-micro rounded font-mono border ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                  <span className="text-micro px-1.5 py-0.2 rounded bg-wash text-ink-muted font-sans border border-line-subtle">
                    {item.tag}
                  </span>
                </div>
                <span className="text-xs text-ink-muted mt-0.5">{item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

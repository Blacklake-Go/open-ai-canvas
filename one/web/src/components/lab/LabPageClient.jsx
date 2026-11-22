'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Box,
  Camera,
  Film,
  FlaskConical,
  LayoutGrid,
  Map,
  Maximize2,
  Scissors,
  Smile,
  Sparkles,
  User,
} from 'lucide-react';
import StudioHeader from '@/components/site/StudioHeader';

const BASIC_TOOLS = [
  {
    id: 'outpaint',
    title: '扩图',
    description: '扩展画幅并补全场景，保持主体、材质与光线一致。',
    href: '/zh/canvas-tools/outpaint',
    icon: Maximize2,
  },
  {
    id: 'upscale',
    title: '智能超清',
    description: '2K / 4K 提升清晰度，补全边缘与纹理细节。',
    href: '/zh/canvas-tools/upscale',
    icon: Sparkles,
  },
  {
    id: 'cutout',
    title: '抠图',
    description: '自动识别主体并替换为纯白背景，适合后续合成。',
    href: '/zh/canvas-tools/cutout',
    icon: Scissors,
  },
  {
    id: 'multi-angle',
    title: '多角度',
    description: '调整水平、俯仰与景别，重绘同一画面。',
    href: '/zh/canvas-tools/multi-angle',
    icon: Camera,
  },
];

const STORY_TOOLS = [
  {
    id: 'character',
    title: '人物三视图',
    description: '正面 / 侧面 / 背面全身设定，保持造型与服装一致。',
    href: '/zh/canvas-tools/three-view/character',
    icon: User,
    badge: 'HOT',
  },
  {
    id: 'face',
    title: '面部三视图',
    description: '五官、发型与妆容在多个角度下保持一致。',
    href: '/zh/canvas-tools/three-view/face',
    icon: Smile,
    badge: 'NEW',
  },
  {
    id: 'product',
    title: '产品三视图',
    description: '产品正面、侧面与背面展示，材质与细节统一。',
    href: '/zh/canvas-tools/three-view/product',
    icon: Box,
  },
  {
    id: 'scene-top-view',
    title: '场景俯视图',
    description: '正上方俯视重建场景平面布局与物体关系。',
    href: '/zh/canvas-tools/three-view/scene-top-view',
    icon: Map,
  },
  {
    id: 'storyboard',
    title: '连续分镜图',
    description: '横向三格连续动作分镜，保持角色与场景一致。',
    href: '/zh/canvas-tools/three-view/storyboard',
    icon: Film,
  },
  {
    id: 'nine-grid',
    title: '多机位九宫格',
    description: '3×3 九机位同一主体，覆盖多种角度与景别。',
    href: '/zh/canvas-tools/three-view/nine-grid',
    icon: LayoutGrid,
    badge: 'NEW',
  },
];

function ToolCard({ tool }) {
  const Icon = tool.icon;

  return (
    <Link
      href={tool.href}
      prefetch={false}
      className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-5 transition-colors duration-fast hover:border-line-strong hover:bg-wash"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl border border-line bg-wash text-brand transition-colors duration-fast group-hover:border-line-strong group-hover:bg-wash-strong">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        {tool.badge ? (
          <span className="rounded-full border border-brand-line bg-brand-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
            {tool.badge}
          </span>
        ) : null}
      </div>
      <h3 className="mt-4 text-lg font-bold text-ink">{tool.title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{tool.description}</p>
      <span className="mt-auto inline-flex items-center gap-1 pt-5 text-xs font-semibold text-brand">
        进入工具
        <ArrowRight className="size-3.5 transition-transform duration-fast group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}

function ToolSection({ index, title, caption, tools }) {
  return (
    <section className="mt-12">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-ink-subtle">{index}</div>
          <h2 className="mt-1 text-2xl font-bold text-ink">{title}</h2>
          <p className="mt-1 text-sm text-ink-muted">{caption}</p>
        </div>
        <span className="shrink-0 text-xs font-mono text-ink-subtle">{tools.length} 个工具</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </section>
  );
}

export default function LabPageClient() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-canvas font-sans text-ink selection:bg-brand/30">
      <StudioHeader locale="zh" className="relative z-40" />

      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[420px] w-[1000px] -translate-x-1/2 rounded-full bg-gradient-to-b from-brand/10 via-brand/5 to-transparent blur-[140px]" />
      </div>

      <main className="relative z-10 mx-auto max-w-[1440px] px-4 pb-24 pt-8 sm:px-6 lg:px-12">
        <section className="relative overflow-hidden rounded-3xl border border-line bg-surface px-6 py-10 sm:px-10 sm:py-12">
          <div className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full bg-brand/10 blur-3xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-brand-soft px-3 py-1 text-xs font-mono text-brand">
              <FlaskConical className="size-3.5" aria-hidden="true" />
              SupDance Lab
            </span>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-4xl lg:text-5xl">
              短剧工作坊
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-[16px]">
              从角色设定、场景与分镜，到多角度与成片前的画面处理。选择一个单项工具直接开始，也可以进入完整画布工具连续处理。
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/zh/canvas-tools"
                prefetch={false}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-ink-inverse transition-opacity hover:opacity-90"
              >
                打开完整画布工具
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href="/zh"
                prefetch={false}
                className="inline-flex items-center justify-center rounded-xl border border-line bg-wash px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-line-strong hover:bg-wash-strong"
              >
                返回首页
              </Link>
            </div>
          </div>
        </section>

        <ToolSection
          index="01 / EDIT"
          title="基础编辑"
          caption="单张画面的扩图、清晰度、抠图与机位调整。"
          tools={BASIC_TOOLS}
        />
        <ToolSection
          index="02 / STORYBOARD"
          title="分镜与三视图"
          caption="角色、产品、场景设定与连续分镜的快速拆分。"
          tools={STORY_TOOLS}
        />

        <div className="mt-14 flex flex-col justify-between gap-5 rounded-2xl border border-line bg-surface p-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-ink">需要一次完成整套流程？</h2>
            <p className="mt-1 text-sm text-ink-muted">
              在完整画布工具中切换扩图、超清、抠图、三视图与多角度，无需重复上传。
            </p>
          </div>
          <Link
            href="/zh/canvas-tools"
            prefetch={false}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-line bg-wash px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-line-strong hover:bg-wash-strong"
          >
            进入完整画布
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-ink-subtle">
          所有工具由 Seedream 4.5 承接。每次生成会消耗积分，实际价格以工具页报价为准。
        </p>
      </main>
    </div>
  );
}

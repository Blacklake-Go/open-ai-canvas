'use client';

import React, { useState } from 'react';

export default function PremiumFooter() {
  const [currentLocale, setCurrentLocale] = useState('en');

  return (
    <footer className="relative mt-auto border-t border-line bg-canvas pt-20 pb-12 overflow-hidden select-none">
      {/* 底部环境氛围光晕 */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[900px] h-[320px] bg-gradient-to-t from-brand-soft via-violet-600/5 to-transparent blur-[140px] pointer-events-none" />

      <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* 1. 顶层 CTA 预热发光横幅：直通生图平台 */}
        <div className="relative rounded-3xl p-8 sm:p-12 mb-16 overflow-hidden border border-line bg-gradient-to-r from-brand-line via-neutral-900/60 to-violet-950/40 backdrop-blur-2xl">
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-brand-pressed rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="max-w-xl text-center md:text-left">
              <h3 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
                开启你的 AI 艺术创作之旅
              </h3>
              <p className="text-sm text-ink-muted mt-2">
                加入全球 80,000+ 概念设计师、插画师与视觉创作者。新用户注册即赠 1,000 算力点数，立即在 Studio 中挥洒无限创意。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="/studio"
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-brand-active to-blue-600 hover:from-brand hover:to-blue-500 text-ink font-bold text-xs tracking-wide shadow-elevation-2 shadow-brand-line transition-all hover:-translate-y-0.5 flex items-center gap-1.5"
              >
                <span>立即进入 Studio 创作</span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </a>
              <a
                href="/pricing"
                className="px-6 py-3 rounded-xl bg-wash-strong hover:bg-wash-press text-ink font-semibold text-xs border border-line transition-all hover:-translate-y-0.5"
              >
                升级创作者会员
              </a>
            </div>
          </div>
        </div>

        {/* 2. 核心 5 列矩阵布局：深度呼应生图平台功能 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-16 border-b border-line">
          
          {/* 第 1 列：品牌愿景与 GPU 渲染集群状态 (占据 4 列) */}
          <div className="lg:col-span-4 space-y-5">
            <a href="/studio" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-active to-violet-600 p-[1px] shadow-elevation-2 shadow-brand-soft">
                <div className="w-full h-full bg-canvas rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="2" />
                    <polyline points="21 15 16 10 5 21" strokeWidth="2" />
                  </svg>
                </div>
              </div>
              <span className="font-bold text-xl text-ink tracking-tight">SupDance AI Studio</span>
            </a>
            
            <p className="text-xs text-ink-muted leading-relaxed pr-6">
              下一代旗舰级生成式 AI 视觉创作平台。聚合全球顶尖文生图与视频模型，以统一的高精度画布与分层编辑能力，赋能数字艺术与商业设计全流程。
            </p>

            {/* 动态 GPU 渲染集群健康状态微件 */}
            <div className="inline-flex flex-col gap-2 p-3 rounded-xl bg-wash border border-line">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
                </span>
                <span className="text-xs font-semibold text-success">GPU 渲染集群运转正常 (All Clusters Operational)</span>
              </div>
              <div className="flex items-center gap-4 text-micro font-mono text-ink-subtle pl-4.5">
                <span>平均生成耗时: <strong className="text-ink">3.2s</strong></span>
                <span>今日已渲染: <strong className="text-ink">1,480,200+ 张</strong></span>
              </div>
            </div>

            {/* 画质与商用认证徽标 */}
            <div className="flex items-center gap-3 pt-2 text-micro text-ink-subtle font-mono">
              <span className="px-2 py-0.5 rounded border border-line-subtle bg-wash">4K Ultra-HD</span>
              <span className="px-2 py-0.5 rounded border border-line-subtle bg-wash">Commercial License</span>
              <span className="px-2 py-0.5 rounded border border-line-subtle bg-wash">LoRA Supported</span>
            </div>
          </div>

          {/* 第 2 列：核心创作工坊 (Studio Suite) */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-wider text-ink font-semibold">创作工坊</h4>
            <ul className="space-y-2.5 text-xs text-ink-muted">
              <li><a href="/studio/image" className="hover:text-brand transition-colors">图像生成工坊 (Image)</a></li>
              <li><a href="/studio/video" className="hover:text-brand transition-colors">视频生成工坊 (Video)</a></li>
              <li><a href="/studio/layers" className="hover:text-brand transition-colors">图层精修工坊 (Layers)</a></li>
              <li><a href="/studio/headshot" className="hover:text-brand transition-colors">AI 肖像写真 (Headshot)</a></li>
              <li><a href="/studio/workflows" className="hover:text-brand transition-colors">节点工作流 (Workflow)</a></li>
              <li><a href="/studio/marketing" className="hover:text-brand transition-colors">营销海报设计 (Design)</a></li>
            </ul>
          </div>

          {/* 第 3 列：生图模型引擎 (Generative Models) */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-wider text-ink font-semibold">顶尖模型支持</h4>
            <ul className="space-y-2.5 text-xs text-ink-muted">
              <li><a href="/studio" className="hover:text-brand transition-colors">FLUX.1 [pro] 1.1</a></li>
              <li><a href="/studio" className="hover:text-brand transition-colors">Midjourney v6.1 Omni</a></li>
              <li><a href="/studio" className="hover:text-brand transition-colors">Stable Diffusion 3.5 Large</a></li>
              <li><a href="/studio" className="hover:text-brand transition-colors">Google Veo 3.1 & Imagen 3</a></li>
              <li><a href="/studio" className="hover:text-brand transition-colors">快手可灵 Kling 1.5 HD</a></li>
              <li><a href="/studio" className="hover:text-brand transition-colors">字节跳动 Seedance 2.5</a></li>
            </ul>
          </div>

          {/* 第 4 列：创作者社区与灵感 (Community) */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-wider text-ink font-semibold">社区与灵感</h4>
            <ul className="space-y-2.5 text-xs text-ink-muted">
              <li><a href="/community" className="hover:text-brand transition-colors">灵感作品广场 (Gallery)</a></li>
              <li><a href="/community" className="hover:text-brand transition-colors">每日热门排行 (Trending)</a></li>
              <li><a href="/community" className="hover:text-brand transition-colors">提示词精选 (Prompt Book)</a></li>
              <li><a href="/community" className="hover:text-brand transition-colors">一键同款 Remix 创作</a></li>
              <li><a href="/community" className="hover:text-brand transition-colors">创作者激励计划</a></li>
              <li><a href="/community" className="hover:text-brand transition-colors">官方设计挑战赛</a></li>
            </ul>
          </div>

          {/* 第 5 列：会员、方案与支持 (Plans & Support) */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-wider text-ink font-semibold">会员与方案</h4>
            <ul className="space-y-2.5 text-xs text-ink-muted">
              <li><a href="/pricing" className="hover:text-brand transition-colors">会员方案与定价 (Pricing)</a></li>
              <li><a href="/credits" className="hover:text-brand transition-colors">算力中心与明细 (Credits)</a></li>
              <li><a href="/terms" className="hover:text-brand transition-colors">商用授权协议说明</a></li>
              <li><a href="/privacy" className="hover:text-brand transition-colors">隐私保护政策</a></li>
              <li><a href="/terms" className="hover:text-brand transition-colors">服务条款与规则</a></li>
              <li><a href="/refund" className="hover:text-brand transition-colors">退款与保障政策</a></li>
            </ul>
          </div>

        </div>

        {/* 3. 页脚底栏：版权、国际化、货币、社交矩阵 */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-ink-subtle">
          
          {/* 左侧：版权与备案 */}
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
            <span>© 2026 SupDance AI Studio. 保留所有权利。</span>
            <span className="hidden sm:inline text-ink-subtle">|</span>
            <span className="hover:text-ink-muted transition-colors">京ICP备202508899号-1</span>
          </div>

          {/* 中间：国际化与货币选择 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-wash border border-line text-ink-muted">
              <svg className="w-3.5 h-3.5 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
              <select
                value={currentLocale}
                onChange={(e) => setCurrentLocale(e.target.value)}
                className="bg-transparent text-xs text-ink cursor-pointer"
              >
                <option value="zh-CN" className="bg-canvas">简体中文 (Chinese)</option>
                <option value="en" className="bg-canvas">English (US)</option>
                <option value="ja" className="bg-canvas">日本語 (Japanese)</option>
              </select>
            </div>

            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-wash border border-line text-ink-muted">
              <span className="text-[11px] font-mono font-bold text-ink">¥ CNY</span>
            </div>
          </div>

          {/* 右侧：社交媒体高精矩阵 */}
          <div className="flex items-center gap-4 text-ink-muted">
            {/* Discord */}
            <a href="https://discord.com" target="_blank" rel="noreferrer" className="hover:text-ink transition-colors" title="Discord 创作社区">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
            </a>
            {/* X / Twitter */}
            <a href="https://x.com" target="_blank" rel="noreferrer" className="hover:text-ink transition-colors" title="X / Twitter">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            {/* GitHub */}
            <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-ink transition-colors" title="GitHub">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </a>
          </div>

        </div>

      </div>
    </footer>
  );
}

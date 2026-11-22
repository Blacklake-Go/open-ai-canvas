'use client';

import React from 'react';

/**
 * StudioWorkbenchSkeleton
 * 
 * 高保真工作台骨架屏，用于在动态加载 Studio 工作台切片 (ImageStudio/VideoStudio 等) 
 * 期间提供像素级无缝占位，消除页面刷新与加载时的全屏空白与内容跳闪。
 * 严格遵守 UI_DESIGN_SYSTEM.md 与 UI_REPAIR_INSTRUCTION.md 规范：
 * - 绝对定位与 z-sticky 层级契约
 * - rounded-2xl Prompt Composer 外壳与 rounded-xl 展台卡
 * - 品牌洋红 (#e11d74) 高光与暗色层级
 */
const SKELETON_COPY = {
  en: {
    start: 'START CREATING WITH',
    desc: 'Describe a scene, character, mood, or style — and watch it come to life',
    promptPlaceholder: 'Describe the image you want to create...',
    generate: 'Generate',
    loadingLabel: 'Loading studio workbench',
  },
  'zh-CN': {
    start: '开启你的创意之旅',
    desc: '输入提示词或上传参考图，探索全网 200+ 顶尖 AI 影像模型',
    promptPlaceholder: '描述你想要生成的画面内容...',
    generate: '立即生成',
    loadingLabel: '加载工作台中',
  },
  'zh-TW': {
    start: '開啟你的創意之旅',
    desc: '輸入提示詞或上傳參考圖，探索全網 200+ 頂尖 AI 影像模型',
    promptPlaceholder: '描述你想要生成的畫面內容...',
    generate: '立即生成',
    loadingLabel: '加載工作台中',
  },
  'ja-JP': {
    start: 'クリエイティブな制作を始める',
    desc: 'プロンプトを入力するか参考画像をアップロードして、最先端のAIモデルを体験',
    promptPlaceholder: '作成したい画像の内容を入力してください...',
    generate: '今すぐ生成',
    loadingLabel: 'スタジオを読み込み中',
  },
  'ko-KR': {
    start: '창의적인 여정을 시작하세요',
    desc: '프롬프트를 입력하거나 참조 이미지를 업로드하여 200개 이상의 최고급 AI 모델을 탐색하세요',
    promptPlaceholder: '생성하고 싶은 이미지 내용을 입력하세요...',
    generate: '지금 생성',
    loadingLabel: '스튜디오 작업 공간 로드 중',
  },
  es: {
    start: 'COMIENZA A CREAR CON',
    desc: 'Describe una escena, personaje o estilo y mira cómo cobra vida con IA',
    promptPlaceholder: 'Describe la imagen que deseas crear...',
    generate: 'Generar ahora',
    loadingLabel: 'Cargando el espacio de trabajo',
  },
};

function resolveSkeletonCopy(locale) {
  const norm = String(locale || 'en').trim();
  if (SKELETON_COPY[norm]) return SKELETON_COPY[norm];
  if (norm.startsWith('zh-TW') || norm.startsWith('zh-HK') || norm.startsWith('zh-Hant')) return SKELETON_COPY['zh-TW'];
  if (norm.startsWith('zh')) return SKELETON_COPY['zh-CN'];
  if (norm.startsWith('ja')) return SKELETON_COPY['ja-JP'];
  if (norm.startsWith('ko')) return SKELETON_COPY['ko-KR'];
  if (norm.startsWith('es')) return SKELETON_COPY['es'];
  return SKELETON_COPY.en;
}

export default function StudioWorkbenchSkeleton({
  locale = 'en',
  tabId = 'image',
  modelName = '',
}) {
  const copy = resolveSkeletonCopy(locale);
  const displayModel = modelName || 'Nano Banana Pro';

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-transparent select-none"
      data-testid="studio-workbench-skeleton"
      aria-busy="true"
      aria-label={copy.loadingLabel}
    >
      {/* ── 中央舞台区域 (Central Showcase Stage) ── */}
      <div className="flex flex-col items-center justify-center h-full min-h-[50vh] w-full px-4">
        {/* 4 张错落微倾斜展示卡 (Overlapping Floating Cards) */}
        <div className="flex items-center justify-center gap-3 sm:gap-4 mb-10 select-none scale-90 sm:scale-100">
          <div className="w-16 sm:w-24 aspect-[3/4] rounded-xl border border-line shadow-elevation-2 -rotate-3 overflow-hidden bg-surface-raised flex-shrink-0">
            <img
              src="https://d3adwkbyhxyrtq.cloudfront.net/webassets/videomodels/sdxl-image.avif"
              alt="Creative preview 1"
              className="w-full h-full object-cover"
              loading="eager"
            />
          </div>
          <div className="w-16 sm:w-24 aspect-[3/4] rounded-xl border border-line shadow-elevation-2 -rotate-1 overflow-hidden bg-surface-raised flex-shrink-0">
            <img
              src="https://d3adwkbyhxyrtq.cloudfront.net/webassets/videomodels/chroma-image.avif"
              alt="Creative preview 2"
              className="w-full h-full object-cover"
              loading="eager"
            />
          </div>
          <div className="w-16 sm:w-24 aspect-[3/4] rounded-xl border border-line shadow-elevation-2 rotate-1 overflow-hidden bg-surface-raised flex-shrink-0">
            <img
              src="https://d3adwkbyhxyrtq.cloudfront.net/webassets/videomodels/neta-lumina.avif"
              alt="Creative preview 3"
              className="w-full h-full object-cover"
              loading="eager"
            />
          </div>
          <div className="w-16 sm:w-24 aspect-[3/4] rounded-xl border border-line shadow-elevation-2 rotate-3 overflow-hidden bg-surface-raised flex-shrink-0">
            <img
              src="https://d3adwkbyhxyrtq.cloudfront.net/webassets/videomodels/perfect-pony-xl.avif"
              alt="Creative preview 4"
              className="w-full h-full object-cover"
              loading="eager"
            />
          </div>
        </div>

        {/* 标题字排版 (Empty State Heading) */}
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-center px-4 flex flex-col items-center">
          <span className="text-white font-black uppercase text-xl sm:text-3xl tracking-wide mb-1 opacity-90">
            {copy.start}
          </span>
          <span className="text-brand font-black uppercase text-2xl sm:text-4xl sm:mt-1 tracking-tight">
            {displayModel}
          </span>
        </h1>
        <p className="text-ink-muted text-xs sm:text-sm font-medium tracking-wide text-center max-w-lg leading-relaxed px-4">
          {copy.desc}
        </p>
      </div>

      {/* ── 底部吸底提示词输入框骨架 (Bottom Prompt Composer Frame) ── */}
      <div className="absolute bottom-4 inset-x-0 mx-auto w-full max-w-[95%] lg:max-w-4xl z-sticky px-2 pointer-events-none">
        <div className="rounded-2xl border border-line bg-surface-glass backdrop-blur-md p-3 sm:p-4 shadow-elevation-2 flex flex-col justify-between min-h-[128px]">
          {/* 输入框文案占位 */}
          <div className="text-ink-subtle text-body text-sm py-1">
            {copy.promptPlaceholder}
          </div>

          {/* 底部控制栏 */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-line-subtle/50 mt-2">
            <div className="flex items-center gap-2">
              {/* 模型选择胶囊 */}
              <div className="h-control-md flex items-center gap-2 rounded-lg border border-line bg-wash px-3 text-label text-ink-muted">
                <span className="size-3.5 rounded-full bg-brand/30 inline-block" />
                <span className="text-xs font-medium">{displayModel}</span>
              </div>
              {/* 画幅比胶囊 */}
              <div className="h-control-md flex items-center gap-1.5 rounded-lg border border-line bg-wash px-2.5 text-label text-ink-muted">
                <span className="text-xs font-mono font-medium">1:1</span>
              </div>
            </div>

            {/* 生成按钮 */}
            <div className="h-control-md rounded-xl bg-brand text-ink-on-accent font-bold px-5 text-label shadow-elevation-1 flex items-center justify-center gap-1.5">
              <span className="text-xs font-bold">{copy.generate}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { ImageStudio } from 'studio';

const PRESETS = [
  { id: 'professional', label: '专业证件', description: '干净背景、柔和棚拍光', prompt: 'Create a polished professional headshot portrait, clean neutral background, soft studio lighting, natural skin texture, centered composition, realistic photography.' },
  { id: 'creator', label: '创作者头像', description: '有层次的彩色环境光', prompt: 'Create a modern creator profile headshot, expressive but natural pose, subtle colorful rim light, editorial composition, realistic photography.' },
  { id: 'executive', label: '商务头像', description: '稳重、可信、品牌感', prompt: 'Create a confident executive headshot portrait, premium business styling, controlled soft lighting, understated background, realistic photography.' },
];

export default function HeadshotStudio(props) {
  const [preset, setPreset] = useState(PRESETS[0]);
  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent">
      <div className="shrink-0 border-b border-white/10 bg-white/[.03] px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.24em] text-brand">AI Headshot</p>
            <h1 className="mt-1 text-base font-semibold text-white">头像生成工作台</h1>
            <p className="mt-1 text-xs text-white/45">上传一张清晰正面照，再选择适合你的商业风格预设。</p>
          </div>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="头像风格预设">
            {PRESETS.map((item) => (
              <button key={item.id} type="button" onClick={() => setPreset(item)} className={`rounded-xl border px-3 py-2 text-left transition-[background-color,border-color,color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer ${preset.id === item.id ? 'border-brand-line bg-brand-soft text-brand shadow-elevation-1' : 'border-white/10 bg-white/[.02] text-white/60 hover:border-white/20 hover:text-white'}`}>
                <span className="block text-xs font-semibold">{item.label}</span>
                <span className="mt-0.5 block text-[10px] text-white/40">{item.description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <ImageStudio key={preset.id} {...props} initialPrompt={preset.prompt} />
      </div>
    </div>
  );
}

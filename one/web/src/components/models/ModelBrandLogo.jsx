'use client';

import React, { useState } from 'react';
import Image from 'next/image';

// 官方本地矢量与高清品牌标识映射表 (优先采用已下载的高保真暗色定制 SVG)
const BRAND_LOGOS = {
  // 图像与前沿基础模型
  bfl: '/assets/brands/bfl.svg',
  flux: '/assets/brands/bfl.svg',
  openai: '/assets/brands/openai.svg',
  gpt: '/assets/brands/openai.svg',
  bytedance: '/assets/brands/bytedance.svg',
  seedream: '/assets/brands/bytedance.svg',
  doubao: '/assets/brands/bytedance.svg',
  volcengine: '/assets/brands/bytedance.svg',
  midjourney: '/assets/brands/midjourney.svg',
  stability: '/assets/brands/stability.svg',

  // 视频与动态模型
  kuaishou: '/assets/brands/kuaishou.svg',
  kling: '/assets/brands/kuaishou.svg',
  minimax: '/assets/brands/minimax.svg',
  hailuo: '/assets/brands/minimax.svg',
  alibaba: '/assets/brands/alibaba.svg',
  wan: '/assets/brands/alibaba.svg',
  google: '/assets/brands/google.svg',
  veo: '/assets/brands/google.svg',
  gemini: '/assets/brands/google.svg',
  vidu: '/assets/brands/vidu.svg',
  runway: '/assets/brands/runway.svg',
  luma: '/assets/brands/luma.svg',
  pika: '/assets/brands/pika.svg',
  tencent: '/assets/brands/tencent.svg',
  hunyuan: '/assets/brands/tencent.svg',

  // 音乐与音频模型
  suno: '/assets/brands/suno.svg',
  udio: '/assets/brands/udio.svg',
  elevenlabs: '/assets/brands/elevenlabs.svg',

  // 语言与多模态
  deepseek: '/assets/brands/deepseek.svg',
  anthropic: '/assets/brands/anthropic.svg',
  claude: '/assets/brands/anthropic.svg',
  zhipu: '/assets/brands/zhipu.svg',
  topaz: '/assets/brands/topaz.svg',
  hidream: '/assets/brands/hidream.svg',
};

// 品牌首字母缩写徽章备用色卡 (当 SVG 加载异常时平滑降级)
const BRAND_FALLBACK_STYLES = {
  deepseek: { initials: 'DS', bg: 'bg-[#183968]', text: 'text-[#58a6ff]' },
  openai: { initials: 'OA', bg: 'bg-[#103b2b]', text: 'text-[#10a37f]' },
  bfl: { initials: 'BF', bg: 'bg-[#3b2a14]', text: 'text-[#f59e0b]' },
  bytedance: { initials: 'BD', bg: 'bg-[#291b3e]', text: 'text-[#a855f7]' },
  alibaba: { initials: 'AL', bg: 'bg-[#142e47]', text: 'text-[#38bdf8]' },
  kuaishou: { initials: 'KS', bg: 'bg-[#3e1728]', text: 'text-[#f43f5e]' },
  midjourney: { initials: 'MJ', bg: 'bg-[#211e40]', text: 'text-[#818cf8]' },
  minimax: { initials: 'MX', bg: 'bg-[#381a30]', text: 'text-[#ec4899]' },
  google: { initials: 'GO', bg: 'bg-[#152e4d]', text: 'text-[#60a5fa]' },
  suno: { initials: 'SU', bg: 'bg-[#381c1c]', text: 'text-[#fb7185]' },
  tencent: { initials: 'TX', bg: 'bg-[#12303a]', text: 'text-[#2dd4bf]' },
  vidu: { initials: 'VD', bg: 'bg-[#12323a]', text: 'text-[#22d3ee]' },
};

/**
 * 获取最匹配的品牌标识 URL
 */
export function resolveBrandLogo(providerId, providerName, modelId) {
  const pId = String(providerId || '').toLowerCase().trim();
  const pName = String(providerName || '').toLowerCase().trim();
  const mId = String(modelId || '').toLowerCase().trim();

  // 优先直接匹配 providerId
  if (pId && BRAND_LOGOS[pId]) return BRAND_LOGOS[pId];

  // 模糊匹配 providerName 或 modelId
  const candidate = `${pId} ${pName} ${mId}`;
  if (candidate.includes('deepseek')) return BRAND_LOGOS.deepseek;
  if (candidate.includes('openai') || candidate.includes('gpt')) return BRAND_LOGOS.openai;
  if (candidate.includes('bfl') || candidate.includes('flux') || candidate.includes('black forest')) return BRAND_LOGOS.bfl;
  if (candidate.includes('bytedance') || candidate.includes('seedream') || candidate.includes('doubao') || candidate.includes('字节')) return BRAND_LOGOS.bytedance;
  if (candidate.includes('alibaba') || candidate.includes('wan') || candidate.includes('阿里') || candidate.includes('万相')) return BRAND_LOGOS.alibaba;
  if (candidate.includes('kuaishou') || candidate.includes('kling') || candidate.includes('快手') || candidate.includes('可灵')) return BRAND_LOGOS.kuaishou;
  if (candidate.includes('midjourney') || candidate.includes('mj')) return BRAND_LOGOS.midjourney;
  if (candidate.includes('minimax') || candidate.includes('hailuo') || candidate.includes('海螺')) return BRAND_LOGOS.minimax;
  if (candidate.includes('google') || candidate.includes('veo') || candidate.includes('gemini')) return BRAND_LOGOS.google;
  if (candidate.includes('suno')) return BRAND_LOGOS.suno;
  if (candidate.includes('tencent') || candidate.includes('hunyuan') || candidate.includes('腾讯') || candidate.includes('混元')) return BRAND_LOGOS.tencent;
  if (candidate.includes('vidu')) return BRAND_LOGOS.vidu;
  if (candidate.includes('runway')) return BRAND_LOGOS.runway;
  if (candidate.includes('luma')) return BRAND_LOGOS.luma;
  if (candidate.includes('anthropic') || candidate.includes('claude')) return BRAND_LOGOS.anthropic;
  if (candidate.includes('stability')) return BRAND_LOGOS.stability;
  if (candidate.includes('elevenlabs')) return BRAND_LOGOS.elevenlabs;
  if (candidate.includes('topaz')) return BRAND_LOGOS.topaz;
  if (candidate.includes('zhipu') || candidate.includes('智谱')) return BRAND_LOGOS.zhipu;

  return null;
}

/**
 * 专业级 AI 大模型品牌 Logo 组件
 * 自动暗色适配、发丝微光描边、平滑图片容错与降级
 */
export default function ModelBrandLogo({
  providerId,
  provider = '',
  modelId = '',
  size = 'md', // 'sm' (24px) | 'md' (32px) | 'lg' (40px) | 'xl' (48px)
  className = '',
  showRing = true,
}) {
  const [imgError, setImgError] = useState(false);
  const logoUrl = resolveBrandLogo(providerId, provider, modelId);

  // 尺寸映射 (严格遵循 UI_DESIGN_SYSTEM 4px 网格)
  const sizeMap = {
    sm: { box: 'w-6 h-6', img: 16, text: 'text-[10px]' },
    md: { box: 'w-8 h-8', img: 20, text: 'text-xs' },
    lg: { box: 'w-10 h-10', img: 26, text: 'text-sm' },
    xl: { box: 'w-12 h-12', img: 30, text: 'text-base' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  // 降级首字母提取
  const fallbackKey = String(providerId || '').toLowerCase().trim();
  const fallbackStyle = BRAND_FALLBACK_STYLES[fallbackKey] || {
    initials: (provider || 'AI').slice(0, 2).toUpperCase(),
    bg: 'bg-white/[0.08]',
    text: 'text-white/80',
  };

  return (
    <div
      className={`relative shrink-0 rounded-full flex items-center justify-center overflow-hidden transition-all duration-200 ${currentSize.box} ${
        showRing ? 'border border-white/10 bg-[#0d0f14] shadow-[0_2px_8px_rgba(0,0,0,0.5)] group-hover:border-white/25' : ''
      } ${className}`}
    >
      {logoUrl && !imgError ? (
        <img
          src={logoUrl}
          alt={provider || 'Model Brand'}
          width={currentSize.img}
          height={currentSize.img}
          className="object-contain transition-transform duration-200 group-hover:scale-110 select-none pointer-events-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      ) : (
        <div
          className={`w-full h-full flex items-center justify-center font-mono font-bold select-none ${currentSize.text} ${fallbackStyle.bg} ${fallbackStyle.text}`}
        >
          {fallbackStyle.initials}
        </div>
      )}
    </div>
  );
}

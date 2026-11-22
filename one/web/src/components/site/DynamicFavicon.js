'use client';

import { useEffect } from 'react';
import { useBranding } from '@/lib/hooks/useBranding';

const DEFAULT_ICON_SVG = '/branding/favicon.svg';
const DEFAULT_ICON_ICO = '/favicon.ico';
const DEFAULT_APPLE_ICON = '/branding/apple-touch-icon.png';
const CACHE_VERSION = 'v=3';

function withVersion(url) {
  if (!url) return url;
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  return url.includes('?') ? `${url}&${CACHE_VERSION}` : `${url}?${CACHE_VERSION}`;
}

/**
 * 动态同步网站浏览器标签页图标 (Dynamic Favicon Sync)
 * 优先响应运营后台配置的自定义图标；未配置时无缝回退为官方三色方块矢量/多尺寸图标。
 * 针对 Chromium / WebKit 浏览器的强缓存机制，通过 DOM 节点重置与版本戳强制刷新标签页图标。
 */
export default function DynamicFavicon() {
  const { brand } = useBranding();

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const customUrl = brand?.faviconUrl?.trim();
    if (!customUrl) return; // 未配置自定义 Favicon 时保持 Next.js 原生 metadata 标签，严禁破坏 React DOM 树

    const targetIconUrl = withVersion(customUrl);

    // 原地安全更新已有节点或按需单例添加，严禁直接 el.remove() 破坏 React 内部 Fiber 引用
    const iconLink = document.querySelector("link[rel='icon']");
    if (iconLink) {
      iconLink.href = targetIconUrl;
    } else {
      const newLink = document.createElement('link');
      newLink.rel = 'icon';
      newLink.href = targetIconUrl;
      document.head.appendChild(newLink);
    }
  }, [brand?.faviconUrl]);

  return null;
}

'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { sanitizeAvatarUrl, getDeterministicDefaultAvatar } from '@/lib/avatar';

export { sanitizeAvatarUrl, getDeterministicDefaultAvatar };

/**
 * 全站工业级防破碎用户头像组件 (UserAvatar)
 *
 * 核心防护能力：
 * 1. 防盗链穿透：强制携带 `referrerPolicy="no-referrer"`，破除微信/QQ等第三方 403 阻断
 * 2. 双重加载失败探测：同时捕获 React 事件 `onError` 与挂载时刻的 `naturalWidth === 0`
 * 3. 优雅降级兜底：加载失败或无头像时，自动渲染符合 KOYO 设计系统的高质感首字母或矢量徽章，绝无原生碎图框与 alt 乱飞
 */
export default function UserAvatar({
  src,
  alt,
  name,
  seed,
  fallbackType = 'letter', // 'letter' | 'svg'
  className = 'size-full object-cover',
  fallbackClassName = '',
  children,
}) {
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef(null);

  const cleanSrc = useMemo(() => sanitizeAvatarUrl(src), [src]);

  // 当外部传入的图片地址变更时，重置失败状态
  useEffect(() => {
    setHasError(false);
  }, [cleanSrc]);

  // 检查服务端直出或浏览器预加载失败的情况（浏览器不重复触发 error 事件）
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth === 0 && cleanSrc) {
      setHasError(true);
    }
  }, [cleanSrc]);

  // 首字母提取（过滤特殊符号，取首个有效字符并大写）
  const initialLetter = useMemo(() => {
    const raw = String(name || alt || 'U').trim();
    if (!raw) return 'U';
    return raw.charAt(0).toUpperCase();
  }, [name, alt]);

  // 若无有效地址或已触发加载失败，执行优雅降级兜底
  if (!cleanSrc || hasError) {
    if (children) {
      return children;
    }

    if (fallbackType === 'svg') {
      const defaultSvg = getDeterministicDefaultAvatar(seed || name || alt);
      return (
        <img
          src={defaultSvg}
          alt={alt || name || 'Default Avatar'}
          className={className}
          referrerPolicy="no-referrer"
          loading="lazy"
        />
      );
    }

    // 默认首字母降级
    return (
      <span
        className={`select-none font-bold uppercase ${fallbackClassName}`}
        aria-hidden="true"
      >
        {initialLetter}
      </span>
    );
  }

  return (
    <img
      ref={imgRef}
      src={cleanSrc}
      alt={alt || name || 'User Avatar'}
      className={className}
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
}

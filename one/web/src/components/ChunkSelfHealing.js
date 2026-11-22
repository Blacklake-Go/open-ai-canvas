'use client';

import { useEffect } from 'react';

const RECOVERY_KEY = 'supdance_chunk_recovery_ts';
const RECOVERY_COOLDOWN_MS = 15000; // 15秒内仅允许自动自愈一次，防止无限循环

export default function ChunkSelfHealing() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const trySelfHealing = (reason) => {
      try {
        const lastRecovery = sessionStorage.getItem(RECOVERY_KEY);
        const now = Date.now();
        if (lastRecovery && now - Number(lastRecovery) < RECOVERY_COOLDOWN_MS) {
          console.warn('[ChunkSelfHealing] 冷却时间内已执行过自愈，跳过重复刷新:', reason);
          return;
        }

        sessionStorage.setItem(RECOVERY_KEY, String(now));
        console.warn('[ChunkSelfHealing] 检测到静态资源版本错位或加载失败，正在自动拉取最新版本:', reason);

        // 强制带时间戳重载最新 HTML
        const url = new URL(window.location.href);
        url.searchParams.set('_v_reload', String(now));
        window.location.replace(url.toString());
      } catch (e) {
        window.location.reload();
      }
    };

    // 1. 捕获未处理的 Promise 拒绝 (例如动态 import() 失败导致的 ChunkLoadError)
    const handleRejection = (event) => {
      const error = event.reason;
      const message = String(error?.message || error || '');
      const isChunkError =
        message.includes('ChunkLoadError') ||
        message.includes('Loading chunk') ||
        message.includes('CSS_CHUNK_LOAD_FAILED') ||
        message.includes('failed to fetch') ||
        message.includes('Failed to load resource') ||
        (error?.name === 'ChunkLoadError');

      if (isChunkError) {
        event.preventDefault();
        trySelfHealing(`Promise rejection: ${message}`);
      }
    };

    // 2. 捕获全局脚本/样式标签加载失败事件 (例如 <script src="..."> 404/400)
    const handleError = (event) => {
      const target = event.target;
      const isScriptOrLink =
        target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK');
      const src = target?.src || target?.href || '';

      if (isScriptOrLink && (src.includes('/_next/static/') || src.includes('/_next/'))) {
        trySelfHealing(`Resource tag load error: ${src}`);
        return;
      }

      const message = String(event.message || '');
      if (
        message.includes('Loading chunk') ||
        message.includes('ChunkLoadError') ||
        message.includes('CSS_CHUNK_LOAD_FAILED')
      ) {
        trySelfHealing(`Window error: ${message}`);
      }
    };

    window.addEventListener('unhandledrejection', handleRejection);
    window.addEventListener('error', handleError, true); // 使用 capture 捕获资源标签加载失败

    return () => {
      window.removeEventListener('unhandledrejection', handleRejection);
      window.removeEventListener('error', handleError, true);
    };
  }, []);

  return null;
}

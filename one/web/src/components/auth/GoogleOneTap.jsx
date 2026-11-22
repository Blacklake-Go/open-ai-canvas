'use client';

import { useEffect } from 'react';

const GIS_CLIENT_SRC = 'https://accounts.google.com/gsi/client';
const ENDPOINT = '/api/auth/oauth/google/one-tap';

let gisLoadPromise = null;

function loadGoogleIdentityServices() {
  if (typeof window === 'undefined') return Promise.reject(new Error('NO_WINDOW'));
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_CLIENT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('GIS_LOAD_FAILED')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_CLIENT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisLoadPromise = null;
      script.remove();
      reject(new Error('GIS_LOAD_FAILED'));
    };
    document.head.appendChild(script);
  });

  return gisLoadPromise;
}

/**
 * 仅挂载在服务端确认过「未登录 + 非中国大陆 IP」的页面；
 * 真正的开关仍由 GET /api/auth/oauth/google/one-tap 复核（地区、后台开关、凭据）。
 */
export default function GoogleOneTap({ eligible = false }) {
  useEffect(() => {
    if (!eligible) return undefined;

    let cancelled = false;

    const start = async () => {
      try {
        const configResponse = await fetch(ENDPOINT, {
          headers: { accept: 'application/json' },
          cache: 'no-store',
        });
        if (!configResponse.ok) return;
        const config = await configResponse.json();
        if (cancelled || !config?.enabled || !config?.clientId) return;

        await loadGoogleIdentityServices();
        if (cancelled || !window.google?.accounts?.id) return;

        window.google.accounts.id.initialize({
          client_id: config.clientId,
          auto_select: true,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: true,
          itp_support: true,
          callback: async ({ credential }) => {
            if (!credential) return;
            try {
              const loginResponse = await fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential }),
              });
              if (!loginResponse.ok) {
                if (process.env.NODE_ENV !== 'production') {
                  console.warn('[google-one-tap] login rejected', loginResponse.status);
                }
                return;
              }
              const result = await loginResponse.json();
              if (result.onboardingUrl) window.location.assign(result.onboardingUrl);
              else window.location.reload();
            } catch (error) {
              if (process.env.NODE_ENV !== 'production') {
                console.warn('[google-one-tap] login request failed', error);
              }
            }
          },
        });

        window.google.accounts.id.prompt((notification) => {
          if (process.env.NODE_ENV === 'production') return;
          if (notification.isNotDisplayed()) {
            console.info('[google-one-tap] not displayed:', notification.getNotDisplayedReason());
          } else if (notification.isSkippedMoment()) {
            console.info('[google-one-tap] skipped:', notification.getSkippedReason());
          }
        });
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[google-one-tap] init failed', error);
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      try {
        window.google?.accounts?.id?.cancel?.();
      } catch {}
    };
  }, [eligible]);

  return null;
}

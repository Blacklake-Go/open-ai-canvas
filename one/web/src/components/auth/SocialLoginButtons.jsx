'use client';

import React from 'react';
import {
  GoogleIcon,
  XIcon,
  TikTokIcon,
  InstagramIcon,
  WeChatIcon,
  QQIcon,
  DouyinIcon,
  BilibiliIcon,
} from '@/components/SocialIcons';
import { openOAuthPopup } from '@/lib/auth/oauthPopup';

export const SOCIAL_PROVIDER_META = {
  google: { label: 'Google', icon: GoogleIcon },
  x: { label: 'X', icon: XIcon },
  tiktok: { label: 'TikTok', icon: TikTokIcon },
  instagram: { label: 'Instagram', icon: InstagramIcon },
  wechat: { label: '微信', icon: WeChatIcon },
  qq: { label: 'QQ', icon: QQIcon },
  douyin: { label: '抖音', icon: DouyinIcon },
  bilibili: { label: '哔哩哔哩', icon: BilibiliIcon },
};

export default function SocialLoginButtons({
  providers = [],
  dividerText = '或使用快捷方式',
  actionLabel = '登录',
  region = 'mainland_china',
  onSocialLogin,
}) {
  const hasProviders = Array.isArray(providers) && providers.length > 0;
  if (!hasProviders) return null;

  const handleTrigger = (providerId) => {
    if (onSocialLogin) {
      onSocialLogin(providerId);
      return;
    }
    const returnTo = typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '/studio';
    const url = `/api/auth/oauth/${providerId}?returnTo=${encodeURIComponent(returnTo)}&redirect=${encodeURIComponent(returnTo)}`;
    openOAuthPopup(url);
  };

  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="relative flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-line-subtle" />
        </div>
        <span className="relative px-3 bg-surface text-[10px] text-ink-muted uppercase tracking-wider">
          {dividerText}
        </span>
      </div>

      {hasProviders && (
        <div className="grid grid-cols-2 gap-2">
          {providers.map((provider) => {
            const meta = SOCIAL_PROVIDER_META[provider.id];
            if (!meta) return null;
            const Icon = meta.icon;
            const labelText = actionLabel ? `${meta.label} ${actionLabel}` : meta.label;
            return (
              <button
                key={provider.id}
                type="button"
                disabled={provider.available !== true}
                onClick={() => { if (provider.available === true) handleTrigger(provider.id); }}
                title={`使用 ${meta.label} ${actionLabel || '登录'}`}
                className="h-9 px-3 rounded-full bg-wash hover:bg-surface-raised active:bg-base border border-line-subtle hover:border-line flex items-center justify-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink transition-colors cursor-pointer shadow-elevation-1 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Icon size={16} />
                <span className="truncate">{labelText}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import ProfileTab from './tabs/ProfileTab';
import SystemPreferencesSection from './settings/SystemPreferencesSection';
import { UserRound, SlidersHorizontal } from 'lucide-react';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/locales';

export default function AccountSettingsView({
  user,
  profileName: propProfileName,
  setProfileName: propSetProfileName,
  onSaveProfile,
  onProfileUpdated,
  busy = false,
  initialSubTab = 'profile',
  embedded = false,
  className = '',
}) {
  const [subTab, setSubTab] = useState(initialSubTab); // 'profile' | 'preferences'

  const cookieLocale = typeof document !== 'undefined' ? document.cookie.match(/(?:^|;\s*)(?:NEXT_LOCALE|locale)=([^;]+)/)?.[1] : null;
  const activeLocale = normalizeLocale(user?.locale || cookieLocale || DEFAULT_LOCALE);
  const isZhTw = activeLocale === 'zh-TW';
  const isZhCn = activeLocale === 'zh-CN' || activeLocale === 'zh';

  const copy = {
    profile: isZhTw ? '帳戶資料與安全' : (isZhCn ? '账户资料与安全' : (activeLocale === 'ja-JP' ? 'プロフィールとセキュリティ' : (activeLocale === 'ko-KR' ? '프로필 및 보안' : (activeLocale === 'es' ? 'Perfil y seguridad' : 'Profile & Security')))),
    preferences: isZhTw ? '系統與偏好設定' : (isZhCn ? '系统与偏好设置' : (activeLocale === 'ja-JP' ? 'システムと環境設定' : (activeLocale === 'ko-KR' ? '시스템 및 환경설정' : (activeLocale === 'es' ? 'Sistema y preferencias' : 'System & Preferences')))),
  };

  return (
    <div className={`w-full ${className}`}>
      {/* 顶部子模式切换胶囊 */}
      <div className="flex items-center gap-2 mb-6 border-b border-line-subtle pb-3 select-none">
        <button
          type="button"
          onClick={() => setSubTab('profile')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            subTab === 'profile'
              ? 'bg-brand text-white shadow-elevation-1'
              : 'text-ink-muted hover:text-ink hover:bg-wash'
          }`}
        >
          <UserRound className="size-3.5" />
          <span>{copy.profile}</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('preferences')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            subTab === 'preferences'
              ? 'bg-brand text-white shadow-elevation-1'
              : 'text-ink-muted hover:text-ink hover:bg-wash'
          }`}
        >
          <SlidersHorizontal className="size-3.5" />
          <span>{copy.preferences}</span>
        </button>
      </div>

      {/* 内容区域 */}
      {subTab === 'profile' ? (
        <ProfileTab
          user={user}
          profileName={propProfileName}
          setProfileName={propSetProfileName}
          onSaveProfile={onSaveProfile}
          onProfileUpdated={onProfileUpdated}
          busy={busy}
        />
      ) : (
        <SystemPreferencesSection user={user} />
      )}
    </div>
  );
}

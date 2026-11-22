'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SpatialBackground } from '@/components/spatial';
import AuthCard from '@/components/auth/AuthCard';
import LoginSuccessOverlay from '@/components/auth/LoginSuccessOverlay';
import LoginSummaryModal from '@/components/auth/LoginSummaryModal';
import UserOnboardingModal from '@/components/auth/UserOnboardingModal';
import DeletionGracePeriodModal from '@/components/auth/DeletionGracePeriodModal';
import {
  GoogleIcon,
  XIcon,
  TikTokIcon,
  InstagramIcon,
  WeChatIcon,
  QQIcon,
  DouyinIcon,
  BilibiliIcon,
} from './SocialIcons';
import { openGlobalAuthModal, closeGlobalAuthModal } from '@/lib/authEvents';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/locales';

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

export default function AuthModal({
  isOpen = true,
  onClose,
  onSuccess,
  isInline = false,
  className = '',
  locale = null,
  initialTab = 'email',
  initialEmailMode = 'login',
  initialMode = null,
}) {
  const getCookieLocale = () => {
    if (typeof document === 'undefined') return null;
    const m = document.cookie.match(/(?:^|;\s*)(?:NEXT_LOCALE|locale)=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  };
  const activeLocale = normalizeLocale(locale || getCookieLocale() || DEFAULT_LOCALE);

  // Main Mode: 'login' | 'register' | 'forgot'
  const effectiveInitialMode = initialMode || (
    initialEmailMode === 'register'
      ? 'register'
      : initialEmailMode === 'reset' || initialEmailMode === 'recover-username'
        ? 'forgot'
        : 'login'
  );
  const [mode, setMode] = useState(effectiveInitialMode);
  const [loginTab, setLoginTab] = useState(initialTab === 'phone' ? 'phone' : 'email');

  // Sync mode with props
  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    } else if (initialEmailMode === 'register') {
      setMode('register');
    } else if (initialEmailMode === 'reset' || initialEmailMode === 'recover-username') {
      setMode('forgot');
    } else {
      setMode('login');
    }
  }, [initialMode, initialEmailMode]);

  useEffect(() => {
    if (initialTab) {
      setLoginTab(initialTab === 'phone' ? 'phone' : 'email');
    }
  }, [initialTab]);

  // Post-auth Overlays
  const [showDeletionGracePeriod, setShowDeletionGracePeriod] = useState(false);
  const [deletionGracePeriodUser, setDeletionGracePeriodUser] = useState(null);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [authenticatedUser, setAuthenticatedUser] = useState(null);
  const [summarySnapshot, setSummarySnapshot] = useState(null);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  // 全局键盘 Esc 退出
  useEffect(() => {
    if (!isOpen || isInline) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, isInline, handleClose]);

  // Global Event Listener
  useEffect(() => {
    const handleOpenAuth = (e) => {
      const detail = e.detail || {};
      const targetMode = detail.mode || detail.initialMode || (detail.initialEmailMode === 'register' ? 'register' : 'login');
      setMode(targetMode);
      if (detail.tab || detail.initialTab) {
        setLoginTab(detail.tab || detail.initialTab);
      }
    };
    const handleCloseAuth = () => {
      handleClose();
    };

    window.addEventListener('open-auth-modal', handleOpenAuth);
    window.addEventListener('supdance:open-auth', handleOpenAuth);
    window.addEventListener('close-auth-modal', handleCloseAuth);
    window.addEventListener('supdance:close-auth', handleCloseAuth);
    return () => {
      window.removeEventListener('open-auth-modal', handleOpenAuth);
      window.removeEventListener('supdance:open-auth', handleOpenAuth);
      window.removeEventListener('close-auth-modal', handleCloseAuth);
      window.removeEventListener('supdance:close-auth', handleCloseAuth);
    };
  }, [handleClose]);

  // Session Synchronization with Retries (used by OAuth synchronization)
  const syncSessionWithRetry = useCallback(async (attemptsLeft = 3, delay = 250) => {
    try {
      const response = await fetch('/api/auth/me', { cache: 'no-store' });
      if (response.ok) {
        const res = await response.json();
        if (res?.user) return res.user;
      }
    } catch {}

    if (attemptsLeft > 1) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return syncSessionWithRetry(attemptsLeft - 1, delay * 1.5);
    }
    return null;
  }, []);

  // Auth Success Pipeline
  const handleAuthSuccessFlow = useCallback(
    (user, isNew = false, provider = null) => {
      setAuthenticatedUser(user);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('supdance-auth-success', { detail: { user } }));
      }

      if (user?.deletion_scheduled_at || user?.deletionScheduledAt) {
        setDeletionGracePeriodUser(user);
        setShowDeletionGracePeriod(true);
        return;
      }

      if (isNew || user?.onboardingCompleted === false) {
        setShowOnboardingModal(true);
      } else {
        setShowSuccessOverlay(true);
      }
    },
    []
  );

  // Cross-Window OAuth Listener
  const handledAuthEventsRef = useRef(new Set());
  useEffect(() => {
    if (!isOpen) return;

    const processAuthData = (data) => {
      if (!data || data.type !== 'supdance-auth-complete') return;
      if (data.action === 'bind') return;

      const eventKey = data.eventId || `${data.provider}_${data.ok}_${data.isNew}`;
      if (handledAuthEventsRef.current.has(eventKey)) return;
      handledAuthEventsRef.current.add(eventKey);

      if (data.ok) {
        syncSessionWithRetry().then((user) => {
          const resolvedUser = user || data.user;
          if (resolvedUser) {
            handleAuthSuccessFlow(resolvedUser, Boolean(data.isNew), data.provider);
          }
        });
      }
    };

    let channel = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        channel = new BroadcastChannel('supdance_auth_channel');
        channel.onmessage = (event) => processAuthData(event.data);
      }
    } catch {}

    const handleStorageChange = (event) => {
      if ((event.key === 'supdance_auth_event' || event.key === 'supdance-oauth-sync') && event.newValue) {
        try {
          processAuthData(JSON.parse(event.newValue));
        } catch {}
      }
    };

    const handleWindowMessage = (event) => {
      if (event?.data?.type === 'supdance-auth-complete') {
        processAuthData(event.data);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('message', handleWindowMessage);
    return () => {
      if (channel) channel.close();
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('message', handleWindowMessage);
    };
  }, [isOpen, syncSessionWithRetry, handleAuthSuccessFlow]);

  // Mobile OAuth trigger redirection helper
  const handleSocialOAuth = (providerId) => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const currentPath = typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '/studio';
    const returnTo = currentPath.includes('/login') || currentPath.includes('/register') ? '/studio' : currentPath;
    const url = `/api/auth/oauth/${providerId}?action=login&returnTo=${encodeURIComponent(returnTo)}&redirect=${encodeURIComponent(returnTo)}`;
    if (isMobile) {
      window.location.assign(url);
      return;
    }
    const popup = window.open(url, 'supdance-oauth', 'popup,width=520,height=720');
    if (!popup) window.location.assign(url);
  };

  // Helper for registration code dispatch (contract verified)
  const sendEmailRegisterCodeContract = async (cleanEmail) => {
    return fetch('/api/auth/register/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, locale: activeLocale }),
    });
  };

  // 1. 账号注销冷静期恢复弹窗
  if (showDeletionGracePeriod && deletionGracePeriodUser) {
    return (
      <DeletionGracePeriodModal
        user={deletionGracePeriodUser}
        onCancelGracePeriod={() => {
          setShowDeletionGracePeriod(false);
          setShowSuccessOverlay(true);
        }}
        onContinueLogin={() => {
          setShowDeletionGracePeriod(false);
          setShowSuccessOverlay(true);
        }}
        onClose={() => {
          setShowDeletionGracePeriod(false);
          handleClose();
        }}
      />
    );
  }

  // 2. 新用户 Onboarding 欢迎步骤弹窗
  if (showOnboardingModal && authenticatedUser) {
    return (
      <UserOnboardingModal
        user={authenticatedUser}
        onComplete={(updatedUser) => {
          setShowOnboardingModal(false);
          setShowSuccessOverlay(true);
          setAuthenticatedUser(updatedUser || authenticatedUser);
        }}
        onClose={() => {
          setShowOnboardingModal(false);
          setShowSuccessOverlay(true);
        }}
      />
    );
  }

  // 3. 登录成功动效全屏覆盖层
  if (showSuccessOverlay) {
    return (
      <LoginSuccessOverlay
        user={authenticatedUser}
        onComplete={(snapshot) => {
          setShowSuccessOverlay(false);
          setSummarySnapshot(snapshot || null);
          setShowSummaryModal(true);
        }}
      />
    );
  }

  // 4. 登录总结与资产权益面板
  if (showSummaryModal) {
    return (
      <LoginSummaryModal
        user={summarySnapshot?.user || authenticatedUser}
        onComplete={() => {
          setShowSummaryModal(false);
          onSuccess?.(
            summarySnapshot?.user || authenticatedUser,
            summarySnapshot?.entitlements || null
          );
        }}
        onClose={() => {
          setShowSummaryModal(false);
          onSuccess?.(
            summarySnapshot?.user || authenticatedUser,
            summarySnapshot?.entitlements || null
          );
        }}
      />
    );
  }

  if (!isOpen) return null;

  // 内嵌模式直接渲染卡片
  if (isInline) {
    return (
      <AuthCard
        initialMode={mode}
        initialTab={loginTab}
        locale={activeLocale}
        onSuccess={(user, meta) => handleAuthSuccessFlow(user, meta?.isNew, meta?.provider)}
        onClose={handleClose}
        showClose={false}
        embedded={true}
        className={className}
      />
    );
  }

  // 浮窗弹窗模式：半透明毛玻璃背景 + 居中组件化卡片
  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-3 sm:p-6 lg:p-8 bg-scrim backdrop-blur-xl transition-opacity duration-base ease-enter animate-fade-in overflow-y-auto cursor-pointer"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <SpatialBackground variant="minimal" />
      <AuthCard
        initialMode={mode}
        initialTab={loginTab}
        locale={activeLocale}
        onSuccess={(user, meta) => handleAuthSuccessFlow(user, meta?.isNew, meta?.provider)}
        onClose={handleClose}
        showClose={true}
        embedded={false}
        className={className}
      />
    </div>
  );
}

export { openGlobalAuthModal, closeGlobalAuthModal };

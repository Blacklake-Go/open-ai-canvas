'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { X, User, Loader2 } from 'lucide-react';
import AccountLayout, { normalizeTab } from '@/components/account/AccountLayout';
import ActivityTab from '@/components/account/tabs/ActivityTab';
import MembershipTab from '@/components/account/tabs/MembershipTab';
import UsageTab from '@/components/account/tabs/UsageTab';
import AccountSettingsView from './AccountSettingsView';
import AuthModal from '@/components/AuthModal';
import { Button } from '@/components/ui/button';

class TabErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('[TabErrorBoundary Caught]:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-12 rounded-2xl border border-line bg-surface/90 text-center animate-in fade-in duration-modal ease-enter">
          <p className="text-body-sm font-medium text-ink">当前面板加载异常</p>
          <p className="mt-1 text-caption text-ink-subtle">{this.state.error?.message || '运行时遇到非预期数据'}</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 px-5 py-2 rounded-full text-xs font-semibold bg-brand text-ink-on-accent hover:bg-brand-hover active:bg-brand-active active:scale-[0.98] active:duration-instant transition-[background-color,color,transform] duration-fast ease-standard focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer"
          >
            重试加载
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AccountCenterContent({
  onClose,
  initialTabProp,
  onTabChange: onTabChangeProp,
  initialUser = null,
  initialCredits = null,
  onOpenAuth = null,
  isModal = true,
}) {
  const searchParams = useSearchParams();
  const rawAction = initialTabProp || searchParams?.get('action') || 'activity';
  const initialAction = normalizeTab(rawAction);

  const [user, setUser] = useState(initialUser);
  const [authLoading, setAuthLoading] = useState(!initialUser);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [credits, setCredits] = useState(initialCredits ?? (initialUser?.credits ?? 0));
  const [currentTab, setCurrentTab] = useState(initialAction);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [profileName, setProfileName] = useState(
    initialUser?.displayName || initialUser?.display_name || initialUser?.name || ''
  );
  const lastInitialTabRef = useRef(rawAction);

  const loadAccount = async (silent = false) => {
    try {
      if (!silent) setAuthLoading(true);
      const response = await fetch('/api/auth/me', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          setUser(data.user);
          setCredits(data.entitlements?.credits ?? data.user.credits ?? 0);
          setProfileName(data.user.displayName || data.user.display_name || data.user.name || '');
          return;
        }
      }
      if (!initialUser) setUser(null);
    } catch {
      if (!initialUser) setUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    loadAccount(Boolean(initialUser));
  }, []);

  useEffect(() => {
    if (initialTabProp && initialTabProp !== lastInitialTabRef.current) {
      lastInitialTabRef.current = initialTabProp;
      setCurrentTab(normalizeTab(initialTabProp));
    }
  }, [initialTabProp]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 3500);
    return () => window.clearTimeout(timer);
  }, [message]);

  const handleTabChange = (tabId) => {
    const normalized = normalizeTab(tabId);
    if (!user) {
      if (onOpenAuth) {
        onClose?.();
        onOpenAuth();
      } else {
        setShowAuthModal(true);
      }
      return;
    }
    lastInitialTabRef.current = tabId;
    setCurrentTab(normalized);
    onTabChangeProp?.(normalized);
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('action', normalized);
        window.history.replaceState(null, '', url.toString());
      } catch {}
    }
  };

  const handleSaveProfile = async (event, overrides = {}) => {
    if (event?.preventDefault) event.preventDefault();
    setBusy(true);
    try {
      const payload = {
        displayName: overrides.displayName !== undefined ? overrides.displayName : profileName,
      };
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      setMessage(response.ok ? '个人资料已更新' : data.error || '更新失败');
      if (response.ok) {
        if (data.user) {
          setUser((prev) => ({ ...prev, ...data.user }));
        }
        await loadAccount(true);
        return true;
      }
      return false;
    } catch {
      setMessage('网络请求失败');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setMessage('正在安全退出并返回首页…');
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('muapi_key');
        localStorage.removeItem('ko_user');
      } catch {}
      onClose?.();
      setTimeout(() => {
        window.location.href = '/';
      }, 250);
    }
  };

  if (authLoading) {
    return (
      <div className="relative w-full max-w-[1400px] 2xl:max-w-[1480px] h-[90vh] md:h-[86vh] max-h-[880px] min-h-[600px] rounded-2xl border border-line bg-overlay backdrop-blur-xl shadow-elevation-4 flex flex-col items-center justify-center animate-pulse">
        <Loader2 className="size-8 animate-spin text-brand" />
        <p className="mt-3 text-caption text-ink-muted">正在加载个人中心…</p>
      </div>
    );
  }

  const normalizedTab = normalizeTab(currentTab);

  if (!user) {
    return (
      <div className="relative w-full max-w-md rounded-2xl border border-line bg-overlay p-8 text-center shadow-elevation-4 backdrop-blur-xl animate-in zoom-in-95 duration-modal ease-enter">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-ink-muted hover:text-ink hover:bg-wash active:scale-[0.98] active:duration-instant transition-[background-color,color,transform] duration-fast ease-standard focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer"
          aria-label="关闭"
        >
          <X className="size-4" />
        </button>
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-line bg-surface text-brand mb-4">
          <User className="size-7" />
        </div>
        <h2 className="text-xl font-bold text-ink">请先登录</h2>
        <p className="mt-2 text-sm text-ink-muted leading-relaxed">
          访问创作者个人中心、管理创作活跃与账号设置前，需要先登录你的账号。
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Button
            type="button"
            onClick={() => {
              if (onOpenAuth) {
                onClose?.();
                onOpenAuth();
              } else {
                setShowAuthModal(true);
              }
            }}
            className="w-full h-10 rounded-xl bg-brand text-ink-on-accent font-semibold hover:bg-brand-hover active:bg-brand-active active:scale-[0.98] active:duration-instant transition-[background-color,color,transform] duration-fast ease-standard focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer"
          >
            立即登录 / 注册
          </Button>
          <Button
            type="button"
            onClick={onClose}
            variant="outline"
            className="w-full h-10 rounded-xl border-line text-ink hover:bg-wash active:scale-[0.98] active:duration-instant transition-[background-color,color,border-color,transform] duration-fast ease-standard focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer"
          >
            继续留在工作台
          </Button>
        </div>
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => {
            setShowAuthModal(false);
            loadAccount();
          }}
        />
      </div>
    );
  }

  return (
    <>
      <AccountLayout
        user={user}
        activeTab={normalizedTab}
        onTabChange={handleTabChange}
        onLogout={logout}
        onClose={onClose}
        onOpenAuth={() => {
          if (onOpenAuth) {
            onClose?.();
            onOpenAuth();
          } else {
            setShowAuthModal(true);
          }
        }}
        withBackdrop={!isModal}
      >
        {message && (
          <div
            role="status"
            className="fixed top-8 left-1/2 -translate-x-1/2 z-toast flex items-center gap-3 rounded-full border border-white/15 bg-surface-raised px-5 py-2 text-xs font-medium text-ink shadow-elevation-4 backdrop-blur-md animate-in fade-in slide-in-from-top-2"
          >
            <span>{message}</span>
            <button
              type="button"
              onClick={() => setMessage('')}
              className="text-ink-muted hover:text-ink transition-colors cursor-pointer"
              aria-label="关闭提示"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* 1. 活跃历史 */}
        {normalizedTab === 'activity' && (
          <TabErrorBoundary>
            <ActivityTab user={user} />
          </TabErrorBoundary>
        )}

        {/* 2. 账号与设置 (居中头像与用户名、密码安全、三方绑定、系统偏好) */}
        {normalizedTab === 'settings' && (
          <TabErrorBoundary>
            <AccountSettingsView
              user={user}
              profileName={profileName}
              setProfileName={setProfileName}
              onSaveProfile={handleSaveProfile}
              onProfileUpdated={async (updatedUser) => {
                if (updatedUser) {
                  setUser((prev) => ({ ...prev, ...updatedUser }));
                }
                await loadAccount(true);
              }}
              busy={busy}
            />
          </TabErrorBoundary>
        )}

        {/* 3. 订阅与账单 */}
        {normalizedTab === 'billing' && (
          <TabErrorBoundary>
            <MembershipTab
              user={user}
              onRefreshUser={() => loadAccount(true)}
              onOpenAuth={onOpenAuth}
              onNavigateTab={handleTabChange}
            />
          </TabErrorBoundary>
        )}

        {/* 4. 额度明细 */}
        {normalizedTab === 'usage' && (
          <TabErrorBoundary>
            <UsageTab user={user} />
          </TabErrorBoundary>
        )}
      </AccountLayout>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          loadAccount();
        }}
      />
    </>
  );
}

export default function AccountCenterView(props) {
  return (
    <Suspense
      fallback={
        <div className="relative w-full max-w-[1400px] 2xl:max-w-[1480px] h-[90vh] md:h-[86vh] max-h-[880px] min-h-[600px] rounded-2xl border border-line bg-overlay backdrop-blur-xl shadow-elevation-4 flex items-center justify-center animate-pulse">
          <Loader2 className="size-8 animate-spin text-brand" />
        </div>
      }
    >
      <AccountCenterContent {...props} />
    </Suspense>
  );
}

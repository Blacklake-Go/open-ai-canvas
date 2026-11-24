'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocation } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import AuthModal from '@/components/AuthModal';
import UserOnboardingModal from '@/components/auth/UserOnboardingModal';
import DeletionGracePeriodModal from '@/components/auth/DeletionGracePeriodModal';
import UserDropdownMenu from '@/components/UserDropdownMenu';
import AccountModal from '@/components/account/AccountModal';
import SubscriptionModal from '@/components/subscription/SubscriptionModal';
import { useBranding } from '@/lib/hooks/useBranding';
import { useUserSession } from '@/lib/hooks/useUserSession';
import { getAuthRoutes } from '@/lib/authCopy';
import { DEFAULT_LOCALE, getCommonCopy, getLocaleConfig, matchPathLocale, normalizeLocale, localizeStudioPath } from '@/lib/locales';
import BrandLogo from '@/components/site/BrandLogo';
import HeaderThemeToggle from '@/components/site/HeaderThemeToggle';
import GenerationRiverControl from '@/components/generation-river/GenerationRiverControl';
import TopMegaNavigation from '@/components/navigation/TopMegaNavigation';
import MobileTopNavigation from '@/components/navigation/MobileTopNavigation';

export function BrandMark({ compact = false, locale = null, className = '' }) {
  const { brand } = useBranding();
  const pathname = usePathname();
  const getCookieLocale = () => {
    if (typeof document === 'undefined') return null;
    const m = document.cookie.match(/(?:^|;\s*)(?:NEXT_LOCALE|locale)=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  };
  const activeLocale = normalizeLocale(locale || matchPathLocale(pathname) || getCookieLocale() || DEFAULT_LOCALE);
  const homeHref = activeLocale === 'zh-CN' ? '/' : (getLocaleConfig(activeLocale).rootPath || '/');
  const logoHref = brand?.logoHref && brand.logoHref !== '/' ? brand.logoHref : homeHref;
  const logoTarget = brand?.logoTarget || '_self';

  return (
    <Link
      href={logoHref}
      target={logoTarget}
      className={cn("group inline-flex items-center gap-2.5 cursor-pointer shrink-0", className)}
      aria-label={`${brand?.brandName || 'supdance'} Studio`}
    >
      <BrandLogo
        brand={brand}
        className="inline-flex min-w-0 max-w-full items-center gap-2.5 [&>span:first-child]:min-w-0 [&>span:first-child]:group-hover:scale-105"
        imageClassName="h-full w-auto max-h-8 max-w-full object-contain"
        nameClassName="truncate font-jost text-sm font-bold tracking-tight text-ink"
      />
    </Link>
  );
}

export function PageEyebrow({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-brand-line bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand">
      {children}
    </span>
  );
}

/**
 * 全站统一固定顶栏组件 (Site-Wide Unified Fixed Top Navigation)
 * 严格遵循 UI_DESIGN_SYSTEM.md 规范：固定高度 56px (h-14)，fixed top-0，半透明毛玻璃底色
 */
export default function StudioHeader({
  title,
  subtitle,
  locale = null,
  activeTab = null,
  backHref = null,
  backLabel = null,
  showBack = false,
  showCommunity = true,
  customNavItems = null,
  headerVariant = 'default',
  initialAccountTab = null,
  initialUser = undefined,
  className = '',
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { search, hash } = useLocation();
  const { user, credits, entitlements, mutate } = useUserSession(initialUser);

  const getCookieLocale = () => {
    if (typeof document === 'undefined') return null;
    const m = document.cookie.match(/(?:^|;\s*)(?:NEXT_LOCALE|locale)=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  };

  const activeLocale = normalizeLocale(
    locale ||
    matchPathLocale(pathname) ||
    getCookieLocale() ||
    user?.locale ||
    DEFAULT_LOCALE
  );
  const copy = getCommonCopy(activeLocale);
  const studioHref = localizeStudioPath(activeLocale);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountModalTab, setAccountModalTab] = useState('price-details');
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const onboardingPromptedRef = useRef(false);

  // 针对未完成新用户引导的登录用户，主动推送轻量资料设置与额度领取弹窗
  useEffect(() => {
    if (user && user.onboardingCompleted === false && !onboardingPromptedRef.current) {
      const dismissed = typeof window !== 'undefined' && sessionStorage.getItem('supdance_onboarding_dismissed');
      if (!dismissed) {
        setShowOnboardingModal(true);
        onboardingPromptedRef.current = true;
      }
    }
  }, [user]);

  // 统一认证路由跳转（彻底弃用旧版弹窗，直达带动效背景的专属认证页面）
  const handleOpenAuth = useCallback((mode = 'login') => {
    const authRoutes = getAuthRoutes(activeLocale);
    const cleanPath = pathname ? `${pathname}${search}${hash}` : authRoutes.studioUrl;
    const baseTarget = mode === 'register' ? authRoutes.registerUrl : authRoutes.loginUrl;
    router.push(`${baseTarget}?redirect=${encodeURIComponent(cleanPath)}`);
  }, [activeLocale, pathname, search, hash, router]);

  // 跨组件事件监听：唤起账户悬浮窗与会员订阅浮窗
  useEffect(() => {
    const handleOpen = (e) => {
      const tab = e.detail?.tab;
      if (tab === 'membership' || tab === 'subscription') {
        setIsSubscriptionModalOpen(true);
        return;
      }
      if (tab) setAccountModalTab(tab);
      setIsAccountModalOpen(true);
    };
    const handleOpenSub = () => {
      setIsSubscriptionModalOpen(true);
    };
    window.addEventListener('open-account-modal', handleOpen);
    window.addEventListener('open-subscription-modal', handleOpenSub);
    return () => {
      window.removeEventListener('open-account-modal', handleOpen);
      window.removeEventListener('open-subscription-modal', handleOpenSub);
    };
  }, []);

  // 允许带有账户操作参数的页面直接打开对应 Tab
  useEffect(() => {
    if (!initialAccountTab) return;
    setAccountModalTab(initialAccountTab);
    setIsAccountModalOpen(true);
  }, [initialAccountTab]);

  const resolvedActiveTab = activeTab || (
    pathname === '/community' || pathname?.startsWith('/community/') || pathname === '/zh/community' || pathname?.startsWith('/zh/community/')
      ? 'community'
      : (pathname === '/creations' ? 'creations' : null)
  );

  return (
    <>
      {/* 1. 固定顶栏 (Fixed Top Header - h-14, 56px) */}
      <header
        className={cn(
          "fixed top-0 inset-x-0 z-header h-14 bg-surface-glass border-b border-line-subtle px-3 sm:px-4 backdrop-blur-md flex items-center justify-between gap-2 sm:gap-4 select-none",
          className
        )}
      >
        {/* 左侧：移动端汉堡菜单 + 返回按钮 + BrandMark + 全局 TopMegaNavigation */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <MobileTopNavigation locale={activeLocale} activeTab={resolvedActiveTab} customItems={customNavItems} />

          {showBack && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Link
                href={backHref || studioHref}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-wash hover:text-ink"
              >
                <ArrowLeft className="size-4" />
                <span className="hidden sm:inline">{backLabel || copy.shell?.studioFallback || '返回'}</span>
              </Link>
              <div className="hidden h-4 w-px bg-line-subtle sm:block" />
            </div>
          )}

          <BrandMark compact locale={activeLocale} className="min-w-0 shrink lg:shrink-0" />

          {/* 桌面端水平 Mega Menu 导航 (全站统一穿透，支持图像/视频/音频/智能体/社区/关于) */}
          {customNavItems ? (
            <nav className="ml-1 hidden items-center gap-1 sm:ml-6 lg:flex sm:gap-2">
              {customNavItems.map((item) => {
                const isActive = item.active ?? (item.activePath && (pathname === item.activePath || pathname?.startsWith(`${item.activePath}/`)));
                return (
                  <Link
                    key={`${item.href}-${item.label}`}
                    href={item.href}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm',
                      isActive ? 'bg-wash-strong text-ink font-semibold' : 'text-ink-muted hover:bg-wash hover:text-ink'
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          ) : (
            <div className="hidden lg:flex items-center min-w-0 flex-1 ml-2">
              <TopMegaNavigation
                activeTab={resolvedActiveTab}
                locale={activeLocale}
              />
            </div>
          )}

          {/* 页面专有标题/副标题（仅在有特定传入且大屏留白充足时作为次级面包屑展示） */}
          {title && (
            <div className="hidden min-w-0 xl:block ml-2 border-l border-line-subtle pl-3">
              <div className="truncate text-xs font-semibold tracking-[-0.01em] text-ink">{title}</div>
              {subtitle && <div className="truncate text-[11px] text-ink-muted">{subtitle}</div>}
            </div>
          )}
        </div>

        {/* 右侧固定功能区 (额度、提醒、语言切换、用户头像 / 登录) */}
        <div className="flex-shrink-0 flex items-center gap-2">
          <GenerationRiverControl key={user?.id || 'guest'} userId={String(user?.id || '')} locale={activeLocale} />
          <HeaderThemeToggle locale={activeLocale} />
          <UserDropdownMenu
            key={user?.id || 'guest'}
            user={user}
            credits={credits}
            entitlements={entitlements}
            locale={activeLocale}
            onOpenSettings={() => {
              setAccountModalTab('settings');
              setIsAccountModalOpen(true);
            }}
            onOpenAccount={(tab) => {
              if (tab === 'membership' || tab === 'subscription') {
                setIsSubscriptionModalOpen(true);
              } else {
                setAccountModalTab(tab);
                setIsAccountModalOpen(true);
              }
            }}
            onOpenSubscription={() => setIsSubscriptionModalOpen(true)}
            onLogout={async () => {
              try {
                await fetch('/api/auth/logout', { method: 'POST' });
              } catch {}
              mutate({ user: null, credits: null, entitlements: null });
              setIsAccountModalOpen(false);
              if (typeof window !== 'undefined') {
                window.location.href = '/';
              }
            }}
            onOpenAuth={() => handleOpenAuth('login')}
          />
        </div>
      </header>

      {/* 2. 占位垫高层 (Fixed Header Spacer - 占据文档流固定 56px 高度，杜绝页面内容被遮挡) */}
      <div className="h-14 shrink-0 w-full pointer-events-none select-none" aria-hidden="true" />

      {/* 4. 全局认证模态框 */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={(loggedInUser) => {
            setShowAuthModal(false);
            if (loggedInUser) {
              mutate({
                user: loggedInUser,
                credits: loggedInUser.credits ?? credits,
              });
            }
          }}
        />
      )}

      {/* 5. 独立会员订阅浮层 */}
      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => {
          setIsSubscriptionModalOpen(false);
          mutate();
        }}
        user={user}
        onOpenAuth={() => handleOpenAuth('login')}
      />

      {/* 6. 个人中心悬浮窗 (支持未登录访客直达价格表) */}
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        initialTab={accountModalTab}
        user={user}
        credits={credits}
        onOpenAuth={() => handleOpenAuth('login')}
      />

      {/* 7. 新用户资料与额度引导弹窗 */}
      {showOnboardingModal && user && (
        <UserOnboardingModal
          user={user}
          onComplete={(updatedUser) => {
            setShowOnboardingModal(false);
            if (updatedUser) {
              mutate({
                user: updatedUser,
                credits: updatedUser.credits ?? credits,
              });
            }
          }}
          onClose={() => {
            setShowOnboardingModal(false);
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('supdance_onboarding_dismissed', '1');
            }
          }}
        />
      )}

      {/* 8. 注销 3 天后悔保护期弹窗 */}
      {user?.isDeletionPending && (
        <DeletionGracePeriodModal
          user={user}
          onCancelled={() => {
            mutate();
          }}
          onLogout={() => {
            mutate(null);
            window.location.href = '/';
          }}
        />
      )}
    </>
  );
}

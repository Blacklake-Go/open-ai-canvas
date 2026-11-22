'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Menu, X, ChevronRight, Crown, ExternalLink, Workflow, MessageSquarePlus } from 'lucide-react';
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
import { DEFAULT_LOCALE, getCommonCopy, getLocaleConfig, getLocaleFromPathname, matchPathLocale, normalizeLocale, localizeStudioPath } from '@/lib/locales';
import BrandLogo from '@/components/site/BrandLogo';
import TopMegaNavigation from '@/components/navigation/TopMegaNavigation';
import { getMegaNavCategories } from '@/config/mega-navigation';
import NavIcon from '@/components/navigation/NavIcon';
import NavBadge from '@/components/navigation/NavBadge';

export function BrandMark({ compact = false, locale = null }) {
  const { brand } = useBranding();
  const pathname = usePathname();
  const getCookieLocale = () => {
    if (typeof document === 'undefined') return null;
    const m = document.cookie.match(/(?:^|;\s*)(?:NEXT_LOCALE|locale)=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  };
  const activeLocale = normalizeLocale(locale || matchPathLocale(pathname) || getCookieLocale() || DEFAULT_LOCALE);
  const homeHref = '/';
  const logoHref = brand?.logoHref || homeHref;
  const logoTarget = brand?.logoTarget || '_self';

  return (
    <Link
      href={logoHref}
      target={logoTarget}
      className="group inline-flex items-center gap-2.5 cursor-pointer shrink-0"
      aria-label={`${brand?.brandName || 'supdance'} Studio`}
    >
      <BrandLogo brand={brand} className="inline-flex items-center gap-2.5 [&>span:first-child]:group-hover:scale-105" />
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
  const { brand } = useBranding();
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
  const categories = getMegaNavCategories(activeLocale);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountModalTab, setAccountModalTab] = useState('price-details');
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
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
    const cleanPath = pathname || authRoutes.studioUrl;
    const baseTarget = mode === 'register' ? authRoutes.registerUrl : authRoutes.loginUrl;
    router.push(`${baseTarget}?redirect=${encodeURIComponent(cleanPath)}`);
  }, [activeLocale, pathname, router]);

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

  // 路由变化时自动收起移动端抽屉
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

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
          {/* 移动端抽屉开关 (lg:hidden) */}
          <button
            type="button"
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="lg:hidden shrink-0 flex size-9 items-center justify-center rounded-lg text-ink-muted hover:bg-wash hover:text-ink transition-colors cursor-pointer"
            aria-label={copy.shell?.toggleNavMenu || '菜单'}
          >
            <Menu className="size-5" />
          </button>

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

          <BrandMark compact locale={activeLocale} />

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
          <UserDropdownMenu
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

      {/* 3. 移动端全功能滑出抽屉 (Mobile Drawer - 移动端全面享有各分类工具入口) */}
      {isMobileOpen && (
        <>
          <div
            className="fixed inset-0 z-sticky bg-scrim backdrop-blur-sm lg:hidden animate-fade-in"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="fixed bottom-0 left-0 top-14 z-drawer w-72 max-w-[85vw] bg-surface-glass border-r border-line-subtle backdrop-blur-xl flex flex-col p-4 overflow-y-auto custom-scrollbar lg:hidden animate-in slide-in-from-left duration-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-line-subtle mb-3">
              <span className="text-body-sm font-semibold text-ink">导航菜单</span>
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-wash cursor-pointer"
                aria-label="关闭菜单"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4">
              <Link
                href={studioHref}
                onClick={() => setIsMobileOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-body-sm font-medium text-ink hover:bg-wash transition-colors"
              >
                <NavIcon name="sparkles" className="size-4 text-brand" />
                <span>创作工作台</span>
              </Link>

              {/* 无限画布 (独立二号白板工作台) */}
              <Link
                href="/canvas"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsMobileOpen(false)}
                className="flex items-center justify-between px-3 py-2 rounded-xl text-body-sm font-medium text-ink hover:bg-wash transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Workflow className="size-4 text-brand" />
                  <span>{activeLocale.startsWith('zh') ? '无限画布' : 'Infinite Canvas'}</span>
                </div>
                <ExternalLink className="size-3.5 text-ink-muted" />
              </Link>

              {/* 👑 VIP 会员与算力套餐 (移动端专属高亮入口) */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileOpen(false);
                  setIsSubscriptionModalOpen(true);
                }}
                className="flex w-full items-center justify-between px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border border-amber-500/30 text-amber-300 font-semibold text-body-sm hover:border-amber-500/50 hover:bg-amber-500/20 transition-all cursor-pointer shadow-elevation-1 active:scale-98"
              >
                <div className="flex items-center gap-2.5">
                  <Crown className="size-4 text-amber-400" />
                  <span>VIP 会员与算力套餐</span>
                </div>
                <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-black text-black">
                  82% OFF
                </span>
              </button>

              {categories.map((cat) => {
                const hasFeatures = Array.isArray(cat.features) && cat.features.length > 0;

                if (!hasFeatures) {
                  const isDirectActive = pathname === cat.href || pathname === `${cat.href}/`;
                  return (
                    <Link
                      key={cat.id}
                      href={cat.href}
                      onClick={() => setIsMobileOpen(false)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-body-sm font-medium transition-colors ${
                        isDirectActive ? 'bg-wash-strong text-ink' : 'text-ink hover:bg-wash'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <NavIcon name="sparkles" className="size-4 text-brand" />
                        <span>{cat.label}</span>
                      </div>
                      {cat.badge && <NavBadge badge={cat.badge} />}
                    </Link>
                  );
                }

                return (
                  <div key={cat.id} className="space-y-1">
                    <div className="px-3 text-caption font-bold text-ink-muted uppercase tracking-wider">
                      {cat.label}
                    </div>
                    <div className="space-y-0.5">
                      {cat.features?.map((feat) => (
                        <Link
                          key={feat.id}
                          href={feat.href}
                          onClick={() => setIsMobileOpen(false)}
                          className="flex items-center justify-between px-3 py-2 rounded-xl text-caption text-ink-muted hover:text-ink hover:bg-wash transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <NavIcon name={feat.icon} className="size-3.5" />
                            <span>{feat.label}</span>
                          </div>
                          {feat.badge && <NavBadge badge={feat.badge} />}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div className="pt-2 border-t border-line-subtle space-y-1">
                <Link
                  href={activeLocale.startsWith('zh') ? '/zh/community' : '/community'}
                  onClick={() => setIsMobileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-body-sm font-medium text-ink hover:bg-wash transition-colors"
                >
                  <NavIcon name="flame" className="size-4 text-amber-400" />
                  <span>{activeLocale.startsWith('zh') ? '灵感社区' : 'Community'}</span>
                </Link>
                <Link
                  href="/feedback"
                  onClick={() => setIsMobileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-body-sm font-medium text-ink hover:bg-wash transition-colors"
                >
                  <MessageSquarePlus className="size-4 text-brand" />
                  <span>{copy?.topNav?.feedback || (activeLocale.startsWith('zh') ? '建议与需求' : 'Feedback')}</span>
                </Link>
                <Link
                  href={activeLocale.startsWith('zh') ? '/zh/about' : '/about'}
                  onClick={() => setIsMobileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-body-sm font-medium text-ink hover:bg-wash transition-colors"
                >
                  <NavIcon name="sparkles" className="size-4 text-sky-400" />
                  <span>{activeLocale.startsWith('zh') ? '关于本站' : 'About'}</span>
                </Link>
              </div>
            </div>
          </aside>
        </>
      )}

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

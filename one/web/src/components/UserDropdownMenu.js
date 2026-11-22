'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  UserRound,
  WalletCards,
  Settings,
  Globe,
  ShieldCheck,
  LogOut,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Activity,
  Crown,
  Bell,
  Check,
  Zap,
  KeyRound,
  Coins,
} from 'lucide-react';
import { DEFAULT_LOCALE, normalizeLocale, LOCALE_CONFIGS, SUPPORTED_LOCALES, getCommonCopy } from '@/lib/locales';
import { getAuthRoutes } from '@/lib/authCopy';
import { switchLocale } from '@/lib/client/localeSwitch';
import { openGlobalAccountModal } from '@/lib/accountEvents';
import SubscriptionModal from '@/components/subscription/SubscriptionModal';
import AvatarFrame from '@/components/profile/AvatarFrame';
import UserAvatar from '@/components/ui/UserAvatar';
import { FOCUS_RING } from 'studio/ui/tokens';

const LANGUAGE_FLAGS = {
  en: '/flags/en.svg',
  'zh-CN': '/flags/zh-cn.svg',
  'zh-TW': '/flags/zh-tw.svg',
  'ja-JP': '/flags/ja.svg',
  'ko-KR': '/flags/ko.svg',
  es: '/flags/es.svg',
};

const LANGUAGE_LIST = SUPPORTED_LOCALES.map((code) => ({
  code,
  label: LOCALE_CONFIGS[code]?.nativeName || code,
  flag: LANGUAGE_FLAGS[code] || '/flags/en.svg',
  native: LOCALE_CONFIGS[code]?.nativeName || code,
}));

/**
 * 全站高级用户头像、功能胶囊群与悬浮动效菜单组件 (UserDropdownMenu)
 * 严格参考参考图视觉规范：
 * 1. AI 3D 预演特色动态胶囊
 * 2. 消息通知中心铃铛 (带真实未读粉红角标与通知浮层)
 * 3. 会员订阅高亮胶囊 (带 👑 皇冠图标与高亮「最低18折」折角标签)
 * 4. 算力/积分额度胶囊 (带 📦 图标与 FREE/PRO 状态)
 * 5. 全站用户头像 (带微光动效、在线呼吸灯与丝滑悬浮展开面板)
 */
export default function UserDropdownMenu({
  user,
  credits = null,
  entitlements = null,
  locale = 'zh',
  onOpenSettings,
  onOpenAccount,
  onOpenSubscription,
  onLogout,
  onOpenAuth,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [liveAvatar, setLiveAvatar] = useState(null);
  const [userEntitlements, setUserEntitlements] = useState(
    entitlements || (typeof window !== 'undefined' ? (() => {
      try {
        const stored = localStorage.getItem('ko_entitlements');
        return stored ? JSON.parse(stored) : null;
      } catch { return null; }
    })() : null)
  );
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [kcoins, setKcoins] = useState(0);
  const [dailyLoginClaimed, setDailyLoginClaimed] = useState(false);

  const menuRef = useRef(null);
  const notifRef = useRef(null);
  const langRef = useRef(null);
  const router = useRouter();
  const pathname = usePathname();

  const getCookieLocale = () => {
    if (typeof document === 'undefined') return null;
    const m = document.cookie.match(/(?:^|;\s*)(?:NEXT_LOCALE|locale)=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  };
  const activeLocale = normalizeLocale(locale || user?.locale || getCookieLocale() || DEFAULT_LOCALE);
  const activeLanguage = LANGUAGE_LIST.find((item) => item.code === activeLocale) || LANGUAGE_LIST[0];
  const authRoutes = getAuthRoutes(activeLocale);
  const profileUrl = authRoutes.profileUrl || (activeLocale.startsWith('zh') ? '/zh/profile' : '/profile');
  const copy = getCommonCopy(activeLocale);
  const t = copy.userMenu || {};
  const coinsHref = activeLocale.startsWith('zh') ? '/zh/coins' : '/coins';

  // 统一打开个人中心弹窗
  const handleOpenAccountModal = useCallback((tab = 'price-details') => {
    setIsMenuOpen(false);
    setIsNotifOpen(false);
    if (onOpenAccount) {
      onOpenAccount(tab);
    } else {
      openGlobalAccountModal(tab);
    }
  }, [onOpenAccount]);

  // 统一打开会员订阅弹窗
  const handleOpenSubscriptionModal = useCallback(() => {
    setIsMenuOpen(false);
    setIsNotifOpen(false);
    if (onOpenSubscription) {
      onOpenSubscription();
    } else {
      setIsSubscriptionModalOpen(true);
    }
  }, [onOpenSubscription]);

  // 加载真实用户通知与未读数 (前后端真实联调)
  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    try {
      const res = await fetch('/api/user/notifications', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
        setUnreadCount(Number(data.unreadCount || 0));
      }
    } catch {
      // 网络静默容错
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // 加载用户专属 K 币余额与今日登录打卡状态
  const fetchCoinStatus = useCallback(async () => {
    if (!user) {
      setKcoins(0);
      setDailyLoginClaimed(false);
      return;
    }
    try {
      const res = await fetch('/api/financial/currency/daily-login', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setKcoins(Number(data.balance || 0));
        setDailyLoginClaimed(Boolean(data.claimed));
      }
    } catch {}
  }, [user]);

  useEffect(() => {
    fetchCoinStatus();
  }, [fetchCoinStatus]);

  // 点击头像或金币胶囊时，自动检查/触发每日登录 1 枚 K 币奖励
  const triggerDailyLoginReward = useCallback(async () => {
    if (!user || dailyLoginClaimed) return;
    try {
      const res = await fetch('/api/financial/currency/daily-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.isFirstToday) {
          setKcoins(Number(data.balance || 0));
          setDailyLoginClaimed(true);
        } else if (data.claimed) {
          setDailyLoginClaimed(true);
        }
      }
    } catch {}
  }, [user, dailyLoginClaimed]);

  // 同步外部传入的 entitlements 方案
  useEffect(() => {
    if (entitlements) {
      setUserEntitlements(entitlements);
    }
  }, [entitlements]);

  // 加载当前用户订阅套餐方案与权益（若外部已有则直接复用，避免重复网络调用与二次跳闪）
  useEffect(() => {
    if (!user) {
      setUserEntitlements(null);
      return;
    }
    if (entitlements) {
      setUserEntitlements(entitlements);
      return;
    }
    let cancelled = false;
    fetch('/api/billing/entitlements', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.entitlements) {
          setUserEntitlements(data.entitlements);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, entitlements]);

  // 全部标记已读
  const handleMarkAllAsRead = async () => {
    try {
      const res = await fetch('/api/user/notifications', { method: 'POST' });
      if (res.ok) {
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      }
    } catch {}
  };

  // 监听全站用户资料与头像更新广播 (0 延迟即时生效)
  useEffect(() => {
    const handleProfileUpdate = (e) => {
      if (e.detail?.avatarUrl !== undefined) {
        setLiveAvatar(e.detail.avatarUrl);
      } else if (e.detail?.user?.avatar_url !== undefined) {
        setLiveAvatar(e.detail.user.avatar_url);
      }
    };
    window.addEventListener('user-profile-updated', handleProfileUpdate);
    return () => {
      window.removeEventListener('user-profile-updated', handleProfileUpdate);
    };
  }, []);

  // 监听全局 open-subscription-modal 事件
  useEffect(() => {
    const handleOpenSub = () => {
      handleOpenSubscriptionModal();
    };
    window.addEventListener('open-subscription-modal', handleOpenSub);
    return () => {
      window.removeEventListener('open-subscription-modal', handleOpenSub);
    };
  }, [handleOpenSubscriptionModal]);

  // 点击外部收起
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
      if (langRef.current && !langRef.current.contains(event.target)) {
        setIsLangOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
        setIsNotifOpen(false);
        setIsLangOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 路由跳转时自动关闭
  useEffect(() => {
    setIsMenuOpen(false);
    setIsNotifOpen(false);
    setIsLangOpen(false);
  }, [pathname]);

  // 复制 6 位不可变数字 ID
  const handleCopyUserNumber = (num, e) => {
    e?.stopPropagation();
    if (!num) return;
    navigator.clipboard?.writeText?.(String(num));
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 1800);
  };

  // 语言切换与持久化写入数据库
  const toggleLanguage = async (targetLocaleOverride = null) => {
    const nextLocale = targetLocaleOverride || (activeLocale === 'zh-CN' ? 'en' : 'zh-CN');
    const currentPath = pathname || (typeof window !== 'undefined' ? window.location.pathname : '/');
    const search = typeof window !== 'undefined' ? (window.location.search || '') : '';
    setIsMenuOpen(false);
    // cookie、偏好落库与 URL 前缀改写交给唯一实现 lib/client/localeSwitch.js。
    switchLocale({ targetLocale: normalizeLocale(nextLocale), pathname: currentPath, search });
  };

  // 退出登录
  const handleLogoutClick = async () => {
    setIsMenuOpen(false);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    if (onLogout) await onLogout();
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  // 计算展示数据
  const displayName = user?.displayName || user?.display_name || user?.email?.split('@')[0] || (t.displayNameFallback || 'Creator');
  const userNumber = user?.userNumber || user?.user_number;
  const avatarUrl = liveAvatar !== null ? liveAvatar : (user?.avatar || user?.avatar_url);
  const initialLetter = displayName.slice(0, 1).toUpperCase();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const effectiveCredits = credits !== null ? credits : (user?.credits ?? 0);

  // 计算订阅套餐徽章展示 (未订阅显示基础版/FREE，已订阅显示对应套餐名)
  const isPaidPlan = Boolean(
    userEntitlements?.isPaidSubscription ||
    (user?.plan_id && String(user.plan_id).toLowerCase() !== 'free') ||
    user?.is_subscribed
  );
  const rawPlanId = String(userEntitlements?.planId || user?.plan_id || 'free').toLowerCase();
  let planBadgeText = t.freePlan || 'FREE';
  if (isPaidPlan) {
    if (rawPlanId.includes('starter')) planBadgeText = 'STARTER';
    else if (rawPlanId.includes('basic')) planBadgeText = 'BASIC';
    else if (rawPlanId.includes('plus')) planBadgeText = 'PLUS';
    else if (rawPlanId.includes('pro')) planBadgeText = 'PRO';
    else planBadgeText = (userEntitlements?.planName || t.vipPlan || 'VIP').slice(0, 7).toUpperCase();
  }

  return (
    <>
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* 1. 消息通知中心铃铛 (仅登录用户显示，带粉红未读角标) */}
      {user && (
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => {
              setIsNotifOpen((prev) => !prev);
              setIsMenuOpen(false);
            }}
            className={`${FOCUS_RING} relative flex size-control-sm items-center justify-center rounded-lg border transition-[background-color,border-color,color] duration-fast ease-standard cursor-pointer ${
              isNotifOpen
                ? 'border-brand-line bg-brand-soft text-brand-text'
                : 'border-line-subtle bg-wash text-ink-muted hover:border-line hover:bg-wash-strong hover:text-ink'
            }`}
            aria-label={t.notificationsHeading || 'Notifications'}
            title={t.notificationsTitle || 'Notification Center'}
          >
            <Bell className="size-3.5" strokeWidth={1.8} />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-danger-line bg-danger-soft px-1 text-micro font-semibold text-danger">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* 通知中心悬浮弹层 */}
          {isNotifOpen && (
            <div
              data-state="open"
              className="glass-popover absolute right-0 top-full z-popover mt-2 w-[310px] overflow-hidden p-3 text-ink"
            >
              <div className="flex items-center justify-between border-b border-line-subtle pb-2 px-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
                  <Bell className="size-3.5 text-brand-text" strokeWidth={1.8} />
                  <span>{t.notificationsHeading || 'Notifications'}</span>
                  {unreadCount > 0 && (
                    <span className="rounded-md border border-brand-line bg-brand-soft px-1.5 py-0.5 font-mono text-micro text-brand-text">
                      {unreadCount}
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllAsRead}
                    className="control-focus flex items-center gap-1 rounded-md px-1 text-caption text-ink-muted transition-colors duration-fast hover:text-ink cursor-pointer"
                  >
                    <Check className="size-3.5" strokeWidth={1.8} />
                    <span>{t.markAllRead || 'Mark all read'}</span>
                  </button>
                )}
              </div>

              {/* 消息列表 */}
              <div className="mt-2 max-h-72 overflow-y-auto space-y-1.5 pr-0.5">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-ink-subtle">
                    {t.emptyNotifications || 'No notifications'}
                  </div>
                ) : (
                  notifications.map((n) => (
                    <Link
                      key={n.id}
                      href={n.link_url || '#'}
                      onClick={() => setIsNotifOpen(false)}
                      className={`block rounded-lg p-2.5 text-caption transition-colors duration-fast ${
                        n.is_read
                          ? 'bg-wash text-ink-muted hover:bg-wash-strong hover:text-ink'
                          : 'border border-brand-line bg-brand-soft text-ink hover:bg-brand-pressed'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <p className="font-semibold text-ink truncate">{n.title}</p>
                        {!n.is_read && (
                          <span className="size-1.5 shrink-0 rounded-full bg-brand mt-1" />
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-caption text-ink-muted leading-relaxed">
                        {n.content}
                      </p>
                    </Link>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. 会员方案与算力状态展示：已付费用户合并展示套餐与算力（消除双重 STARTER 冗余），免费用户展示高亮升级与基础额度 */}
      {user && (
        !isPaidPlan ? (
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* 未订阅用户：高亮会员升级优惠入口 */}
            <button
              type="button"
              onClick={handleOpenSubscriptionModal}
              className={`${FOCUS_RING} hidden h-control-sm select-none items-center gap-1.5 rounded-lg border border-brand-line bg-brand-soft px-2.5 text-label font-semibold text-brand-text transition-[background-color,border-color,color] duration-fast ease-standard hover:border-brand hover:bg-brand-pressed active:scale-[0.98] active:duration-press cursor-pointer sm:flex sm:px-3`}
              title={t.membership || 'Membership Subscription'}
            >
              <Crown className="size-3.5 shrink-0" strokeWidth={1.8} />
              <span className="font-semibold">{t.vipPlan || 'VIP'}</span>
              {!isPaidPlan && (
                <>
                  <span className="mx-0.5 hidden h-3 w-px bg-brand-line xs:inline-block" />
                  <span className="hidden text-caption font-medium tabular-nums xs:inline-block">
                    {t.discountTag || '82% OFF'}
                  </span>
                </>
              )}
            </button>

            {/* 免费额度胶囊 */}
            <button
              type="button"
              onClick={() => handleOpenAccountModal('membership')}
              className={`${FOCUS_RING} hidden h-control-sm select-none items-center gap-1.5 rounded-lg border border-line-subtle bg-wash px-2.5 text-label font-medium text-ink transition-[background-color,border-color,color] duration-fast ease-standard hover:border-line hover:bg-wash-strong active:scale-[0.98] active:duration-press cursor-pointer sm:flex sm:px-3`}
              title={t.membership || 'Subscription & Quota Usage'}
            >
              <Zap className="size-3.5 shrink-0 text-ink-muted" strokeWidth={1.8} />
              <span className="font-mono font-semibold tabular-nums text-ink">{effectiveCredits}</span>
              <span className="rounded-sm border border-line-subtle bg-wash-strong px-1.5 py-0.5 text-micro font-semibold uppercase tracking-wide text-ink-muted">
                {planBadgeText}
              </span>
            </button>
          </div>
        ) : (
          /* 已订阅付费用户：统一合并为尊贵套餐与算力胶囊，彻底消除双重 STARTER 冗余 */
          <button
            type="button"
            onClick={handleOpenSubscriptionModal}
            className={`${FOCUS_RING} hidden h-control-sm select-none items-center gap-2 rounded-lg border border-brand-line bg-brand-soft px-2.5 text-label font-medium text-brand-text transition-[background-color,border-color,color] duration-fast ease-standard hover:border-brand hover:bg-brand-pressed active:scale-[0.98] active:duration-press cursor-pointer sm:flex sm:px-3`}
            title={t.membership || 'Subscription & Quota Usage'}
          >
            <div className="flex items-center gap-1.5">
              <Crown className="size-3.5 shrink-0" strokeWidth={1.8} />
              <span className="font-semibold tracking-wide">{planBadgeText}</span>
            </div>
            <span className="h-3 w-px shrink-0 bg-brand-line" />
            <div className="flex items-center gap-1">
              <Zap className="size-3 shrink-0" strokeWidth={1.8} />
              <span className="font-mono font-semibold tabular-nums text-ink">{effectiveCredits}</span>
            </div>
          </button>
        )
      )}

      {/* 3. 语言切换：显示地球图标、当前语言原生名称与下拉指示箭头，方便即时识别与一键切换 */}
      <div className="relative inline-block" ref={langRef}>
        <button
          type="button"
          onClick={(e) => {
            e?.preventDefault?.();
            e?.stopPropagation?.();
            setIsLangOpen((prev) => !prev);
            setIsMenuOpen(false);
            setIsNotifOpen(false);
          }}
          className={`${FOCUS_RING} flex h-control-sm select-none items-center gap-1.5 rounded-lg border px-2.5 text-label font-medium transition-[background-color,border-color,color] duration-fast ease-standard active:scale-[0.98] active:duration-press cursor-pointer ${
            isLangOpen
              ? 'border-brand-line bg-brand-soft text-ink'
              : 'border-line-subtle bg-wash text-ink-muted hover:border-line hover:bg-wash-strong hover:text-ink'
          }`}
          aria-label={t.interfaceLanguage || 'Language'}
          aria-expanded={isLangOpen}
          aria-haspopup="menu"
          title={t.interfaceLanguage || 'Language'}
        >
          <Globe className="size-3.5 shrink-0" strokeWidth={1.8} />
          <span className="text-ink">{activeLanguage.native}</span>
          <ChevronDown
            className={`size-3.5 shrink-0 text-ink-subtle transition-transform duration-fast ease-standard ${isLangOpen ? 'rotate-180' : ''}`}
            strokeWidth={1.8}
          />
        </button>

        {/* 语言选择下拉浮层 */}
        {isLangOpen && (
          <div
            data-state="open"
            className="popover-surface absolute right-0 top-full z-dropdown mt-2 w-44 p-1.5 text-ink"
            role="menu"
            aria-label={t.interfaceLanguage || 'Language'}
          >
            <div className="mb-1 flex items-center justify-between border-b border-line-subtle px-3 py-1.5 text-micro font-semibold uppercase tracking-wide text-ink-subtle">
              <span>{t.interfaceLanguage || 'Language'}</span>
              <span className="font-mono text-ink-subtle">i18n</span>
            </div>
            <div className="space-y-0.5">
              {LANGUAGE_LIST.map((item) => {
                const isSelected = activeLocale === item.code || (item.code === 'zh-CN' && activeLocale === 'zh');
                return (
                  <button
                    key={item.code}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isSelected}
                    onClick={() => {
                      setIsLangOpen(false);
                      toggleLanguage(item.code);
                    }}
                    className={`control-focus flex min-h-10 w-full items-center justify-between rounded-md px-3 py-2 text-body transition-none cursor-pointer ${
                      isSelected
                        ? 'bg-wash-press font-medium text-ink'
                        : 'font-normal text-ink-muted hover:bg-wash-strong hover:text-ink'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <img
                        src={item.flag}
                        alt={item.native}
                        className="h-4 w-5 shrink-0 rounded-sm object-cover ring-1 ring-line-subtle"
                      />
                      <span className="truncate">{item.native}</span>
                    </div>
                    {isSelected && <Check className="size-3.5 shrink-0 text-ink-muted" strokeWidth={1.8} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 5. 顶栏隐藏硬币展示：硬币为站点互动道具，保留在下拉菜单与社区中 */}

      {/* 6. 用户头像触发按钮与悬浮菜单 */}
      {!user ? (
        // 未登录状态：直达独立全屏登录页
        <Link
          href={getAuthRoutes(activeLocale).loginUrl}
          className={`${FOCUS_RING} flex h-control-sm items-center gap-1.5 rounded-full border border-transparent bg-brand px-3 text-label font-semibold text-ink-on-accent transition-[background-color,border-color,color] duration-fast ease-standard hover:bg-brand-hover-solid active:scale-[0.98] active:duration-press cursor-pointer`}
        >
          <UserRound className="size-3.5" strokeWidth={1.8} />
          <span>{t.login || 'Log in'}</span>
        </Link>
      ) : (
        <div className="relative inline-block text-left" ref={menuRef}>
          {/* 用户头像圆环触发按钮 */}
          <button
            type="button"
            onClick={() => {
              setIsMenuOpen((prev) => !prev);
              setIsNotifOpen(false);
              triggerDailyLoginReward();
            }}
            aria-expanded={isMenuOpen}
            aria-haspopup="true"
            aria-label={t.displayNameFallback || 'User Menu'}
            className={`${FOCUS_RING} group relative flex items-center gap-2 rounded-full p-0.5 transition-shadow duration-fast ease-standard ${
              isMenuOpen
                ? 'ring-2 ring-brand-ring'
                : 'hover:ring-2 hover:ring-line-strong'
            }`}
          >
            <AvatarFrame frame={userEntitlements?.avatarFrame} className="size-8 shrink-0 bg-surface-raised text-label font-semibold text-brand-text flex items-center justify-center">
              <div className="relative size-full overflow-hidden rounded-full flex items-center justify-center">
                <UserAvatar
                  src={avatarUrl}
                  name={displayName}
                  className="size-full object-cover"
                  fallbackClassName="text-brand-text text-label"
                />
                <span className="absolute bottom-0 right-0 size-2 rounded-full bg-success ring-2 ring-bg-base" />
              </div>
            </AvatarFrame>
          </button>

          {/* 悬浮展开用户菜单面板 */}
          {isMenuOpen && (
            <div
              data-state="open"
              className="glass-popover absolute right-0 top-full z-popover mt-2.5 w-[292px] p-3 text-ink"
              role="menu"
              aria-orientation="vertical"
            >
              {/* (1) 顶部用户信息卡片 (大头像 + 昵称 + 6位UID + 点击进入个人主页 / 编辑资料) */}
              <div className="flex items-center justify-between gap-3 p-1">
                <Link
                  href={profileUrl}
                  onClick={() => setIsMenuOpen(false)}
                  className="control-focus group flex min-w-0 items-center gap-2.5 rounded-lg cursor-pointer"
                  title={t.goToProfile || 'Profile'}
                >
                  <AvatarFrame frame={userEntitlements?.avatarFrame} className="size-11 shrink-0 bg-surface-raised flex items-center justify-center text-base font-semibold text-brand-text">
                    <div className="relative size-full overflow-hidden rounded-full flex items-center justify-center">
                      <UserAvatar
                        src={avatarUrl}
                        name={displayName}
                        className="size-full object-cover"
                        fallbackClassName="text-brand-text text-base"
                      />
                    </div>
                  </AvatarFrame>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-label font-semibold text-ink transition-colors duration-fast group-hover:text-brand-text" title={displayName}>
                        {displayName}
                      </p>
                      {isAdmin && (
                        <span className="rounded-sm border border-brand-line bg-brand-soft px-1.5 py-0.5 text-micro font-semibold text-brand-text">
                          ADMIN
                        </span>
                      )}
                    </div>
                    {/* 不可变 6 位数字 ID 展示与点击复制 */}
                    <div className="mt-0.5 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          handleCopyUserNumber(userNumber || user?.id, e);
                        }}
                        className="control-focus truncate rounded-sm font-mono text-caption text-ink-muted transition-colors duration-fast hover:text-ink cursor-pointer"
                        title={t.copyUid || 'Click to copy UID'}
                      >
                        {userNumber || user?.id ? `UID: ${userNumber || user.id}` : (user?.email || (t.displayNameFallback || 'Creator'))}
                      </button>
                      {copyFeedback && (
                        <span className="text-micro font-medium text-brand-text animate-fade-in">
                          {t.copiedUid || 'Copied'}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>

                {/* 前往编辑资料 */}
                <button
                  type="button"
                  onClick={() => handleOpenAccountModal('settings')}
                  className="control-focus flex shrink-0 items-center gap-0.5 rounded-md px-1 text-caption text-ink-muted transition-colors duration-fast hover:text-ink cursor-pointer"
                  title="修改个人用户名与头像"
                >
                  <span>编辑资料</span>
                  <ChevronRight className="size-3.5" strokeWidth={1.8} />
                </button>
              </div>

              {/* (2) 资产区：硬币与算力彻底分离展示，硬币极简仅显示数量和图标 */}
              <div className="mt-2.5 mb-2 flex items-center gap-2">
                {/* 独立硬币胶囊 (仅显示硬币数量和硬币图标，与算力分离) */}
                <div
                  className="flex h-control-md shrink-0 items-center gap-1.5 rounded-lg border border-brand-line bg-brand-soft px-3 text-brand-text"
                  title="专属硬币余额"
                >
                  <Coins className="size-4 shrink-0" strokeWidth={1.8} />
                  <span className="font-mono text-label font-semibold tabular-nums">{kcoins}</span>
                </div>

                {/* 算力卡片 (仅显示算力与充值/升级入口) */}
                <div className="flex h-control-md flex-1 items-center justify-between rounded-lg border border-line-subtle bg-wash px-2.5 transition-colors duration-fast hover:border-line">
                  <div className="flex items-center gap-1.5">
                    <Zap className="size-3.5 shrink-0 text-brand-text" strokeWidth={1.8} />
                    <span className="font-mono text-label font-semibold text-ink">{effectiveCredits}</span>
                  </div>

                  {/* 充值/升级方案入口 -> 直达会员订阅弹窗 */}
                  <button
                    type="button"
                    onClick={handleOpenSubscriptionModal}
                    className="control-focus flex items-center rounded-md border border-line-subtle bg-wash-strong px-2 py-1 text-caption font-medium text-ink transition-[background-color,border-color,color] duration-fast ease-standard hover:border-line hover:bg-wash-press hover:text-brand-text active:scale-[0.96] active:duration-press cursor-pointer"
                    title="查看个人订阅权益、积分充值与开通"
                  >
                    <span>{t.topUpUpgrade || '充值/升级'}</span>
                  </button>
                </div>
              </div>

              {/* (3) 核心功能列表 */}
              <div className="space-y-0.5 pt-1">
                {/* 1. 个人主页 (作品集与活跃动态) */}
                <Link
                  href={profileUrl}
                  onClick={() => setIsMenuOpen(false)}
                  className="control-focus flex min-h-10 w-full items-center justify-between rounded-md px-3 py-2 text-body text-ink-muted transition-none hover:bg-wash-strong hover:text-ink cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="size-4" strokeWidth={1.8} />
                    <span>{t.goToProfile || 'Creator Profile'}</span>
                  </div>
                  <ChevronRight className="size-3.5 text-ink-subtle" strokeWidth={1.8} />
                </Link>

                {/* 2. 账号与设置 (个人资料、头像、用户名、密码安全、绑定) */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (onOpenSettings) onOpenSettings();
                    else handleOpenAccountModal('settings');
                  }}
                  className="control-focus flex min-h-10 w-full items-center justify-between rounded-md px-3 py-2 text-body text-ink-muted transition-none hover:bg-wash-strong hover:text-ink cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <UserRound className="size-4" strokeWidth={1.8} />
                    <span>{t.accountSettings || '账号与设置'}</span>
                  </div>
                  <ChevronRight className="size-3.5 text-ink-subtle" strokeWidth={1.8} />
                </button>

                {/* 3. 订阅与账单 (整合会员订阅与算力充值，直接跳转到订阅详情页) */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleOpenAccountModal('billing');
                  }}
                  className="control-focus flex min-h-10 w-full items-center justify-between rounded-md px-3 py-2 text-body text-ink-muted transition-none hover:bg-wash-strong hover:text-ink cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Crown className="size-4" strokeWidth={1.8} />
                    <span>订阅与账单</span>
                  </div>
                  <span className="rounded-sm border border-brand-line bg-brand-soft px-1.5 py-0.5 text-micro font-semibold text-brand-text">
                    VIP
                  </span>
                </button>

                {/* 管理员控制台 (仅限管理员) */}
                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setIsMenuOpen(false)}
                    className="control-focus flex min-h-10 w-full items-center justify-between rounded-md px-3 py-2 text-body text-ink-muted transition-none hover:bg-wash-strong hover:text-ink"
                  >
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="size-4" strokeWidth={1.8} />
                      <span>{t.adminConsole || 'Admin Console'}</span>
                    </div>
                    <ChevronRight className="size-3.5 text-ink-subtle" strokeWidth={1.8} />
                  </Link>
                )}

                {/* 9. 修改密码直达入口 */}
                <Link
                  href={getAuthRoutes(activeLocale).changePasswordUrl}
                  onClick={() => setIsMenuOpen(false)}
                  className="control-focus flex min-h-10 w-full items-center justify-between rounded-md px-3 py-2 text-body text-ink-muted transition-none hover:bg-wash-strong hover:text-ink cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <KeyRound className="size-4" strokeWidth={1.8} />
                    <span>{getAuthRoutes(activeLocale).isChinese ? '修改密码' : 'Change Password'}</span>
                  </div>
                  <ChevronRight className="size-3.5 text-ink-subtle" strokeWidth={1.8} />
                </Link>
              </div>

              {/* (4) 底部分割线与退出登录 */}
              <div className="my-1.5 h-px bg-line-subtle" />

              <button
                type="button"
                onClick={handleLogoutClick}
                className="control-focus flex min-h-10 w-full items-center gap-2.5 rounded-md px-3 py-2 text-body text-ink-muted transition-none hover:bg-danger-soft hover:text-danger cursor-pointer"
              >
                <LogOut className="size-4" strokeWidth={1.8} />
                <span>{t.signOut || 'Sign out'}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>

    {/* 独立订阅弹窗浮层 (仅在外部未接管 onOpenSubscription 时作为自包含浮层渲染) */}
    {!onOpenSubscription && (
      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
        user={user}
        onOpenAuth={onOpenAuth}
      />
    )}
    </>
  );
}

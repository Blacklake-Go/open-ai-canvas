'use client';

import React, { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, LogOut, User, Activity, UserRound, CreditCard, BarChart2 } from 'lucide-react';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/locales';

export const NAV_ITEMS = [
  { id: 'activity', label: '活跃历史', icon: Activity },
  { id: 'settings', label: '账号与设置', icon: UserRound },
  { id: 'billing', label: '订阅与账单', icon: CreditCard },
  { id: 'usage', label: '额度明细', icon: BarChart2 },
];

export function normalizeTab(tab) {
  if (!tab) return 'activity';
  const t = String(tab).toLowerCase().trim();
  if (['activity', 'stats', 'creations', 'dashboard', 'history'].includes(t)) {
    return 'activity';
  }
  if (['usage', 'ledger', 'points-details', 'credits', 'consumption', 'credits-usage'].includes(t)) {
    return 'usage';
  }
  if (['billing', 'membership', 'subscription', 'invoices', 'price-details', 'wallet', 'orders'].includes(t)) {
    return 'billing';
  }
  if (['settings', 'profile', 'security', 'edit-profile', 'account'].includes(t)) {
    return 'settings';
  }
  return 'settings';
}

export default function AccountLayout({
  user,
  activeTab = 'activity',
  onTabChange,
  onLogout,
  onClose,
  onOpenAuth,
  withBackdrop = false,
  children,
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = React.useState(false);

  const cookieLocale = typeof document !== 'undefined' ? document.cookie.match(/(?:^|;\s*)(?:NEXT_LOCALE|locale)=([^;]+)/)?.[1] : null;
  const activeLocale = normalizeLocale(user?.locale || cookieLocale || DEFAULT_LOCALE);
  const isZhTw = activeLocale === 'zh-TW';
  const isZhCn = activeLocale === 'zh-CN' || activeLocale === 'zh';

  const localizedNavLabels = {
    activity: isZhTw ? '活躍歷史' : (isZhCn ? '活跃历史' : (activeLocale === 'ja-JP' ? 'アクティビティ履歴' : (activeLocale === 'ko-KR' ? '활동 내역' : (activeLocale === 'es' ? 'Actividad' : 'Activity & History')))),
    settings: isZhTw ? '帳號與設定' : (isZhCn ? '账号与设置' : (activeLocale === 'ja-JP' ? 'アカウントと設定' : (activeLocale === 'ko-KR' ? '계정 및 설정' : (activeLocale === 'es' ? 'Cuenta y ajustes' : 'Account & Settings')))),
    billing: isZhTw ? '訂閱與帳單' : (isZhCn ? '订阅与账单' : (activeLocale === 'ja-JP' ? 'サブスクリプションと請求' : (activeLocale === 'ko-KR' ? '구독 및 청구' : (activeLocale === 'es' ? 'Suscripción y facturación' : 'Subscription & Billing')))),
    usage: isZhTw ? '額度明細' : (isZhCn ? '额度明细' : (activeLocale === 'ja-JP' ? 'クォータ詳細' : (activeLocale === 'ko-KR' ? '사용량 세부정보' : (activeLocale === 'es' ? 'Detalles de cuota' : 'Quota & Usage')))),
  };

  const copy = {
    title: isZhTw ? '個人中心' : (isZhCn ? '个人中心' : (activeLocale === 'ja-JP' ? 'アカウントセンター' : (activeLocale === 'ko-KR' ? '계정 센터' : (activeLocale === 'es' ? 'Centro de cuenta' : 'Account Center')))),
    logout: isZhTw ? '登出' : (isZhCn ? '退出登录' : (activeLocale === 'ja-JP' ? 'ログアウト' : (activeLocale === 'ko-KR' ? '로그아웃' : (activeLocale === 'es' ? 'Cerrar sesión' : 'Sign out')))),
    loggingOut: isZhTw ? '正在登出…' : (isZhCn ? '正在退出…' : (activeLocale === 'ja-JP' ? 'ログアウト中…' : (activeLocale === 'ko-KR' ? '로그아웃 중…' : (activeLocale === 'es' ? 'Cerrando sesión…' : 'Signing out…')))),
    mobileLogout: isZhTw ? '登出' : (isZhCn ? '退出' : (activeLocale === 'ja-JP' ? 'ログアウト' : (activeLocale === 'ko-KR' ? '로그아웃' : (activeLocale === 'es' ? 'Salir' : 'Sign out')))),
    login: isZhTw ? '立即登入' : (isZhCn ? '立即登录' : (activeLocale === 'ja-JP' ? 'ログイン' : (activeLocale === 'ko-KR' ? '로그인' : (activeLocale === 'es' ? 'Iniciar sesión' : 'Log in')))),
    close: isZhTw ? '關閉 (Esc)' : (isZhCn ? '关闭 (Esc)' : (activeLocale === 'ja-JP' ? '閉じる (Esc)' : (activeLocale === 'ko-KR' ? '닫기 (Esc)' : (activeLocale === 'es' ? 'Cerrar (Esc)' : 'Close (Esc)')))),
    closeAria: isZhTw ? '關閉彈窗' : (isZhCn ? '关闭弹窗' : (activeLocale === 'ja-JP' ? 'ポップアップを閉じる' : (activeLocale === 'ko-KR' ? '팝업 닫기' : (activeLocale === 'es' ? 'Cerrar ventana' : 'Close modal')))),
  };

  const currentNormalizedTab = normalizeTab(activeTab);
  const currentItem = NAV_ITEMS.find((item) => item.id === currentNormalizedTab) || NAV_ITEMS[0];
  const CurrentIcon = currentItem.icon;
  const currentItemLabel = localizedNavLabels[currentItem.id] || currentItem.label;

  const handleClose = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has('account') || url.searchParams.has('action')) {
          url.searchParams.delete('account');
          url.searchParams.delete('action');
          window.history.replaceState(null, '', url.toString());
        }
      } catch {}
    }
    if (onClose) {
      onClose();
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/studio');
    }
  }, [onClose, router]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [handleClose]);

  const handleLogoutClick = async () => {
    setLoggingOut(true);
    if (onLogout) {
      await onLogout();
    }
  };

  const cardContent = (
    <div
      className="relative w-full max-w-[1400px] 2xl:max-w-[1480px] h-[90vh] md:h-[86vh] max-h-[880px] min-h-[600px] rounded-2xl border border-line bg-overlay backdrop-blur-xl shadow-elevation-4 flex flex-col md:flex-row overflow-hidden animate-in zoom-in-95 duration-modal ease-enter cursor-default select-none"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
    >
      {/* 左侧垂直侧栏导航 (竖排 Tab) */}
      <aside className="w-full md:w-60 lg:w-64 shrink-0 border-b md:border-b-0 md:border-r border-line-subtle bg-surface flex flex-col justify-between">
        <div className="p-4 sm:p-5">
          {/* 侧栏顶部标题 */}
          <div className="mb-4 sm:mb-6 px-1 hidden md:block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand">
              ACCOUNT CENTER
            </span>
            <h2 className="mt-0.5 text-base font-bold text-ink tracking-tight">
              {copy.title}
            </h2>
          </div>

          {/* 竖排导航列表 */}
          <nav className="flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible pb-1 md:pb-0 scrollbar-none" aria-label={copy.title}>
            {NAV_ITEMS.map((item) => {
              const isActive = currentNormalizedTab === item.id;
              const Icon = item.icon;
              const navLabel = localizedNavLabels[item.id] || item.label;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  className={`group relative flex items-center gap-2.5 md:gap-3 px-3.5 py-2.5 rounded-xl text-caption md:text-body-sm font-medium transition-[background-color,border-color,color,transform] duration-fast cursor-pointer shrink-0 md:shrink md:w-full overflow-hidden ${
                    isActive
                      ? 'bg-brand-soft text-white font-semibold shadow-elevation-1 border border-brand-line'
                      : 'text-ink-muted hover:text-ink hover:bg-wash border border-transparent hover:translate-x-0.5'
                  }`}
                >
                  {/* 活跃项左侧细高光指示条 */}
                  {isActive && (
                    <span className="hidden md:block absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full bg-brand shadow-[0_0_8px_rgba(225,29,116,0.6)]" />
                  )}
                  <Icon className={`size-4 shrink-0 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-brand' : 'text-ink-muted group-hover:text-ink'}`} />
                  <span className="truncate text-left">{navLabel}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* 侧栏底部：桌面端 UID 与退出/登录 */}
        <div className="p-4 sm:p-5 border-t border-line-subtle bg-surface/50 hidden md:block">
          <div className="flex items-center justify-between text-caption text-ink-subtle font-mono px-1">
            <span className="text-micro text-ink-disabled uppercase">UID</span>
            <span className="truncate max-w-[130px] font-medium text-ink-muted">
              {user?.userNumber || user?.id || '—'}
            </span>
          </div>

          <div className="mt-3">
            {user ? (
              <button
                type="button"
                disabled={loggingOut}
                onClick={handleLogoutClick}
                className="flex w-full items-center justify-center gap-2 px-3 py-2 rounded-xl text-caption font-medium text-ink-muted hover:text-danger hover:bg-danger-soft/20 transition-colors cursor-pointer disabled:opacity-50 border border-line-subtle/50"
              >
                <LogOut className={`size-3.5 ${loggingOut ? 'animate-spin' : ''}`} />
                <span>{loggingOut ? copy.loggingOut : copy.logout}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (onOpenAuth) onOpenAuth();
                  else if (typeof window !== 'undefined') window.location.href = '/login';
                }}
                className="flex w-full items-center justify-center gap-2 px-3.5 py-2 rounded-full text-caption font-semibold text-brand bg-brand-soft border border-brand-line hover:bg-brand-pressed active:scale-[0.98] active:duration-instant transition-[background-color,color,border-color,transform] duration-fast ease-standard focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer shadow-elevation-1"
              >
                <User className="size-3.5" />
                <span>{copy.login}</span>
              </button>
            )}
          </div>
        </div>

        {/* 移动端紧凑底栏 */}
        <div className="md:hidden flex items-center justify-between px-4 py-2 border-t border-line-subtle bg-surface/50 text-caption">
          <span className="text-micro text-ink-subtle font-mono">UID: {user?.userNumber || user?.id || '—'}</span>
          {user && (
            <button
              type="button"
              disabled={loggingOut}
              onClick={handleLogoutClick}
              className="flex items-center gap-1.5 text-ink-muted hover:text-danger text-caption font-medium cursor-pointer"
            >
              <LogOut className="size-3" />
              <span>{loggingOut ? copy.loggingOut : copy.mobileLogout}</span>
            </button>
          )}
        </div>
      </aside>

      {/* 右侧主面板：头部标题栏 + 滚动内容区 */}
      <div className="flex-1 flex flex-col min-w-0 bg-surface-raised/40 overflow-hidden">
        {/* 右侧内容头部 */}
        <header className="flex items-center justify-between px-5 md:px-6 py-3.5 md:py-4 border-b border-line-subtle bg-surface/30 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2.5">
            <CurrentIcon className="size-4 text-brand" />
            <h1 className="text-body-sm font-bold text-ink tracking-tight">
              {currentItemLabel}
            </h1>
          </div>

          {/* 右上角关闭按钮 */}
          <button
            type="button"
            onClick={handleClose}
            className="size-8 rounded-full flex items-center justify-center text-ink-muted hover:text-ink hover:bg-wash active:scale-[0.98] active:duration-instant transition-[background-color,color,transform] duration-fast ease-standard focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer"
            title={copy.close}
            aria-label={copy.closeAria}
          >
            <X className="size-4" />
          </button>
        </header>

        {/* 右侧可滚动内容主体 */}
        <main className="flex-1 overflow-y-auto scrollbar-rail p-5 sm:p-6 lg:p-8">
          <div key={currentNormalizedTab} className="animate-in fade-in slide-in-from-bottom-2 duration-200 ease-out">
            {children}
          </div>
        </main>
      </div>
    </div>
  );

  if (!withBackdrop) {
    return cardContent;
  }

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-3 sm:p-6 lg:p-8 bg-scrim backdrop-blur-xl animate-in fade-in duration-modal ease-enter overflow-hidden cursor-pointer"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      {cardContent}
    </div>
  );
}

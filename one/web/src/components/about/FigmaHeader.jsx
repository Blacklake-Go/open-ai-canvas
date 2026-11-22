'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Rocket,
  ChevronDown,
  Bell,
  Wallet,
  Clock,
  Sparkles,
  Globe,
  Coins,
  Shield,
  Layers,
  Menu,
  X,
  Check,
  LogIn,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserSession } from '@/lib/hooks/useUserSession';
import { normalizeLocale, localizeStudioPath } from '@/lib/locales';
import { switchLocale as switchLocaleVia } from '@/lib/client/localeSwitch';
import UserDropdownMenu from '@/components/UserDropdownMenu';
import AuthModal from '@/components/AuthModal';

export default function FigmaHeader({ locale = 'zh' }) {
  const pathname = usePathname();
  const router = useRouter();
  const isChinese = Boolean(locale?.includes("zh"));
  const { user, credits, entitlements } = useUserSession();

  // 状态管理
  const [activeDropdown, setActiveDropdown] = useState(null); // 'pages' | 'assets' | 'orders' | 'lang' | null
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const headerRef = useRef(null);

  // 点击外部收起下拉菜单
  useEffect(() => {
    function handleClickOutside(e) {
      if (headerRef.current && !headerRef.current.contains(e.target)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = (name) => {
    setActiveDropdown((prev) => (prev === name ? null : name));
  };

  const handleOpenAuth = () => {
    setShowAuthModal(true);
  };

  const homeHref = '/';
  const studioHref = isChinese ? '/zh/studio' : '/studio';
  const communityHref = isChinese ? '/zh/community' : '/community';
  const pricingHref = isChinese ? '/zh/pricing' : '/pricing';

  return (
    <>
      {/* Figma 1:1 专属暗夜旗舰导航条 (Fixed Top 72px) */}
      <header
        ref={headerRef}
        className="fixed top-0 inset-x-0 z-50 h-[72px] bg-[#08090d]/90 backdrop-blur-2xl border-b border-white/[0.08] transition-all select-none"
      >
        <div className="max-w-[1536px] h-full mx-auto px-4 sm:px-6 lg:px-10 flex items-center justify-between gap-4">
          {/* 左侧：Rocket Logo + 导航项列表 (Strictly matching Figma 04. Homepage 2 Dark) */}
          <div className="flex items-center gap-7 lg:gap-9">
            {/* 品牌标识: Rocket Logo */}
            <Link
              href={homeHref}
              className="flex items-center gap-2.5 group shrink-0 cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#3772FF] to-[#00f5d4] p-[1.5px] shadow-[0_0_15px_rgba(55,114,255,0.4)] group-hover:shadow-[0_0_20px_rgba(0,245,212,0.6)] transition-all">
                <div className="w-full h-full rounded-[10px] bg-[#0a0b0d] flex items-center justify-center">
                  <Rocket className="w-4 h-4 text-[#00f5d4] group-hover:rotate-12 transition-transform duration-300" />
                </div>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-extrabold tracking-tight text-white group-hover:text-[#00f5d4] transition-colors">
                    Rocket
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-[#3772FF]/20 text-[#3772FF] border border-[#3772FF]/30">
                    AI
                  </span>
                </div>
                <span className="text-[9px] font-mono text-white/40 tracking-wider -mt-0.5">
                  SUPDANCE
                </span>
              </div>
            </Link>

            {/* 中间核心导航链接群 (Desktop) */}
            <nav className="hidden xl:flex items-center gap-1 text-xs sm:text-sm font-medium">
              {/* Homepage */}
              <Link
                href={homeHref}
                className="px-3.5 py-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                {isChinese ? '主页' : 'Homepage'}
              </Link>

              {/* Buy Crypto -> 算力中心 */}
              <Link
                href={pricingHref}
                className="px-3.5 py-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#3772FF]" />
                <span>{isChinese ? '算力中心' : 'Buy Crypto'}</span>
              </Link>

              {/* Markets -> 模型行情 */}
              <a
                href="#models"
                className="px-3.5 py-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                {isChinese ? '模型市场' : 'Markets'}
              </a>

              {/* Exchange -> 创作控制台 */}
              <Link
                href={studioHref}
                className="px-3.5 py-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>{isChinese ? '智能工坊' : 'Exchange'}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#00f5d4] animate-pulse" />
              </Link>

              {/* Spot -> 灵感广场 */}
              <Link
                href={communityHref}
                className="px-3.5 py-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                {isChinese ? '灵感广场' : 'Spot'}
              </Link>

              {/* 模型目录入口 */}
              <Link
                href={isChinese ? '/zh/models' : '/models'}
                className="px-3 py-1 rounded-full bg-[#101216] border border-white/10 text-xs font-mono text-white/70 hover:text-white hover:border-white/25 transition-colors flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#00f5d4]" />
                <span className="font-bold">{isChinese ? '模型目录' : 'Models'}</span>
              </Link>

              {/* Pages 下拉菜单 */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => toggleDropdown('pages')}
                  className={cn(
                    'px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 cursor-pointer',
                    activeDropdown === 'pages'
                      ? 'bg-white/10 text-white'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  )}
                >
                  <span>{isChinese ? '关于与更多' : 'Pages'}</span>
                  <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200', activeDropdown === 'pages' && 'rotate-180')} />
                </button>

                {activeDropdown === 'pages' && (
                  <div className="absolute top-full left-0 mt-2 w-56 rounded-2xl bg-[#131519]/95 backdrop-blur-2xl border border-white/10 p-2 shadow-elevation-4 animate-scale-in">
                    <Link
                      href={isChinese ? '/zh/about' : '/about'}
                      onClick={() => setActiveDropdown(null)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-white bg-white/10 cursor-pointer"
                    >
                      <Rocket className="w-4 h-4 text-[#3772FF]" />
                      <div>
                        <div>{isChinese ? '关于我们 (当前页)' : 'About Us'}</div>
                        <div className="text-[10px] text-white/40">{isChinese ? '实力架构与使命信条' : 'Our Infrastructure'}</div>
                      </div>
                    </Link>
                    <Link
                      href={pricingHref}
                      onClick={() => setActiveDropdown(null)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <Coins className="w-4 h-4 text-amber-400" />
                      <div>
                        <div>{isChinese ? '会员方案与定价' : 'Pricing & Compute'}</div>
                        <div className="text-[10px] text-white/40">{isChinese ? '专业算力订阅' : 'Subscription Plans'}</div>
                      </div>
                    </Link>
                    <Link
                      href={communityHref}
                      onClick={() => setActiveDropdown(null)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <Layers className="w-4 h-4 text-purple-400" />
                      <div>
                        <div>{isChinese ? '创作者社区' : 'Community Gallery'}</div>
                        <div className="text-[10px] text-white/40">{isChinese ? '一键做同款与提示词' : 'Explore Creations'}</div>
                      </div>
                    </Link>
                    <a
                      href="#workflow"
                      onClick={() => setActiveDropdown(null)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <Shield className="w-4 h-4 text-emerald-400" />
                      <div>
                        <div>{isChinese ? '工业级流水线' : 'How It Works'}</div>
                        <div className="text-[10px] text-white/40">{isChinese ? '四步创作流图谱' : 'Production Pipeline'}</div>
                      </div>
                    </a>
                  </div>
                )}
              </div>
            </nav>
          </div>

          {/* 右侧：Assets / Orders / 语言货币 / 通知 / 用户态 (Figma 1:1) */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Assets ▾ 下拉菜单 */}
            <div className="relative hidden md:block">
              <button
                type="button"
                onClick={() => toggleDropdown('assets')}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer',
                  activeDropdown === 'assets'
                    ? 'bg-white/10 text-white'
                    : 'text-white/80 hover:text-white hover:bg-white/5'
                )}
              >
                <Wallet className="w-3.5 h-3.5 text-[#3772FF]" />
                <span>{isChinese ? '资产总览' : 'Assets'}</span>
                <ChevronDown className="w-3 h-3 text-white/50" />
              </button>

              {activeDropdown === 'assets' && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-[#131519]/95 backdrop-blur-2xl border border-white/10 p-4 shadow-elevation-4 animate-scale-in">
                  <div className="text-xs text-white/50 mb-1">{isChinese ? '账户可用算力点' : 'Available Credits'}</div>
                  <div className="text-xl font-bold font-mono text-white mb-3">
                    {credits?.totalAvailable ?? (user ? '500' : '0')} <span className="text-xs font-normal text-white/40">PTS</span>
                  </div>
                  <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between">
                    <Link
                      href={pricingHref}
                      onClick={() => setActiveDropdown(null)}
                      className="w-full py-2 rounded-full bg-[#3772FF] hover:bg-[#2e62de] text-center text-xs font-semibold text-white transition-all shadow-elevation-1"
                    >
                      {isChinese ? '充值与订阅' : 'Deposit / Subscribe'}
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Orders & Trades ▾ 下拉菜单 */}
            <div className="relative hidden lg:block">
              <button
                type="button"
                onClick={() => toggleDropdown('orders')}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer',
                  activeDropdown === 'orders'
                    ? 'bg-white/10 text-white'
                    : 'text-white/80 hover:text-white hover:bg-white/5'
                )}
              >
                <Clock className="w-3.5 h-3.5 text-[#00f5d4]" />
                <span>{isChinese ? '生成任务' : 'Orders & Trades'}</span>
                <ChevronDown className="w-3 h-3 text-white/50" />
              </button>

              {activeDropdown === 'orders' && (
                <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl bg-[#131519]/95 backdrop-blur-2xl border border-white/10 p-3 shadow-elevation-4 animate-scale-in">
                  <div className="text-xs font-semibold text-white mb-2">{isChinese ? '最近生成任务' : 'Recent Tasks'}</div>
                  <div className="text-xs text-white/40 py-4 text-center">
                    {isChinese ? '暂无进行中的排队任务' : 'No running jobs'}
                  </div>
                  <Link
                    href={studioHref}
                    onClick={() => setActiveDropdown(null)}
                    className="block text-center text-[11px] text-[#3772FF] hover:underline pt-2 border-t border-white/[0.06]"
                  >
                    {isChinese ? '前往工作台查看全部 ›' : 'Go to Studio History ›'}
                  </Link>
                </div>
              )}
            </div>

            {/* EN/USD ▾ 语言与货币切换 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => toggleDropdown('lang')}
                className={cn(
                  'px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer',
                  activeDropdown === 'lang'
                    ? 'bg-white/10 text-white'
                    : 'text-white/80 hover:text-white hover:bg-white/5'
                )}
              >
                <Globe className="w-3.5 h-3.5 text-white/60" />
                <span className="font-mono">{isChinese ? 'ZH/CNY' : 'EN/USD'}</span>
                <ChevronDown className="w-3 h-3 text-white/50" />
              </button>

              {activeDropdown === 'lang' && (
                <div className="absolute right-0 top-full mt-2 w-40 rounded-2xl bg-[#131519]/95 backdrop-blur-2xl border border-white/10 p-2 shadow-elevation-4 animate-scale-in">
                  <button
                    type="button"
                    onClick={() => {
                      switchLocaleVia('zh-CN', pathname);
                      setActiveDropdown(null);
                    }}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors',
                      isChinese ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
                    )}
                  >
                    <span>简体中文 (CNY)</span>
                    {isChinese && <Check className="w-3.5 h-3.5 text-[#00f5d4]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      switchLocaleVia('en', pathname);
                      setActiveDropdown(null);
                    }}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors',
                      !isChinese ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
                    )}
                  >
                    <span>English (USD)</span>
                    {!isChinese && <Check className="w-3.5 h-3.5 text-[#00f5d4]" />}
                  </button>
                </div>
              )}
            </div>

            {/* 铃铛通知图标 (带呼吸高光红点) */}
            <button
              type="button"
              aria-label="Notifications"
              className="relative p-2 rounded-full text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#e11d74] ring-2 ring-[#08090d]" />
            </button>

            {/* 用户头像与认证态 */}
            {user ? (
              <UserDropdownMenu user={user} credits={credits} entitlements={entitlements} />
            ) : (
              <button
                type="button"
                onClick={handleOpenAuth}
                className="px-4 py-1.5 rounded-full bg-[#3772FF] hover:bg-[#2e62de] text-white text-xs font-semibold tracking-wide transition-all shadow-elevation-1 flex items-center gap-1.5 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{isChinese ? '登录 / 注册' : 'Sign In'}</span>
              </button>
            )}

            {/* 移动端汉堡菜单切换 */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="xl:hidden p-2 rounded-full text-white/80 hover:bg-white/10"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* 移动端展开抽屉 */}
        {mobileMenuOpen && (
          <div className="xl:hidden bg-[#0a0b0d]/98 border-b border-white/10 px-5 py-4 flex flex-col gap-3 animate-scale-in text-sm">
            <Link
              href={homeHref}
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 text-white/80 hover:text-white"
            >
              {isChinese ? '主页 (Homepage)' : 'Homepage'}
            </Link>
            <Link
              href={pricingHref}
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 text-white/80 hover:text-white"
            >
              {isChinese ? '算力中心 (Buy Crypto)' : 'Buy Crypto'}
            </Link>
            <a
              href="#models"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 text-white/80 hover:text-white"
            >
              {isChinese ? '模型市场 (Markets)' : 'Markets'}
            </a>
            <Link
              href={studioHref}
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 text-white/80 hover:text-white"
            >
              {isChinese ? '智能工坊 (Exchange)' : 'Exchange'}
            </Link>
            <Link
              href={communityHref}
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 text-white/80 hover:text-white"
            >
              {isChinese ? '灵感广场 (Spot)' : 'Spot'}
            </Link>
          </div>
        )}
      </header>

      {/* 登录弹窗 */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          locale={locale}
        />
      )}
    </>
  );
}

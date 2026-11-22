'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as NavigationMenu from '@radix-ui/react-navigation-menu';
import { ChevronDown } from 'lucide-react';
import { ExternalLink } from 'lucide-react';
import { getMegaNavCategories } from '../../config/mega-navigation';
import { withPublicNavigationModels } from '../../lib/modelCenter/megaNavigationModels';
import MegaMenuPanel from './MegaMenuPanel';
import NavBadge from './NavBadge';
import { getCommonCopy, getLocaleConfig, normalizeLocale } from '@/lib/locales';
import { inferStudioTabFromModel } from '@/lib/studio-routes';
import {
  FOCUS_RING,
  withoutRadiusUtilities,
} from 'studio/ui/tokens';

/**
 * 顶栏水平导航与双栏 Mega Menu 组件 (严格遵循 UI_DESIGN_SYSTEM.md 规范)
 *
 * @param {Object} props
 * @param {string} props.activeTab 当前激活的工作室 Tab ID (如 'image', 'video' 等)
 * @param {string} props.locale 语言代码 ('zh' | 'en')
 * @param {Function} props.onSelectTab 切换 Tab 时的回调
 * @param {string} props.className 外部额外类名
 */
export default function TopMegaNavigation({
  activeTab = 'image',
  locale = 'zh',
  onSelectTab,
  className = '',
}) {
  const pathname = usePathname();
  const normLocale = normalizeLocale(locale);
  const copy = getCommonCopy(normLocale);
  const tNav = copy.topNav || {};
  const rootPath = getLocaleConfig(normLocale)?.rootPath || '';
  const [launchScope, setLaunchScope] = useState({ restricted: false, models: [] });
  const categories = withPublicNavigationModels(getMegaNavCategories(normLocale), launchScope.models, rootPath);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/models/active', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('MODEL_DIRECTORY_UNAVAILABLE');
        return response.json();
      })
      .then((payload) => {
        if (!cancelled) {
          setLaunchScope({
            restricted: payload.launchScope?.restricted === true,
            models: Array.isArray(payload.models) ? payload.models : [],
          });
        }
      })
      .catch(() => {
        if (!cancelled) setLaunchScope({ restricted: false, models: [] });
      });
    return () => { cancelled = true; };
  }, []);

  const getNavLabel = (key, defaultLabel) => {
    if (tNav[key]) return tNav[key];
    const dict = {
      home: { 'zh-CN': '首页', 'zh-TW': '首頁', 'ja-JP': 'ホーム', 'ko-KR': '홈', es: 'Inicio', en: 'Home' },
      assets: { 'zh-CN': '资产', 'zh-TW': '資產', 'ja-JP': 'アセット', 'ko-KR': '에셋', es: 'Activos', en: 'Assets' },
      infiniteCanvas: { 'zh-CN': '无限画布', 'zh-TW': '無限畫布', 'ja-JP': '無限キャンバス', 'ko-KR': '무한 캔버스', es: 'Lienzo Infinito', en: 'Infinite Canvas' },
      feedback: { 'zh-CN': '建议与需求', 'zh-TW': '建議與需求', 'ja-JP': 'ご意見・ご要望', 'ko-KR': '건의 및 요청', es: 'Sugerencias', en: 'Feedback' },
      about: { 'zh-CN': '关于', 'zh-TW': '關於', 'ja-JP': '概要', 'ko-KR': '소개', es: 'Acerca de', en: 'About' },
    };
    return dict[key]?.[normLocale] || dict[key]?.en || defaultLabel;
  };
  const [currentOpenValue, setCurrentOpenValue] = useState('');
  const [viewportOffset, setViewportOffset] = useState(0);
  const [headerBottom, setHeaderBottom] = useState(56);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const rootRef = useRef(null);
  const triggerRefs = useRef({});
  const viewportRef = useRef(null);

  // 自适应视口居中与屏幕边界检测
  const updatePosition = useCallback(() => {
    if (!currentOpenValue || !rootRef.current) return;
    const triggerEl = triggerRefs.current[currentOpenValue];
    if (!triggerEl) return;

    const compute = () => {
      if (!rootRef.current || !triggerEl || typeof window === 'undefined') return;
      const rootRect = rootRef.current.getBoundingClientRect();
      const triggerRect = triggerEl.getBoundingClientRect();

      const headerEl = rootRef.current.closest('header');
      if (headerEl) {
        const headerRect = headerEl.getBoundingClientRect();
        setHeaderBottom(Math.round(headerRect.bottom));
      } else {
        setHeaderBottom(Math.round(rootRect.bottom));
      }

      // 触发器中心点相对于根容器的水平坐标
      const triggerCenter = triggerRect.left + triggerRect.width / 2 - rootRect.left;

      // 浮层面板宽度：若已渲染取实测宽度，否则默认 768px (max-w-3xl)
      const panelWidth = viewportRef.current?.offsetWidth || Math.min(768, window.innerWidth - 32);
      let targetLeft = triggerCenter - panelWidth / 2;

      // 视口边界保护：距屏幕左右边缘至少保留 16px 边距
      const minPadding = 18;
      const screenLeft = rootRect.left + targetLeft;
      if (screenLeft < minPadding) {
        targetLeft = Math.ceil(minPadding - rootRect.left);
      } else if (screenLeft + panelWidth > window.innerWidth - minPadding) {
        targetLeft = Math.floor(window.innerWidth - minPadding - panelWidth - rootRect.left);
      }

      setViewportOffset(Math.round(targetLeft));
    };

    compute();
    const rafId = requestAnimationFrame(compute);
    return () => cancelAnimationFrame(rafId);
  }, [currentOpenValue]);

  useEffect(() => {
    const cleanup = updatePosition();
    const handleResize = () => updatePosition();
    window.addEventListener('resize', handleResize);
    return () => {
      if (cleanup) cleanup();
      window.removeEventListener('resize', handleResize);
    };
  }, [updatePosition]);

  // 处理菜单项点击
  const handleItemClick = (e, item, cat) => {
    setCurrentOpenValue('');
    const targetTabId = item.tabId || cat?.tabId || (item.modelKey ? inferStudioTabFromModel(item.modelKey) : null);
    if (targetTabId && onSelectTab) {
      onSelectTab(e, targetTabId, item.modelKey);
    }
  };

  return (
    <>
      <NavigationMenu.Root
        ref={rootRef}
        value={currentOpenValue}
        onValueChange={setCurrentOpenValue}
        delayDuration={120}
        skipDelayDuration={300}
        className={`relative z-header flex items-center min-w-0 [&>div]:w-full [&>div]:min-w-0 ${withoutRadiusUtilities(className)}`}
      >
        <NavigationMenu.List className="m-0 flex w-full min-w-0 list-none items-center gap-1.5 overflow-x-auto p-0 scrollbar-rail font-jost whitespace-nowrap">

          {/* 首页 */}
          <NavigationMenu.Item>
            <NavigationMenu.Link asChild>
              <Link
                href="/"
                prefetch={false}
                className={`inline-flex items-center gap-1.5 rounded-lg border border-transparent px-3 h-control-sm text-body-sm font-medium font-jost transition-[background-color,color,border-color] duration-fast hover:bg-wash hover:text-ink shrink-0 select-none ${FOCUS_RING} ${
                  pathname === '/' || pathname === '/zh' || pathname === '/zh/' || (rootPath && pathname === rootPath) ? 'bg-wash-strong text-ink font-semibold border-line-subtle' : 'text-ink-muted'
                }`}
              >
                {getNavLabel('home', 'Home')}
              </Link>
            </NavigationMenu.Link>
          </NavigationMenu.Item>

          {/* 资产中心入口 */}
          <NavigationMenu.Item>
            <NavigationMenu.Link asChild>
              <Link
                href={rootPath ? `${rootPath}/assets` : '/assets'}
                prefetch={false}
                className={`inline-flex items-center gap-1.5 rounded-lg border border-transparent px-3 h-control-sm text-body-sm font-medium font-jost transition-[background-color,color,border-color] duration-fast hover:bg-wash hover:text-ink shrink-0 select-none ${FOCUS_RING} ${
                  pathname?.includes('/assets') ? 'bg-wash-strong text-ink font-semibold border-line-subtle' : 'text-ink-muted'
                }`}
              >
                {getNavLabel('assets', 'Assets')}
              </Link>
            </NavigationMenu.Link>
          </NavigationMenu.Item>

          {/* 各主分类 Mega Menu (图像、视频、音频、智能体、短剧工作坊、社区) */}
          {launchScope.restricted && launchScope.models.some((model) => model.category === 'image') && (
            <NavigationMenu.Item>
              <NavigationMenu.Link asChild>
                <Link
                  href={rootPath ? `${rootPath}/studio/image` : '/studio/image'}
                  prefetch={false}
                  className={`inline-flex items-center gap-1.5 rounded-lg border border-transparent px-3 h-control-sm text-body-sm font-medium font-jost text-ink-muted transition-[background-color,color,border-color] duration-fast hover:bg-wash hover:text-ink shrink-0 select-none ${FOCUS_RING}`}
                >
                  {categories.find((category) => category.id === 'images')?.label || getNavLabel('images', 'Image')}
                </Link>
              </NavigationMenu.Link>
            </NavigationMenu.Item>
          )}
          {!launchScope.restricted && categories.map((cat) => {
            const label = cat.label;
            const isDirectCategory = !cat.features?.length && !cat.models?.length;

            if (isDirectCategory) {
              const isDirectActive = pathname === cat.href || pathname === `${cat.href}/`;
              return (
                <NavigationMenu.Item key={cat.id}>
                  <NavigationMenu.Link asChild>
                    <Link
                      href={cat.href}
                      prefetch={false}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 h-control-sm text-body-sm font-medium font-jost transition-[background-color,color,border-color] duration-fast shrink-0 select-none ${FOCUS_RING} ${
                        isDirectActive
                          ? 'bg-wash-strong text-ink font-semibold border-line-subtle'
                          : 'border-transparent text-ink-muted hover:bg-wash hover:text-ink'
                      }`}
                    >
                      <span>{label}</span>
                      {cat.badge && <NavBadge badge={cat.badge} className="font-jost" />}
                    </Link>
                  </NavigationMenu.Link>
                </NavigationMenu.Item>
              );
            }

            const isCategoryActive = cat.features?.some((f) => f.tabId === activeTab) || (cat.id === 'community' && (pathname === '/community' || pathname?.startsWith('/community/') || pathname === '/zh/community' || pathname?.startsWith('/zh/community/')));

            return (
              <NavigationMenu.Item key={cat.id} value={cat.id}>
                <NavigationMenu.Trigger
                  ref={(el) => {
                    if (el) {
                      triggerRefs.current[cat.id] = el;
                    } else {
                      delete triggerRefs.current[cat.id];
                    }
                  }}
                  className={`group inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 h-control-sm text-body-sm font-medium font-jost transition-[background-color,color,border-color] duration-fast select-none ${FOCUS_RING} ${
                    isCategoryActive
                      ? 'bg-wash-strong text-ink font-semibold border-line-subtle'
                      : 'border-transparent text-ink-muted hover:bg-wash hover:text-ink data-[state=open]:bg-wash-strong data-[state=open]:text-ink data-[state=open]:border-line-subtle'
                  }`}
                >
                  <span>{label}</span>
                  {cat.badge && <NavBadge badge={cat.badge} className="font-jost" />}
                  <ChevronDown
                    className="w-3.5 h-3.5 ml-1 transition-transform duration-fast group-data-[state=open]:rotate-180"
                    aria-hidden="true"
                  />
                </NavigationMenu.Trigger>

                <NavigationMenu.Content className="animate-popover-in">
                  <MegaMenuPanel
                    category={cat}
                    locale={locale}
                    onItemClick={handleItemClick}
                  />
                </NavigationMenu.Content>
              </NavigationMenu.Item>
            );
          })}

          {/* SupDance 的第二创作工作台使用同一账号与业务 API。 */}
          {!launchScope.restricted && <NavigationMenu.Item key="infinite-canvas">
            <NavigationMenu.Link asChild>
              <Link
                href="/canvas"
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 rounded-lg border border-transparent px-3 h-control-sm text-body-sm font-medium font-jost text-ink-muted transition-[background-color,color,border-color] duration-fast hover:bg-wash hover:text-ink shrink-0 select-none ${FOCUS_RING}`}
              >
                <span>{getNavLabel('infiniteCanvas', 'Infinite Canvas')}</span>
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </Link>
            </NavigationMenu.Link>
          </NavigationMenu.Item>}

          {/* 建议与需求：固定排在「关于」之前，作为反馈与提需求的统一入口。 */}
          <NavigationMenu.Item key="nav_feedback_pinned">
            <NavigationMenu.Link asChild>
              <Link
                href="/feedback"
                prefetch={false}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 h-control-sm text-body-sm font-medium font-jost transition-[background-color,color,border-color] duration-fast shrink-0 select-none ${FOCUS_RING} ${
                  pathname === '/feedback'
                    ? 'bg-wash-strong text-ink font-semibold border-line-subtle'
                    : 'border-transparent text-ink-muted hover:bg-wash hover:text-ink'
                }`}
              >
                <span>{getNavLabel('feedback', 'Feedback')}</span>
              </Link>
            </NavigationMenu.Link>
          </NavigationMenu.Item>

          {/* 顶部导航栏最后一个菜单项：关于本站 (Fixed Final Item: About) */}
          <NavigationMenu.Item key="nav_about_pinned">
            <NavigationMenu.Link asChild>
              <Link
                href={rootPath ? `${rootPath}/about` : '/about'}
                prefetch={false}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 h-control-sm text-body-sm font-medium font-jost transition-[background-color,color,border-color] duration-fast shrink-0 select-none ${FOCUS_RING} ${
                  pathname === '/about' || (rootPath && pathname === `${rootPath}/about`)
                    ? 'bg-wash-strong text-ink font-semibold border-line-subtle'
                    : 'border-transparent text-ink-muted hover:bg-wash hover:text-ink'
                }`}
              >
                <span>{getNavLabel('about', 'About')}</span>
              </Link>
            </NavigationMenu.Link>
          </NavigationMenu.Item>

        </NavigationMenu.List>

        {/* 浮层视口容器 (Radix Viewport - 自适应触发器居中与边界平滑过渡) */}
        <div
          className="absolute top-full mt-2 transition-transform duration-fast ease-standard"
          style={{ transform: `translateX(${viewportOffset}px)` }}
        >
          <NavigationMenu.Viewport
            ref={viewportRef}
            className="relative overflow-hidden rounded-xl shadow-elevation-3 transition-[width,height] duration-fast ease-standard"
          />
        </div>
      </NavigationMenu.Root>

      {/* 沉浸式 Backdrop Scrim 遮罩层 (Portal 挂载至 document.body，避免 header backdrop-filter 包含块陷阱) */}
      {mounted &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            data-mega-scrim
            data-state={currentOpenValue ? 'open' : 'closed'}
            aria-hidden="true"
            onClick={() => setCurrentOpenValue('')}
            style={{ top: `${headerBottom}px` }}
            className={`fixed inset-x-0 bottom-0 z-sticky bg-scrim transition-opacity duration-fast will-change-[opacity] ${
              currentOpenValue
                ? 'opacity-100 pointer-events-auto'
                : 'opacity-0 pointer-events-none'
            }`}
          />,
          document.body
        )}
    </>
  );
}

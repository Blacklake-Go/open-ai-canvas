'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * 通用横向可滑动菜单/标签栏组件 (AdminScrollableTabs)
 * 专为管理后台复杂二级菜单、多标签切换设计 (对标图二效果)
 * 特性：
 * 1. 永不折行 (flex-nowrap)
 * 2. 鼠标左键拖拽滑动 (Drag to scroll)
 * 3. 鼠标滚轮横向滚动 (Wheel horizontal scroll)
 * 4. 左右溢出微光渐变遮罩与快捷微型翻页按钮
 * 5. 选中项平滑自动居中对齐 (scrollIntoView)
 */
export default function AdminScrollableTabs({
  tabs = [],
  activeTab,
  onChange,
  className = '',
  tabClassName = '',
}) {
  const containerRef = useRef(null);
  const activeTabRef = useRef(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // 拖拽位置状态
  const dragInfo = useRef({
    isDown: false,
    startX: 0,
    startScrollLeft: 0,
    hasMoved: false,
  });

  // 检测左右是否有可滚动余量
  const checkScrollable = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  useEffect(() => {
    checkScrollable();
    const el = containerRef.current;
    if (!el) return;

    const handleResize = () => checkScrollable();
    window.addEventListener('resize', handleResize);

    const observer = new ResizeObserver(checkScrollable);
    observer.observe(el);

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, [checkScrollable, tabs]);

  // 切换选中项时平滑自动居中
  useEffect(() => {
    if (activeTabRef.current && containerRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
      const timer = setTimeout(checkScrollable, 300);
      return () => clearTimeout(timer);
    }
  }, [activeTab, checkScrollable]);

  // 鼠标滚轮横向滚动
  const handleWheel = (e) => {
    const el = containerRef.current;
    if (!el) return;
    if (el.scrollWidth > el.clientWidth) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
        checkScrollable();
      }
    }
  };

  // 鼠标拖拽逻辑
  const handleMouseDown = (e) => {
    // 仅响应鼠标主键 (左键)
    if (e.button !== 0) return;
    const el = containerRef.current;
    if (!el) return;
    dragInfo.current.isDown = true;
    dragInfo.current.startX = e.pageX - el.offsetLeft;
    dragInfo.current.startScrollLeft = el.scrollLeft;
    dragInfo.current.hasMoved = false;
  };

  const handleMouseMove = (e) => {
    if (!dragInfo.current.isDown) return;
    const el = containerRef.current;
    if (!el) return;

    const x = e.pageX - el.offsetLeft;
    const walk = x - dragInfo.current.startX;

    // 提高拖拽死区判定至 10px，避免普通点击时的手部微抖动被误判为拖拽而拦截点击
    if (Math.abs(walk) > 10) {
      dragInfo.current.hasMoved = true;
      setIsDragging(true);
      el.scrollLeft = dragInfo.current.startScrollLeft - walk;
      checkScrollable();
    }
  };

  const handleMouseUp = () => {
    dragInfo.current.isDown = false;
    setTimeout(() => {
      setIsDragging(false);
      dragInfo.current.hasMoved = false;
    }, 60);
  };

  // 全局监听 mouseup，防止鼠标在容器外释放时拖拽状态被卡死
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragInfo.current.isDown) {
        handleMouseUp();
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const handleTabClick = (tabId, e) => {
    if (dragInfo.current.hasMoved || isDragging) {
      e?.preventDefault();
      e?.stopPropagation();
      return;
    }
    onChange?.(tabId);
  };

  // 左右翻页微按钮平滑滚动
  const scrollStep = (direction) => {
    const el = containerRef.current;
    if (!el) return;
    const step = 200;
    el.scrollBy({
      left: direction === 'left' ? -step : step,
      behavior: 'smooth',
    });
    setTimeout(checkScrollable, 260);
  };

  return (
    <div className={`group/scroll relative flex items-center ${className}`}>
      {/* 左侧平滑翻页按钮与微光遮罩 */}
      <div
        className={`pointer-events-none absolute left-0 top-0 bottom-0 z-10 flex items-center pr-6 bg-gradient-to-r from-canvas via-canvas/80 to-transparent transition-opacity duration-200 ${
          canScrollLeft ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <button
          type="button"
          onClick={() => scrollStep('left')}
          aria-label="向左滑动"
          className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.12] bg-surface-raised/90 text-gray-300 shadow-lg backdrop-blur-md transition-all hover:border-brand/40 hover:bg-brand/10 hover:text-brand active:scale-95 cursor-pointer"
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>

      {/* 滚动容器 */}
      <div
        ref={containerRef}
        onScroll={checkScrollable}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`no-scrollbar flex w-full items-center gap-1.5 overflow-x-auto select-none py-1 transition-all ${
          isDragging ? 'cursor-grabbing' : 'cursor-default'
        }`}
        style={{ scrollBehavior: isDragging ? 'auto' : 'smooth' }}
      >
        {tabs.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              ref={isActive ? activeTabRef : null}
              type="button"
              onClick={(e) => handleTabClick(t.id, e)}
              className={`shrink-0 rounded-xl px-4 py-2 text-xs font-semibold tracking-wide transition-all duration-200 active:scale-[0.98] ${
                isActive
                  ? 'border border-brand/30 bg-brand/10 text-brand'
                  : 'border border-transparent text-white/55 hover:border-white/10 hover:bg-white/[0.06] hover:text-white'
              } ${tabClassName}`}
            >
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                {t.icon && <span className="text-sm">{t.icon}</span>}
                <span>{t.label}</span>
                {t.badge !== undefined && (
                  <span
                    className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                      isActive
                        ? 'bg-brand/20 text-brand'
                        : 'bg-white/10 text-white/50'
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 右侧平滑翻页按钮与微光遮罩 */}
      <div
        className={`pointer-events-none absolute right-0 top-0 bottom-0 z-10 flex items-center pl-6 bg-gradient-to-l from-canvas via-canvas/80 to-transparent transition-opacity duration-200 ${
          canScrollRight ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <button
          type="button"
          onClick={() => scrollStep('right')}
          aria-label="向右滑动"
          className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.12] bg-surface-raised/90 text-gray-300 shadow-lg backdrop-blur-md transition-all hover:border-brand/40 hover:bg-brand/10 hover:text-brand active:scale-95 cursor-pointer"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}


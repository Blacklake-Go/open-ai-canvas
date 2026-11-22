'use client';

import React, { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import UserProfileView from './UserProfileView';
import { openGlobalProfileModal, closeGlobalProfileModal } from '@/lib/profileEvents';

import { getProfileStrings, useProfileLocale } from './profileI18n';

export default function UserProfileModal({
  isOpen = false,
  onClose,
  userId = null,
  creator = null,
  initialTab = 'creations',
  className = '',
  locale = null,
}) {
  const activeLocale = useProfileLocale(locale);
  const strings = getProfileStrings(activeLocale);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  // 全局监听 Esc 键关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-3 sm:p-6 lg:p-8 bg-scrim backdrop-blur-xl transition-opacity duration-modal ease-enter animate-fade-in overflow-y-auto cursor-pointer"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label={strings.ariaLabelProfile}
    >
      <div
        className={`relative w-full max-w-4xl max-h-[90vh] rounded-2xl border border-line-strong bg-overlay shadow-elevation-4 p-5 sm:p-7 overflow-y-auto cursor-default animate-scale-in text-ink ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 右上角关闭按钮 */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 size-8 rounded-full bg-wash hover:bg-surface-raised border border-line-subtle text-ink-muted hover:text-ink flex items-center justify-center active:scale-95 active:duration-instant transition-[background-color,color,transform] duration-fast ease-standard cursor-pointer z-20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
          aria-label={strings.ariaLabelClose}
        >
          <X className="size-4" />
        </button>

        {/* 内嵌个人资料主视图 */}
        <UserProfileView
          creator={creator}
          userId={userId}
          initialTab={initialTab}
          embedded={true}
          showHeader={false}
          showBackLink={false}
          compact={false}
          locale={activeLocale}
          onClose={handleClose}
        />
      </div>
    </div>
  );
}

export { openGlobalProfileModal, closeGlobalProfileModal };

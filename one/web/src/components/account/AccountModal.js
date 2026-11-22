'use client';

import React, { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { openGlobalAccountModal } from '@/lib/accountEvents';
import { Loader2 } from 'lucide-react';

function ModalLoadingSkeleton() {
  return (
    <div className="relative w-full max-w-[1400px] 2xl:max-w-[1480px] h-[90vh] md:h-[86vh] max-h-[880px] min-h-[600px] rounded-2xl border border-line bg-overlay backdrop-blur-xl shadow-elevation-4 flex flex-col items-center justify-center animate-pulse">
      <Loader2 className="size-8 animate-spin text-brand" />
      <p className="mt-3 text-caption text-ink-muted">正在加载个人中心…</p>
    </div>
  );
}

const AccountCenterView = dynamic(() => import('@/components/account/AccountCenterView'), {
  ssr: false,
  loading: () => <ModalLoadingSkeleton />,
});

export default function AccountModal({
  isOpen,
  onClose,
  initialTab = 'activity',
  user = null,
  credits = null,
  onOpenAuth = null,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

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
      className="fixed inset-0 z-modal flex items-center justify-center p-3 sm:p-6 lg:p-8 bg-scrim backdrop-blur-xl animate-in fade-in duration-modal ease-enter overflow-hidden cursor-pointer"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <AccountCenterView
        onClose={handleClose}
        initialTabProp={activeTab}
        onTabChange={setActiveTab}
        initialUser={user}
        initialCredits={credits}
        onOpenAuth={onOpenAuth}
        isModal={true}
      />
    </div>
  );
}

export { openGlobalAccountModal };

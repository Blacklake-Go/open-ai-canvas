'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';
import AccountSettingsView from './AccountSettingsView';

export default function AccountSettingsModal({
  isOpen = false,
  onClose,
  initialUser = null,
  className = '',
}) {
  const [user, setUser] = useState(initialUser);
  const [loading, setLoading] = useState(!initialUser);

  const loadUser = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadUser();
    }
  }, [isOpen, loadUser]);

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
      aria-label="账号与设置"
    >
      <div
        className={`relative w-full max-w-3xl max-h-[90vh] rounded-2xl border border-line-strong bg-overlay shadow-elevation-4 p-5 sm:p-7 overflow-y-auto cursor-default animate-scale-in text-ink ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 右上角关闭按钮 */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 size-8 rounded-full bg-wash hover:bg-surface-raised border border-line-subtle text-ink-muted hover:text-ink flex items-center justify-center active:scale-95 active:duration-instant transition-[background-color,color,transform] duration-fast ease-standard cursor-pointer z-20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
          aria-label="关闭"
        >
          <X className="size-4" />
        </button>

        <div className="mb-4">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand">
            ACCOUNT SETTINGS
          </span>
          <h2 className="text-xl font-bold text-ink tracking-tight">
            账号设置与偏好
          </h2>
        </div>

        {loading && !user ? (
          <div className="flex flex-col items-center justify-center py-20 text-ink-muted">
            <Loader2 className="size-8 animate-spin text-brand mb-3" />
            <p className="text-caption">正在加载设置数据…</p>
          </div>
        ) : (
          <AccountSettingsView
            user={user}
            onProfileUpdated={async (updated) => {
              if (updated) {
                setUser((prev) => ({ ...prev, ...updated }));
              }
              await loadUser();
            }}
            embedded={true}
          />
        )}
      </div>
    </div>
  );
}

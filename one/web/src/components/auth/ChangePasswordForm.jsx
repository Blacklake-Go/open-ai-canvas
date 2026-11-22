'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getAuthCopy, getAuthRoutes } from '@/lib/authCopy';

export default function ChangePasswordForm({ locale = 'en' }) {
  const router = useRouter();
  const copy = getAuthCopy(locale).change;
  const routes = getAuthRoutes(locale);

  const [loadingUser, setLoadingUser] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Check login session
  useEffect(() => {
    let active = true;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.user) {
          setCurrentUser(data.user);
        } else {
          setCurrentUser(null);
        }
      })
      .catch(() => {
        if (active) setCurrentUser(null);
      })
      .finally(() => {
        if (active) setLoadingUser(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Submit Password Change
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!newPassword || newPassword.length < 8) {
      setErrorMsg(copy.errNewPasswordLength);
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg(copy.errPasswordMismatch);
      return;
    }
    if (oldPassword && oldPassword === newPassword) {
      setErrorMsg(copy.errSamePassword);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/user/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');

      setSuccessMsg(data.message || copy.successDesc);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to change password');
    } finally {
      setBusy(false);
    }
  };

  if (loadingUser) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-white/50 text-xs">
        <span className="animate-spin text-lg">◌</span>
        <span>{copy.checkingAuth}</span>
      </div>
    );
  }

  // Not logged in: show guidance card to login
  if (!currentUser) {
    return (
      <div className="flex flex-col items-center gap-5 text-center py-4 animate-fade-in">
        <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <div className="flex flex-col gap-1.5">
          <h2 className="text-base sm:text-lg font-bold text-white">
            {copy.authRequiredTitle}
          </h2>
          <p className="text-xs text-white/60 leading-relaxed max-w-xs">
            {copy.authRequiredDesc}
          </p>
        </div>

        <Link
          href={`${routes.loginUrl}?redirect=${encodeURIComponent(routes.changePasswordUrl)}`}
          className="w-full h-11 rounded-full bg-brand hover:bg-brand-hover text-white text-sm font-semibold transition-all duration-200 shadow-elevation-2 flex items-center justify-center cursor-pointer"
        >
          {copy.goToLogin}
        </Link>
      </div>
    );
  }

  // Success state
  if (successMsg) {
    return (
      <div className="flex flex-col items-center gap-5 text-center py-4 animate-fade-in">
        <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>

        <div className="flex flex-col gap-1.5">
          <h2 className="text-lg font-bold text-white">{copy.successTitle}</h2>
          <p className="text-xs text-white/60 leading-relaxed">{successMsg}</p>
        </div>

        <Link
          href={routes.studioUrl}
          className="w-full h-11 rounded-full bg-brand hover:bg-brand-hover text-white text-sm font-semibold transition-all duration-200 shadow-elevation-2 flex items-center justify-center cursor-pointer"
        >
          {copy.returnStudio}
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6">
      {/* 当前登录账号提示卡 */}
      <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white/70 flex items-center justify-between">
        <span className="text-white/50">{copy.currentAccount}</span>
        <span className="font-mono text-white font-medium">
          {currentUser.email || currentUser.phone || currentUser.name || 'Creator'}
        </span>
      </div>

      {/* 错误提示条 */}
      {errorMsg && (
        <div className="px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2 animate-fade-in">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="flex-1">{errorMsg}</span>
        </div>
      )}

      {/* 改密主表单 */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* 原密码 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-white/70">
            {copy.oldPasswordLabel}
          </label>
          <input
            type="password"
            autoComplete="current-password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            placeholder={copy.oldPasswordPlaceholder}
            className="w-full h-11 px-3.5 rounded-xl bg-[#101216] border border-white/10 text-white placeholder-white/30 text-xs sm:text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/50 transition-all font-mono"
          />
        </div>

        {/* 新密码 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-white/70">
            {copy.newPasswordLabel}
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={copy.newPasswordPlaceholder}
              className="w-full h-11 pl-3.5 pr-10 rounded-xl bg-[#101216] border border-white/10 text-white placeholder-white/30 text-xs sm:text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/50 transition-all font-mono"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 p-1 cursor-pointer transition-colors"
            >
              {showPassword ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* 确认新密码 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-white/70">
            {copy.confirmPasswordLabel}
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={copy.confirmPasswordPlaceholder}
            className="w-full h-11 px-3.5 rounded-xl bg-[#101216] border border-white/10 text-white placeholder-white/30 text-xs sm:text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/50 transition-all font-mono"
          />
        </div>

        {/* 提交改密按钮 */}
        <button
          type="submit"
          disabled={busy}
          className="w-full h-11 mt-2 rounded-full bg-brand hover:bg-brand-hover active:bg-brand-active disabled:opacity-50 text-white text-sm font-semibold transition-all duration-200 shadow-elevation-2 flex items-center justify-center gap-2 cursor-pointer"
        >
          {busy && <span className="animate-spin text-sm">◌</span>}
          <span>{copy.submitChange}</span>
        </button>
      </form>

      {/* 取消返回工作台 */}
      <div className="pt-2 text-center text-xs text-white/60">
        <Link
          href={routes.studioUrl}
          className="text-white/60 hover:text-white underline-offset-4 hover:underline transition-colors"
        >
          {copy.returnStudio}
        </Link>
      </div>
    </div>
  );
}

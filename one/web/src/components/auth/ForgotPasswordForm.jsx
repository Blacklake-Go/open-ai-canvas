'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getAuthCopy, getAuthRoutes } from '@/lib/authCopy';

export default function ForgotPasswordForm({ locale = 'en' }) {
  const router = useRouter();
  const copy = getAuthCopy(locale).forgot;
  const routes = getAuthRoutes(locale);

  // Mode: 'password' | 'username'
  const [activeTab, setActiveTab] = useState('password');

  // Step: 'request' | 'verify' | 'done'
  const [step, setStep] = useState('request');

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Recovery result for username
  const [recoveredInfo, setRecoveredInfo] = useState(null);

  // Status
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Step 1: Send verification code
  const handleSendCode = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg(copy.errValidEmail);
      return;
    }

    setBusy(true);
    try {
      const endpoint =
        activeTab === 'username'
          ? '/api/auth/username/forgot/email'
          : '/api/auth/password/forgot/email';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send verification code');

      setCountdown(60);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      setInfoMsg(data.message || 'Verification code sent');
      if (step === 'request') {
        setStep('verify');
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Step 2: Reset Password or Recover Username
  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    if (!cleanCode || !/^\d{6}$/.test(cleanCode)) {
      setErrorMsg(copy.errEnterCode);
      return;
    }

    if (activeTab === 'password') {
      if (!newPassword || newPassword.length < 8) {
        setErrorMsg(copy.errPasswordLength);
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMsg(copy.errPasswordMismatch);
        return;
      }
    }

    setBusy(true);
    try {
      if (activeTab === 'password') {
        const res = await fetch('/api/auth/password/reset/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            code: cleanCode,
            password: newPassword,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Reset password failed');

        setStep('done');
      } else {
        const res = await fetch('/api/auth/username/recover/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            code: cleanCode,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Recover account failed');

        setRecoveredInfo(data.user || { email: cleanEmail });
        setStep('done');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Operation failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* 1. 找回类型胶囊切换器 (Tabs Pill) */}
      <div className="flex p-1 rounded-full bg-[#101216] border border-white/10 shadow-elevation-1">
        <button
          type="button"
          onClick={() => {
            setActiveTab('password');
            setStep('request');
            setErrorMsg('');
            setInfoMsg('');
          }}
          className={`flex-1 py-1.5 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer ${
            activeTab === 'password'
              ? 'bg-white/15 text-white shadow-elevation-1'
              : 'text-white/60 hover:text-white'
          }`}
        >
          {copy.tabPassword}
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('username');
            setStep('request');
            setErrorMsg('');
            setInfoMsg('');
          }}
          className={`flex-1 py-1.5 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer ${
            activeTab === 'username'
              ? 'bg-white/15 text-white shadow-elevation-1'
              : 'text-white/60 hover:text-white'
          }`}
        >
          {copy.tabUsername}
        </button>
      </div>

      {/* 提示信息 */}
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

      {infoMsg && (
        <div className="px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2 animate-fade-in">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span className="flex-1">{infoMsg}</span>
        </div>
      )}

      {/* 2. 表单步骤切换 */}
      {step === 'request' && (
        <form onSubmit={handleSendCode} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-white/70">
              {copy.emailLabel}
            </label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={copy.emailPlaceholder}
              className="w-full h-11 px-3.5 rounded-xl bg-[#101216] border border-white/10 text-white placeholder-white/30 text-xs sm:text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/50 transition-all font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full h-11 mt-2 rounded-full bg-brand hover:bg-brand-hover active:bg-brand-active disabled:opacity-50 text-white text-sm font-semibold transition-all duration-200 shadow-elevation-2 flex items-center justify-center gap-2 cursor-pointer"
          >
            {busy && <span className="animate-spin text-sm">◌</span>}
            <span>{copy.nextStep}</span>
          </button>
        </form>
      )}

      {step === 'verify' && (
        <form onSubmit={handleVerifySubmit} className="flex flex-col gap-4 animate-fade-in">
          {/* 已填邮箱预览 */}
          <div className="flex items-center justify-between text-xs text-white/60 px-1">
            <span>{email}</span>
            <button
              type="button"
              onClick={() => setStep('request')}
              className="text-brand hover:underline cursor-pointer"
            >
              修改邮箱
            </button>
          </div>

          {/* 验证码输入与重新发送 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-white/70">
              {copy.codeLabel}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={copy.codePlaceholder}
                className="flex-1 h-11 px-3.5 rounded-xl bg-[#101216] border border-white/10 text-white placeholder-white/30 text-xs sm:text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/50 transition-all font-mono tracking-widest"
              />
              <button
                type="button"
                disabled={busy || countdown > 0}
                onClick={handleSendCode}
                className="h-11 px-4 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 disabled:opacity-40 border border-white/10 text-xs text-white font-medium transition-all cursor-pointer whitespace-nowrap"
              >
                {countdown > 0 ? copy.resendCode(countdown) : copy.sendCode}
              </button>
            </div>
          </div>

          {/* 仅在重置密码模式显示新密码输入 */}
          {activeTab === 'password' && (
            <>
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
            </>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full h-11 mt-2 rounded-full bg-brand hover:bg-brand-hover active:bg-brand-active disabled:opacity-50 text-white text-sm font-semibold transition-all duration-200 shadow-elevation-2 flex items-center justify-center gap-2 cursor-pointer"
          >
            {busy && <span className="animate-spin text-sm">◌</span>}
            <span>{activeTab === 'password' ? copy.submitReset : copy.submitRecover}</span>
          </button>
        </form>
      )}

      {step === 'done' && (
        <div className="flex flex-col items-center gap-5 text-center py-4 animate-fade-in">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>

          {activeTab === 'password' ? (
            <div className="flex flex-col gap-1.5">
              <h2 className="text-lg font-bold text-white">{copy.successResetTitle}</h2>
              <p className="text-xs text-white/60">{copy.successResetDesc}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-bold text-white">{copy.successRecoverTitle}</h2>
              <div className="p-3.5 rounded-xl bg-[#101216] border border-white/10 text-xs text-left flex flex-col gap-1">
                {recoveredInfo?.name && (
                  <div className="text-white">
                    <span className="text-white/60">{copy.usernameFound} </span>
                    <span className="font-semibold">{recoveredInfo.name}</span>
                  </div>
                )}
                <div className="text-white">
                  <span className="text-white/60">{copy.emailFound} </span>
                  <span className="font-mono">{recoveredInfo?.email || email}</span>
                </div>
              </div>
            </div>
          )}

          <Link
            href={routes.loginUrl}
            className="w-full h-11 rounded-full bg-brand hover:bg-brand-hover text-white text-sm font-semibold transition-all duration-200 shadow-elevation-2 flex items-center justify-center cursor-pointer"
          >
            {copy.backToLogin}
          </Link>
        </div>
      )}

      {/* 底部返回登录 */}
      {step !== 'done' && (
        <div className="pt-2 text-center text-xs text-white/60">
          <Link
            href={routes.loginUrl}
            className="text-brand hover:text-brand-hover font-medium underline-offset-4 hover:underline transition-colors"
          >
            {copy.backToLogin}
          </Link>
        </div>
      )}
    </div>
  );
}

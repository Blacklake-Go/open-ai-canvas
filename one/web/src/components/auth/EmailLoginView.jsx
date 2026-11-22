'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function EmailLoginView({
  email,
  setEmail,
  password,
  setPassword,
  onSubmit,
  onForgotPassword,
  busy = false,
  copy = {},
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium text-ink-muted">
          {copy.emailLabel || '邮箱 / 账号'}
        </label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={copy.emailPlaceholder || 'name@example.com'}
          className="w-full h-11 px-3.5 rounded-xl bg-well border border-line-subtle text-ink placeholder-ink-subtle text-xs sm:text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/50 transition-all font-mono"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-medium text-ink-muted">
            {copy.passwordLabel || '密码'}
          </label>
          {onForgotPassword && (
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-[11px] text-brand hover:text-brand-hover hover:underline cursor-pointer"
            >
              {copy.forgotPasswordLink || '忘记密码？'}
            </button>
          )}
        </div>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={copy.passwordPlaceholder || '输入您的账号密码'}
            className="w-full h-11 pl-3.5 pr-10 rounded-xl bg-well border border-line-subtle text-ink placeholder-ink-subtle text-xs sm:text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/50 transition-all font-mono"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink p-1 cursor-pointer transition-colors"
            aria-label={showPassword ? '隐藏密码' : '显示密码'}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full h-11 mt-1 rounded-full bg-brand hover:bg-brand-hover active:bg-brand-active disabled:opacity-50 text-white text-xs sm:text-sm font-semibold transition-all duration-200 shadow-elevation-2 flex items-center justify-center gap-2 cursor-pointer"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        <span>{copy.submitLogin || '立即登录'}</span>
      </button>
    </form>
  );
}

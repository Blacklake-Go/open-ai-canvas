'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function RegisterView({
  registerEmail,
  setRegisterEmail,
  registerCode,
  setRegisterCode,
  registerPassword,
  setRegisterPassword,
  inviteCode,
  setInviteCode,
  agreed,
  setAgreed,
  registerCountdown,
  onSendCode,
  onSubmit,
  onSwitchToLogin,
  busy = false,
  copy = {},
  routes = {},
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3.5 animate-fade-in">
      {/* 邮箱 */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium text-ink-muted">
          {copy.emailLabel || '电子邮箱'}
        </label>
        <input
          type="email"
          required
          autoComplete="email"
          value={registerEmail}
          onChange={(e) => setRegisterEmail(e.target.value)}
          placeholder={copy.emailPlaceholder || 'name@example.com'}
          className="w-full h-11 px-3.5 rounded-xl bg-well border border-line-subtle text-ink placeholder-ink-subtle text-xs sm:text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/50 transition-all font-mono"
        />
      </div>

      {/* 邮件验证码 */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium text-ink-muted">
          {copy.codeLabel || '邮箱验证码'}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            required
            maxLength={6}
            value={registerCode}
            onChange={(e) => setRegisterCode(e.target.value)}
            placeholder={copy.codePlaceholder || '6 位验证码'}
            className="flex-1 h-11 px-3.5 rounded-xl bg-well border border-line-subtle text-ink placeholder-ink-subtle text-xs sm:text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/50 transition-all font-mono tracking-widest text-center"
          />
          <button
            type="button"
            disabled={registerCountdown > 0 || busy}
            onClick={onSendCode}
            className="h-11 px-3.5 rounded-xl bg-wash hover:bg-surface-raised disabled:opacity-50 text-ink text-xs font-medium border border-line-subtle transition-colors shrink-0 cursor-pointer"
          >
            {registerCountdown > 0
              ? (copy.resendCode ? copy.resendCode(registerCountdown) : `${registerCountdown}s 后重发`)
              : (copy.sendCode || '获取验证码')}
          </button>
        </div>
      </div>

      {/* 设置登录密码 */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium text-ink-muted">
          {copy.passwordLabel || '设置登录密码 (至少8位)'}
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="new-password"
            value={registerPassword}
            onChange={(e) => setRegisterPassword(e.target.value)}
            placeholder={copy.passwordPlaceholder || '设置 8 位以上高强度密码'}
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

      {/* 邀请码 (可选) */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium text-ink-muted">
          {copy.inviteCodeLabel || '邀请码 (选填)'}
        </label>
        <input
          type="text"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          placeholder={copy.inviteCodePlaceholder || '若有邀请码请填写'}
          className="w-full h-11 px-3.5 rounded-xl bg-well border border-line-subtle text-ink placeholder-ink-subtle text-xs sm:text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/50 transition-all font-mono"
        />
      </div>

      {/* 条款勾选 */}
      <label className="flex items-start gap-2 cursor-pointer pt-1 text-[11px] text-ink-muted">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 rounded border-line-subtle bg-well text-brand focus:ring-brand/50 cursor-pointer"
        />
        <span className="leading-tight">
          {copy.agreePrompt || '注册即代表同意 '}
          <Link href={routes.termsUrl || '/terms'} target="_blank" className="text-ink hover:underline">
            {copy.termsText || '用户协议'}
          </Link>
          {copy.agreeAnd || ' 与 '}
          <Link href={routes.privacyUrl || '/privacy'} target="_blank" className="text-ink hover:underline">
            {copy.privacyText || '隐私政策'}
          </Link>
        </span>
      </label>

      <button
        type="submit"
        disabled={busy}
        className="w-full h-11 mt-1 rounded-full bg-brand hover:bg-brand-hover active:bg-brand-active disabled:opacity-50 text-white text-xs sm:text-sm font-semibold transition-all duration-200 shadow-elevation-2 flex items-center justify-center gap-2 cursor-pointer"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        <span>{copy.submitRegister || '立即注册'}</span>
      </button>

      {/* 切换至登录 */}
      {onSwitchToLogin && (
        <div className="text-center text-[11px] text-ink-muted pt-1">
          <span>{copy.hasAccountPrompt || '已有账号？'} </span>
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-brand hover:text-brand-hover font-semibold hover:underline cursor-pointer"
          >
            {copy.signInLink || '直接登录'}
          </button>
        </div>
      )}
    </form>
  );
}

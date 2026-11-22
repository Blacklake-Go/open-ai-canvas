'use client';

import React from 'react';
import { Loader2, Check } from 'lucide-react';

export default function ForgotPasswordView({
  forgotTab,
  setForgotTab,
  forgotEmail,
  setForgotEmail,
  forgotStep,
  forgotCode,
  setForgotCode,
  forgotNewPassword,
  setForgotNewPassword,
  forgotConfirmPassword,
  setForgotConfirmPassword,
  forgotCountdown,
  usernameRecoverResult,
  onResetRecoverResult,
  onSubmit,
  onSwitchToLogin,
  busy = false,
  copy = {},
}) {
  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* 找回模式胶囊切换器：重置密码 vs 找回账号 */}
      <div className="h-10 rounded-full bg-well border border-line-subtle p-1 flex items-center mb-1">
        <button
          type="button"
          onClick={() => setForgotTab('password')}
          className={`flex-1 h-full rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
            forgotTab === 'password'
              ? 'bg-wash text-ink shadow-elevation-1'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          {copy.tabPassword || '重置密码'}
        </button>
        <button
          type="button"
          onClick={() => setForgotTab('username')}
          className={`flex-1 h-full rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
            forgotTab === 'username'
              ? 'bg-wash text-ink shadow-elevation-1'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          {copy.tabUsername || '找回账号'}
        </button>
      </div>

      {usernameRecoverResult ? (
        <div className="flex flex-col items-center gap-4 py-3 text-center animate-fade-in">
          <div className="size-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Check className="size-6" />
          </div>
          <div className="flex flex-col gap-1.5 w-full bg-wash border border-line-subtle p-3.5 rounded-xl text-xs">
            <div className="flex justify-between text-ink-muted">
              <span>{copy.usernameFound || '找到账号名：'}</span>
              <span className="font-mono text-ink font-bold">{usernameRecoverResult.username || 'Creator'}</span>
            </div>
            {usernameRecoverResult.userNumber && (
              <div className="flex justify-between text-ink-muted">
                <span>账号编号：</span>
                <span className="font-mono text-ink font-bold">#{usernameRecoverResult.userNumber}</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              onResetRecoverResult?.();
              onSwitchToLogin?.();
            }}
            className="w-full h-11 rounded-full bg-brand hover:bg-brand-hover text-white text-xs sm:text-sm font-semibold transition-all duration-200 shadow-elevation-2 flex items-center justify-center cursor-pointer"
          >
            {copy.backToLogin || '返回登录'}
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
          {/* 绑定邮箱 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-ink-muted">
              {copy.emailLabel || '账号注册邮箱'}
            </label>
            <input
              type="email"
              required
              disabled={forgotStep === 'verify'}
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder={copy.emailPlaceholder || 'name@example.com'}
              className="w-full h-11 px-3.5 rounded-xl bg-well border border-line-subtle text-ink placeholder-ink-subtle text-xs sm:text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/50 transition-all font-mono disabled:opacity-60"
            />
          </div>

          {/* 第二步：验证码与新密码 */}
          {forgotStep === 'verify' && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-ink-muted">
                  {copy.codeLabel || '邮箱验证码'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={forgotCode}
                    onChange={(e) => setForgotCode(e.target.value)}
                    placeholder={copy.codePlaceholder || '6 位验证码'}
                    className="flex-1 h-11 px-3.5 rounded-xl bg-well border border-line-subtle text-ink placeholder-ink-subtle text-xs sm:text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/50 transition-all font-mono tracking-widest text-center"
                  />
                  <button
                    type="button"
                    disabled={forgotCountdown > 0 || busy}
                    onClick={onSubmit}
                    className="h-11 px-3.5 rounded-xl bg-wash hover:bg-surface-raised disabled:opacity-50 text-ink text-xs font-medium border border-line-subtle transition-colors shrink-0 cursor-pointer"
                  >
                    {forgotCountdown > 0
                      ? (copy.resendCode ? copy.resendCode(forgotCountdown) : `${forgotCountdown}s 后重发`)
                      : (copy.sendCode || '获取验证码')}
                  </button>
                </div>
              </div>

              {forgotTab === 'password' && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-medium text-ink-muted">
                      {copy.newPasswordLabel || '新密码 (至少8位)'}
                    </label>
                    <input
                      type="password"
                      required
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      placeholder={copy.newPasswordPlaceholder || '设置新登录密码'}
                      className="w-full h-11 px-3.5 rounded-xl bg-well border border-line-subtle text-ink placeholder-ink-subtle text-xs sm:text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/50 transition-all font-mono"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-medium text-ink-muted">
                      {copy.confirmPasswordLabel || '确认新密码'}
                    </label>
                    <input
                      type="password"
                      required
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      placeholder={copy.confirmPasswordPlaceholder || '再次输入新登录密码'}
                      className="w-full h-11 px-3.5 rounded-xl bg-well border border-line-subtle text-ink placeholder-ink-subtle text-xs sm:text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/50 transition-all font-mono"
                    />
                  </div>
                </>
              )}
            </>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full h-11 mt-1 rounded-full bg-brand hover:bg-brand-hover active:bg-brand-active disabled:opacity-50 text-white text-xs sm:text-sm font-semibold transition-all duration-200 shadow-elevation-2 flex items-center justify-center gap-2 cursor-pointer"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            <span>
              {forgotStep === 'request'
                ? (copy.nextStep || '发送验证码')
                : forgotTab === 'username'
                  ? (copy.submitRecover || '立即找回')
                  : (copy.submitReset || '重置密码并登录')}
            </span>
          </button>

          {onSwitchToLogin && (
            <div className="text-center text-[11px] text-ink-muted pt-1">
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="text-brand hover:text-brand-hover font-semibold hover:underline cursor-pointer"
              >
                {copy.backToLogin || '返回登录'}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

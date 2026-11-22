'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  GoogleIcon,
  XIcon,
  TikTokIcon,
  InstagramIcon,
  WeChatIcon,
  QQIcon,
  DouyinIcon,
  BilibiliIcon,
} from '@/components/SocialIcons';
import { getAuthCopy, getAuthRoutes } from '@/lib/authCopy';
import { openOAuthPopup } from '@/lib/auth/oauthPopup';
import { fetchSocialOptions as fetchSocialOptionsRequest } from '@/lib/auth/socialOptionsClient';

const SOCIAL_ICONS = {
  google: { label: 'Google', icon: GoogleIcon },
  x: { label: 'X', icon: XIcon },
  tiktok: { label: 'TikTok', icon: TikTokIcon },
  instagram: { label: 'Instagram', icon: InstagramIcon },
  wechat: { label: '微信', icon: WeChatIcon },
  qq: { label: 'QQ', icon: QQIcon },
  douyin: { label: '抖音', icon: DouyinIcon },
  bilibili: { label: '哔哩哔哩', icon: BilibiliIcon },
};

export default function RegisterForm({ locale = 'en' }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const copy = getAuthCopy(locale).register;
  const routes = getAuthRoutes(locale);

  const redirectUrl = searchParams.get('redirect') || routes.studioUrl;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  // Countdown & status
  const [countdown, setCountdown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [agreed, setAgreed] = useState(true);
  const [socialProviders, setSocialProviders] = useState([]);

  const timerRef = useRef(null);
  const handledAuthRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // 监听 URL 中的第三方授权错误参数
  useEffect(() => {
    const authError = searchParams?.get('auth_error');
    if (authError) {
      setErrorMsg(decodeURIComponent(authError));
    }
  }, [searchParams]);

  const fetchSocialOptions = useCallback(async () => {
    const data = await fetchSocialOptionsRequest();
    if (!data) return;
    setSocialProviders(data.providers.filter((p) => Boolean(SOCIAL_ICONS[p.id])));
  }, []);

  // 获取当前区域启用的第三方社交平台列表
  useEffect(() => {
    fetchSocialOptions();
  }, [fetchSocialOptions]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleOAuthEvent = (data) => {
      if (!data || (data.type !== 'supdance-auth-complete' && data.type !== 'koyosim-auth-complete')) return;
      if (data.action === 'bind') return;
      if (data.ok) {
        if (handledAuthRef.current) return;
        handledAuthRef.current = true;
        const target = data.targetUrl || redirectUrl;
        window.location.replace(target);
      } else if (data.message) {
        setErrorMsg(data.message);
      }
    };

    const handleWindowMessage = (event) => handleOAuthEvent(event?.data);
    const handleStorageChange = (event) => {
      if ((event.key === 'supdance_auth_event' || event.key === 'supdance-oauth-sync' || event.key === 'koyosim_auth_event' || event.key === 'koyosim-oauth-sync') && event.newValue) {
        try {
          handleOAuthEvent(JSON.parse(event.newValue));
        } catch {}
      }
    };

    let channel = null;
    let channelKoyo = null;
    try {
      if ('BroadcastChannel' in window) {
        channel = new BroadcastChannel('supdance_auth_channel');
        channel.onmessage = (event) => handleOAuthEvent(event.data);
        channelKoyo = new BroadcastChannel('koyosim_auth_channel');
        channelKoyo.onmessage = (event) => handleOAuthEvent(event.data);
      }
    } catch {}

    window.addEventListener('message', handleWindowMessage);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      if (channel) channel.close();
      if (channelKoyo) channelKoyo.close();
      window.removeEventListener('message', handleWindowMessage);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [redirectUrl, router]);

  const handleOAuth = (providerId) => {
    const url = `/api/auth/oauth/${providerId}?returnTo=${encodeURIComponent(redirectUrl)}&redirect=${encodeURIComponent(redirectUrl)}`;
    openOAuthPopup(url);
  };

  // Send Email Register Code
  const handleSendCode = async () => {
    setErrorMsg('');
    setInfoMsg('');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg(copy.errValidEmail);
      return;
    }

    setSendingCode(true);
    try {
      const res = await fetch('/api/auth/register/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, locale }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || copy.errSendCodeFailed);

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

      setInfoMsg(data.message || copy.msgCodeSent);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSendingCode(false);
    }
  };

  // Submit Register
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    if (!agreed) {
      setErrorMsg(copy.errAgree);
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();
    if (!cleanEmail) {
      setErrorMsg(copy.errValidEmail);
      return;
    }
    if (!cleanCode || !/^\d{6}$/.test(cleanCode)) {
      setErrorMsg(copy.errEnterCode);
      return;
    }
    if (!password || password.length < 8) {
      setErrorMsg(copy.errPasswordLength);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          code: cleanCode,
          inviteCode: inviteCode.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      setInfoMsg(copy.msgRegisterSuccess);
      setTimeout(() => {
        window.location.replace(redirectUrl);
      }, 500);
    } catch (err) {
      setErrorMsg(err.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* 提示信息条 */}
      {errorMsg && (
        <div className="px-3.5 py-2.5 rounded-xl bg-danger-soft border border-danger-line text-danger text-label flex items-center gap-2 animate-fade-in">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="flex-1">{errorMsg}</span>
        </div>
      )}

      {infoMsg && (
        <div className="px-3.5 py-2.5 rounded-xl bg-success-soft border border-success-line text-success text-label flex items-center gap-2 animate-fade-in">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span className="flex-1">{infoMsg}</span>
        </div>
      )}

      {/* 注册表单 */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* 邮箱输入 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-label font-medium text-ink-muted">
            {copy.emailLabel}
          </label>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={copy.emailPlaceholder}
            className="w-full h-control-lg px-3.5 rounded-xl bg-well border border-line-subtle text-ink placeholder-ink-disabled text-body-sm control-focus transition-[border-color,background-color] duration-fast font-mono"
          />
        </div>

        {/* 邮件验证码 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-label font-medium text-ink-muted">
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
              className="flex-1 h-control-lg px-3.5 rounded-xl bg-well border border-line-subtle text-ink placeholder-ink-disabled text-body-sm control-focus transition-[border-color,background-color] duration-fast font-mono tracking-widest"
            />
            <button
              type="button"
              disabled={sendingCode || countdown > 0}
              onClick={handleSendCode}
              className="control-focus h-control-lg rounded-lg border border-line-subtle bg-wash px-4 text-label font-medium text-ink-muted whitespace-nowrap transition-[background-color,border-color,color] duration-fast ease-standard hover:border-line hover:bg-wash-strong hover:text-ink active:scale-[0.98] active:duration-press disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {countdown > 0 ? copy.resendCode(countdown) : copy.sendCode}
            </button>
          </div>
        </div>

        {/* 密码输入 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-label font-medium text-ink-muted">
            {copy.passwordLabel}
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={copy.passwordPlaceholder}
              className="w-full h-control-lg pl-3.5 pr-10 rounded-xl bg-well border border-line-subtle text-ink placeholder-ink-disabled text-body-sm control-focus transition-[border-color,background-color] duration-fast font-mono"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 control-focus rounded-sm p-1 text-ink-subtle hover:text-ink transition-colors duration-fast"
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

        {/* 邀请码 (可选) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-label font-medium text-ink-muted">
            {copy.inviteCodeLabel}
          </label>
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder={copy.inviteCodePlaceholder}
            className="w-full h-control-lg px-3.5 rounded-xl bg-well border border-line-subtle text-ink placeholder-ink-disabled text-body-sm control-focus transition-[border-color,background-color] duration-fast font-mono"
          />
        </div>

        {/* 协议勾选 */}
        <div className="flex items-start gap-2 pt-1">
          <input
            type="checkbox"
            id="agreement"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="control-focus mt-0.5 rounded-xs border-line bg-well text-brand cursor-pointer"
          />
          <label htmlFor="agreement" className="text-label text-ink-muted leading-normal cursor-pointer">
            {copy.agreePrompt}
            <Link href={routes.termsUrl} target="_blank" className="text-ink hover:text-brand-text transition-colors underline">
              {copy.termsText}
            </Link>
            {copy.agreeAnd}
            <Link href={routes.privacyUrl} target="_blank" className="text-ink hover:text-brand-text transition-colors underline">
              {copy.privacyText}
            </Link>
          </label>
        </div>

        {/* 注册提交按钮 */}
        <button
          type="submit"
          disabled={busy}
          className="control-focus w-full h-control-lg mt-2 rounded-lg bg-brand text-label font-semibold text-ink-on-accent transition-[background-color,color,transform] duration-fast ease-standard hover:bg-brand-hover-solid active:bg-brand-active-solid active:scale-[0.99] active:duration-press disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
        >
          {busy && <span className="animate-spin text-sm">◌</span>}
          <span>{copy.submitRegister}</span>
        </button>
      </form>

      {/* 第三方社交平台快捷注册与登录 */}
      {socialProviders.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-line-subtle" />
            </div>
            <span className="relative px-3 bg-surface-raised text-micro text-ink-subtle uppercase tracking-wider">
              {copy.socialDivider}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {socialProviders.map((provider) => {
              const item = SOCIAL_ICONS[provider.id];
              if (!item) return null;
              const Icon = item.icon;
              const btnLabel = copy.socialRegisterLabel
                ? copy.socialRegisterLabel(item.label)
                : (String(locale || '').startsWith('zh') ? `${item.label} 快捷注册` : item.label);
              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => handleOAuth(provider.id)}
                  title={btnLabel}
                  className="control-focus h-control-md rounded-lg border border-line-subtle bg-wash px-3.5 text-label font-medium text-ink-muted transition-[background-color,border-color,color,transform] duration-fast ease-standard hover:border-line hover:bg-wash-strong hover:text-ink active:scale-[0.98] active:duration-press flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Icon size={18} />
                  <span className="truncate">{btnLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 前往登录 */}
      <div className="pt-2 text-center text-body-sm text-ink-muted">
        <span>{copy.hasAccountPrompt} </span>
        <Link
          href={routes.loginUrl}
          className="text-brand-text hover:underline font-medium underline-offset-4 hover:underline transition-colors"
        >
          {copy.signInLink}
        </Link>
      </div>
    </div>
  );
}

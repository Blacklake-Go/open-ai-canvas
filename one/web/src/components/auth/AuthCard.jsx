'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getAuthCopy, getAuthRoutes } from '@/lib/authCopy';
import { normalizeLocale } from '@/lib/locales';
import EmailLoginView from './EmailLoginView';
import PhoneLoginView from './PhoneLoginView';
import RegisterView from './RegisterView';
import ForgotPasswordView from './ForgotPasswordView';
import SocialLoginButtons, { SOCIAL_PROVIDER_META } from './SocialLoginButtons';
import { fetchSocialOptions as fetchSocialOptionsRequest } from '@/lib/auth/socialOptionsClient';

export default function AuthCard({
  initialMode = 'login',
  initialTab = 'email',
  locale = null,
  onSuccess,
  onClose,
  showClose = false,
  className = '',
  embedded = false,
}) {
  const getCookieLocale = () => {
    if (typeof document === 'undefined') return null;
    const m = document.cookie.match(/(?:^|;\s*)(?:NEXT_LOCALE|locale)=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  };
  const activeLocale = normalizeLocale(locale || getCookieLocale() || 'zh-CN');
  const copy = getAuthCopy(activeLocale);
  const routes = getAuthRoutes(activeLocale);

  // Main Mode: 'login' | 'register' | 'forgot'
  const [mode, setMode] = useState(
    initialMode === 'register' ? 'register' : initialMode === 'forgot' || initialMode === 'reset' ? 'forgot' : 'login'
  );

  useEffect(() => {
    if (initialMode === 'register') setMode('register');
    else if (initialMode === 'forgot' || initialMode === 'reset' || initialMode === 'recover-username') setMode('forgot');
    else setMode('login');
  }, [initialMode]);

  // Login Mode State
  const [loginTab, setLoginTab] = useState(initialTab === 'phone' ? 'phone' : 'email');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [countryCode, setCountryCode] = useState('+86');
  const [phone, setPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneCountdown, setPhoneCountdown] = useState(0);
  const phoneTimerRef = useRef(null);

  // Register Mode State
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerCode, setRegisterCode] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [registerCountdown, setRegisterCountdown] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const registerTimerRef = useRef(null);

  // Forgot Password / Account Mode State
  const [forgotTab, setForgotTab] = useState('password');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState('request');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotCountdown, setForgotCountdown] = useState(0);
  const [usernameRecoverResult, setUsernameRecoverResult] = useState(null);
  const forgotTimerRef = useRef(null);

  // Feedback & Busy
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [socialProviders, setSocialProviders] = useState([]);

  // Timers cleanup
  useEffect(() => {
    return () => {
      if (phoneTimerRef.current) clearInterval(phoneTimerRef.current);
      if (registerTimerRef.current) clearInterval(registerTimerRef.current);
      if (forgotTimerRef.current) clearInterval(forgotTimerRef.current);
    };
  }, []);

  const fetchSocialOptions = useCallback(async () => {
    const data = await fetchSocialOptionsRequest();
    if (!data) return;
    setSocialProviders(data.providers.filter((p) => Boolean(SOCIAL_PROVIDER_META[p.id])));
  }, []);

  // Fetch Regional Social Providers
  useEffect(() => {
    fetchSocialOptions();
  }, [fetchSocialOptions]);

  // Surface OAuth errors from popup or query string
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    try {
      const params = new URLSearchParams(window.location.search);
      const authError = params.get('auth_error');
      if (authError) setErrorMsg(decodeURIComponent(authError));
    } catch {}

    const handleOAuthEvent = (data) => {
      if (!data || (data.type !== 'supdance-auth-complete' && data.type !== 'koyosim-auth-complete')) return;
      if (data.action === 'bind') return;
      if (!data.ok && data.message) {
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
  }, []);

  const switchMode = (newMode) => {
    setErrorMsg('');
    setInfoMsg('');
    setMode(newMode);
  };

  // 1. Phone SMS Code
  const handleSendPhoneCode = async () => {
    setErrorMsg('');
    setInfoMsg('');
    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      setErrorMsg(copy.login.errEnterPhone);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/phone/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, countryCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send SMS code');

      setPhoneCountdown(60);
      if (phoneTimerRef.current) clearInterval(phoneTimerRef.current);
      phoneTimerRef.current = setInterval(() => {
        setPhoneCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(phoneTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      setInfoMsg(copy.login.msgCodeSent);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  // 2. Email Register Code
  const handleSendRegisterCode = async () => {
    setErrorMsg('');
    setInfoMsg('');
    const cleanEmail = registerEmail.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg(copy.register.errValidEmail);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/register/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, locale: activeLocale }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || copy.register.errSendCodeFailed);

      setRegisterCountdown(60);
      if (registerTimerRef.current) clearInterval(registerTimerRef.current);
      registerTimerRef.current = setInterval(() => {
        setRegisterCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(registerTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      setInfoMsg(copy.register.msgCodeSent);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  // 3. Login Submit
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setBusy(true);

    try {
      if (loginTab === 'phone') {
        const cleanPhone = phone.trim();
        const cleanCode = phoneCode.trim();
        if (!cleanPhone) throw new Error(copy.login.errEnterPhone);
        if (!cleanCode) throw new Error(copy.login.errEnterPhoneCode);

        const res = await fetch('/api/auth/phone/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: cleanPhone, countryCode, code: cleanCode }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || copy.login.errLoginFailed);
        onSuccess?.(data.user, { isNew: Boolean(data.isNew), provider: 'phone' });
      } else {
        const cleanEmail = loginEmail.trim().toLowerCase();
        if (!cleanEmail) throw new Error(copy.login.errEnterEmail);
        if (!loginPassword) throw new Error(copy.login.errEnterPassword);

        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password: loginPassword }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || copy.login.errLoginFailed);
        onSuccess?.(data.user, { isNew: false, provider: 'email' });
      }
    } catch (err) {
      setErrorMsg(err.message || copy.login.errLoginFailed);
    } finally {
      setBusy(false);
    }
  };

  // 4. Register Submit
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    if (!agreed) {
      setErrorMsg(copy.register.errAgree);
      return;
    }
    const cleanEmail = registerEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg(copy.register.errValidEmail);
      return;
    }
    if (!registerCode || registerCode.trim().length !== 6) {
      setErrorMsg(copy.register.errEnterCode);
      return;
    }
    if (!registerPassword || registerPassword.length < 8) {
      setErrorMsg(copy.register.errPasswordLength);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password: registerPassword,
          code: registerCode.trim(),
          inviteCode: inviteCode.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      onSuccess?.(data.user, { isNew: true, provider: 'email' });
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  // 5. Forgot Password / Account Submit
  const handleForgotSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg(copy.forgot.errValidEmail);
      return;
    }

    setBusy(true);
    try {
      if (forgotStep === 'request') {
        const endpoint =
          forgotTab === 'username'
            ? '/api/auth/username/forgot/email'
            : '/api/auth/password/forgot/email';

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, locale: activeLocale }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to send recovery code');

        setForgotStep('verify');
        setForgotCountdown(60);
        if (forgotTimerRef.current) clearInterval(forgotTimerRef.current);
        forgotTimerRef.current = setInterval(() => {
          setForgotCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(forgotTimerRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        setInfoMsg(data.message || '验证码已发送至邮箱');
      } else {
        if (!forgotCode || forgotCode.trim().length !== 6) {
          throw new Error(copy.forgot.errEnterCode);
        }

        if (forgotTab === 'username') {
          const res = await fetch('/api/auth/username/recover/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail, code: forgotCode.trim() }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to recover account');
          setUsernameRecoverResult(data);
          setInfoMsg(copy.forgot.successRecoverTitle);
        } else {
          if (!forgotNewPassword || forgotNewPassword.length < 8) {
            throw new Error(copy.forgot.errPasswordLength);
          }
          if (forgotNewPassword !== forgotConfirmPassword) {
            throw new Error(copy.forgot.errPasswordMismatch);
          }

          const res = await fetch('/api/auth/password/reset/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: cleanEmail,
              code: forgotCode.trim(),
              newPassword: forgotNewPassword,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Password reset failed');
          setInfoMsg(copy.forgot.successResetDesc);
          setTimeout(() => {
            switchMode('login');
            setForgotStep('request');
            setForgotCode('');
            setForgotNewPassword('');
            setForgotConfirmPassword('');
          }, 1500);
        }
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  const containerClasses = embedded
    ? `w-full text-ink select-none ${className}`
    : `relative w-full max-w-[450px] my-auto rounded-modal bg-overlay backdrop-blur-2xl border border-line shadow-elevation-4 p-6 sm:p-8 text-ink select-none overflow-hidden animate-scale-in ${className}`;

  return (
    <div
      className={containerClasses}
      onClick={(e) => e.stopPropagation()}
      role="region"
      aria-labelledby="auth-card-title"
    >
      {/* 顶部微透环境漫反射高光 */}
      {!embedded && (
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-24 rounded-full pointer-events-none opacity-40 blur-2xl"
          style={{ background: 'radial-gradient(circle, rgba(225,29,116,0.35) 0%, transparent 70%)' }}
        />
      )}

      {/* 右上角关闭按钮 */}
      {showClose && onClose && (
        <button
          type="button"
          onClick={onClose}
          className="control-focus absolute right-4 top-4 size-control-md rounded-lg bg-wash hover:bg-wash-strong border border-line-subtle text-ink-muted hover:text-ink flex items-center justify-center active:scale-[0.98] active:duration-press transition-[background-color,border-color,color,transform] duration-fast ease-standard cursor-pointer z-10"
          aria-label="关闭"
        >
          <X className="size-3.5" />
        </button>
      )}

      {/* 顶部标题区 */}
      <div className="mb-6 text-center">
        <h2 id="auth-modal-title" className="text-page-title font-semibold tracking-tight text-ink mb-1.5">
          {mode === 'login'
            ? (routes.isChinese ? '创作者账号登录' : 'Creator Account Login')
            : mode === 'register'
              ? (routes.isChinese ? '创建创作者账号' : 'Create Creator Account')
              : (routes.isChinese ? '找回密码与账号' : 'Forgot Password & Account')}
        </h2>
        <p className="text-body-sm text-ink-muted leading-relaxed">
          {mode === 'login'
            ? (routes.isChinese ? '畅享 200+ 生成模型与统一创作算力' : 'Access 200+ generative AI models and unified creative compute')
            : mode === 'register'
              ? (routes.isChinese ? '畅享 200+ 顶尖生成模型与统一算力生态' : 'Access 200+ generative AI models and unified creative compute')
              : (routes.isChinese ? '通过注册邮箱安全重置您的访问凭证' : 'Safely recover or reset your access credentials via email')}
        </p>
      </div>

      {/* 提示消息条 */}
      {errorMsg && (
        <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-danger-soft border border-danger-line text-danger text-label flex items-center gap-2 animate-fade-in">
          <AlertCircle className="size-4 shrink-0" />
          <span className="flex-1">{errorMsg}</span>
        </div>
      )}

      {infoMsg && (
        <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-success-soft border border-success-line text-success text-label flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="size-4 shrink-0" />
          <span className="flex-1">{infoMsg}</span>
        </div>
      )}

      {/* ── 1. 登录表单 ── */}
      {mode === 'login' && (
        <div className="flex flex-col gap-4 animate-fade-in">
          <div className="h-10 rounded-full bg-well border border-line-subtle p-1 flex items-center mb-1">
            <button
              type="button"
              onClick={() => {
                setLoginTab('email');
                setErrorMsg('');
              }}
              className={`control-focus flex-1 h-control-xs rounded-full text-label font-medium transition-none cursor-pointer ${
                loginTab === 'email'
                  ? 'bg-surface-inverse text-ink-inverse font-semibold shadow-elevation-1'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {copy.login.tabEmail || '邮箱登录'}
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginTab('phone');
                setErrorMsg('');
              }}
              className={`control-focus flex-1 h-control-xs rounded-full text-label font-medium transition-none cursor-pointer ${
                loginTab === 'phone'
                  ? 'bg-surface-inverse text-ink-inverse font-semibold shadow-elevation-1'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {copy.login.tabPhone || '手机登录'}
            </button>
          </div>

          {loginTab === 'email' ? (
            <EmailLoginView
              email={loginEmail}
              setEmail={setLoginEmail}
              password={loginPassword}
              setPassword={setLoginPassword}
              onSubmit={handleLoginSubmit}
              onForgotPassword={() => switchMode('forgot')}
              busy={busy}
              copy={copy.login}
            />
          ) : (
            <PhoneLoginView
              countryCode={countryCode}
              setCountryCode={setCountryCode}
              phone={phone}
              setPhone={setPhone}
              phoneCode={phoneCode}
              setPhoneCode={setPhoneCode}
              phoneCountdown={phoneCountdown}
              onSendCode={handleSendPhoneCode}
              onSubmit={handleLoginSubmit}
              busy={busy}
              copy={copy.login}
            />
          )}

          {socialProviders.length > 0 && (
            <SocialLoginButtons
              providers={socialProviders}
              dividerText={copy.login.socialDivider || '或使用快捷方式'}
              actionLabel={routes.isChinese ? '登录' : ''}
            />
          )}

          <div className="text-center text-[11px] text-ink-muted pt-1">
            <span>{copy.login.noAccountPrompt || '还没有账号？'} </span>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className="text-brand-text hover:text-brand-text font-semibold hover:underline cursor-pointer"
            >
              {copy.login.registerLink || '免费注册'}
            </button>
          </div>
        </div>
      )}

      {/* ── 2. 注册表单 ── */}
      {mode === 'register' && (
        <div className="flex flex-col gap-4 animate-fade-in">
          <RegisterView
            registerEmail={registerEmail}
            setRegisterEmail={setRegisterEmail}
            registerCode={registerCode}
            setRegisterCode={setRegisterCode}
            registerPassword={registerPassword}
            setRegisterPassword={setRegisterPassword}
            inviteCode={inviteCode}
            setInviteCode={setInviteCode}
            agreed={agreed}
            setAgreed={setAgreed}
            registerCountdown={registerCountdown}
            onSendCode={handleSendRegisterCode}
            onSubmit={handleRegisterSubmit}
            onSwitchToLogin={() => switchMode('login')}
            busy={busy}
            copy={copy.register}
            routes={routes}
          />

          {socialProviders.length > 0 && (
            <SocialLoginButtons
              providers={socialProviders}
              dividerText={copy.register?.socialDivider || copy.login?.socialDivider || '或使用快捷方式'}
              actionLabel={routes.isChinese ? '快捷注册' : ''}
            />
          )}
        </div>
      )}

      {/* ── 3. 找回密码与账号表单 ── */}
      {mode === 'forgot' && (
        <ForgotPasswordView
          forgotTab={forgotTab}
          setForgotTab={setForgotTab}
          forgotEmail={forgotEmail}
          setForgotEmail={setForgotEmail}
          forgotStep={forgotStep}
          forgotCode={forgotCode}
          setForgotCode={setForgotCode}
          forgotNewPassword={forgotNewPassword}
          setForgotNewPassword={setForgotNewPassword}
          forgotConfirmPassword={forgotConfirmPassword}
          setForgotConfirmPassword={setForgotConfirmPassword}
          forgotCountdown={forgotCountdown}
          usernameRecoverResult={usernameRecoverResult}
          onResetRecoverResult={() => setUsernameRecoverResult(null)}
          onSubmit={handleForgotSubmit}
          onSwitchToLogin={() => switchMode('login')}
          busy={busy}
          copy={copy.forgot}
        />
      )}
    </div>
  );
}

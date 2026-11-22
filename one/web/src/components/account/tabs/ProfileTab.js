'use client';
import OAuthAccountsSection from '../settings/OAuthAccountsSection';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Camera, Loader2, AlertTriangle, Lock, ShieldCheck, Check, Eye, EyeOff } from 'lucide-react';
import {
  BilibiliIcon,
  DouyinIcon,
  GoogleIcon,
  InstagramIcon,
  QQIcon,
  TikTokIcon,
  WeChatIcon,
  XIcon,
  PhoneIcon,
  MailIcon,
} from '@/components/SocialIcons';
import { completePhoneCaptchaChallenge } from '@/lib/auth/phone-captcha-client';
import { DEFAULT_LOCALE } from '@/lib/locales';
import UserAvatar from '@/components/ui/UserAvatar';

const SOCIAL_ACCOUNT_PROVIDERS = {
  wechat: { title: '微信账号', shortName: '微信', icon: WeChatIcon, description: '微信快捷登录' },
  qq: { title: 'QQ 账号', shortName: 'QQ', icon: QQIcon, description: 'QQ 快捷登录' },
  douyin: { title: '抖音账号', shortName: '抖音', icon: DouyinIcon, description: '抖音快捷登录' },
  bilibili: { title: '哔哩哔哩账号', shortName: '哔哩哔哩', icon: BilibiliIcon, description: '哔哩哔哩快捷登录' },
  google: { title: 'Google 账号', shortName: 'Google', icon: GoogleIcon, description: 'Google 全球化快捷登录' },
  x: { title: 'X 账号', shortName: 'X', icon: XIcon, description: 'X 社交账号快捷登录' },
  tiktok: { title: 'TikTok 账号', shortName: 'TikTok', icon: TikTokIcon, description: 'TikTok 全球化快捷登录' },
  instagram: { title: 'Instagram 账号', shortName: 'Instagram', icon: InstagramIcon, description: 'Instagram 社交账号快捷登录' },
};
const SOCIAL_ACCOUNT_PROVIDER_ORDER = ['wechat', 'qq', 'douyin', 'bilibili', 'google', 'x', 'tiktok', 'instagram'];
const PHONE_DIAL_CODES = ['+86', '+1', '+44', '+49', '+61', '+65', '+81', '+82', '+852', '+853', '+886'];

function SettingRow({ icon, title, description, action }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line-subtle py-3 last:border-0 min-h-12">
      <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
        {icon && (
          <div className="size-8 rounded-lg bg-wash border border-line-subtle flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-body-sm font-medium text-ink truncate">{title}</p>
          <p className="mt-0.5 text-caption text-ink-muted truncate">{description}</p>
        </div>
      </div>
      <div className="shrink-0 flex items-center justify-end gap-2">
        {action}
      </div>
    </div>
  );
}

export default function ProfileTab({
  user,
  profileName: propProfileName,
  setProfileName: propSetProfileName,
  onSaveProfile,
  onProfileUpdated,
  busy,
}) {
  const [localName, setLocalName] = useState(user?.displayName || user?.display_name || user?.name || '');
  const profileName = propProfileName !== undefined ? propProfileName : localName;
  const setProfileName = propSetProfileName || setLocalName;

  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(user?.avatar || user?.avatar_url || null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [oauthConnecting, setOauthConnecting] = useState(null);
  const fileInputRef = useRef(null);

  const [currentProviders, setCurrentProviders] = useState(user?.loginProviders || ['phone']);
  const [currentAccounts, setCurrentAccounts] = useState(user?.authAccounts || []);
  const [socialOptions, setSocialOptions] = useState(null);
  const [currentPhone, setCurrentPhone] = useState(user?.phone || '');
  const [currentEmail, setCurrentEmail] = useState(user?.email || '');

  // 密码设置状态
  const [hasPassword, setHasPassword] = useState(Boolean(user?.hasPassword ?? user?.has_password));
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPwd, setShowOldPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [pwdMessage, setPwdMessage] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdBusy, setPwdBusy] = useState(false);

  // 手机号与邮箱绑定弹窗状态
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [inputPhone, setInputPhone] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+86');
  const [inputCode, setInputCode] = useState('');
  const [phoneChallengeId, setPhoneChallengeId] = useState('');
  const [phoneCaptchaChallenge, setPhoneCaptchaChallenge] = useState(null);
  const [phoneCountdown, setPhoneCountdown] = useState(0);
  const phoneTimerRef = useRef(null);
  const phoneCaptchaHostRef = useRef(null);
  const [phoneNotice, setPhoneNotice] = useState('');
  const [phoneBusy, setPhoneBusy] = useState(false);

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [inputEmail, setInputEmail] = useState('');
  const [emailVerificationCode, setEmailVerificationCode] = useState('');
  const [emailVerificationPending, setEmailVerificationPending] = useState(false);
  const [emailNotice, setEmailNotice] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);

  // 解绑确认弹窗状态
  const [unbindTarget, setUnbindTarget] = useState(null);
  const [unbinding, setUnbinding] = useState(false);
  const [unbindError, setUnbindError] = useState('');

  // Toast 状态
  const [toastMessage, setToastMessage] = useState('');
  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    window.setTimeout(() => setToastMessage(''), 3000);
  }, []);

  useEffect(() => {
    setCurrentAvatarUrl(user?.avatar || user?.avatar_url || null);
    if (user?.loginProviders) setCurrentProviders(user?.loginProviders);
    if (user?.authAccounts) setCurrentAccounts(user?.authAccounts);
    if (user?.phone) setCurrentPhone(user?.phone);
    if (user?.email) setCurrentEmail(user?.email);
    if (user?.hasPassword !== undefined || user?.has_password !== undefined) {
      setHasPassword(Boolean(user.hasPassword ?? user.has_password));
    }
    if (user?.displayName || user?.display_name || user?.name) {
      setLocalName(user.displayName || user.display_name || user.name);
    }
  }, [user]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/social-options', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json();
        if (Array.isArray(result?.providers)) {
          setSocialOptions(result);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => () => {
    if (phoneTimerRef.current) clearInterval(phoneTimerRef.current);
  }, []);

  const handledOAuthEventsRef = useRef(new Set());

  // 监听第三方授权回调消息
  useEffect(() => {
    const handleOAuthData = (data) => {
      if (!data || data.type !== 'supdance-auth-complete') return;
      if (data.action && data.action !== 'bind') return;
      const eventKey = data.eventId || `${data.provider}_${data.ok}_${data.action || 'bind'}`;
      if (handledOAuthEventsRef.current.has(eventKey)) return;
      handledOAuthEventsRef.current.add(eventKey);

      setOauthConnecting(null);

      if (data.ok) {
        showToast(data.message || '第三方账号绑定成功！');
        fetch('/api/auth/me', { cache: 'no-store' })
          .then((res) => res.json())
          .then((resData) => {
            if (resData.user) {
              if (resData.user.authAccounts) setCurrentAccounts(resData.user.authAccounts);
              if (resData.user.loginProviders) setCurrentProviders(resData.user.loginProviders);
              if (resData.user.email) setCurrentEmail(resData.user.email);
              if (resData.user.phone) setCurrentPhone(resData.user.phone);
              onProfileUpdated?.(resData.user);
            }
          })
          .catch(() => {});
      } else {
        showToast(data.message || '第三方绑定未完成');
      }
    };

    const handleOAuthMessage = (event) => {
      const isExpectedOrigin =
        event.origin === window.location.origin ||
        (typeof event.origin === 'string' && event.origin.toLowerCase().includes('supdance.com'));
      if (!isExpectedOrigin) return;
      handleOAuthData(event.data);
    };
    window.addEventListener('message', handleOAuthMessage);

    let bc = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('supdance_auth_channel');
        bc.onmessage = (event) => handleOAuthData(event.data);
      }
    } catch {}

    const handleStorage = (event) => {
      if (event.key === 'supdance_auth_event' && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          handleOAuthData(parsed);
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    try {
      const url = new URL(window.location.href);
      const auth = url.searchParams.get('auth');
      const action = url.searchParams.get('action');
      if (auth && (action === 'bind' || url.searchParams.get('provider'))) {
        const errorMsg = url.searchParams.get('auth_error');
        if (auth === 'success') {
          handleOAuthData({ type: 'supdance-auth-complete', ok: true, message: '第三方账号绑定成功！' });
        } else {
          handleOAuthData({ type: 'supdance-auth-complete', ok: false, message: errorMsg || '第三方绑定未完成' });
        }
        url.searchParams.delete('auth');
        url.searchParams.delete('action');
        url.searchParams.delete('provider');
        url.searchParams.delete('auth_error');
        url.searchParams.delete('isNew');
        window.history.replaceState(null, '', url.pathname + (url.search ? url.search : '') + url.hash);
      }
    } catch {}

    return () => {
      window.removeEventListener('message', handleOAuthMessage);
      window.removeEventListener('storage', handleStorage);
      if (bc) {
        try { bc.close(); } catch {}
      }
    };
  }, [onProfileUpdated, showToast]);

  const handleConnectOAuth = (provider) => {
    if (oauthConnecting) return;
    setOauthConnecting(provider);
    const returnTo = `${window.location.pathname}${window.location.search}`;
    const url = `/api/auth/oauth/${provider}?action=bind&returnTo=${encodeURIComponent(returnTo)}`;
    const isMobile = typeof navigator !== 'undefined' && (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (typeof window !== 'undefined' && window.innerWidth < 768));
    if (isMobile) {
      window.location.assign(url);
      return;
    }
    const popup = window.open(url, 'supdance-oauth', 'popup,width=580,height=720');
    if (!popup) {
      window.location.assign(url);
    }
  };

  const handleAvatarFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('请选择有效的图片文件（JPG/PNG/WebP/GIF）');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('头像大小不能超过 5MB');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setAvatarUploading(true);
    try {
      const res = await fetch('/api/user/avatar', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.avatarUrl) {
        setCurrentAvatarUrl(data.avatarUrl);
        showToast('头像已更新');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('user-profile-updated', {
              detail: { avatarUrl: data.avatarUrl, user: data.user },
            })
          );
        }
        onProfileUpdated?.(data.user);
      } else {
        showToast(data.error || '头像上传失败，请重试');
      }
    } catch {
      showToast('网络连接失败，请稍后重试');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSendPhoneCode = async () => {
    if (!inputPhone) return setPhoneNotice('请输入手机号');
    if (phoneCountdown > 0) return;
    setPhoneBusy(true);
    setPhoneNotice('');
    try {
      const postSendCode = async (extra = {}) => {
        const response = await fetch('/api/auth/phone/send-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: inputPhone, countryCode: phoneCountryCode, purpose: 'bind', ...extra }),
        });
        return { response, data: await response.json() };
      };
      let outcome;
      if (phoneCaptchaChallenge) {
        outcome = await completePhoneCaptchaChallenge(phoneCaptchaChallenge, {
          postSendCode,
          locale: user?.locale || DEFAULT_LOCALE,
          container: phoneCaptchaHostRef.current,
        });
      } else {
        outcome = await postSendCode();
        if (outcome.response.status === 428 && outcome.data.requiresCaptcha) {
          setPhoneChallengeId(outcome.data.challengeId);
          setPhoneCaptchaChallenge(outcome.data);
          outcome = await completePhoneCaptchaChallenge(outcome.data, {
            postSendCode,
            locale: user?.locale || DEFAULT_LOCALE,
            container: phoneCaptchaHostRef.current,
          });
        }
      }
      if (!outcome.response.ok || !outcome.data.success) {
        if (outcome.response.status !== 428) {
          setPhoneCaptchaChallenge(null);
          setPhoneChallengeId('');
        }
        throw new Error(outcome.data.error || '验证码发送失败');
      }
      setPhoneChallengeId(outcome.data.challengeId);
      setPhoneCaptchaChallenge(null);
      setPhoneCountdown(Number(outcome.data.cooldown) || 60);
      if (phoneTimerRef.current) clearInterval(phoneTimerRef.current);
      phoneTimerRef.current = setInterval(() => {
        setPhoneCountdown((previous) => {
          if (previous <= 1) {
            clearInterval(phoneTimerRef.current);
            return 0;
          }
          return previous - 1;
        });
      }, 1000);
      setPhoneNotice('验证码已发送');
    } catch {
      setPhoneNotice('安全验证或验证码发送失败，请稍后重试');
    } finally {
      setPhoneBusy(false);
    }
  };

  const handleBindPhone = async (e) => {
    e.preventDefault();
    if (!inputPhone || !inputCode) return setPhoneNotice('请完整输入手机号与验证码');
    if (!phoneChallengeId) return setPhoneNotice('请先获取验证码');
    setPhoneBusy(true);
    try {
      const res = await fetch('/api/user/phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: inputPhone, countryCode: phoneCountryCode, code: inputCode, challengeId: phoneChallengeId }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('手机号绑定成功');
        setCurrentPhone(data.phone || inputPhone);
        if (!currentProviders.includes('phone')) {
          setCurrentProviders([...currentProviders, 'phone']);
        }
        setPhoneModalOpen(false);
        setPhoneChallengeId('');
        setPhoneCaptchaChallenge(null);
        setPhoneCountdown(0);
      } else {
        setPhoneNotice(data.error || '绑定失败');
      }
    } catch {
      setPhoneNotice('网络请求异常');
    } finally {
      setPhoneBusy(false);
    }
  };

  const handleBindEmail = async (e) => {
    e.preventDefault();
    if (!inputEmail) return setEmailNotice('请输入邮箱地址');
    if (emailVerificationPending && !/^\d{6}$/.test(emailVerificationCode)) {
      return setEmailNotice('请输入邮件中的 6 位验证码');
    }
    setEmailBusy(true);
    try {
      const res = await fetch('/api/user/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inputEmail,
          ...(emailVerificationPending ? { code: emailVerificationCode } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.verificationRequired) {
          setEmailVerificationPending(true);
          setEmailNotice('验证码已发送，请查收邮件后输入');
          return;
        }
        showToast('安全邮箱绑定成功');
        setCurrentEmail(data.email || inputEmail);
        if (!currentProviders.includes('email')) {
          setCurrentProviders([...currentProviders, 'email']);
        }
        setEmailModalOpen(false);
        setEmailVerificationPending(false);
        setEmailVerificationCode('');
      } else {
        setEmailNotice(data.error || '绑定失败');
      }
    } catch {
      setEmailNotice('网络请求异常');
    } finally {
      setEmailBusy(false);
    }
  };

  const confirmExecuteUnbind = async () => {
    if (!unbindTarget) return;
    setUnbinding(true);
    setUnbindError('');

    try {
      let url = '';
      if (unbindTarget.type === 'phone') url = '/api/user/phone';
      else if (unbindTarget.type === 'email') url = '/api/user/email';
      else if (unbindTarget.type === 'oauth') url = `/api/user/oauth/${unbindTarget.provider}`;

      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        setUnbindError(data.error || '解绑失败');
        return;
      }

      if (unbindTarget.type === 'phone') {
        setCurrentPhone('');
        setCurrentProviders(currentProviders.filter((p) => p !== 'phone'));
      } else if (unbindTarget.type === 'email') {
        setCurrentEmail('');
        setCurrentProviders(currentProviders.filter((p) => p !== 'email'));
      } else if (unbindTarget.type === 'oauth') {
        setCurrentProviders(currentProviders.filter((p) => p !== unbindTarget.provider));
        setCurrentAccounts(currentAccounts.filter((a) => a.provider !== unbindTarget.provider));
      }

      setUnbindTarget(null);
      showToast(data.message || '解绑成功');
    } catch {
      setUnbindError('网络连接异常');
    } finally {
      setUnbinding(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPwdMessage('');
    setPwdSuccess(false);

    if (hasPassword && !oldPassword) {
      return setPwdMessage('请输入当前原密码以验证身份');
    }
    if (!newPassword || newPassword.length < 8) {
      return setPwdMessage('新密码长度至少需要 8 位');
    }
    if (newPassword.length > 200) {
      return setPwdMessage('新密码长度不能超过 200 位');
    }
    if (newPassword !== confirmPassword) {
      return setPwdMessage('两次输入的新密码不一致');
    }
    if (hasPassword && oldPassword && oldPassword === newPassword) {
      return setPwdMessage('新密码不能与原密码相同');
    }

    setPwdBusy(true);
    try {
      const res = await fetch('/api/user/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(hasPassword ? { oldPassword } : {}),
          newPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPwdSuccess(true);
        setHasPassword(true);
        setPwdMessage(data.message || (hasPassword ? '密码已成功修改' : '密码已成功设置'));
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        if (onProfileUpdated) {
          await onProfileUpdated({ hasPassword: true });
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('profile:updated', { detail: { user: { hasPassword: true } } }));
        }
      } else {
        if (data.hasPassword || data.code === 'PASSWORD_REQUIRED' || data.error?.includes('当前密码')) {
          setHasPassword(true);
        }
        setPwdMessage(data.error || '密码更新失败');
      }
    } catch {
      setPwdMessage('网络请求失败，请稍后重试');
    } finally {
      setPwdBusy(false);
    }
  };

  const handleDeactivate = async () => {
    try {
      const res = await fetch('/api/user/deactivate', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast(data.message || '注销申请已提交，已开启 3 天后悔保护期');
        setTimeout(() => {
          window.location.href = '/';
        }, 1200);
      } else {
        showToast(data.error || '注销申请提交失败，请联系客服');
      }
    } catch {
      showToast('网络连接异常');
    }
  };

  const handleSubmitProfile = (event) => {
    event?.preventDefault?.();
    if (onSaveProfile) {
      onSaveProfile(event, {
        displayName: profileName,
      });
    }
  };

  const visibleSocialProviderIds = [...new Set([
    ...(socialOptions?.providers || []).map((p) => p.id),
    ...currentProviders,
    ...currentAccounts.map((a) => a.provider),
  ])]
    .filter((provider) => SOCIAL_ACCOUNT_PROVIDERS[provider])
    .sort((a, b) => SOCIAL_ACCOUNT_PROVIDER_ORDER.indexOf(a) - SOCIAL_ACCOUNT_PROVIDER_ORDER.indexOf(b));

  return (
    <div className="w-full flex flex-col gap-6 relative select-none">
      {/* 实时反馈 Toast */}
      {toastMessage && (
        <div
          role="status"
          className="fixed top-8 left-1/2 -translate-x-1/2 z-toast flex items-center gap-2 rounded-full border border-line bg-surface-raised px-5 py-2 text-caption font-medium text-ink shadow-elevation-4 backdrop-blur-md animate-in fade-in slide-in-from-top-2"
        >
          <Check className="size-3.5 text-brand" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. 个人资料卡片 (1:1 深度参考 oiioii 居中头像 + 用户名 + 保存) */}
      <Card padding="lg" className="rounded-2xl border border-line-subtle bg-surface p-6 shadow-elevation-1">
        <form onSubmit={handleSubmitProfile} className="flex flex-col items-center">
          {/* 居中同心圆头像与相机上传交互 */}
          <div className="relative group mb-6">
            {/* 外部微光同心轮廓 */}
            <div className="size-24 rounded-full p-1 border-2 border-line-subtle group-hover:border-brand-line transition-all duration-300 flex items-center justify-center bg-well shadow-elevation-2">
              <div className="relative size-full rounded-full overflow-hidden bg-well flex items-center justify-center">
                <UserAvatar
                  src={currentAvatarUrl}
                  name={profileName}
                  className="w-full h-full object-cover"
                  fallbackClassName="text-brand text-xl font-bold"
                />
                {/* 悬停相机操作层 */}
                <button
                  type="button"
                  disabled={avatarUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 hover:bg-black/60 transition-colors text-white cursor-pointer"
                  title="点击更换头像"
                  aria-label="上传新头像"
                >
                  {avatarUploading ? (
                    <Loader2 className="size-6 animate-spin text-brand" />
                  ) : (
                    <Camera className="size-6 text-white group-hover:scale-110 transition-transform" />
                  )}
                </button>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAvatarFile(file);
                e.target.value = '';
              }}
            />
          </div>

          {/* 用户名输入区 */}
          <div className="w-full max-w-md">
            <label className="block text-body-sm font-medium text-ink mb-1.5">
              用户名<span className="text-danger ml-0.5">*</span>
            </label>
            <Input
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="请输入用户名"
              maxLength={40}
              className="w-full bg-well border-line-subtle text-ink rounded-xl h-11 px-3.5 focus-visible:ring-brand-ring"
            />
            <p className="mt-1.5 text-caption text-ink-muted leading-relaxed">
              长度 1–40 个字符，支持汉字、字母、数字和 &quot;-&quot;。
            </p>

            {/* 保存按钮 (Cyan 品牌色全宽主按钮) */}
            <Button
              type="submit"
              disabled={busy || !profileName?.trim()}
              className="w-full h-11 rounded-xl bg-brand text-ink-on-accent font-semibold hover:bg-brand-hover active:bg-brand-active shadow-elevation-1 transition-all mt-5 cursor-pointer"
            >
              {busy ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  <span>正在保存…</span>
                </div>
              ) : (
                '保存'
              )}
            </Button>
          </div>
        </form>
      </Card>

      {/* 2. 账号密码设置 */}
      <Card padding="lg" className="rounded-2xl border border-line-subtle bg-surface p-6 shadow-elevation-1">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <Lock className="size-4 text-brand" />
            <h3 className="text-card-title font-semibold text-ink">独立登录密码</h3>
            {hasPassword ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-success-line bg-success-soft px-2 py-0.5 text-micro text-success font-medium">
                <Check className="size-3" />
                已设置
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-line-subtle bg-wash px-2 py-0.5 text-micro text-ink-muted font-medium">
                未设置
              </span>
            )}
          </div>
        </div>
        <p className="text-caption text-ink-muted mb-4">
          {hasPassword
            ? '已设置独立登录密码，可用于账号与密码直接登录。'
            : '尚未设置独立登录密码，建议设置以提高账号在各终端的登录便利与安全性。'}
        </p>

        <form onSubmit={handlePasswordSubmit} className="space-y-3.5 max-w-md">
          {hasPassword && (
            <div>
              <label className="block text-caption font-medium text-ink-muted mb-1">原密码</label>
              <div className="relative">
                <Input
                  type={showOldPwd ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => {
                    setOldPassword(e.target.value);
                    if (pwdMessage) setPwdMessage('');
                    if (pwdSuccess) setPwdSuccess(false);
                  }}
                  placeholder="请输入当前原密码"
                  className="bg-well border-line-subtle text-ink rounded-xl h-10 px-3.5 pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowOldPwd(!showOldPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink cursor-pointer p-1"
                  aria-label={showOldPwd ? '隐藏原密码' : '显示原密码'}
                >
                  {showOldPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-caption font-medium text-ink-muted mb-1">
              {hasPassword ? '新密码' : '设置新密码'}
            </label>
            <div className="relative">
              <Input
                type={showNewPwd ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (pwdMessage) setPwdMessage('');
                  if (pwdSuccess) setPwdSuccess(false);
                }}
                placeholder="长度至少 8 位"
                className="bg-well border-line-subtle text-ink rounded-xl h-10 px-3.5 pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowNewPwd(!showNewPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink cursor-pointer p-1"
                aria-label={showNewPwd ? '隐藏新密码' : '显示新密码'}
              >
                {showNewPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-caption font-medium text-ink-muted mb-1">确认新密码</label>
            <div className="relative">
              <Input
                type={showConfirmPwd ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (pwdMessage) setPwdMessage('');
                  if (pwdSuccess) setPwdSuccess(false);
                }}
                placeholder="再次输入新密码"
                className="bg-well border-line-subtle text-ink rounded-xl h-10 px-3.5 pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink cursor-pointer p-1"
                aria-label={showConfirmPwd ? '隐藏确认新密码' : '显示确认新密码'}
              >
                {showConfirmPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {pwdMessage && (
            <div className={`flex items-center gap-1.5 text-caption ${pwdSuccess ? 'text-success' : 'text-danger'} animate-in fade-in duration-200`}>
              {pwdSuccess ? <Check className="size-4 shrink-0" /> : <AlertTriangle className="size-4 shrink-0" />}
              <span>{pwdMessage}</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={pwdBusy || !newPassword || !confirmPassword || (hasPassword && !oldPassword)}
            variant="secondary"
            className="h-10 px-5 rounded-xl font-medium cursor-pointer"
          >
            {pwdBusy ? (
              <div className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                <span>正在更新…</span>
              </div>
            ) : hasPassword ? (
              '修改密码'
            ) : (
              '设置密码'
            )}
          </Button>
        </form>
      </Card>

      {/* 3. 登录凭证与三方绑定 */}
      <Card padding="lg" className="rounded-2xl border border-line-subtle bg-surface p-6 shadow-elevation-1">
        <div className="flex items-center gap-2.5 mb-2">
          <ShieldCheck className="size-4 text-brand" />
          <h3 className="text-card-title font-semibold text-ink">登录凭证与第三方绑定</h3>
        </div>
        <p className="text-caption text-ink-muted mb-4">
          绑定常用手机号、邮箱或社交账号，支持在登录时快速一键验证。
        </p>

        <div className="divide-y divide-line-subtle">
          {/* 手机号绑定行 */}
          <SettingRow
            icon={<PhoneIcon className="size-4 text-ink-muted" />}
            title="手机号"
            description={
              currentPhone
                ? `已绑定：${currentPhone.slice(0, 3)}****${currentPhone.slice(-4)}`
                : '未绑定手机号'
            }
            action={
              currentPhone ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="xs"
                    variant="secondary"
                    onClick={() => {
                      setInputPhone('');
                      setInputCode('');
                      setPhoneNotice('');
                      setPhoneModalOpen(true);
                    }}
                  >
                    更换
                  </Button>
                  {(currentEmail || currentAccounts.length > 0 || hasPassword) && (
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      className="text-danger hover:text-danger hover:bg-danger-soft"
                      onClick={() =>
                        setUnbindTarget({ type: 'phone', label: '手机号' })
                      }
                    >
                      解绑
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  type="button"
                  size="xs"
                  variant="primary"
                  onClick={() => {
                    setInputPhone('');
                    setInputCode('');
                    setPhoneNotice('');
                    setPhoneModalOpen(true);
                  }}
                >
                  绑定
                </Button>
              )
            }
          />

          {/* 邮箱绑定行 */}
          <SettingRow
            icon={<MailIcon className="size-4 text-ink-muted" />}
            title="安全邮箱"
            description={currentEmail ? `已绑定：${currentEmail}` : '未绑定安全邮箱'}
            action={
              currentEmail ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="xs"
                    variant="secondary"
                    onClick={() => {
                      setInputEmail('');
                      setEmailVerificationCode('');
                      setEmailNotice('');
                      setEmailVerificationPending(false);
                      setEmailModalOpen(true);
                    }}
                  >
                    换绑
                  </Button>
                  {(currentPhone || currentAccounts.length > 0 || hasPassword) && (
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      className="text-danger hover:text-danger hover:bg-danger-soft"
                      onClick={() =>
                        setUnbindTarget({ type: 'email', label: '安全邮箱' })
                      }
                    >
                      解绑
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  type="button"
                  size="xs"
                  variant="primary"
                  onClick={() => {
                    setInputEmail('');
                    setEmailVerificationCode('');
                    setEmailNotice('');
                    setEmailVerificationPending(false);
                    setEmailModalOpen(true);
                  }}
                >
                  绑定
                </Button>
              )
            }
          />

          <OAuthAccountsSection />
        </div>
      </Card>

      {/* 4. 危险区：注销账户与冷静期管理 */}
      {user?.isDeletionPending ? (
        <Card padding="lg" className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6 shadow-elevation-1">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="size-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="size-4 text-amber-400" />
              </div>
              <div>
                <h4 className="text-body-sm font-semibold text-amber-300">账户处于注销保护期中</h4>
                <p className="text-caption text-amber-200/80 mt-1 leading-relaxed">
                  距离账号与所有数据彻底物理清除还剩约 {Math.max(1, Math.ceil((user.deletionRemainingHours ?? 72) / 24))} 天 ({user.deletionRemainingHours ?? 72} 小时)。期间随时可撤销注销并完整恢复所有资产。
                </p>
              </div>
            </div>

            <Button
              type="button"
              size="xs"
              onClick={async () => {
                try {
                  const res = await fetch('/api/user/cancel-deletion', { method: 'POST' });
                  const d = await res.json().catch(() => ({}));
                  if (res.ok) {
                    showToast('注销申请已成功撤销，账户已恢复！');
                    setTimeout(() => window.location.reload(), 1000);
                  } else {
                    showToast(d.error || '撤销失败');
                  }
                } catch {
                  showToast('网络连接异常');
                }
              }}
              className="bg-brand text-ink-on-accent hover:bg-brand-hover active:bg-brand-active shrink-0 cursor-pointer font-semibold"
            >
              撤销注销
            </Button>
          </div>
        </Card>
      ) : (
        <Card padding="lg" className="rounded-2xl border border-danger-line/40 bg-danger-soft/10 p-6 shadow-elevation-1">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="size-8 rounded-lg bg-danger-soft border border-danger-line flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="size-4 text-danger" />
              </div>
              <div>
                <h4 className="text-body-sm font-semibold text-danger">注销账户</h4>
                <p className="text-caption text-ink-muted mt-1 leading-relaxed">
                  提交注销后将享受 3 天后悔保护期，期间随时可重新登录撤销；到期未撤销将自动永久物理清除所有数据，此后可重新注册。
                </p>
              </div>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" size="xs" variant="danger" className="shrink-0 cursor-pointer">
                  注销账户
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="z-modal max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-ink">确认申请注销账户？</AlertDialogTitle>
                  <AlertDialogDescription className="text-ink-muted leading-relaxed">
                    提交后账号将进入 3 天后悔保护期。在 3 天内您可以随时重新登录撤销注销申请；若 3 天内未撤销，到期后系统将自动物理清除您的所有作品、资产与凭据，此后您可以随时使用原账号重新注册。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="cursor-pointer">取消</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeactivate}
                    className="bg-danger text-white hover:bg-danger-hover cursor-pointer"
                  >
                    确认申请注销
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </Card>
      )}

      {/* 手机绑定弹窗 */}
      {phoneModalOpen && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-scrim backdrop-blur-xl animate-in fade-in duration-modal ease-enter"
          role="dialog"
          aria-modal="true"
          onClick={() => setPhoneModalOpen(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl border border-line bg-overlay p-6 shadow-elevation-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-ink mb-1">绑定/更换手机号</h3>
            <p className="text-caption text-ink-muted mb-4">验证码将发送至你的手机</p>

            <form onSubmit={handleBindPhone} className="space-y-3.5">
              <div className="flex gap-2">
                <select
                  value={phoneCountryCode}
                  onChange={(e) => setPhoneCountryCode(e.target.value)}
                  className="w-24 bg-well border border-line-subtle rounded-xl text-ink px-2.5 text-caption focus:outline-none"
                >
                  {PHONE_DIAL_CODES.map((code) => (
                    <option key={code} value={code} className="bg-surface text-ink">
                      {code}
                    </option>
                  ))}
                </select>
                <Input
                  type="tel"
                  placeholder="手机号码"
                  value={inputPhone}
                  onChange={(e) => setInputPhone(e.target.value)}
                  className="flex-1 bg-well border-line-subtle text-ink rounded-xl h-10"
                />
              </div>

              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="6 位短信验证码"
                  value={inputCode}
                  maxLength={6}
                  onChange={(e) => setInputCode(e.target.value)}
                  className="flex-1 bg-well border-line-subtle text-ink rounded-xl h-10"
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={phoneBusy || phoneCountdown > 0 || !inputPhone}
                  onClick={handleSendPhoneCode}
                  className="shrink-0 h-10 px-3 text-caption cursor-pointer"
                >
                  {phoneCountdown > 0 ? `${phoneCountdown}s` : '获取验证码'}
                </Button>
              </div>

              {phoneNotice && <p className="text-caption text-danger">{phoneNotice}</p>}

              <div ref={phoneCaptchaHostRef} className="empty:hidden" />

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-10 rounded-xl cursor-pointer"
                  onClick={() => setPhoneModalOpen(false)}
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={phoneBusy || !inputPhone || !inputCode}
                  className="flex-1 h-10 rounded-xl cursor-pointer"
                >
                  {phoneBusy ? '正在验证…' : '确认绑定'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 邮箱绑定弹窗 */}
      {emailModalOpen && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-scrim backdrop-blur-xl animate-in fade-in duration-modal ease-enter"
          role="dialog"
          aria-modal="true"
          onClick={() => setEmailModalOpen(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl border border-line bg-overlay p-6 shadow-elevation-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-ink mb-1">绑定/换绑安全邮箱</h3>
            <p className="text-caption text-ink-muted mb-4">输入邮箱接收安全验证码</p>

            <form onSubmit={handleBindEmail} className="space-y-3.5">
              <Input
                type="email"
                placeholder="your-email@example.com"
                value={inputEmail}
                onChange={(e) => setInputEmail(e.target.value)}
                className="w-full bg-well border-line-subtle text-ink rounded-xl h-10"
              />

              {emailVerificationPending && (
                <Input
                  type="text"
                  placeholder="6 位邮件验证码"
                  value={emailVerificationCode}
                  maxLength={6}
                  onChange={(e) => setEmailVerificationCode(e.target.value)}
                  className="w-full bg-well border-line-subtle text-ink rounded-xl h-10"
                />
              )}

              {emailNotice && <p className="text-caption text-danger">{emailNotice}</p>}

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-10 rounded-xl cursor-pointer"
                  onClick={() => setEmailModalOpen(false)}
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={emailBusy || !inputEmail}
                  className="flex-1 h-10 rounded-xl cursor-pointer"
                >
                  {emailBusy ? '正在验证…' : emailVerificationPending ? '确认绑定' : '发送验证码'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 解绑确认弹窗 */}
      {unbindTarget && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-scrim backdrop-blur-xl animate-in fade-in duration-modal ease-enter"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setUnbindTarget(null);
            setUnbindError('');
          }}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl border border-line bg-overlay p-6 shadow-elevation-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-ink mb-2">
              确认解绑 {unbindTarget.label}？
            </h3>
            <p className="text-caption text-ink-muted mb-4 leading-relaxed">
              解绑后将无法使用该渠道直接登录。请确保至少保留一种可用登录凭证。
            </p>

            {unbindError && <p className="text-caption text-danger mb-3">{unbindError}</p>}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-10 rounded-xl cursor-pointer"
                onClick={() => {
                  setUnbindTarget(null);
                  setUnbindError('');
                }}
              >
                取消
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={unbinding}
                onClick={confirmExecuteUnbind}
                className="flex-1 h-10 rounded-xl cursor-pointer"
              >
                {unbinding ? '正在解绑…' : '确认解绑'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

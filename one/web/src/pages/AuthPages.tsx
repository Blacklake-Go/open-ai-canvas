import { useCallback, useEffect, useMemo } from 'react';
import { Navigate, useLocation, useParams } from 'react-router';
import AuthLayout from '@/components/auth/AuthLayout';
import LoginForm from '@/components/auth/LoginForm';
import RegisterForm from '@/components/auth/RegisterForm';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';
import ChangePasswordForm from '@/components/auth/ChangePasswordForm';
import OAuthOnboarding from '@/components/auth/OAuthOnboarding';
import AuthModal from '@/components/AuthModal';
import { getAuthCopy, normalizeAuthLocale } from '@/lib/authCopy';
import { resolveAuthEmbedOptions } from '@/lib/auth/embedAuth';
import { getLocaleConfig, isSupportedLocale, normalizeLocale } from '@/lib/locales';
import { getCookieLocaleClient, useDocumentTitle } from '@/pages/helpers/pageHelpers';
import RootNotFound from '@/pages/boundaries/RootNotFound';

export function LoginPage({ forcedLocale }: { forcedLocale?: string }) {
  const { locale: routeLocale } = useParams<{ locale?: string }>();
  const isDynamic = Boolean(!forcedLocale && routeLocale);

  const resolvedLocale = useMemo(() => {
    if (forcedLocale) return forcedLocale;
    if (routeLocale) {
      if (!isSupportedLocale(routeLocale)) return null;
      return normalizeLocale(routeLocale);
    }
    return normalizeAuthLocale(getCookieLocaleClient() || 'en');
  }, [forcedLocale, routeLocale]);

  const copy = useMemo(() => getAuthCopy(resolvedLocale || 'en'), [resolvedLocale]);
  useDocumentTitle(`${copy.login.title} — supdance`);

  if (isDynamic && !resolvedLocale) {
    return <RootNotFound />;
  }
  if (isDynamic && resolvedLocale === 'en') {
    return <Navigate to="/login" replace />;
  }
  if (isDynamic && resolvedLocale) {
    const config = getLocaleConfig(resolvedLocale);
    if (config.rootPath && routeLocale !== config.rootPath.slice(1)) {
      return <Navigate to={`${config.rootPath}/login`} replace />;
    }
  }

  const activeLocale = resolvedLocale || 'en';
  return (
    <AuthLayout locale={activeLocale} title={copy.login.title} subtitle={copy.login.subtitle}>
      <LoginForm locale={activeLocale} />
    </AuthLayout>
  );
}

export function RegisterPage({ locale = 'en' }: { locale?: string }) {
  const isZh = locale === 'zh-CN';
  useDocumentTitle(isZh ? '注册创作者账号 — supdance' : 'Create Account — supdance');

  return (
    <AuthLayout
      locale={locale}
      title={isZh ? '创建创作者账号' : 'Create Creator Account'}
      subtitle={
        isZh
          ? '畅享 200+ 顶尖生成模型与统一算力生态'
          : 'Access 200+ generative AI models and unified creative compute'
      }
    >
      <RegisterForm locale={locale} />
    </AuthLayout>
  );
}

export function ForgotPasswordPage({ locale = 'en' }: { locale?: string }) {
  const isZh = locale === 'zh-CN';
  useDocumentTitle(isZh ? '找回密码 — supdance' : 'Reset Password — supdance');

  return (
    <AuthLayout
      locale={locale}
      title={isZh ? '找回密码与账号' : 'Reset Password & Account'}
      subtitle={
        isZh
          ? '通过注册邮箱安全重置您的访问凭证'
          : 'Securely recover your credentials with registered email'
      }
    >
      <ForgotPasswordForm locale={locale} />
    </AuthLayout>
  );
}

export function ChangePasswordPage({ locale = 'en' }: { locale?: string }) {
  const isZh = locale === 'zh-CN';
  useDocumentTitle(isZh ? '修改密码 — supdance' : 'Change Password — supdance');

  return (
    <AuthLayout
      locale={locale}
      title={isZh ? '修改密码' : 'Change Password'}
      subtitle={
        isZh
          ? '更新您的创作者账号登录凭据与安全密码'
          : 'Update your creator account password and security credentials'
      }
    >
      <ChangePasswordForm locale={locale} />
    </AuthLayout>
  );
}

export function ResetPasswordRedirectPage({ locale = 'en' }: { locale?: string }) {
  return <Navigate to={locale === 'zh-CN' ? '/zh/forgot-password' : '/forgot-password'} replace />;
}

export function OAuthOnboardingPage() {
  useDocumentTitle('确认账号与安全邮箱 · SupDance');
  return <OAuthOnboarding />;
}

function EmbeddedAuthView({
  parentOrigin,
  mode,
  tab,
  locale,
}: {
  parentOrigin: string;
  mode: string;
  tab: string;
  locale: string;
}) {
  const notify = useCallback(
    (action: string) => {
      if (typeof window !== 'undefined' && window.parent) {
        window.parent.postMessage({ type: 'supdance:embed-auth', action }, parentOrigin);
      }
    },
    [parentOrigin]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/me', {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.ok && (await response.json()).user) notify('success');
      })
      .catch(() => {});
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') notify('close');
    };
    const onSession = () => notify('session');
    window.addEventListener('keydown', onKey);
    window.addEventListener('supdance-auth-success', onSession);
    notify('ready');
    return () => {
      controller.abort();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('supdance-auth-success', onSession);
    };
  }, [notify]);

  return (
    <>
      <style>{'html,body{margin:0;height:100%;overflow:hidden;background:transparent!important}'}</style>
      <AuthModal
        locale={locale}
        initialMode={mode}
        initialTab={tab}
        onSuccess={() => notify('success')}
        onClose={() => notify('close')}
      />
    </>
  );
}

export function EmbedAuthPage() {
  useDocumentTitle('SupDance 登录');
  const location = useLocation();
  const paramsObj = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    return Object.fromEntries(sp.entries());
  }, [location.search]);

  const options = resolveAuthEmbedOptions(paramsObj);
  if (!options) {
    return <RootNotFound />;
  }
  return <EmbeddedAuthView {...options} />;
}

import { Navigate, useParams } from 'react-router';
import JimengHomePortal from '@/components/home/JimengHomePortal';
import { isSupportedLocale, normalizeLocale } from '@/lib/locales';
import { useUserSession } from '@/lib/hooks/useUserSession';
import { resolveEffectiveLocaleClient, useDocumentTitle } from '@/pages/helpers/pageHelpers';
import RootNotFound from '@/pages/boundaries/RootNotFound';

export function HomePage() {
  useDocumentTitle('SupDance — AI Creative Workspace');
  const { user } = useUserSession();
  const targetLocale = resolveEffectiveLocaleClient(user?.locale);
  const googleOneTapEligible = !user;

  return (
    <JimengHomePortal
      locale={targetLocale}
      initialUser={user}
      googleOneTapEligible={googleOneTapEligible}
    />
  );
}

export function ZhHomePage() {
  return <Navigate to="/" replace />;
}

export function LocalizedHomePage() {
  const { locale } = useParams<{ locale?: string }>();
  const { user } = useUserSession();
  const normalized = locale ? normalizeLocale(locale) : 'en';

  useDocumentTitle(
    normalized === 'zh-CN' ? 'SupDance 创作中心' : 'SupDance — AI Creative Workspace'
  );

  if (!locale || !isSupportedLocale(locale)) {
    return <RootNotFound />;
  }
  if (normalized === 'en') {
    return <RootNotFound />;
  }

  return <JimengHomePortal locale={normalized} initialUser={user} />;
}

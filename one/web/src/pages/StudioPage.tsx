import { Navigate, useLocation, useParams as useRRParams } from 'react-router';
import StandaloneShell from '@/components/StandaloneShell';
import { isStudioSlug, inferStudioTabFromModel } from '@/lib/studio-routes';
import { getLocaleConfig, isSupportedLocale, normalizeLocale } from '@/lib/locales';
import { useUserSession } from '@/lib/hooks/useUserSession';
import { resolveEffectiveLocaleClient, useDocumentTitle } from '@/pages/helpers/pageHelpers';
import RootNotFound from '@/pages/boundaries/RootNotFound';

function parseSlug(rawSplat?: string): string[] | undefined {
  if (typeof rawSplat !== 'string') return undefined;
  const parts = rawSplat.split('/').filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

export function StudioPage({ forcedLocale }: { forcedLocale?: string }) {
  useDocumentTitle('Studio — SupDance');
  const rrParams = useRRParams();
  const location = useLocation();
  const { user } = useUserSession();

  const routeLocale = rrParams.locale;
  const slug = parseSlug(rrParams['*']);

  // Localized dynamic route: /:locale/studio/*
  if (!forcedLocale && routeLocale) {
    if (!isSupportedLocale(routeLocale)) return <RootNotFound />;
    const normalized = normalizeLocale(routeLocale);
    if (normalized === 'en') return <RootNotFound />;
    if (!isStudioSlug(slug)) return <RootNotFound />;
    const { rootPath } = getLocaleConfig(normalized);
    if (rootPath.slice(1) !== routeLocale) return <RootNotFound />;

    const qs = new URLSearchParams(location.search);
    const initialModel = qs.get('model') || '';
    const initialTab =
      qs.get('tab') ||
      (Array.isArray(slug) && slug[0]
        ? slug[0]
        : initialModel
          ? inferStudioTabFromModel(initialModel, 'image')
          : 'image');

    return (
      <StandaloneShell
        locale={normalized}
        initialUser={user}
        initialTab={initialTab}
        initialModel={initialModel}
      />
    );
  }

  if (!isStudioSlug(slug)) {
    return <RootNotFound />;
  }

  // Unprefixed /studio/* checks effective locale (cookie / user) and redirects to localized studio when non-en
  if (!forcedLocale) {
    const targetLocale = resolveEffectiveLocaleClient(user?.locale);
    if (targetLocale !== 'en') {
      const config = getLocaleConfig(targetLocale);
      if (config?.rootPath) {
        const slugPath = Array.isArray(slug) && slug.length > 0 ? `/${slug.join('/')}` : '';
        return <Navigate to={`${config.rootPath}/studio${slugPath}${location.search}`} replace />;
      }
    }
  }

  const effectiveLocale = forcedLocale || 'en';
  const qs = new URLSearchParams(location.search);
  const initialModel = qs.get('model') || '';
  const initialTab =
    qs.get('tab') ||
    (Array.isArray(slug) && slug[0]
      ? slug[0]
      : initialModel
        ? inferStudioTabFromModel(initialModel, 'image')
        : 'image');

  return (
    <StandaloneShell
      locale={effectiveLocale}
      initialUser={user}
      initialTab={initialTab}
      initialModel={initialModel}
    />
  );
}

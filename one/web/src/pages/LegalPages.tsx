import { Navigate, useParams } from 'react-router';
import LegalPageView from '@/components/legal/LegalPageView';
import { getLocaleConfig, isSupportedLocale, normalizeLocale } from '@/lib/locales';
import { getLegalMetadata } from '@/lib/legalCopy';
import { useDocumentTitle } from '@/pages/helpers/pageHelpers';
import RootNotFound from '@/pages/boundaries/RootNotFound';

const SEGMENT_BY_PAGE: Record<'privacy' | 'terms' | 'refund' | 'contentPolicy', string> = {
  privacy: 'privacy',
  terms: 'terms',
  refund: 'refund',
  contentPolicy: 'content-policy',
};

export function LegalPage({
  page,
  forcedLocale,
}: {
  page: 'privacy' | 'terms' | 'refund' | 'contentPolicy';
  forcedLocale?: string;
}) {
  const { locale: routeLocale } = useParams<{ locale?: string }>();
  const isDynamic = Boolean(!forcedLocale && routeLocale);
  const validLocale = !isDynamic || isSupportedLocale(routeLocale!);
  const normalized = forcedLocale || (routeLocale && validLocale ? normalizeLocale(routeLocale) : 'en');
  const meta = validLocale ? getLegalMetadata(normalized, page) : null;

  useDocumentTitle(meta?.title);

  if (isDynamic && !validLocale) {
    return <RootNotFound />;
  }

  if (isDynamic) {
    const segment = SEGMENT_BY_PAGE[page];
    if (normalized === 'en') {
      return <Navigate to={`/${segment}`} replace />;
    }
    const config = getLocaleConfig(normalized);
    if (routeLocale !== config.rootPath.slice(1)) {
      return <Navigate to={`${config.rootPath}/${segment}`} replace />;
    }
  }

  return <LegalPageView page={page} locale={normalized} />;
}

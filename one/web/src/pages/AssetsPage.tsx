import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router';
import JimengAssetCenter from '@/components/assets/JimengAssetCenter';
import { getAssetLibraryCopy } from '@/lib/assetLibraryCopy';
import { getLocaleConfig, isSupportedLocale, normalizeLocale } from '@/lib/locales';
import { resolveEffectiveLocaleClient, useDocumentTitle } from '@/pages/helpers/pageHelpers';
import RootNotFound from '@/pages/boundaries/RootNotFound';
import { oneApi } from '@/services/api/http';

export function AssetsPage({ forcedLocale }: { forcedLocale?: string }) {
  const { locale: routeLocale } = useParams<{ locale?: string }>();
  const [authState, setAuthState] = useState<{ loading: boolean; user: any }>({
    loading: true,
    user: null,
  });

  const isDynamicLocale = Boolean(!forcedLocale && routeLocale);
  const invalidDynamic =
    isDynamicLocale &&
    (!isSupportedLocale(routeLocale!) || normalizeLocale(routeLocale!) === 'en');

  const normalizedDynamic = isDynamicLocale && !invalidDynamic ? normalizeLocale(routeLocale!) : 'en';

  useDocumentTitle(
    forcedLocale === 'zh-CN' || (isDynamicLocale && normalizedDynamic === 'zh-CN')
      ? '资产中心 — SupDance AI Studio'
      : isDynamicLocale
        ? 'Asset Center — SupDance AI Studio'
        : '资产中心 — SupDance AI Studio'
  );

  useEffect(() => {
    if (invalidDynamic) return;
    let cancelled = false;
    setAuthState({ loading: true, user: null });
    oneApi
      .getAuthMe()
      .then((res) => {
        if (!cancelled) {
          setAuthState({ loading: false, user: res?.user || null });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuthState({ loading: false, user: null });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [invalidDynamic, forcedLocale, routeLocale]);

  if (invalidDynamic) {
    return <RootNotFound />;
  }

  if (authState.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-brand" />
      </div>
    );
  }

  if (isDynamicLocale) {
    const { rootPath } = getLocaleConfig(normalizedDynamic);
    const targetPath = `${rootPath}/assets`;
    if (!authState.user) {
      return <Navigate to={`${rootPath}/login?redirect=${encodeURIComponent(targetPath)}`} replace />;
    }
    return (
      <JimengAssetCenter
        locale={normalizedDynamic}
        initialUser={authState.user}
        assetLibraryCopy={getAssetLibraryCopy(normalizedDynamic)}
      />
    );
  }

  if (forcedLocale === 'zh-CN') {
    if (!authState.user) {
      return <Navigate to="/zh/login?redirect=/zh/assets" replace />;
    }
    return (
      <JimengAssetCenter
        locale="zh"
        initialUser={authState.user}
        assetLibraryCopy={getAssetLibraryCopy('zh')}
      />
    );
  }

  const effectiveLocale = resolveEffectiveLocaleClient(authState.user?.locale);
  if (!authState.user) {
    if (effectiveLocale === 'zh-CN') {
      return <Navigate to="/zh/login?redirect=/zh/assets" replace />;
    }
    return <Navigate to="/login?redirect=/assets" replace />;
  }

  if (effectiveLocale === 'zh-CN') {
    return <Navigate to="/zh/assets" replace />;
  }

  return (
    <JimengAssetCenter
      locale="en"
      initialUser={authState.user}
      assetLibraryCopy={getAssetLibraryCopy('en')}
    />
  );
}

export function LocalizedStudioAssetsRedirectPage() {
  const { locale } = useParams<{ locale?: string }>();
  if (!locale || !isSupportedLocale(locale) || normalizeLocale(locale) === 'en') {
    return <RootNotFound />;
  }
  const normalized = normalizeLocale(locale);
  const { rootPath } = getLocaleConfig(normalized);
  return <Navigate to={`${rootPath}/assets`} replace />;
}

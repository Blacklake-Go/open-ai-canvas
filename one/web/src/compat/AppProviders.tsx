import React, { useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { NextIntlClientProvider } from 'next-intl';
import { usePathname, useSearchParams } from 'next/navigation';
import { BrandingProvider } from '@/lib/hooks/useBranding';
import { getLocaleConfig, matchPathLocale, resolveClientLocale } from '@/lib/locales';
import { getMessagesForLocale } from '@/i18n/request';
import { oneApi } from '@/services/api/http';
import DynamicFavicon from '@/components/site/DynamicFavicon';
import ChunkSelfHealing from '@/components/ChunkSelfHealing';
import VisitorAnalytics from '@/components/analytics/VisitorAnalytics';
import GlobalSiteBanner from '@/components/GlobalSiteBanner';
import MaintenanceGate from '@/components/MaintenanceGate';

export interface AppProvidersProps {
  children: React.ReactNode;
  locale?: string;
  initialBrand?: any;
  initialNav?: any;
  banner?: any;
  maintenance?: any;
  user?: any;
  visitorAnalytics?: any;
}

export function AppProviders({
  children,
  locale: explicitLocale,
  initialBrand = null,
  initialNav = null,
  banner = null,
  maintenance = null,
  user = null,
  visitorAnalytics = null,
}: AppProvidersProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams ? searchParams.toString() : '';
  const [localeEventTick, setLocaleEventTick] = useState(0);
  const [contentBanner, setContentBanner] = useState<any>(null);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onLocaleChanged = () => setLocaleEventTick((n) => n + 1);
    window.addEventListener('supdance-locale-changed', onLocaleChanged);
    window.addEventListener('koyosim-locale-changed', onLocaleChanged);
    return () => {
      window.removeEventListener('supdance-locale-changed', onLocaleChanged);
      window.removeEventListener('koyosim-locale-changed', onLocaleChanged);
    };
  }, []);

  const activeLocale = useMemo(() => {
    void localeEventTick;
    return resolveClientLocale({
      explicit: explicitLocale,
      pathname,
      search: search ? `?${search}` : '',
      userLocale: matchPathLocale(pathname) ? undefined : user?.locale,
    });
  }, [explicitLocale, pathname, search, user?.locale, localeEventTick]);

  const intlMessages = useMemo(() => getMessagesForLocale(activeLocale), [activeLocale]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = getLocaleConfig(activeLocale).htmlLang || activeLocale;
  }, [activeLocale]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof fetch !== 'function') return undefined;
    const ac = new AbortController();
    oneApi
      .getContentConfig(ac.signal)
      .then((cfg) => {
        if (ac.signal.aborted || !cfg) return;
        if (banner == null && cfg.banner) {
          setContentBanner(cfg.banner);
        }
        if (typeof document !== 'undefined') {
          document.documentElement.classList.toggle(
            'no-motion',
            cfg.motion?.motionLevel === 'none',
          );
        }
      })
      .catch(() => {
        // Ignore offline/backend-unavailable failures; baseline UI renders without banner.
      });
    return () => ac.abort();
  }, [banner]);

  const resolvedBanner = banner ?? contentBanner;

  return (
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale={activeLocale} messages={intlMessages}>
        <ThemeProvider attribute="class" defaultTheme="dark">
          <DynamicFavicon />
          <ChunkSelfHealing />
          <VisitorAnalytics config={visitorAnalytics} />
          <GlobalSiteBanner banner={resolvedBanner} />
          <BrandingProvider initialBrand={initialBrand} initialNav={initialNav}>
            <MaintenanceGate maintenance={maintenance} user={user}>
              {children}
            </MaintenanceGate>
          </BrandingProvider>
        </ThemeProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

export default AppProviders;

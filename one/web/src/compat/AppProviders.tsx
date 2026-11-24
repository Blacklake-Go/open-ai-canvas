import React, { useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { NextIntlClientProvider } from 'next-intl';
import { usePathname, useSearchParams } from 'next/navigation';
import { BrandingProvider } from '@/lib/hooks/useBranding';
import { getLocaleConfig, matchPathLocale, resolveClientLocale } from '@/lib/locales';
import { getMessagesForLocale } from '@/i18n/request';
import { siteContentQueryKey, siteContentUpdateKey, useSiteContentConfig } from '@/lib/hooks/useSiteContentConfig';
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

function SiteContent({ banner }: { banner: AppProvidersProps['banner'] }) {
  const { data } = useSiteContentConfig();
  const queryClient = useQueryClient();
  const motionLevel = data?.motion?.motionLevel;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('no-motion', motionLevel === 'minimal' || motionLevel === 'none');
    return () => root.classList.remove('no-motion');
  }, [motionLevel]);

  useEffect(() => {
    const refreshContent = (event: StorageEvent) => {
      if (event.key === siteContentUpdateKey) void queryClient.invalidateQueries({ queryKey: siteContentQueryKey });
    };
    window.addEventListener('storage', refreshContent);
    return () => window.removeEventListener('storage', refreshContent);
  }, [queryClient]);

  return <GlobalSiteBanner banner={data?.banner ?? banner} pulse={data?.motion?.bannerPulse !== false} />;
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

  return (
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale={activeLocale} messages={intlMessages}>
        <ThemeProvider attribute="class" defaultTheme="dark">
          <DynamicFavicon />
          <ChunkSelfHealing />
          <VisitorAnalytics config={visitorAnalytics} />
          <SiteContent banner={banner} />
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

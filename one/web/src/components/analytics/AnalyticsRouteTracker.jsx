'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * AnalyticsRouteTracker
 * Listens to SPA route transitions in Next.js App Router and notifies
 * active analytics providers (Baidu Tongji and Google Analytics 4).
 */
export default function AnalyticsRouteTracker({ ga4Enabled, ga4Id, baiduEnabled }) {
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Initial page load is already captured by script initialization tags
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (!pathname) return;

    // Baidu Tongji SPA pageview push
    if (baiduEnabled && typeof window !== 'undefined') {
      window._hmt = window._hmt || [];
      window._hmt.push(['_trackPageview', pathname]);
    }

    // Google Analytics 4 SPA pageview push
    if (ga4Enabled && typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_path: pathname,
        page_location: window.location.href,
        page_title: document.title,
      });
    }
  }, [pathname, ga4Enabled, ga4Id, baiduEnabled]);

  return null;
}

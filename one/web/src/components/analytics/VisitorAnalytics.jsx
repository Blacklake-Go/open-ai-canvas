import { useEffect, useState } from 'react';
import Script from 'next/script';
import { getVisitorAnalyticsConfig, normalizeVisitorAnalyticsConfig } from '@/lib/services/visitorAnalytics';
import CustomScriptLoader from './CustomScriptLoader';
import AnalyticsRouteTracker from './AnalyticsRouteTracker';

/**
 * VisitorAnalytics Component (Vite SPA client-safe adaptation)
 * Preserves identical script tags, sanitizer logic, and zero-DOM fallback when disabled.
 */
export default function VisitorAnalytics({ config: initialConfig = null }) {
  const [config, setConfig] = useState(initialConfig);

  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig);
      return;
    }
    let active = true;
    getVisitorAnalyticsConfig()
      .then((loaded) => {
        if (active && loaded) setConfig(loaded);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [initialConfig]);

  const norm = normalizeVisitorAnalyticsConfig(config);

  const ga4Enabled = Boolean(norm.googleAnalytics?.enabled && norm.googleAnalytics?.measurementId);
  const baiduEnabled = Boolean(norm.baiduTongji?.enabled && norm.baiduTongji?.siteId);
  const clarityEnabled = Boolean(norm.microsoftClarity?.enabled && norm.microsoftClarity?.projectId);
  const customEnabled = Boolean(norm.customScript?.enabled && norm.customScript?.code);

  if (!ga4Enabled && !baiduEnabled && !clarityEnabled && !customEnabled) {
    return null;
  }

  return (
    <>
      {ga4Enabled && (
        <>
          <Script
            id="ga4-src"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(norm.googleAnalytics.measurementId)}`}
          />
          <Script id="ga4-inline" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${norm.googleAnalytics.measurementId.replace(/[^A-Za-z0-9_-]/g, '')}');
            `}
          </Script>
        </>
      )}

      {baiduEnabled && (
        <>
          <Script id="baidu-tongji-init" strategy="afterInteractive">
            {`window._hmt = window._hmt || [];`}
          </Script>
          <Script
            id="baidu-tongji"
            strategy="afterInteractive"
            src={`https://hm.baidu.com/hm.js?${encodeURIComponent(norm.baiduTongji.siteId)}`}
          />
        </>
      )}

      {clarityEnabled && (
        <Script id="clarity-script" strategy="lazyOnload">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${norm.microsoftClarity.projectId.replace(/[^0-9a-zA-Z]/g, '')}");
          `}
        </Script>
      )}

      {customEnabled && <CustomScriptLoader code={norm.customScript.code} />}

      {(ga4Enabled || baiduEnabled) && (
        <AnalyticsRouteTracker
          ga4Enabled={ga4Enabled}
          ga4Id={norm.googleAnalytics.measurementId}
          baiduEnabled={baiduEnabled}
        />
      )}
    </>
  );
}

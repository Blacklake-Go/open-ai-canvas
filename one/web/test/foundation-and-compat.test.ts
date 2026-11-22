import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatHref } from '../src/compat/next-link.tsx';
import { NotFoundError, RedirectError, notFound } from '../src/compat/next-navigation.tsx';
import { getTranslations } from '../src/compat/next-intl-server.ts';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  getCommonCopy,
  getLocaleConfig,
  localizeStudioPath,
  normalizeLocale,
} from '../src/lib/locales.js';
import { getLegalCopy } from '../src/lib/legalCopy.js';
import {
  STUDIO_TAB_ALIASES,
  STUDIO_TAB_IDS,
  buildStudioUrl,
  isStudioSlug,
  normalizeStudioTab,
  resolveStudioTab,
} from '../src/lib/studio-routes.js';
import { matchRoute, resolvePolicy } from '../src/lib/routePolicy.js';
import { normalizeVisitorAnalyticsConfig } from '../src/lib/services/visitorAnalytics.js';
import { cursorDecode, cursorEncode, toSearchParams } from '../src/lib/admin/pagination.js';
import { getPluginCopy, getPluginHtmlLang } from '../src/plugins/china-ip-block/i18n.js';
import getRequestConfig, {
  MESSAGES,
  getMessagesForLocale,
  mergeCommonMessages,
} from '../src/i18n/request.js';
import { CREDIT_PRICING_POLICY, getRequestedUnits } from '../src/lib/pricing/creditPolicy.js';
import { CANONICAL_GROUPS } from '../src/lib/modelCenter/canonicalModels.js';
import { isSelectablePublicModel, serializePublicAppModel } from '../src/lib/modelCenter/publicDirectory.js';
import { buildCanvasToolSpec } from '../src/lib/canvasTools/spec.js';
import { isInvariantTranslationKey } from '../src/lib/i18nInvariantKeys.js';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { useLocale, useTranslations } from '../src/compat/next-intl.tsx';
import { AppProviders } from '../src/compat/AppProviders.tsx';
import DesignAgentStudio from '../src/packages/studio/src/components/DesignAgentStudio.jsx';
import SupplierMarquee from '../src/components/call-api/SupplierMarquee.jsx';

const webRoot = fileURLToPath(new URL('..', import.meta.url));

describe('Wave 2-A Foundation: 6-Locale Dictionaries & Config', () => {
  test('loads all 6 canonical locales and common/legal/plugin dictionaries', () => {
    assert.deepEqual(SUPPORTED_LOCALES, ['en', 'zh-CN', 'ja-JP', 'ko-KR', 'zh-TW', 'es']);
    assert.equal(DEFAULT_LOCALE, 'en');
    assert.equal(normalizeLocale('zh'), 'zh-CN');
    assert.equal(normalizeLocale('ja'), 'ja-JP');
    assert.equal(normalizeLocale('ko'), 'ko-KR');

    for (const locale of SUPPORTED_LOCALES) {
      const cfg = getLocaleConfig(locale);
      const common = getCommonCopy(locale);
      const legal = getLegalCopy(locale);
      const pluginCopy = getPluginCopy(locale);
      assert.equal(cfg.code, locale);
      assert.equal(getPluginHtmlLang(locale), cfg.htmlLang);
      assert.ok(common && typeof common === 'object');
      assert.ok(legal && typeof legal === 'object');
      assert.ok(pluginCopy && typeof pluginCopy === 'object');
    }
  });

  test('resolves studio tabs, aliases, localized studio paths, and route policies', () => {
    assert.equal(STUDIO_TAB_IDS.length, 19);
    assert.equal(Object.keys(STUDIO_TAB_ALIASES).length, 5);
    assert.equal(normalizeStudioTab('recast'), 'body-swap');
    assert.equal(resolveStudioTab('canvas'), 'layers');
    assert.equal(isStudioSlug(['video', 'kling-v3']), true);
    assert.equal(localizeStudioPath('en', 'video'), '/studio/video');
    assert.equal(localizeStudioPath('zh', 'video'), '/zh/studio/video');
    assert.equal(
      buildStudioUrl('kling-v2.6-pro-t2v', { tab: '', locale: 'zh', extraParams: {} }),
      '/zh/studio?tab=video&model=kling-v2.6-pro-t2v',
    );
    assert.equal(resolvePolicy(['studio', 'video'])?.auth, 'onboarding');
    assert.equal(resolvePolicy(['admin', 'users'])?.auth, 'admin');
    assert.equal(matchRoute('/admin/**', ['admin', 'users']), true);
  });
});

describe('Wave 2-A Foundation: Next.js-to-Vite Shims & Client-Safe Libs', () => {
  test('next/link formatHref supports string, query object, and hash', () => {
    assert.equal(formatHref('/studio/video'), '/studio/video');
    assert.equal(
      formatHref({ pathname: '/studio/image', query: { modal: 'auth', tab: 'login' }, hash: 'top' }),
      '/studio/image?modal=auth&tab=login#top',
    );
    assert.equal(formatHref(null), '#');
  });

  test('next/navigation errors & next-intl server fallback work cleanly', async () => {
    assert.throws(() => notFound(), NotFoundError);
    assert.equal(new RedirectError('/login').url, '/login');
    const t = await getTranslations({ locale: 'en' });
    assert.equal(typeof t('missing.key'), 'string');
  });

  test('client-safe visitorAnalytics & admin/pagination helpers have no Node/DB dependencies', () => {
    const norm = normalizeVisitorAnalyticsConfig({
      googleAnalytics: { enabled: true, measurementId: 'G-TEST123' },
    });
    assert.equal(norm.googleAnalytics.enabled, true);
    assert.equal(norm.googleAnalytics.measurementId, 'G-TEST123');

    const encoded = cursorEncode({ id: 'usr_123', created_at: '2026-01-01T00:00:00Z' });
    assert.ok(encoded);
    assert.deepEqual(cursorDecode(encoded!), { id: 'usr_123', createdAt: '2026-01-01T00:00:00Z' });
    assert.equal(toSearchParams({ limit: 25, q: 'test' }).toString(), 'limit=25&q=test');

    const visitorJs = fs.readFileSync(path.join(webRoot, 'src/lib/services/visitorAnalytics.js'), 'utf8');
    assert.ok(!visitorJs.includes('repositories/settings'));
    assert.ok(!visitorJs.includes('admin/audit'));

    const visitorJsx = fs.readFileSync(path.join(webRoot, 'src/components/analytics/VisitorAnalytics.jsx'), 'utf8');
    assert.ok(!visitorJsx.includes('export default async function'));
  });
});

describe('Wave 2-A Foundation: Styles, Fonts, and Clean Public Assets', () => {
  test('globals.css, variable fonts, and static assets are present without upload/AppleDouble junk', () => {
    const globalsCss = fs.readFileSync(path.join(webRoot, 'src/styles/globals.css'), 'utf8');
    assert.ok(globalsCss.includes('@tailwind base;'));
    assert.ok(globalsCss.includes('--font-inter: "Inter";'));
    assert.ok(globalsCss.includes('--font-jost: "Jost";'));
    assert.ok(globalsCss.includes('--bg-canvas: #030303;'));
    assert.ok(globalsCss.includes('--accent-primary: #e11d74;'));

    assert.equal(fs.existsSync(path.join(webRoot, 'src/assets/fonts/inter-latin-wght-normal.woff2')), true);
    assert.equal(fs.existsSync(path.join(webRoot, 'src/assets/fonts/jost-latin-wght-normal.woff2')), true);
    assert.equal(fs.existsSync(path.join(webRoot, 'public/branding/favicon.svg')), true);
    assert.equal(fs.existsSync(path.join(webRoot, 'public/favicon.ico')), true);
    assert.equal(fs.existsSync(path.join(webRoot, 'public/uploads')), false);
    assert.equal(fs.existsSync(path.join(webRoot, 'public/vite.svg')), false);

    const walkCheck = (dir: string) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        assert.notEqual(ent.name, '.DS_Store');
        assert.equal(ent.name.startsWith('._'), false);
        if (ent.isDirectory()) walkCheck(path.join(dir, ent.name));
      }
    };
    walkCheck(path.join(webRoot, 'public'));
    walkCheck(path.join(webRoot, 'src'));
  });

  test('i18n/request.js and client-safe pricing/model/canvas lib helpers work without server imports', async () => {
    assert.deepEqual(Object.keys(MESSAGES).sort(), ['en', 'es', 'ja-JP', 'ko-KR', 'zh-CN', 'zh-TW']);
    const zhConfig = await getRequestConfig({ requestLocale: Promise.resolve('zh') });
    assert.equal(zhConfig.locale, 'zh-CN');
    assert.ok(zhConfig.messages && typeof zhConfig.messages === 'object');

    const merged = mergeCommonMessages(getMessagesForLocale('en'), {
      'common.authModal.login': 'Custom Login',
    });
    assert.equal((merged as any).authModal.login, 'Custom Login');

    assert.equal(CREDIT_PRICING_POLICY.cnyPerCredit, 0.07);
    assert.equal(getRequestedUnits({ count: 3 }), 3);
    assert.ok(Array.isArray(CANONICAL_GROUPS) && CANONICAL_GROUPS.length > 0);
    assert.equal(isInvariantTranslationKey('common.billing.alipay', 'zh-CN'), true);

    const sampleModel = {
      id: 'kling-3.0',
      name: 'Kling 3.0',
      category: 'video',
      tier: 'core',
      is_active: true,
      is_visible: true,
      auto_route_eligible: true,
      hasWorkingRoute: true,
      credits_price: 45,
      available_providers: ['kling'],
    };
    assert.equal(isSelectablePublicModel(sampleModel), true);
    assert.equal(serializePublicAppModel(sampleModel).credits, 45);

    const spec = buildCanvasToolSpec({ model: sampleModel });
    assert.equal(spec.version, 1);
    assert.ok(spec.tools.length >= 5);
  });

  test('AppProviders propagates NextIntlClientProvider locale and DesignAgentStudio/SupplierMarquee render without Konva/jsx errors', () => {
    function LocaleProbe() {
      const locale = useLocale();
      const t = useTranslations('nav');
      return React.createElement('span', { 'data-locale': locale }, t('studio'));
    }

    const html = renderToString(
      React.createElement(AppProviders, {
        locale: 'zh',
        children: React.createElement(LocaleProbe),
      }),
    );
    assert.ok(html.includes('data-locale="zh-CN"'));

    const studioHtml = renderToString(React.createElement(DesignAgentStudio));
    assert.ok(studioHtml.length > 0);

    const marqueeHtml = renderToString(React.createElement(SupplierMarquee));
    assert.ok(marqueeHtml.includes('<style>'));
    assert.equal(marqueeHtml.includes('jsx='), false);

    const pkg = JSON.parse(fs.readFileSync(path.join(webRoot, 'package.json'), 'utf8'));
    assert.match(pkg.dependencies['react-konva'], /^~?19\.2\./);

    const viteCfg = fs.readFileSync(path.join(webRoot, 'vite.config.ts'), 'utf8');
    assert.ok(viteCfg.includes("'.js': 'jsx'"));
  });
});

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import baselinePages from '../src/router/baseline-pages.json';
import { MIGRATED_BASELINE_ROUTES } from '../src/router/pageRegistry.ts';

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_ROOT = resolve(WEB_ROOT, 'src');

function resolveModuleFile(aliasedPath: string): string {
  const rel = aliasedPath.replace(/^@\//, '');
  const base = resolve(SRC_ROOT, rel);
  for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
    if (existsSync(`${base}${ext}`)) {
      return `${base}${ext}`;
    }
  }
  throw new Error(`Migrated page module not found for ${aliasedPath} (${base})`);
}

function extractDeclaredAppRouterPaths(appSource: string): Set<string> {
  const paths = new Set<string>();

  // Top-level Route path="..." (outside the /admin nested block)
  const adminStart = appSource.indexOf('<Route path="/admin" element={<AdminLayout />}>');
  assert.ok(adminStart > 0, 'App.tsx must mount <Route path="/admin" element={<AdminLayout />}>');
  const adminEnd = appSource.indexOf('</Route>', adminStart);
  assert.ok(adminEnd > adminStart, 'App.tsx must close /admin <Route> block');

  const outsideAdmin = appSource.slice(0, adminStart) + appSource.slice(adminEnd);
  for (const match of outsideAdmin.matchAll(/<Route\s+[^>]*path="([^"]+)"/g)) {
    paths.add(match[1]);
  }

  const adminBlock = appSource.slice(adminStart, adminEnd);
  if (/<Route\s+index\b/.test(adminBlock)) {
    paths.add('/admin');
  }
  for (const match of adminBlock.matchAll(/<Route\s+[^>]*path="([^"]+)"/g)) {
    const sub = match[1];
    if (sub === '/admin' || sub === '*') continue;
    paths.add(`/admin/${sub}`);
  }

  return paths;
}

describe('Wave 2-B: 145-Page, Layout, & Boundary Migration Coverage', () => {
  test('App.tsx replaces BaselineRouteShell completely with real BrowserRouter + layouts + boundaries', () => {
    const appSource = readFileSync(resolve(SRC_ROOT, 'App.tsx'), 'utf8');
    assert.equal(appSource.includes('BaselineRouteShell'), false, 'BaselineRouteShell must be completely removed');

    for (const token of [
      'BrowserRouter',
      'AppProviders',
      'GlobalErrorBoundary',
      'RootErrorBoundary',
      'RootNotFound',
      'AdminNotFound',
      'AdminLayout',
      'AgentsLayout',
      'DesignSystemLayout',
      'CanonicalRedirectGuard',
    ]) {
      assert.ok(appSource.includes(token), `App.tsx must wire ${token}`);
    }

    // Verify all 3 layout and 5 boundary source files exist
    for (const relFile of [
      'pages/layouts/AdminLayout.tsx',
      'pages/layouts/AgentsLayout.tsx',
      'pages/layouts/DesignSystemLayout.tsx',
      'pages/boundaries/GlobalErrorBoundary.tsx',
      'pages/boundaries/RootErrorBoundary.tsx',
      'pages/boundaries/RootNotFound.tsx',
      'pages/boundaries/AdminErrorBoundary.tsx',
      'pages/boundaries/AdminNotFound.tsx',
    ]) {
      assert.ok(existsSync(resolve(SRC_ROOT, relFile)), `Missing migrated file: ${relFile}`);
    }
  });

  test('covers 100% of all 145 Supdance Pro app/**/page.* routes across all 4 partitions', () => {
    assert.equal(baselinePages.length, 145);
    assert.equal(MIGRATED_BASELINE_ROUTES.length, 145);

    const dynamicLocale = MIGRATED_BASELINE_ROUTES.filter((r) => r.file.startsWith('app/[locale]/'));
    const zhRoutes = MIGRATED_BASELINE_ROUTES.filter((r) => r.file.startsWith('app/zh/'));
    const adminRoutes = MIGRATED_BASELINE_ROUTES.filter((r) => r.file.startsWith('app/admin/'));
    const unprefixedRoutes = MIGRATED_BASELINE_ROUTES.filter(
      (r) =>
        !r.file.startsWith('app/[locale]/') &&
        !r.file.startsWith('app/zh/') &&
        !r.file.startsWith('app/admin/')
    );

    assert.equal(dynamicLocale.length, 10);
    assert.equal(zhRoutes.length, 25);
    assert.equal(adminRoutes.length, 66);
    assert.equal(unprefixedRoutes.length, 44);

    const baselineFileSet = new Set(baselinePages.map((p) => p.file));
    const migratedFileSet = new Set(MIGRATED_BASELINE_ROUTES.map((r) => r.file));
    assert.deepEqual(migratedFileSet, baselineFileSet);
  });

  test('every one of the 145 routes wires to a real module export and appears in App.tsx <Routes>', () => {
    const appSource = readFileSync(resolve(SRC_ROOT, 'App.tsx'), 'utf8');
    const declaredPaths = extractDeclaredAppRouterPaths(appSource);
    const moduleCache = new Map<string, string>();

    for (const route of MIGRATED_BASELINE_ROUTES) {
      // 1. Route path declared in App.tsx (note optional catch-all studio paths map both base & /*)
      if (route.rrPath === '/studio/*') {
        assert.ok(declaredPaths.has('/studio') && declaredPaths.has('/studio/*'), 'App.tsx must map /studio and /studio/*');
      } else if (route.rrPath === '/zh/studio/*') {
        assert.ok(declaredPaths.has('/zh/studio') && declaredPaths.has('/zh/studio/*'), 'App.tsx must map /zh/studio and /zh/studio/*');
      } else if (route.rrPath === '/:locale/studio/*') {
        assert.ok(
          declaredPaths.has('/:locale/studio') && declaredPaths.has('/:locale/studio/*'),
          'App.tsx must map /:locale/studio and /:locale/studio/*'
        );
      } else {
        assert.ok(
          declaredPaths.has(route.rrPath),
          `Route ${route.rrPath} (from ${route.file}) missing in App.tsx <Routes>`
        );
      }

      // 2. Target module exists & exports expected symbol
      let modText = moduleCache.get(route.module);
      if (!modText) {
        const modFile = resolveModuleFile(route.module);
        modText = readFileSync(modFile, 'utf8');
        moduleCache.set(route.module, modText);
      }

      if (route.exportName === 'default') {
        assert.match(modText, /export\s+default\s+/, `Missing default export in ${route.module}`);
      } else {
        const exportRegex = new RegExp(`export\\s+(?:function|const)\\s+${route.exportName}\\b`);
        assert.match(modText, exportRegex, `Missing export ${route.exportName} in ${route.module}`);
      }
    }
  });

  test('KOYO :root design tokens are not clobbered by design-agent/tailwind.css', () => {
    const globalsCss = readFileSync(resolve(SRC_ROOT, 'styles/globals.css'), 'utf8');
    assert.match(globalsCss, /:root\s*\{/);

    const designAgentCss = readFileSync(
      resolve(SRC_ROOT, 'packages/Open-AI-Design-Agent/packages/design-agent/src/tailwind.css'),
      'utf8'
    );
    assert.match(designAgentCss, /\.design-agent-theme\s*\{/);
    assert.match(designAgentCss, /\.design-agent-theme\.dark\s*\{/);
    assert.equal(/(^|\n):root\s*\{/.test(designAgentCss), false, 'design-agent tailwind.css must not declare global :root');
    assert.equal(/(^|\n)\.dark\s*\{/.test(designAgentCss), false, 'design-agent tailwind.css must not declare global .dark');
  });
});

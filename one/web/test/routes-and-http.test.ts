import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  BASELINE_PAGE_ROUTES,
  LOCALE_CONFIGS,
  STUDIO_ALIAS_SEGMENTS,
  STUDIO_TAB_ALIASES,
  STUDIO_TAB_IDS,
  buildLocalizedPath,
  computeCanonicalRedirect,
  expandReactRouterPatterns,
  resolveStudioTab,
} from '../src/router/routes.ts';
import { ApiClientError, apiRequest } from '../src/services/api/http.ts';

describe('ONE 1:1 Route Manifest & Locale Canonicalization', () => {
  test('matches baseline counts from Supdance Pro (145 pages, 6 locales, 19 studio tabs, 5 aliases)', () => {
    assert.equal(BASELINE_PAGE_ROUTES.length, 145);
    assert.equal(LOCALE_CONFIGS.length, 6);
    assert.equal(STUDIO_TAB_IDS.length, 19);
    assert.equal(Object.keys(STUDIO_TAB_ALIASES).length, 5);
    assert.equal(STUDIO_ALIAS_SEGMENTS.length, 3);

    const patterns = expandReactRouterPatterns();
    assert.ok(patterns.includes('/'));
    assert.ok(patterns.includes('/studio/*'));
    assert.ok(patterns.includes('/studio/layers'));
    assert.ok(patterns.includes('/admin/users'));
    assert.ok(patterns.includes('/zh/pricing'));
    assert.ok(patterns.includes('/ja-JP/models/*'));
    assert.ok(patterns.includes('/es/content-policy'));
  });

  test('resolves studio tabs and legacy aliases cleanly', () => {
    assert.equal(resolveStudioTab(''), 'image');
    assert.equal(resolveStudioTab('character'), 'ai-influencer');
    assert.equal(resolveStudioTab('motion-agent'), 'motion-control');
    assert.equal(resolveStudioTab('workflow'), 'workflows');
    assert.equal(resolveStudioTab('canvas'), 'layers');
    assert.equal(resolveStudioTab('recast'), 'body-swap');
    assert.equal(resolveStudioTab('non-existent-tab'), null);
  });

  test('computes exact middleware.js redirects and localized paths', () => {
    assert.deepEqual(computeCanonicalRedirect('/canvas'), {
      status: 308,
      location: 'https://canvas.supdance.com/canvas',
    });
    assert.deepEqual(computeCanonicalRedirect('/zh/canvas/proj_1', '?from=one'), {
      status: 308,
      location: 'https://canvas.supdance.com/canvas/proj_1?from=one',
    });
    assert.deepEqual(computeCanonicalRedirect('/en/pricing', '?plan=pro'), {
      status: 308,
      location: '/pricing?plan=pro',
    });
    assert.deepEqual(computeCanonicalRedirect('/zh/'), {
      status: 308,
      location: '/',
    });
    assert.deepEqual(computeCanonicalRedirect('/ja/pricing'), {
      status: 308,
      location: '/ja-JP/pricing',
    });
    assert.equal(computeCanonicalRedirect('/zh/studio'), null);
    assert.equal(computeCanonicalRedirect('/zh-TW/pricing'), null);
    assert.deepEqual(computeCanonicalRedirect('/studio', '', { cookieLocale: 'zh-CN' }), {
      status: 307,
      location: '/zh/studio',
    });
    assert.deepEqual(computeCanonicalRedirect('/login', '?redirect=%2Fassets', { cookieLocale: 'ja-JP' }), {
      status: 307,
      location: '/ja-JP/login?redirect=%2Fassets',
    });
    assert.deepEqual(computeCanonicalRedirect('/zh/image', '?model=flux'), {
      status: 307,
      location: '/zh/studio?model=flux&tab=image',
    });
    assert.deepEqual(computeCanonicalRedirect('/en/music/'), {
      status: 307,
      location: '/studio?tab=audio',
    });
    assert.equal(buildLocalizedPath('en', '/pricing'), '/pricing');
    assert.equal(buildLocalizedPath('zh-CN', '/pricing'), '/zh/pricing');
  });
});

describe('ONE KOYO Tokens & Envelope HTTP Client', () => {
  test('koyo-tokens.css preserves core palette and geometry tokens', () => {
    const cssPath = fileURLToPath(new URL('../src/styles/koyo-tokens.css', import.meta.url));
    const css = readFileSync(cssPath, 'utf8');
    assert.ok(css.includes('--bg-canvas: #030303'));
    assert.ok(css.includes('--bg-base: #070708'));
    assert.ok(css.includes('--bg-surface: #0d0e12'));
    assert.ok(css.includes('--accent-primary: #e11d74'));
  });

  test('apiRequest unwraps admin_ok_meta_envelope, success_flagged_json, and direct_domain_json', async () => {
    const origFetch = globalThis.fetch;
    try {
      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ ok: true, data: { users: 42 }, meta: { requestId: 'req_1' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })) as typeof fetch;

      const adminData = await apiRequest<{ users: number }>('/api/admin/users', { contract: 'admin' });
      assert.equal(adminData.users, 42);

      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: { code: 'FORBIDDEN', message: 'Denied' },
            meta: { requestId: 'req_2' },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        )) as typeof fetch;

      await assert.rejects(
        () => apiRequest('/api/admin/users', { contract: 'admin' }),
        (err: unknown) => err instanceof ApiClientError && err.status === 403 && err.code === 'FORBIDDEN',
      );

      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ success: true, models: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })) as typeof fetch;

      const models = await apiRequest<{ success: boolean; models: unknown[] }>('/api/models/active', {
        contract: 'success',
      });
      assert.equal(models.success, true);
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

interface NginxLocationBlock {
  modifier: '' | '=' | '^~' | '~' | '~*';
  pattern: string;
  body: string;
}

function stripNginxComments(conf: string): string {
  return conf
    .split('\n')
    .map((line) => {
      let inSingle = false;
      let inDouble = false;
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === '\\') {
          i += 1;
          continue;
        }
        if (ch === "'" && !inDouble) inSingle = !inSingle;
        else if (ch === '"' && !inSingle) inDouble = !inDouble;
        else if (ch === '#' && !inSingle && !inDouble) return line.slice(0, i);
      }
      return line;
    })
    .join('\n');
}

function parseNginxLocations(rawConf: string): NginxLocationBlock[] {
  const conf = stripNginxComments(rawConf);

  // Verify overall brace balance in stripped config
  let totalDepth = 0;
  for (let i = 0; i < conf.length; i += 1) {
    if (conf[i] === '{') totalDepth += 1;
    else if (conf[i] === '}') {
      totalDepth -= 1;
      assert.ok(totalDepth >= 0, 'unmatched closing brace in nginx.conf');
    }
  }
  assert.equal(totalDepth, 0, 'unclosed brace in nginx.conf');

  const blocks: NginxLocationBlock[] = [];
  const headerRe = /^\s*location\s+(?:(=|\^~|~\*|~)\s+)?(\S+?)\s*\{\s*$/gm;
  let match: RegExpExecArray | null;
  while ((match = headerRe.exec(conf)) !== null) {
    const modifier = (match[1] ?? '') as NginxLocationBlock['modifier'];
    const pattern = match[2];
    const bodyStart = headerRe.lastIndex;
    let depth = 1;
    let i = bodyStart;
    while (i < conf.length && depth > 0) {
      if (conf[i] === '{') depth += 1;
      else if (conf[i] === '}') depth -= 1;
      i += 1;
    }
    assert.equal(depth, 0, `unclosed location block: ${modifier} ${pattern}`);
    const body = conf.slice(bodyStart, i - 1);
    blocks.push({ modifier, pattern, body });
    headerRe.lastIndex = i;
  }
  return blocks;
}

function hasNginxDirective(body: string, directive: string): boolean {
  const normalizedBody = body.replace(/\s+/g, ' ').trim();
  const normalizedDirective = directive.replace(/\s+/g, ' ').trim();
  return normalizedBody.includes(normalizedDirective);
}

function resolveNginxLocation(blocks: NginxLocationBlock[], uri: string): NginxLocationBlock | null {
  for (const b of blocks) {
    if (b.modifier === '=' && uri === b.pattern) {
      return b;
    }
  }
  let bestPrefix: NginxLocationBlock | null = null;
  for (const b of blocks) {
    if ((b.modifier === '' || b.modifier === '^~') && uri.startsWith(b.pattern)) {
      if (!bestPrefix || b.pattern.length > bestPrefix.pattern.length) {
        bestPrefix = b;
      }
    }
  }
  if (bestPrefix && bestPrefix.modifier === '^~') {
    return bestPrefix;
  }
  for (const b of blocks) {
    if (b.modifier === '~' || b.modifier === '~*') {
      const re = new RegExp(b.pattern, b.modifier === '~*' ? 'i' : '');
      if (re.test(uri)) {
        return b;
      }
    }
  }
  return bestPrefix;
}

function materializeBackendRoute(routePath: string): string[] {
  if (routePath.includes('[[...')) {
    const base = routePath.replace(/\/\[\[\.\.\.[^\]]+\]\]$/, '') || '/';
    const withChild = routePath.replace(/\[\[\.\.\.[^\]]+\]\]/, 'runs/123');
    return [base, withChild];
  }
  const materialized = routePath
    .replace(/\[\.\.\.[^\]]+\]/g, 'nested/segment')
    .replace(/\[[^\]]+\]/g, 'sample-provider');
  return [materialized];
}

describe('ONE Nginx Edge Proxy Guard', () => {
  const REQUIRED_PROXY_DIRECTIVES = [
    'proxy_pass http://backend:8080;',
    'proxy_http_version 1.1;',
    'proxy_set_header Host $http_host;',
    'proxy_set_header X-Forwarded-Host $http_host;',
    'proxy_set_header X-Real-IP $remote_addr;',
    'proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
    'proxy_set_header X-Forwarded-Proto $scheme;',
  ];

  test('proxies all 4 non-/api/ and all /api/ backend routes while keeping /auth/onboarding and SPA routes on SPA fallback', () => {
    const nginxPath = fileURLToPath(new URL('../../deploy/nginx.conf', import.meta.url));
    const nginxConf = readFileSync(nginxPath, 'utf8');
    const blocks = parseNginxLocations(nginxConf);

    const expectedLocations: Array<{ modifier: NginxLocationBlock['modifier']; pattern: string }> = [
      { modifier: '=', pattern: '/api/generations/events' },
      { modifier: '', pattern: '/api/' },
      { modifier: '=', pattern: '/sitemap.xml' },
      { modifier: '=', pattern: '/auth/tiktok' },
      { modifier: '=', pattern: '/auth/tiktok/callback' },
      { modifier: '~', pattern: '^/auth/[^/]+/callback$' },
    ];

    for (const expected of expectedLocations) {
      const found = blocks.find((b) => b.modifier === expected.modifier && b.pattern === expected.pattern);
      assert.ok(found, `missing nginx location ${expected.modifier} ${expected.pattern}`);
      for (const directive of REQUIRED_PROXY_DIRECTIVES) {
        assert.ok(
          hasNginxDirective(found.body, directive),
          `location ${expected.modifier} ${expected.pattern} missing "${directive}"`,
        );
      }
      assert.ok(
        !found.body.includes('X-Frame-Options'),
        `location ${expected.modifier} ${expected.pattern} must not set duplicate X-Frame-Options`,
      );
    }

    // Regex locations in Nginx cannot specify a URI path on proxy_pass
    for (const b of blocks) {
      if ((b.modifier === '~' || b.modifier === '~*') && hasNginxDirective(b.body, 'proxy_pass')) {
        assert.ok(
          hasNginxDirective(b.body, 'proxy_pass http://backend:8080;'),
          `regex location ${b.modifier} ${b.pattern} must proxy without a URI path`,
        );
      }
    }

    // SSE block preserves streaming directives
    const sseBlock = resolveNginxLocation(blocks, '/api/generations/events');
    assert.ok(sseBlock);
    assert.equal(sseBlock.modifier, '=');
    assert.equal(sseBlock.pattern, '/api/generations/events');
    assert.ok(hasNginxDirective(sseBlock.body, 'proxy_buffering off;'));
    assert.ok(hasNginxDirective(sseBlock.body, 'proxy_cache off;'));
    assert.ok(hasNginxDirective(sseBlock.body, 'gzip off;'));

    const manifestPath = fileURLToPath(
      new URL('../../backend/internal/pkg/envelope/routes_manifest.json', import.meta.url),
    );
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Array<{
      routePath: string;
      isApi: boolean;
    }>;
    assert.equal(manifest.length, 238);

    const nonApiRoutes = manifest.filter((r) => !r.isApi).map((r) => r.routePath);
    assert.deepEqual(
      [...nonApiRoutes].sort(),
      ['/auth/[provider]/callback', '/auth/tiktok', '/auth/tiktok/callback', '/sitemap.xml'],
    );

    // Every single backend route (all 238 manifest entries) must resolve to backend:8080
    for (const entry of manifest) {
      for (const uri of materializeBackendRoute(entry.routePath)) {
        const resolved = resolveNginxLocation(blocks, uri);
        assert.ok(resolved, `no nginx location matched backend route ${uri}`);
        assert.ok(
          hasNginxDirective(resolved.body, 'proxy_pass http://backend:8080;'),
          `expected ${uri} (${entry.routePath}) to proxy to backend, got location "${resolved.modifier} ${resolved.pattern}"`,
        );
      }
    }

    // Provider-specific OAuth callback samples
    for (const uri of ['/auth/google/callback', '/auth/github/callback', '/auth/wechat/callback']) {
      const resolved = resolveNginxLocation(blocks, uri);
      assert.ok(resolved);
      assert.ok(hasNginxDirective(resolved.body, 'proxy_pass http://backend:8080;'));
    }

    // Frontend SPA routes (including /auth/onboarding) must NOT be intercepted by backend proxy rules
    const spaSamples = [
      '/auth/onboarding',
      '/zh/auth/onboarding',
      '/ja-JP/auth/onboarding',
      '/auth/tiktok/extra',
      '/auth/a/b/callback',
      '/onboarding',
      '/embed-auth',
      '/assets',
      '/pricing',
      '/studio',
    ];
    for (const uri of spaSamples) {
      const resolved = resolveNginxLocation(blocks, uri);
      assert.ok(resolved, `no nginx location matched ${uri}`);
      assert.ok(!hasNginxDirective(resolved.body, 'proxy_pass'), `expected ${uri} NOT to proxy to backend`);
      assert.ok(hasNginxDirective(resolved.body, 'try_files'), `expected ${uri} to resolve to SPA try_files`);
      assert.ok(resolved.body.includes('/index.html'), `expected ${uri} to serve /index.html`);
    }

    // Specifically ensure unprefixed /auth/onboarding hits the SPA fallback `location /`
    const onboardingBlock = resolveNginxLocation(blocks, '/auth/onboarding');
    assert.ok(onboardingBlock);
    assert.equal(onboardingBlock.modifier, '');
    assert.equal(onboardingBlock.pattern, '/');
  });
});

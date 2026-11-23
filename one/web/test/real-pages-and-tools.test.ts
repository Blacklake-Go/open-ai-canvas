import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_ROOT = resolve(WEB_ROOT, 'src');

describe('ONE Real Pages, Real Tools & Route Integrity Guard', () => {
  test('Fake routes have been eliminated from PublicFeaturePages and CanvasToolsAndLabPages', () => {
    const publicFeatures = readFileSync(resolve(SRC_ROOT, 'pages/PublicFeaturePages.tsx'), 'utf8');
    const canvasLab = readFileSync(resolve(SRC_ROOT, 'pages/CanvasToolsAndLabPages.tsx'), 'utf8');
    const adminRedirects = readFileSync(resolve(SRC_ROOT, 'pages/admin/AdminRedirectPages.tsx'), 'utf8');

    // 1. Pricing & Subscription renders PricingClient directly
    assert.ok(publicFeatures.includes('function PricingPage'), 'Must export PricingPage');
    assert.ok(publicFeatures.includes('<PricingClient />'), 'PricingPage must render PricingClient');

    // 2. Account renders AccountCenterView directly
    assert.ok(publicFeatures.includes('function AccountPage'), 'Must export AccountPage');
    assert.ok(publicFeatures.includes('<AccountCenterView'), 'AccountPage must render AccountCenterView');

    // 3. Assistant & Workflows render StandaloneShell directly
    assert.ok(publicFeatures.includes('function AssistantPage'), 'Must export AssistantPage');
    assert.ok(publicFeatures.includes('initialTab="agents"'), 'AssistantPage must render agents tab');
    assert.ok(publicFeatures.includes('function WorkflowIndexPage'), 'Must export WorkflowIndexPage');
    assert.ok(publicFeatures.includes('initialTab="workflows"'), 'WorkflowIndexPage must render workflows tab');

    // 4. Agents routes render StandaloneShell or agent components directly
    assert.ok(publicFeatures.includes('function AgentsIndexPage'), 'Must export AgentsIndexPage');
    assert.ok(publicFeatures.includes('function AgentsCreatePage'), 'Must export AgentsCreatePage');

    // 5. Canvas tools & Lab render real components directly on unprefixed paths
    assert.ok(canvasLab.includes('function CanvasToolsPage'), 'Must export CanvasToolsPage');
    assert.ok(canvasLab.includes('<ZhCanvasToolsPage />'), 'CanvasToolsPage must render ZhCanvasToolsPage directly');
    assert.ok(canvasLab.includes('function LabPage'), 'Must export LabPage');
    assert.ok(canvasLab.includes('<ZhLabPage />'), 'LabPage must render ZhLabPage directly');

    // 6. Admin brands and pricing render real clients directly
    assert.ok(adminRedirects.includes('function AdminBrandsPage'), 'Must export AdminBrandsPage');
    assert.ok(adminRedirects.includes('<BrandsManagerClient'), 'AdminBrandsPage must render BrandsManagerClient');
    assert.ok(adminRedirects.includes('function AdminPricingPage'), 'Must export AdminPricingPage');
    assert.ok(adminRedirects.includes('<PricingManagerClient'), 'AdminPricingPage must render PricingManagerClient');
  });

  test('Fake tools in AppsStudio.jsx are replaced with real functional tools and direct navigation', () => {
    const appsSource = readFileSync(resolve(SRC_ROOT, 'packages/studio/src/components/AppsStudio.jsx'), 'utf8');

    // No dummy data or "Coming soon" popup modal
    assert.equal(appsSource.includes('dummyAppsData'), false, 'AppsStudio must not contain dummyAppsData');
    assert.equal(appsSource.includes('selectedApp.name'), false, 'AppsStudio must not have fake modal');

    // Real tools array exists with 22 functional tools
    assert.ok(appsSource.includes('export const REAL_STUDIO_APPS = ['), 'Must define REAL_STUDIO_APPS');
    assert.ok(appsSource.includes('/zh/lab'), 'Must include Drama Lab workshop route');
    assert.ok(appsSource.includes('/studio/cinema'), 'Must include Cinema studio route');
    assert.ok(appsSource.includes('/zh/canvas-tools/outpaint'), 'Must include Canvas Outpaint route');
    assert.ok(appsSource.includes('/zh/canvas-tools/upscale'), 'Must include Canvas Upscale route');
    assert.ok(appsSource.includes('/zh/canvas-tools/cutout'), 'Must include Canvas Cutout route');
    assert.ok(appsSource.includes('/zh/canvas-tools/three-view/character'), 'Must include Character 3-View route');
    assert.ok(appsSource.includes('/zh/canvas-tools/three-view/face'), 'Must include Face 3-View route');
    assert.ok(appsSource.includes('/zh/canvas-tools/three-view/product'), 'Must include Product 3-View route');
    assert.ok(appsSource.includes('/zh/canvas-tools/three-view/storyboard'), 'Must include Storyboard route');
    assert.ok(appsSource.includes('/zh/canvas-tools/three-view/nine-grid'), 'Must include Nine-Grid route');
    assert.ok(appsSource.includes('/studio/body-swap'), 'Must include Body Swap route');
    assert.ok(appsSource.includes('/studio/lipsync'), 'Must include LipSync route');
    assert.ok(appsSource.includes('/studio/motion-control'), 'Must include Motion Control route');
    assert.ok(appsSource.includes('/studio/vibe-motion'), 'Must include Vibe Motion route');
    assert.ok(appsSource.includes('/studio/audio'), 'Must include Audio Studio route');
    assert.ok(appsSource.includes('/studio/workflows'), 'Must include Workflows route');
    assert.ok(appsSource.includes('/studio/agents'), 'Must include Agents route');
    assert.ok(appsSource.includes('/studio/design-agent'), 'Must include Design Agent route');

    // Direct navigation is wired
    assert.ok(appsSource.includes('navigate(href)'), 'Must navigate directly to tool on click');
  });

  test('Simulated placeholders in CallApiPage, CreditsClient and benefits catalog are resolved', () => {
    const publicFeatures = readFileSync(resolve(SRC_ROOT, 'pages/PublicFeaturePages.tsx'), 'utf8');
    const creditsClient = readFileSync(resolve(SRC_ROOT, 'components/credits/CreditsClient.js'), 'utf8');
    const benefitsCatalog = readFileSync(resolve(SRC_ROOT, 'lib/benefits/catalog.js'), 'utf8');

    // CallApiPage contains real developer platform content
    assert.equal(publicFeatures.includes('开发者 API — 筹备中'), false, 'CallApiPage must not say 筹备中');
    assert.equal(publicFeatures.includes('公开 API 尚未开放'), false, 'CallApiPage must not say 尚未开放');
    assert.equal(publicFeatures.includes('此页面不提供 API 文档或代码示例'), false, 'CallApiPage must not deny API docs');

    assert.ok(publicFeatures.includes('https://one.supdance.com/api'), 'Must document Base URL');
    assert.ok(publicFeatures.includes('/api/generations'), 'Must document /api/generations endpoint');
    assert.ok(publicFeatures.includes('/api/tasks/:id'), 'Must document /api/tasks/:id endpoint');
    assert.ok(publicFeatures.includes('/api/canvas-tools/plan'), 'Must document /api/canvas-tools/plan endpoint');
    assert.ok(publicFeatures.includes('curlSnippet'), 'Must include cURL code snippet');
    assert.ok(publicFeatures.includes('pythonSnippet'), 'Must include Python code snippet');
    assert.ok(publicFeatures.includes('tsSnippet'), 'Must include TypeScript code snippet');

    // CreditsClient has all prizes active
    assert.equal(creditsClient.includes('敬请期待'), false, 'CreditsClient must not have 敬请期待');
    assert.equal(creditsClient.includes('后续开放'), false, 'CreditsClient must not have 后续开放');

    // Benefits catalog has all open items
    assert.equal(benefitsCatalog.includes("status: 'soon'"), false, 'All benefits must have active open status');
  });
});

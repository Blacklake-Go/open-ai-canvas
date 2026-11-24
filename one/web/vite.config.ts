import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, transformWithOxc, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const r = (rel: string) => path.resolve(__dirname, rel);

function jsxInJsPlugin(): Plugin {
  return {
    name: 'one-jsx-in-js',
    enforce: 'pre',
    async transform(code, id) {
      const cleanId = id.split('?')[0];
      if (!cleanId.endsWith('.js') || cleanId.includes('/node_modules/') || !cleanId.includes('/src/')) {
        return null;
      }
      const res = await transformWithOxc(code, cleanId, {
        lang: 'jsx',
        jsx: { runtime: 'automatic' },
      });
      return { code: res.code, map: res.map };
    },
  };
}

export default defineConfig({
  plugins: [jsxInJsPlugin(), react()],
  resolve: {
    alias: [
      // Next.js compatibility shims
      { find: /^next\/link$/, replacement: r('src/compat/next-link.tsx') },
      { find: /^next\/navigation$/, replacement: r('src/compat/next-navigation.tsx') },
      { find: /^next\/image$/, replacement: r('src/compat/next-image.tsx') },
      { find: /^next\/script$/, replacement: r('src/compat/next-script.tsx') },
      { find: /^next\/dynamic$/, replacement: r('src/compat/next-dynamic.tsx') },
      { find: /^next-themes$/, replacement: r('src/compat/next-themes.tsx') },
      { find: /^next-intl\/server$/, replacement: r('src/compat/next-intl-server.ts') },
      { find: /^next-intl$/, replacement: r('src/compat/next-intl.tsx') },

      // Workspace packages: studio exact subpath exports
      { find: /^studio\/ui$/, replacement: r('src/packages/studio/src/ui/index.js') },
      { find: /^studio\/ui\/field$/, replacement: r('src/packages/studio/src/ui/Field.jsx') },
      { find: /^studio\/ui\/navigation$/, replacement: r('src/packages/studio/src/ui/Navigation.jsx') },
      { find: /^studio\/ui\/overlay$/, replacement: r('src/packages/studio/src/ui/Overlay.jsx') },
      { find: /^studio\/ui\/tokens$/, replacement: r('src/packages/studio/src/ui/tokens.js') },
      { find: /^studio\/ui\/button$/, replacement: r('src/packages/studio/src/ui/Button.jsx') },
      { find: /^studio\/ui\/feedback$/, replacement: r('src/packages/studio/src/ui/Feedback.jsx') },
      { find: /^studio\/ui\/surface$/, replacement: r('src/packages/studio/src/ui/Surface.jsx') },
      { find: /^studio\/models$/, replacement: r('src/packages/studio/src/models.js') },
      { find: /^studio\/providerLogos$/, replacement: r('src/packages/studio/src/providerLogos.js') },
      { find: /^studio\/muapi$/, replacement: r('src/packages/studio/src/muapi.js') },
      { find: /^studio\/platformClient$/, replacement: r('src/packages/studio/src/platformClient.js') },
      { find: /^studio\/dist\/tailwind\.css$/, replacement: r('src/packages/studio/src/tailwind.css') },
      { find: /^studio\/FrontendModelPicker$/, replacement: r('src/packages/studio/src/components/FrontendModelPicker.jsx') },
      { find: /^studio\/ImageSpecPopover$/, replacement: r('src/packages/studio/src/components/ImageSpecPopover.jsx') },
      { find: /^studio\/ModelPriceTag$/, replacement: r('src/packages/studio/src/components/ModelPriceTag.jsx') },
      { find: /^studio\/DrawModal$/, replacement: r('src/packages/studio/src/components/DrawModal.jsx') },
      { find: /^studio\/PromptComposer$/, replacement: r('src/packages/studio/src/components/prompt/PromptComposer.jsx') },
      { find: /^studio\/PromptAttachments$/, replacement: r('src/packages/studio/src/components/prompt/PromptAttachments.jsx') },
      { find: /^studio\/PromptInputField$/, replacement: r('src/packages/studio/src/components/prompt/PromptInputField.jsx') },
      { find: /^studio\/modelFamilies$/, replacement: r('src/packages/studio/src/modelFamilies.js') },
      { find: /^studio\/modelDescriptions$/, replacement: r('src/packages/studio/src/modelDescriptions.js') },
      { find: /^studio\/modelCapabilities$/, replacement: r('src/packages/studio/src/modelCapabilities.js') },
      { find: /^studio\/modelParameters$/, replacement: r('src/packages/studio/src/modelParameters.js') },
      { find: /^studio\/persistKey$/, replacement: r('src/packages/studio/src/persistKey.js') },
      { find: /^studio\/i18nUtils$/, replacement: r('src/packages/studio/src/i18nUtils.js') },
      { find: /^studio\/ImageStudio$/, replacement: r('src/packages/studio/src/components/ImageStudio.jsx') },
      { find: /^studio\/ImageDetailWorkbench$/, replacement: r('src/packages/studio/src/components/ImageDetailWorkbench.jsx') },
      { find: /^studio\/VideoStudio$/, replacement: r('src/packages/studio/src/components/VideoStudio.jsx') },
      { find: /^studio\/AudioStudio$/, replacement: r('src/packages/studio/src/components/AudioStudio.jsx') },
      { find: /^studio\/ClippingStudio$/, replacement: r('src/packages/studio/src/components/ClippingStudio.jsx') },
      { find: /^studio\/VibeMotionStudio$/, replacement: r('src/packages/studio/src/components/VibeMotionStudio.jsx') },
      { find: /^studio\/LipSyncStudio$/, replacement: r('src/packages/studio/src/components/LipSyncStudio.jsx') },
      { find: /^studio\/RecastStudio$/, replacement: r('src/packages/studio/src/components/RecastStudio.jsx') },
      { find: /^studio\/CinemaStudio$/, replacement: r('src/packages/studio/src/components/CinemaStudio.jsx') },
      { find: /^studio\/MarketingStudio$/, replacement: r('src/packages/studio/src/components/MarketingStudio.jsx') },
      { find: /^studio\/WorkflowStudio$/, replacement: r('src/packages/studio/src/components/WorkflowStudio.jsx') },
      { find: /^studio\/AgentStudio$/, replacement: r('src/packages/studio/src/components/AgentStudio.jsx') },
      { find: /^studio\/DesignAgentStudio$/, replacement: r('src/packages/studio/src/components/DesignAgentStudio.jsx') },
      { find: /^studio\/AppsStudio$/, replacement: r('src/packages/studio/src/components/AppsStudio.jsx') },
      { find: /^studio\/McpCliStudio$/, replacement: r('src/packages/studio/src/components/McpCliStudio.jsx') },
      { find: /^studio\/AiInfluencerStudio$/, replacement: r('src/packages/studio/src/components/AiInfluencerStudio.jsx') },
      { find: /^studio\/LayersStudio$/, replacement: r('src/packages/studio/src/components/LayersStudio.jsx') },
      { find: /^studio\/MotionControlStudio$/, replacement: r('src/packages/studio/src/components/MotionControlStudio.jsx') },
      { find: /^studio$/, replacement: r('src/packages/studio/src/index.js') },
      { find: /^@supdance\/studio$/, replacement: r('src/packages/studio/src/index.js') },

      // Workspace packages: ai-agent, workflow-builder, design-agent
      { find: /^ai-agent\/dist\/tailwind\.css$/, replacement: r('src/packages/Open-Poe-AI/packages/agents/src/tailwind.css') },
      { find: /^ai-agent$/, replacement: r('src/packages/Open-Poe-AI/packages/agents/src/index.js') },
      { find: /^workflow-builder\/dist\/tailwind\.css$/, replacement: r('src/packages/Vibe-Workflow/packages/workflow-builder/src/tailwind.css') },
      { find: /^workflow-builder$/, replacement: r('src/packages/Vibe-Workflow/packages/workflow-builder/src/index.js') },
      { find: /^design-agent\/dist\/tailwind\.css$/, replacement: r('src/packages/Open-AI-Design-Agent/packages/design-agent/src/tailwind.css') },
      { find: /^design-agent$/, replacement: r('src/packages/Open-AI-Design-Agent/packages/design-agent/src/index.js') },

      // Root @ alias
      { find: '@', replacement: r('src') },
    ],
  },
  optimizeDeps: {
    rolldownOptions: {
      moduleTypes: {
        '.js': 'jsx',
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_PROXY_TARGET || 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
      '/uploads/branding/': {
        target: process.env.VITE_BACKEND_PROXY_TARGET || 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
      '/sitemap.xml': {
        target: process.env.VITE_BACKEND_PROXY_TARGET || 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
      '^/auth/(?:tiktok(?:/callback)?|[^/]+/callback)$': {
        target: process.env.VITE_BACKEND_PROXY_TARGET || 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
});

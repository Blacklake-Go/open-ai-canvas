import { PLUGIN_API_VERSION_V2, type PluginSurface, type RegisteredPlugin } from "@/lib/plugins/plugin-types";
import { registerSupDancePlugin, type SupDancePluginManifest } from "@/supdance/adapters/compatibility";
import { SUPDANCE_HTML_PAGE_MANAGER_PLUGIN_ID } from "./types";

export const supdanceHtmlPageManagerManifest: SupDancePluginManifest = {
    apiVersion: PLUGIN_API_VERSION_V2,
    id: SUPDANCE_HTML_PAGE_MANAGER_PLUGIN_ID,
    name: "supdance html页面管理",
    version: "1.0.0",
    publishedAt: "2026-11-04",
    updatedAt: "2026-11-04",
    minHostVersion: "1.7.1",
    author: "SupDance Team",
    description: "专为 AI 影视创作者与平台合规打造的 HTML 页面管理与排版工作台。内置 Linear 极简黑夜、Vercel 结构化文档、Anthropic 法律中心等大气简洁模板，集成高效简洁的开源 HTML 编辑器，支持实时沙箱预览、法务排版增强、代码格式化与独立导出交付。",
    surfaces: ["fullscreen", "settings"] as PluginSurface[],
    permissions: ["canvas.read"],
    trusted: true,
    runtime: {
        backend: "declarative",
        web: "declarative",
    },
    contributes: {
        usageObservers: [SUPDANCE_HTML_PAGE_MANAGER_PLUGIN_ID],
        commands: [
            {
                id: "supdance-html-page-manager.open-editor",
                label: "打开 HTML 页面管理器",
            },
        ],
    },
};

export const supdanceHtmlPageManagerPlugin: RegisteredPlugin = {
    manifest: supdanceHtmlPageManagerManifest,
    activate: () => {},
    deactivate: () => {},
};

registerSupDancePlugin(supdanceHtmlPageManagerPlugin);

export * from "./types";
export * from "./api";
export * from "./templates";

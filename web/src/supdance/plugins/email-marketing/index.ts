import {
    PLUGIN_API_VERSION_V2,
    type PluginSurface,
    type RegisteredPlugin,
} from "@/lib/plugins/plugin-types";
import { registerSupDancePlugin, type SupDancePluginManifest } from "@/supdance/adapters/compatibility";
import { SUPDANCE_EMAIL_MARKETING_PLUGIN_ID } from "./types";

export const supdanceEmailMarketingManifest: SupDancePluginManifest = {
    apiVersion: PLUGIN_API_VERSION_V2,
    id: SUPDANCE_EMAIL_MARKETING_PLUGIN_ID,
    name: "supdance 邮件营销与模板管理",
    version: "1.0.0",
    publishedAt: "2026-11-17",
    updatedAt: "2026-11-17",
    minHostVersion: "1.7.1",
    author: "SupDance Team",
    description: "涵盖新用户欢迎引导、功能周报、额度预警与沉睡召回全生命周期的邮件营销工作台。内置黑曜石 Obsidian 暗黑响应式模板，支持可视化编辑、动态变量实时插值调试、双栏沙箱渲染预览与防频控测试发信。",
    surfaces: ["fullscreen", "settings"] as PluginSurface[],
    permissions: ["canvas.read"],
    trusted: true,
    runtime: {
        backend: "declarative",
        web: "declarative",
    },
    contributes: {
        usageObservers: [SUPDANCE_EMAIL_MARKETING_PLUGIN_ID],
        commands: [
            {
                id: "supdance-email-marketing.open-editor",
                label: "打开邮件营销管理器",
            },
        ],
    },
};

export const supdanceEmailMarketingPlugin: RegisteredPlugin = {
    manifest: supdanceEmailMarketingManifest,
    activate: () => {},
    deactivate: () => {},
};

registerSupDancePlugin(supdanceEmailMarketingPlugin);

export * from "./types";
export * from "./api";

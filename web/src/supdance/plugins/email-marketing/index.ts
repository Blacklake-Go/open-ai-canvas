import { PLUGIN_API_VERSION_V2, type PluginSurface, type RegisteredPlugin } from "@/lib/plugins/plugin-types";
import { registerSupDancePlugin, type SupDancePluginManifest } from "@/supdance/adapters/compatibility";
import { SUPDANCE_EMAIL_MARKETING_PLUGIN_ID } from "./types";

export const supdanceEmailMarketingManifest: SupDancePluginManifest = {
    apiVersion: PLUGIN_API_VERSION_V2,
    id: SUPDANCE_EMAIL_MARKETING_PLUGIN_ID,
    name: "邮件中心",
    version: "1.1.0",
    publishedAt: "2026-11-17",
    updatedAt: "2026-11-17",
    minHostVersion: "1.7.1",
    author: "SupDance Team",
    description: "统一管理系统邮件、营销内容、站点品牌、模板版本、订阅偏好与 SMTP 发送记录。",
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
                label: "打开邮件中心",
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

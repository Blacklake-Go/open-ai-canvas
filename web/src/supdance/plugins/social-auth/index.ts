import { PLUGIN_API_VERSION_V2, type RegisteredPlugin } from "@/lib/plugins/plugin-types";
import { registerSupDancePlugin, type SupDancePluginManifest } from "@/supdance/adapters/compatibility";
import { SUPDANCE_SOCIAL_AUTH_PLUGIN_ID } from "./types";

export const supdanceSocialAuthManifest: SupDancePluginManifest = {
    apiVersion: PLUGIN_API_VERSION_V2,
    id: SUPDANCE_SOCIAL_AUTH_PLUGIN_ID,
    name: "Supdance社交登录配置",
    version: "1.1.0",
    publishedAt: "2026-10-27",
    updatedAt: "2026-10-31",
    minHostVersion: "1.7.1",
    author: "SupDance Team",
    description: "支持八大主流平台（国内 QQ、微信、抖音、B站；海外 Google、X、Instagram、TikTok）社交登录，基于访客真实 IP 智能分区展示，集成暗黑/浅色双端 UI 与后台可视化配置中心。",
    surfaces: ["hybrid", "settings"],
    permissions: ["canvas.read"],
    trusted: true,
    runtime: {
        backend: "declarative",
        web: "declarative",
    },
    contributes: {
        usageObservers: ["supdance-social-auth"],
        commands: [
            {
                id: "supdance-social-auth.admin-settings",
                label: "管理社交登录插件配置",
            },
        ],
    },
};

export const supdanceSocialAuthPlugin: RegisteredPlugin = {
    manifest: supdanceSocialAuthManifest,
    activate: () => {},
    deactivate: () => {},
};

registerSupDancePlugin(supdanceSocialAuthPlugin);

export * from "./types";
export * from "./api";
export * from "./components/social-provider-icons";
export * from "./components/social-login-buttons";

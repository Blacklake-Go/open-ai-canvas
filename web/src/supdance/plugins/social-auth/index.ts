import { PLUGIN_API_VERSION_V2, type PluginSurface, type RegisteredPlugin } from "@/lib/plugins/plugin-types";
import { registerSupDancePlugin, type SupDancePluginManifest } from "@/supdance/adapters/compatibility";
import { SUPDANCE_SOCIAL_AUTH_PLUGIN_ID } from "./types";

export const supdanceSocialAuthManifest: SupDancePluginManifest = {
    apiVersion: PLUGIN_API_VERSION_V2,
    id: SUPDANCE_SOCIAL_AUTH_PLUGIN_ID,
    name: "Supdance社交登录配置",
    version: "1.3.0",
    publishedAt: "2026-10-27",
    updatedAt: "2026-11-02",
    minHostVersion: "1.7.1",
    author: "SupDance Team",
    description: "提供 QQ、微信、抖音、Google、X 授权码适配、入站与绑定管理。渠道需配置真实凭据并完成服务商验收；其他预留渠道尚未开放。支持 IP 分区、即时启停与运营审计。",
    surfaces: ["hybrid", "settings"] as PluginSurface[],
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
export * from "./components/social-onboarding-modal";
export * from "./components/social-account-bindings";


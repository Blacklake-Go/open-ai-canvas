import { PLUGIN_API_VERSION_V2, type RegisteredPlugin } from "@/lib/plugins/plugin-types";
import { registerSupDancePlugin, type SupDancePluginManifest } from "@/supdance/adapters/compatibility";
import { useSupDanceI18nStore } from "./store";
import { SUPDANCE_I18N_PLUGIN_ID } from "./types";

export const supdanceI18nPlugin: RegisteredPlugin = {
    manifest: {
        id: SUPDANCE_I18N_PLUGIN_ID,
        name: "站点多语言与实时词条中心",
        version: "1.0.0",
        publishedAt: "2026-10-27",
        updatedAt: "2026-10-27",
        apiVersion: PLUGIN_API_VERSION_V2,
        minHostVersion: "1.7.1",
        description: "站点级多语言国际化插件：内置简中、英语、繁中、日文、韩语、西班牙语六大语种，提供右上角语言切换器、后台语言管理与动态词条即时修改能力。",
        author: "SupDance Team",
        surfaces: ["hybrid", "settings"],
        permissions: ["canvas.read"],
        trusted: true,
        runtime: {
            backend: "declarative",
            web: "declarative",
        },
        contributes: {
            usageObservers: ["supdance-i18n"],
            commands: [
                {
                    id: "supdance-i18n.switch-language",
                    label: "切换站点界面语言",
                },
            ],
        },
    } as SupDancePluginManifest,
    activate: () => {
        useSupDanceI18nStore.getState().setPluginEnabled(true);
    },
    deactivate: () => {
        useSupDanceI18nStore.getState().setPluginEnabled(false);
    },
};

registerSupDancePlugin(supdanceI18nPlugin);

export * from "./types";
export * from "./api";
export * from "./locales";
export * from "./store";
export * from "./engine/translator";
export * from "./engine/dom-observer";
export * from "./engine/antd-locale";
export { TopbarLanguageSwitcher } from "./components/topbar-language-switcher";
export { SupDanceI18nRuntimeHost } from "./components/i18n-runtime-host";

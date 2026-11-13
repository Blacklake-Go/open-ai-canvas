import { PLUGIN_API_VERSION_V2, type RegisteredPlugin } from "@/lib/plugins/plugin-types";
import { registerSupDancePlugin, type SupDancePluginManifest } from "@/supdance/adapters/compatibility";
import { useSupDanceI18nStore } from "./store";
import { SUPDANCE_I18N_PLUGIN_ID } from "./types";

export const supdanceI18nPlugin: RegisteredPlugin = {
    manifest: {
        id: SUPDANCE_I18N_PLUGIN_ID,
        name: "Supdance国际化",
        version: "1.3.0",
        publishedAt: "2026-10-27",
        updatedAt: "2026-11-13",
        apiVersion: PLUGIN_API_VERSION_V2,
        minHostVersion: "1.7.1",
        description: "使用上游国际化引擎，支持简中、繁中、英语、西班牙语、法语、德语、日语和韩语；保留翻译管理、审核与已发布译文。",
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

import { PLUGIN_API_VERSION_V2, type RegisteredPlugin } from "@/lib/plugins/plugin-types";
import { registerSupDancePlugin, type SupDancePluginManifest } from "@/supdance/adapters/compatibility";
import { SUPDANCE_MUSIC_PLUGIN_ID } from "./types";
import { MUSIC_SITE_DESCRIPTION } from "../i18n/locales/music-site";

export const supdanceMusicManifest: SupDancePluginManifest = {
    apiVersion: PLUGIN_API_VERSION_V2,
    id: SUPDANCE_MUSIC_PLUGIN_ID,
    name: "Supdance音乐音频生成",
    version: "1.3.0",
    publishedAt: "2026-10-29",
    updatedAt: "2026-10-31",
    minHostVersion: "1.7.4",
    author: "SupDance Team",
    description: MUSIC_SITE_DESCRIPTION,
    surfaces: ["fullscreen", "settings", "hybrid"],
    permissions: ["canvas.read", "canvas.write", "asset.read", "asset.upload", "generation.run", "ai.text", "media.read"],
    trusted: true,
    runtime: {
        backend: "declarative",
        web: "declarative",
    },
    contributes: {
        usageObservers: ["supdance-music-generation"],
        commands: [
            {
                id: "supdance-music-generation.open-studio",
                label: "打开 AI 音乐创作岛",
            },
            {
                id: "supdance-music-generation.admin-settings",
                label: "管理音乐生成插件设置",
            },
        ],
        aiCapabilities: ["music-generation", "audio"],
    },
};

export const supdanceMusicPlugin: RegisteredPlugin = {
    manifest: supdanceMusicManifest,
    activate: () => {
        try {
            if (typeof window !== "undefined") {
                window.dispatchEvent(
                    new CustomEvent("supdance:music-plugin:activated", {
                        detail: { pluginId: SUPDANCE_MUSIC_PLUGIN_ID },
                    }),
                );
            }
        } catch (err) {
            console.error("[SupDance Music Plugin] Activation error:", err);
        }
    },
    deactivate: () => {
        try {
            if (typeof window !== "undefined") {
                window.dispatchEvent(
                    new CustomEvent("supdance:music-plugin:deactivated", {
                        detail: { pluginId: SUPDANCE_MUSIC_PLUGIN_ID },
                    }),
                );
            }
        } catch (err) {
            console.error("[SupDance Music Plugin] Deactivation error:", err);
        }
    },
};

registerSupDancePlugin(supdanceMusicPlugin);

export * from "./types";
export * from "./services/music-api";
export * from "./stores/use-music-store";

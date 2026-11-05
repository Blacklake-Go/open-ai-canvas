import { PLUGIN_API_VERSION_V2, type RegisteredPlugin } from "@/lib/plugins/plugin-types";
import { registerSupDancePlugin, type SupDancePluginManifest } from "@/supdance/adapters/compatibility";
import { SUPDANCE_MUSIC_PLUGIN_ID } from "./types";

export const supdanceMusicManifest: SupDancePluginManifest = {
    apiVersion: PLUGIN_API_VERSION_V2,
    id: SUPDANCE_MUSIC_PLUGIN_ID,
    name: "Supdance音乐音频生成",
    version: "1.3.0",
    publishedAt: "2026-10-29",
    updatedAt: "2026-10-31",
    minHostVersion: "1.7.4",
    author: "SupDance Team",
    description: "音乐工作台复用平台渠道、实时报价、统一任务与共享资产，按服务端能力提供描述或歌词创作、多结果管理与统一播放。宿主实现升级需要构建并重启；配置启停不删除历史或账目。",
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

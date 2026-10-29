import { PLUGIN_API_VERSION_V2, type RegisteredPlugin } from "@/lib/plugins/plugin-types";
import { registerSupDancePlugin, type SupDancePluginManifest } from "@/supdance/adapters/compatibility";
import { SUPDANCE_MUSIC_PLUGIN_ID } from "./types";

export const supdanceMusicManifest: SupDancePluginManifest = {
    apiVersion: PLUGIN_API_VERSION_V2,
    id: SUPDANCE_MUSIC_PLUGIN_ID,
    name: "AI 音乐生成 (Music Studio)",
    version: "1.0.0",
    publishedAt: "2026-10-29",
    updatedAt: "2026-10-29",
    minHostVersion: "1.7.1",
    author: "SupDance Team",
    description: "SupDance 专业级 AI 音乐与歌曲生成扩展：深度集成固定服务端 Koyosim 网关（https://www.koyosim.com），支持 Mureka V9.5、Suno v6、Google Lyria 3.5 与 Eleven Music v2.5 四大前沿音频模型。具备简单/自定义双创作模式、专业多行歌词编辑器与结构标签插入、无伪百分比真实阶段状态机、Web Audio API 64频段波形播放器、无损音频下载（MP3/WAV/FLAC 服务端实时转码）与单账本积分预占/结算，全生命周期独立安全启停。",
    surfaces: ["fullscreen", "settings", "hybrid"],
    permissions: [
        "canvas.read",
        "canvas.write",
        "asset.read",
        "asset.upload",
        "generation.run",
        "ai.text",
        "media.read",
    ],
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
        aiCapabilities: [
            "music-generation",
            "audio",
        ],
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

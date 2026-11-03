import { PLUGIN_API_VERSION_V2, type PluginSurface, type RegisteredPlugin } from "@/lib/plugins/plugin-types";
import { registerSupDancePlugin, type SupDancePluginManifest } from "@/supdance/adapters/compatibility";
import { SUPDANCE_VISUAL_ENGINE_PLUGIN_ID } from "./types";
import { removeVisualEngineTheme } from "./themes/theme-engine";
import { useVisualEngineStore } from "./storage/visual-engine-store";

export const supdanceVisualEngineManifest: SupDancePluginManifest = {
    apiVersion: PLUGIN_API_VERSION_V2,
    id: SUPDANCE_VISUAL_ENGINE_PLUGIN_ID,
    name: "Supdance全站视觉与交互引擎",
    version: "2.0.1",
    publishedAt: "2026-11-03",
    updatedAt: "2026-11-03",
    minHostVersion: "1.7.3",
    author: "SupDance Architecture & UI Engineering",
    description:
        "全站视觉、UI 与交互引擎独立插件 V2.0：集中管理品牌色彩、深浅色三层 Token 体系、组件状态光学、E0–E4 深度阴影与遮罩、统一 Motion 动效引擎、图 1 工作区恢复轨道过渡模块、页面级视觉策略及双入口单控制台（Visual Console）。全生命周期支持热插拔与安全回滚。",
    surfaces: ["fullscreen", "settings", "hybrid"] as PluginSurface[],
    permissions: [],
    trusted: true,
    runtime: {
        backend: "declarative",
        web: "declarative",
    },
    contributes: {
        usageObservers: ["supdance-visual-engine"],
        commands: [
            {
                id: "supdance-visual-engine.open-console",
                label: "打开 Visual Console 视觉控制台",
            },
            {
                id: "supdance-visual-engine.switch-theme",
                label: "切换全站视觉主题预设",
            },
        ],
    },
};

export const supdanceVisualEnginePlugin: RegisteredPlugin = {
    manifest: supdanceVisualEngineManifest,
    activate: () => {
        try {
            useVisualEngineStore.getState().setEnabled(true);
            if (typeof window !== "undefined") {
                window.dispatchEvent(
                    new CustomEvent("supdance:visual-engine:activated", {
                        detail: { pluginId: SUPDANCE_VISUAL_ENGINE_PLUGIN_ID, version: "2.0.1" },
                    }),
                );
            }
        } catch (err) {
            console.error("[SupDance Visual Engine] Activation error:", err);
        }
    },
    deactivate: () => {
        try {
            useVisualEngineStore.getState().setEnabled(false);
            removeVisualEngineTheme();
            if (typeof window !== "undefined") {
                window.dispatchEvent(
                    new CustomEvent("supdance:visual-engine:deactivated", {
                        detail: { pluginId: SUPDANCE_VISUAL_ENGINE_PLUGIN_ID },
                    }),
                );
            }
        } catch (err) {
            console.error("[SupDance Visual Engine] Deactivation error:", err);
        }
    },
};

registerSupDancePlugin(supdanceVisualEnginePlugin);

export * from "./types";
export * from "./storage/visual-engine-store";

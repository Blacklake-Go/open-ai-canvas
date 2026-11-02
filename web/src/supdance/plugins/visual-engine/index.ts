import { PLUGIN_API_VERSION_V2, type PluginSurface, type RegisteredPlugin } from "@/lib/plugins/plugin-types";
import { registerSupDancePlugin, type SupDancePluginManifest } from "@/supdance/adapters/compatibility";
import { SUPDANCE_VISUAL_ENGINE_PLUGIN_ID } from "./types";
import { applyVisualEngineTheme, removeVisualEngineTheme } from "./themes/theme-engine";
import { useVisualEngineStore } from "./storage/visual-engine-store";

export const supdanceVisualEngineManifest: SupDancePluginManifest = {
    apiVersion: PLUGIN_API_VERSION_V2,
    id: SUPDANCE_VISUAL_ENGINE_PLUGIN_ID,
    name: "Supdance全站视觉与交互引擎",
    version: "2.0.0",
    publishedAt: "2026-11-03",
    updatedAt: "2026-11-03",
    minHostVersion: "1.7.1",
    author: "SupDance Architecture & UI Engineering",
    description: "全站视觉、UI 与交互引擎独立插件 V2.0：集中管理品牌色彩、深浅色三层 Token 体系、组件状态光学、E0–E4 深度阴影与遮罩、统一 Motion 动效引擎、图 1 工作区恢复轨道过渡模块、页面级视觉策略及双入口单控制台（Visual Console）。全生命周期支持热插拔与安全回滚。",
    surfaces: ["fullscreen", "settings", "hybrid"] as PluginSurface[],
    permissions: ["canvas.read", "canvas.write"],
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
            const currentConfig = useVisualEngineStore.getState().config;
            const mode = currentConfig.themeMode === "light" ? "light" : "dark";
            applyVisualEngineTheme(currentConfig, mode);
            if (typeof window !== "undefined") {
                window.dispatchEvent(
                    new CustomEvent("supdance:visual-engine:activated", {
                        detail: { pluginId: SUPDANCE_VISUAL_ENGINE_PLUGIN_ID, version: "2.0.0" },
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
export * from "./themes/theme-engine";
export * from "./themes/css-variables";
export * from "./themes/contrast-checker";
export * from "./motion/motion-engine";
export * from "./motion/motion-constants";
export * from "./overlays/depth-system";
export * from "./overlays/masks-scrims";
export * from "./loading/workspace-recovery-animator";
export * from "./loading/stage-state-machine";
export * from "./page-rules/page-rules-engine";
export * from "./page-rules/rule-matcher";
export * from "./diagnostics/host-compatibility";
export * from "./diagnostics/token-health-check";
export * from "./runtime/visual-engine-runtime-host";
export { default as VisualConsole } from "./admin/VisualConsole";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useVisualEngineStore } from "../storage/visual-engine-store";
import { applyVisualEngineTheme, removeVisualEngineTheme } from "../themes/theme-engine";
import { resolvePageVisualPolicy } from "../page-rules/page-rules-engine";
import { useActiveTheme } from "@/stores/canvas/use-canvas-theme-store";
import { fetchVisualEnginePublicBundle } from "../api/visual-engine-api";

type NavigationSource = {
    state: { location: { pathname: string } };
    subscribe: (listener: () => void) => () => void;
};

export function VisualEngineRuntimeHost({ navigation }: { navigation: NavigationSource }) {
    const subscribe = useCallback((listener: () => void) => navigation.subscribe(listener), [navigation]);
    const readPath = useCallback(() => navigation.state.location.pathname, [navigation]);
    const pathname = useSyncExternalStore(subscribe, readPath, readPath);
    const enabled = useVisualEngineStore((state) => state.enabled);
    const config = useVisualEngineStore((state) => state.config);
    const theme = useActiveTheme();

    useEffect(() => {
        let disposed = false;
        let pending = false;
        const refresh = async () => {
            if (pending) return;
            pending = true;
            try {
                const bundle = await fetchVisualEnginePublicBundle();
                if (!disposed) useVisualEngineStore.getState().acceptBundle(bundle);
            } catch (error) {
                if (!disposed) {
                    useVisualEngineStore.getState().setEnabled(false);
                    console.warn("视觉引擎配置读取失败，已恢复宿主样式", error);
                }
            } finally {
                pending = false;
            }
        };
        void refresh();
        const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 15000);
        window.addEventListener("focus", refresh);
        return () => {
            disposed = true;
            window.clearInterval(timer);
            window.removeEventListener("focus", refresh);
        };
    }, []);

    useEffect(() => {
        const mode = config.themeMode === "system" ? theme : config.themeMode;
        const policy = resolvePageVisualPolicy(pathname, config, mode);
        if (!enabled || pathname.startsWith("/admin") || config.activePreset === "native" || policy.matchedRule?.themePresetOverride === "native") {
            removeVisualEngineTheme();
            return;
        }
        applyVisualEngineTheme({ ...config, motion: { ...config.motion, enabled: policy.motionEnabled } }, policy.activeThemeMode, { customTokens: policy.activeTokens });
        return () => removeVisualEngineTheme();
    }, [config, enabled, theme, pathname]);

    return null;
}

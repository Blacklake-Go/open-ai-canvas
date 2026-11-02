import { useEffect } from "react";
import { useLocation } from "react-router";
import { useVisualEngineStore } from "../storage/visual-engine-store";
import { applyVisualEngineTheme, removeVisualEngineTheme } from "../themes/theme-engine";
import { resolvePageVisualPolicy } from "../page-rules/page-rules-engine";
import { useThemeStore } from "@/stores/use-theme-store";

export function VisualEngineRuntimeHost() {
    const location = useLocation();
    const enabled = useVisualEngineStore((state) => state.enabled);
    const config = useVisualEngineStore((state) => state.config);
    const theme = useThemeStore((state) => state.theme);
    const isDark = theme === "dark";

    useEffect(() => {
        if (!enabled) {
            removeVisualEngineTheme();
            return;
        }

        const mode = isDark ? "dark" : "light";
        const pagePolicy = resolvePageVisualPolicy(location.pathname, config, mode);

        applyVisualEngineTheme(config, pagePolicy.activeThemeMode, {
            customTokens: pagePolicy.activeTokens,
        });

        return () => {
            // 当离开特定页面规则时还原
        };
    }, [config, enabled, isDark, location.pathname]);

    return null;
}

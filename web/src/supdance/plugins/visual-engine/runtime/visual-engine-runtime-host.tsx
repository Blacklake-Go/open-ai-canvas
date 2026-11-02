import { useEffect, useState } from "react";
import { useVisualEngineStore } from "../storage/visual-engine-store";
import { applyVisualEngineTheme, removeVisualEngineTheme } from "../themes/theme-engine";
import { resolvePageVisualPolicy } from "../page-rules/page-rules-engine";
import { useThemeStore } from "@/stores/use-theme-store";

// AppProviders 挂载点位于 Router 上下文之外，不能使用 useLocation()。
// 改为直接监听 window 导航事件（pushState/replaceState/popstate）来感知路由变化。
function useCurrentPathname(): string {
    const [pathname, setPathname] = useState(() => (typeof window !== "undefined" ? window.location.pathname : "/"));

    useEffect(() => {
        if (typeof window === "undefined") return;
        const update = () => setPathname(window.location.pathname);
        const originalPush = history.pushState;
        const originalReplace = history.replaceState;
        history.pushState = function (...args) {
            const result = originalPush.apply(this, args);
            update();
            return result;
        };
        history.replaceState = function (...args) {
            const result = originalReplace.apply(this, args);
            update();
            return result;
        };
        window.addEventListener("popstate", update);
        return () => {
            history.pushState = originalPush;
            history.replaceState = originalReplace;
            window.removeEventListener("popstate", update);
        };
    }, []);

    return pathname;
}

export function VisualEngineRuntimeHost() {
    const pathname = useCurrentPathname();
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
        const pagePolicy = resolvePageVisualPolicy(pathname, config, mode);

        applyVisualEngineTheme(config, pagePolicy.activeThemeMode, {
            customTokens: pagePolicy.activeTokens,
        });

        return () => {
            // 当离开特定页面规则时还原
        };
    }, [config, enabled, isDark, pathname]);

    return null;
}

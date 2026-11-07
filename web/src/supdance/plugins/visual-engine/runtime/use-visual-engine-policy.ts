import { useSyncExternalStore } from "react";
import { useLocation } from "react-router";
import { useActiveTheme, useCanvasThemeStore } from "@/stores/canvas/use-canvas-theme-store";
import { usePluginStore } from "@/stores/use-plugin-store";
import { useVisualEngineStore } from "../storage/visual-engine-store";
import { resolvePageVisualPolicy } from "../page-rules/page-rules-engine";
import { useVisualEngineActive } from "./visual-engine-activation";

const reducedQuery = "(prefers-reduced-motion: reduce)";
const darkQuery = "(prefers-color-scheme: dark)";
function subscribeMedia(query: string, listener: () => void) {
    const media = window.matchMedia?.(query);
    media?.addEventListener("change", listener);
    return () => media?.removeEventListener("change", listener);
}
const subscribeReduced = (listener: () => void) => subscribeMedia(reducedQuery, listener);
const subscribeDark = (listener: () => void) => subscribeMedia(darkQuery, listener);
const readReduced = () => typeof window !== "undefined" && !!window.matchMedia?.(reducedQuery).matches;
const readDark = () => typeof window !== "undefined" && !!window.matchMedia?.(darkQuery).matches;
const serverSnapshot = () => false;

export function useSystemReducedMotion() {
    return useSyncExternalStore(subscribeReduced, readReduced, serverSnapshot);
}

export function useVisualEnginePolicy() {
    const { pathname } = useLocation();
    const config = useVisualEngineStore((state) => state.config);
    const enabled = useVisualEngineActive();
    const platformEnabled = usePluginStore((state) => state.pluginStates["supdance-visual-engine"]?.effectiveEnabled);
    const hostMode = useActiveTheme();
    const canvasActive = useCanvasThemeStore((state) => state.active);
    const systemDark = useSyncExternalStore(subscribeDark, readDark, serverSnapshot);
    const reducedMotion = useSystemReducedMotion();
    const active = enabled && platformEnabled !== false;
    const mode = !active || canvasActive ? hostMode : config.themeMode === "system" ? (systemDark ? "dark" : "light") : config.themeMode;
    const policy = resolvePageVisualPolicy(pathname, config, mode);
    return { active, mode, config, policy, reducedMotion };
}

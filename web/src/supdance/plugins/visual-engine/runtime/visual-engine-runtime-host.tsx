import { startPluginStateSync } from "@/supdance/adapters/plugin-state-sync";
import { useCallback, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { registerCanvasThemeExtension, refreshCanvasThemeExtensions } from "@/lib/canvas-theme";
import { createVisualEngineCanvasTheme } from "../adapters/canvas-theme";
import { refreshOverlayExtensions, registerOverlayExtension } from "@/lib/overlay-extensions";
import { createVisualEngineOverlayStyles } from "../adapters/overlay-theme";
import { allowsVisualTheme, useVisualEngineActive } from "./visual-engine-activation";
import { registerThemeExtension } from "@/lib/theme-extensions";
import "../components/visual-components.css";
import { useUserStore } from "@/stores/use-user-store";
import { fetchVisualEngineCapabilities } from "../api/visual-engine-api";
import { useVisualEngineStore } from "../storage/visual-engine-store";
import { applyVisualEngineTheme, removeVisualEngineTheme } from "../themes/theme-engine";
import { resolvePageVisualPolicy } from "../page-rules/page-rules-engine";
import { useActiveTheme } from "@/stores/canvas/use-canvas-theme-store";
import { fetchVisualEnginePublicBundle } from "../api/visual-engine-api";
import { MotionGlobalConfig } from "motion/react";

import { usePluginStore } from "@/stores/use-plugin-store";
import { synchronizeVisualEngineRegistration } from "../lifecycle/registration";

type NavigationSource = {
    state: { location: { pathname: string } };
    subscribe: (listener: () => void) => () => void;
};

export function VisualEngineRuntimeHost({ navigation }: { navigation: NavigationSource }) {
    const active = useVisualEngineActive();
    return (
        <>
            <VisualEngineMetadataHost />
            {active ? <ActiveVisualEngineRuntime navigation={navigation} /> : null}
        </>
    );
}

function VisualEngineMetadataHost() {
    const installed = useVisualEngineStore((state) => state.installation.installed);
    const platform = usePluginStore((state) => state.pluginStates["supdance-visual-engine"]?.platformAvailable);
    const user = useUserStore((state) => state.user);
    useLayoutEffect(() => {
        useVisualEngineStore.getState().resetSession();
    }, [user?.id]);
    useEffect(() => {
        synchronizeVisualEngineRegistration(installed);
    }, [installed]);
    useEffect(() => {
        const controller = new AbortController();
        useVisualEngineStore.getState().setPermissions([]);
        if (user?.role === "admin")
            void fetchVisualEngineCapabilities(controller.signal)
                .then((permissions) => {
                    if (!controller.signal.aborted) useVisualEngineStore.getState().setPermissions(permissions);
                })
                .catch((error) => {
                    if (!controller.signal.aborted) console.warn("无法读取视觉权限", error);
                });
        return () => controller.abort();
    }, [user?.id, user?.role, platform]);
    useEffect(
        () =>
            startPluginStateSync(async (signal) => {
                const revision = useVisualEngineStore.getState().publishedRevision;
                try {
                    const bundle = await fetchVisualEnginePublicBundle(signal);
                    const current = useVisualEngineStore.getState();
                    if (!signal.aborted && (current.publishedRevision === revision || current.publishedRevision === bundle.revision)) current.acceptBundle(bundle);
                } catch (error) {
                    if (!signal.aborted && useVisualEngineStore.getState().publishedRevision === revision) {
                        useVisualEngineStore.getState().setEnabled(false);
                        useVisualEngineStore.getState().setPermissions([]);
                        console.warn("视觉引擎配置读取失败，已恢复宿主样式", error);
                    }
                }
            }),
        [installed, platform, user?.id],
    );
    return null;
}

function ActiveVisualEngineRuntime({ navigation }: { navigation: NavigationSource }) {
    const subscribe = useCallback((listener: () => void) => navigation.subscribe(listener), [navigation]);
    const readPath = useCallback(() => navigation.state.location.pathname, [navigation]);
    const pathname = useSyncExternalStore(subscribe, readPath, readPath);
    useLayoutEffect(() => {
        useVisualEngineStore.getState().setRuntimePath(pathname);
    }, [pathname]);
    const config = useVisualEngineStore((state) => state.config);
    const theme = useActiveTheme();
    useLayoutEffect(() => {
        if (config.motion.enabled) return;
        const previous = MotionGlobalConfig.skipAnimations;
        const previousAttribute = document.documentElement.getAttribute("data-ve-motion");
        MotionGlobalConfig.skipAnimations = true;
        document.documentElement.dataset.veMotion = "off";
        return () => {
            MotionGlobalConfig.skipAnimations = previous;
            if (previousAttribute === null) delete document.documentElement.dataset.veMotion;
            else document.documentElement.setAttribute("data-ve-motion", previousAttribute);
        };
    }, [config.motion.enabled]);
    useLayoutEffect(() => {
        const mode = config.themeMode === "system" ? theme : config.themeMode;
        const policy = resolvePageVisualPolicy(pathname, config, mode);
        if (!allowsVisualTheme(pathname, config, policy)) {
            removeVisualEngineTheme();
            return;
        }
        const apply = () =>
            applyVisualEngineTheme(
                {
                    ...config,
                    components: policy.matchedRule?.components ?? config.components,
                    overlays: policy.matchedRule?.overlays ?? config.overlays,
                    elevations: policy.matchedRule?.elevations ?? config.elevations,
                    interactions: { ...config.interactions, performanceMode: policy.matchedRule?.performanceMode ?? config.interactions.performanceMode },
                    motion: { ...config.motion, enabled: policy.motionEnabled },
                    modelPicker: policy.matchedRule?.modelPicker ? { ...config.modelPicker, ...policy.matchedRule.modelPicker } : config.modelPicker,
                },
                policy.activeThemeMode,
                { customTokens: policy.activeTokens },
            );
        const unregisterCanvas = registerCanvasThemeExtension((base) =>
            document.documentElement.dataset.skin && document.documentElement.dataset.skin !== "classic"
                ? base
                : createVisualEngineCanvasTheme(base, { ...config, elevations: policy.matchedRule?.elevations ?? config.elevations }, policy.activeThemeMode, policy.activeTokens),
        );
        const unregisterOverlay = registerOverlayExtension((kind) =>
            document.documentElement.dataset.visualEngineTheme
                ? createVisualEngineOverlayStyles(
                      { ...config, overlays: policy.matchedRule?.overlays ?? config.overlays, elevations: policy.matchedRule?.elevations ?? config.elevations, components: policy.matchedRule?.components ?? config.components },
                      policy.activeThemeMode,
                      kind,
                  )
                : {},
        );
        const unregister = registerThemeExtension({
            beforeApply: ({ document }) => removeVisualEngineTheme({ targetDocument: document }),
            afterApply: ({ skin, document }) => {
                if (document !== window.document) return;
                if (skin.id === "classic") apply();
                refreshCanvasThemeExtensions();
                refreshOverlayExtensions();
            },
        });
        if (document.documentElement.dataset.skin === undefined || document.documentElement.dataset.skin === "classic") apply();
        return () => {
            unregister();
            unregisterOverlay();
            unregisterCanvas();
            removeVisualEngineTheme();
        };
    }, [config, theme, pathname]);

    return null;
}

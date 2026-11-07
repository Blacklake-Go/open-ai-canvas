import { afterAll, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { canvasThemes } from "../src/lib/canvas-theme";
import { apiClient } from "../src/services/api/request";
import { DEFAULT_VISUAL_ENGINE_CONFIG } from "../src/supdance/plugins/visual-engine/config/default-config";
import { applyVisualEngineTheme, removeVisualEngineTheme } from "../src/supdance/plugins/visual-engine/themes/theme-engine";
import { applySkinTheme, DEFAULT_CLASSIC_SKIN } from "../src/lib/skin-themes";
import { detectHostCompatibility } from "../src/supdance/plugins/visual-engine/diagnostics/host-compatibility";
import { MotionGlobalConfig } from "motion/react";
import { resolveOverlayExtensionStyles, useOverlayExtensionRevision } from "../src/lib/overlay-extensions";
import { createSupDanceSkinDefinition } from "../src/supdance/theme/supdance-skin";

const dom = new Window({ url: "http://localhost/" });
const originals = new Map<string, PropertyDescriptor | undefined>();
for (const [name, value] of Object.entries({ __APP_VERSION__: "v1.8.0-supdance.3", window: dom, document: dom.document, navigator: dom.navigator, HTMLElement: dom.HTMLElement, Element: dom.Element, Node: dom.Node, IS_REACT_ACT_ENVIRONMENT: true })) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}
const { act, StrictMode } = await import("react");
const { createRoot } = await import("react-dom/client");
const { VisualEngineRuntimeHost } = await import("../src/supdance/plugins/visual-engine/runtime/visual-engine-runtime-host");
const { useVisualEngineStore } = await import("../src/supdance/plugins/visual-engine/storage/visual-engine-store");
const { WorkspaceRecoveryBoundary } = await import("../src/supdance/plugins/visual-engine/loading/workspace-recovery-boundary");
const { createVisualEngineAntTheme, useVisualEngineHostAdapter } = await import("../src/supdance/plugins/visual-engine/adapters/antd-theme");
const { useAppearanceStore } = await import("../src/stores/use-appearance-store");
const originalRequest = apiClient.request;
test("compatible extensions survive an upstream release and missing extensions still fail closed", () => {
    expect(detectHostCompatibility().compatible).toBe(true);
    expect(detectHostCompatibility({ overlay: false }).compatible).toBe(false);
    const runtime = globalThis as typeof globalThis & { __APP_VERSION__: string };
    try {
        for (const version of ["1.7.3.4", "1.7.4-supdance.2", "1.8.0", "1.8.1", "v1.8.2"]) {
            runtime.__APP_VERSION__ = version;
            expect(detectHostCompatibility().compatible).toBe(true);
        }
    } finally {
        runtime.__APP_VERSION__ = "v1.8.0-supdance.3";
    }
});

test("an uninstalled visual engine leaves both host AntD and host loader in control", async () => {
    const previous = useVisualEngineStore.getState();
    const base = { components: { Button: { primaryShadow: "none" } } };
    const host = document.createElement("div");
    const root = createRoot(host);
    function HostConsumer() {
        const adapter = useVisualEngineHostAdapter("light", DEFAULT_CLASSIC_SKIN, base);
        return <WorkspaceRecoveryBoundary fallback={<span data-native={adapter.theme === base} />} />;
    }
    try {
        useVisualEngineStore.setState({ enabled: true, installation: { ...previous.installation, installed: false }, config: DEFAULT_VISUAL_ENGINE_CONFIG });
        await act(async () => root.render(<HostConsumer />));
        expect(host.querySelector("[data-native]")?.getAttribute("data-native")).toBe("true");
    } finally {
        await act(async () => root.unmount());
        useVisualEngineStore.setState(previous);
    }
});

test("AntD preserves host component options while applying a page motion override", () => {
    const config = structuredClone(DEFAULT_VISUAL_ENGINE_CONFIG);
    config.motion.enabled = true;
    config.pageRules = [{ ...config.pageRules[1], pathPattern: "/", motionEnabledOverride: false, elevations: { ...config.elevations, E2: { ...config.elevations.E2, shadowLight: "0 1px 2px #000" } } }];
    const theme = createVisualEngineAntTheme(config, "light", "/", { components: { Button: { primaryShadow: "none" } } });
    expect(theme.components?.Button?.primaryShadow).toBe("none");
    expect(theme.token?.motion).toBe(false);
    expect(theme.token?.boxShadowSecondary).toBe("0 1px 2px #000");
});
afterAll(() => {
    apiClient.request = originalRequest;
    dom.happyDOM.abort();
    for (const [name, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
    }
});

test("theme cleanup restores existing host properties and removes every injected variable", () => {
    const target = dom.document.createElement("div") as unknown as HTMLElement;
    target.style.setProperty("--primary", "#123456", "important");
    const config = structuredClone(DEFAULT_VISUAL_ENGINE_CONFIG);
    applyVisualEngineTheme(config, "dark", { isolationScope: target });
    expect(target.style.getPropertyValue("--primary")).toBe(config.tokens.dark.primary);
    removeVisualEngineTheme({ isolationScope: target });
    expect(target.style.getPropertyValue("--primary")).toBe("#123456");
    expect(target.style.getPropertyPriority("--primary")).toBe("important");
    expect(target.style.getPropertyValue("--motion-quick")).toBe("");
    expect(target.dataset.visualEngineTheme).toBeUndefined();
});

test("real runtime mounts outside Router and cleans navigation subscriptions under StrictMode", async () => {
    apiClient.request = (async () => ({
        data: { code: 0, msg: "ok", data: { pluginId: "supdance-visual-engine", enabled: true, config: DEFAULT_VISUAL_ENGINE_CONFIG, revision: "revision", version: "2.0.0" } },
        status: 200,
    })) as typeof apiClient.request;
    const listeners = new Set<() => void>();
    const navigation = {
        state: { location: { pathname: "/" } },
        subscribe: (listener: () => void) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
    const host = document.createElement("div");
    const errors: unknown[] = [];
    const root = createRoot(host, { onUncaughtError: (error) => errors.push(error) });
    const originalPush = window.history.pushState;
    function OpenOverlay() {
        useOverlayExtensionRevision();
        const mask = resolveOverlayExtensionStyles("modal", {}).mask;
        return <span data-mask={mask?.backdropFilter} />;
    }
    await act(async () => {
        root.render(
            <StrictMode>
                <VisualEngineRuntimeHost navigation={navigation} />
                <OpenOverlay />
            </StrictMode>,
        );
    });
    expect(errors).toEqual([]);
    expect(listeners.size).toBe(1);
    expect(document.documentElement.dataset.veMotion).toBe("off");
    expect(MotionGlobalConfig.skipAnimations).toBe(true);
    expect(window.history.pushState).toBe(originalPush);
    await act(async () => {
        applySkinTheme(DEFAULT_CLASSIC_SKIN, "light", document);
    });
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe(DEFAULT_VISUAL_ENGINE_CONFIG.tokens.light.primary);
    expect(document.documentElement.dataset.visualEngineTheme).toBe("studio");
    expect(canvasThemes.light.accent.primary).toBe(DEFAULT_VISUAL_ENGINE_CONFIG.tokens.light.primary);
    expect(host.querySelector("span")?.getAttribute("data-mask")).toBe("blur(8px)");
    await act(async () => {
        applySkinTheme(createSupDanceSkinDefinition(), "light", document);
    });
    expect(document.documentElement.dataset.skin).toBe("supdance-studio");
    expect(document.documentElement.dataset.visualEngineTheme).toBeUndefined();
    expect(host.querySelector("span")?.getAttribute("data-mask")).toBeNull();
    await act(async () => {
        applySkinTheme(DEFAULT_CLASSIC_SKIN, "light", document);
    });
    expect(host.querySelector("span")?.getAttribute("data-mask")).toBe("blur(8px)");
    await act(async () => {
        useVisualEngineStore.setState({ enabled: false });
    });
    expect(host.querySelector("span")?.getAttribute("data-mask")).toBeNull();
    expect(document.documentElement.dataset.visualEngineTheme).toBeUndefined();
    expect(document.documentElement.dataset.veMotion).toBeUndefined();
    expect(listeners.size).toBe(0);
    await act(async () => {
        useVisualEngineStore.setState({ enabled: true });
    });
    expect(host.querySelector("span")?.getAttribute("data-mask")).toBe("blur(8px)");
    const published = structuredClone(DEFAULT_VISUAL_ENGINE_CONFIG);
    published.tokens.light.primary = "#215d85";
    await act(async () => {
        useVisualEngineStore.setState({ config: published });
        navigation.state.location.pathname = "/create";
        for (const listener of listeners) listener();
    });
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe("#215d85");
    expect(canvasThemes.light.accent.primary).toBe("#215d85");
    expect(createVisualEngineAntTheme(published, "light", "/create").token?.colorPrimary).toBe("#215d85");
    await act(async () => {
        navigation.state.location.pathname = "/admin/plugins";
        for (const listener of listeners) listener();
    });
    expect(document.documentElement.dataset.visualEngineTheme).toBeUndefined();
    expect(host.querySelector("span")?.getAttribute("data-mask")).toBeNull();
    expect(document.documentElement.dataset.veMotion).toBe("off");
    await act(async () => {
        useVisualEngineStore.setState({ config: { ...DEFAULT_VISUAL_ENGINE_CONFIG, motion: { ...DEFAULT_VISUAL_ENGINE_CONFIG.motion, enabled: true } } });
    });
    expect(document.documentElement.dataset.veMotion).toBeUndefined();
    expect(MotionGlobalConfig.skipAnimations).toBeUndefined();
    await act(async () => {
        useVisualEngineStore.setState({ config: DEFAULT_VISUAL_ENGINE_CONFIG });
    });
    expect(document.documentElement.dataset.veMotion).toBe("off");
    await act(async () => {
        root.unmount();
    });
    expect(listeners.size).toBe(0);
    expect(document.documentElement.dataset.veMotion).toBeUndefined();
    expect(MotionGlobalConfig.skipAnimations).toBeUndefined();
    expect(canvasThemes.light.accent.primary).toBe("#171717");
    expect(window.history.pushState).toBe(originalPush);
});

test("motion off renders the upstream route loader instead of recovery or host animation", async () => {
    const previous = useVisualEngineStore.getState();
    useVisualEngineStore.setState({ enabled: true, config: DEFAULT_VISUAL_ENGINE_CONFIG, runtimePath: "/" });
    const host = document.createElement("div");
    const root = createRoot(host);
    try {
        await act(async () => root.render(<WorkspaceRecoveryBoundary fallback={<span data-host-fallback />} />));
        const markup = host.innerHTML;
        expect(markup).toContain("data-workspace-route-loader");
        expect(markup).toContain("loading-signal");
        expect(markup).toContain("正在打开页面");
        expect(markup).not.toContain("data-host-fallback");
        await act(async () => useVisualEngineStore.setState({ enabled: false }));
        expect(host.innerHTML).toContain("data-host-fallback");
    } finally {
        await act(async () => root.unmount());
        useVisualEngineStore.setState(previous);
    }
});

test("model picker simplified dataset adheres to hot-plug lifecycle on DOM", () => {
    const target = dom.document.createElement("div") as unknown as HTMLElement;
    const config = structuredClone(DEFAULT_VISUAL_ENGINE_CONFIG);
    applyVisualEngineTheme(config, "dark", { isolationScope: target });
    expect(target.dataset.veSimplifiedModelPicker).toBe("true");
    expect(target.dataset.veHideChannelMeta).toBe("true");
    expect(target.dataset.veHideTelemetry).toBe("true");
    expect(target.dataset.veCleanCardLayout).toBe("true");

    config.modelPicker.simplified = false;
    applyVisualEngineTheme(config, "dark", { isolationScope: target });
    expect(target.dataset.veHideChannelMeta).toBeUndefined();
    expect(target.dataset.veHideTelemetry).toBeUndefined();
    expect(target.dataset.veCleanCardLayout).toBeUndefined();

    config.modelPicker = { simplified: true, hideChannelMeta: false, hideTelemetry: false, cleanCardLayout: false };
    applyVisualEngineTheme(config, "dark", { isolationScope: target });
    expect(target.dataset.veSimplifiedModelPicker).toBe("true");
    expect(target.dataset.veHideChannelMeta).toBeUndefined();
    expect(target.dataset.veHideTelemetry).toBeUndefined();
    expect(target.dataset.veCleanCardLayout).toBeUndefined();

    removeVisualEngineTheme({ isolationScope: target });
    expect(target.dataset.veSimplifiedModelPicker).toBeUndefined();
    expect(target.dataset.veHideChannelMeta).toBeUndefined();
    expect(target.dataset.veHideTelemetry).toBeUndefined();
    expect(target.dataset.veCleanCardLayout).toBeUndefined();
});

test("startup loader honors route motion, native appearance, and admin isolation", async () => {
    const previous = useVisualEngineStore.getState();
    const appearance = useAppearanceStore.getState().appearance;
    const config = structuredClone(DEFAULT_VISUAL_ENGINE_CONFIG);
    const host = document.createElement("div");
    const root = createRoot(host);
    try {
        await act(async () => {
            useVisualEngineStore.setState({ enabled: true, config, runtimePath: "/admin/plugins" });
            root.render(<WorkspaceRecoveryBoundary fallback={<span data-host-fallback />} />);
        });
        expect(host.querySelector("[data-host-fallback]")).not.toBeNull();
        await act(async () => {
            useVisualEngineStore.setState({ runtimePath: "/create", config: { ...config, activePreset: "native" } });
        });
        expect(host.querySelector("[data-host-fallback]")).not.toBeNull();
        await act(async () => {
            useVisualEngineStore.setState({ config });
            useAppearanceStore.setState({ appearance: { ...appearance, activeSkin: createSupDanceSkinDefinition() } });
        });
        expect(host.querySelector("[data-host-fallback]")).not.toBeNull();
        await act(async () => {
            useAppearanceStore.setState({ appearance });
            useVisualEngineStore.setState({
                config: { ...config, motion: { ...config.motion, enabled: true }, pageRules: [{ ...config.pageRules[1], pathPattern: "/create", motionEnabledOverride: false }] },
            });
        });
        expect(host.querySelector("[data-workspace-route-loader]")).not.toBeNull();
    } finally {
        await act(async () => root.unmount());
        useAppearanceStore.setState({ appearance });
        useVisualEngineStore.setState(previous);
    }
});

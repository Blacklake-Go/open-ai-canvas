import { afterAll, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { canvasThemes } from "../src/lib/canvas-theme";
import { apiClient } from "../src/services/api/request";
import { DEFAULT_VISUAL_ENGINE_CONFIG } from "../src/supdance/plugins/visual-engine/config/default-config";
import { applyVisualEngineTheme, removeVisualEngineTheme } from "../src/supdance/plugins/visual-engine/themes/theme-engine";
import { applySkinTheme, DEFAULT_CLASSIC_SKIN } from "../src/lib/skin-themes";
import { detectHostCompatibility } from "../src/supdance/plugins/visual-engine/diagnostics/host-compatibility";

const dom = new Window({ url: "http://localhost/" });
const originals = new Map<string, PropertyDescriptor | undefined>();
for (const [name, value] of Object.entries({ __APP_VERSION__: "1.7.4-supdance.2", window: dom, document: dom.document, navigator: dom.navigator, HTMLElement: dom.HTMLElement, Element: dom.Element, Node: dom.Node, IS_REACT_ACT_ENVIRONMENT: true })) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}
const { act, StrictMode } = await import("react");
const { createRoot } = await import("react-dom/client");
const { VisualEngineRuntimeHost } = await import("../src/supdance/plugins/visual-engine/runtime/visual-engine-runtime-host");
const originalRequest = apiClient.request;
test("missing host extensions and unknown upstream versions fall back safely", () => {
    expect(detectHostCompatibility().compatible).toBe(true);
    expect(detectHostCompatibility({ overlay: false }).compatible).toBe(false);
    const runtime = globalThis as typeof globalThis & { __APP_VERSION__: string };
    runtime.__APP_VERSION__ = "1.8.0";
    expect(detectHostCompatibility().compatible).toBe(false);
    runtime.__APP_VERSION__ = "1.7.4-supdance.2";
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
    await act(async () => {
        root.render(
            <StrictMode>
                <VisualEngineRuntimeHost navigation={navigation} />
            </StrictMode>,
        );
    });
    expect(errors).toEqual([]);
    expect(listeners.size).toBe(1);
    expect(window.history.pushState).toBe(originalPush);
    await act(async () => {
        applySkinTheme(DEFAULT_CLASSIC_SKIN, "light", document);
    });
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe(DEFAULT_VISUAL_ENGINE_CONFIG.tokens.light.primary);
    expect(document.documentElement.dataset.visualEngineTheme).toBe("studio");
    expect(canvasThemes.light.accent.primary).toBe(DEFAULT_VISUAL_ENGINE_CONFIG.tokens.light.primary);
    await act(async () => {
        navigation.state.location.pathname = "/admin/plugins";
        for (const listener of listeners) listener();
    });
    expect(document.documentElement.dataset.visualEngineTheme).toBeUndefined();
    await act(async () => {
        root.unmount();
    });
    expect(listeners.size).toBe(0);
    expect(canvasThemes.light.accent.primary).toBe("#171717");
    expect(window.history.pushState).toBe(originalPush);
});

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import type { AxiosAdapter } from "axios";
import { apiClient } from "../src/services/api/request";
import { DEFAULT_VISUAL_ENGINE_CONFIG } from "../src/supdance/plugins/visual-engine/config/default-config";
import { validateVisualEngineConfig } from "../src/supdance/plugins/visual-engine/config/schema";
import { useVisualEngineStore } from "../src/supdance/plugins/visual-engine/storage/visual-engine-store";
import { useUserStore } from "../src/stores/use-user-store";
import { usePluginStore } from "../src/stores/use-plugin-store";
import { useCanvasThemeStore } from "../src/stores/canvas/use-canvas-theme-store";
import { applyVisualEngineTheme, removeVisualEngineTheme } from "../src/supdance/plugins/visual-engine/themes/theme-engine";
import { generateVisualEngineCSSVariables } from "../src/supdance/plugins/visual-engine/themes/css-variables";
import { mergeVisualEngineAntTheme } from "../src/supdance/plugins/visual-engine/themes/host-theme";
import { resolvePageVisualPolicy } from "../src/supdance/plugins/visual-engine/page-rules/page-rules-engine";
import { findMatchingPageRule } from "../src/supdance/plugins/visual-engine/page-rules/rule-matcher";
import { runTokenHealthCheck } from "../src/supdance/plugins/visual-engine/diagnostics/token-health-check";
import { DiagnosticsPane } from "../src/supdance/plugins/visual-engine/admin/pages/DiagnosticsPane";
import { WorkspaceRecoveryAnimator } from "../src/supdance/plugins/visual-engine/loading/workspace-recovery-animator";
import { VisualEngineWorkspaceLoader } from "../src/supdance/plugins/visual-engine/loading/workspace-recovery-loader";
import { useSessionRecoveryStore } from "../src/lib/session-recovery";
import { PageRulesPane } from "../src/supdance/plugins/visual-engine/admin/pages/PageRulesPane";
import { VisualEngineRuntimeHost } from "../src/supdance/plugins/visual-engine/runtime/visual-engine-runtime-host";
import { getComponentTransition } from "../src/supdance/plugins/visual-engine/motion/motion-engine";

const dom = new Window({ url: "http://localhost:3000" });
const originals = new Map<string, PropertyDescriptor | undefined>();
const originalAdapter = apiClient.defaults.adapter;
const originalPluginStorage = usePluginStore.persist.getOptions().storage;
let root: Root | undefined;
let container: HTMLDivElement;
let adminShell: typeof import("../src/pages/admin/components/admin-shell");
beforeAll(async () => {
    for (const [key, value] of Object.entries({
        window: dom,
        document: dom.document,
        HTMLElement: dom.HTMLElement,
        Element: dom.Element,
        Event: dom.Event,
        CustomEvent: dom.CustomEvent,
        navigator: dom.navigator,
        getComputedStyle: dom.getComputedStyle.bind(dom),
        ShadowRoot: dom.ShadowRoot,
        SVGElement: dom.SVGElement,
        IS_REACT_ACT_ENVIRONMENT: true,
        __APP_VERSION__: "1.7.3.4",
    })) {
        originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        Object.defineProperty(globalThis, key, { configurable: true, value });
    }
    usePluginStore.persist.setOptions({ storage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} } });
    adminShell = await import("../src/pages/admin/components/admin-shell");
});
beforeEach(() => {
    useVisualEngineStore.getState().resetSession();
    useVisualEngineStore.setState({ loaded: false, enabled: false, config: structuredClone(DEFAULT_VISUAL_ENGINE_CONFIG), draftConfig: structuredClone(DEFAULT_VISUAL_ENGINE_CONFIG), error: null });
    useUserStore.setState({ user: { id: "admin", username: "admin", displayName: "Admin", role: "admin", status: "active" } });
    usePluginStore.setState({ pluginStates: {} });
    useCanvasThemeStore.setState({ active: false });
    container = document.createElement("div");
    document.body.append(container);
});
afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    root = undefined;
    container.remove();
    removeVisualEngineTheme();
    apiClient.defaults.adapter = originalAdapter;
});
afterAll(async () => {
    await dom.happyDOM.abort();
    usePluginStore.persist.setOptions({ storage: originalPluginStorage });
    for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
    }
});
function overview() {
    return {
        bundle: { pluginId: "supdance-visual-engine", enabled: true, version: "server-revision", revision: "revision", config: { ...structuredClone(DEFAULT_VISUAL_ENGINE_CONFIG), publishedVersion: "server-revision" } },
        snapshots: [],
        auditLogs: [],
        canPublish: true,
        canRollback: true,
    };
}

test("upstream navigation regrouping preserves one visual engine entry and removes it when disabled", () => {
    const { getAdminNavigation } = adminShell;
    const enabled = getAdminNavigation(true);
    const visualGroup = enabled.find((group) => group.items.some((item) => item.path === "/admin/plugins/visual-engine"));
    expect(visualGroup?.key).toBe("creation");
    expect(enabled.flatMap((group) => group.items).filter((item) => item.path === "/admin/plugins/visual-engine")).toHaveLength(1);
    expect(getAdminNavigation(true)).toEqual(enabled);
    const disabledPaths = getAdminNavigation(false).flatMap((group) => group.items.map((item) => item.path));
    expect(disabledPaths).not.toContain("/admin/plugins/visual-engine");
    expect(disabledPaths).toContain("/admin/plugins");
    expect(disabledPaths).toContain("/admin/settings/system-update");
});

test("visual console breadcrumb uses its specific entry after upstream navigation regrouping", async () => {
    const { AdminPageFrame } = adminShell;
    useVisualEngineStore.setState({ enabled: true });
    await render(createElement(MemoryRouter, { initialEntries: ["/admin/plugins/visual-engine"] }, createElement(AdminPageFrame, { title: "视觉引擎", children: createElement("div", null, "console") })));
    const breadcrumb = container.querySelector('nav[aria-label="当前位置"]');
    expect(breadcrumb?.textContent).toContain("创作与扩展");
    expect(breadcrumb?.textContent).toContain("视觉引擎");
    expect(breadcrumb?.textContent).not.toContain("插件管理");
});
async function render(element: React.ReactNode) {
    root = createRoot(container);
    await act(async () => root?.render(element));
}

describe("visual engine publication boundary", () => {
    test("uses business envelope and server versions; failed publish preserves the draft", async () => {
        const paths: string[] = [];
        let failing = false;
        apiClient.defaults.adapter = (async (config) => {
            paths.push(config.url ?? "");
            return { config, status: 200, statusText: "OK", headers: {}, data: failing ? { code: 400, reason: "invalid_config", msg: "rejected" } : { code: 0, data: overview(), msg: "ok" } };
        }) satisfies AxiosAdapter;
        await useVisualEngineStore.getState().refresh(true);
        useVisualEngineStore.getState().updateDraft((draft) => {
            draft.components.buttonRadius = 20;
        });
        failing = true;
        expect((await useVisualEngineStore.getState().publishDraft()).success).toBe(false);
        expect(useVisualEngineStore.getState().isDraftDirty).toBe(true);
        expect(useVisualEngineStore.getState().draftConfig.components.buttonRadius).toBe(20);
        failing = false;
        expect((await useVisualEngineStore.getState().publishDraft("forged-actor")).success).toBe(true);
        expect(useVisualEngineStore.getState().config.publishedVersion).toBe("server-revision");
        expect(paths).toEqual(["/admin/plugins/supdance-visual-engine/overview", "/admin/plugins/supdance-visual-engine/publish", "/admin/plugins/supdance-visual-engine/publish"]);
        expect(dom.localStorage.getItem("supdance_visual_engine_config_v2")).toBeNull();
    });
    test("discarding an account session rejects its late admin response", async () => {
        let release: (() => void) | undefined;
        apiClient.defaults.adapter = (async (config) => {
            await new Promise<void>((resolve) => {
                release = resolve;
            });
            return { config, status: 200, statusText: "OK", headers: {}, data: { code: 0, data: overview(), msg: "ok" } };
        }) satisfies AxiosAdapter;
        const pending = useVisualEngineStore.getState().refresh(true);
        await new Promise((resolve) => setTimeout(resolve, 0));
        useVisualEngineStore.getState().resetSession();
        useUserStore.setState({ user: null });
        release?.();
        await pending;
        expect(useVisualEngineStore.getState().canPublish).toBe(false);
        expect(useVisualEngineStore.getState().snapshots).toEqual([]);
    });
    test("failed public lookup disables the runtime instead of enabling defaults", async () => {
        apiClient.defaults.adapter = (async () => {
            throw new Error("offline");
        }) satisfies AxiosAdapter;
        await expect(useVisualEngineStore.getState().refresh()).rejects.toThrow("offline");
        expect(useVisualEngineStore.getState().enabled).toBe(false);
        expect(useVisualEngineStore.getState().canPublish).toBe(false);
    });
});

test("strict config rejects missing sections, null elevations, invalid ranges and rules", () => {
    expect(validateVisualEngineConfig(DEFAULT_VISUAL_ENGINE_CONFIG).valid).toBe(true);
    for (const mutation of [
        (config: any) => {
            config.elevations.E2 = null;
        },
        (config: any) => {
            config.elevations.E2.shadowDark = "not-a-shadow";
        },
        (config: any) => {
            config.components.buttonRadius = -999;
        },
        (config: any) => {
            config.motion.durationModal = -200;
        },
        (config: any) => {
            config.motion.easingStandard = "invalid";
        },
        (config: any) => {
            config.workspaceRecovery.enabled = "yes";
        },
        (config: any) => {
            config.pageRules = [null];
        },
        (config: any) => {
            config.pageRules[0].customTokens = { primary: "invalid" };
        },
        (config: any) => {
            delete config.tokens.light;
        },
    ]) {
        const config = structuredClone(DEFAULT_VISUAL_ENGINE_CONFIG);
        mutation(config);
        const result = validateVisualEngineConfig(config);
        expect(result.valid).toBe(false);
        expect(() => generateVisualEngineCSSVariables(result.config, "dark")).not.toThrow();
    }
});

test("theme cleanup restores original values and preserves newer host writes", () => {
    const target = document.documentElement;
    target.style.setProperty("--primary", "#123456", "important");
    applyVisualEngineTheme(DEFAULT_VISUAL_ENGINE_CONFIG, "dark");
    applyVisualEngineTheme(DEFAULT_VISUAL_ENGINE_CONFIG, "light");
    removeVisualEngineTheme();
    expect(target.style.getPropertyValue("--primary")).toBe("#123456");
    expect(target.style.getPropertyPriority("--primary")).toBe("important");
    applyVisualEngineTheme(DEFAULT_VISUAL_ENGINE_CONFIG, "dark");
    target.style.setProperty("--primary", "#654321");
    removeVisualEngineTheme();
    expect(target.style.getPropertyValue("--primary")).toBe("#654321");
});

test("specific rules win without mutating order; global motion off dominates page overrides", () => {
    const rules = [
        { id: "general", name: "General", pathPattern: "/admin/*" },
        { id: "specific", name: "Specific", pathPattern: "/admin/plugins/*" },
    ];
    expect(findMatchingPageRule("/admin/plugins/visual-engine", rules)?.id).toBe("specific");
    expect(rules[0].id).toBe("general");
    const config = structuredClone(DEFAULT_VISUAL_ENGINE_CONFIG);
    config.motion.enabled = false;
    const policy = resolvePageVisualPolicy("/admin/plugins/visual-engine", config, "light");
    expect(policy.motionEnabled).toBe(false);
    const variables = generateVisualEngineCSSVariables(config, "light");
    expect(variables["--motion-state"]).toBe("0ms");
    expect(variables["--motion-modal"]).toBe("0ms");
    const theme = mergeVisualEngineAntTheme({}, config, policy, false);
    expect(theme.token?.motion).toBe(false);
    expect(theme.components?.Button?.borderRadius).toBe(policy.activeComponents.buttonRadius);
});

test("diagnostics renders draft failures and both selectable modes", async () => {
    const draft = structuredClone(DEFAULT_VISUAL_ENGINE_CONFIG);
    draft.tokens.dark.text = draft.tokens.dark.canvas;
    useVisualEngineStore.setState({ draftConfig: draft, previewThemeMode: "dark" });
    expect(runTokenHealthCheck(draft, "dark").pass).toBe(false);
    await render(createElement(DiagnosticsPane));
    expect(container.textContent).toContain("1:1 · FAIL");
    expect(container.textContent).toContain("当前草稿存在未通过项");
    const select = container.querySelector("select")!;
    await act(async () => {
        select.value = "light";
        select.dispatchEvent(new dom.Event("change", { bubbles: true }));
    });
    expect(useVisualEngineStore.getState().previewThemeMode).toBe("light");
});

test("real recovery loader follows session stages and respects platform disable", async () => {
    useVisualEngineStore.setState({ loaded: true, enabled: true });
    useSessionRecoveryStore.setState({ stage: "syncing" });
    await render(createElement(MemoryRouter, { initialEntries: ["/projects"] }, createElement(VisualEngineWorkspaceLoader)));
    expect(container.querySelector("[data-stage]")?.getAttribute("data-stage")).toBe("syncing");
    await act(async () => useSessionRecoveryStore.setState({ stage: "ready" }));
    expect(container.querySelector("[data-stage]")?.getAttribute("data-stage")).toBe("ready");
    await act(async () => useVisualEngineStore.setState({ enabled: false }));
    expect(container.querySelector("[data-full-screen-loader]")).not.toBeNull();
    expect(container.querySelector("[data-stage]")).toBeNull();
});

test("disabled recovery renders no animation", async () => {
    await render(createElement(WorkspaceRecoveryAnimator, { config: { ...DEFAULT_VISUAL_ENGINE_CONFIG.workspaceRecovery, enabled: false } }));
    expect(container.querySelector("[data-supdance-recovery-animator]")).toBeNull();
});

test("runtime follows canvas mode, stops on platform disable, and cleans up its variables", async () => {
    apiClient.defaults.adapter = (async (config) => ({ config, status: 200, statusText: "OK", headers: {}, data: { code: 0, data: overview().bundle, msg: "ok" } })) satisfies AxiosAdapter;
    useCanvasThemeStore.setState({ active: true, theme: "light" });
    await render(createElement(MemoryRouter, { initialEntries: ["/canvas/test"] }, createElement(VisualEngineRuntimeHost)));
    expect(document.documentElement.dataset.visualEngineMode).toBe("light");
    await act(async () => useCanvasThemeStore.setState({ theme: "dark" }));
    expect(document.documentElement.dataset.visualEngineMode).toBe("dark");
    await act(async () =>
        usePluginStore.getState().setPluginStates({ "supdance-visual-engine": { pluginId: "supdance-visual-engine", effectiveEnabled: false, platformAvailable: false, userEnabled: false, userConfigured: false, canToggle: false, canConfigure: false } }),
    );
    expect(document.documentElement.dataset.visualEngineMode).toBeUndefined();
    expect(document.documentElement.style.getPropertyValue("--motion-modal")).toBe("");
});

test("motion transition consumes edited timing and easing, including reduced motion", () => {
    const motion = { ...DEFAULT_VISUAL_ENGINE_CONFIG.motion, durationTabSwitch: 370, easingBounce: "cubic-bezier(0.1, 0.2, 0.3, 0.4)" };
    expect(getComponentTransition("tabSwitch", motion, false)).toEqual({ duration: 0.37, ease: [0.1, 0.2, 0.3, 0.4] });
    expect(getComponentTransition("tabSwitch", { ...motion, enabled: false }, false)).toEqual({ duration: 0 });
    expect(getComponentTransition("modal", { ...motion, reducedMotionBehavior: "instant" }, true)).toEqual({ duration: 0 });
});

test("page rule editor creates and edits a rule through its real modal", async () => {
    await render(createElement(PageRulesPane));
    const add = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("新增规则"))!;
    await act(async () => add.click());
    const dialog = document.querySelector("[role=dialog]")!;
    expect(dialog).not.toBeNull();
    const select = dialog.querySelector("select")!;
    await act(async () => {
        select.value = "light";
        select.dispatchEvent(new dom.Event("change", { bubbles: true }));
    });
    const save = Array.from(dialog.querySelectorAll("button")).find((button) => button.textContent?.includes("保存到草稿"))!;
    await act(async () => save.click());
    const added = useVisualEngineStore.getState().draftConfig.pageRules.at(-1)!;
    expect(added.themePresetOverride).toBe("light");
    const edit = container.querySelector<HTMLButtonElement>(`button[aria-label="编辑规则：${added.name}"]`)!;
    await act(async () => edit.click());
    const editDialog = document.querySelector("[role=dialog]")!;
    const motionSelect = editDialog.querySelectorAll("select")[1];
    await act(async () => {
        motionSelect.value = "false";
        motionSelect.dispatchEvent(new dom.Event("change", { bubbles: true }));
    });
    const saveAgain = Array.from(editDialog.querySelectorAll("button")).find((button) => button.textContent?.includes("保存到草稿"))!;
    await act(async () => saveAgain.click());
    expect(useVisualEngineStore.getState().draftConfig.pageRules.at(-1)?.motionEnabledOverride).toBe(false);
});

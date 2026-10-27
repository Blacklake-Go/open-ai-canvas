import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DEFAULT_CLASSIC_SKIN, getSkinAntOverrides } from "@/lib/skin-themes";
import { assertEditorPermission, pluginMayRenderEditorSlot } from "@/lib/plugins/plugin-permission-check";
import { getRegisteredPlugin } from "@/lib/plugins/plugin-registry";
import type { PluginHostContext, PluginManifestV2, RegisteredPlugin } from "@/lib/plugins/plugin-types";
import {
    activateSupDancePluginSafely,
    applySupDanceTheme,
    createSupDanceSkinDefinition,
    deactivateSupDancePluginSafely,
    DEFAULT_SUPDANCE_FEATURE_FLAGS,
    mergeSupDanceRoutes,
    registerSupDancePlugin,
    SUPDANCE_BRAND_DEFAULTS,
    SUPDANCE_RESERVED_PLUGIN_PREFIX,
    SUPDANCE_SKIN_ID,
    SUPDANCE_UPSTREAM_PATCH_REGISTRY,
    unregisterSupDancePlugin,
    upgradeSupDancePlugin,
    validateSupDancePluginManifest,
} from "@/supdance";

const TEST_PLUGIN_ID = "supdance-test-extension";

function createMockHostContext(manifest: PluginManifestV2): PluginHostContext {
    return {
        manifest,
        permissions: new Set(manifest.permissions),
        storage: {
            get: async () => null,
            set: async () => {},
            remove: async () => {},
        },
        config: {},
    };
}

afterEach(() => {
    unregisterSupDancePlugin(TEST_PLUGIN_ID);
});

describe("SupDance theme isolation", () => {
    test("creates valid SupDance skin without mutating DEFAULT_CLASSIC_SKIN", () => {
        const skin = createSupDanceSkinDefinition();
        expect(skin.id).toBe(SUPDANCE_SKIN_ID);
        expect(skin.name).toBe("SupDance Studio");
        expect(skin.locked).toBe(false);
        expect(Object.keys(skin.tokens.light)).toHaveLength(50);
        expect(Object.keys(skin.tokens.dark)).toHaveLength(50);

        // Verify classic default remains untouched and locked
        expect(DEFAULT_CLASSIC_SKIN.id).toBe("classic");
        expect(DEFAULT_CLASSIC_SKIN.locked).toBe(true);
        expect(getSkinAntOverrides(DEFAULT_CLASSIC_SKIN, "light")).toEqual({});

        // Verify SupDance overrides map cleanly to AntD token overrides
        const lightOverrides = getSkinAntOverrides(skin, "light");
        expect(lightOverrides.primary).toBe("#4f46e5");
        expect(lightOverrides.buttonRadius).toBe(10);
    });

    test("applySupDanceTheme toggles between SupDance skin and classic fallback cleanly", () => {
        const assigned = new Map<string, string>();
        const removed: string[] = [];
        const mockDoc = {
            documentElement: {
                dataset: {} as Record<string, string>,
                style: {
                    setProperty: (k: string, v: string) => assigned.set(k, v),
                    removeProperty: (k: string) => {
                        removed.push(k);
                        assigned.delete(k);
                    },
                },
            },
        } as unknown as Document;

        const applied = applySupDanceTheme("light", { enabled: true, targetDocument: mockDoc });
        expect(applied.id).toBe(SUPDANCE_SKIN_ID);
        expect(mockDoc.documentElement.dataset.skin).toBe(SUPDANCE_SKIN_ID);
        expect(assigned.get("--btn-solid-bg")).toBe("#4f46e5");

        const restored = applySupDanceTheme("light", { enabled: false, targetDocument: mockDoc });
        expect(restored.id).toBe("classic");
        expect(mockDoc.documentElement.dataset.skin).toBe("classic");
        expect(assigned.has("--btn-solid-bg")).toBe(false);
    });

    test("feature flags and brand defaults are defined", () => {
        expect(SUPDANCE_BRAND_DEFAULTS.brandSlug).toBe("supdance-canvas");
        expect(DEFAULT_SUPDANCE_FEATURE_FLAGS.themeExtensionEnabled).toBe(true);
    });
});

describe("SupDance plugin isolation and manifest validation", () => {
    test("rejects custom plugins without supdance- prefix, invalid semver, or incompatible minHostVersion", () => {
        const badManifest = {
            apiVersion: "yingce.plugin/v2" as const,
            id: "custom-plugin-no-prefix",
            name: "Bad Prefix",
            version: "invalid-semver",
            minHostVersion: "99.0.0",
            description: "test",
            permissions: ["canvas.read" as const, "canvas.read" as const],
            contributes: { aiCapabilities: ["test"] },
        };
        const report = validateSupDancePluginManifest(badManifest);
        expect(report.compatible).toBe(false);
        expect(report.errors.some((e) => e.includes(SUPDANCE_RESERVED_PLUGIN_PREFIX))).toBe(true);
        expect(report.errors.some((e) => e.includes("SemVer"))).toBe(true);
        expect(report.errors.some((e) => e.includes("最低兼容版本"))).toBe(true);
        expect(report.errors.some((e) => e.includes("重复"))).toBe(true);
    });

    test("registers, activates, enforces permission denial, upgrades, and unregisters compliant SupDance plugin cleanly", async () => {
        let activated = false;
        let deactivated = false;
        const manifestV1: PluginManifestV2 = {
            apiVersion: "yingce.plugin/v2",
            id: TEST_PLUGIN_ID,
            name: "SupDance Test Extension",
            version: "0.1.0",
            description: "Test plugin",
            permissions: ["canvas.read"],
            contributes: { aiCapabilities: [TEST_PLUGIN_ID] },
        };
        const plugin: RegisteredPlugin = {
            manifest: manifestV1,
            activate: () => {
                activated = true;
            },
            deactivate: () => {
                deactivated = true;
            },
        };
        registerSupDancePlugin(plugin);
        expect(getRegisteredPlugin(TEST_PLUGIN_ID)?.manifest.version).toBe("0.1.0");

        const ctx = createMockHostContext(manifestV1);
        const actRes = await activateSupDancePluginSafely(TEST_PLUGIN_ID, ctx);
        expect(actRes.ok).toBe(true);
        expect(activated).toBe(true);

        // Permission denial check: plugin only requested canvas.read, so timeline.command / export.run must be denied
        const slotVerdict = pluginMayRenderEditorSlot(TEST_PLUGIN_ID, "export-renderer");
        expect(slotVerdict.allowed).toBe(false);
        if (!slotVerdict.allowed) {
            expect(slotVerdict.reason).toBe("missing-permission");
            expect(slotVerdict.missing).toBe("export.run");
        }
        expect(() => assertEditorPermission(TEST_PLUGIN_ID, "timeline.command")).toThrow(/缺少 timeline\.command 权限/);

        // Upgrade plugin to 0.2.0
        const manifestNext: PluginManifestV2 = {
            ...manifestV1,
            version: "0.2.0",
        };
        const upgradeRes = await upgradeSupDancePlugin({ manifest: manifestNext }, { context: ctx });
        expect(deactivated).toBe(true);
        expect(upgradeRes.previousVersion).toBe("0.1.0");
        expect(upgradeRes.currentVersion).toBe("0.2.0");
        expect(getRegisteredPlugin(TEST_PLUGIN_ID)?.manifest.version).toBe("0.2.0");

        // Reject downgrade or same-version upgrade
        await expect(upgradeSupDancePlugin({ manifest: manifestV1 })).rejects.toThrow(/必须高于当前已安装版本/);

        unregisterSupDancePlugin(TEST_PLUGIN_ID);
        expect(getRegisteredPlugin(TEST_PLUGIN_ID)).toBeUndefined();
    });

    test("isolates plugin activation and deactivation failures without crashing host", async () => {
        const manifest: PluginManifestV2 = {
            apiVersion: "yingce.plugin/v2",
            id: TEST_PLUGIN_ID,
            name: "SupDance Broken Plugin",
            version: "0.1.0",
            description: "Faulty plugin",
            permissions: ["canvas.read"],
            contributes: { aiCapabilities: [TEST_PLUGIN_ID] },
        };
        registerSupDancePlugin({
            manifest,
            activate: () => {
                throw new Error("simulated plugin activation crash");
            },
        });
        const ctx = createMockHostContext(manifest);
        const result = await activateSupDancePluginSafely(TEST_PLUGIN_ID, ctx);
        expect(result.ok).toBe(false);
        expect(result.error).toContain("simulated plugin activation crash");
        // Faulty plugin must be automatically unregistered to protect host state
        expect(getRegisteredPlugin(TEST_PLUGIN_ID)).toBeUndefined();
    });

    test("verifies supdance/plugins template manifests do not collide with upstream plugin-packages", () => {
        const repoRoot = resolve(import.meta.dir, "../..");
        const upstreamPackagesDir = resolve(repoRoot, "plugin-packages");
        const supdancePluginsDir = resolve(repoRoot, "supdance/plugins");

        const upstreamIds = new Set<string>();
        for (const entry of readdirSync(upstreamPackagesDir, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                const manifestPath = resolve(upstreamPackagesDir, entry.name, "manifest.json");
                if (existsSync(manifestPath)) {
                    const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as { id?: string };
                    if (parsed.id) upstreamIds.add(parsed.id);
                }
            }
        }
        expect(upstreamIds.size).toBeGreaterThan(50);

        for (const entry of readdirSync(supdancePluginsDir, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const manifestPath = resolve(supdancePluginsDir, entry.name, "manifest.json");
            expect(existsSync(manifestPath)).toBe(true);
            const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PluginManifestV2 & { minHostVersion?: string };
            expect(manifest.minHostVersion).toBeDefined();
            const report = validateSupDancePluginManifest(manifest, upstreamIds);
            expect(report.compatible).toBe(true);
            expect(report.errors).toEqual([]);
        }
    });
});

describe("SupDance route & patch registry guards", () => {
    test("prevents SupDance custom routes (including nested children and trailing slashes) from shadowing upstream routes", () => {
        const upstream = [{ path: "/canvas" }, { path: "/admin", children: [{ path: "plugins" }] }];
        expect(() => mergeSupDanceRoutes(upstream, [{ path: "/canvas" }])).toThrow(/冲突/);
        expect(() => mergeSupDanceRoutes(upstream, [{ path: "/canvas/" }])).toThrow(/冲突/);
        expect(() => mergeSupDanceRoutes(upstream, [{ path: "/admin/plugins" }])).toThrow(/冲突/);
        expect(() => mergeSupDanceRoutes(upstream, [{ path: "/admin", children: [{ path: "plugins" }] }])).toThrow(/冲突/);
        expect(() => mergeSupDanceRoutes(upstream, [{ path: "/supdance/a" }, { path: "/supdance/a/" }])).toThrow(/重复声明/);

        const merged = mergeSupDanceRoutes(upstream, [{ path: "/supdance/studio", children: [{ path: "themes" }] }]);
        expect(merged).toHaveLength(3);
    });

    test("verifies all registered upstream patch files exist on disk and align with supdance/config/baseline.json", () => {
        const repoRoot = resolve(import.meta.dir, "../..");
        expect(SUPDANCE_UPSTREAM_PATCH_REGISTRY.length).toBeGreaterThan(0);
        const registryCoupled = new Set<string>();
        for (const record of SUPDANCE_UPSTREAM_PATCH_REGISTRY) {
            for (const relPath of record.files) {
                expect(existsSync(resolve(repoRoot, relPath))).toBe(true);
            }
            for (const coupled of record.coupledUpstreamFiles) {
                registryCoupled.add(coupled);
            }
        }
        const baselineConfig = JSON.parse(readFileSync(resolve(repoRoot, "supdance/config/baseline.json"), "utf8")) as {
            coupledUpstreamFiles: string[];
        };
        expect([...registryCoupled].sort()).toEqual([...baselineConfig.coupledUpstreamFiles].sort());
    });
});

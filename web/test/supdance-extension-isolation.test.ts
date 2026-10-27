import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DEFAULT_CLASSIC_SKIN, getSkinAntOverrides } from "@/lib/skin-themes";
import { getRegisteredPlugin } from "@/lib/plugins/plugin-registry";
import type { PluginManifestV2, RegisteredPlugin } from "@/lib/plugins/plugin-types";
import {
    applySupDanceTheme,
    createSupDanceSkinDefinition,
    DEFAULT_SUPDANCE_FEATURE_FLAGS,
    mergeSupDanceRoutes,
    registerSupDancePlugin,
    SUPDANCE_BRAND_DEFAULTS,
    SUPDANCE_RESERVED_PLUGIN_PREFIX,
    SUPDANCE_SKIN_ID,
    SUPDANCE_UPSTREAM_PATCH_REGISTRY,
    unregisterSupDancePlugin,
    validateSupDancePluginManifest,
} from "@/supdance";

const TEST_PLUGIN_ID = "supdance-test-extension";

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
    test("rejects custom plugins without supdance- prefix or with invalid semver", () => {
        const badManifest: PluginManifestV2 = {
            apiVersion: "yingce.plugin/v2",
            id: "custom-plugin-no-prefix",
            name: "Bad Prefix",
            version: "invalid-semver",
            description: "test",
            permissions: ["canvas.read", "canvas.read"],
            contributes: { aiCapabilities: ["test"] },
        };
        const report = validateSupDancePluginManifest(badManifest);
        expect(report.compatible).toBe(false);
        expect(report.errors.some((e) => e.includes(SUPDANCE_RESERVED_PLUGIN_PREFIX))).toBe(true);
        expect(report.errors.some((e) => e.includes("SemVer"))).toBe(true);
        expect(report.errors.some((e) => e.includes("重复"))).toBe(true);
    });

    test("registers and unregisters compliant SupDance plugin cleanly", () => {
        const plugin: RegisteredPlugin = {
            manifest: {
                apiVersion: "yingce.plugin/v2",
                id: TEST_PLUGIN_ID,
                name: "SupDance Test Extension",
                version: "0.1.0",
                description: "Test plugin",
                permissions: ["canvas.read"],
                contributes: { aiCapabilities: [TEST_PLUGIN_ID] },
            },
        };
        registerSupDancePlugin(plugin);
        expect(getRegisteredPlugin(TEST_PLUGIN_ID)?.manifest.version).toBe("0.1.0");

        unregisterSupDancePlugin(TEST_PLUGIN_ID);
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
            const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PluginManifestV2;
            const report = validateSupDancePluginManifest(manifest, upstreamIds);
            expect(report.compatible).toBe(true);
            expect(report.errors).toEqual([]);
        }
    });
});

describe("SupDance route & patch registry guards", () => {
    test("prevents SupDance custom routes from shadowing upstream routes", () => {
        const upstream = [{ path: "/canvas" }, { path: "/admin", children: [{ path: "plugins" }] }];
        expect(() => mergeSupDanceRoutes(upstream, [{ path: "/canvas" }])).toThrow(/冲突/);
        expect(() => mergeSupDanceRoutes(upstream, [{ path: "/admin/plugins" }])).toThrow(/冲突/);

        const merged = mergeSupDanceRoutes(upstream, [{ path: "/supdance/studio" }]);
        expect(merged).toHaveLength(3);
    });

    test("verifies all registered upstream patch files exist on disk", () => {
        const repoRoot = resolve(import.meta.dir, "../..");
        expect(SUPDANCE_UPSTREAM_PATCH_REGISTRY.length).toBeGreaterThan(0);
        for (const record of SUPDANCE_UPSTREAM_PATCH_REGISTRY) {
            for (const relPath of record.files) {
                expect(existsSync(resolve(repoRoot, relPath))).toBe(true);
            }
        }
    });
});

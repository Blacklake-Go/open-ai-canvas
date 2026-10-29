import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getRegisteredPlugin } from "@/lib/plugins/plugin-registry";
import type { PluginHostContext, PluginManifestV2, RegisteredPlugin } from "@/lib/plugins/plugin-types";
import {
    activateSupDancePluginSafely,
    deactivateSupDancePluginSafely,
    mergeSupDanceRoutes,
    registerSupDancePlugin,
    SUPDANCE_HOST_VERSION,
    SUPDANCE_RESERVED_PLUGIN_PREFIX,
    unregisterSupDancePlugin,
    upgradeSupDancePlugin,
    validateSupDancePluginManifest,
} from "@/supdance";

const MUSIC_PLUGIN_ID = "supdance-music-generation";

function createMockHostContext(manifest: PluginManifestV2): PluginHostContext {
    const memoryStorage = new Map<string, unknown>();
    return {
        manifest,
        permissions: new Set(manifest.permissions),
        storage: {
            get: async (key: string) => memoryStorage.get(key) ?? null,
            set: async (key: string, value: unknown) => {
                memoryStorage.set(key, value);
            },
            remove: async (key: string) => {
                memoryStorage.delete(key);
            },
        },
        config: {},
    };
}

describe("SupDance Music Generation Plugin Lifecycle & Manifest V2 Conformance", () => {
    let rawManifest: PluginManifestV2 & { minHostVersion?: string };

    beforeEach(() => {
        const repoRoot = resolve(import.meta.dir, "../..");
        const manifestPath = resolve(repoRoot, "supdance/plugins/supdance-music-generation/manifest.json");
        expect(existsSync(manifestPath)).toBe(true);
        rawManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    });

    afterEach(() => {
        unregisterSupDancePlugin(MUSIC_PLUGIN_ID);
    });

    test("verifies Manifest V2 contract, naming prefix, and compatibility constraints", () => {
        expect(rawManifest.id).toBe(MUSIC_PLUGIN_ID);
        expect(rawManifest.id.startsWith(SUPDANCE_RESERVED_PLUGIN_PREFIX)).toBe(true);
        expect(rawManifest.apiVersion).toBe("yingce.plugin/v2");
        expect(rawManifest.version).toMatch(/^\d+\.\d+\.\d+/);
        expect(rawManifest.minHostVersion).toBeDefined();
        expect(rawManifest.surfaces).toContain("fullscreen");
        expect(rawManifest.surfaces).toContain("settings");
        expect(rawManifest.permissions).toContain("canvas.read");
        expect(rawManifest.permissions).toContain("generation.run");
        expect(rawManifest.contributes?.aiCapabilities).toContain("music-generation");

        const validationReport = validateSupDancePluginManifest(rawManifest, new Set(), SUPDANCE_HOST_VERSION);
        expect(validationReport.compatible).toBe(true);
        expect(validationReport.errors).toHaveLength(0);
    });

    test("registers music plugin, activates safely, and verifies lifecycle events", async () => {
        let activated = false;
        let deactivated = false;

        const musicPlugin: RegisteredPlugin = {
            manifest: rawManifest,
            activate: () => {
                activated = true;
            },
            deactivate: () => {
                deactivated = true;
            },
        };

        registerSupDancePlugin(musicPlugin);
        const registered = getRegisteredPlugin(MUSIC_PLUGIN_ID);
        expect(registered).toBeDefined();
        expect(registered?.manifest.id).toBe(MUSIC_PLUGIN_ID);

        const ctx = createMockHostContext(rawManifest);
        const actResult = await activateSupDancePluginSafely(MUSIC_PLUGIN_ID, ctx);
        expect(actResult.ok).toBe(true);
        expect(activated).toBe(true);

        const deactResult = await deactivateSupDancePluginSafely(MUSIC_PLUGIN_ID, ctx);
        expect(deactResult.ok).toBe(true);
        expect(deactivated).toBe(true);
    });

    test("isolates activation error and unregisters faulty music plugin without crashing host", async () => {
        const faultyPlugin: RegisteredPlugin = {
            manifest: {
                ...rawManifest,
                id: "supdance-music-faulty",
            },
            activate: () => {
                throw new Error("Koyosim connection timeout during plugin bootstrap");
            },
        };

        registerSupDancePlugin(faultyPlugin);
        const ctx = createMockHostContext(faultyPlugin.manifest as PluginManifestV2);
        const result = await activateSupDancePluginSafely("supdance-music-faulty", ctx);

        expect(result.ok).toBe(false);
        expect(result.error).toContain("Koyosim connection timeout");
        // Must be unregistered to isolate host
        expect(getRegisteredPlugin("supdance-music-faulty")).toBeUndefined();
    });

    test("smoothly upgrades plugin version while retaining state", async () => {
        let oldDeactivated = false;
        const v1Plugin: RegisteredPlugin = {
            manifest: { ...rawManifest, version: "1.0.0" },
            deactivate: () => {
                oldDeactivated = true;
            },
        };
        registerSupDancePlugin(v1Plugin);

        const ctx = createMockHostContext(v1Plugin.manifest as PluginManifestV2);
        const v2Manifest = { ...rawManifest, version: "1.1.0" };
        const upgradeResult = await upgradeSupDancePlugin({ manifest: v2Manifest }, { context: ctx });

        expect(oldDeactivated).toBe(true);
        expect(upgradeResult.previousVersion).toBe("1.0.0");
        expect(upgradeResult.currentVersion).toBe("1.1.0");
        expect(getRegisteredPlugin(MUSIC_PLUGIN_ID)?.manifest.version).toBe("1.1.0");

        // Reject downgrade
        await expect(
            upgradeSupDancePlugin({ manifest: { ...rawManifest, version: "1.0.0" } }, { context: ctx })
        ).rejects.toThrow(/必须高于当前已安装版本/);
    });

    test("guards against route collision when mounting /toolbox/music studio route", () => {
        const upstreamRoutes = [
            { path: "/toolbox/image" },
            { path: "/toolbox/video" },
            { path: "/tasks" },
        ];

        // Should successfully mount /toolbox/music
        const customMusicRoutes = [{ path: "/toolbox/music" }];
        const merged = mergeSupDanceRoutes(upstreamRoutes, customMusicRoutes);
        expect(merged).toHaveLength(4);

        // Should reject if music plugin tries to shadow an existing route
        expect(() => mergeSupDanceRoutes(upstreamRoutes, [{ path: "/toolbox/image" }])).toThrow(/冲突/);
        expect(() => mergeSupDanceRoutes(upstreamRoutes, [{ path: "/tasks/" }])).toThrow(/冲突/);
    });
});

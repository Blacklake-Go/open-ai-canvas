import { describe, expect, test } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
    SUPDANCE_HOST_VERSION,
    type SupDancePluginManifest,
    validateSupDancePluginManifest,
} from "@/supdance";

describe("Challenger 2: Manifest V2 Adversarial Schema and Permission Conformance", () => {
    const manifestPath = resolve(import.meta.dir, "../../supdance/plugins/supdance-music-generation/manifest.json");

    test("Verifies physical manifest file exists on disk and parses correctly", () => {
        expect(existsSync(manifestPath)).toBe(true);
        const rawContent = readFileSync(manifestPath, "utf8");
        expect(() => JSON.parse(rawContent)).not.toThrow();
    });

    test("Verifies physical manifest conforms strictly to validateSupDancePluginManifest", () => {
        const rawContent = readFileSync(manifestPath, "utf8");
        const manifest = JSON.parse(rawContent) as SupDancePluginManifest;

        const upstreamIds = new Set<string>(["existing-upstream-plugin"]);
        const report = validateSupDancePluginManifest(manifest, upstreamIds, SUPDANCE_HOST_VERSION);

        expect(report.compatible).toBe(true);
        expect(report.errors).toHaveLength(0);
    });

    test("Verifies permission list remains strictly bounded without privilege escalation", () => {
        const rawContent = readFileSync(manifestPath, "utf8");
        const manifest = JSON.parse(rawContent) as SupDancePluginManifest;

        // Must declare required runtime permissions
        expect(manifest.permissions).toBeArray();
        expect(manifest.permissions.length).toBeGreaterThan(0);

        // Disallow dangerous privilege escalation permissions
        const prohibitedPermissions = [
            "system.admin",
            "user.manage",
            "database.direct",
            "plugin.install",
            "plugin.uninstall",
            "fs.root",
            "network.raw",
        ];

        for (const forbidden of prohibitedPermissions) {
            expect(manifest.permissions).not.toContain(forbidden as any);
        }

        // Verify zero duplicate permissions
        const uniqueSet = new Set(manifest.permissions);
        expect(uniqueSet.size).toBe(manifest.permissions.length);
    });

    test("Verifies metadata integrity and contract attributes", () => {
        const rawContent = readFileSync(manifestPath, "utf8");
        const manifest = JSON.parse(rawContent) as Record<string, any>;

        expect(manifest.apiVersion).toBe("yingce.plugin/v2");
        expect(manifest.id).toBe("supdance-music-generation");
        expect(manifest.version).toBe("1.0.0");
        expect(manifest.minHostVersion).toBe("1.7.1");

        // Surface bindings must be valid
        expect(manifest.surfaces).toBeArray();
        expect(manifest.surfaces).toContain("fullscreen");
        expect(manifest.surfaces).toContain("settings");

        // Commands must use namespaced IDs
        expect(manifest.contributes).toBeDefined();
        expect(manifest.contributes.commands).toBeArray();
        for (const cmd of manifest.contributes.commands) {
            expect(cmd.id).toStartWith("supdance-music-generation.");
        }

        // AI capabilities must include music-generation
        expect(manifest.contributes.aiCapabilities).toContain("music-generation");
    });
});

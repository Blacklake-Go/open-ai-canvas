import { describe, expect, test } from "bun:test";
import {
    compareSemVer,
    SUPDANCE_HOST_VERSION,
    type SupDancePluginManifest,
    validateSupDancePluginManifest,
} from "@/supdance";

describe("Adversarial Manifest Validation Harness (validateSupDancePluginManifest)", () => {
    const validBaseManifest: SupDancePluginManifest = {
        id: "supdance-music-generation",
        name: "Music Generation",
        description: "AI Music Plugin",
        version: "1.0.0",
        apiVersion: "yingce.plugin/v2",
        minHostVersion: "1.7.1",
        surfaces: ["fullscreen", "settings"],
        permissions: ["canvas.read", "generation.run"],
    };

    test("Challenge 3.1: Validates compliant base manifest without errors", () => {
        const report = validateSupDancePluginManifest(validBaseManifest, new Set(), SUPDANCE_HOST_VERSION);
        expect(report.compatible).toBe(true);
        expect(report.errors).toHaveLength(0);
    });

    test("Challenge 3.2: Rejects diverse invalid SemVer formats", () => {
        const invalidVersions = [
            "1.0",
            "v1.0.0",
            "1.0.0.0",
            "alpha-release",
            "1.0.0-",
            "",
            "1.0.0+20130313144700", // Semver build metadata not supported by strict SEMVER_REGEX
        ];

        for (const version of invalidVersions) {
            const report = validateSupDancePluginManifest(
                { ...validBaseManifest, version },
                new Set(),
                SUPDANCE_HOST_VERSION
            );
            expect(report.compatible).toBe(false);
            expect(report.errors.some((e) => e.includes("必须遵循 SemVer"))).toBe(true);
        }

        // Valid semver formats with pre-release tags should pass
        const validVersions = ["1.0.0", "1.0.0-beta.1", "2.14.3-rc.0"];
        for (const version of validVersions) {
            const report = validateSupDancePluginManifest(
                { ...validBaseManifest, version },
                new Set(),
                SUPDANCE_HOST_VERSION
            );
            expect(report.compatible).toBe(true);
        }
    });

    test("Challenge 3.3: Rejects duplicate permissions strictly", () => {
        const duplicateCases = [
            ["canvas.read", "canvas.read"],
            ["canvas.read", "generation.run", "canvas.read"],
            ["asset.read", "asset.read", "asset.read"],
        ];

        for (const permissions of duplicateCases) {
            const report = validateSupDancePluginManifest(
                { ...validBaseManifest, permissions: permissions as any },
                new Set(),
                SUPDANCE_HOST_VERSION
            );
            expect(report.compatible).toBe(false);
            expect(report.errors).toContain("插件权限声明包含重复项");
        }

        // Empty permissions array is valid
        const emptyPermReport = validateSupDancePluginManifest(
            { ...validBaseManifest, permissions: [] },
            new Set(),
            SUPDANCE_HOST_VERSION
        );
        expect(emptyPermReport.compatible).toBe(true);
    });

    test("Challenge 3.4: Rejects non-kebab-case and prefix-violating plugin IDs", () => {
        const invalidIds = [
            { id: "supdance_music_generation", reason: "underscore" },
            { id: "supdance-Music-Generation", reason: "uppercase" },
            { id: "supdance--music", reason: "consecutive hyphens" },
            { id: "supdance-music-", reason: "trailing hyphen" },
            { id: "-supdance-music", reason: "leading hyphen" },
            { id: "music-generation", reason: "missing supdance- prefix" },
            { id: "supdance-", reason: "missing name after prefix" },
            { id: "supdance-music@gen", reason: "illegal character" },
        ];

        for (const { id } of invalidIds) {
            const report = validateSupDancePluginManifest(
                { ...validBaseManifest, id },
                new Set(),
                SUPDANCE_HOST_VERSION
            );
            expect(report.compatible).toBe(false);
            expect(report.errors.length).toBeGreaterThan(0);
        }

        // Valid kebab-case with numbers is accepted
        const validReport = validateSupDancePluginManifest(
            { ...validBaseManifest, id: "supdance-music-v2-4" },
            new Set(),
            SUPDANCE_HOST_VERSION
        );
        expect(validReport.compatible).toBe(true);
    });

    test("Challenge 3.5: Enforces minHostVersion comparison against host version", () => {
        // Higher minHostVersion than host (1.7.1)
        const tooHighReport = validateSupDancePluginManifest(
            { ...validBaseManifest, minHostVersion: "2.0.0" },
            new Set(),
            "1.7.1"
        );
        expect(tooHighReport.compatible).toBe(false);
        expect(tooHighReport.errors.some((e) => e.includes("低于插件要求的最低兼容版本"))).toBe(true);

        // Equal host version
        const equalReport = validateSupDancePluginManifest(
            { ...validBaseManifest, minHostVersion: "1.7.1" },
            new Set(),
            "1.7.1"
        );
        expect(equalReport.compatible).toBe(true);

        // Lower host requirement than host version
        const lowerReport = validateSupDancePluginManifest(
            { ...validBaseManifest, minHostVersion: "1.0.0" },
            new Set(),
            "1.7.1"
        );
        expect(lowerReport.compatible).toBe(true);

        // Malformed minHostVersion
        const badMinReport = validateSupDancePluginManifest(
            { ...validBaseManifest, minHostVersion: "invalid-semver" },
            new Set(),
            "1.7.1"
        );
        expect(badMinReport.compatible).toBe(false);
        expect(badMinReport.errors.some((e) => e.includes("必须遵循 SemVer"))).toBe(true);
    });

    test("Challenge 3.6: Enforces apiVersion contract and prevents collision", () => {
        const invalidApiVersions = ["yingce.plugin/v3", "v2", "1.0", ""];
        for (const apiVersion of invalidApiVersions) {
            const report = validateSupDancePluginManifest(
                { ...validBaseManifest, apiVersion: apiVersion as any },
                new Set(),
                SUPDANCE_HOST_VERSION
            );
            expect(report.compatible).toBe(false);
            expect(report.errors.some((e) => e.includes("不支持的宿主 apiVersion"))).toBe(true);
        }

        // Collision check
        const existingIds = new Set(["supdance-music-generation"]);
        const collisionReport = validateSupDancePluginManifest(
            validBaseManifest,
            existingIds,
            SUPDANCE_HOST_VERSION
        );
        expect(collisionReport.compatible).toBe(false);
        expect(collisionReport.errors.some((e) => e.includes("与现有插件冲突"))).toBe(true);
    });

    test("Challenge 3.7: Exposes uncaught exception risk on missing permissions property", () => {
        // Defensive check: if manifest is missing permissions array altogether,
        // validateSupDancePluginManifest throws a TypeError instead of returning a clean error report.
        const malformedManifest = {
            id: "supdance-no-perm",
            version: "1.0.0",
            apiVersion: "yingce.plugin/v2",
        } as unknown as SupDancePluginManifest;

        expect(() => {
            validateSupDancePluginManifest(malformedManifest, new Set(), SUPDANCE_HOST_VERSION);
        }).toThrow();
    });
});

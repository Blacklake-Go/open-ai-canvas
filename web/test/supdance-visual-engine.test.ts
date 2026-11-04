import { describe, expect, it } from "bun:test";

import { DEFAULT_VISUAL_ENGINE_CONFIG, BUILTIN_THEME_PRESETS } from "@/supdance/plugins/visual-engine/config/default-config";
import { validateVisualEngineConfig } from "@/supdance/plugins/visual-engine/config/schema";
import { generateVisualEngineCSSVariables } from "@/supdance/plugins/visual-engine/themes/css-variables";
import { calculateContrastRatio, evaluateContrastCompliance } from "@/supdance/plugins/visual-engine/themes/contrast-checker";
import { getNextRecoveryStage, getStageCopy } from "@/supdance/plugins/visual-engine/loading/stage-state-machine";
import { matchPathPattern, findMatchingPageRule } from "@/supdance/plugins/visual-engine/page-rules/rule-matcher";
import { MOTION_DURATIONS } from "@/supdance/plugins/visual-engine/motion/motion-constants";
import { supdanceVisualEngineManifest } from "@/supdance/plugins/visual-engine/index";
import { resolvePageVisualPolicy } from "@/supdance/plugins/visual-engine/page-rules/page-rules-engine";

describe("SupDance Visual Engine V2.0", () => {
    it("ships four built-in presets including a native host baseline", () => {
        const presetIds = BUILTIN_THEME_PRESETS.map((preset) => preset.id);
        expect(presetIds).toContain("native");
        expect(presetIds).toContain("dark");
        expect(presetIds).toContain("light");
        expect(presetIds).toContain("studio");
    });

    it("keeps the light theme as an independently designed token set rather than a dark inversion", () => {
        const dark = DEFAULT_VISUAL_ENGINE_CONFIG.tokens.dark;
        const light = DEFAULT_VISUAL_ENGINE_CONFIG.tokens.light;
        expect(light.canvas).not.toBe(dark.canvas);
        expect(light.text).not.toBe(dark.text);
        expect(light.border).not.toBe(dark.border);
        // Light mode body text on the light canvas must satisfy WCAG AA for normal text.
        const bodyRatio = calculateContrastRatio(light.text, light.canvas);
        expect(evaluateContrastCompliance(bodyRatio).aaNormalText).toBe(true);
    });

    it("generates scoped CSS variables for both dark and light modes from one config", () => {
        const darkVars = generateVisualEngineCSSVariables(DEFAULT_VISUAL_ENGINE_CONFIG, "dark");
        const lightVars = generateVisualEngineCSSVariables(DEFAULT_VISUAL_ENGINE_CONFIG, "light");
        expect(darkVars["--primary"]).toBe(DEFAULT_VISUAL_ENGINE_CONFIG.tokens.dark.primary);
        expect(lightVars["--primary"]).toBe(DEFAULT_VISUAL_ENGINE_CONFIG.tokens.light.primary);
        expect(darkVars["--canvas"]).not.toBe(lightVars["--canvas"]);
        expect(darkVars["--motion-quick"]).toBe("0ms");
        expect(MOTION_DURATIONS.quick).toBe(0.15);
    });

    it("keeps page overrides below the global motion switch", () => {
        const config = structuredClone(DEFAULT_VISUAL_ENGINE_CONFIG);
        expect(config.motion.enabled).toBe(false);
        for (const mode of ["light", "dark"] as const) {
            const disabled = resolvePageVisualPolicy("/create/image", config, mode);
            expect(disabled.motionEnabled).toBe(false);
            expect(disabled.recoveryEnabled).toBe(false);
            config.motion.enabled = true;
            const enabled = resolvePageVisualPolicy("/create/image", config, mode);
            expect(enabled.motionEnabled).toBe(true);
            expect(enabled.recoveryEnabled).toBe(true);
            config.motion.enabled = false;
        }
    });

    it("rejects malformed configs during schema validation", () => {
        const result = validateVisualEngineConfig({ tokens: { dark: { primary: "not-a-color" } } });
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        // The fallback config must always remain usable.
        expect(result.config.tokens.dark.primary).toBe(DEFAULT_VISUAL_ENGINE_CONFIG.tokens.dark.primary);
    });

    it("walks the workspace recovery state machine through all five stages", () => {
        // Happy path: init -> recovering -> syncing -> ready
        let stage = getNextRecoveryStage("init", { type: "START" });
        expect(stage).toBe("recovering");
        stage = getNextRecoveryStage(stage, { type: "PROJECTS_SYNCED" });
        expect(stage).toBe("syncing");
        stage = getNextRecoveryStage(stage, { type: "APP_READY" });
        expect(stage).toBe("ready");
        // Terminal ready state must not silently regress.
        expect(getNextRecoveryStage("ready", { type: "APP_READY" })).toBe("ready");

        // Failure path with explicit retry back to init.
        const failed = getNextRecoveryStage("recovering", { type: "TIMEOUT" });
        expect(failed).toBe("failed");
        expect(getNextRecoveryStage("failed", { type: "RETRY" })).toBe("init");

        // Stage copy resolves against the configurable workspace recovery contract.
        const copy = getStageCopy("syncing", DEFAULT_VISUAL_ENGINE_CONFIG.workspaceRecovery);
        expect(copy.title).toBe(DEFAULT_VISUAL_ENGINE_CONFIG.workspaceRecovery.statusCopies.syncing);
        expect(copy.detail.length).toBeGreaterThan(0);
    });

    it("matches page rules with wildcard paths and returns the most specific rule first", () => {
        expect(matchPathPattern("/admin/*", "/admin/plugins/visual-engine")).toBe(true);
        expect(matchPathPattern("/admin/*", "/canvas/board")).toBe(false);
        expect(matchPathPattern("/projects", "/projects")).toBe(true);

        const rule = findMatchingPageRule("/admin/plugins/visual-engine", DEFAULT_VISUAL_ENGINE_CONFIG.pageRules);
        expect(rule?.id).toBe("rule-admin-isolation");
    });

    it("declares the plugin manifest required for dual-entry lifecycle management", () => {
        expect(supdanceVisualEngineManifest.id).toBe("supdance-visual-engine");
        expect(supdanceVisualEngineManifest.version).toBe("2.0.1");
        expect(supdanceVisualEngineManifest.contributes?.commands?.length).toBeGreaterThanOrEqual(2);
    });
});

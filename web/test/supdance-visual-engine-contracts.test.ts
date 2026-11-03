import { describe, expect, it } from "bun:test";
import { DEFAULT_VISUAL_ENGINE_CONFIG as defaults, BUILTIN_THEME_PRESETS } from "../src/supdance/plugins/visual-engine/config/default-config";
import { validateVisualEngineConfig } from "../src/supdance/plugins/visual-engine/config/schema";
import { parseVisualEngineImport } from "../src/supdance/plugins/visual-engine/config/import-config";
import { diffVisualConfig } from "../src/supdance/plugins/visual-engine/config/config-diff";
import { findMatchingPageRule } from "../src/supdance/plugins/visual-engine/page-rules/rule-matcher";
import { transitionFrames, playRouteTransition } from "../src/supdance/plugins/visual-engine/transitions/route-transition";
import { createVisualEngineOverlayStyles } from "../src/supdance/plugins/visual-engine/adapters/overlay-theme";
import { runTokenHealthCheck } from "../src/supdance/plugins/visual-engine/diagnostics/token-health-check";
describe("visual engine production contracts", () => {
    it("round trips extended settings through validated import", () => {
        const config = structuredClone(defaults);
        config.typography.scales.body.size = 16;
        config.typography.scales.body.lineHeight = 24;
        config.workspaceRecovery.animationSpeed = 0.5;
        const parsed = parseVisualEngineImport(JSON.stringify(config));
        expect(parsed.config.typography.scales.body.size).toBe(16);
        expect(parsed.config.workspaceRecovery.animationSpeed).toBe(0.5);
        expect(diffVisualConfig(defaults, parsed.config).map((item) => item.field)).toContain("typography.scales.body.size");
    });
    it("rejects malformed objects without crashing or silently accepting scripts", () => {
        for (const value of [null, [], { ...defaults, customPresets: "script" }, { ...defaults, tokens: { dark: {}, light: {} } }, { ...defaults, workspaceRecovery: { ...defaults.workspaceRecovery, brandLogoUrl: "//evil.test/logo.svg" } }])
            expect(validateVisualEngineConfig(value).valid).toBe(false);
        expect(() => parseVisualEngineImport("export default ()=>alert(1)")).toThrow();
        expect(() => parseVisualEngineImport(" ".repeat(1024 * 1024 + 1))).toThrow();
    });
    it("rejects invalid easing, unsafe shadows and out of range page overrides", () => {
        for (const mutate of [
            (config: typeof defaults) => {
                config.motion.easingStandard = "cubic-bezier(3,0,0,1)";
            },
            (config: typeof defaults) => {
                config.elevations.E2.shadowDark = "url(https://evil.test)";
            },
            (config: typeof defaults) => {
                config.pageRules = [{ id: "invalid", name: "invalid", pathPattern: "/projects", components: { ...config.components, inputHeight: 0 } }];
            },
        ]) {
            const config = structuredClone(defaults);
            mutate(config);
            expect(validateVisualEngineConfig(config).valid).toBe(false);
        }
    });
    it("chooses exact routes before prefixes independent of order", () => {
        const rules = [
            { id: "all", name: "all", pathPattern: "/*" },
            { id: "projects", name: "projects", pathPattern: "/projects/*" },
            { id: "exact", name: "exact", pathPattern: "/projects/current" },
        ];
        expect(findMatchingPageRule("/projects/current", rules)?.id).toBe("exact");
        expect(findMatchingPageRule("/projects/other", rules)?.id).toBe("projects");
    });
    it("removes displacement in reduced motion and cancels active animations", () => {
        const config = { ...defaults.transitions, enabled: true, preset: "slide" as const };
        expect(transitionFrames(config, true)[0].transform).toBeUndefined();
        let cancelled = false;
        const cancel = playRouteTransition(
            {
                animate: () => ({
                    cancel: () => {
                        cancelled = true;
                    },
                }),
            } as unknown as HTMLElement,
            config,
            false,
            "linear",
        );
        cancel();
        expect(cancelled).toBe(true);
        expect(() =>
            playRouteTransition(
                {
                    animate: () => {
                        throw Error("unsupported");
                    },
                } as unknown as HTMLElement,
                config,
                false,
                "bad",
            ),
        ).not.toThrow();
    });
    it("applies real modal blur and separate drawer mask opacity", () => {
        const modal = createVisualEngineOverlayStyles(defaults, "dark", "modal"),
            drawer = createVisualEngineOverlayStyles(defaults, "light", "drawer");
        expect(modal.mask.backdropFilter).toBe("blur(8px)");
        expect(drawer.mask.backgroundColor).toContain("0.5");
        expect(modal.container.boxShadow).toBe(defaults.elevations.E3.shadowDark);
    });

    it("manages simplified model picker configuration and schema validation", () => {
        expect(defaults.modelPicker.simplified).toBe(true);
        expect(defaults.modelPicker.hideChannelMeta).toBe(true);
        expect(defaults.modelPicker.hideTelemetry).toBe(true);
        expect(defaults.modelPicker.cleanCardLayout).toBe(true);

        const invalid = structuredClone(defaults);
        // @ts-expect-error test invalid type
        invalid.modelPicker.simplified = "yes";
        expect(validateVisualEngineConfig(invalid).valid).toBe(false);
    });

    for (const preset of BUILTIN_THEME_PRESETS)
        for (const mode of ["light", "dark"] as const)
            it(preset.id + " " + mode + " default contrast", () => {
                expect(runTokenHealthCheck({ ...defaults, tokens: preset.tokens }, mode).pass).toBe(true);
            });
});

import type { CanvasTheme } from "@/lib/canvas-theme";
import type { VisualEngineConfig, SemanticTokens } from "../types";
export function createVisualEngineCanvasTheme(base: CanvasTheme, config: VisualEngineConfig, mode: "light" | "dark", tokens: SemanticTokens = config.tokens[mode]): CanvasTheme {
    const shadows = config.elevations,
        property = mode === "dark" ? "shadowDark" : "shadowLight";
    return {
        ...base,
        canvas: {
            ...base.canvas,
            background: tokens.canvas,
            selectionFill:
                (tokens.selected.length === 4
                    ? "#" +
                      tokens.selected
                          .slice(1)
                          .split("")
                          .map((char) => char + char)
                          .join("")
                    : tokens.selected) + "26",
        },
        node: {
            ...base.node,
            fill: tokens.surface,
            panel: tokens.surfaceRaised,
            stroke: tokens.border,
            text: tokens.text,
            muted: tokens.textMuted,
            faint: tokens.textMuted,
            label: tokens.textMuted,
            placeholder: tokens.textMuted,
            agentUserMessage: tokens.surfaceSubtle,
            activeStroke: tokens.controlFocus,
            shadow: shadows.E1[property],
            hoverShadow: shadows.E2[property],
        },
        toolbar: { panel: tokens.surfaceRaised, border: tokens.border, item: tokens.textMuted, itemHover: tokens.controlHover, activeBg: tokens.selected, activeText: tokens.selectedForeground },
        accent: { ...base.accent, primary: tokens.primary, primarySoft: tokens.selected, onPrimary: tokens.primaryForeground, danger: tokens.danger },
        spatial: { ...base.spatial, surface: tokens.surface, elevated: tokens.overlay, dropzone: tokens.surfaceSubtle },
        frame: { ...base.frame, stroke: tokens.border, activeStroke: tokens.controlFocus },
        timeline: { ...base.timeline, trackFill: tokens.surfaceSubtle, trackBorder: tokens.border, rulerLabel: tokens.textMuted, playhead: tokens.primary, clipSelectedBorder: tokens.controlFocus },
    };
}

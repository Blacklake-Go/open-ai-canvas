import type { VisualEngineConfig, SemanticTokens } from "../types";

export function generateVisualEngineCSSVariables(
    config: VisualEngineConfig,
    mode: "light" | "dark",
    customTokens?: Partial<SemanticTokens>,
): Record<string, string> {
    const tokens: SemanticTokens = {
        ...config.tokens[mode],
        ...(customTokens || {}),
    };
    const comp = config.components;
    const elev = config.elevations;
    const overlays = config.overlays;
    const motion = config.motion;

    const shadowProp = mode === "light" ? "shadowLight" : "shadowDark";

    return {
        // Semantic Canvas & Surface
        "--background": tokens.canvas,
        "--foreground": tokens.text,
        "--canvas": tokens.canvas,
        "--surface": tokens.surface,
        "--surface-subtle": tokens.surfaceSubtle,
        "--surface-raised": tokens.surfaceRaised,
        "--surface-hover": tokens.controlHover,
        "--surface-active": tokens.controlActive,
        "--card": tokens.surface,
        "--card-foreground": tokens.text,
        "--card-surface": tokens.surfaceSubtle,
        "--card-surface-hover": tokens.controlHover,
        "--card-surface-raised": tokens.surfaceRaised,
        "--popover": tokens.overlay,
        "--popover-foreground": tokens.text,

        // Primary Branding
        "--primary": tokens.primary,
        "--primary-hover": tokens.primaryHover,
        "--primary-active": tokens.primaryActive,
        "--primary-foreground": tokens.primaryForeground,
        "--button-primary-bg": tokens.primary,
        "--button-primary-hover-bg": tokens.primaryHover,
        "--button-primary-active-bg": tokens.primaryActive,
        "--button-primary-fg": tokens.primaryForeground,
        "--btn-solid-bg": tokens.primary,
        "--btn-solid-hover-bg": tokens.primaryHover,
        "--btn-solid-active-bg": tokens.primaryActive,
        "--btn-solid-fg": tokens.primaryForeground,

        // Secondary / Muted
        "--secondary": tokens.surfaceSubtle,
        "--secondary-foreground": tokens.text,
        "--muted": tokens.surfaceSubtle,
        "--muted-foreground": tokens.textMuted,
        "--text-primary": tokens.text,
        "--text-secondary": tokens.textMuted,

        // Controls, Borders & Selection
        "--border": tokens.border,
        "--input": tokens.controlBorder,
        "--ring": tokens.controlFocus,
        "--control-border": tokens.controlBorder,
        "--control-focus": tokens.controlFocus,
        "--control-selected-bg": tokens.selected,
        "--control-selected-hover-bg": tokens.selectedHover,
        "--control-selected-active-bg": tokens.selectedActive,
        "--control-selected-fg": tokens.selectedForeground,
        "--selected": tokens.selected,
        "--selected-hover": tokens.selectedHover,
        "--selected-active": tokens.selectedActive,
        "--selected-foreground": tokens.selectedForeground,

        // State Semantics
        "--destructive": tokens.danger,
        "--destructive-hover": tokens.dangerHover,
        "--destructive-active": tokens.dangerActive,
        "--destructive-foreground": tokens.dangerForeground,
        "--palette-status-error": tokens.danger,
        "--palette-status-success": tokens.success,
        "--palette-status-warning": tokens.warning,
        "--palette-status-info": tokens.info,

        // Component Geometry
        "--radius-btn": `${comp.buttonRadius}px`,
        "--radius-input": `${comp.inputRadius}px`,
        "--radius-card": `${comp.cardRadius}px`,
        "--radius-overlay": `${comp.overlayRadius}px`,
        "--radius-menu": `${comp.menuRadius}px`,
        "--radius-tag": `${comp.tagRadius}px`,
        "--height-btn-regular": `${comp.buttonHeightRegular}px`,
        "--height-btn-compact": `${comp.buttonHeightCompact}px`,
        "--height-btn-micro": `${comp.buttonHeightMicro}px`,
        "--height-input": `${comp.inputHeight}px`,

        // E0–E4 Elevation Depth
        "--elevation-e0": elev.E0[shadowProp],
        "--elevation-e1": elev.E1[shadowProp],
        "--elevation-e2": elev.E2[shadowProp],
        "--elevation-e3": elev.E3[shadowProp],
        "--elevation-e4": elev.E4[shadowProp],

        // Overlays & Backdrop Blurs
        "--backdrop-blur-modal": `${overlays.modalBackdropBlur}px`,
        "--backdrop-opacity-modal": `${overlays.modalBackdropOpacity}`,
        "--backdrop-blur-drawer": `${overlays.drawerBackdropBlur}px`,
        "--backdrop-opacity-drawer": `${overlays.drawerBackdropOpacity}`,
        "--backdrop-blur-menu": `${overlays.menuBackdropBlur}px`,

        // Motion Engine
        "--motion-quick": `${motion.durationQuick}ms`,
        "--motion-dropdown-enter": `${motion.durationDropdownEnter}ms`,
        "--motion-dropdown-exit": `${motion.durationDropdownExit}ms`,
        "--motion-modal": `${motion.durationModal}ms`,
        "--motion-drawer": `${motion.durationDrawer}ms`,
        "--motion-tab-switch": `${motion.durationTabSwitch}ms`,
        "--motion-ease-standard": motion.easingStandard,
        "--motion-ease-bounce": motion.easingBounce,
        "--motion-ease-smooth": motion.easingSmooth,
    };
}

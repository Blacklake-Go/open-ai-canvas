import type { VisualEngineConfig, SemanticTokens } from "../types";
import { FONT_FAMILIES } from "../config/extended-config";

export function generateVisualEngineCSSVariables(config: VisualEngineConfig, mode: "light" | "dark", customTokens?: Partial<SemanticTokens>): Record<string, string> {
    const tokens: SemanticTokens = {
        ...config.tokens[mode],
        ...(customTokens || {}),
    };
    const comp = config.components;
    const elev = config.elevations;
    const overlays = config.overlays;
    const motion =
        config.motion.enabled && config.interactions.performanceMode !== "low" ? config.motion : { ...config.motion, durationQuick: 0, durationDropdownEnter: 0, durationDropdownExit: 0, durationModal: 0, durationDrawer: 0, durationTabSwitch: 0 };

    const shadowProp = mode === "light" ? "shadowLight" : "shadowDark";

    return {
        "--ve-media-gradient": overlays.enableTextProtectionGradient ? `linear-gradient(transparent,rgba(0,0,0,${overlays.imageGradientOpacity ?? 0.85}))` : "none",
        "--ve-scroll-edge-opacity": String(overlays.scrollEdgeOpacity ?? 0.8),
        "--ve-busy-opacity": String(overlays.busyOpacity ?? 0.65),
        "--ve-menu-blur": `${overlays.menuBackdropBlur}px`,
        ...Object.fromEntries(
            Object.entries(config.typography.scales).flatMap(([name, scale]) => [
                [`--ve-type-${name}-size`, `${scale.size / 16}rem`],
                [`--ve-type-${name}-line`, `${scale.lineHeight / 16}rem`],
                [`--ve-type-${name}-weight`, String(scale.weight)],
            ]),
        ),
        "--ve-font-sans": FONT_FAMILIES[config.typography.fontFamilySans],
        "--ve-font-mono": config.typography.fontFamilyMono === "mono" ? FONT_FAMILIES.mono : "ui-monospace,monospace",
        "--spacing": `${config.typography.spacingUnit / 16}rem`,
        "--ve-focus-width": `${config.interactions.focusWidth}px`,
        "--ve-focus-offset": `${config.interactions.focusOffset}px`,
        "--ve-hover-lift": `-${config.interactions.hoverLift}px`,
        "--ve-pressed-scale": String(config.interactions.pressedScale),
        "--ve-disabled-opacity": String(config.interactions.disabledOpacity),
        "--control-switch-checked-bg": mode === "dark" ? config.interactions.switchOnDark : config.interactions.switchOnLight,
        "--control-check-bg": mode === "dark" ? config.interactions.checkboxDark : config.interactions.checkboxLight,
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
        "--accent": tokens.selected,
        "--accent-foreground": tokens.selectedForeground,
        "--surface-card": tokens.surfaceSubtle,
        "--surface-card-hover": tokens.controlHover,
        "--control-check-fg": mode === "dark" ? "#18181b" : "#ffffff",
        "--control-switch-checked-hover-bg": mode === "dark" ? config.interactions.switchOnDark : config.interactions.switchOnLight,
        "--control-switch-checked-handle": mode === "dark" ? "#0a0a0f" : "#ffffff",
        "--control-disabled-bg": tokens.surfaceSubtle,
        "--control-disabled-fg": tokens.textMuted,
        "--control-focus-ring": tokens.controlFocus,
        "--workspace-surface": tokens.canvas,
        "--workspace-surface-strong": tokens.surfaceRaised,
        "--workspace-border": tokens.border,
        "--workspace-border-strong": tokens.controlBorder,
        "--workspace-accent": tokens.primary,
        "--icon-foreground": tokens.text,
        "--icon-muted": tokens.textMuted,
        "--icon-active": tokens.primary,
        "--r-sm": `${comp.inputRadius}px`,
        "--r-md": `${comp.buttonRadius}px`,
        "--r-lg": `${comp.cardRadius}px`,
        "--r-xl": `${comp.overlayRadius}px`,
        "--r-2xl": `${comp.overlayRadius}px`,
        "--radius": `${comp.buttonRadius / 16}rem`,
        "--control-radius": `${comp.inputRadius}px`,
        "--button-radius": `${comp.buttonRadius}px`,
        "--input-radius": `${comp.inputRadius}px`,
        "--card-radius": `${comp.cardRadius}px`,
        "--overlay-radius": `${comp.overlayRadius}px`,
        "--menu-radius": `${comp.menuRadius}px`,
        "--user-control-height": `${comp.buttonHeightRegular}px`,
        "--user-control-height-sm": `${comp.buttonHeightCompact}px`,
        "--user-radius-button": `${comp.buttonRadius}px`,
        "--focus-ring-width": `${config.interactions.focusWidth}px`,
        "--motion-fast": `${motion.enabled ? motion.durationQuick : 0}ms`,
        "--motion-normal": `${motion.enabled ? motion.durationModal : 0}ms`,

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

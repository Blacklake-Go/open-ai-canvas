import type { VisualEngineConfig } from "../types";
import { useVisualEngineStore } from "../storage/visual-engine-store";
import { getAntThemeConfig } from "@/lib/app-theme";
import type { SkinDefinition } from "@/lib/skin-themes";
import { resolvePageVisualPolicy } from "../page-rules/page-rules-engine";
import type { ThemeConfig } from "antd";
import { allowsVisualTheme, useVisualEngineActive } from "../runtime/visual-engine-activation";
import { useSystemReducedMotion } from "../runtime/use-visual-engine-policy";

export function useVisualEngineHostAdapter(hostMode: "light" | "dark", skin: SkinDefinition, hostTheme?: ThemeConfig) {
    const enabled = useVisualEngineActive();
    const config = useVisualEngineStore((state) => state.config);
    const path = useVisualEngineStore((state) => state.runtimePath);
    const reducedMotion = useSystemReducedMotion();
    const policy = resolvePageVisualPolicy(path, config, hostMode);
    const active = enabled && skin.id === "classic" && allowsVisualTheme(path, config, policy);
    const mode = active && config.themeMode !== "system" ? config.themeMode : hostMode;
    const base = mode === hostMode && hostTheme ? hostTheme : getAntThemeConfig(mode === "dark", skin);
    if (!active) return { mode, theme: base, active: false };
    return { mode, theme: createVisualEngineAntTheme(config, mode, path, base, reducedMotion), active: true };
}

export function createVisualEngineAntTheme(config: VisualEngineConfig, mode: "light" | "dark", path = "/__visual_preview", base: ThemeConfig = getAntThemeConfig(mode === "dark"), reducedMotion = false): ThemeConfig {
    const resolved = resolvePageVisualPolicy(path, config, mode);
    const tokens = resolved.activeTokens;
    const component = resolved.matchedRule?.components ?? config.components;
    const interaction = config.interactions;
    const font = config.typography.scales;
    const check = mode === "dark" ? interaction.checkboxDark : interaction.checkboxLight;
    const switchColor = mode === "dark" ? interaction.switchOnDark : interaction.switchOnLight;
    const overrides: ThemeConfig = {
        token: {
            motionEaseInOut: config.motion.easingStandard,
            motionEaseOut: config.motion.easingSmooth,
            colorPrimary: tokens.primary,
            colorPrimaryHover: tokens.primaryHover,
            colorPrimaryActive: tokens.primaryActive,
            colorText: tokens.text,
            colorTextSecondary: tokens.textMuted,
            colorBgContainer: tokens.surface,
            colorBgElevated: tokens.overlay,
            colorBgLayout: tokens.canvas,
            colorBorder: tokens.controlBorder,
            colorError: tokens.danger,
            colorSuccess: tokens.success,
            colorWarning: tokens.warning,
            colorInfo: tokens.info,
            borderRadius: component.inputRadius,
            fontSize: font.body.size,
            fontSizeSM: font.caption.size,
            fontSizeLG: font.heading.size,
            lineHeight: font.body.lineHeight / font.body.size,
            controlHeight: component.inputHeight,
            controlHeightSM: component.buttonHeightCompact,
            controlOutlineWidth: interaction.focusWidth,
            boxShadowSecondary: config.elevations.E2[mode === "dark" ? "shadowDark" : "shadowLight"],
            motion: resolved.motionEnabled && (resolved.matchedRule?.performanceMode ?? interaction.performanceMode) !== "low" && !reducedMotion,
            motionDurationFast: config.motion.durationQuick / 1000 + "s",
            motionDurationMid: config.motion.durationModal / 1000 + "s",
            motionDurationSlow: config.motion.durationDrawer / 1000 + "s",
        },
        components: {
            Button: {
                borderRadius: component.buttonRadius,
                borderRadiusSM: component.buttonRadius,
                borderRadiusLG: component.buttonRadius,
                controlHeight: component.buttonHeightRegular,
                colorPrimary: tokens.primary,
                colorPrimaryHover: tokens.primaryHover,
                colorPrimaryActive: tokens.primaryActive,
                primaryColor: tokens.primaryForeground,
                defaultBg: tokens.control,
                defaultColor: tokens.text,
                defaultBorderColor: tokens.controlBorder,
                defaultHoverBg: tokens.controlHover,
                defaultActiveBg: tokens.controlActive,
            },
            Input: { activeBorderColor: tokens.controlFocus, hoverBorderColor: tokens.controlBorder, borderRadius: component.inputRadius },
            InputNumber: { activeBorderColor: tokens.controlFocus, borderRadius: component.inputRadius },
            Select: { optionActiveBg: tokens.controlHover, optionSelectedBg: tokens.selected, optionSelectedColor: tokens.selectedForeground, borderRadius: component.menuRadius },
            Checkbox: { colorPrimary: check, colorPrimaryHover: check },
            Radio: { colorPrimary: check, colorPrimaryHover: check },
            Switch: { colorPrimary: switchColor, colorPrimaryHover: switchColor, colorPrimaryActive: switchColor },
            Slider: { trackBg: tokens.primary, trackHoverBg: tokens.primaryHover, handleColor: tokens.primary },
            Dropdown: {
                motionDurationMid: config.motion.durationDropdownEnter / 1000 + "s",
                motionDurationFast: config.motion.durationDropdownExit / 1000 + "s",
                motionEaseOut: config.motion.easingBounce,
                controlItemBgHover: tokens.controlHover,
                borderRadiusLG: component.menuRadius,
            },
            Popover: { borderRadiusLG: component.menuRadius },
            Tooltip: { colorBgSpotlight: tokens.overlay, colorTextLightSolid: tokens.text },
            Modal: { contentBg: tokens.overlay, headerBg: tokens.overlay, titleColor: tokens.text, borderRadiusLG: component.overlayRadius },
            Drawer: { colorBgElevated: tokens.overlay },
            Card: { colorBgContainer: tokens.surface, borderRadiusLG: component.cardRadius },
            Table: { headerBg: tokens.surfaceSubtle, headerColor: tokens.text, rowHoverBg: tokens.controlHover, rowSelectedBg: tokens.selected, rowSelectedHoverBg: tokens.selectedHover },
            Tabs: { itemColor: tokens.textMuted, itemSelectedColor: tokens.selectedForeground, itemHoverColor: tokens.text, inkBarColor: tokens.primary },
            Segmented: { itemSelectedBg: tokens.selected, itemSelectedColor: tokens.selectedForeground, trackBg: tokens.surfaceSubtle },
            Message: { contentBg: tokens.overlay },
            Notification: { colorBgElevated: tokens.overlay },
        },
    };
    const components = { ...base.components };
    for (const key of Object.keys(overrides.components ?? {}) as (keyof NonNullable<ThemeConfig["components"]>)[]) {
        Object.assign(components, { [key]: { ...base.components?.[key], ...overrides.components?.[key] } });
    }
    return { ...base, token: { ...base.token, ...overrides.token }, components };
}

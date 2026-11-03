import type { VisualEngineConfig } from "../types";
import { useVisualEngineStore } from "../storage/visual-engine-store";
import { getAntThemeConfig } from "@/lib/app-theme";
import type { SkinDefinition } from "@/lib/skin-themes";
import { resolvePageVisualPolicy } from "../page-rules/page-rules-engine";
import type { ThemeConfig } from "antd";

export function useVisualEngineHostAdapter(hostMode: "light" | "dark", skin: SkinDefinition, hostTheme?: ThemeConfig) {
    const enabled = useVisualEngineStore((state) => state.enabled);
    const config = useVisualEngineStore((state) => state.config);
    const path = useVisualEngineStore((state) => state.runtimePath);
    const policy = resolvePageVisualPolicy(path, config, hostMode);
    const active = enabled && !path.startsWith("/admin") && skin.id === "classic" && config.activePreset !== "native" && policy.matchedRule?.themePresetOverride !== "native";
    const mode = active && config.themeMode !== "system" ? config.themeMode : hostMode;
    const base = mode === hostMode && hostTheme ? hostTheme : getAntThemeConfig(mode === "dark", skin);
    if (!active) return { mode, theme: base, active: false };
    return { mode, theme: createVisualEngineAntTheme(config, mode, path, base), active: true };
}

export function createVisualEngineAntTheme(config: VisualEngineConfig, mode: "light" | "dark", path = "/__visual_preview", base: ThemeConfig = getAntThemeConfig(mode === "dark")): ThemeConfig {
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
            motion: config.motion.enabled && config.interactions.performanceMode !== "low",
            motionDurationFast: config.motion.durationQuick / 1000 + "s",
            motionDurationMid: config.motion.durationModal / 1000 + "s",
            motionDurationSlow: config.motion.durationDrawer / 1000 + "s",
        },
        components: {
            Button: {
                borderRadius: component.buttonRadius,
                controlHeight: component.buttonHeightRegular,
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
            Switch: { colorPrimary: switchColor, colorPrimaryHover: switchColor },
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
    const merged: ThemeConfig = { ...base, token: { ...base.token, ...overrides.token }, components: { ...base.components, ...overrides.components } };
    return merged;
}

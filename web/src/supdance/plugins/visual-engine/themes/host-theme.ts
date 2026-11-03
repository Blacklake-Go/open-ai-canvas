import type { ThemeConfig } from "antd";
import type { ResolvedPageVisualPolicy } from "../page-rules/page-rules-engine";
import type { VisualEngineConfig } from "../types";

export function mergeVisualEngineAntTheme(base: ThemeConfig, config: VisualEngineConfig, policy: ResolvedPageVisualPolicy, reducedMotion: boolean): ThemeConfig {
    const tokens = policy.activeTokens;
    const components = policy.activeComponents;
    const duration = (value: number) => `${!policy.motionEnabled || reducedMotion ? 0 : value}ms`;
    return {
        ...base,
        token: {
            ...base.token,
            colorPrimary: tokens.primary,
            colorPrimaryHover: tokens.primaryHover,
            colorPrimaryActive: tokens.primaryActive,
            colorText: tokens.text,
            colorTextSecondary: tokens.textMuted,
            colorBgBase: tokens.canvas,
            colorBgContainer: tokens.surface,
            colorBgElevated: tokens.overlay,
            colorBorder: tokens.controlBorder,
            colorBorderSecondary: tokens.border,
            colorError: tokens.danger,
            colorSuccess: tokens.success,
            colorWarning: tokens.warning,
            colorInfo: tokens.info,
            borderRadius: components.buttonRadius,
            borderRadiusLG: components.overlayRadius,
            borderRadiusSM: components.menuRadius,
            controlHeight: components.buttonHeightRegular,
            controlHeightSM: components.buttonHeightCompact,
            controlHeightLG: components.inputHeight,
            motion: policy.motionEnabled && !reducedMotion,
            motionDurationFast: duration(config.motion.durationQuick),
            motionDurationMid: duration(config.motion.durationDropdownEnter),
            motionDurationSlow: duration(config.motion.durationModal),
            motionEaseInOut: config.motion.easingSmooth,
            motionEaseOut: config.motion.easingStandard,
            boxShadowSecondary: config.elevations.E3[policy.activeThemeMode === "light" ? "shadowLight" : "shadowDark"],
        },
        components: {
            ...base.components,
            Button: {
                ...base.components?.Button,
                borderRadius: components.buttonRadius,
                borderRadiusSM: components.buttonRadius,
                borderRadiusLG: components.buttonRadius,
                primaryColor: tokens.primaryForeground,
                colorPrimary: tokens.primary,
                colorPrimaryHover: tokens.primaryHover,
                colorPrimaryActive: tokens.primaryActive,
            },
            Input: { ...base.components?.Input, borderRadius: components.inputRadius, controlHeight: components.inputHeight },
            Select: { ...base.components?.Select, borderRadius: components.inputRadius, controlHeight: components.inputHeight, optionSelectedBg: tokens.selected, optionSelectedColor: tokens.selectedForeground },
            Modal: { ...base.components?.Modal, borderRadiusLG: components.overlayRadius },
            Drawer: { ...base.components?.Drawer, colorBgElevated: tokens.overlay },
            Card: { ...base.components?.Card, borderRadiusLG: components.cardRadius },
            Tag: { ...base.components?.Tag, borderRadiusSM: components.tagRadius },
        },
    };
}

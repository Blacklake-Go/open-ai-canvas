import type { InteractionConfig, TransitionConfig, TypographyConfig, ModelPickerVisualConfig } from "../types";

export const DEFAULT_TYPOGRAPHY: TypographyConfig = {
    fontFamilySans: "system",
    fontFamilyMono: "system",
    spacingUnit: 4,
    scales: {
        label: { size: 11, lineHeight: 16, weight: 500 },
        caption: { size: 12, lineHeight: 18, weight: 400 },
        ui: { size: 13, lineHeight: 20, weight: 500 },
        body: { size: 14, lineHeight: 22, weight: 400 },
        heading: { size: 16, lineHeight: 24, weight: 600 },
        title: { size: 22, lineHeight: 30, weight: 700 },
        display: { size: 32, lineHeight: 40, weight: 700 },
    },
};
export const DEFAULT_INTERACTIONS: InteractionConfig = {
    focusWidth: 2,
    focusOffset: 3,
    hoverLift: 0,
    pressedScale: 0.98,
    disabledOpacity: 0.45,
    switchOnLight: "#15803d",
    switchOnDark: "#22c55e",
    checkboxLight: "#18181b",
    checkboxDark: "#f4f4f5",
    performanceMode: "auto",
};
export const DEFAULT_TRANSITIONS: TransitionConfig = {
    enabled: true,
    preset: "fade",
    duration: 150,
    delay: 0,
    distance: 8,
    scale: 0.98,
    opacity: 0,
    direction: "forward",
    paths: ["/*"],
    components: ["page"],
};
export const FONT_FAMILIES = {
    system: '"SF Pro Text","PingFang SC","Microsoft YaHei",system-ui,sans-serif',
    inter: 'Inter,"PingFang SC","Microsoft YaHei",system-ui,sans-serif',
    mono: '"JetBrains Mono","SFMono-Regular",Consolas,monospace',
};

export const DEFAULT_MODEL_PICKER: ModelPickerVisualConfig = {
    simplified: true,
    hideChannelMeta: true,
    hideTelemetry: true,
    cleanCardLayout: true,
};

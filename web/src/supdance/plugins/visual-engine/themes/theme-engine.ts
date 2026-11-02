import type { VisualEngineConfig, SemanticTokens } from "../types";
import { generateVisualEngineCSSVariables } from "./css-variables";

let injectedStyleElement: HTMLStyleElement | null = null;

const MANAGED_VISUAL_ENGINE_PROPERTIES = [
    "--background", "--foreground", "--canvas", "--surface", "--surface-subtle", "--surface-raised",
    "--surface-hover", "--surface-active", "--card", "--card-foreground", "--card-surface",
    "--card-surface-hover", "--card-surface-raised", "--popover", "--popover-foreground",
    "--primary", "--primary-hover", "--primary-active", "--primary-foreground",
    "--button-primary-bg", "--button-primary-hover-bg", "--button-primary-active-bg", "--button-primary-fg",
    "--btn-solid-bg", "--btn-solid-hover-bg", "--btn-solid-active-bg", "--btn-solid-fg",
    "--secondary", "--secondary-foreground", "--muted", "--muted-foreground",
    "--text-primary", "--text-secondary", "--border", "--input", "--ring",
    "--control-border", "--control-focus", "--control-selected-bg", "--control-selected-hover-bg",
    "--control-selected-active-bg", "--control-selected-fg", "--selected", "--selected-hover",
    "--selected-active", "--selected-foreground", "--destructive", "--destructive-hover",
    "--destructive-active", "--destructive-foreground", "--palette-status-error",
    "--palette-status-success", "--palette-status-warning", "--palette-status-info",
    "--radius-btn", "--radius-input", "--radius-card", "--radius-overlay", "--radius-menu",
    "--radius-tag", "--height-btn-regular", "--height-btn-compact", "--height-btn-micro",
    "--height-input", "--elevation-e0", "--elevation-e1", "--elevation-e2", "--elevation-e3",
    "--elevation-e4", "--backdrop-blur-modal", "--backdrop-opacity-modal", "--backdrop-blur-drawer",
    "--backdrop-opacity-drawer", "--backdrop-blur-menu", "--motion-quick",
    "--motion-dropdown-enter", "--motion-dropdown-exit", "--motion-modal", "--motion-drawer",
    "--motion-tab-switch", "--motion-ease-standard", "--motion-ease-bounce", "--motion-ease-smooth"
];

/**
 * 将视觉引擎的 CSS 变量无侵入注入至页面根节点
 */
export function applyVisualEngineTheme(
    config: VisualEngineConfig,
    activeMode: "light" | "dark",
    options: {
        customTokens?: Partial<SemanticTokens>;
        targetDocument?: Document;
        isolationScope?: HTMLElement;
    } = {},
): void {
    const doc = options.targetDocument ?? (typeof document !== "undefined" ? document : undefined);
    if (!doc) return;

    const targetElement = options.isolationScope ?? doc.documentElement;
    const variables = generateVisualEngineCSSVariables(config, activeMode, options.customTokens);

    for (const [prop, val] of Object.entries(variables)) {
        targetElement.style.setProperty(prop, val);
    }

    targetElement.dataset.visualEngineTheme = config.activePreset;
    targetElement.dataset.visualEngineMode = activeMode;
    targetElement.dataset.visualEngineVersion = config.publishedVersion;
}

/**
 * 停用插件时无损清理注入的 CSS 变量，恢复宿主原生样式
 */
export function removeVisualEngineTheme(
    options: {
        targetDocument?: Document;
        isolationScope?: HTMLElement;
    } = {},
): void {
    const doc = options.targetDocument ?? (typeof document !== "undefined" ? document : undefined);
    if (!doc) return;

    const targetElement = options.isolationScope ?? doc.documentElement;

    for (const prop of MANAGED_VISUAL_ENGINE_PROPERTIES) {
        targetElement.style.removeProperty(prop);
    }

    delete targetElement.dataset.visualEngineTheme;
    delete targetElement.dataset.visualEngineMode;
    delete targetElement.dataset.visualEngineVersion;

    if (injectedStyleElement && injectedStyleElement.parentNode) {
        injectedStyleElement.parentNode.removeChild(injectedStyleElement);
        injectedStyleElement = null;
    }
}

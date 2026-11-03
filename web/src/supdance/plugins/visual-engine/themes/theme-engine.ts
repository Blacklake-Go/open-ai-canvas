import type { VisualEngineConfig, SemanticTokens } from "../types";
import { generateVisualEngineCSSVariables } from "./css-variables";

const appliedProperties = new WeakMap<HTMLElement, Map<string, { previous: string; priority: string; applied: string }>>();

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
    const saved = appliedProperties.get(targetElement) ?? new Map();

    for (const [prop, val] of Object.entries(variables)) {
        const original = saved.get(prop);
        saved.set(prop, { previous: original?.previous ?? targetElement.style.getPropertyValue(prop), priority: original?.priority ?? targetElement.style.getPropertyPriority(prop), applied: val });
        targetElement.style.setProperty(prop, val);
    }
    appliedProperties.set(targetElement, saved);

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

    const saved = appliedProperties.get(targetElement);
    for (const [property, value] of saved ?? []) {
        if (targetElement.style.getPropertyValue(property) !== value.applied) continue;
        if (value.previous) targetElement.style.setProperty(property, value.previous, value.priority);
        else targetElement.style.removeProperty(property);
    }
    appliedProperties.delete(targetElement);

    delete targetElement.dataset.visualEngineTheme;
    delete targetElement.dataset.visualEngineMode;
    delete targetElement.dataset.visualEngineVersion;
}

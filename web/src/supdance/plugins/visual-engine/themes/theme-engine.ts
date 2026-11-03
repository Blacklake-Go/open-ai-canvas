import type { VisualEngineConfig, SemanticTokens } from "../types";
import { generateVisualEngineCSSVariables } from "./css-variables";

type PropertySnapshot = { value: string; priority: string; applied: string };
const managedTargets = new WeakMap<HTMLElement, Map<string, PropertySnapshot>>();

export function applyVisualEngineTheme(
    config: VisualEngineConfig,
    activeMode: "light" | "dark",
    options: { customTokens?: Partial<SemanticTokens>; targetDocument?: Document; isolationScope?: HTMLElement } = {},
): void {
    const doc = options.targetDocument ?? (typeof document !== "undefined" ? document : undefined);
    if (!doc) return;
    const target = options.isolationScope ?? doc.documentElement;
    const originals = managedTargets.get(target) ?? new Map<string, PropertySnapshot>();
    managedTargets.set(target, originals);
    for (const [property, value] of Object.entries(generateVisualEngineCSSVariables(config, activeMode, options.customTokens))) {
        const previous = originals.get(property);
        if (!previous || target.style.getPropertyValue(property) !== previous.applied) {
            originals.set(property, { value: target.style.getPropertyValue(property), priority: target.style.getPropertyPriority(property), applied: value });
        } else {
            previous.applied = value;
        }
        target.style.setProperty(property, value);
    }
    target.dataset.visualEngineTheme = config.activePreset;
    target.dataset.visualEngineMode = activeMode;
    target.dataset.visualEngineVersion = config.publishedVersion;
}

export function removeVisualEngineTheme(options: { targetDocument?: Document; isolationScope?: HTMLElement } = {}): void {
    const doc = options.targetDocument ?? (typeof document !== "undefined" ? document : undefined);
    if (!doc) return;
    const target = options.isolationScope ?? doc.documentElement;
    const originals = managedTargets.get(target);
    if (originals) {
        for (const [property, previous] of originals) {
            if (target.style.getPropertyValue(property) !== previous.applied) continue;
            if (previous.value) target.style.setProperty(property, previous.value, previous.priority);
            else target.style.removeProperty(property);
        }
        managedTargets.delete(target);
    }
    delete target.dataset.visualEngineTheme;
    delete target.dataset.visualEngineMode;
    delete target.dataset.visualEngineVersion;
}

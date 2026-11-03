import type { VisualEngineConfig, SemanticTokens } from "../types";
import { generateVisualEngineCSSVariables } from "./css-variables";

type PropertySnapshot = { value: string; priority: string; applied: string };
const managedTargets = new WeakMap<HTMLElement, Map<string, PropertySnapshot>>();

export function applyVisualEngineTheme(config: VisualEngineConfig, activeMode: "light" | "dark", options: { customTokens?: Partial<SemanticTokens>; targetDocument?: Document; isolationScope?: HTMLElement } = {}): void {
    const doc = options.targetDocument ?? (typeof document !== "undefined" ? document : undefined);
    if (!doc) return;
    const target = options.isolationScope ?? doc.documentElement;
    applyManagedProperties(target, generateVisualEngineCSSVariables(config, activeMode, options.customTokens));
    if (!options.isolationScope && doc.body) applyManagedProperties(doc.body, { "font-family": "var(--ve-font-sans)" });
    target.dataset.visualEngineTheme = config.activePreset;
    target.dataset.visualEngineMode = activeMode;
    target.dataset.visualEngineVersion = config.publishedVersion;

    const mp = config.modelPicker;
    if (mp?.simplified) {
        target.dataset.veSimplifiedModelPicker = "true";
    } else {
        delete target.dataset.veSimplifiedModelPicker;
    }
    if (mp?.hideChannelMeta) {
        target.dataset.veHideChannelMeta = "true";
    } else {
        delete target.dataset.veHideChannelMeta;
    }
    if (mp?.hideTelemetry) {
        target.dataset.veHideTelemetry = "true";
    } else {
        delete target.dataset.veHideTelemetry;
    }
    if (mp?.cleanCardLayout) {
        target.dataset.veCleanCardLayout = "true";
    } else {
        delete target.dataset.veCleanCardLayout;
    }
}

export function removeVisualEngineTheme(options: { targetDocument?: Document; isolationScope?: HTMLElement } = {}): void {
    const doc = options.targetDocument ?? (typeof document !== "undefined" ? document : undefined);
    if (!doc) return;
    const target = options.isolationScope ?? doc.documentElement;
    restoreManagedProperties(target);
    if (!options.isolationScope && doc.body) restoreManagedProperties(doc.body);
    delete target.dataset.visualEngineTheme;
    delete target.dataset.visualEngineMode;
    delete target.dataset.visualEngineVersion;

    delete target.dataset.veSimplifiedModelPicker;
    delete target.dataset.veHideChannelMeta;
    delete target.dataset.veHideTelemetry;
    delete target.dataset.veCleanCardLayout;
}

function applyManagedProperties(target: HTMLElement, values: Record<string, string>) {
    const originals = managedTargets.get(target) ?? new Map<string, PropertySnapshot>();
    managedTargets.set(target, originals);
    for (const [property, value] of Object.entries(values)) {
        const previous = originals.get(property);
        if (!previous || target.style.getPropertyValue(property) !== previous.applied) {
            originals.set(property, { value: target.style.getPropertyValue(property), priority: target.style.getPropertyPriority(property), applied: value });
        } else {
            previous.applied = value;
        }
        target.style.setProperty(property, value);
    }
}

function restoreManagedProperties(target: HTMLElement) {
    const originals = managedTargets.get(target);
    if (originals) {
        for (const [property, previous] of originals) {
            if (target.style.getPropertyValue(property) !== previous.applied) continue;
            if (previous.value) target.style.setProperty(property, previous.value, previous.priority);
            else target.style.removeProperty(property);
        }
        managedTargets.delete(target);
    }
}

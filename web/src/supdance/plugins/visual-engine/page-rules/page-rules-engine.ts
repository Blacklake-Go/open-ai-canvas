import type { VisualEngineConfig, PageRule, SemanticTokens, ComponentTokens } from "../types";
import { findMatchingPageRule } from "./rule-matcher";
import { BUILTIN_THEME_PRESETS } from "../config/default-config";

export type ResolvedPageVisualPolicy = {
    matchedRule?: PageRule;
    activeThemeMode: "light" | "dark";
    activeTokens: SemanticTokens;
    activeComponents: ComponentTokens;
    motionEnabled: boolean;
    recoveryEnabled: boolean;
};

export function resolvePageVisualPolicy(pathname: string, config: VisualEngineConfig, systemMode: "light" | "dark"): ResolvedPageVisualPolicy {
    const rule = findMatchingPageRule(pathname, config.pageRules);

    let activeTokens = { ...config.tokens[systemMode] };
    let activeComponents = config.components;
    let motionEnabled = config.motion.enabled;
    let recoveryEnabled = config.workspaceRecovery.enabled;

    if (rule) {
        if (rule.themePresetOverride) {
            const preset = BUILTIN_THEME_PRESETS.find((p) => p.id === rule.themePresetOverride);
            if (preset) {
                activeTokens = { ...preset.tokens[systemMode] };
                activeComponents = preset.components;
            }
        }
        if (rule.customTokens) {
            activeTokens = { ...activeTokens, ...rule.customTokens };
        }
        if (rule.motionEnabledOverride !== undefined) {
            motionEnabled = config.motion.enabled && rule.motionEnabledOverride;
        }
        if (rule.recoveryEnabledOverride !== undefined) {
            recoveryEnabled = config.workspaceRecovery.enabled && rule.recoveryEnabledOverride;
        }
    }

    return {
        matchedRule: rule,
        activeThemeMode: systemMode,
        activeTokens,
        activeComponents,
        motionEnabled,
        recoveryEnabled,
    };
}

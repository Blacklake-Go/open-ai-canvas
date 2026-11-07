import type { VisualEngineConfig, PageRule, SemanticTokens } from "../types";
import { findMatchingPageRule } from "./rule-matcher";
import { BUILTIN_THEME_PRESETS } from "../config/default-config";

export type ResolvedPageVisualPolicy = {
    matchedRule?: PageRule;
    activeThemeMode: "light" | "dark";
    activeTokens: SemanticTokens;
    motionEnabled: boolean;
    recoveryEnabled: boolean;
};

export function resolvePageVisualPolicy(pathname: string, config: VisualEngineConfig, systemMode: "light" | "dark"): ResolvedPageVisualPolicy {
    const rule = findMatchingPageRule(pathname, config.pageRules);

    let activeTokens = { ...config.tokens[systemMode] };
    let motionEnabled = config.motion.enabled;
    let recoveryEnabled = config.workspaceRecovery.enabled;

    if (rule) {
        if (rule.themePresetOverride && rule.themePresetOverride !== config.activePreset) {
            const preset = [...BUILTIN_THEME_PRESETS, ...config.customPresets].find((p) => p.id === rule.themePresetOverride);
            if (preset) {
                activeTokens = { ...preset.tokens[systemMode] };
            }
        }
        if (rule.customTokens) {
            activeTokens = { ...activeTokens, ...rule.customTokens };
        }
        if (rule.motionEnabledOverride !== undefined) {
            motionEnabled = config.motion.enabled && rule.motionEnabledOverride;
        }
        if (rule.recoveryEnabledOverride !== undefined) {
            recoveryEnabled = rule.recoveryEnabledOverride;
        }
    }

    return {
        matchedRule: rule,
        activeThemeMode: systemMode,
        activeTokens,
        motionEnabled,
        recoveryEnabled: recoveryEnabled && motionEnabled,
    };
}

import { detectHostCompatibility } from "../diagnostics/host-compatibility";
import { useVisualEngineStore } from "../storage/visual-engine-store";
import type { VisualEngineConfig } from "../types";
import type { ResolvedPageVisualPolicy } from "../page-rules/page-rules-engine";

export function useVisualEngineActive() {
    return useVisualEngineStore((state) => state.enabled && state.installation.installed) && detectHostCompatibility().compatible;
}

export function allowsVisualTheme(path: string, config: VisualEngineConfig, policy: ResolvedPageVisualPolicy) {
    return !/^\/admin(?:\/|$)/i.test(path) && config.activePreset !== "native" && policy.matchedRule?.themePresetOverride !== "native";
}

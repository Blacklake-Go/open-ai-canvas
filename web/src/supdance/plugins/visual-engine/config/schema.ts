import type { VisualEngineConfig } from "../types";
import { DEFAULT_VISUAL_ENGINE_CONFIG } from "./default-config";

const COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const SHADOW_LENGTH = String.raw`(?:0|(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em))`;
const SHADOW_CHANNEL = String.raw`(?:25[0-5]|2[0-4]\d|1?\d{1,2})`;
const SHADOW_ALPHA = String.raw`(?:0(?:\.\d+)?|1(?:\.0+)?|\.\d+)`;
const SHADOW_COLOR = String.raw`(?:#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?|rgb\(\s*${SHADOW_CHANNEL}\s*,\s*${SHADOW_CHANNEL}\s*,\s*${SHADOW_CHANNEL}\s*\)|rgba\(\s*${SHADOW_CHANNEL}\s*,\s*${SHADOW_CHANNEL}\s*,\s*${SHADOW_CHANNEL}\s*,\s*${SHADOW_ALPHA}\s*\)|transparent|black|white)`;
const SINGLE_SHADOW = String.raw`(?:inset\s+)?[+-]?${SHADOW_LENGTH}\s+[+-]?${SHADOW_LENGTH}(?:\s+${SHADOW_LENGTH}(?:\s+[+-]?${SHADOW_LENGTH})?)?\s+${SHADOW_COLOR}`;
const SHADOW = new RegExp(String.raw`^(?:none|${SINGLE_SHADOW}(?:,\s*${SINGLE_SHADOW})*)$`);
const EASING = /^(linear|ease|ease-in|ease-out|ease-in-out|cubic-bezier\(\s*(0(\.\d+)?|1(\.0+)?)\s*,\s*-?\d+(\.\d+)?\s*,\s*(0(\.\d+)?|1(\.0+)?)\s*,\s*-?\d+(\.\d+)?\s*\))$/;
const PRESETS = ["native", "light", "dark", "studio", "custom"];
const bytes = (value: string) => new TextEncoder().encode(value).length;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
export const isPageRulePattern = (value: string) => value.length <= 500 && (value === "*" || value.startsWith("/")) && !/[?#\\]/.test(value) && !value.replace(/\*$/, "").includes("*");

export function validateVisualEngineConfig(input: unknown): { valid: boolean; errors: string[]; config: VisualEngineConfig } {
    const errors: string[] = [];
    const reject = (path: string) => {
        errors.push(`视觉配置字段无效：${path}`);
    };
    const number = (value: unknown, minimum: number, maximum: number, integer = true) => typeof value === "number" && Number.isFinite(value) && (!integer || Number.isInteger(value)) && value >= minimum && value <= maximum;
    const shape = (value: unknown, baseline: unknown, path: string) => {
        if (Array.isArray(baseline)) return;
        if (object(baseline)) {
            if (!object(value)) {
                reject(path);
                return;
            }
            for (const [key, child] of Object.entries(baseline)) shape(value[key], child, path ? path + "." + key : key);
            for (const key of Object.keys(value)) if (!(key in baseline)) reject(path + "." + key);
        } else if (typeof value !== typeof baseline || (typeof value === "number" && !Number.isFinite(value))) reject(path);
    };
    shape(input, DEFAULT_VISUAL_ENGINE_CONFIG, "");
    if (!object(input)) return { valid: false, errors, config: structuredClone(DEFAULT_VISUAL_ENGINE_CONFIG) };
    if (input.schemaVersion !== 2) reject("schemaVersion");
    if (!PRESETS.includes(String(input.activePreset))) reject("activePreset");
    if (!["dark", "light", "system"].includes(String(input.themeMode))) reject("themeMode");
    if (object(input.tokens))
        for (const mode of ["light", "dark"]) {
            const tokens = input.tokens[mode];
            if (object(tokens)) for (const [key, value] of Object.entries(tokens)) if (typeof value !== "string" || !COLOR.test(value)) reject(`tokens.${mode}.${key}`);
        }
    if (object(input.components)) for (const [key, value] of Object.entries(input.components)) if (!number(value, key.includes("Height") ? 16 : 0, 128)) reject("components." + key);
    if (object(input.elevations))
        for (const level of ["E0", "E1", "E2", "E3", "E4"]) {
            const elevation = input.elevations[level];
            if (!object(elevation)) continue;
            if (elevation.level !== level || !number(elevation.blurRadius, 0, 128)) reject("elevations." + level);
            for (const key of ["shadowLight", "shadowDark"]) {
                const shadow = elevation[key];
                if (typeof shadow !== "string" || bytes(shadow) > 512 || !SHADOW.test(shadow)) reject(`elevations.${level}.${key}`);
            }
        }
    if (object(input.overlays))
        for (const [key, value] of Object.entries(input.overlays)) {
            if ((key.endsWith("Opacity") && !number(value, 0, 1, false)) || (key.endsWith("Blur") && !number(value, 0, 128))) reject("overlays." + key);
        }
    if (object(input.motion)) {
        for (const [key, value] of Object.entries(input.motion)) {
            if (key.startsWith("duration") && !number(value, 0, 5000)) reject("motion." + key);
            if (key.startsWith("easing") && (typeof value !== "string" || !EASING.test(value))) reject("motion." + key);
        }
        if (!["instant", "fade-only"].includes(String(input.motion.reducedMotionBehavior))) reject("motion.reducedMotionBehavior");
    }
    if (object(input.workspaceRecovery)) {
        const recovery = input.workspaceRecovery;
        if (!["light", "dark"].includes(String(recovery.themeMode)) || !["compact", "normal", "sparse"].includes(String(recovery.gridDensity))) reject("workspaceRecovery.mode");
        for (const [key, minimum, maximum, integer] of [
            ["orbitSpeed", 0.1, 5, false],
            ["orbitNodesCount", 3, 8, true],
            ["floatingCardsCount", 2, 6, true],
            ["glowIntensity", 0, 1, false],
            ["timeoutMs", 1000, 120000, true],
        ] as const)
            if (!number(recovery[key], minimum, maximum, integer)) reject("workspaceRecovery." + key);
        if (typeof recovery.brandName !== "string" || !recovery.brandName.trim() || bytes(recovery.brandName) > 200) reject("workspaceRecovery.brandName");
        if (typeof recovery.brandLogoUrl === "string" && recovery.brandLogoUrl !== "") {
            try {
                const parsed = new URL(recovery.brandLogoUrl, "https://visual.invalid");
                if (parsed.username || parsed.password || !((recovery.brandLogoUrl.startsWith("/") && !recovery.brandLogoUrl.startsWith("//")) || (parsed.protocol === "https:" && recovery.brandLogoUrl.startsWith("https://"))))
                    reject("workspaceRecovery.brandLogoUrl");
            } catch {
                reject("workspaceRecovery.brandLogoUrl");
            }
        }
        for (const group of ["statusCopies", "stageDetails"])
            if (object(recovery[group])) for (const [key, value] of Object.entries(recovery[group])) if (typeof value !== "string" || !value.trim() || bytes(value) > 1000) reject(`workspaceRecovery.${group}.${key}`);
    }
    const seen = new Set<string>();
    if (!Array.isArray(input.pageRules) || input.pageRules.length > 128) reject("pageRules");
    else
        for (const rule of input.pageRules) {
            if (!object(rule)) {
                reject("pageRules");
                continue;
            }
            if (typeof rule.id !== "string" || !rule.id || bytes(rule.id) > 200 || seen.has(rule.id)) reject("pageRules.id");
            else seen.add(rule.id);
            if (typeof rule.name !== "string" || !rule.name.trim() || bytes(rule.name) > 200) reject("pageRules.name");
            if (typeof rule.pathPattern !== "string" || !isPageRulePattern(rule.pathPattern)) reject("pageRules.pathPattern");
            if (rule.themePresetOverride !== undefined && !PRESETS.includes(String(rule.themePresetOverride))) reject("pageRules.themePresetOverride");
            for (const key of ["motionEnabledOverride", "recoveryEnabledOverride"]) if (rule[key] !== undefined && typeof rule[key] !== "boolean") reject("pageRules." + key);
            if (rule.notes !== undefined && typeof rule.notes !== "string") reject("pageRules.notes");
            if (rule.customTokens !== undefined) {
                if (!object(rule.customTokens)) reject("pageRules.customTokens");
                else for (const [key, value] of Object.entries(rule.customTokens)) if (!(key in DEFAULT_VISUAL_ENGINE_CONFIG.tokens.dark) || typeof value !== "string" || !COLOR.test(value)) reject("pageRules.customTokens." + key);
            }
        }
    return { valid: errors.length === 0, errors, config: errors.length ? structuredClone(DEFAULT_VISUAL_ENGINE_CONFIG) : (structuredClone(input) as VisualEngineConfig) };
}

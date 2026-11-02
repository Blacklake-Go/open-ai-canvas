import type { VisualEngineConfig } from "../types";
import { DEFAULT_VISUAL_ENGINE_CONFIG } from "./default-config";

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function collectInvalidColorTokens(prefix: string, tokens: Record<string, unknown>, errors: string[]): void {
    for (const [key, value] of Object.entries(tokens)) {
        if (value !== undefined && (typeof value !== "string" || !HEX_COLOR_PATTERN.test(value))) {
            errors.push(`${prefix}.${key} 不是合法的颜色值`);
        }
    }
}

export function validateVisualEngineConfig(input: unknown): { valid: boolean; errors: string[]; config: VisualEngineConfig } {
    const errors: string[] = [];
    if (!input || typeof input !== "object") {
        return { valid: false, errors: ["配置必须是一个有效的 JSON 对象"], config: DEFAULT_VISUAL_ENGINE_CONFIG };
    }

    const raw = input as Partial<VisualEngineConfig>;

    if (raw.schemaVersion !== undefined && raw.schemaVersion !== 2) {
        errors.push(`不支持的 Schema 版本：${raw.schemaVersion}，仅支持版本 2`);
    }

    const activePreset = typeof raw.activePreset === "string" && raw.activePreset.trim() ? raw.activePreset.trim() : DEFAULT_VISUAL_ENGINE_CONFIG.activePreset;
    const themeMode = raw.themeMode === "dark" || raw.themeMode === "light" || raw.themeMode === "system" ? raw.themeMode : "dark";

    const lightTokens = { ...DEFAULT_VISUAL_ENGINE_CONFIG.tokens.light };
    const darkTokens = { ...DEFAULT_VISUAL_ENGINE_CONFIG.tokens.dark };
    if (raw.tokens?.light) {
        collectInvalidColorTokens("tokens.light", raw.tokens.light, errors);
    }
    if (raw.tokens?.dark) {
        collectInvalidColorTokens("tokens.dark", raw.tokens.dark, errors);
    }
    const sanitizeTokenOverlay = <T extends Record<string, unknown>>(
        base: T,
        overlay: Record<string, unknown> | undefined,
    ): T => {
        if (!overlay) return base;
        const next: Record<string, unknown> = { ...base };
        for (const [key, value] of Object.entries(overlay)) {
            if (value !== undefined && typeof value === "string" && HEX_COLOR_PATTERN.test(value)) {
                next[key] = value;
            }
        }
        return next as T;
    };
    const mergedLightTokens = sanitizeTokenOverlay(lightTokens, raw.tokens?.light || {});
    const mergedDarkTokens = sanitizeTokenOverlay(darkTokens, raw.tokens?.dark || {});

    const components = { ...DEFAULT_VISUAL_ENGINE_CONFIG.components, ...(raw.components || {}) };
    const elevations = { ...DEFAULT_VISUAL_ENGINE_CONFIG.elevations, ...(raw.elevations || {}) };
    const overlays = { ...DEFAULT_VISUAL_ENGINE_CONFIG.overlays, ...(raw.overlays || {}) };
    const motion = { ...DEFAULT_VISUAL_ENGINE_CONFIG.motion, ...(raw.motion || {}) };
    const workspaceRecovery = {
        ...DEFAULT_VISUAL_ENGINE_CONFIG.workspaceRecovery,
        ...(raw.workspaceRecovery || {}),
        statusCopies: {
            ...DEFAULT_VISUAL_ENGINE_CONFIG.workspaceRecovery.statusCopies,
            ...(raw.workspaceRecovery?.statusCopies || {}),
        },
        stageDetails: {
            ...DEFAULT_VISUAL_ENGINE_CONFIG.workspaceRecovery.stageDetails,
            ...(raw.workspaceRecovery?.stageDetails || {}),
        },
    };

    const pageRules = Array.isArray(raw.pageRules) ? raw.pageRules : DEFAULT_VISUAL_ENGINE_CONFIG.pageRules;

    const validated: VisualEngineConfig = {
        schemaVersion: 2,
        activePreset,
        themeMode,
        tokens: {
            light: mergedLightTokens,
            dark: mergedDarkTokens,
        },
        components,
        elevations,
        overlays,
        motion,
        workspaceRecovery,
        pageRules,
        publishedVersion: typeof raw.publishedVersion === "string" ? raw.publishedVersion : DEFAULT_VISUAL_ENGINE_CONFIG.publishedVersion,
        updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
        updatedBy: typeof raw.updatedBy === "string" ? raw.updatedBy : "System",
    };

    return {
        valid: errors.length === 0,
        errors,
        config: validated,
    };
}

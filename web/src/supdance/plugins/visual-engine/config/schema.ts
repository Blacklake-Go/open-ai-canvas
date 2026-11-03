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

function validateConfig(input: unknown): { valid: boolean; errors: string[]; config: VisualEngineConfig } {
    const errors: string[] = [];
    if (!input || typeof input !== "object") {
        return { valid: false, errors: ["配置必须是一个有效的 JSON 对象"], config: DEFAULT_VISUAL_ENGINE_CONFIG };
    }

    const raw = input as Partial<VisualEngineConfig>;
    for (const mode of ["light", "dark"] as const) for (const key of Object.keys(DEFAULT_VISUAL_ENGINE_CONFIG.tokens[mode])) if (typeof raw.tokens?.[mode]?.[key as keyof typeof raw.tokens.light] !== "string") errors.push(`缺少颜色 ${mode}.${key}`);
    if (raw.schemaVersion !== 2 || !raw.tokens?.light || !raw.tokens.dark || !raw.components) errors.push("缺少完整的 Schema、主题或组件配置");
    if (!["dark", "light", "system"].includes(String(raw.themeMode))) errors.push("主题模式无效");

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
    const sanitizeTokenOverlay = <T extends Record<string, unknown>>(base: T, overlay: Record<string, unknown> | undefined): T => {
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
    for (const [name, value] of Object.entries(components)) if (!Number.isInteger(value) || value < 0 || value > 128) errors.push(`组件 ${name} 尺寸无效`);
    if (components.buttonHeightRegular < 28 || components.inputHeight < 28) errors.push("控件高度不能小于 28px");
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
        typography: {
            ...DEFAULT_VISUAL_ENGINE_CONFIG.typography,
            ...raw.typography,
            scales: Object.fromEntries(
                Object.entries(DEFAULT_VISUAL_ENGINE_CONFIG.typography.scales).map(([name, scale]) => [name, { ...scale, ...raw.typography?.scales?.[name as keyof typeof raw.typography.scales] }]),
            ) as VisualEngineConfig["typography"]["scales"],
        },
        interactions: { ...DEFAULT_VISUAL_ENGINE_CONFIG.interactions, ...raw.interactions },
        transitions: { ...DEFAULT_VISUAL_ENGINE_CONFIG.transitions, ...raw.transitions },
        customPresets: structuredClone(raw.customPresets ?? []),
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
    for (const [name, scale] of Object.entries(validated.typography.scales)) {
        if (![scale.size, scale.lineHeight, scale.weight].every(Number.isFinite) || scale.size < 10 || scale.size > 72 || scale.lineHeight < scale.size || scale.lineHeight > 120 || scale.weight < 100 || scale.weight > 900)
            errors.push(`排版层级 ${name} 超出范围`);
    }
    if (!["system", "inter"].includes(validated.typography.fontFamilySans) || !["system", "mono"].includes(validated.typography.fontFamilyMono) || validated.typography.spacingUnit < 2 || validated.typography.spacingUnit > 8) errors.push("字体或间距无效");
    const interaction = validated.interactions;
    for (const name of ["switchOnLight", "switchOnDark", "checkboxLight", "checkboxDark"] as const) if (!HEX_COLOR_PATTERN.test(interaction[name])) errors.push("交互颜色无效");
    if (
        !Number.isFinite(interaction.focusWidth) ||
        interaction.focusWidth < 1 ||
        interaction.focusWidth > 6 ||
        interaction.focusOffset < 0 ||
        interaction.focusOffset > 8 ||
        interaction.hoverLift < 0 ||
        interaction.hoverLift > 4 ||
        interaction.pressedScale < 0.9 ||
        interaction.pressedScale > 1 ||
        interaction.disabledOpacity < 0.2 ||
        interaction.disabledOpacity > 0.8 ||
        !["auto", "low", "full"].includes(interaction.performanceMode)
    )
        errors.push("交互参数超出范围");
    const transition = validated.transitions;
    if (
        ![transition.duration, transition.delay, transition.distance, transition.scale, transition.opacity].every(Number.isFinite) ||
        transition.duration < 0 ||
        transition.duration > 1000 ||
        transition.delay < 0 ||
        transition.delay > 300 ||
        transition.distance < 0 ||
        transition.distance > 32 ||
        transition.scale < 0.9 ||
        transition.scale > 1 ||
        transition.opacity < 0 ||
        transition.opacity > 1 ||
        !["fade", "slide", "scale"].includes(transition.preset) ||
        !["forward", "backward"].includes(transition.direction)
    )
        errors.push("页面过渡参数超出范围");
    if (
        !Array.isArray(transition.paths) ||
        transition.paths.length > 100 ||
        transition.paths.some((path) => typeof path !== "string" || !path.startsWith("/") || path.length > 200) ||
        !Array.isArray(transition.components) ||
        transition.components.some((value) => !["page", "workspace", "generation", "overlay"].includes(value))
    )
        errors.push("动效适用范围无效");
    if (!Array.isArray(validated.customPresets) || validated.customPresets.length > 30) errors.push("自定义预设数量无效");
    else
        for (const preset of validated.customPresets) {
            if (!preset.id?.startsWith("custom-") || !preset.name || preset.name.length > 80 || preset.isSystem) errors.push("自定义预设标识无效");
            for (const mode of ["dark", "light"] as const)
                if (preset.tokens?.[mode]) collectInvalidColorTokens(`presets.${preset.id}.${mode}`, preset.tokens[mode], errors);
                else errors.push("预设缺少明暗色");
            if (!preset.components || Object.values(preset.components).some((value) => !Number.isInteger(value) || value < 0 || value > 128)) errors.push("预设组件尺寸无效");
        }
    if (new Set(validated.customPresets.map((preset) => preset.id)).size !== validated.customPresets.length) errors.push("自定义预设标识重复");

    for (const [key, value] of Object.entries(motion)) if (key.startsWith("duration") && (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 3000)) errors.push("动画时长无效");
    const easing = /^(linear|ease|ease-in|ease-out|ease-in-out|cubic-bezier\([-0-9., ]+\))$/;
    for (const curve of [motion.easingStandard, motion.easingSmooth, motion.easingBounce]) {
        if (typeof curve !== "string" || !easing.test(curve)) errors.push("动画曲线无效");
        else if (curve.startsWith("cubic-bezier")) {
            const numbers = curve.slice(13, -1).split(",").map(Number);
            if (numbers.length !== 4 || numbers.some((value) => !Number.isFinite(value)) || numbers[0] < 0 || numbers[0] > 1 || numbers[2] < 0 || numbers[2] > 1) errors.push("贝塞尔曲线无效");
        }
    }
    if (!["instant", "fade-only"].includes(motion.reducedMotionBehavior)) errors.push("减少动效策略无效");
    for (const [key, value] of Object.entries(overlays)) if (key !== "enableTextProtectionGradient" && (!Number.isFinite(value) || Number(value) < 0 || Number(value) > (key.endsWith("Blur") ? 100 : 1))) errors.push("遮罩参数无效");
    for (const level of ["E0", "E1", "E2", "E3", "E4"] as const) {
        const token = elevations[level];
        if (
            !token ||
            ![token.shadowLight, token.shadowDark].every((value) => typeof value === "string" && value.length <= 240 && /^(none|[-0-9.pxrgba(), #%]+)$/.test(value)) ||
            !Number.isInteger(token.blurRadius) ||
            token.blurRadius < 0 ||
            token.blurRadius > 100
        )
            errors.push("阴影参数无效");
    }
    const recovery = workspaceRecovery;
    if (
        !["light", "dark"].includes(recovery.themeMode) ||
        !["compact", "normal", "sparse"].includes(recovery.gridDensity) ||
        !["fade", "instant"].includes(recovery.exitEffect) ||
        !["retry", "reload"].includes(recovery.timeoutFeedback) ||
        !HEX_COLOR_PATTERN.test(recovery.backgroundDark) ||
        !HEX_COLOR_PATTERN.test(recovery.backgroundLight)
    )
        errors.push("恢复动画外观无效");
    if (typeof recovery.brandLogoUrl !== "string" || !recovery.brandLogoUrl.startsWith("/") || recovery.brandLogoUrl.startsWith("//") || /[\\\\\r\n]/.test(recovery.brandLogoUrl)) errors.push("Logo 必须使用站内资源路径");
    if (typeof recovery.brandName !== "string" || recovery.brandName.length > 120 || !recovery.brandName) errors.push("品牌名称无效");
    for (const [value, min, max] of [
        [recovery.timeoutMs, 1000, 120000],
        [recovery.orbitSpeed, 0.1, 10],
        [recovery.orbitNodesCount, 0, 8],
        [recovery.floatingCardsCount, 0, 4],
        [recovery.glowIntensity, 0, 1],
        [recovery.animationSpeed, 0.25, 2],
    ])
        if (!Number.isFinite(value) || value < min || value > max) errors.push("恢复动画参数超出范围");
    for (const text of [...Object.values(recovery.statusCopies), ...Object.values(recovery.stageDetails)]) if (typeof text !== "string" || text.length > 800 || !text) errors.push("恢复动画文案无效");
    if (!Array.isArray(recovery.paths) || recovery.paths.length > 100 || recovery.paths.some((path) => typeof path !== "string" || !path.startsWith("/") || path.length > 200)) errors.push("恢复动画路径无效");
    if (!Array.isArray(pageRules) || pageRules.length > 100) errors.push("页面规则数量无效");
    else {
        const ids = new Set<string>();
        for (const rule of pageRules) {
            if (!rule.id || ids.has(rule.id) || typeof rule.pathPattern !== "string" || !rule.pathPattern.startsWith("/") || rule.pathPattern.length > 200) errors.push("页面规则标识或路径无效");
            ids.add(rule.id);
            if (rule.performanceMode && !["auto", "low", "full"].includes(rule.performanceMode)) errors.push("页面性能模式无效");
            for (const [name, value] of Object.entries(rule.customTokens ?? {})) if (!(name in lightTokens) || !HEX_COLOR_PATTERN.test(String(value))) errors.push("页面规则颜色无效");
            if (rule.components || rule.overlays || rule.elevations) {
                const result = validateVisualEngineConfig({ ...validated, components: rule.components ?? components, overlays: rule.overlays ?? overlays, elevations: rule.elevations ?? elevations, pageRules: [], customPresets: [] });
                errors.push(...result.errors.map((error) => "页面覆盖：" + error));
            }
        }
    }
    for (const preset of validated.customPresets) {
        const result = validateVisualEngineConfig({ ...validated, tokens: preset.tokens, components: preset.components, motion: { ...motion, ...preset.motion }, customPresets: [], pageRules: [] });
        errors.push(...result.errors.map((error) => "自定义预设：" + error));
        if (preset.motion) preset.motion = { ...motion, ...preset.motion };
    }
    return {
        valid: errors.length === 0,
        errors,
        config: validated,
    };
}
export function validateVisualEngineConfig(input: unknown): ReturnType<typeof validateConfig> {
    try {
        return validateConfig(input);
    } catch {
        return { valid: false, errors: ["配置结构无效，未应用任何内容"], config: DEFAULT_VISUAL_ENGINE_CONFIG };
    }
}

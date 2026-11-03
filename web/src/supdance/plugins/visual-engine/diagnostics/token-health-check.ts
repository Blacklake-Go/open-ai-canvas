import type { VisualEngineConfig } from "../types";
import { calculateContrastRatio, evaluateContrastCompliance } from "../themes/contrast-checker";

export type HealthCheckResult = {
    pass: boolean;
    contrastChecks: Array<{
        name: string;
        foreground: string;
        background: string;
        ratio: number;
        rating: "AAA" | "AA" | "FAIL";
        pass: boolean;
    }>;
    warnings: string[];
    errors: string[];
};

export function runTokenHealthCheck(config: VisualEngineConfig, mode: "light" | "dark"): HealthCheckResult {
    const tokens = config.tokens[mode];
    const warnings: string[] = [];
    const errors: string[] = [];

    const contrastPairs = [
        { name: "主文字 vs 画布底色", fg: tokens.text, bg: tokens.canvas, min: 4.5 },
        { name: "主操作文字 vs 主操作按钮", fg: tokens.primaryForeground, bg: tokens.primary, min: 4.5 },
        { name: "次级文字 vs 画布底色", fg: tokens.textMuted, bg: tokens.canvas, min: 4.5 },
        { name: "危险操作文字 vs 危险背景", fg: tokens.dangerForeground, bg: tokens.danger, min: 4.5 },
        { name: "选中高亮文字 vs 选中背景", fg: tokens.selectedForeground, bg: tokens.selected, min: 4.5 },
    ];

    const contrastChecks = contrastPairs.map((pair) => {
        const ratio = calculateContrastRatio(pair.fg, pair.bg);
        const evalResult = evaluateContrastCompliance(ratio);
        const pass = ratio >= pair.min;
        if (!pass) {
            warnings.push(`${pair.name} 对比度偏低 (${ratio}:1 < ${pair.min}:1)`);
        }
        return {
            name: pair.name,
            foreground: pair.fg,
            background: pair.bg,
            ratio,
            rating: evalResult.rating,
            pass,
        };
    });

    if (config.components.buttonRadius > 24) {
        warnings.push("主按钮圆角大于 24px，可能影响紧凑控件布局");
    }

    if (config.motion.durationQuick > 300) {
        warnings.push("快速微交互时长大于 300ms，可能引起用户操作迟滞感");
    }

    return {
        pass: errors.length === 0 && contrastChecks.every((check) => check.pass),
        contrastChecks,
        warnings,
        errors,
    };
}

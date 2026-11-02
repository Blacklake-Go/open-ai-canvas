/**
 * WCAG 2.1 对比度算法实现 (无需外部依赖)
 */
function parseHexColor(hex: string): [number, number, number] {
    const cleaned = hex.replace("#", "").trim();
    if (cleaned.length === 3) {
        return [
            parseInt(cleaned[0] + cleaned[0], 16),
            parseInt(cleaned[1] + cleaned[1], 16),
            parseInt(cleaned[2] + cleaned[2], 16),
        ];
    }
    if (cleaned.length === 6) {
        return [
            parseInt(cleaned.slice(0, 2), 16),
            parseInt(cleaned.slice(2, 4), 16),
            parseInt(cleaned.slice(4, 6), 16),
        ];
    }
    return [0, 0, 0];
}

function sRGBtoLin(colorChannel: number): number {
    const c = colorChannel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function getRelativeLuminance(hex: string): number {
    const [r, g, b] = parseHexColor(hex);
    return 0.2126 * sRGBtoLin(r) + 0.7152 * sRGBtoLin(g) + 0.0722 * sRGBtoLin(b);
}

export function calculateContrastRatio(foregroundHex: string, backgroundHex: string): number {
    const lumA = getRelativeLuminance(foregroundHex);
    const lumB = getRelativeLuminance(backgroundHex);
    const lighter = Math.max(lumA, lumB);
    const darker = Math.min(lumA, lumB);
    const ratio = (lighter + 0.05) / (darker + 0.05);
    return Math.round(ratio * 100) / 100;
}

export function evaluateContrastCompliance(ratio: number): {
    aaNormalText: boolean;  // ≥ 4.5:1
    aaLargeText: boolean;   // ≥ 3.0:1
    uiComponents: boolean;  // ≥ 3.0:1
    rating: "AAA" | "AA" | "FAIL";
} {
    const aaNormalText = ratio >= 4.5;
    const aaLargeText = ratio >= 3.0;
    const uiComponents = ratio >= 3.0;
    const rating = ratio >= 7.0 ? "AAA" : ratio >= 4.5 ? "AA" : "FAIL";
    return { aaNormalText, aaLargeText, uiComponents, rating };
}

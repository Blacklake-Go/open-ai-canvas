import type { VisualEngineConfig } from "../types";

export type ConfigDifference = { field: string; before: unknown; after: unknown };
export function diffVisualConfig(before: VisualEngineConfig, after: VisualEngineConfig): ConfigDifference[] {
    const differences: ConfigDifference[] = [];
    const walk = (left: unknown, right: unknown, path: string) => {
        if (JSON.stringify(left) === JSON.stringify(right)) return;
        if (left && right && typeof left === "object" && typeof right === "object" && !Array.isArray(left) && !Array.isArray(right)) {
            const first = left as Record<string, unknown>,
                second = right as Record<string, unknown>;
            for (const key of new Set([...Object.keys(first), ...Object.keys(second)])) {
                if (!path && ["updatedAt", "updatedBy", "publishedVersion"].includes(key)) continue;
                walk(first[key], second[key], path ? path + "." + key : key);
            }
        } else differences.push({ field: path, before: left, after: right });
    };
    walk(before, after, "");
    return differences;
}

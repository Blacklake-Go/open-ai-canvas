import type { CSSProperties } from "react";
export type OverlayKind = "modal" | "drawer";
export type OverlayStyles = Record<string, CSSProperties>;
const extensions = new Set<(kind: OverlayKind) => OverlayStyles>();
export function registerOverlayExtension(extension: (kind: OverlayKind) => OverlayStyles) {
    extensions.add(extension);
    return () => {
        extensions.delete(extension);
    };
}
export function resolveOverlayExtensionStyles(kind: OverlayKind, input: unknown): OverlayStyles {
    const result: OverlayStyles = {};
    for (const extension of extensions) {
        try {
            for (const [key, value] of Object.entries(extension(kind))) result[key] = { ...result[key], ...value };
        } catch (error) {
            console.warn("浮层扩展失败，保留宿主样式", error);
        }
    }
    if (input && typeof input === "object") for (const [key, value] of Object.entries(input)) if (value && typeof value === "object") result[key] = { ...result[key], ...value };
    return result;
}

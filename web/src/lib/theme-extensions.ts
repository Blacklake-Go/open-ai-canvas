import type { SkinDefinition, SkinThemeMode } from "./skin-themes";

export type HostThemeContext = { skin: SkinDefinition; mode: SkinThemeMode; document: Document };
type ThemeExtension = { beforeApply: (context: HostThemeContext) => void; afterApply: (context: HostThemeContext) => void };
const extensions = new Set<ThemeExtension>();

export function registerThemeExtension(extension: ThemeExtension) {
    extensions.add(extension);
    return () => {
        extensions.delete(extension);
    };
}

export function runThemeExtensions(phase: keyof ThemeExtension, context: HostThemeContext) {
    for (const extension of extensions) {
        try {
            extension[phase](context);
        } catch (error) {
            console.warn("主题扩展失败，保留宿主主题", error);
        }
    }
}

import { useTranslation } from "react-i18next";
import { i18n } from "@/i18n";
import { CREATION_UI_SOURCES } from "./locales/creation-sources";
import { CREATION_NAMESPACE } from "./creation-catalogs";
export { CREATION_CATALOGS, CREATION_NAMESPACE } from "./creation-catalogs";
import { interpolateTemplate } from "./engine/translator";

type TextParams = Record<string, string | number | boolean | null | undefined>;
const sourceKeys = new Map(Object.entries(CREATION_UI_SOURCES).map(([key, source]) => [source, key]));
const templates = Object.entries(CREATION_UI_SOURCES)
    .flatMap(([key, source]) => {
        const names = [...source.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((match) => match[1]);
        if (!names.length) return [];
        const parts = source.split(/\{[a-zA-Z0-9_]+\}/g);
        const pattern = parts.map((part) => part.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&")).join("([\\s\\S]*?)");
        return [{ key, source, names, pattern: new RegExp("^" + pattern + "$") }];
    })
    .sort((a, b) => b.source.length - a.source.length);

function normalizeParams(params?: TextParams) {
    return params ? Object.fromEntries(Object.entries(params).map(([name, value]) => [name, value == null ? "" : typeof value === "number" ? value : String(value)])) : undefined;
}

/** Persist canonical UI messages; locale changes must not change state guards or payloads. */
export function creationSource(key: string, params?: TextParams): string {
    return interpolateTemplate(CREATION_UI_SOURCES[key] ?? key, normalizeParams(params));
}

/** Explicit UI translations share the host i18next instance and all supported languages. */
export function creationText(key: string, params?: TextParams): string {
    return i18n.t(key, { ...normalizeParams(params), ns: CREATION_NAMESPACE, keySeparator: false, defaultValue: creationSource(key, params) }) as string;
}

/** Subscribe without remounting inputs or changing drafts and business data. */
export function useCreationLocale(): void {
    useTranslation(CREATION_NAMESPACE);
}

/** Only callers' UI labels are matched. User text and generation prompts stay verbatim. */
export function creationLabel(source: string): string {
    const key = sourceKeys.get(source);
    if (key) return creationText(key);
    for (const template of templates) {
        const match = template.pattern.exec(source);
        if (match) return creationText(template.key, Object.fromEntries(template.names.map((name, index) => [name, match[index + 1]])));
    }
    return source;
}

/** Localize display fields while preserving IDs, enum values and parameter metadata. */
export function creationOptions<T>(options: T): T {
    if (!Array.isArray(options)) return options;
    return options.map((option: unknown) => {
        if (!option || typeof option !== "object") return option;
        return Object.fromEntries(Object.entries(option).map(([key, value]) => [key, ["label", "title", "detail", "description"].includes(key) && typeof value === "string" ? creationLabel(value) : key === "options" ? creationOptions(value) : value]));
    }) as T;
}

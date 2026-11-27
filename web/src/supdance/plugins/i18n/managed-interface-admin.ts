import catalog from "@/i18n/messages/interface.json";
import { SUPPORTED_LOCALES } from "@/i18n/locales";
import { BUILTIN_I18N_ENTRIES, mergeI18nEntries } from "./locales";
import { MANAGED_TRANSLATION_TARGETS } from "./managed-catalog";
import type { SupDanceI18nEntry } from "./types";

const catalogs: Record<string, Record<string, string>> = catalog;
const interfaceBuiltins: SupDanceI18nEntry[] = [];
for (const [key, source] of Object.entries(catalogs["zh-CN"])) {
    const managedKey = `upstream.${key}`;
    if (MANAGED_TRANSLATION_TARGETS.has(managedKey) || !source.trim()) continue;
    interfaceBuiltins.push({
        key: managedKey,
        namespace: "upstreamUI",
        sourceText: source,
        description: `translation: ${key}`,
        origin: "builtin",
        translations: Object.fromEntries(SUPPORTED_LOCALES.map(({ code }) => [code, catalogs[code][key] ?? ""])) as SupDanceI18nEntry["translations"],
    });
}

const adminBuiltins = [...BUILTIN_I18N_ENTRIES, ...interfaceBuiltins];

export function adminI18nEntries(customEntries: Record<string, SupDanceI18nEntry>) {
    return mergeI18nEntries(customEntries, adminBuiltins);
}

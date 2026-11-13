import { NATIVE_CATALOGS } from "@/i18n/catalogs";
import { SUPPORTED_LOCALES } from "@/i18n/locales";
import { CREATION_CATALOGS, CREATION_NAMESPACE } from "./creation-catalogs";
import { MODEL_CATALOGS, MODEL_NAMESPACE } from "./model-catalogs";
import type { SupDanceI18nEntry } from "./types";

export type ManagedTranslationTarget = { namespace: string; key: string };
export const MANAGED_TRANSLATION_TARGETS = new Map<string, ManagedTranslationTarget>();
const singleBraces = (text: string) => text.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, "{$1}");
export const MANAGED_UI_ENTRIES: SupDanceI18nEntry[] = [];
for (const [prefix, namespace, catalogs, category] of [
    ["upstream", "translation", NATIVE_CATALOGS, "upstreamUI"],
    ["creation", CREATION_NAMESPACE, CREATION_CATALOGS, "creationUI"],
    ["model", MODEL_NAMESPACE, MODEL_CATALOGS, "modelUI"],
] as const) {
    for (const [runtimeKey, source] of Object.entries(catalogs["zh-CN"])) {
        if (!source.trim()) continue;
        const key = `${prefix}.${runtimeKey}`;
        MANAGED_TRANSLATION_TARGETS.set(key, { namespace, key: runtimeKey });
        MANAGED_UI_ENTRIES.push({
            key,
            namespace: category,
            sourceText: singleBraces(source),
            description: `${namespace}: ${runtimeKey}`,
            origin: "builtin",
            translations: Object.fromEntries(SUPPORTED_LOCALES.map(({ code }) => [code, singleBraces(catalogs[code][runtimeKey] ?? "")])) as SupDanceI18nEntry["translations"],
        });
    }
}

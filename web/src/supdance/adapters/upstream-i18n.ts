import { i18n } from "@/i18n";
import { SUPPORTED_LOCALES } from "@/i18n/locales";
import type { SupDanceI18nEntry, SupDanceLocaleCode } from "@/supdance/plugins/i18n/types";

export const SUPDANCE_TRANSLATION_NAMESPACE = "supdance";

let registeredEntries: SupDanceI18nEntry[] | undefined;

/** Only extension keys live here. No postprocessor may override upstream catalogs. */
export function registerSupDanceTranslations(entries: SupDanceI18nEntry[]) {
    if (registeredEntries === entries) return;
    registeredEntries = entries;
    const template = (text: string) => text.replace(/\{([a-zA-Z0-9_]+)\}/g, "{{$1}}");
    for (const { code } of SUPPORTED_LOCALES) {
        const resources = Object.fromEntries(entries.map((entry) => [entry.key, template(entry.translations[code as SupDanceLocaleCode] || entry.sourceText)]));
        i18n.removeResourceBundle(code, SUPDANCE_TRANSLATION_NAMESPACE);
        i18n.addResourceBundle(code, SUPDANCE_TRANSLATION_NAMESPACE, resources);
    }
}

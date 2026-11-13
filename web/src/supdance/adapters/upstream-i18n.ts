import { i18n } from "@/i18n";
import { toI18nextTemplate } from "@/i18n/interpolation";
import { NATIVE_CATALOGS, expandCatalog } from "@/i18n/catalogs";
import { SUPPORTED_LOCALES } from "@/i18n/locales";
import { CREATION_CATALOGS, CREATION_NAMESPACE } from "@/supdance/plugins/i18n/creation-catalogs";
import { MODEL_CATALOGS, MODEL_NAMESPACE } from "@/supdance/plugins/i18n/model-catalogs";
import { MANAGED_TRANSLATION_TARGETS } from "@/supdance/plugins/i18n/managed-catalog";
import type { SupDanceI18nEntry } from "@/supdance/plugins/i18n/types";

export const SUPDANCE_TRANSLATION_NAMESPACE = "supdance";

let registeredEntries: SupDanceI18nEntry[] | undefined;

/** Published overrides target explicit UI keys; source matching never touches user content. */
export function registerSupDanceTranslations(entries: SupDanceI18nEntry[]) {
    if (registeredEntries === entries) return;
    registeredEntries = entries;
    const template = toI18nextTemplate;
    for (const { code } of SUPPORTED_LOCALES) {
        // Rebuild from immutable resources so deleting an override restores the exact builtin.
        i18n.removeResourceBundle(code, "translation");
        i18n.addResourceBundle(code, "translation", expandCatalog(NATIVE_CATALOGS[code]));
        i18n.removeResourceBundle(code, CREATION_NAMESPACE);
        i18n.addResourceBundle(code, CREATION_NAMESPACE, Object.fromEntries(Object.entries(CREATION_CATALOGS[code]).map(([key, text]) => [key, template(text)])));
        i18n.removeResourceBundle(code, MODEL_NAMESPACE);
        i18n.addResourceBundle(code, MODEL_NAMESPACE, { ...MODEL_CATALOGS[code] });
        const resources: Record<string, string> = {};
        for (const entry of entries) {
            const text = template(entry.translations[code]?.trim() || entry.translations["en-US"]?.trim() || entry.sourceText);
            resources[entry.key] = text;
            const target = MANAGED_TRANSLATION_TARGETS.get(entry.key);
            if (target && entry.origin !== "builtin") {
                if (target.namespace !== "translation") i18n.addResourceBundle(code, target.namespace, { [target.key]: text }, true, true);
                else i18n.addResource(code, target.namespace, target.key, text, { silent: true });
            }
        }
        i18n.removeResourceBundle(code, SUPDANCE_TRANSLATION_NAMESPACE);
        i18n.addResourceBundle(code, SUPDANCE_TRANSLATION_NAMESPACE, resources);
    }
}

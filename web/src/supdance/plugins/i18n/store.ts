import { useMemo } from "react";
import { create } from "zustand";
import { i18n } from "@/i18n";
import { useTranslation } from "react-i18next";
import { useLocaleStore } from "@/stores/use-locale-store";
import { registerSupDanceTranslations, SUPDANCE_TRANSLATION_NAMESPACE } from "@/supdance/adapters/upstream-i18n";
import { usePluginStore } from "@/stores/use-plugin-store";
import { compileI18nDictionary, isCandidateUntranslatedChinese, translateByKey, translateSourceText, type CompiledI18nDictionary } from "./engine/translator";
import { BUILTIN_I18N_ENTRIES, DEFAULT_SUPDANCE_I18N_SETTINGS, mergeI18nEntries } from "./locales";
import { SUPDANCE_I18N_PLUGIN_ID, type SupDanceDiscoveredTextItem, type SupDanceI18nEntry, type SupDanceI18nPublicBundle, type SupDanceI18nSettings, type SupDanceLanguageItem, type SupDanceLocaleCode } from "./types";

export const SUPDANCE_I18N_LOCALE_STORAGE_KEY = "supdance:i18n:locale";
export const SUPDANCE_I18N_CACHE_STORAGE_KEY = "supdance:i18n:config-cache";
export const SUPDANCE_I18N_DISCOVERED_STORAGE_KEY = "supdance:i18n:discovered-untranslated";
const MAX_DISCOVERED_ITEMS = 200;

type StoredI18nCache = {
    pluginEnabled?: boolean;
    settings?: SupDanceI18nSettings;
    customEntries?: Record<string, SupDanceI18nEntry>;
};

function readStoredCache(): StoredI18nCache | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(SUPDANCE_I18N_CACHE_STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as StoredI18nCache;
    } catch {
        return null;
    }
}

function writeStoredCache(cache: StoredI18nCache): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(SUPDANCE_I18N_CACHE_STORAGE_KEY, JSON.stringify(cache));
    } catch {
        // Ignore storage write errors in restricted privacy contexts
    }
}

function readStoredDiscovered(): SupDanceDiscoveredTextItem[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(SUPDANCE_I18N_DISCOVERED_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as SupDanceDiscoveredTextItem[]) : [];
    } catch {
        return [];
    }
}

function writeStoredDiscovered(items: SupDanceDiscoveredTextItem[]): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(SUPDANCE_I18N_DISCOVERED_STORAGE_KEY, JSON.stringify(items.slice(0, MAX_DISCOVERED_ITEMS)));
    } catch {
        // Ignore storage write errors
    }
}

function filterOutTranslatedDiscovered(discovered: SupDanceDiscoveredTextItem[], dictionary: CompiledI18nDictionary): SupDanceDiscoveredTextItem[] {
    return discovered.filter((item) => translateSourceText(dictionary, item.sourceText, "en-US", "zh-CN") === null);
}

const initialCache = readStoredCache();
const initialSettings = initialCache?.settings ?? DEFAULT_SUPDANCE_I18N_SETTINGS;
const initialCustomEntries = initialCache?.customEntries ?? {};
const initialPluginEnabled = typeof initialCache?.pluginEnabled === "boolean" ? initialCache.pluginEnabled : true;
const initialEntries = mergeI18nEntries(initialCustomEntries);
const initialDictionary = compileI18nDictionary(initialEntries);
const initialLocale = useLocaleStore.getState().locale;
const initialDiscovered = filterOutTranslatedDiscovered(readStoredDiscovered(), initialDictionary);

export type SupDanceI18nStoreState = {
    initialized: boolean;
    pluginEnabled: boolean;
    locale: SupDanceLocaleCode;
    settings: SupDanceI18nSettings;
    customEntries: Record<string, SupDanceI18nEntry>;
    entries: SupDanceI18nEntry[];
    dictionary: CompiledI18nDictionary;
    discoveredUntranslated: SupDanceDiscoveredTextItem[];
    revision: string;
    setLocale: (locale: SupDanceLocaleCode) => void;
    setPluginEnabled: (enabled: boolean) => void;
    applyBundle: (bundle: SupDanceI18nPublicBundle) => void;
    updateLocalSettings: (settings: SupDanceI18nSettings) => void;
    upsertLocalEntries: (items: SupDanceI18nEntry[]) => void;
    removeLocalEntry: (key: string) => void;
    recordUntranslatedText: (sourceText: string, route?: string) => void;
    clearDiscoveredUntranslated: (sourceText?: string) => void;
    syncFromStorage: () => void;
};

export const useSupDanceI18nStore = create<SupDanceI18nStoreState>((set, get) => ({
    initialized: false,
    pluginEnabled: initialPluginEnabled,
    locale: initialLocale,
    settings: initialSettings,
    customEntries: initialCustomEntries,
    entries: initialEntries,
    dictionary: initialDictionary,
    discoveredUntranslated: initialDiscovered,
    revision: initialSettings.revision || DEFAULT_SUPDANCE_I18N_SETTINGS.revision,

    setLocale: (nextLocale) => {
        useLocaleStore.getState().setLocale(nextLocale);
        const locale = useLocaleStore.getState().locale;
        if (get().locale !== locale) set({ locale });
    },

    setPluginEnabled: (enabled) => {
        const { settings, customEntries } = get();
        writeStoredCache({ pluginEnabled: enabled, settings, customEntries });
        set({ pluginEnabled: enabled });
    },

    applyBundle: (bundle) => {
        const settings = bundle.settings ?? DEFAULT_SUPDANCE_I18N_SETTINGS;
        const customEntries = bundle.customEntries ?? {};
        const pluginEnabled = Boolean(bundle.pluginEnabled);
        const entries = mergeI18nEntries(customEntries);
        const dictionary = compileI18nDictionary(entries);
        const nextLocale = useLocaleStore.getState().locale;
        const discoveredUntranslated = filterOutTranslatedDiscovered(get().discoveredUntranslated, dictionary);

        writeStoredCache({ pluginEnabled, settings, customEntries });
        writeStoredDiscovered(discoveredUntranslated);
        set({
            initialized: true,
            pluginEnabled,
            settings,
            customEntries,
            entries,
            dictionary,
            discoveredUntranslated,
            locale: nextLocale,
            revision: bundle.revision || settings.revision || "builtin-v1",
        });
    },

    updateLocalSettings: (settings) => {
        const nextLocale = useLocaleStore.getState().locale;
        writeStoredCache({
            pluginEnabled: get().pluginEnabled,
            settings,
            customEntries: get().customEntries,
        });
        set({
            settings,
            locale: nextLocale,
            revision: settings.revision || get().revision,
        });
    },

    upsertLocalEntries: (items) => {
        const nextCustom = { ...get().customEntries };
        for (const item of items) {
            if (!item?.key) continue;
            nextCustom[item.key] = item;
        }
        const entries = mergeI18nEntries(nextCustom);
        const dictionary = compileI18nDictionary(entries);
        const discoveredUntranslated = filterOutTranslatedDiscovered(get().discoveredUntranslated, dictionary);
        writeStoredCache({
            pluginEnabled: get().pluginEnabled,
            settings: get().settings,
            customEntries: nextCustom,
        });
        writeStoredDiscovered(discoveredUntranslated);
        set({
            customEntries: nextCustom,
            entries,
            dictionary,
            discoveredUntranslated,
            revision: `local-${Date.now()}`,
        });
    },

    removeLocalEntry: (key) => {
        const nextCustom = { ...get().customEntries };
        delete nextCustom[key];
        const entries = mergeI18nEntries(nextCustom);
        const dictionary = compileI18nDictionary(entries);
        writeStoredCache({
            pluginEnabled: get().pluginEnabled,
            settings: get().settings,
            customEntries: nextCustom,
        });
        set({
            customEntries: nextCustom,
            entries,
            dictionary,
            revision: `local-${Date.now()}`,
        });
    },

    recordUntranslatedText: (rawSourceText, route) => {
        if (get().locale === "zh-CN") return;
        const trimmed = rawSourceText.trim();
        if (!isCandidateUntranslatedChinese(trimmed)) return;
        const { dictionary, discoveredUntranslated } = get();
        if (translateSourceText(dictionary, trimmed, "en-US", "zh-CN") !== null) return;

        const now = new Date().toISOString();
        const activeRoute = route || (typeof window !== "undefined" ? window.location.pathname : "/");
        const existingIndex = discoveredUntranslated.findIndex((item) => item.sourceText === trimmed);
        if (existingIndex >= 0) {
            const existing = discoveredUntranslated[existingIndex]!;
            // Avoid noisy state churn if already recorded on this route recently
            if (existing.route === activeRoute && existing.count >= 1) return;
            const next = [...discoveredUntranslated];
            next[existingIndex] = {
                ...existing,
                route: activeRoute,
                count: existing.count + 1,
                lastSeenAt: now,
            };
            writeStoredDiscovered(next);
            set({ discoveredUntranslated: next });
            return;
        }

        if (discoveredUntranslated.length >= MAX_DISCOVERED_ITEMS) return;
        const next: SupDanceDiscoveredTextItem[] = [
            {
                sourceText: trimmed,
                route: activeRoute,
                count: 1,
                firstSeenAt: now,
                lastSeenAt: now,
            },
            ...discoveredUntranslated,
        ];
        writeStoredDiscovered(next);
        set({ discoveredUntranslated: next });
    },

    clearDiscoveredUntranslated: (sourceText) => {
        if (!sourceText) {
            writeStoredDiscovered([]);
            set({ discoveredUntranslated: [] });
            return;
        }
        const next = get().discoveredUntranslated.filter((item) => item.sourceText !== sourceText);
        writeStoredDiscovered(next);
        set({ discoveredUntranslated: next });
    },

    syncFromStorage: () => {
        const storedCache = readStoredCache();
        const settings = storedCache?.settings ?? get().settings;
        const customEntries = storedCache?.customEntries ?? get().customEntries;
        const pluginEnabled = typeof storedCache?.pluginEnabled === "boolean" ? storedCache.pluginEnabled : get().pluginEnabled;
        const entries = mergeI18nEntries(customEntries);
        const dictionary = compileI18nDictionary(entries);
        const locale = useLocaleStore.getState().locale;
        const discoveredUntranslated = filterOutTranslatedDiscovered(readStoredDiscovered(), dictionary);
        set({
            pluginEnabled,
            settings,
            customEntries,
            entries,
            dictionary,
            locale,
            discoveredUntranslated,
            revision: `storage-${Date.now()}`,
        });
    },
}));

registerSupDanceTranslations(useSupDanceI18nStore.getState().entries);
useSupDanceI18nStore.subscribe((state, previous) => {
    if (state.entries !== previous.entries) registerSupDanceTranslations(state.entries);
});
useLocaleStore.subscribe((state, previous) => {
    if (state.locale !== previous.locale) useSupDanceI18nStore.setState({ locale: state.locale });
});

/**
 * Checks if the supdance-i18n plugin is currently active across both the global plugin store
 * and the i18n bundle state.
 */
export function useSupDanceI18nEnabled(): boolean {
    const storePluginEnabled = useSupDanceI18nStore((s) => s.pluginEnabled);
    const platformAvailable = usePluginStore((state) => {
        const pluginState = state.pluginStates[SUPDANCE_I18N_PLUGIN_ID];
        if (pluginState) {
            if (typeof pluginState.platformAvailable === "boolean" && !pluginState.platformAvailable) {
                return false;
            }
            if (typeof pluginState.effectiveEnabled === "boolean") {
                return pluginState.effectiveEnabled;
            }
        }
        const installation = state.installations.find((item) => item.manifest.id === SUPDANCE_I18N_PLUGIN_ID);
        if (installation && typeof installation.enabled === "boolean") {
            return installation.enabled;
        }
        return true;
    });
    return storePluginEnabled && platformAvailable;
}

/**
 * Main i18n hook for components that want explicit key/text translation and locale switching.
 */

export function useI18n() {
    const { t: nativeT } = useTranslation();
    const nativeLocale = useLocaleStore((state) => state.locale);
    const dictionary = useSupDanceI18nStore((state) => state.dictionary);
    const settings = useSupDanceI18nStore((state) => state.settings);
    const locale = nativeLocale;
    const t = useMemo(
        () =>
            (key: string, params?: Record<string, string | number>, fallbackText?: string): string => {
                const entry = dictionary.byKey.get(key) ?? dictionary.bySourceText.get(key.trim());
                if (entry) return i18n.t(entry.key, { ...params, ns: SUPDANCE_TRANSLATION_NAMESPACE, keySeparator: false, lng: nativeLocale, defaultValue: fallbackText ?? key }) as string;
                for (const rule of dictionary.templateRules) {
                    const match = rule.regex.exec(key.trim());
                    if (!match) continue;
                    const values = Object.fromEntries(rule.paramNames.map((name, index) => [name, match[index + 1]]));
                    return i18n.t(rule.key, { ...values, ...params, ns: SUPDANCE_TRANSLATION_NAMESPACE, keySeparator: false, lng: nativeLocale, defaultValue: fallbackText ?? key }) as string;
                }
                return i18n.exists(key) ? (nativeT(key, params) as string) : (fallbackText ?? key);
            },
        [dictionary, nativeLocale, nativeT],
    );
    return { enabled: true, locale, settings, t, builtinCount: BUILTIN_I18N_ENTRIES.length };
}

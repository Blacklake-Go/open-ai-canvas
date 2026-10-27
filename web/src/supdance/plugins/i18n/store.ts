import { useMemo } from "react";
import { create } from "zustand";
import { usePluginStore } from "@/stores/use-plugin-store";
import { getAntdLocaleForCode } from "./engine/antd-locale";
import { compileI18nDictionary, translateByKey, translateSourceText, type CompiledI18nDictionary } from "./engine/translator";
import { BUILTIN_I18N_ENTRIES, DEFAULT_SUPDANCE_I18N_SETTINGS, mergeI18nEntries, SUPPORTED_LOCALE_CODES } from "./locales";
import { SUPDANCE_I18N_PLUGIN_ID, type SupDanceI18nEntry, type SupDanceI18nPublicBundle, type SupDanceI18nSettings, type SupDanceLanguageItem, type SupDanceLocaleCode } from "./types";

export const SUPDANCE_I18N_LOCALE_STORAGE_KEY = "supdance:i18n:locale";

function isValidLocaleCode(value: unknown): value is SupDanceLocaleCode {
    return typeof value === "string" && (SUPPORTED_LOCALE_CODES as readonly string[]).includes(value);
}

function matchBrowserLocale(enabledLanguages: SupDanceLanguageItem[]): SupDanceLocaleCode | null {
    if (typeof navigator === "undefined") return null;
    const enabledSet = new Set(enabledLanguages.filter((l) => l.enabled).map((l) => l.code));
    const candidates = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const raw of candidates) {
        if (!raw) continue;
        const normalized = raw.trim().toLowerCase();
        if (normalized.startsWith("zh-tw") || normalized.startsWith("zh-hk") || normalized.startsWith("zh-mo") || normalized.includes("hant")) {
            if (enabledSet.has("zh-TW")) return "zh-TW";
        }
        if (normalized.startsWith("zh")) {
            if (enabledSet.has("zh-CN")) return "zh-CN";
        }
        if (normalized.startsWith("en")) {
            if (enabledSet.has("en-US")) return "en-US";
        }
        if (normalized.startsWith("ja")) {
            if (enabledSet.has("ja-JP")) return "ja-JP";
        }
        if (normalized.startsWith("ko")) {
            if (enabledSet.has("ko-KR")) return "ko-KR";
        }
        if (normalized.startsWith("es")) {
            if (enabledSet.has("es-ES")) return "es-ES";
        }
    }
    return null;
}

function readStoredLocale(): SupDanceLocaleCode | null {
    if (typeof window === "undefined") return null;
    try {
        const stored = window.localStorage.getItem(SUPDANCE_I18N_LOCALE_STORAGE_KEY);
        return isValidLocaleCode(stored) ? stored : null;
    } catch {
        return null;
    }
}

function writeStoredLocale(locale: SupDanceLocaleCode): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(SUPDANCE_I18N_LOCALE_STORAGE_KEY, locale);
    } catch {
        // Ignore storage write errors in restricted privacy contexts
    }
}

function resolveEffectiveLocale(preferred: SupDanceLocaleCode | null, settings: SupDanceI18nSettings): SupDanceLocaleCode {
    const enabledCodes = new Set(settings.languages.filter((item) => item.enabled).map((item) => item.code));
    if (preferred && enabledCodes.has(preferred)) {
        return preferred;
    }
    if (settings.autoDetectBrowser) {
        const detected = matchBrowserLocale(settings.languages);
        if (detected && enabledCodes.has(detected)) {
            return detected;
        }
    }
    if (enabledCodes.has(settings.defaultLocale)) {
        return settings.defaultLocale;
    }
    const firstEnabled = settings.languages.find((item) => item.enabled)?.code;
    return firstEnabled ?? "zh-CN";
}

const initialEntries = mergeI18nEntries({});
const initialDictionary = compileI18nDictionary(initialEntries);
const initialLocale = resolveEffectiveLocale(readStoredLocale(), DEFAULT_SUPDANCE_I18N_SETTINGS);

export type SupDanceI18nStoreState = {
    initialized: boolean;
    pluginEnabled: boolean;
    locale: SupDanceLocaleCode;
    settings: SupDanceI18nSettings;
    customEntries: Record<string, SupDanceI18nEntry>;
    entries: SupDanceI18nEntry[];
    dictionary: CompiledI18nDictionary;
    revision: string;
    setLocale: (locale: SupDanceLocaleCode) => void;
    setPluginEnabled: (enabled: boolean) => void;
    applyBundle: (bundle: SupDanceI18nPublicBundle) => void;
    updateLocalSettings: (settings: SupDanceI18nSettings) => void;
    upsertLocalEntries: (items: SupDanceI18nEntry[]) => void;
    removeLocalEntry: (key: string) => void;
};

export const useSupDanceI18nStore = create<SupDanceI18nStoreState>((set, get) => ({
    initialized: false,
    pluginEnabled: true,
    locale: initialLocale,
    settings: DEFAULT_SUPDANCE_I18N_SETTINGS,
    customEntries: {},
    entries: initialEntries,
    dictionary: initialDictionary,
    revision: DEFAULT_SUPDANCE_I18N_SETTINGS.revision,

    setLocale: (nextLocale) => {
        const { settings } = get();
        const enabledCodes = new Set(settings.languages.filter((item) => item.enabled).map((item) => item.code));
        const resolved = enabledCodes.has(nextLocale) ? nextLocale : settings.defaultLocale;
        writeStoredLocale(resolved);
        set({ locale: resolved });
    },

    setPluginEnabled: (enabled) => {
        set({ pluginEnabled: enabled });
    },

    applyBundle: (bundle) => {
        const currentStored = readStoredLocale();
        const settings = bundle.settings ?? DEFAULT_SUPDANCE_I18N_SETTINGS;
        const customEntries = bundle.customEntries ?? {};
        const entries = mergeI18nEntries(customEntries);
        const dictionary = compileI18nDictionary(entries);
        const nextLocale = resolveEffectiveLocale(currentStored ?? get().locale, settings);

        set({
            initialized: true,
            pluginEnabled: Boolean(bundle.pluginEnabled),
            settings,
            customEntries,
            entries,
            dictionary,
            locale: nextLocale,
            revision: bundle.revision || settings.revision || "builtin-v1",
        });
    },

    updateLocalSettings: (settings) => {
        const currentStored = readStoredLocale();
        const nextLocale = resolveEffectiveLocale(currentStored ?? get().locale, settings);
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
        set({
            customEntries: nextCustom,
            entries,
            dictionary,
            revision: `local-${Date.now()}`,
        });
    },

    removeLocalEntry: (key) => {
        const nextCustom = { ...get().customEntries };
        delete nextCustom[key];
        const entries = mergeI18nEntries(nextCustom);
        const dictionary = compileI18nDictionary(entries);
        set({
            customEntries: nextCustom,
            entries,
            dictionary,
            revision: `local-${Date.now()}`,
        });
    },
}));

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
 * Hook returning the active Ant Design Locale object.
 * Automatically falls back to zh-CN when the plugin is disabled.
 */
export function useSupDanceAntdLocale() {
    const enabled = useSupDanceI18nEnabled();
    const locale = useSupDanceI18nStore((s) => s.locale);
    const effectiveLocale: SupDanceLocaleCode = enabled ? locale : "zh-CN";
    return useMemo(() => getAntdLocaleForCode(effectiveLocale), [effectiveLocale]);
}

/**
 * Main i18n hook for components that want explicit key/text translation and locale switching.
 */
export function useI18n() {
    const enabled = useSupDanceI18nEnabled();
    const locale = useSupDanceI18nStore((s) => s.locale);
    const settings = useSupDanceI18nStore((s) => s.settings);
    const dictionary = useSupDanceI18nStore((s) => s.dictionary);
    const setLocale = useSupDanceI18nStore((s) => s.setLocale);

    const effectiveLocale: SupDanceLocaleCode = enabled ? locale : "zh-CN";

    const enabledLanguages = useMemo(() => [...settings.languages].filter((item) => item.enabled).sort((a, b) => a.sortOrder - b.sortOrder), [settings.languages]);

    const currentLanguage = useMemo(
        () =>
            settings.languages.find((item) => item.code === effectiveLocale) ??
            settings.languages[0] ?? {
                code: "zh-CN" as const,
                name: "简体中文",
                nativeName: "简体中文",
                badge: "中",
                direction: "ltr" as const,
                enabled: true,
                sortOrder: 1,
            },
        [effectiveLocale, settings.languages],
    );

    const t = useMemo(() => {
        return (keyOrText: string, params?: Record<string, string | number>, fallbackText?: string): string => {
            if (!enabled) {
                return fallbackText ?? keyOrText;
            }
            if (dictionary.byKey.has(keyOrText)) {
                return translateByKey(dictionary, keyOrText, effectiveLocale, settings.fallbackLocale, params, fallbackText);
            }
            return translateSourceText(dictionary, keyOrText, effectiveLocale, settings.fallbackLocale) ?? fallbackText ?? keyOrText;
        };
    }, [dictionary, effectiveLocale, enabled, settings.fallbackLocale]);

    return {
        enabled,
        locale: effectiveLocale,
        currentLanguage,
        enabledLanguages,
        settings,
        setLocale,
        t,
        builtinCount: BUILTIN_I18N_ENTRIES.length,
    };
}

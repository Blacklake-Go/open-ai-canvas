import { useLayoutEffect } from "react";
import type { TOptions } from "i18next";
import { i18n, setTranslationOverride } from "@/i18n";
import { isAppLocale } from "@/i18n/locales";
import { useLocaleStore } from "@/stores/use-locale-store";
import { useSupDanceI18nEnabled, useSupDanceI18nStore } from "@/supdance/plugins/i18n/store";
import { translateByKey, translateSourceText } from "@/supdance/plugins/i18n/engine/translator";

let activeLocale = "zh-CN" as ReturnType<typeof useSupDanceI18nStore.getState>["locale"];
let activeEnabled = false;

setTranslationOverride((value: string, keys: string | string[], options: TOptions) => {
        if (!activeEnabled) return value;
        const state = useSupDanceI18nStore.getState();
        const key = Array.isArray(keys) ? keys[0] : keys;
        if (key && state.dictionary.byKey.has(key)) {
            const params = Object.fromEntries(Object.entries(options).filter(([, item]) => typeof item === "string" || typeof item === "number")) as Record<string, string | number>;
            return translateByKey(state.dictionary, key, activeLocale, state.settings.fallbackLocale, params);
        }
        const source = key ? i18n.getFixedT("zh-CN")(key, { ...options, lng: "zh-CN", postProcess: [] }) : value;
        return translateSourceText(state.dictionary, source, activeLocale, state.settings.fallbackLocale) ?? value;
});

export function useSupDanceUpstreamI18n() {
    const enabled = useSupDanceI18nEnabled();
    const locale = useSupDanceI18nStore((state) => state.locale);
    const dictionary = useSupDanceI18nStore((state) => state.dictionary);
    useLayoutEffect(() => {
        activeEnabled = enabled;
        activeLocale = enabled ? locale : "zh-CN";
        const upstreamLocale = isAppLocale(activeLocale) ? activeLocale : "zh-CN";
        useLocaleStore.getState().setLocale(upstreamLocale);
        if (i18n.language === upstreamLocale) i18n.emit("languageChanged", upstreamLocale);
        else void i18n.changeLanguage(upstreamLocale);
    }, [enabled, locale, dictionary]);
}

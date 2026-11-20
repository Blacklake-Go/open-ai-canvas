import { useEffect } from "react";
import { usePluginStore } from "@/stores/use-plugin-store";
import { getPublicSupDanceI18nBundle, invalidateI18nPublicReads } from "../api";
import { SUPDANCE_I18N_CACHE_STORAGE_KEY, SUPDANCE_I18N_DISCOVERED_STORAGE_KEY, useSupDanceI18nStore } from "../store";
import { SUPDANCE_I18N_PLUGIN_ID } from "../types";
import { useLocaleStore } from "@/stores/use-locale-store";

export function SupDanceI18nRuntimeHost() {
    const applyBundle = useSupDanceI18nStore((s) => s.applyBundle);
    const syncFromStorage = useSupDanceI18nStore((s) => s.syncFromStorage);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const controller = new AbortController();
        let syncing = false;
        let pending = false;

        const syncBundle = async () => {
            if (controller.signal.aborted) return;
            if (syncing) {
                pending = true;
                return;
            }
            syncing = true;
            try {
                const bundle = await getPublicSupDanceI18nBundle(controller.signal);
                if (!bundle) return;
                if (controller.signal.aborted) return;
                applyBundle(bundle);
                if (bundle.pluginEnabled) {
                    const { locale, setLocale } = useLocaleStore.getState();
                    const hasPreference = window.localStorage.getItem("yingce:locale") || window.localStorage.getItem("supdance:i18n:locale") || new URLSearchParams(window.location.search).get("lang");
                    if (locale !== bundle.settings.defaultLocale && (!hasPreference || !bundle.settings.languages.some((item) => item.enabled && item.code === locale))) setLocale(bundle.settings.defaultLocale);
                }
            } catch {
                // Keep built-in dictionary and local state when offline
            } finally {
                syncing = false;
                if (pending) {
                    pending = false;
                    void syncBundle();
                }
            }
        };

        void syncBundle();
        const unsubscribe = usePluginStore.subscribe((state, previous) => {
            const enabled = state.pluginStates[SUPDANCE_I18N_PLUGIN_ID]?.effectiveEnabled;
            if (typeof enabled === "boolean" && enabled !== previous.pluginStates[SUPDANCE_I18N_PLUGIN_ID]?.effectiveEnabled) {
                invalidateI18nPublicReads();
                useSupDanceI18nStore.getState().setPluginEnabled(enabled);
                void syncBundle();
            }
        });
        const onVisible = () => {
            if (document.visibilityState === "visible") void syncBundle();
        };
        const interval = window.setInterval(onVisible, 120000);
        window.addEventListener("focus", onVisible);
        window.addEventListener("online", onVisible);
        document.addEventListener("visibilitychange", onVisible);

        const handleStorage = (event: StorageEvent) => {
            if (event.key === SUPDANCE_I18N_CACHE_STORAGE_KEY) invalidateI18nPublicReads();
            if (event.key === SUPDANCE_I18N_CACHE_STORAGE_KEY || event.key === SUPDANCE_I18N_DISCOVERED_STORAGE_KEY) {
                syncFromStorage();
            }
        };

        window.addEventListener("storage", handleStorage);
        return () => {
            unsubscribe();
            controller.abort();
            window.clearInterval(interval);
            window.removeEventListener("focus", onVisible);
            window.removeEventListener("online", onVisible);
            document.removeEventListener("visibilitychange", onVisible);
            window.removeEventListener("storage", handleStorage);
        };
    }, [applyBundle, syncFromStorage]);

    return null;
}

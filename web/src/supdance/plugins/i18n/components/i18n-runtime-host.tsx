import { useEffect } from "react";
import { usePluginStore } from "@/stores/use-plugin-store";
import { getPublicSupDanceI18nBundle, invalidateI18nPublicReads } from "../api";
import { SUPDANCE_I18N_CACHE_STORAGE_KEY, SUPDANCE_I18N_DISCOVERED_STORAGE_KEY, useSupDanceI18nStore } from "../store";
import { SUPDANCE_I18N_PLUGIN_ID } from "../types";

export function SupDanceI18nRuntimeHost() {
    const applyBundle = useSupDanceI18nStore((s) => s.applyBundle);
    const syncFromStorage = useSupDanceI18nStore((s) => s.syncFromStorage);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const controller = new AbortController();
        let syncing = false;

        const syncBundle = async () => {
            if (syncing || controller.signal.aborted) return;
            syncing = true;
            try {
                const bundle = await getPublicSupDanceI18nBundle(controller.signal);
                if (!bundle) return;
                applyBundle(bundle);
                const pluginStore = usePluginStore.getState();
                const current = pluginStore.pluginStates[SUPDANCE_I18N_PLUGIN_ID];
                if (!current || current.platformAvailable !== bundle.pluginEnabled) {
                    usePluginStore.setState((state) => ({
                        pluginStates: {
                            ...state.pluginStates,
                            [SUPDANCE_I18N_PLUGIN_ID]: {
                                pluginId: SUPDANCE_I18N_PLUGIN_ID,
                                platformAvailable: bundle.pluginEnabled,
                                userEnabled: bundle.pluginEnabled,
                                userConfigured: true,
                                effectiveEnabled: bundle.pluginEnabled,
                                canToggle: false,
                                canConfigure: false,
                            },
                        },
                    }));
                }
            } catch {
                // Keep built-in dictionary and local state when offline
            } finally {
                syncing = false;
            }
        };

        void syncBundle();
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

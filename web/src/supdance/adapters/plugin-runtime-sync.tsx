import { useEffect } from "react";
import { fetchPluginRuntimeState, type PluginState } from "@/services/api/plugins";
import { http } from "@/services/api/request";
import { usePluginStore } from "@/stores/use-plugin-store";
import { useUserStore } from "@/stores/use-user-store";
import { startPluginStateSync } from "./plugin-state-sync";

export function SupDancePluginRuntimeSync() {
    const userId = useUserStore((state) => state.user?.id || "");
    useEffect(
        () =>
            startPluginStateSync(async (signal) => {
                if (userId) {
                    const runtime = await fetchPluginRuntimeState(signal);
                    if (signal.aborted || useUserStore.getState().user?.id !== userId) return;
                    usePluginStore.getState().setPluginStates(runtime.states);
                    usePluginStore.getState().setRuntimeStatuses(runtime.statuses);
                    return;
                }
                try {
                    const availability = await http.get<Record<string, boolean>>("/plugins/supdance/status", { signal });
                    if (signal.aborted || useUserStore.getState().user?.id) return;
                    const states: Record<string, PluginState> = {};
                    for (const [pluginId, available] of Object.entries(availability)) {
                        states[pluginId] = {
                            pluginId,
                            platformAvailable: available,
                            effectiveEnabled: available,
                            userEnabled: available,
                            userConfigured: false,
                            canToggle: false,
                            canConfigure: false,
                        };
                    }
                    usePluginStore.getState().setPluginStates(states);
                } catch {
                    if (signal.aborted || useUserStore.getState().user?.id) return;
                    const fallbackStates: Record<string, PluginState> = {
                        "supdance-social-auth": {
                            pluginId: "supdance-social-auth",
                            platformAvailable: true,
                            effectiveEnabled: true,
                            userEnabled: true,
                            userConfigured: false,
                            canToggle: false,
                            canConfigure: false,
                        },
                        "supdance-i18n": {
                            pluginId: "supdance-i18n",
                            platformAvailable: true,
                            effectiveEnabled: true,
                            userEnabled: true,
                            userConfigured: false,
                            canToggle: false,
                            canConfigure: false,
                        },
                    };
                    usePluginStore.getState().setPluginStates(fallbackStates);
                }
            }),
        [userId],
    );
    return null;
}

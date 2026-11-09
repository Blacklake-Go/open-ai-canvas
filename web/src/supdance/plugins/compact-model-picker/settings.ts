import { useQuery } from "@tanstack/react-query";
import { appQueryClient } from "@/lib/query-client";
import { http } from "@/services/api/request";
import { PLUGIN_STATE_CHANGED_EVENT, PLUGIN_STATE_REVISION_KEY } from "@/supdance/adapters/plugin-state-sync";

export type CompactPickerSettings = { enabled: boolean; showDescription: boolean; showPrice: boolean; showInspirations: boolean };
export const COMPACT_PICKER_ID = "supdance-compact-model-picker";
export const COMPACT_PICKER_ADMIN_ROUTE = "/admin/plugins/compact-model-picker";
export const compactPublicKey = [COMPACT_PICKER_ID, "public"] as const;
export const compactAdminKey = [COMPACT_PICKER_ID, "admin"] as const;
const publicPath = "/supdance/compact-model-picker/settings";
const adminPath = "/admin" + publicPath;
export const compactSettingsStorageKey = "supdance:compact-picker:settings:v1";
const compactDefaults: CompactPickerSettings = { enabled: true, showDescription: true, showPrice: true, showInspirations: false };

function parseSettings(value: unknown): CompactPickerSettings {
    if (!value || typeof value !== "object" || !("enabled" in value) || !("showDescription" in value) || !("showPrice" in value) || typeof value.enabled !== "boolean" || typeof value.showDescription !== "boolean" || typeof value.showPrice !== "boolean") {
        throw new Error("Invalid model picker display settings");
    }
    const showInspirations = "showInspirations" in value && typeof value.showInspirations === "boolean" ? value.showInspirations : false;
    return { enabled: value.enabled, showDescription: value.showDescription, showPrice: value.showPrice, showInspirations };
}

function cachedSettings() {
    try {
        const stored = localStorage.getItem(compactSettingsStorageKey);
        return stored ? parseSettings(JSON.parse(stored)) : undefined;
    } catch {
        console.warn("Ignoring unreadable model picker display settings");
        return undefined;
    }
}

function remember(settings: CompactPickerSettings) {
    try {
        localStorage.setItem(compactSettingsStorageKey, JSON.stringify(settings));
    } catch {
        console.warn("Unable to persist the model picker display settings");
    }
    return settings;
}

async function publishSettings(settings: CompactPickerSettings) {
    // An older in-flight read must not overwrite an acknowledged administrator save.
    await appQueryClient.cancelQueries({ queryKey: compactPublicKey });
    appQueryClient.setQueryData(compactPublicKey, remember(parseSettings(settings)));
}

export async function applyCompactPickerAvailability(enabled: boolean) {
    const current = appQueryClient.getQueryData<CompactPickerSettings>(compactPublicKey) ?? cachedSettings() ?? compactDefaults;
    await publishSettings({ ...current, enabled });
}

// This is site-wide public presentation policy, not account-scoped user data.
// Keep one listener for the page lifetime, including gaps between routed pickers.
if (typeof window !== "undefined") {
    const refresh = () => {
        void appQueryClient.invalidateQueries({ queryKey: compactPublicKey });
    };
    const storage = (event: StorageEvent) => {
        if (event.key === PLUGIN_STATE_REVISION_KEY) refresh();
        if (event.key !== compactSettingsStorageKey || !event.newValue) return;
        try {
            const settings = parseSettings(JSON.parse(event.newValue));
            void appQueryClient.cancelQueries({ queryKey: compactPublicKey }).then(() => appQueryClient.setQueryData(compactPublicKey, settings));
        } catch {
            console.warn("Ignoring invalid model picker display settings from another tab");
        }
    };
    window.addEventListener(PLUGIN_STATE_CHANGED_EVENT, refresh);
    window.addEventListener("storage", storage);
    import.meta.hot?.dispose(() => {
        window.removeEventListener(PLUGIN_STATE_CHANGED_EVENT, refresh);
        window.removeEventListener("storage", storage);
    });
}

export function useCompactPickerSettings() {
    const result = useQuery(
        {
            queryKey: compactPublicKey,
            queryFn: async ({ signal }) => {
                try {
                    const settings = parseSettings(await http.get<CompactPickerSettings>(publicPath, { signal }));
                    if (signal.aborted) throw new DOMException("Model picker settings read cancelled", "AbortError");
                    return remember(settings);
                } catch (error) {
                    if (!signal.aborted) console.warn("Model picker settings refresh failed; retaining the last confirmed appearance");
                    throw error;
                }
            },
            // Never seed native mode from a possibly stale disabled cache. A cold
            // client waits for confirmation instead of painting the wrong menu.
            initialData: () => {
                const cached = cachedSettings();
                return cached?.enabled ? cached : undefined;
            },
            initialDataUpdatedAt: 0,
            staleTime: 30_000,
            refetchOnWindowFocus: "always",
        },
        appQueryClient,
    );
    return {
        ...(result.data ?? compactDefaults),
        status: result.data ? "ready" : result.isError ? "error" : "loading",
        reload: () => {
            void result.refetch();
        },
    };
}

export const readAdminSettings = (signal: AbortSignal) => http.get<CompactPickerSettings>(adminPath, { signal });
export const saveAdminSettings = async (settings: CompactPickerSettings) => {
    const saved = parseSettings(await http.put<CompactPickerSettings>(adminPath, settings));
    await publishSettings(saved);
    return saved;
};

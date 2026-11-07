import { useQuery } from "@tanstack/react-query";
import { appQueryClient } from "@/lib/query-client";
import { http } from "@/services/api/request";

export type CompactPickerSettings = { enabled: boolean; showDescription: boolean; showPrice: boolean };
export const COMPACT_PICKER_ID = "supdance-compact-model-picker";
export const COMPACT_PICKER_ADMIN_ROUTE = "/admin/plugins/compact-model-picker";
export const compactPublicKey = [COMPACT_PICKER_ID, "public"] as const;
export const compactAdminKey = [COMPACT_PICKER_ID, "admin"] as const;
const publicPath = "/supdance/compact-model-picker/settings";
const adminPath = "/admin" + publicPath;
const nativeFallback: CompactPickerSettings = { enabled: false, showDescription: false, showPrice: false };

export function useCompactPickerSettings(open: boolean) {
    const result = useQuery(
        {
            queryKey: compactPublicKey,
            queryFn: ({ signal }) => http.get<CompactPickerSettings>(publicPath, { signal }),
            enabled: open,
            staleTime: 0,
            refetchOnWindowFocus: true,
        },
        appQueryClient,
    );
    return result.isError ? nativeFallback : (result.data ?? nativeFallback);
}

export const readAdminSettings = (signal: AbortSignal) => http.get<CompactPickerSettings>(adminPath, { signal });
export const saveAdminSettings = (settings: CompactPickerSettings) => http.put<CompactPickerSettings>(adminPath, settings);

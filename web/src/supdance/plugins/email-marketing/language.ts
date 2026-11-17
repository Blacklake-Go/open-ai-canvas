import type { AppLocale } from "@/i18n/locales";
import type { LocalUser } from "@/services/api/auth";
import { invalidateAuthSessionCache } from "@/services/api/auth";
import { http } from "@/services/api/request";
import { useUserStore } from "@/stores/use-user-store";

let writes: Promise<void> = Promise.resolve();
export async function savePreferredLanguage(locale: AppLocale) {
    const current = useUserStore.getState().user;
    if (!current) return;
    const write = writes
        .catch(() => undefined)
        .then(async () => {
            if (useUserStore.getState().user?.id !== current.id) throw new DOMException("Account changed", "AbortError");
            const result = await http.put<{ user: LocalUser }>("/auth/email-center/language", { locale });
            const latest = useUserStore.getState().user;
            if (!latest || latest.id !== current.id || result.user.id !== current.id) throw new DOMException("Account changed", "AbortError");
            useUserStore.getState().setUser({ ...latest, ...result.user });
            invalidateAuthSessionCache();
        });
    writes = write;
    return write;
}

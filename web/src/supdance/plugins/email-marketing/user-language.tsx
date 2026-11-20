import { useEffect, useState } from "react";
import { App, Button, Select } from "antd";
import { isAppLocale } from "@/i18n/locales";
import { useSiteLanguages } from "@/supdance/plugins/i18n/store";
import { useLocaleStore } from "@/stores/use-locale-store";
import { useUserStore } from "@/stores/use-user-store";
import { languageText } from "./language-messages";
import { savePreferredLanguage } from "./language";

export function UserLanguageSync() {
    const languages = useSiteLanguages();
    const user = useUserStore((state) => state.user);
    const { message } = App.useApp();
    useEffect(() => {
        if (!user) return;
        const current = useLocaleStore.getState().locale;
        if (isAppLocale(user.preferredLocale)) {
            if (current !== user.preferredLocale && languages.some((item) => item.code === user.preferredLocale)) {
                useLocaleStore.getState().setLocale(user.preferredLocale);
                window.location.reload();
            }
        } else {
            void savePreferredLanguage(current).catch((error: unknown) => {
                if (!(error instanceof DOMException && error.name === "AbortError")) message.warning(languageText(current, "languageError"));
            });
        }
    }, [user?.id, user?.preferredLocale, languages]);
    return null;
}

export function UserLanguagePreference() {
    const languages = useSiteLanguages();
    const locale = useLocaleStore((state) => state.locale);
    const user = useUserStore((state) => state.user);
    const { message } = App.useApp();
    const [value, setValue] = useState(isAppLocale(user?.preferredLocale) ? user.preferredLocale : locale);
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        setValue(isAppLocale(user?.preferredLocale) && languages.some((item) => item.code === user?.preferredLocale) ? user.preferredLocale : locale);
    }, [user?.id, user?.preferredLocale, locale, languages]);
    const save = async () => {
        setBusy(true);
        try {
            await savePreferredLanguage(value);
            message.success(languageText(locale, "languageSaved"));
        } catch {
            message.error(languageText(locale, "languageError"));
        } finally {
            setBusy(false);
        }
    };
    return (
        <section className="grid gap-3" aria-label={languageText(locale, "language")}>
            <h3>{languageText(locale, "language")}</h3>
            <p>{languageText(locale, "languageHelp")}</p>
            <Select aria-label={languageText(locale, "language")} value={value} disabled={busy} onChange={setValue} options={languages.map((item) => ({ value: item.code, label: item.label }))} />
            <Button loading={busy} disabled={!user || value === user.preferredLocale} onClick={() => void save()}>
                {languageText(locale, "saveLanguage")}
            </Button>
        </section>
    );
}

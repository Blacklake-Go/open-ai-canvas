import { useEffect } from "react";
import { SUPPORTED_LOCALES, type AppLocale } from "@/i18n/locales";
import { PUBLIC_CHROME } from "./refund";

export function publicChrome(key: keyof typeof PUBLIC_CHROME, locale: AppLocale): string {
    return PUBLIC_CHROME[key][SUPPORTED_LOCALES.findIndex(({ code }) => code === locale)] ?? PUBLIC_CHROME[key][1];
}

export function localizeSocialLabel(label: string, locale: AppLocale) {
    return label.replace("QQ 交流群", publicChrome("qqGroup", locale)).replace("SupDance 官方群", publicChrome("qqOfficial", locale)).replace("小红书 (RED)", publicChrome("red", locale));
}

export function usePublicTitle(heading?: string) {
    useEffect(() => {
        if (!heading) return;
        const previous = document.title;
        const title = `${heading} · SupDance`;
        document.title = title;
        return () => {
            if (document.title === title) document.title = previous;
        };
    }, [heading]);
}

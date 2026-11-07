import { Button } from "antd";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AppModal } from "@/components/ui/product/app-modal";
import { useI18n } from "@/supdance/plugins/i18n";
import { loadXPixel, MARKETING_CONSENT_KEY, setMarketingConsent } from "./x-purchase";

const OPEN_PREFERENCES = "supdance:marketing-preferences";

export function MarketingPreferencesButton() {
    const { t } = useI18n();
    return (
        <Button className="min-h-11" onClick={() => window.dispatchEvent(new Event(OPEN_PREFERENCES))}>
            {t("marketing.manage")}
        </Button>
    );
}

export function MarketingConsentHost({ navigation }: { navigation: { subscribe: (callback: () => void) => () => void } }) {
    const { t } = useI18n();
    const url = useSyncExternalStore(
        (callback) => navigation.subscribe(callback),
        () => window.location.href,
    );
    const [open, setOpen] = useState(false);
    useEffect(() => {
        const show = () => setOpen(true);
        window.addEventListener(OPEN_PREFERENCES, show);
        return () => window.removeEventListener(OPEN_PREFERENCES, show);
    }, []);
    useEffect(() => {
        const location = new URL(url);
        if (location.pathname.startsWith("/admin")) return;
        try {
            const choice = localStorage.getItem(MARKETING_CONSENT_KEY);
            if (!choice && (location.searchParams.get("utm_source") === "x" || location.searchParams.has("twclid"))) setOpen(true);
            if (choice === "accepted") void loadXPixel();
        } catch {
            /* Tracking stays disabled when storage is unavailable. */
        }
    }, [url]);
    const choose = (accepted: boolean) => {
        setMarketingConsent(accepted);
        setOpen(false);
        if (accepted) void loadXPixel();
    };
    return (
        <AppModal
            open={open}
            title={t("marketing.title")}
            onCancel={() => choose(false)}
            footer={
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button className="min-h-11" size="large" onClick={() => choose(false)}>
                        {t("marketing.decline")}
                    </Button>
                    <Button className="min-h-11" size="large" type="primary" onClick={() => choose(true)}>
                        {t("marketing.accept")}
                    </Button>
                </div>
            }
        >
            <p>{t("marketing.description")}</p>
            <a href="/privacy">{t("marketing.privacy")}</a>
        </AppModal>
    );
}

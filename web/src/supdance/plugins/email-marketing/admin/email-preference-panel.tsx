import { Alert, App, Button } from "antd";
import { useEffect, useState } from "react";
import { useI18n } from "@/supdance/plugins/i18n";
import { getEmailPreference, setEmailPreference } from "../api";

export function EmailPreferencePanel() {
    const { t } = useI18n();
    const label = (key: string) => t(`email.center.${key}`);
    const { message } = App.useApp();
    const [subscribed, setSubscribed] = useState<boolean>();
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        getEmailPreference()
            .then((result) => setSubscribed(result.marketing))
            .catch((err: unknown) => setError(err instanceof Error ? err.message : label("failed")));
    }, []);
    const update = async (value: boolean) => {
        setBusy(true);
        try {
            await setEmailPreference(value);
            setSubscribed(value);
            message.success(label("saved"));
        } catch (err) {
            message.error(err instanceof Error ? err.message : label("failed"));
        } finally {
            setBusy(false);
        }
    };
    return (
        <section className="email-center-module">
            <h2>{label("ownPreference")}</h2>
            {error && <Alert type="error" title={error} />}
            <p>{label(subscribed ? "optedIn" : "optedOut")}</p>
            <Button loading={busy} disabled={subscribed === undefined} onClick={() => update(!subscribed)}>
                {label(subscribed ? "unsubscribe" : "subscribe")}
            </Button>
        </section>
    );
}

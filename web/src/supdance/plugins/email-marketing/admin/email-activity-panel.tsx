import { Alert } from "antd";
import { useEffect, useState } from "react";
import { useI18n } from "@/supdance/plugins/i18n";
import { listEmailActivity } from "../api";

export function EmailActivityPanel() {
    const { t } = useI18n();
    const [rows, setRows] = useState<Awaited<ReturnType<typeof listEmailActivity>>>([]);
    const [error, setError] = useState("");
    useEffect(() => {
        listEmailActivity()
            .then(setRows)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : t("email.center.failed")));
    }, []);
    return (
        <section className="email-center-module">
            <h2>{t("email.center.audit")}</h2>
            {error && <Alert type="error" title={error} />}
            <ul>
                {rows.map((row) => (
                    <li key={row.id}>
                        {new Date(row.createdAt).toLocaleString()} · {row.action} · {row.targetId}
                    </li>
                ))}
            </ul>
            {!rows.length && <p>{t("email.center.empty")}</p>}
        </section>
    );
}

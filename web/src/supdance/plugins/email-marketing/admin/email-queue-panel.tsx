import { Alert, Button } from "antd";
import { useEffect, useState } from "react";
import { useI18n } from "@/supdance/plugins/i18n";
import { listEmailQueue } from "../api";

export function EmailQueuePanel() {
    const { t } = useI18n();
    const label = (key: string) => t(`email.center.${key}`);
    const [rows, setRows] = useState<Awaited<ReturnType<typeof listEmailQueue>>>([]);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const load = async () => {
        setBusy(true);
        try {
            setRows(await listEmailQueue());
            setError("");
        } catch (err) {
            setError(err instanceof Error ? err.message : label("failed"));
        } finally {
            setBusy(false);
        }
    };
    useEffect(() => {
        void load();
    }, []);
    return (
        <section className="email-center-panel">
            <div className="email-center-actions">
                <h2>{label("queue")}</h2>
                <Button loading={busy} onClick={load}>
                    {label("refresh")}
                </Button>
            </div>
            {error && <Alert type="error" title={error} />}
            <table>
                <thead>
                    <tr>
                        <th>{label("recipient")}</th>
                        <th>{label("state")}</th>
                        <th>{label("attempts")}</th>
                        <th>{label("nextAttempt")}</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.id}>
                            <td>{row.recipient}</td>
                            <td>{row.status}</td>
                            <td>{row.attempts}</td>
                            <td>{["pending", "retrying"].includes(row.status) ? new Date(row.nextAttemptAt).toLocaleString() : "—"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {!rows.length && <p>{label("empty")}</p>}
        </section>
    );
}

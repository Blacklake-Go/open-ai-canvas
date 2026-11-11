import { useEffect, useState } from "react";
import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { http } from "@/services/api/request";

export default function ConnectOnePage() {
    const { t } = useTranslation();
    const [request] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("request") || "");
    const [accounts, setAccounts] = useState<{ oneUserId: string; mainUserId: string; mainDisplayName: string; purpose: string }>();
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        window.history.replaceState(null, "", window.location.pathname);
        if (!request) return;
        let current = true;
        void http
            .post<typeof accounts>("/supdance/federation/link", { request })
            .then((value) => {
                if (current) setAccounts(value);
            })
            .catch((reason: unknown) => {
                if (current) setError(reason instanceof Error ? reason.message : t("federation.failed"));
            });
        return () => {
            current = false;
        };
    }, [request, t]);
    async function confirm(values: { password?: string }) {
        setBusy(true);
        setError("");
        try {
            const result = await http.post<{ assertion: string }>("/supdance/federation/link", { request, password: values.password || "", confirm: true });
            const form = document.createElement("form");
            form.method = "POST";
            form.action = accounts?.purpose === "login-request" ? "https://one.supdance.com/api/federation/login/complete" : "https://one.supdance.com/api/federation/link/complete";
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = "assertion";
            input.value = result.assertion;
            form.append(input);
            document.body.append(form);
            form.submit();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : t("federation.failed"));
            setBusy(false);
        }
    }
    return (
        <main className="mx-auto w-full max-w-xl p-4 sm:p-6">
            <Card title={t("federation.title")}>
                <Typography.Paragraph>{t(accounts?.purpose === "login-request" ? "federation.loginIntro" : "federation.intro")}</Typography.Paragraph>
                {error && <Alert type="error" title={error} showIcon className="mb-4" />}
                {!request && <Alert type="warning" title={t("federation.missing")} showIcon />}
                {accounts && (
                    <>
                        {accounts.purpose !== "login-request" && (
                            <Typography.Paragraph>
                                {t("federation.one")}: <Typography.Text code>{accounts.oneUserId}</Typography.Text>
                            </Typography.Paragraph>
                        )}
                        <Typography.Paragraph>
                            {t("federation.main")}: {accounts.mainDisplayName} <Typography.Text code>{accounts.mainUserId}</Typography.Text>
                        </Typography.Paragraph>
                        <Form layout="vertical" onFinish={confirm}>
                            {accounts.purpose !== "login-request" && (
                                <Form.Item label={t("federation.password")} name="federation.password" extra={t("federation.passwordHint")}>
                                    <Input.Password autoComplete="current-password" maxLength={200} />
                                </Form.Item>
                            )}
                            <Button type="primary" htmlType="submit" loading={busy} block>
                                {t(accounts.purpose === "login-request" ? "federation.continueLogin" : "federation.confirm")}
                            </Button>
                        </Form>
                    </>
                )}
                <Button href="/" type="link" className="mt-4">
                    {t("federation.cancel")}
                </Button>
            </Card>
        </main>
    );
}

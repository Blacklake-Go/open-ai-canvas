import { useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Spin, Typography } from "antd";
import { Link, useNavigate } from "react-router";
import { AuthPanel } from "@/components/auth/auth-panel";
import { AppModal } from "@/components/ui/product/app-modal";
import type { AuthView } from "@/lib/auth-entry";
import { useUserStore } from "@/stores/use-user-store";
import { useI18n } from "@/supdance/plugins/i18n";
import { isCanvasImportMedia, parseCanvasImportRequest, requestCanvasImportOffer, saveCanvasImport } from "./canvas-media-import";

export default function CanvasMediaImportPage() {
    const { t } = useI18n();
    const navigate = useNavigate();
    const user = useUserStore((state) => state.user);
    const hydrated = useUserStore((state) => state.hydrated);
    const [request] = useState(() => parseCanvasImportRequest(window.location.hash));
    const [authView, setAuthView] = useState<AuthView | null>(null);
    const [kind, setKind] = useState<"image" | "video" | "audio">();
    const [expired, setExpired] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(false);
    const port = useRef<MessagePort>(null);
    const attempt = useRef<{ signal: AbortController; timer: number }>(null);
    const media = useRef<{ blob: Blob; title: string }>(null);
    const authorizedRecipient = useRef<string>(null);

    useEffect(() => {
        if (!request) {
            window.opener = null;
            setExpired(true);
            return;
        }
        let current = true;
        void requestCanvasImportOffer(request).then((offer) => {
            if (!current) return;
            if (offer) {
                port.current = offer.port;
                setKind(offer.kind);
            } else {
                setExpired(true);
            }
        });
        return () => {
            current = false;
            if (!attempt.current) return;
            attempt.current?.signal.abort();
            window.clearTimeout(attempt.current?.timer);
            port.current?.postMessage({ phase: "cancel" });
            port.current?.close();
        };
    }, [request]);

    useEffect(() => {
        if (!authorizedRecipient.current || authorizedRecipient.current === user?.id) return;
        attempt.current?.signal.abort();
        window.clearTimeout(attempt.current?.timer);
        attempt.current = null;
        media.current = null;
        port.current?.postMessage({ phase: "cancel" });
        port.current?.close();
        setBusy(false);
        setExpired(true);
    }, [user?.id]);

    function startImport() {
        if (!user || !kind || !request || !port.current || attempt.current) return;
        const connection = port.current;
        const signal = new AbortController();
        const recipient = user.id;
        authorizedRecipient.current = recipient;
        const finish = (failed: boolean) => {
            window.clearTimeout(attempt.current?.timer);
            if (attempt.current?.signal !== signal) return;
            attempt.current = null;
            setBusy(false);
            setError(failed);
        };
        const save = async (received: { blob: Blob; title: string }) => {
            window.clearTimeout(attempt.current?.timer);
            try {
                const id = await saveCanvasImport({ ...received, id: request.id, kind, recipient, signal: signal.signal });
                connection.postMessage({ phase: "complete" });
                finish(false);
                navigate(`/canvas/${id}`, { replace: true });
            } catch {
                if (!signal.signal.aborted) finish(true);
            }
        };
        setError(false);
        setBusy(true);
        attempt.current = { signal, timer: window.setTimeout(() => finish(true), 45000) };
        if (media.current) {
            void save(media.current);
            return;
        }
        connection.onmessage = ({ data }) => {
            if (attempt.current?.signal !== signal) return;
            if (data?.phase === "unavailable") finish(true);
            if (data?.phase !== "media") return;
            if (!isCanvasImportMedia(data.blob, kind)) {
                finish(true);
                return;
            }
            media.current = { blob: data.blob, title: typeof data.title === "string" ? data.title.trim().slice(0, 100) || t("federation.canvasImportTitle") : t("federation.canvasImportTitle") };
            connection.onmessage = null;
            void save(media.current);
        };
        connection.postMessage({ phase: "request" });
    }

    return (
        <main className="mx-auto w-full max-w-xl p-4 sm:p-6">
            <Card title={t("federation.canvasImportTitle")}>
                {expired ? (
                    <Alert type="warning" title={t("federation.canvasImportExpired")} showIcon />
                ) : !kind || !hydrated ? (
                    <div role="status" className="flex items-center gap-3">
                        <Spin size="small" />
                        <span>{t("federation.canvasImportWaiting")}</span>
                    </div>
                ) : !user ? (
                    <Button type="primary" size="large" onClick={() => setAuthView("login")}>
                        {t("federation.canvasImportSignIn")}
                    </Button>
                ) : (
                    <>
                        <Typography.Paragraph>{t("federation.canvasImportRecipient", { account: user.displayName || user.username })}</Typography.Paragraph>
                        {error && <Alert className="mb-4" type="error" title={t("federation.canvasImportFailed")} showIcon />}
                        <Button type="primary" size="large" loading={busy} onClick={startImport}>
                            {t("federation.canvasImportConfirm")}
                        </Button>
                    </>
                )}
                {!busy && (
                    <p className="mb-0 mt-4">
                        <Link to="/canvas" onClick={() => port.current?.postMessage({ phase: "cancel" })}>
                            {t("federation.canvasImportBack")}
                        </Link>
                    </p>
                )}
            </Card>
            {authView && !user && (
                <AppModal centered open title={t("federation.canvasImportSignIn")} onCancel={() => setAuthView(null)} footer={null}>
                    <AuthPanel variant="dialog" view={authView} onViewChange={setAuthView} next={window.location.pathname + window.location.hash} onAuthenticated={() => setAuthView(null)} />
                </AppModal>
            )}
        </main>
    );
}

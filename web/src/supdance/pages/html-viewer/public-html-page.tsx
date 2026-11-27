import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, ExternalLink, FileCode, RefreshCw } from "lucide-react";

import { fetchPublicHtmlPageBySlug } from "@/supdance/plugins/html-page-manager/api";
import type { ManagedHtmlPage } from "@/supdance/plugins/html-page-manager/types";
import { useLocaleStore } from "@/stores/use-locale-store";
import { publicChrome, usePublicTitle } from "../public-copy/public-page";

export default function PublicHtmlViewerPage({ fixedSlug }: { fixedSlug?: string }) {
    const params = useParams<{ slug: string }>();
    const slug = fixedSlug ?? params.slug;
    const locale = useLocaleStore((state) => state.locale);
    const [page, setPage] = useState<ManagedHtmlPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [frameTitle, setFrameTitle] = useState<string>();
    const frameRef = useRef<HTMLIFrameElement>(null);
    usePublicTitle(frameTitle?.replace(/ · SupDance$/, ""));

    useEffect(() => {
        const updateTitle = () => setFrameTitle(frameRef.current?.contentDocument?.title);
        window.addEventListener("supdance:managed-title", updateTitle);
        return () => window.removeEventListener("supdance:managed-title", updateTitle);
    }, []);

    const loadPage = async () => {
        if (!slug) return;
        setFrameTitle(undefined);
        setLoading(true);
        setError(null);
        try {
            const data = await fetchPublicHtmlPageBySlug(slug);
            setPage(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "页面不存在或未公开");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadPage();
    }, [slug]);

    if (loading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="size-6 animate-spin text-sky-500" />
                    <span className="font-mono text-xs text-muted-foreground">{publicChrome("loading", locale)}</span>
                </div>
            </div>
        );
    }

    if (error || !page) {
        return (
            <div className="flex h-screen w-screen flex-col items-center justify-center bg-background p-6 text-center text-foreground font-sans">
                <div className="size-12 rounded-2xl bg-[var(--button-danger-soft-bg)] text-[var(--status-error)] flex items-center justify-center mb-4">
                    <FileCode className="size-6" />
                </div>
                <h1 className="text-xl font-semibold mb-2">{publicChrome("missing", locale)}</h1>
                <p className="text-xs text-muted-foreground max-w-md mb-6">{publicChrome("unavailable", locale)}</p>
                <div className="flex items-center gap-3">
                    <Link to="/legal" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors no-underline">
                        <ArrowLeft className="size-3.5" />
                        {publicChrome("legal", locale)}
                    </Link>
                    <Link
                        to="/"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--button-primary-bg)] px-3 py-1.5 text-xs font-medium text-[var(--button-primary-fg)] hover:bg-[var(--button-primary-hover-bg)] transition-colors no-underline"
                    >
                        {publicChrome("home", locale)}
                    </Link>
                </div>
            </div>
        );
    }

    // 直接满屏渲染沙箱自包含 HTML 页面
    return (
        <div
            className="legal-public-page bg-background relative"
            style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                overflow: "hidden",
            }}
        >
            <iframe
                ref={frameRef}
                title={frameTitle ?? page.title}
                srcDoc={page.html}
                onLoad={({ currentTarget }) => setFrameTitle(currentTarget.contentDocument?.title)}
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                className="h-full w-full border-0 bg-transparent block"
                style={{ width: "100%", height: "100%", border: "none" }}
            />
        </div>
    );
}

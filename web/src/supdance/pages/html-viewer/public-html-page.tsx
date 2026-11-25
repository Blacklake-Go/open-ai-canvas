import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, ExternalLink, FileCode, RefreshCw } from "lucide-react";

import { fetchPublicHtmlPageBySlug } from "@/supdance/plugins/html-page-manager/api";
import type { ManagedHtmlPage } from "@/supdance/plugins/html-page-manager/types";

export default function PublicHtmlViewerPage() {
    const { slug } = useParams<{ slug: string }>();
    const [page, setPage] = useState<ManagedHtmlPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadPage = async () => {
        if (!slug) return;
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
                    <span className="font-mono text-xs text-muted-foreground">LOADING HTML PAGE...</span>
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
                <h1 className="text-xl font-semibold mb-2">未找到该 HTML 页面</h1>
                <p className="text-xs text-muted-foreground max-w-md mb-6">{error || "页面可能已被管理员撤下或路径错误。"}</p>
                <div className="flex items-center gap-3">
                    <Link to="/legal" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors no-underline">
                        <ArrowLeft className="size-3.5" />
                        返回法务中心
                    </Link>
                    <Link
                        to="/"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--button-primary-bg)] px-3 py-1.5 text-xs font-medium text-[var(--button-primary-fg)] hover:bg-[var(--button-primary-hover-bg)] transition-colors no-underline"
                    >
                        回到主站
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
            <iframe title={page.title} srcDoc={page.html} sandbox="allow-scripts allow-same-origin allow-popups allow-forms" className="h-full w-full border-0 bg-transparent block" style={{ width: "100%", height: "100%", border: "none" }} />
        </div>
    );
}

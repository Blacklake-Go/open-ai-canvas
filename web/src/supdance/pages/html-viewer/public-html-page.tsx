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
            <div className="flex h-screen w-screen items-center justify-center bg-black text-white">
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="size-6 animate-spin text-sky-400" />
                    <span className="font-mono text-xs text-[#8a8f98]">LOADING HTML PAGE...</span>
                </div>
            </div>
        );
    }

    if (error || !page) {
        return (
            <div className="flex h-screen w-screen flex-col items-center justify-center bg-black p-6 text-center text-white font-sans">
                <div className="size-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mb-4">
                    <FileCode className="size-6" />
                </div>
                <h1 className="text-xl font-semibold mb-2">未找到该 HTML 页面</h1>
                <p className="text-xs text-[#8a8f98] max-w-md mb-6">{error || "页面可能已被管理员撤下或路径错误。"}</p>
                <div className="flex items-center gap-3">
                    <Link to="/legal" className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white hover:bg-white/10 transition-colors no-underline">
                        <ArrowLeft className="size-3.5" />
                        返回法务中心
                    </Link>
                    <Link to="/" className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-black hover:bg-white/90 transition-colors no-underline">
                        回到主站
                    </Link>
                </div>
            </div>
        );
    }

    // 直接满屏渲染沙箱自包含 HTML 页面
    return (
        <div className="legal-public-page h-full w-full h-dvh bg-black overflow-hidden relative">
            <iframe title={page.title} srcDoc={page.html} sandbox="allow-scripts allow-same-origin allow-popups allow-forms" className="h-full w-full border-0 bg-transparent" />
        </div>
    );
}

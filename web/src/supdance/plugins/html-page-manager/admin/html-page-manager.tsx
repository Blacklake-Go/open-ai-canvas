import { Alert, App, Button, Spin, Tag, Tooltip } from "antd";
import { AdminSwitch as Switch } from "@/pages/admin/ui/controls";
import {
    ArrowLeft,
    Code2,
    Columns2,
    Copy,
    Download,
    ExternalLink,
    Eye,
    FileCode,
    Globe,
    Heading1,
    Heading2,
    Heading3,
    LayoutPanelTop,
    List,
    ListOrdered,
    Monitor,
    Moon,
    Plus,
    RotateCcw,
    Save,
    Smartphone,
    Sparkles,
    Sun,
    Table as TableIcon,
    Tablet,
    Trash2,
    Wand2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/supdance/plugins/i18n";
import { useBlocker, useNavigate } from "react-router";
import { AdminModal as Modal } from "@/pages/admin/ui/overlays";
import "./html-page-manager.css";
import { buildPreviewDocument } from "./preview-document";

import { SupdanceAboutFooter } from "@/supdance/components/site-footer/supdance-about-footer";
import { DEFAULT_HTML_SITE_FOOTER_CONFIG, fetchAdminHtmlPagesOverview, resetAdminHtmlPages, resetAdminHtmlSiteFooter, saveAdminHtmlPages, saveAdminHtmlSiteFooter } from "../api";
import { BUILTIN_HTML_TEMPLATES } from "../templates";
import type { HtmlSiteFooterConfig, ManagedHtmlPage } from "../types";

type AdminSectionMode = "editor" | "site-pages" | "footer-manager";

export default function HtmlPageManager() {
    const { message, modal } = App.useApp();
    const { t } = useI18n();
    const navigate = useNavigate();

    const [activeSection, setActiveSection] = useState<AdminSectionMode>("editor");
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [saving, setSaving] = useState(false);
    const [savingFooter, setSavingFooter] = useState(false);
    const [savedPages, setSavedPages] = useState("");
    const [savedFooter, setSavedFooter] = useState("");
    const [pages, setPages] = useState<ManagedHtmlPage[]>([]);
    const [siteFooter, setSiteFooter] = useState<HtmlSiteFooterConfig>(DEFAULT_HTML_SITE_FOOTER_CONFIG);
    const [activeId, setActiveId] = useState<string>("");
    const [viewMode, setViewMode] = useState<"split" | "code" | "preview">("split");
    const [deviceViewport, setDeviceViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
    const [previewTheme, setPreviewTheme] = useState<"dark" | "light">("dark");
    const [templateModalOpen, setTemplateModalOpen] = useState(false);
    const [newPageModalOpen, setNewPageModalOpen] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newSlug, setNewSlug] = useState("");
    const [newTemplateId, setNewTemplateId] = useState("linear-dark");

    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const dirty = !!savedPages && (JSON.stringify(pages) !== savedPages || JSON.stringify(siteFooter) !== savedFooter);
    const blocker = useBlocker(dirty && !saving && !savingFooter);

    useEffect(() => {
        const beforeUnload = (event: BeforeUnloadEvent) => {
            if (dirty) event.preventDefault();
        };
        window.addEventListener("beforeunload", beforeUnload);
        return () => window.removeEventListener("beforeunload", beforeUnload);
    }, [dirty]);

    useEffect(() => {
        if (blocker.state !== "blocked") return;
        const confirmation = modal.confirm({
            title: t("admin.html.unsaved_title"),
            content: t("admin.html.unsaved_description"),
            okText: t("admin.html.leave"),
            cancelText: t("admin.html.stay"),
            onOk: () => blocker.proceed(),
            onCancel: () => blocker.reset(),
        });
        return () => confirmation.destroy();
    }, [blocker, modal, t]);

    const togglePreviewTheme = () => {
        const next = previewTheme === "light" ? "dark" : "light";
        setPreviewTheme(next);
    };

    const previewDocument = useMemo(() => {
        return buildPreviewDocument(pages.find((page) => page.id === activeId)?.html || pages[0]?.html || "", previewTheme);
    }, [pages, activeId, previewTheme]);

    // 加载页面列表与页脚配置
    const loadData = async () => {
        setLoading(true);
        setLoadError("");
        try {
            const res = await fetchAdminHtmlPagesOverview();
            setPages(res.pages);
            setSavedPages(JSON.stringify(res.pages));
            setSavedFooter(JSON.stringify(res.siteFooter || DEFAULT_HTML_SITE_FOOTER_CONFIG));
            if (res.siteFooter) {
                setSiteFooter(res.siteFooter);
            }
            if (res.pages.length > 0 && !activeId) {
                setActiveId(res.pages[0].id);
            }
        } catch (err) {
            setLoadError(err instanceof Error ? err.message : t("admin.html.load_failed"));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, []);

    const activePage = useMemo(() => {
        return pages.find((p) => p.id === activeId) || pages[0] || null;
    }, [pages, activeId]);

    // 更新当前页面内容
    const updateActivePage = (updater: Partial<ManagedHtmlPage>) => {
        if (!activePage) return;
        setPages((prev) => prev.map((p) => (p.id === activePage.id ? { ...p, ...updater, updatedAt: new Date().toISOString() } : p)));
    };

    // 更新页脚配置
    const updateSiteFooter = (updater: Partial<HtmlSiteFooterConfig>) => {
        setSiteFooter((prev) => ({ ...prev, ...updater }));
    };

    // 格式化当前 HTML
    const handleBeautify = async () => {
        if (!activePage) return;
        try {
            const source = activePage.html;
            const pageId = activePage.id;
            const [{ format }, { default: htmlPlugin }] = await Promise.all([import("prettier/standalone"), import("prettier/plugins/html")]);
            const formatted = await format(source, { parser: "html", plugins: [htmlPlugin], htmlWhitespaceSensitivity: "strict" });
            setPages((prev) => prev.map((page) => (page.id === pageId && page.html === source ? { ...page, html: formatted } : page)));
            message.success(t("admin.html.formatted"));
        } catch {
            message.error(t("admin.html.format_failed"));
        }
    };

    // 快捷插入法务标签排版代码
    const insertSnippet = (snippet: string | ((selected: string) => string)) => {
        const textarea = textareaRef.current;
        if (!textarea || !activePage) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentText = activePage.html;
        const selected = currentText.substring(start, end);
        const insertion = typeof snippet === "function" ? snippet(selected) : snippet;

        const nextText = currentText.substring(0, start) + insertion + currentText.substring(end);
        updateActivePage({ html: nextText });

        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + insertion.length, start + insertion.length);
        }, 0);
    };

    // 保存 HTML 页面
    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await saveAdminHtmlPages(pages);
            setPages(res.pages);
            setSavedPages(JSON.stringify(res.pages));
            message.success(t("admin.html.pages_saved"));
        } catch (err) {
            message.error(err instanceof Error ? err.message : t("admin.html.save_failed"));
        } finally {
            setSaving(false);
        }
    };

    // 保存页脚与受管页面配置
    const handleSaveSiteFooter = async () => {
        setSavingFooter(true);
        try {
            const res = await saveAdminHtmlSiteFooter(siteFooter);
            if (res.siteFooter) {
                setSiteFooter(res.siteFooter);
                setSavedFooter(JSON.stringify(res.siteFooter));
            }
            message.success(t("admin.html.footer_saved"));
        } catch (err) {
            message.error(err instanceof Error ? err.message : t("admin.html.footer_save_failed"));
        } finally {
            setSavingFooter(false);
        }
    };

    // 重置页脚与受管页面配置
    const handleResetSiteFooter = () => {
        modal.confirm({
            title: t("admin.html.reset_footer"),
            content: t("admin.html.reset_footer_description"),
            okText: t("admin.html.confirm_reset"),
            okButtonProps: { danger: true },
            cancelText: t("admin.html.cancel"),
            onOk: async () => {
                try {
                    const res = await resetAdminHtmlSiteFooter();
                    if (res.siteFooter) {
                        setSiteFooter(res.siteFooter);
                        setSavedFooter(JSON.stringify(res.siteFooter));
                    }
                    message.success(t("admin.html.footer_reset"));
                } catch (err) {
                    message.error(err instanceof Error ? err.message : t("admin.html.reset_failed"));
                }
            },
        });
    };

    // 重置页面为初始高质感模板
    const handleReset = () => {
        modal.confirm({
            title: t("admin.html.reset_pages"),
            content: t("admin.html.reset_pages_description"),
            okText: t("admin.html.confirm_reset"),
            okButtonProps: { danger: true },
            cancelText: t("admin.html.cancel"),
            onOk: async () => {
                try {
                    const res = await resetAdminHtmlPages();
                    setPages(res.pages);
                    setSavedPages(JSON.stringify(res.pages));
                    if (res.pages[0]) setActiveId(res.pages[0].id);
                    message.success(t("admin.html.pages_reset"));
                } catch (err) {
                    message.error(err instanceof Error ? err.message : t("admin.html.reset_failed"));
                }
            },
        });
    };

    // 复制 HTML
    const handleCopyHtml = async () => {
        if (!activePage) return;
        try {
            await navigator.clipboard.writeText(activePage.html);
            message.success(t("admin.html.copied"));
        } catch {
            message.error(t("admin.html.copy_failed"));
        }
    };

    // 下载单文件独立 HTML
    const handleDownloadHtml = () => {
        if (!activePage) return;
        const blob = new Blob([activePage.html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${activePage.slug || "page"}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        message.success(`${t("admin.html.download")}: ${activePage.slug}.html`);
    };

    // 在新标签页全屏预览
    const handleOpenInNewTab = () => {
        if (!activePage) return;
        window.open(`/p/${encodeURIComponent(activePage.slug)}`, "_blank", "noopener,noreferrer");
    };

    // 复制在线预览地址
    const handleCopyPreviewLink = async () => {
        if (!activePage) return;
        const previewUrl = `${window.location.origin}/p/${activePage.slug}`;
        try {
            await navigator.clipboard.writeText(previewUrl);
            message.success(`${t("admin.html.copy_link")}: ${previewUrl}`);
        } catch {
            message.info(previewUrl);
        }
    };

    // 新建页面确认
    const handleCreatePage = () => {
        if (!newTitle.trim()) {
            message.warning(t("admin.html.title_required"));
            return;
        }
        const slug = (newSlug.trim() || newTitle.trim())
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-_]/g, "");
        if (slug && !/^[a-z0-9][a-z0-9_-]*$/.test(slug)) {
            message.warning(t("admin.html.invalid_slug"));
            return;
        }
        if (slug && pages.some((page) => page.slug.toLowerCase() === slug.toLowerCase())) {
            message.warning(t("admin.html.duplicate_slug"));
            return;
        }
        const template = BUILTIN_HTML_TEMPLATES.find((t) => t.id === newTemplateId) || BUILTIN_HTML_TEMPLATES[0];
        const document = new DOMParser().parseFromString(template.sampleHtml, "text/html");
        document.title = newTitle.trim();

        const newPage: ManagedHtmlPage = {
            id: `page-${Date.now()}`,
            slug: slug || `page-${Date.now()}`,
            title: newTitle.trim(),
            description: `${template.name} 模板`,
            templateId: template.id,
            html: "<!DOCTYPE html>\n" + document.documentElement.outerHTML,
            isPublished: false,
            updatedAt: new Date().toISOString(),
        };

        setPages((prev) => [...prev, newPage]);
        setActiveId(newPage.id);
        setNewPageModalOpen(false);
        setNewTitle("");
        setNewSlug("");
        message.success(`${t("admin.html.created_draft")}: ${newPage.title}`);
    };

    // 删除当前页面
    const handleDeleteCurrentPage = () => {
        if (!activePage) return;
        if (pages.length <= 1) {
            message.warning(t("admin.html.keep_page"));
            return;
        }
        modal.confirm({
            title: `${t("admin.html.confirm_delete")}: ${activePage.title}`,
            content: `${t("admin.html.delete_after_save")} /p/${activePage.slug}`,
            okText: t("admin.html.confirm_delete"),
            okButtonProps: { danger: true },
            cancelText: t("admin.html.cancel"),
            onOk: () => {
                const next = pages.filter((p) => p.id !== activePage.id);
                setPages(next);
                setActiveId(next[0].id);
                message.success(t("admin.html.deleted"));
            },
        });
    };

    // 套用模板
    const applyTemplate = (tpl: (typeof BUILTIN_HTML_TEMPLATES)[0]) => {
        if (!activePage) return;
        modal.confirm({
            title: `${t("admin.html.templates")}: ${tpl.name}`,
            content: t("admin.html.replace_description"),
            okText: t("admin.html.confirm_apply"),
            cancelText: t("admin.html.cancel"),
            onOk: () => {
                updateActivePage({
                    templateId: tpl.id,
                    html: tpl.sampleHtml,
                });
                setTemplateModalOpen(false);
                message.success(`${t("admin.html.apply")}: ${tpl.name}`);
            },
        });
    };

    // 视口尺寸计算
    const viewportWidthStyle = deviceViewport === "mobile" ? "375px" : deviceViewport === "tablet" ? "768px" : "100%";

    return (
        <div className="plugin-scope-html-admin flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden" aria-busy={loading || saving || savingFooter}>
            {/* 顶栏 Header */}
            <fieldset className="plugin-html-actions" disabled={loading || !!loadError || saving || savingFooter}>
                <header className="plugin-html-header flex shrink-0 items-center justify-between border-b border-[var(--admin-border)] px-4 bg-[var(--admin-surface)]">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => navigate("/admin/plugins")}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--admin-border)] px-2.5 py-1 text-xs text-[var(--admin-text-secondary)] hover:border-[var(--admin-border)] hover:text-[var(--admin-text)] transition-colors"
                            title={t("admin.html.back")}
                        >
                            <ArrowLeft className="size-3.5" />
                            {t("admin.html.plugins")}
                        </button>
                        <div className="h-4 w-px bg-[var(--admin-surface-2)]" />
                        <div className="flex items-center gap-2">
                            <FileCode className="size-4 text-[var(--admin-text)]" />
                            <h1 className="text-sm font-semibold tracking-tight text-[var(--admin-text)]">{t("admin.html.title")}</h1>
                        </div>

                        {/* 模块切换导航 */}
                        <div className="ml-2 flex items-center gap-1 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-2)] p-1">
                            <button
                                type="button"
                                onClick={() => setActiveSection("editor")}
                                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors ${activeSection === "editor" ? "bg-[var(--admin-surface-2)] text-[var(--admin-text)] border border-[var(--admin-border)] font-medium" : "text-[var(--admin-text-secondary)] hover:text-[var(--admin-text)]"}`}
                            >
                                <Code2 className="size-3.5" />
                                {t("admin.html.editor")}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveSection("site-pages")}
                                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors ${activeSection === "site-pages" ? "bg-[var(--admin-surface-2)] text-[var(--admin-text)] border border-[var(--admin-border)] font-medium" : "text-[var(--admin-text-secondary)] hover:text-[var(--admin-text)]"}`}
                            >
                                <Globe className="size-3.5" />
                                {t("admin.html.site_pages")}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveSection("footer-manager")}
                                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors ${activeSection === "footer-manager" ? "bg-[var(--admin-surface-2)] text-[var(--admin-text)] border border-[var(--admin-border)] font-medium" : "text-[var(--admin-text-secondary)] hover:text-[var(--admin-text)]"}`}
                            >
                                <LayoutPanelTop className="size-3.5" />
                                {t("admin.html.footer")}
                            </button>
                        </div>
                    </div>

                    {/* 中间：仅在 HTML 编辑器模式下展示视图分栏与设备切换 */}
                    {activeSection === "editor" ? (
                        <div className="flex items-center gap-1.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-2)] p-1">
                            <button
                                type="button"
                                onClick={() => setViewMode("code")}
                                className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs transition-colors ${viewMode === "code" ? "bg-[var(--admin-surface-2)] text-[var(--admin-text)] font-medium" : "text-[var(--admin-text-secondary)] hover:text-[var(--admin-text)]"}`}
                                title={t("admin.html.code_hint")}
                            >
                                <Code2 className="size-3.5" />
                                {t("admin.html.code")}
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode("split")}
                                className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs transition-colors ${viewMode === "split" ? "bg-[var(--admin-surface-2)] text-[var(--admin-text)] font-medium" : "text-[var(--admin-text-secondary)] hover:text-[var(--admin-text)]"}`}
                                title={t("admin.html.split_hint")}
                            >
                                <Columns2 className="size-3.5" />
                                {t("admin.html.split")}
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode("preview")}
                                className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs transition-colors ${viewMode === "preview" ? "bg-[var(--admin-surface-2)] text-[var(--admin-text)] font-medium" : "text-[var(--admin-text-secondary)] hover:text-[var(--admin-text)]"}`}
                                title={t("admin.html.preview_hint")}
                            >
                                <Eye className="size-3.5" />
                                {t("admin.html.preview")}
                            </button>

                            {viewMode !== "code" && (
                                <>
                                    <div className="mx-1 h-3.5 w-px bg-[var(--admin-surface-2)]" />
                                    <button
                                        type="button"
                                        onClick={() => setDeviceViewport("desktop")}
                                        className={`p-1 rounded transition-colors ${deviceViewport === "desktop" ? "text-[var(--admin-text)] bg-[var(--admin-surface-2)]" : "text-[var(--admin-text-secondary)] hover:text-[var(--admin-text)]"}`}
                                        title={t("admin.html.desktop")}
                                    >
                                        <Monitor className="size-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDeviceViewport("tablet")}
                                        className={`p-1 rounded transition-colors ${deviceViewport === "tablet" ? "text-[var(--admin-text)] bg-[var(--admin-surface-2)]" : "text-[var(--admin-text-secondary)] hover:text-[var(--admin-text)]"}`}
                                        title={t("admin.html.tablet")}
                                    >
                                        <Tablet className="size-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDeviceViewport("mobile")}
                                        className={`p-1 rounded transition-colors ${deviceViewport === "mobile" ? "text-[var(--admin-text)] bg-[var(--admin-surface-2)]" : "text-[var(--admin-text-secondary)] hover:text-[var(--admin-text)]"}`}
                                        title={t("admin.html.mobile")}
                                    >
                                        <Smartphone className="size-3.5" />
                                    </button>
                                    <div className="mx-1 h-3.5 w-px bg-[var(--admin-surface-2)]" />
                                    <button
                                        type="button"
                                        onClick={togglePreviewTheme}
                                        className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-transform  ${
                                            previewTheme === "light" ? "text-[var(--admin-status-warning)] bg-[var(--admin-surface-2)] font-medium" : "text-[var(--admin-text)] bg-[var(--admin-surface-2)] font-medium"
                                        }`}
                                        title={previewTheme === "light" ? t("admin.html.preview_light") : t("admin.html.preview_dark")}
                                    >
                                        {previewTheme === "light" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
                                        <span className="font-mono text-xs uppercase">{previewTheme === "light" ? "Light" : "Dark"}</span>
                                    </button>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="text-xs text-[var(--admin-text-secondary)] font-mono">{activeSection === "site-pages" ? t("admin.html.site_description") : t("admin.html.footer_description")}</div>
                    )}

                    {/* 右侧：保存、导出与功能操作 */}
                    {activeSection === "editor" ? (
                        <div className="flex items-center gap-2">
                            <Button
                                size="small"
                                icon={<Sparkles className="size-3.5 text-[var(--admin-status-warning)]" />}
                                onClick={() => setTemplateModalOpen(true)}
                                className="border-[var(--admin-border)] text-xs bg-[var(--admin-surface-2)] hover:bg-[var(--admin-surface-2)]"
                            >
                                {t("admin.html.templates")}
                            </Button>
                            <Tooltip title={t("admin.html.format_hint")}>
                                <Button size="small" icon={<Wand2 className="size-3.5" />} onClick={handleBeautify} className="border-[var(--admin-border)] text-xs bg-[var(--admin-surface-2)]">
                                    {t("admin.html.format")}
                                </Button>
                            </Tooltip>
                            <Tooltip title={t("admin.html.copy_link_hint")}>
                                <Button size="small" icon={<Copy className="size-3.5 text-[var(--admin-text)]" />} onClick={() => void handleCopyPreviewLink()} className="border-[var(--admin-border)] text-xs bg-[var(--admin-surface-2)]">
                                    {t("admin.html.preview_link")}
                                </Button>
                            </Tooltip>
                            <Tooltip title={t("admin.html.download_hint")}>
                                <Button size="small" aria-label={t("admin.html.download")} icon={<Download className="size-3.5" />} onClick={handleDownloadHtml} className="border-[var(--admin-border)] text-xs bg-[var(--admin-surface-2)]" />
                            </Tooltip>
                            <Tooltip title={t("admin.html.open_hint")}>
                                <Button size="small" aria-label={t("admin.html.open_saved")} icon={<ExternalLink className="size-3.5" />} onClick={handleOpenInNewTab} className="border-[var(--admin-border)] text-xs bg-[var(--admin-surface-2)]" />
                            </Tooltip>
                            <Button type="primary" size="small" icon={<Save className="size-3.5" />} loading={saving} onClick={() => void handleSave()} className="bg-[var(--admin-surface-2)] hover:bg-[var(--admin-surface-2)] font-medium text-xs px-3">
                                {t("admin.html.save_pages")}
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Button size="small" icon={<RotateCcw className="size-3.5" />} onClick={handleResetSiteFooter} className="border-[var(--admin-border)] text-xs bg-[var(--admin-surface-2)] hover:bg-[var(--admin-surface-2)]">
                                {t("admin.html.restore_defaults")}
                            </Button>
                            <Button
                                type="primary"
                                size="small"
                                icon={<Save className="size-3.5" />}
                                loading={savingFooter}
                                onClick={() => void handleSaveSiteFooter()}
                                className="bg-[var(--admin-surface-2)] hover:bg-[var(--admin-surface-2)] font-medium text-xs px-3"
                            >
                                {t("admin.html.save_footer")}
                            </Button>
                        </div>
                    )}
                </header>
            </fieldset>

            {loading && (
                <div className="plugin-html-state">
                    <Spin />
                    <span>{t("admin.html.loading")}</span>
                </div>
            )}
            {loadError && <Alert type="error" showIcon title={loadError} action={<Button onClick={() => void loadData()}>{t("admin.html.retry")}</Button>} />}
            <fieldset className="plugin-html-workspace" disabled={loading || !!loadError || saving || savingFooter}>
                {/* 主工作区：根据 activeSection 切换 */}
                {activeSection === "editor" && (
                    <div className="plugin-html-editor flex flex-1 min-h-0 overflow-hidden">
                        {/* 左栏：页面抽屉/列表 */}
                        <aside className="plugin-html-sidebar w-64 shrink-0 flex flex-col border-r border-[var(--admin-border)] bg-[var(--admin-surface)]">
                            <div className="flex items-center justify-between border-b border-[var(--admin-border)] p-3">
                                <span className="text-xs font-medium text-[var(--admin-text-secondary)] uppercase tracking-wider">
                                    {t("admin.html.page_list")}
                                    {pages.length})
                                </span>
                                <button type="button" onClick={() => setNewPageModalOpen(true)} className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-[var(--admin-text)] hover:bg-[var(--admin-surface-2)] transition-colors">
                                    <Plus className="size-3" />
                                    {t("admin.html.new")}
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                {!loading && !loadError && pages.length === 0 && <p className="p-3 text-sm text-[var(--admin-text-secondary)]">{t("admin.html.no_pages")}</p>}
                                {pages.map((p) => {
                                    const isCurrent = p.id === activePage?.id;
                                    return (
                                        <div
                                            key={p.id}
                                            role="button"
                                            tabIndex={0}
                                            aria-pressed={isCurrent}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter" || event.key === " ") {
                                                    event.preventDefault();
                                                    setActiveId(p.id);
                                                }
                                            }}
                                            onClick={() => setActiveId(p.id)}
                                            className={`group flex items-center justify-between rounded-lg p-2.5 cursor-pointer text-xs transition-colors ${
                                                isCurrent
                                                    ? "bg-[var(--admin-surface-2)] text-[var(--admin-text)] font-medium border border-[var(--admin-border)]"
                                                    : "text-[var(--admin-text-secondary)] hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)]"
                                            }`}
                                        >
                                            <div className="min-w-0 flex-1 pr-2">
                                                <div className="flex items-center gap-1.5 truncate">
                                                    <span className="truncate">{p.title}</span>
                                                    {p.isPublished ? (
                                                        <span className="size-1.5 rounded-full bg-[var(--admin-status-success)] shrink-0" title={t("admin.html.published")} />
                                                    ) : (
                                                        <span className="size-1.5 rounded-full bg-[var(--admin-status-warning)] shrink-0" title={t("admin.html.draft")} />
                                                    )}
                                                </div>
                                                <div className="font-mono text-xs text-[var(--admin-text-secondary)] truncate mt-0.5">/{p.slug}</div>
                                            </div>
                                            <span className="text-xs text-[var(--admin-text-secondary)] text-[var(--admin-text-secondary)] font-mono shrink-0">{p.templateId ? p.templateId.replace("-", " ") : "html"}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* 左侧底栏：页面属性快速编辑与重置 */}
                            {activePage && (
                                <div className="border-t border-[var(--admin-border)] p-3 space-y-2.5 bg-[var(--admin-surface-2)]">
                                    <div className="space-y-1">
                                        <label className="text-xs text-[var(--admin-text-secondary)]">
                                            {t("admin.html.page_title")}
                                            <input
                                                type="text"
                                                value={activePage.title}
                                                onChange={(e) => updateActivePage({ title: e.target.value })}
                                                className="w-full rounded border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-2 py-1 text-xs text-[var(--admin-text)] focus:outline-none focus:border-[var(--admin-border)]"
                                            />
                                        </label>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-[var(--admin-text-secondary)]">
                                            {t("admin.html.slug")}
                                            <input
                                                type="text"
                                                value={activePage.slug}
                                                onChange={(e) => updateActivePage({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, "") })}
                                                className="w-full rounded border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-2 py-1 text-xs font-mono text-[var(--admin-text)] focus:outline-none focus:border-[var(--admin-border)]"
                                            />
                                        </label>
                                    </div>
                                    <div className="flex items-center justify-between pt-1">
                                        <span className="text-xs text-[var(--admin-text-secondary)]">{t("admin.html.public_access")}</span>
                                        <Switch size="sm" aria-label={t("admin.html.public_access")} checked={activePage.isPublished} onChange={(checked) => updateActivePage({ isPublished: checked })} />
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-[var(--admin-border)]">
                                        <button type="button" onClick={handleDeleteCurrentPage} className="inline-flex items-center gap-1 text-xs text-[var(--admin-status-error)] hover:text-[var(--admin-status-error)]">
                                            <Trash2 className="size-3" />
                                            {t("admin.html.delete_page")}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleReset}
                                            className="inline-flex items-center gap-1 text-xs text-[var(--admin-text-secondary)] hover:text-[var(--admin-text)]"
                                            aria-label={t("admin.html.restore_hint")}
                                            title={t("admin.html.restore_hint")}
                                        >
                                            <RotateCcw className="size-3" />
                                            {t("admin.html.reset")}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </aside>

                        {/* 编辑器主舞台 */}
                        <div className="flex flex-1 flex-col min-w-0 bg-[var(--admin-surface)]">
                            {/* 排版快捷工具栏 */}
                            {viewMode !== "preview" && (
                                <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--admin-border)] px-3 py-1.5 bg-[var(--admin-surface)] text-xs">
                                    <span className="text-xs font-mono text-[var(--admin-text-secondary)] mr-2 shrink-0">{t("admin.html.snippets")}</span>
                                    <button
                                        type="button"
                                        onClick={() => insertSnippet((s) => `<h1>${s || t("admin.html.snippet_heading")}</h1>\n`)}
                                        className="rounded px-2 py-1 text-[var(--admin-text-secondary)] hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)]"
                                        title={t("admin.html.insert_h1")}
                                    >
                                        <Heading1 className="size-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertSnippet((s) => `<h2>${s || t("admin.html.snippet_section")}</h2>\n`)}
                                        className="rounded px-2 py-1 text-[var(--admin-text-secondary)] hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)]"
                                        title={t("admin.html.insert_h2")}
                                    >
                                        <Heading2 className="size-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertSnippet((s) => `<h3>${s || t("admin.html.snippet_clause")}</h3>\n`)}
                                        className="rounded px-2 py-1 text-[var(--admin-text-secondary)] hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)]"
                                        title={t("admin.html.insert_h3")}
                                    >
                                        <Heading3 className="size-3.5" />
                                    </button>
                                    <div className="h-3 w-px bg-[var(--admin-surface-2)] mx-1" />
                                    <button
                                        type="button"
                                        onClick={() => insertSnippet((s) => `<p>${s || t("admin.html.snippet_paragraph")}</p>\n`)}
                                        className="rounded px-2 py-1 text-[var(--admin-text-secondary)] hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)] font-mono text-xs"
                                        title={t("admin.html.insert_p")}
                                    >
                                        P
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertSnippet((s) => `<strong>${s || t("admin.html.snippet_strong")}</strong>`)}
                                        className="rounded px-2 py-1 text-[var(--admin-text-secondary)] hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)] font-bold text-xs"
                                        title={t("admin.html.insert_strong")}
                                    >
                                        B
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertSnippet((s) => `<em>${s || t("admin.html.snippet_emphasis")}</em>`)}
                                        className="rounded px-2 py-1 text-[var(--admin-text-secondary)] hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)] italic text-xs"
                                        title={t("admin.html.insert_em")}
                                    >
                                        I
                                    </button>
                                    <div className="h-3 w-px bg-[var(--admin-surface-2)] mx-1" />
                                    <button
                                        type="button"
                                        onClick={() => insertSnippet(`<ul>\n  <li>条款清单项 1</li>\n  <li>条款清单项 2</li>\n</ul>\n`)}
                                        className="rounded px-2 py-1 text-[var(--admin-text-secondary)] hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)]"
                                        title={t("admin.html.insert_ul")}
                                    >
                                        <List className="size-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertSnippet(`<ol>\n  <li>序号步骤 1</li>\n  <li>序号步骤 2</li>\n</ol>\n`)}
                                        className="rounded px-2 py-1 text-[var(--admin-text-secondary)] hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)]"
                                        title={t("admin.html.insert_ol")}
                                    >
                                        <ListOrdered className="size-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            insertSnippet(
                                                `<table>\n  <thead>\n    <tr><th>类别</th><th>收集内容</th><th>合法用途</th></tr>\n  </thead>\n  <tbody>\n    <tr><td>账号凭据</td><td>手机号/邮箱</td><td>身份鉴权与安全防护</td></tr>\n  </tbody>\n</table>\n`,
                                            )
                                        }
                                        className="rounded px-2 py-1 text-[var(--admin-text-secondary)] hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)]"
                                        title={t("admin.html.insert_table")}
                                    >
                                        <TableIcon className="size-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertSnippet((s) => `<div class="callout">\n  <strong>特别提醒：</strong>${s || t("admin.html.snippet_callout")}\n</div>\n`)}
                                        className="rounded px-2 py-1 text-[var(--admin-status-warning)] hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-status-warning)] text-xs"
                                        title={t("admin.html.insert_callout")}
                                    >
                                        Callout
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertSnippet(`<hr style="border:0;border-top:1px solid var(--border,#333);margin:32px 0;" />\n`)}
                                        className="rounded px-2 py-1 text-[var(--admin-text-secondary)] hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)] text-xs font-mono"
                                        title={t("admin.html.insert_hr")}
                                    >
                                        HR
                                    </button>
                                    <div className="flex-1" />
                                    <button
                                        type="button"
                                        onClick={handleCopyHtml}
                                        className="flex items-center gap-1 text-xs text-[var(--admin-text-secondary)] hover:text-[var(--admin-text)] px-2 py-1 rounded hover:bg-[var(--admin-surface-2)]"
                                        aria-label={t("admin.html.copy_hint")}
                                        title={t("admin.html.copy_hint")}
                                    >
                                        <Copy className="size-3" />
                                        {t("admin.html.copy_code")}
                                    </button>
                                </div>
                            )}

                            {/* 编辑与预览分屏主体 */}
                            <div className="plugin-html-panes flex flex-1 min-h-0 min-w-0">
                                {/* 左：代码编辑器 */}
                                {viewMode !== "preview" && (
                                    <div className={`flex flex-col min-w-0 ${viewMode === "split" ? "w-1/2 border-r border-[var(--admin-border)]" : "w-full"}`}>
                                        <textarea
                                            ref={textareaRef}
                                            aria-label={t("admin.html.code")}
                                            value={activePage?.html || ""}
                                            onChange={(e) => updateActivePage({ html: e.target.value })}
                                            placeholder={t("admin.html.source_placeholder")}
                                            spellCheck={false}
                                            className="flex-1 w-full resize-none bg-[var(--admin-surface)] p-4 font-mono text-sm leading-relaxed text-[var(--admin-text-secondary)] focus:outline-none selection:bg-[var(--admin-surface-2)]"
                                        />
                                        <div className="flex items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1 text-xs text-[var(--admin-text-secondary)] font-mono">
                                            <span>
                                                {t("admin.html.character_count")}
                                                {activePage?.html.length || 0}
                                                {t("admin.html.characters")}
                                            </span>
                                            <span>
                                                {t("admin.html.template_type")}
                                                {activePage?.templateId || "custom"}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* 右：实时沙箱预览 */}
                                {viewMode !== "code" && (
                                    <div className={`flex flex-col min-w-0 bg-[var(--admin-surface)] overflow-hidden ${viewMode === "split" ? "w-1/2" : "w-full"}`}>
                                        <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-1 text-xs text-[var(--admin-text-secondary)]">
                                            <div className="flex items-center gap-2">
                                                <span className="size-2 rounded-full bg-[var(--admin-status-success)] animate-pulse" />
                                                <span className="font-mono text-xs">{t("admin.html.sandbox_preview")}</span>
                                                <span className="text-xs text-[var(--admin-text-secondary)]">/p/{activePage?.slug}</span>
                                            </div>
                                            <div className="flex items-center gap-3 font-mono text-xs text-[var(--admin-text-secondary)]">
                                                <span>
                                                    {t("admin.html.viewport")}
                                                    {viewportWidthStyle}
                                                </span>
                                                <button type="button" onClick={() => void handleCopyPreviewLink()} className="text-[var(--admin-text)] hover:text-[var(--admin-text)] flex items-center gap-1" title={t("admin.html.copy_link_hint")}>
                                                    <Copy className="size-3" />
                                                    {t("admin.html.copy_link")}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex-1 min-h-0 overflow-auto p-4 bg-[var(--admin-surface)]">
                                            <div style={{ width: viewportWidthStyle, height: "100%" }} className="mx-auto h-full rounded-lg shadow-none overflow-hidden bg-[var(--admin-surface-2)] transition-colors">
                                                <iframe ref={iframeRef} title="HTML Page Live Preview" srcDoc={previewDocument} sandbox="allow-scripts" className="h-full w-full border-0 bg-transparent" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 页面管理视图 */}
                {activeSection === "site-pages" && (
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="mx-auto max-w-5xl space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                                <div>
                                    <h2 className="text-base font-semibold text-[var(--admin-text)]">{t("admin.html.site_heading")}</h2>
                                    <p className="mt-1 text-xs text-[var(--admin-text-secondary)]">
                                        {t("admin.html.manage")}
                                        <code className="text-[var(--admin-text)]">/terms</code>、<code className="text-[var(--admin-text)]">/privacy</code>、<code className="text-[var(--admin-text)]">/aup</code>、
                                        <code className="text-[var(--admin-text)]">/legal</code>、<code className="text-[var(--admin-text)]">/mcp</code>
                                        {t("admin.html.and")}
                                        <code className="text-[var(--admin-text)]">/pricing.html</code>
                                        {t("admin.html.site_help")}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <span className="text-xs text-[var(--admin-text-secondary)]">{t("admin.html.global_footer")}</span>
                                    <Switch aria-label={t("admin.html.global_footer")} checked={siteFooter.enabled} onChange={(checked) => updateSiteFooter({ enabled: checked })} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {siteFooter.sitePages.map((sp, idx) => (
                                    <div key={sp.path} className="flex flex-col justify-between rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 hover:border-[var(--admin-border)] transition-colors">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs font-semibold text-[var(--admin-text)] bg-[var(--admin-surface-2)] border border-[var(--admin-border)] px-2 py-0.5 rounded">{sp.path}</span>
                                                    <Tag color={sp.pageType === "static-html" ? "purple" : "blue"} className="m-0 text-xs border-0">
                                                        {sp.pageType === "static-html" ? t("admin.html.static_html") : t("admin.html.spa")}
                                                    </Tag>
                                                </div>
                                                <a href={sp.path} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[var(--admin-text-secondary)] hover:text-[var(--admin-text)] no-underline">
                                                    <span>{t("admin.html.open_page")}</span>
                                                    <ExternalLink className="size-3" />
                                                </a>
                                            </div>

                                            <div>
                                                <label className="text-xs text-[var(--admin-text-secondary)] block mb-1">
                                                    {t("admin.html.page_name")}
                                                    <input
                                                        type="text"
                                                        value={sp.title}
                                                        onChange={(e) => {
                                                            const next = [...siteFooter.sitePages];
                                                            next[idx] = { ...sp, title: e.target.value };
                                                            updateSiteFooter({ sitePages: next });
                                                        }}
                                                        className="w-full rounded border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-2.5 py-1.5 text-xs text-[var(--admin-text)] focus:outline-none focus:border-[var(--admin-border)]"
                                                    />
                                                </label>
                                            </div>

                                            <div>
                                                <label className="text-xs text-[var(--admin-text-secondary)] block mb-1">
                                                    {t("admin.html.description")}
                                                    <input
                                                        type="text"
                                                        value={sp.description}
                                                        onChange={(e) => {
                                                            const next = [...sitePagesClone(siteFooter)];
                                                            next[idx] = { ...sp, description: e.target.value };
                                                            updateSiteFooter({ sitePages: next });
                                                        }}
                                                        className="w-full rounded border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-2.5 py-1.5 text-xs text-[var(--admin-text-secondary)] focus:outline-none focus:border-[var(--admin-border)]"
                                                    />
                                                </label>
                                            </div>
                                        </div>

                                        <div className="mt-4 pt-3 border-t border-[var(--admin-border)] flex items-center justify-between">
                                            <span className="text-xs text-[var(--admin-text-secondary)]">{t("admin.html.show_footer")}</span>
                                            <Switch
                                                size="sm"
                                                aria-label={`${t("admin.html.show_footer")} ${sp.path}`}
                                                checked={sp.showFooter}
                                                onChange={(checked) => {
                                                    const next = [...siteFooter.sitePages];
                                                    next[idx] = { ...sp, showFooter: checked };
                                                    updateSiteFooter({ sitePages: next });
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* 页脚管理器视图 */}
                {activeSection === "footer-manager" && (
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="mx-auto max-w-6xl space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* 左侧：品牌、社交与订阅卡片设置 */}
                                <div className="space-y-5 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                                    <h3 className="text-sm font-semibold text-[var(--admin-text)] border-b border-[var(--admin-border)] pb-3">{t("admin.html.brand_heading")}</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-[var(--admin-text-secondary)] block mb-1">
                                                {t("admin.html.brand_name")}
                                                <input
                                                    type="text"
                                                    value={siteFooter.brandName}
                                                    onChange={(e) => updateSiteFooter({ brandName: e.target.value })}
                                                    className="w-full rounded border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-3 py-1.5 text-xs text-[var(--admin-text)]"
                                                />
                                            </label>
                                        </div>
                                        <div>
                                            <label className="text-xs text-[var(--admin-text-secondary)] block mb-1">
                                                {t("admin.html.slogan")}
                                                <input
                                                    type="text"
                                                    value={siteFooter.brandSlogan}
                                                    onChange={(e) => updateSiteFooter({ brandSlogan: e.target.value })}
                                                    className="w-full rounded border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-3 py-1.5 text-xs text-[var(--admin-text)]"
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs text-[var(--admin-text-secondary)] block mb-1">
                                            {t("admin.html.vision")}
                                            <textarea
                                                rows={2}
                                                value={siteFooter.brandVision}
                                                onChange={(e) => updateSiteFooter({ brandVision: e.target.value })}
                                                className="w-full rounded border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-3 py-1.5 text-xs text-[var(--admin-text)] resize-none"
                                            />
                                        </label>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-[var(--admin-text-secondary)] block mb-1">
                                                {t("admin.html.support_email")}
                                                <input
                                                    type="text"
                                                    value={siteFooter.supportEmail}
                                                    onChange={(e) => updateSiteFooter({ supportEmail: e.target.value })}
                                                    className="w-full rounded border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-3 py-1.5 text-xs font-mono text-[var(--admin-text)]"
                                                />
                                            </label>
                                        </div>
                                        <div>
                                            <label className="text-xs text-[var(--admin-text-secondary)] block mb-1">
                                                {t("admin.html.social_heading")}
                                                <input
                                                    type="text"
                                                    value={siteFooter.officialChannelsText}
                                                    onChange={(e) => updateSiteFooter({ officialChannelsText: e.target.value })}
                                                    className="w-full rounded border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-3 py-1.5 text-xs text-[var(--admin-text)]"
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    <div className="space-y-2 pt-2">
                                        <label className="text-xs text-[var(--admin-text-secondary)] block">{t("admin.html.social_links")}</label>
                                        {siteFooter.socialLinks.map((soc, sIdx) => (
                                            <div key={soc.id} className="grid grid-cols-12 gap-2 items-center">
                                                <span className="col-span-3 font-mono text-xs text-[var(--admin-text-secondary)] truncate">{soc.name}</span>
                                                <input
                                                    type="text"
                                                    aria-label={soc.name + " " + t("admin.html.account")}
                                                    value={soc.handle}
                                                    placeholder={t("admin.html.account")}
                                                    onChange={(e) => {
                                                        const next = [...siteFooter.socialLinks];
                                                        next[sIdx] = { ...soc, handle: e.target.value };
                                                        updateSiteFooter({ socialLinks: next });
                                                    }}
                                                    className="col-span-3 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-2 py-1 text-xs text-[var(--admin-text)]"
                                                />
                                                <input
                                                    type="text"
                                                    aria-label={soc.name + " " + t("admin.html.url")}
                                                    value={soc.href}
                                                    placeholder={t("admin.html.url")}
                                                    onChange={(e) => {
                                                        const next = [...siteFooter.socialLinks];
                                                        next[sIdx] = { ...soc, href: e.target.value };
                                                        updateSiteFooter({ socialLinks: next });
                                                    }}
                                                    className="col-span-6 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-2 py-1 text-xs font-mono text-[var(--admin-text)]"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 右侧：导航列、技术周刊与底部备案版权 */}
                                <div className="space-y-5 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                                    <h3 className="text-sm font-semibold text-[var(--admin-text)] border-b border-[var(--admin-border)] pb-3">{t("admin.html.navigation_heading")}</h3>

                                    {siteFooter.columns.map((col, cIdx) => (
                                        <div key={cIdx} className="space-y-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-2)] p-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs font-mono text-[var(--admin-text)]">
                                                    {t("admin.html.column_prefix")}
                                                    {cIdx + 1}
                                                    {t("admin.html.column_title")}
                                                </span>
                                                <input
                                                    type="text"
                                                    aria-label={t("admin.html.column_title")}
                                                    value={col.title}
                                                    onChange={(e) => {
                                                        const next = [...siteFooter.columns];
                                                        next[cIdx] = { ...col, title: e.target.value };
                                                        updateSiteFooter({ columns: next });
                                                    }}
                                                    className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-2.5 py-1 text-xs text-[var(--admin-text)]"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                {col.links.map((lnk, lIdx) => (
                                                    <div key={lIdx} className="grid grid-cols-12 gap-2">
                                                        <input
                                                            type="text"
                                                            aria-label={t("admin.html.page_name")}
                                                            value={lnk.label}
                                                            onChange={(e) => {
                                                                const nextCols = [...siteFooter.columns];
                                                                const nextLinks = [...col.links];
                                                                nextLinks[lIdx] = { ...lnk, label: e.target.value };
                                                                nextCols[cIdx] = { ...col, links: nextLinks };
                                                                updateSiteFooter({ columns: nextCols });
                                                            }}
                                                            className="col-span-5 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-2 py-1 text-xs text-[var(--admin-text)]"
                                                        />
                                                        <input
                                                            type="text"
                                                            aria-label={t("admin.html.url")}
                                                            value={lnk.href}
                                                            onChange={(e) => {
                                                                const nextCols = [...siteFooter.columns];
                                                                const nextLinks = [...col.links];
                                                                nextLinks[lIdx] = { ...lnk, href: e.target.value };
                                                                nextCols[cIdx] = { ...col, links: nextLinks };
                                                                updateSiteFooter({ columns: nextCols });
                                                            }}
                                                            className="col-span-7 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-2 py-1 text-xs font-mono text-[var(--admin-text-secondary)]"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-[var(--admin-text-secondary)] block mb-1">
                                                {t("admin.html.newsletter_heading")}
                                                <input
                                                    type="text"
                                                    value={siteFooter.newsletterHeading}
                                                    onChange={(e) => updateSiteFooter({ newsletterHeading: e.target.value })}
                                                    className="w-full rounded border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-2.5 py-1 text-xs text-[var(--admin-text)]"
                                                />
                                            </label>
                                        </div>
                                        <div>
                                            <label className="text-xs text-[var(--admin-text-secondary)] block mb-1">
                                                {t("admin.html.card_title")}
                                                <input
                                                    type="text"
                                                    value={siteFooter.newsletterCardTitle}
                                                    onChange={(e) => updateSiteFooter({ newsletterCardTitle: e.target.value })}
                                                    className="w-full rounded border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-2.5 py-1 text-xs text-[var(--admin-text)]"
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-[var(--admin-text-secondary)] block mb-1">
                                                {t("admin.html.copyright")}
                                                <input
                                                    type="text"
                                                    value={siteFooter.copyrightText}
                                                    onChange={(e) => updateSiteFooter({ copyrightText: e.target.value })}
                                                    className="w-full rounded border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-2.5 py-1 text-xs text-[var(--admin-text)]"
                                                />
                                            </label>
                                        </div>
                                        <div>
                                            <label className="text-xs text-[var(--admin-text-secondary)] block mb-1">
                                                {t("admin.html.icp")}
                                                <input
                                                    type="text"
                                                    value={siteFooter.icpNumber}
                                                    onChange={(e) => updateSiteFooter({ icpNumber: e.target.value })}
                                                    className="w-full rounded border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-2.5 py-1 text-xs text-[var(--admin-text)]"
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="text-xs text-[var(--admin-text-secondary)] block mb-1">
                                                {t("admin.html.system_label")}
                                                <input
                                                    type="text"
                                                    value={siteFooter.operatingSystemText}
                                                    onChange={(e) => updateSiteFooter({ operatingSystemText: e.target.value })}
                                                    className="w-full rounded border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-2.5 py-1 text-xs text-[var(--admin-text)]"
                                                />
                                            </label>
                                        </div>
                                        <div>
                                            <label className="text-xs text-[var(--admin-text-secondary)] block mb-1">
                                                {t("admin.html.status_primary")}
                                                <input
                                                    type="text"
                                                    value={siteFooter.statusPrimaryText}
                                                    onChange={(e) => updateSiteFooter({ statusPrimaryText: e.target.value })}
                                                    className="w-full rounded border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-2.5 py-1 text-xs text-[var(--admin-text)]"
                                                />
                                            </label>
                                        </div>
                                        <div>
                                            <label className="text-xs text-[var(--admin-text-secondary)] block mb-1">
                                                {t("admin.html.status_secondary")}
                                                <input
                                                    type="text"
                                                    value={siteFooter.statusSecondaryText}
                                                    onChange={(e) => updateSiteFooter({ statusSecondaryText: e.target.value })}
                                                    className="w-full rounded border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-2.5 py-1 text-xs text-[var(--admin-text)]"
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 底部实时预览 */}
                            <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] overflow-hidden">
                                <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-xs text-[var(--admin-text-secondary)]">
                                    <span className="font-mono">{t("admin.html.footer_preview")}</span>
                                    <span className="text-[var(--admin-status-success)] font-mono">Dark #07080c</span>
                                </div>
                                <div className="[&>footer]:mt-0">
                                    <SupdanceAboutFooter configOverride={siteFooter} forceShow />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </fieldset>
            {/* 模版库弹窗 */}
            <Modal title={t("admin.html.template_title")} open={templateModalOpen} onCancel={() => setTemplateModalOpen(false)} footer={null} width={840} rootClassName="plugin-scope-html-admin">
                <div className="py-2">
                    <p className="text-xs text-muted-foreground mb-4">{t("admin.html.template_description")}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1">
                        {BUILTIN_HTML_TEMPLATES.map((tpl) => (
                            <div
                                role="button"
                                tabIndex={0}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        applyTemplate(tpl);
                                    }
                                }}
                                key={tpl.id}
                                className="flex flex-col justify-between rounded-xl border border-border p-4 bg-card hover:border-foreground/30 transition-all cursor-pointer group"
                                onClick={() => applyTemplate(tpl)}
                            >
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{tpl.name}</h3>
                                        <Tag color={tpl.theme === "dark" ? "default" : "blue"} className="text-xs">
                                            {tpl.badge}
                                        </Tag>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 mb-3">{tpl.description}</p>
                                </div>
                                <div className="flex items-center justify-between pt-3 border-t border-border/60 text-xs text-primary font-medium">
                                    <span>{t("admin.html.apply")}</span>
                                    <span>&rarr;</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Modal>

            {/* 新建页面弹窗 */}
            <Modal
                rootClassName="plugin-scope-html-admin"
                title={t("admin.html.create_title")}
                open={newPageModalOpen}
                onCancel={() => setNewPageModalOpen(false)}
                onOk={handleCreatePage}
                okText={t("admin.html.create")}
                cancelText={t("admin.html.cancel")}
            >
                <div className="space-y-4 py-2">
                    <div>
                        <label className="text-xs font-medium text-foreground block mb-1">
                            {t("admin.html.page_title")}
                            <input
                                type="text"
                                placeholder={t("admin.html.title_placeholder")}
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        </label>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-foreground block mb-1">{t("admin.html.url_slug")}</label>
                        <div className="flex items-center gap-1 text-sm font-mono text-muted-foreground">
                            <span>/</span>
                            <input
                                type="text"
                                placeholder={t("admin.html.slug_placeholder")}
                                value={newSlug}
                                onChange={(e) => setNewSlug(e.target.value)}
                                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-foreground block mb-1">
                            {t("admin.html.initial_template")}
                            <select value={newTemplateId} onChange={(e) => setNewTemplateId(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                                {BUILTIN_HTML_TEMPLATES.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name} ({t.badge})
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

function sitePagesClone(siteFooter: HtmlSiteFooterConfig) {
    return siteFooter.sitePages;
}

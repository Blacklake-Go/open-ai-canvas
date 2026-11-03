import { App, Button, Dropdown, Modal, Switch, Tag, Tooltip } from "antd";
import {
    ArrowLeft,
    Check,
    Code2,
    Columns2,
    Copy,
    Download,
    ExternalLink,
    Eye,
    FileCode,
    FolderPlus,
    Heading1,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    Maximize2,
    Moon,
    Plus,
    RefreshCw,
    RotateCcw,
    Save,
    Smartphone,
    Sparkles,
    Sun,
    Table as TableIcon,
    Tablet,
    Monitor,
    Trash2,
    Wand2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { fetchAdminHtmlPagesOverview, resetAdminHtmlPages, saveAdminHtmlPages } from "../api";
import { BUILTIN_HTML_TEMPLATES } from "../templates";
import type { ManagedHtmlPage } from "../types";

/**
 * 轻量、高效、无冗余依赖的 HTML 代码美化格式化器。
 * 能够规范标签缩进、处理换行与自闭合标签，使排版赏心悦目。
 */
function formatHtmlCode(html: string): string {
    const tab = "  ";
    let result = "";
    let indent = 0;

    // 清理多余空行与两端空格
    const tokens = html
        .replace(/>\s*</g, "><")
        .replace(/<!--[\s\S]*?-->/g, (m) => m) // 保留注释
        .split(/(<[^>]+>)/g)
        .filter((t) => t.trim().length > 0);

    const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i].trim();
        if (!token) continue;

        if (token.startsWith("<!") || token.startsWith("<?")) {
            result += token + "\n";
            continue;
        }

        if (token.startsWith("</")) {
            indent = Math.max(0, indent - 1);
            result += tab.repeat(indent) + token + "\n";
            continue;
        }

        if (token.startsWith("<") && !token.startsWith("</")) {
            const match = token.match(/^<([a-zA-Z0-9:-]+)/);
            const tagName = match ? match[1].toLowerCase() : "";
            const isSelfClosing = token.endsWith("/>") || voidTags.has(tagName);

            result += tab.repeat(indent) + token + "\n";
            if (!isSelfClosing) {
                indent++;
            }
            continue;
        }

        // 纯文本
        result += tab.repeat(indent) + token + "\n";
    }

    return result.trim() + "\n";
}

export default function HtmlPageManager() {
    const { message, modal } = App.useApp();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [pages, setPages] = useState<ManagedHtmlPage[]>([]);
    const [activeId, setActiveId] = useState<string>("");
    const [viewMode, setViewMode] = useState<"split" | "code" | "preview">("split");
    const [deviceViewport, setDeviceViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
    const [previewTheme, setPreviewTheme] = useState<"default" | "dark" | "light">("default");
    const [templateModalOpen, setTemplateModalOpen] = useState(false);
    const [newPageModalOpen, setNewPageModalOpen] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newSlug, setNewSlug] = useState("");
    const [newTemplateId, setNewTemplateId] = useState("linear-dark");

    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    // 加载页面列表
    const loadData = async () => {
        setLoading(true);
        try {
            const res = await fetchAdminHtmlPagesOverview();
            setPages(res.pages);
            if (res.pages.length > 0 && !activeId) {
                setActiveId(res.pages[0].id);
            }
        } catch (err) {
            message.error(err instanceof Error ? err.message : "读取页面数据失败");
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

    // 格式化当前 HTML
    const handleBeautify = () => {
        if (!activePage) return;
        try {
            const formatted = formatHtmlCode(activePage.html);
            updateActivePage({ html: formatted });
            message.success("HTML 代码已美化排版");
        } catch {
            message.warning("HTML 格式化遇到不规则标签，已尽量规范排版");
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

    // 保存页面
    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await saveAdminHtmlPages(pages);
            setPages(res.pages);
            message.success("所有 HTML 页面已安全保存");
        } catch (err) {
            message.error(err instanceof Error ? err.message : "保存页面失败");
        } finally {
            setSaving(false);
        }
    };

    // 重置页面为初始高质感模板
    const handleReset = () => {
        modal.confirm({
            title: "重置所有页面为高质感默认模板？",
            content: "该操作将恢复服务条款、隐私政策、法律中心等官方样板，您自建的未保存页面将被覆盖。",
            okText: "确认重置",
            okButtonProps: { danger: true },
            cancelText: "取消",
            onOk: async () => {
                try {
                    const res = await resetAdminHtmlPages();
                    setPages(res.pages);
                    if (res.pages[0]) setActiveId(res.pages[0].id);
                    message.success("已恢复为初始优质法务模板");
                } catch (err) {
                    message.error(err instanceof Error ? err.message : "重置失败");
                }
            },
        });
    };

    // 复制 HTML
    const handleCopyHtml = async () => {
        if (!activePage) return;
        try {
            await navigator.clipboard.writeText(activePage.html);
            message.success("HTML 代码已复制到剪贴板");
        } catch {
            message.error("复制失败，请手动选取复制");
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
        message.success(`已导出 ${activePage.slug}.html 独立页面`);
    };

    // 在新标签页全屏预览
    const handleOpenInNewTab = () => {
        if (!activePage) return;
        const newWin = window.open("about:blank", "_blank");
        if (newWin) {
            newWin.document.write(activePage.html);
            newWin.document.close();
        }
    };

    // 新建页面确认
    const handleCreatePage = () => {
        if (!newTitle.trim()) {
            message.warning("请输入页面标题");
            return;
        }
        const slug = (newSlug.trim() || newTitle.trim().toLowerCase()).replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-_]/g, "");
        const template = BUILTIN_HTML_TEMPLATES.find((t) => t.id === newTemplateId) || BUILTIN_HTML_TEMPLATES[0];

        const newPage: ManagedHtmlPage = {
            id: `page-${Date.now()}`,
            slug: slug || `page-${Date.now()}`,
            title: newTitle.trim(),
            description: `${template.name} 模板`,
            templateId: template.id,
            html: template.sampleHtml.replace("<title>Terms of Service · 服务条款</title>", `<title>${newTitle.trim()} · 官方文档</title>`),
            isPublished: true,
            updatedAt: new Date().toISOString(),
        };

        setPages((prev) => [...prev, newPage]);
        setActiveId(newPage.id);
        setNewPageModalOpen(false);
        setNewTitle("");
        setNewSlug("");
        message.success(`页面「${newPage.title}」创建成功`);
    };

    // 删除当前页面
    const handleDeleteCurrentPage = () => {
        if (!activePage) return;
        if (pages.length <= 1) {
            message.warning("至少保留一个页面");
            return;
        }
        modal.confirm({
            title: `删除页面「${activePage.title}」？`,
            content: `路径 /${activePage.slug} 将无法访问。`,
            okText: "确认删除",
            okButtonProps: { danger: true },
            cancelText: "取消",
            onOk: () => {
                const next = pages.filter((p) => p.id !== activePage.id);
                setPages(next);
                setActiveId(next[0].id);
                message.success("页面已移除");
            },
        });
    };

    // 套用模板
    const applyTemplate = (tpl: typeof BUILTIN_HTML_TEMPLATES[0]) => {
        if (!activePage) return;
        modal.confirm({
            title: `套用模版「${tpl.name}」？`,
            content: "当前编辑器中的 HTML 将被替换为此模版的完整骨架代码，请确认已保存旧草稿。",
            okText: "确认套用",
            cancelText: "取消",
            onOk: () => {
                updateActivePage({
                    templateId: tpl.id,
                    html: tpl.sampleHtml,
                });
                setTemplateModalOpen(false);
                message.success(`已套用「${tpl.name}」`);
            },
        });
    };

    // 视口尺寸计算
    const viewportWidthStyle = deviceViewport === "mobile" ? "375px" : deviceViewport === "tablet" ? "768px" : "100%";

    return (
        <div className="flex h-screen w-screen flex-col bg-[#0c0c0e] text-[#f4f4f6] font-sans overflow-hidden">
            {/* 顶栏 Header */}
            <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4 bg-[#141418]">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate("/admin/plugins")}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-[#a2a2ad] hover:border-white/20 hover:text-white transition-colors"
                        title="返回插件管理"
                    >
                        <ArrowLeft className="size-3.5" />
                        插件列表
                    </button>
                    <div className="h-4 w-px bg-white/15" />
                    <div className="flex items-center gap-2">
                        <FileCode className="size-4 text-sky-400" />
                        <h1 className="text-sm font-semibold tracking-tight text-white">supdance html页面管理</h1>
                        <Tag color="cyan" className="rounded-full text-[10px] px-2 border-0">
                            法务条款 & 单页工作台
                        </Tag>
                    </div>
                </div>

                {/* 中间：视图分栏与设备切换 */}
                <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 p-1">
                    <button
                        type="button"
                        onClick={() => setViewMode("code")}
                        className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs transition-colors ${
                            viewMode === "code" ? "bg-white/15 text-white font-medium" : "text-[#8a8f98] hover:text-white"
                        }`}
                        title="仅源码模式"
                    >
                        <Code2 className="size-3.5" />
                        源码
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode("split")}
                        className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs transition-colors ${
                            viewMode === "split" ? "bg-white/15 text-white font-medium" : "text-[#8a8f98] hover:text-white"
                        }`}
                        title="分栏实时对照"
                    >
                        <Columns2 className="size-3.5" />
                        双栏
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode("preview")}
                        className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs transition-colors ${
                            viewMode === "preview" ? "bg-white/15 text-white font-medium" : "text-[#8a8f98] hover:text-white"
                        }`}
                        title="纯预览模式"
                    >
                        <Eye className="size-3.5" />
                        预览
                    </button>

                    {viewMode !== "code" && (
                        <>
                            <div className="mx-1 h-3.5 w-px bg-white/10" />
                            <button
                                type="button"
                                onClick={() => setDeviceViewport("desktop")}
                                className={`p-1 rounded transition-colors ${deviceViewport === "desktop" ? "text-white bg-white/15" : "text-[#8a8f98] hover:text-white"}`}
                                title="桌面端 100%"
                            >
                                <Monitor className="size-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setDeviceViewport("tablet")}
                                className={`p-1 rounded transition-colors ${deviceViewport === "tablet" ? "text-white bg-white/15" : "text-[#8a8f98] hover:text-white"}`}
                                title="平板端 768px"
                            >
                                <Tablet className="size-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setDeviceViewport("mobile")}
                                className={`p-1 rounded transition-colors ${deviceViewport === "mobile" ? "text-white bg-white/15" : "text-[#8a8f98] hover:text-white"}`}
                                title="手机端 375px"
                            >
                                <Smartphone className="size-3.5" />
                            </button>
                        </>
                    )}
                </div>

                {/* 右侧：保存、导出与功能操作 */}
                <div className="flex items-center gap-2">
                    <Button
                        size="small"
                        icon={<Sparkles className="size-3.5 text-amber-300" />}
                        onClick={() => setTemplateModalOpen(true)}
                        className="border-white/15 text-xs bg-white/5 hover:bg-white/10"
                    >
                        套用模版
                    </Button>
                    <Tooltip title="一键格式化与整洁排版">
                        <Button size="small" icon={<Wand2 className="size-3.5" />} onClick={handleBeautify} className="border-white/15 text-xs bg-white/5">
                            排版美化
                        </Button>
                    </Tooltip>
                    <Tooltip title="下载独立单文件 HTML">
                        <Button size="small" icon={<Download className="size-3.5" />} onClick={handleDownloadHtml} className="border-white/15 text-xs bg-white/5" />
                    </Tooltip>
                    <Tooltip title="在新标签页全屏独立打开">
                        <Button size="small" icon={<ExternalLink className="size-3.5" />} onClick={handleOpenInNewTab} className="border-white/15 text-xs bg-white/5" />
                    </Tooltip>
                    <Button
                        type="primary"
                        size="small"
                        icon={<Save className="size-3.5" />}
                        loading={saving}
                        onClick={() => void handleSave()}
                        className="bg-sky-500 hover:bg-sky-400 font-medium text-xs px-3"
                    >
                        保存页面
                    </Button>
                </div>
            </header>

            {/* 主工作区 */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* 左栏：页面抽屉/列表 */}
                <aside className="w-64 shrink-0 flex flex-col border-r border-white/10 bg-[#121215]">
                    <div className="flex items-center justify-between border-b border-white/10 p-3">
                        <span className="text-xs font-medium text-[#8a8f98] uppercase tracking-wider">页面清单 ({pages.length})</span>
                        <button
                            type="button"
                            onClick={() => setNewPageModalOpen(true)}
                            className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-sky-400 hover:bg-sky-500/10 transition-colors"
                        >
                            <Plus className="size-3" />
                            新建
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {pages.map((p) => {
                            const isCurrent = p.id === activePage?.id;
                            return (
                                <div
                                    key={p.id}
                                    onClick={() => setActiveId(p.id)}
                                    className={`group flex items-center justify-between rounded-lg p-2.5 cursor-pointer text-xs transition-colors ${
                                        isCurrent ? "bg-white/10 text-white font-medium border border-white/15" : "text-[#a2a2ad] hover:bg-white/5 hover:text-white"
                                    }`}
                                >
                                    <div className="min-w-0 flex-1 pr-2">
                                        <div className="flex items-center gap-1.5 truncate">
                                            <span className="truncate">{p.title}</span>
                                            {p.isPublished ? (
                                                <span className="size-1.5 rounded-full bg-emerald-400 shrink-0" title="已发布" />
                                            ) : (
                                                <span className="size-1.5 rounded-full bg-amber-400 shrink-0" title="草稿" />
                                            )}
                                        </div>
                                        <div className="font-mono text-[11px] text-[#6a6a75] truncate mt-0.5">/{p.slug}</div>
                                    </div>
                                    <span className="text-[10px] text-[#555] group-hover:text-[#888] font-mono shrink-0">
                                        {p.templateId ? p.templateId.replace("-", " ") : "html"}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* 左侧底栏：页面属性快速编辑与重置 */}
                    {activePage && (
                        <div className="border-t border-white/10 p-3 space-y-2.5 bg-black/30">
                            <div className="space-y-1">
                                <label className="text-[11px] text-[#7c7c88]">页面标题</label>
                                <input
                                    type="text"
                                    value={activePage.title}
                                    onChange={(e) => updateActivePage({ title: e.target.value })}
                                    className="w-full rounded border border-white/10 bg-black/50 px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] text-[#7c7c88]">访问路径 (Slug)</label>
                                <input
                                    type="text"
                                    value={activePage.slug}
                                    onChange={(e) => updateActivePage({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, "") })}
                                    className="w-full rounded border border-white/10 bg-black/50 px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                                />
                            </div>
                            <div className="flex items-center justify-between pt-1">
                                <span className="text-xs text-[#a2a2ad]">公开访问</span>
                                <Switch
                                    size="small"
                                    checked={activePage.isPublished}
                                    onChange={(checked) => updateActivePage({ isPublished: checked })}
                                />
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-white/10">
                                <button
                                    type="button"
                                    onClick={handleDeleteCurrentPage}
                                    className="inline-flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300"
                                >
                                    <Trash2 className="size-3" />
                                    删除此页
                                </button>
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    className="inline-flex items-center gap-1 text-[11px] text-[#7c7c88] hover:text-white"
                                    title="恢复默认官方条款"
                                >
                                    <RotateCcw className="size-3" />
                                    重置
                                </button>
                            </div>
                        </div>
                    )}
                </aside>

                {/* 编辑器主舞台 */}
                <div className="flex flex-1 flex-col min-w-0 bg-[#0c0c0e]">
                    {/* 排版快捷工具栏 */}
                    {viewMode !== "preview" && (
                        <div className="flex items-center gap-1 overflow-x-auto border-b border-white/10 px-3 py-1.5 bg-[#121215] text-xs">
                            <span className="text-[11px] font-mono text-[#666] mr-2 shrink-0">排版快捷元素:</span>
                            <button
                                type="button"
                                onClick={() => insertSnippet((s) => `<h1>${s || "大标题"}</h1>\n`)}
                                className="rounded px-2 py-1 text-[#a2a2ad] hover:bg-white/10 hover:text-white"
                                title="插入一级大标题"
                            >
                                <Heading1 className="size-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => insertSnippet((s) => `<h2>${s || "1. 章节条款"}</h2>\n`)}
                                className="rounded px-2 py-1 text-[#a2a2ad] hover:bg-white/10 hover:text-white"
                                title="插入二级章节标题"
                            >
                                <Heading2 className="size-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => insertSnippet((s) => `<h3>${s || "1.1 详细条款"}</h3>\n`)}
                                className="rounded px-2 py-1 text-[#a2a2ad] hover:bg-white/10 hover:text-white"
                                title="插入三级条款标题"
                            >
                                <Heading3 className="size-3.5" />
                            </button>
                            <div className="h-3 w-px bg-white/15 mx-1" />
                            <button
                                type="button"
                                onClick={() => insertSnippet((s) => `<p>${s || "请输入正文段落说明..."}</p>\n`)}
                                className="rounded px-2 py-1 text-[#a2a2ad] hover:bg-white/10 hover:text-white font-mono text-[11px]"
                                title="插入段落 <p>"
                            >
                                P
                            </button>
                            <button
                                type="button"
                                onClick={() => insertSnippet((s) => `<strong>${s || "重点条款"}</strong>`)}
                                className="rounded px-2 py-1 text-[#a2a2ad] hover:bg-white/10 hover:text-white font-bold text-[11px]"
                                title="粗体 <strong>"
                            >
                                B
                            </button>
                            <button
                                type="button"
                                onClick={() => insertSnippet((s) => `<em>${s || "强调内容"}</em>`)}
                                className="rounded px-2 py-1 text-[#a2a2ad] hover:bg-white/10 hover:text-white italic text-[11px]"
                                title="斜体 <em>"
                            >
                                I
                            </button>
                            <div className="h-3 w-px bg-white/15 mx-1" />
                            <button
                                type="button"
                                onClick={() => insertSnippet(`<ul>\n  <li>条款清单项 1</li>\n  <li>条款清单项 2</li>\n</ul>\n`)}
                                className="rounded px-2 py-1 text-[#a2a2ad] hover:bg-white/10 hover:text-white"
                                title="插入无序列表 <ul>"
                            >
                                <List className="size-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => insertSnippet(`<ol>\n  <li>序号步骤 1</li>\n  <li>序号步骤 2</li>\n</ol>\n`)}
                                className="rounded px-2 py-1 text-[#a2a2ad] hover:bg-white/10 hover:text-white"
                                title="插入有序列表 <ol>"
                            >
                                <ListOrdered className="size-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    insertSnippet(`<table>\n  <thead>\n    <tr><th>类别</th><th>收集内容</th><th>合法用途</th></tr>\n  </thead>\n  <tbody>\n    <tr><td>账号凭据</td><td>手机号/邮箱</td><td>身份鉴权与安全防护</td></tr>\n  </tbody>\n</table>\n`)
                                }
                                className="rounded px-2 py-1 text-[#a2a2ad] hover:bg-white/10 hover:text-white"
                                title="插入法务合规表格 <table>"
                            >
                                <TableIcon className="size-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => insertSnippet((s) => `<div class="callout">\n  <strong>特别提醒：</strong>${s || "本条款涉及您的核心退款与数据所有权益，请仔细审阅。"}\n</div>\n`)}
                                className="rounded px-2 py-1 text-amber-300/80 hover:bg-white/10 hover:text-amber-200 text-[11px]"
                                title="插入高亮重点声明框"
                            >
                                Callout
                            </button>
                            <button
                                type="button"
                                onClick={() => insertSnippet(`<hr style="border:0;border-top:1px solid var(--border,#333);margin:32px 0;" />\n`)}
                                className="rounded px-2 py-1 text-[#a2a2ad] hover:bg-white/10 hover:text-white text-[11px] font-mono"
                                title="插入水平分割线 <hr>"
                            >
                                HR
                            </button>
                            <div className="flex-1" />
                            <button
                                type="button"
                                onClick={handleCopyHtml}
                                className="flex items-center gap-1 text-[11px] text-[#a2a2ad] hover:text-white px-2 py-1 rounded hover:bg-white/5"
                                title="复制全文代码"
                            >
                                <Copy className="size-3" />
                                复制代码
                            </button>
                        </div>
                    )}

                    {/* 编辑与预览分屏主体 */}
                    <div className="flex flex-1 min-h-0 min-w-0">
                        {/* 左：代码编辑器 */}
                        {viewMode !== "preview" && (
                            <div className={`flex flex-col min-w-0 ${viewMode === "split" ? "w-1/2 border-r border-white/10" : "w-full"}`}>
                                <textarea
                                    ref={textareaRef}
                                    value={activePage?.html || ""}
                                    onChange={(e) => updateActivePage({ html: e.target.value })}
                                    placeholder="在此输入或粘贴完整自包含 HTML 页面代码..."
                                    spellCheck={false}
                                    className="flex-1 w-full resize-none bg-[#09090b] p-4 font-mono text-[13px] leading-relaxed text-[#e2e2e8] focus:outline-none selection:bg-sky-500/30"
                                />
                                <div className="flex items-center justify-between border-t border-white/5 bg-[#0a0a0c] px-3 py-1 text-[11px] text-[#666] font-mono">
                                    <span>字数: {activePage?.html.length || 0} 字符</span>
                                    <span>模板类型: {activePage?.templateId || "custom"}</span>
                                </div>
                            </div>
                        )}

                        {/* 右：实时沙箱预览 */}
                        {viewMode !== "code" && (
                            <div className={`flex flex-col min-w-0 bg-[#16161a] overflow-hidden ${viewMode === "split" ? "w-1/2" : "w-full"}`}>
                                <div className="flex items-center justify-between border-b border-white/10 bg-[#111114] px-4 py-1 text-xs text-[#8a8f98]">
                                    <div className="flex items-center gap-2">
                                        <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="font-mono text-[11px]">实时沙箱预览</span>
                                        <span className="text-[11px] text-[#555]">（自包含 CSS 隔离环境）</span>
                                    </div>
                                    <div className="font-mono text-[11px] text-[#666]">
                                        视口: {viewportWidthStyle}
                                    </div>
                                </div>

                                <div className="flex flex-1 items-center justify-center overflow-auto p-4 bg-[#0a0a0c]/60">
                                    <div
                                        style={{ width: viewportWidthStyle, height: "100%" }}
                                        className="h-full rounded-lg shadow-2xl overflow-hidden border border-white/10 bg-black transition-all duration-200"
                                    >
                                        <iframe
                                            title="HTML Page Live Preview"
                                            srcDoc={activePage?.html || "<p>无预览内容</p>"}
                                            sandbox="allow-scripts allow-same-origin"
                                            className="h-full w-full border-0 bg-transparent"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 模版库弹窗 */}
            <Modal
                title="选择法务条款精美开源 HTML 模版"
                open={templateModalOpen}
                onCancel={() => setTemplateModalOpen(false)}
                footer={null}
                width={840}
                className="html-template-modal"
            >
                <div className="py-2">
                    <p className="text-xs text-muted-foreground mb-4">
                        所有模板均为自包含独立 HTML，内置针对条款阅读调优的优雅 CSS，响应式兼容手机与桌面端，可直接导出为单文件。
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1">
                        {BUILTIN_HTML_TEMPLATES.map((tpl) => (
                            <div
                                key={tpl.id}
                                className="flex flex-col justify-between rounded-xl border border-border p-4 bg-card hover:border-foreground/30 transition-all cursor-pointer group"
                                onClick={() => applyTemplate(tpl)}
                            >
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{tpl.name}</h3>
                                        <Tag color={tpl.theme === "dark" ? "default" : "blue"} className="text-[10px]">
                                            {tpl.badge}
                                        </Tag>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 mb-3">{tpl.description}</p>
                                </div>
                                <div className="flex items-center justify-between pt-3 border-t border-border/60 text-xs text-primary font-medium">
                                    <span>立即套用</span>
                                    <span>&rarr;</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Modal>

            {/* 新建页面弹窗 */}
            <Modal
                title="创建新的 HTML 页面"
                open={newPageModalOpen}
                onCancel={() => setNewPageModalOpen(false)}
                onOk={handleCreatePage}
                okText="创建页面"
                cancelText="取消"
            >
                <div className="space-y-4 py-2">
                    <div>
                        <label className="text-xs font-medium text-foreground block mb-1">页面标题</label>
                        <input
                            type="text"
                            placeholder="如：第三方内容披露协议"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-foreground block mb-1">访问路径 (URL Slug)</label>
                        <div className="flex items-center gap-1 text-sm font-mono text-muted-foreground">
                            <span>/</span>
                            <input
                                type="text"
                                placeholder="如：third-party-license"
                                value={newSlug}
                                onChange={(e) => setNewSlug(e.target.value)}
                                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-foreground block mb-1">初始基础模版</label>
                        <select
                            value={newTemplateId}
                            onChange={(e) => setNewTemplateId(e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                            {BUILTIN_HTML_TEMPLATES.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.name} ({t.badge})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

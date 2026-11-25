import { useState, useMemo, useEffect, useRef } from "react";
import { App } from "antd";
import { AlertCircle, AlertTriangle, Check, Copy, Download, Image as ImageIcon, LayoutGrid, Loader2, Maximize2, Menu, Pencil, RefreshCw, RotateCcw, Sparkles, X } from "lucide-react";

import { useI18n } from "@/supdance/plugins/i18n";
import { Tooltip } from "@/components/ui/base/tooltip";
import { useCopyText } from "@/hooks/use-copy-text";
import { creationResultAssetIds } from "@/lib/canvas/canvas-asset-handoff";
import { useAssetStore } from "@/stores/use-asset-store";
import { continueCreationConversationOnCanvas } from "@/services/creation-canvas-conversation";
import { downloadBrowserMedia } from "@/services/browser-download";
import { getResourceAccess, resolveResourceAccessURL, resourceIdFromStorageKey } from "@/services/api/resources";
import { resolveImageUrl } from "@/services/image-storage";
import { workspacePath } from "@/lib/workspace-routes";
import { creationResultEntries } from "@/pages/create/creation-result-urls";
import type { CreationConversation, CreationMessage } from "@/pages/create/creation-types";

type TaskItem = {
    id: string;
    userMessage: CreationMessage;
    assistantMessage?: CreationMessage;
    createdAt: string;
};

export function formatDateGroup(dateStr: string, t: (key: string, params?: Record<string, string | number>) => string): string {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return t("create.workspace.dateEarlier");
    const now = new Date();
    const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (isToday) return t("create.workspace.dateToday");

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear();
    if (isYesterday) return t("create.workspace.dateYesterday");

    return t("create.workspace.dateLabel", { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() });
}

/** 时间流卡片的展示状态：连接中断不是失败；有稳定 storageKey 的恢复结果不是空结果。 */
export function imageTaskCardState(assistant: CreationMessage | undefined): { isPending: boolean; isDone: boolean; isError: boolean; isInterrupted: boolean } {
    const hasResults = Boolean(assistant?.resultUrls?.length || assistant?.resultStorageKeys?.length);
    const isInterrupted = Boolean(assistant?.syncInterrupted);
    const isPending = assistant ? assistant.status === "pending" || assistant.status === "streaming" : false;
    const isDone = assistant ? assistant.status === "done" && hasResults : false;
    const isError = assistant ? !isInterrupted && (assistant.status === "error" || assistant.generationStatus === "failed" || (assistant.status === "done" && !hasResults)) : false;
    return { isPending, isDone, isError, isInterrupted };
}

function formatTaskTime(dateStr: string): string {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${hours}:${mins}`;
}

function getAspectRatioValue(ratio?: string): number {
    if (!ratio) return 1;
    const parts = ratio.split(":").map(Number);
    if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
        return parts[0] / parts[1];
    }
    return 1;
}

export function ImageWorkspaceTimeline({
    conversation,
    sessionError,
    onReuseParams,
    onRegenerate,
    onRefetchResult,
    onRecoverMedia,
    onSetReferenceImage,
    onRenameSession,
    onOpenAssetDrawer,
    assetDrawerOpen,
    onOpenMobileNav,
    onNewSession,
}: {
    conversation?: CreationConversation;
    sessionError?: "not_found" | "unauthorized" | null;
    onReuseParams: (userMessage: CreationMessage) => void;
    onRegenerate: (userMessage: CreationMessage) => void;
    onRefetchResult: (assistantMessage: CreationMessage) => void;
    onRecoverMedia: (assistantMessage: CreationMessage) => void;
    onSetReferenceImage: (imageUrl: string) => void;
    onRenameSession: (newTitle: string) => void;
    onOpenAssetDrawer: () => void;
    assetDrawerOpen: boolean;
    onOpenMobileNav?: () => void;
    onNewSession?: () => void;
}) {
    const { message: toast } = App.useApp();
    const { t } = useI18n();
    const copyText = useCopyText();
    const assets = useAssetStore((state) => state.assets);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const [preview, setPreview] = useState<{ url: string; storageKey?: string } | null>(null);
    const previewUrl = preview?.url || null;
    const previewStorageKey = preview?.storageKey;
    const setPreviewUrl = (url: string | null, storageKey?: string) => setPreview(url ? { url, storageKey } : null);
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameTitle, setRenameTitle] = useState("");
    const [expandedPrompts, setExpandedPrompts] = useState<Record<string, boolean>>({});
    // 展示地址按 storageKey 解析并续签；历史 hint 只在签名有效期内兜底（与创作页同一契约）。
    const [resolvedByKey, setResolvedByKey] = useState<Record<string, string>>({});
    const [failedByKey, setFailedByKey] = useState<Record<string, boolean>>({});

    const resultStorageKeys = useMemo(() => Array.from(new Set((conversation?.messages || []).flatMap((m) => (m.role === "assistant" ? m.resultStorageKeys || [] : [])))), [conversation?.messages]);

    useEffect(() => {
        if (!resultStorageKeys.length) return;
        let active = true;
        const timers: ReturnType<typeof setTimeout>[] = [];
        const updateResultUrl = (storageKey: string, url: string) => {
            if (!active || !url) return;
            setResolvedByKey((current) => (current[storageKey] === url ? current : { ...current, [storageKey]: url }));
        };
        const refreshRemote = async (storageKey: string): Promise<void> => {
            try {
                const access = await getResourceAccess(storageKey, "display");
                if (!active) return;
                updateResultUrl(storageKey, resolveResourceAccessURL(access.url));
                const refreshAt = access.refreshAt ? new Date(access.refreshAt).getTime() : Number.NaN;
                const expiresAt = access.expiresAt ? new Date(access.expiresAt).getTime() : Number.NaN;
                const nextRefreshAt = Number.isFinite(refreshAt) ? refreshAt : expiresAt;
                const delay = Number.isFinite(nextRefreshAt) ? Math.max(10_000, nextRefreshAt - Date.now()) : 4 * 60_000;
                timers.push(setTimeout(() => void refreshRemote(storageKey), delay));
            } catch {
                if (!active) return;
                setFailedByKey((current) => (current[storageKey] ? current : { ...current, [storageKey]: true }));
                timers.push(setTimeout(() => void refreshRemote(storageKey), 60_000));
            }
        };
        void Promise.all(
            resultStorageKeys.map(async (storageKey) => {
                if (resourceIdFromStorageKey(storageKey)) {
                    await refreshRemote(storageKey);
                    return;
                }
                const url = await resolveImageUrl(storageKey);
                updateResultUrl(storageKey, url);
            }),
        ).catch(() => {
            // 保留页面已有的 URL hint；签名过期时由 media 空态兜底，不回退到平台正文代理。
        });
        return () => {
            active = false;
            timers.forEach((timer) => clearTimeout(timer));
        };
    }, [resultStorageKeys.join("|")]);

    // Group messages into tasks (user prompt + assistant result)
    const taskItems = useMemo<TaskItem[]>(() => {
        if (!conversation?.messages?.length) return [];
        const items: TaskItem[] = [];
        const msgs = conversation.messages;

        for (let i = 0; i < msgs.length; i++) {
            const current = msgs[i];
            if (current.role === "user") {
                const next = msgs[i + 1]?.role === "assistant" ? msgs[i + 1] : undefined;
                items.push({
                    id: current.id,
                    userMessage: current,
                    assistantMessage: next,
                    createdAt: current.createdAt || new Date().toISOString(),
                });
            } else if (current.role === "assistant" && (i === 0 || msgs[i - 1]?.role !== "user")) {
                // Standalone assistant message
                items.push({
                    id: current.id,
                    userMessage: {
                        id: `auto-${current.id}`,
                        role: "user",
                        content: current.content || t("canvasA.activeTasks.title"),
                        createdAt: current.createdAt,
                    },
                    assistantMessage: current,
                    createdAt: current.createdAt || new Date().toISOString(),
                });
            }
        }
        return items;
    }, [conversation?.messages]);

    // Group tasks by date
    const dateGroups = useMemo(() => {
        const groups: Array<{ label: string; items: TaskItem[] }> = [];
        let currentLabel = "";
        let currentGroup: TaskItem[] = [];

        for (const item of taskItems) {
            const label = formatDateGroup(item.createdAt, t);
            if (label !== currentLabel) {
                if (currentGroup.length > 0) {
                    groups.push({ label: currentLabel, items: currentGroup });
                }
                currentLabel = label;
                currentGroup = [item];
            } else {
                currentGroup.push(item);
            }
        }
        if (currentGroup.length > 0) {
            groups.push({ label: currentLabel, items: currentGroup });
        }
        return groups;
    }, [taskItems, t]);

    // Auto-scroll to bottom on mount, session switch, or when new tasks arrive
    const prevTaskCount = useRef(taskItems.length);
    const prevSessionId = useRef<string | undefined>(conversation?.id);
    useEffect(() => {
        const isNewSession = conversation?.id !== prevSessionId.current;
        prevSessionId.current = conversation?.id;
        if (isNewSession || taskItems.length > prevTaskCount.current) {
            scrollContainerRef.current?.scrollTo({
                top: scrollContainerRef.current.scrollHeight,
                behavior: isNewSession ? "auto" : "smooth",
            });
        }
        prevTaskCount.current = taskItems.length;
    }, [conversation?.id, taskItems.length]);

    // Close preview modal on Escape
    useEffect(() => {
        if (!previewUrl) return;
        const handleKeyDown = (e: globalThis.KeyboardEvent) => {
            if (e.key === "Escape") setPreviewUrl(null);
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [previewUrl]);

    const handleSendToCanvas = async (assistantMessage?: CreationMessage) => {
        if (!conversation || !assistantMessage) return;
        try {
            const project = await continueCreationConversationOnCanvas({
                id: conversation.id,
                title: conversation.title,
                updatedAt: conversation.updatedAt,
                canvasId: conversation.canvasId,
                messages: conversation.messages,
            });
            if (project?.id) {
                toast.success(t("create.workspace.sentToCanvas"));
                window.open(workspacePath(`/canvas/${project.id}`), "_blank");
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t("create.page.handoffFailed"));
        }
    };

    const handleDownloadImage = async (url: string, index: number, storageKey?: string) => {
        try {
            const fileName = `one-creation-${Date.now()}-${index + 1}.png`;
            await downloadBrowserMedia({ fileName, url, storageKey });
            toast.success(t("create.workspace.downloadStarted"));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t("create.workspace.downloadFailed"));
        }
    };

    const togglePromptExpand = (taskId: string) => {
        setExpandedPrompts((prev) => ({
            ...prev,
            [taskId]: !prev[taskId],
        }));
    };

    // If session error (not found or unauthorized)
    if (sessionError) {
        return (
            <main className="image-workspace-main" role="region" aria-label={t("create.workspace.sessionErrorRegion")}>
                <header className="image-workspace-topbar">
                    <div className="image-workspace-title-box">
                        <button type="button" className="image-workspace-mobile-menu-btn" onClick={onOpenMobileNav} aria-label={t("create.workspace.openSessionList")}>
                            <Menu className="size-4" />
                        </button>
                        <h2 className="image-workspace-title-text">{t("create.workspace.title")}</h2>
                    </div>
                </header>
                <div className="flex flex-col items-center justify-center py-32 text-center px-4">
                    <div className="size-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
                        <AlertCircle className="size-8" />
                    </div>
                    <h3 className="text-base font-semibold text-foreground mb-2">{sessionError === "unauthorized" ? t("create.workspace.sessionUnauthorized") : t("create.workspace.sessionNotFound")}</h3>
                    <p className="text-xs text-muted-foreground max-w-sm leading-relaxed mb-6">{sessionError === "unauthorized" ? t("create.workspace.sessionUnauthorizedDetail") : t("create.workspace.sessionNotFoundDetail")}</p>
                    <div className="flex items-center gap-3">
                        <button type="button" className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-medium" onClick={onNewSession}>
                            {t("create.history.new")}
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="image-workspace-main">
            {/* 顶栏：会话标题编辑与素材库抽屉开关 */}
            <header className="image-workspace-topbar">
                <div className="image-workspace-title-box">
                    <button type="button" className="image-workspace-mobile-menu-btn" onClick={onOpenMobileNav} aria-label={t("create.workspace.openSessionList")}>
                        <Menu className="size-4" />
                    </button>
                    {isRenaming ? (
                        <div className="flex items-center gap-1.5">
                            <input
                                type="text"
                                className="text-sm font-semibold bg-black/60 border border-primary rounded px-2 py-0.5 text-foreground outline-none w-64"
                                value={renameTitle}
                                autoFocus
                                onChange={(e) => setRenameTitle(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                                        if (renameTitle.trim()) onRenameSession(renameTitle.trim());
                                        setIsRenaming(false);
                                    } else if (e.key === "Escape") {
                                        setIsRenaming(false);
                                    }
                                }}
                            />
                            <button
                                type="button"
                                className="text-primary hover:text-primary-foreground p-1"
                                onClick={() => {
                                    if (renameTitle.trim()) onRenameSession(renameTitle.trim());
                                    setIsRenaming(false);
                                }}
                            >
                                <Check className="size-4" />
                            </button>
                            <button type="button" className="text-muted-foreground hover:text-foreground p-1" onClick={() => setIsRenaming(false)}>
                                <X className="size-4" />
                            </button>
                        </div>
                    ) : (
                        <>
                            <h2 className="image-workspace-title-text" title={conversation?.title || t("create.workspace.title")}>
                                {conversation?.title || t("create.workspace.title")}
                            </h2>
                            <button
                                type="button"
                                className="image-workspace-title-edit-btn"
                                onClick={() => {
                                    setRenameTitle(conversation?.title || t("create.page.workspaceNav.untitled"));
                                    setIsRenaming(true);
                                }}
                                title={t("create.page.workspaceNav.renameAria")}
                            >
                                <Pencil className="size-3.5" />
                            </button>
                        </>
                    )}
                </div>

                <div className="image-workspace-topbar-actions">
                    <button type="button" className={`image-workspace-tool-btn ${assetDrawerOpen ? "is-active" : ""}`} onClick={onOpenAssetDrawer} aria-pressed={assetDrawerOpen}>
                        <LayoutGrid className="size-3.5" />
                        <span>{t("library.assets.page.title")}</span>
                    </button>
                </div>
            </header>

            {/* 滚动时间流 */}
            <div ref={scrollContainerRef} className="image-workspace-timeline-scroll">
                <div className="image-workspace-timeline-inner">
                    {taskItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 text-center">
                            <div className="size-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground mb-4">
                                <ImageIcon className="size-8" />
                            </div>
                            <h3 className="text-base font-semibold text-foreground mb-1">{t("create.workspace.emptyTitle")}</h3>
                            <p className="text-xs text-muted-foreground max-w-sm leading-relaxed mb-6">{t("create.workspace.emptyDetail")}</p>
                        </div>
                    ) : (
                        dateGroups.map((group) => (
                            <div key={group.label} className="flex flex-col gap-6">
                                <div className="image-workspace-date-divider">
                                    <span className="image-workspace-date-pill">{group.label}</span>
                                </div>

                                {group.items.map((task) => {
                                    const user = task.userMessage;
                                    const assistant = task.assistantMessage;
                                    const prompt = user.content || "";
                                    const settings = user.settings || assistant?.settings;
                                    const ratio = settings?.ratio || "1:1";
                                    // 张数与 composer 的账号并发上限一致（硬上限 15）；网格列数单独 clamp 到 4。
                                    const count = Math.max(1, Math.min(15, Number(settings?.count) || assistant?.taskIds?.length || assistant?.resultUrls?.length || 1));
                                    const model = user.model || assistant?.model || "";
                                    const resolution = settings?.imageResolution || settings?.resolution || "1.5K";
                                    const time = formatTaskTime(task.createdAt);

                                    const { isPending, isDone, isError, isInterrupted } = imageTaskCardState(assistant);
                                    const isClamped = !expandedPrompts[task.id];

                                    // 结果身份是 storageKey；展示地址经访问缓存续签，历史 hint 只在有效期内兜底。
                                    const storedUrls = assistant?.resultUrls || [];
                                    const taskStorageKeys = assistant?.resultStorageKeys || [];
                                    const { entries: resultEntries } = creationResultEntries({
                                        storageKeys: taskStorageKeys,
                                        storedUrls,
                                        resolvedByKey,
                                        failedByKey,
                                        isVideo: false,
                                        isRemoteKey: (storageKey) => Boolean(resourceIdFromStorageKey(storageKey)),
                                    });
                                    const resultUrls = resultEntries.map((entry) => entry.url);
                                    const resultKeys = resultEntries.map((entry) => entry.key);
                                    const resultCount = Math.max(taskStorageKeys.length, storedUrls.length);
                                    const savedAssetIds = assistant ? creationResultAssetIds(assets, { messageId: assistant.id, taskIds: assistant.taskIds || [], resultUrls: storedUrls, resultStorageKeys: taskStorageKeys }) : [];
                                    const allSaved = resultCount > 0 && savedAssetIds.length >= resultCount;
                                    const ratioValue = getAspectRatioValue(ratio);
                                    const remainingPlaceholders = Math.max(0, count - resultCount);

                                    return (
                                        <article key={task.id} className="image-workspace-task-card" aria-label={t("canvasA.activeTasks.title")}>
                                            {/* 任务头部：提示词与参数徽标 */}
                                            <div className="image-workspace-task-header">
                                                <div className="image-workspace-prompt-row">
                                                    <p className={`image-workspace-prompt-text ${isClamped ? "is-clamped" : ""}`}>{prompt}</p>
                                                    <div className="image-workspace-prompt-actions">
                                                        {prompt.length > 80 && (
                                                            <button type="button" className="image-workspace-prompt-btn" onClick={() => togglePromptExpand(task.id)}>
                                                                {isClamped ? t("create.page.workspaceNav.expand") : t("nav.sidebar.showLess")}
                                                            </button>
                                                        )}
                                                        <Tooltip title={t("canvasA.artCritique.copyPrompt")}>
                                                            <button type="button" className="image-workspace-prompt-btn" onClick={() => copyText(prompt, t("create.workspace.promptCopied"))} aria-label={t("canvasA.artCritique.copyPrompt")}>
                                                                <Copy className="size-3" />
                                                            </button>
                                                        </Tooltip>
                                                    </div>
                                                </div>

                                                <div className="image-workspace-meta-row">
                                                    <div className="image-workspace-chips">
                                                        {model && <span className="image-workspace-chip">{model}</span>}
                                                        <span className="image-workspace-chip">{ratio}</span>
                                                        <span className="image-workspace-chip">{resolution}</span>
                                                        <span className="image-workspace-chip">{t("create.workspace.countChip", { count })}</span>
                                                        {time && <span className="image-workspace-chip">{time}</span>}
                                                    </div>

                                                    <div>
                                                        {isPending && (
                                                            <span className="image-workspace-status-badge is-running">
                                                                <Loader2 className="size-3 animate-spin" />
                                                                {isInterrupted ? t("create.workspace.interruptedBadge") : assistant?.generationStatus === "queued" ? t("canvasPage.taskStatus.queued") : t("create.workspace.generating")}
                                                            </span>
                                                        )}
                                                        {isDone && (
                                                            <span className="image-workspace-status-badge is-succeeded">
                                                                <Check className="size-3" />
                                                                {t("create.workspace.succeeded")}
                                                            </span>
                                                        )}
                                                        {isError && (
                                                            <span className="image-workspace-status-badge is-failed">
                                                                <AlertTriangle className="size-3" />
                                                                {t("create.status.failed")}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 任务内容：生成中占位、已生成缩略图网格 */}
                                            <div className="image-workspace-task-body">
                                                {isPending && (
                                                    <div className={`image-workspace-grid grid-${Math.min(4, count)}`} style={{ "--tile-ratio": String(ratioValue) } as React.CSSProperties}>
                                                        {/* 已生成的图片立即展示 */}
                                                        {resultUrls.map((url, idx) => (
                                                            <div key={`${task.id}-done-${resultKeys[idx] || idx}`} className="image-workspace-tile" onClick={() => setPreviewUrl(url, taskStorageKeys[idx])}>
                                                                <img src={url} alt={t("create.workspace.resultAlt", { index: idx + 1 })} loading="lazy" decoding="async" />
                                                                <div className="image-workspace-tile-overlay">
                                                                    <div className="image-workspace-tile-top-actions">
                                                                        <Tooltip title={t("create.workspace.setReference")}>
                                                                            <button
                                                                                type="button"
                                                                                className="image-workspace-tile-btn"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    onSetReferenceImage(url);
                                                                                    toast.success(t("create.workspace.referenceSet"));
                                                                                }}
                                                                                aria-label={t("create.workspace.setReference")}
                                                                            >
                                                                                <Sparkles className="size-3.5" />
                                                                            </button>
                                                                        </Tooltip>
                                                                        <Tooltip title={t("create.workspace.downloadOriginal")}>
                                                                            <button
                                                                                type="button"
                                                                                className="image-workspace-tile-btn"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    void handleDownloadImage(url, idx, taskStorageKeys[idx]);
                                                                                }}
                                                                                aria-label={t("create.workspace.downloadOriginal")}
                                                                            >
                                                                                <Download className="size-3.5" />
                                                                            </button>
                                                                        </Tooltip>
                                                                        <Tooltip title={t("create.workspace.previewLarge")}>
                                                                            <button type="button" className="image-workspace-tile-btn" onClick={() => setPreviewUrl(url, taskStorageKeys[idx])} aria-label={t("create.workspace.previewLarge")}>
                                                                                <Maximize2 className="size-3.5" />
                                                                            </button>
                                                                        </Tooltip>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}

                                                        {/* 剩余进行中的占位卡片 */}
                                                        {Array.from({ length: remainingPlaceholders }).map((_, idx) => (
                                                            <div key={`placeholder-${idx}`} className="image-workspace-placeholder-tile">
                                                                <Loader2 className="size-6 text-primary animate-spin" />
                                                                <span className="image-workspace-placeholder-text">{isInterrupted ? t("create.workspace.interruptedDetail") : t("create.workspace.drawing")}</span>
                                                                <span className="image-workspace-placeholder-timer">{assistant?.generationProgress ? `${assistant.generationProgress}%` : t("create.workspace.eta")}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {isDone && (
                                                    <div className="flex flex-col gap-2">
                                                        <div className={`image-workspace-grid grid-${Math.min(4, resultCount || 1)}`} style={{ "--tile-ratio": String(ratioValue) } as React.CSSProperties}>
                                                            {resultUrls.map((url, idx) => (
                                                                <div key={`${task.id}-img-${resultKeys[idx] || idx}`} className="image-workspace-tile" onClick={() => setPreviewUrl(url, taskStorageKeys[idx])}>
                                                                    <img src={url} alt={t("create.workspace.resultAlt", { index: idx + 1 })} loading="lazy" decoding="async" />
                                                                    <div className="image-workspace-tile-overlay">
                                                                        <div className="image-workspace-tile-top-actions">
                                                                            <Tooltip title={t("create.workspace.setReference")}>
                                                                                <button
                                                                                    type="button"
                                                                                    className="image-workspace-tile-btn"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        onSetReferenceImage(url);
                                                                                        toast.success(t("create.workspace.referenceSet"));
                                                                                    }}
                                                                                    aria-label={t("create.workspace.setReference")}
                                                                                >
                                                                                    <Sparkles className="size-3.5" />
                                                                                </button>
                                                                            </Tooltip>
                                                                            <Tooltip title={t("create.workspace.downloadOriginal")}>
                                                                                <button
                                                                                    type="button"
                                                                                    className="image-workspace-tile-btn"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        void handleDownloadImage(url, idx, taskStorageKeys[idx]);
                                                                                    }}
                                                                                    aria-label={t("create.workspace.downloadOriginal")}
                                                                                >
                                                                                    <Download className="size-3.5" />
                                                                                </button>
                                                                            </Tooltip>
                                                                            <Tooltip title={t("create.workspace.previewLarge")}>
                                                                                <button type="button" className="image-workspace-tile-btn" onClick={() => setPreviewUrl(url, taskStorageKeys[idx])} aria-label={t("create.workspace.previewLarge")}>
                                                                                    <Maximize2 className="size-3.5" />
                                                                                </button>
                                                                            </Tooltip>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {/* 部分生成成功时的轻量提示 */}
                                                        {assistant?.taskIds && assistant.taskIds.length > resultCount && (
                                                            <div className="text-xs text-amber-400/80 flex items-center gap-1.5 pt-1">
                                                                <AlertTriangle className="size-3" />
                                                                <span>{t("create.workspace.partialDone", { done: resultCount, total: assistant.taskIds.length })}</span>
                                                            </div>
                                                        )}
                                                        {/* 作品已生成但保存未完成：重新保存不重新生成、不重复扣费。 */}
                                                        {assistant?.mediaRecoverable && (
                                                            <div className="text-xs text-amber-400/80 flex items-center gap-1.5 pt-1">
                                                                <AlertTriangle className="size-3" />
                                                                <span>{t("create.workspace.saveIncomplete")}</span>
                                                                <button type="button" className="image-workspace-prompt-btn" onClick={() => assistant && onRecoverMedia(assistant)}>
                                                                    {t("create.workspace.resave")}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {isError && (
                                                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 flex items-start gap-3 text-red-400">
                                                        <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                                                        <div className="flex-1 text-xs leading-relaxed">
                                                            <div className="font-medium mb-1">{assistant?.error || t("create.workspace.genericError")}</div>
                                                            <div className="text-red-400/70">{assistant?.errorKind === "task" ? t("create.workspace.confirmedFailedHint") : t("create.workspace.unconfirmedFailedHint")}</div>
                                                        </div>
                                                        {assistant?.errorKind === "task" ? (
                                                            <button type="button" className="image-workspace-footer-btn is-primary shrink-0" onClick={() => onRegenerate(user)}>
                                                                <RotateCcw className="size-3.5" />
                                                                <span>{t("create.workspace.regenerate")}</span>
                                                            </button>
                                                        ) : (
                                                            // 后端未确认失败：先重新获取原任务结果，避免重复扣费。
                                                            <button type="button" className="image-workspace-footer-btn is-primary shrink-0" onClick={() => assistant && onRefetchResult(assistant)}>
                                                                <RefreshCw className="size-3.5" />
                                                                <span>{t("create.workspace.refetch")}</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* 任务底部操作栏 */}
                                            <div className="image-workspace-task-footer">
                                                <div className="image-workspace-footer-actions">
                                                    <button type="button" className="image-workspace-footer-btn" onClick={() => onReuseParams(user)}>
                                                        <RefreshCw className="size-3" />
                                                        <span>{t("create.workspace.reuseParams")}</span>
                                                    </button>
                                                    <button type="button" className="image-workspace-footer-btn is-primary" onClick={() => onRegenerate(user)}>
                                                        <RotateCcw className="size-3" />
                                                        <span>{t("create.workspace.generateAgain")}</span>
                                                    </button>
                                                    {isDone && (
                                                        <>
                                                            <button type="button" className="image-workspace-footer-btn" onClick={() => void handleSendToCanvas(assistant)}>
                                                                <LayoutGrid className="size-3" />
                                                                <span>{t("create.workspace.toCanvas")}</span>
                                                            </button>
                                                            {allSaved ? (
                                                                <span className="image-workspace-footer-btn" aria-live="polite">
                                                                    <Check className="size-3" />
                                                                    <span>{t("create.workspace.savedToAssets")}</span>
                                                                </span>
                                                            ) : (
                                                                <button type="button" className="image-workspace-footer-btn" onClick={() => assistant && onRecoverMedia(assistant)}>
                                                                    <RefreshCw className="size-3" />
                                                                    <span>{t("create.workspace.resave")}</span>
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* 图片大图预览弹窗 */}
            {previewUrl && (
                <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label={t("create.workspace.previewLarge")} onClick={() => setPreviewUrl(null)}>
                    <div className="relative max-w-5xl max-h-full flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="absolute -top-10 right-0 text-white/80 hover:text-white p-1" onClick={() => setPreviewUrl(null)} aria-label={t("create.workspace.closePreview")}>
                            <X className="size-6" />
                        </button>
                        <img src={previewUrl} alt={t("create.workspace.previewLarge")} className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl border border-white/10" />
                        <div className="mt-4 flex items-center gap-3">
                            <button
                                type="button"
                                className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs flex items-center gap-2 border border-white/15"
                                onClick={() => void handleDownloadImage(previewUrl, 0, previewStorageKey)}
                            >
                                <Download className="size-3.5" />
                                <span>{t("create.workspace.downloadHd")}</span>
                            </button>
                            <button
                                type="button"
                                className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs flex items-center gap-2"
                                onClick={() => {
                                    onSetReferenceImage(previewUrl);
                                    toast.success(t("create.workspace.referenceSet"));
                                    setPreviewUrl(null);
                                }}
                            >
                                <Sparkles className="size-3.5" />
                                <span>{t("create.workspace.setReference")}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}

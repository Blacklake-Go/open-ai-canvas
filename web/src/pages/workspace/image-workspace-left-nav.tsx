import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { Check, Home, Image as ImageIcon, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { App } from "antd";

import { BrandLogo } from "@/components/brand/brand-logo";
import { Tooltip } from "@/components/ui/base/tooltip";
import { workspacePath } from "@/lib/workspace-routes";
import { useAppearanceStore } from "@/stores/use-appearance-store";
import { useI18n } from "@/supdance/plugins/i18n";
import { translate } from "@/i18n";
import type { CreationConversation } from "@/pages/create/creation-types";

function formatRelativeTime(dateStr: string): string {
    const time = new Date(dateStr).getTime();
    if (isNaN(time)) return "";
    const diff = Date.now() - time;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return translate("create.page.workspaceNav.justNow");
    if (minutes < 60) return translate("create.page.workspaceNav.minutesAgo", { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return translate("create.page.workspaceNav.hoursAgo", { count: hours });
    const days = Math.floor(hours / 24);
    if (days < 7) return translate("create.page.workspaceNav.daysAgo", { count: days });
    const d = new Date(time);
    return translate("create.page.workspaceNav.dateLabel", { month: d.getMonth() + 1, day: d.getDate() });
}

export function ImageWorkspaceLeftNav({
    conversations,
    activeSessionId,
    collapsed,
    mobileOpen = false,
    onCloseMobile,
    onToggleCollapse,
    onSelectSession,
    onNewSession,
    onRenameSession,
    onDeleteSession,
}: {
    conversations: CreationConversation[];
    activeSessionId: string;
    collapsed: boolean;
    mobileOpen?: boolean;
    onCloseMobile?: () => void;
    onToggleCollapse: () => void;
    onSelectSession: (id: string) => void;
    onNewSession: () => void;
    onRenameSession: (id: string, newTitle: string) => void;
    onDeleteSession: (id: string) => void;
}) {
    const { t } = useI18n();
    const navigate = useNavigate();
    const brandName = useAppearanceStore((state) => state.appearance.brandName || "ONE");
    const [searchQuery, setSearchQuery] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState("");
    const { modal } = App.useApp();

    const imageConversations = useMemo(() => {
        return conversations.filter((c) => c.id === activeSessionId || !c.messages.length || c.messages.some((m) => m.mode === "image" || m.settings?.mode === "image"));
    }, [conversations, activeSessionId]);

    const filteredConversations = useMemo(() => {
        if (!searchQuery.trim()) return imageConversations;
        const q = searchQuery.toLowerCase().trim();
        return imageConversations.filter((c) => {
            if (c.title?.toLowerCase().includes(q)) return true;
            return c.messages?.some((m) => m.content?.toLowerCase().includes(q));
        });
    }, [imageConversations, searchQuery]);

    const startRename = (c: CreationConversation, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setEditingId(c.id);
        setEditingTitle(c.title || t("create.page.workspaceNav.untitled"));
    };

    const confirmRename = (id: string, e?: React.SyntheticEvent) => {
        e?.stopPropagation();
        e?.preventDefault();
        if (editingTitle.trim()) {
            onRenameSession(id, editingTitle.trim());
        }
        setEditingId(null);
    };

    const confirmDelete = (c: CreationConversation, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        modal.confirm({
            title: t("create.page.workspaceNav.deleteTitle"),
            content: t("create.page.workspaceNav.deleteContent", { title: c.title || t("create.page.workspaceNav.untitled") }),
            okText: t("create.page.workspaceNav.deleteOk"),
            okType: "danger",
            cancelText: t("create.page.workspaceNav.deleteCancel"),
            onOk: () => onDeleteSession(c.id),
        });
    };

    const handleSessionClick = (id: string) => {
        onSelectSession(id);
        onCloseMobile?.();
    };

    const handleNewSessionClick = () => {
        onNewSession();
        onCloseMobile?.();
    };

    return (
        <>
            {/* 移动端遮罩层 */}
            {mobileOpen && <div className="image-workspace-mobile-backdrop" onClick={onCloseMobile} aria-hidden="true" />}

            <aside className={`image-workspace-sidebar ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "is-mobile-open" : ""}`} aria-label={t("create.page.workspaceNav.ariaLabel")}>
                {/* 顶栏：Logo + 返回首页 + 移动端关闭按钮 */}
                <div className="image-workspace-sidebar-header">
                    {!collapsed ? (
                        <Link to={workspacePath("/")} className="image-workspace-brand" title={t("create.page.workspaceNav.backHome")}>
                            <div className="image-workspace-brand-logo">
                                <BrandLogo theme="dark" className="size-6" alt="" fallback={<span className="size-6 rounded bg-primary" />} />
                            </div>
                            <span className="image-workspace-brand-text">{brandName} AI</span>
                        </Link>
                    ) : (
                        <div className="image-workspace-brand-logo mx-auto">
                            <BrandLogo theme="dark" className="size-6" alt="" fallback={<span className="size-6 rounded bg-primary" />} />
                        </div>
                    )}

                    <div className="flex items-center gap-1">
                        {!collapsed && (
                            <Tooltip title={t("create.page.workspaceNav.backHome")}>
                                <button type="button" className="image-workspace-home-btn" onClick={() => navigate(workspacePath("/"))} aria-label={t("create.page.workspaceNav.backHome")}>
                                    <Home className="size-4" />
                                </button>
                            </Tooltip>
                        )}
                        {mobileOpen && (
                            <button type="button" className="image-workspace-mobile-close-btn" onClick={onCloseMobile} aria-label={t("create.page.workspaceNav.closeNav")}>
                                <X className="size-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* 新建创作按钮 */}
                <div className="image-workspace-new-action">
                    <Tooltip title={collapsed ? t("create.page.workspaceNav.newSession") : undefined}>
                        <button type="button" className="image-workspace-new-btn" onClick={handleNewSessionClick} aria-label={t("create.page.workspaceNav.newSession")}>
                            <Plus className="size-4" />
                            <span>{t("create.page.workspaceNav.newSession")}</span>
                        </button>
                    </Tooltip>
                </div>

                {/* 历史搜索框 */}
                {!collapsed && (
                    <div className="image-workspace-search-wrap">
                        <div className="relative flex items-center">
                            <Search className="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none" />
                            <input type="text" className="image-workspace-search-input" placeholder={t("create.page.workspaceNav.searchPlaceholder")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                            {searchQuery && (
                                <button type="button" className="absolute right-2 text-muted-foreground hover:text-foreground p-0.5" onClick={() => setSearchQuery("")}>
                                    <X className="size-3" />
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* 历史会话列表 */}
                <div className="image-workspace-sidebar-scroll">
                    <ul className="image-workspace-session-list">
                        {filteredConversations.map((item) => {
                            const isActive = item.id === activeSessionId;
                            const isEditing = editingId === item.id;
                            const title = item.title || t("create.page.workspaceNav.untitled");
                            const relTime = formatRelativeTime(item.updatedAt);

                            if (collapsed) {
                                return (
                                    <li key={item.id}>
                                        <Tooltip title={`${title}${relTime ? ` · ${relTime}` : ""}`}>
                                            <button type="button" className={`image-workspace-session-item w-full justify-center ${isActive ? "is-active" : ""}`} onClick={() => handleSessionClick(item.id)} aria-label={title}>
                                                <div className="image-workspace-session-icon">
                                                    <ImageIcon className="size-3.5" />
                                                </div>
                                            </button>
                                        </Tooltip>
                                    </li>
                                );
                            }

                            return (
                                <li key={item.id}>
                                    <div
                                        className={`image-workspace-session-item ${isActive ? "is-active" : ""}`}
                                        onClick={() => handleSessionClick(item.id)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault();
                                                handleSessionClick(item.id);
                                            }
                                        }}
                                    >
                                        <div className="image-workspace-session-icon">
                                            <ImageIcon className="size-3.5" />
                                        </div>

                                        <div className="image-workspace-session-info">
                                            {isEditing ? (
                                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="text"
                                                        className="text-xs bg-black/60 border border-primary rounded px-1.5 py-0.5 text-foreground outline-none w-full"
                                                        value={editingTitle}
                                                        autoFocus
                                                        onChange={(e) => setEditingTitle(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") {
                                                                if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                                                                confirmRename(item.id, e);
                                                            } else if (e.key === "Escape") setEditingId(null);
                                                        }}
                                                    />
                                                    <button type="button" className="text-primary hover:text-primary-foreground p-0.5" onClick={(e) => confirmRename(item.id, e)}>
                                                        <Check className="size-3" />
                                                    </button>
                                                    <button type="button" className="text-muted-foreground hover:text-foreground p-0.5" onClick={() => setEditingId(null)}>
                                                        <X className="size-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <span className="image-workspace-session-title" title={title}>
                                                        {title}
                                                    </span>
                                                    {relTime && <span className="image-workspace-session-time">{relTime}</span>}
                                                </>
                                            )}
                                        </div>

                                        {!isEditing && (
                                            <div className="image-workspace-session-actions">
                                                <Tooltip title={t("create.page.workspaceNav.rename")}>
                                                    <button type="button" className="image-workspace-item-act-btn" onClick={(e) => startRename(item, e)} aria-label={t("create.page.workspaceNav.renameAria")}>
                                                        <Pencil className="size-3" />
                                                    </button>
                                                </Tooltip>
                                                <Tooltip title={t("create.page.workspaceNav.deleteAria")}>
                                                    <button type="button" className="image-workspace-item-act-btn is-danger" onClick={(e) => confirmDelete(item, e)} aria-label={t("create.page.workspaceNav.deleteAria")}>
                                                        <Trash2 className="size-3" />
                                                    </button>
                                                </Tooltip>
                                            </div>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                {/* 底部折叠切换按钮 */}
                <div className="image-workspace-sidebar-footer">
                    <button
                        type="button"
                        className="image-workspace-collapse-btn"
                        onClick={onToggleCollapse}
                        aria-label={collapsed ? t("create.page.workspaceNav.expandNav") : t("create.page.workspaceNav.collapseNav")}
                        title={collapsed ? t("create.page.workspaceNav.expandNav") : t("create.page.workspaceNav.collapseNav")}
                    >
                        <span>{collapsed ? t("create.page.workspaceNav.expand") : t("create.page.workspaceNav.collapse")}</span>
                    </button>
                </div>
            </aside>
        </>
    );
}

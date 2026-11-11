import { creationSource as _creationSource, creationLabel as _creationLabel } from "@/supdance/plugins/i18n/creation-text";
import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { App, Modal } from "antd";
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, FolderOpen, Images, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppModal } from "@/components/ui/product/app-modal";
import { deleteEcommerceProjects, listEcommerceProjectPage, projectDraft, projectPlan, type EcommerceProject } from "@/services/api/ecommerce";
import { parseBackendGenerationResult } from "@/services/api/generation-task";
import { resourceStorageKey, resolveResourceVariantUrl } from "@/services/api/resources";
import type { GenerationTask } from "@/services/api/task-center";

const statusLabels: Record<string, string> = {
    draft: "草稿",
    planning: "策划中",
    awaiting_confirmation: "待确认",
    running: "生成中",
    queued: "排队中",
    partial_success: "部分完成",
    completed: "已完成",
    failed: "生成失败",
    cancelled: "已取消",
};

export function ecommerceHistoryCovers(project: EcommerceProject, tasks: Record<string, GenerationTask>): string[] {
    // Archived rounds are not embedded in the project row; the server sends a
    // bounded set of their task IDs so covers still work without reading history.
    const taskIds = [...new Set([...(project.coverTaskIds || []), ...(projectPlan(project)?.images || []).map((image) => image.taskId).filter((id): id is string => Boolean(id))])];
    const generated = taskIds.flatMap((taskId) => {
        const task = tasks[taskId];
        if (task?.status !== "succeeded") return [];
        let output;
        try {
            output = parseBackendGenerationResult(task).images?.[0];
        } catch {
            /* A completed task may expose only its persisted preview. */
        }
        const src = output?.storageKey ? resolveResourceVariantUrl(output.storageKey, "thumbnail") : task.previewKind !== "video" ? task.previewUrl || output?.dataUrl : undefined;
        return src ? [src] : [];
    });
    const references = projectDraft(project).references;
    const product = Array.isArray(references) ? references.find((reference) => reference.role === "primary" && reference.resourceId) : undefined;
    return [...new Set([...generated, ...(product ? [resolveResourceVariantUrl(resourceStorageKey(product.resourceId), "thumbnail")] : [])])];
}

function ProjectCard({
    project,
    tasks,
    active,
    index,
    selecting,
    selected,
    disabled,
    onOpen,
    onSelect,
    onDelete,
}: {
    project: EcommerceProject;
    tasks: Record<string, GenerationTask>;
    active: boolean;
    index: number;
    selecting: boolean;
    selected: boolean;
    disabled: boolean;
    onOpen: (project: EcommerceProject) => void;
    onSelect: (id: string) => void;
    onDelete: (project: EcommerceProject) => void;
}) {
    _useCreationLocale();
    const [failed, setFailed] = useState<string[]>([]);
    const candidates = useMemo(() => ecommerceHistoryCovers(project, tasks), [project, tasks]);
    const cover = candidates.find((candidate) => !failed.includes(candidate));
    const title = project.name?.trim() || projectDraft(project).productName?.trim() || "未命名商品";
    const date = new Date(project.updatedAt);
    const updated = Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
    return (
        <div className={`ecommerce-project-tile${selecting ? " is-selecting" : ""}`}>
            <button
                type="button"
                className="ecommerce-project-card"
                style={{ animationDelay: `${Math.min(index, 11) * 32}ms` }}
                aria-current={active ? "true" : undefined}
                aria-pressed={selecting ? selected : undefined}
                aria-label={
                    selecting
                        ? _creationText("creation.8f669b98dfe6dc04", { value1: selected ? _creationText("creation.74966e20df2ea9fd") : _creationText("creation.c11330b85234f9c0"), value2: title })
                        : _creationText("creation.3ef75d6edeed0eb6", { value1: title })
                }
                disabled={disabled}
                onClick={() => (selecting ? onSelect(project.id) : onOpen(project))}
            >
                <span className="ecommerce-project-cover">
                    {cover ? (
                        <img src={cover} alt={_creationText("creation.546e2626ba33ea25", { value1: title })} loading="lazy" decoding="async" onError={() => setFailed((values) => [...values, cover])} />
                    ) : (
                        <span className="ecommerce-project-cover-empty">
                            <Images size={27} strokeWidth={1.5} />
                            <span>{candidates.length ? _creationText("creation.cf9029feede1d9bf") : _creationText("creation.74c1cf5d718a2782")}</span>
                        </span>
                    )}
                </span>
                <span className="ecommerce-project-card-body">
                    <span className="ecommerce-project-title" title={title} data-i18n-user-content>
                        {title}
                    </span>
                    <span className="ecommerce-project-meta">
                        <span className={`ecommerce-project-status ecommerce-project-status-${project.status}`}>{statusLabels[project.status] || _creationText("settings.saved_badge")}</span>
                        {updated ? (
                            <time dateTime={project.updatedAt} title={date.toLocaleString("zh-CN")}>
                                {updated}
                            </time>
                        ) : null}
                    </span>
                </span>
                {selecting ? (
                    <span className="ecommerce-project-check" aria-hidden="true">
                        {selected ? <Check size={15} strokeWidth={2.6} /> : null}
                    </span>
                ) : (
                    <ArrowUpRight className="ecommerce-project-open-icon" size={17} aria-hidden="true" />
                )}
            </button>
            {!selecting ? (
                <button type="button" className="ecommerce-project-delete" aria-label={_creationText("creation.59467c43d9553e96", { value1: title })} title={_creationText("creation.f6dc6a110d09321f")} disabled={disabled} onClick={() => onDelete(project)}>
                    <Trash2 size={15} strokeWidth={1.8} />
                </button>
            ) : null}
        </div>
    );
}

type DeleteTarget = { kind: "one" | "selected" | "all"; ids: string[]; count: number; name?: string };

export function EcommerceProjectHistory({
    open,
    tasks,
    activeProjectId,
    deletionDisabled = false,
    onClose,
    onOpen,
    onDeleted,
}: {
    open: boolean;
    tasks: Record<string, GenerationTask>;
    activeProjectId?: string;
    deletionDisabled?: boolean;
    onClose: () => void;
    onOpen: (project: EcommerceProject) => void;
    onDeleted: (ids: string[], all: boolean) => void;
}) {
    const { message } = App.useApp();
    _useCreationLocale();
    const [projects, setProjects] = useState<EcommerceProject[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState<20 | 50 | 100>(20);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [retry, setRetry] = useState(0);
    const [selecting, setSelecting] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(() => new Set());
    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
    const [deleting, setDeleting] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const pageCount = Math.max(1, Math.ceil(total / pageSize));

    useEffect(() => {
        if (!open) {
            setSelecting(false);
            setSelected(new Set());
            setDeleteTarget(null);
        }
    }, [open]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        setError("");
        void listEcommerceProjectPage(page, pageSize)
            .then((result) => {
                if (cancelled) return;
                setProjects(result.projects || []);
                setTotal(result.total || 0);
                if (scrollRef.current) scrollRef.current.scrollTop = 0;
                if (result.total > 0 && page > Math.ceil(result.total / pageSize)) setPage(Math.ceil(result.total / pageSize));
            })
            .catch((cause) => {
                if (!cancelled) setError(cause instanceof Error ? cause.message : _creationSource("creation.f304ae050447c64c"));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [open, page, pageSize, retry]);

    const first = total ? (page - 1) * pageSize + 1 : 0;
    const last = Math.min(page * pageSize, total);
    const pages = Array.from({ length: Math.min(5, pageCount) }, (_, index) => Math.max(1, Math.min(page - 2, pageCount - 4)) + index);
    const pageSelected = projects.length > 0 && projects.every((project) => selected.has(project.id));
    const toggleSelected = (id: string) =>
        setSelected((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    const togglePage = () =>
        setSelected((current) => {
            const next = new Set(current);
            for (const project of projects) {
                if (pageSelected) next.delete(project.id);
                else next.add(project.id);
            }
            return next;
        });
    const confirmDelete = async () => {
        if (!deleteTarget || deleting) return;
        setDeleting(true);
        try {
            const all = deleteTarget.kind === "all";
            const result = await deleteEcommerceProjects({ ...(all ? { all: true } : { ids: deleteTarget.ids }), expectedTotal: deleteTarget.count });
            onDeleted(deleteTarget.ids, all);
            setDeleteTarget(null);
            setSelected(new Set());
            setSelecting(false);
            setRetry((value) => value + 1);
            message.success(_creationText("creation.37409ecfd730cf30", { value1: result.deleted }));
        } catch (cause) {
            setDeleteTarget(null);
            setRetry((value) => value + 1);
            message.error(cause instanceof Error ? cause.message : _creationText("creation.b576310441a5f527"));
        } finally {
            setDeleting(false);
        }
    };
    return (
        <AppModal
            flush
            open={open}
            onCancel={() => {
                if (!deleting) onClose();
            }}
            footer={null}
            title={null}
            closable={false}
            centered
            width="min(1120px, calc(100vw - 32px))"
            rootClassName="ecommerce-history-root"
            className="ecommerce-history-modal"
            transitionName="ecommerce-history-motion"
            maskTransitionName="ecommerce-history-mask"
            aria-label={_creationText("creation.96f17ac431a84c02")}
        >
            <section className="ecommerce-history" aria-label={_creationText("creation.a74bc790efe9453d")}>
                <header className="ecommerce-history-heading">
                    <div className="ecommerce-history-emblem">
                        <FolderOpen size={23} strokeWidth={1.55} />
                    </div>
                    <div className="ecommerce-history-heading-copy">
                        <span>COMMERCE / PROJECT LIBRARY</span>
                        <h2>{_creationText("creation.a74bc790efe9453d")}</h2>
                        <p>{_creationText("creation.039a654ed00df082")}</p>
                    </div>
                    <button type="button" className="ecommerce-history-close" aria-label={_creationText("creation.211de1220a6c41bb")} disabled={deleting} onClick={onClose}>
                        <X size={19} />
                    </button>
                </header>
                <div className="ecommerce-history-controls">
                    <div className="ecommerce-history-actions">
                        <span className="ecommerce-history-count">
                            <strong>{total}</strong>
                            {_creationText("creation.5e7e88508a0922e2")}
                        </span>
                        {total > 0 ? (
                            <button
                                type="button"
                                className={`ecommerce-history-action${selecting ? " is-active" : ""}`}
                                disabled={loading || deleting || deletionDisabled}
                                onClick={() => {
                                    setSelecting((value) => !value);
                                    setSelected(new Set());
                                }}
                            >
                                {selecting ? _creationText("creation.08b5788a41a8e796") : _creationText("creation.04e9e1b949acaae3")}
                            </button>
                        ) : null}
                        {selecting ? (
                            <>
                                <span className="ecommerce-history-selected">{_creationText("creation.bb370c51551f57bd", { value1: selected.size })}</span>
                                <button type="button" className="ecommerce-history-action" disabled={loading || deleting || !projects.length} onClick={togglePage}>
                                    {pageSelected ? _creationText("creation.4379693cbf2f2c06") : _creationText("creation.4cabaad3579bdbdd")}
                                </button>
                                <button type="button" className="ecommerce-history-action ecommerce-history-danger" disabled={deleting || !selected.size} onClick={() => setDeleteTarget({ kind: "selected", ids: [...selected], count: selected.size })}>
                                    {_creationText("creation.435bf8a234fde6f2")}
                                </button>
                            </>
                        ) : null}
                    </div>
                    <div className="ecommerce-history-actions">
                        <label className="ecommerce-history-page-size">
                            {_creationText("creation.3be014d778139529")}{" "}
                            <select
                                aria-label={_creationText("creation.26f341c1a30993da")}
                                value={pageSize}
                                disabled={loading || deleting}
                                onChange={(event) => {
                                    setPageSize(Number(event.target.value) as 20 | 50 | 100);
                                    setPage(1);
                                }}
                            >
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>{" "}
                            {_creationText("creation.3a116815bc9da10d")}
                        </label>
                        {total > 0 ? (
                            <button type="button" className="ecommerce-history-action ecommerce-history-danger" disabled={loading || deleting || deletionDisabled} onClick={() => setDeleteTarget({ kind: "all", ids: [], count: total })}>
                                {_creationText("creation.c1d9d09298bb9499")}
                            </button>
                        ) : null}
                    </div>
                </div>
                <div ref={scrollRef} className="ecommerce-history-scroll" data-canvas-wheel-scroll>
                    {loading ? (
                        <div className="ecommerce-history-message" role="status">
                            <span className="ecommerce-history-loader" />
                            {_creationText("creation.510ee21c7a5a32e3")}
                        </div>
                    ) : error ? (
                        <div className="ecommerce-history-message" role="alert">
                            <strong>{_creationText("creation.b6dad97986bc0517")}</strong>
                            <span>{_creationLabel(error)}</span>
                            <button type="button" onClick={() => setRetry((value) => value + 1)}>
                                {_creationText("common.reload")}
                            </button>
                        </div>
                    ) : projects.length ? (
                        <div className="ecommerce-history-list">
                            {projects.map((project, index) => (
                                <ProjectCard
                                    key={project.id}
                                    project={project}
                                    tasks={tasks}
                                    active={project.id === activeProjectId}
                                    index={index}
                                    selecting={selecting}
                                    selected={selected.has(project.id)}
                                    disabled={deleting || deletionDisabled}
                                    onOpen={onOpen}
                                    onSelect={toggleSelected}
                                    onDelete={(item) => setDeleteTarget({ kind: "one", ids: [item.id], count: 1, name: item.name?.trim() || "未命名商品" })}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="ecommerce-history-message">
                            <FolderOpen size={32} strokeWidth={1.3} />
                            <strong>{_creationText("creation.385ddda451af9cf9")}</strong>
                            <span>{_creationText("creation.549e944dc0a5b20a")}</span>
                        </div>
                    )}
                </div>
                <footer className="ecommerce-history-footer">
                    <span>
                        {_creationText("creation.4e1449e7d5e50593")}
                        {first}–{last} / {total}
                        {selecting && selected.size ? _creationText("creation.2d42e874417d6c45", { value1: selected.size }) : ""}
                    </span>
                    <nav className="ecommerce-history-pagination" aria-label={_creationText("creation.66cc26ecc47b816e")}>
                        <button type="button" aria-label={_creationText("common.prev")} disabled={page <= 1 || loading || deleting} onClick={() => setPage((value) => value - 1)}>
                            <ChevronLeft size={17} />
                        </button>
                        {pages.map((number) => (
                            <button key={number} type="button" aria-label={_creationText("creation.bee11b0726bf134f", { value1: number })} aria-current={page === number ? "page" : undefined} disabled={loading || deleting} onClick={() => setPage(number)}>
                                {number}
                            </button>
                        ))}
                        <button type="button" aria-label={_creationText("common.next")} disabled={page >= pageCount || loading || deleting} onClick={() => setPage((value) => value + 1)}>
                            <ChevronRight size={17} />
                        </button>
                    </nav>
                </footer>
            </section>
            <Modal
                className="ecommerce-delete-confirm"
                open={Boolean(deleteTarget)}
                title={
                    deleteTarget?.kind === "all" ? _creationText("creation.1e1fa5236fda89b3") : deleteTarget?.kind === "one" ? _creationText("creation.70ee599f5e2114e4") : _creationText("creation.924698620e0d7176", { value1: deleteTarget?.count || 0 })
                }
                centered
                okText={deleting ? _creationText("creation.4fd4f40094d40891") : _creationText("common.confirm_delete")}
                okButtonProps={{ danger: true, loading: deleting }}
                cancelText={_creationText("common.cancel")}
                cancelButtonProps={{ disabled: deleting }}
                closable={!deleting}
                mask={{ closable: !deleting }}
                keyboard={!deleting}
                onOk={() => void confirmDelete()}
                onCancel={() => {
                    if (!deleting) setDeleteTarget(null);
                }}
            >
                <p>
                    {deleteTarget?.kind === "all"
                        ? _creationText("creation.640c6023a81968b0", { value1: deleteTarget.count })
                        : deleteTarget?.kind === "one"
                          ? _creationText("creation.7558d3860d42ed03", { value1: deleteTarget.name })
                          : _creationText("creation.9046f7067d426c0f", { value1: deleteTarget?.count || 0 })}
                </p>
                <p>{_creationText("creation.2b48ab3883f83e58")}</p>
            </Modal>
        </AppModal>
    );
}

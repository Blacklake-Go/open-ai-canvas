import { creationLabel as _creationLabel } from "@/supdance/plugins/i18n/creation-text";
import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { useDeferredValue, useEffect, useRef, useState, type DragEvent } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Dropdown, Input } from "antd";
import { BookOpenText, ClipboardPaste, Clapperboard, ExternalLink, FileUp, MoreHorizontal, Plus, Search, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router";

import { CollectionToolbar } from "@/components/layout/collection-toolbar";
import { PageHeader, PaginationBar, WorkspacePage } from "@/components/layout/workspace-page";
import { WorkspaceErrorState, WorkspaceLoadingState, WorkspaceNoResultsState } from "@/components/layout/workspace-state";
import { deleteDrama, listDramas, type DramaListItem, type DramaStatus } from "@/services/api/drama";

import { formatCredits, MediaThumb, STATUS_LABEL } from "./drama-shared";
import { progressFillStyle } from "@/lib/progress-fill";
import { RelativeTime } from "@/components/ui/product/relative-time";
import "./drama.css";

const PAGE_SIZES = [24, 48, 96];
const PIPELINE = ["解析章节", "建立角色、道具与场景", "分集改编与段提示词", "按剧情段生成视频", "合成成片"];
const STATUS_FILTERS: Array<{ value: DramaStatus | "all"; label: string }> = [
    { value: "all", label: "全部" },
    { value: "running", label: "制作中" },
    { value: "paused", label: "已暂停" },
    { value: "completed", label: "已完成" },
    { value: "draft", label: "未开始" },
];
const ACCEPT = ".txt,.md,.markdown,text/plain,text/markdown";

export default function DramaListPage() {
    _useCreationLocale();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { message, modal } = App.useApp();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
    const [keyword, setKeyword] = useState("");
    const [status, setStatus] = useState<DramaStatus | "all">("all");
    const [dragging, setDragging] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const search = useDeferredValue(keyword.trim());
    useEffect(() => setPage(1), [search, status, pageSize]);

    const query = useQuery({
        queryKey: ["dramas", { page, pageSize, search, status }],
        queryFn: ({ signal }) => listDramas({ page, pageSize, q: search || undefined, status: status === "all" ? undefined : status }, signal),
        placeholderData: keepPreviousData,
        refetchInterval: (state) => (state.state.data?.items.some((item) => item.status === "running") ? 8_000 : false),
    });
    const remove = useMutation({
        mutationFn: deleteDrama,
        onSuccess: () => {
            message.success(_creationText("creation.f53a0f76ecbc1914"));
            void queryClient.invalidateQueries({ queryKey: ["dramas"] });
        },
        onError: (error) => message.error(error instanceof Error ? error.message : _creationText("creation.c228558cf257fc49")),
    });
    const data = query.data;
    const counts = data?.statusCounts || {};
    const total = counts.all ?? 0;
    const filtered = Boolean(search || status !== "all");
    const openFile = (file: File) => navigate("/projects/new", { state: { file } });
    const confirmDelete = (item: DramaListItem) => {
        modal.confirm({
            title: `删除《${item.project.name}》？`,
            content: "小说原文、剧本、分镜与成片记录都会删除。此操作无法撤销。",
            okText: "删除",
            okButtonProps: { danger: true },
            cancelText: "取消",
            centered: true,
            onOk: () => remove.mutateAsync(item.project.id),
        });
    };
    // 整页都能拖入小说：列表页不再单独放一块上传区占位置。
    const dragProps = {
        onDragOver: (event: DragEvent) => {
            if (event.dataTransfer.types.includes("Files")) {
                event.preventDefault();
                setDragging(true);
            }
        },
        onDragLeave: (event: DragEvent) => {
            if (event.currentTarget === event.target) setDragging(false);
        },
        onDrop: (event: DragEvent) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) openFile(file);
        },
    };

    if (query.isLoading)
        return (
            <WorkspacePage className="studio-collection-page">
                <WorkspaceLoadingState label={_creationText("creation.a9ca39c897ae10ad")} />
            </WorkspacePage>
        );
    if (query.isError && !data)
        return (
            <WorkspacePage className="studio-collection-page">
                <WorkspaceErrorState description={_creationText("creation.94ff097a9a7b023c")} onRetry={() => void query.refetch()} />
            </WorkspacePage>
        );

    const actions = (
        <div className="collection-header-actions">
            <Button icon={<ClipboardPaste />} onClick={() => navigate("/projects/new?paste=1")}>
                {_creationText("creation.c6c4089137f068cc")}
            </Button>
            <Button type="primary" icon={<Plus />} onClick={() => fileRef.current?.click()}>
                {_creationText("creation.8c06a100ff4d9de0")}
            </Button>
        </div>
    );

    return (
        <WorkspacePage className="studio-collection-page drama-library">
            <div className="drama-root" {...dragProps}>
                <div className="studio-band">
                    <PageHeader
                        title={_creationText("nav.projects_short")}
                        description={_creationText("creation.1b044b68b48f5536")}
                        meta={<span className="app-projects-header-meta">{_creationText("creation.eb23cd1f0d909502", { value1: total })}</span>}
                        actions={total ? actions : undefined}
                    />
                    {total ? (
                        <CollectionToolbar
                            label={_creationText("creation.cfc4ad779472dabf")}
                            active={filtered}
                            onReset={() => {
                                setKeyword("");
                                setStatus("all");
                            }}
                        >
                            <Input prefix={<Search />} value={keyword} allowClear placeholder={_creationText("creation.b9e093dc2ea44eca")} aria-label={_creationText("creation.b9e093dc2ea44eca")} onChange={(event) => setKeyword(event.target.value)} />
                            <div className="drama-library-status" role="radiogroup" aria-label={_creationText("plugins.filter_by_status")}>
                                {STATUS_FILTERS.map((item) => {
                                    const count = item.value === "all" ? total : counts[item.value] || 0;
                                    if (item.value !== "all" && !count && status !== item.value) return null;
                                    return (
                                        <button key={item.value} type="button" role="radio" aria-checked={status === item.value} className={`drama-library-status-item is-${item.value}`} onClick={() => setStatus(item.value)}>
                                            {item.value !== "all" ? <span className="drama-dot" /> : null}
                                            {_creationLabel(item.label)}
                                            <b>{count}</b>
                                        </button>
                                    );
                                })}
                            </div>
                        </CollectionToolbar>
                    ) : null}
                </div>

                {!total ? (
                    <UploadHero onPick={() => fileRef.current?.click()} onPaste={() => navigate("/projects/new?paste=1")} />
                ) : data?.items.length ? (
                    <>
                        <div className={`drama-library-grid ${query.isPlaceholderData ? "is-stale" : ""}`}>
                            {data.items.map((item) => (
                                <DramaCard key={item.project.id} item={item} onDelete={() => confirmDelete(item)} />
                            ))}
                        </div>
                        <PaginationBar
                            current={page}
                            pageSize={pageSize}
                            total={data.total}
                            itemLabel="部"
                            pageSizeOptions={PAGE_SIZES}
                            onChange={(next, size) => {
                                setPage(next);
                                setPageSize(size);
                            }}
                        />
                    </>
                ) : (
                    <WorkspaceNoResultsState
                        icon="projects"
                        query={keyword}
                        description={_creationText("creation.a092b3a0d54b46a4")}
                        onClear={() => {
                            setKeyword("");
                            setStatus("all");
                        }}
                    />
                )}

                {dragging ? (
                    <div className="drama-library-drop" aria-hidden>
                        <div>
                            <FileUp className="size-8" />
                            <strong>{_creationText("creation.e585766440b75f36")}</strong>
                            <span>{_creationText("creation.3586a9f5b5ccf68a")}</span>
                        </div>
                    </div>
                ) : null}
                <input
                    ref={fileRef}
                    type="file"
                    accept={ACCEPT}
                    className="hidden"
                    onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) openFile(file);
                        event.target.value = "";
                    }}
                />
            </div>
        </WorkspacePage>
    );
}

/** 还没有作品时的上传引导；有作品后整页都可拖入，不再常驻占位。 */
function UploadHero({ onPick, onPaste }: { onPick: () => void; onPaste: () => void }) {
    _useCreationLocale();
    return (
        <div className="drama-drop drama-library-hero">
            <span className="drama-drop-icon">
                <BookOpenText className="size-7" />
            </span>
            <h2>{_creationText("creation.02e0d618c11a41e1")}</h2>
            <p>{_creationText("creation.2f194e17339bd211")}</p>
            <div className="flex flex-wrap justify-center gap-2">
                <Button type="primary" size="large" icon={<FileUp className="size-4" />} onClick={onPick}>
                    {_creationText("creation.0fe2c483ce41c5e6")}
                </Button>
                <Button size="large" icon={<ClipboardPaste className="size-4" />} onClick={onPaste}>
                    {_creationText("creation.c6c4089137f068cc")}
                </Button>
            </div>
            <div className="drama-drop-steps">
                {PIPELINE.map((step, index) => (
                    <span key={step}>
                        <b>{index + 1}</b>
                        {step}
                    </span>
                ))}
            </div>
        </div>
    );
}

function DramaCover({ item }: { item: DramaListItem }) {
    _useCreationLocale();
    const covers = (item.coverResourceIds?.length ? item.coverResourceIds : item.coverResourceId ? [item.coverResourceId] : []).slice(0, 4);
    if (!covers.length) {
        return (
            <div className="drama-library-cover is-empty">
                <span className="drama-library-glyph">{item.project.name.slice(0, 1)}</span>
                <Clapperboard className="drama-library-empty-icon" />
            </div>
        );
    }
    return (
        <div className={`drama-library-cover is-${covers.length}`}>
            {covers.map((id) => (
                <span key={id}>
                    <MediaThumb resourceId={id} alt="" />
                </span>
            ))}
        </div>
    );
}

function DramaCard({ item, onDelete }: { item: DramaListItem; onDelete: () => void }) {
    _useCreationLocale();
    const progress = item.episodeCount ? Math.round((item.doneCount / item.episodeCount) * 100) : 0;
    const needsAction = item.status === "paused" && Boolean(item.pauseReason);
    // 保存了创建页表单的草稿回到创建页继续编辑，其余进入制作台。
    const href = item.hasDraftForm ? `/projects/new?draft=${encodeURIComponent(item.project.id)}` : `/projects/${item.project.id}`;
    const stage = item.episodeCount ? `${item.doneCount}/${item.episodeCount} 集成片` : item.status === "running" ? "正在改编小说" : item.status === "draft" ? "尚未开始" : "等待分集";
    return (
        <article className={`drama-library-card is-${item.status}`}>
            <Link to={href} className="drama-library-open" aria-label={_creationText("creation.a1ad29f5fd5eaf28", { value1: item.project.name })}>
                <DramaCover item={item} />
                <span className={`drama-chip drama-library-badge is-${needsAction ? "paused" : item.status}`}>
                    <span className="drama-dot" />
                    {needsAction ? _creationText("creation.b7e3e715f18b9bac") : STATUS_LABEL[item.status]}
                </span>
                <div className="drama-library-body">
                    <h3 title={item.project.name}>{item.project.name}</h3>
                    <div className="drama-library-meta">
                        {item.styleName ? <span>{item.styleName}</span> : null}
                        <span>{item.aspectRatio}</span>
                        <RelativeTime value={item.updatedAt || item.project.updatedAt} />
                    </div>
                    <div className="drama-library-progress">
                        <span className="drama-library-progress-bar">
                            <span style={progressFillStyle(Math.max(progress, item.episodeCount && progress === 0 ? 2 : progress))} />
                        </span>
                        <span className="drama-library-progress-text">
                            <b>{stage}</b>
                            {item.spentMicrocredits ? <span>{_creationText("creation.d901f70479c8f61f", { value1: formatCredits(item.spentMicrocredits) })}</span> : null}
                        </span>
                    </div>
                    {needsAction ? (
                        <p className="drama-library-alert" title={item.pauseReason}>
                            {item.pauseReason}
                        </p>
                    ) : null}
                </div>
            </Link>
            <div className="drama-library-menu">
                <Dropdown
                    trigger={["click"]}
                    placement="bottomRight"
                    menu={{
                        items: [
                            { key: "open", icon: <ExternalLink className="size-3.5" />, label: <Link to={href}>{item.hasDraftForm ? _creationText("creation.9d0eedd99d2bdac6") : _creationText("creation.876671b61230bd76")}</Link> },
                            { type: "divider" },
                            { key: "delete", danger: true, icon: <Trash2 className="size-3.5" />, label: "删除作品", onClick: onDelete },
                        ],
                    }}
                >
                    <button type="button" className="product-icon-button" aria-label={_creationText("creation.f29acd414340e617", { value1: item.project.name })}>
                        <MoreHorizontal />
                    </button>
                </Dropdown>
            </div>
        </article>
    );
}

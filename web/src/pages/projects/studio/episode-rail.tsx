import { creationLabel as _creationLabel } from "@/supdance/plugins/i18n/creation-text";
import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AntTooltip as Tooltip } from "@/components/ui/base/tooltip/ant-tooltip";
import { BookOpenText, Grid3x3, List, Plus, Search, X } from "lucide-react";

import type { DramaEpisodeRow } from "@/services/api/drama";

import { episodeStatusText, episodeTone, StagePips, STAGE_LABEL } from "../drama-shared";

type Filter = "all" | "ready" | "attention" | "active" | "done";

const FILTERS: Array<{ key: Filter; label: string }> = [
    { key: "all", label: "全部" },
    { key: "ready", label: "待生成" },
    { key: "attention", label: "待处理" },
    { key: "active", label: "制作中" },
    { key: "done", label: "已完成" },
];

function matchesFilter(episode: DramaEpisodeRow, filter: Filter) {
    const tone = episodeTone(episode);
    if (filter === "ready") return tone === "ready";
    if (filter === "attention") return tone === "error" || tone === "review";
    if (filter === "active") return tone === "active";
    if (filter === "done") return tone === "done";
    return true;
}

export function EpisodeRail({
    episodes,
    currentId,
    planning,
    reservedChapters = 0,
    onSelect,
    onAdd,
    onPickChapters,
}: {
    episodes: DramaEpisodeRow[];
    currentId: string;
    planning: boolean;
    /** 导入时未加入制作的原著章节数；大于 0 时提供“继续选章”入口。 */
    reservedChapters?: number;
    onSelect: (id: string) => void;
    onAdd: () => void;
    onPickChapters?: () => void;
}) {
    _useCreationLocale();
    const nextNumber = (episodes[episodes.length - 1]?.number || 0) + 1;
    const [filter, setFilter] = useState<Filter>("all");
    const [query, setQuery] = useState("");
    const [matrix, setMatrix] = useState(() => localStorage.getItem("drama-rail-matrix") === "1");
    const deferredQuery = useDeferredValue(query.trim());
    const listRef = useRef<HTMLDivElement>(null);
    const counts = useMemo(() => Object.fromEntries(FILTERS.map((item) => [item.key, episodes.filter((episode) => matchesFilter(episode, item.key)).length])) as Record<Filter, number>, [episodes]);
    const visible = useMemo(
        () =>
            episodes.filter((episode) => {
                if (!matchesFilter(episode, filter)) return false;
                if (!deferredQuery) return true;
                return String(episode.number) === deferredQuery.replace(/^第|集$/g, "") || episode.title.includes(deferredQuery) || episode.synopsis.includes(deferredQuery);
            }),
        [deferredQuery, episodes, filter],
    );
    const virtualizer = useVirtualizer({ count: visible.length, getScrollElement: () => listRef.current, estimateSize: () => 62, overscan: 10 });

    useEffect(() => {
        localStorage.setItem("drama-rail-matrix", matrix ? "1" : "0");
    }, [matrix]);
    // 切换集时让当前集保持在可视范围内，长列表里不会“丢失”位置。
    useEffect(() => {
        if (matrix) return;
        const index = visible.findIndex((episode) => episode.id === currentId);
        if (index >= 0) virtualizer.scrollToIndex(index, { align: "auto" });
    }, [currentId, matrix, virtualizer, visible]);

    return (
        <aside className="drama-rail" aria-label={_creationText("creation.dea789c82d1d71bb")}>
            <div className="drama-rail-head">
                <div className="flex items-center gap-2">
                    <label className="drama-search flex-1">
                        <Search className="size-3.5 shrink-0 opacity-40" />
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" && visible[0]) onSelect(visible[0].id);
                            }}
                            placeholder={_creationText("creation.0ac28e1a289c8bd9")}
                            aria-label={_creationText("creation.339375e61da5a097")}
                        />
                        {query ? (
                            <button type="button" onClick={() => setQuery("")} aria-label={_creationText("canvas.clear_search")}>
                                <X className="size-3.5 opacity-40" />
                            </button>
                        ) : null}
                    </label>
                    <Tooltip title={_creationText("creation.e9a99e0649fe9bbc", { value1: nextNumber })}>
                        <button type="button" className="drama-title-edit !h-8 !w-8" aria-label={_creationText("creation.7fa645eba8ead61e", { value1: nextNumber })} onClick={onAdd}>
                            <Plus className="size-4" />
                        </button>
                    </Tooltip>
                    {onPickChapters ? (
                        <Tooltip title={reservedChapters > 0 ? _creationText("creation.3876fa1092ce2912", { value1: reservedChapters }) : _creationText("creation.5e938948885dece7")}>
                            <button type="button" className="drama-title-edit !h-8 !w-8" aria-label={_creationText("creation.5b050d133cce9443")} onClick={onPickChapters}>
                                <BookOpenText className="size-4" />
                            </button>
                        </Tooltip>
                    ) : null}
                    <Tooltip title={matrix ? _creationText("tasks.list_view") : _creationText("creation.fbf3ed4dde1ea8cc")}>
                        <button type="button" className="drama-title-edit !h-8 !w-8" aria-pressed={matrix} aria-label={_creationText("creation.d9846df13b29f683")} onClick={() => setMatrix((value) => !value)}>
                            {matrix ? <List className="size-4" /> : <Grid3x3 className="size-4" />}
                        </button>
                    </Tooltip>
                </div>
                <div className="drama-filters" role="group" aria-label={_creationText("creation.a692d07dfab0281f")}>
                    {FILTERS.filter((item) => item.key !== "ready" || counts.ready || filter === "ready").map((item) => (
                        <button key={item.key} type="button" className={`drama-filter ${item.key === "attention" && counts.attention ? "is-alert" : ""}`} aria-pressed={filter === item.key} onClick={() => setFilter(item.key)}>
                            {_creationLabel(item.label)}
                            <b>{counts[item.key]}</b>
                        </button>
                    ))}
                </div>
            </div>
            {matrix ? (
                <div className="drama-rail-list thin-scrollbar">
                    <div className="drama-matrix">
                        <div className="drama-matrix-legend">
                            <span>
                                <i style={{ background: "var(--status-success)" }} />
                                {_creationText("settings.channel_complete_btn")}
                            </span>
                            <span>
                                <i style={{ background: "var(--workspace-accent)" }} />
                                {_creationText("creation.3af7842f0a6561ef")}
                            </span>
                            <span>
                                <i className="is-ready" />
                                {_creationText("creation.49933a1953501c0a")}
                            </span>
                            <span>
                                <i style={{ background: "var(--status-warning)" }} />
                                {_creationText("creation.b92b1ce488db924d")}
                            </span>
                            <span>
                                <i style={{ background: "var(--status-error)" }} />
                                {_creationText("admin.failed_status")}
                            </span>
                        </div>
                        <div className="drama-matrix-grid">
                            {visible.map((episode) => (
                                <Tooltip key={episode.id} title={_creationText("creation.7699c6d40eeb56a4", { value1: episode.number, value2: episode.title, value3: episodeStatusText(episode) })} mouseEnterDelay={0.25}>
                                    <button
                                        type="button"
                                        className={`drama-cell is-${episodeTone(episode)}`}
                                        aria-current={episode.id === currentId}
                                        aria-label={_creationText("creation.14cd1c9a694b7d72", { value1: episode.number, value2: STAGE_LABEL[episode.stage] })}
                                        onClick={() => onSelect(episode.id)}
                                    >
                                        {episode.number}
                                    </button>
                                </Tooltip>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div ref={listRef} className="drama-rail-list thin-scrollbar">
                    {visible.length ? (
                        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
                            {virtualizer.getVirtualItems().map((item) => {
                                const episode = visible[item.index];
                                const tone = episodeTone(episode);
                                return (
                                    <div key={episode.id} className="absolute left-0 top-0 w-full pb-[2px]" style={{ height: item.size, transform: `translateY(${item.start}px)` }}>
                                        <button type="button" className={`drama-ep is-${tone}`} aria-current={episode.id === currentId} onClick={() => onSelect(episode.id)}>
                                            <span className="drama-ep-num">{String(episode.number).padStart(episodes.length >= 100 ? 3 : 2, "0")}</span>
                                            <span className="min-w-0">
                                                <span data-i18n-user-content className="drama-ep-title block" title={episode.title}>
                                                    {episode.title}
                                                </span>
                                                <span className="drama-ep-meta">
                                                    <span>{episodeStatusText(episode)}</span>
                                                    <StagePips episode={episode} />
                                                </span>
                                            </span>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="px-3 py-10 text-center text-[var(--fs-tiny)] text-foreground/40">{_creationText("creation.f7e6d42698ee15ce")}</div>
                    )}
                    {planning ? <div className="px-3 py-3 text-center text-[var(--fs-micro)] text-foreground/40">{_creationText("creation.558b5ee4d2af4616")}</div> : null}
                    {!planning && filter === "all" && !deferredQuery && reservedChapters > 0 && onPickChapters ? (
                        <button type="button" className="drama-rail-add is-accent" onClick={onPickChapters}>
                            <BookOpenText className="size-3.5" />
                            {_creationText("creation.3c850afd04016045")}
                            {reservedChapters}
                            {_creationText("creation.1fa359d2e60bdcb1")}
                        </button>
                    ) : null}
                    {!planning && filter === "all" && !deferredQuery ? (
                        <button type="button" className="drama-rail-add" onClick={onAdd}>
                            <Plus className="size-3.5" />
                            {_creationText("creation.e9ad46ccd1ad4a8f")}
                            {nextNumber}
                            {_creationText("creation.5bbadd8f8c4f781d")}
                        </button>
                    ) : null}
                </div>
            )}
        </aside>
    );
}

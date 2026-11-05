import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { memo, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from "react";
import { Button, Checkbox } from "antd";
import { AntTooltip as Tooltip } from "@/components/ui/base/tooltip/ant-tooltip";
import { AlertCircle, Film, Play, RotateCcw, TriangleAlert, X, PenLine } from "lucide-react";

import type { DramaCast, DramaModelChoice, DramaSegment, DramaShot } from "@/services/api/drama";

import { DramaModelPicker } from "../drama-model-picker";
import { aspectRatioValue, formatClock, mediaBusy, MediaThumb, useResourceMediaUrl } from "../drama-shared";
import { promptReady, secondsLabel, SegmentInputs, SegmentStatus, segmentState } from "./segment-parts";
import { isTypingTarget } from "./use-studio";
import { progressFillStyle } from "@/lib/progress-fill";

type Props = {
    shots: DramaShot[];
    segments: DramaSegment[];
    aspectRatio: string;
    castById: Map<string, DramaCast>;
    defaultVideoModel: DramaModelChoice;
    /** 作品指定的视频分辨率；批量换模型时给不出的置灰。 */
    videoResolution?: string;
    busy: boolean;
    /** 剧情段弹窗打开时暂停分镜页快捷键，避免和弹窗内的输入冲突。 */
    keyboardEnabled: boolean;
    /** 打开剧情段弹窗；shotId 有值时定位到该镜头。 */
    onOpen: (segmentIndex: number, shotId?: string) => void;
    onGenerate: (indexes: number[], model?: DramaModelChoice) => void;
    /** 重新处理已生成但后处理失败的段视频；reprocessing 是正在提交的段序号。 */
    onReprocess: (index: number) => void;
    reprocessing?: number;
    onWritePrompts: (indexes: number[]) => void;
    /** 本集还没有镜头时的说明：正在写、排队、已暂停或失败，由页面按真实状态给出。 */
    empty: EpisodeEmpty;
};

export type EpisodeEmpty = { title: string; text: string; active: boolean; action?: ReactNode };

const SHOT_PREVIEW = 3;

/** 可以提交视频的段：提示词已就绪且不在生成中。批量操作只提交这些段，其余跳过并说明。 */
function generatable(segment: DramaSegment) {
    return promptReady(segment) && !mediaBusy(segment.videoStatus);
}

/** 本段已有生成好的视频（含过期或后处理失败的），不论能否直接用于下一段。 */
function hasVideo(segment: DramaSegment) {
    return Boolean(segment.videoResourceId) && (segment.videoStatus === "ready" || segment.videoStatus === "stale" || segment.videoStatus === "failed");
}

/** 还没有尾帧缩略图时，用视频本身的开头画面作封面。 */
function CoverVideo({ resourceId }: { resourceId: string }) {
    _useCreationLocale();
    const url = useResourceMediaUrl(resourceId, "playback");
    if (!url) return <span className="drama-sg-cover-empty is-busy" aria-hidden />;
    return <video className="drama-sg-cover-media" src={`${url}#t=0.1`} muted playsInline preload="metadata" aria-hidden tabIndex={-1} />;
}

function writable(segment: DramaSegment) {
    return segment.promptStatus !== "queued" && segment.promptStatus !== "running";
}

const NO_SHOTS: DramaShot[] = [];

type CardActions = {
    anchor?: number;
    handleCardClick: (event: MouseEvent, index: number) => void;
    toggle: (index: number) => void;
    selectRange: (from: number, to: number, additive: boolean) => void;
    onOpen: (segmentIndex: number, shotId?: string) => void;
    onGenerate: (indexes: number[], model?: DramaModelChoice) => void;
    onReprocess: (index: number) => void;
};

type CardProps = {
    segment: DramaSegment;
    segmentShots: DramaShot[];
    aspectRatio: string;
    castById: Map<string, DramaCast>;
    isSelected: boolean;
    focused: boolean;
    busy: boolean;
    reprocessing: boolean;
    defaultModelLabel?: string;
    actions: RefObject<CardActions>;
};

/**
 * 单个剧情段卡片。轮询刷新时 React Query 保留未变化段的对象引用，memo 让这些卡片跳过渲染，
 * 低配电脑上打开弹窗或轮询时不再整页重绘全部卡片。回调经 actions 引用读取，props 保持稳定。
 */
const SegmentCard = memo(function SegmentCard({ segment, segmentShots, aspectRatio, castById, isSelected, focused, busy, reprocessing, defaultModelLabel, actions }: CardProps) {
    _useCreationLocale();
    const state = segmentState(segment);
    const error = segment.promptStatus === "failed" ? segment.promptError : segment.videoStatus === "failed" ? segment.videoError : "";
    const act = () => actions.current;
    return (
        <article
            data-segment={segment.index}
            role="option"
            aria-selected={isSelected}
            aria-current={focused}
            aria-label={_creationText("creation.a2c6a9f39e5606a3", { value1: segment.index + 1, value2: segment.title, value3: state.label })}
            className={`drama-sg is-${state.tone} ${isSelected ? "is-selected" : ""} ${focused ? "is-focused" : ""}`}
            onClick={(event) => act().handleCardClick(event, segment.index)}
            onDoubleClick={(event) => {
                if (!(event.target as HTMLElement).closest("button, .ant-select")) act().onOpen(segment.index);
            }}
        >
            <header className="drama-sg-head">
                <Checkbox
                    checked={isSelected}
                    onChange={() => act().toggle(segment.index)}
                    onClick={(event) => {
                        const anchor = act().anchor;
                        if (event.shiftKey && anchor !== undefined) {
                            event.preventDefault();
                            act().selectRange(anchor, segment.index, true);
                        }
                    }}
                    aria-label={_creationText("creation.53d1e286cc37980c", { value1: segment.index + 1 })}
                />
                <span className="drama-seg-num">{segment.index + 1}</span>
                <button data-i18n-user-content type="button" className="drama-sg-title" title={segment.title} onClick={() => act().onOpen(segment.index)}>
                    {segment.title}
                </button>
                {error ? (
                    <Tooltip title={error}>
                        <AlertCircle className="size-3.5 flex-none text-[var(--drama-err)]" aria-label={_creationText("creation.bb8c4e5583b44624")} />
                    </Tooltip>
                ) : segment.request.warning ? (
                    <Tooltip title={segment.request.warning}>
                        <TriangleAlert className="size-3.5 flex-none text-[var(--drama-warn)]" aria-label={_creationText("admin.social_auth.icon_notice_title")} />
                    </Tooltip>
                ) : null}
            </header>
            <div className="drama-sg-body">
                <button type="button" className="drama-sg-cover" style={{ aspectRatio: aspectRatioValue(aspectRatio) }} onClick={() => act().onOpen(segment.index)} aria-label={_creationText("creation.3d7a40ae5b076fcb", { value1: segment.index + 1 })}>
                    {segment.tailFrameResourceId && segment.videoResourceId ? (
                        <MediaThumb resourceId={segment.tailFrameResourceId} alt="" />
                    ) : segment.videoResourceId && hasVideo(segment) ? (
                        <CoverVideo resourceId={segment.videoResourceId} />
                    ) : (
                        <span className={`drama-sg-cover-empty ${state.tone === "busy" ? "is-busy" : ""}`}>
                            <Film className="size-4" aria-hidden />
                        </span>
                    )}
                    <span className="drama-sg-cover-dur">{secondsLabel(segment.durationMs)}</span>
                    {segment.videoResourceId ? (
                        <span className="drama-sg-cover-play">
                            <Play className="size-3" aria-hidden />
                        </span>
                    ) : null}
                </button>
                <div className="drama-sg-main">
                    <div className="drama-sg-meta">
                        <SegmentStatus segment={segment} />
                        <span>
                            {segmentShots.length}
                            {_creationText("creation.601e41f3ade62c01")}
                            {segment.request.maxVideoSeconds ? _creationText("creation.06da6cc20a0ac3f0", { value1: segment.request.maxVideoSeconds }) : ""}
                        </span>
                    </div>
                    <SegmentInputs segment={segment} castById={castById} compact />
                    {segmentShots.length === 1 ? (
                        <button type="button" className="drama-sg-single" onClick={() => act().onOpen(segment.index, segmentShots[0].id)}>
                            <span className="drama-sg-single-action">{segmentShots[0].action || segmentShots[0].imagePrompt || _creationText("creation.dc8dde6388085f48")}</span>
                            {segmentShots[0].dialogue ? (
                                <span className="drama-sg-single-line">
                                    <em>{segmentShots[0].speaker || _creationText("projects.narration")}</em>
                                    {segmentShots[0].dialogue}
                                </span>
                            ) : null}
                        </button>
                    ) : (
                        <ol className="drama-sg-shots">
                            {segmentShots.slice(0, SHOT_PREVIEW).map((shot) => (
                                <li key={shot.id}>
                                    <button type="button" onClick={() => act().onOpen(segment.index, shot.id)} title={shot.dialogue ? `${shot.speaker || _creationText("projects.narration")}：${shot.dialogue}` : shot.action}>
                                        <b>{shot.position + 1}</b>
                                        <span data-i18n-user-content>
                                            {shot.dialogue ? (
                                                <>
                                                    <em>{shot.speaker || _creationText("projects.narration")}</em>
                                                    {shot.dialogue}
                                                </>
                                            ) : (
                                                shot.action || shot.imagePrompt || _creationText("creation.dc8dde6388085f48")
                                            )}
                                        </span>
                                    </button>
                                </li>
                            ))}
                            {segmentShots.length > SHOT_PREVIEW ? <li className="drama-sg-more">{_creationText("creation.eb751d2693f30ba2", { value1: segmentShots.length - SHOT_PREVIEW })}</li> : null}
                        </ol>
                    )}
                </div>
            </div>
            <footer className="drama-sg-foot">
                <span className="drama-sg-model" title={segment.videoModel?.label}>
                    {segment.videoModel?.label || defaultModelLabel || _creationText("settings.default_video_model")}
                </span>
                <span className="drama-sg-actions">
                    {segment.videoReprocessable ? (
                        <Button size="small" type="primary" icon={<RotateCcw className="size-3" />} disabled={busy} loading={reprocessing} title={_creationText("creation.8f516eb045eaa897")} onClick={() => act().onReprocess(segment.index)}>
                            {_creationText("creation.ec981a4aedf0bd3e")}
                        </Button>
                    ) : null}
                    <Button
                        size="small"
                        type={generatable(segment) && !hasVideo(segment) ? "primary" : "default"}
                        icon={<Play className="size-3" />}
                        disabled={busy || !generatable(segment)}
                        title={!promptReady(segment) ? _creationText("creation.7566985909053644") : hasVideo(segment) ? _creationText("creation.f53e52384d6f3547") : undefined}
                        onClick={() => act().onGenerate([segment.index])}
                    >
                        {mediaBusy(segment.videoStatus)
                            ? segment.videoStatus === "queued" && segment.videoWait
                                ? _creationText("creation.26c8cfcbf763073f")
                                : segment.request.firstFramePending
                                  ? _creationText("creation.5406b764674d3dad")
                                  : _creationText("settings.memory_proposal_generating")
                            : hasVideo(segment)
                              ? _creationText("workbench.regenerate")
                              : _creationText("creation.1ad1463fe16fc2a6")}
                    </Button>
                </span>
            </footer>
        </article>
    );
});

/**
 * 分镜页：剧情段卡片网格。一段一次调用视频模型，卡片只放判断所需的信息：状态、预览、生成依据缩略图和前几个镜头；
 * 完整内容在剧情段弹窗里。
 * 选择：单击聚焦，⌘/Ctrl 单击切换选择，Shift 单击连选；快捷键见底部提示。
 */
export function Storyboard({ shots, segments, aspectRatio, castById, defaultVideoModel, videoResolution, busy, keyboardEnabled, onOpen, onGenerate, onReprocess, reprocessing, onWritePrompts, empty }: Props) {
    _useCreationLocale();
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [focused, setFocused] = useState<number>();
    const [anchor, setAnchor] = useState<number>();
    const [batchModel, setBatchModel] = useState<DramaModelChoice>();
    const gridRef = useRef<HTMLDivElement>(null);
    const episodeId = shots[0]?.episodeId;
    useEffect(() => {
        setSelected(new Set());
        setFocused(undefined);
        setAnchor(undefined);
        setBatchModel(undefined);
    }, [episodeId]);
    const shotsBySegment = useMemo(() => {
        const map = new Map<number, DramaShot[]>();
        for (const shot of shots) map.set(shot.segmentIndex, [...(map.get(shot.segmentIndex) || []), shot]);
        return map;
    }, [shots]);
    const order = useMemo(() => segments.map((segment) => segment.index), [segments]);
    const totals = useMemo(
        () => ({
            durationMs: segments.reduce((sum, segment) => sum + segment.durationMs, 0),
            prompts: segments.filter(promptReady).length,
            videos: segments.filter((segment) => segment.videoStatus === "ready").length,
        }),
        [segments],
    );
    const chosen = segments.filter((segment) => selected.has(segment.index));
    const toGenerate = chosen.filter(generatable).map((segment) => segment.index);
    const toWrite = chosen.filter(writable).map((segment) => segment.index);

    const selectRange = (from: number, to: number, additive: boolean) => {
        const a = order.indexOf(from);
        const b = order.indexOf(to);
        const [start, end] = a < b ? [a, b] : [b, a];
        setSelected((current) => new Set([...(additive ? current : []), ...order.slice(start, end + 1)]));
    };
    const toggle = (index: number) => {
        setSelected((current) => {
            const next = new Set(current);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
        setAnchor(index);
        setFocused(index);
    };
    const handleCardClick = (event: MouseEvent, index: number) => {
        if ((event.target as HTMLElement).closest("button, a, input, .ant-select, .ant-checkbox-wrapper")) return;
        if (event.shiftKey && anchor !== undefined) {
            selectRange(anchor, index, event.metaKey || event.ctrlKey);
            setFocused(index);
            return;
        }
        if (event.metaKey || event.ctrlKey) {
            toggle(index);
            return;
        }
        setFocused(index);
        setAnchor(index);
    };
    // 卡片 memo 后通过引用读取最新回调与连选锚点，避免每次渲染传入新函数让 memo 失效。
    const actions = useRef<CardActions>({ anchor, handleCardClick, toggle, selectRange, onOpen, onGenerate, onReprocess });
    actions.current = { anchor, handleCardClick, toggle, selectRange, onOpen, onGenerate, onReprocess };

    // 分镜页快捷键：⌘/Ctrl+A 全选，Esc 清空，J/K 或方向键切换聚焦，Shift+方向键连选，X 或空格切换选择，Enter 打开。
    useEffect(() => {
        if (!keyboardEnabled) return;
        const columns = () => {
            const grid = gridRef.current;
            if (!grid) return 1;
            return Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length);
        };
        const onKey = (event: KeyboardEvent) => {
            if (isTypingTarget(event.target) || event.altKey || !order.length) return;
            const key = event.key.toLowerCase();
            if ((event.metaKey || event.ctrlKey) && key === "a") {
                event.preventDefault();
                setSelected(new Set(order));
                return;
            }
            if (event.metaKey || event.ctrlKey) return;
            const position = focused === undefined ? -1 : order.indexOf(focused);
            const move = (delta: number) => {
                event.preventDefault();
                const next = order[Math.min(order.length - 1, Math.max(0, position < 0 ? 0 : position + delta))];
                if (event.shiftKey) {
                    const from = anchor ?? focused ?? next;
                    setAnchor(from);
                    selectRange(from, next, false);
                } else {
                    setAnchor(next);
                }
                setFocused(next);
            };
            if (key === "j" || event.key === "ArrowRight") move(1);
            else if (key === "k" || event.key === "ArrowLeft") move(-1);
            else if (event.key === "ArrowDown") move(columns());
            else if (event.key === "ArrowUp") move(-columns());
            else if (event.key === "Home") move(-order.length);
            else if (event.key === "End") move(order.length);
            else if (event.key === "Escape") {
                setSelected(new Set());
            } else if ((key === "x" || event.key === " ") && focused !== undefined) {
                event.preventDefault();
                toggle(focused);
            } else if (event.key === "Enter" && focused !== undefined) {
                event.preventDefault();
                onOpen(focused);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    useEffect(() => {
        if (focused === undefined) return;
        gridRef.current?.querySelector<HTMLElement>(`[data-segment="${focused}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, [focused]);

    if (!shots.length) {
        return (
            <div className="drama-genesis">
                <div className="drama-genesis-card">
                    <div className={`drama-genesis-orb ${empty.active ? "" : "is-idle"}`} aria-hidden />
                    <h2>{empty.title}</h2>
                    <p>{empty.text}</p>
                    {empty.action ? <div className="drama-genesis-action">{empty.action}</div> : null}
                </div>
            </div>
        );
    }

    return (
        <div className="pb-4">
            <div className={`drama-board-toolbar ${selected.size ? "is-selecting" : ""}`}>
                {selected.size ? (
                    <>
                        <b className="text-[var(--fs-label)]">{_creationText("creation.0ea801426801dedf", { value1: selected.size })}</b>
                        <div className="drama-board-model">
                            <DramaModelPicker
                                capability="video"
                                size="sm"
                                value={batchModel || defaultVideoModel}
                                onChange={setBatchModel}
                                placeholder={_creationText("creation.a0afda31af337fd1")}
                                aspectRatio={aspectRatio}
                                videoResolution={videoResolution}
                            />
                        </div>
                        <Tooltip title={toGenerate.length < selected.size ? _creationText("creation.4f8cdb7da01a9e6f", { value1: selected.size - toGenerate.length }) : undefined}>
                            <Button
                                size="small"
                                type="primary"
                                icon={<Play className="size-3.5" />}
                                disabled={busy || !toGenerate.length}
                                onClick={() => {
                                    onGenerate(toGenerate, batchModel);
                                    setSelected(new Set());
                                }}
                            >
                                {_creationText("creation.06fdddbce72b50bb", { value1: toGenerate.length })}
                            </Button>
                        </Tooltip>
                        <Button
                            size="small"
                            icon={<PenLine className="size-3.5" />}
                            disabled={busy || !toWrite.length}
                            onClick={() => {
                                onWritePrompts(toWrite);
                                setSelected(new Set());
                            }}
                        >
                            {_creationText("creation.885eb75ec5e51c39", { value1: toWrite.length })}
                        </Button>
                        <Button size="small" type="text" onClick={() => setSelected(new Set(order))}>
                            {_creationText("creation.3a5040b68abf75f9")}
                        </Button>
                        <Button size="small" type="text" icon={<X className="size-3.5" />} className="!ml-auto" onClick={() => setSelected(new Set())}>
                            {_creationText("creation.74966e20df2ea9fd")}
                        </Button>
                    </>
                ) : (
                    <>
                        <span className="drama-board-stat">
                            <b>{segments.length}</b>
                            {_creationText("creation.0477dbbdee99b5b3")}
                        </span>
                        <span className="drama-board-stat">
                            <b>{shots.length}</b>
                            {_creationText("creation.601e41f3ade62c01")}
                        </span>
                        <span className="drama-board-stat">
                            <b>{formatClock(totals.durationMs)}</b>
                            {_creationText("workbench.duration")}
                        </span>
                        <span className="drama-board-meter" aria-label={_creationText("creation.b9545515a714cfb2", { value1: totals.prompts, value2: segments.length })}>
                            {_creationText("workbench.prompt_label")}
                            <i>
                                <em style={progressFillStyle((totals.prompts / Math.max(segments.length, 1)) * 100)} />
                            </i>
                            <b>
                                {totals.prompts}/{segments.length}
                            </b>
                        </span>
                        <span className="drama-board-meter is-video" aria-label={_creationText("creation.a2dd701b37297058", { value1: totals.videos, value2: segments.length })}>
                            {_creationText("create.mode_video")}
                            <i>
                                <em style={progressFillStyle((totals.videos / Math.max(segments.length, 1)) * 100)} />
                            </i>
                            <b>
                                {totals.videos}/{segments.length}
                            </b>
                        </span>
                        <span className="ml-auto drama-board-hint">{_creationText("creation.92ae60561f8dc471")}</span>
                    </>
                )}
            </div>
            <div ref={gridRef} className={`drama-sg-grid ${aspectRatio === "16:9" || aspectRatio === "4:3" ? "is-landscape" : ""}`} role="listbox" aria-multiselectable aria-label={_creationText("creation.7c4175f6609bc3c7")}>
                {segments.map((segment) => (
                    <SegmentCard
                        key={segment.id || segment.index}
                        segment={segment}
                        segmentShots={shotsBySegment.get(segment.index) || NO_SHOTS}
                        aspectRatio={aspectRatio}
                        castById={castById}
                        isSelected={selected.has(segment.index)}
                        focused={focused === segment.index}
                        busy={busy}
                        reprocessing={reprocessing === segment.index}
                        defaultModelLabel={defaultVideoModel?.label}
                        actions={actions}
                    />
                ))}
            </div>
            <div className="drama-kbd-hint" aria-label={_creationText("creation.89ce481a4b23d2a4")}>
                <span>
                    <kbd>⌘</kbd>
                    <kbd>A</kbd>
                    {_creationText("creation.3a5040b68abf75f9")}
                </span>
                <span>
                    <kbd>⌘</kbd>
                    {_creationText("creation.6d965596c92f294c")}
                </span>
                <span>
                    <kbd>⇧</kbd>
                    {_creationText("creation.550cb0f92cc09fed")}
                    <kbd>⇧</kbd>
                    <kbd>←</kbd>
                    <kbd>→</kbd>
                    {_creationText("creation.9ae465eb2cf1d8bd")}
                </span>
                <span>
                    <kbd>X</kbd>/<kbd>{_creationText("creation.bfa4a6e0fe42ac28")}</kbd>
                    {_creationText("creation.4172693f0f03ab2d")}
                </span>
                <span>
                    <kbd>J</kbd>
                    <kbd>K</kbd>
                    {_creationText("creation.d96a48dd7c84f036")}
                </span>
                <span>
                    <kbd>Enter</kbd>
                    {_creationText("creation.c771248e511fbf93")}
                </span>
                <span>
                    <kbd>Esc</kbd>
                    {_creationText("creation.74966e20df2ea9fd")}
                </span>
            </div>
        </div>
    );
}

import { creationOptions as _creationOptions, creationLabel as _creationLabel } from "@/supdance/plugins/i18n/creation-text";
import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { App, Button, Input, InputNumber, Popover, Select } from "antd";
import { CachedResourceImage } from "@/components/cached-resource-image";
import { AntTooltip as Tooltip } from "@/components/ui/base/tooltip/ant-tooltip";
import { AlertTriangle, Brush, Check, ChevronLeft, ChevronRight, Copy, Info, Loader2, Pencil, Play, Plus, RotateCcw, Trash2, X, PenLine } from "lucide-react";

import { AppModal } from "@/components/ui/product/app-modal";
import { TRANSITION_LABEL } from "@/lib/drama/storyboard";
import type { DramaCast, DramaEpisodeDetail, DramaModelChoice, DramaSegment, DramaSegmentReferencePatch, DramaShot, DramaShotPatch, DramaTake, DramaTransition } from "@/services/api/drama";
import { ReferenceBoard } from "./segment-references";
import { dramaChoiceKey, dramaVideoResolutionValue } from "@/lib/drama/model-choice";
import { formatVideoResolutionLabel } from "@/lib/video-generation-options";

import { DramaModelPicker, useDramaModelCatalog } from "../drama-model-picker";
import { useEffectiveConfig } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";
import { dramaSegmentQuoteMissing, dramaSegmentVideoRequirements, dramaVideoOptionFor, SEGMENT_NO_QUOTE_HINT } from "./segment-quote";

import { CAST_KIND_LABEL, formatCredits, mediaBusy, MediaThumb } from "../drama-shared";
import { promptReady, secondsLabel, SegmentStatus, SegmentVideo, videoWaitLabel } from "./segment-parts";
import { DramaTakeList, shortModelName } from "./take-list";
import { CanvasResourceMentionTextarea } from "@/components/canvas/canvas-resource-mention-textarea";
import type { CanvasResourceReference } from "@/lib/canvas/canvas-resource-references";

const SHOT_SIZES = ["特写", "近景", "中景", "全景", "远景"];
const CAMERAS = ["固定", "推", "拉", "摇", "跟", "环绕", "升降", "手持"];

const PROMPT_NOTICE: Record<DramaSegment["promptStatus"], string> = {
    none: "还没有撰写本段视频提示词",
    queued: "排队撰写中…",
    running: "正在撰写本段视频提示词…",
    ready: "",
    stale: "本段镜头或设定改过，提示词已过期，请重新撰写",
    failed: "撰写失败",
};

const OPERATION_LABEL: Record<DramaSegment["request"]["operation"], string> = {
    image_to_video: "图生视频（上一段尾帧作首帧）",
    reference_to_video: "参考图生视频",
    text_to_video: "文生视频",
    "": "未确定",
};

type Props = {
    detail?: DramaEpisodeDetail;
    segmentIndex?: number;
    shotId?: string;
    castById: Map<string, DramaCast>;
    aspectRatio: string;
    busy: boolean;
    writing: boolean;
    onClose: () => void;
    onNavigate: (segmentIndex: number, shotId?: string) => void;
    onPatchShot: (shot: DramaShot, patch: DramaShotPatch) => void;
    /** 在镜头前后插入空镜头；不传时不显示插入入口。 */
    onInsertShot?: (shot: DramaShot, position: "before" | "after") => void;
    /** 删除镜头；剧情段唯一的镜头不能删。 */
    onDeleteShot?: (shot: DramaShot) => void;
    onSavePrompt: (segment: DramaSegment, override: string) => void;
    /** 指定本段参考图；null 恢复按镜头自动取。 */
    onSaveReferences: (segment: DramaSegment, patch: DramaSegmentReferencePatch) => Promise<unknown>;
    onWritePrompt: (segment: DramaSegment) => void;
    onGenerate: (segment: DramaSegment, model?: DramaModelChoice) => void;
    reprocessing: boolean;
    onReprocess: (segment: DramaSegment) => void;
    defaultVideoModel: DramaModelChoice;
    /** 作品指定的视频分辨率；换模型时给不出的置灰。 */
    videoResolution?: string;
    onOpenCast: (castId: string) => void;
    /** 把本段投送到精修画布（已投送则定位），在画布上换首尾帧、延长或重新生成后采用回来。 */
    onOpenCanvas: (segment: DramaSegment) => void;
    canvasOpening: boolean;
};

/**
 * 剧情段弹窗（生成节点）：上方是本段的生成控制（视频模型、时长、画幅与操作），
 * 接着是本段使用的参考资产（可逐个勾选）、生成依据回执与按时间排开的镜头脚本，最后是提交时发送的完整提示词；
 * 右侧固定本段视频、处理状态与版本记录。
 */
export function SegmentDialog({
    detail,
    segmentIndex,
    shotId,
    castById,
    aspectRatio,
    busy,
    writing,
    reprocessing,
    defaultVideoModel,
    videoResolution,
    onClose,
    onNavigate,
    onPatchShot,
    onInsertShot,
    onDeleteShot,
    onSavePrompt,
    onSaveReferences,
    onWritePrompt,
    onGenerate,
    onReprocess,
    onOpenCast,
    onOpenCanvas,
    canvasOpening,
}: Props) {
    _useCreationLocale();
    const segments = detail?.segments || [];
    const position = segments.findIndex((item) => item.index === segmentIndex);
    const segment = position >= 0 ? segments[position] : undefined;
    const shots = segment ? (detail?.shots || []).filter((shot) => shot.segmentIndex === segment.index) : [];
    const [previewTake, setPreviewTake] = useState<DramaTake>();
    useEffect(() => {
        setPreviewTake(undefined);
    }, [segment?.id]);
    const previewResourceId = previewTake && segment && previewTake.resourceId !== segment.videoResourceId ? previewTake.resourceId : undefined;
    return (
        <AppModal
            open={Boolean(segment)}
            onCancel={onClose}
            footer={null}
            title={null}
            closable={false}
            flush
            centered
            width="min(1360px, calc(100vw - 48px))"
            rootClassName="drama-root drama-sd-root"
            aria-label={segment ? _creationText("creation.83db323ec59ca39a", { value1: segment.index + 1 }) : _creationText("creation.7c4175f6609bc3c7")}
        >
            {segment && detail ? (
                <div className="drama-sd">
                    <header className="drama-sd-head">
                        <div className="min-w-0">
                            <div className="drama-eyebrow">
                                {_creationText("creation.af50a0fe2a50a3d1")}
                                {detail.episode.number}
                                {_creationText("creation.355a2c8cd7808a99")}
                                {segment.index + 1} / {segments.length}
                                {_creationText("creation.c74bcc4f599c8549")}
                                {shots.length ? `${shots[0].position + 1}–${shots[shots.length - 1].position + 1}` : "—"}
                            </div>
                            <div className="drama-sd-title">
                                <h2 data-i18n-user-content>{segment.title}</h2>
                                <span className="drama-sdx-total">
                                    {_creationText("creation.9b1830480c8008b8")}
                                    {secondsLabel(segment.durationMs)}
                                </span>
                                <SegmentStatus segment={segment} />
                            </div>
                        </div>
                        <div className="drama-sd-nav">
                            <Button icon={<Brush className="size-4" />} loading={canvasOpening} onClick={() => onOpenCanvas(segment)}>
                                {_creationText("creation.64422cd9b4ac9f19")}
                            </Button>
                            <Tooltip title={_creationText("creation.5c73eb92d825f81f")}>
                                <Button icon={<ChevronLeft className="size-4" />} aria-label={_creationText("creation.5c73eb92d825f81f")} disabled={position <= 0} onClick={() => onNavigate(segments[position - 1].index)} />
                            </Tooltip>
                            <Tooltip title={_creationText("creation.4cd4dc1f03d6dce3")}>
                                <Button icon={<ChevronRight className="size-4" />} aria-label={_creationText("creation.4cd4dc1f03d6dce3")} disabled={position >= segments.length - 1} onClick={() => onNavigate(segments[position + 1].index)} />
                            </Tooltip>
                            <Button type="text" icon={<X className="size-4" />} aria-label={_creationText("common.close")} onClick={onClose} />
                        </div>
                    </header>
                    <div className="drama-sdx-body">
                        <main className="drama-sdx-main thin-scrollbar">
                            <SegmentToolbar
                                key={segment.id}
                                segment={segment}
                                aspectRatio={aspectRatio}
                                busy={busy}
                                writing={writing}
                                defaultVideoModel={defaultVideoModel}
                                videoResolution={videoResolution}
                                onGenerate={(model) => onGenerate(segment, model)}
                                onWritePrompt={() => onWritePrompt(segment)}
                            />
                            <SegmentPrompt segment={segment} castById={castById} writing={writing} onSave={(override) => onSavePrompt(segment, override)} onWrite={() => onWritePrompt(segment)} />
                            <ReferenceBoard key={segment.id} segment={segment} shots={shots} castById={castById} busy={busy} onSave={(patch) => onSaveReferences(segment, patch)} onOpenCast={onOpenCast} />
                            <SegmentReceipt segment={segment} />
                            <section className="drama-sdx-section" aria-label={_creationText("creation.5327351b5844372b")}>
                                <div className="drama-sdx-section-head">
                                    <strong>{_creationText("creation.5327351b5844372b")}</strong>
                                    <small>{_creationText("creation.2f9969e4bb0b79bd")}</small>
                                </div>
                                <ol className="drama-sdx-shots">
                                    {shots.map((item, index) => (
                                        <ShotCard
                                            key={item.id}
                                            shot={item}
                                            number={index + 1}
                                            startMs={shots.slice(0, index).reduce((sum, previous) => sum + previous.durationMs, 0)}
                                            castById={castById}
                                            editing={item.id === shotId}
                                            busy={busy}
                                            deletable={shots.length > 1}
                                            onEdit={() => onNavigate(segment.index, item.id === shotId ? undefined : item.id)}
                                            onPatch={(patch) => onPatchShot(item, patch)}
                                            onInsert={onInsertShot ? (where) => onInsertShot(item, where) : undefined}
                                            onDelete={onDeleteShot ? () => onDeleteShot(item) : undefined}
                                        />
                                    ))}
                                </ol>
                            </section>
                        </main>
                        <aside className="drama-sdx-side thin-scrollbar" aria-label={_creationText("creation.44bd0fc799b223fa")}>
                            <div className="drama-sdx-side-head">
                                <strong>{_creationText("creation.5ecbd1b33b344e52", { value1: segment.index + 1 })}</strong>
                                <SegmentStatus segment={segment} />
                            </div>
                            <SegmentVideo segment={segment} aspectRatio={aspectRatio} previewResourceId={previewResourceId} />
                            {previewResourceId && previewTake ? (
                                <div className="drama-sdx-preview-banner" role="status">
                                    <span>
                                        {_creationText("creation.ce1c95ee12b000c9")}
                                        {previewTake.version}
                                        {previewTake.durationMs ? ` · ${secondsLabel(previewTake.durationMs).replace(/s$/, " 秒")}` : ""}
                                        {previewTake.model ? ` · ${shortModelName(previewTake.model)}` : ""}
                                        {_creationText("creation.06956123093bb0ab")}
                                    </span>
                                    <Button size="small" onClick={() => setPreviewTake(undefined)}>
                                        {_creationText("creation.ed6efdb1ae8c5e3f")}
                                    </Button>
                                </div>
                            ) : null}
                            {segment.videoStatus === "failed" && segment.videoError ? (
                                <div className="drama-sd-error">
                                    <strong>{segment.videoReprocessable ? _creationText("creation.cb5dcb93c12ddbc4") : _creationText("creation.5a586025ef2c7f6f")}</strong>
                                    <span>{segment.videoError}</span>
                                    {segment.videoReprocessable ? (
                                        <>
                                            <span>{_creationText("creation.17322000f7ee7616")}</span>
                                            <div className="drama-sd-error-actions">
                                                <Button size="small" icon={<RotateCcw className="size-3.5" />} loading={reprocessing} disabled={busy} onClick={() => onReprocess(segment)}>
                                                    {_creationText("creation.1c6614af61520f96")}
                                                </Button>
                                            </div>
                                        </>
                                    ) : null}
                                </div>
                            ) : null}
                            {segment.videoStatus === "queued" && segment.videoWait ? (
                                <div className="drama-sd-error is-wait" role="status">
                                    <strong>{_creationText("creation.25e00a4083c8d52c")}</strong>
                                    <span>{segment.videoWait}</span>
                                </div>
                            ) : null}
                            <dl className="drama-sdx-facts">
                                <div>
                                    <dt>{_creationText("creation.3f94f7b4263e5b00")}</dt>
                                    <dd>{segment.videoSeconds ? _creationText("creation.8e9c8e4d3e4205c7", { value1: segment.videoSeconds }) : "—"}</dd>
                                </div>
                                <div>
                                    <dt>{_creationText("creation.ae7c2a86010c6eeb")}</dt>
                                    <dd>{segment.videoJob ? _creationText("creation.d901f70479c8f61f", { value1: formatCredits(segment.videoJob.costMicrocredits) }) : "—"}</dd>
                                </div>
                            </dl>
                            <DramaTakeList
                                projectId={detail.episode.projectId}
                                ownerId={segment.id}
                                kind="video"
                                previewTakeId={previewTake?.id}
                                onPreview={setPreviewTake}
                                switchCurrent={{ episodeId: detail.episode.id, segmentIndex: segment.index, expectedRevision: segment.revision }}
                            />
                        </aside>
                    </div>
                </div>
            ) : null}
        </AppModal>
    );
}

/** 生成控制条：本段视频模型（只对本段生效）、时长与画幅，以及撰写提示词、复制全文与生成视频。 */
function SegmentToolbar({
    segment,
    aspectRatio,
    busy,
    writing,
    defaultVideoModel,
    videoResolution,
    onGenerate,
    onWritePrompt,
}: {
    segment: DramaSegment;
    aspectRatio: string;
    busy: boolean;
    writing: boolean;
    defaultVideoModel: DramaModelChoice;
    videoResolution?: string;
    onGenerate: (model?: DramaModelChoice) => void;
    onWritePrompt: () => void;
}) {
    _useCreationLocale();
    const { message } = App.useApp();
    const baseline = segment.videoModel?.logicalModelId || segment.videoModel?.modelKey ? segment.videoModel : defaultVideoModel;
    const [choice, setChoice] = useState<DramaModelChoice>(baseline);
    const changed = dramaChoiceKey(choice) !== dramaChoiceKey(baseline);
    const config = useEffectiveConfig();
    const creditsEnabled = useUserStore((state) => state.features.creditsEnabled);
    const catalogQuery = useDramaModelCatalog();
    const chosenOption = dramaVideoOptionFor(catalogQuery.data?.options.video, choice);
    const chosenAudioLimit = changed ? chosenOption?.maxAudios : segment.request.modelMaxAudios;
    // 本段实际出片分辨率：没换模型用服务端预演结果；换了模型且新模型给不出作品分辨率时，按模型默认。
    const supportedResolution = dramaVideoResolutionValue(chosenOption, videoResolution);
    const effectiveResolution = changed ? supportedResolution || chosenOption?.defaultVideoResolution || "" : segment.request.resolution || supportedResolution || chosenOption?.defaultVideoResolution || "";
    const resolutionFallback = Boolean(changed && videoResolution && chosenOption && !supportedResolution);
    const requirements = dramaSegmentVideoRequirements(segment.request, chosenOption, changed, videoResolution);
    const quoteMissing = creditsEnabled && dramaSegmentQuoteMissing(config, choice, requirements);
    const running = mediaBusy(segment.videoStatus);
    const writingNow = segment.promptStatus === "queued" || segment.promptStatus === "running";
    const sent = [segment.request.header, segment.videoPrompt.trim()].filter(Boolean).join("\n\n");
    const generateLabel = running
        ? segment.videoStatus === "queued" && segment.videoWait
            ? videoWaitLabel(segment.videoWait)
            : segment.request.firstFramePending
              ? `排队中 · 等第 ${segment.index} 段`
              : "视频生成中"
        : segment.videoResourceId && segment.videoStatus !== ""
          ? "重新生成视频"
          : "生成本段视频";
    return (
        <section className="drama-sdx-toolbar" aria-label={_creationText("workbench.generation_settings")}>
            <div className="drama-sdx-toolbar-row">
                <DramaModelPicker
                    capability="video"
                    size="sm"
                    value={choice}
                    onChange={setChoice}
                    placeholder={_creationText("creation.a0afda31af337fd1")}
                    className="drama-sdx-model"
                    aspectRatio={aspectRatio}
                    videoResolution={videoResolution}
                    requirements={requirements}
                />
                <Tooltip title={segment.request.maxVideoSeconds ? _creationText("creation.6b0bff4f372e6c4f", { value1: segment.request.maxVideoSeconds }) : _creationText("creation.e69b906d413df03e")}>
                    <span className="drama-sdx-chip">{segment.request.seconds ? `${segment.request.seconds}s` : secondsLabel(segment.durationMs)}</span>
                </Tooltip>
                <Tooltip title={_creationText("creation.a2a5967203246f06")}>
                    <span className="drama-sdx-chip">{aspectRatio}</span>
                </Tooltip>
                {changed ? <span className="drama-sdx-chip is-accent">{_creationText("creation.f1644c09a4ca6f70")}</span> : null}
                <Tooltip title={_creationText("creation.drama.effectiveResolutionTitle")}>
                    <span className="drama-sdx-chip">{effectiveResolution ? formatVideoResolutionLabel(effectiveResolution) : _creationText("creation.drama.modelDefaultResolution")}</span>
                </Tooltip>
            </div>
            <div className="drama-sdx-toolbar-row">
                <Button size="small" icon={<PenLine className="size-3.5" />} loading={writing} disabled={busy || writingNow} onClick={onWritePrompt}>
                    {segment.promptStatus === "none" ? _creationText("creation.ae924664cacd3732") : _creationText("creation.8bf26df8f7981efa")}
                </Button>
                <Button
                    size="small"
                    icon={<Copy className="size-3.5" />}
                    disabled={!segment.videoPrompt}
                    onClick={() =>
                        void navigator.clipboard.writeText(sent).then(
                            () => message.success(_creationText("creation.f0839b18103409c7")),
                            () => message.error(_creationText("creation.753d8bb0da9913ce")),
                        )
                    }
                >
                    {_creationText("creation.c36f24e737314811")}
                </Button>
                <span className="drama-sdx-spacer" />
                <Button
                    type="primary"
                    size="small"
                    icon={running ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" /> : <Play className="size-3.5" />}
                    disabled={busy || !promptReady(segment) || running || Boolean(segment.request.unknownReferences?.length) || quoteMissing}
                    onClick={() => onGenerate(changed ? choice : undefined)}
                >
                    {generateLabel}
                </Button>
            </div>
            {!promptReady(segment) && !running ? <p className="drama-sdx-hint">{_creationText("creation.6180f55293c362ec")}</p> : null}
            {changed && chosenAudioLimit !== undefined ? (
                <p className="drama-sdx-hint">
                    {_creationText("creation.75fdd01c2979146c")}
                    {chosenAudioLimit ? _creationText("creation.17c83b5ba7bf3685", { value1: chosenAudioLimit }) : _creationText("creation.cbbbc5550af11ffb")}
                    {_creationText("creation.a2140bfd2ccf8ad6")}
                </p>
            ) : null}
            {resolutionFallback ? (
                <p className="drama-sdx-hint">
                    {_creationText("creation.drama.segmentResolutionFallback", {
                        requested: videoResolution ? formatVideoResolutionLabel(videoResolution) : _creationText("creation.drama.modelDefaultResolution"),
                        actual: chosenOption?.defaultVideoResolution ? formatVideoResolutionLabel(chosenOption.defaultVideoResolution) : _creationText("creation.drama.modelDefaultResolution"),
                    })}
                </p>
            ) : null}
            {quoteMissing && !running ? <p className="drama-sdx-hint is-error">{SEGMENT_NO_QUOTE_HINT}</p> : null}
            {segment.request.unknownReferences?.length ? (
                <p className="drama-sdx-hint is-error">
                    {_creationText("creation.83c942cfc6b026ac")}
                    {segment.request.unknownReferences.join("、")}
                    {_creationText("creation.24f95068a48ae791")}
                </p>
            ) : null}
        </section>
    );
}

type ReceiptRow = { tone: "ok" | "warn" | "info"; label: string; value: ReactNode };

/** 生成依据回执：本段实际会发送什么、按什么方式生成；与提交时同一函数计算。 */
function SegmentReceipt({ segment }: { segment: DramaSegment }) {
    _useCreationLocale();
    const { request } = segment;
    const references = request.references.length;
    const sent = request.references.filter((ref) => ref.sent).length;
    const first = segment.index === 0 && !request.firstFrameResourceId && !request.firstFramePending;
    const promptText = segment.custom ? "已手动改写" : { none: "未撰写", queued: "排队撰写", running: "撰写中", ready: "已就绪", stale: "已过期，需要重新撰写", failed: "撰写失败" }[segment.promptStatus];
    // 读到视频模型能力时才有画面与声音参数（aspectRatio 与它们一起填写）。
    const outputRows: ReceiptRow[] = request.aspectRatio
        ? [
              {
                  tone: request.size || request.resolution ? "ok" : "warn",
                  label: "画面",
                  value: request.resolution ? `${request.aspectRatio}（按 ${request.resolution} 出片）` : request.size ? request.aspectRatio : `${request.aspectRatio}（所选模型给不出这个画幅）`,
              },
              { tone: request.generateAudio ? "ok" : "warn", label: "声音", value: request.generateAudio ? "模型同步生成对白与音效" : "所选模型不出声，本段视频没有对白与音效" },
          ]
        : [];
    const rows: ReceiptRow[] = [
        { tone: sent === references ? "ok" : "warn", label: "参考图实发", value: `${sent}/${references} 张${references > sent ? "（未附图的按文字设定生成）" : ""}` },
        { tone: first || request.firstFrameResourceId ? "ok" : "warn", label: "首帧", value: first ? "开场段，无首帧" : request.firstFrameResourceId ? `第 ${segment.index} 段视频最后一帧` : `等第 ${segment.index} 段视频生成` },
        { tone: "info", label: "生成方式", value: OPERATION_LABEL[request.operation] },
        { tone: "info", label: "时长", value: `${request.seconds || Math.round(segment.durationMs / 1000)} 秒${request.maxVideoSeconds ? `（模型单次最长 ${request.maxVideoSeconds} 秒）` : ""}` },
        ...outputRows,
        { tone: "info", label: "视频模型", value: segment.videoModel?.label || "作品默认" },
        { tone: promptReady(segment) ? "ok" : "warn", label: "提示词", value: promptText },
    ];
    return (
        <section className="drama-sdx-receipt" aria-label={_creationText("creation.056ff5e9562a293c")}>
            <strong>{_creationText("creation.056ff5e9562a293c")}</strong>
            <ul>
                {rows.map((row) => (
                    <li key={row.label} className={`is-${row.tone}`}>
                        {row.tone === "ok" ? <Check className="size-3.5" aria-hidden /> : row.tone === "warn" ? <AlertTriangle className="size-3.5" aria-hidden /> : <Info className="size-3.5" aria-hidden />}
                        <span>{_creationLabel(row.label)}：</span>
                        <b>{row.value}</b>
                    </li>
                ))}
                {request.warning ? (
                    <li className="is-warn">
                        <AlertTriangle className="size-3.5" aria-hidden />
                        <b>{request.warning}</b>
                    </li>
                ) : null}
            </ul>
        </section>
    );
}

/** 文本里出现的设定名高亮显示，方便核对镜头里的人物、道具与场景。 */
function HighlightCast({ text, names }: { text: string; names: string[] }) {
    _useCreationLocale();
    if (!text || !names.length) return <>{text}</>;
    const pattern = new RegExp(`(${names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
    return (
        <>
            {text.split(pattern).map((part, index) =>
                names.includes(part) ? (
                    <mark key={index} className="drama-sdx-mention">
                        {part}
                    </mark>
                ) : (
                    part
                ),
            )}
        </>
    );
}

/** 一个镜头：类型、时间段与操作，下面直接列出景别、运镜、画面、动作与台词；编辑时展开表单。 */
function ShotCard({
    shot,
    number,
    startMs,
    castById,
    editing,
    busy,
    deletable,
    onEdit,
    onPatch,
    onInsert,
    onDelete,
}: {
    shot: DramaShot;
    number: number;
    startMs: number;
    castById: Map<string, DramaCast>;
    editing: boolean;
    busy: boolean;
    deletable: boolean;
    onEdit: () => void;
    onPatch: (patch: DramaShotPatch) => void;
    onInsert?: (where: "before" | "after") => void;
    onDelete?: () => void;
}) {
    _useCreationLocale();
    const { modal } = App.useApp();
    const names = useMemo(
        () =>
            [...castById.values()]
                .map((cast) => cast.name)
                .filter((name) => name.length >= 2)
                .sort((left, right) => right.length - left.length),
        [castById],
    );
    const rows: Array<[string, string]> = [
        ["景别", [shot.shotSize, shot.camera ? `运镜 ${shot.camera}` : "", shot.transition && shot.transition !== "cut" && shot.position > 0 ? `转场 ${TRANSITION_LABEL[shot.transition]}` : ""].filter(Boolean).join(" · ")],
        ["场景", shot.scene],
        ["画面", shot.imagePrompt],
        ["动作", shot.action],
        ["运动", shot.videoPrompt],
        ["对白", shot.dialogue ? `${shot.speaker || "旁白"}：${shot.dialogue}` : "无"],
    ];
    return (
        <li className={`drama-sdx-shot ${editing ? "is-editing" : ""}`}>
            <div className="drama-sdx-shot-head">
                <b className="drama-sdx-shot-index">{number}</b>
                <span data-i18n-user-content className="drama-sdx-chip">
                    {shot.dialogue ? _creationText("creation.271f256b3cb9cd3b") : _creationText("creation.e58e8ce8ad3025ac")}
                </span>
                <span className="drama-sdx-shot-time">
                    {secondsLabel(startMs)}–{secondsLabel(startMs + shot.durationMs)}
                </span>
                <span className="drama-sdx-shot-duration">{secondsLabel(shot.durationMs)}</span>
                <span className="drama-sdx-spacer" />
                {onInsert ? (
                    <Tooltip title={_creationText("creation.fbc909b7baa01d67")}>
                        <Button size="small" icon={<Plus className="size-3.5" />} disabled={busy} onClick={() => onInsert("after")}>
                            {_creationText("creation.601e41f3ade62c01")}
                        </Button>
                    </Tooltip>
                ) : null}
                {onDelete ? (
                    <Tooltip title={deletable ? _creationText("creation.382c8d6e426ce8cd") : _creationText("creation.563407e151db7ecc")}>
                        <Button
                            size="small"
                            icon={<Trash2 className="size-3.5" />}
                            aria-label={_creationText("creation.382c8d6e426ce8cd")}
                            disabled={busy || !deletable}
                            onClick={() =>
                                modal.confirm({
                                    title: `删除镜头 ${number}？`,
                                    content: "删除后本段提示词与视频需要重新生成。",
                                    okText: "删除",
                                    okButtonProps: { danger: true },
                                    cancelText: "取消",
                                    centered: true,
                                    onOk: onDelete,
                                })
                            }
                        />
                    </Tooltip>
                ) : null}
                <Button size="small" type={editing ? "primary" : "default"} icon={<Pencil className="size-3.5" />} aria-pressed={editing} onClick={onEdit}>
                    {editing ? _creationText("settings.channel_complete_btn") : _creationText("common.edit")}
                </Button>
            </div>
            {editing ? (
                <ShotEditor key={shot.id} shot={shot} onPatch={onPatch} />
            ) : (
                <dl className="drama-sdx-shot-body">
                    {rows
                        .filter(([, value]) => value)
                        .map(([label, value]) => (
                            <div key={label}>
                                <dt>{_creationLabel(label)}</dt>
                                <dd>
                                    <HighlightCast text={value} names={names} />
                                </dd>
                            </div>
                        ))}
                </dl>
            )}
        </li>
    );
}

// 与服务端 production.referenceTokenPattern 一致：“@参考图1”“参考图 1”保存时都会归一成“参考图1”。
const REFERENCE_TOKEN = /@?参考图\s*(\d+)/g;

/** 正文里引用到的参考图编号，以及不属于本段的编号（超出参考图数量）。 */
function referenceUsage(text: string, count: number) {
    const used = new Set<number>();
    const unknown: string[] = [];
    for (const match of text.matchAll(REFERENCE_TOKEN)) {
        const number = Number(match[1]);
        if (number >= 1 && number <= count) used.add(number);
        else if (!unknown.includes(`参考图${match[1]}`)) unknown.push(`参考图${match[1]}`);
    }
    return { used, unknown };
}

const PROMPT_EDITOR_MIN = 260;
const PROMPT_EDITOR_MAX = 560;

/**
 * 完整视频提示词：与画布视频节点的提示词面板一致，正文里的“参考图N”显示为带缩略图的引用，输入 @ 可插入本段参考图。
 * 提交时系统在正文前追加参考图对应说明（上方列出），视频模型靠同一个“参考图N”把名称与图片对上。
 */
function SegmentPrompt({ segment, castById, writing, onSave, onWrite }: { segment: DramaSegment; castById: Map<string, DramaCast>; writing: boolean; onSave: (override: string) => void; onWrite: () => void }) {
    _useCreationLocale();
    const [draft, setDraft] = useState(segment.videoPrompt);
    const [editorHeight, setEditorHeight] = useState(PROMPT_EDITOR_MIN);
    const [showHeader, setShowHeader] = useState(false);
    useEffect(() => setDraft(segment.videoPrompt), [segment.videoPrompt]);
    const busy = segment.promptStatus === "queued" || segment.promptStatus === "running";
    const notice = segment.custom && segment.promptStatus === "stale" ? "" : PROMPT_NOTICE[segment.promptStatus];
    const dirty = draft.trim() !== segment.videoPrompt.trim();
    const { request } = segment;
    const references = useMemo<CanvasResourceReference[]>(
        () =>
            request.references.map((ref) => {
                const resourceId = ref.resourceId || castById.get(ref.castId)?.imageResourceId;
                return {
                    id: `drama-ref:${ref.castId || ref.resourceId}`,
                    nodeId: "",
                    kind: "image",
                    label: ref.label,
                    title: `${ref.name} · ${CAST_KIND_LABEL[ref.kind]}${ref.sent ? "" : "（未附图）"}`,
                    storageKey: resourceId ? `resource:${resourceId}` : undefined,
                    mentionToken: ref.label,
                    active: true,
                };
            }),
        [castById, request.references],
    );
    const usage = useMemo(() => referenceUsage(draft, request.references.length), [draft, request.references.length]);
    // 与服务端一致按字符（码点）计：参考图说明 + 空行 + 正文。
    const sentChars = Array.from([request.header, draft.trim()].filter(Boolean).join("\n\n")).length;
    const overLimit = Boolean(request.promptMaxChars && sentChars > request.promptMaxChars);
    const unmentioned = request.references.filter((_, index) => !usage.used.has(index + 1));
    const commit = () => {
        const next = draft.trim();
        if (!dirty) return;
        if (!next) {
            setDraft(segment.videoPrompt);
            return;
        }
        onSave(next === segment.generated.trim() ? "" : next);
    };
    return (
        <section className="drama-sdx-section drama-sdx-prompt" aria-label={_creationText("creation.c9667afc7e406330")}>
            <div className="drama-sdx-section-head">
                <strong>{_creationText("creation.c9667afc7e406330")}</strong>
                {segment.custom ? <span className="drama-sdx-chip is-accent">{_creationText("creation.bf4dd6b2a365d439")}</span> : null}
                <small>{_creationText("creation.1d5e4b75f52d7fbb")}</small>
                {segment.custom ? (
                    <Button size="small" type="text" icon={<RotateCcw className="size-3.5" />} onClick={() => onSave("")}>
                        {_creationText("creation.4d2e5ee624a18410")}
                    </Button>
                ) : null}
            </div>
            {notice && segment.videoPrompt ? <PromptNotice segment={segment} text={notice} /> : null}
            {request.header ? (
                <div className="drama-sdx-prefix" aria-label={_creationText("creation.baf62892393711ae")}>
                    <div className="drama-sdx-prefix-head">
                        <span>{_creationText("creation.4693268e02fbc877")}</span>
                        <button type="button" className="drama-sdx-link" aria-expanded={showHeader} onClick={() => setShowHeader((value) => !value)}>
                            {showHeader ? _creationText("creation.b5269ef5aea2bd68") : _creationText("creation.e8952ea03f9173f3")}
                        </button>
                    </div>
                    <div className="drama-sdx-prefix-refs">
                        {segment.index > 0 ? <span className="drama-sdx-prefix-ref is-frame">{_creationText("creation.859b4d5247209e00")}</span> : null}
                        {request.references.map((ref, index) => {
                            const resourceId = ref.resourceId || castById.get(ref.castId)?.imageResourceId;
                            const caption = ref.sent ? `${ref.label}：${ref.name}` : `${ref.label}（${ref.name}）未附图，按文字设定生成`;
                            const chip = (
                                <span
                                    key={ref.castId || ref.resourceId}
                                    className={`drama-sdx-prefix-ref ${ref.sent ? "" : "is-missing"} ${usage.used.has(index + 1) ? "" : "is-unused"}`}
                                    title={resourceId ? undefined : _creationLabel(caption)}
                                    tabIndex={resourceId ? 0 : undefined}
                                    aria-label={caption}
                                >
                                    <span className="drama-sdx-prefix-thumb">{resourceId ? <MediaThumb resourceId={resourceId} alt="" /> : null}</span>
                                    <b>{_creationLabel(ref.label)}</b>
                                    {ref.name}
                                </span>
                            );
                            if (!resourceId) return chip;
                            return (
                                <Popover
                                    key={ref.castId || ref.resourceId}
                                    trigger={["hover", "focus"]}
                                    mouseEnterDelay={0.2}
                                    placement="bottom"
                                    content={
                                        <figure className="drama-sdx-prefix-preview">
                                            <CachedResourceImage storageKey={`resource:${resourceId}`} alt={caption} eager draggable={false} />
                                            <figcaption>{caption}</figcaption>
                                        </figure>
                                    }
                                >
                                    {chip}
                                </Popover>
                            );
                        })}
                    </div>
                    {showHeader ? <pre>{request.header}</pre> : null}
                </div>
            ) : null}
            {!segment.videoPrompt && !draft && !busy ? (
                <div className="drama-sd-write">
                    <span>
                        {notice}
                        {segment.promptStatus === "failed" && segment.promptError ? `：${segment.promptError}` : ""}
                    </span>
                    <Button size="small" type="primary" icon={<PenLine className="size-3.5" />} loading={writing} onClick={onWrite}>
                        {segment.promptStatus === "none" ? _creationText("creation.81baad7cfd5f89c7") : _creationText("creation.a952766ec558060d")}
                    </Button>
                </div>
            ) : null}
            {segment.videoPrompt || draft || !busy ? (
                <div className="drama-sdx-editor" style={{ height: Math.min(PROMPT_EDITOR_MAX, Math.max(PROMPT_EDITOR_MIN, editorHeight + 4)) }}>
                    <CanvasResourceMentionTextarea
                        value={draft}
                        references={references}
                        onChange={(next) => {
                            setDraft(next);
                        }}
                        onSubmit={commit}
                        sendOnEnter={false}
                        onContentSizeChange={setEditorHeight}
                        mentionMenuLabels={{ connected: "本段参考图" }}
                        className="drama-sdx-editor-input thin-scrollbar"
                        style={{ color: "var(--foreground)" }}
                        aria-label={_creationText("creation.c9667afc7e406330")}
                        placeholder={_creationText("creation.db91c75e3a824387")}
                        onBlur={commit}
                        onKeyDown={(event) => {
                            if (event.key === "Escape" && dirty) {
                                event.stopPropagation();
                                setDraft(segment.videoPrompt);
                            }
                        }}
                    />
                </div>
            ) : (
                <div className="drama-sd-empty">
                    <Loader2 className="size-5 animate-spin" aria-hidden />
                    <span>{notice}</span>
                    <small>{_creationText("creation.1bd6362fa0c985b2")}</small>
                </div>
            )}
            {usage.unknown.length ? (
                <p className="drama-sg-note is-error" role="alert">
                    {_creationText("creation.810303952c181221")}
                    {usage.unknown.join("、")}
                    {_creationText("creation.9c7e89bfc92072c8")}
                    {request.references.length}
                    {_creationText("creation.c62d39d8f0d80d86")}
                </p>
            ) : draft && unmentioned.length ? (
                <p className="drama-sg-note">
                    {_creationText("creation.2c19bd763a63f329")}
                    {unmentioned.map((ref) => `${ref.label}（${ref.name}）`).join("、")}
                    {_creationText("creation.d16c1fbaf89b5b36")}
                </p>
            ) : null}
            {overLimit ? (
                <p className="drama-sg-note is-error" role="alert">
                    {_creationText("creation.a5e03fe42d1b25dd")}
                    {sentChars}
                    {_creationText("creation.7b7a2dab242c167c")}
                    {request.promptMaxChars}
                    {_creationText("creation.4667c13f0417dac6")}
                    {segment.custom ? _creationText("creation.4db7952c5b59ee6f") : _creationText("creation.5a1c6e12dcfb51a8")}
                </p>
            ) : null}
            <div className="drama-sd-pane-foot">
                {dirty ? <span className="is-dirty">{_creationText("creation.da8f43267001c38b")}</span> : <span>{_creationText("creation.01170d728a5fe595")}</span>}
                <span className={overLimit ? "is-over" : undefined} title={_creationText("creation.3ee6bf03176e4a13")}>
                    {_creationText("creation.093c8e41624b1c08")}
                    {sentChars}
                    {request.promptMaxChars ? ` / ${request.promptMaxChars}` : ""}
                    {_creationText("creation.c55038b272b109b8")}
                </span>
            </div>
        </section>
    );
}

function PromptNotice({ segment, text }: { segment: DramaSegment; text: ReactNode }) {
    _useCreationLocale();
    const busy = segment.promptStatus === "queued" || segment.promptStatus === "running";
    return (
        <div className={`drama-sd-notice is-${segment.promptStatus}`}>
            {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            <span>
                {text}
                {segment.promptStatus === "failed" && segment.promptError ? `：${segment.promptError}` : ""}
            </span>
        </div>
    );
}

/** 单个镜头的剧本内容；镜头是撰写段提示词的素材，不再单独生成媒体。 */
export function ShotEditor({ shot, onPatch }: { shot: DramaShot; onPatch: (patch: DramaShotPatch) => void }) {
    _useCreationLocale();
    return (
        <div className="drama-sd-form">
            <FieldText label={_creationText("creation.e7447595378ab413")} value={shot.dialogue} placeholder={_creationText("creation.f993fa0eaff535b8")} onSave={(value) => onPatch({ dialogue: value })} />
            <div className="drama-sd-row">
                <label className="drama-sd-field">
                    <span className="drama-sd-label">
                        <span>{_creationText("creation.0ac45e5afa719ca6")}</span>
                    </span>
                    <Input
                        defaultValue={shot.speaker}
                        key={`${shot.id}-speaker-${shot.speaker}`}
                        placeholder={_creationText("projects.narration")}
                        aria-label={_creationText("creation.0ac45e5afa719ca6")}
                        onBlur={(event) => {
                            if (event.target.value.trim() !== shot.speaker) onPatch({ speaker: event.target.value });
                        }}
                    />
                </label>
                <label className="drama-sd-field">
                    <span className="drama-sd-label">
                        <span>{_creationText("workbench.duration")}</span>
                    </span>
                    <InputNumber
                        key={`${shot.id}-${shot.durationMs}`}
                        className="!w-full"
                        min={1}
                        max={60}
                        step={0.5}
                        precision={1}
                        defaultValue={shot.durationMs / 1000}
                        suffix="秒"
                        aria-label={_creationText("creation.bbec874fe996c5df")}
                        onBlur={(event) => {
                            const seconds = Number(event.target.value);
                            if (Number.isFinite(seconds) && Math.abs(seconds * 1000 - shot.durationMs) >= 50) onPatch({ durationSeconds: seconds });
                        }}
                        onPressEnter={(event) => (event.target as HTMLInputElement).blur()}
                    />
                </label>
            </div>
            <div className="drama-sd-row is-three">
                <label className="drama-sd-field">
                    <span className="drama-sd-label">
                        <span>{_creationText("canvas.shot_scale")}</span>
                    </span>
                    <Select
                        className="w-full"
                        value={shot.shotSize || undefined}
                        placeholder={_creationText("settings.oss_path_style_auto")}
                        aria-label={_creationText("canvas.shot_scale")}
                        options={_creationOptions(SHOT_SIZES.map((value) => ({ value, label: value })))}
                        onChange={(value) => onPatch({ shotSize: value })}
                    />
                </label>
                <label className="drama-sd-field">
                    <span className="drama-sd-label">
                        <span>{_creationText("canvas.camera_movement")}</span>
                    </span>
                    <Select
                        className="w-full"
                        value={shot.camera || undefined}
                        placeholder={_creationText("settings.oss_path_style_auto")}
                        aria-label={_creationText("canvas.camera_movement")}
                        options={_creationOptions(CAMERAS.map((value) => ({ value, label: value })))}
                        onChange={(value) => onPatch({ camera: value })}
                    />
                </label>
                <label className="drama-sd-field">
                    <span className="drama-sd-label">
                        <span>{_creationText("creation.12bb64579c1966c4")}</span>
                    </span>
                    <Select
                        className="w-full"
                        value={(shot.transition || "cut") as DramaTransition}
                        aria-label={_creationText("creation.12bb64579c1966c4")}
                        options={_creationOptions((Object.keys(TRANSITION_LABEL) as DramaTransition[]).map((value) => ({ value, label: TRANSITION_LABEL[value] })))}
                        disabled={shot.position === 0}
                        onChange={(value) => onPatch({ transition: value })}
                    />
                </label>
            </div>
            <FieldText label={_creationText("creation.be37d84119d6b71f")} value={shot.action} rows={2} onSave={(value) => onPatch({ action: value })} />
            <FieldText label={_creationText("creation.f877fd93b5ecbd6a")} value={shot.imagePrompt} rows={2} onSave={(value) => onPatch({ imagePrompt: value })} />
            {shot.sourceQuote ? (
                <div className="drama-sd-quote" data-i18n-user-content>
                    <span className="drama-sd-label">
                        <span>{_creationText("creation.354b28c853334568")}</span>
                    </span>
                    <p data-i18n-user-content>「{shot.sourceQuote}」</p>
                </div>
            ) : null}
        </div>
    );
}

function FieldText({ label, value, placeholder, rows = 1, onSave }: { label: string; value: string; placeholder?: string; rows?: number; onSave: (value: string) => void }) {
    _useCreationLocale();
    const [draft, setDraft] = useState(value);
    useEffect(() => setDraft(value), [value]);
    return (
        <label className="drama-sd-field">
            <span className="drama-sd-label">
                <span>{_creationLabel(label)}</span>
                {draft !== value ? <small className="is-dirty">{_creationText("settings.prompts_unsaved")}</small> : null}
            </span>
            <Input.TextArea
                value={draft}
                placeholder={placeholder}
                autoSize={{ minRows: rows, maxRows: 5 }}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => {
                    if (draft.trim() !== value.trim()) onSave(draft);
                }}
            />
        </label>
    );
}

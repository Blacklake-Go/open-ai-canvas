import { creationLabel as _creationLabel, creationOptions as _creationOptions } from "@/supdance/plugins/i18n/creation-text";
import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { App, Button, Checkbox, Input, InputNumber, Select, Switch } from "antd";
import {
    AlertCircle,
    ArrowRight,
    Brush,
    CheckCheck,
    Clapperboard,
    Film,
    FolderOpen,
    Gem,
    Inbox,
    Lock,
    MapPinned,
    Maximize2,
    PauseCircle,
    RefreshCw,
    RotateCcw,
    ScrollText,
    Upload,
    UserRound,
    UsersRound,
    Cpu,
    PackageCheck,
    Play,
    Plus,
    Link2,
    Shirt,
    Trash2,
} from "lucide-react";

import { CanvasImagePreview } from "@/components/canvas/canvas-image-preview";
import { dramaChoiceKey, dramaResolutionAfterModelChange, dramaVideoRatioIssue, dramaVideoResolutionIssue } from "@/lib/drama/model-choice";
import { formatVideoResolutionLabel } from "@/lib/video-generation-options";
import { dramaKeys } from "@/lib/drama/drama-query-keys";
import {
    getDramaCastImpact,
    regenerateDramaCast,
    regenerateDramaCasts,
    setDramaCastImage,
    updateDramaCast,
    updateDramaCastLook,
    deleteDramaCastLook,
    updateDramaSettings,
    type DramaCapability,
    type DramaCast,
    type DramaCastKind,
    type DramaEpisodeMode,
    type DramaSettings,
    formatDramaInboxCount,
    type DramaInboxItem,
    type DramaMediaMode,
    type DramaModelChoice,
    type DramaReviewMode,
    type DramaSummary,
    type DramaTextThinking,
    type DramaVideoContinuity,
} from "@/services/api/drama";

import { aspectRatioValue, CAST_KIND_LABEL, EpisodeGroupField, formatCredits, MEDIA_MODE_LABEL, mediaBusy, MediaThumb, parseList, VIDEO_CONTINUITY_LABEL } from "../drama-shared";
import { AssetSchemePicker } from "../asset-scheme";
import { DramaModelPicker, useDramaModelCatalog } from "../drama-model-picker";
import { DramaAssetImageModels, DramaTextSteps, VideoResolutionField } from "../step-settings";
import { StoryboardRules } from "../storyboard-rules";
import { progressFillStyle } from "@/lib/progress-fill";
import { uploadResourceFile } from "@/services/api/resources";
import { DramaTakeList } from "./take-list";
import { CastLibraryPicker } from "./cast-library-picker";
import { CastVoiceField, CastVoicePreview } from "./cast-voice";
import { CastLooks } from "./cast-looks";
import { CastImageFields, type CastImageFieldsValue } from "./cast-image-fields";
import { CastCreateDialog } from "./cast-create-dialog";
import { CastProjectImport } from "./cast-project-import";

// 制作台的三个整页视图：设定（角色 / 道具 / 场景）、待处理、制作设置。都在主区域内展示，不使用抽屉遮挡。

// ===== 设定 =====

const CAST_KIND_ICON: Record<DramaCastKind, ReactNode> = { character: <UserRound className="size-6 opacity-30" />, prop: <Gem className="size-6 opacity-30" />, scene: <MapPinned className="size-6 opacity-30" /> };
const CAST_KINDS: DramaCastKind[] = ["character", "prop", "scene"];
const CAST_TABS = ["character", "look", "prop", "scene"] as const;
type CastTab = (typeof CAST_TABS)[number];

type CastFilter = "all" | "failed" | "busy" | "locked";

/** 资产参考图统一横版 16:9；角色按参考图方案的画幅（内置方案均为 16:9）。图片完整显示不裁切，占位与成图同尺寸。 */
const ASSET_IMAGE_RATIO = "16:9";

function castRatio(kind: DramaCastKind, ratios: CastRatios) {
    const ratio = (kind === "character" && ratios.character) || ASSET_IMAGE_RATIO;
    const [width, height] = ratio.split(":").map(Number);
    const orientation = width && height ? (width > height ? "is-wide" : width < height ? "is-tall" : "is-square") : "is-tall";
    return { style: { "--drama-cast-ratio": aspectRatioValue(ratio) } as CSSProperties, orientation };
}

export type CastRatios = { character: string };

const castImageLoading = <span className="drama-cast-media-state is-loading" role="status" aria-label={_creationText("creation.4a655cc3a794f39a")} />;
const castImageFailed = (
    <span className="drama-cast-media-state">
        <AlertCircle className="size-3.5" />
        {_creationText("creation.572993f5820a55ba")}
    </span>
);

export function CastPanel({
    projectId,
    cast,
    ratios,
    focusId,
    retrying,
    assetsPending,
    releasing,
    onFocus,
    onRetry,
    onChanged,
    onReleaseAssets,
    onOpenCanvas,
    canvasOpening,
}: {
    projectId: string;
    cast: DramaCast[];
    ratios: CastRatios;
    focusId: string;
    retrying: boolean;
    assetsPending: boolean;
    releasing: boolean;
    onFocus: (id: string) => void;
    onRetry: () => void;
    onChanged: () => void;
    onReleaseAssets: () => void;
    /** 把设定投送到精修画布（已投送则定位）。 */
    onOpenCanvas: (castId: string) => void;
    /** 正在打开画布的设定 ID。 */
    canvasOpening?: string;
}) {
    _useCreationLocale();
    const [kind, setKind] = useState<CastTab>("character");
    const [filter, setFilter] = useState<CastFilter>("all");
    const [creating, setCreating] = useState(false);
    const [importing, setImporting] = useState(false);
    const focused = cast.find((item) => item.id === focusId);
    const focusedKind = focused?.kind;
    const focusedParent = focused?.parentId;
    useEffect(() => {
        if (focusedKind) setKind((current) => (focusedParent ? (current === "character" ? current : "look") : focusedKind));
    }, [focusId, focusedKind, focusedParent]);
    const bases = cast.filter((item) => !item.parentId);
    const ofKind = kind === "look" ? cast.filter((item) => item.parentId) : bases.filter((item) => item.kind === kind);
    const failed = cast.filter((item) => item.imageStatus === "failed").length;
    const count = (predicate: (item: DramaCast) => boolean) => ofKind.filter(predicate).length;
    const filters: Array<[CastFilter, string, number]> = [
        ["all", "全部", ofKind.length],
        ["failed", "失败", count((item) => item.imageStatus === "failed")],
        ["busy", "生成中", count((item) => mediaBusy(item.imageStatus))],
        ["locked", "已锁定", count((item) => item.locked)],
    ];
    const list = ofKind.filter((item) => {
        if (filter === "failed") return item.imageStatus === "failed";
        if (filter === "busy") return mediaBusy(item.imageStatus);
        if (filter === "locked") return item.locked;
        return true;
    });
    const active = focused && (kind === "look" ? focused.parentId : focused.kind === kind) ? focused : list[0];
    const kindRatio = castRatio(kind === "look" ? "character" : kind, ratios);
    const tabLabel = (value: CastTab) => (value === "look" ? _creationLabel("造型") : _creationLabel(CAST_KIND_LABEL[value]));
    // 导入或外部保存后回填新设定；媒体轮询和锁定状态变化不打断正在输入的表单。
    const activeFormKey = active
        ? JSON.stringify([
              active.id,
              active.name,
              active.lookName,
              active.appearance,
              active.aliasesJson,
              active.voiceInstructions,
              active.imagePrompt,
              active.imageStyleId,
              active.imageStyleName,
              active.imageStylePrompt,
              active.lookFromChapter,
              active.lookToChapter,
          ])
        : "";
    return (
        <div className="drama-view drama-cast-layout">
            <section className="drama-view-main">
                <div className="drama-view-head">
                    <div className="drama-tabs" role="tablist" aria-label={_creationText("creation.abb13611a5fca572")}>
                        {CAST_TABS.map((value) => (
                            <button
                                key={value}
                                type="button"
                                role="tab"
                                className="drama-tab"
                                aria-selected={kind === value}
                                onClick={() => {
                                    setKind(value);
                                    setFilter("all");
                                }}
                            >
                                {tabLabel(value)}
                                <span className="drama-tab-count">{value === "look" ? cast.filter((item) => item.parentId).length : bases.filter((item) => item.kind === value).length}</span>
                            </button>
                        ))}
                    </div>
                    <div className="drama-filters" role="group" aria-label={_creationText("common.filter")}>
                        {filters.map(([key, label, value]) => (
                            <button key={key} type="button" className={`drama-filter ${key === "failed" && value ? "is-alert" : ""}`} aria-pressed={filter === key} onClick={() => setFilter(key)}>
                                {_creationLabel(label)}
                                <b>{value}</b>
                            </button>
                        ))}
                    </div>
                    <div className="drama-cast-toolbar">
                        <Button icon={<Link2 className="size-4" />} onClick={() => setImporting(true)}>
                            {_creationText("creation.2632b5ca05257b30")}
                        </Button>
                        <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
                            {_creationText("creation.fb65ffaaf0cb709d")}
                        </Button>
                    </div>
                    {failed ? (
                        <Button className="!ml-auto" icon={<RotateCcw className="size-4" />} loading={retrying} onClick={onRetry}>
                            {_creationText("creation.d3b272c957bbc419", { value1: failed })}
                        </Button>
                    ) : null}
                </div>
                <div className="drama-view-scroll thin-scrollbar">
                    {assetsPending && cast.some((item) => item.imageStatus === "" || item.imageStatus === "draft") ? (
                        <div className="drama-banner is-ready is-flush">
                            <Clapperboard className="size-5 shrink-0 text-[var(--workspace-accent)]" />
                            <div className="drama-banner-text">
                                <strong>{_creationText("creation.7ae9f813db8d0f0f")}</strong>
                                <span>{_creationText("creation.2d145ad46bff5543")}</span>
                            </div>
                            <Button type="primary" icon={<Play className="size-4" />} loading={releasing} onClick={onReleaseAssets}>
                                {_creationText("creation.3301c5c72d199284")}
                            </Button>
                        </div>
                    ) : null}
                    <div className={`drama-cast-grid ${kindRatio.orientation}`}>
                        {list.map((item) => (
                            <div key={item.id} className="drama-cast-card" aria-current={item.id === active?.id || item.id === active?.parentId}>
                                <button type="button" className="block w-full text-left" aria-label={_creationText("creation.93a2783e87f75289", { value1: item.lookName || item.name })} onClick={() => onFocus(item.id)}>
                                    <div className="drama-cast-card-media" style={kindRatio.style}>
                                        {item.imageResourceId ? <MediaThumb resourceId={item.imageResourceId} alt={item.name} loading={castImageLoading} failed={castImageFailed} /> : null}
                                        {!item.imageResourceId || mediaBusy(item.imageStatus) || item.imageStatus === "failed" || item.imageStatus === "" ? (
                                            <div className={`drama-shot-placeholder ${mediaBusy(item.imageStatus) ? "is-busy" : ""}`}>
                                                {item.imageStatus === "failed" ? (
                                                    <span className="drama-cast-card-failed">
                                                        <AlertCircle className="size-3.5" />
                                                        {_creationText("music.status_failed")}
                                                    </span>
                                                ) : item.imageResourceId ? (
                                                    _creationText("creation.a0bacec44f47968a")
                                                ) : (
                                                    CAST_KIND_ICON[item.kind]
                                                )}
                                            </div>
                                        ) : null}
                                        {item.locked ? (
                                            <span className="drama-shot-flags">
                                                <span className="drama-flag is-lock">
                                                    <Lock className="size-3" />
                                                </span>
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="drama-cast-card-body">
                                        <strong>{item.lookName || item.name}</strong>
                                        <span>
                                            {item.parentId
                                                ? `${cast.find((base) => base.id === item.parentId)?.name || item.name} · ${item.imageStyleName || _creationLabel("沿用作品风格")}`
                                                : item.role || parseList(item.aliasesJson).join("、") || item.description || "—"}
                                        </span>
                                    </div>
                                </button>
                                {item.kind === "character" && !item.parentId && cast.some((look) => look.parentId === item.id) ? (
                                    <div className="drama-cast-look-switcher" role="group" aria-label={_creationText("creation.look.switcherLabel", { name: item.name })}>
                                        {[item, ...cast.filter((look) => look.parentId === item.id)].map((look) => (
                                            <button
                                                type="button"
                                                key={look.id}
                                                aria-label={_creationText("creation.77789e196ec3f561", { value1: look.lookName || _creationText("creation.2ecf1b056bdf801d") })}
                                                title={look.lookName || _creationText("creation.2ecf1b056bdf801d")}
                                                aria-pressed={look.id === active?.id}
                                                onClick={() => onFocus(look.id)}
                                            >
                                                {look.imageResourceId ? <MediaThumb resourceId={look.imageResourceId} alt={look.lookName || _creationText("creation.50ef161256d9798a")} /> : <Shirt className="size-4 opacity-40" />}
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                                {item.kind === "character" && !item.parentId ? (
                                    <div className="px-2 pb-2">
                                        <CastVoicePreview resourceId={item.voiceSampleResourceId} name={item.name} />
                                    </div>
                                ) : null}
                            </div>
                        ))}
                    </div>
                    {!list.length ? (
                        <div className="drama-empty">
                            <UserRound className="size-7" />
                            <span>{ofKind.length ? _creationText("creation.c6d39fdd74dc6351") : kind === "look" ? _creationText("creation.look.empty") : _creationText("creation.8f395dbcb3178688", { value1: _creationLabel(CAST_KIND_LABEL[kind]) })}</span>
                        </div>
                    ) : null}
                </div>
            </section>
            <aside className="drama-view-side thin-scrollbar">
                {active ? (
                    <CastEditor
                        key={activeFormKey}
                        projectId={projectId}
                        cast={active}
                        parent={active.parentId ? cast.find((item) => item.id === active.parentId) : undefined}
                        looks={cast.filter((item) => item.parentId === active.id)}
                        ratios={ratios}
                        onChanged={onChanged}
                        onOpenCanvas={() => onOpenCanvas(active.id)}
                        canvasOpening={canvasOpening === active.id}
                    />
                ) : (
                    <div className="drama-empty is-compact">
                        <span>{_creationText("creation.76e0b8e671117d7e")}</span>
                    </div>
                )}
            </aside>
            {creating ? (
                <CastCreateDialog
                    projectId={projectId}
                    initialKind={kind === "look" ? "character" : kind}
                    onClose={() => setCreating(false)}
                    onCreated={(item) => {
                        setKind(item.kind);
                        onFocus(item.id);
                        onChanged();
                    }}
                />
            ) : null}
            {importing ? <CastProjectImport projectId={projectId} currentCast={cast} onClose={() => setImporting(false)} onImported={onChanged} /> : null}
        </div>
    );
}

function CastEditor({
    projectId,
    cast,
    parent,
    looks,
    ratios,
    onChanged,
    onOpenCanvas,
    canvasOpening,
}: {
    projectId: string;
    cast: DramaCast;
    parent?: DramaCast;
    looks: DramaCast[];
    ratios: CastRatios;
    onChanged: () => void;
    onOpenCanvas: () => void;
    canvasOpening: boolean;
}) {
    _useCreationLocale();
    const { message, modal } = App.useApp();
    const [previewing, setPreviewing] = useState(false);
    const [name, setName] = useState(cast.lookName || cast.name);
    const [aliases, setAliases] = useState(parseList(cast.aliasesJson));
    const [appearance, setAppearance] = useState(cast.appearance);
    const [voiceInstructions, setVoiceInstructions] = useState(cast.voiceInstructions);
    const [imageFields, setImageFields] = useState<CastImageFieldsValue>({ imagePrompt: cast.imagePrompt || "", imageStyleId: cast.imageStyleId || "", imageStyleName: cast.imageStyleName || "", imageStylePrompt: cast.imageStylePrompt || "" });
    const [from, setFrom] = useState<number | null>(cast.lookFromChapter || null);
    const [to, setTo] = useState<number | null>(cast.lookToChapter || null);
    const [restyle, setRestyle] = useState(true);
    const isLook = Boolean(cast.parentId);
    const impactQuery = useQuery({ queryKey: dramaKeys.castImpact(projectId, cast.id), queryFn: ({ signal }) => getDramaCastImpact(projectId, cast.id, signal) });
    const imageDirty = (["imagePrompt", "imageStyleId", "imageStyleName", "imageStylePrompt"] as const).some((key) => (imageFields[key] || "") !== (cast[key] || ""));
    const dirty =
        imageDirty ||
        name !== (cast.lookName || cast.name) ||
        appearance !== cast.appearance ||
        voiceInstructions !== cast.voiceInstructions ||
        aliases.join("|") !== parseList(cast.aliasesJson).join("|") ||
        (isLook && ((from || 0) !== (cast.lookFromChapter || 0) || (to || 0) !== (cast.lookToChapter || 0)));
    const fields = { name, aliases, appearance, voiceInstructions, ...imageFields };
    const saveFields = () => (isLook ? updateDramaCastLook(projectId, cast.id, { lookName: name, appearance, ...imageFields, fromChapter: from || 0, toChapter: to || 0, restyleSegments: restyle }) : updateDramaCast(projectId, cast.id, fields));
    const save = useMutation({
        mutationFn: async () => {
            await saveFields();
        },
        onSuccess: () => {
            message.success(_creationText("creation.1ca65987ba9bb56a"));
            onChanged();
        },
        onError: (error) => message.error(error instanceof Error ? error.message : _creationText("common.save_failed")),
    });
    const lock = useMutation({ mutationFn: (locked: boolean) => updateDramaCast(projectId, cast.id, { locked }), onSuccess: onChanged });
    const regenerate = useMutation({
        mutationFn: async () => {
            if (dirty) await saveFields();
            return regenerateDramaCast(projectId, cast.id, restyle);
        },
        onSuccess: (result) => {
            message.success(result.affectedSegments ? _creationText("creation.eb3d4a93ef0c3e58", { value1: result.affectedSegments }) : _creationText("creation.716da7a97f92262d"));
            onChanged();
        },
        onError: (error) => message.error(error instanceof Error ? error.message : _creationText("creation.0c3b4cf7aa259edb")),
    });
    // 上传或从素材库选的形象图直接成为参考图并锁定：不会被重新生成覆盖，剧情段视频按这张图生成。
    const fileRef = useRef<HTMLInputElement>(null);
    const [libraryOpen, setLibraryOpen] = useState(false);
    const imageAdopted = (result: Awaited<ReturnType<typeof setDramaCastImage>>) => {
        if (result.unchanged) message.info(_creationText("creation.164f9f2456eada1a"));
        else message.success(result.affectedSegments ? _creationText("creation.4bc8654aed260b6f", { value1: result.affectedSegments }) : _creationText("creation.362b68e98062540d"));
        onChanged();
    };
    const upload = useMutation({
        mutationFn: async (file: File) => {
            const resource = await uploadResourceFile(file, "image", { fileName: file.name });
            return setDramaCastImage(projectId, cast.id, resource.id, restyle);
        },
        onSuccess: imageAdopted,
        onError: (error) => message.error(error instanceof Error ? error.message : _creationText("workbench.upload_failed")),
    });
    // 素材库选图的失败由选择弹窗内联显示，这里只处理成功。
    const adoptLibraryImage = async (resourceId: string) => imageAdopted(await setDramaCastImage(projectId, cast.id, resourceId, restyle));
    const impact = impactQuery.data;
    const isCharacter = cast.kind === "character" && !isLook;
    const kindLabel = isLook ? "造型" : CAST_KIND_LABEL[cast.kind];
    const busy = save.isPending || regenerate.isPending || upload.isPending || mediaBusy(cast.imageStatus);
    const parentReady = !isLook || (parent?.imageStatus === "ready" && Boolean(parent.imageResourceId));
    return (
        <div className="drama-editor">
            <div className="drama-cast-hero" style={castRatio(cast.kind, ratios).style}>
                {cast.imageResourceId ? <MediaThumb resourceId={cast.imageResourceId} alt={cast.name} loading={castImageLoading} failed={castImageFailed} /> : null}
                {cast.imageResourceId ? (
                    <button
                        type="button"
                        className="drama-cast-hero-zoom"
                        aria-label={_creationText("creation.e6ec139e5619b480", { value1: cast.lookName || cast.name })}
                        title={_creationText("creation.771c680268c7d738")}
                        onClick={() => setPreviewing(true)}
                    >
                        <span className="drama-cast-hero-zoom-hint" aria-hidden="true">
                            <Maximize2 className="size-3.5" />
                        </span>
                    </button>
                ) : null}
                {!cast.imageResourceId || mediaBusy(cast.imageStatus) || cast.imageStatus === "failed" ? (
                    <div className={`drama-shot-placeholder ${mediaBusy(cast.imageStatus) ? "is-busy" : ""}`}>
                        {cast.imageStatus === "failed" ? (
                            <span className="drama-cast-card-failed">
                                <AlertCircle className="size-4" />
                                {_creationText("creation.97a3666c8b9c2ccd")}
                            </span>
                        ) : mediaBusy(cast.imageStatus) ? (
                            _creationText("creation.faf0e15acbcc4fb3")
                        ) : (
                            _creationText("creation.d53abcb6f23d1e22")
                        )}
                    </div>
                ) : null}
            </div>
            <div className="drama-editor-row">
                <span className="drama-eyebrow">{_creationText("creation.855d1b2cb22a7cb0", { value1: kindLabel })}</span>
                <label className="drama-switch-label">
                    <Lock className="size-3.5" />
                    {_creationText("creation.2f03b0c4244f8c20")}
                    <Switch size="small" checked={cast.locked} loading={lock.isPending} onChange={(checked) => lock.mutate(checked)} />
                </label>
            </div>
            {isLook ? <p className="drama-editor-note">{_creationText("creation.look.parentNote", { name: parent?.name || cast.name })}</p> : null}
            {cast.sourceProjectId ? (
                <p className="drama-editor-note">
                    <Link2 className="inline size-3.5" /> {_creationText("creation.look.linkedProjectNote")}
                </p>
            ) : null}
            <Field label={isLook ? _creationText("creation.52110dc27dc17cb6") : _creationText("creation.d44e9b3d3b31d37b")}>
                <Input value={name} maxLength={60} disabled={busy} onChange={(event) => setName(event.target.value)} aria-label={isLook ? _creationText("creation.52110dc27dc17cb6") : _creationText("creation.d44e9b3d3b31d37b")} />
            </Field>
            {isCharacter ? (
                <Field label={_creationText("creation.65f3f0a1a0d8c522")} hint={_creationText("creation.abe41d97aab8d366")}>
                    <Select
                        mode="tags"
                        className="w-full"
                        value={aliases}
                        onChange={setAliases}
                        tokenSeparators={[",", "，", "、"]}
                        placeholder={_creationText("creation.254fb43985f568b3")}
                        open={false}
                        suffixIcon={null}
                        aria-label={_creationText("creation.65f3f0a1a0d8c522")}
                    />
                </Field>
            ) : null}
            <Field label={_creationLabel(APPEARANCE_LABEL[cast.kind])} hint={_creationText("creation.2b6552dffd47cce8")}>
                <Input.TextArea value={appearance} maxLength={1000} disabled={busy} autoSize={{ minRows: 4, maxRows: 10 }} onChange={(event) => setAppearance(event.target.value)} aria-label={_creationLabel(APPEARANCE_LABEL[cast.kind])} />
            </Field>
            <CastImageFields projectId={projectId} castId={cast.id} appearance={appearance} value={imageFields} disabled={busy} onChange={(patch) => setImageFields((current) => ({ ...current, ...patch }))} />
            {isLook ? (
                <Field label={_creationText("creation.look.chapterRange")} hint={_creationText("creation.look.chapterRangeHint")}>
                    <div className="drama-look-form-range">
                        <InputNumber aria-label={_creationText("creation.0d7a3e72696addf7")} min={0} precision={0} value={from} placeholder={_creationText("creation.0d7a3e72696addf7")} disabled={busy} onChange={setFrom} />
                        <span>{_creationText("creation.65edbf9f1c677e70")}</span>
                        <InputNumber aria-label={_creationText("creation.64ca7b6d0bc78870")} min={0} precision={0} value={to} placeholder={_creationText("creation.64ca7b6d0bc78870")} disabled={busy} onChange={setTo} />
                    </div>
                </Field>
            ) : null}
            {isCharacter ? (
                <Field label={_creationText("creation.53b7be078bbefcf1")} hint={_creationText("creation.279df4f25f8bfecc")}>
                    <Input value={voiceInstructions} placeholder={_creationText("creation.d09d1f813cd82f9e")} onChange={(event) => setVoiceInstructions(event.target.value)} aria-label={_creationText("creation.53b7be078bbefcf1")} />
                </Field>
            ) : null}
            {isCharacter ? (
                <Field label={_creationText("creation.ab2d94db28b7e97c")} hint={_creationText("creation.a0af67be8579e0a9")}>
                    <CastVoiceField projectId={projectId} cast={cast} restyle={restyle} onChanged={onChanged} />
                </Field>
            ) : null}
            {isCharacter ? <CastLooks projectId={projectId} character={cast} looks={looks} restyle={restyle} onChanged={onChanged} /> : null}
            <div className="drama-editor-impact">
                <Checkbox checked={restyle} onChange={(event) => setRestyle(event.target.checked)}>
                    {_creationText("creation.89c9fbb40d0616fe")}
                </Checkbox>
                {impact ? <span>{_creationText("creation.930589baef623377", { value1: impact.episodes, value2: impact.segments })}</span> : null}
            </div>
            <div className="drama-editor-actions">
                <Button disabled={!dirty || busy || !name.trim() || !appearance.trim()} loading={save.isPending} onClick={() => save.mutate()}>
                    {_creationText("creation.8d6347cdac37b628")}
                </Button>
                <Button icon={<Upload className="size-4" />} loading={upload.isPending} onClick={() => fileRef.current?.click()}>
                    {_creationText("creation.0698efef6d10c4de")}
                </Button>
                <Button className="drama-editor-wide" icon={<FolderOpen className="size-4" />} onClick={() => setLibraryOpen(true)}>
                    {_creationText("creation.c76d0fc89f481fdd")}
                </Button>
                {libraryOpen ? <CastLibraryPicker open={libraryOpen} cast={cast} onClose={() => setLibraryOpen(false)} onPick={adoptLibraryImage} /> : null}
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    aria-label={_creationText("creation.383f9609302244fd", { value1: cast.name })}
                    onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) return;
                        if (!file.type.startsWith("image/")) {
                            message.warning(_creationText("creation.96316e8a10485c7d"));
                            return;
                        }
                        if (file.size > 20 * 1024 * 1024) {
                            message.warning(_creationText("creation.97ec82181469f64a"));
                            return;
                        }
                        upload.mutate(file);
                    }}
                />
                <Button
                    type="primary"
                    className="drama-editor-wide"
                    icon={<RefreshCw className="size-4" />}
                    disabled={cast.locked || busy || !parentReady || !name.trim() || !appearance.trim()}
                    title={!parentReady ? _creationText("creation.1d6e01cd275f4db9") : undefined}
                    loading={regenerate.isPending}
                    onClick={() => regenerate.mutate()}
                >
                    {cast.imageResourceId ? (dirty ? _creationText("creation.ba2c1b372a9d8492") : _creationText("workbench.regenerate")) : dirty ? _creationText("creation.331c7d136dcc01a9") : _creationText("creation.7327923f6dbc62b4")}
                </Button>
                <Button className="drama-editor-wide" icon={<Brush className="size-4" />} loading={canvasOpening} onClick={onOpenCanvas}>
                    {_creationText("creation.64422cd9b4ac9f19")}
                </Button>
                {isLook ? (
                    <Button
                        danger
                        className="drama-editor-wide"
                        icon={<Trash2 className="size-4" />}
                        disabled={busy}
                        onClick={() =>
                            modal.confirm({
                                title: _creationText("creation.look.deleteTitle", { name: cast.lookName }),
                                content: _creationText("creation.look.deleteContent"),
                                okText: _creationText("creation.look.deleteConfirm"),
                                cancelText: _creationText("common.cancel"),
                                onOk: async () => {
                                    await deleteDramaCastLook(projectId, cast.id, restyle);
                                    onChanged();
                                },
                            })
                        }
                    >
                        {_creationText("creation.look.deleteConfirm")}
                    </Button>
                ) : null}
            </div>
            <p className="drama-editor-note">{_creationText("creation.08e9304bcb7c8493")}</p>
            <DramaTakeList projectId={projectId} ownerId={cast.id} kind="cast" />
            {previewing && cast.imageResourceId ? (
                <CanvasImagePreview storageKey={`resource:${cast.imageResourceId}`} alt={_creationText("creation.3e17e15a839a5231", { value1: cast.lookName || cast.name, value2: kindLabel })} onClose={() => setPreviewing(false)} />
            ) : null}
        </div>
    );
}

const APPEARANCE_LABEL: Record<DramaCastKind, string> = { character: "外貌描述", prop: "外形描述", scene: "环境描述" };

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
    _useCreationLocale();
    return (
        <div className="drama-field">
            <div className="drama-field-label">
                <span>{_creationLabel(label)}</span>
                {hint ? <small>{hint}</small> : null}
            </div>
            {children}
        </div>
    );
}

// ===== 待处理 =====

type InboxGroup = {
    key: string;
    kind: DramaInboxItem["kind"];
    severity: DramaInboxItem["severity"];
    title: string;
    reason: string;
    items: DramaInboxItem[];
};

const KIND_ORDER: DramaInboxItem["kind"][] = ["paused", "media_ready", "review", "episode_error", "cast_failed", "segment_failed"];
const MEDIA_LABEL: Record<NonNullable<DramaInboxItem["media"]>, string> = { prompt: "提示词", video: "视频" };

/** 同类、同原因的问题折叠成一组：12 个角色同样的失败只占一张卡。 */
function groupInbox(items: DramaInboxItem[]): InboxGroup[] {
    const groups = new Map<string, InboxGroup>();
    for (const item of items) {
        const reason = item.kind === "review" ? "" : item.detail;
        const key = [item.kind, item.castKind || "", item.media || "", reason].join("|");
        const group = groups.get(key);
        if (group) group.items.push(item);
        else groups.set(key, { key, kind: item.kind, severity: item.severity, title: "", reason, items: [item] });
    }
    for (const group of groups.values()) {
        const count = group.items.length;
        const first = group.items[0];
        if (group.kind === "paused") group.title = "制作已暂停";
        else if (group.kind === "media_ready") group.title = first.title;
        else if (group.kind === "review") group.title = count > 1 ? `${count} 集视频提示词等待审阅` : first.title;
        else if (group.kind === "episode_error") group.title = count > 1 ? `${count} 集改编遇到问题` : first.title;
        else if (group.kind === "cast_failed") group.title = `${count} 个${CAST_KIND_LABEL[first.castKind || "character"]}参考图生成失败`;
        else group.title = `${count} 个剧情段${MEDIA_LABEL[first.media || "video"]}生成失败`;
    }
    return [...groups.values()].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || b.items.length - a.items.length);
}

const GROUP_ICON: Record<DramaInboxItem["kind"], ReactNode> = {
    paused: <PauseCircle className="size-[18px]" />,
    media_ready: <PackageCheck className="size-[18px]" />,
    review: <CheckCheck className="size-[18px]" />,
    episode_error: <ScrollText className="size-[18px]" />,
    cast_failed: <UserRound className="size-[18px]" />,
    segment_failed: <Film className="size-[18px]" />,
};

const MEDIA_ICON: Record<NonNullable<DramaInboxItem["media"]>, ReactNode> = {
    prompt: <ScrollText className="size-3" />,
    video: <Film className="size-3" />,
};

const CHIP_LIMIT = 24;

export function InboxPanel({
    items,
    failureCount,
    castById,
    retrying,
    retryingGroup,
    releasing,
    onRetryAll,
    onRetryGroup,
    onOpen,
    onOpenSettings,
    onReleaseAll,
}: {
    items: DramaInboxItem[];
    failureCount?: number;
    castById: Map<string, DramaCast>;
    retrying: boolean;
    retryingGroup: string;
    onRetryAll: () => void;
    onRetryGroup: (key: string, items: DramaInboxItem[]) => void;
    onOpen: (item: DramaInboxItem) => void;
    onOpenSettings: () => void;
    releasing: boolean;
    onReleaseAll: () => void;
}) {
    _useCreationLocale();
    const groups = useMemo(() => groupInbox(items), [items]);
    const listedFailures = items.filter((item) => item.severity === "error").length;
    const failures = failureCount ?? listedFailures;
    const reviews = items.filter((item) => item.kind === "review").length;
    return (
        <div className="drama-view">
            <section className="drama-view-main">
                <div className="drama-view-head">
                    <h2 className="drama-view-title">{_creationText("settings.feedback_status_pending")}</h2>
                    {items.length ? (
                        <div className="drama-inbox-summary">
                            {failures ? (
                                <span className="is-err">
                                    <AlertCircle className="size-3.5" />
                                    {formatDramaInboxCount(failures)}
                                    {_creationText("creation.11301f0dc0cd415b")}
                                </span>
                            ) : null}
                            {reviews ? (
                                <span className="is-info">
                                    <CheckCheck className="size-3.5" />
                                    {reviews}
                                    {_creationText("creation.e8d93af2614e9726")}
                                </span>
                            ) : null}
                            <span>{_creationText("creation.3b0b2528954f27f3", { value1: groups.length })}</span>
                            {failures > listedFailures ? <span>{_creationText("creation.d5d1c10f2945613d")}</span> : null}
                        </div>
                    ) : null}
                    {failures ? (
                        <Button className="!ml-auto" icon={<RotateCcw className="size-4" />} loading={retrying} onClick={onRetryAll}>
                            {_creationText("creation.57e91697264062af")}
                        </Button>
                    ) : null}
                </div>
                <div className="drama-view-scroll thin-scrollbar">
                    {groups.length ? (
                        <div className="drama-inbox">
                            {groups.map((group) => {
                                const retryable = group.kind === "cast_failed" || group.kind === "segment_failed";
                                return (
                                    <article key={group.key} className={`drama-inbox-card is-${group.severity}`}>
                                        <header className="drama-inbox-card-head">
                                            <span className={`drama-inbox-icon is-${group.severity}`}>{GROUP_ICON[group.kind]}</span>
                                            <div className="min-w-0 flex-1">
                                                <h3>{group.title}</h3>
                                                {group.kind === "review" ? (
                                                    <p>{_creationText("creation.ec63b0611e6c15f7")}</p>
                                                ) : group.kind === "cast_failed" ? (
                                                    <p>{_creationText("creation.b9c7823cb9985282")}</p>
                                                ) : group.kind === "media_ready" ? (
                                                    <p>{group.items[0].detail}</p>
                                                ) : null}
                                            </div>
                                            <div className="drama-inbox-card-actions">
                                                {group.kind === "paused" ? (
                                                    <Button size="small" onClick={onOpenSettings}>
                                                        {_creationText("creation.93112c231d6a7c6b")}
                                                    </Button>
                                                ) : null}
                                                {group.kind === "media_ready" ? (
                                                    <Button size="small" type="primary" icon={<Play className="size-3.5" />} loading={releasing} onClick={onReleaseAll}>
                                                        {_creationText("creation.fad1c77d45383acc")}
                                                    </Button>
                                                ) : null}
                                                {retryable ? (
                                                    <Button size="small" icon={<RotateCcw className="size-3.5" />} loading={retryingGroup === group.key} onClick={() => onRetryGroup(group.key, group.items)}>
                                                        {_creationText("common.retry")}
                                                        {group.items.length > 1 ? _creationText("creation.e76a147f7ee93417", { value1: group.items.length }) : ""}
                                                    </Button>
                                                ) : null}
                                                {group.items.length === 1 && group.kind !== "paused" && group.kind !== "media_ready" ? (
                                                    <Button size="small" type={group.kind === "review" ? "primary" : "default"} onClick={() => onOpen(group.items[0])}>
                                                        {group.kind === "review" ? _creationText("creation.fffa3770d4a69a57") : _creationText("projects.view")}
                                                        <ArrowRight className="size-3.5" />
                                                    </Button>
                                                ) : null}
                                            </div>
                                        </header>
                                        {group.reason && group.kind !== "media_ready" ? (
                                            <div className="drama-inbox-reason" title={group.reason}>
                                                <span>{_creationText("creation.f029d9cb4a7614ef")}</span>
                                                <code>{group.reason}</code>
                                            </div>
                                        ) : null}
                                        {group.items.length > 1 || group.kind === "cast_failed" ? (
                                            <div className="drama-inbox-chips">
                                                {group.items.slice(0, CHIP_LIMIT).map((item) => (
                                                    <InboxChip key={item.id} item={item} cast={item.castId ? castById.get(item.castId) : undefined} onOpen={onOpen} />
                                                ))}
                                                {group.items.length > CHIP_LIMIT ? <span className="drama-inbox-more">{_creationText("creation.1404aaa7bbff9c58", { value1: group.items.length - CHIP_LIMIT })}</span> : null}
                                            </div>
                                        ) : null}
                                    </article>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="drama-empty is-tall">
                            <Inbox className="size-8" />
                            <strong>{_creationText("creation.f00400ffc98ef3fc")}</strong>
                            <span>{_creationText("creation.b6b6ae0bb048898b")}</span>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}

function InboxChip({ item, cast, onOpen }: { item: DramaInboxItem; cast?: DramaCast; onOpen: (item: DramaInboxItem) => void }) {
    _useCreationLocale();
    let content: ReactNode;
    if (item.kind === "cast_failed") {
        content = (
            <>
                <span className="drama-avatar">{cast?.imageResourceId ? <MediaThumb resourceId={cast.imageResourceId} alt="" /> : item.title.slice(0, 1)}</span>
                {item.title}
            </>
        );
    } else if (item.kind === "segment_failed") {
        content = (
            <>
                {item.media ? MEDIA_ICON[item.media] : null}
                {_creationText("creation.af50a0fe2a50a3d1")}
                {item.episodeNumber}
                {_creationText("creation.355a2c8cd7808a99")}
                {item.segmentIndex + 1}
                {_creationText("creation.0477dbbdee99b5b3")}
            </>
        );
    } else if (item.kind === "review") {
        content = (
            <>
                <Clapperboard className="size-3" />
                {item.title}
            </>
        );
    } else {
        content = item.title;
    }
    return (
        <button type="button" className={`drama-inbox-chip ${item.kind === "cast_failed" ? "has-avatar" : ""}`} title={item.detail} onClick={() => onOpen(item)}>
            {content}
        </button>
    );
}

// ===== 制作设置 =====

const CAPABILITY_META: Record<DramaCapability, { label: string; hint: string }> = {
    text: { label: "默认文本", hint: "分集规划，及没有单独指定模型的文字步骤" },
    image: { label: "默认图片", hint: "没有单独指定模型的参考图" },
    video: { label: "剧情段视频", hint: "每段一个带对白与音效的视频，可按段换模型" },
};
const REVIEW_LABEL: Record<DramaReviewMode, { title: string; detail: string }> = {
    sample: { title: "先看样片", detail: "第 1 集成片确认后继续其余集" },
    every: { title: "每集确认", detail: "每集生成视频前停下来审阅段视频提示词" },
    auto: { title: "全自动", detail: "不打断，直接跑到成片" },
};
const CONCURRENCY = [2, 4, 6, 8, 12, 16];

export function SettingsPanel({ projectId, summary, cast, onChanged }: { projectId: string; summary: DramaSummary; cast: DramaCast[]; onChanged: () => void }) {
    _useCreationLocale();
    const { message, modal } = App.useApp();
    const current = summary.production.settings;
    const [settings, setSettings] = useState(current);
    const [budget, setBudget] = useState(summary.production.budgetMicrocredits / 1_000_000);
    useEffect(() => {
        setSettings(summary.production.settings);
        setBudget(summary.production.budgetMicrocredits / 1_000_000);
    }, [summary.production.settings, summary.production.budgetMicrocredits]);
    const dirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(current) || Math.round(budget * 1_000_000) !== summary.production.budgetMicrocredits, [budget, current, settings, summary.production.budgetMicrocredits]);
    const save = useMutation({
        mutationFn: () => updateDramaSettings(projectId, { settings, budgetMicrocredits: Math.max(0, Math.round((budget || 0) * 1_000_000)) }),
        onSuccess: () => {
            message.success(_creationText("creation.f42f813a44bff987"));
            onChanged();
        },
        onError: (error) => message.error(error instanceof Error ? error.message : _creationText("common.save_failed")),
    });
    const [restyleSegments, setRestyleSegments] = useState(true);
    const regenerateAll = useMutation({
        mutationFn: (kind: DramaCastKind) => regenerateDramaCasts(projectId, kind, restyleSegments),
        onSuccess: (result, kind) => {
            message.success(
                _creationText("creation.c85e1b45ce28bf95", {
                    value1: result.queued,
                    value2: CAST_KIND_LABEL[kind],
                    value3: result.skipped ? _creationText("creation.b65aec57e06c4fc6", { value1: result.skipped }) : "",
                    value4: result.affectedSegments ? _creationText("creation.1a7e3387eb6cb5e6", { value1: result.affectedSegments }) : "",
                }),
            );
            onChanged();
        },
        onError: (error) => message.error(error instanceof Error ? error.message : _creationText("creation.0c3b4cf7aa259edb")),
    });
    const catalogQuery = useDramaModelCatalog();
    const videoOptionFor = (choice?: DramaModelChoice) => catalogQuery.data?.options.video?.find((option) => dramaChoiceKey(option.choice) === dramaChoiceKey(choice));
    const videoOption = videoOptionFor(settings.models.video);
    // 角色参考图用单独指定的模型，没有就用默认图片模型；参考图方案按它检查角色画幅。
    const characterImage = dramaChoiceKey(settings.models.characterImage) ? settings.models.characterImage : settings.models.image;
    const imageOption = catalogQuery.data?.options.image?.find((option) => dramaChoiceKey(option.choice) === dramaChoiceKey(characterImage));
    const videoRatioProblem = dramaVideoRatioIssue(videoOption, current.aspectRatio);
    const videoResolutionProblem = dramaVideoResolutionIssue(videoOption, settings.videoResolution);
    const setModels = (patch: Partial<DramaSettings["models"]>) => setSettings({ ...settings, models: { ...settings.models, ...patch } });
    const setModelChoice = (capability: DramaCapability, choice: DramaModelChoice) => {
        if (capability !== "video") {
            setModels({ [capability]: choice });
            return;
        }
        // 视频模型与分辨率一起更新：新模型支持就保留，不支持就清空，按新模型默认档出片。
        const next = videoOptionFor(choice);
        setSettings({ ...settings, models: { ...settings.models, video: choice }, ...(next ? { videoResolution: dramaResolutionAfterModelChange(next, settings.videoResolution) } : {}) });
    };
    const continuity: DramaVideoContinuity = settings.videoContinuity || "tail_frame";
    const sampleCharacter = cast.find((item) => item.kind === "character" && item.appearance);
    const sampleScene = cast.find((item) => item.kind === "scene" && item.appearance);
    const countOf = (kind: DramaCastKind) => cast.filter((item) => item.kind === kind).length;
    const spent = summary.production.spentMicrocredits;
    const held = summary.production.heldMicrocredits || 0;
    const budgetMicro = Math.round((budget || 0) * 1_000_000);
    // 预算占用与后端判断同一口径：已扣费加冻结中的订单。
    const usage = budgetMicro > 0 ? Math.min(1, (spent + held) / budgetMicro) : 0;
    return (
        <div className="drama-view">
            <section className="drama-view-main">
                <div className="drama-view-head">
                    <h2 className="drama-view-title">{_creationText("creation.ebdce5c268341e78")}</h2>
                    <span className="drama-view-sub">{dirty ? _creationText("creation.c2277872cdcec9e0") : _creationText("creation.92033cc506709923")}</span>
                    <div className="ml-auto flex gap-2">
                        <Button
                            disabled={!dirty}
                            onClick={() => {
                                setSettings(current);
                                setBudget(summary.production.budgetMicrocredits / 1_000_000);
                            }}
                        >
                            {_creationText("creation.ddde08946298195d")}
                        </Button>
                        <Button type="primary" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>
                            {_creationText("creation.c8550237ba701f64")}
                        </Button>
                    </div>
                </div>
                <div className="drama-view-scroll thin-scrollbar">
                    <div className="drama-cfg">
                        <div className="drama-cfg-main">
                            <EpisodeModeCard summary={summary} settings={settings} onChange={(patch) => setSettings({ ...settings, ...patch })} />
                            <section className="drama-cfg-card">
                                <SettingsTitle title={_creationText("creation.cff64d1df754bb51")} detail={_creationText("creation.94adfce0fb793871")} icon={<Clapperboard className="size-4" />} />
                                <StoryboardRules
                                    value={settings.storyboard}
                                    onChange={(storyboard) => setSettings({ ...settings, storyboard })}
                                    episodeSeconds={settings.episodeSeconds}
                                    onEpisodeSecondsChange={(episodeSeconds) => setSettings({ ...settings, episodeSeconds })}
                                    maxVideoSeconds={videoOption?.maxVideoSeconds}
                                    videoModelLabel={settings.models.video?.label}
                                    bare
                                />
                            </section>
                            <section className="drama-cfg-card">
                                <SettingsTitle title={_creationText("creation.f074a508d31551f1")} detail={_creationText("creation.53479b16e74ae0f0")} icon={<ScrollText className="size-4" />} />
                                <DramaTextSteps
                                    models={settings.models}
                                    onModelsChange={setModels}
                                    skills={{ bible: settings.bibleSkill, script: settings.scriptSkill, prompt: settings.promptSkill }}
                                    onSkillChange={(step, value) => setSettings({ ...settings, [step === "bible" ? "bibleSkill" : step === "script" ? "scriptSkill" : "promptSkill"]: value })}
                                    textThinking={settings.textThinking || {}}
                                    onThinkingChange={(step, level) => setSettings({ ...settings, textThinking: { ...settings.textThinking, [step]: level === "auto" ? undefined : level } as DramaTextThinking })}
                                />
                            </section>
                            <section className="drama-cfg-card">
                                <SettingsTitle title={_creationText("workbench.ref_image_short")} detail={_creationText("creation.9a41d8cdac1b275f")} icon={<UsersRound className="size-4" />} />
                                <DramaAssetImageModels models={settings.models} onModelsChange={setModels} assets={settings.assets} onAssetsChange={(assets) => setSettings({ ...settings, assets })} />
                                <AssetSchemePicker
                                    value={settings.assets}
                                    onChange={(assets) => setSettings({ ...settings, assets })}
                                    sample={{ style: settings.stylePrompt, characterName: sampleCharacter?.name, characterAppearance: sampleCharacter?.appearance, sceneName: sampleScene?.name, sceneAppearance: sampleScene?.appearance }}
                                    imageModel={imageOption}
                                />
                                <div className="drama-settings-regen">
                                    <div>
                                        <strong>{_creationText("creation.569ea8a53600cee6")}</strong>
                                        <span>
                                            {CAST_KINDS.map((kind) => `${countOf(kind)} 个${CAST_KIND_LABEL[kind]}`).join(" · ")}
                                            {_creationText("creation.46875ba1878920dd")}
                                            {dirty ? _creationText("creation.4787b74531850e81") : ""}
                                        </span>
                                    </div>
                                    <Checkbox checked={restyleSegments} onChange={(event) => setRestyleSegments(event.target.checked)}>
                                        {_creationText("creation.d330e64ec1e2dbee")}
                                    </Checkbox>
                                    {CAST_KINDS.map((kind) => (
                                        <Button
                                            key={kind}
                                            disabled={dirty || !countOf(kind)}
                                            loading={regenerateAll.isPending && regenerateAll.variables === kind}
                                            onClick={() =>
                                                modal.confirm({
                                                    title: `按当前方案重做 ${countOf(kind)} 个${CAST_KIND_LABEL[kind]}参考图？`,
                                                    content: `每张参考图都会重新生成并计费${restyleSegments ? "，引用它们且已生成的剧情段视频需要重新生成" : ""}。旧版本保留在版本记录中。`,
                                                    okText: "开始重做",
                                                    cancelText: "取消",
                                                    centered: true,
                                                    onOk: () => regenerateAll.mutateAsync(kind),
                                                })
                                            }
                                        >
                                            {_creationText("creation.b94053f10124b226", { value1: CAST_KIND_LABEL[kind] })}
                                        </Button>
                                    ))}
                                </div>
                            </section>
                            <section className="drama-cfg-card">
                                <SettingsTitle title={_creationText("creation.3909481ae334f9fd")} detail={_creationText("creation.99d61ed946b573c8")} icon={<Cpu className="size-4" />} />
                                <div className="drama-cfg-models">
                                    {(Object.keys(CAPABILITY_META) as DramaCapability[]).map((capability) => (
                                        <div key={capability} className="drama-cfg-model">
                                            <div className="drama-cfg-model-label">
                                                <strong>{_creationLabel(CAPABILITY_META[capability].label)}</strong>
                                                <small>{CAPABILITY_META[capability].hint}</small>
                                            </div>
                                            <DramaModelPicker
                                                capability={capability}
                                                value={settings.models[capability]}
                                                aspectRatio={current.aspectRatio}
                                                videoResolution={settings.videoResolution}
                                                placeholder={_creationText("creation.d6e0385d73f38b9b", { value1: CAPABILITY_META[capability].label })}
                                                onChange={(choice) => setModelChoice(capability, choice)}
                                            />
                                        </div>
                                    ))}
                                    <div className="drama-cfg-model">
                                        <div className="drama-cfg-model-label">
                                            <strong>{_creationText("creation.458920ec58f79783")}</strong>
                                            <small>{_creationText("creation.633af44b4f6f7b9c")}</small>
                                        </div>
                                        <VideoResolutionField option={videoOption} value={settings.videoResolution} onChange={(videoResolution) => setSettings({ ...settings, videoResolution })} />
                                    </div>
                                </div>
                                {videoRatioProblem ? <p className="drama-cfg-note">{_creationText("creation.acd26c3d800d911c", { value1: videoRatioProblem })}</p> : null}
                                {videoOption?.generateAudio === false ? <p className="drama-cfg-note">{_creationText("creation.7675c15706918653")}</p> : null}
                                {videoResolutionProblem ? (
                                    <p className="drama-cfg-note">
                                        {_creationText("creation.drama.videoResolutionFallback", {
                                            problem: videoResolutionProblem,
                                            resolution: videoOption?.defaultVideoResolution ? formatVideoResolutionLabel(videoOption.defaultVideoResolution) : _creationText("creation.drama.modelDefaultResolution"),
                                        })}
                                    </p>
                                ) : null}
                            </section>
                        </div>
                        <aside className="drama-cfg-side">
                            <section className="drama-cfg-card">
                                <SettingsTitle title={_creationText("creation.37a3a796866b0433")} detail={_creationText("creation.87b903a2d82f44a0")} />
                                <dl className="drama-cfg-kv">
                                    <div>
                                        <dt>{_creationText("creation.9b7a0bf8b5258a13")}</dt>
                                        <dd>{current.aspectRatio}</dd>
                                    </div>
                                    <div>
                                        <dt>{_creationText("creation.106de8b95d0277cb")}</dt>
                                        <dd title={current.styleName}>{current.styleName || "—"}</dd>
                                    </div>
                                    <div>
                                        <dt>{_creationText("creation.f195d8a2459126bc")}</dt>
                                        <dd>{current.language}</dd>
                                    </div>
                                </dl>
                            </section>
                            <section className="drama-cfg-card">
                                <SettingsTitle title={_creationText("projects.review_mode")} detail={_creationText("creation.abf9efda2936ce45")} />
                                <CompactRadios
                                    label={_creationText("projects.review_mode")}
                                    value={settings.reviewMode}
                                    options={_creationOptions((Object.keys(REVIEW_LABEL) as DramaReviewMode[]).map((mode) => ({ value: mode, ...REVIEW_LABEL[mode] })))}
                                    onChange={(reviewMode) => setSettings({ ...settings, reviewMode })}
                                />
                            </section>
                            <section className="drama-cfg-card">
                                <SettingsTitle
                                    title={_creationText("projects.generation_pacing")}
                                    detail={settings.mediaMode === "manual" ? _creationText("creation.9b6db063239479bf", { value1: summary.episodes.filter((episode) => episode.awaitingMedia).length }) : undefined}
                                />
                                <CompactRadios
                                    label={_creationText("projects.generation_pacing")}
                                    value={settings.mediaMode}
                                    options={_creationOptions((Object.keys(MEDIA_MODE_LABEL) as DramaMediaMode[]).map((mode) => ({ value: mode, ...MEDIA_MODE_LABEL[mode] })))}
                                    onChange={(mediaMode) => setSettings({ ...settings, mediaMode })}
                                />
                                {settings.mediaMode !== current.mediaMode && settings.mediaMode === "manual" ? <p className="drama-cfg-note">{_creationText("creation.dc0f4ef322c93333")}</p> : null}
                            </section>
                            <section className="drama-cfg-card">
                                <SettingsTitle title={_creationText("creation.3656248ae83b8212")} detail={_creationText("creation.f2c46b9045e657e7")} />
                                <CompactRadios
                                    label={_creationText("creation.3656248ae83b8212")}
                                    value={continuity}
                                    options={_creationOptions((Object.keys(VIDEO_CONTINUITY_LABEL) as DramaVideoContinuity[]).map((mode) => ({ value: mode, ...VIDEO_CONTINUITY_LABEL[mode] })))}
                                    onChange={(videoContinuity) => setSettings({ ...settings, videoContinuity })}
                                />
                                {continuity === "tail_frame" && videoOption && !videoOption.tailFrameChain ? <p className="drama-cfg-note">{_creationText("creation.73ae5805a664da63")}</p> : null}
                                {continuity !== (current.videoContinuity || "tail_frame") ? <p className="drama-cfg-note">{_creationText("creation.f908ad23bb533e84")}</p> : null}
                            </section>
                            <section className="drama-cfg-card">
                                <SettingsTitle title={_creationText("creation.122ea1aa134cfad3")} detail={_creationText("creation.799e06fc7f30696e")} />
                                <div className="drama-tabs drama-cfg-seg" role="radiogroup" aria-label={_creationText("creation.122ea1aa134cfad3")}>
                                    {CONCURRENCY.map((value) => (
                                        <button key={value} type="button" role="radio" className="drama-tab" aria-checked={settings.concurrency === value} onClick={() => setSettings({ ...settings, concurrency: value })}>
                                            {value}
                                        </button>
                                    ))}
                                </div>
                            </section>
                            <section className="drama-cfg-card">
                                <SettingsTitle title={_creationText("creation.441c04f4f2ba2358")} detail={_creationText("creation.8d8d4a761c64d2ca")} />
                                <InputNumber
                                    className="!w-full"
                                    min={0}
                                    max={20}
                                    precision={0}
                                    value={settings.referenceLimit || 0}
                                    onChange={(value) => setSettings({ ...settings, referenceLimit: value || 0 })}
                                    suffix="张"
                                    aria-label={_creationText("creation.441c04f4f2ba2358")}
                                />
                                <p className="drama-cfg-note">{_creationText("creation.717116c8bb4cb83e")}</p>
                            </section>
                            <section className="drama-cfg-card">
                                <SettingsTitle title={_creationText("projects.budget_cap")} detail={_creationText("creation.07e438b0c255f5d2")} />
                                <InputNumber className="!w-full" min={0} precision={0} value={budget} onChange={(value) => setBudget(value || 0)} suffix="积分" aria-label={_creationText("projects.budget_cap")} />
                                <div className="drama-budget-meter">
                                    <div className="drama-budget-track">
                                        <span className={usage >= 0.9 ? "is-warn" : ""} style={progressFillStyle(budgetMicro ? Math.max(usage * 100, spent + held ? 2 : 0) : 0)} />
                                    </div>
                                    <span>
                                        {_creationText("creation.c84b431ed39c4a70")}
                                        <b>{formatCredits(spent)}</b>
                                        {held > 0 ? _creationText("creation.9ef5e9f7cf16e542", { value1: formatCredits(held) }) : ""}
                                        {budgetMicro ? ` / ${formatCredits(budgetMicro)}` : _creationText("creation.edb850356eb73e6b")}
                                    </span>
                                </div>
                                {summary.production.canvasSpentMicrocredits > 0 ? (
                                    <p className="drama-cfg-note">
                                        {_creationText("creation.558545b54e8c85f5", { value1: formatCredits(Math.max(0, spent - summary.production.canvasSpentMicrocredits)), value2: formatCredits(summary.production.canvasSpentMicrocredits) })}
                                    </p>
                                ) : null}
                            </section>
                        </aside>
                    </div>
                </div>
            </section>
        </div>
    );
}

const EPISODE_MODE_OPTIONS: Array<{ value: DramaEpisodeMode; title: string; detail: string }> = [
    { value: "chapter", title: "按章分集", detail: "按章节顺序固定分集，每 N 章一集" },
    { value: "auto", title: "模型自动分集", detail: "按剧情把章节规划成集，可合并或拆分章节" },
];

/**
 * 分集方式：只影响还没分集的章节。分集完成后已有的集可能写好了剧本，不再重新分组，
 * 之后用“逐集追加”继续；剧本与分镜作品总是每章一集。
 */
function EpisodeModeCard({ summary, settings, onChange }: { summary: DramaSummary; settings: DramaSettings; onChange: (patch: Pick<DramaSettings, "episodeMode" | "chaptersPerEpisode">) => void }) {
    _useCreationLocale();
    const { production, episodes } = summary;
    const novel = (summary.project.sourceType || "novel") === "novel";
    const editable = novel && !production.planDone;
    const mode = settings.episodeMode || (production.planDone ? undefined : "auto");
    const perEpisode = settings.chaptersPerEpisode || 1;
    const current = !novel ? "每章一集（剧本与分镜按标题分集）" : settings.episodeMode === "chapter" ? (perEpisode > 1 ? `按章分集 · 每 ${perEpisode} 章一集` : "按章分集 · 每章一集") : settings.episodeMode === "auto" ? "模型自动分集" : "已分集";
    return (
        <section className="drama-cfg-card">
            <SettingsTitle title={_creationText("projects.drama_episode_split")} detail={editable ? _creationText("creation.9d9edbf21cfccf5b") : _creationText("creation.65c687c0b965cda9")} icon={<Film className="size-4" />} />
            {editable ? (
                <div className="grid gap-3">
                    <CompactRadios
                        label={_creationText("projects.drama_episode_split")}
                        value={mode || "auto"}
                        options={_creationOptions(EPISODE_MODE_OPTIONS)}
                        onChange={(value) => onChange({ episodeMode: value, chaptersPerEpisode: value === "chapter" ? perEpisode : undefined })}
                    />
                    {mode === "chapter" ? <EpisodeGroupField value={perEpisode} onChange={(value) => onChange({ episodeMode: "chapter", chaptersPerEpisode: value })} chapterCount={Math.max(0, production.chapterCount - production.planCursor)} /> : null}
                    {production.planCursor > 0 ? <p className="drama-cfg-note">{_creationText("creation.751c882829f8a6ba", { value1: production.planCursor, value2: episodes.length })}</p> : null}
                </div>
            ) : (
                <p className="drama-cfg-note">{_creationText("creation.0f73932d3912e9c3", { value1: current, value2: production.chapterCount, value3: episodes.length })}</p>
            )}
        </section>
    );
}

/** 侧栏里的紧凑单选列表：一行标题，说明作为次要文字，选中态只改边框和底色。 */
function CompactRadios<V extends string>({ label, value, options, onChange }: { label: string; value: V; options: Array<{ value: V; title: string; detail: string }>; onChange: (value: V) => void }) {
    _useCreationLocale();
    return (
        <div className="drama-cfg-radios" role="radiogroup" aria-label={label}>
            {options.map((option) => (
                <button key={option.value} type="button" role="radio" aria-checked={value === option.value} className="drama-cfg-radio" onClick={() => onChange(option.value)}>
                    <span className="drama-radio" aria-hidden />
                    <span className="min-w-0">
                        <strong>{option.title}</strong>
                        <small>{option.detail}</small>
                    </span>
                </button>
            ))}
        </div>
    );
}

function SettingsTitle({ title, detail, icon }: { title: string; detail?: string; icon?: ReactNode }) {
    _useCreationLocale();
    return (
        <div className="drama-settings-title">
            <h3>
                {icon}
                {title}
            </h3>
            {detail ? <span>{detail}</span> : null}
        </div>
    );
}

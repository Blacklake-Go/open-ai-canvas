import { creationLabel as _creationLabel, creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { useRef, useState, type ReactNode } from "react";
import { App, Button, Input, Popover } from "antd";
import { ArrowDown, ArrowUp, Check, Library, Plus, RotateCcw, Search, Trash2, Upload, ZoomIn } from "lucide-react";

import { CanvasImagePreview } from "@/components/canvas/canvas-image-preview";
import type { DramaCast, DramaSegment, DramaSegmentReferencePatch, DramaShot } from "@/services/api/drama";
import { uploadResourceFile } from "@/services/api/resources";
import { MediaThumb, parseList } from "../drama-shared";
import { CastLibraryPicker } from "./cast-library-picker";
import { CastVoicePreview } from "./cast-voice";
import { referenceMissingReason } from "./segment-parts";

const ASSET_KINDS = ["character", "scene", "prop"] as const;
const KIND_LABEL = { character: "人物", scene: "场景", prop: "道具", image: "附加图片" };
type AssetKind = keyof typeof KIND_LABEL;
type Reference = DramaSegment["request"]["references"][number];

function moved<T>(items: T[], from: number, to: number) {
    const result = [...items];
    const [item] = result.splice(from, 1);
    result.splice(to, 0, item);
    return result;
}

function castName(cast: DramaCast) {
    return `${cast.name}${cast.lookName ? ` · ${cast.lookName}` : ""}`;
}

/** 分组只改变展示；保存的 ID 顺序仍是提示词编号和模型发送顺序。 */
export function ReferenceBoard({
    segment,
    shots,
    castById,
    busy: saving,
    onSave,
    onOpenCast,
}: {
    segment: DramaSegment;
    shots: DramaShot[];
    castById: Map<string, DramaCast>;
    busy: boolean;
    onSave: (patch: DramaSegmentReferencePatch) => Promise<unknown>;
    onOpenCast: (id: string) => void;
}) {
    _useCreationLocale();
    const { message } = App.useApp();
    const [menuOpen, setMenuOpen] = useState(false);
    const [libraryOpen, setLibraryOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [voiceDraft, setVoiceDraft] = useState<string[] | null>(null);
    const [preview, setPreview] = useState<{ resourceId: string; name: string }>();
    const fileRef = useRef<HTMLInputElement>(null);
    const busy = saving || uploading;
    const openPreview = (image: { resourceId: string; name: string }) => {
        setMenuOpen(false);
        setPreview(image);
    };
    const { request } = segment;
    const ids = request.references.filter((ref) => ref.castId).map((ref) => ref.castId);
    const images = request.references.filter((ref) => !ref.castId && ref.resourceId).map((ref) => ({ resourceId: ref.resourceId!, name: ref.name }));
    const refsById = new Map(request.references.filter((ref) => ref.castId).map((ref) => [ref.castId, ref]));
    const selectedVoices = voiceDraft ?? (request.audioReferences || []).map((voice) => voice.castId);
    const audioLimit = request.modelMaxAudios || 0;
    const save = (patch: DramaSegmentReferencePatch) => {
        // 父层 mutation 显示错误；失败后保留服务端选择和本地尚未保存的音色。
        void onSave(patch).catch(() => {});
    };
    const saveIDs = (next: string[]) => save({ referenceCastIds: next });
    const toggleCast = (cast: DramaCast) => {
        if (ids.includes(cast.id)) saveIDs(ids.filter((id) => id !== cast.id));
        else {
            const last = ids.findLastIndex((id) => castById.get(id)?.kind === cast.kind);
            const next = [...ids];
            next.splice(last < 0 ? next.length : last + 1, 0, cast.id);
            saveIDs(next);
        }
    };
    const addImage = async (resourceId: string, name: string) => {
        if (request.references.some((ref) => ref.resourceId === resourceId)) {
            message.info(_creationText("creation.0dec0ba0aa9a36c8"));
            return;
        }
        await onSave({ referenceImages: [...images, { resourceId, name }] });
    };
    const upload = async (file: File) => {
        if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) {
            message.error(_creationText("creation.b184df5bf195296f"));
            return;
        }
        setUploading(true);
        try {
            const resource = await uploadResourceFile(file, "image", { fileName: file.name });
            await addImage(resource.id, file.name.replace(/\.[^.]+$/, ""));
        } catch (error) {
            message.error(error instanceof Error ? error.message : _creationText("creation.a169bd9ab2c226f0"));
        } finally {
            setUploading(false);
        }
    };

    const activeKinds = [...new Set(ids.map((id) => castById.get(id)?.kind).filter((kind): kind is DramaCast["kind"] => Boolean(kind)))];
    const groupOrder = [...activeKinds, ...ASSET_KINDS.filter((kind) => !activeKinds.includes(kind))];
    const groupedIDs = (kind: DramaCast["kind"]) => ids.filter((id) => castById.get(id)?.kind === kind);
    const moveGroup = (kind: DramaCast["kind"], direction: number) => {
        const index = activeKinds.indexOf(kind);
        saveIDs(moved(activeKinds, index, index + direction).flatMap(groupedIDs));
    };
    const moveCast = (cast: DramaCast, direction: number) => {
        const group = groupedIDs(cast.kind);
        const reordered = moved(group, group.indexOf(cast.id), group.indexOf(cast.id) + direction);
        saveIDs(activeKinds.flatMap((kind) => (kind === cast.kind ? reordered : groupedIDs(kind))));
    };

    const visible = new Set(ids);
    for (const shot of shots) {
        for (const id of [...parseList(shot.castIdsJson), ...parseList(shot.lookCastIdsJson), ...parseList(shot.propIdsJson), shot.sceneCastId || ""]) {
            if (id) visible.add(id);
        }
    }
    // 没选参考图的说话人仍需保留人物卡，让音色可以独立关闭。
    for (const id of new Set([...selectedVoices, ...(request.audioReferences || []).map((voice) => voice.castId)])) {
        if (!ids.some((castId) => (castById.get(castId)?.parentId || castId) === id)) visible.add(id);
    }
    for (const id of visible) {
        const parentId = castById.get(id)?.parentId;
        if (parentId && !ids.includes(parentId)) visible.delete(parentId);
    }
    const voiceControls = (cast: DramaCast) => {
        const character = cast.parentId ? castById.get(cast.parentId) : cast;
        if (!character || character.kind !== "character") return null;
        const selected = selectedVoices.includes(character.id);
        const audio = request.audioReferences?.find((voice) => voice.castId === character.id);
        return (
            <div className="drama-sdx-asset-voice" aria-label={_creationText("creation.a5e06f590054761b", { value1: character.name })}>
                <button
                    type="button"
                    aria-pressed={selected}
                    aria-label={_creationText(selected ? "creation.42954cad80a772c4" : "creation.f9f002b979231e25", { value1: character.name })}
                    disabled={busy || (!selected && (!character.voiceSampleResourceId || selectedVoices.length >= audioLimit))}
                    onClick={() => setVoiceDraft(selected ? selectedVoices.filter((id) => id !== character.id) : [...selectedVoices, character.id])}
                >
                    {selected ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
                    {_creationText("creation.6ab9d2bde92cea4a")}
                    {selected ? _creationText("creation.8a4ef3e48e4e8a5a") : _creationText("creation.6744b4c6a9aa0038")}
                </button>
                <CastVoicePreview resourceId={character.voiceSampleResourceId} name={character.name} />
                <small>
                    {voiceDraft !== null
                        ? _creationText("creation.192a61bb15de9958")
                        : audio
                          ? audio.sent
                              ? _creationText("creation.b3e013f485bd9008", { value1: audio.label })
                              : audio.note
                          : !character.voiceSampleResourceId
                            ? _creationText("creation.001bc873992fb6d5")
                            : cast.parentId
                              ? _creationText("creation.98e80988b76384df")
                              : ""}
                </small>
            </div>
        );
    };
    const renderCast = (cast: DramaCast) => {
        const ref = refsById.get(cast.id);
        const group = groupedIDs(cast.kind);
        const index = group.indexOf(cast.id);
        return (
            <AssetCard
                key={cast.id}
                name={castName(cast)}
                kind={_creationLabel(KIND_LABEL[cast.kind])}
                resourceId={ref?.resourceId || cast.imageResourceId}
                badge={ref?.label}
                checked={Boolean(ref)}
                disabled={busy}
                note={ref ? (ref.sent ? "随请求发送" : `未附图：${referenceMissingReason(segment, cast, ref.resourceId)}`) : "未选用参考图"}
                onToggle={() => toggleCast(cast)}
                onOpen={() => onOpenCast(cast.id)}
                onPreview={openPreview}
                onRaise={index > 0 ? () => moveCast(cast, -1) : undefined}
                onLower={index >= 0 && index < group.length - 1 ? () => moveCast(cast, 1) : undefined}
            >
                {voiceControls(cast)}
            </AssetCard>
        );
    };
    const renderImage = (ref: Reference) => {
        const index = images.findIndex((image) => image.resourceId === ref.resourceId);
        return (
            <AssetCard
                key={ref.resourceId}
                name={ref.name}
                kind={KIND_LABEL.image}
                resourceId={ref.resourceId}
                badge={ref.label}
                checked
                disabled={busy}
                note={ref.sent ? "随请求发送" : `未附图：${referenceMissingReason(segment, undefined, ref.resourceId)}`}
                onToggle={() => save({ referenceImages: images.filter((image) => image.resourceId !== ref.resourceId) })}
                onPreview={openPreview}
                onRaise={index > 0 ? () => save({ referenceImages: moved(images, index, index - 1) }) : undefined}
                onLower={index < images.length - 1 ? () => save({ referenceImages: moved(images, index, index + 1) }) : undefined}
            />
        );
    };
    const first = segment.index === 0 && !request.firstFrameResourceId && !request.firstFramePending;
    const voiceActions = (
        <>
            {segment.audioReferenceMode === "custom" ? (
                <Button size="small" type="text" disabled={busy || voiceDraft !== null} onClick={() => save({ autoAudioReferences: true })}>
                    {_creationText("creation.7af74e1b84a858bf")}
                </Button>
            ) : null}
            {voiceDraft !== null ? (
                <>
                    <Button
                        size="small"
                        disabled={busy || selectedVoices.length > audioLimit}
                        onClick={() => {
                            void onSave({ audioCastIds: selectedVoices })
                                .then(() => setVoiceDraft(null))
                                .catch(() => {});
                        }}
                    >
                        {_creationText("creation.d52afbb7b9dd8bbc")}
                    </Button>
                    <Button size="small" type="text" disabled={busy} onClick={() => setVoiceDraft(null)}>
                        {_creationText("creation.6127f5413ba64331")}
                    </Button>
                </>
            ) : null}
        </>
    );
    return (
        <section className="drama-sdx-section" aria-label={_creationText("creation.b0332e8d02818c80")}>
            <div className="drama-sdx-section-head">
                <span className="drama-sdx-count">{_creationText("creation.f76f0672d7ae2e60", { value1: request.references.filter((ref) => ref.sent).length, value2: request.references.length })}</span>
                <small>
                    {segment.referenceMode === "custom" ? _creationText("creation.3fafbd5dffd185e4") : _creationText("creation.0edb541a6e6c7ee7")}
                    {_creationText("creation.baa0677523f2553b")}
                    {request.referenceCapacity}
                    {_creationText("creation.f56a049fcc23f1eb")}
                    {request.modelMaxImages ? _creationText("creation.6439c5d4a4c22061", { value1: request.modelMaxImages }) : ""}
                </small>
                {segment.referenceMode === "custom" ? (
                    <Button size="small" type="text" disabled={busy} icon={<RotateCcw className="size-3.5" />} onClick={() => save({ autoReferences: true })}>
                        {_creationText("creation.09df5cd375eead2f")}
                    </Button>
                ) : null}
            </div>
            <div className="drama-sdx-assets-foot">
                <Popover
                    trigger="click"
                    placement="bottomLeft"
                    destroyOnHidden
                    open={menuOpen}
                    onOpenChange={setMenuOpen}
                    content={
                        <AssetMenu
                            casts={[...castById.values()]}
                            images={request.references.filter((ref) => !ref.castId)}
                            ids={ids}
                            busy={busy}
                            renderCast={renderCast}
                            renderImage={renderImage}
                            voiceActions={
                                voiceDraft !== null ? (
                                    <>
                                        <small>{_creationText("creation.e0df3cd20f0ea1e2", { value1: selectedVoices.length, value2: audioLimit })}</small>
                                        {voiceActions}
                                    </>
                                ) : null
                            }
                            onLibrary={() => {
                                setMenuOpen(false);
                                setLibraryOpen(true);
                            }}
                            onUpload={() => fileRef.current?.click()}
                        />
                    }
                >
                    <Button size="small" icon={<Search className="size-3.5" />} aria-expanded={menuOpen}>
                        {_creationText("creation.6e7b9999f5706078")}
                    </Button>
                </Popover>
                <Button size="small" icon={<Library className="size-3.5" />} disabled={busy} onClick={() => setLibraryOpen(true)}>
                    {_creationText("creation.89e906481e9ff575")}
                </Button>
                <Button size="small" icon={<Upload className="size-3.5" />} loading={uploading} disabled={busy} onClick={() => fileRef.current?.click()}>
                    {_creationText("creation.464d140c37a379a6")}
                </Button>
                <small>{_creationText("creation.73ae588f4056e6fd")}</small>
            </div>
            <div className="drama-sdx-frame-note">
                {request.firstFrameResourceId ? (
                    <button type="button" aria-label={_creationText("creation.0b8b197f78665824")} onClick={() => setPreview({ resourceId: request.firstFrameResourceId!, name: "上一段尾帧" })}>
                        <MediaThumb resourceId={request.firstFrameResourceId} alt={_creationText("creation.8bac7ae57174292e")} />
                    </button>
                ) : null}
                <span>
                    {first ? _creationText("creation.3ffd76e271e3a941") : request.firstFrameResourceId ? _creationText("creation.b51e78db2f31b708", { value1: segment.index }) : _creationText("creation.91475a5b2a7d0bb7", { value1: segment.index })}
                </span>
            </div>
            {groupOrder.map((kind) => {
                const group = [...ids.map((id) => castById.get(id)).filter((cast): cast is DramaCast => Boolean(cast)), ...[...castById.values()].filter((cast) => visible.has(cast.id) && !ids.includes(cast.id))].filter((cast) => cast.kind === kind);
                const index = activeKinds.indexOf(kind);
                return (
                    <section className="drama-sdx-asset-group" aria-label={_creationText("creation.2456afb0709e5073", { value1: _creationLabel(KIND_LABEL[kind]) })} key={kind}>
                        <div className="drama-sdx-group-head">
                            <strong>{_creationLabel(KIND_LABEL[kind])}</strong>
                            <small>{_creationText("creation.85671af6e41c198a", { value1: groupedIDs(kind).length })}</small>
                            <Button
                                size="small"
                                type="text"
                                disabled={busy || index <= 0}
                                aria-label={_creationText("creation.a021b52e0612e069", { value1: _creationLabel(KIND_LABEL[kind]) })}
                                icon={<ArrowUp className="size-3.5" />}
                                onClick={() => moveGroup(kind, -1)}
                            />
                            <Button
                                size="small"
                                type="text"
                                disabled={busy || index < 0 || index === activeKinds.length - 1}
                                aria-label={_creationText("creation.af4f6d90a5e319ca", { value1: _creationLabel(KIND_LABEL[kind]) })}
                                icon={<ArrowDown className="size-3.5" />}
                                onClick={() => moveGroup(kind, 1)}
                            />
                        </div>
                        {kind === "character" ? (
                            <div className="drama-sdx-assets-foot">
                                <small>
                                    {_creationText("creation.6ab9d2bde92cea4a")}
                                    {selectedVoices.length}/{audioLimit} · {segment.audioReferenceMode === "custom" ? _creationText("creation.187b88cd44e46d10") : _creationText("creation.1652c27d66840d47")} ·{" "}
                                    {audioLimit ? _creationText("creation.8589df5d6fc373d0", { value1: audioLimit }) : _creationText("creation.30182f2cd1f00437")}
                                </small>
                                {voiceActions}
                            </div>
                        ) : null}
                        {kind === "character" && selectedVoices.length > audioLimit ? <p className="drama-sdx-hint is-error">{_creationText("creation.ba350f7289bf89ff")}</p> : null}
                        {group.length ? <div className="drama-sdx-assets">{group.map(renderCast)}</div> : <p className="drama-sdx-hint">{_creationText("creation.3de743ca1c037e4f", { value1: _creationLabel(KIND_LABEL[kind]) })}</p>}
                    </section>
                );
            })}
            {images.length ? (
                <section className="drama-sdx-asset-group" aria-label={_creationText("creation.5e1740348d9beb4a")}>
                    <div className="drama-sdx-group-head">
                        <strong>{_creationText("creation.828cd5b24871b7ab")}</strong>
                        <small>{_creationText("creation.720af9febe9c6016")}</small>
                    </div>
                    <div className="drama-sdx-assets">{request.references.filter((ref) => !ref.castId).map(renderImage)}</div>
                </section>
            ) : null}
            <small className="drama-sdx-hint">{_creationText("creation.d8de6c9c957150b3")}</small>
            <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void upload(file);
                }}
            />
            <CastLibraryPicker open={libraryOpen} cast={{ kind: "character", name: segment.title }} segment onClose={() => setLibraryOpen(false)} onPick={addImage} />
            {preview ? <CanvasImagePreview storageKey={`resource:${preview.resourceId}`} alt={preview.name} onClose={() => setPreview(undefined)} /> : null}
        </section>
    );
}

/** 二级资产菜单保留已选项；搜索角色名、别名或造型名后可直接添加或移除。 */
function AssetMenu({
    casts,
    images,
    ids,
    busy,
    renderCast,
    renderImage,
    voiceActions,
    onLibrary,
    onUpload,
}: {
    casts: DramaCast[];
    images: Reference[];
    ids: string[];
    busy: boolean;
    renderCast: (cast: DramaCast) => ReactNode;
    renderImage: (ref: Reference) => ReactNode;
    voiceActions: ReactNode;
    onLibrary: () => void;
    onUpload: () => void;
}) {
    const [kind, setKind] = useState<AssetKind | "all">("all");
    const [query, setQuery] = useState("");
    const needle = query.trim().toLocaleLowerCase();
    const matches = (text: string) => text.toLocaleLowerCase().includes(needle);
    const filteredCasts = casts.filter((cast) => (kind === "all" || cast.kind === kind) && matches(`${castName(cast)} ${parseList(cast.aliasesJson).join(" ")}`));
    const filteredImages = kind === "all" || kind === "image" ? images.filter((ref) => matches(ref.name)) : [];
    return (
        <div className="drama-root drama-sdx-asset-menu" aria-label={_creationText("creation.42f7601f8df05f19")}>
            <Input allowClear value={query} prefix={<Search className="size-3.5" />} placeholder={_creationText("creation.f7d659a92a8b02bb")} aria-label={_creationText("creation.05697124c39d2e13")} onChange={(event) => setQuery(event.target.value)} />
            <nav className="drama-sdx-asset-menu-kinds" aria-label={_creationText("creation.8e14f176fa7715ae")}>
                {(["all", ...ASSET_KINDS, "image"] as const).map((value) => (
                    <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)}>
                        {value === "all" ? _creationText("settings.memory_status_all") : _creationLabel(KIND_LABEL[value])}
                    </button>
                ))}
            </nav>
            <div className="drama-sdx-asset-menu-results">
                {filteredCasts.map(renderCast)}
                {filteredImages.map(renderImage)}
                {!filteredCasts.length && !filteredImages.length ? <p className="drama-sdx-hint">{_creationText("creation.471ca58619d9cb77")}</p> : null}
            </div>
            <div className="drama-sdx-assets-foot">
                <small>{_creationText("creation.b20901bc6d5fd37d", { value1: ids.length + images.length })}</small>
                <Button size="small" disabled={busy} onClick={onLibrary}>
                    {_creationText("creation.89e906481e9ff575")}
                </Button>
                <Button size="small" disabled={busy} onClick={onUpload}>
                    {_creationText("creation.464d140c37a379a6")}
                </Button>
            </div>
            {voiceActions ? <div className="drama-sdx-assets-foot">{voiceActions}</div> : null}
        </div>
    );
}

function AssetCard({
    name,
    kind,
    resourceId,
    badge,
    checked,
    disabled,
    note,
    onToggle,
    onOpen,
    onPreview,
    onRaise,
    onLower,
    children,
}: {
    name: string;
    kind: string;
    resourceId?: string;
    badge?: string;
    checked: boolean;
    disabled: boolean;
    note: string;
    onToggle: () => void;
    onOpen?: () => void;
    onPreview: (image: { resourceId: string; name: string }) => void;
    onRaise?: () => void;
    onLower?: () => void;
    children?: ReactNode;
}) {
    return (
        <article className={`drama-sdx-asset ${checked ? "is-checked" : ""}`} aria-label={_creationText("creation.6f976e0e70dc0a51", { value1: name })}>
            <button
                type="button"
                className="drama-sdx-asset-thumb"
                disabled={!resourceId}
                aria-label={_creationText("creation.7013995fd3364f19", { value1: name })}
                onClick={() => {
                    if (resourceId) onPreview({ resourceId, name });
                }}
            >
                {resourceId ? <MediaThumb resourceId={resourceId} alt={name} /> : <span>{_creationText("creation.d117ed1cad63dce5", { value1: kind })}</span>}
                {badge ? <em>{badge}</em> : null}
                {resourceId ? <ZoomIn className="drama-sdx-asset-zoom size-4" /> : null}
            </button>
            {onOpen ? (
                <button type="button" className="drama-sdx-asset-text" onClick={onOpen} aria-label={_creationText("creation.dad73495280c07b2", { value1: name })}>
                    <b>{name}</b>
                </button>
            ) : (
                <strong className="drama-sdx-asset-text">{name}</strong>
            )}
            <small className="drama-sdx-asset-note">{note}</small>
            <div className="drama-sdx-asset-actions">
                <Button
                    size="small"
                    type="text"
                    icon={checked ? <Trash2 className="size-3.5" /> : <Plus className="size-3.5" />}
                    disabled={disabled}
                    aria-label={checked ? _creationText("creation.bd6f19e3549033d1", { value1: name }) : _creationText("creation.4d0e009671c1c2bd", { value1: name })}
                    onClick={onToggle}
                >
                    {checked ? _creationText("creation.6135d4159e892541") : _creationText("creation.7a8a11ead50742a2")}
                </Button>
                {checked ? (
                    <>
                        <Button size="small" type="text" disabled={disabled || !onRaise} icon={<ArrowUp className="size-3.5" />} aria-label={_creationText("creation.f8d42d0770297166", { value1: name })} onClick={onRaise} />
                        <Button size="small" type="text" disabled={disabled || !onLower} icon={<ArrowDown className="size-3.5" />} aria-label={_creationText("creation.0c562fe0daf143ba", { value1: name })} onClick={onLower} />
                    </>
                ) : null}
            </div>
            {children}
        </article>
    );
}

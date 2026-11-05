import { creationSource as _creationSource } from "@/supdance/plugins/i18n/creation-text";
import { creationOptions as _creationOptions, creationLabel as _creationLabel } from "@/supdance/plugins/i18n/creation-text";
import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { Button, Input, Popconfirm, Popover, Select } from "antd";
import { ArrowDownToLine, Crop, Images, Languages, Layers3, Maximize2, Paintbrush2, RotateCcw, RotateCw, Scissors, Sparkles, Trash2, Type, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { ModelPicker } from "@/components/model-picker";
import { RollingCreditAmount } from "@/components/rolling-credit-text";
import { modelCapabilityConfigFor } from "@/lib/model-capabilities";
import { systemModelQuoteRequest } from "@/lib/model-pricing";
import { quoteModel } from "@/services/api/logical-models";
import { parseBackendGenerationResult } from "@/services/api/generation-task";
import { resolveResourceVariantUrl, resourceIdFromStorageKey } from "@/services/api/resources";
import type { GenerationTask } from "@/services/api/task-center";
import type { EcommerceDraft, EcommercePlan, EcommercePlanImage } from "@/services/api/ecommerce";
import type { AiConfig } from "@/stores/use-config-store";
import { imageSizeLabel, imageTypes, labelOf } from "./catalog";
import { commerceGenerationRatio, commerceImageReferences } from "./workflow";
import type { EcommerceExportItem } from "./export";
import { writeCommerceImageTransfer } from "./image-transfer";
import { commerceCanvasAspect } from "./canvas-layout";
import { CommerceGeneratingArtwork, CommerceResultImage } from "./result-image";
import { commerceCopyHasDirections } from "./consumer-copy";

export function imageResultAsset(task?: GenerationTask) {
    return task?.outputs?.find((output) => output.materializedAssetId)?.materializedAssetId;
}

const pendingImageTools = [
    { label: "裁剪", icon: Crop },
    { label: "图层分离", icon: Layers3 },
    { label: "AI 抠图", icon: Scissors },
    { label: "局部重绘", icon: Paintbrush2 },
    { label: "智能延展", icon: Maximize2 },
    { label: "无损放大", icon: Maximize2 },
    { label: "图片翻译", icon: Languages },
    { label: "AI 超清", icon: Sparkles },
    { label: "编辑文字", icon: Type },
    { label: "爆款图片复刻", icon: Images },
] as const;

export function SingleImageEditor({
    config,
    draft,
    image,
    imageModels,
    onClose,
    onGenerate,
}: {
    config: AiConfig;
    draft: EcommerceDraft;
    image: EcommercePlanImage;
    imageModels: string[];
    onClose: () => void;
    onGenerate: (image: EcommercePlanImage) => Promise<void>;
}) {
    _useCreationLocale();
    const [edited, setEdited] = useState<EcommercePlanImage>(() => ({
        ...image,
        copy: "",
        manualPrompt: true,
        prompt: image.manualPrompt
            ? image.prompt
            : [image.prompt, image.copy?.trim() && !commerceCopyHasDirections(image.copy) ? `成品文案与位置：\n${image.copy}\n文字完整放在画幅内，按本提示词指定位置排版，不遮挡商品。` : ""].filter(Boolean).join("\n\n"),
    }));
    const [request, setRequest] = useState("");
    const [cost, setCost] = useState<number>();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const lock = useRef(false);
    const profile = modelCapabilityConfigFor(config, edited.imageModel).image;
    const refs = commerceImageReferences(draft, edited, 0, false);
    // Quote the size the image is generated at (自动 resolves to the platform recommendation).
    const quotedRatio = commerceGenerationRatio(config, draft, edited);
    useEffect(() => {
        const controller = new AbortController();
        setCost(undefined);
        setError("");
        const request = systemModelQuoteRequest(config, edited.imageModel, "image", {
            capability: "image",
            input: { textCount: 1, imageCount: refs.length, referenceImageCount: refs.length, videoCount: 0, audioCount: 0, characterCount: 0 },
            imageSize: quotedRatio,
            options: { size: quotedRatio, imageResolution: edited.resolution, count: 1 },
        });
        if (request)
            void quoteModel(request, controller.signal)
                .then((value) => {
                    if (!controller.signal.aborted) setCost(value.quote.amountMicrocredits / 1_000_000);
                })
                .catch((cause) => {
                    if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : _creationSource("creation.57e73d133f5fdbbb"));
                });
        else setError(_creationSource("creation.ed896598373e81c6"));
        return () => controller.abort();
    }, [config, edited.imageModel, quotedRatio, edited.resolution, refs.length]);
    return (
        <section className="ecommerce-image-editor" aria-label={_creationText("creation.22845f845f147940")}>
            <header>
                <div>
                    <Sparkles size={17} />
                    <strong>{_creationText("creation.e52afda12c21ff0a")}</strong>
                </div>
                <Button type="text" aria-label={_creationText("creation.08d672e6df168b30")} icon={<X size={17} />} onClick={onClose} disabled={busy} />
            </header>
            <p>{_creationText("creation.468b9686569e3fc2")}</p>
            <label className="ecommerce-field">
                <span>{_creationText("creation.28c29060ccc30899")}</span>
                <Input.TextArea aria-label={_creationText("creation.f54287590bfaa4eb")} placeholder={_creationText("creation.8f65c5113d4c4748")} autoSize={{ minRows: 4, maxRows: 8 }} value={request} onChange={(event) => setRequest(event.target.value)} />
            </label>
            <label className="ecommerce-field">
                <span>{_creationText("creation.48156e412e6b80bf")}</span>
                <ModelPicker
                    config={config}
                    capability="image"
                    value={edited.imageModel}
                    modelFilter={(value) => imageModels.includes(value) && (modelCapabilityConfigFor(config, value).image?.references.maxImages || 0) >= refs.length}
                    requirements={{ input: { textCount: 1, imageCount: refs.length, referenceImageCount: refs.length, videoCount: 0, audioCount: 0, characterCount: 0 } }}
                    fullWidth
                    showOptionPrices
                    onChange={(value) => {
                        const next = modelCapabilityConfigFor(config, value).image;
                        setEdited({ ...edited, imageModel: value, ratio: next?.size.default || "1:1", resolution: next?.resolution.supported ? next.resolution.default : next?.quality.default || "auto" });
                    }}
                />
            </label>
            <div className="ecommerce-image-editor-parameters">
                <label className="ecommerce-field">
                    <span>{_creationText("creation.f69028ee0d49a448")}</span>
                    <Select
                        aria-label={_creationText("creation.a9708836bf654a32")}
                        value={edited.ratio}
                        options={_creationOptions(profile?.size.values.map((value) => ({ value, label: imageSizeLabel(value) })))}
                        onChange={(ratio) => setEdited({ ...edited, ratio })}
                    />
                </label>
                <label className="ecommerce-field">
                    <span>{_creationText("creation.3074f9433e3c7a48")}</span>
                    <Select
                        aria-label={_creationText("creation.5bcd95a2223274bb")}
                        value={edited.resolution}
                        options={_creationOptions((profile?.resolution.supported ? profile.resolution.values : [profile?.quality.default || "auto"]).map((value) => ({ value, label: value.toUpperCase() })))}
                        onChange={(resolution) => setEdited({ ...edited, resolution })}
                    />
                </label>
            </div>
            {error ? <p role="alert">{_creationLabel(error)}</p> : null}
            <footer>
                <span>
                    {_creationText("creation.97a1cfb03b99f24f")}
                    {cost == null ? _creationText("workbench.calculating_credits") : _creationText("creation.7055463fb9b7d458")}
                    <RollingCreditAmount value={cost ?? null} />
                    {cost == null ? null : _creationText("creation.32ded95d61e3f532")}
                </span>
                <Button
                    type="primary"
                    icon={<Sparkles size={15} />}
                    loading={busy}
                    disabled={cost == null || !request.trim()}
                    onClick={async () => {
                        if (lock.current) return;
                        lock.current = true;
                        setBusy(true);
                        setError("");
                        try {
                            await onGenerate({ ...edited, prompt: `${edited.prompt}\n\n用户本轮修改要求（优先于原方案）：${request.trim()}` });
                            onClose();
                        } catch (cause) {
                            setError(cause instanceof Error ? cause.message : _creationSource("creation.7f8f9593f5c4a4bf"));
                        } finally {
                            lock.current = false;
                            setBusy(false);
                        }
                    }}
                >
                    {_creationText("workbench.regenerate")}
                </Button>
            </footer>
        </section>
    );
}

type ResizeDirection = "top-left" | "top-center" | "top-right" | "middle-left" | "middle-right" | "bottom-left" | "bottom-center" | "bottom-right";
const resizeDirections: ResizeDirection[] = ["top-left", "top-center", "top-right", "middle-left", "middle-right", "bottom-left", "bottom-center", "bottom-right"];

export function EcommerceResultGallery({
    config,
    draft,
    plan,
    tasks,
    selected,
    focused,
    imageModels,
    qualityIssues,
    onSelect,
    onFocus,
    onDownload,
    onCanvas,
    onRemove,
    onRegenerate,
    onRetry,
    regenerationPreviews = {},
    regeneratingIds = new Set<string>(),
    generationPending = false,
}: {
    config: AiConfig;
    draft: EcommerceDraft;
    plan: EcommercePlan;
    tasks: Record<string, GenerationTask>;
    selected: Set<string>;
    imageModels: string[];
    qualityIssues?: Record<string, string[]>;
    regenerationPreviews?: Record<string, string>;
    regeneratingIds?: Set<string>;
    generationPending?: boolean;
    focused?: string;
    onSelect: (id: string) => void;
    onFocus: (id?: string) => void;
    onDownload: (item: EcommerceExportItem) => void;
    onCanvas: (ids: string[]) => void;
    onRemove: (image: EcommercePlanImage) => Promise<void>;
    onRegenerate: (image: EcommercePlanImage) => Promise<void>;
    onRetry: (image: EcommercePlanImage) => void;
}) {
    _useCreationLocale();
    const [editing, setEditing] = useState<string>();
    const [rotations, setRotations] = useState<Record<string, number>>({});
    const [dimensions, setDimensions] = useState<Record<string, string>>({});
    const [frameSizes, setFrameSizes] = useState<Record<string, { width: number; height: number; left: number; top: number }>>({});
    const resizing = useRef<{ id: string; pointerId: number; direction: ResizeDirection; x: number; y: number; width: number; height: number; left: number; top: number; scale: number } | null>(null);
    const startResize = (event: ReactPointerEvent<HTMLSpanElement>, id: string, direction: ResizeDirection) => {
        const frame = event.currentTarget.closest<HTMLElement>(".ecommerce-result");
        if (!frame) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        const world = frame.closest<HTMLElement>(".commerce-canvas-results");
        const scale = world && world.offsetWidth ? world.getBoundingClientRect().width / world.offsetWidth : 1;
        resizing.current = { id, pointerId: event.pointerId, direction, x: event.clientX, y: event.clientY, width: frame.offsetWidth, height: frame.offsetHeight, left: frameSizes[id]?.left || 0, top: frameSizes[id]?.top || 0, scale };
    };
    const moveResize = (event: ReactPointerEvent<HTMLSpanElement>) => {
        const state = resizing.current;
        if (!state || state.pointerId !== event.pointerId) return;
        const dx = (event.clientX - state.x) / state.scale;
        const dy = (event.clientY - state.y) / state.scale;
        const horizontal = state.direction.includes("left") ? -dx : state.direction.includes("right") ? dx : 0;
        const vertical = state.direction.includes("top") ? -dy : state.direction.includes("bottom") ? dy : 0;
        const width = Math.max(120, Math.min(1200, Math.round(state.width + horizontal)));
        const height = Math.max(120, Math.min(1600, Math.round(state.height + vertical)));
        setFrameSizes((current) => ({ ...current, [state.id]: { width, height, left: state.left + (state.direction.includes("left") ? state.width - width : 0), top: state.top + (state.direction.includes("top") ? state.height - height : 0) } }));
    };
    const endResize = (event: ReactPointerEvent<HTMLSpanElement>) => {
        if (resizing.current?.pointerId === event.pointerId) resizing.current = null;
    };
    const keyResize = (event: ReactKeyboardEvent<HTMLSpanElement>, id: string) => {
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
        const frame = event.currentTarget.closest<HTMLElement>(".ecommerce-result");
        if (!frame) return;
        event.preventDefault();
        const current = frameSizes[id] || { width: frame.offsetWidth, height: frame.offsetHeight, left: 0, top: 0 };
        const step = event.shiftKey ? 20 : 5;
        setFrameSizes((sizes) => ({
            ...sizes,
            [id]: {
                ...current,
                width: Math.max(120, Math.min(1200, current.width + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0))),
                height: Math.max(120, Math.min(1600, current.height + (event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0))),
            },
        }));
    };
    return (
        <>
            <div className="ecommerce-result-grid">
                {plan.images.map((image) => {
                    const index = plan.images.indexOf(image);
                    const task = image.taskId ? tasks[image.taskId] : undefined;
                    const assetId = imageResultAsset(task);
                    const working = regeneratingIds.has(image.id) || Boolean(image.taskId && (!task || !["succeeded", "failed", "cancelled"].includes(task.status))) || (!image.taskId && generationPending);
                    const output = (() => {
                        try {
                            return task?.status === "succeeded" ? parseBackendGenerationResult(task)?.images?.[0] : undefined;
                        } catch {
                            return undefined;
                        }
                    })();
                    const resourceId = resourceIdFromStorageKey(output?.storageKey);
                    const src = output?.storageKey ? resolveResourceVariantUrl(output.storageKey, "thumbnail") : output?.dataUrl || task?.previewUrl;
                    const displaySrc = src || (working ? regenerationPreviews[image.id] : undefined);
                    const frameSize = frameSizes[image.id];
                    return (
                        <article
                            key={image.id}
                            data-ecommerce-image-id={image.id}
                            data-node-id={image.id}
                            data-resized={Boolean(frameSize)}
                            style={frameSize ? { width: frameSize.width, height: frameSize.height, left: frameSize.left, top: frameSize.top } : undefined}
                            className={`ecommerce-result${selected.has(image.id) ? " is-selected" : ""}${focused === image.id ? " is-focused" : ""}${editing === image.id ? " is-editing" : ""}${working ? " is-generating" : ""}`}
                            aria-label={_creationText("creation.13a64d41c44e4667", { value1: index + 1, value2: labelOf(imageTypes, image.imageType) })}
                        >
                            <div className="ecommerce-result-media">
                                {displaySrc ? (
                                    <button
                                        type="button"
                                        className="ecommerce-result-open"
                                        aria-label={_creationText("creation.acfddbf80bdbaaaf", { value1: index + 1 })}
                                        aria-pressed={focused === image.id}
                                        title={_creationText("creation.b6dae462990f3657")}
                                        onClick={(event) => {
                                            if (event.shiftKey || event.ctrlKey || event.metaKey) onSelect(image.id);
                                            else onFocus(focused === image.id ? undefined : image.id);
                                        }}
                                    >
                                        <CommerceResultImage
                                            key={displaySrc}
                                            ratio={commerceCanvasAspect(image.ratio)}
                                            src={displaySrc}
                                            alt={_creationText("creation.3499c78b636a69ea", { value1: index + 1 })}
                                            rotation={rotations[image.id] || 0}
                                            frameRatio={frameSize ? frameSize.width / frameSize.height : undefined}
                                            draggable={false}
                                            onPointerDown={(event) => {
                                                event.currentTarget.draggable = event.altKey && !working;
                                                if (event.altKey) event.stopPropagation();
                                            }}
                                            onLoad={(event) => {
                                                const { naturalWidth, naturalHeight } = event.currentTarget;
                                                if (naturalWidth && naturalHeight) setDimensions((current) => (current[image.id] === `${naturalWidth} × ${naturalHeight}` ? current : { ...current, [image.id]: `${naturalWidth} × ${naturalHeight}` }));
                                            }}
                                            onDragStart={(event) => writeCommerceImageTransfer(event.dataTransfer, { resourceId, name: `第 ${index + 1} 张生成结果`, url: displaySrc })}
                                        />
                                    </button>
                                ) : (
                                    <div className="ecommerce-result-placeholder commerce-branded-placeholder" style={{ aspectRatio: commerceCanvasAspect(image.ratio) }} role="status">
                                        <div className="commerce-placeholder-brand">
                                            <img src="/commerce/agent-mark.svg" alt="" />
                                            <span>{_creationText("creation.b932b2906738d571")}</span>
                                        </div>
                                        {working ? <CommerceGeneratingArtwork queued={!image.taskId || task?.status === "queued"} label={`${String(index + 1).padStart(2, "0")} · ${labelOf(imageTypes, image.imageType)}`} /> : <Images size={27} />}
                                        {!working ? (
                                            <strong>
                                                {task?.status === "failed" && task.canRecoverMedia
                                                    ? _creationText("creation.57c925f72601ea9e")
                                                    : task?.status === "failed"
                                                      ? _creationText("music.status_failed")
                                                      : task?.status === "cancelled"
                                                        ? _creationText("canvas.task_cancelled_msg")
                                                        : _creationText("creation.6b63c92e5494efa2")}
                                            </strong>
                                        ) : null}
                                        {!working ? (
                                            <span>
                                                {String(index + 1).padStart(2, "0")} · {_creationLabel(labelOf(imageTypes, image.imageType))}
                                            </span>
                                        ) : null}
                                        {task?.error ? <p>{task.error}</p> : null}
                                        {task && ["failed", "cancelled"].includes(task.status) ? (
                                            <Button size="small" onClick={() => onRetry(image)}>
                                                {task.canRecoverMedia ? _creationText("creation.f4d0e43e083c1b75") : _creationText("creation.353ec6bf7bb1d356")}
                                            </Button>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                            {src && !working && focused === image.id && selected.size <= 1 ? (
                                <>
                                    {resizeDirections.map((direction) => {
                                        const vertical = direction === "top-center" || direction === "bottom-center";
                                        return (
                                            <span
                                                key={direction}
                                                role="slider"
                                                aria-label={_creationText("creation.6c04d44d5ed67325", { value1: index + 1, value2: direction })}
                                                aria-valuemin={120}
                                                aria-valuemax={vertical ? 1600 : 1200}
                                                aria-valuenow={vertical ? frameSize?.height || Math.round(260 / commerceCanvasAspect(image.ratio)) : frameSize?.width || 260}
                                                tabIndex={0}
                                                className={`commerce-selection-handle ${direction}`}
                                                onPointerDown={(event) => startResize(event, image.id, direction)}
                                                onPointerMove={moveResize}
                                                onPointerUp={endResize}
                                                onLostPointerCapture={endResize}
                                                onKeyDown={(event) => keyResize(event, image.id)}
                                            />
                                        );
                                    })}
                                    {dimensions[image.id] ? <span className="commerce-selection-dimensions">{dimensions[image.id]}</span> : null}
                                    <button
                                        type="button"
                                        className="commerce-selection-rotate"
                                        title={_creationText("creation.81ace10251ac1435")}
                                        aria-label={_creationText("creation.dbdf59795cc87188")}
                                        onClick={() => setRotations((current) => ({ ...current, [image.id]: ((current[image.id] || 0) + 90) % 360 }))}
                                    >
                                        <RotateCw size={15} />
                                    </button>
                                    <div className="commerce-selected-tools" role="group" aria-label={_creationText("creation.3c568ab678945517")} data-canvas-no-zoom>
                                        <div className="commerce-selected-tools-cost">
                                            {_creationText("workbench.image_editing")}
                                            <small>{_creationText("creation.ffa2268976277632")}</small>
                                        </div>
                                        {pendingImageTools.map(({ label, icon: Icon }) => (
                                            <button type="button" key={label} disabled title={_creationText("creation.1cfc38a90c8eec95", { value1: label })}>
                                                <Icon size={15} strokeWidth={1.8} />
                                                <span>{_creationLabel(label)}</span>
                                                <small>{_creationText("creation.2126dc0b0c251d10")}</small>
                                            </button>
                                        ))}
                                        <div className="commerce-selected-tools-divider" />
                                        <button
                                            type="button"
                                            disabled={!assetId}
                                            title={rotations[image.id] ? _creationText("creation.8960a816885e13c3") : _creationText("creation.480575b14b0ed0e0")}
                                            onClick={() => assetId && onDownload({ image, index, assetId })}
                                        >
                                            <ArrowDownToLine size={15} />
                                            <span>{_creationText("creation.833d680fe5a99443")}</span>
                                        </button>
                                        <button type="button" disabled={!assetId} onClick={() => assetId && onCanvas([assetId])}>
                                            <Images size={15} />
                                            <span>{_creationText("creation.d430af0b12ad6ca1")}</span>
                                        </button>
                                        <Popover
                                            open={editing === image.id}
                                            onOpenChange={(open) => setEditing(open ? image.id : undefined)}
                                            trigger="click"
                                            placement="leftTop"
                                            destroyOnHidden
                                            content={
                                                <SingleImageEditor
                                                    key={`${image.id}:${image.taskId}`}
                                                    config={config}
                                                    draft={image.sourceDraft || draft}
                                                    image={image}
                                                    imageModels={imageModels}
                                                    onClose={() => setEditing(undefined)}
                                                    onGenerate={onRegenerate}
                                                />
                                            }
                                        >
                                            <button type="button" onClick={() => setEditing(image.id)}>
                                                <RotateCcw size={15} />
                                                <span>{_creationText("workbench.regenerate")}</span>
                                            </button>
                                        </Popover>
                                        <Popconfirm title={_creationText("creation.bb284f538eb6a980")} description={_creationText("creation.be35c35e34895aac")} onConfirm={() => onRemove(image)}>
                                            <button type="button">
                                                <Trash2 size={15} />
                                                <span>{_creationText("creation.86d72aaba84d724e")}</span>
                                            </button>
                                        </Popconfirm>
                                    </div>
                                </>
                            ) : null}
                            {displaySrc && working ? (
                                <div className="ecommerce-result-regenerating" role="status">
                                    <img src="/commerce/agent-mark.svg" alt="" />
                                    <strong>{_creationText("creation.fac1a7bdbc89ac02")}</strong>
                                    <span>{_creationText("creation.f38171e036d4cad0")}</span>
                                </div>
                            ) : null}
                            {assetId && qualityIssues?.[assetId]?.length ? (
                                <div className="ecommerce-quality-warning" role="status" title={qualityIssues[assetId].join("；")}>
                                    {_creationText("creation.ae3c13f390dbe797")}
                                    {qualityIssues[assetId].join("；")}
                                </div>
                            ) : null}
                        </article>
                    );
                })}
            </div>
        </>
    );
}

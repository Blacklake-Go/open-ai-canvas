import { creationLabel as _creationLabel } from "@/supdance/plugins/i18n/creation-text";
import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { useState, type ReactNode } from "react";
import { Button, Checkbox, Typography } from "antd";
import { ArrowDownToLine, Clapperboard, Image as ImageIcon, RotateCcw, Trash2 } from "lucide-react";
import { AppModal } from "@/components/ui/product/app-modal/app-modal";
import type { GenerationTask } from "@/services/api/task-center";
import type { EcommerceDraft, EcommercePlan, EcommercePlanImage } from "@/services/api/ecommerce";
import type { AiConfig } from "@/stores/use-config-store";
import { parseBackendGenerationResult } from "@/services/api/generation-task";
import { resolveResourceVariantUrl, resourceIdFromStorageKey } from "@/services/api/resources";
import type { EcommerceExportItem } from "./export";
import { imageTypes, labelOf } from "./catalog";
import { commerceCanvasAspect } from "./canvas-layout";
import { CommerceGeneratingArtwork, CommerceResultImage } from "./result-image";
import { SingleImageEditor, imageResultAsset } from "./result-gallery";
import "./output-gallery.css";

type OutputImage = { image: EcommercePlanImage; index: number; task?: GenerationTask; src?: string; assetId?: string; resourceId?: string };

type OutputFilter = "all" | "active" | "done" | "failed";
const filters: Array<[OutputFilter, string]> = [
    ["all", "全部"],
    ["active", "进行中"],
    ["done", "已完成"],
    ["failed", "失败"],
];

export function EcommerceOutputGallery({
    config,
    draft,
    plan,
    tasks,
    imageModels,
    qualityIssues,
    selected,
    onSelect,
    onDownload,
    onRemove,
    onRegenerate,
    onRetry,
    generationPending,
    regeneratingIds = new Set<string>(),
    regenerationPreviews = {},
    stage,
    stageActive = false,
    nextStep,
    exportCount = 0,
    exportDisabled = false,
    onExport,
    preparedDownload,
    progress,
    onMakeVideo,
}: {
    config: AiConfig;
    draft: EcommerceDraft;
    plan: EcommercePlan | null;
    tasks: Record<string, GenerationTask>;
    imageModels: string[];
    qualityIssues?: Record<string, string[]>;
    selected: Set<string>;
    onSelect: (id: string) => void;
    onDownload: (item: EcommerceExportItem) => void;
    onRemove: (image: EcommercePlanImage) => Promise<void>;
    onRegenerate: (image: EcommercePlanImage) => Promise<void>;
    onRetry: (image: EcommercePlanImage) => void;
    generationPending: boolean;
    regeneratingIds?: Set<string>;
    regenerationPreviews?: Record<string, string>;
    /** 本轮流程：已发送的需求、视觉方向、方案审阅与进度，显示在作品之上。 */
    stage?: ReactNode;
    stageActive?: boolean;
    /** 空态里告诉用户下一步做什么。 */
    nextStep?: string;
    exportCount?: number;
    exportDisabled?: boolean;
    onExport?: () => void;
    preparedDownload?: { url: string; fileName: string };
    /** 流程进度条，固定在作品区顶部。 */
    progress?: ReactNode;
    /** 开放商品视频时：把这张图带到视频生成做首帧。 */
    onMakeVideo?: (resourceId: string) => void;
}) {
    _useCreationLocale();
    const [preview, setPreview] = useState<OutputImage | null>(null);
    const [editing, setEditing] = useState<string | null>(null);
    const [filter, setFilter] = useState<OutputFilter>("all");
    const images = [...(plan?.previousImages || []), ...(plan?.images || [])];
    const stateOf = (image: EcommercePlanImage, pending: boolean): OutputFilter => {
        const task = image.taskId ? tasks[image.taskId] : undefined;
        if (task?.status === "succeeded" || (!task && image.deliveryStatus === "delivered")) return "done";
        if (task && ["failed", "cancelled"].includes(task.status)) return "failed";
        return regenerationPending(image, tasks, pending, regeneratingIds) ? "active" : "all";
    };
    const counts = { active: 0, done: 0, failed: 0 };
    for (const image of plan?.images || []) {
        const state = stateOf(image, generationPending);
        if (state !== "all") counts[state] += 1;
    }
    for (const image of plan?.previousImages || []) {
        const state = stateOf(image, false);
        if (state !== "all") counts[state] += 1;
    }
    const visible = (image: EcommercePlanImage, pending: boolean) => filter === "all" || stateOf(image, pending) === filter;
    const card = (image: EcommercePlanImage, index: number, pending: boolean) => (
        <OutputCard
            key={image.id}
            image={image}
            index={index}
            task={image.taskId ? tasks[image.taskId] : undefined}
            selected={selected.has(image.id)}
            working={regenerationPending(image, tasks, pending, regeneratingIds)}
            src={outputSource(image, tasks) || (pending ? regenerationPreviews[image.id] : undefined)}
            assetId={image.taskId ? imageResultAsset(tasks[image.taskId]) : undefined}
            resourceId={resourceFor(image, tasks)}
            issues={qualityIssues?.[image.taskId ? imageResultAsset(tasks[image.taskId]) || "" : ""]}
            onSelect={() => onSelect(image.id)}
            onPreview={(value) => setPreview(value)}
            onDownload={onDownload}
            onRetry={() => onRetry(image)}
            onEdit={() => setEditing(image.id)}
            onRemove={() => void onRemove(image)}
            onMakeVideo={onMakeVideo}
        />
    );
    const current = (plan?.images || []).map((image, index) => ({ image, index })).filter(({ image }) => visible(image, generationPending));
    const previous = (plan?.previousImages || []).map((image, index) => ({ image, index })).filter(({ image }) => visible(image, false));

    return (
        <section className="commerce-output-gallery" aria-label={_creationText("creation.9ea5fb9199d003ee")}>
            <header className="commerce-output-gallery-header">
                <div className="commerce-output-title">
                    <h2>{_creationText("creation.19469bb61390b8b7")}</h2>
                    <span>
                        {counts.done}
                        {_creationText("creation.acd71b2835e9415b")}
                        {counts.active ? _creationText("creation.3021a4eb5fbb0b26", { value1: counts.active }) : ""}
                        {counts.failed ? _creationText("creation.f3aac2ae16b7a6f6", { value1: counts.failed }) : ""}
                    </span>
                </div>
                <div className="commerce-output-tools">
                    {images.length ? (
                        <div className="commerce-output-filters" role="group" aria-label={_creationText("creation.ebaa19a690990495")}>
                            {filters.map(([value, label]) => (
                                <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>
                                    {_creationLabel(label)}
                                    {value !== "all" && counts[value] ? <span>{counts[value]}</span> : null}
                                </button>
                            ))}
                        </div>
                    ) : null}
                    {preparedDownload ? (
                        <Button size="small" href={preparedDownload.url} download={preparedDownload.fileName}>
                            {_creationText("creation.5141476ed7e71c36")}
                        </Button>
                    ) : null}
                    {onExport ? (
                        <Button size="small" icon={<ArrowDownToLine size={14} />} disabled={!exportCount || exportDisabled} onClick={onExport} aria-label={_creationText("creation.0f2808c079d8dc4a", { value1: exportCount })}>
                            {selected.size ? _creationText("creation.b4dd1b2e03b60e19", { value1: exportCount }) : exportCount > 1 ? _creationText("creation.9660a933fec0fb77", { value1: exportCount }) : _creationText("common.export")}
                        </Button>
                    ) : null}
                </div>
            </header>
            {progress}
            <div className="commerce-output-scroll" data-canvas-wheel-scroll>
                {stageActive ? <div className="ecs-stage">{stage}</div> : null}
                {!images.length ? (
                    stageActive ? null : (
                        <div className="commerce-output-empty" role="status">
                            <span className="commerce-output-empty-mark" aria-hidden="true">
                                <ImageIcon size={22} strokeWidth={1.6} />
                            </span>
                            <strong>{_creationText("creation.36d68d7970fd6ef0")}</strong>
                            <span>{nextStep || _creationText("creation.81a922f0adb63011")}</span>
                        </div>
                    )
                ) : (
                    <div className="commerce-output-batches">
                        {current.length ? (
                            <section className="commerce-output-batch" aria-label={_creationText("creation.8b905c8fcee819cb")}>
                                <header>
                                    <strong>{plan!.images.length > 1 ? _creationText("creation.c1fbd1df4a238769") : _creationText("creation.c4580d00c18eba56")}</strong>
                                    <span>{_creationText("creation.dc62d72cc7077723", { value1: plan!.images.length })}</span>
                                </header>
                                <div className="commerce-output-grid">{current.map(({ image, index }) => card(image, index, generationPending))}</div>
                            </section>
                        ) : null}
                        {previous.length ? (
                            <section className="commerce-output-batch" aria-label={_creationText("creation.4cda9aaf8adcfbe7")}>
                                <header>
                                    <strong>{_creationText("creation.af3959ecabe7318e")}</strong>
                                    <span>{_creationText("creation.dc62d72cc7077723", { value1: plan!.previousImages!.length })}</span>
                                </header>
                                <div className="commerce-output-grid">{previous.map(({ image, index }) => card(image, index, false))}</div>
                            </section>
                        ) : null}
                        {!current.length && !previous.length ? <p className="commerce-output-filter-empty">{_creationText("creation.cd5694fc2807e79a", { value1: filters.find(([value]) => value === filter)?.[1] })}</p> : null}
                    </div>
                )}
            </div>
            {preview ? (
                <AppModal open onCancel={() => setPreview(null)} footer={null} width="min(1120px, calc(100vw - 32px))" title={`${String(preview.index + 1).padStart(2, "0")} · ${labelOf(imageTypes, preview.image.imageType)}`}>
                    <div className="commerce-output-preview">
                        <CommerceResultImage ratio={commerceCanvasAspect(preview.image.ratio)} src={preview.src || ""} alt={_creationText("creation.e837417e4b8c673f", { value1: preview.index + 1 })} />
                        <section>
                            {preview.image.copy ? <p>{preview.image.copy}</p> : null}
                            <Typography.Text type="secondary" data-i18n-user-content>
                                {preview.image.prompt}
                            </Typography.Text>
                            <dl>
                                <div>
                                    <dt>{_creationText("creation.05b36669c4ad9a73")}</dt>
                                    <dd>{_creationLabel(labelOf(imageTypes, preview.image.imageType))}</dd>
                                </div>
                                <div>
                                    <dt>{_creationText("tasks.model")}</dt>
                                    <dd>{preview.image.imageModel}</dd>
                                </div>
                                <div>
                                    <dt>{_creationText("plugins.dimensions")}</dt>
                                    <dd>
                                        {preview.image.ratio} · {preview.image.resolution}
                                    </dd>
                                </div>
                            </dl>
                            {preview.assetId ? (
                                <Button type="primary" icon={<ArrowDownToLine size={14} />} onClick={() => onDownload({ image: preview.image, index: preview.index, assetId: preview.assetId!, resourceId: preview.resourceId })}>
                                    {_creationText("creation.833d680fe5a99443")}
                                </Button>
                            ) : null}
                        </section>
                    </div>
                </AppModal>
            ) : null}
            {editing
                ? (() => {
                      const image = images.find((item) => item.id === editing);
                      if (!image) return null;
                      return (
                          <AppModal open onCancel={() => setEditing(null)} footer={null} width="min(600px, calc(100vw - 32px))" title={_creationText("creation.4158a3e095d16237", { value1: images.indexOf(image) + 1 })}>
                              <SingleImageEditor config={config} draft={image.sourceDraft || draft} image={image} imageModels={imageModels} onClose={() => setEditing(null)} onGenerate={onRegenerate} />
                          </AppModal>
                      );
                  })()
                : null}
        </section>
    );
}

function OutputCard({
    image,
    index,
    task,
    selected,
    working,
    src,
    assetId,
    resourceId,
    issues,
    onSelect,
    onPreview,
    onDownload,
    onRetry,
    onEdit,
    onRemove,
    onMakeVideo,
}: {
    image: EcommercePlanImage;
    index: number;
    task?: GenerationTask;
    selected: boolean;
    working: boolean;
    src?: string;
    assetId?: string;
    resourceId?: string;
    issues?: string[];
    onSelect: () => void;
    onPreview: (image: OutputImage) => void;
    onDownload: (item: EcommerceExportItem) => void;
    onRetry: () => void;
    onEdit: () => void;
    onRemove: () => void;
    onMakeVideo?: (resourceId: string) => void;
}) {
    _useCreationLocale();
    const failed = Boolean(task && ["failed", "cancelled"].includes(task.status));
    const status =
        task?.status === "succeeded"
            ? "已完成"
            : task?.status === "failed"
              ? "生成失败"
              : task?.status === "cancelled"
                ? "已取消"
                : working
                  ? task?.status === "queued"
                      ? "排队中"
                      : task?.stage || "生成中"
                  : image.deliveryStatus === "delivered"
                    ? "已完成"
                    : "待生成";
    const title = `${String(index + 1).padStart(2, "0")} · ${labelOf(imageTypes, image.imageType)}`;
    return (
        <article className={`commerce-output-card${selected ? " is-selected" : ""}`} data-ecommerce-image-id={image.id} data-status={failed ? "failed" : working ? "working" : status === "已完成" ? "done" : "idle"}>
            <div className="commerce-output-card-frame">
                <button type="button" className="commerce-output-card-media" disabled={!src} onClick={() => src && onPreview({ image, index, src, assetId, resourceId })} aria-label={_creationText("creation.b9f6b27477a1d548", { value1: index + 1 })}>
                    {src ? (
                        <CommerceResultImage ratio={commerceCanvasAspect(image.ratio)} src={src} alt={_creationText("creation.dec4868d02732135", { value1: labelOf(imageTypes, image.imageType) })} loading="lazy" />
                    ) : working ? (
                        <CommerceGeneratingArtwork queued={!image.taskId || task?.status === "queued"} label={String(index + 1).padStart(2, "0")} />
                    ) : (
                        <span className="commerce-output-empty-card">{task?.error || _creationText("creation.1b130189d1a91ff1")}</span>
                    )}
                </button>
                <span className="commerce-output-card-check">
                    <Checkbox checked={selected} onChange={onSelect} aria-label={_creationText("creation.2ffe42fe72c6a4c8", { value1: index + 1 })} />
                </span>
            </div>
            <div className="commerce-output-card-meta">
                <span className="commerce-output-card-title" title={image.goal || image.theme || title}>
                    <strong>{title}</strong>
                    {image.goal || image.theme ? <small>{image.goal || image.theme}</small> : null}
                </span>
                <span className="commerce-output-status">{status}</span>
            </div>
            {image.copy ? <p className="commerce-output-card-copy">{image.copy}</p> : null}
            {issues?.length ? (
                <p className="commerce-output-issue">
                    {_creationText("creation.77d6bcc5c7f58c5a")}
                    {issues.join("；")}
                </p>
            ) : null}
            <footer>
                {failed ? (
                    <Button size="small" onClick={onRetry}>
                        {task!.canRecoverMedia ? _creationText("creation.e188062da724b515") : _creationText("common.retry")}
                    </Button>
                ) : null}
                <Button size="small" type="text" icon={<RotateCcw size={14} />} onClick={onEdit}>
                    {_creationText("creation.9ad86cd01d8c3a17")}
                </Button>
                {assetId && resourceId && onMakeVideo ? (
                    <Button size="small" type="text" icon={<Clapperboard size={14} />} onClick={() => onMakeVideo(resourceId)}>
                        {_creationText("creation.2d3668cdd3a4ad43")}
                    </Button>
                ) : null}
                {assetId && resourceId ? (
                    <Button size="small" type="text" icon={<ArrowDownToLine size={14} />} aria-label={_creationText("creation.460fb38cf2936b3b", { value1: index + 1 })} onClick={() => onDownload({ image, index, assetId, resourceId })} />
                ) : null}
                <Button size="small" type="text" icon={<Trash2 size={14} />} aria-label={_creationText("creation.44622278bd60f961", { value1: index + 1 })} onClick={onRemove} />
            </footer>
        </article>
    );
}

function outputSource(image: EcommercePlanImage, tasks: Record<string, GenerationTask>) {
    const task = image.taskId ? tasks[image.taskId] : undefined;
    try {
        const output = task?.status === "succeeded" ? parseBackendGenerationResult(task)?.images?.[0] : undefined;
        if (output?.storageKey) return resolveResourceVariantUrl(output.storageKey, "thumbnail");
        if (output?.dataUrl || task?.previewUrl) return output?.dataUrl || task?.previewUrl;
        if (image.resourceId) return resolveResourceVariantUrl(image.resourceId, "thumbnail");
    } catch {
        if (task?.previewUrl) return task.previewUrl;
    }
    return undefined;
}

function resourceFor(image: EcommercePlanImage, tasks: Record<string, GenerationTask>) {
    const task = image.taskId ? tasks[image.taskId] : undefined;
    try {
        return resourceIdFromStorageKey(task && parseBackendGenerationResult(task)?.images?.[0]?.storageKey) || image.resourceId;
    } catch {
        return image.resourceId;
    }
}

function regenerationPending(image: EcommercePlanImage, tasks: Record<string, GenerationTask>, generationPending: boolean, regeneratingIds: Set<string>) {
    const task = image.taskId ? tasks[image.taskId] : undefined;
    return regeneratingIds.has(image.id) || Boolean(image.taskId && (!task || ["queued", "running"].includes(task.status))) || (!image.taskId && generationPending);
}

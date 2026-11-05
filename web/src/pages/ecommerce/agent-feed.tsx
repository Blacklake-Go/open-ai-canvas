import { creationLabel as _creationLabel } from "@/supdance/plugins/i18n/creation-text";
import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { Button, Popover } from "antd";
import { Check, Images, LoaderCircle, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";
import { parseBackendGenerationResult } from "@/services/api/generation-task";
import { resolveResourceVariantUrl, resourceIdFromStorageKey } from "@/services/api/resources";
import type { GenerationTask } from "@/services/api/task-center";
import type { EcommerceCreativeDirection, EcommerceDraft, EcommercePlan, EcommercePlanImage } from "@/services/api/ecommerce";
import type { AiConfig } from "@/stores/use-config-store";
import { imageTypes, labelOf } from "./catalog";
import { SingleImageEditor } from "./result-gallery";
import { commerceCopyHasDirections } from "./consumer-copy";
import { commerceCanvasImages } from "./continuation";
import { writeCommerceImageTransfer } from "./image-transfer";

function imageSource(task?: GenerationTask) {
    if (!task || task.status !== "succeeded") return undefined;
    try {
        const result = parseBackendGenerationResult(task)?.images?.[0];
        if (result?.storageKey) return resolveResourceVariantUrl(result.storageKey, "thumbnail");
        if (result?.dataUrl) return result.dataUrl;
    } catch {
        /* Persisted previews may be unavailable for older tasks. */
    }
    return task.previewUrl;
}

export function EcommerceAgentFeed({
    direction,
    plan,
    tasks,
    config,
    draft,
    imageModels,
    imageCost,
    onRegenerate,
    onRetry,
    onFocus,
}: {
    direction: EcommerceCreativeDirection | null;
    plan: EcommercePlan | null;
    tasks: Record<string, GenerationTask>;
    config: AiConfig;
    draft: EcommerceDraft;
    imageModels: string[];
    imageCost: number | null;
    onRegenerate: (image: EcommercePlanImage) => Promise<void>;
    onRetry: (image: EcommercePlanImage) => void;
    onFocus: (id: string) => void;
}) {
    _useCreationLocale();
    const [editing, setEditing] = useState<string>();
    const [expanded, setExpanded] = useState<string>();
    const complete = plan?.images.filter((image) => image.taskId && imageSource(tasks[image.taskId])).length || 0;
    const total = commerceCanvasImages(plan).length;
    const submitted = plan?.images.some((image) => image.taskId);
    const active = submitted && plan?.images.some((image) => image.taskId && (!tasks[image.taskId] || !["succeeded", "failed", "cancelled"].includes(tasks[image.taskId].status)));
    return (
        <div className="commerce-agent-feed">
            {direction ? (
                <div className="commerce-direction-choice">
                    <small>{_creationText("creation.205081e8ec7f361c")}</small>
                    <strong data-i18n-user-content>{direction.name}</strong>
                    <span data-i18n-user-content>{direction.summary.split(" 知识约束：{")[0]}</span>
                </div>
            ) : null}
            {plan && active ? (
                <section className="commerce-generation-message" role="status" aria-label={_creationText("creation.17cd00dc4279e2b1")}>
                    <header>
                        <span className="commerce-generation-glyph">
                            <Sparkles size={17} />
                        </span>
                        <strong>{_creationText("creation.2f98e1405bc55307")}</strong>
                        <span>
                            {complete} / {total}
                        </span>
                    </header>
                    <div className="commerce-generation-visual">
                        <span className="commerce-yoru-glow" />
                        <Sparkles size={34} aria-label={_creationText("creation.e3e53287386be15a")} />
                        <span className="commerce-generation-particles" aria-hidden="true" />
                    </div>
                    <div className="commerce-generation-track" aria-label={_creationText("creation.dcd092b51591256a", { value1: complete, value2: total })}>
                        <span style={{ width: `${total ? (complete / total) * 100 : 0}%` }} />
                    </div>
                    <p>
                        <LoaderCircle size={14} className="commerce-planning-spin" />
                        {_creationText("creation.d51fce0ff15359dc")}
                    </p>
                </section>
            ) : null}
            {commerceCanvasImages(plan).map((image, index) => {
                const task = image.taskId ? tasks[image.taskId] : undefined;
                const src = imageSource(task);
                let resourceId = image.resourceId;
                try {
                    resourceId ||= task ? resourceIdFromStorageKey(parseBackendGenerationResult(task)?.images?.[0]?.storageKey) : undefined;
                } catch {
                    /* Legacy previews still provide their URL. */
                }
                if (!src && task && ["failed", "cancelled"].includes(task.status))
                    return (
                        <section className="commerce-generated-card" key={image.id} role="alert">
                            <header>
                                <span className="commerce-generation-glyph">
                                    <Images size={16} />
                                </span>
                                <strong>{_creationText("creation.7ac2ce454e355662", { value1: index + 1 })}</strong>
                            </header>
                            <p>{task.error || _creationText("creation.d3da3bae81110c4d")}</p>
                            <Button size="small" onClick={() => onRetry(image)}>
                                {task.canRecoverMedia ? _creationText("creation.f4d0e43e083c1b75") : _creationText("creation.353ec6bf7bb1d356")}
                            </Button>
                        </section>
                    );
                if (!src) return null;
                return (
                    <section className="commerce-generated-card" key={`${image.id}:${image.taskId}`} aria-label={_creationText("creation.76048fed25289692", { value1: index + 1 })}>
                        <header>
                            <span className="commerce-generation-glyph">
                                <Check size={16} />
                            </span>
                            <strong>{_creationText("workbench.generate_image_action")}</strong>
                            <small>
                                {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
                            </small>
                        </header>
                        <p>
                            {_creationLabel(labelOf(imageTypes, image.imageType))}
                            <span> · {image.ratio}</span>
                        </p>
                        <button type="button" className="commerce-generated-preview" onClick={() => onFocus(image.id)} aria-label={_creationText("creation.271257809c5b19b6", { value1: index + 1 })}>
                            <img
                                src={src}
                                alt={_creationText("creation.b889e911d73c1bdb", { value1: index + 1 })}
                                draggable
                                onDragStart={(event) => writeCommerceImageTransfer(event.dataTransfer, { resourceId, name: `第 ${index + 1} 张生成结果`, url: src })}
                            />
                        </button>
                        <footer>
                            <Popover
                                open={editing === image.id}
                                onOpenChange={(open) => setEditing(open ? image.id : undefined)}
                                trigger="click"
                                placement="rightTop"
                                destroyOnHidden
                                content={<SingleImageEditor key={`${image.id}:${image.taskId}`} config={config} draft={image.sourceDraft || draft} image={image} imageModels={imageModels} onClose={() => setEditing(undefined)} onGenerate={onRegenerate} />}
                            >
                                <Button size="small" icon={<RotateCcw size={14} />} onClick={() => setEditing(image.id)}>
                                    {_creationText("workbench.regenerate")}
                                    {imageCost == null ? "" : _creationText("creation.beec15b34b40a70e", { value1: imageCost.toLocaleString("zh-CN", { maximumFractionDigits: 3 }) })}
                                </Button>
                            </Popover>
                            <Button size="small" icon={<Images size={14} />} onClick={() => setExpanded((id) => (id === image.id ? undefined : image.id))} aria-expanded={expanded === image.id}>
                                {_creationText("creation.02fa591634a73800")}
                            </Button>
                        </footer>
                        {expanded === image.id ? (
                            <div className="commerce-generated-plan">
                                <strong>{_creationText("creation.5882ccf9684d82c6")}</strong>
                                <p>{image.performanceAngle || _creationText("creation.cf4ba1e7dedc36d9")}</p>
                                <strong>{_creationText("creation.0a9fbf9514a93869")}</strong>
                                <p>{image.informationComponent || _creationText("creation.f1eb8b8b996d3d39")}</p>
                                <strong>{_creationText("creation.be203d842d9d0490")}</strong>
                                <p style={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{!image.copy || commerceCopyHasDirections(image.copy) ? _creationText("creation.d954abe0b8828357") : image.copy}</p>
                            </div>
                        ) : null}
                    </section>
                );
            })}
        </div>
    );
}

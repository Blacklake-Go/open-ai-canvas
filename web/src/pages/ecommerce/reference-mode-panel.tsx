import { creationSource as _creationSource, creationLabel as _creationLabel } from "@/supdance/plugins/i18n/creation-text";
import { creationOptions as _creationOptions } from "@/supdance/plugins/i18n/creation-text";
import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { Select } from "antd";
import { Images, LoaderCircle, Upload, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { EcommerceDraft, EcommerceReference, EcommerceReferenceMode, EcommerceReferenceScreen } from "@/services/api/ecommerce";
import { resourceStorageKey } from "@/services/api/resources";
import { CachedResourceImage } from "@/components/cached-resource-image";
import { COMMERCE_IMAGE_ACCEPT, mightContainCommerceImage, readCommerceImageTransfer, type CommerceImageTransfer } from "./image-transfer";

const modeOptions: Array<{ value: EcommerceReferenceMode; label: string; description: string }> = [
    { value: "product", label: "商品自主策划", description: "根据商品图和已确认资料，自主设计卖点、场景、文案与画面。" },
    { value: "style", label: "参考风格与排版", description: "借鉴下方图片的色彩、构图与排版，用上方自己的商品和已核实资料重新策划。" },
    { value: "detail", label: "长图详情页逐屏参考", description: "按上传顺序识别每张长图中每一屏的内容、排版与画面，逐屏策划生成。" },
];
const uploadLabels: Record<EcommerceReferenceMode, string> = { product: "商品图", style: "风格与排版参考图", detail: "逐屏参考长图" };
const fallbackNames: Record<EcommerceReferenceMode, string> = { product: "商品参考图", style: "风格参考图", detail: "详情长图" };

function referenceName(reference: EcommerceReference, mode: EcommerceReferenceMode, index?: number) {
    const name = reference.name?.trim() || "";
    const stem = name.replace(/\.[a-z0-9]{2,8}$/i, "");
    const opaque =
        !name || name === reference.resourceId || (reference.resourceId.length >= 16 && name.includes(reference.resourceId)) || /[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}/i.test(name) || /^(?:resource:)?[a-f\d]{24,64}$/i.test(stem);
    return opaque ? `${fallbackNames[mode]}${index == null ? "" : ` ${index + 1}`}` : name;
}

function ReferenceThumbnail({ reference, name }: { reference: EcommerceReference; name: string }) {
    _useCreationLocale();
    return (
        <CachedResourceImage
            storageKey={resourceStorageKey(reference.resourceId)}
            variant="thumbnail"
            alt={name}
            loading="lazy"
            decoding="async"
            fallback={
                <span className="ecommerce-reference-thumbnail-empty" aria-label={_creationText("creation.62cab5ebabfe9c33")}>
                    <Images size={22} />
                </span>
            }
            loadingFallback={
                <span className="ecommerce-reference-thumbnail-empty" aria-label={_creationText("creation.df1d3ca46a0479b0")}>
                    <LoaderCircle size={18} />
                </span>
            }
        />
    );
}

export function ReferenceModePanel({
    draft,
    onChange,
    onUpload,
    uploading = false,
    uploadProgress,
}: {
    draft: EcommerceDraft;
    onChange: (patch: Partial<EcommerceDraft>) => void;
    onUpload: (source: CommerceImageTransfer, mode: EcommerceReferenceMode) => Promise<void>;
    uploading?: boolean;
    uploadProgress?: string;
}) {
    _useCreationLocale();
    const fileInput = useRef<HTMLInputElement>(null);
    const mounted = useRef(false);
    const lock = useRef(false);
    const depth = useRef(0);
    const lastUpload = useRef<{ source: CommerceImageTransfer; mode: EcommerceReferenceMode } | undefined>(undefined);
    const [pending, setPending] = useState(false);
    const [batchProgress, setBatchProgress] = useState("");
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState<string | { succeeded: number; failed: number; messages: string[] }>("");
    const helpId = useId();
    const busy = uploading || pending;
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    const mode = modeOptions.find((option) => option.value === draft.referenceMode) || modeOptions[0];
    const references = draft.layoutReferences || [];
    const label = uploadLabels[mode.value];

    const chooseMode = (value: EcommerceReferenceMode) => {
        if (busy || lock.current) return;
        setError("");
        lastUpload.current = undefined;
        onChange({ referenceMode: value, ...(value === "detail" ? { imageType: "detail" } : {}) });
    };
    const removeReference = (index: number) => {
        if (busy || lock.current) return;
        setError("");
        lastUpload.current = undefined;
        onChange({ layoutReferences: references.filter((_, position) => position !== index) });
    };
    const upload = async (source: CommerceImageTransfer, uploadMode = mode.value) => {
        if (!mounted.current || uploading || lock.current) return;
        if (!source.files.length && !source.resourceId && !source.url) {
            lastUpload.current = undefined;
            setError(_creationSource("creation.556abe0365cd68e3"));
            return;
        }
        lock.current = true;
        setPending(true);
        setError("");
        lastUpload.current = undefined;
        const items: CommerceImageTransfer[] = source.files.length ? source.files.map((file) => ({ files: [file] })) : [source];
        const failed: CommerceImageTransfer[] = [];
        const messages: string[] = [];
        try {
            for (const [index, item] of items.entries()) {
                if (!mounted.current) return;
                const name = item.files[0]?.name || item.name || uploadLabels[uploadMode];
                setBatchProgress(`正在添加 ${index + 1}/${items.length} · ${name}`);
                try {
                    await onUpload(item, uploadMode);
                } catch (cause) {
                    if (!mounted.current) return;
                    failed.push(item);
                    messages.push(`${name}：${cause instanceof Error ? cause.message : "图片上传失败，请重试"}`);
                }
                if (!mounted.current) return;
            }
            if (failed.length) {
                lastUpload.current = { source: source.files.length ? { files: failed.flatMap((item) => item.files) } : source, mode: uploadMode };
                setError({ succeeded: items.length - failed.length, failed: failed.length, messages });
            }
        } finally {
            lock.current = false;
            if (mounted.current) {
                setPending(false);
                setBatchProgress("");
            }
        }
    };
    return (
        <section className="ecommerce-reference-mode" aria-label={_creationText("creation.ad089917b9c00809")}>
            <Select<EcommerceReferenceMode>
                variant="filled"
                aria-label={_creationText("creation.b8aa0ea123dadae0")}
                value={mode.value}
                options={_creationOptions(modeOptions.map(({ value, label }) => ({ value, label })))}
                onChange={chooseMode}
                disabled={busy}
            />
            {mode.value === "product" ? (
                <p className="ecommerce-reference-mode-description">{_creationText("creation.34551ab493ec3f5c")}</p>
            ) : (
                <>
                    <p className="ecommerce-reference-mode-description">{mode.description}</p>
                    <div
                        className={`ecommerce-reference-upload${dragging ? " is-dragging" : ""}`}
                        role="group"
                        aria-label={_creationText("creation.8ee1cbc105527e1b", { value1: label })}
                        aria-busy={busy}
                        aria-describedby={helpId}
                        tabIndex={0}
                        onDragEnter={(event) => {
                            if (!mightContainCommerceImage(event.dataTransfer)) return;
                            event.preventDefault();
                            depth.current += 1;
                            setDragging(true);
                        }}
                        onDragOver={(event) => {
                            if (!mightContainCommerceImage(event.dataTransfer)) return;
                            event.preventDefault();
                            event.dataTransfer.dropEffect = busy ? "none" : "copy";
                        }}
                        onDragLeave={() => {
                            depth.current = Math.max(0, depth.current - 1);
                            if (!depth.current) setDragging(false);
                        }}
                        onDrop={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            depth.current = 0;
                            setDragging(false);
                            void upload(readCommerceImageTransfer(event.dataTransfer));
                        }}
                        onPaste={(event) => {
                            if ((event.target as HTMLElement).closest('textarea,input:not([type="file"]),[contenteditable="true"]')) return;
                            const source = readCommerceImageTransfer(event.clipboardData);
                            if (!source.files.length && !source.resourceId && !source.url) return;
                            event.preventDefault();
                            event.stopPropagation();
                            void upload(source);
                        }}
                    >
                        {references.length ? (
                            <ol className="ecommerce-reference-gallery" aria-label={_creationText("creation.a5d8be8ac872a701")}>
                                {references.map((reference, index) => {
                                    const name = referenceName(reference, mode.value, index);
                                    return (
                                        <li key={`${reference.resourceId}:${index}`}>
                                            <ReferenceThumbnail reference={reference} name={name} />
                                            <span className="ecommerce-reference-gallery-name" title={name}>
                                                <small>{index + 1}</small>
                                                {name}
                                            </span>
                                            <button
                                                type="button"
                                                aria-label={_creationText("creation.cdac26bfd8ec3501", { value1: name })}
                                                title={_creationText("creation.cdac26bfd8ec3501", { value1: name })}
                                                disabled={busy}
                                                onClick={() => removeReference(index)}
                                            >
                                                <X size={13} aria-hidden="true" />
                                            </button>
                                        </li>
                                    );
                                })}
                            </ol>
                        ) : null}
                        <button type="button" className="ecommerce-reference-upload-button" disabled={busy} aria-label={_creationText("creation.29726226fcf92696", { value1: label })} onClick={() => fileInput.current?.click()}>
                            <Upload size={25} strokeWidth={1.5} aria-hidden="true" />
                            <span>
                                <strong>{references.length ? _creationText("creation.80d077eed19adca0", { value1: label }) : _creationText("creation.e1a6195880a6ef55", { value1: label })}</strong>
                                <small>{busy ? _creationText("creation.6148b38691e3018e") : dragging ? _creationText("creation.3f8982b5ff9bbfbd") : _creationText("creation.d30966194d45df0a")}</small>
                            </span>
                        </button>
                        <input
                            ref={fileInput}
                            type="file"
                            multiple
                            hidden
                            aria-label={_creationText("creation.57281dccbd735fab", { value1: label })}
                            accept={COMMERCE_IMAGE_ACCEPT}
                            disabled={busy}
                            onChange={(event) => {
                                const files = Array.from(event.target.files || []);
                                event.target.value = "";
                                if (files.length) void upload({ files });
                            }}
                        />
                    </div>
                    <p id={helpId} className="ecommerce-reference-upload-help">
                        {_creationText("creation.681ca9c8ac740d3e")}
                    </p>
                    {busy ? (
                        <p className="ecommerce-reference-upload-status" role="status">
                            <LoaderCircle size={13} className="commerce-planning-spin" />
                            {_creationLabel(batchProgress || uploadProgress || _creationText("creation.ebbeec0c9eff4ec6"))}
                        </p>
                    ) : null}
                    {error ? (
                        <div className="ecommerce-reference-upload-error" role="alert">
                            <span>
                                {typeof error === "string"
                                    ? _creationLabel(error)
                                    : _creationText("creation.a5b57c65dbb45bb8", { value1: error.succeeded ? _creationText("creation.ad46aafc52ff1b5b", { value1: error.succeeded }) : "", value2: error.failed, value3: error.messages.join("；") })}
                            </span>
                            {lastUpload.current ? (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                        if (lastUpload.current) void upload(lastUpload.current.source, lastUpload.current.mode);
                                    }}
                                >
                                    {_creationText("creation.73299253274b98cd")}
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                    {!references.length ? (
                        <p className="sr-only" role="status">
                            {_creationText("creation.6c76f755e213e8ef")}
                        </p>
                    ) : null}
                </>
            )}
        </section>
    );
}

export function ReferenceScreenSummary({ screen }: { screen?: EcommerceReferenceScreen }) {
    _useCreationLocale();
    if (!screen) return null;
    return (
        <div className="ecommerce-reference-screen-summary" aria-label={_creationText("creation.caa281dd112b674b", { value1: screen.screenIndex })}>
            <strong>{_creationText("creation.4fa696f7f4a4f4b2", { value1: screen.screenIndex })}</strong>
            {screen.resourceId ? (
                <CachedResourceImage
                    className="ecommerce-reference-screen-preview"
                    storageKey={resourceStorageKey(screen.resourceId)}
                    variant="thumbnail"
                    alt={_creationText("creation.0018dfbcf3d383f1", { value1: screen.screenIndex })}
                    loading="lazy"
                    decoding="async"
                    fallback={
                        <span className="ecommerce-reference-thumbnail-empty" aria-label={_creationText("creation.62cab5ebabfe9c33")}>
                            <Images size={22} />
                        </span>
                    }
                    loadingFallback={
                        <span className="ecommerce-reference-thumbnail-empty" aria-label={_creationText("creation.df1d3ca46a0479b0")}>
                            <LoaderCircle size={18} />
                        </span>
                    }
                />
            ) : null}
            <dl>
                <div>
                    <dt>{_creationText("creation.7a688306423bec17")}</dt>
                    <dd>{screen.content}</dd>
                </div>
                <div>
                    <dt>{_creationText("creation.29d5eedb72ef1b1d")}</dt>
                    <dd>{screen.layout}</dd>
                </div>
                <div>
                    <dt>{_creationText("tasks.visual_frame")}</dt>
                    <dd>{screen.visual}</dd>
                </div>
            </dl>
            {screen.sourceCopy ? (
                <details>
                    <summary>{_creationText("creation.3102cc3ed8fe6c06")}</summary>
                    <p>{screen.sourceCopy}</p>
                </details>
            ) : null}
        </div>
    );
}

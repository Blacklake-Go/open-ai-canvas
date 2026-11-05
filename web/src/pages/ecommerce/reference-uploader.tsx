import { creationSource as _creationSource, creationLabel as _creationLabel } from "@/supdance/plugins/i18n/creation-text";
import { creationOptions as _creationOptions } from "@/supdance/plugins/i18n/creation-text";
import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { Plus, X } from "lucide-react";
import { Popover, Select } from "antd";
import { useRef, useState } from "react";
import { resourceFileUrl, resourceStorageKey } from "@/services/api/resources";
import { CachedResourceImage } from "@/components/cached-resource-image";
import type { EcommerceReference, EcommerceReferenceRole } from "@/services/api/ecommerce";
import { CommerceHint } from "./commerce-hint";
import { COMMERCE_IMAGE_ACCEPT, mightContainCommerceImage, readCommerceImageTransfer, writeCommerceImageTransfer, type CommerceImageTransfer } from "./image-transfer";
import "./reference-uploader.css";

export const referenceRoleOptions = [
    { value: "primary", label: "商品主图" },
    { value: "detail", label: "细节参考" },
    { value: "sku", label: "SKU 参考" },
    { value: "logo", label: "品牌 Logo" },
    { value: "package", label: "包装图" },
];

export function ReferenceUploader({
    references,
    uploading,
    uploadProgress,
    maxReferences = 24,
    compact = false,
    onUpload,
    onTransfer,
    onChange,
}: {
    references: EcommerceReference[];
    uploading: boolean;
    uploadProgress?: string;
    maxReferences?: number;
    compact?: boolean;
    onUpload: (files: File[]) => void | Promise<void>;
    onTransfer: (source: CommerceImageTransfer) => void | Promise<void>;
    onChange: (references: EcommerceReference[]) => void;
}) {
    _useCreationLocale();
    const [dragging, setDragging] = useState(false);
    const [pending, setPending] = useState(false);
    const [previews, setPreviews] = useState<Array<{ name: string; url: string }>>([]);
    const [error, setError] = useState("");
    const lock = useRef(false);
    const depth = useRef(0);
    const busy = uploading || pending;
    const full = references.length >= maxReferences;
    const run = async (action: () => void | Promise<void>, files: File[] = []) => {
        if (uploading || lock.current) {
            setError(_creationSource("creation.585b353aacad2ffa"));
            return;
        }
        if (full) {
            setError(_creationSource("creation.27a987e5b3615d23"));
            return;
        }
        lock.current = true;
        setPending(true);
        setError("");
        const nextPreviews = files.filter((file) => file.type.startsWith("image/")).map((file) => ({ name: file.name, url: URL.createObjectURL(file) }));
        setPreviews(nextPreviews);
        try {
            await action();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : _creationSource("creation.3e54faa0442c241e"));
        } finally {
            lock.current = false;
            setPending(false);
            setPreviews([]);
            nextPreviews.forEach((item) => URL.revokeObjectURL(item.url));
        }
    };
    const tiles = references.map((ref, index) => {
        const thumbnail = (
            <CachedResourceImage
                storageKey={resourceStorageKey(ref.resourceId)}
                alt={ref.name || _creationText("creation.cf7b6e13d4ecaecd")}
                loading="lazy"
                decoding="async"
                draggable
                onDragStart={(event) => writeCommerceImageTransfer(event.dataTransfer, { resourceId: ref.resourceId, name: ref.name || "商品参考图", url: resourceFileUrl(ref.resourceId) })}
                fallback={<span className="commerce-reference-item-image-fallback" aria-label={_creationText("creation.62cab5ebabfe9c33")} />}
                loadingFallback={<span className="commerce-reference-item-image-fallback" aria-label={_creationText("creation.df1d3ca46a0479b0")} />}
            />
        );
        return (
            <div className="commerce-reference-item" key={`${ref.resourceId}-${index}`} title={compact ? undefined : ref.name || _creationText("creation.4c61b585b81f81b8", { value1: index + 1 })}>
                {/* 紧凑模式缩略图很小，悬停时放大预览，便于确认上传的是哪张商品图。 */}
                {compact ? (
                    <Popover
                        placement="top"
                        arrow={false}
                        mouseEnterDelay={0.35}
                        classNames={{ root: "commerce-reference-preview-popover" }}
                        content={
                            <figure className="commerce-reference-preview">
                                <CachedResourceImage storageKey={resourceStorageKey(ref.resourceId)} alt={ref.name || _creationText("creation.929d5f299fc6db73")} decoding="async" />
                                <figcaption>{ref.name || _creationText("creation.4c61b585b81f81b8", { value1: index + 1 })}</figcaption>
                            </figure>
                        }
                    >
                        <span className="commerce-reference-thumb">{thumbnail}</span>
                    </Popover>
                ) : (
                    thumbnail
                )}
                <div className="commerce-reference-item-actions">
                    {!compact ? (
                        <Select
                            aria-label={_creationText("creation.4a0f689945622286", { value1: index + 1 })}
                            size="small"
                            value={ref.role}
                            options={_creationOptions(referenceRoleOptions)}
                            disabled={busy}
                            popupMatchSelectWidth={180}
                            onChange={(role: EcommerceReferenceRole) => onChange(references.map((item, i) => (i === index ? { ...item, role } : item)))}
                        />
                    ) : null}
                    <CommerceHint text={_creationText("creation.c5e70c1fb406d5e5")}>
                        <button className="commerce-reference-remove" type="button" aria-label={_creationText("creation.efb4eee3221b49ea", { value1: index + 1 })} disabled={busy} onClick={() => onChange(references.filter((_, i) => i !== index))}>
                            <X size={13} />
                        </button>
                    </CommerceHint>
                </div>
            </div>
        );
    });
    const addTile = (
        <CommerceHint text={_creationText("creation.e3188cf705ce33bd")}>
            <label className={`commerce-reference-add ${busy ? "is-uploading" : ""}`}>
                {busy ? <span className="commerce-reference-spinner" aria-hidden="true" /> : <Plus size={25} strokeWidth={1.5} aria-hidden="true" />}
                <span>
                    {busy
                        ? _creationText("creation.ce1c9d61565f624b")
                        : full
                          ? _creationText("creation.127831b7aeebf843")
                          : dragging
                            ? _creationText("creation.76b28755012dc03f")
                            : references.length
                              ? _creationText("creation.1f1167a9f7b50b27")
                              : compact
                                ? _creationText("creation.2b05cc6bb7876585")
                                : _creationText("creation.4bac9633636ccc85")}
                </span>
                <input
                    type="file"
                    aria-label={_creationText("creation.6c85890723f199cf")}
                    accept={COMMERCE_IMAGE_ACCEPT}
                    multiple
                    disabled={busy || full}
                    onChange={(event) => {
                        const files = Array.from(event.target.files || []);
                        event.target.value = "";
                        if (files.length) void run(() => onUpload(files), files);
                    }}
                />
            </label>
        </CommerceHint>
    );
    return (
        <section
            className={`commerce-reference-dropzone${dragging ? " is-dragging" : ""}${compact ? " is-compact" : ""}`}
            aria-label={_creationText("creation.caaa9f6cf6de2d87")}
            tabIndex={0}
            aria-busy={busy}
            aria-describedby="commerce-reference-help"
            onDragEnter={(event) => {
                if (!mightContainCommerceImage(event.dataTransfer)) return;
                event.preventDefault();
                depth.current += 1;
                setDragging(true);
            }}
            onDragOver={(event) => {
                if (!mightContainCommerceImage(event.dataTransfer)) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = busy || full ? "none" : "copy";
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
                const source = readCommerceImageTransfer(event.dataTransfer);
                void run(() => onTransfer(source), source.files);
            }}
            onPaste={(event) => {
                const target = event.target as HTMLElement;
                if (target.closest('textarea,input:not([type="file"]),[contenteditable="true"],[role="combobox"]')) return;
                const source = readCommerceImageTransfer(event.clipboardData);
                if (!source.files.length && !source.resourceId && !source.url) return;
                event.preventDefault();
                event.stopPropagation();
                void run(() => onTransfer(source), source.files);
            }}
        >
            {/* 紧凑模式由外层区块提供标题与说明，这里不再重复。 */}
            {compact ? null : (
                <>
                    <strong>{_creationText("creation.2be75d9968af021a")}</strong>
                    <p className="commerce-reference-help">{_creationText("creation.5147a1f77f9e95c2")}</p>
                </>
            )}
            <div className="commerce-reference-list" aria-label={_creationText("creation.bdfe0a56a07022bc")}>
                {compact ? addTile : null}
                {tiles}
                {previews.map((item, index) => (
                    <div className="commerce-reference-item is-pending" key={`${item.url}-${index}`}>
                        <img src={item.url} alt={_creationText("creation.c59b602c7eb9b13e", { value1: item.name })} />
                        <span className="commerce-reference-pending-pulse" aria-hidden="true" />
                    </div>
                ))}
                {!compact ? addTile : null}
            </div>
            <p id="commerce-reference-help" className={compact ? "sr-only" : "commerce-reference-help"}>
                {_creationText("creation.62fd1ef953a19b4f")}
            </p>
            {busy ? (
                <p className="commerce-reference-status" role="status">
                    {uploadProgress || _creationText("creation.ebbeec0c9eff4ec6")}
                </p>
            ) : null}
            {error ? (
                <p className="commerce-reference-error" role="alert">
                    {_creationLabel(error)}
                </p>
            ) : null}
        </section>
    );
}

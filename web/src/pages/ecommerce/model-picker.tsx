import { creationOptions as _creationOptions } from "@/supdance/plugins/i18n/creation-text";
import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { App, Button, Modal, Select, Switch } from "antd";
import { Check, Images, Search, Trash2, ZoomIn } from "lucide-react";
import { useState } from "react";
import { resourceStorageKey } from "@/services/api/resources";
import { CachedResourceImage } from "@/components/cached-resource-image";
import type { EcommerceReference } from "@/services/api/ecommerce";
import { commerceModelCatalog, commerceModelById, type CommerceModelProfile } from "./model-catalog";
import "./model-picker.css";

type Props = {
    enabled: boolean;
    references: EcommerceReference[];
    primaryId?: string;
    uploading: boolean;
    onEnabledChange: (enabled: boolean) => void;
    onUpload: (files: FileList | null) => void;
    onAddCatalog: (profile: CommerceModelProfile) => Promise<void>;
    onRemove: (resourceId: string) => void;
    onPrimary: (resourceId: string) => void;
};

export function EcommerceModelPicker({ enabled, references, primaryId, uploading, onEnabledChange, onUpload, onAddCatalog, onRemove, onPrimary }: Props) {
    const { message } = App.useApp();
    _useCreationLocale();
    const [open, setOpen] = useState(false);
    const [preview, setPreview] = useState<CommerceModelProfile | null>(null);
    const [kind, setKind] = useState("all");
    const [gender, setGender] = useState("all");
    const [age, setAge] = useState("all");
    const [country, setCountry] = useState("all");
    const [adding, setAdding] = useState("");
    const visible = commerceModelCatalog.filter((item) => (kind === "all" || item.kind === kind) && (gender === "all" || item.gender === gender) && (age === "all" || item.age === age) && (country === "all" || item.country === country));
    const add = async (profile: CommerceModelProfile) => {
        if (references.some((ref) => ref.catalogId === profile.id)) return;
        setAdding(profile.id);
        try {
            await onAddCatalog(profile);
            message.success(_creationText("creation.d1ce43a656bdb349", { value1: profile.name }));
        } catch (cause) {
            message.error(cause instanceof Error ? cause.message : _creationText("creation.c71d226055cfe7bf"));
        } finally {
            setAdding("");
        }
    };
    return (
        <section className="ecommerce-model-picker" aria-label={_creationText("creation.d1f951b44b0552e2")}>
            <div className="ecommerce-model-heading">
                <strong>{_creationText("creation.d1f951b44b0552e2")}</strong>
                <div>
                    <span>{_creationText("creation.5e9986b3000e0796")}</span>
                    <Switch aria-label={_creationText("creation.5e9986b3000e0796")} checked={enabled} onChange={onEnabledChange} />
                    <Button size="small" icon={<Images size={14} />} onClick={() => setOpen(true)}>
                        {_creationText("creation.7fec76336a340f5a")}
                    </Button>
                </div>
            </div>
            {enabled ? (
                <>
                    <p className="ecommerce-model-hint">{_creationText("creation.756d92495edcfd46")}</p>
                    <div className="ecommerce-model-refs">
                        {references.map((ref) => (
                            <div className="ecommerce-model-ref" key={ref.resourceId}>
                                <CachedResourceImage
                                    storageKey={resourceStorageKey(ref.resourceId)}
                                    alt={ref.name || _creationText("creation.d1f951b44b0552e2")}
                                    loading="lazy"
                                    decoding="async"
                                    fallback={<span className="ecommerce-model-ref-image-fallback" aria-label={_creationText("creation.62cab5ebabfe9c33")} />}
                                    loadingFallback={<span className="ecommerce-model-ref-image-fallback" aria-label={_creationText("creation.df1d3ca46a0479b0")} />}
                                />
                                <div>
                                    <strong>{ref.name || commerceModelById(ref.catalogId)?.name || _creationText("creation.29a998dc64e0b176")}</strong>
                                    <Button
                                        type="text"
                                        size="small"
                                        aria-label={_creationText("creation.2afa105648800787", { value1: ref.name || _creationText("workbench.model_person") })}
                                        icon={<Trash2 size={13} />}
                                        onClick={() => onRemove(ref.resourceId)}
                                    />
                                </div>
                                <Select
                                    size="small"
                                    aria-label={_creationText("creation.dd0c8119a6747bef", { value1: ref.name || _creationText("workbench.model_person") })}
                                    value={primaryId === ref.resourceId ? "primary" : "support"}
                                    options={_creationOptions([
                                        { value: "primary", label: "主模特 · 全套贯穿" },
                                        { value: "support", label: "辅助模特 · 仅多人画面" },
                                    ])}
                                    onChange={(value) => {
                                        if (value === "primary") onPrimary(ref.resourceId);
                                        else if (primaryId === ref.resourceId) onPrimary(references.find((item) => item.resourceId !== ref.resourceId)?.resourceId || ref.resourceId);
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                    <label className="ecommerce-model-upload">
                        {uploading ? _creationText("creation.ce1c9d61565f624b") : _creationText("creation.4a6acdd65ba5d485")}
                        <input
                            type="file"
                            aria-label={_creationText("creation.50ef78f781e534ab")}
                            accept="image/png,image/jpeg,image/webp"
                            multiple
                            disabled={uploading}
                            onChange={(event) => {
                                onUpload(event.target.files);
                                event.target.value = "";
                            }}
                        />
                    </label>
                </>
            ) : (
                <p className="ecommerce-model-hint">{_creationText("creation.2b3c064647a7ab91")}</p>
            )}
            <Modal title={_creationText("creation.ec594a29ea4bac26")} open={open} onCancel={() => setOpen(false)} footer={<Button onClick={() => setOpen(false)}>{_creationText("settings.channel_complete_btn")}</Button>} width={1000} destroyOnHidden>
                <p className="ecommerce-model-hint">{_creationText("creation.e9e2191b507a0d81")}</p>
                <div className="ecommerce-model-filters">
                    <Select
                        aria-label={_creationText("creation.342175d9c517819e")}
                        value={kind}
                        onChange={setKind}
                        options={_creationOptions([
                            { value: "all", label: "真人与假人" },
                            { value: "person", label: "真人模特" },
                            { value: "mannequin", label: "服装假人" },
                        ])}
                    />
                    <Select
                        aria-label={_creationText("creation.a752a7d8c127ff15")}
                        value={gender}
                        onChange={setGender}
                        options={_creationOptions([
                            { value: "all", label: "不限性别" },
                            { value: "female", label: "女" },
                            { value: "male", label: "男" },
                        ])}
                    />
                    <Select
                        aria-label={_creationText("creation.9ee831fcb82d7223")}
                        value={age}
                        onChange={setAge}
                        options={_creationOptions([
                            { value: "all", label: "不限年龄" },
                            { value: "child", label: "儿童" },
                            { value: "adult", label: "成人" },
                            { value: "mature", label: "银发" },
                        ])}
                    />
                    <Select
                        aria-label={_creationText("creation.ac003e6249916516")}
                        value={country}
                        onChange={setCountry}
                        options={_creationOptions([{ value: "all", label: "全部市场" }, ...[...new Set(commerceModelCatalog.map((item) => item.country))].map((value) => ({ value, label: value }))])}
                    />
                </div>
                <div className="ecommerce-model-grid">
                    {visible.map((item) => {
                        const selected = references.some((ref) => ref.catalogId === item.id);
                        return (
                            <article className="ecommerce-model-card" key={item.id}>
                                <div className="ecommerce-model-card-image">
                                    <button type="button" className="ecommerce-model-image-open" aria-label={_creationText("creation.e801fe38e4d099ae", { value1: item.name })} onClick={() => setPreview(item)}>
                                        <img src={item.image} alt={_creationText("creation.f0801523caa6861f", { value1: item.name })} loading="lazy" />
                                    </button>
                                    <div className="ecommerce-model-card-actions">
                                        <Button icon={<ZoomIn size={14} />} onClick={() => setPreview(item)}>
                                            {_creationText("assets.zoom_in")}
                                        </Button>
                                        <Button type={selected ? "default" : "primary"} icon={selected ? <Check size={14} /> : <Search size={14} />} loading={adding === item.id} disabled={selected || Boolean(adding)} onClick={() => void add(item)}>
                                            {selected ? _creationText("creation.8f5e05481beaf43d") : _creationText("creation.ea18760322ebd3f0")}
                                        </Button>
                                    </div>
                                </div>
                                <strong>{item.name}</strong>
                                <small>{item.description}</small>
                            </article>
                        );
                    })}
                </div>
            </Modal>
            <Modal
                title={preview?.name || _creationText("creation.3e6247e7b8f807fb")}
                open={Boolean(preview)}
                onCancel={() => setPreview(null)}
                footer={
                    preview ? (
                        <Button type="primary" disabled={references.some((ref) => ref.catalogId === preview.id)} loading={adding === preview.id} onClick={() => void add(preview)}>
                            {references.some((ref) => ref.catalogId === preview.id) ? _creationText("creation.8f5e05481beaf43d") : _creationText("creation.0fe812d4e3b0cad5")}
                        </Button>
                    ) : null
                }
                width={1120}
            >
                {preview ? <img className="ecommerce-model-preview" src={preview.image} alt={_creationText("creation.25f4ec74c344650f", { value1: preview.name })} /> : null}
            </Modal>
        </section>
    );
}

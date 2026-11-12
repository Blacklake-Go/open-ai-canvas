import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { App, Button, Input, InputNumber } from "antd";
import { AlertCircle, Check, Pencil, Plus, Shirt, Trash2, X, Play, Upload, Library } from "lucide-react";

import { addDramaCastLook, deleteDramaCastLook, updateDramaCastLook, regenerateDramaCast, setDramaCastImage, updateDramaCast, type DramaCast, type DramaCastImageStyle } from "@/services/api/drama";
import { CanvasImagePreview } from "@/components/canvas/canvas-image-preview";
import { CastImageFields, type CastImageFieldsValue } from "./cast-image-fields";
import { uploadResourceFile } from "@/services/api/resources";
import { CastLibraryPicker } from "./cast-library-picker";

import { mediaBusy, MediaThumb } from "../drama-shared";

const MAX_LOOKS = 6;
type LookInput = DramaCastImageStyle & { lookName: string; appearance: string; imagePrompt: string; fromChapter?: number; toChapter?: number };

function chapterLabel(from?: number, to?: number) {
    if (from && to) return `第 ${from}–${to} 章`;
    if (from) return `第 ${from} 章起`;
    if (to) return `第 ${to} 章前`;
    return "不限章节";
}

/** 一套造型的编辑表单（新增或修改共用）。 */
function LookForm({ projectId, initial, submitting, onCancel, onSubmit }: { projectId: string; initial?: DramaCast; submitting: boolean; onCancel: () => void; onSubmit: (value: LookInput) => void }) {
    _useCreationLocale();
    const [name, setName] = useState(initial?.lookName || "");
    const [appearance, setAppearance] = useState(initial?.appearance || "");
    const [imageFields, setImageFields] = useState<CastImageFieldsValue>({
        imagePrompt: initial?.imagePrompt || "",
        imageStyleId: initial?.imageStyleId || "",
        imageStyleName: initial?.imageStyleName || "",
        imageStylePrompt: initial?.imageStylePrompt || "",
    });
    const [from, setFrom] = useState<number | null>(initial?.lookFromChapter || null);
    const [to, setTo] = useState<number | null>(initial?.lookToChapter || null);
    const valid = name.trim() && appearance.trim();
    return (
        <div className="drama-look-form">
            <Input value={name} maxLength={60} placeholder={_creationText("creation.b112a3329a5b8770")} aria-label={_creationText("creation.6c1622f1d7915c66")} onChange={(event) => setName(event.target.value)} />
            <Input.TextArea
                value={appearance}
                maxLength={1000}
                autoSize={{ minRows: 2, maxRows: 5 }}
                placeholder={_creationText("creation.53e192ade07f0417")}
                aria-label={_creationText("creation.956d263c09612b3c")}
                onChange={(event) => setAppearance(event.target.value)}
            />
            <CastImageFields projectId={projectId} castId={initial?.id} appearance={appearance} value={imageFields} disabled={submitting} onChange={(patch) => setImageFields((current) => ({ ...current, ...patch }))} />
            <div className="drama-look-form-range">
                <span>{_creationText("creation.2d4d8c540ceb37fc")}</span>
                <InputNumber size="small" min={0} precision={0} value={from} placeholder={_creationText("creation.0d7a3e72696addf7")} aria-label={_creationText("creation.0d7a3e72696addf7")} onChange={(value) => setFrom(value)} />
                <span>{_creationText("creation.65edbf9f1c677e70")}</span>
                <InputNumber size="small" min={0} precision={0} value={to} placeholder={_creationText("creation.64ca7b6d0bc78870")} aria-label={_creationText("creation.64ca7b6d0bc78870")} onChange={(value) => setTo(value)} />
                <small>{_creationText("creation.220a1b5de1dee3fd")}</small>
            </div>
            <div className="drama-look-form-actions">
                <Button size="small" icon={<X className="size-3.5" />} onClick={onCancel}>
                    {_creationText("common.cancel")}
                </Button>
                <Button
                    size="small"
                    type="primary"
                    icon={<Check className="size-3.5" />}
                    loading={submitting}
                    disabled={!valid}
                    onClick={() => onSubmit({ ...imageFields, lookName: name.trim(), appearance: appearance.trim(), imagePrompt: (imageFields.imagePrompt || "").trim(), fromChapter: from ?? 0, toChapter: to ?? 0 })}
                >
                    {_creationText("creation.4a1edb18155e988e")}
                </Button>
            </div>
        </div>
    );
}

/**
 * 角色造型（多妆造）：一个角色可有多套造型（如散修 / 外门弟子 / 内门弟子 / 长老），每套有自己的外观与参考图，
 * 以角色本体参考图为底图生成以保持同一张脸。写剧本时按本集章节选默认造型，AI 也会按剧情在镜头里换造型。
 */
export function CastLooks({ projectId, character, looks, restyle, onChanged }: { projectId: string; character: DramaCast; looks: DramaCast[]; restyle: boolean; onChanged: () => void }) {
    _useCreationLocale();
    const { message, modal } = App.useApp();
    const [adding, setAdding] = useState(false);
    const [editingId, setEditingId] = useState<string>();
    const [libraryLook, setLibraryLook] = useState<DramaCast>();
    const [previewLook, setPreviewLook] = useState<DramaCast>();
    const fileRef = useRef<HTMLInputElement>(null);
    const uploadLookRef = useRef<DramaCast | undefined>(undefined);
    const done = (text: string, affected?: number) => {
        message.success(affected ? _creationText("creation.a0e033aeda422328", { value1: text, value2: affected }) : text);
        setAdding(false);
        setEditingId(undefined);
        onChanged();
    };
    const add = useMutation({
        mutationFn: (value: LookInput) => addDramaCastLook(projectId, character.id, value),
        onSuccess: () => done(_creationText("creation.b62e81b387439575")),
        onError: (error) => message.error(error instanceof Error ? error.message : _creationText("creation.2ca15f1e2bb7d991")),
    });
    const update = useMutation({
        mutationFn: ({ id, value }: { id: string; value: LookInput }) => updateDramaCastLook(projectId, id, { ...value, restyleSegments: restyle }),
        onSuccess: (result) => done(_creationText("creation.f66508cf521b940b"), result.affectedSegments),
        onError: (error) => message.error(error instanceof Error ? error.message : _creationText("creation.ec99e5c45d648fd6")),
    });
    const remove = useMutation({
        mutationFn: (id: string) => deleteDramaCastLook(projectId, id, restyle),
        onSuccess: (result) => done(_creationText("creation.f8291b06fb4dda08"), result.affectedSegments),
        onError: (error) => message.error(error instanceof Error ? error.message : _creationText("creation.c228558cf257fc49")),
    });
    const generate = useMutation({
        mutationFn: async (look: DramaCast) => {
            if (look.locked) await updateDramaCast(projectId, look.id, { locked: false });
            return regenerateDramaCast(projectId, look.id, restyle);
        },
        onSuccess: (result) => done(_creationText("creation.e0ea9be2559fbeb7"), result.affectedSegments),
        onError: (error) => message.error(error instanceof Error ? error.message : _creationText("music.status_failed")),
    });
    const upload = useMutation({
        mutationFn: async ({ look, file }: { look: DramaCast; file: File }) => {
            const resource = await uploadResourceFile(file, "image", { fileName: file.name });
            return setDramaCastImage(projectId, look.id, resource.id, restyle);
        },
        onSuccess: (result) => done(_creationText("creation.243287ec79c595b2"), result.affectedSegments),
        onError: (error) => message.error(error instanceof Error ? error.message : _creationText("workbench.upload_failed")),
    });
    const busy = add.isPending || update.isPending || remove.isPending || generate.isPending || upload.isPending;
    return (
        <div className="drama-field">
            <div className="drama-field-label">
                <span>{_creationText("creation.e02a055a1d86b349")}</span>
                <small>{_creationText("creation.e87b6034fdc7e614", { value1: MAX_LOOKS, value2: looks.length, value3: MAX_LOOKS })}</small>
            </div>
            <div className="drama-looks">
                {looks.map((look) =>
                    editingId === look.id ? (
                        <LookForm projectId={projectId} key={look.id} initial={look} submitting={update.isPending} onCancel={() => setEditingId(undefined)} onSubmit={(value) => update.mutate({ id: look.id, value })} />
                    ) : (
                        <div key={look.id} className="drama-look-item">
                            <div className="drama-look">
                                <button
                                    type="button"
                                    className="drama-look-thumb"
                                    disabled={!look.imageResourceId}
                                    aria-label={_creationText("creation.look.previewReference", { name: look.lookName || _creationText("creation.345897933b2d1a83") })}
                                    onClick={() => setPreviewLook(look)}
                                >
                                    {look.imageResourceId ? <MediaThumb resourceId={look.imageResourceId} alt={look.lookName || _creationText("creation.345897933b2d1a83")} /> : <Shirt className="size-4 opacity-40" />}
                                    {mediaBusy(look.imageStatus) ? <span className="drama-look-busy" aria-label={_creationText("creation.8ffe34dc84c3db06")} /> : null}
                                    {look.imageStatus === "failed" ? <AlertCircle className="size-3.5 text-[var(--status-error)]" aria-label={_creationText("creation.97a3666c8b9c2ccd")} /> : null}
                                </button>
                                <span className="drama-look-body">
                                    <b className="truncate">{look.lookName || _creationText("creation.50ef161256d9798a")}</b>
                                    <small>{chapterLabel(look.lookFromChapter, look.lookToChapter)}</small>
                                    <small>
                                        {look.imageStatus === "draft"
                                            ? _creationText("creation.79820fd6496eff3f")
                                            : look.imageStatus === ""
                                              ? _creationText("creation.50dee6d134b09e1c")
                                              : look.imageStatus === "failed"
                                                ? _creationText("creation.ee58807031796a75")
                                                : look.locked
                                                  ? _creationText("creation.d39c736ffb2c949b")
                                                  : look.imagePrompt
                                                    ? _creationText("creation.f1d3720d98f16b61")
                                                    : _creationText("creation.3cce46b0732460a5")}
                                    </small>
                                </span>
                                <span className="drama-look-actions">
                                    <Button
                                        size="small"
                                        type="primary"
                                        icon={<Play className="size-3.5" />}
                                        loading={generate.isPending && generate.variables?.id === look.id}
                                        disabled={busy || mediaBusy(look.imageStatus) || character.imageStatus !== "ready" || !character.imageResourceId}
                                        title={
                                            !character.imageResourceId || character.imageStatus !== "ready"
                                                ? _creationText("creation.8784fc284e2c85e2")
                                                : look.imageResourceId
                                                  ? _creationText("creation.2b98bd1d8c7be621")
                                                  : _creationText("creation.76073a1a2816bfc7")
                                        }
                                        aria-label={_creationText("creation.2695d95160536842", { value1: look.imageResourceId ? _creationText("workbench.regenerate") : _creationText("creation.1ad1463fe16fc2a6"), value2: look.lookName || "" })}
                                        onClick={() => {
                                            if (look.locked) modal.confirm({ title: "重新生成造型图？", content: "将解锁当前自定义图，并按已保存的提示词生成新图。", okText: "解锁并生成", cancelText: "取消", onOk: () => generate.mutateAsync(look) });
                                            else generate.mutate(look);
                                        }}
                                    >
                                        {look.imageResourceId ? _creationText("workbench.regenerate") : _creationText("creation.cf3b516f73cfe527")}
                                    </Button>
                                    <Button
                                        size="small"
                                        type="text"
                                        icon={<Pencil className="size-3.5" />}
                                        aria-label={_creationText("creation.ef6d1adeddb93d63", { value1: look.lookName })}
                                        disabled={busy || mediaBusy(look.imageStatus)}
                                        onClick={() => setEditingId(look.id)}
                                    />
                                    <Button size="small" type="text" icon={<Trash2 className="size-3.5" />} aria-label={_creationText("creation.fa7c47ccf656c344", { value1: look.lookName })} disabled={busy} onClick={() => remove.mutate(look.id)} />
                                </span>
                            </div>
                            <div className="drama-look-form-actions">
                                <Button size="small" icon={<Library className="size-3.5" />} disabled={busy || mediaBusy(look.imageStatus)} onClick={() => setLibraryLook(look)}>
                                    {_creationText("creation.89e906481e9ff575")}
                                </Button>
                                <Button
                                    size="small"
                                    icon={<Upload className="size-3.5" />}
                                    disabled={busy || mediaBusy(look.imageStatus)}
                                    onClick={() => {
                                        uploadLookRef.current = look;
                                        fileRef.current?.click();
                                    }}
                                >
                                    {_creationText("creation.1ff0930980561d5a")}
                                </Button>
                            </div>
                        </div>
                    ),
                )}
                {adding ? (
                    <LookForm projectId={projectId} submitting={add.isPending} onCancel={() => setAdding(false)} onSubmit={(value) => add.mutate(value)} />
                ) : looks.length < MAX_LOOKS ? (
                    <Button size="small" icon={<Plus className="size-3.5" />} disabled={busy} onClick={() => setAdding(true)}>
                        {_creationText("creation.959cb9de4e4b63cd")}
                    </Button>
                ) : null}
            </div>
            <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    const look = uploadLookRef.current;
                    if (!file || !look) return;
                    if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) {
                        message.error(_creationText("creation.b184df5bf195296f"));
                        return;
                    }
                    modal.confirm({
                        title: _creationText("creation.7519d42214a669d6", { value1: look.lookName }),
                        content: _creationText("creation.6e873e54f20df07c"),
                        okText: "确认保存",
                        cancelText: _creationText("common.cancel"),
                        onOk: () => upload.mutateAsync({ look, file }),
                    });
                }}
            />
            {previewLook?.imageResourceId ? <CanvasImagePreview storageKey={`resource:${previewLook.imageResourceId}`} alt={previewLook.lookName || _creationText("creation.345897933b2d1a83")} onClose={() => setPreviewLook(undefined)} /> : null}
            {libraryLook ? (
                <CastLibraryPicker
                    open
                    cast={libraryLook}
                    onClose={() => setLibraryLook(undefined)}
                    onPick={async (resourceId) => {
                        const result = await setDramaCastImage(projectId, libraryLook.id, resourceId, restyle);
                        done(_creationText("creation.243287ec79c595b2"), result.affectedSegments);
                    }}
                />
            ) : null}
        </div>
    );
}

import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { App, Button, Input, InputNumber } from "antd";
import { AlertCircle, Check, Pencil, Plus, Shirt, Trash2, X } from "lucide-react";

import { addDramaCastLook, deleteDramaCastLook, updateDramaCastLook, type DramaCast } from "@/services/api/drama";

import { mediaBusy, MediaThumb } from "../drama-shared";

const MAX_LOOKS = 6;

function chapterLabel(from?: number, to?: number) {
    if (from && to) return `第 ${from}–${to} 章`;
    if (from) return `第 ${from} 章起`;
    if (to) return `第 ${to} 章前`;
    return "不限章节";
}

/** 一套造型的编辑表单（新增或修改共用）。 */
function LookForm({ initial, submitting, onCancel, onSubmit }: { initial?: DramaCast; submitting: boolean; onCancel: () => void; onSubmit: (value: { lookName: string; appearance: string; fromChapter?: number; toChapter?: number }) => void }) {
    _useCreationLocale();
    const [name, setName] = useState(initial?.lookName || "");
    const [appearance, setAppearance] = useState(initial?.appearance || "");
    const [from, setFrom] = useState<number | null>(initial?.lookFromChapter || null);
    const [to, setTo] = useState<number | null>(initial?.lookToChapter || null);
    const valid = name.trim() && appearance.trim();
    return (
        <div className="drama-look-form">
            <Input value={name} maxLength={60} placeholder={_creationText("creation.b112a3329a5b8770")} aria-label={_creationText("creation.6c1622f1d7915c66")} onChange={(event) => setName(event.target.value)} />
            <Input.TextArea
                value={appearance}
                autoSize={{ minRows: 2, maxRows: 5 }}
                placeholder={_creationText("creation.53e192ade07f0417")}
                aria-label={_creationText("creation.956d263c09612b3c")}
                onChange={(event) => setAppearance(event.target.value)}
            />
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
                    onClick={() => onSubmit({ lookName: name.trim(), appearance: appearance.trim(), fromChapter: from ?? 0, toChapter: to ?? 0 })}
                >
                    {_creationText("common.save")}
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
    const { message } = App.useApp();
    const [adding, setAdding] = useState(false);
    const [editingId, setEditingId] = useState<string>();
    const done = (text: string, affected?: number) => {
        message.success(affected ? _creationText("creation.a0e033aeda422328", { value1: text, value2: affected }) : text);
        setAdding(false);
        setEditingId(undefined);
        onChanged();
    };
    const add = useMutation({
        mutationFn: (value: { lookName: string; appearance: string; fromChapter?: number; toChapter?: number }) => addDramaCastLook(projectId, character.id, value),
        onSuccess: () => done("已添加造型，正在以角色形象为底图生成参考图"),
        onError: (error) => message.error(error instanceof Error ? error.message : _creationText("creation.2ca15f1e2bb7d991")),
    });
    const update = useMutation({
        mutationFn: ({ id, value }: { id: string; value: { lookName: string; appearance: string; fromChapter?: number; toChapter?: number } }) => updateDramaCastLook(projectId, id, { ...value, restyleSegments: restyle }),
        onSuccess: (result) => done("已更新造型", result.affectedSegments),
        onError: (error) => message.error(error instanceof Error ? error.message : _creationText("creation.ec99e5c45d648fd6")),
    });
    const remove = useMutation({
        mutationFn: (id: string) => deleteDramaCastLook(projectId, id, restyle),
        onSuccess: (result) => done("已删除造型，引用它的镜头回到角色本体", result.affectedSegments),
        onError: (error) => message.error(error instanceof Error ? error.message : _creationText("creation.c228558cf257fc49")),
    });
    const busy = add.isPending || update.isPending || remove.isPending;
    return (
        <div className="drama-field">
            <div className="drama-field-label">
                <span>{_creationText("creation.e02a055a1d86b349")}</span>
                <small>{_creationText("creation.3d77b9b4c73eef19", { value1: MAX_LOOKS, value2: looks.length, value3: MAX_LOOKS })}</small>
            </div>
            <div className="drama-looks">
                {looks.map((look) =>
                    editingId === look.id ? (
                        <LookForm key={look.id} initial={look} submitting={update.isPending} onCancel={() => setEditingId(undefined)} onSubmit={(value) => update.mutate({ id: look.id, value })} />
                    ) : (
                        <div key={look.id} className="drama-look">
                            <span className="drama-look-thumb">
                                {look.imageResourceId ? <MediaThumb resourceId={look.imageResourceId} alt={look.lookName || _creationText("creation.345897933b2d1a83")} /> : <Shirt className="size-4 opacity-40" />}
                                {mediaBusy(look.imageStatus) ? <span className="drama-look-busy" aria-label={_creationText("creation.8ffe34dc84c3db06")} /> : null}
                                {look.imageStatus === "failed" ? <AlertCircle className="size-3.5 text-[var(--status-error)]" aria-label={_creationText("creation.97a3666c8b9c2ccd")} /> : null}
                            </span>
                            <span className="drama-look-body">
                                <b className="truncate">{look.lookName || _creationText("creation.50ef161256d9798a")}</b>
                                <small>{chapterLabel(look.lookFromChapter, look.lookToChapter)}</small>
                            </span>
                            <span className="drama-look-actions">
                                <Button size="small" type="text" icon={<Pencil className="size-3.5" />} aria-label={_creationText("creation.ef6d1adeddb93d63", { value1: look.lookName })} disabled={busy} onClick={() => setEditingId(look.id)} />
                                <Button size="small" type="text" icon={<Trash2 className="size-3.5" />} aria-label={_creationText("creation.fa7c47ccf656c344", { value1: look.lookName })} disabled={busy} onClick={() => remove.mutate(look.id)} />
                            </span>
                        </div>
                    ),
                )}
                {adding ? (
                    <LookForm submitting={add.isPending} onCancel={() => setAdding(false)} onSubmit={(value) => add.mutate(value)} />
                ) : looks.length < MAX_LOOKS ? (
                    <Button size="small" icon={<Plus className="size-3.5" />} disabled={busy} onClick={() => setAdding(true)}>
                        {_creationText("creation.959cb9de4e4b63cd")}
                    </Button>
                ) : null}
            </div>
        </div>
    );
}

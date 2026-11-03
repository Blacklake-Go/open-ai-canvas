import { useEffect, useState } from "react";
import { useVisualEngineStore } from "../../storage/visual-engine-store";
import { BUILTIN_THEME_PRESETS } from "../../config/default-config";
import { ChoiceField, TextField, ToggleField } from "../components/config-fields";
import type { PageRule } from "../../types";

function JsonOverride({ label, value, onChange }: { label: string; value: object; onChange: (value: object) => void }) {
    const encoded = JSON.stringify(value, null, 2);
    const [text, setText] = useState(encoded);
    const [error, setError] = useState("");
    useEffect(() => {
        setText(encoded);
    }, [encoded]);
    return (
        <div className="space-y-2">
            <TextField
                label={label}
                multiline
                value={text}
                onChange={(next) => {
                    setText(next);
                    try {
                        const parsed = JSON.parse(next);
                        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("请输入 JSON 对象");
                        onChange(parsed);
                        setError("");
                    } catch (reason) {
                        setError(reason instanceof Error ? reason.message : "JSON 无效");
                    }
                }}
            />
            {error && (
                <p role="alert" className="text-sm">
                    {error}
                </p>
            )}
        </div>
    );
}
export function PageRulesPane() {
    const config = useVisualEngineStore((state) => state.draftConfig);
    const update = useVisualEngineStore((state) => state.updateDraft);
    const change = (id: string, values: Partial<PageRule>) =>
        update((draft) => {
            const found = draft.pageRules.find((rule) => rule.id === id);
            if (found) Object.assign(found, values);
        });
    const choices = ["inherit", ...BUILTIN_THEME_PRESETS.map((preset) => preset.id), ...config.customPresets.map((preset) => preset.id)];
    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold">页面与组件视觉规则</h2>
            <p className="text-sm text-foreground/65">精确路径优先，其次采用最长匹配路径。后台保持原生视觉；覆盖项仅允许经过 Schema 校验的颜色、尺寸、遮罩和阴影。</p>
            <button
                type="button"
                className="min-h-11 rounded-lg border border-border px-4"
                onClick={() =>
                    update((draft) => {
                        draft.pageRules.push({ id: "rule-" + crypto.randomUUID(), name: "新页面规则", pathPattern: "/projects/*" });
                    })
                }
            >
                新增页面规则
            </button>
            {config.pageRules.map((rule) => (
                <fieldset key={rule.id} className="space-y-4 rounded-xl border border-border p-4">
                    <legend className="break-all px-2 text-xs">{rule.id}</legend>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextField label="规则名称" value={rule.name} onChange={(name) => change(rule.id, { name })} />
                        <TextField label="匹配路径" value={rule.pathPattern} onChange={(pathPattern) => change(rule.id, { pathPattern })} />
                        <ChoiceField label="主题预设覆盖" value={rule.themePresetOverride ?? "inherit"} choices={choices} onChange={(value) => change(rule.id, { themePresetOverride: value === "inherit" ? undefined : value })} />
                        <ChoiceField
                            label="动画覆盖"
                            value={rule.motionEnabledOverride === undefined ? "inherit" : rule.motionEnabledOverride ? "on" : "off"}
                            choices={["inherit", "on", "off"]}
                            onChange={(value) => change(rule.id, { motionEnabledOverride: value === "inherit" ? undefined : value === "on" })}
                        />
                        <ChoiceField
                            label="恢复动画覆盖"
                            value={rule.recoveryEnabledOverride === undefined ? "inherit" : rule.recoveryEnabledOverride ? "on" : "off"}
                            choices={["inherit", "on", "off"]}
                            onChange={(value) => change(rule.id, { recoveryEnabledOverride: value === "inherit" ? undefined : value === "on" })}
                        />
                        <ChoiceField
                            label="性能模式覆盖"
                            value={rule.performanceMode ?? "inherit"}
                            choices={["inherit", "auto", "low", "full"]}
                            onChange={(value) => change(rule.id, { performanceMode: value === "inherit" ? undefined : (value as PageRule["performanceMode"]) })}
                        />
                    </div>
                    <TextField label="规则说明" value={rule.notes ?? ""} onChange={(notes) => change(rule.id, { notes })} />
                    <JsonOverride label="语义颜色覆盖 JSON" value={rule.customTokens ?? {}} onChange={(customTokens) => change(rule.id, { customTokens })} />
                    <ToggleField label="覆盖此页组件尺寸" value={!!rule.components} onChange={(enabled) => change(rule.id, { components: enabled ? structuredClone(config.components) : undefined })} />
                    {rule.components && <JsonOverride label="组件尺寸 JSON" value={rule.components} onChange={(components) => change(rule.id, { components: components as PageRule["components"] })} />}
                    <ToggleField label="覆盖此页遮罩" value={!!rule.overlays} onChange={(enabled) => change(rule.id, { overlays: enabled ? structuredClone(config.overlays) : undefined })} />
                    {rule.overlays && <JsonOverride label="遮罩 JSON" value={rule.overlays} onChange={(overlays) => change(rule.id, { overlays: overlays as PageRule["overlays"] })} />}
                    <ToggleField label="覆盖此页阴影层级" value={!!rule.elevations} onChange={(enabled) => change(rule.id, { elevations: enabled ? structuredClone(config.elevations) : undefined })} />
                    {rule.elevations && <JsonOverride label="阴影 JSON" value={rule.elevations} onChange={(elevations) => change(rule.id, { elevations: elevations as PageRule["elevations"] })} />}
                    <button
                        type="button"
                        className="min-h-11 rounded-lg border border-border px-4"
                        onClick={() =>
                            update((draft) => {
                                draft.pageRules = draft.pageRules.filter((item) => item.id !== rule.id);
                            })
                        }
                    >
                        删除规则
                    </button>
                </fieldset>
            ))}
        </div>
    );
}

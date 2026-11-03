import { useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { AppModal } from "@/components/ui/product/app-modal";
import { useVisualEngineStore } from "../../storage/visual-engine-store";
import { DEFAULT_VISUAL_ENGINE_CONFIG } from "../../config/default-config";
import { validateVisualEngineConfig } from "../../config/schema";
import type { PageRule } from "../../types";

export function PageRulesPane() {
    const rules = useVisualEngineStore((state) => state.draftConfig.pageRules);
    const updateDraft = useVisualEngineStore((state) => state.updateDraft);
    const [editing, setEditing] = useState<PageRule | null>(null);
    const [tokensJSON, setTokensJSON] = useState("{}");
    const [error, setError] = useState("");
    const openEditor = (rule: PageRule) => {
        setEditing(structuredClone(rule));
        setTokensJSON(JSON.stringify(rule.customTokens ?? {}, null, 2));
        setError("");
    };
    const save = () => {
        if (!editing) return;
        try {
            const customTokens: unknown = JSON.parse(tokensJSON);
            const candidate = { ...editing, customTokens };
            const result = validateVisualEngineConfig({ ...DEFAULT_VISUAL_ENGINE_CONFIG, pageRules: [candidate] });
            if (!result.valid) {
                setError(result.errors.join("；"));
                return;
            }
            const rule = result.config.pageRules[0];
            if (!rules.some((item) => item.id === rule.id) && rules.length >= 128) {
                setError("最多配置 128 条页面规则");
                return;
            }
            updateDraft((draft) => {
                const index = draft.pageRules.findIndex((item) => item.id === rule.id);
                if (index < 0) draft.pageRules.push(rule);
                else draft.pageRules[index] = rule;
            });
            setEditing(null);
        } catch {
            setError("自定义颜色必须是合法的 JSON 对象");
        }
    };
    const setOverride = (key: "motionEnabledOverride" | "recoveryEnabledOverride", value: string) => {
        if (editing) setEditing({ ...editing, [key]: value === "" ? undefined : value === "true" });
    };
    const fieldClass = "w-full rounded border border-border bg-background p-2 text-sm text-foreground";
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold">页面级视觉策略</h2>
                    <p className="mt-2 text-sm text-muted-foreground">具体路径优先于通配路径；相同具体程度按列表顺序生效。全局关闭后页面规则不会重新打开动效。</p>
                </div>
                <button type="button" className="flex gap-2 items-center rounded border border-border p-2" onClick={() => openEditor({ id: crypto.randomUUID(), name: "新页面规则", pathPattern: "/" })}>
                    <Plus size={16} />
                    新增规则
                </button>
            </div>
            {rules.map((rule) => (
                <div key={rule.id} className="rounded-xl border border-border p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <h3 className="font-semibold">
                            {rule.name} <code className="text-sm text-muted-foreground">{rule.pathPattern}</code>
                        </h3>
                        <div className="flex gap-2">
                            <button type="button" aria-label={`编辑规则：${rule.name}`} onClick={() => openEditor(rule)} className="p-2 rounded border border-border">
                                <Pencil size={16} />
                            </button>
                            <button
                                type="button"
                                aria-label={`删除规则：${rule.name}`}
                                onClick={() =>
                                    updateDraft((draft) => {
                                        draft.pageRules = draft.pageRules.filter((item) => item.id !== rule.id);
                                    })
                                }
                                className="p-2 rounded border border-border text-destructive"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{rule.notes}</p>
                    <p className="text-sm">
                        主题：{rule.themePresetOverride ?? "跟随全站"} · 动效：{rule.motionEnabledOverride === undefined ? "跟随全局" : rule.motionEnabledOverride ? "开启" : "关闭"} · 恢复动画：
                        {rule.recoveryEnabledOverride === undefined ? "跟随全局" : rule.recoveryEnabledOverride ? "开启" : "关闭"}
                    </p>
                </div>
            ))}
            {!rules.length ? <p>尚未配置页面规则。</p> : null}
            <AppModal title="编辑页面规则" open={editing !== null} onCancel={() => setEditing(null)} onOk={save} okText="保存到草稿" cancelText="取消">
                {editing ? (
                    <div className="space-y-4">
                        <label className="block">
                            规则名称
                            <input className={fieldClass} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
                        </label>
                        <label className="block">
                            路径模式
                            <input className={fieldClass} value={editing.pathPattern} placeholder="/create/*" onChange={(event) => setEditing({ ...editing, pathPattern: event.target.value })} />
                        </label>
                        <label className="block">
                            主题预设
                            <select
                                className={fieldClass}
                                value={editing.themePresetOverride ?? ""}
                                onChange={(event) => setEditing({ ...editing, themePresetOverride: event.target.value ? (event.target.value as PageRule["themePresetOverride"]) : undefined })}
                            >
                                <option value="">跟随全站</option>
                                {["native", "studio", "dark", "light"].map((id) => (
                                    <option key={id} value={id}>
                                        {id}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="block">
                            页面动效
                            <select className={fieldClass} value={editing.motionEnabledOverride === undefined ? "" : String(editing.motionEnabledOverride)} onChange={(event) => setOverride("motionEnabledOverride", event.target.value)}>
                                <option value="">跟随全局</option>
                                <option value="true">开启</option>
                                <option value="false">关闭</option>
                            </select>
                        </label>
                        <label className="block">
                            工作区恢复动画
                            <select className={fieldClass} value={editing.recoveryEnabledOverride === undefined ? "" : String(editing.recoveryEnabledOverride)} onChange={(event) => setOverride("recoveryEnabledOverride", event.target.value)}>
                                <option value="">跟随全局</option>
                                <option value="true">开启</option>
                                <option value="false">关闭</option>
                            </select>
                        </label>
                        <label className="block">
                            自定义语义颜色（JSON）
                            <textarea className={fieldClass + " font-mono"} rows={4} value={tokensJSON} onChange={(event) => setTokensJSON(event.target.value)} />
                        </label>
                        <label className="block">
                            备注
                            <input className={fieldClass} value={editing.notes ?? ""} onChange={(event) => setEditing({ ...editing, notes: event.target.value })} />
                        </label>
                        {error ? (
                            <p role="alert" className="text-destructive">
                                {error}
                            </p>
                        ) : null}
                    </div>
                ) : null}
            </AppModal>
        </div>
    );
}

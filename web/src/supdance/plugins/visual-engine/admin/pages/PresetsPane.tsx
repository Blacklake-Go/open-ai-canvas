import { useRef, useState } from "react";
import { AppModal } from "@/components/ui/product/app-modal";
import { useVisualEngineStore } from "../../storage/visual-engine-store";
import { BUILTIN_THEME_PRESETS, DEFAULT_VISUAL_ENGINE_CONFIG } from "../../config/default-config";
import { parseVisualEngineImport } from "../../config/import-config";
import { diffVisualConfig } from "../../config/config-diff";
import type { VisualEngineConfig } from "../../types";
import { TextField } from "../components/config-fields";

export function PresetsPane() {
    const config = useVisualEngineStore((state) => state.draftConfig);
    const update = useVisualEngineStore((state) => state.updateDraft);
    const switchPreset = useVisualEngineStore((state) => state.switchPreset);
    const [name, setName] = useState("我的主题");
    const [status, setStatus] = useState("");
    const [candidate, setCandidate] = useState<VisualEngineConfig | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const exportConfig = () => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(config, null, 2)], { type: "application/json" }));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "supdance-visual-theme.json";
        anchor.click();
        URL.revokeObjectURL(url);
    };
    const duplicate = () => {
        if (!name.trim() || name.trim().length > 80) {
            setStatus("请输入 1–80 字主题名称");
            return;
        }
        const preset = {
            id: "custom-" + crypto.randomUUID(),
            name: name.trim(),
            description: "自定义主题",
            isSystem: false,
            author: "管理员自定义",
            tokens: structuredClone(config.tokens),
            components: { ...config.components },
            motion: { ...config.motion },
        };
        update((draft) => {
            draft.customPresets.push(preset);
            draft.activePreset = preset.id;
        });
        setStatus("已复制到草稿主题库，发布后持久保存");
    };
    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold">主题库与导入导出</h2>
            <p className="text-sm text-foreground/65">所有增删改先保存在草稿中。内置主题不可删除；导入只接受经过 Schema 校验的 JSON。</p>
            <div className="flex flex-wrap gap-3">
                <button type="button" onClick={exportConfig} className="min-h-11 rounded-lg border border-border px-4">
                    导出主题配置
                </button>
                <button type="button" onClick={() => fileInput.current?.click()} className="min-h-11 rounded-lg border border-border px-4">
                    导入 JSON
                </button>
                <button
                    type="button"
                    onClick={() =>
                        update((draft) => {
                            const presets = draft.customPresets;
                            const version = draft.publishedVersion;
                            Object.assign(draft, structuredClone(DEFAULT_VISUAL_ENGINE_CONFIG), { customPresets: presets, publishedVersion: version });
                        })
                    }
                    className="min-h-11 rounded-lg border border-border px-4"
                >
                    恢复默认到草稿
                </button>
            </div>
            <input
                ref={fileInput}
                aria-label="导入主题 JSON 文件"
                type="file"
                accept=".json,application/json"
                className="sr-only"
                onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    try {
                        if (file.size > 1024 * 1024) throw new Error("配置文件不能超过 1 MiB");
                        const parsed = parseVisualEngineImport(await file.text());
                        setCandidate(parsed.config);
                        setStatus(parsed.migrated ? "Schema 1 已迁移为 2，请检查差异后应用" : "导入校验通过，请检查差异");
                    } catch (error) {
                        setStatus(error instanceof Error ? error.message : "导入失败");
                    } finally {
                        event.target.value = "";
                    }
                }}
            />
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <TextField label="复制当前主题的名称" value={name} onChange={setName} />
                <button type="button" onClick={duplicate} className="self-end min-h-11 rounded-lg border border-border px-4">
                    复制为自定义主题
                </button>
            </div>
            <p role="status" className="text-sm">
                {status}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
                {[...BUILTIN_THEME_PRESETS, ...config.customPresets].map((preset) => (
                    <section key={preset.id} className="space-y-3 rounded-xl border border-border p-4">
                        <h3 className="font-semibold">{preset.name}</h3>
                        <p className="text-sm text-foreground/65">{preset.isSystem ? "内置主题" : "自定义主题"}</p>
                        <button type="button" onClick={() => switchPreset(preset.id)} className="min-h-11 rounded-lg border border-border px-4">
                            应用到草稿
                        </button>
                        {!preset.isSystem && (
                            <>
                                <TextField
                                    label={preset.name + " 重命名"}
                                    value={preset.name}
                                    onChange={(value) =>
                                        update((draft) => {
                                            const found = draft.customPresets.find((item) => item.id === preset.id);
                                            if (found) found.name = value;
                                        })
                                    }
                                />
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            update((draft) => {
                                                const found = draft.customPresets.find((item) => item.id === preset.id);
                                                if (found) {
                                                    found.tokens = structuredClone(draft.tokens);
                                                    found.components = { ...draft.components };
                                                    found.motion = { ...draft.motion };
                                                }
                                            })
                                        }
                                        className="min-h-11 rounded-lg border border-border px-3"
                                    >
                                        保存当前调色到预设
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            update((draft) => {
                                                draft.customPresets = draft.customPresets.filter((item) => item.id !== preset.id);
                                                if (draft.activePreset === preset.id) draft.activePreset = "custom";
                                            })
                                        }
                                        className="min-h-11 rounded-lg border border-border px-3"
                                    >
                                        删除自定义预设
                                    </button>
                                </div>
                            </>
                        )}
                    </section>
                ))}
            </div>
            <AppModal open={!!candidate} onCancel={() => setCandidate(null)} title="导入配置差异" footer={null}>
                <div className="space-y-4">
                    <p>共有 {candidate ? diffVisualConfig(config, candidate).length : 0} 处变化。应用只更新草稿，不直接发布。</p>
                    <div className="max-h-72 overflow-auto text-xs">
                        {candidate &&
                            diffVisualConfig(config, candidate).map((change) => (
                                <p key={change.field} className="break-all py-1">
                                    {change.field}: {JSON.stringify(change.before)} → {JSON.stringify(change.after)}
                                </p>
                            ))}
                    </div>
                    <button
                        type="button"
                        className="min-h-11 rounded-lg border border-border px-4"
                        onClick={() => {
                            if (candidate) {
                                update((draft) => Object.assign(draft, candidate, { publishedVersion: draft.publishedVersion, updatedAt: draft.updatedAt, updatedBy: draft.updatedBy }));
                                setCandidate(null);
                                setStatus("已应用到草稿，请预览后发布");
                            }
                        }}
                    >
                        确认应用到草稿
                    </button>
                </div>
            </AppModal>
        </div>
    );
}

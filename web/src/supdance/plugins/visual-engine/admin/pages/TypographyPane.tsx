import { useVisualEngineStore } from "../../storage/visual-engine-store";
import { ChoiceField, NumberField } from "../components/config-fields";
import type { TypographyConfig } from "../../types";

export function TypographyPane() {
    const config = useVisualEngineStore((state) => state.draftConfig.typography);
    const update = useVisualEngineStore((state) => state.updateDraft);
    const set = <Key extends keyof TypographyConfig>(key: Key, value: TypographyConfig[Key]) =>
        update((draft) => {
            draft.typography[key] = value;
        });
    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold">字体与排版</h2>
            <p className="text-sm text-foreground/65">设置将先应用于隔离预览，发布后由语义排版与组件适配器消费。字体只使用宿主可用字体和系统回退。</p>
            <div className="grid gap-4 sm:grid-cols-2">
                <ChoiceField label="界面字体" value={config.fontFamilySans} choices={["system", "inter"]} onChange={(value) => set("fontFamilySans", value as TypographyConfig["fontFamilySans"])} />
                <ChoiceField label="等宽字体" value={config.fontFamilyMono} choices={["system", "mono"]} onChange={(value) => set("fontFamilyMono", value as TypographyConfig["fontFamilyMono"])} />
                <NumberField label="基础间距（px）" value={config.spacingUnit} min={2} max={8} onChange={(value) => set("spacingUnit", value)} />
            </div>
            {Object.entries(config.scales).map(([name, scale]) => (
                <fieldset key={name} className="rounded-xl border border-border p-4">
                    <legend className="px-2 font-semibold">{name}</legend>
                    <div className="grid gap-3 sm:grid-cols-3">
                        {(["size", "lineHeight", "weight"] as const).map((key) => (
                            <NumberField
                                key={key}
                                label={name + " " + { size: "字号", lineHeight: "行高", weight: "字重" }[key]}
                                value={scale[key]}
                                min={key === "weight" ? 100 : 10}
                                max={key === "weight" ? 900 : key === "lineHeight" ? 120 : 72}
                                step={key === "weight" ? 100 : 1}
                                onChange={(value) =>
                                    update((draft) => {
                                        draft.typography.scales[name as keyof TypographyConfig["scales"]][key] = value;
                                    })
                                }
                            />
                        ))}
                    </div>
                    <p className="mt-4" style={{ fontSize: scale.size, lineHeight: scale.lineHeight + "px", fontWeight: scale.weight }}>
                        SupDance 创作工作区 · 文字预览 012345
                    </p>
                </fieldset>
            ))}
        </div>
    );
}

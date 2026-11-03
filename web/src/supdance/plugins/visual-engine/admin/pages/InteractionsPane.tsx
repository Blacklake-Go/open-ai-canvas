import { useVisualEngineStore } from "../../storage/visual-engine-store";
import { ChoiceField, NumberField, TextField } from "../components/config-fields";
import type { InteractionConfig } from "../../types";

export function InteractionsPane() {
    const config = useVisualEngineStore((state) => state.draftConfig.interactions);
    const update = useVisualEngineStore((state) => state.updateDraft);
    const numeric = [
        ["focusWidth", "焦点环宽度", 1, 6, 1],
        ["focusOffset", "焦点环偏移", 0, 8, 1],
        ["hoverLift", "悬停上移", 0, 4, 0.5],
        ["pressedScale", "按压比例", 0.9, 1, 0.01],
        ["disabledOpacity", "禁用透明度", 0.2, 0.8, 0.05],
    ] as const;
    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold">交互中心</h2>
            <p className="text-sm text-foreground/65">主操作、普通选择和开关保持独立语义。配置不会改变提交条件、禁用逻辑或业务权限。</p>
            <div className="grid gap-4 sm:grid-cols-2">
                {numeric.map(([key, label, min, max, step]) => (
                    <NumberField
                        key={key}
                        label={label}
                        value={config[key]}
                        min={min}
                        max={max}
                        step={step}
                        onChange={(value) =>
                            update((draft) => {
                                draft.interactions[key] = value;
                            })
                        }
                    />
                ))}
                {(["switchOnLight", "switchOnDark", "checkboxLight", "checkboxDark"] as const).map((key) => (
                    <TextField
                        key={key}
                        label={key}
                        value={config[key]}
                        onChange={(value) =>
                            update((draft) => {
                                draft.interactions[key] = value;
                            })
                        }
                    />
                ))}
                <ChoiceField
                    label="性能模式"
                    value={config.performanceMode}
                    choices={["auto", "low", "full"]}
                    onChange={(value) =>
                        update((draft) => {
                            draft.interactions.performanceMode = value as InteractionConfig["performanceMode"];
                        })
                    }
                />
            </div>
            <p className="text-sm">减少动效偏好始终优先于悬停位移与按压缩放。焦点环不会被关闭。</p>
        </div>
    );
}

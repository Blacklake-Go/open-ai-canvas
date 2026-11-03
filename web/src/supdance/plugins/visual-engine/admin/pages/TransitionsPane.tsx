import { useVisualEngineStore } from "../../storage/visual-engine-store";
import { ChoiceField, NumberField, TextField, ToggleField } from "../components/config-fields";
import type { TransitionConfig } from "../../types";

export function TransitionsPane() {
    const config = useVisualEngineStore((state) => state.draftConfig.transitions);
    const update = useVisualEngineStore((state) => state.updateDraft);
    const numeric = [
        ["duration", "时长（ms）", 0, 1000, 10],
        ["delay", "延迟（ms）", 0, 300, 10],
        ["distance", "位移（px）", 0, 32, 1],
        ["scale", "起始缩放", 0.9, 1, 0.01],
        ["opacity", "起始透明度", 0, 1, 0.1],
    ] as const;
    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold">页面与模块过渡</h2>
            <p className="text-sm text-foreground/65">路由订阅驱动原生浏览器动画；快速切换会取消旧动画，画布拖动与实时输入不会经过缓动。</p>
            <ToggleField
                label="启用页面过渡"
                value={config.enabled}
                onChange={(value) =>
                    update((draft) => {
                        draft.transitions.enabled = value;
                    })
                }
            />
            <div className="grid gap-4 sm:grid-cols-2">
                <ChoiceField
                    label="过渡样式"
                    value={config.preset}
                    choices={["fade", "slide", "scale"]}
                    onChange={(value) =>
                        update((draft) => {
                            draft.transitions.preset = value as TransitionConfig["preset"];
                        })
                    }
                />
                <ChoiceField
                    label="方向"
                    value={config.direction}
                    choices={["forward", "backward"]}
                    onChange={(value) =>
                        update((draft) => {
                            draft.transitions.direction = value as TransitionConfig["direction"];
                        })
                    }
                />
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
                                draft.transitions[key] = value;
                            })
                        }
                    />
                ))}
            </div>
            <TextField
                label="适用路径（每行一项，支持 *）"
                multiline
                value={config.paths.join("\n")}
                onChange={(value) =>
                    update((draft) => {
                        draft.transitions.paths = value
                            .split("\n")
                            .map((path) => path.trim())
                            .filter(Boolean);
                    })
                }
            />
            <div className="space-y-2">
                {["page", "workspace", "generation", "overlay"].map((component) => (
                    <ToggleField
                        key={component}
                        label={"适用模块：" + component}
                        value={config.components.includes(component)}
                        onChange={(value) =>
                            update((draft) => {
                                draft.transitions.components = value ? [...draft.transitions.components, component] : draft.transitions.components.filter((item) => item !== component);
                            })
                        }
                    />
                ))}
            </div>
        </div>
    );
}

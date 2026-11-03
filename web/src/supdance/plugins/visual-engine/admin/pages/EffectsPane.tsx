import { useVisualEngineStore } from "../../storage/visual-engine-store";
import { NumberField, TextField, ToggleField } from "../components/config-fields";
import type { ElevationLevel } from "../../types";
export function EffectsPane() {
    const config = useVisualEngineStore((state) => state.draftConfig);
    const update = useVisualEngineStore((state) => state.updateDraft);
    const fields = [
        ["modalBackdropBlur", "弹窗模糊", 0, 32, 1],
        ["modalBackdropOpacity", "弹窗透明度", 0, 1, 0.05],
        ["drawerBackdropBlur", "抽屉模糊", 0, 32, 1],
        ["drawerBackdropOpacity", "抽屉透明度", 0, 1, 0.05],
        ["menuBackdropBlur", "菜单模糊", 0, 32, 1],
        ["imageGradientOpacity", "图片文字保护渐变", 0, 1, 0.05],
        ["scrollEdgeOpacity", "滚动边缘提示", 0, 1, 0.05],
        ["busyOpacity", "局部忙碌遮罩", 0, 1, 0.05],
    ] as const;
    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold">阴影、遮罩与深度</h2>
            {(Object.keys(config.elevations) as ElevationLevel[]).map((level) => (
                <section key={level} className="space-y-3 rounded-xl border border-border p-4">
                    <h3 className="font-semibold">
                        {level} · {config.elevations[level].label}
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {(["shadowLight", "shadowDark"] as const).map((key) => (
                            <TextField
                                key={key}
                                label={key}
                                value={config.elevations[level][key]}
                                onChange={(value) =>
                                    update((draft) => {
                                        draft.elevations[level][key] = value;
                                    })
                                }
                            />
                        ))}
                    </div>
                </section>
            ))}
            <div className="grid gap-4 sm:grid-cols-2">
                {fields.map(([key, label, min, max, step]) => (
                    <NumberField
                        key={key}
                        label={label}
                        value={config.overlays[key]}
                        min={min}
                        max={max}
                        step={step}
                        onChange={(value) =>
                            update((draft) => {
                                draft.overlays[key] = value;
                            })
                        }
                    />
                ))}
            </div>
            <ToggleField
                label="启用图片文字保护渐变"
                value={config.overlays.enableTextProtectionGradient}
                onChange={(value) =>
                    update((draft) => {
                        draft.overlays.enableTextProtectionGradient = value;
                    })
                }
            />
            <p className="text-sm text-foreground/70">E1 用于创作框和工具条，E2 用于菜单，E3 用于弹窗。装饰性渐变不拦截鼠标；操作遮罩继续由宿主控制焦点和阻挡行为。</p>
        </div>
    );
}

import { useVisualEngineStore } from "../../storage/visual-engine-store";
import { NumberField, TextField, ChoiceField, ToggleField } from "../components/config-fields";
export function MotionPane() {
    const motion = useVisualEngineStore((state) => state.draftConfig.motion);
    const update = useVisualEngineStore((state) => state.updateDraft);
    const durations = [
        ["durationQuick", "快速反馈"],
        ["durationDropdownEnter", "下拉进入"],
        ["durationDropdownExit", "下拉退出"],
        ["durationModal", "弹窗"],
        ["durationDrawer", "抽屉"],
        ["durationTabSwitch", "分段切换"],
    ] as const;
    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold">动效中心</h2>
            <ToggleField
                label="启用动效"
                value={motion.enabled}
                onChange={(value) =>
                    update((draft) => {
                        draft.motion.enabled = value;
                    })
                }
            />
            <div className="grid gap-4 sm:grid-cols-2">
                {durations.map(([key, label]) => (
                    <NumberField
                        key={key}
                        label={label + "（ms）"}
                        value={motion[key]}
                        min={0}
                        max={1000}
                        step={10}
                        onChange={(value) =>
                            update((draft) => {
                                draft.motion[key] = value;
                            })
                        }
                    />
                ))}
                {(["easingStandard", "easingBounce", "easingSmooth"] as const).map((key) => (
                    <TextField
                        key={key}
                        label={key}
                        value={motion[key]}
                        onChange={(value) =>
                            update((draft) => {
                                draft.motion[key] = value;
                            })
                        }
                    />
                ))}
                <ChoiceField
                    label="系统减少动效偏好"
                    value={motion.reducedMotionBehavior}
                    choices={["fade-only", "instant"]}
                    onChange={(value) =>
                        update((draft) => {
                            draft.motion.reducedMotionBehavior = value as typeof motion.reducedMotionBehavior;
                        })
                    }
                />
            </div>
            <p className="text-sm text-foreground/70">位移、方向、缩放、透明度和范围在页面过渡中配置。低性能模式停止持续动画，实时拖拽与输入保持即时响应。</p>
        </div>
    );
}

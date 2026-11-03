import { useState } from "react";
import { useVisualEngineStore } from "../../storage/visual-engine-store";
import { WorkspaceRecoveryAnimator } from "../../loading/workspace-recovery-animator";
import { ChoiceField, NumberField, TextField, ToggleField } from "../components/config-fields";
import type { WorkspaceRecoveryStage } from "../../types";
export function LoadingPane() {
    const config = useVisualEngineStore((state) => state.draftConfig.workspaceRecovery);
    const forceReducedMotion = useVisualEngineStore((state) => !state.draftConfig.motion.enabled || state.draftConfig.interactions.performanceMode === "low");
    const update = useVisualEngineStore((state) => state.updateDraft);
    const [stage, setStage] = useState<WorkspaceRecoveryStage>("recovering");
    const [play, setPlay] = useState(false);
    const [replay, setReplay] = useState(0);
    const numeric = [
        ["orbitSpeed", "轨道速度", 0.25, 3, 0.25],
        ["animationSpeed", "动画速度", 0.25, 2, 0.25],
        ["orbitNodesCount", "轨道节点", 0, 8, 1],
        ["floatingCardsCount", "浮动卡片", 0, 4, 1],
        ["glowIntensity", "光晕强度", 0, 1, 0.05],
        ["timeoutMs", "超时（ms）", 1000, 60000, 1000],
    ] as const;
    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold">工作区恢复动画</h2>
            <p className="text-sm">实际状态由会话与工作区事件驱动；以下为明确标记的阶段演示。</p>
            <ToggleField
                label="启用恢复动画"
                value={config.enabled}
                onChange={(value) =>
                    update((draft) => {
                        draft.workspaceRecovery.enabled = value;
                    })
                }
            />
            <div className="flex flex-wrap gap-2">
                {(["init", "recovering", "syncing", "ready", "failed"] as const).map((value) => (
                    <button
                        type="button"
                        key={value}
                        aria-pressed={!play && stage === value}
                        onClick={() => {
                            setPlay(false);
                            setStage(value);
                        }}
                        className="min-h-11 rounded border border-border px-3"
                    >
                        {value}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={() => {
                        setPlay(true);
                        setStage("init");
                        setReplay((value) => value + 1);
                    }}
                    className="min-h-11 rounded border border-border px-3"
                >
                    播放 / 重播
                </button>
            </div>
            <div className="h-[600px] overflow-hidden rounded-xl border border-border">
                <WorkspaceRecoveryAnimator forceReducedMotion={forceReducedMotion} key={replay} config={config} activeStage={stage} interactivePreview={play} onStageChange={setStage} onRetry={() => setStage("init")} />
            </div>
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
                                draft.workspaceRecovery[key] = value;
                            })
                        }
                    />
                ))}
                {(["brandName", "brandLogoUrl", "backgroundLight", "backgroundDark"] as const).map((key) => (
                    <TextField
                        key={key}
                        label={key}
                        value={config[key]}
                        onChange={(value) =>
                            update((draft) => {
                                draft.workspaceRecovery[key] = value;
                            })
                        }
                    />
                ))}
                <ChoiceField
                    label="明暗模式"
                    value={config.themeMode}
                    choices={["dark", "light"]}
                    onChange={(value) =>
                        update((draft) => {
                            draft.workspaceRecovery.themeMode = value as "dark" | "light";
                        })
                    }
                />
                <ChoiceField
                    label="网格密度"
                    value={config.gridDensity}
                    choices={["compact", "normal", "sparse"]}
                    onChange={(value) =>
                        update((draft) => {
                            draft.workspaceRecovery.gridDensity = value as typeof config.gridDensity;
                        })
                    }
                />
                <ChoiceField
                    label="退出效果"
                    value={config.exitEffect}
                    choices={["fade", "instant"]}
                    onChange={(value) =>
                        update((draft) => {
                            draft.workspaceRecovery.exitEffect = value as typeof config.exitEffect;
                        })
                    }
                />
                <ChoiceField
                    label="超时反馈"
                    value={config.timeoutFeedback}
                    choices={["retry", "reload"]}
                    onChange={(value) =>
                        update((draft) => {
                            draft.workspaceRecovery.timeoutFeedback = value as typeof config.timeoutFeedback;
                        })
                    }
                />
            </div>
            <TextField
                label="适用路径（每行一项）"
                multiline
                value={config.paths.join("\n")}
                onChange={(value) =>
                    update((draft) => {
                        draft.workspaceRecovery.paths = value
                            .split("\n")
                            .map((path) => path.trim())
                            .filter(Boolean);
                    })
                }
            />
            <h3 className="font-semibold">状态文案</h3>
            {Object.entries(config.statusCopies).map(([key, value]) => (
                <TextField
                    key={key}
                    label={key}
                    value={value}
                    onChange={(text) =>
                        update((draft) => {
                            draft.workspaceRecovery.statusCopies[key as WorkspaceRecoveryStage] = text;
                        })
                    }
                />
            ))}
            <h3 className="font-semibold">状态说明</h3>
            {Object.entries(config.stageDetails).map(([key, value]) => (
                <TextField
                    key={key}
                    label={key}
                    value={value}
                    onChange={(text) =>
                        update((draft) => {
                            draft.workspaceRecovery.stageDetails[key as keyof typeof config.stageDetails] = text;
                        })
                    }
                />
            ))}
        </div>
    );
}

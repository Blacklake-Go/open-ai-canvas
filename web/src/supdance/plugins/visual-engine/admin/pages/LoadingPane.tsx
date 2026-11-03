import { useState } from "react";
import { Loader2, Play, RefreshCw, Sliders, CheckCircle2 } from "lucide-react";
import { useVisualEngineStore } from "../../storage/visual-engine-store";
import { WorkspaceRecoveryAnimator } from "../../loading/workspace-recovery-animator";
import type { WorkspaceRecoveryStage } from "../../types";

export function LoadingPane() {
    const draftConfig = useVisualEngineStore((state) => state.draftConfig);
    const updateDraft = useVisualEngineStore((state) => state.updateDraft);
    const recovery = draftConfig.workspaceRecovery;

    const [previewStage, setPreviewStage] = useState<WorkspaceRecoveryStage>("recovering");
    const [autoPlay, setAutoPlay] = useState(false);

    const handleConfigChange = (key: keyof typeof recovery, val: unknown) => {
        updateDraft((d) => {
            (d.workspaceRecovery as Record<string, unknown>)[key] = val;
        });
    };

    const handleCopyChange = (stage: keyof typeof recovery.statusCopies, val: string) => {
        updateDraft((d) => {
            d.workspaceRecovery.statusCopies[stage] = val;
        });
    };

    const stages: WorkspaceRecoveryStage[] = ["init", "recovering", "syncing", "ready", "failed"];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Loader2 className="h-5 w-5 text-sky-400" />
                        工作区恢复动画模块 (图 1 Workspace Recovery)
                    </h2>
                    <p className="text-sm text-foreground/60 leading-relaxed mt-1">基于图 1 建立的 5 阶段环形运动轨道、卫星节点与浮动 UI 卡片恢复动画，深度绑定真实业务事件，拒绝虚假百分比。</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-foreground/60">模块开关：</span>
                    <button
                        type="button"
                        onClick={() =>
                            updateDraft((d) => {
                                d.workspaceRecovery.enabled = !d.workspaceRecovery.enabled;
                            })
                        }
                        className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${recovery.enabled ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-foreground/5 text-foreground/50 border-border"}`}
                    >
                        {recovery.enabled ? "已启用 (Enabled)" : "已停用 (Disabled)"}
                    </button>
                </div>
            </div>

            {/* 图 1 实机视觉交互模拟器 */}
            <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Play className="h-4 w-4 text-sky-400" />
                        实机舞台模拟与阶段取证 (Figure 1 Visual Simulator)
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                        {stages.map((st) => (
                            <button
                                key={st}
                                type="button"
                                onClick={() => {
                                    setAutoPlay(false);
                                    setPreviewStage(st);
                                }}
                                className={`px-2.5 py-1 text-xs rounded-md border font-mono transition-all ${previewStage === st && !autoPlay ? "bg-sky-500 text-white border-sky-500 font-bold" : "border-border text-foreground/60 hover:text-foreground"}`}
                            >
                                Stage: {st}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => {
                                setAutoPlay(true);
                                setPreviewStage("init");
                            }}
                            className={`flex items-center gap-1 px-3 py-1 text-xs rounded-md border font-medium ${autoPlay ? "bg-emerald-500 text-white border-emerald-500" : "border-border text-foreground/70"}`}
                        >
                            <RefreshCw className="h-3 w-3" /> 演进全流程
                        </button>
                    </div>
                </div>

                {/* 模拟器画板容器 */}
                <div className="h-[420px] w-full rounded-xl border border-border/80 overflow-hidden shadow-2xl relative">
                    <WorkspaceRecoveryAnimator config={recovery} activeStage={previewStage} interactivePreview={autoPlay} onStageChange={(next) => setPreviewStage(next)} onRetry={() => setPreviewStage("init")} />
                </div>
            </div>

            {/* 动画参数配置 */}
            <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-sky-400" />
                    轨道速度、密度与光晕参数
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-3.5 rounded-lg border border-border/60 bg-background/50 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-foreground">环形轨道旋转速度</span>
                            <span className="font-mono text-sky-400 font-bold">{recovery.orbitSpeed}x</span>
                        </div>
                        <input
                            type="range"
                            min={0.5}
                            max={2.5}
                            step={0.1}
                            value={recovery.orbitSpeed}
                            onChange={(e) => handleConfigChange("orbitSpeed", parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-sky-400"
                        />
                    </div>

                    <div className="p-3.5 rounded-lg border border-border/60 bg-background/50 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-foreground">轨道卫星节点数量</span>
                            <span className="font-mono text-sky-400 font-bold">{recovery.orbitNodesCount} 个</span>
                        </div>
                        <input
                            type="range"
                            min={3}
                            max={8}
                            value={recovery.orbitNodesCount}
                            onChange={(e) => handleConfigChange("orbitNodesCount", parseInt(e.target.value, 10))}
                            className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-sky-400"
                        />
                    </div>

                    <div className="p-3.5 rounded-lg border border-border/60 bg-background/50 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-foreground">环境光晕强度 (Glow)</span>
                            <span className="font-mono text-sky-400 font-bold">{Math.round(recovery.glowIntensity * 100)}%</span>
                        </div>
                        <input
                            type="range"
                            min={0.2}
                            max={1.0}
                            step={0.05}
                            value={recovery.glowIntensity}
                            onChange={(e) => handleConfigChange("glowIntensity", parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-sky-400"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                        <label className="text-xs text-foreground/60 block">超时自动降级阈值 (Timeout MS)</label>
                        <input
                            type="number"
                            min={3000}
                            max={30000}
                            step={500}
                            value={recovery.timeoutMs}
                            onChange={(e) => handleConfigChange("timeoutMs", parseInt(e.target.value, 10) || 8000)}
                            className="w-full h-8 rounded-lg border border-border bg-background px-2.5 text-xs font-mono text-foreground focus:border-sky-400 focus:outline-none"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs text-foreground/60 block">背景深色网格密度</label>
                        <select
                            value={recovery.gridDensity}
                            onChange={(e) => handleConfigChange("gridDensity", e.target.value)}
                            className="w-full h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground focus:border-sky-400 focus:outline-none cursor-pointer"
                        >
                            <option value="compact">高密紧凑网格 (16px)</option>
                            <option value="normal">标准创作网格 (24px)</option>
                            <option value="sparse">空灵稀疏网格 (36px)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* 真实阶段业务文案定制 */}
            <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">各阶段业务文案定制 (Stage Copy Contracts)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs text-foreground/60 block">Stage 1 (初始化文案)</label>
                        <input
                            type="text"
                            value={recovery.statusCopies.init}
                            onChange={(e) => handleCopyChange("init", e.target.value)}
                            className="w-full h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:border-sky-400 focus:outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-foreground/60 block">Stage 2 (工作区恢复中)</label>
                        <input
                            type="text"
                            value={recovery.statusCopies.recovering}
                            onChange={(e) => handleCopyChange("recovering", e.target.value)}
                            className="w-full h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:border-sky-400 focus:outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-foreground/60 block">Stage 3 (数据与模型同步)</label>
                        <input
                            type="text"
                            value={recovery.statusCopies.syncing}
                            onChange={(e) => handleCopyChange("syncing", e.target.value)}
                            className="w-full h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:border-sky-400 focus:outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-foreground/60 block">Stage 4 (就绪即将进入)</label>
                        <input
                            type="text"
                            value={recovery.statusCopies.ready}
                            onChange={(e) => handleCopyChange("ready", e.target.value)}
                            className="w-full h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:border-sky-400 focus:outline-none"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

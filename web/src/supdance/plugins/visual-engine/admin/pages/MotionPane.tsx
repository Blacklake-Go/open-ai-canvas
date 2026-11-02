import { Zap, Play, RotateCcw } from "lucide-react";
import { useVisualEngineStore } from "../../storage/visual-engine-store";

export function MotionPane() {
    const draftConfig = useVisualEngineStore((state) => state.draftConfig);
    const updateDraft = useVisualEngineStore((state) => state.updateDraft);
    const motion = draftConfig.motion;

    const handleDurationChange = (key: keyof typeof motion, val: number) => {
        updateDraft((d) => {
            (d.motion as Record<string, unknown>)[key] = val;
        });
    };

    const handleStringChange = (key: keyof typeof motion, val: string) => {
        updateDraft((d) => {
            (d.motion as Record<string, unknown>)[key] = val;
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Zap className="h-5 w-5 text-sky-400" />
                        全站交互与 Motion Engine
                    </h2>
                    <p className="text-sm text-foreground/60 leading-relaxed mt-1">
                        统一管理全站微交互时长、缓动曲线、页面路由进出场过渡及无障碍动效降级策略。
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-foreground/60">动效引擎总开关：</span>
                    <button
                        type="button"
                        onClick={() => updateDraft((d) => { d.motion.enabled = !d.motion.enabled; })}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${
                            motion.enabled
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                : "bg-foreground/5 text-foreground/50 border-border"
                        }`}
                    >
                        {motion.enabled ? "已启用 (Enabled)" : "已全局禁用 (Disabled)"}
                    </button>
                </div>
            </div>

            {/* 时长矩阵 */}
            <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">组件与交互时长矩阵 (Durations)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-3.5 rounded-lg border border-border/60 bg-background/50 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-foreground">快速交互 (Hover/Pressed)</span>
                            <span className="font-mono text-sky-400 font-bold">{motion.durationQuick}ms</span>
                        </div>
                        <input
                            type="range"
                            min={50}
                            max={400}
                            step={10}
                            value={motion.durationQuick}
                            onChange={(e) => handleDurationChange("durationQuick", parseInt(e.target.value, 10))}
                            className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-sky-400"
                        />
                    </div>

                    <div className="p-3.5 rounded-lg border border-border/60 bg-background/50 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-foreground">下拉菜单进入 (Dropdown In)</span>
                            <span className="font-mono text-sky-400 font-bold">{motion.durationDropdownEnter}ms</span>
                        </div>
                        <input
                            type="range"
                            min={100}
                            max={500}
                            step={10}
                            value={motion.durationDropdownEnter}
                            onChange={(e) => handleDurationChange("durationDropdownEnter", parseInt(e.target.value, 10))}
                            className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-sky-400"
                        />
                    </div>

                    <div className="p-3.5 rounded-lg border border-border/60 bg-background/50 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-foreground">模态弹窗展开 (Modal In)</span>
                            <span className="font-mono text-sky-400 font-bold">{motion.durationModal}ms</span>
                        </div>
                        <input
                            type="range"
                            min={100}
                            max={600}
                            step={10}
                            value={motion.durationModal}
                            onChange={(e) => handleDurationChange("durationModal", parseInt(e.target.value, 10))}
                            className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-sky-400"
                        />
                    </div>

                    <div className="p-3.5 rounded-lg border border-border/60 bg-background/50 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-foreground">侧边抽屉滑入 (Drawer In)</span>
                            <span className="font-mono text-sky-400 font-bold">{motion.durationDrawer}ms</span>
                        </div>
                        <input
                            type="range"
                            min={100}
                            max={700}
                            step={10}
                            value={motion.durationDrawer}
                            onChange={(e) => handleDurationChange("durationDrawer", parseInt(e.target.value, 10))}
                            className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-sky-400"
                        />
                    </div>

                    <div className="p-3.5 rounded-lg border border-border/60 bg-background/50 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-foreground">分段/选项卡切换 (Tabs Switch)</span>
                            <span className="font-mono text-sky-400 font-bold">{motion.durationTabSwitch}ms</span>
                        </div>
                        <input
                            type="range"
                            min={100}
                            max={500}
                            step={10}
                            value={motion.durationTabSwitch}
                            onChange={(e) => handleDurationChange("durationTabSwitch", parseInt(e.target.value, 10))}
                            className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-sky-400"
                        />
                    </div>
                </div>
            </div>

            {/* 缓动与物理曲线 */}
            <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">缓动曲线与无障碍策略 (Curves & Accessibility)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs text-foreground/60 block">标准缓动曲线 (Standard Easing)</label>
                        <input
                            type="text"
                            value={motion.easingStandard}
                            onChange={(e) => handleStringChange("easingStandard", e.target.value)}
                            className="w-full h-8 rounded-lg border border-border bg-background px-2.5 text-xs font-mono text-foreground focus:border-sky-400 focus:outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-foreground/60 block">弹性物理曲线 (Bounce Easing)</label>
                        <input
                            type="text"
                            value={motion.easingBounce}
                            onChange={(e) => handleStringChange("easingBounce", e.target.value)}
                            className="w-full h-8 rounded-lg border border-border bg-background px-2.5 text-xs font-mono text-foreground focus:border-sky-400 focus:outline-none"
                        />
                    </div>
                </div>

                <div className="pt-3 border-t border-border/50 flex items-center justify-between">
                    <div>
                        <span className="text-xs font-medium text-foreground block">减少动效偏好 (prefers-reduced-motion) 表现</span>
                        <span className="text-[11px] text-foreground/50 block">针对系统开启减少动态效果的用户自动降级</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => updateDraft((d) => { d.motion.reducedMotionBehavior = "fade-only"; })}
                            className={`px-3 py-1 rounded text-xs border ${
                                motion.reducedMotionBehavior === "fade-only"
                                    ? "bg-sky-500/20 text-sky-400 border-sky-500/30"
                                    : "border-border text-foreground/60"
                            }`}
                        >
                            仅淡入淡出 (Fade-only)
                        </button>
                        <button
                            type="button"
                            onClick={() => updateDraft((d) => { d.motion.reducedMotionBehavior = "instant"; })}
                            className={`px-3 py-1 rounded text-xs border ${
                                motion.reducedMotionBehavior === "instant"
                                    ? "bg-sky-500/20 text-sky-400 border-sky-500/30"
                                    : "border-border text-foreground/60"
                            }`}
                        >
                            瞬间完成 (Instant)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

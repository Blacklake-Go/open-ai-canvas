import { Shield, Sparkles, Eye } from "lucide-react";
import { useVisualEngineStore } from "../../storage/visual-engine-store";
import type { ElevationLevel } from "../../types";

export function EffectsPane() {
    const draftConfig = useVisualEngineStore((state) => state.draftConfig);
    const updateDraft = useVisualEngineStore((state) => state.updateDraft);
    const elevations = draftConfig.elevations;
    const overlays = draftConfig.overlays;

    const handleOverlayChange = (key: keyof typeof overlays, val: number | boolean) => {
        updateDraft((d) => {
            (d.overlays as Record<string, unknown>)[key] = val;
        });
    };

    const handleElevationShadowChange = (level: ElevationLevel, isDark: boolean, shadow: string) => {
        updateDraft((d) => {
            if (isDark) {
                d.elevations[level].shadowDark = shadow;
            } else {
                d.elevations[level].shadowLight = shadow;
            }
        });
    };

    const elevationList: ElevationLevel[] = ["E0", "E1", "E2", "E3", "E4"];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Shield className="h-5 w-5 text-sky-400" />
                    阴影、遮罩与浮层深度引擎 (E0–E4)
                </h2>
                <p className="text-sm text-foreground/60 leading-relaxed mt-1">严格按光学分层管理阴影景深、模态遮罩毛玻璃模糊度（Backdrop Blur）与文字保护渐变。</p>
            </div>

            {/* E0-E4 深度层级卡片 */}
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">E0–E4 阴影光学层级</h3>
                <div className="grid grid-cols-1 gap-3">
                    {elevationList.map((level) => {
                        const item = elevations[level];
                        return (
                            <div key={level} className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="inline-block px-2 py-0.5 rounded font-mono font-bold text-xs bg-sky-500/20 text-sky-400 mr-2">{item.level}</span>
                                        <span className="text-sm font-medium text-foreground">{item.label}</span>
                                        <span className="text-xs text-foreground/50 ml-2">({item.usage})</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                                    <div className="space-y-1">
                                        <label className="text-[11px] text-foreground/60 block">深色模式投影 (Dark Shadow)</label>
                                        <input
                                            type="text"
                                            value={item.shadowDark}
                                            onChange={(e) => handleElevationShadowChange(level, true, e.target.value)}
                                            className="w-full h-8 rounded-lg border border-border bg-background px-2.5 text-xs font-mono text-foreground focus:border-sky-400 focus:outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] text-foreground/60 block">浅色模式投影 (Light Shadow)</label>
                                        <input
                                            type="text"
                                            value={item.shadowLight}
                                            onChange={(e) => handleElevationShadowChange(level, false, e.target.value)}
                                            className="w-full h-8 rounded-lg border border-border bg-background px-2.5 text-xs font-mono text-foreground focus:border-sky-400 focus:outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 遮罩与模糊参数 */}
            <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Eye className="h-4 w-4 text-sky-400" />
                    浮层遮罩与毛玻璃滤镜 (Backdrop Blur & Scrim)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3.5 rounded-lg border border-border/60 bg-background/50 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-foreground">模态弹窗毛玻璃模糊 (Modal Blur)</span>
                            <span className="font-mono text-sky-400 font-bold">{overlays.modalBackdropBlur}px</span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={24}
                            value={overlays.modalBackdropBlur}
                            onChange={(e) => handleOverlayChange("modalBackdropBlur", parseInt(e.target.value, 10))}
                            className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-sky-400"
                        />
                    </div>

                    <div className="p-3.5 rounded-lg border border-border/60 bg-background/50 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-foreground">模态背景暗化不透明度 (Modal Opacity)</span>
                            <span className="font-mono text-sky-400 font-bold">{overlays.modalBackdropOpacity}</span>
                        </div>
                        <input
                            type="range"
                            min={0.1}
                            max={0.95}
                            step={0.05}
                            value={overlays.modalBackdropOpacity}
                            onChange={(e) => handleOverlayChange("modalBackdropOpacity", parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-sky-400"
                        />
                    </div>

                    <div className="p-3.5 rounded-lg border border-border/60 bg-background/50 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-foreground">浮动菜单毛玻璃模糊 (Menu Blur)</span>
                            <span className="font-mono text-sky-400 font-bold">{overlays.menuBackdropBlur}px</span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={24}
                            value={overlays.menuBackdropBlur}
                            onChange={(e) => handleOverlayChange("menuBackdropBlur", parseInt(e.target.value, 10))}
                            className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-sky-400"
                        />
                    </div>

                    <div className="p-3.5 rounded-lg border border-border/60 bg-background/50 flex items-center justify-between">
                        <div className="space-y-0.5">
                            <span className="text-xs font-medium text-foreground block">图片文字保护渐变</span>
                            <span className="text-[11px] text-foreground/50 block">画卷卡片底部安全渐变</span>
                        </div>
                        <input
                            type="checkbox"
                            checked={overlays.enableTextProtectionGradient}
                            onChange={(e) => handleOverlayChange("enableTextProtectionGradient", e.target.checked)}
                            className="h-4 w-4 rounded border-border text-sky-500 focus:ring-sky-400 cursor-pointer"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

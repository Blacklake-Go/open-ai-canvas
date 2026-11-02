import { Check, Palette } from "lucide-react";
import { useVisualEngineStore } from "../../storage/visual-engine-store";
import { BUILTIN_THEME_PRESETS } from "../../config/default-config";

export function ThemesPane() {
    const draftConfig = useVisualEngineStore((state) => state.draftConfig);
    const switchPreset = useVisualEngineStore((state) => state.switchPreset);
    const updateDraft = useVisualEngineStore((state) => state.updateDraft);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Palette className="h-5 w-5 text-sky-400" />
                    主题中心 (Theme Presets)
                </h2>
                <p className="text-sm text-foreground/60 leading-relaxed mt-1">
                    选择或切换官方设计预设。切换后可在右侧预览面板即时体验，满意后保存草稿并正式发布。
                </p>
            </div>

            {/* 官方系统预设卡片列表 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {BUILTIN_THEME_PRESETS.map((preset) => {
                    const isSelected = draftConfig.activePreset === preset.id;
                    const primaryColor = preset.tokens.dark.primary;
                    const canvasColor = preset.tokens.dark.canvas;
                    const surfaceColor = preset.tokens.dark.surface;

                    return (
                        <div
                            key={preset.id}
                            onClick={() => switchPreset(preset.id)}
                            className={`relative cursor-pointer rounded-xl border p-5 transition-all flex flex-col justify-between ${
                                isSelected
                                    ? "border-sky-400 bg-sky-400/5 shadow-md shadow-sky-500/10 ring-1 ring-sky-400"
                                    : "border-border/70 bg-card hover:border-foreground/30 hover:bg-foreground/[0.02]"
                            }`}
                        >
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                                        {preset.name}
                                    </h3>
                                    {isSelected ? (
                                        <span className="flex items-center gap-1 rounded-full bg-sky-500/20 px-2 py-0.5 text-xs font-medium text-sky-400">
                                            <Check className="h-3 w-3" /> 当前草稿
                                        </span>
                                    ) : null}
                                </div>
                                <p className="text-xs text-foreground/60 leading-relaxed">
                                    {preset.description}
                                </p>
                            </div>

                            {/* 色彩样本微展示 */}
                            <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
                                <span className="text-xs text-foreground/40">{preset.author}</span>
                                <div className="flex items-center gap-1.5">
                                    <span
                                        className="h-4 w-4 rounded-full border border-white/20 shadow-sm"
                                        style={{ backgroundColor: canvasColor }}
                                        title={`Canvas: ${canvasColor}`}
                                    />
                                    <span
                                        className="h-4 w-4 rounded-full border border-white/20 shadow-sm"
                                        style={{ backgroundColor: surfaceColor }}
                                        title={`Surface: ${surfaceColor}`}
                                    />
                                    <span
                                        className="h-4 w-4 rounded-full border border-white/20 shadow-sm"
                                        style={{ backgroundColor: primaryColor }}
                                        title={`Primary: ${primaryColor}`}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 默认模式配置 */}
            <div className="rounded-xl border border-border/70 bg-card p-5 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">默认色彩模式模式倾向</h3>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => updateDraft((d) => { d.themeMode = "dark"; })}
                        className={`px-4 py-2 rounded-lg text-xs font-medium border transition-all ${
                            draftConfig.themeMode === "dark"
                                ? "border-sky-400 bg-sky-400/10 text-sky-400 font-semibold"
                                : "border-border text-foreground/70 hover:bg-foreground/5"
                        }`}
                    >
                        深色模式 (Dark-First 推荐)
                    </button>
                    <button
                        type="button"
                        onClick={() => updateDraft((d) => { d.themeMode = "light"; })}
                        className={`px-4 py-2 rounded-lg text-xs font-medium border transition-all ${
                            draftConfig.themeMode === "light"
                                ? "border-sky-400 bg-sky-400/10 text-sky-400 font-semibold"
                                : "border-border text-foreground/70 hover:bg-foreground/5"
                        }`}
                    >
                        浅色模式 (Light)
                    </button>
                    <button
                        type="button"
                        onClick={() => updateDraft((d) => { d.themeMode = "system"; })}
                        className={`px-4 py-2 rounded-lg text-xs font-medium border transition-all ${
                            draftConfig.themeMode === "system"
                                ? "border-sky-400 bg-sky-400/10 text-sky-400 font-semibold"
                                : "border-border text-foreground/70 hover:bg-foreground/5"
                        }`}
                    >
                        跟随操作系统 (System)
                    </button>
                </div>
            </div>
        </div>
    );
}

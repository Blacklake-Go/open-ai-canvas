import { Package, Download, Upload, RefreshCw } from "lucide-react";
import { useVisualEngineStore } from "../../storage/visual-engine-store";
import { BUILTIN_THEME_PRESETS } from "../../config/default-config";

export function PresetsPane() {
    const draftConfig = useVisualEngineStore((state) => state.draftConfig);

    const handleExport = () => {
        const payload = JSON.stringify(draftConfig, null, 2);
        const blob = new Blob([payload], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `supdance-visual-theme-${draftConfig.activePreset}-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Package className="h-5 w-5 text-sky-400" />
                        主题预设管理与导入导出 (Theme Presets)
                    </h2>
                    <p className="text-sm text-foreground/60 leading-relaxed mt-1">支持将当前调校的主题方案导出为标准 JSON 规范包，或跨开发环境导入经过校验的预设方案。</p>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-foreground/5 text-xs font-medium text-foreground transition-all">
                        <Download className="h-3.5 w-3.5" /> 导出当前主题包
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {BUILTIN_THEME_PRESETS.map((preset) => (
                    <div key={preset.id} className="p-4 rounded-xl border border-border/70 bg-card space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-foreground">{preset.name}</span>
                            <span className="text-xs px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 font-mono">官方内置</span>
                        </div>
                        <p className="text-xs text-foreground/60 leading-relaxed">{preset.description}</p>
                        <div className="pt-2 border-t border-border/50 text-xs text-foreground/40 flex justify-between">
                            <span>Author: {preset.author}</span>
                            <span>ID: {preset.id}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

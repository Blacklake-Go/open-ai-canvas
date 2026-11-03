import { Eye } from "lucide-react";
import { useVisualEngineStore } from "../../storage/visual-engine-store";

export function PreviewPane() {
    const draftConfig = useVisualEngineStore((state) => state.draftConfig);
    const previewViewport = useVisualEngineStore((state) => state.previewViewport);
    const setPreviewViewport = useVisualEngineStore((state) => state.setPreviewViewport);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Eye className="h-5 w-5 text-sky-400" />
                        全景隔离实时预览 (Live Sandbox Preview)
                    </h2>
                    <p className="text-sm text-foreground/60 leading-relaxed mt-1">在不影响生产普通用户的情况下，在沙箱视口中实时预览桌面端、平板与手机布局下的组件渲染。</p>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg border border-border p-1 bg-card">
                    <button type="button" onClick={() => setPreviewViewport("desktop")} className={`px-2.5 py-1 text-xs rounded font-medium ${previewViewport === "desktop" ? "bg-sky-500 text-white" : "text-foreground/60"}`}>
                        桌面 1280px+
                    </button>
                    <button type="button" onClick={() => setPreviewViewport("tablet")} className={`px-2.5 py-1 text-xs rounded font-medium ${previewViewport === "tablet" ? "bg-sky-500 text-white" : "text-foreground/60"}`}>
                        平板 768px
                    </button>
                    <button type="button" onClick={() => setPreviewViewport("mobile")} className={`px-2.5 py-1 text-xs rounded font-medium ${previewViewport === "mobile" ? "bg-sky-500 text-white" : "text-foreground/60"}`}>
                        移动 390px
                    </button>
                </div>
            </div>

            <div className="p-8 rounded-xl border border-dashed border-border flex items-center justify-center text-xs text-foreground/50">可直接使用右侧常驻的【实时交互画板】进行各视口与深浅色模式的 live 操作体验。</div>
        </div>
    );
}

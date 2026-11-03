import { useState } from "react";
import { AppModal } from "@/components/ui/product/app-modal";
import { useVisualEngineStore } from "../../storage/visual-engine-store";
import { generateVisualEngineCSSVariables } from "../../themes/css-variables";
import { WorkspaceRecoveryAnimator } from "../../loading/workspace-recovery-animator";
import { ComponentGallery } from "../components/component-gallery";
import type { VisualEngineConfig } from "../../types";

export function ConsolePreviewPanel({ configOverride, title = "草稿实时预览", allowFullscreen = true }: { configOverride?: VisualEngineConfig; title?: string; allowFullscreen?: boolean } = {}) {
    const draft = useVisualEngineStore((state) => state.draftConfig);
    const config = configOverride ?? draft;
    const mode = useVisualEngineStore((state) => state.previewThemeMode);
    const setMode = useVisualEngineStore((state) => state.setPreviewThemeMode);
    const viewport = useVisualEngineStore((state) => state.previewViewport);
    const setViewport = useVisualEngineStore((state) => state.setPreviewViewport);
    const [fullscreen, setFullscreen] = useState(false);
    const [recovery, setRecovery] = useState(false);
    const [replay, setReplay] = useState(0);
    const variables = generateVisualEngineCSSVariables(config, mode);
    return (
        <aside className="flex h-full min-w-0 w-full flex-col overflow-hidden bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
                <strong className="text-xs">{title}</strong>
                {allowFullscreen && (
                    <button type="button" onClick={() => setFullscreen(true)} className="min-h-11 rounded border border-border px-3 text-xs">
                        全屏预览
                    </button>
                )}
                <select aria-label={title + " 预览视口"} value={viewport} onChange={(event) => setViewport(event.target.value as typeof viewport)} className="min-h-9 rounded border border-border bg-card px-2 text-xs">
                    <option value="desktop">桌面</option>
                    <option value="tablet">平板</option>
                    <option value="mobile">手机</option>
                </select>
                <button type="button" onClick={() => setMode(mode === "dark" ? "light" : "dark")} className="min-h-9 rounded border border-border px-2 text-xs">
                    {mode === "dark" ? "切至浅色预览" : "切至深色预览"}
                </button>
                <button type="button" aria-pressed={recovery} onClick={() => setRecovery((value) => !value)} className="min-h-9 rounded border border-border px-2 text-xs">
                    {recovery ? "组件沙箱" : "图 1 恢复动画"}
                </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
                <div
                    className="mx-auto space-y-4 rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 text-[var(--foreground)]"
                    style={{ ...variables, maxWidth: viewport === "mobile" ? 390 : viewport === "tablet" ? 768 : undefined, fontFamily: "var(--ve-font-sans)", fontSize: "var(--ve-type-body-size)" } as React.CSSProperties}
                >
                    {recovery ? (
                        <>
                            <button type="button" onClick={() => setReplay((value) => value + 1)} className="min-h-11 rounded border border-[var(--border)] px-3">
                                重播动画演示
                            </button>
                            <p className="text-xs">这里是阶段演示；实际加载由宿主认证和工作区事件驱动。</p>
                            <div className="h-[600px] overflow-hidden rounded-lg">
                                <WorkspaceRecoveryAnimator forceReducedMotion={!config.motion.enabled || config.interactions.performanceMode === "low"} key={replay} config={{ ...config.workspaceRecovery, themeMode: mode }} interactivePreview />
                            </div>
                        </>
                    ) : (
                        <ComponentGallery config={config} mode={mode} />
                    )}
                </div>
            </div>
            <AppModal open={fullscreen} onCancel={() => setFullscreen(false)} title="全屏视觉预览" footer={null} width="100vw" style={{ top: 0, paddingBottom: 0 }} styles={{ body: { height: "calc(100dvh - 120px)" } }}>
                <ConsolePreviewPanel configOverride={config} title={title} allowFullscreen={false} />
            </AppModal>
        </aside>
    );
}

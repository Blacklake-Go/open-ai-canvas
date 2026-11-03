import { useState } from "react";
import { Monitor, Tablet, Smartphone, Sun, Moon, Sparkles, Check, Layers, AlertCircle, Play } from "lucide-react";
import { useVisualEngineStore } from "../../storage/visual-engine-store";
import { generateVisualEngineCSSVariables } from "../../themes/css-variables";
import { WorkspaceRecoveryAnimator } from "../../loading/workspace-recovery-animator";

export function ConsolePreviewPanel() {
    const draftConfig = useVisualEngineStore((state) => state.draftConfig);
    const previewViewport = useVisualEngineStore((state) => state.previewViewport);
    const setPreviewViewport = useVisualEngineStore((state) => state.setPreviewViewport);
    const previewThemeMode = useVisualEngineStore((state) => state.previewThemeMode);
    const setPreviewThemeMode = useVisualEngineStore((state) => state.setPreviewThemeMode);

    const [activeTab, setActiveTab] = useState<"components" | "recovery">("components");
    const [modalTestOpen, setModalTestOpen] = useState(false);
    const [selectVal, setSelectVal] = useState("seedance-4.5");

    // 为隔离沙箱容器计算行内 CSS 变量
    const sandboxVariables = generateVisualEngineCSSVariables(draftConfig, previewThemeMode);

    const viewportWidthStyle = {
        desktop: "w-full",
        tablet: "max-w-[768px]",
        mobile: "max-w-[390px]",
    }[previewViewport];

    return (
        <aside className="w-[420px] xl:w-[480px] shrink-0 border-l border-border/70 bg-background/50 flex flex-col h-full overflow-hidden">
            {/* 预览控制顶栏 */}
            <div className="h-12 border-b border-border/70 px-4 flex items-center justify-between bg-card/60 shrink-0 text-xs">
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => setActiveTab("components")}
                        className={`px-2.5 py-1 rounded font-medium ${activeTab === "components" ? "bg-foreground/10 text-foreground font-semibold" : "text-foreground/50 hover:text-foreground"}`}
                    >
                        组件沙箱
                    </button>
                    <button type="button" onClick={() => setActiveTab("recovery")} className={`px-2.5 py-1 rounded font-medium ${activeTab === "recovery" ? "bg-foreground/10 text-foreground font-semibold" : "text-foreground/50 hover:text-foreground"}`}>
                        图 1 恢复动画
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {/* 视口切换 */}
                    <div className="flex items-center rounded border border-border p-0.5 bg-background">
                        <button type="button" onClick={() => setPreviewViewport("desktop")} className={`p-1 rounded ${previewViewport === "desktop" ? "bg-sky-500 text-white" : "text-foreground/50"}`} title="桌面 (1280px+)">
                            <Monitor className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => setPreviewViewport("tablet")} className={`p-1 rounded ${previewViewport === "tablet" ? "bg-sky-500 text-white" : "text-foreground/50"}`} title="平板 (768px)">
                            <Tablet className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => setPreviewViewport("mobile")} className={`p-1 rounded ${previewViewport === "mobile" ? "bg-sky-500 text-white" : "text-foreground/50"}`} title="手机 (390px)">
                            <Smartphone className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    {/* 深浅色模式切换 */}
                    <button
                        type="button"
                        onClick={() => setPreviewThemeMode(previewThemeMode === "dark" ? "light" : "dark")}
                        className="p-1 rounded border border-border text-foreground/70 hover:bg-foreground/5"
                        title={previewThemeMode === "dark" ? "切至浅色预览" : "切至深色预览"}
                    >
                        {previewThemeMode === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                    </button>
                </div>
            </div>

            {/* 隔离沙箱视口画板 */}
            <div className="flex-1 overflow-y-auto p-4 flex justify-center bg-black/10">
                <div style={sandboxVariables as React.CSSProperties} className={`transition-all duration-300 rounded-2xl border border-border bg-[var(--background)] text-[var(--foreground)] p-5 shadow-2xl flex flex-col gap-6 ${viewportWidthStyle} h-fit`}>
                    {activeTab === "recovery" ? (
                        <div className="h-[460px] rounded-xl overflow-hidden border border-border/70">
                            <WorkspaceRecoveryAnimator config={draftConfig.workspaceRecovery} interactivePreview={true} />
                        </div>
                    ) : (
                        <>
                            {/* 预览标题栏 */}
                            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                                <div>
                                    <span className="text-xs font-bold block">Live Components Preview</span>
                                    <span className="text-[10px] text-[var(--muted-foreground)]">实时应用草稿令牌</span>
                                </div>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--accent)] text-[var(--accent-foreground)] font-mono">{previewThemeMode.toUpperCase()}</span>
                            </div>

                            {/* 按钮群组测试 */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-semibold text-[var(--muted-foreground)] block">按钮光学 (Buttons)</label>
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        style={{
                                            backgroundColor: "var(--primary)",
                                            color: "var(--primary-foreground)",
                                            borderRadius: "var(--radius-btn)",
                                            height: "var(--height-btn-regular)",
                                            boxShadow: "var(--elevation-e1)",
                                        }}
                                        className="px-3.5 text-xs font-semibold transition-all hover:opacity-90 active:scale-95"
                                    >
                                        主操作按钮
                                    </button>
                                    <button
                                        type="button"
                                        style={{
                                            backgroundColor: "var(--secondary)",
                                            color: "var(--secondary-foreground)",
                                            borderRadius: "var(--radius-btn)",
                                            height: "var(--height-btn-regular)",
                                            border: "1px solid var(--border)",
                                        }}
                                        className="px-3.5 text-xs font-medium hover:bg-[var(--surface-hover)] active:scale-95 transition-all"
                                    >
                                        次级按钮
                                    </button>
                                    <button
                                        type="button"
                                        style={{
                                            backgroundColor: "var(--destructive)",
                                            color: "var(--destructive-foreground)",
                                            borderRadius: "var(--radius-btn)",
                                            height: "var(--height-btn-regular)",
                                        }}
                                        className="px-3.5 text-xs font-medium hover:opacity-90 active:scale-95 transition-all"
                                    >
                                        危险操作
                                    </button>
                                </div>
                            </div>

                            {/* 输入框与选择菜单 */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-semibold text-[var(--muted-foreground)] block">表单与下拉框 (Input & Select)</label>
                                <div className="space-y-2.5">
                                    <input
                                        type="text"
                                        placeholder="输入提示词（按 Tab 查看焦点环）"
                                        style={{
                                            backgroundColor: "var(--surface)",
                                            color: "var(--foreground)",
                                            borderColor: "var(--input)",
                                            borderRadius: "var(--radius-input)",
                                            height: "var(--height-input)",
                                        }}
                                        className="w-full border px-3 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-all"
                                    />

                                    <select
                                        value={selectVal}
                                        onChange={(e) => setSelectVal(e.target.value)}
                                        style={{
                                            backgroundColor: "var(--surface)",
                                            color: "var(--foreground)",
                                            borderColor: "var(--input)",
                                            borderRadius: "var(--radius-input)",
                                            height: "var(--height-input)",
                                        }}
                                        className="w-full border px-3 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--ring)] cursor-pointer"
                                    >
                                        <option value="seedance-4.5">Seedance 4.5 · 电影级生图</option>
                                        <option value="mureka-9.5">Mureka V9.5 · 音乐音频生成</option>
                                        <option value="kling-v2">Kling 2.0 · 高清运镜生成</option>
                                    </select>
                                </div>
                            </div>

                            {/* 表面卡片与景深 */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-semibold text-[var(--muted-foreground)] block">卡片景深与悬停 (Card & Elevation)</label>
                                <div
                                    style={{
                                        backgroundColor: "var(--card-surface)",
                                        borderRadius: "var(--radius-card)",
                                        boxShadow: "var(--elevation-e2)",
                                        border: "1px solid var(--border)",
                                    }}
                                    className="p-4 transition-all hover:-translate-y-0.5 space-y-2"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-[var(--foreground)]">电影分镜预览卡片</span>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--primary)] text-[var(--primary-foreground)]">E2 Elevation</span>
                                    </div>
                                    <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">悬停卡片触发微上浮与光泽增强，边框细致平滑。</p>
                                </div>
                            </div>

                            {/* 模态弹窗触发 */}
                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={() => setModalTestOpen(true)}
                                    style={{
                                        borderRadius: "var(--radius-btn)",
                                        borderColor: "var(--border)",
                                    }}
                                    className="w-full py-2 border text-xs text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-all font-medium"
                                >
                                    触发模态弹窗与遮罩模糊测试 (E3 Depth)
                                </button>
                            </div>

                            {/* 模拟弹窗 */}
                            {modalTestOpen ? (
                                <div
                                    style={{
                                        backdropFilter: `blur(${draftConfig.overlays.modalBackdropBlur}px)`,
                                        backgroundColor: `rgba(0, 0, 0, ${draftConfig.overlays.modalBackdropOpacity})`,
                                    }}
                                    className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-all"
                                >
                                    <div
                                        style={{
                                            backgroundColor: "var(--surface-raised)",
                                            color: "var(--foreground)",
                                            borderRadius: "var(--radius-overlay)",
                                            boxShadow: "var(--elevation-e3)",
                                            border: "1px solid var(--border)",
                                        }}
                                        className="w-full max-w-xs p-5 space-y-4 shadow-2xl"
                                    >
                                        <h4 className="text-sm font-bold">模态窗口 (E3 Optical Depth)</h4>
                                        <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">背景应用了毛玻璃模糊滤镜，点击下方按钮关闭并返回焦点。</p>
                                        <div className="flex justify-end gap-2 pt-2">
                                            <button
                                                type="button"
                                                onClick={() => setModalTestOpen(false)}
                                                style={{
                                                    backgroundColor: "var(--primary)",
                                                    color: "var(--primary-foreground)",
                                                    borderRadius: "var(--radius-btn)",
                                                }}
                                                className="px-3 py-1.5 text-xs font-semibold"
                                            >
                                                关闭弹窗
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </>
                    )}
                </div>
            </div>
        </aside>
    );
}

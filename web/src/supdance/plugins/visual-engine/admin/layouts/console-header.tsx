import { useState } from "react";
import { AppModal } from "@/components/ui/product/app-modal";
import { Sparkles, Check, Send, RotateCcw, PanelRightClose, PanelRightOpen, Sun, Moon } from "lucide-react";
import { useVisualEngineStore } from "../../storage/visual-engine-store";
import { BUILTIN_THEME_PRESETS } from "../../config/default-config";

export function ConsoleHeader({ previewOpen, onTogglePreview }: { previewOpen: boolean; onTogglePreview: () => void }) {
    const config = useVisualEngineStore((state) => state.config);
    const draftConfig = useVisualEngineStore((state) => state.draftConfig);
    const enabled = useVisualEngineStore((state) => state.enabled);
    const isDraftDirty = useVisualEngineStore((state) => state.isDraftDirty);
    const isPublishing = useVisualEngineStore((state) => state.isPublishing);
    const canPublish = useVisualEngineStore((state) => state.canPublish);
    const resetDraft = useVisualEngineStore((state) => state.resetDraft);
    const publishDraft = useVisualEngineStore((state) => state.publishDraft);
    const switchPreset = useVisualEngineStore((state) => state.switchPreset);

    const [publishModalOpen, setPublishModalOpen] = useState(false);
    const [publishComment, setPublishComment] = useState("");

    const handleConfirmPublish = async () => {
        const res = await publishDraft("Admin", publishComment || "更新视觉与动效配置");
        if (res.success) {
            setPublishModalOpen(false);
            setPublishComment("");
        } else {
            alert(`发布失败：${res.error}`);
        }
    };

    return (
        <header className="min-h-16 shrink-0 border-b border-border/70 bg-card/80 backdrop-blur-md px-3 py-3 sm:px-6 flex flex-wrap gap-3 items-center justify-between z-20">
            {/* 标题与当前状态标识 */}
            <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-indigo-600 text-white shadow-md shadow-sky-500/20">
                    <Sparkles className="h-5 w-5" />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-sm font-bold text-foreground">SupDance Visual Engine</h1>
                        <span title={config.publishedVersion} className="max-w-36 truncate font-mono text-xs text-sky-400 font-semibold px-1.5 py-0.5 rounded bg-sky-500/15">
                            v{config.publishedVersion}
                        </span>
                        <span className={`h-2 w-2 rounded-full ${enabled ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : "bg-zinc-500"}`} />
                    </div>
                    <p className="text-[11px] text-foreground/50">双入口单一控制台 · 独立插件集中管理</p>
                </div>
            </div>

            {/* 操作工具栏 */}
            <div className="flex flex-wrap items-center gap-2.5">
                {/* 快速预设选择 */}
                <select value={draftConfig.activePreset} onChange={(e) => switchPreset(e.target.value)} className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:border-sky-400 focus:outline-none cursor-pointer">
                    {BUILTIN_THEME_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                            预设：{p.name}
                        </option>
                    ))}
                </select>

                {/* 放弃草稿修改 */}
                {isDraftDirty ? (
                    <button type="button" onClick={resetDraft} className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs text-foreground/70 hover:bg-foreground/5 active:scale-95 transition-all">
                        <RotateCcw className="h-3.5 w-3.5" /> 放弃未存草稿
                    </button>
                ) : null}

                {/* 正式发布按钮 */}
                <button
                    type="button"
                    onClick={() => setPublishModalOpen(true)}
                    disabled={isPublishing || !canPublish}
                    className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold shadow-md shadow-sky-500/20 active:scale-95 transition-all disabled:opacity-50"
                >
                    <Send className="h-3.5 w-3.5" />
                    {isPublishing ? "正在发布…" : isDraftDirty ? "发布草稿生效" : "发布配置快照"}
                </button>

                {/* 预览面板折叠切换 */}
                <button
                    type="button"
                    onClick={onTogglePreview}
                    className="hidden xl:flex items-center justify-center h-8 w-8 rounded-lg border border-border hover:bg-foreground/5 text-foreground/70"
                    title={previewOpen ? "收起右侧预览画板" : "展开右侧预览画板"}
                >
                    {previewOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                </button>
            </div>

            {/* 发布确认弹窗 */}
            {publishModalOpen ? (
                <AppModal flush open title="正式发布 Visual Engine 配置" footer={null} onCancel={() => setPublishModalOpen(false)}>
                    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 text-foreground">
                        <p className="text-xs text-foreground/60 leading-relaxed">发布成功后由服务端保存新版本快照，其他页面会在自动同步时应用配置。若发现视觉异常，可在“版本管理”中回滚。</p>
                        <div className="space-y-1">
                            <label className="text-xs text-foreground/70 block">本次发布说明/变更摘要：</label>
                            <input
                                type="text"
                                value={publishComment}
                                placeholder="例如：调整了深色按钮圆角与工作区恢复轨道速度"
                                onChange={(e) => setPublishComment(e.target.value)}
                                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-sky-400 focus:outline-none"
                            />
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setPublishModalOpen(false)} className="px-4 py-2 rounded-lg border border-border text-xs text-foreground/70 hover:bg-foreground/5">
                                取消
                            </button>
                            <button type="button" onClick={handleConfirmPublish} disabled={isPublishing || !canPublish} className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold shadow-md active:scale-95">
                                确认并立即发布
                            </button>
                        </div>
                    </div>
                </AppModal>
            ) : null}
        </header>
    );
}

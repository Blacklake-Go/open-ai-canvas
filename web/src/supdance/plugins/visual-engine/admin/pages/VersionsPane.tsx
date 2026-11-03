import { useState } from "react";
import { diffVisualConfig } from "../../config/config-diff";
import { History, RotateCcw, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { useVisualEngineStore } from "../../storage/visual-engine-store";

export function VersionsPane() {
    const current = useVisualEngineStore((state) => state.config);
    const snapshots = useVisualEngineStore((state) => state.snapshots);
    const rollbackToSnapshot = useVisualEngineStore((state) => state.rollbackToSnapshot);
    const publishedVersion = useVisualEngineStore((state) => state.config.publishedVersion);
    const permissions = useVisualEngineStore((state) => state.permissions);

    const [statusMsg, setStatusMsg] = useState("");

    const handleRollback = async (version: string) => {
        if (!confirm(`确认回滚至历史版本 v${version} 吗？当前草稿将同步重置。`)) return;
        const res = await rollbackToSnapshot(version, "Admin User");
        if (res.success) {
            setStatusMsg(`成功回滚至 v${version}！已生效并应用。`);
            setTimeout(() => setStatusMsg(""), 4000);
        } else {
            alert(`回滚失败：${res.error}`);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <History className="h-5 w-5 text-sky-400" />
                        发布历史与版本快照 (Versions & Rollback)
                    </h2>
                    <p className="text-sm text-foreground/60 leading-relaxed mt-1">正式发布配置会保存服务端历史快照。回滚将恢复所选配置内容，并记录为一个新的发布版本。</p>
                </div>
            </div>

            {statusMsg ? (
                <div className="p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{statusMsg}</span>
                </div>
            ) : null}

            {/* 版本列表 */}
            <div className="space-y-3">
                {snapshots.map((item) => {
                    const isCurrent = item.version === publishedVersion;
                    return (
                        <div key={item.version} className={`rounded-xl border p-4 space-y-3 transition-colors ${isCurrent ? "border-sky-400/80 bg-sky-400/5 ring-1 ring-sky-400/50" : "border-border/70 bg-card hover:border-foreground/20"}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-foreground/10 text-foreground">v{item.version}</span>
                                    {isCurrent ? (
                                        <span className="text-xs font-semibold text-sky-400 flex items-center gap-1">
                                            <CheckCircle2 className="h-3.5 w-3.5" /> 当前生效版本
                                        </span>
                                    ) : null}
                                </div>
                                {!isCurrent ? (
                                    <button
                                        type="button"
                                        disabled={!permissions.includes("rollback")}
                                        onClick={() => handleRollback(item.version)}
                                        className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium border border-border hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30 transition-colors active:scale-95"
                                    >
                                        <RotateCcw className="h-3 w-3" /> 一键回滚至此版本
                                    </button>
                                ) : null}
                            </div>

                            <details className="text-xs">
                                <summary className="cursor-pointer py-3">与当前发布配置的差异 · {isCurrent ? "已发布" : "已归档"}</summary>
                                <pre className="max-h-60 overflow-auto whitespace-pre-wrap">{JSON.stringify(diffVisualConfig(current, item.config), null, 2)}</pre>
                            </details>
                            <p className="text-xs text-foreground/80 leading-relaxed">{item.summary || "未填写发布摘要"}</p>

                            <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs text-foreground/50">
                                <span>发布人：{item.actor}</span>
                                <span>时间：{new Date(item.timestamp).toLocaleString()}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

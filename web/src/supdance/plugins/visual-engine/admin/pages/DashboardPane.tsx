import { Sparkles, CheckCircle2, ShieldCheck, Palette, Layers, Activity } from "lucide-react";
import { useVisualEngineStore } from "../../storage/visual-engine-store";
import { BUILTIN_THEME_PRESETS } from "../../config/default-config";

export function DashboardPane() {
    const config = useVisualEngineStore((state) => state.config);
    const enabled = useVisualEngineStore((state) => state.enabled);
    const snapshots = useVisualEngineStore((state) => state.snapshots);
    const auditLogs = useVisualEngineStore((state) => state.auditLogs);
    const setConsoleModule = useVisualEngineStore((state) => state.setConsoleModule);

    const activePresetName = BUILTIN_THEME_PRESETS.find((p) => p.id === config.activePreset)?.name || config.activePreset;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-sky-400" />
                    SupDance 视觉与交互引擎概览
                </h2>
                <p className="text-sm text-foreground/60 leading-relaxed">统一集中控制 SupDance 全站色彩、三层设计令牌、UI 组件光学、E0–E4 深度阴影、交互反馈、Motion 动效引擎与工作区恢复过渡。</p>
            </div>

            {/* 核心指标状态卡片 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-border/70 bg-card p-4">
                    <div className="flex items-center justify-between text-xs text-foreground/60">
                        <span>插件运行状态</span>
                        <Activity className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-foreground">{enabled ? "已激活运行" : "已停用"}</span>
                        <span className="text-xs text-emerald-500 font-medium">热插拔就绪</span>
                    </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-card p-4">
                    <div className="flex items-center justify-between text-xs text-foreground/60">
                        <span>当前发布主题</span>
                        <Palette className="h-4 w-4 text-sky-400" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-foreground truncate" title={activePresetName}>
                            {activePresetName}
                        </span>
                    </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-card p-4">
                    <div className="flex items-center justify-between text-xs text-foreground/60">
                        <span>宿主兼容版本</span>
                        <ShieldCheck className="h-4 w-4 text-sky-400" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-foreground">v1.7.3+</span>
                        <span className="text-xs text-sky-400">非侵入式适配</span>
                    </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-card p-4">
                    <div className="flex items-center justify-between text-xs text-foreground/60">
                        <span>配置历史快照</span>
                        <Layers className="h-4 w-4 text-amber-400" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-foreground">{snapshots.length} 个版本</span>
                        <span className="text-xs text-foreground/50">支持一键回滚</span>
                    </div>
                </div>
            </div>

            {/* 功能快捷导航 */}
            <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">功能快捷配置矩阵</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <button type="button" onClick={() => setConsoleModule("themes")} className="flex flex-col items-start p-3 rounded-lg border border-border/60 hover:border-sky-400/50 hover:bg-foreground/5 transition-all text-left">
                        <span className="text-sm font-medium text-foreground">主题与预设中心</span>
                        <span className="text-xs text-foreground/50 mt-1">切换或编辑 4 款官方预设</span>
                    </button>
                    <button type="button" onClick={() => setConsoleModule("components")} className="flex flex-col items-start p-3 rounded-lg border border-border/60 hover:border-sky-400/50 hover:bg-foreground/5 transition-all text-left">
                        <span className="text-sm font-medium text-foreground">UI 组件光学</span>
                        <span className="text-xs text-foreground/50 mt-1">按钮、输入框、下拉框状态</span>
                    </button>
                    <button type="button" onClick={() => setConsoleModule("loading")} className="flex flex-col items-start p-3 rounded-lg border border-border/60 hover:border-sky-400/50 hover:bg-foreground/5 transition-all text-left">
                        <span className="text-sm font-medium text-foreground">工作区恢复动画 (图 1)</span>
                        <span className="text-xs text-foreground/50 mt-1">环形轨道、节点与卡片浮动</span>
                    </button>
                    <button type="button" onClick={() => setConsoleModule("versions")} className="flex flex-col items-start p-3 rounded-lg border border-border/60 hover:border-sky-400/50 hover:bg-foreground/5 transition-all text-left">
                        <span className="text-sm font-medium text-foreground">发布与版本快照</span>
                        <span className="text-xs text-foreground/50 mt-1">草稿校验、发布与快速回退</span>
                    </button>
                </div>
            </div>

            {/* 最近运维审计动态 */}
            <div className="rounded-xl border border-border/70 bg-card p-5 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center justify-between">
                    <span>最近操作与发布日志</span>
                    <button type="button" onClick={() => setConsoleModule("auditlogs")} className="text-xs text-sky-400 hover:underline">
                        查看全部 ({auditLogs.length})
                    </button>
                </h3>
                <div className="divide-y divide-border/50 text-xs">
                    {auditLogs.slice(0, 3).map((log) => (
                        <div key={log.id} className="py-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                <span className="font-medium text-foreground">{log.action}</span>
                                <span className="text-foreground/50 truncate max-w-sm">{log.details}</span>
                            </div>
                            <span className="text-foreground/40 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

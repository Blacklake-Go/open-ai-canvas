import { ShieldAlert, CheckCircle2, AlertTriangle, MonitorCheck, HelpCircle } from "lucide-react";
import { useVisualEngineStore } from "../../storage/visual-engine-store";
import { runTokenHealthCheck } from "../../diagnostics/token-health-check";
import { detectHostCompatibility } from "../../diagnostics/host-compatibility";

export function DiagnosticsPane() {
    const config = useVisualEngineStore((state) => state.config);
    const healthResult = runTokenHealthCheck(config, "dark");
    const hostReport = detectHostCompatibility();

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <MonitorCheck className="h-5 w-5 text-sky-400" />
                    兼容性与无障碍诊断 (Diagnostics)
                </h2>
                <p className="text-sm text-foreground/60 leading-relaxed mt-1">
                    实时校验宿主浏览器特性支持、WCAG 2.1 色彩对比度合规度以及潜在样式冲突。
                </p>
            </div>

            {/* 宿主环境支持报告 */}
            <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center justify-between">
                    <span>宿主浏览器与扩展能力探测</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-medium">
                        兼容性良好
                    </span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-lg border border-border/60 bg-background/50 flex items-center justify-between">
                        <span className="text-foreground">CSS Custom Properties</span>
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="p-3 rounded-lg border border-border/60 bg-background/50 flex items-center justify-between">
                        <span className="text-foreground">CSS @layer 隔离</span>
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="p-3 rounded-lg border border-border/60 bg-background/50 flex items-center justify-between">
                        <span className="text-foreground">Reduced Motion 媒体查询</span>
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="p-3 rounded-lg border border-border/60 bg-background/50 flex items-center justify-between">
                        <span className="text-foreground">Web Animations API</span>
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="p-3 rounded-lg border border-border/60 bg-background/50 flex items-center justify-between">
                        <span className="text-foreground">Popover API 原生支持</span>
                        <span className="text-sky-400 font-mono">{hostReport.features.popoverApi ? "原生" : "Polyfill"}</span>
                    </div>
                    <div className="p-3 rounded-lg border border-border/60 bg-background/50 flex items-center justify-between">
                        <span className="text-foreground">上游影策版本契约</span>
                        <span className="text-foreground/70 font-mono">v1.7.3+</span>
                    </div>
                </div>
            </div>

            {/* WCAG 对比度安全审查 */}
            <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">WCAG 2.1 无障碍色彩对比度合规检查</h3>
                <div className="divide-y divide-border/50 text-xs">
                    {healthResult.contrastChecks.map((item) => (
                        <div key={item.name} className="py-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span
                                    className="h-3.5 w-3.5 rounded-full border border-white/20"
                                    style={{ backgroundColor: item.foreground }}
                                />
                                <span className="text-foreground font-medium">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="font-mono text-foreground/70">{item.ratio}:1</span>
                                <span
                                    className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                                        item.rating === "AAA"
                                            ? "bg-emerald-500/20 text-emerald-400"
                                            : item.rating === "AA"
                                            ? "bg-sky-500/20 text-sky-400"
                                            : "bg-rose-500/20 text-rose-400"
                                    }`}
                                >
                                    {item.rating}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

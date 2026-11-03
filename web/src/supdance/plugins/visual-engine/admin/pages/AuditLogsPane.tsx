import { ClipboardList, CheckCircle2, User } from "lucide-react";
import { useVisualEngineStore } from "../../storage/visual-engine-store";

export function AuditLogsPane() {
    const auditLogs = useVisualEngineStore((state) => state.auditLogs);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-sky-400" />
                    操作与变更审计日志 (Audit Logs)
                </h2>
                <p className="text-sm text-foreground/60 leading-relaxed mt-1">完整追溯视觉引擎的所有配置保存、草稿修改、正式发布、预设切换及版本回滚操作人与时间戳。</p>
            </div>

            <div className="rounded-xl border border-border/70 bg-card overflow-hidden">
                <table className="w-full text-left text-xs">
                    <thead className="bg-foreground/[0.03] border-b border-border/70 text-foreground/60 font-semibold">
                        <tr>
                            <th className="p-3.5">时间戳</th>
                            <th className="p-3.5">操作人</th>
                            <th className="p-3.5">功能模块</th>
                            <th className="p-3.5">操作类型</th>
                            <th className="p-3.5">版本</th>
                            <th className="p-3.5">变更明细</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 text-foreground/80">
                        {auditLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-foreground/[0.01]">
                                <td className="p-3.5 font-mono text-foreground/50 shrink-0">{new Date(log.timestamp).toLocaleString()}</td>
                                <td className="p-3.5 font-medium text-foreground flex items-center gap-1.5">
                                    <User className="h-3 w-3 text-sky-400" />
                                    {log.actor}
                                </td>
                                <td className="p-3.5">{log.module}</td>
                                <td className="p-3.5 font-mono text-sky-400">{log.action}</td>
                                <td className="p-3.5 font-mono">v{log.version}</td>
                                <td className="p-3.5 text-foreground/70 max-w-xs truncate" title={log.details}>
                                    {log.details}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

import { useVisualEngineStore } from "../../storage/visual-engine-store";
import { runTokenHealthCheck } from "../../diagnostics/token-health-check";
import { detectHostCompatibility } from "../../diagnostics/host-compatibility";
import { VisualEnginePermissionsPanel } from "../components/permissions-panel";
export function DiagnosticsPane() {
    const config = useVisualEngineStore((state) => state.draftConfig);
    const report = detectHostCompatibility();
    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold">兼容性与无障碍诊断</h2>
            <section className="space-y-3 rounded-xl border border-border p-4">
                <h3 className="font-semibold">
                    宿主 {report.hostVersion} · {report.compatible ? "所需接口可用" : "已降级"}
                </h3>
                {Object.entries(report.features).map(([name, available]) => (
                    <div key={name} className="flex justify-between gap-4 text-sm">
                        <span>{name}</span>
                        <span>{available ? "支持" : "不支持 / 使用回退"}</span>
                    </div>
                ))}
                {[...report.missingExtensions, ...report.recommendations].map((text) => (
                    <p key={text} className="text-sm">
                        {text}
                    </p>
                ))}
            </section>
            {(["light", "dark"] as const).map((mode) => {
                const health = runTokenHealthCheck(config, mode);
                return (
                    <section key={mode} className="space-y-3 rounded-xl border border-border p-4">
                        <h3 className="font-semibold">
                            {mode} 草稿对比度 · {health.pass ? "通过" : "需要调整"}
                        </h3>
                        {health.contrastChecks.map((item) => (
                            <div key={item.name} className="flex flex-wrap justify-between gap-2 text-sm">
                                <span>{item.name}</span>
                                <span>
                                    {item.ratio}:1 · {item.pass ? "通过" : "未通过"}
                                </span>
                            </div>
                        ))}
                        {health.warnings.map((text) => (
                            <p key={text} className="text-sm">
                                {text}
                            </p>
                        ))}
                    </section>
                );
            })}
            <VisualEnginePermissionsPanel />
        </div>
    );
}

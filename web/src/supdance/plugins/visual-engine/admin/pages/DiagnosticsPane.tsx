import { useVisualEngineStore } from "../../storage/visual-engine-store";
import { runTokenHealthCheck } from "../../diagnostics/token-health-check";
import { detectHostCompatibility } from "../../diagnostics/host-compatibility";
import { validateVisualEngineConfig } from "../../config/schema";

export function DiagnosticsPane() {
    const config = useVisualEngineStore((state) => state.draftConfig);
    const mode = useVisualEngineStore((state) => state.previewThemeMode);
    const setMode = useVisualEngineStore((state) => state.setPreviewThemeMode);
    const validation = validateVisualEngineConfig(config);
    const health = runTokenHealthCheck(validation.config, mode);
    const host = detectHostCompatibility();
    const features = [
        ["CSS Custom Properties", host.features.cssCustomProperties],
        ["CSS @layer", host.features.cssLayers],
        ["Reduced Motion 媒体查询", host.features.reducedMotionQuery],
        ["Web Animations API", host.features.webAnimationsApi],
        ["Popover API", host.features.popoverApi],
    ] as const;
    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold">兼容性与无障碍诊断</h2>
            <p>检查当前草稿；兼容性状态来自当前浏览器能力检测。</p>
            <div className="rounded-xl border border-border p-5 space-y-3">
                <h3 className="font-semibold">
                    宿主 v{host.hostVersion}：{host.compatible ? "核心能力可用" : "核心能力缺失"}
                </h3>
                {features.map(([name, supported]) => (
                    <div key={name} className="flex justify-between gap-4 text-sm">
                        <span>{name}</span>
                        <span>{supported ? "支持" : "不支持"}</span>
                    </div>
                ))}
                {host.missingExtensions.map((message) => (
                    <p key={message} role="alert">
                        {message}
                    </p>
                ))}
            </div>
            <div className="rounded-xl border border-border p-5 space-y-4">
                <label className="flex items-center gap-3">
                    检查色彩模式
                    <select aria-label="诊断色彩模式" value={mode} onChange={(event) => setMode(event.target.value as "light" | "dark")} className="border border-border bg-background rounded p-2">
                        <option value="dark">深色</option>
                        <option value="light">浅色</option>
                    </select>
                </label>
                <p role="status">{validation.valid && health.pass ? "当前模式的检查项通过" : "当前草稿存在未通过项"}</p>
                {validation.errors.map((message) => (
                    <p key={message} role="alert">
                        {message}
                    </p>
                ))}
                {health.contrastChecks.map((item) => (
                    <div key={item.name} className="flex justify-between gap-4 text-sm border-b border-border py-2">
                        <span>{item.name}</span>
                        <span>
                            {item.ratio}:1 · {item.pass ? item.rating : "FAIL"}
                        </span>
                    </div>
                ))}
                {health.warnings.map((message) => (
                    <p key={message} className="text-sm">
                        {message}
                    </p>
                ))}
            </div>
        </div>
    );
}

import { useState } from "react";
import { useVisualEngineStore } from "../../storage/visual-engine-store";
import { diffVisualConfig } from "../../config/config-diff";
import { validateVisualEnginePreview } from "../../api/visual-engine-api";
import { ConsolePreviewPanel } from "../layouts/console-preview-panel";

export function PreviewPane() {
    const draft = useVisualEngineStore((state) => state.draftConfig);
    const published = useVisualEngineStore((state) => state.config);
    const permissions = useVisualEngineStore((state) => state.permissions);
    const [status, setStatus] = useState("");
    if (!permissions.includes("preview")) return <p role="status">当前管理员没有预览权限。</p>;
    const differences = diffVisualConfig(published, draft);
    return (
        <div className="space-y-5">
            <h2 className="text-xl font-bold">发布前后对比</h2>
            <p className="text-sm text-foreground/65">两侧使用相同的真实组件，草稿不修改站点根样式。</p>
            <button
                type="button"
                className="min-h-11 rounded-lg border border-border px-4"
                onClick={async () => {
                    try {
                        await validateVisualEnginePreview(draft);
                        setStatus("服务端 Schema 与预览权限校验通过");
                    } catch (error) {
                        setStatus(error instanceof Error ? error.message : "校验失败");
                    }
                }}
            >
                服务端校验预览
            </button>
            <p role="status">{status}</p>
            <details className="rounded-lg border border-border p-3">
                <summary>配置差异（{differences.length} 项）</summary>
                <div className="max-h-64 space-y-2 overflow-auto pt-3 text-xs">
                    {differences.map((change) => (
                        <p key={change.field} className="break-all">
                            {change.field}: {JSON.stringify(change.before)} → {JSON.stringify(change.after)}
                        </p>
                    ))}
                </div>
            </details>
            <div className="grid gap-4 2xl:grid-cols-2">
                <div className="h-[760px] overflow-hidden rounded-xl border border-border">
                    <ConsolePreviewPanel configOverride={published} title="已发布配置" />
                </div>
                <div className="h-[760px] overflow-hidden rounded-xl border border-border">
                    <ConsolePreviewPanel title="草稿配置" />
                </div>
            </div>
        </div>
    );
}

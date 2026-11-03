import { useState } from "react";
import { Link } from "react-router";
import { AppModal } from "@/components/ui/product/app-modal";
import { fetchVisualEnginePublicBundle, manageVisualEngine } from "../../api/visual-engine-api";
import { useVisualEngineStore } from "../../storage/visual-engine-store";
import { detectHostCompatibility } from "../../diagnostics/host-compatibility";

export function VisualEnginePluginControls({ onChanged }: { onChanged: () => void | Promise<void> }) {
    const installation = useVisualEngineStore((state) => state.installation);
    const permissions = useVisualEngineStore((state) => state.permissions);
    const [busy, setBusy] = useState(false);
    const [confirm, setConfirm] = useState(false);
    const [retain, setRetain] = useState(true);
    const [status, setStatus] = useState("");
    const perform = async (action: "install" | "update" | "uninstall") => {
        setBusy(true);
        setStatus("");
        try {
            await manageVisualEngine(action, retain);
            useVisualEngineStore.getState().acceptBundle(await fetchVisualEnginePublicBundle());
            await onChanged();
            setConfirm(false);
            setStatus("插件状态已更新");
        } catch (error) {
            setStatus(error instanceof Error ? error.message : "操作失败");
        } finally {
            setBusy(false);
        }
    };
    return (
        <div className="space-y-2 text-xs">
            {installation.installed && permissions.includes("view") && (
                <Link to="/admin/plugins/visual-engine" title="进入 Visual Console 控制台" className="inline-flex min-h-9 items-center rounded border border-border px-2">
                    控制台
                </Link>
            )}
            {permissions.includes("lifecycle") && (
                <div className="flex flex-wrap gap-2">
                    {!installation.installed ? (
                        <button type="button" disabled={busy} onClick={() => void perform("install")} className="min-h-9 rounded border border-border px-2">
                            安装视觉引擎
                        </button>
                    ) : (
                        <>
                            {installation.version !== installation.availableVersion && (
                                <button type="button" disabled={busy} onClick={() => void perform("update")} className="min-h-9 rounded border border-border px-2">
                                    升级至 {installation.availableVersion}
                                </button>
                            )}
                            <button type="button" disabled={busy} onClick={() => setConfirm(true)} className="min-h-9 rounded border border-border px-2">
                                卸载视觉引擎
                            </button>
                        </>
                    )}
                    <button
                        type="button"
                        onClick={async () => {
                            try {
                                const bundle = await fetchVisualEnginePublicBundle();
                                setStatus("版本 " + (bundle.installation?.version ?? bundle.version) + "；宿主契约：" + (detectHostCompatibility().compatible ? "兼容" : "不兼容"));
                            } catch (error) {
                                setStatus(error instanceof Error ? error.message : "检查失败");
                            }
                        }}
                        className="min-h-9 rounded border border-border px-2"
                    >
                        健康检查
                    </button>
                </div>
            )}
            <span role="status" className="block max-w-72 break-words">
                {status}
            </span>
            <AppModal open={confirm} onCancel={() => setConfirm(false)} title="卸载视觉引擎" footer={null}>
                <div className="space-y-4">
                    <p>停止视觉增强并移除活动注册、菜单与运行资源。宿主用户、项目、素材和任务不会删除。</p>
                    <label className="flex min-h-11 items-center gap-3">
                        <input type="checkbox" checked={retain} onChange={(event) => setRetain(event.target.checked)} />
                        保留视觉配置、草稿和版本供重新安装
                    </label>
                    {!retain && <p role="alert">将清理本插件主题配置、草稿和版本。权限策略与审计记录保留。</p>}
                    <button type="button" disabled={busy} onClick={() => void perform("uninstall")} className="min-h-11 rounded-lg border border-border px-4">
                        确认卸载视觉引擎
                    </button>
                </div>
            </AppModal>
        </div>
    );
}

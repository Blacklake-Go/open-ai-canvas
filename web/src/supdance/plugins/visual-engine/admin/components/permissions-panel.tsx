import { useEffect, useState } from "react";
import { useVisualEngineStore } from "../../storage/visual-engine-store";
import { fetchVisualEnginePermissions, saveVisualEnginePermissions, fetchVisualEngineCapabilities, type VisualEnginePermissionPolicy, type VisualEnginePermission } from "../../api/visual-engine-api";
import { TextField } from "./config-fields";

const capabilities: VisualEnginePermission[] = ["view", "edit", "preview", "publish", "rollback", "lifecycle"];
export function VisualEnginePermissionsPanel() {
    const canManage = useVisualEngineStore((state) => state.permissions.includes("lifecycle"));
    const [policy, setPolicy] = useState<VisualEnginePermissionPolicy>({ grants: {} });
    const [userId, setUserId] = useState("");
    const [status, setStatus] = useState("");
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        let disposed = false;
        if (canManage)
            void fetchVisualEnginePermissions()
                .then((value) => {
                    if (!disposed) setPolicy(value);
                })
                .catch((error) => {
                    if (!disposed) setStatus(error.message);
                });
        return () => {
            disposed = true;
        };
    }, [canManage]);
    if (!canManage) return null;
    return (
        <section className="space-y-4 rounded-xl border border-border p-4">
            <h3 className="font-semibold">视觉引擎权限</h3>
            <p className="text-sm text-foreground/65">仅适用于宿主管理员。未列出的管理员沿用完整管理员权限；列出的管理员只拥有勾选能力。普通用户始终不能访问控制台。</p>
            <TextField label="添加宿主管理员 ID" value={userId} onChange={setUserId} />
            <button
                type="button"
                className="min-h-11 rounded-lg border border-border px-4"
                onClick={() => {
                    const id = userId.trim();
                    if (id) setPolicy((current) => ({ grants: { ...current.grants, [id]: ["view"] } }));
                }}
            >
                加入权限清单
            </button>
            {Object.entries(policy.grants).map(([id, grants]) => (
                <fieldset key={id} className="space-y-3 rounded-lg border border-border p-3">
                    <legend className="break-all px-2 text-xs">{id}</legend>
                    <div className="flex flex-wrap gap-4">
                        {capabilities.map((permission) => (
                            <label key={permission} className="flex min-h-11 items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={grants.includes(permission)}
                                    onChange={(event) => setPolicy((current) => ({ grants: { ...current.grants, [id]: event.target.checked ? [...grants, permission] : grants.filter((item) => item !== permission) } }))}
                                />
                                {permission}
                            </label>
                        ))}
                    </div>
                    <button type="button" className="min-h-11 rounded border border-border px-3" onClick={() => setPolicy((current) => ({ grants: Object.fromEntries(Object.entries(current.grants).filter(([key]) => key !== id)) }))}>
                        恢复该管理员默认权限
                    </button>
                </fieldset>
            ))}
            <button
                type="button"
                disabled={busy}
                className="min-h-11 rounded-lg border border-border px-4"
                onClick={async () => {
                    setBusy(true);
                    try {
                        await saveVisualEnginePermissions(policy);
                        useVisualEngineStore.getState().setPermissions(await fetchVisualEngineCapabilities());
                        setStatus("权限已保存并记录审计");
                    } catch (error) {
                        setStatus(error instanceof Error ? error.message : "保存失败");
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                保存视觉权限
            </button>
            <p role="status" className="text-sm">
                {status}
            </p>
        </section>
    );
}

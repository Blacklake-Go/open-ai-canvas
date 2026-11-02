import React, { useMemo, type ReactNode } from "react";
import { Button } from "antd";
import { useNavigate } from "react-router";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { WorkspaceState } from "@/components/layout/workspace-state";
import { selectPluginEffectivelyEnabled, usePluginStore } from "@/stores/use-plugin-store";
import { useI18n } from "@/supdance/plugins/i18n";

export function RequirePlugin({ pluginId, pluginName = "功能插件", children }: { pluginId: string; pluginName?: string; children: ReactNode }) {
    const navigate = useNavigate();
    const { t } = useI18n();

    // 服务端状态尚未就绪时放行（unknownFallback=true）：真正的准入闸门在后端
    // （例如 CheckMusicTaskAdmission），路由守卫不应因本地状态缺失误判为"已停用"。
    const gate = useMemo(() => selectPluginEffectivelyEnabled(pluginId, true), [pluginId]);
    const active = usePluginStore(gate);
    const serverState = usePluginStore((state) => state.pluginStates[pluginId]);

    if (!active) {
        const canSelfToggle = Boolean(serverState?.canToggle);
        return (
            <WorkspacePage>
                <WorkspaceState
                    title={`${pluginName}已停用`}
                    description={serverState?.blockedReason ?? (canSelfToggle ? "该功能插件当前未启用。你可以前往插件中心自行开启后继续使用。" : "该功能插件已由管理员统一停用。如需继续使用，请联系管理员在后台插件中心恢复启用。")}
                    action={
                        canSelfToggle ? (
                            <Button type="primary" onClick={() => navigate("/plugins")}>
                                {t("plugins.center_title", undefined, "插件中心")}
                            </Button>
                        ) : (
                            <Button type="primary" onClick={() => navigate("/")}>
                                {t("common.back_home", undefined, "返回首页")}
                            </Button>
                        )
                    }
                />
            </WorkspacePage>
        );
    }

    return <>{children}</>;
}

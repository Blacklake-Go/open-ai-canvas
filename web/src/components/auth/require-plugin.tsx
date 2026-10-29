import React, { type ReactNode } from "react";
import { Button } from "antd";
import { useNavigate } from "react-router";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { WorkspaceState } from "@/components/layout/workspace-state";
import { usePluginStore } from "@/stores/use-plugin-store";
import { useI18n } from "@/supdance/plugins/i18n";

export function RequirePlugin({
    pluginId,
    pluginName = "功能插件",
    children,
}: {
    pluginId: string;
    pluginName?: string;
    children: ReactNode;
}) {
    const navigate = useNavigate();
    const { t } = useI18n();

    const active = usePluginStore((state) => {
        const inst = state.installations.find((item) => item.manifest.id === pluginId);
        if (inst) return inst.enabled;
        const pluginState = state.pluginStates[pluginId];
        if (pluginState) return pluginState.effectiveEnabled;
        return true;
    });

    if (!active) {
        return (
            <WorkspacePage>
                <WorkspaceState
                    title={`${pluginName}已停用`}
                    description={`该功能插件当前处于未启用或已停用状态。如需继续使用，请前往后台插件中心进行启用配置。`}
                    action={
                        <Button type="primary" onClick={() => navigate("/")}>
                            {t("common.back_home", undefined, "返回首页")}
                        </Button>
                    }
                />
            </WorkspacePage>
        );
    }

    return <>{children}</>;
}

import { LocateFixed, LocateOff } from "lucide-react";
import { useTranslation } from "react-i18next";

import { canvasThemes } from "@/lib/canvas-theme";
import { useActiveTheme } from "@/stores/canvas/use-canvas-theme-store";

/**
 * 画布规模 HUD：节点与连线计数。Agent 批量搭建或生成时数字随增量一起涨，
 * 旁边的开关决定镜头是否跟随 Agent 的改动。
 */
export function CanvasAgentHud({ nodeCount, connectionCount, followAgent, onFollowAgentChange }: { nodeCount: number; connectionCount: number; followAgent: boolean; onFollowAgentChange: (value: boolean) => void }) {
    const { t } = useTranslation();
    const theme = canvasThemes[useActiveTheme()];
    const FollowIcon = followAgent ? LocateFixed : LocateOff;
    return (
        <div className="canvas-agent-hud" style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.muted }} data-canvas-no-zoom>
            <span className="canvas-agent-hud-stat" aria-live="polite">
                {t("upstream.canvasHud.nodes")} <strong style={{ color: theme.node.text }}>{nodeCount}</strong>
                <span aria-hidden="true"> · </span>
                {t("upstream.canvasHud.connections")} <strong style={{ color: theme.node.text }}>{connectionCount}</strong>
            </span>
            <button
                type="button"
                className="canvas-agent-hud-follow"
                aria-pressed={followAgent}
                title={t(followAgent ? "upstream.canvasHud.followOn" : "upstream.canvasHud.followOff")}
                aria-label={t("upstream.canvasHud.followAgent")}
                style={followAgent ? { color: theme.accent.primary } : undefined}
                onClick={() => onFollowAgentChange(!followAgent)}
            >
                <FollowIcon className="size-3.5" aria-hidden="true" />
            </button>
        </div>
    );
}

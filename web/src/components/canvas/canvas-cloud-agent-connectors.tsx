import { Button, Popover } from "antd";
import { useState } from "react";
import { MessageSquarePlus, Unplug } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Cable, Cloud, Hash, MessageSquareText, PlugZap, RefreshCw, Shapes } from "lucide-react";
import { Tooltip } from "@/components/ui/base/tooltip";
import GithubLogo from "@lobehub/icons/es/Github/components/Mono";
import NotionLogo from "@lobehub/icons/es/Notion/components/Mono";
import { listMCPConnections, type MCPConnection } from "@/services/api/agent-mcp";
import { useUserStore } from "@/stores/use-user-store";
import "./canvas-cloud-agent-connectors.css";

export type AgentMCPDestination = "connections" | "market";

type AgentConnectorsBarProps = {
    onOpenMCP?: (destination: AgentMCPDestination) => void;
    codex?: CodexConnectorBarState;
    onConnectCodex?: () => void;
    onNewCodexThread?: () => void;
    onDisconnectCodex?: () => void;
};

function connectionState(connection: MCPConnection) {
    if (connection.enabled) return { label: `${connection.allowedTools.length} 个工具可用`, tone: "ready" as const };
    if (connection.lastTestAt) return { label: "待授权", tone: "pending" as const };
    return { label: "待检测", tone: "muted" as const };
}

function connectionLabel(connection: MCPConnection) {
    return connection.scope === "platform" ? `${connection.name} · 平台` : connection.name;
}

function connectorVisual(name: string) {
    const key = name.toLocaleLowerCase();
    if (key.includes("github")) return { Icon: GithubLogo, color: "#24292f", ink: "#ffffff" };
    if (key.includes("notion")) return { Icon: NotionLogo, color: "#f5f5f4", ink: "#111827" };
    if (key.includes("feishu") || key.includes("lark") || key.includes("飞书")) return { Icon: MessageSquareText, color: "#3370ff", ink: "#ffffff" };
    if (key.includes("slack")) return { Icon: Hash, color: "#611f69", ink: "#ffffff" };
    if (key.includes("figma")) return { Icon: Shapes, color: "#a259ff", ink: "#ffffff" };
    if (key.includes("google")) return { Icon: Cloud, color: "#4285f4", ink: "#ffffff" };
    return { Icon: PlugZap, color: "var(--status-loading)", ink: "#ffffff" };
}

function ConnectorItem({ connection, onOpen }: { connection: MCPConnection; onOpen?: () => void }) {
    const state = connectionState(connection);
    const visual = connectorVisual(connection.name);
    const Icon = visual.Icon;
    return (
        <Tooltip title={connectionLabel(connection)} placement="top">
            <button
                type="button"
                data-no-press
                className={`agent-connector-item is-${state.tone}`}
                onClick={onOpen}
                aria-label={`${connectionLabel(connection)}，${state.label}，打开 MCP 连接设置`}
                style={{ backgroundColor: visual.color, color: visual.ink }}
            >
                <Icon className="agent-connector-glyph" aria-hidden="true" />
                <span className={`agent-connector-status is-${state.tone}`} aria-hidden="true" />
            </button>
        </Tooltip>
    );
}

/** Agent 输入框底部的真实 MCP 连接器入口。连接数据与 MCP 设置页共享 Query 缓存。 */
export function AgentConnectorsBar({ onOpenMCP, codex, onConnectCodex, onNewCodexThread, onDisconnectCodex }: AgentConnectorsBarProps) {
    const userId = useUserStore((state) => state.user?.id);
    const connections = useQuery({
        queryKey: ["agent-mcp", userId, "user", "connections"],
        queryFn: ({ signal }) => listMCPConnections("user", signal),
        enabled: Boolean(userId),
        staleTime: 15_000,
        retry: false,
    });
    const items = connections.data?.items ?? [];
    const loading = Boolean(userId) && connections.isPending;
    return (
        <div className="agent-connectors" role="group" aria-label="MCP 连接器">
            <button type="button" className="agent-connectors-heading" onClick={() => onOpenMCP?.("connections")} aria-label="管理连接器">
                <Cable className="agent-connectors-brand size-4" aria-hidden="true" />
                <span>连接器</span>
            </button>
            <div className="agent-connectors-list thin-scrollbar" aria-label="已安装连接器">
                {codex && onConnectCodex && onNewCodexThread && onDisconnectCodex ? <CodexConnectorButton codex={codex} onConnectCodex={onConnectCodex} onNewCodexThread={onNewCodexThread} onDisconnectCodex={onDisconnectCodex} /> : null}
                {loading ? <span className="agent-connectors-loading" role="status" aria-label="正在读取 MCP 连接器" /> : null}
                {items.map((connection) => (
                    <ConnectorItem key={connection.id} connection={connection} onOpen={() => onOpenMCP?.("connections")} />
                ))}
                {connections.isError ? (
                    <button type="button" className="agent-connector-action" aria-label="重新读取 MCP 连接器" title="重新读取" onClick={() => void connections.refetch()}>
                        <RefreshCw className="size-3.5" />
                    </button>
                ) : null}
            </div>
            <button type="button" className="agent-connectors-market" onClick={() => onOpenMCP?.("market")}>
                <span>浏览插件市场</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
            </button>
        </div>
    );
}

export type CodexConnectorBarState = {
    status: "idle" | "connecting" | "connected" | "error";
    detected: boolean;
    busy: boolean;
    error: string;
};

function CodexIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect width="24" height="24" rx="6" fill="#0B0B0C" />
            <g transform="translate(3.2 3.2) scale(0.7333)">
                <path
                    fill="#fff"
                    d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"
                />
            </g>
        </svg>
    );
}

function CodexConnectorButton({ codex, onConnectCodex, onNewCodexThread, onDisconnectCodex }: { codex: CodexConnectorBarState; onConnectCodex: () => void; onNewCodexThread: () => void; onDisconnectCodex: () => void }) {
    const [codexMenuOpen, setCodexMenuOpen] = useState(false);
    const connected = codex.status === "connected";
    const codexTitle = codex.status === "connected" ? (codex.busy ? "Codex · 运行中" : "Codex · 已连接") : codex.status === "connecting" ? "Codex · 连接中" : codex.detected ? "Codex · 点击连接" : "Codex · 未检测到本地插件";
    const codexButton = (
        <button
            type="button"
            className={`agent-connector-item agent-connector-codex is-${codex.status}`}
            aria-label={codexTitle}
            title={codexTitle}
            onClick={() => {
                if (connected) return;
                if (codex.status === "connecting") return;
                onConnectCodex();
            }}
        >
            <CodexIcon />
            <span className={`agent-connector-status is-${codex.status}`} aria-hidden="true" />
        </button>
    );
    const menu = (
        <div className="agent-connector-menu">
            <div className="agent-connector-menu-head">
                <PlugZap aria-hidden="true" />
                <span>{codex.busy ? "Codex 正在运行" : "Codex 已连接"}</span>
            </div>
            <p>{codex.error || "可直接在输入框与 Codex 对话。"}</p>
            <Button
                size="small"
                type="text"
                icon={<MessageSquarePlus />}
                onClick={() => {
                    setCodexMenuOpen(false);
                    onNewCodexThread();
                }}
            >
                新建 Codex 对话
            </Button>
            <Button
                size="small"
                type="text"
                danger
                icon={<Unplug />}
                onClick={() => {
                    setCodexMenuOpen(false);
                    onDisconnectCodex();
                }}
            >
                断开连接
            </Button>
        </div>
    );
    return connected ? (
        <Popover content={menu} open={codexMenuOpen} onOpenChange={setCodexMenuOpen} placement="topLeft" trigger="click">
            {codexButton}
        </Popover>
    ) : (
        <Tooltip title={codexTitle} placement="top">
            {codexButton}
        </Tooltip>
    );
}

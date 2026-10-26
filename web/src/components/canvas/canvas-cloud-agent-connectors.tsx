// Agent 连接器：输入框底部的第三方协作工具入口条。
//
// 流光溢彩渐变背景 + 紧凑排列的品牌图标，无独立按钮背景。
// Codex 是第一个真实连接器：点击后与本机 SupDance Canvas Agent 配对并开始对话。

import { App, Button, Popover } from "antd";
import { Cable, MessageSquarePlus, PlugZap, Unplug, X } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Tooltip } from "@/components/ui/base/tooltip";
import "./canvas-cloud-agent-connectors.css";

type AgentConnector = {
    id: string;
    name: string;
    icon: ReactNode;
};

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

function NotionIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 100 100" fill="none">
            <path
                d="M6.017 4.313l55.333 -4.087c6.797 -0.583 8.543 -0.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277 -1.553 6.807 -6.99 7.193L24.467 99.967c-4.08 0.193 -6.023 -0.39 -8.16 -3.113L3.3 79.94c-2.333 -3.113 -3.3 -5.443 -3.3 -8.167V11.113c0 -3.497 1.553 -6.413 6.017 -6.8z"
                fill="#fff"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M61.35 0.227l-55.333 4.087C1.553 4.7 0 7.617 0 11.113v60.66c0 2.724 0.967 5.053 3.3 8.167l13.007 16.913c2.137 2.723 4.08 3.307 8.16 3.113l64.257 -3.89c5.433 -0.387 6.99 -2.917 6.99 -7.193V20.64c0 -2.21 -0.873 -2.847 -3.443 -4.733L74.167 3.143c-4.273 -3.107 -6.02 -3.5 -12.817 -2.917zM25.92 19.523c-5.247 0.353 -6.437 0.433 -9.417 -1.99L8.927 11.507c-0.77 -0.78 -0.383 -1.753 1.557 -1.947l53.193 -3.887c4.467 -0.39 6.793 1.167 8.54 2.527l9.123 6.61c0.39 0.197 1.36 1.36 0.193 1.36l-54.933 3.307 -0.68 0.047zM19.803 88.3V30.367c0 -2.53 0.777 -3.697 3.103 -3.893L86 22.78c2.14 -0.193 3.107 1.167 3.107 3.693v57.547c0 2.53 -0.39 4.67 -3.883 4.863l-60.377 3.5c-3.493 0.193 -5.043 -0.97 -5.043 -4.083zm59.6 -54.827c0.387 1.75 0 3.5 -1.75 3.7l-2.91 0.577v42.773c-2.527 1.36 -4.853 2.137 -6.797 2.137 -3.107 0 -3.883 -0.973 -6.21 -3.887l-19.03 -29.94v28.967l6.02 1.363s0 3.5 -4.857 3.5l-13.39 0.777c-0.39 -0.78 0 -2.723 1.357 -3.11l3.497 -0.97v-38.3L30.48 40.667c-0.39 -1.75 0.58 -4.277 3.3 -4.473l14.367 -0.967 19.8 30.327v-26.83l-5.047 -0.58c-0.39 -2.143 1.163 -3.7 3.103 -3.89l13.4 -0.78z"
                fill="#000"
            />
        </svg>
    );
}

function FeishuIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="6" fill="#3370FF" />
            <path d="M7 7h10v3H7V7z" fill="#fff" />
            <path d="M7 11h4v6H7v-6z" fill="#fff" opacity="0.9" />
            <path d="M12 11h5v2.5h-5V11z" fill="#fff" opacity="0.75" />
            <path d="M12 14.5h5V17h-5v-2.5z" fill="#fff" opacity="0.75" />
        </svg>
    );
}

function BasecampIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="11" fill="#1DB954" />
            <path d="M12 6c-3.5 0-6 2.5-6 6s2.5 6 6 6 6-2.5 6-6-2.5-6-6-6zm0 10c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z" fill="#fff" />
            <circle cx="12" cy="12" r="2" fill="#fff" />
        </svg>
    );
}

function ObsidianIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="6" fill="#7C3AED" />
            <path d="M12 4l7 4v8l-7 4-7-4V8l7-4z" stroke="#fff" strokeWidth="1.5" fill="none" />
            <path d="M12 4v8m0 8V12m-7-4l7 4m7-4l-7 4" stroke="#fff" strokeWidth="1.2" opacity="0.6" />
        </svg>
    );
}

function GitHubIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="11" fill="#24292e" />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 3C7.03 3 3 7.03 3 12c0 3.98 2.58 7.35 6.15 8.54.45.08.62-.19.62-.43v-1.7c-2.52.55-3.05-1.08-3.05-1.08-.41-1.04-1-1.32-1-1.32-.82-.56.06-.55.06-.55.91.06 1.39.93 1.39.93.81 1.38 2.12.98 2.63.75.08-.58.31-.98.57-1.2-2.01-.23-4.13-1-4.13-4.47 0-.99.35-1.8.93-2.43-.09-.23-.4-1.14.09-2.38 0 0 .76-.24 2.48.92a8.6 8.6 0 012.26-.3c.77 0 1.54.1 2.26.3 1.72-1.16 2.48-.92 2.48-.92.49 1.24.18 2.15.09 2.38.58.63.93 1.44.93 2.43 0 3.48-2.13 4.24-4.15 4.46.33.28.62.83.62 1.67v2.47c0 .24.17.52.63.43A9.003 9.003 0 0021 12c0-4.97-4.03-9-9-9z"
                fill="#fff"
            />
        </svg>
    );
}

function TencentDocsIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="6" fill="#1E6FFF" />
            <path d="M8 6h5.5l3 3v8.5a1 1 0 01-1 1H8a1 1 0 01-1-1V7a1 1 0 011-1z" fill="#fff" />
            <path d="M13.5 6v2.2c0 .4.3.8.8.8H17" fill="#BFD4FF" />
            <rect x="9.5" y="12" width="5.5" height="1.2" rx=".6" fill="#1E6FFF" />
            <rect x="9.5" y="14.5" width="5.5" height="1.2" rx=".6" fill="#1E6FFF" opacity=".7" />
            <rect x="9.5" y="17" width="3.5" height="1.2" rx=".6" fill="#1E6FFF" opacity=".5" />
        </svg>
    );
}

function SlackIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M8.5 3.5a2 2 0 11-4 0 2 2 0 014 0zm0 7a2 2 0 01-2 2h-2a2 2 0 010-4h2a2 2 0 012 2z" fill="#E01E5A" />
            <path d="M15.5 10.5a2 2 0 100-4 2 2 0 000 4zm7 0a2 2 0 01-2 2h-2a2 2 0 110-4h2a2 2 0 012 2z" fill="#36C5F0" />
            <path d="M15.5 20.5a2 2 0 100-4 2 2 0 000 4zm0-7a2 2 0 012-2v-2a2 2 0 10-4 0v2a2 2 0 012 2z" fill="#2EB67D" />
            <path d="M8.5 13.5a2 2 0 10-4 0 2 2 0 004 0zm7 0a2 2 0 01-2 2v2a2 2 0 104 0v-2a2 2 0 01-2-2z" fill="#ECB22E" />
        </svg>
    );
}

const AGENT_CONNECTORS: AgentConnector[] = [
    { id: "notion", name: "Notion", icon: <NotionIcon /> },
    { id: "feishu", name: "飞书", icon: <FeishuIcon /> },
    { id: "basecamp", name: "Basecamp", icon: <BasecampIcon /> },
    { id: "obsidian", name: "Obsidian", icon: <ObsidianIcon /> },
    { id: "github", name: "GitHub", icon: <GitHubIcon /> },
    { id: "tencent-docs", name: "腾讯文档", icon: <TencentDocsIcon /> },
    { id: "slack", name: "Slack", icon: <SlackIcon /> },
];

/** 输入框底部的连接器条，流光溢彩背景，紧凑图标阵列。 */
export function AgentConnectorsBar({
    onClose,
    codex,
    onConnectCodex,
    onNewCodexThread,
    onDisconnectCodex,
}: {
    onClose: () => void;
    codex: CodexConnectorBarState;
    onConnectCodex: () => void;
    onNewCodexThread: () => void;
    onDisconnectCodex: () => void;
}) {
    const { message } = App.useApp();
    const [codexMenuOpen, setCodexMenuOpen] = useState(false);
    const connected = codex.status === "connected";
    const codexTitle =
        codex.status === "connected"
            ? codex.busy
                ? "Codex · 运行中"
                : "Codex · 已连接"
            : codex.status === "connecting"
              ? "Codex · 连接中"
              : codex.detected
                ? "Codex · 点击连接"
                : "Codex · 未检测到本地插件";
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
            <Button size="small" type="text" icon={<MessageSquarePlus />} onClick={() => { setCodexMenuOpen(false); onNewCodexThread(); }}>
                新建 Codex 对话
            </Button>
            <Button size="small" type="text" danger icon={<Unplug />} onClick={() => { setCodexMenuOpen(false); onDisconnectCodex(); }}>
                断开连接
            </Button>
        </div>
    );
    return (
        <div className="agent-connectors" role="group" aria-label="连接器">
            <div className="agent-connectors-label">
                <Cable />
                <span>连接器</span>
            </div>
            <div className="agent-connectors-list">
                {connected ? (
                    <Popover content={menu} open={codexMenuOpen} onOpenChange={setCodexMenuOpen} placement="topLeft" trigger="click">
                        {codexButton}
                    </Popover>
                ) : (
                    <Tooltip title={codexTitle} placement="top">
                        {codexButton}
                    </Tooltip>
                )}
                {AGENT_CONNECTORS.map((connector) => (
                    <Tooltip key={connector.id} title={`${connector.name} · 研发中`} placement="top">
                        <button type="button" className="agent-connector-item" aria-label={`${connector.name}（研发中）`} onClick={() => message.info({ content: `${connector.name}连接器研发中，敬请期待`, key: `agent-connector-${connector.id}` })}>
                            {connector.icon}
                        </button>
                    </Tooltip>
                ))}
            </div>
            <button type="button" className="agent-connectors-close" aria-label="收起连接器" onClick={onClose}>
                <X />
            </button>
        </div>
    );
}

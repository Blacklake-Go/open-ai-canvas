// 本地 Codex 连接器：影策画布通过它发现、配对并驱动本机 SupDance Canvas Agent。
//
// 只在用户点击连接器时访问 127.0.0.1；长期 token 保存在当前标签页的 sessionStorage，
// 事件流使用一次性 ticket，和主站画布的本地 Agent 协议保持一致。

export type CodexConnectorDescriptor = {
    id: string;
    name: string;
    description: string;
    icon: string;
    capabilities: string[];
    website?: string;
};

export type CodexConnectorDiscovery = {
    ok?: boolean;
    service?: string;
    protocolVersion?: number;
    agentVersion?: string;
    connectors?: CodexConnectorDescriptor[];
};

export type CodexConnectResult = CodexConnectorDiscovery & {
    connector?: string;
    url?: string;
    token?: string;
};

export type CodexConversationState = {
    conversationId?: string;
    threadId?: string;
    status?: "idle" | "preparing" | "ready" | "warning" | "running" | "failed";
    error?: string;
};

export type CodexThreadSummary = { id?: string; title?: string; [key: string]: unknown };
export type CodexChatItem = { id?: string; role?: string; text?: string; itemId?: string; clientMessageId?: string; [key: string]: unknown };

export type CodexThreadResponse = {
    ok?: boolean;
    error?: string;
    code?: string;
    thread?: CodexThreadSummary;
    conversation?: CodexConversationState;
    messages?: CodexChatItem[];
    workspace?: { workspacePath?: string; activeThreadId?: string };
};

export type CodexHealth = {
    ok?: boolean;
    codexBusy?: boolean;
    conversation?: CodexConversationState;
};

export type CodexAgentEvent = {
    type?: string;
    item?: { id?: string; type?: string; delta?: string; text?: string; command?: string; tool?: string; status?: string; error?: { message?: string } | null; [key: string]: unknown };
    status?: string;
    error?: { message?: string } | string;
    thread_id?: string;
    turn_id?: string;
    [key: string]: unknown;
};

export type CodexStreamEvent = { type: string; payload: Record<string, unknown> };

export const CODEX_CONNECTOR_ENDPOINT = ((import.meta.env.VITE_CODEX_CONNECTOR_URL as string | undefined) || "http://127.0.0.1:17372").replace(/\/$/, "");

const STORAGE_KEY = "yingce-codex-connector";

export type StoredCodexConnection = { endpoint: string; token: string; clientId: string; threadId: string };

export function loadCodexConnection(): StoredCodexConnection | null {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const value = JSON.parse(raw) as StoredCodexConnection;
        return value?.endpoint && value?.token && value?.clientId ? { ...value, threadId: value.threadId || "" } : null;
    } catch {
        return null;
    }
}

export function saveCodexConnection(value: StoredCodexConnection | null) {
    try {
        if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
        else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        // 隐私模式禁用 storage 时仍保留内存连接。
    }
}

async function connectorFetch<T>(endpoint: string, path: string, init: RequestInit = {}, timeoutMs = 20000): Promise<T> {
    const response = await fetch(`${endpoint}${path}`, {
        ...init,
        signal: init.signal || AbortSignal.timeout(timeoutMs),
    });
    const data = (await response.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
    if (!response.ok || data.ok === false) throw new Error(data.error || `本地 Codex 请求失败（HTTP ${response.status}）`);
    return data;
}

/** 发现本机 Agent；未安装或未启动时返回 null。 */
export async function discoverCodexConnector(endpoint = CODEX_CONNECTOR_ENDPOINT): Promise<CodexConnectorDiscovery | null> {
    try {
        const data = await connectorFetch<CodexConnectorDiscovery>(endpoint, "/connectors", {}, 2000);
        return data.connectors?.some((item) => item.id === "codex") ? data : null;
    } catch {
        return null;
    }
}

/** 配对：Agent 校验页面来源后返回本地地址与 token。 */
export function pairCodexConnector(clientId: string, endpoint = CODEX_CONNECTOR_ENDPOINT) {
    return connectorFetch<CodexConnectResult>(endpoint, "/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connector: "codex", clientId }),
    }, 5000);
}

export function fetchCodexHealth(endpoint: string) {
    return connectorFetch<CodexHealth>(endpoint, "/health", {}, 3000);
}

export function createCodexEventsTicket(endpoint: string, token: string, clientId: string) {
    return connectorFetch<{ ticket?: string }>(endpoint, "/events-ticket", {
        method: "POST",
        headers: { "content-type": "application/json", "x-canvas-agent-token": token },
        body: JSON.stringify({ clientId }),
    }, 5000);
}

/** 打开一次性 ticket 的 SSE 事件流。 */
export function openCodexEventStream(endpoint: string, ticket: string, clientId: string, onEvent: (event: CodexStreamEvent) => void) {
    const source = new EventSource(`${endpoint}/events?ticket=${encodeURIComponent(ticket)}&clientId=${encodeURIComponent(clientId)}`);
    const types = ["hello", "conversation_changed", "workspace_changed", "chat_message", "agent_event", "agent_done", "agent_error", "agent_bootstrap", "codex_state", "codex_approval", "codex_approval_resolved", "skills_changed", "agent_log", "ping"];
    for (const type of types) {
        source.addEventListener(type, (event) => {
            try {
                onEvent({ type, payload: JSON.parse((event as MessageEvent).data || "{}") });
            } catch {
                // 忽略无法解析的事件，等待下一帧。
            }
        });
    }
    return source;
}

export function createCodexThread(endpoint: string, token: string, clientId: string) {
    return connectorFetch<CodexThreadResponse>(endpoint, "/agent/codex/threads/new", {
        method: "POST",
        headers: { "content-type": "application/json", "x-canvas-agent-token": token },
        body: JSON.stringify({ clientId, permissionMode: "automatic" }),
    }, 90000);
}

export function resumeCodexThread(endpoint: string, token: string, threadId: string, clientId: string) {
    return connectorFetch<CodexThreadResponse>(endpoint, `/agent/codex/threads/${encodeURIComponent(threadId)}/resume`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-canvas-agent-token": token },
        body: JSON.stringify({ clientId, permissionMode: "automatic" }),
    }, 90000);
}

export function sendCodexTurn(endpoint: string, token: string, input: { threadId: string; clientId: string; prompt: string; messageId: string; messageText?: string }) {
    return connectorFetch<{ ok?: boolean; threadId?: string; error?: string }>(endpoint, "/agent/codex/turn", {
        method: "POST",
        headers: { "content-type": "application/json", "x-canvas-agent-token": token },
        body: JSON.stringify({ ...input, permissionMode: "automatic" }),
    }, 300000);
}

export function interruptCodexTurn(endpoint: string, token: string, threadId: string) {
    return connectorFetch<{ ok?: boolean }>(endpoint, "/agent/codex/interrupt", {
        method: "POST",
        headers: { "content-type": "application/json", "x-canvas-agent-token": token },
        body: JSON.stringify({ threadId }),
    }, 10000);
}

export function resolveCodexApproval(endpoint: string, token: string, requestId: string, decision: "accept" | "acceptForSession" | "decline" | "cancel") {
    return connectorFetch<{ ok?: boolean }>(endpoint, "/agent/codex/approval", {
        method: "POST",
        headers: { "content-type": "application/json", "x-canvas-agent-token": token },
        body: JSON.stringify({ requestId, decision }),
    }, 10000);
}

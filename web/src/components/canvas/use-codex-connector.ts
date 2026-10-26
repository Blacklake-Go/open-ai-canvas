// 影策画布底部的 Codex 连接器状态机：发现 → 配对 → SSE → 建线程 → 首轮对话。
//
// 连接器只在用户点击后启动；云端 Agent 的 run / 历史逻辑不受影响。

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { createClientUUID } from "@/lib/client-id";
import {
    createCodexEventsTicket,
    createCodexThread,
    discoverCodexConnector,
    fetchCodexHealth,
    interruptCodexTurn,
    loadCodexConnection,
    openCodexEventStream,
    pairCodexConnector,
    resolveCodexApproval,
    resumeCodexThread,
    saveCodexConnection,
    sendCodexTurn,
    type CodexAgentEvent,
    type CodexConversationState,
} from "@/services/api/codex-connector";
import type { CloudAgentChatMessage } from "./canvas-cloud-agent-chat-ui";

export type CodexConnectorStatus = "idle" | "connecting" | "connected" | "error";

export type CodexConnectorApi = {
    status: CodexConnectorStatus;
    detected: boolean;
    busy: boolean;
    threadId: string;
    conversationStatus: CodexConversationState["status"] | "";
    error: string;
    connected: boolean;
    connect: () => Promise<void>;
    reconnect: () => Promise<void>;
    disconnect: () => void;
    newThread: () => Promise<void>;
    send: (text: string) => Promise<void>;
    stop: () => Promise<void>;
};

type Options = {
    setMessages: Dispatch<SetStateAction<CloudAgentChatMessage[]>>;
    canvasId?: string;
    nodeCount?: number;
};

type Connection = { endpoint: string; token: string; clientId: string; threadId: string; source: EventSource | null };

const CLIENT_ID_KEY = "yingce-codex-client-id";
const WELCOME_PROMPT = "这是从影策画布连接器发起的首次唤醒。请用一句中文问候，并说明你已准备好等待我的第一个任务；不要调用任何工具。";

function readClientId() {
    try {
        const stored = sessionStorage.getItem(CLIENT_ID_KEY);
        if (stored) return stored;
        const value = createClientUUID();
        sessionStorage.setItem(CLIENT_ID_KEY, value);
        return value;
    } catch {
        return createClientUUID();
    }
}

function errorText(cause: unknown) {
    return cause instanceof Error ? cause.message : String(cause);
}

function sleep(ms: number) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function useCodexConnector({ setMessages, canvasId, nodeCount }: Options): CodexConnectorApi {
    const [status, setStatus] = useState<CodexConnectorStatus>("idle");
    const [detected, setDetected] = useState(false);
    const [busy, setBusy] = useState(false);
    const [threadId, setThreadId] = useState("");
    const [conversationStatus, setConversationStatus] = useState<CodexConversationState["status"] | "">("");
    const [error, setError] = useState("");
    const connectionRef = useRef<Connection | null>(null);
    const clientIdRef = useRef(readClientId());
    const busyRef = useRef(false);
    const connectingRef = useRef(false);
    const helloRef = useRef<{ resolve: () => void; reject: (error: Error) => void } | null>(null);
    const mountedRef = useRef(true);

    const setBusyState = useCallback((value: boolean) => {
        busyRef.current = value;
        if (mountedRef.current) setBusy(value);
    }, []);

    const appendMessage = useCallback((message: CloudAgentChatMessage) => {
        setMessages((current) => (current.some((item) => item.id === message.id) ? current.map((item) => (item.id === message.id ? message : item)) : [...current, message]));
    }, [setMessages]);

    const appendSystem = useCallback((text: string, id = `codex-system-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`) => {
        appendMessage({ id, role: "system", text });
    }, [appendMessage]);

    const appendError = useCallback((id: string, cause: unknown, title = "Codex 请求失败") => {
        appendMessage({ id, role: "error", text: `${title}：${errorText(cause)}` });
    }, [appendMessage]);

    const handleAgentEvent = useCallback((payload: CodexAgentEvent) => {
        const item = payload.item;
        if (payload.type === "item.updated" && item?.id) {
            const id = `codex-item-${item.id}`;
            const delta = String(item.delta || "");
            if (!delta) return;
            setMessages((current) => {
                const index = current.findIndex((message) => message.id === id);
                if (item.type === "agent_message") {
                    if (index === -1) return [...current, { id, role: "assistant", text: delta, streaming: true }];
                    const next = [...current];
                    next[index] = { ...next[index], text: `${next[index].text}${delta}`, streaming: true };
                    return next;
                }
                if (item.type === "reasoning") {
                    if (index === -1) return [...current, { id, role: "assistant", text: delta, reasoning: true, streaming: true }];
                    const next = [...current];
                    next[index] = { ...next[index], text: `${next[index].text}${delta}`, streaming: true };
                    return next;
                }
                return current;
            });
            return;
        }
        if (payload.type === "item.completed" && item) {
            if (item.type === "agent_message" && item.id) {
                const id = `codex-item-${item.id}`;
                const text = String(item.text || "");
                setMessages((current) => {
                    const index = current.findIndex((message) => message.id === id);
                    if (index === -1) return text ? [...current, { id, role: "assistant", text, final: true }] : current;
                    const next = [...current];
                    next[index] = { ...next[index], text: text || next[index].text, streaming: false, final: true };
                    return next;
                });
            }
            if (item.type === "error") {
                appendError(`codex-item-error-${item.id || Date.now()}`, String(item.text || item.error?.message || "Codex 返回了错误"), "Codex 运行失败");
                setBusyState(false);
            }
            return;
        }
        if (payload.type === "turn.completed") {
            setBusyState(false);
            if (payload.status === "failed") {
                const message = typeof payload.error === "string" ? payload.error : payload.error?.message;
                if (message) appendError(`codex-turn-error-${payload.turn_id || Date.now()}`, message, "Codex 运行失败");
            }
        }
    }, [appendError, setBusyState, setMessages]);

    const handleEvent = useCallback((type: string, payload: Record<string, unknown>) => {
        if (type === "hello") {
            const codex = payload.codex as { busy?: boolean } | undefined;
            setBusyState(Boolean(codex?.busy));
            helloRef.current?.resolve();
            helloRef.current = null;
            return;
        }
        if (type === "codex_state") {
            setBusyState(Boolean(payload.busy));
            return;
        }
        if (type === "conversation_changed") {
            const state = payload as CodexConversationState;
            setConversationStatus(state.status || "");
            if (state.status === "failed") appendError(`codex-conversation-${state.conversationId || Date.now()}`, state.error || "Codex 对话初始化失败", "Codex 连接失败");
            return;
        }
        if (type === "agent_event") {
            handleAgentEvent(payload as CodexAgentEvent);
            return;
        }
        if (type === "agent_done") {
            setBusyState(false);
            return;
        }
        if (type === "agent_error") {
            appendError(`codex-agent-error-${Date.now()}`, String(payload.message || "Codex 进程异常"), "Codex 运行失败");
            setBusyState(false);
            return;
        }
        if (type === "codex_approval") {
            const requestId = String(payload.requestId || "");
            const connection = connectionRef.current;
            if (requestId && connection) void resolveCodexApproval(connection.endpoint, connection.token, requestId, "acceptForSession").catch(() => undefined);
        }
    }, [appendError, handleAgentEvent, setBusyState]);

    const closeStream = useCallback(() => {
        const connection = connectionRef.current;
        if (connection?.source) {
            connection.source.close();
            connection.source = null;
        }
    }, []);

    const openStream = useCallback(async (endpoint: string, token: string, nextThreadId = "") => {
        closeStream();
        const clientId = clientIdRef.current;
        const { ticket } = await createCodexEventsTicket(endpoint, token, clientId);
        if (!ticket) throw new Error("本地 Agent 没有返回事件流 ticket");
        const connection: Connection = { endpoint, token, clientId, threadId: nextThreadId || connectionRef.current?.threadId || "", source: null };
        connectionRef.current = connection;
        const ready = new Promise<void>((resolve, reject) => {
            helloRef.current = { resolve, reject };
            window.setTimeout(() => {
                if (helloRef.current) {
                    helloRef.current = null;
                    reject(new Error("本地 Codex 事件流连接超时"));
                }
            }, 6000);
        });
        const source = openCodexEventStream(endpoint, ticket, clientId, (event) => handleEvent(event.type, event.payload));
        connection.source = source;
        source.onerror = () => {
            if (connectionRef.current?.source !== source) return;
            source.close();
            connection.source = null;
            if (helloRef.current) {
                helloRef.current.reject(new Error("无法连接本地 Codex 事件流"));
                helloRef.current = null;
                return;
            }
            setStatus("error");
            setError("Codex 事件流已断开");
            setBusyState(false);
        };
        await ready;
    }, [closeStream, handleEvent, setBusyState]);

    const waitForReady = useCallback(async (endpoint: string) => {
        for (let attempt = 0; attempt < 120; attempt += 1) {
            const health = await fetchCodexHealth(endpoint).catch(() => null);
            const current = health?.conversation;
            if (current?.status === "ready" || current?.status === "warning") {
                setConversationStatus(current.status);
                return;
            }
            if (current?.status === "failed") throw new Error(current.error || "Codex 对话初始化失败");
            await sleep(500);
        }
        throw new Error("Codex 对话初始化超时，请重试");
    }, []);

    const sendInternal = useCallback(async (text: string, options: { userVisible: boolean; messageId?: string }) => {
        const connection = connectionRef.current;
        if (!connection || !connection.threadId) throw new Error("Codex 尚未连接");
        const messageId = options.messageId || createClientUUID();
        if (options.userVisible) appendMessage({ id: `codex-user-${messageId}`, role: "user", text });
        setBusyState(true);
        try {
            await sendCodexTurn(connection.endpoint, connection.token, {
                threadId: connection.threadId,
                clientId: connection.clientId,
                prompt: text,
                messageId,
                messageText: options.userVisible ? text : "连接器唤醒 Codex",
            });
        } finally {
            setBusyState(false);
        }
    }, [appendMessage, setBusyState]);

    const startThread = useCallback(async (connection: Connection, greet: boolean) => {
        setBusyState(true);
        try {
            appendSystem("正在创建 Codex 对话…");
            const created = await createCodexThread(connection.endpoint, connection.token, connection.clientId);
            const nextThreadId = String(created.thread?.id || "");
            if (!nextThreadId) throw new Error(created.error || "Codex 没有返回对话 ID");
            connection.threadId = nextThreadId;
            setThreadId(nextThreadId);
            saveCodexConnection({ endpoint: connection.endpoint, token: connection.token, clientId: connection.clientId, threadId: nextThreadId });
            await waitForReady(connection.endpoint);
            appendSystem(greet ? "Codex 已连接，第一个对话已开始" : "新的 Codex 对话已就绪");
            setBusyState(false);
            if (greet) {
                const context = canvasId ? `当前画布有 ${nodeCount || 0} 个节点。` : "当前不在画布中。";
                await sendInternal(`${WELCOME_PROMPT.replace("。", `。${context}`)}`, { userVisible: false });
            }
        } finally {
            setBusyState(false);
        }
    }, [appendSystem, canvasId, nodeCount, setBusyState, sendInternal, waitForReady]);

    const connect = useCallback(async () => {
        if (connectingRef.current) return;
        connectingRef.current = true;
        setStatus("connecting");
        setError("");
        appendSystem("正在连接本地 Codex 插件…");
        try {
            const discovery = await discoverCodexConnector();
            if (!discovery) throw new Error("未检测到本地 Codex 插件。请安装 SupDance Canvas Codex 插件，并让 Codex 保持运行后重试。");
            const paired = await pairCodexConnector(clientIdRef.current);
            if (!paired.url || !paired.token) throw new Error("本地 Codex 插件没有返回连接信息");
            const connection: Connection = { endpoint: paired.url, token: paired.token, clientId: clientIdRef.current, threadId: "", source: null };
            connectionRef.current = connection;
            saveCodexConnection({ endpoint: connection.endpoint, token: connection.token, clientId: connection.clientId, threadId: "" });
            await openStream(connection.endpoint, connection.token);
            setDetected(true);
            setStatus("connected");
            await startThread(connection, true);
        } catch (cause) {
            setStatus("error");
            setError(errorText(cause));
            appendError(`codex-connect-${Date.now()}`, cause, "Codex 连接失败");
            closeStream();
            connectionRef.current = null;
            saveCodexConnection(null);
        } finally {
            connectingRef.current = false;
        }
    }, [appendError, appendSystem, closeStream, openStream, startThread]);

    const reconnect = useCallback(async () => {
        if (connectingRef.current) return;
        connectingRef.current = true;
        const stored = loadCodexConnection();
        if (!stored) {
            connectingRef.current = false;
            await connect();
            return;
        }
        setStatus("connecting");
        setError("");
        try {
            await openStream(stored.endpoint, stored.token, stored.threadId || "");
            setStatus("connected");
            if (stored.threadId) {
                setThreadId(stored.threadId);
                await resumeCodexThread(stored.endpoint, stored.token, stored.threadId, stored.clientId);
                appendSystem("Codex 连接已恢复");
            } else {
                await startThread(connectionRef.current!, true);
            }
        } catch {
            saveCodexConnection(null);
            setStatus("idle");
            connectingRef.current = false;
            await connect();
        } finally {
            connectingRef.current = false;
        }
    }, [appendSystem, connect, openStream, startThread]);

    const disconnect = useCallback(() => {
        closeStream();
        connectionRef.current = null;
        saveCodexConnection(null);
        setStatus("idle");
        setBusyState(false);
        setThreadId("");
        setConversationStatus("");
        setError("");
        appendSystem("已断开 Codex 连接");
    }, [appendSystem, closeStream, setBusyState]);

    const newThread = useCallback(async () => {
        const connection = connectionRef.current;
        if (!connection || busyRef.current) return;
        try {
            await startThread(connection, false);
        } catch (cause) {
            appendError(`codex-new-thread-${Date.now()}`, cause, "新建 Codex 对话失败");
        }
    }, [appendError, startThread]);

    const send = useCallback(async (text: string) => {
        const value = text.trim();
        if (!value || busyRef.current) return;
        try {
            await sendInternal(value, { userVisible: true });
        } catch (cause) {
            appendError(`codex-send-${Date.now()}`, cause, "消息没有送达");
        }
    }, [appendError, sendInternal]);

    const stop = useCallback(async () => {
        const connection = connectionRef.current;
        if (!connection) return;
        try {
            await interruptCodexTurn(connection.endpoint, connection.token, connection.threadId);
        } catch {
            // 停止请求本身失败时以服务端 turn 终态为准。
        } finally {
            setBusyState(false);
        }
    }, [setBusyState]);

    useEffect(() => {
        mountedRef.current = true;
        let active = true;
        void discoverCodexConnector().then((result) => {
            if (active) setDetected(Boolean(result));
        });
        return () => {
            active = false;
            mountedRef.current = false;
            closeStream();
        };
    }, [closeStream]);

    return {
        status,
        detected,
        busy,
        threadId,
        conversationStatus,
        error,
        connected: status === "connected",
        connect,
        reconnect,
        disconnect,
        newThread,
        send,
        stop,
    };
}

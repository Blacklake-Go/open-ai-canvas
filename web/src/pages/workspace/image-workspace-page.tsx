import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { App } from "antd";

import { translate } from "@/i18n";
import { createClientId, createClientUUID } from "@/lib/client-id";
import { generationErrorMessage } from "@/lib/generation-error";
import { getActiveUserScope } from "@/lib/user-scope";
import { localForageStorageForScope } from "@/lib/localforage-storage";
import { workspacePath } from "@/lib/workspace-routes";
import { useUserStore } from "@/stores/use-user-store";
import { useEffectiveConfig } from "@/stores/use-config-store";
import { createGenerationTask, waitForGenerationTask, isGenerationTaskTerminalError } from "@/services/api/task-center";
import { prepareBackendGenerationTask, parseBackendGenerationResult } from "@/services/api/generation-task";
import { creationHistoryAPI } from "@/services/api/creation-history";
import { creationHistoryMedia, restoreHistoryMedia } from "@/services/creation-history-media";
import { CreationHistorySync, CREATION_HISTORY_SYNC_KEY, type HistorySyncStatus } from "@/services/creation-history-sync";
import { CreationHistoryConflicts } from "@/pages/create/creation-history-conflicts";
import { readCreationConversationSnapshot, writeCreationConversationSnapshot } from "@/services/creation-conversation-snapshot";
import { loadCreationConversations } from "@/services/creation-conversation-store";
import { trackSiteTrafficAction } from "@/services/site-traffic";
import { splitCreationAttachments, type CreationAttachment } from "@/pages/create/creation-assets";
import { attachCreationTaskContexts } from "@/pages/create/creation-conversations";
import type { CreationConversation, CreationMessage } from "@/pages/create/creation-types";

import { ImageWorkspaceLeftNav } from "./image-workspace-left-nav";
import { ImageWorkspaceTimeline } from "./image-workspace-timeline";
import { ImageWorkspaceComposer, type ComposerSubmitValues } from "./image-workspace-composer";
import { ImageWorkspaceAssetDrawer } from "./image-workspace-asset-drawer";
import "./image-workspace.css";

const LEFT_NAV_COLLAPSED_KEY = "workspace.image.leftNavCollapsed";

const loadCreationRuntime = () => import("@/pages/create/creation-runtime");

type TaskObservedResult = {
    status: "queued" | "running" | "succeeded" | "failed";
    progress?: number;
    urls?: string[];
    keys?: string[];
    error?: string;
    /** 任务成功但结果未能物化进素材库；展示仍可用，保存可重试，不算生成失败。 */
    materializeError?: string;
};

type SessionDraft = {
    prompt: string;
    model: string;
    ratio: string;
    resolution: string;
    count: number;
    referenceImages: CreationAttachment[];
};

export default function ImageWorkspacePage() {
    const { sessionId } = useParams<{ sessionId?: string }>();
    const navigate = useNavigate();
    const { message: toast } = App.useApp();
    const user = useUserStore((state) => state.user);
    const userId = user?.id || null;
    const userSessionHydrated = useUserStore((state) => state.hydrated);
    const config = useEffectiveConfig();
    const activeScope = getActiveUserScope();

    // Navigation and drawer state
    const [leftNavCollapsed, setLeftNavCollapsed] = useState(() => {
        try {
            return window.localStorage.getItem(LEFT_NAV_COLLAPSED_KEY) === "1";
        } catch {
            return false;
        }
    });
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [assetDrawerOpen, setAssetDrawerOpen] = useState(false);
    const [sessionError, setSessionError] = useState<"not_found" | "unauthorized" | null>(null);
    const [historySync, setHistorySync] = useState<HistorySyncStatus>({ phase: "local" });

    // Draft values for Area C (bottom composer)
    const [draftPrompt, setDraftPrompt] = useState("");
    const [draftModel, setDraftModel] = useState("");
    const [draftRatio, setDraftRatio] = useState("1:1");
    const [draftResolution, setDraftResolution] = useState("1.5K");
    const [draftCount, setDraftCount] = useState(1);
    const [draftReferenceImages, setDraftReferenceImages] = useState<CreationAttachment[]>([]);
    const [externalReferenceImage, setExternalReferenceImage] = useState<string | null>(null);

    // Per-session drafts cache
    const sessionDraftsRef = useRef<Map<string, SessionDraft>>(new Map());

    // Conversations state
    const [conversations, setConversations] = useState<CreationConversation[]>(() => {
        const snap = userSessionHydrated ? readCreationConversationSnapshot<CreationConversation>(activeScope) : null;
        return snap || [];
    });
    const conversationsRef = useRef<CreationConversation[]>(conversations);
    conversationsRef.current = conversations;

    const [hydrated, setHydrated] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const historySessionRef = useRef<CreationHistorySync | null>(null);
    const historySyncTimerRef = useRef<number | null>(null);
    const activeTaskControllersRef = useRef(new Map<string, AbortController>());
    const taskResultsRef = useRef(new Map<string, TaskObservedResult>());
    // 非终态中断（网络抖动/超时/物化失败）后的自动重试计数；成功后清零，避免无限空转。
    const taskRetryCountsRef = useRef(new Map<string, number>());
    const taskRetryTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
    const observeTaskRef = useRef<(taskId: string, targetSessionId: string, messageId: string, options?: { force?: boolean }) => void>(() => {});
    const syncWarningShownRef = useRef(false);

    const toggleLeftNav = () => {
        setLeftNavCollapsed((prev) => {
            const next = !prev;
            try {
                window.localStorage.setItem(LEFT_NAV_COLLAPSED_KEY, next ? "1" : "0");
            } catch {
                // ignore
            }
            return next;
        });
    };

    // Find active conversation
    const activeConversation = useMemo(() => {
        if (!sessionId) return undefined;
        return conversations.find((c) => c.id === sessionId);
    }, [conversations, sessionId]);

    // Save helper: updates state and local cache, then pushes to the cloud.
    // save() 只写本地持久队列；必须跟一次防抖 sync，否则新会话停留 pending，换设备即丢。
    const saveConversations = useCallback(
        async (updated: CreationConversation[]) => {
            setConversations(updated);
            conversationsRef.current = updated;
            writeCreationConversationSnapshot(activeScope, updated);
            const session = historySessionRef.current;
            if (!session) return;
            try {
                await session.saveAndScheduleSync(updated, historySyncTimerRef);
            } catch (error) {
                // 本机快照已更新，但持久队列失败必须让用户知道云端未保存。
                console.warn("保存创作历史失败", error);
                toast.warning(translate("create.workspace.saveFailed"));
            }
        },
        [activeScope, toast],
    );

    // Task observer: coordinates all tasks in a batch and accurately updates message state.
    // force 用于「重新获取结果」：忽略已缓存的失败结论，重新跟进原任务，不创建新任务。
    const observeTask = useCallback(
        (taskId: string, targetSessionId: string, messageId: string, options?: { force?: boolean }) => {
            const existingResult = taskResultsRef.current.get(taskId);
            if (!options?.force && existingResult && (existingResult.status === "succeeded" || existingResult.status === "failed")) return;
            if (options?.force) {
                taskResultsRef.current.delete(taskId);
                taskRetryCountsRef.current.delete(taskId);
            }
            if (activeTaskControllersRef.current.has(taskId)) return;

            const controller = new AbortController();
            activeTaskControllersRef.current.set(taskId, controller);

            void (async () => {
                try {
                    const completedTask = await waitForGenerationTask(taskId, {
                        signal: controller.signal,
                        onTaskUpdate: (task) => {
                            taskResultsRef.current.set(taskId, {
                                status: "running",
                                progress: typeof task.progress === "number" ? Math.round(task.progress) : undefined,
                            });
                            // Update live progress in message if available
                            setConversations((current) =>
                                current.map((conv) => {
                                    if (conv.id !== targetSessionId) return conv;
                                    return {
                                        ...conv,
                                        messages: conv.messages.map((m) => {
                                            if (m.id !== messageId) return m;
                                            return {
                                                ...m,
                                                generationStatus: task.status,
                                                generationStage: task.stage,
                                                generationProgress: typeof task.progress === "number" ? Math.round(task.progress) : m.generationProgress,
                                                ...(m.syncInterrupted ? { syncInterrupted: undefined } : {}),
                                            };
                                        }),
                                    };
                                }),
                            );
                        },
                    });

                    if (controller.signal.aborted) return;

                    // 成功任务先物化进素材库（幂等 effectKey + 跨标签锁），保留真实尺寸/字节/storageKey。
                    // 物化失败不代表生成失败：结果仍可展示，转交恢复监听稍后重试保存。
                    const contextual = attachCreationTaskContexts([completedTask], conversationsRef.current)[0];
                    let resultUrls: string[] = [];
                    let resultStorageKeys: string[] = [];
                    let materializeError: string | undefined;
                    try {
                        const runtime = await loadCreationRuntime();
                        const materialized = await runtime.consumeGenerationTaskMessage(
                            contextual,
                            messageId,
                            () => {
                                // 消息状态由下方批量收敛统一写入；这里只借助幂等 effect 完成素材登记。
                            },
                            { signal: controller.signal },
                        );
                        if (controller.signal.aborted) return;
                        resultUrls = runtime.generationTaskMaterializedUrls(materialized);
                        resultStorageKeys = runtime.generationTaskMaterializedStorageKeys(materialized);
                    } catch (error) {
                        if (controller.signal.aborted) return;
                        materializeError = error instanceof Error ? error.message : translate("create.workspace.materializeFailed");
                        console.warn("生成结果物化失败，稍后自动重试保存", error);
                    }
                    // 物化没有产出时退回任务自带结果，保证已生成的作品仍能展示与下载。
                    if (!resultUrls.length && !resultStorageKeys.length) {
                        try {
                            const result = parseBackendGenerationResult(completedTask);
                            resultUrls = (result.images?.map((img) => img.dataUrl).filter(Boolean) as string[]) || [];
                            resultStorageKeys = (result.images?.map((img) => img.storageKey).filter(Boolean) as string[]) || [];
                        } catch {
                            // 结果 JSON 缺失时保留 previewUrl 作为展示兜底。
                        }
                        if (!resultUrls.length && completedTask.previewUrl) resultUrls = [completedTask.previewUrl];
                    }

                    taskRetryCountsRef.current.delete(taskId);
                    taskResultsRef.current.set(taskId, {
                        status: "succeeded",
                        urls: resultUrls,
                        keys: resultStorageKeys,
                        ...(materializeError ? { materializeError } : {}),
                    });
                } catch (error) {
                    if (controller.signal.aborted) return;

                    if (isGenerationTaskTerminalError(error)) {
                        // 后端确认失败/取消才是生成失败；保留任务错误语义供重试判断。
                        taskRetryCountsRef.current.delete(taskId);
                        taskResultsRef.current.set(taskId, {
                            status: "failed",
                            error: generationErrorMessage(error),
                        });
                    } else {
                        // 轮询中断、网络抖动、等待超时：任务可能仍在执行，不能标失败引导用户重复付费。
                        // 标记连接中断并有限次自动重连，交由恢复监听继续跟进原任务。
                        const attempts = (taskRetryCountsRef.current.get(taskId) || 0) + 1;
                        taskRetryCountsRef.current.set(taskId, attempts);
                        taskResultsRef.current.set(taskId, { status: "running" });
                        if (!syncWarningShownRef.current) {
                            syncWarningShownRef.current = true;
                            toast.warning(translate("create.workspace.syncInterrupted"));
                        }
                        setConversations((current) => {
                            const updated = current.map((conv) => {
                                if (conv.id !== targetSessionId) return conv;
                                return {
                                    ...conv,
                                    messages: conv.messages.map((m) => (m.id === messageId && m.status !== "done" && m.status !== "error" ? { ...m, status: "pending" as const, syncInterrupted: true, error: undefined, errorKind: undefined } : m)),
                                };
                            });
                            void saveConversations(updated);
                            return updated;
                        });
                        if (attempts <= 3) {
                            const timer = setTimeout(
                                () => {
                                    taskRetryTimersRef.current.delete(taskId);
                                    observeTaskRef.current(taskId, targetSessionId, messageId);
                                },
                                Math.min(30_000, 5_000 * attempts),
                            );
                            taskRetryTimersRef.current.set(taskId, timer);
                        }
                        return;
                    }
                } finally {
                    activeTaskControllersRef.current.delete(taskId);
                }

                // Batch coordination: check all tasks belonging to this message
                setConversations((current) => {
                    const targetConv = current.find((c) => c.id === targetSessionId);
                    if (!targetConv) return current;

                    const targetMsg = targetConv.messages.find((m) => m.id === messageId);
                    if (!targetMsg) return current;

                    const allTaskIds = targetMsg.taskIds?.length ? targetMsg.taskIds : [taskId];
                    const taskStatuses = allTaskIds.map((id) => taskResultsRef.current.get(id));

                    const succeededTasks = taskStatuses.filter((t) => t?.status === "succeeded");
                    const failedTasks = taskStatuses.filter((t) => t?.status === "failed");
                    const allSettled = succeededTasks.length + failedTasks.length >= allTaskIds.length;

                    const newUrls = succeededTasks.flatMap((t) => t?.urls || []);
                    const newKeys = succeededTasks.flatMap((t) => t?.keys || []);
                    const combinedUrls = Array.from(new Set([...(targetMsg.resultUrls || []), ...newUrls]));
                    const combinedKeys = Array.from(new Set([...(targetMsg.resultStorageKeys || []), ...newKeys]));
                    const materializeErrors = succeededTasks.map((t) => t?.materializeError).filter(Boolean);

                    let nextStatus = targetMsg.status;
                    let nextGenStatus = targetMsg.generationStatus;
                    let nextError = targetMsg.error;

                    if (allSettled) {
                        if (succeededTasks.length > 0) {
                            nextStatus = "done";
                            nextGenStatus = "succeeded";
                            nextError = undefined;
                        } else {
                            nextStatus = "error";
                            nextGenStatus = "failed";
                            nextError = failedTasks[0]?.error || translate("create.status.failed");
                        }
                    } else {
                        nextStatus = "pending";
                        nextGenStatus = "running";
                    }

                    const updated = current.map((conv) => {
                        if (conv.id !== targetSessionId) return conv;
                        return {
                            ...conv,
                            updatedAt: new Date().toISOString(),
                            messages: conv.messages.map((m) => {
                                if (m.id !== messageId) return m;
                                return {
                                    ...m,
                                    status: nextStatus,
                                    generationStatus: nextGenStatus,
                                    resultUrls: combinedUrls,
                                    resultStorageKeys: combinedKeys,
                                    error: nextError,
                                    // 后端确认失败才写 errorKind:"task"；物化未完成标记 mediaRecoverable 供重新保存。
                                    ...(nextStatus === "error" ? { errorKind: "task" as const } : { errorKind: undefined }),
                                    ...(nextStatus === "done" ? { syncInterrupted: undefined, mediaRecoverable: materializeErrors.length > 0 || undefined } : {}),
                                };
                            }),
                        };
                    });

                    void saveConversations(updated);
                    return updated;
                });
            })();
        },
        [saveConversations, toast],
    );
    observeTaskRef.current = observeTask;

    // Initialize CreationHistorySync
    useEffect(() => {
        if (!userSessionHydrated) return;
        const scope = activeScope;
        const controller = new AbortController();
        const active = () => !controller.signal.aborted && getActiveUserScope() === scope;
        const storage = localForageStorageForScope(scope);

        const applyConversations = (items: CreationConversation[]) => {
            if (!active()) return;
            // Merge with local snapshot to avoid wiping out newly created sessions
            const snapshot = readCreationConversationSnapshot<CreationConversation>(scope) || [];
            const snapshotMap = new Map(snapshot.map((c) => [c.id, c]));
            for (const item of items) {
                if (!snapshotMap.has(item.id)) {
                    snapshotMap.set(item.id, item);
                }
            }
            const merged = Array.from(snapshotMap.values());
            const restored = merged.map((item) => ({
                ...item,
                messages: item.messages.map(restoreHistoryMedia),
            }));
            setConversations(restored);
            conversationsRef.current = restored;
            writeCreationConversationSnapshot(scope, restored);
            setHydrated(true);
        };

        const session = new CreationHistorySync({
            read: async () => await storage.getItem(CREATION_HISTORY_SYNC_KEY),
            readLegacy: () => loadCreationConversations<CreationConversation>(scope),
            write: async (val) => {
                await storage.setItem(CREATION_HISTORY_SYNC_KEY, val);
            },
            api: creationHistoryAPI(scope, controller.signal),
            prepare: creationHistoryMedia(scope, controller.signal, active),
            cloud: Boolean(userId),
            active,
            onChange: applyConversations,
            onStatus: (status) => {
                if (active()) setHistorySync(status);
            },
        });

        historySessionRef.current = session;

        // 与创作页同款兜底：回前台/聚焦/定时都会补推本地 pending，防止防抖丢失后长期不同步。
        const refreshSync = () => {
            if (active() && document.visibilityState !== "hidden") void session.sync();
        };
        window.addEventListener("focus", refreshSync);
        document.addEventListener("visibilitychange", refreshSync);
        const syncPoll = window.setInterval(refreshSync, 15000);

        void session
            .load()
            .then((items) => {
                if (!active()) return;
                applyConversations(items);
                void session.sync();
            })
            .catch((err) => {
                // 账号切换会 abort 首次 load；此时新的 init effect 会重新加载，
                // 不能提前置 hydrated，否则路由兜底在空列表上抢先新建会话（浏览器实测 P2）。
                if (controller.signal.aborted || !active()) return;
                console.warn("加载创作历史失败", err);
                setHydrated(true);
            });

        return () => {
            controller.abort();
            session.dispose();
            window.clearInterval(syncPoll);
            window.removeEventListener("focus", refreshSync);
            document.removeEventListener("visibilitychange", refreshSync);
            if (historySessionRef.current === session) {
                historySessionRef.current = null;
            }
            if (historySyncTimerRef.current) {
                window.clearTimeout(historySyncTimerRef.current);
                historySyncTimerRef.current = null;
            }
            for (const [, c] of activeTaskControllersRef.current) {
                c.abort();
            }
            activeTaskControllersRef.current.clear();
            for (const [, timer] of taskRetryTimersRef.current) {
                clearTimeout(timer);
            }
            taskRetryTimersRef.current.clear();
            syncWarningShownRef.current = false;
        };
    }, [userId, userSessionHydrated, activeScope]);

    // Handle sessionId URL routing:
    // If no sessionId is in the URL, pick the most recent one or generate a new sessionId without polluting cloud history
    useEffect(() => {
        if (!hydrated) return;

        if (!sessionId) {
            const imageSessions = conversations.filter((c) => !c.messages.length || c.messages.some((m) => m.mode === "image" || m.settings?.mode === "image"));
            if (imageSessions.length > 0) {
                const target = imageSessions[0];
                navigate(workspacePath(`/workspace/image/${encodeURIComponent(target.id)}`), { replace: true });
            } else {
                // 没有图片会话就新建，不要跳进纯文本/视频会话。
                // 新 ID 必须先写入本地会话列表再跳转：否则会话校验 effect 会把刚生成的 ID
                // 当成陌生会话去查云端，404 后整页误报「会话不存在」（浏览器实测 P1）。
                const newId = `c-${createClientUUID()}`;
                const newConv: CreationConversation = {
                    id: newId,
                    title: translate("create.history.new"),
                    updatedAt: new Date().toISOString(),
                    messages: [],
                };
                const next = [newConv, ...conversationsRef.current];
                conversationsRef.current = next;
                setConversations(next);
                writeCreationConversationSnapshot(activeScope, next);
                navigate(workspacePath(`/workspace/image/${encodeURIComponent(newId)}`), { replace: true });
            }
        }
    }, [hydrated, sessionId, conversations, navigate, activeScope]);

    // Check non-existent / unauthorized session:
    // If sessionId is provided in URL but not in local state, query cloud detail or flag error
    useEffect(() => {
        if (!hydrated || !sessionId) {
            setSessionError(null);
            return;
        }

        const foundLocally = conversations.some((c) => c.id === sessionId);
        if (foundLocally) {
            setSessionError(null);
            return;
        }

        // If not in local list, attempt to fetch from cloud
        if (!userId) {
            setSessionError("not_found");
            return;
        }

        let cancelled = false;
        const controller = new AbortController();
        const api = creationHistoryAPI(activeScope, controller.signal);

        api.get(sessionId)
            .then((detail) => {
                if (cancelled) return;
                const restoredConv: CreationConversation = {
                    id: detail.id,
                    title: detail.title || translate("create.workspace.untitledRecord"),
                    updatedAt: detail.updatedAt,
                    canvasId: detail.canvasId,
                    messages: (detail.messages || []).filter((m) => !m.deleted).map((m) => restoreHistoryMedia(m.data as unknown as CreationMessage)),
                };
                setConversations((current) => {
                    if (current.some((c) => c.id === detail.id)) return current;
                    const next = [restoredConv, ...current];
                    writeCreationConversationSnapshot(activeScope, next);
                    return next;
                });
                setSessionError(null);
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                const status = (err as { status?: number })?.status;
                const code = (err as { code?: number })?.code;
                const reason = (err as { reason?: string })?.reason;
                if (status === 403 || code === 403 || reason === "unauthorized" || reason === "forbidden") {
                    setSessionError("unauthorized");
                } else {
                    setSessionError("not_found");
                }
            });

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [hydrated, sessionId, conversations, userId, activeScope]);

    // Draft retention across sessions
    const prevSessionIdRef = useRef<string | undefined>(sessionId);
    useEffect(() => {
        const prevId = prevSessionIdRef.current;
        prevSessionIdRef.current = sessionId;

        if (sessionId && sessionId !== prevId) {
            const draft = sessionDraftsRef.current.get(sessionId);
            if (draft) {
                setDraftPrompt(draft.prompt);
                if (draft.model) setDraftModel(draft.model);
                if (draft.ratio) setDraftRatio(draft.ratio);
                if (draft.resolution) setDraftResolution(draft.resolution);
                if (draft.count) setDraftCount(draft.count);
                setDraftReferenceImages(draft.referenceImages || []);
            } else {
                setDraftPrompt("");
                setDraftReferenceImages([]);
            }
        }
    }, [sessionId]);

    // Network online re-synchronization
    useEffect(() => {
        const handleOnline = () => {
            toast.info(translate("create.workspace.backOnline"));
            if (historySessionRef.current) {
                void historySessionRef.current.sync();
            }
            if (activeConversation) {
                for (const message of activeConversation.messages) {
                    if (message.role === "assistant" && (message.status === "pending" || message.status === "streaming")) {
                        const taskIds = message.taskIds || [];
                        for (const taskId of taskIds) {
                            observeTask(taskId, activeConversation.id, message.id);
                        }
                    }
                }
            }
        };

        window.addEventListener("online", handleOnline);
        return () => window.removeEventListener("online", handleOnline);
    }, [activeConversation, observeTask, toast]);

    // Scan for pending tasks across all conversations and start observing them
    useEffect(() => {
        for (const conv of conversations) {
            for (const message of conv.messages) {
                // syncInterrupted 的消息同样需要恢复监听：任务没有失败，只是页面没跟上。
                if (message.role === "assistant" && (message.status === "pending" || message.status === "streaming" || message.syncInterrupted)) {
                    const taskIds = message.taskIds || [];
                    for (const taskId of taskIds) {
                        observeTask(taskId, conv.id, message.id);
                    }
                }
            }
        }
    }, [conversations, observeTask]);

    // Submission handler for Area C (bottom composer)
    const handleSubmitTask = async (values: ComposerSubmitValues) => {
        if (!sessionId || submitting || sessionError) return;
        setSubmitting(true);

        try {
            // composer 已按账号并发 clamp；这里只保留与 runBackendGenerationTaskBatch 一致的硬上限 15。
            const taskCount = Math.max(1, Math.min(15, Math.floor(values.count) || 1));
            const promptText = values.prompt.trim();
            // 消息 ID 先于任务创建生成：metadata.messageId 是物化素材回挂消息与幂等登记的稳定标识。
            const userMsgId = createClientId();
            const assistantMsgId = createClientId();

            // Prepare task input
            const { referenceImages } = splitCreationAttachments(values.referenceImages);
            // 与创作页同一技能链路：提示词中的 @[skill:ID] 引用在提交时展开为技能上下文；
            // 无技能权限或无引用时 skillRuntime 原样返回，不产生额外请求。
            let expandedPrompt = promptText;
            let skillMetadata: Record<string, unknown> = {};
            if (/@\[skill:[^\]]+\]/.test(promptText)) {
                try {
                    const [{ listAddedSkills }, runtime] = await Promise.all([import("@/services/api/skills"), loadCreationRuntime()]);
                    const { skills } = await listAddedSkills();
                    const execution = await runtime.skillRuntime.prepare({ profile: "creation", prompt: promptText, skills });
                    expandedPrompt = execution.prompt;
                    skillMetadata = execution.metadata as Record<string, unknown>;
                } catch (error) {
                    toast.error(error instanceof Error ? error.message : translate("create.page.skillContextFailed"));
                    return;
                }
            }
            const taskInput = await prepareBackendGenerationTask({
                mode: "image",
                prompt: expandedPrompt,
                config: {
                    ...config,
                    model: values.model,
                    imageModel: values.model,
                    size: values.ratio,
                    quality: values.quality,
                    imageResolution: values.resolution,
                    count: "1",
                },
                referenceImages,
                metadata: {
                    // 后端只识别 create-page 来源的会话上下文（task_output.go），沿用同一契约。
                    source: "create-page",
                    conversationId: sessionId,
                    messageId: assistantMsgId,
                    ...skillMetadata,
                },
            });

            // Create backend tasks
            const createdTasks = await Promise.all(
                Array.from({ length: taskCount }, (_, i) =>
                    createGenerationTask({
                        ...taskInput,
                        idempotencyKey: `${assistantMsgId}:${i}`,
                        input: {
                            ...taskInput.input,
                            metadata: {
                                ...((taskInput.input?.metadata as Record<string, unknown>) || {}),
                                batchIndex: i,
                                batchCount: taskCount,
                            },
                        },
                    }),
                ),
            );

            const taskIds = createdTasks.map((t) => t.id);
            trackSiteTrafficAction("creation_submit_image");

            const userMessage: CreationMessage = {
                id: userMsgId,
                role: "user",
                content: promptText,
                mode: "image",
                model: values.model,
                attachments: values.referenceImages,
                settings: {
                    ratio: values.ratio,
                    seconds: "0",
                    quality: values.quality,
                    videoQuality: "auto",
                    imageResolution: values.resolution,
                    count: String(taskCount),
                    model: values.model,
                },
                createdAt: new Date().toISOString(),
            };

            const assistantMessage: CreationMessage = {
                id: assistantMsgId,
                role: "assistant",
                content: "",
                mode: "image",
                model: values.model,
                status: "pending",
                generationStatus: "queued",
                taskIds,
                settings: {
                    ratio: values.ratio,
                    seconds: "0",
                    quality: values.quality,
                    videoQuality: "auto",
                    imageResolution: values.resolution,
                    count: String(taskCount),
                    model: values.model,
                },
                createdAt: new Date().toISOString(),
            };

            // Update conversation messages
            const currentList = conversationsRef.current;
            const targetConv = currentList.find((c) => c.id === sessionId);

            let updatedList: CreationConversation[];
            if (targetConv) {
                const isFirst = !targetConv.messages.length;
                const newTitle = isFirst ? promptText.slice(0, 30) : targetConv.title;
                updatedList = currentList.map((c) => {
                    if (c.id !== sessionId) return c;
                    return {
                        ...c,
                        title: newTitle,
                        updatedAt: new Date().toISOString(),
                        messages: [...c.messages, userMessage, assistantMessage],
                    };
                });
            } else {
                const newConv: CreationConversation = {
                    id: sessionId,
                    title: promptText.slice(0, 30),
                    updatedAt: new Date().toISOString(),
                    messages: [userMessage, assistantMessage],
                };
                updatedList = [newConv, ...currentList];
            }

            await saveConversations(updatedList);

            // Clear draft for this session
            sessionDraftsRef.current.delete(sessionId);

            // Start observing newly created tasks
            for (const taskId of taskIds) {
                observeTask(taskId, sessionId, assistantMsgId);
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : translate("create.page.submitFailed"));
            throw error;
        } finally {
            setSubmitting(false);
        }
    };

    // Area A callbacks
    const handleSelectSession = (id: string) => {
        if (id === sessionId) return;
        setMobileNavOpen(false);
        navigate(workspacePath(`/workspace/image/${encodeURIComponent(id)}`));
    };

    const handleNewSession = async () => {
        setMobileNavOpen(false);
        if (activeConversation && activeConversation.messages.length === 0) {
            return;
        }
        const newId = `c-${createClientUUID()}`;
        const newConv: CreationConversation = {
            id: newId,
            title: translate("create.history.new"),
            updatedAt: new Date().toISOString(),
            messages: [],
        };
        // 只保留当前会话；其它空会话可能存着别的草稿，不能顺手清掉。
        const updated = [newConv, ...conversations];
        await saveConversations(updated);
        navigate(workspacePath(`/workspace/image/${encodeURIComponent(newId)}`));
    };

    const handleRenameSession = async (id: string, newTitle: string) => {
        const updated = conversations.map((c) => (c.id === id ? { ...c, title: newTitle, updatedAt: new Date().toISOString() } : c));
        try {
            await saveConversations(updated);
            toast.success(translate("create.workspace.renamed"));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : translate("create.page.renameFailed"));
        }
    };

    const handleDeleteSession = async (id: string) => {
        const remaining = conversations.filter((c) => c.id !== id);
        if (historySessionRef.current) {
            try {
                await historySessionRef.current.remove(id, remaining);
            } catch (error) {
                // 删除是写路径：云端/本机队列失败必须保留会话并明确报错，不得伪报成功。
                console.warn("删除创作会话失败", error);
                toast.error(translate("create.page.deleteFailed"));
                return;
            }
        }
        try {
            await saveConversations(remaining);
        } catch (error) {
            console.warn("删除创作会话保存失败", error);
            toast.error(translate("create.page.deleteFailed"));
            return;
        }
        toast.success(translate("create.workspace.deleted"));

        if (id === sessionId) {
            if (remaining.length > 0) {
                navigate(workspacePath(`/workspace/image/${encodeURIComponent(remaining[0].id)}`), { replace: true });
            } else {
                void handleNewSession();
            }
        }
    };

    // Area B callbacks
    const handleReuseParams = (userMessage: CreationMessage) => {
        if (userMessage.content) setDraftPrompt(userMessage.content);
        if (userMessage.model) setDraftModel(userMessage.model);
        if (userMessage.settings?.ratio) setDraftRatio(userMessage.settings.ratio);
        if (userMessage.settings?.imageResolution) setDraftResolution(userMessage.settings.imageResolution);
        if (userMessage.settings?.count) setDraftCount(Number(userMessage.settings.count) || 1);
        if (userMessage.attachments?.length) setDraftReferenceImages(userMessage.attachments);
        toast.success(translate("create.workspace.paramsReused"));
    };

    const handleRegenerate = (userMessage: CreationMessage) => {
        // 找到这条用户消息对应的结果消息：未确认失败（syncInterrupted / 无 errorKind）时
        // 不能直接新建任务，先重新获取原任务结果，避免重复扣费。
        const conv = conversationsRef.current.find((c) => c.id === sessionId);
        const index = conv?.messages.findIndex((m) => m.id === userMessage.id) ?? -1;
        const assistant = index >= 0 ? conv?.messages[index + 1] : undefined;
        if (assistant && assistant.role === "assistant" && assistant.taskIds?.length && (assistant.syncInterrupted || (assistant.status === "error" && assistant.errorKind !== "task"))) {
            toast.info(translate("create.workspace.refetchFirst"));
            handleRefetchResult(assistant);
            return;
        }
        void handleSubmitTask({
            prompt: userMessage.content,
            model: userMessage.model || draftModel || config.imageModel,
            ratio: userMessage.settings?.ratio || draftRatio,
            resolution: userMessage.settings?.imageResolution || draftResolution,
            quality: userMessage.settings?.quality || "auto",
            count: Number(userMessage.settings?.count) || draftCount,
            referenceImages: userMessage.attachments || [],
        });
    };

    // 重新获取结果：只读原任务并重新物化，不创建新任务、不重复扣费。
    const handleRefetchResult = (assistantMessage: CreationMessage) => {
        if (!sessionId) return;
        const taskIds = assistantMessage.taskIds || [];
        if (!taskIds.length) return;
        setConversations((current) => {
            const updated = current.map((conv) => {
                if (conv.id !== sessionId) return conv;
                return {
                    ...conv,
                    messages: conv.messages.map((m) => (m.id === assistantMessage.id ? { ...m, status: "pending" as const, generationStatus: "queued" as const, error: undefined, errorKind: undefined, syncInterrupted: true } : m)),
                };
            });
            void saveConversations(updated);
            return updated;
        });
        for (const taskId of taskIds) {
            observeTask(taskId, sessionId, assistantMessage.id, { force: true });
        }
    };

    // 重新保存：作品已生成但物化/保存失败，重放保存检查点，不重新生成、不重复扣费。
    const handleRecoverMedia = async (assistantMessage: CreationMessage) => {
        if (!sessionId) return;
        const taskIds = assistantMessage.taskIds || [];
        if (!taskIds.length) return;
        try {
            const runtime = await loadCreationRuntime();
            const recovered = await Promise.allSettled(taskIds.map((id) => runtime.recoverGenerationTaskMedia(id)));
            if (!recovered.some((entry) => entry.status === "fulfilled")) {
                const rejected = recovered.find((entry): entry is PromiseRejectedResult => entry.status === "rejected");
                throw rejected?.reason instanceof Error ? rejected.reason : new Error(translate("create.page.resaveUnavailable"));
            }
            handleRefetchResult(assistantMessage);
        } catch (error) {
            toast.error(translate("create.page.resaveFailed", { reason: generationErrorMessage(error) }));
        }
    };

    const handleSetReferenceImage = (url: string) => {
        setExternalReferenceImage(url);
    };

    const handleDraftChange = (values: ComposerSubmitValues) => {
        if (!sessionId) return;
        sessionDraftsRef.current.set(sessionId, {
            prompt: values.prompt,
            model: values.model,
            ratio: values.ratio,
            resolution: values.resolution,
            count: values.count,
            referenceImages: values.referenceImages,
        });
    };

    return (
        <div className="image-workspace-root">
            {/* 同步状态与创作页共用词条：区分本机缓存与服务端持久化，冲突副本可处理。 */}
            <p role="status" aria-live="polite" className="image-workspace-sync-status">
                <span title={historySync.message}>{translate(`create.historySync.${historySync.phase}`)}</span>
                {historySync.message ? <span> · {historySync.message}</span> : null}
                {historySync.phase === "error" ? (
                    <button type="button" className="image-workspace-sync-retry" onClick={() => void historySessionRef.current?.sync()}>
                        {translate("create.historySync.retry")}
                    </button>
                ) : null}
                <CreationHistoryConflicts key={activeScope} session={historySessionRef.current} status={historySync} busy={submitting} />
            </p>
            {/* Area A: 左侧固定导航 */}
            <ImageWorkspaceLeftNav
                conversations={conversations}
                activeSessionId={sessionId || ""}
                collapsed={leftNavCollapsed}
                mobileOpen={mobileNavOpen}
                onCloseMobile={() => setMobileNavOpen(false)}
                onToggleCollapse={toggleLeftNav}
                onSelectSession={handleSelectSession}
                onNewSession={handleNewSession}
                onRenameSession={handleRenameSession}
                onDeleteSession={handleDeleteSession}
            />

            {/* Area B: 中央生成时间流 */}
            <ImageWorkspaceTimeline
                conversation={activeConversation}
                sessionError={sessionError}
                onReuseParams={handleReuseParams}
                onRegenerate={handleRegenerate}
                onRefetchResult={handleRefetchResult}
                onRecoverMedia={(message) => void handleRecoverMedia(message)}
                onSetReferenceImage={handleSetReferenceImage}
                onRenameSession={(title) => {
                    if (sessionId) void handleRenameSession(sessionId, title);
                }}
                onOpenAssetDrawer={() => setAssetDrawerOpen((prev) => !prev)}
                assetDrawerOpen={assetDrawerOpen}
                onOpenMobileNav={() => setMobileNavOpen(true)}
                onNewSession={handleNewSession}
            />

            {/* Area C: 底部固定创作编辑器 */}
            {!sessionError && (
                <ImageWorkspaceComposer
                    draftPrompt={draftPrompt}
                    draftModel={draftModel}
                    draftRatio={draftRatio}
                    draftResolution={draftResolution}
                    draftCount={draftCount}
                    draftReferenceImages={draftReferenceImages}
                    externalReferenceImage={externalReferenceImage}
                    onExternalReferenceConsumed={() => setExternalReferenceImage(null)}
                    onDraftChange={handleDraftChange}
                    onSubmit={handleSubmitTask}
                    submitting={submitting}
                />
            )}

            {/* Area D: 右侧素材面板 */}
            <ImageWorkspaceAssetDrawer open={assetDrawerOpen} onClose={() => setAssetDrawerOpen(false)} onSelectReference={handleSetReferenceImage} />
        </div>
    );
}

import { create } from "zustand";
import type { VisualEngineConfig, VisualEngineSnapshot, AuditLogEntry, PresetId } from "../types";
import { DEFAULT_VISUAL_ENGINE_CONFIG, BUILTIN_THEME_PRESETS } from "../config/default-config";
import { apiPublishVisualEngineConfig, apiRollbackVisualEngineConfig, fetchAdminVisualEngineOverview, fetchVisualEnginePublicBundle, type VisualEngineAdminOverview } from "../api/visual-engine-api";
import { validateVisualEngineConfig } from "../config/schema";
import { notifyPluginStateChanged } from "@/supdance/adapters/plugin-state-sync";
import { useUserStore } from "@/stores/use-user-store";

let sessionEpoch = 0;

export type ConsoleModuleKey = "dashboard" | "themes" | "colors" | "typography" | "components" | "effects" | "interactions" | "motion" | "transitions" | "loading" | "pagerules" | "preview" | "presets" | "versions" | "diagnostics" | "auditlogs";

type VisualEngineState = {
    enabled: boolean;
    loaded: boolean;
    canPublish: boolean;
    canRollback: boolean;
    error: string | null;
    revision: string;
    refresh: (admin?: boolean, signal?: AbortSignal) => Promise<void>;
    resetSession: () => void;
    config: VisualEngineConfig;
    draftConfig: VisualEngineConfig;
    snapshots: VisualEngineSnapshot[];
    auditLogs: AuditLogEntry[];
    activeConsoleModule: ConsoleModuleKey;
    previewViewport: "desktop" | "tablet" | "mobile";
    previewThemeMode: "light" | "dark";
    isDraftDirty: boolean;
    isSaving: boolean;
    isPublishing: boolean;

    // Actions
    setEnabled: (enabled: boolean) => void;
    setConsoleModule: (module: ConsoleModuleKey) => void;
    setPreviewViewport: (viewport: "desktop" | "tablet" | "mobile") => void;
    setPreviewThemeMode: (mode: "light" | "dark") => void;
    updateDraft: (updater: (draft: VisualEngineConfig) => VisualEngineConfig | void) => void;
    resetDraft: () => void;
    switchPreset: (presetId: PresetId | string) => void;
    publishDraft: (actor?: string, summary?: string) => Promise<{ success: boolean; error?: string }>;
    rollbackToSnapshot: (version: string, actor?: string) => Promise<{ success: boolean; error?: string }>;
};

export const useVisualEngineStore = create<VisualEngineState>((set, get) => ({
    enabled: false,
    loaded: false,
    canPublish: false,
    canRollback: false,
    error: null,
    revision: "",
    config: structuredClone(DEFAULT_VISUAL_ENGINE_CONFIG),
    draftConfig: structuredClone(DEFAULT_VISUAL_ENGINE_CONFIG),
    snapshots: [],
    auditLogs: [],
    activeConsoleModule: "dashboard",
    previewViewport: "desktop",
    previewThemeMode: "dark",
    isDraftDirty: false,
    isSaving: false,
    isPublishing: false,

    setEnabled: (enabled) => set({ enabled }),
    resetSession: () => {
        sessionEpoch++;
        set({ canPublish: false, canRollback: false, snapshots: [], auditLogs: [], draftConfig: structuredClone(get().config), isDraftDirty: false, isPublishing: false });
    },
    refresh: async (admin = false, signal) => {
        const epoch = sessionEpoch;
        const userId = useUserStore.getState().user?.id;
        try {
            const overview = admin ? await fetchAdminVisualEngineOverview(signal) : undefined;
            const bundle = overview?.bundle ?? (await fetchVisualEnginePublicBundle(signal));
            if (signal?.aborted || epoch !== sessionEpoch || userId !== useUserStore.getState().user?.id) return;
            const validated = validateVisualEngineConfig(bundle.config);
            if (!validated.valid) throw new Error(validated.errors.join("；"));
            set((state) => ({
                enabled: bundle.enabled,
                loaded: true,
                revision: bundle.revision,
                config: validated.config,
                error: null,
                draftConfig: state.isDraftDirty ? state.draftConfig : structuredClone(validated.config),
                ...(overview ? { snapshots: overview.snapshots, auditLogs: overview.auditLogs, canPublish: overview.canPublish, canRollback: overview.canRollback } : {}),
            }));
        } catch (error) {
            if (signal?.aborted || epoch !== sessionEpoch || userId !== useUserStore.getState().user?.id) return;
            set({ enabled: false, canPublish: false, canRollback: false, error: error instanceof Error ? error.message : "读取视觉配置失败" });
            throw error;
        }
    },

    setConsoleModule: (activeConsoleModule) => set({ activeConsoleModule }),
    setPreviewViewport: (previewViewport) => set({ previewViewport }),
    setPreviewThemeMode: (previewThemeMode) => set({ previewThemeMode }),

    updateDraft: (updater) => {
        const currentDraft = JSON.parse(JSON.stringify(get().draftConfig));
        const updated = updater(currentDraft) || currentDraft;
        set({ draftConfig: updated, isDraftDirty: true });
    },

    resetDraft: () => {
        set({
            draftConfig: JSON.parse(JSON.stringify(get().config)),
            isDraftDirty: false,
        });
    },

    switchPreset: (presetId) => {
        const target = BUILTIN_THEME_PRESETS.find((p) => p.id === presetId);
        if (!target) return;
        get().updateDraft((draft) => {
            draft.activePreset = target.id;
            draft.tokens.light = { ...draft.tokens.light, ...target.tokens.light };
            draft.tokens.dark = { ...draft.tokens.dark, ...target.tokens.dark };
            draft.components = { ...draft.components, ...target.components };
            if (target.motion) {
                draft.motion = { ...draft.motion, ...target.motion };
            }
        });
    },

    publishDraft: async (_actor, summary = "发布视觉配置变更") => {
        const userId = useUserStore.getState().user?.id;
        const epoch = sessionEpoch;
        if (get().isPublishing) return { success: false, error: "正在保存，请稍候" };
        if (!get().canPublish) return { success: false, error: "尚未取得服务端发布权限，请刷新配置" };
        const validated = validateVisualEngineConfig(get().draftConfig);
        if (!validated.valid) return { success: false, error: validated.errors.join("；") };
        set({ isPublishing: true });
        try {
            const overview = await apiPublishVisualEngineConfig(validated.config, summary);
            if (epoch !== sessionEpoch || userId !== useUserStore.getState().user?.id) throw new Error("账号已变化，请重新读取配置");
            sessionEpoch++;
            acceptOverview(overview);
            notifyPluginStateChanged();
            return { success: true };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : "发布失败" };
        } finally {
            set({ isPublishing: false });
        }
    },

    rollbackToSnapshot: async (version) => {
        const userId = useUserStore.getState().user?.id;
        const epoch = sessionEpoch;
        if (get().isPublishing || !get().canRollback) return { success: false, error: "当前无法回滚，请刷新配置" };
        set({ isPublishing: true });
        try {
            const overview = await apiRollbackVisualEngineConfig(version);
            if (epoch !== sessionEpoch || userId !== useUserStore.getState().user?.id) throw new Error("账号已变化，请重新读取配置");
            sessionEpoch++;
            acceptOverview(overview);
            notifyPluginStateChanged();
            return { success: true };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : "回滚失败" };
        } finally {
            set({ isPublishing: false });
        }
    },
}));

function acceptOverview(overview: VisualEngineAdminOverview) {
    const validated = validateVisualEngineConfig(overview.bundle.config);
    if (!validated.valid) throw new Error("服务端返回了无效配置：" + validated.errors.join("；"));
    useVisualEngineStore.setState({
        enabled: overview.bundle.enabled,
        loaded: true,
        revision: overview.bundle.revision,
        config: validated.config,
        draftConfig: structuredClone(validated.config),
        isDraftDirty: false,
        snapshots: overview.snapshots,
        auditLogs: overview.auditLogs,
        canPublish: overview.canPublish,
        canRollback: overview.canRollback,
        error: null,
    });
}

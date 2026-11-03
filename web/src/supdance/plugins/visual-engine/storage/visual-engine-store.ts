import { create } from "zustand";
import { notifyPluginStateChanged } from "@/supdance/adapters/plugin-state-sync";
import type { VisualEnginePermission, VisualEngineInstallation } from "../api/visual-engine-api";
import type { VisualEngineConfig, VisualEngineSnapshot, AuditLogEntry, PresetId } from "../types";
import { DEFAULT_VISUAL_ENGINE_CONFIG, BUILTIN_THEME_PRESETS } from "../config/default-config";
import { validateVisualEngineConfig } from "../config/schema";
import { apiPublishVisualEngineConfig, apiRollbackVisualEngineConfig, apiSaveVisualEngineDraft, type VisualEngineAdminOverview, type VisualEnginePublicBundle } from "../api/visual-engine-api";

export type ConsoleModuleKey = "dashboard" | "themes" | "colors" | "typography" | "components" | "effects" | "interactions" | "motion" | "loading" | "pagerules" | "preview" | "presets" | "versions" | "diagnostics" | "auditlogs";
type MutationResult = { success: boolean; error?: string };
let sessionEpoch = 0;
type VisualEngineState = {
    resetSession: () => void;
    permissions: VisualEnginePermission[];
    setPermissions: (permissions: VisualEnginePermission[]) => void;
    installation: VisualEngineInstallation;
    runtimePath: string;
    setRuntimePath: (path: string) => void;
    enabled: boolean;
    config: VisualEngineConfig;
    draftConfig: VisualEngineConfig;
    revision: string;
    snapshots: VisualEngineSnapshot[];
    auditLogs: AuditLogEntry[];
    activeConsoleModule: ConsoleModuleKey;
    previewViewport: "desktop" | "tablet" | "mobile";
    previewThemeMode: "light" | "dark";
    isDraftDirty: boolean;
    isSaving: boolean;
    isPublishing: boolean;
    setEnabled: (enabled: boolean) => void;
    setConsoleModule: (module: ConsoleModuleKey) => void;
    setPreviewViewport: (viewport: "desktop" | "tablet" | "mobile") => void;
    setPreviewThemeMode: (mode: "light" | "dark") => void;
    updateDraft: (updater: (draft: VisualEngineConfig) => VisualEngineConfig | void) => void;
    resetDraft: () => void;
    switchPreset: (preset: PresetId | string) => void;
    saveDraft: () => Promise<MutationResult>;
    publishDraft: (actor?: string, summary?: string) => Promise<MutationResult>;
    rollbackToSnapshot: (version: string, actor?: string) => Promise<MutationResult>;
    acceptBundle: (bundle: VisualEnginePublicBundle) => void;
    acceptOverview: (overview: VisualEngineAdminOverview) => void;
    hydrate: (initial?: Partial<{ enabled: boolean; config: VisualEngineConfig; snapshots: VisualEngineSnapshot[]; auditLogs: AuditLogEntry[] }>) => void;
};

export const useVisualEngineStore = create<VisualEngineState>((set, get) => ({
    resetSession: () => {
        sessionEpoch++;
        set({ permissions: [], snapshots: [], auditLogs: [], draftConfig: structuredClone(get().config), isDraftDirty: false, isSaving: false, isPublishing: false });
    },
    permissions: [],
    setPermissions: (permissions) => set({ permissions }),
    installation: { installed: true, version: "2.0.0", availableVersion: "2.0.1", configRetained: true },
    runtimePath: typeof window === "undefined" ? "/" : window.location.pathname,
    setRuntimePath: (runtimePath) => set({ runtimePath }),
    enabled: false,
    config: structuredClone(DEFAULT_VISUAL_ENGINE_CONFIG),
    draftConfig: structuredClone(DEFAULT_VISUAL_ENGINE_CONFIG),
    revision: "",
    snapshots: [],
    auditLogs: [],
    activeConsoleModule: "dashboard",
    previewViewport: "desktop",
    previewThemeMode: "dark",
    isDraftDirty: false,
    isSaving: false,
    isPublishing: false,
    setEnabled: (enabled) => set({ enabled }),
    setConsoleModule: (activeConsoleModule) => set({ activeConsoleModule }),
    setPreviewViewport: (previewViewport) => set({ previewViewport }),
    setPreviewThemeMode: (previewThemeMode) => set({ previewThemeMode }),
    updateDraft: (updater) => {
        const draft = structuredClone(get().draftConfig);
        set({ draftConfig: updater(draft) || draft, isDraftDirty: true });
    },
    resetDraft: () => set({ draftConfig: structuredClone(get().config), isDraftDirty: false }),
    switchPreset: (presetId) => {
        const preset = [...BUILTIN_THEME_PRESETS, ...get().draftConfig.customPresets].find((item) => item.id === presetId);
        if (!preset) return;
        get().updateDraft((draft) => {
            draft.activePreset = preset.id;
            draft.tokens = structuredClone(preset.tokens);
            draft.components = structuredClone(preset.components);
            draft.motion = { ...draft.motion, ...preset.motion };
        });
    },
    saveDraft: async () => {
        const epoch = sessionEpoch;
        if (get().isSaving || get().isPublishing) return { success: false, error: "操作正在进行" };
        set({ isSaving: true });
        try {
            const validation = validateVisualEngineConfig(get().draftConfig);
            if (!validation.valid) throw new Error(validation.errors.join("；"));
            await apiSaveVisualEngineDraft(validation.config);
            if (epoch !== sessionEpoch) throw new Error("账号已变化，请重新读取配置");
            return { success: true };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : "草稿保存失败" };
        } finally {
            if (epoch === sessionEpoch) set({ isSaving: false });
        }
    },
    publishDraft: async (_actor, summary = "发布视觉配置变更") => {
        const epoch = sessionEpoch;
        if (get().isPublishing) return { success: false, error: "操作正在进行" };
        set({ isPublishing: true });
        try {
            const validation = validateVisualEngineConfig(get().draftConfig);
            if (!validation.valid) throw new Error(validation.errors.join("；"));
            if (!get().revision) throw new Error("请先加载服务端配置");
            const overview = await apiPublishVisualEngineConfig(validation.config, summary, get().revision);
            if (epoch !== sessionEpoch) throw new Error("账号已变化，请重新读取配置");
            get().acceptOverview({ ...overview, draft: null });
            if (typeof window !== "undefined") notifyPluginStateChanged();
            return { success: true };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : "发布失败" };
        } finally {
            if (epoch === sessionEpoch) set({ isPublishing: false });
        }
    },
    rollbackToSnapshot: async (version) => {
        const epoch = sessionEpoch;
        if (get().isPublishing) return { success: false, error: "操作正在进行" };
        set({ isPublishing: true });
        try {
            if (!get().revision) throw new Error("请先加载服务端配置");
            const overview = await apiRollbackVisualEngineConfig(version, get().revision);
            if (epoch !== sessionEpoch) throw new Error("账号已变化，请重新读取配置");
            get().acceptOverview({ ...overview, draft: null });
            if (typeof window !== "undefined") notifyPluginStateChanged();
            return { success: true };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : "回滚失败" };
        } finally {
            if (epoch === sessionEpoch) set({ isPublishing: false });
        }
    },
    acceptBundle: (bundle) => {
        const validation = validateVisualEngineConfig(bundle.config);
        if (!validation.valid) throw new Error(validation.errors.join("；"));
        set((state) => ({
            installation: bundle.installation ?? state.installation,
            enabled: bundle.enabled,
            config: validation.config,
            revision: state.isDraftDirty ? state.revision : bundle.revision,
            ...(state.isDraftDirty ? {} : { draftConfig: structuredClone(validation.config) }),
        }));
    },
    acceptOverview: (overview) => {
        get().acceptBundle(overview.bundle);
        set({
            permissions: overview.permissions ?? get().permissions,
            snapshots: overview.snapshots ?? [],
            auditLogs: overview.auditLogs ?? [],
            revision: overview.bundle.revision,
            draftConfig: structuredClone(overview.draft ?? overview.bundle.config),
            isDraftDirty: !!overview.draft,
        });
    },
    hydrate: (initial) => {
        if (!initial) return;
        set(initial);
        if (initial.config) set({ draftConfig: structuredClone(initial.config), isDraftDirty: false });
    },
}));

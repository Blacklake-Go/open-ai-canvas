import { create } from "zustand";
import type { VisualEngineConfig, VisualEngineSnapshot, AuditLogEntry, PresetId } from "../types";
import { DEFAULT_VISUAL_ENGINE_CONFIG, BUILTIN_THEME_PRESETS } from "../config/default-config";
import { validateVisualEngineConfig } from "../config/schema";
import { apiPublishVisualEngineConfig, apiRollbackVisualEngineConfig, apiSaveVisualEngineDraft, type VisualEngineAdminOverview, type VisualEnginePublicBundle } from "../api/visual-engine-api";

export type ConsoleModuleKey = "dashboard" | "themes" | "colors" | "typography" | "components" | "effects" | "interactions" | "motion" | "transitions" | "loading" | "pagerules" | "preview" | "presets" | "versions" | "diagnostics" | "auditlogs";
type MutationResult = { success: boolean; error?: string };
type VisualEngineState = {
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
        const preset = BUILTIN_THEME_PRESETS.find((item) => item.id === presetId);
        if (!preset) return;
        get().updateDraft((draft) => {
            draft.activePreset = preset.id;
            draft.tokens = structuredClone(preset.tokens);
            draft.components = structuredClone(preset.components);
            draft.motion = { ...draft.motion, ...preset.motion };
        });
    },
    saveDraft: async () => {
        if (get().isSaving || get().isPublishing) return { success: false, error: "操作正在进行" };
        set({ isSaving: true });
        try {
            const validation = validateVisualEngineConfig(get().draftConfig);
            if (!validation.valid) throw new Error(validation.errors.join("；"));
            await apiSaveVisualEngineDraft(validation.config);
            return { success: true };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : "草稿保存失败" };
        } finally {
            set({ isSaving: false });
        }
    },
    publishDraft: async (_actor, summary = "发布视觉配置变更") => {
        if (get().isPublishing) return { success: false, error: "操作正在进行" };
        set({ isPublishing: true });
        try {
            const validation = validateVisualEngineConfig(get().draftConfig);
            if (!validation.valid) throw new Error(validation.errors.join("；"));
            if (!get().revision) throw new Error("请先加载服务端配置");
            const overview = await apiPublishVisualEngineConfig(validation.config, summary, get().revision);
            get().acceptOverview({ ...overview, draft: null });
            return { success: true };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : "发布失败" };
        } finally {
            set({ isPublishing: false });
        }
    },
    rollbackToSnapshot: async (version) => {
        if (get().isPublishing) return { success: false, error: "操作正在进行" };
        set({ isPublishing: true });
        try {
            if (!get().revision) throw new Error("请先加载服务端配置");
            const overview = await apiRollbackVisualEngineConfig(version, get().revision);
            get().acceptOverview({ ...overview, draft: null });
            return { success: true };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : "回滚失败" };
        } finally {
            set({ isPublishing: false });
        }
    },
    acceptBundle: (bundle) => {
        const validation = validateVisualEngineConfig(bundle.config);
        if (!validation.valid) throw new Error(validation.errors.join("；"));
        set((state) => ({ enabled: bundle.enabled, config: validation.config, revision: state.isDraftDirty ? state.revision : bundle.revision,
            ...(state.isDraftDirty ? {} : { draftConfig: structuredClone(validation.config) }) }));
    },
    acceptOverview: (overview) => {
        get().acceptBundle(overview.bundle);
        set({ snapshots: overview.snapshots ?? [], auditLogs: overview.auditLogs ?? [], revision: overview.bundle.revision,
            draftConfig: structuredClone(overview.draft ?? overview.bundle.config), isDraftDirty: !!overview.draft });
    },
    hydrate: (initial) => {
        if (!initial) return;
        set(initial);
        if (initial.config) set({ draftConfig: structuredClone(initial.config), isDraftDirty: false });
    },
}));

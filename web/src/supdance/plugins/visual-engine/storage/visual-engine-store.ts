import { create } from "zustand";
import type { VisualEngineConfig, VisualEngineSnapshot, AuditLogEntry, PresetId } from "../types";
import { DEFAULT_VISUAL_ENGINE_CONFIG, BUILTIN_THEME_PRESETS } from "../config/default-config";
import { applyVisualEngineTheme, removeVisualEngineTheme } from "../themes/theme-engine";

export type ConsoleModuleKey =
    | "dashboard"
    | "themes"
    | "colors"
    | "typography"
    | "components"
    | "effects"
    | "interactions"
    | "motion"
    | "transitions"
    | "loading"
    | "pagerules"
    | "preview"
    | "presets"
    | "versions"
    | "diagnostics"
    | "auditlogs";

type VisualEngineState = {
    enabled: boolean;
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
    hydrate: (initial?: Partial<{ enabled: boolean; config: VisualEngineConfig; snapshots: VisualEngineSnapshot[]; auditLogs: AuditLogEntry[] }>) => void;
};

const STORAGE_KEY_CONFIG = "supdance_visual_engine_config_v2";
const STORAGE_KEY_SNAPSHOTS = "supdance_visual_engine_snapshots_v2";
const STORAGE_KEY_AUDIT = "supdance_visual_engine_audit_v2";

function safeLoadLocalStorage<T>(key: string, fallback: T): T {
    if (typeof window === "undefined" || !window.localStorage) return fallback;
    try {
        const item = window.localStorage.getItem(key);
        if (!item) return fallback;
        return JSON.parse(item) as T;
    } catch {
        return fallback;
    }
}

function safeSaveLocalStorage<T>(key: string, value: T): void {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // quota exceeded or storage disabled
    }
}

const initialSavedConfig = safeLoadLocalStorage<VisualEngineConfig>(STORAGE_KEY_CONFIG, DEFAULT_VISUAL_ENGINE_CONFIG);
const initialSnapshots = safeLoadLocalStorage<VisualEngineSnapshot[]>(STORAGE_KEY_SNAPSHOTS, [
    {
        version: "2.0.0",
        timestamp: "2026-11-03T00:00:00.000Z",
        actor: "SupDance Architecture Team",
        summary: "SupDance Visual Engine V2.0 初始稳定发行版本",
        config: DEFAULT_VISUAL_ENGINE_CONFIG,
    },
]);
const initialAuditLogs = safeLoadLocalStorage<AuditLogEntry[]>(STORAGE_KEY_AUDIT, [
    {
        id: "audit-init-20261103",
        timestamp: "2026-11-03T00:00:00.000Z",
        actor: "SupDance Architecture Team",
        module: "System",
        action: "plugin.install",
        details: "初始化 SupDance Visual Engine V2.0 核心引擎与默认配置",
        version: "2.0.0",
        success: true,
    },
]);

export const useVisualEngineStore = create<VisualEngineState>((set, get) => ({
    enabled: true,
    config: initialSavedConfig,
    draftConfig: JSON.parse(JSON.stringify(initialSavedConfig)),
    snapshots: initialSnapshots,
    auditLogs: initialAuditLogs,
    activeConsoleModule: "dashboard",
    previewViewport: "desktop",
    previewThemeMode: "dark",
    isDraftDirty: false,
    isSaving: false,
    isPublishing: false,

    setEnabled: (enabled) => {
        set({ enabled });
        if (enabled) {
            applyVisualEngineTheme(get().config, get().config.themeMode === "light" ? "light" : "dark");
        } else {
            removeVisualEngineTheme();
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

    publishDraft: async (actor = "Administrator", summary = "发布视觉配置变更") => {
        set({ isPublishing: true });
        try {
            const currentDraft = get().draftConfig;
            const nextVersion = `2.0.${get().snapshots.length}`;
            const publishedConfig: VisualEngineConfig = {
                ...currentDraft,
                publishedVersion: nextVersion,
                updatedAt: new Date().toISOString(),
                updatedBy: actor,
            };

            const newSnapshot: VisualEngineSnapshot = {
                version: nextVersion,
                timestamp: publishedConfig.updatedAt,
                actor,
                summary,
                config: publishedConfig,
            };

            const newAuditEntry: AuditLogEntry = {
                id: `audit-${Date.now()}`,
                timestamp: publishedConfig.updatedAt,
                actor,
                module: "Publish",
                action: "config.publish",
                details: `正式发布配置版本 v${nextVersion}：${summary}`,
                version: nextVersion,
                success: true,
            };

            const nextSnapshots = [newSnapshot, ...get().snapshots];
            const nextAuditLogs = [newAuditEntry, ...get().auditLogs];

            set({
                config: publishedConfig,
                draftConfig: JSON.parse(JSON.stringify(publishedConfig)),
                snapshots: nextSnapshots,
                auditLogs: nextAuditLogs,
                isDraftDirty: false,
            });

            safeSaveLocalStorage(STORAGE_KEY_CONFIG, publishedConfig);
            safeSaveLocalStorage(STORAGE_KEY_SNAPSHOTS, nextSnapshots);
            safeSaveLocalStorage(STORAGE_KEY_AUDIT, nextAuditLogs);

            if (get().enabled) {
                applyVisualEngineTheme(publishedConfig, publishedConfig.themeMode === "light" ? "light" : "dark");
            }

            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : "发布失败" };
        } finally {
            set({ isPublishing: false });
        }
    },

    rollbackToSnapshot: async (targetVersion, actor = "Administrator") => {
        const snapshot = get().snapshots.find((s) => s.version === targetVersion);
        if (!snapshot) {
            return { success: false, error: `未找到指定版本快照：${targetVersion}` };
        }

        try {
            const rolledBackConfig: VisualEngineConfig = {
                ...JSON.parse(JSON.stringify(snapshot.config)),
                updatedAt: new Date().toISOString(),
                updatedBy: `${actor} (Rollback to v${targetVersion})`,
            };

            const newAuditEntry: AuditLogEntry = {
                id: `audit-${Date.now()}`,
                timestamp: rolledBackConfig.updatedAt,
                actor,
                module: "Rollback",
                action: "config.rollback",
                details: `回滚配置至历史稳定快照 v${targetVersion}（原发布时间：${snapshot.timestamp}）`,
                version: targetVersion,
                success: true,
            };

            const nextAuditLogs = [newAuditEntry, ...get().auditLogs];

            set({
                config: rolledBackConfig,
                draftConfig: JSON.parse(JSON.stringify(rolledBackConfig)),
                auditLogs: nextAuditLogs,
                isDraftDirty: false,
            });

            safeSaveLocalStorage(STORAGE_KEY_CONFIG, rolledBackConfig);
            safeSaveLocalStorage(STORAGE_KEY_AUDIT, nextAuditLogs);

            if (get().enabled) {
                applyVisualEngineTheme(rolledBackConfig, rolledBackConfig.themeMode === "light" ? "light" : "dark");
            }

            return { success: true };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : "回滚失败" };
        }
    },

    hydrate: (initial) => {
        if (!initial) return;
        set((state) => ({
            enabled: initial.enabled ?? state.enabled,
            config: initial.config ?? state.config,
            draftConfig: initial.config ? JSON.parse(JSON.stringify(initial.config)) : state.draftConfig,
            snapshots: initial.snapshots ?? state.snapshots,
            auditLogs: initial.auditLogs ?? state.auditLogs,
        }));
    },
}));

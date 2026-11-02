import axios from "axios";
import type { VisualEngineConfig, VisualEngineSnapshot, AuditLogEntry } from "../types";
import { DEFAULT_VISUAL_ENGINE_CONFIG } from "../config/default-config";

export type VisualEnginePublicBundle = {
    pluginId: "supdance-visual-engine";
    enabled: boolean;
    version: string;
    config: VisualEngineConfig;
    revision: string;
};

export type VisualEngineAdminOverview = {
    bundle: VisualEnginePublicBundle;
    snapshots: VisualEngineSnapshot[];
    auditLogs: AuditLogEntry[];
    canPublish: boolean;
    canRollback: boolean;
};

export async function fetchVisualEnginePublicBundle(): Promise<VisualEnginePublicBundle> {
    try {
        const response = await axios.get<VisualEnginePublicBundle>("/api/supdance/visual-engine/bundle", {
            timeout: 3000,
        });
        return response.data;
    } catch {
        // 本地/脱机模式安全降级
        return {
            pluginId: "supdance-visual-engine",
            enabled: true,
            version: "2.0.0",
            config: DEFAULT_VISUAL_ENGINE_CONFIG,
            revision: "local-fallback",
        };
    }
}

export async function fetchAdminVisualEngineOverview(): Promise<VisualEngineAdminOverview> {
    try {
        const response = await axios.get<VisualEngineAdminOverview>("/api/supdance/visual-engine/admin/overview", {
            timeout: 5000,
        });
        return response.data;
    } catch {
        return {
            bundle: {
                pluginId: "supdance-visual-engine",
                enabled: true,
                version: "2.0.0",
                config: DEFAULT_VISUAL_ENGINE_CONFIG,
                revision: "local-fallback",
            },
            snapshots: [],
            auditLogs: [],
            canPublish: true,
            canRollback: true,
        };
    }
}

export async function apiPublishVisualEngineConfig(config: VisualEngineConfig, comment: string): Promise<VisualEngineAdminOverview> {
    const response = await axios.post<VisualEngineAdminOverview>("/api/supdance/visual-engine/admin/publish", {
        config,
        comment,
    });
    return response.data;
}

export async function apiRollbackVisualEngineConfig(version: string): Promise<VisualEngineAdminOverview> {
    const response = await axios.post<VisualEngineAdminOverview>("/api/supdance/visual-engine/admin/rollback", {
        version,
    });
    return response.data;
}

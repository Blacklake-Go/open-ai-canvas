import { http } from "@/services/api/request";
import type { VisualEngineConfig, VisualEngineSnapshot, AuditLogEntry } from "../types";

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
    draft: VisualEngineConfig | null;
    canPublish: boolean;
    canRollback: boolean;
};

const adminPath = "/admin/plugins/supdance-visual-engine";

export function fetchVisualEnginePublicBundle() {
    return http.get<VisualEnginePublicBundle>("/plugins/supdance-visual-engine/bundle");
}

export function fetchAdminVisualEngineOverview() {
    return http.get<VisualEngineAdminOverview>(`${adminPath}/overview`);
}

export function apiSaveVisualEngineDraft(config: VisualEngineConfig) {
    return http.put<VisualEngineConfig>(`${adminPath}/draft`, { config });
}

export function apiPublishVisualEngineConfig(config: VisualEngineConfig, comment: string, expectedRevision: string) {
    return http.post<VisualEngineAdminOverview>(`${adminPath}/publish`, { config, comment, expectedRevision });
}

export function apiRollbackVisualEngineConfig(version: string, expectedRevision: string) {
    return http.post<VisualEngineAdminOverview>(`${adminPath}/rollback`, { version, expectedRevision });
}

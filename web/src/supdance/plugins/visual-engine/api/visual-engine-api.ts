import { http } from "@/services/api/request";
import type { VisualEngineConfig, VisualEngineSnapshot, AuditLogEntry } from "../types";

export type VisualEnginePublicBundle = {
    installation?: VisualEngineInstallation;
    pluginId: "supdance-visual-engine";
    enabled: boolean;
    version: string;
    config: VisualEngineConfig;
    revision: string;
};

export type VisualEngineAdminOverview = {
    permissions?: VisualEnginePermission[];
    bundle: VisualEnginePublicBundle;
    snapshots: VisualEngineSnapshot[];
    auditLogs: AuditLogEntry[];
    draft: VisualEngineConfig | null;
    canPublish: boolean;
    canRollback: boolean;
};

const adminPath = "/admin/plugins/supdance-visual-engine";
export type VisualEnginePermission = "view" | "edit" | "preview" | "publish" | "rollback" | "lifecycle";
export type VisualEngineInstallation = { installed: boolean; version: string; availableVersion: string; updatedAt?: string; updatedBy?: string; configRetained: boolean };
export type VisualEnginePermissionPolicy = { grants: Record<string, VisualEnginePermission[]> };
export function fetchVisualEngineCapabilities(signal?: AbortSignal) {
    return http.get<VisualEnginePermission[]>(adminPath + "/capabilities", { signal });
}
export function manageVisualEngine(action: "install" | "activate" | "deactivate" | "uninstall" | "update", retainConfig = true) {
    return http.post<VisualEngineInstallation>(adminPath + "/lifecycle", { action, retainConfig });
}
export function fetchVisualEnginePermissions() {
    return http.get<VisualEnginePermissionPolicy>(adminPath + "/permissions");
}
export function saveVisualEnginePermissions(policy: VisualEnginePermissionPolicy) {
    return http.put<VisualEnginePermissionPolicy>(adminPath + "/permissions", policy);
}
export function validateVisualEnginePreview(config: VisualEngineConfig) {
    return http.post<VisualEngineConfig>(adminPath + "/preview", { config });
}

export function fetchVisualEnginePublicBundle(signal?: AbortSignal) {
    return http.get<VisualEnginePublicBundle>("/plugins/supdance-visual-engine/bundle", { signal });
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

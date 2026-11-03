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
    canPublish: boolean;
    canRollback: boolean;
};

const adminPath = "/admin/plugins/supdance-visual-engine";

export function fetchVisualEnginePublicBundle(signal?: AbortSignal): Promise<VisualEnginePublicBundle> {
    return http.get("/plugins/supdance-visual-engine/bundle", { signal });
}

export function fetchAdminVisualEngineOverview(signal?: AbortSignal): Promise<VisualEngineAdminOverview> {
    return http.get(adminPath + "/overview", { signal });
}

export function apiPublishVisualEngineConfig(config: VisualEngineConfig, comment: string): Promise<VisualEngineAdminOverview> {
    return http.post(adminPath + "/publish", { config, comment });
}

export function apiRollbackVisualEngineConfig(version: string): Promise<VisualEngineAdminOverview> {
    return http.post(adminPath + "/rollback", { version });
}

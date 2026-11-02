import type { WorkspaceRecoveryStage, WorkspaceRecoveryConfig } from "../types";

export type StageTransitionEvent =
    | { type: "START" }
    | { type: "AUTH_VERIFIED" }
    | { type: "PROJECTS_SYNCED" }
    | { type: "APP_READY" }
    | { type: "ERROR"; error?: string }
    | { type: "RETRY" }
    | { type: "TIMEOUT" };

export function getNextRecoveryStage(
    current: WorkspaceRecoveryStage,
    event: StageTransitionEvent,
): WorkspaceRecoveryStage {
    switch (current) {
        case "init":
            if (event.type === "START" || event.type === "AUTH_VERIFIED") return "recovering";
            if (event.type === "ERROR" || event.type === "TIMEOUT") return "failed";
            return current;
        case "recovering":
            if (event.type === "PROJECTS_SYNCED") return "syncing";
            if (event.type === "APP_READY") return "ready";
            if (event.type === "ERROR" || event.type === "TIMEOUT") return "failed";
            return current;
        case "syncing":
            if (event.type === "APP_READY") return "ready";
            if (event.type === "ERROR" || event.type === "TIMEOUT") return "failed";
            return current;
        case "failed":
            if (event.type === "RETRY") return "init";
            return current;
        case "ready":
            return "ready";
        default:
            return current;
    }
}

export function getStageCopy(stage: WorkspaceRecoveryStage, config: WorkspaceRecoveryConfig): {
    title: string;
    detail: string;
} {
    switch (stage) {
        case "init":
            return {
                title: config.statusCopies.init,
                detail: config.stageDetails.auth,
            };
        case "recovering":
            return {
                title: config.statusCopies.recovering,
                detail: config.stageDetails.workspace,
            };
        case "syncing":
            return {
                title: config.statusCopies.syncing,
                detail: config.stageDetails.projects,
            };
        case "ready":
            return {
                title: config.statusCopies.ready,
                detail: config.stageDetails.environment,
            };
        case "failed":
            return {
                title: config.statusCopies.failed,
                detail: "请检查网络连接、用户凭据或点击下方重试按钮重新初始化",
            };
    }
}

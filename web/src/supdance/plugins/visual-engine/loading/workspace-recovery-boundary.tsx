import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { getClientDiagnosticEvents, subscribeClientDiagnostics } from "@/services/diagnostics/client-diagnostics";
import { useVisualEngineStore } from "../storage/visual-engine-store";
import { resolvePageVisualPolicy } from "../page-rules/page-rules-engine";
import type { WorkspaceRecoveryStage } from "../types";

import { matchPathPattern } from "../page-rules/rule-matcher";
import { WorkspaceRouteLoader } from "@/components/ui/aceternity/full-screen-loader";
const Animator = lazy(() => import("./workspace-recovery-animator").then((module) => ({ default: module.WorkspaceRecoveryAnimator })));
function diagnosticStage(code: string | undefined): WorkspaceRecoveryStage | undefined {
    if (code === "startup.auth_session_started") return "init";
    if (code === "startup.auth_session_ready") return "recovering";
    if (code === "startup.workspace_ready" || code === "startup.anonymous_ready") return "ready";
    if (code === "startup.auth_session_failed") return "failed";
    if (code === "startup.workspace_background_ready") return "syncing";
    return undefined;
}
export function WorkspaceRecoveryBoundary({ fallback, phase }: { fallback: ReactNode; phase?: WorkspaceRecoveryStage }) {
    const enabled = useVisualEngineStore((state) => state.enabled);
    const config = useVisualEngineStore((state) => state.config);
    const path = useVisualEngineStore((state) => state.runtimePath);
    const [stage, setStage] = useState<WorkspaceRecoveryStage>(() => getClientDiagnosticEvents().reduce<WorkspaceRecoveryStage>((current, event) => diagnosticStage(event.code) ?? current, "init"));
    useEffect(
        () =>
            subscribeClientDiagnostics((event) => {
                const next = diagnosticStage(event.code);
                if (next) setStage(next);
            }),
        [],
    );
    const policy = resolvePageVisualPolicy(path, config, config.themeMode === "light" ? "light" : "dark");
    if (enabled && !config.motion.enabled)
        return (
            <div className="fixed inset-0">
                <WorkspaceRouteLoader />
            </div>
        );
    if (!enabled || !policy.recoveryEnabled || !config.workspaceRecovery.paths.some((pattern) => matchPathPattern(pattern, path)) || path.startsWith("/admin") || config.activePreset === "native") return fallback;
    return (
        <Suspense fallback={fallback}>
            <Animator
                forceReducedMotion={!config.motion.enabled || config.interactions.performanceMode === "low"}
                config={config.workspaceRecovery}
                activeStage={stage === "failed" ? "failed" : (phase ?? stage)}
                onStageChange={setStage}
                onRetry={() => window.location.reload()}
            />
        </Suspense>
    );
}

import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { getClientDiagnosticEvents, subscribeClientDiagnostics } from "@/services/diagnostics/client-diagnostics";
import { useAppearanceStore } from "@/stores/use-appearance-store";
import { useVisualEngineStore } from "../storage/visual-engine-store";
import { resolvePageVisualPolicy } from "../page-rules/page-rules-engine";
import type { VisualEngineConfig, WorkspaceRecoveryStage } from "../types";

import { matchPathPattern } from "../page-rules/rule-matcher";
import { WorkspaceRouteLoader } from "@/components/ui/aceternity/full-screen-loader";
import { allowsVisualTheme, useVisualEngineActive } from "../runtime/visual-engine-activation";
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
    const enabled = useVisualEngineActive();
    const config = useVisualEngineStore((state) => state.config);
    const path = useVisualEngineStore((state) => state.runtimePath);
    const skinId = useAppearanceStore((state) => state.appearance.activeSkin.id);
    const policy = resolvePageVisualPolicy(path, config, config.themeMode === "light" ? "light" : "dark");
    if (!enabled || skinId !== "classic" || !allowsVisualTheme(path, config, policy)) return fallback;
    if (!policy.motionEnabled)
        return (
            <div className="fixed inset-0">
                <WorkspaceRouteLoader />
            </div>
        );
    if (!policy.recoveryEnabled || !config.workspaceRecovery.paths.some((pattern) => matchPathPattern(pattern, path))) return fallback;
    return <ActiveRecovery config={config} fallback={fallback} phase={phase} />;
}

function ActiveRecovery({ config, fallback, phase }: { config: VisualEngineConfig; fallback: ReactNode; phase?: WorkspaceRecoveryStage }) {
    const [stage, setStage] = useState<WorkspaceRecoveryStage>(() => getClientDiagnosticEvents().reduce<WorkspaceRecoveryStage>((current, event) => diagnosticStage(event.code) ?? current, "init"));
    useEffect(
        () =>
            subscribeClientDiagnostics((event) => {
                const next = diagnosticStage(event.code);
                if (next) setStage(next);
            }),
        [],
    );
    return (
        <Suspense fallback={fallback}>
            <Animator forceReducedMotion={config.interactions.performanceMode === "low"} config={config.workspaceRecovery} activeStage={stage === "failed" ? "failed" : (phase ?? stage)} onStageChange={setStage} onRetry={() => window.location.reload()} />
        </Suspense>
    );
}

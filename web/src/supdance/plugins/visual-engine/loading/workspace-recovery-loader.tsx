import { FullScreenLoader } from "@/components/ui/aceternity/full-screen-loader";
import { useSessionRecoveryStore, setSessionRecoveryStage } from "@/lib/session-recovery";
import { useVisualEnginePolicy } from "../runtime/use-visual-engine-policy";
import { WorkspaceRecoveryAnimator } from "./workspace-recovery-animator";

export function VisualEngineWorkspaceLoader() {
    const { active, config, policy } = useVisualEnginePolicy();
    const stage = useSessionRecoveryStore((state) => state.stage);
    if (!active || !policy.recoveryEnabled) return <FullScreenLoader />;
    return (
        <div className="fixed inset-0 z-50">
            <WorkspaceRecoveryAnimator config={{ ...config.workspaceRecovery, themeMode: policy.activeThemeMode }} activeStage={stage} onStageChange={setSessionRecoveryStage} onRetry={() => window.location.reload()} />
        </div>
    );
}

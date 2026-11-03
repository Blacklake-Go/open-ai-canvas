import { create } from "zustand";

export type SessionRecoveryStage = "init" | "recovering" | "syncing" | "ready" | "failed";
export const useSessionRecoveryStore = create<{ stage: SessionRecoveryStage }>(() => ({ stage: "init" }));
export function setSessionRecoveryStage(stage: SessionRecoveryStage) {
    useSessionRecoveryStore.setState({ stage });
}

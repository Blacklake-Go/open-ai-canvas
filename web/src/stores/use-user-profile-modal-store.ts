import { create } from "zustand";

export type UserProfileModalTab = "profile" | "security" | "social" | "models" | "channels" | "runninghub" | "generation" | "prompts" | "agent-memory" | "preferences" | "storage" | "diagnostics" | "feedbacks";

interface UserProfileModalState {
    isOpen: boolean;
    activeTab: UserProfileModalTab;
    openModal: (tab?: UserProfileModalTab) => void;
    closeModal: () => void;
    setTab: (tab: UserProfileModalTab) => void;
}

let returnFocusTo: HTMLElement | null = null;

function captureReturnFocus() {
    if (typeof document === "undefined") return null;
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return null;
    const popup = active.closest('[role="tooltip"]');
    if (popup?.id) {
        const trigger = Array.from(document.querySelectorAll<HTMLElement>("button[aria-describedby]")).find((button) => button.getAttribute("aria-describedby")?.split(/\s+/).includes(popup.id));
        if (trigger) return trigger;
    }
    return active;
}

export function restoreUserProfileModalFocus() {
    const target = returnFocusTo;
    returnFocusTo = null;
    if (target?.isConnected) target.focus();
}

export const useUserProfileModalStore = create<UserProfileModalState>((set, get) => ({
    isOpen: false,
    activeTab: "profile",
    openModal: (tab = "profile") => {
        if (!get().isOpen) returnFocusTo = captureReturnFocus();
        set({ isOpen: true, activeTab: tab });
    },
    closeModal: () => set({ isOpen: false }),
    setTab: (tab) => set({ activeTab: tab }),
}));

export const USER_PROFILE_MODAL_EVENT = "supdance:open-user-profile-modal";

export function openUserProfileModal(tab: UserProfileModalTab = "profile") {
    useUserProfileModalStore.getState().openModal(tab);
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(USER_PROFILE_MODAL_EVENT, { detail: { tab } }));
    }
}

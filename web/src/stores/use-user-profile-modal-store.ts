import { create } from "zustand";

export type UserProfileModalTab = "profile" | "security" | "social" | "preferences";

interface UserProfileModalState {
    isOpen: boolean;
    activeTab: UserProfileModalTab;
    openModal: (tab?: UserProfileModalTab) => void;
    closeModal: () => void;
    setTab: (tab: UserProfileModalTab) => void;
}

export const useUserProfileModalStore = create<UserProfileModalState>((set) => ({
    isOpen: false,
    activeTab: "profile",
    openModal: (tab = "profile") => set({ isOpen: true, activeTab: tab }),
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

import { createClientUUID } from "@/lib/client-id";

export const GUEST_TEXT_DRAFT_PARAM = "resumeTextDraft";
const STORAGE_KEY = "supdance:guest-text-draft";
const RETENTION_MS = 30 * 60 * 1000;

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function guestTextDraftSignInPath(prompt: string, storage?: DraftStorage): string | undefined {
    try {
        const tab = storage ?? window.sessionStorage;
        const token = createClientUUID();
        tab.setItem(STORAGE_KEY, JSON.stringify({ token, prompt, expiresAt: Date.now() + RETENTION_MS }));
        const params = new URLSearchParams({ mode: "text", [GUEST_TEXT_DRAFT_PARAM]: token });
        return `/create?${params}`;
    } catch {
        return undefined;
    }
}

export function takeGuestTextDraft(token: string, storage?: DraftStorage): string | undefined {
    try {
        const tab = storage ?? window.sessionStorage;
        const raw = tab.getItem(STORAGE_KEY);
        if (!raw) return undefined;
        const draft = JSON.parse(raw);
        if (!draft || typeof draft.prompt !== "string" || typeof draft.expiresAt !== "number" || draft.expiresAt <= Date.now()) {
            tab.removeItem(STORAGE_KEY);
            return undefined;
        }
        if (draft.token !== token) return undefined;
        tab.removeItem(STORAGE_KEY);
        return draft.prompt;
    } catch {
        return undefined;
    }
}

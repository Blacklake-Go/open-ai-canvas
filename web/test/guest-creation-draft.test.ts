import { describe, expect, test } from "bun:test";

import { authDialogLanding } from "../src/lib/auth-entry";
import { buildSocialAuthStartUrl } from "../src/supdance/plugins/social-auth/api";
import { GUEST_TEXT_DRAFT_PARAM, guestTextDraftSignInPath, takeGuestTextDraft } from "../src/supdance/guest-creation-draft";

function tabStorage() {
    const entries = new Map<string, string>();
    return {
        entries,
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => entries.set(key, value),
        removeItem: (key: string) => entries.delete(key),
    };
}

describe("guest text draft through sign-in", () => {
    test("passes only the return marker through Google and consumes the original text once", () => {
        const tab = tabStorage();
        const text = "  分镜改为两镜。\n保留最后一镜的雨声。  ";
        const next = guestTextDraftSignInPath(text, tab)!;
        const target = new URL(next, "https://example.test");
        const token = target.searchParams.get(GUEST_TEXT_DRAFT_PARAM)!;
        expect(target.pathname).toBe("/create");
        expect(target.searchParams.get("mode")).toBe("text");
        expect(authDialogLanding(next)).toBe(next);
        const oauth = new URL(buildSocialAuthStartUrl("google", { next }), "https://example.test");
        expect(oauth.searchParams.get("next")).toBe(next);
        expect(decodeURIComponent(oauth.href)).not.toContain(text.trim());
        expect(takeGuestTextDraft(token, tabStorage())).toBeUndefined();
        expect(takeGuestTextDraft(token, tab)).toBe(text);
        expect(takeGuestTextDraft(token, tab)).toBeUndefined();
        expect(tab.entries.size).toBe(0);
    });

    test("ignores an old callback and expires the current draft", () => {
        const tab = tabStorage();
        guestTextDraftSignInPath("first", tab);
        const prior = JSON.parse([...tab.entries.values()][0]!);
        guestTextDraftSignInPath("second", tab);
        const [key, raw] = [...tab.entries][0]!;
        const latest = JSON.parse(raw);
        expect(takeGuestTextDraft(prior.token, tab)).toBeUndefined();
        expect(tab.getItem(key)).toBe(raw);
        tab.setItem(key, JSON.stringify({ ...latest, expiresAt: Date.now() - 1 }));
        expect(takeGuestTextDraft(latest.token, tab)).toBeUndefined();
        expect(tab.entries.size).toBe(0);
    });

    test("allows the usual sign-in flow when storage cannot be accessed", () => {
        const blocked = () => {
            throw new Error("storage unavailable");
        };
        const tab = { getItem: blocked, setItem: blocked, removeItem: blocked };
        expect(guestTextDraftSignInPath("draft", tab)).toBeUndefined();
        expect(takeGuestTextDraft("token", tab)).toBeUndefined();
    });
});

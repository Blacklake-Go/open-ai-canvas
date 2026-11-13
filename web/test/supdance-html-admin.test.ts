import { describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import { buildPreviewDocument } from "@/supdance/plugins/html-page-manager/admin/preview-document";
import { HTML_ADMIN_I18N_ENTRIES } from "@/supdance/plugins/i18n/locales/html-admin";

describe("HTML admin preview and translations", () => {
    it("preserves authored content and runs template scripts with isolated storage", () => {
        const window = new Window();
        const previousParser = globalThis.DOMParser;
        globalThis.DOMParser = window.DOMParser as unknown as typeof DOMParser;
        try {
            const source = '<!DOCTYPE html><html><head><title>Authored title</title></head><body><pre>  keep\n spacing </pre><script>localStorage.setItem("theme", "dark")</script></body></html>';
            const result = buildPreviewDocument(source, "light");
            const doc = new window.DOMParser().parseFromString(result, "text/html");
            expect(doc.documentElement.dataset.theme).toBe("light");
            expect(doc.documentElement.style.colorScheme).toBe("light");
            expect(doc.title).toBe("Authored title");
            expect(doc.querySelector("pre")?.textContent).toBe("  keep\n spacing ");
            expect(doc.querySelectorAll("script")).toHaveLength(2);
            new Function("window", doc.head.querySelector("script")!.textContent!)(window);
            new Function("localStorage", doc.body.querySelector("script")!.textContent!)(window.localStorage);
            expect(window.localStorage.getItem("theme")).toBe("dark");
            const secondWindow = new Window();
            expect(secondWindow.localStorage.getItem("theme")).toBeNull();
            expect(source).not.toContain("Object.defineProperty");
        } finally {
            globalThis.DOMParser = previousParser;
            window.close();
        }
    });

    it("provides translations for current site locales and retained plugin locales", () => {
        const keys = new Set<string>();
        for (const entry of HTML_ADMIN_I18N_ENTRIES) {
            expect(keys.has(entry.key)).toBe(false);
            keys.add(entry.key);
            for (const locale of ["zh-CN", "en-US", "fr-FR", "de-DE", "ja-JP", "ko-KR", "zh-TW", "es-ES"] as const) {
                expect(entry.translations[locale]?.trim().length).toBeGreaterThan(0);
            }
        }
    });
});

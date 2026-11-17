import { describe, expect, test } from "bun:test";
import { SUPPORTED_LOCALES } from "../src/i18n/locales";
import { EMAIL_CENTER_I18N_ENTRIES } from "../src/supdance/plugins/email-marketing/messages";
import { PAGE_MANAGEMENT_ENTRIES } from "../src/supdance/plugins/compact-model-picker/page-messages";

describe("mail and page management native language coverage", () => {
    test("every editor, language preference and navigation key supplies all eight translations", () => {
        expect(SUPPORTED_LOCALES).toHaveLength(8);
        const entries = [...EMAIL_CENTER_I18N_ENTRIES, ...PAGE_MANAGEMENT_ENTRIES];
        expect(new Set(entries.map((entry) => entry.key)).size).toBe(entries.length);
        for (const entry of entries)
            for (const { code } of SUPPORTED_LOCALES) {
                expect(entry.translations[code]?.trim().length, `${entry.key}/${code}`).toBeGreaterThan(0);
            }
    });
    test("the product wording changes with the selected language", () => {
        const title = EMAIL_CENTER_I18N_ENTRIES.find((entry) => entry.key === "email.center.title")!;
        expect(title.translations["zh-TW"]).toBe("郵件中心");
        expect(title.translations["fr-FR"]).toBe("Centre de messagerie");
        expect(title.translations["de-DE"]).toBe("E-Mail-Center");
        expect(title.translations["ja-JP"]).toBe("メールセンター");
        expect(PAGE_MANAGEMENT_ENTRIES.find((entry) => entry.key === "page.management.title")?.translations["en-US"]).toBe("Page management");
    });
});

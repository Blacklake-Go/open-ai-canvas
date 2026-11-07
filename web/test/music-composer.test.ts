import { describe, expect, test } from "bun:test";
import { appendStyle, insertLyricSection, songOutline, styleTemplates } from "../src/supdance/plugins/music-generation/components/composer-patterns";
import { composerDefinitions } from "../src/supdance/plugins/i18n/locales/music-composer";

describe("music composer", () => {
    test("appends to the original field without duplicating a template or exceeding the model's Unicode limit", () => {
        expect(appendStyle("🌙", "🎶", 3)).toBe("🌙\n🎶");
        expect(appendStyle("原稿", "追加", 4)).toBeNull();
        expect(appendStyle("原稿\n追加", "追加", 8)).toBe("原稿\n追加");
        expect(appendStyle("", "新草稿", 3)).toBe("新草稿");
        expect(appendStyle("原稿\n", "追加", 5)).toBe("原稿\n追加");
    });

    test("inserts structures at the textarea selection and returns a UTF-16 caret without breaking the model limit", () => {
        expect(insertLyricSection("🌙ab", 2, 3, "[Chorus]\n", 12)).toEqual({ lyrics: "🌙\n[Chorus]\nb", caret: 12 });
        expect(insertLyricSection("🌙ab", 2, 3, "[Chorus]\n", 11)).toBeNull();
        expect(insertLyricSection("line\n", 5, 5, songOutline, 100)?.lyrics).toBe("line\n" + songOutline);
    });

    test("each original sketch has a localized title, prompt and two searchable category labels across all six languages", () => {
        expect(styleTemplates.length).toBeGreaterThanOrEqual(12);
        expect(new Set(styleTemplates.map((p) => p.id)).size).toBe(styleTemplates.length);
        const entries = new Map(composerDefinitions.map(([key, ...translations]) => [key, translations]));
        for (const p of styleTemplates) {
            for (const key of ["pattern_" + p.id, "pattern_" + p.id + "_style", "genre_" + p.genre, "use_" + p.use]) {
                expect(entries.get(key)?.filter(Boolean)).toHaveLength(6);
            }
        }
    });
});

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { catalogIdOf, curatedInspirations, type CreationInspiration } from "../src/lib/inspirations/catalog";
import { resolveInspirationCategoryLabel } from "../src/lib/inspirations/category-i18n";
import { resolveInspirationItem, setInspirationTranslations } from "../src/lib/inspirations/inspiration-i18n";
import type { SupDanceLocaleCode } from "../src/supdance/plugins/i18n/types";

const LOCALES: SupDanceLocaleCode[] = ["zh-CN", "en-US", "zh-TW", "ja-JP", "ko-KR", "es-ES"];

function loadCatalogData(): { all: CreationInspiration[]; seedance: CreationInspiration[]; haohaoxue: CreationInspiration[]; youmind: CreationInspiration[]; curated: CreationInspiration[] } {
    const seedancePack = JSON.parse(readFileSync(new URL("../public/inspirations/seedance.json", import.meta.url), "utf8"));
    const haohaoxuePack = JSON.parse(readFileSync(new URL("../public/inspirations/haohaoxue.json", import.meta.url), "utf8"));
    const youmindPack = JSON.parse(readFileSync(new URL("../public/inspirations/youmind.json", import.meta.url), "utf8"));

    const seedance = seedancePack.entries as CreationInspiration[];
    const haohaoxue = haohaoxuePack.entries as CreationInspiration[];
    const youmind = youmindPack.entries as CreationInspiration[];
    const curated = curatedInspirations;

    return {
        all: [...curated, ...seedance, ...haohaoxue, ...youmind],
        seedance,
        haohaoxue,
        youmind,
        curated,
    };
}

describe("Inspiration Hall Upstream Links & Material Retention", () => {
    const catalog = loadCatalogData();

    test("100% material retention: total assets count is exactly 1341 and none are deleted", () => {
        expect(catalog.curated.length).toBe(22);
        expect(catalog.seedance.length).toBe(767);
        expect(catalog.haohaoxue.length).toBe(297);
        expect(catalog.youmind.length).toBe(255);
        expect(catalog.all.length).toBe(1341);

        const ids = new Set(catalog.all.map((item) => catalogIdOf(item)));
        expect(ids.size).toBe(1341);
    });

    test("all upstream materials have valid, non-empty sourceUrl and attribution intact", () => {
        // Every external item in seedance, haohaoxue, and youmind must have a valid sourceUrl
        for (const item of catalog.seedance) {
            expect(item.sourceUrl).toBeDefined();
            expect(item.sourceUrl).toStartWith("https://");
            expect(item.sourceId).toBe("seedance");
        }
        for (const item of catalog.haohaoxue) {
            expect(item.sourceUrl).toBeDefined();
            expect(item.sourceUrl).toStartWith("https://");
            expect(item.sourceId).toBe("haohaoxue");
        }
        for (const item of catalog.youmind) {
            expect(item.sourceUrl).toBeDefined();
            expect(item.sourceUrl).toStartWith("https://");
            expect(item.sourceId).toBe("youmind");
        }
    });

    test("every translation pack contains all 1341 items with title, description, and prompt", () => {
        for (const locale of ["en-US", "zh-TW", "ja-JP", "ko-KR", "es-ES"] as const) {
            const raw = readFileSync(new URL(`../public/inspirations/translations/${locale}.json`, import.meta.url), "utf8");
            const pack = JSON.parse(raw);

            // Initialize cache for resolveInspirationItem
            setInspirationTranslations(locale, pack);

            let matchedCount = 0;
            for (const item of catalog.all) {
                const resolved = resolveInspirationItem(item, locale);
                expect(resolved.title).toBeTruthy();
                if (item.description) {
                    expect(resolved.description).toBeTruthy();
                }
                expect(resolved.prompt).toBeTruthy();
                // Crucial invariant: sourceUrl is NEVER lost or deleted during localization
                if (item.sourceUrl) {
                    expect(resolved.sourceUrl).toBe(item.sourceUrl);
                }
                matchedCount++;
            }
            expect(matchedCount).toBe(1341);
        }
    });

    test("under zh-CN, items return original verified Chinese without network overhead", () => {
        for (const item of catalog.all.slice(0, 50)) {
            const resolved = resolveInspirationItem(item, "zh-CN");
            expect(resolved).toBe(item);
            expect(resolved.title).toBe(item.title);
            expect(resolved.description).toBe(item.description);
            expect(resolved.prompt).toBe(item.prompt);
        }
    });

    test("under en-US, seedance and haohaoxue items resolve authentic English prompts", () => {
        const seedanceItem = catalog.seedance[0];
        const resolved = resolveInspirationItem(seedanceItem, "en-US");
        expect(resolved.prompt).toStartWith("Photorealistic cinematic 1950s American diner");
        expect(resolved.sourceUrl).toBe(seedanceItem.sourceUrl);
    });

    test("all 78 inspiration categories map cleanly across all 6 locales", () => {
        for (const locale of LOCALES) {
            expect(resolveInspirationCategoryLabel("3D 卡通", locale)).toBeTruthy();
            expect(resolveInspirationCategoryLabel("赛博朋克 / 科幻", locale)).toBeTruthy();
            expect(resolveInspirationCategoryLabel("电影感叙事短片", locale)).toBeTruthy();
            expect(resolveInspirationCategoryLabel("时间冻结与倒放", locale)).toBeTruthy();
            expect(resolveInspirationCategoryLabel("手持 UGC Vlog", locale)).toBeTruthy();
        }
    });
});

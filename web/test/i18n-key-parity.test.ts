import { describe, expect, test } from "bun:test";
import { BUILTIN_SUPDANCE_I18N_ENTRIES, DEFAULT_SUPDANCE_I18N_SETTINGS, DEFAULT_SUPDANCE_LANGUAGES, NAMESPACE_LABELS, SUPPORTED_LOCALE_CODES } from "../src/supdance/plugins/i18n/locales";
import enUSPack from "../src/supdance/plugins/i18n/locales/packs/en-US";
import esESPack from "../src/supdance/plugins/i18n/locales/packs/es-ES";
import jaJPPack from "../src/supdance/plugins/i18n/locales/packs/ja-JP";
import koKRPack from "../src/supdance/plugins/i18n/locales/packs/ko-KR";
import zhTWPack from "../src/supdance/plugins/i18n/locales/packs/zh-TW";
import type { SupDanceLocaleCode } from "../src/supdance/plugins/i18n/types";

describe("i18n Dictionary Key Parity & Catalog Integrity", () => {
    const builtinKeys = BUILTIN_SUPDANCE_I18N_ENTRIES.map((e) => e.key);
    const builtinKeySet = new Set(builtinKeys);
    const tokenRegex = /\{([a-zA-Z0-9_]+)\}/g;

    const foreignPacks: Record<Exclude<SupDanceLocaleCode, "zh-CN">, Record<string, string>> = {
        "en-US": enUSPack,
        "zh-TW": zhTWPack,
        "ja-JP": jaJPPack,
        "ko-KR": koKRPack,
        "es-ES": esESPack,
    };

    test("canonical catalog has valid entries, unique keys, and non-empty source text", () => {
        expect(BUILTIN_SUPDANCE_I18N_ENTRIES.length).toBeGreaterThanOrEqual(1657);
        expect(builtinKeySet.size).toBe(BUILTIN_SUPDANCE_I18N_ENTRIES.length);

        for (const entry of BUILTIN_SUPDANCE_I18N_ENTRIES) {
            expect(entry.key.trim()).toBe(entry.key);
            expect(entry.key.length).toBeGreaterThan(0);
            expect(entry.sourceText.trim().length).toBeGreaterThan(0);
            expect(entry.namespace in NAMESPACE_LABELS).toBe(true);
            expect(entry.origin).toBe("builtin");
            expect(entry.translations["zh-CN"]).toBe(entry.sourceText);
        }
    });

    test("supported locale codes and language settings match 6 core locales", () => {
        expect(SUPPORTED_LOCALE_CODES).toEqual(["zh-CN", "en-US", "zh-TW", "ja-JP", "ko-KR", "es-ES"]);
        expect(DEFAULT_SUPDANCE_LANGUAGES.length).toBe(6);
        expect(DEFAULT_SUPDANCE_I18N_SETTINGS.defaultLocale).toBe("zh-CN");
        expect(DEFAULT_SUPDANCE_I18N_SETTINGS.fallbackLocale).toBe("zh-CN");

        const codesInLanguages = DEFAULT_SUPDANCE_LANGUAGES.map((l) => l.code);
        expect(codesInLanguages).toEqual(SUPPORTED_LOCALE_CODES as unknown as SupDanceLocaleCode[]);
    });

    for (const [localeCode, pack] of Object.entries(foreignPacks)) {
        test(`${localeCode} language pack has 100% key parity with zero missing or extra keys`, () => {
            const packKeys = Object.keys(pack);
            const missingKeys = builtinKeys.filter((key) => !(key in pack));
            const extraKeys = packKeys.filter((key) => !builtinKeySet.has(key));

            if (missingKeys.length > 0) {
                console.error(`[FAIL] ${localeCode} missing ${missingKeys.length} keys:`, missingKeys.slice(0, 10));
            }
            if (extraKeys.length > 0) {
                console.error(`[FAIL] ${localeCode} extra ${extraKeys.length} keys:`, extraKeys.slice(0, 10));
            }

            expect(missingKeys).toEqual([]);
            expect(extraKeys).toEqual([]);
            expect(packKeys.length).toBe(BUILTIN_SUPDANCE_I18N_ENTRIES.length);
        });

        test(`${localeCode} language pack has non-empty, trimmed translations for all keys`, () => {
            const emptyKeys = Object.entries(pack).filter(([_, value]) => typeof value !== "string" || value.trim().length === 0);
            if (emptyKeys.length > 0) {
                console.error(`[FAIL] ${localeCode} contains empty translations for keys:`, emptyKeys.slice(0, 10));
            }
            expect(emptyKeys.length).toBe(0);
        });
    }

    test("dynamic template placeholders are strictly preserved between sourceText and foreign translations", () => {
        const mismatches: Array<{ key: string; locale: string; expected: string[]; actual: string[] }> = [];

        for (const entry of BUILTIN_SUPDANCE_I18N_ENTRIES) {
            const expectedTokens = [...entry.sourceText.matchAll(tokenRegex)].map((m) => m[1]!).sort();
            if (expectedTokens.length === 0) continue;

            for (const [localeCode, pack] of Object.entries(foreignPacks)) {
                const translation = pack[entry.key] ?? "";
                const actualTokens = [...translation.matchAll(tokenRegex)].map((m) => m[1]!).sort();
                if (expectedTokens.join(",") !== actualTokens.join(",")) {
                    mismatches.push({
                        key: entry.key,
                        locale: localeCode,
                        expected: expectedTokens,
                        actual: actualTokens,
                    });
                }
            }
        }

        if (mismatches.length > 0) {
            console.error("[FAIL] Placeholder mismatches discovered:", mismatches.slice(0, 5));
        }
        expect(mismatches).toEqual([]);
    });
});

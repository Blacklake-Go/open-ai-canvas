import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { getAntdLocaleForCode, loadAntdLocale } from "../src/supdance/plugins/i18n/engine/antd-locale";
import { compileI18nDictionary, interpolateTemplate, translateByKey, translateSourceText } from "../src/supdance/plugins/i18n/engine/translator";
import { DEFAULT_SUPDANCE_I18N_SETTINGS, loadAllLocalePacks, mergeI18nEntries } from "../src/supdance/plugins/i18n/locales";
import { useI18n, useSupDanceI18nStore } from "../src/supdance/plugins/i18n/store";
import type { SupDanceLocaleCode } from "../src/supdance/plugins/i18n/types";

const ALL_LOCALES: readonly SupDanceLocaleCode[] = ["zh-CN", "en-US", "zh-TW", "ja-JP", "ko-KR", "es-ES"];
const originalGlobalDescriptors = new Map(["window", "document", "navigator", "MutationObserver"].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));

describe("Empirical Challenger Suite: Milestone 1 Stress & Verification", () => {
    let initialStoreState: ReturnType<typeof useSupDanceI18nStore.getState>;

    beforeEach(async () => {
        initialStoreState = useSupDanceI18nStore.getState();
        await loadAllLocalePacks();
        const fullEntries = mergeI18nEntries();
        const fullDictionary = compileI18nDictionary(fullEntries);
        useSupDanceI18nStore.setState({
            pluginEnabled: true,
            locale: "zh-CN",
            settings: DEFAULT_SUPDANCE_I18N_SETTINGS,
            customEntries: {},
            entries: fullEntries,
            dictionary: fullDictionary,
            discoveredUntranslated: [],
        });
    });

    afterEach(() => {
        useSupDanceI18nStore.setState(initialStoreState);
        for (const [name, descriptor] of originalGlobalDescriptors) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else Reflect.deleteProperty(globalThis, name);
        }
    });

    // =========================================================================
    // 1. DYNAMIC REGEX TIME & NODE FORMATTING ACROSS ALL 6 LOCALES
    // =========================================================================
    describe("1. Dynamic Regex Formatting (Nodes & Relative Times)", () => {
        test("Format: 0 个节点 across all 6 locales (plurality check)", () => {
            const dict = useSupDanceI18nStore.getState().dictionary;
            const expected: Record<SupDanceLocaleCode, string> = {
                "zh-CN": "0 个节点",
                "en-US": "0 nodes",
                "zh-TW": "0 個節點",
                "ja-JP": "0 ノード",
                "ko-KR": "0개 노드",
                "es-ES": "0 nodos",
            };

            for (const locale of ALL_LOCALES) {
                const res = translateSourceText(dict, "0 个节点", locale);
                expect(res).toBe(expected[locale]);
            }
        });

        test("Format: 1 个节点 across all 6 locales (singular check)", () => {
            const dict = useSupDanceI18nStore.getState().dictionary;
            const expected: Record<SupDanceLocaleCode, string> = {
                "zh-CN": "1 个节点",
                "en-US": "1 node",
                "zh-TW": "1 個節點",
                "ja-JP": "1 ノード",
                "ko-KR": "1개 노드",
                "es-ES": "1 nodo",
            };

            for (const locale of ALL_LOCALES) {
                const res = translateSourceText(dict, "1 个节点", locale);
                expect(res).toBe(expected[locale]);
            }
        });

        test("Format: 9999 个节点 across all 6 locales (large quantity plural check)", () => {
            const dict = useSupDanceI18nStore.getState().dictionary;
            const expected: Record<SupDanceLocaleCode, string> = {
                "zh-CN": "9999 个节点",
                "en-US": "9999 nodes",
                "zh-TW": "9999 個節點",
                "ja-JP": "9999 ノード",
                "ko-KR": "9999개 노드",
                "es-ES": "9999 nodos",
            };

            for (const locale of ALL_LOCALES) {
                const res = translateSourceText(dict, "9999 个节点", locale);
                expect(res).toBe(expected[locale]);
            }
        });

        test("Format: 刚刚 across all 6 locales", () => {
            const dict = useSupDanceI18nStore.getState().dictionary;
            const expected: Record<SupDanceLocaleCode, string> = {
                "zh-CN": "刚刚",
                "en-US": "Just now",
                "zh-TW": "剛剛",
                "ja-JP": "たった今",
                "ko-KR": "방금 전",
                "es-ES": "Justo ahora",
            };

            for (const locale of ALL_LOCALES) {
                const res = translateSourceText(dict, "刚刚", locale);
                expect(res).toBe(expected[locale]);
            }
        });

        test("Format: 5 分钟前 across all 6 locales", () => {
            const dict = useSupDanceI18nStore.getState().dictionary;
            const expected: Record<SupDanceLocaleCode, string> = {
                "zh-CN": "5 分钟前",
                "en-US": "5m ago",
                "zh-TW": "5 分鐘前",
                "ja-JP": "5分前",
                "ko-KR": "5분 전",
                "es-ES": "hace 5 m",
            };

            for (const locale of ALL_LOCALES) {
                const res = translateSourceText(dict, "5 分钟前", locale);
                expect(res).toBe(expected[locale]);
            }
        });

        test("Format: 2 小时前 across all 6 locales", () => {
            const dict = useSupDanceI18nStore.getState().dictionary;
            const expected: Record<SupDanceLocaleCode, string> = {
                "zh-CN": "2 小时前",
                "en-US": "2h ago",
                "zh-TW": "2 小時前",
                "ja-JP": "2時間前",
                "ko-KR": "2시간 전",
                "es-ES": "hace 2 h",
            };

            for (const locale of ALL_LOCALES) {
                const res = translateSourceText(dict, "2 小时前", locale);
                expect(res).toBe(expected[locale]);
            }
        });

        test("Format: 30 天前 across all 6 locales", () => {
            const dict = useSupDanceI18nStore.getState().dictionary;
            const expected: Record<SupDanceLocaleCode, string> = {
                "zh-CN": "30 天前",
                "en-US": "30d ago",
                "zh-TW": "30 天前",
                "ja-JP": "30日前",
                "ko-KR": "30일 전",
                "es-ES": "hace 30 d",
            };

            for (const locale of ALL_LOCALES) {
                const res = translateSourceText(dict, "30 天前", locale);
                expect(res).toBe(expected[locale]);
            }
        });

        test("Whitespace preservation and boundary padding around dynamic rules", () => {
            const dict = useSupDanceI18nStore.getState().dictionary;

            // Leading and trailing spaces should be preserved exactly
            expect(translateSourceText(dict, "  5 分钟前  ", "en-US")).toBe("  5m ago  ");
            expect(translateSourceText(dict, "\n1 个节点\t", "es-ES")).toBe("\n1 nodo\t");
            expect(translateSourceText(dict, " 刚刚 ", "ja-JP")).toBe(" たった今 ");

            // Internal spaces in regex: `^(\d+)\s*个节点$`
            expect(translateSourceText(dict, "10   个节点", "en-US")).toBe("10 nodes");
            expect(translateSourceText(dict, "10个节点", "es-ES")).toBe("10 nodos");
        });

        test("Negative cases: near-matches do NOT falsely trigger dynamic rules", () => {
            const dict = useSupDanceI18nStore.getState().dictionary;

            // Incomplete or extra words around dynamic regex rules
            expect(translateSourceText(dict, "个节点", "en-US")).toBeNull();
            expect(translateSourceText(dict, "1个节点哦", "en-US")).toBeNull();
            expect(translateSourceText(dict, "刚刚好", "en-US")).toBeNull();
            expect(translateSourceText(dict, "天前", "en-US")).toBeNull();
            expect(translateSourceText(dict, "5天前吗", "en-US")).toBeNull();
            expect(translateSourceText(dict, "-5 天前", "en-US")).toBeNull();
            expect(translateSourceText(dict, "5.5 天前", "en-US")).toBeNull();
        });
    });

    // =========================================================================
    // 2. RAPID LOCALE SWITCHING & COMPONENT STABILITY
    // =========================================================================
    describe("2. Rapid Locale Switching Across All 6 Locales", () => {
        test("Simulate 300 rapid sequential locale switches without state corruption", () => {
            const store = useSupDanceI18nStore.getState();
            let notifications = 0;

            const unsub = useSupDanceI18nStore.subscribe((state) => {
                if (state.locale) notifications++;
            });

            const switchCycles = 50; // 50 * 6 = 300 switches
            for (let i = 0; i < switchCycles; i++) {
                for (const loc of ALL_LOCALES) {
                    useSupDanceI18nStore.getState().setLocale(loc);
                }
            }

            unsub();

            expect(notifications).toBe(switchCycles * ALL_LOCALES.length);
            expect(useSupDanceI18nStore.getState().locale).toBe("es-ES");

            // Final switch back to zh-CN
            useSupDanceI18nStore.getState().setLocale("zh-CN");
            expect(useSupDanceI18nStore.getState().locale).toBe("zh-CN");
        });

        test("Storage meter translations across all 6 locales under normal, full, and error states", () => {
            const dict = useSupDanceI18nStore.getState().dictionary;

            // Check keys used by WorkspaceSidebarStorageMeter:
            // "nav.storage_used", "nav.storage_remaining", "nav.storage_total", "common.retry"
            for (const locale of ALL_LOCALES) {
                const used = translateByKey(dict, "nav.storage_used", locale, "zh-CN", { used: "1.2 GB" });
                const remaining = translateByKey(dict, "nav.storage_remaining", locale, "zh-CN", { remaining: "18.8 GB" });
                const total = translateByKey(dict, "nav.storage_total", locale, "zh-CN", { total: "20 GB" });
                const retry = translateByKey(dict, "common.retry", locale, "zh-CN");

                expect(used).toContain("1.2 GB");
                expect(remaining).toContain("18.8 GB");
                expect(total).toContain("20 GB");
                expect(retry).toBeTruthy();

                if (locale === "es-ES") {
                    expect(used).toBe("Usado: 1.2 GB");
                    expect(remaining).toBe("Restante: 18.8 GB");
                    expect(total).toBe("Total 20 GB");
                    expect(retry).toBe("Reintentar");
                } else if (locale === "en-US") {
                    expect(used).toBe("Used: 1.2 GB");
                    expect(remaining).toBe("Remaining: 18.8 GB");
                    expect(total).toBe("Total 20 GB");
                    expect(retry).toBe("Retry");
                }
            }
        });

        test("Topbar Language Switcher keys and current locale matching", () => {
            const store = useSupDanceI18nStore.getState();
            const languages = store.settings.languages;

            expect(languages.length).toBe(6);
            for (const lang of languages) {
                expect(ALL_LOCALES).toContain(lang.code);
                expect(lang.enabled).toBe(true);
                expect(lang.name).toBeTruthy();
                expect(lang.nativeName).toBeTruthy();
            }
        });

        test("Creation area recommendation cards & creation placeholders across all 6 locales", () => {
            const dict = useSupDanceI18nStore.getState().dictionary;

            const cardKeys = [
                { title: "create.suggest_first_shot_title", hint: "create.suggest_first_shot_hint" },
                { title: "create.suggest_ref_image_title", hint: "create.suggest_ref_image_hint" },
                { title: "create.suggest_continue_story_title", hint: "create.suggest_continue_story_hint" },
                { title: "create.suggest_skills_title", hint: "create.suggest_skills_hint" },
            ];

            for (const locale of ALL_LOCALES) {
                // Card titles & hints must exist and have non-empty translations
                for (const card of cardKeys) {
                    const title = translateByKey(dict, card.title, locale);
                    const hint = translateByKey(dict, card.hint, locale);
                    expect(title).toBeTruthy();
                    expect(hint).toBeTruthy();
                    if (locale === "en-US" || locale === "es-ES") {
                        expect(title).not.toMatch(/[\u4e00-\u9fff]/);
                    }
                }

                // Placeholders:
                const emptyPlaceholder = translateByKey(dict, "create.empty_composer_placeholder", locale);
                const createBtn = translateByKey(dict, "create.create_canvas", locale);
                const creatingBtn = translateByKey(dict, "create.creating_canvas", locale);

                expect(emptyPlaceholder).toBeTruthy();
                expect(createBtn).toBeTruthy();
                expect(creatingBtn).toBeTruthy();

                if (locale === "es-ES") {
                    expect(createBtn).toBe("Crear lienzo");
                    expect(creatingBtn).toBe("Creando...");
                }
            }
        });

        test("Inspiration hall elements and Music category tab across all 6 locales", () => {
            const dict = useSupDanceI18nStore.getState().dictionary;

            const expectedMusic: Record<SupDanceLocaleCode, string> = {
                "zh-CN": "音乐",
                "en-US": "Music",
                "zh-TW": "音樂",
                "ja-JP": "音楽",
                "ko-KR": "음악",
                "es-ES": "Música",
            };

            for (const locale of ALL_LOCALES) {
                // Category "音乐"
                const music = translateByKey(dict, "common.music", locale);
                expect(music).toBe(expectedMusic[locale]);

                // Mode tabs
                expect(translateByKey(dict, "common.all", locale)).toBeTruthy();
                expect(translateByKey(dict, "assets.image", locale)).toBeTruthy();
                expect(translateByKey(dict, "assets.video", locale)).toBeTruthy();
                expect(translateByKey(dict, "common.text", locale)).toBeTruthy();

                // Actions and inputs
                expect(translateByKey(dict, "inspiration.hall_title", locale)).toBeTruthy();
                expect(translateByKey(dict, "inspiration.new_inspiration", locale)).toBeTruthy();
                expect(translateByKey(dict, "inspiration.search_placeholder", locale)).toBeTruthy();
                expect(translateByKey(dict, "inspiration.more_filters", locale)).toBeTruthy();
            }
        });
    });

    // =========================================================================
    // 3. MISSING KEY FALLBACK BEHAVIOR & IMMUNITY TO CRASHES
    // =========================================================================
    describe("3. Missing Key Fallback Behavior", () => {
        test("translateByKey: missing key with explicit fallback returns fallback", () => {
            const dict = useSupDanceI18nStore.getState().dictionary;

            const result = translateByKey(dict, "some.totally.bogus.key", "es-ES", "zh-CN", undefined, "Default Text Here");
            expect(result).toBe("Default Text Here");
        });

        test("translateByKey: missing key without fallback returns key name verbatim", () => {
            const dict = useSupDanceI18nStore.getState().dictionary;

            const result = translateByKey(dict, "some.totally.bogus.key", "es-ES", "zh-CN");
            expect(result).toBe("some.totally.bogus.key");
        });

        test("translateByKey: missing key with parameterized fallback interpolates parameters", () => {
            const dict = useSupDanceI18nStore.getState().dictionary;

            const result = translateByKey(dict, "missing.key.with.param", "es-ES", "zh-CN", { user: "Alice", count: 42 }, "User {user} has {count} items");
            expect(result).toBe("User Alice has 42 items");
        });

        test("Missing key with empty string key returns empty string", () => {
            const dict = useSupDanceI18nStore.getState().dictionary;
            expect(translateByKey(dict, "", "es-ES")).toBe("");
        });

        test("Edge case: Prototype pollution keys handled safely", () => {
            const dict = useSupDanceI18nStore.getState().dictionary;

            expect(translateByKey(dict, "__proto__", "es-ES")).toBe("__proto__");
            expect(translateByKey(dict, "constructor", "es-ES")).toBe("constructor");
            expect(translateByKey(dict, "toString", "es-ES")).toBe("toString");
            expect(translateByKey(dict, "valueOf", "es-ES")).toBe("valueOf");
        });

        test("interpolateTemplate handles extreme and unusual parameter values", () => {
            // Null or undefined values inside parameters map
            expect(interpolateTemplate("Hello {name}", { name: undefined as any })).toBe("Hello {name}");
            expect(interpolateTemplate("Value: {val}", { val: null as any })).toBe("Value: {val}");

            // Numeric zero
            expect(interpolateTemplate("Count: {count}", { count: 0 })).toBe("Count: 0");

            // Empty string value
            expect(interpolateTemplate("Prefix {str} Suffix", { str: "" })).toBe("Prefix  Suffix");

            // Meta-characters
            expect(interpolateTemplate("Path: {path}", { path: "C:\\Users\\test/$1/.*" })).toBe("Path: C:\\Users\\test/$1/.*");
        });
    });

    // =========================================================================
    // 4. ANTD DYNAMIC LOCALE LOADER CONCURRENCY & ASYNC RESILIENCE
    // =========================================================================
    describe("4. Ant Design Dynamic Locale Loader Concurrency", () => {
        test("Concurrent calls to loadAntdLocale for all 6 languages resolve simultaneously", async () => {
            const promises = ALL_LOCALES.map((code) => loadAntdLocale(code));
            const results = await Promise.all(promises);

            expect(results.length).toBe(6);
            for (const res of results) {
                expect(res).toBeDefined();
                expect(typeof res.locale).toBe("string");
            }
        });

        test("Synchronous getAntdLocaleForCode returns valid locale object for any code", () => {
            for (const code of ALL_LOCALES) {
                const loc = getAntdLocaleForCode(code);
                expect(loc).toBeDefined();
                expect(typeof loc.locale).toBe("string");
            }

            // When plugin is disabled, always falls back to zh-cn
            const disabledFallback = getAntdLocaleForCode("es-ES", false);
            expect(disabledFallback.locale).toBe("zh-cn");

            // When plugin is enabled, returns cached authentic AntD locale
            const enabledLoc = getAntdLocaleForCode("es-ES", true);
            expect(enabledLoc.locale).toBe("es");
        });
    });
});

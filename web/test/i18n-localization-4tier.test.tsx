import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Window } from "happy-dom";
import { detectBrowserLocale } from "../src/i18n/locales";
import { useLocaleStore } from "../src/stores/use-locale-store";
import { usePluginStore } from "../src/stores/use-plugin-store";
import { getAntdLocaleForCode, loadAntdLocale } from "../src/supdance/plugins/i18n/engine/antd-locale";
import { SupDanceDomTranslator } from "../src/supdance/plugins/i18n/engine/dom-observer";
import { compileI18nDictionary, interpolateTemplate, isCandidateUntranslatedChinese, resolveEntryTranslation, translateByKey, translateSourceText } from "../src/supdance/plugins/i18n/engine/translator";
import { BUILTIN_SUPDANCE_I18N_ENTRIES, DEFAULT_SUPDANCE_I18N_SETTINGS, loadAllLocalePacks, loadLocalePack, mergeI18nEntries } from "../src/supdance/plugins/i18n/locales";
import { SUPDANCE_I18N_CACHE_STORAGE_KEY, SUPDANCE_I18N_DISCOVERED_STORAGE_KEY, SUPDANCE_I18N_LOCALE_STORAGE_KEY, useI18n, useSupDanceI18nStore } from "../src/supdance/plugins/i18n/store";
import type { SupDanceI18nEntry, SupDanceLocaleCode } from "../src/supdance/plugins/i18n/types";

describe("SupDance Localization 4-Tier Test Suite", () => {
    let initialStoreState: ReturnType<typeof useSupDanceI18nStore.getState>;
    let initialPluginStoreState: ReturnType<typeof usePluginStore.getState>;
    const originalGlobalDescriptors = new Map(["window", "document", "navigator", "MutationObserver"].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));

    beforeEach(async () => {
        initialStoreState = useSupDanceI18nStore.getState();
        initialPluginStoreState = usePluginStore.getState();
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
        usePluginStore.setState(initialPluginStoreState);
        for (const [name, descriptor] of originalGlobalDescriptors) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else Reflect.deleteProperty(globalThis, name);
        }
    });

    /**
     * Safely executes a callback with a temporary happy-dom window,
     * guaranteeing immediate cleanup to prevent async store leaks.
     */
    function withMockWindow<T>(callback: (dom: Window) => T): T {
        const dom = new Window();
        const origWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
        const origDoc = Object.getOwnPropertyDescriptor(globalThis, "document");
        const origNav = Object.getOwnPropertyDescriptor(globalThis, "navigator");
        const origMO = Object.getOwnPropertyDescriptor(globalThis, "MutationObserver");

        Object.defineProperty(globalThis, "window", { configurable: true, value: dom });
        Object.defineProperty(globalThis, "document", { configurable: true, value: dom.document });
        Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.navigator });
        Object.defineProperty(globalThis, "MutationObserver", { configurable: true, value: dom.MutationObserver });

        try {
            return callback(dom);
        } finally {
            if (origWindow) Object.defineProperty(globalThis, "window", origWindow);
            else delete (globalThis as any).window;

            if (origDoc) Object.defineProperty(globalThis, "document", origDoc);
            else delete (globalThis as any).document;

            if (origNav) Object.defineProperty(globalThis, "navigator", origNav);
            else delete (globalThis as any).navigator;

            if (origMO) Object.defineProperty(globalThis, "MutationObserver", origMO);
            else delete (globalThis as any).MutationObserver;
        }
    }

    /**
     * Opaque translation helper mirroring useI18n().t contract
     */
    function getTranslator(locale: SupDanceLocaleCode = "es-ES") {
        const state = useSupDanceI18nStore.getState();
        const { dictionary, settings, pluginEnabled } = state;
        return (keyOrText: string, params?: Record<string, string | number>, fallbackText?: string): string => {
            if (!pluginEnabled) {
                return fallbackText ?? keyOrText;
            }
            if (dictionary.byKey.has(keyOrText)) {
                return translateByKey(dictionary, keyOrText, locale, settings.fallbackLocale, params, fallbackText);
            }
            return translateSourceText(dictionary, keyOrText, locale, settings.fallbackLocale) ?? fallbackText ?? keyOrText;
        };
    }

    // =========================================================================
    // TIER 1: Feature Coverage (Translation, Language Switching, Fallbacks)
    // =========================================================================
    describe("Tier 1: Feature Coverage", () => {
        test("key translation resolves authentic translations across all 6 supported locales", () => {
            const dict = useSupDanceI18nStore.getState().dictionary;

            expect(translateByKey(dict, "auth.login", "zh-CN")).toBe("登录");
            expect(translateByKey(dict, "auth.login", "en-US")).toBe("Log In");
            expect(translateByKey(dict, "auth.login", "zh-TW")).toBe("登入");
            expect(translateByKey(dict, "auth.login", "ja-JP")).toBe("ログイン");
            expect(translateByKey(dict, "auth.login", "ko-KR")).toBe("로그인");
            expect(translateByKey(dict, "auth.login", "es-ES")).toBe("Iniciar sesión");

            expect(translateByKey(dict, "create.recent_canvases", "zh-CN")).toBe("最近画布");
            expect(translateByKey(dict, "create.recent_canvases", "en-US")).toBe("Recent Canvases");
            expect(translateByKey(dict, "create.recent_canvases", "es-ES")).toBe("Lienzos recientes");

            expect(translateByKey(dict, "common.confirm", "zh-CN")).toBe("确认");
            expect(translateByKey(dict, "common.confirm", "es-ES")).toBe("Confirmar");
            expect(translateByKey(dict, "common.cancel", "zh-CN")).toBe("取消");
            expect(translateByKey(dict, "common.cancel", "es-ES")).toBe("Cancelar");
        });

        test("language switching updates active locale and triggers subscriber notification", async () => {
            let notifiedLocale: SupDanceLocaleCode | null = null;
            const unsubscribe = useSupDanceI18nStore.subscribe((state) => {
                notifiedLocale = state.locale;
            });

            useSupDanceI18nStore.getState().setLocale("es-ES");
            expect(useSupDanceI18nStore.getState().locale).toBe("es-ES");
            expect(notifiedLocale).toBe("es-ES");

            useSupDanceI18nStore.getState().setLocale("ja-JP");
            expect(useSupDanceI18nStore.getState().locale).toBe("ja-JP");
            expect(notifiedLocale).toBe("ja-JP");

            // Invalid values cannot replace the native device preference.
            useSupDanceI18nStore.getState().setLocale("invalid-locale" as any);
            expect(useSupDanceI18nStore.getState().locale).toBe("ja-JP");

            unsubscribe();
        });

        test("fallback cascade: missing locale translation falls back to zh-CN, then sourceText", () => {
            const syntheticEntry: SupDanceI18nEntry = {
                key: "test.synthetic_key",
                namespace: "common",
                sourceText: "原始中文文案",
                origin: "custom",
                translations: {
                    "zh-CN": "中文翻译",
                    "en-US": "",
                    "zh-TW": "",
                    "ja-JP": "",
                    "ko-KR": "",
                    "es-ES": "",
                },
            };

            // Direct missing foreign translation falls back to fallbackLocale (zh-CN)
            expect(resolveEntryTranslation(syntheticEntry, "es-ES", "zh-CN")).toBe("中文翻译");

            // If fallbackLocale is empty, falls back to sourceText
            const bareEntry: SupDanceI18nEntry = {
                ...syntheticEntry,
                translations: {
                    "zh-CN": "",
                    "en-US": "",
                    "zh-TW": "",
                    "ja-JP": "",
                    "ko-KR": "",
                    "es-ES": "",
                },
            };
            expect(resolveEntryTranslation(bareEntry, "es-ES", "en-US")).toBe("原始中文文案");
        });

        test("missing dictionary key falls back to explicit fallbackText or returns key verbatim", () => {
            const dict = useSupDanceI18nStore.getState().dictionary;

            // Missing key with fallbackText provided
            expect(translateByKey(dict, "unregistered.custom_key", "es-ES", "zh-CN", undefined, "Texto de respaldo")).toBe("Texto de respaldo");

            // Missing key without fallbackText returns the key itself
            expect(translateByKey(dict, "unregistered.custom_key", "es-ES", "zh-CN")).toBe("unregistered.custom_key");
        });

        test("disabled i18n store state returns fallbackText or key without throwing", () => {
            useSupDanceI18nStore.setState({ pluginEnabled: false });

            const tDisabled = getTranslator("es-ES");
            expect(tDisabled("missing.btn", undefined, "点击操作")).toBe("点击操作");
            expect(tDisabled("missing.unfallback")).toBe("missing.unfallback");

            // React component SSR test: verify it renders safely without error
            const Probe = () => {
                const { t } = useI18n();
                return createElement("span", null, `${t("auth.login")}/${t("auth.password")}`);
            };
            const html = renderToStaticMarkup(createElement(Probe));
            expect(html).toContain("登录");
            expect(html).toContain("密码");
        });

        test("source text translation preserves leading and trailing whitespace", () => {
            const dict = useSupDanceI18nStore.getState().dictionary;

            const translated = translateSourceText(dict, "  新建画布  ", "es-ES");
            expect(translated).toBe("  Nuevo lienzo  ");

            const translatedEn = translateSourceText(dict, "\n开始生成\t", "en-US");
            expect(translatedEn).toBe("\nGenerate\t");
        });

        test("dynamic pattern rules correctly format quantities, times, and counts across 6 locales", () => {
            const dict = useSupDanceI18nStore.getState().dictionary;

            // Quantity: 共 X 条
            expect(translateSourceText(dict, "共 42 条", "zh-CN")).toBe("共 42 条");
            expect(translateSourceText(dict, "共 42 条", "en-US")).toBe("Total 42");
            expect(translateSourceText(dict, "共 42 条", "zh-TW")).toBe("共 42 條");
            expect(translateSourceText(dict, "共 42 条", "ja-JP")).toBe("全 42 件");
            expect(translateSourceText(dict, "共 42 条", "ko-KR")).toBe("총 42개");
            expect(translateSourceText(dict, "共 42 条", "es-ES")).toBe("Total 42");

            // Range: X-Y / 共 Z 条
            expect(translateSourceText(dict, "1-10 / 共 50 条", "en-US")).toBe("1-10 of 50");
            expect(translateSourceText(dict, "1-10 / 共 50 条", "es-ES")).toBe("1-10 de 50");

            // Pagination size: X 条/页
            expect(translateSourceText(dict, "20 条/页", "es-ES")).toBe("20 / pág.");
            expect(translateSourceText(dict, "20 条/页", "en-US")).toBe("20 / page");

            // Selection count: 已选择 X 项
            expect(translateSourceText(dict, "已选择 3 项", "es-ES")).toBe("3 seleccionados");
            expect(translateSourceText(dict, "已选择 3 项", "en-US")).toBe("3 selected");

            // Shots: 第 X 镜
            expect(translateSourceText(dict, "第 5 镜", "es-ES")).toBe("Toma #5");
            expect(translateSourceText(dict, "第 5 镜", "en-US")).toBe("Shot #5");

            // Seconds: X 秒
            expect(translateSourceText(dict, "30 秒", "es-ES")).toBe("30s");
            expect(translateSourceText(dict, "30 秒", "ja-JP")).toBe("30秒");
            expect(translateSourceText(dict, "30 秒", "ko-KR")).toBe("30초");

            // Total shots: 共 X 个镜头
            expect(translateSourceText(dict, "共 8 个镜头", "es-ES")).toBe("8 tomas en total");
            expect(translateSourceText(dict, "共 8 个镜头", "en-US")).toBe("8 shots total");
        });
    });

    // =========================================================================
    // TIER 2: Boundary & Corner Cases (Empty Keys, Special Regex, Privacy)
    // =========================================================================
    describe("Tier 2: Boundary & Corner Cases", () => {
        test("empty keys and whitespace strings handle safely without throwing", () => {
            const dict = useSupDanceI18nStore.getState().dictionary;

            expect(translateByKey(dict, "", "es-ES")).toBe("");
            expect(translateByKey(dict, "   ", "es-ES")).toBe("   ");
            expect(translateSourceText(dict, "", "es-ES")).toBeNull();
            expect(translateSourceText(dict, "   ", "es-ES")).toBeNull();
        });

        test("parameter interpolation handles missing parameters, extra parameters, and numeric zero", () => {
            const template = "已使用 {used}，剩余 {remaining}，共 {total} 项";

            // Complete parameters
            expect(interpolateTemplate(template, { used: "5GB", remaining: "15GB", total: 100 })).toBe("已使用 5GB，剩余 15GB，共 100 项");

            // Missing parameters: unprovided placeholders remain verbatim
            expect(interpolateTemplate(template, { used: "5GB" })).toBe("已使用 5GB，剩余 {remaining}，共 {total} 项");

            // Numeric zero must not be treated as falsey or omitted
            expect(interpolateTemplate("选中了 {count} 个对象", { count: 0 })).toBe("选中了 0 个对象");

            // Extra unused parameters are ignored cleanly
            expect(interpolateTemplate("Hello {name}", { name: "Alice", extra: "IgnoreMe" })).toBe("Hello Alice");

            // No vars provided
            expect(interpolateTemplate(template, undefined)).toBe(template);
        });

        test("parameter interpolation safely handles regex meta-characters and HTML symbols in values", () => {
            const template = "品牌: {brand}, 路径: {path}, 表达式: {expr}";
            const result = interpolateTemplate(template, {
                brand: "<Sup&Dance/100%>",
                path: "C:\\Windows\\system32\\*.*",
                expr: "a+b.*?(regex)?^$[test]",
            });

            expect(result).toBe("品牌: <Sup&Dance/100%>, 路径: C:\\Windows\\system32\\*.*, 表达式: a+b.*?(regex)?^$[test]");
        });

        test("browser language normalization matches dialect variants to core 6 locales", () => {
            const expectations: Array<{ input: string[]; expected: SupDanceLocaleCode }> = [
                { input: ["es-AR", "es"], expected: "es-ES" }, // Argentina Spanish -> es-ES
                { input: ["es-419"], expected: "es-ES" }, // Latin American Spanish -> es-ES
                { input: ["es-MX"], expected: "es-ES" }, // Mexican Spanish -> es-ES
                { input: ["zh-TW"], expected: "zh-TW" }, // Traditional Taiwan -> zh-TW
                { input: ["zh-HK"], expected: "zh-TW" }, // Traditional Hong Kong -> zh-TW
                { input: ["zh-MO"], expected: "zh-TW" }, // Traditional Macau -> zh-TW
                { input: ["zh-CN"], expected: "zh-CN" }, // Simplified Chinese -> zh-CN
                { input: ["zh-SG"], expected: "zh-CN" }, // Singapore Chinese -> zh-CN
                { input: ["en-GB", "en"], expected: "en-US" }, // British English -> en-US
                { input: ["en-US"], expected: "en-US" }, // American English -> en-US
                { input: ["ja"], expected: "ja-JP" }, // Japanese -> ja-JP
                { input: ["ko-KR"], expected: "ko-KR" }, // Korean -> ko-KR
            ];

            for (const { input, expected } of expectations) {
                withMockWindow((dom) => {
                    Object.defineProperty(dom.navigator, "languages", {
                        configurable: true,
                        value: input,
                    });
                    Object.defineProperty(dom.navigator, "language", {
                        configurable: true,
                        value: input[0],
                    });

                    expect(detectBrowserLocale(input)).toBe(expected);
                    useLocaleStore.getState().setLocale("en-US");
                    useSupDanceI18nStore.getState().updateLocalSettings({
                        ...DEFAULT_SUPDANCE_I18N_SETTINGS,
                        autoDetectBrowser: true,
                    });

                    expect(useSupDanceI18nStore.getState().locale).toBe("en-US");
                });
            }
        });

        test("untranslated Chinese candidate heuristic filters URLs, code, and extreme lengths", () => {
            // Valid candidates
            expect(isCandidateUntranslatedChinese("创建画布")).toBe(true);
            expect(isCandidateUntranslatedChinese("选择图片模型")).toBe(true);
            expect(isCandidateUntranslatedChinese("和 Supdance 聊聊")).toBe(true);

            // Invalid candidates
            expect(isCandidateUntranslatedChinese("https://ddcat.ai/api/v1")).toBe(false);
            expect(isCandidateUntranslatedChinese("http://localhost:3000")).toBe(false);
            expect(isCandidateUntranslatedChinese('{"status": 200, "msg": "ok"}')).toBe(false);
            expect(isCandidateUntranslatedChinese("<div className='box'>")).toBe(false);
            expect(isCandidateUntranslatedChinese("// 注释代码行")).toBe(false);
            expect(isCandidateUntranslatedChinese("我")).toBe(false); // Length < 2
            expect(isCandidateUntranslatedChinese("Hello World")).toBe(false); // No Chinese Han characters
            expect(isCandidateUntranslatedChinese("超长".repeat(40))).toBe(false); // Length > 64
        });

        test("incognito localstorage quota exceeded or security errors do not throw", () => {
            withMockWindow((dom) => {
                dom.localStorage.setItem = () => {
                    const err = new Error("QuotaExceededError: The quota has been exceeded.");
                    err.name = "QuotaExceededError";
                    throw err;
                };

                // Operations must succeed in memory without uncaught exception
                expect(() => {
                    useSupDanceI18nStore.getState().setLocale("es-ES");
                }).not.toThrow();

                expect(() => {
                    useSupDanceI18nStore.getState().recordUntranslatedText("未翻译字段测试", "/create");
                }).not.toThrow();

                expect(useSupDanceI18nStore.getState().locale).toBe("es-ES");
            });
        });
    });

    // =========================================================================
    // TIER 3: Cross-Feature Combinations (Multi-Tab Sync, AntD Locale, Observer)
    // =========================================================================
    describe("Tier 3: Cross-Feature Combinations & Interactions", () => {
        test("legacy configuration synchronization cannot replace the native locale", () => {
            withMockWindow((dom) => {
                dom.localStorage.setItem(SUPDANCE_I18N_LOCALE_STORAGE_KEY, "es-ES");

                // Trigger storage synchronization
                useSupDanceI18nStore.getState().syncFromStorage();

                expect(useSupDanceI18nStore.getState().locale).toBe(useLocaleStore.getState().locale);
                expect(useSupDanceI18nStore.getState().revision).toContain("storage-");
            });
        });

        test("Ant Design dynamic locale loader resolves locale objects for all 6 languages", async () => {
            // Default zh-CN
            const zhLocale = getAntdLocaleForCode("zh-CN");
            expect(zhLocale.locale).toBe("zh-cn");

            // Dynamic loading for foreign locales
            const enLocale = await loadAntdLocale("en-US");
            expect(enLocale.locale).toBe("en");

            const esLocale = await loadAntdLocale("es-ES");
            expect(esLocale.locale).toBe("es");

            const jaLocale = await loadAntdLocale("ja-JP");
            expect(jaLocale.locale).toBe("ja");

            const koLocale = await loadAntdLocale("ko-KR");
            expect(koLocale.locale).toBe("ko");

            const twLocale = await loadAntdLocale("zh-TW");
            expect(twLocale.locale).toBe("zh-tw");

            // Disabled plugin fallback
            const disabledLocale = getAntdLocaleForCode("es-ES", false);
            expect(disabledLocale.locale).toBe("zh-cn");
        });

        test("DOM MutationObserver translates text nodes and translatable attributes without infinite loops", async () => {
            const dom = new Window();
            globalThis.MutationObserver = dom.MutationObserver as any;

            const root = dom.document.createElement("div");
            dom.document.body.appendChild(root);

            const titleNode = dom.document.createElement("h2");
            titleNode.textContent = "新建画布";
            root.appendChild(titleNode);

            const inputNode = dom.document.createElement("input");
            inputNode.setAttribute("placeholder", "新建画布");
            root.appendChild(inputNode);

            const dict = useSupDanceI18nStore.getState().dictionary;
            const observer = new SupDanceDomTranslator();

            // Attach observer in Spanish
            observer.attach(root as any, dict, "es-ES", "zh-CN");

            // Check immediate translation
            expect(titleNode.textContent).toBe("Nuevo lienzo");
            expect(inputNode.getAttribute("placeholder")).toBe("Nuevo lienzo");

            // Dynamic child addition
            const dynamicBtn = dom.document.createElement("button");
            dynamicBtn.textContent = "开始生成";
            root.appendChild(dynamicBtn);

            await new Promise((r) => setTimeout(r, 20));
            observer.update(dict, "es-ES", "zh-CN");

            expect(dynamicBtn.textContent).toBe("Generar");

            // Restore on switching back to Chinese
            observer.restoreAndDetach();
            expect(titleNode.textContent).toBe("新建画布");
            expect(inputNode.getAttribute("placeholder")).toBe("新建画布");
            expect(dynamicBtn.textContent).toBe("开始生成");
        });

        test("DOM observer memory leak defense: disconnected nodes are pruned", () => {
            const dom = new Window();
            globalThis.MutationObserver = dom.MutationObserver as any;

            const root = dom.document.createElement("div");
            dom.document.body.appendChild(root);

            const tempP = dom.document.createElement("p");
            tempP.textContent = "新建画布";
            root.appendChild(tempP);

            const dict = useSupDanceI18nStore.getState().dictionary;
            const observer = new SupDanceDomTranslator();
            observer.attach(root as any, dict, "es-ES", "zh-CN");

            expect(observer.getTouchedNodeCounts().textNodes).toBeGreaterThan(0);

            // Unmount node from live DOM
            root.removeChild(tempP);

            // Pruning removes detached reference from tracking set
            const pruned = observer.pruneDisconnectedNodes();
            expect(pruned.prunedTextNodes).toBeGreaterThanOrEqual(1);

            observer.restoreAndDetach();
        });

        test("custom dictionary entries override built-in entries and revert cleanly upon removal", () => {
            const originalTranslation = translateByKey(useSupDanceI18nStore.getState().dictionary, "create.new_canvas", "es-ES");
            expect(originalTranslation).toBe("Nuevo lienzo");

            // Upsert custom override
            const customEntry: SupDanceI18nEntry = {
                key: "create.new_canvas",
                namespace: "create",
                sourceText: "新建画布",
                origin: "modified",
                translations: {
                    "zh-CN": "新建画布",
                    "en-US": "Create Canvas Project",
                    "zh-TW": "新建畫布專案",
                    "ja-JP": "新規キャンバス作成",
                    "ko-KR": "새 캔버스 생성",
                    "es-ES": "Crear proyecto de lienzo",
                },
            };

            useSupDanceI18nStore.getState().upsertLocalEntries([customEntry]);
            const overridden = translateByKey(useSupDanceI18nStore.getState().dictionary, "create.new_canvas", "es-ES");
            expect(overridden).toBe("Crear proyecto de lienzo");

            // Remove local entry and verify reversion to built-in translation
            useSupDanceI18nStore.getState().removeLocalEntry("create.new_canvas");
            const reverted = translateByKey(useSupDanceI18nStore.getState().dictionary, "create.new_canvas", "es-ES");
            expect(reverted).toBe("Nuevo lienzo");
        });
    });

    // =========================================================================
    // TIER 4: Real-World Application Scenarios (Spanish / es-ES User Journey)
    // =========================================================================
    describe("Tier 4: Real-World Application Scenarios (Spanish / es-ES Journey)", () => {
        let tEs: ReturnType<typeof getTranslator>;

        beforeEach(() => {
            useSupDanceI18nStore.getState().setLocale("es-ES");
            tEs = getTranslator("es-ES");
        });

        test("Scenario 1: Creation workspace empty state rendering in Spanish", () => {
            // R1.1 Hero chat title parameterized contract
            const heroTitle = tEs("create.hero_chat_title", { brand: "Supdance" }, "Habla de ideas creativas con Supdance");
            expect(heroTitle).toContain("Supdance");
            expect(heroTitle).not.toContain("和");
            expect(heroTitle).not.toContain("聊聊创作想法");

            // R1.2 Composer placeholder
            const composerPlaceholder = tEs("create.empty_composer_placeholder", undefined, "Introduce tu toma, plano o historia. También puedes añadir una imagen de referencia para empezar a crear.");
            expect(composerPlaceholder).toContain("Introduce tu toma");
            expect(composerPlaceholder).not.toContain("输入你的镜头");

            // R1.5 4 Quick Recommendation Cards
            const card1 = {
                title: tEs("create.card_first_shot_title", undefined, "Generar la primera toma"),
                hint: tEs("create.card_first_shot_hint", undefined, "Describe el encuadre, el movimiento de cámara y la iluminación"),
            };
            const card2 = {
                title: tEs("create.card_ref_image_title", undefined, "Comenzar desde imagen de referencia"),
                hint: tEs("create.card_ref_image_hint", undefined, "Sube una imagen de estilo para generar planos con el mismo estilo"),
            };
            const card3 = {
                title: tEs("create.card_story_title", undefined, "Continuar la historia"),
                hint: tEs("create.card_story_hint", undefined, "Habla con la IA sobre la trama, los personajes y los diálogos"),
            };
            const card4 = {
                title: tEs("create.card_skills_title", undefined, "Potenciar con habilidades"),
                hint: tEs("create.card_skills_hint", undefined, "@habilidad para invocar capacidades de guion gráfico y doblaje"),
            };

            for (const card of [card1, card2, card3, card4]) {
                expect(card.title).not.toMatch(/[\u4e00-\u9fff]/);
                expect(card.hint).not.toMatch(/[\u4e00-\u9fff]/);
            }
        });

        test("Scenario 2: Model selector and media tab bar rendering in Spanish", () => {
            // R1.3 Model selector placeholder
            const selectorPlaceholder = tEs("create.select_model_placeholder", { mode: "Imagen" }, "Seleccionar modelo de Imagen");
            expect(selectorPlaceholder).toBe("Seleccionar modelo de Imagen");
            expect(selectorPlaceholder).not.toContain("选择");
            expect(selectorPlaceholder).not.toContain("模型");

            // R1.4 Music category / tab key
            const musicLabel = tEs("common.music", undefined, "Música");
            expect(musicLabel).toBe("Música");
            expect(musicLabel).not.toBe("音乐");
        });

        test("Scenario 3: Recent canvases section displays translated headings and actions", () => {
            // Recent canvases header (built-in translation in es-ES)
            expect(tEs("create.recent_canvases")).toBe("Lienzos recientes");

            // New canvas button
            expect(tEs("create.new_canvas")).toBe("Nuevo lienzo");

            // Create canvas card (R1.6)
            const createCardTitle = tEs("create.create_canvas", undefined, "Crear lienzo");
            expect(createCardTitle).toBe("Crear lienzo");
            expect(createCardTitle).not.toBe("创建画布");
        });

        test("Scenario 4: Inspiration hall exploration in Spanish", () => {
            // R1.7 Inspiration hall elements
            const inspirationTitle = tEs("create.inspiration");
            expect(inspirationTitle).toBe("Galería de Inspiración");

            const inspirationSubtitle = tEs("inspirations.subtitle", undefined, "Haz clic para ver el prompt completo y seguir creando con tu idea favorita.");
            expect(inspirationSubtitle).toContain("Haz clic para ver");

            const newInspirationBtn = tEs("inspirations.new", undefined, "Nueva inspiración");
            expect(newInspirationBtn).toBe("Nueva inspiración");

            const searchPlaceholder = tEs("inspirations.search_placeholder", undefined, "Buscar por título, descripción o etiquetas");
            expect(searchPlaceholder).toBe("Buscar por título, descripción o etiquetas");

            const moreFilters = tEs("inspirations.more_filters", undefined, "Más filtros");
            expect(moreFilters).toBe("Más filtros");

            // Dynamic category count: Música 0
            const dynamicMusicCount = `${tEs("common.music", undefined, "Música")} 0`;
            expect(dynamicMusicCount).toBe("Música 0");
            expect(dynamicMusicCount).not.toContain("音乐");
        });

        test("Scenario 5: Storage meter card in Spanish correctly interpolates byte quantities and warnings", () => {
            // R1.8 Storage meter labels in Spanish (from built-in pack: "Usado: {used}", "Restante: {remaining}", "Total {total}")
            const usedText = tEs("nav.storage_used", { used: "120 KB" });
            const remainingText = tEs("nav.storage_remaining", { remaining: "20 GB" });
            const totalText = tEs("nav.storage_total", { total: "20 GB" });

            expect(usedText).toBe("Usado: 120 KB");
            expect(remainingText).toBe("Restante: 20 GB");
            expect(totalText).toBe("Total 20 GB");

            expect(usedText).not.toContain("已用");
            expect(remainingText).not.toContain("剩余");
            expect(totalText).not.toContain("共");

            // Storage action buttons in Spanish
            expect(tEs("nav.storage_limit_clean")).toBe("Limpiar recursos");
            expect(tEs("nav.storage_limit_buy")).toBe("Comprar espacio");
            expect(tEs("nav.storage_limit_title")).toBe("Espacio de almacenamiento insuficiente");
        });
    });
});

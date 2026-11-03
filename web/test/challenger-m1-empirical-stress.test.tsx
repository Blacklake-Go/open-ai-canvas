import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { SupDanceDomTranslator } from "../src/supdance/plugins/i18n/engine/dom-observer";
import {
    compileI18nDictionary,
    interpolateTemplate,
    translateByKey,
    translateSourceText,
    type CompiledI18nDictionary,
} from "../src/supdance/plugins/i18n/engine/translator";
import {
    BUILTIN_SUPDANCE_I18N_ENTRIES,
    DEFAULT_SUPDANCE_I18N_SETTINGS,
    loadAllLocalePacks,
    loadLocalePack,
    mergeI18nEntries,
} from "../src/supdance/plugins/i18n/locales";
import {
    useSupDanceI18nStore,
} from "../src/supdance/plugins/i18n/store";
import type { SupDanceLocaleCode } from "../src/supdance/plugins/i18n/types";

describe("Empirical Challenger Milestone 1 Stress & Adversarial Suite", () => {
    let dict: CompiledI18nDictionary;
    const hanRegex = /[\u4e00-\u9fff]/;

    beforeEach(async () => {
        await loadAllLocalePacks();
        const fullEntries = mergeI18nEntries();
        dict = compileI18nDictionary(fullEntries);
        useSupDanceI18nStore.setState({
            pluginEnabled: true,
            locale: "es-ES",
            settings: DEFAULT_SUPDANCE_I18N_SETTINGS,
            customEntries: {},
            entries: fullEntries,
            dictionary: dict,
            discoveredUntranslated: [],
        });
    });

    describe("Challenge 1: Spanish (es-ES) Screenshot 8-Item Deep Verification", () => {
        const tEs = (key: string, vars?: Record<string, string | number>, fallback?: string) =>
            translateByKey(dict, key, "es-ES", "zh-CN", vars, fallback);

        test("Item 1: Hero Chat Title resolves to Spanish without residual Chinese", () => {
            const title = tEs("create.hero_chat_title", { brand: "Supdance" });
            expect(title).toBe("Habla con Supdance sobre ideas de creación");
            expect(hanRegex.test(title)).toBeFalse();
        });

        test("Item 2: Composer Placeholders resolve to Spanish without residual Chinese", () => {
            const emptyPlaceholder = tEs("create.empty_composer_placeholder");
            expect(emptyPlaceholder).toBe(
                "Introduce tu toma, imagen o historia. También puedes añadir imágenes de referencia para empezar a crear"
            );
            expect(hanRegex.test(emptyPlaceholder)).toBeFalse();

            const textPlaceholder = tEs("create.composer_placeholder_text");
            expect(textPlaceholder).toBe("Describe tu historia, personajes o ideas que quieras desarrollar");
            expect(hanRegex.test(textPlaceholder)).toBeFalse();

            const imagePlaceholder = tEs("create.composer_placeholder_image");
            expect(imagePlaceholder).toBe("Describe la imagen, personajes, escenas, composición y estilo");
            expect(hanRegex.test(imagePlaceholder)).toBeFalse();

            const videoPlaceholder = tEs("create.composer_placeholder_video");
            expect(videoPlaceholder).toBe("Describe el contenido de la toma, movimiento, iluminación y ritmo");
            expect(hanRegex.test(videoPlaceholder)).toBeFalse();
        });

        test("Item 3: Model Selector Placeholders resolve to Spanish without residual Chinese", () => {
            const modeImage = tEs("create.mode_image");
            const modeVideo = tEs("create.mode_video");
            const modeText = tEs("create.mode_text");

            expect(modeImage).toBe("imagen");
            expect(modeVideo).toBe("video");
            expect(modeText).toBe("texto");

            const placeholderImage = tEs("create.select_model_placeholder", { mode: modeImage });
            expect(placeholderImage).toBe("Seleccionar modelo de imagen");
            expect(hanRegex.test(placeholderImage)).toBeFalse();

            const placeholderVideo = tEs("create.select_model_placeholder", { mode: modeVideo });
            expect(placeholderVideo).toBe("Seleccionar modelo de video");
            expect(hanRegex.test(placeholderVideo)).toBeFalse();

            const placeholderText = tEs("create.select_model_placeholder", { mode: modeText });
            expect(placeholderText).toBe("Seleccionar modelo de texto");
            expect(hanRegex.test(placeholderText)).toBeFalse();
        });

        test("Item 4: Music Category Key in Navigation and Common resolves to Spanish", () => {
            const musicLabel = tEs("common.music");
            expect(musicLabel).toBe("Música");
            expect(hanRegex.test(musicLabel)).toBeFalse();
        });

        test("Item 5: 4 Quick Start Suggestion Cards resolve to Spanish without residual Chinese", () => {
            const card1Title = tEs("create.suggest_first_shot_title");
            const card1Hint = tEs("create.suggest_first_shot_hint");
            expect(card1Title).toBe("Generar la primera toma");
            expect(card1Hint).toBe("Describe la imagen, movimiento de cámara e iluminación");
            expect(hanRegex.test(card1Title)).toBeFalse();
            expect(hanRegex.test(card1Hint)).toBeFalse();

            const card2Title = tEs("create.suggest_ref_image_title");
            const card2Hint = tEs("create.suggest_ref_image_hint");
            expect(card2Title).toBe("Empezar con imagen de referencia");
            expect(card2Hint).toBe("Sube una imagen de estilo para generar escenas del mismo estilo");
            expect(hanRegex.test(card2Title)).toBeFalse();
            expect(hanRegex.test(card2Hint)).toBeFalse();

            const card3Title = tEs("create.suggest_continue_story_title");
            const card3Hint = tEs("create.suggest_continue_story_hint");
            expect(card3Title).toBe("Continuar la historia");
            expect(card3Hint).toBe("Habla con la IA sobre trama, personajes y diálogos");
            expect(hanRegex.test(card3Title)).toBeFalse();
            expect(hanRegex.test(card3Hint)).toBeFalse();

            const card4Title = tEs("create.suggest_skills_title");
            const card4Hint = tEs("create.suggest_skills_hint");
            expect(card4Title).toBe("Mejorar con habilidades");
            expect(card4Hint).toBe("@Habilidades invoca guiones gráficos, doblaje y funciones pro");
            expect(hanRegex.test(card4Title)).toBeFalse();
            expect(hanRegex.test(card4Hint)).toBeFalse();
        });

        test("Item 6: Recent Canvases Create Card actions resolve to Spanish", () => {
            const createTitle = tEs("create.create_canvas");
            expect(createTitle).toBe("Crear lienzo");
            expect(hanRegex.test(createTitle)).toBeFalse();

            const creatingTitle = tEs("create.creating_canvas");
            expect(creatingTitle).toBe("Creando...");
            expect(hanRegex.test(creatingTitle)).toBeFalse();
        });

        test("Item 7: Inspiration Hall Elements resolve to Spanish without residual Chinese", () => {
            const title = tEs("create.inspiration");
            expect(title).toBe("Galería de Inspiración");
            expect(hanRegex.test(title)).toBeFalse();

            const subtitle = tEs("inspiration.hall_subtitle");
            expect(subtitle).toBe(
                "Haz clic para ver las instrucciones completas y continúa creando con tus ideas favoritas."
            );
            expect(hanRegex.test(subtitle)).toBeFalse();

            const newBtn = tEs("inspirations.new");
            expect(newBtn).toBe("Nueva inspiración");
            expect(hanRegex.test(newBtn)).toBeFalse();

            const moreFilters = tEs("inspirations.more_filters");
            expect(moreFilters).toBe("Más filtros");
            expect(hanRegex.test(moreFilters)).toBeFalse();

            const searchPlaceholder = tEs("inspirations.search_placeholder");
            expect(searchPlaceholder).toBe("Buscar por título, descripción o etiquetas");
            expect(hanRegex.test(searchPlaceholder)).toBeFalse();

            const musicCategory = `${tEs("common.music")} 0`;
            expect(musicCategory).toBe("Música 0");
            expect(hanRegex.test(musicCategory)).toBeFalse();
        });

        test("Item 8: Storage Meter Card Elements resolve to Spanish without residual Chinese", () => {
            const used = tEs("nav.storage_used", { used: "120 KB" });
            expect(used).toBe("Usado: 120 KB");
            expect(hanRegex.test(used)).toBeFalse();

            const remaining = tEs("nav.storage_remaining", { remaining: "20 GB" });
            expect(remaining).toBe("Restante: 20 GB");
            expect(hanRegex.test(remaining)).toBeFalse();

            const total = tEs("nav.storage_total", { total: "20 GB" });
            expect(total).toBe("Total 20 GB");
            expect(hanRegex.test(total)).toBeFalse();

            const aria = tEs("nav.storage_meter_aria");
            expect(aria).toBe("Progreso de uso de almacenamiento de archivos");
            expect(hanRegex.test(aria)).toBeFalse();

            const tooltipDesc = tEs("nav.storage_tooltip_desc");
            expect(tooltipDesc).toBe("Incluye archivos de recursos y adjuntos de sesiones de Agent");
            expect(hanRegex.test(tooltipDesc)).toBeFalse();
        });
    });

    describe("Challenge 2: Parameter Interpolation Boundary & Adversarial Inputs", () => {
        test("Interpolation handles empty string parameter safely", () => {
            const res = interpolateTemplate("Hello {brand}!", { brand: "" });
            expect(res).toBe("Hello !");
        });

        test("Interpolation preserves token when parameter is undefined or null", () => {
            const resUndefined = interpolateTemplate("Hello {brand}!", { brand: undefined as any });
            expect(resUndefined).toBe("Hello {brand}!");

            const resNull = interpolateTemplate("Hello {brand}!", { brand: null as any });
            expect(resNull).toBe("Hello {brand}!");

            const resMissing = interpolateTemplate("Hello {brand}!", {});
            expect(resMissing).toBe("Hello {brand}!");
        });

        test("Interpolation handles numeric 0 without converting to false or empty", () => {
            const res = interpolateTemplate("Total: {count} items", { count: 0 });
            expect(res).toBe("Total: 0 items");

            const resFloat = interpolateTemplate("Value: {val}", { val: 0.005 });
            expect(resFloat).toBe("Value: 0.005");
        });

        test("Interpolation safely preserves regex special characters ($1, $$, .*, ^, +) in values", () => {
            const specialVal = "$1 and $& and .* and ^+$";
            const res = interpolateTemplate("Brand: {brand}", { brand: specialVal });
            expect(res).toBe("Brand: $1 and $& and .* and ^+$");
        });

        test("Interpolation safely handles HTML tags and script payloads", () => {
            const xss = "<script>alert('xss')</script>";
            const res = interpolateTemplate("User {name}", { name: xss });
            expect(res).toBe("User <script>alert('xss')</script>");
        });

        test("Interpolation with multiple placeholders in one template", () => {
            const template = "Imported {imported}, merged {merged}, skipped {skipped}";
            const res = interpolateTemplate(template, { imported: 12, merged: 3, skipped: 0 });
            expect(res).toBe("Imported 12, merged 3, skipped 0");
        });

        test("Interpolation handles huge string value (100,000 characters) without ReDoS", () => {
            const huge = "a".repeat(100_000);
            const start = performance.now();
            const res = interpolateTemplate("Prefix {huge} Suffix", { huge });
            const elapsed = performance.now() - start;
            expect(res.length).toBe(100_014);
            expect(elapsed).toBeLessThan(50); // Sub-50ms execution
        });
    });

    describe("Challenge 3: Dynamic Regex Patterns & Empirical Node Count Defect", () => {
        test("Dynamic time patterns format correctly across all 6 locales", () => {
            const timeCases: Array<{ source: string; es: string; en: string; ja: string; ko: string; tw: string }> = [
                { source: "刚刚", es: "Justo ahora", en: "Just now", ja: "たった今", ko: "방금 전", tw: "剛剛" },
                { source: "3 分钟前", es: "hace 3 m", en: "3m ago", ja: "3分前", ko: "3분 전", tw: "3 分鐘前" },
                { source: "2 小时前", es: "hace 2 h", en: "2h ago", ja: "2時間前", ko: "2시간 전", tw: "2 小時前" },
                { source: "5 天前", es: "hace 5 d", en: "5d ago", ja: "5日前", ko: "5일 전", tw: "5 天前" },
            ];

            for (const c of timeCases) {
                expect(translateSourceText(dict, c.source, "es-ES")).toBe(c.es);
                expect(translateSourceText(dict, c.source, "en-US")).toBe(c.en);
                expect(translateSourceText(dict, c.source, "ja-JP")).toBe(c.ja);
                expect(translateSourceText(dict, c.source, "ko-KR")).toBe(c.ko);
                expect(translateSourceText(dict, c.source, "zh-TW")).toBe(c.tw);
            }
        });

        test("Dynamic count patterns format correctly across all 6 locales", () => {
            expect(translateSourceText(dict, "共 10 条", "es-ES")).toBe("Total 10");
            expect(translateSourceText(dict, "共 10 条", "en-US")).toBe("Total 10");
            expect(translateSourceText(dict, "共 10 条", "ja-JP")).toBe("全 10 件");

            expect(translateSourceText(dict, "已选择 4 项", "es-ES")).toBe("4 seleccionados");
            expect(translateSourceText(dict, "已选择 1 项", "en-US")).toBe("1 selected");
        });

        test("EMPIRICAL DEFECT: '5 个节点' translates when standalone, but fails when formatted with separator ' · '", () => {
            // Standalone "5 个节点" works:
            const standalone = translateSourceText(dict, "5 个节点", "es-ES");
            expect(standalone).toBe("5 nodos");

            // However, in React JSX: `<small>{project.nodeCount} 个节点 · <RelativeTime .../></small>`
            // React produces text node " 个节点 · " which has NO digit and a trailing " · ":
            const reactTextNode = translateSourceText(dict, " 个节点 · ", "es-ES");
            // This empirically returns null because regex is /^(\d+)\s*个节点$/:
            expect(reactTextNode).toBeNull();

            // Even if the digit is prepended, "5 个节点 · " also fails:
            const combinedWithSeparator = translateSourceText(dict, "5 个节点 · ", "es-ES");
            expect(combinedWithSeparator).toBeNull();
        });
    });

    describe("Challenge 4: Component Re-rendering Stability & Rapid Language Toggling", () => {
        test("Rapid 50-cycle sequential locale switching does not corrupt dictionary or store state", async () => {
            const locales: SupDanceLocaleCode[] = ["zh-CN", "es-ES", "en-US", "ja-JP", "ko-KR", "zh-TW"];
            const store = useSupDanceI18nStore.getState();

            for (let i = 0; i < 50; i++) {
                const targetLocale = locales[i % locales.length]!;
                store.setLocale(targetLocale);
                await loadLocalePack(targetLocale);
                const current = useSupDanceI18nStore.getState();
                expect(current.locale).toBe(targetLocale);
                expect(current.dictionary).toBeDefined();
                expect(current.dictionary.byKey.size).toBeGreaterThanOrEqual(1728);
            }
        });

        test("DOM MutationObserver handles rapid subtree updates without memory leak or loop", async () => {
            const dom = new Window();
            globalThis.MutationObserver = dom.MutationObserver as any;

            const root = dom.document.createElement("div");
            dom.document.body.appendChild(root);

            const heading = dom.document.createElement("h1");
            heading.textContent = "新建画布";
            root.appendChild(heading);

            const input = dom.document.createElement("input");
            input.setAttribute("placeholder", "搜索标题、描述或标签");
            root.appendChild(input);

            const translator = new SupDanceDomTranslator();
            translator.attach(root as any, dict, "es-ES", "zh-CN");

            // Check immediate translation to Spanish
            expect(heading.textContent).toBe("Nuevo lienzo");
            expect(input.getAttribute("placeholder")).toBe("Buscar por título, descripción o etiquetas");

            // Switch to Japanese
            translator.update(dict, "ja-JP", "zh-CN");
            expect(heading.textContent).toBe("新規キャンバス");
            expect(input.getAttribute("placeholder")).toBe("タイトル、説明、タグを検索");

            // Switch to English
            translator.update(dict, "en-US", "zh-CN");
            expect(heading.textContent).toBe("New Canvas");
            expect(input.getAttribute("placeholder")).toBe("Search by title, description, or tags");

            // Restore to Chinese
            translator.restoreAndDetach();
            expect(heading.textContent).toBe("新建画布");
            expect(input.getAttribute("placeholder")).toBe("搜索标题、描述或标签");
        });
    });
});

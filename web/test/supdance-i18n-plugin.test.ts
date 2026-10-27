import { describe, expect, test } from "bun:test";
import { listRegisteredPlugins } from "@/lib/plugins/plugin-registry";
import { validateSupDancePluginManifest } from "@/supdance/adapters/compatibility";
import {
    BUILTIN_I18N_ENTRIES,
    compileI18nDictionary,
    DEFAULT_SUPDANCE_LANGUAGES,
    getAntdLocaleForCode,
    mergeI18nEntries,
    SUPDANCE_I18N_PLUGIN_ID,
    supdanceI18nPlugin,
    SUPPORTED_LOCALE_CODES,
    SupDanceDomTranslator,
    translateByKey,
    translateSourceText,
    useSupDanceI18nStore,
} from "@/supdance/plugins/i18n";

type MockTextNode = {
    nodeType: 3;
    nodeValue: string;
    parentElement: MockElementNode | null;
};

type MockElementNode = {
    nodeType: 1;
    tagName: string;
    parentElement: MockElementNode | null;
    childNodes: Array<MockElementNode | MockTextNode>;
    attrs: Map<string, string>;
    classList: { contains: (cls: string) => boolean };
    getAttribute: (name: string) => string | null;
    setAttribute: (name: string, value: string) => void;
    hasAttribute: (name: string) => boolean;
};

function createMockElement(tagName: string, attrs: Record<string, string> = {}, children: Array<MockElementNode | MockTextNode> = []): MockElementNode {
    const attrMap = new Map<string, string>(Object.entries(attrs));
    const el: MockElementNode = {
        nodeType: 1,
        tagName: tagName.toUpperCase(),
        parentElement: null,
        childNodes: children,
        attrs: attrMap,
        classList: {
            contains: (cls: string) => (attrMap.get("class") ?? "").split(/\s+/).includes(cls),
        },
        getAttribute: (name: string) => attrMap.get(name) ?? null,
        setAttribute: (name: string, value: string) => {
            attrMap.set(name, value);
        },
        hasAttribute: (name: string) => attrMap.has(name),
    };
    for (const child of children) {
        child.parentElement = el;
    }
    return el;
}

function createMockText(text: string): MockTextNode {
    return {
        nodeType: 3,
        nodeValue: text,
        parentElement: null,
    };
}

describe("supdance-i18n plugin architecture and engine", () => {
    test("registers supdance-i18n as a compliant v2 plugin", () => {
        const report = validateSupDancePluginManifest(supdanceI18nPlugin.manifest);
        expect(report.compatible).toBe(true);
        expect(report.errors).toEqual([]);

        const registered = listRegisteredPlugins().find((p) => p.manifest.id === SUPDANCE_I18N_PLUGIN_ID);
        expect(registered).toBeDefined();
        expect(registered?.manifest.name).toBe("站点多语言与实时词条中心");
    });

    test("covers all 6 required languages with complete built-in translations", () => {
        expect(SUPPORTED_LOCALE_CODES).toEqual(["zh-CN", "en-US", "zh-TW", "ja-JP", "ko-KR", "es-ES"]);
        expect(DEFAULT_SUPDANCE_LANGUAGES).toHaveLength(6);
        expect(BUILTIN_I18N_ENTRIES.length).toBeGreaterThanOrEqual(80);

        for (const entry of BUILTIN_I18N_ENTRIES) {
            expect(entry.key).toBeTruthy();
            expect(entry.sourceText).toBeTruthy();
            for (const code of SUPPORTED_LOCALE_CODES) {
                expect(entry.translations[code]?.trim().length).toBeGreaterThan(0);
            }
        }
    });

    test("translates by key, source text, ICU interpolation, and dynamic patterns across 6 languages", () => {
        const entries = mergeI18nEntries({});
        const dict = compileI18nDictionary(entries);

        expect(translateByKey(dict, "nav.projects", "en-US", "zh-CN")).toBe("Short Drama");
        expect(translateByKey(dict, "nav.projects", "zh-TW", "zh-CN")).toBe("短劇製作");
        expect(translateByKey(dict, "nav.projects", "ja-JP", "zh-CN")).toBe("ショートドラマ制作");
        expect(translateByKey(dict, "nav.projects", "ko-KR", "zh-CN")).toBe("숏폼 드라마 제작");
        expect(translateByKey(dict, "nav.projects", "es-ES", "zh-CN")).toBe("Producción de Microdramas");

        // ICU parameter interpolation
        expect(translateByKey(dict, "common.totalCount", "en-US", "zh-CN", { count: 42 })).toBe("Total 42");
        expect(translateByKey(dict, "common.totalCount", "ja-JP", "zh-CN", { count: 42 })).toBe("全 42 件");

        // Source text exact + whitespace-preserving match
        expect(translateSourceText(dict, "  自由画布  ", "en-US", "zh-CN")).toBe("  Infinite Canvas  ");
        expect(translateSourceText(dict, "自由画布", "ko-KR", "zh-CN")).toBe("무한 캔버스");

        // Dynamic regex pattern match
        expect(translateSourceText(dict, "打开积分中心，可用 1,280 积分", "en-US", "zh-CN")).toBe("Open Credits Center, 1,280 available");
        expect(translateSourceText(dict, "已选择 5 项", "es-ES", "zh-CN")).toBe("5 seleccionados");
    });

    test("supports hot-adding custom entries and overriding built-in entries at runtime", () => {
        const store = useSupDanceI18nStore.getState();

        store.upsertLocalEntries([
            {
                key: "custom.specialBanner",
                namespace: "custom",
                sourceText: "限时免费体验",
                translations: {
                    "zh-CN": "限时免费体验",
                    "en-US": "Limited-Time Free Trial",
                    "zh-TW": "限時免費體驗",
                    "ja-JP": "期間限定無料体験",
                    "ko-KR": "기간 한정 무료 체험",
                    "es-ES": "Prueba gratuita por tiempo limitado",
                },
                origin: "custom",
            },
            {
                key: "nav.create",
                namespace: "nav",
                sourceText: "创作",
                translations: {
                    "zh-CN": "创作",
                    "en-US": "AI Studio",
                    "zh-TW": "創作工作坊",
                    "ja-JP": "AIスタジオ",
                    "ko-KR": "AI 스튜디오",
                    "es-ES": "Estudio IA",
                },
                origin: "modified",
            },
        ]);

        const updatedDict = useSupDanceI18nStore.getState().dictionary;
        expect(translateSourceText(updatedDict, "限时免费体验", "en-US", "zh-CN")).toBe("Limited-Time Free Trial");
        expect(translateSourceText(updatedDict, "限时免费体验", "ja-JP", "zh-CN")).toBe("期間限定無料体験");
        expect(translateByKey(updatedDict, "nav.create", "en-US", "zh-CN")).toBe("AI Studio");

        // Reset override and remove custom entry
        store.removeLocalEntry("custom.specialBanner");
        store.removeLocalEntry("nav.create");

        const restoredDict = useSupDanceI18nStore.getState().dictionary;
        expect(translateByKey(restoredDict, "nav.create", "en-US", "zh-CN")).toBe("Create");
    });

    test("DOM translator translates text and attributes and losslessly restores on disable", () => {
        const navCreateText = createMockText("创作");
        const navProjectsText = createMockText("短剧制作");
        const codeText = createMockText("创作");
        const ignoredText = createMockText("创作");

        const searchInput = createMockElement("input", {
            placeholder: "搜索插件名称、ID 或作者",
            "aria-label": "搜索插件",
        });
        const codeBlock = createMockElement("code", {}, [codeText]);
        const ignoredDiv = createMockElement("div", { "data-i18n-ignore": "true" }, [createMockElement("span", {}, [ignoredText])]);
        const root = createMockElement("div", { id: "root" }, [createMockElement("a", {}, [navCreateText]), createMockElement("a", {}, [navProjectsText]), searchInput, codeBlock, ignoredDiv]);

        const dict = compileI18nDictionary(mergeI18nEntries({}));
        const translator = new SupDanceDomTranslator();

        translator.attach(root as unknown as HTMLElement, dict, "en-US", "zh-CN", {
            translateAdminPages: true,
        });

        expect(navCreateText.nodeValue).toBe("Create");
        expect(navProjectsText.nodeValue).toBe("Short Drama");
        expect(searchInput.getAttribute("placeholder")).toBe("Search plugin name, ID or author");
        expect(searchInput.getAttribute("aria-label")).toBe("Search plugins");

        // Code and data-i18n-ignore must remain untouched
        expect(codeText.nodeValue).toBe("创作");
        expect(ignoredText.nodeValue).toBe("创作");

        // Switch to Japanese
        translator.update(dict, "ja-JP", "zh-CN", { translateAdminPages: true });
        expect(navCreateText.nodeValue).toBe("制作");
        expect(navProjectsText.nodeValue).toBe("ショートドラマ制作");

        // Switch to Korean
        translator.update(dict, "ko-KR", "zh-CN", { translateAdminPages: true });
        expect(navCreateText.nodeValue).toBe("창작");
        expect(navProjectsText.nodeValue).toBe("숏폼 드라마 제작");

        // Switch to Spanish
        translator.update(dict, "es-ES", "zh-CN", { translateAdminPages: true });
        expect(navCreateText.nodeValue).toBe("Crear");
        expect(navProjectsText.nodeValue).toBe("Producción de Microdramas");

        // Disable plugin -> lossless restore to original Simplified Chinese
        translator.restoreAndDetach();
        expect(navCreateText.nodeValue).toBe("创作");
        expect(navProjectsText.nodeValue).toBe("短剧制作");
        expect(searchInput.getAttribute("placeholder")).toBe("搜索插件名称、ID 或作者");
        expect(searchInput.getAttribute("aria-label")).toBe("搜索插件");
    });

    test("maps all 6 locales to valid Ant Design locale objects", () => {
        for (const code of SUPPORTED_LOCALE_CODES) {
            const antdLocale = getAntdLocaleForCode(code);
            expect(antdLocale).toBeDefined();
            expect(typeof antdLocale.locale).toBe("string");
        }
    });
});

import { afterAll, expect, test } from "bun:test";
import { Window } from "happy-dom";

const dom = new Window({ url: "http://localhost/" });
for (const [key, value] of Object.entries({
    window: dom,
    document: dom.document,
    navigator: dom.navigator,
    localStorage: dom.localStorage,
    HTMLElement: dom.HTMLElement,
    Element: dom.Element,
    Node: dom.Node,
    Event: dom.Event,
    IS_REACT_ACT_ENVIRONMENT: true,
})) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { useTranslation } = await import("react-i18next");
const { useSupDanceI18nStore, useI18n } = await import("../../src/supdance/plugins/i18n/store");
const { useLocaleStore } = await import("../../src/stores/use-locale-store");
const { SUPPORTED_LOCALES } = await import("../../src/i18n/locales");
const { i18n } = await import("../../src/i18n");
const { MANAGED_TRANSLATION_TARGETS } = await import("../../src/supdance/plugins/i18n/managed-catalog");
const creationEntry = useSupDanceI18nStore.getState().entries.find((entry) => entry.namespace === "creationUI" && !entry.sourceText.includes("{"))!;
const modelEntry = useSupDanceI18nStore.getState().entries.find((entry) => entry.namespace === "modelUI")!;
const creationTarget = MANAGED_TRANSLATION_TARGETS.get(creationEntry.key)!;
const modelTarget = MANAGED_TRANSLATION_TARGETS.get(modelEntry.key)!;

function Fixture() {
    const { t } = useTranslation();
    const extension = useI18n();
    return (
        <>
            <span data-core>{t("nav.tools.canvas")}</span>
            <span data-extension>{extension.t("custom.native_test", { name: "Canvas" })}</span>
            <span data-source>{extension.t("你好 {name}", { name: "Canvas" })}</span>
            <span data-creation>{i18n.t(creationTarget.key, { ns: creationTarget.namespace, keySeparator: false })}</span>
            <span data-model>{i18n.t(modelTarget.key, { ns: modelTarget.namespace, keySeparator: false })}</span>
            <input data-prompt defaultValue="用户写的提示词：保留原文" />
        </>
    );
}

afterAll(async () => dom.happyDOM.close());

test("native locale controls all six languages independently of legacy settings and entries", async () => {
    const state = useSupDanceI18nStore.getState();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const nativeLabels = Object.fromEntries(SUPPORTED_LOCALES.map(({ code }) => [code, i18n.getFixedT(code)("nav.tools.canvas")]));
    const entry = {
        ...state.entries[0]!,
        key: "custom.native_test",
        sourceText: "你好 {name}",
        translations: { "zh-CN": "你好 {name}", "en-US": "Hello {name}", "ja-JP": "こんにちは {name}", "ko-KR": "안녕 {name}", "es-ES": "Hola {name}", "zh-TW": "你好 {name}" },
    };
    try {
        useSupDanceI18nStore.getState().upsertLocalEntries([entry, { ...entry, key: "nav.tools.canvas", sourceText: nativeLabels["zh-CN"], translations: { ...entry.translations, "en-US": "Must never override native canvas" } }]);
        await act(async () => root.render(<Fixture />));
        for (const { code } of SUPPORTED_LOCALES) {
            await act(async () => useLocaleStore.getState().setLocale(code));
            expect(i18n.language).toBe(code);
            expect(host.querySelector("[data-core]")?.textContent).toBe(nativeLabels[code]);
            expect(useLocaleStore.getState().locale).toBe(code);
        }
        await act(async () => useLocaleStore.getState().setLocale("en-US"));
        expect(host.querySelector("[data-extension]")?.textContent).toBe("Hello Canvas");
        expect(host.querySelector("[data-source]")?.textContent).toBe("Hello Canvas");
        await act(async () => useSupDanceI18nStore.setState({ pluginEnabled: false, locale: "zh-CN" }));
        expect(i18n.language).toBe("en-US");
        expect(host.querySelector("[data-core]")?.textContent).toBe(nativeLabels["en-US"]);
        expect(host.querySelector("[data-extension]")?.textContent).toBe("Hello Canvas");
        await act(async () => useLocaleStore.getState().setLocale("fr-FR"));
        await act(async () => useSupDanceI18nStore.getState().applyBundle({ pluginId: "supdance-i18n", pluginEnabled: true, settings: state.settings, customEntries: {}, revision: "legacy-update" }));
        expect(i18n.language).toBe("fr-FR");
        expect(host.querySelector("[data-core]")?.textContent).toBe(nativeLabels["fr-FR"]);
        expect(i18n.getResource("en-US", "translation", "nav.tools.canvas")).toBe(nativeLabels["en-US"]);
    } finally {
        await act(async () => root.unmount());
        host.remove();
        useSupDanceI18nStore.setState(state);
    }
});

test("published management entries update the mounted native UI in all eight languages and removal restores builtin text", async () => {
    const state = useSupDanceI18nStore.getState();
    const originalLocale = useLocaleStore.getState().locale;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const key = "upstream.nav.tools.canvas";
    const builtin = state.entries.find((entry) => entry.key === key)!;
    expect(builtin).toBeDefined();
    const translations = Object.fromEntries(SUPPORTED_LOCALES.map(({ code }) => [code, `Published ${code}`]));
    try {
        await act(async () => root.render(<Fixture />));
        const input = host.querySelector("[data-prompt]") as HTMLInputElement;
        input.value = "用户编辑后的提示词";
        const overrides = Object.fromEntries([builtin, creationEntry, modelEntry].map((entry) => [entry.key, { ...entry, origin: "modified" as const, translations }]));
        await act(async () => useSupDanceI18nStore.getState().applyBundle({ pluginId: "supdance-i18n", pluginEnabled: true, settings: state.settings, customEntries: overrides, revision: "published-test" }));
        for (const { code } of SUPPORTED_LOCALES) {
            await act(async () => useLocaleStore.getState().setLocale(code));
            expect(host.querySelector("[data-core]")?.textContent).toBe(`Published ${code}`);
            expect(host.querySelector("[data-creation]")?.textContent).toBe(`Published ${code}`);
            expect(host.querySelector("[data-model]")?.textContent).toBe(`Published ${code}`);
            expect(useSupDanceI18nStore.getState().locale).toBe(code);
            expect(host.querySelector("[data-prompt]")).toBe(input);
            expect(input.value).toBe("用户编辑后的提示词");
        }
        await act(async () => useSupDanceI18nStore.getState().applyBundle({ pluginId: "supdance-i18n", pluginEnabled: true, settings: state.settings, customEntries: {}, revision: "removed-test" }));
        expect(host.querySelector("[data-core]")?.textContent).toBe(builtin.translations[useLocaleStore.getState().locale]);
        expect(host.querySelector("[data-creation]")?.textContent).toBe(creationEntry.translations[useLocaleStore.getState().locale]);
        expect(host.querySelector("[data-model]")?.textContent).toBe(modelEntry.translations[useLocaleStore.getState().locale]);
    } finally {
        await act(async () => root.unmount());
        host.remove();
        useSupDanceI18nStore.setState(state);
        useLocaleStore.getState().setLocale(originalLocale);
    }
});

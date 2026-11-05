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

function Fixture() {
    const { t } = useTranslation();
    const extension = useI18n();
    return (
        <>
            <span data-core>{t("nav.tools.canvas")}</span>
            <span data-extension>{extension.t("custom.native_test", { name: "Canvas" })}</span>
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
        await act(async () => useSupDanceI18nStore.setState({ pluginEnabled: false, locale: "zh-CN" }));
        expect(i18n.language).toBe("en-US");
        expect(host.querySelector("[data-core]")?.textContent).toBe(nativeLabels["en-US"]);
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

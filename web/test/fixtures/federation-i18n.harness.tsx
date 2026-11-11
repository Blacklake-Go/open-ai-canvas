import { test, expect, afterAll } from "bun:test";
import { Window } from "happy-dom";
const dom = new Window({ url: "https://www.supdance.com/connect-one" });
for (const [key, value] of Object.entries({
    window: dom,
    document: dom.document,
    navigator: dom.navigator,
    localStorage: dom.localStorage,
    HTMLElement: dom.HTMLElement,
    HTMLInputElement: dom.HTMLInputElement,
    HTMLBodyElement: dom.HTMLBodyElement,
    HTMLHtmlElement: dom.HTMLHtmlElement,
    SVGElement: dom.SVGElement,
    ShadowRoot: dom.ShadowRoot,
    MutationObserver: dom.MutationObserver,
    ResizeObserver: dom.ResizeObserver,
    getComputedStyle: dom.getComputedStyle.bind(dom),
    requestAnimationFrame: dom.requestAnimationFrame.bind(dom),
    cancelAnimationFrame: dom.cancelAnimationFrame.bind(dom),
    Element: dom.Element,
    Node: dom.Node,
    Event: dom.Event,
    IS_REACT_ACT_ENVIRONMENT: true,
}))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { default: ConnectOnePage } = await import("../../src/supdance/federation/connect-one");
const { useLocaleStore } = await import("../../src/stores/use-locale-store");
const { useSupDanceI18nStore } = await import("../../src/supdance/plugins/i18n/store");
const { SUPPORTED_LOCALES } = await import("../../src/i18n/locales");
const { FEDERATION_I18N_ENTRIES } = await import("../../src/supdance/plugins/i18n/locales/federation");
afterAll(() => dom.happyDOM.close());
test("identity UI renders six configured languages, unsupported-language fallback and a real admin override", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const original = useSupDanceI18nStore.getState();
    try {
        await act(async () => root.render(<ConnectOnePage />));
        for (const { code } of SUPPORTED_LOCALES) {
            await act(async () => useLocaleStore.getState().setLocale(code));
            const entry = FEDERATION_I18N_ENTRIES.find((item) => item.key === "federation.title")!;
            const expected = (entry.translations as Record<string, string>)[code] || entry.sourceText;
            expect(host.textContent).toContain(expected);
            expect(host.textContent).not.toContain("federation.");
        }
        const entry = FEDERATION_I18N_ENTRIES.find((item) => item.key === "federation.title")!;
        await act(async () => {
            useSupDanceI18nStore.getState().upsertLocalEntries([{ ...entry, translations: { ...entry.translations, "en-US": "Verified administrator wording" } }]);
            useLocaleStore.getState().setLocale("en-US");
        });
        expect(host.textContent).toContain("Verified administrator wording");
    } finally {
        await act(async () => root.unmount());
        host.remove();
        useSupDanceI18nStore.setState(original);
    }
});

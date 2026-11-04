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
const { useSupDanceUpstreamI18n } = await import("../../src/supdance/adapters/upstream-i18n");
const { useSupDanceI18nStore } = await import("../../src/supdance/plugins/i18n/store");
const { compileI18nDictionary } = await import("../../src/supdance/plugins/i18n/engine/translator");
const { i18n } = await import("../../src/i18n");

function Fixture() {
    useSupDanceUpstreamI18n();
    const { t } = useTranslation();
    return <span>{t("nav.tools.canvas")}</span>;
}

afterAll(async () => dom.happyDOM.close());

test("published source translations override upstream text for English and Spanish, then disable restores Chinese", async () => {
    const source = i18n.getFixedT("zh-CN")("nav.tools.canvas", { postProcess: [] });
    const state = useSupDanceI18nStore.getState();
    const entry = {
        ...state.entries[0],
        key: "custom.upstream_canvas",
        sourceText: source,
        translations: { "zh-CN": source, "en-US": "Published canvas", "es-ES": "Lienzo publicado", "zh-TW": "已發佈畫布", "ja-JP": "公開キャンバス", "ko-KR": "게시된 캔버스" },
    };
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
        useSupDanceI18nStore.setState({ pluginEnabled: true, locale: "en-US", customEntries: { [entry.key]: entry }, dictionary: compileI18nDictionary([entry]) });
        await act(async () => root.render(<Fixture />));
        expect(host.textContent).toBe("Published canvas");
        await act(async () => useSupDanceI18nStore.setState({ locale: "es-ES" }));
        expect(host.textContent).toBe("Lienzo publicado");
        await act(async () => useSupDanceI18nStore.setState({ locale: "zh-TW" }));
        expect(host.textContent).toBe("已發佈畫布");
        await act(async () => useSupDanceI18nStore.setState({ pluginEnabled: false }));
        expect(host.textContent).toBe(source);
        expect(i18n.language).toBe("zh-CN");
    } finally {
        await act(async () => root.unmount());
        host.remove();
    }
});

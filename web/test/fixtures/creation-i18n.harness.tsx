import { afterAll, expect, test } from "bun:test";
import { Window } from "happy-dom";

const dom = new Window({ url: "http://localhost/projects/new" });
for (const [key, value] of Object.entries({
    window: dom,
    document: dom.document,
    navigator: dom.navigator,
    localStorage: dom.localStorage,
    HTMLElement: dom.HTMLElement,
    Element: dom.Element,
    Node: dom.Node,
    SVGElement: dom.SVGElement,
    ShadowRoot: dom.ShadowRoot,
    MutationObserver: dom.MutationObserver,
    getComputedStyle: dom.getComputedStyle.bind(dom),
    ResizeObserver: dom.ResizeObserver,
    IS_REACT_ACT_ENVIRONMENT: true,
}))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { DirectionEditor } = await import("../../src/pages/ecommerce/direction-cards");
const { CommerceFactReview } = await import("../../src/pages/ecommerce/fact-review");
const { ReferenceUploader } = await import("../../src/pages/ecommerce/reference-uploader");
const { EpisodeGroupField } = await import("../../src/pages/projects/drama-shared");
const { creationText, creationSource, creationOptions, creationLabel } = await import("../../src/supdance/plugins/i18n/creation-text");
const { i18n } = await import("../../src/i18n");
const { SUPPORTED_LOCALES } = await import("../../src/i18n/locales");
const { CREATION_UI_SOURCES } = await import("../../src/supdance/plugins/i18n/locales/creation-sources");
const { useLocaleStore } = await import("../../src/stores/use-locale-store");
const { useSupDanceI18nStore } = await import("../../src/supdance/plugins/i18n/store");
const localeCodes = SUPPORTED_LOCALES.map(({ code }) => code);
useSupDanceI18nStore.setState({ pluginEnabled: false });
useLocaleStore.getState().setLocale("zh-CN");

afterAll(async () => dom.happyDOM.close());

test("native six languages update real controls and preserve drafts with the legacy translator disabled", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    let changes = 0,
        saves = 0,
        excludes = 0;
    try {
        await act(async () =>
            root.render(
                <>
                    <DirectionEditor index={0} value={{ name: "删除", description: "商品主图" }} className="editor" onChange={() => changes++} onCancel={() => {}} onSave={() => saves++} />
                    <EpisodeGroupField value={2} onChange={() => changes++} chapterCount={10} />
                    <CommerceFactReview facts={["删除", "商品主图"]} onApply={() => {}} onExclude={() => excludes++} />
                </>,
            ),
        );
        const originalName = host.querySelector(".editor input");
        const originalDescription = host.querySelector(".editor textarea");
        const originalChapterInput = host.querySelector(".drama-episode-group input");
        const attributes = new Set<string>();
        for (const locale of [...localeCodes, ...localeCodes].reverse()) {
            await act(async () => useLocaleStore.getState().setLocale(locale));
            expect(i18n.language).toBe(locale);
            expect(host.querySelector(".editor input")).toBe(originalName);
            expect(host.querySelector(".editor textarea")).toBe(originalDescription);
            expect((originalName as HTMLInputElement).value).toBe("删除");
            expect((originalDescription as HTMLTextAreaElement).value).toBe("商品主图");
            expect(host.querySelector(".drama-episode-group input")).toBe(originalChapterInput);
            expect((originalChapterInput as HTMLInputElement).value).toBe("2");
            expect([...host.querySelectorAll(".ecommerce-fact-review li")].map((item) => item.textContent)).toEqual(["删除", "商品主图"]);
            attributes.add(originalName!.getAttribute("aria-label")!);
            expect(host.textContent).not.toContain("creation.");
        }
        expect(attributes.size).toBe(localeCodes.length);
        expect(changes).toBe(0);
        expect(saves).toBe(0);
        expect(excludes).toBe(0);
        await act(async () => (host.querySelectorAll(".editor button")[1] as HTMLButtonElement).click());
        expect(saves).toBe(1);
        await act(async () => useLocaleStore.getState().setLocale("zh-CN"));
        expect(originalName!.getAttribute("aria-label")).toContain("风格名称");
    } finally {
        await act(async () => root.unmount());
        host.remove();
    }
});

test("option translation changes only presentation and interpolation never translates names", () => {
    useLocaleStore.getState().setLocale("en-US");
    const options = [{ value: "zh-CN", label: "小说原文", instruction: "商品主图" }];
    const result = creationOptions(options);
    expect(result[0].label).toBe("Original novel");
    expect(result[0].value).toBe("zh-CN");
    expect(result[0].instruction).toBe("商品主图");
    expect(options[0].label).toBe("小说原文");
    const entry = Object.entries(CREATION_UI_SOURCES).find(([, source]) => source === "打开项目：{value1}")!;
    expect(creationText(entry[0], { value1: "删除" })).toContain("删除");
});

test("explicit creation templates preserve unknown labels and canonical service messages", () => {
    useLocaleStore.getState().setLocale("en-US");
    expect(creationLabel("1个节点哦")).toBe("1个节点哦");
    const notice = "已移除 3 行网址、求票等平台插入语";
    expect(creationLabel(notice)).not.toBe(notice);
    expect(creationLabel(notice)).toContain("3");
    const failure = creationSource("creation.54c4980c457dff27", { value1: "provider detail" });
    expect(failure.startsWith("分析结果读取失败")).toBe(true);
});

test("an existing upload error follows language changes without repeating the upload", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    let transfers = 0;
    try {
        useLocaleStore.getState().setLocale("en-US");
        await act(async () =>
            root.render(
                <ReferenceUploader
                    references={[]}
                    uploading={false}
                    onTransfer={async () => {
                        transfers++;
                        throw null;
                    }}
                    onUpload={() => {}}
                    onChange={() => {}}
                />,
            ),
        );
        const drop = new dom.Event("drop", { bubbles: true, cancelable: true });
        Object.defineProperty(drop, "dataTransfer", { value: { files: [new File(["image"], "draft.png", { type: "image/png" })], items: [], types: ["Files"], getData: () => "" } });
        await act(async () => host.querySelector("section")!.dispatchEvent(drop as unknown as Event));
        for (const locale of localeCodes) {
            await act(async () => useLocaleStore.getState().setLocale(locale));
            expect(host.querySelector(".commerce-reference-error")?.textContent).toBe(creationText("creation.3e54faa0442c241e"));
        }
        expect(transfers).toBe(1);
    } finally {
        await act(async () => root.unmount());
        host.remove();
    }
});

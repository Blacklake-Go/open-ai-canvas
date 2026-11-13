import { afterAll, expect, spyOn, test } from "bun:test";
import { Window } from "happy-dom";
const dom = new Window({ url: "http://localhost/admin/plugins/supdance-i18n/entries" });
for (const name of [
    "window",
    "document",
    "navigator",
    "localStorage",
    "HTMLElement",
    "HTMLAnchorElement",
    "HTMLInputElement",
    "SVGElement",
    "Element",
    "Node",
    "Event",
    "MouseEvent",
    "getComputedStyle",
    "ShadowRoot",
    "MutationObserver",
    "ResizeObserver",
]) {
    const value = name === "window" ? dom : (dom as unknown as Record<string, unknown>)[name];
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: typeof value === "function" && name === "getComputedStyle" ? value.bind(dom) : value });
}
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
Object.defineProperty(globalThis, "__APP_VERSION__", { configurable: true, value: "test" });
Object.defineProperty(globalThis, "__APP_CHANGELOG__", { configurable: true, value: "" });
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { MemoryRouter } = await import("react-router");
const { App } = await import("antd");
const { http } = await import("../../src/services/api/request");
const { useSupDanceI18nStore } = await import("../../src/supdance/plugins/i18n/store");
const { SupDanceI18nEntriesPage } = await import("../../src/supdance/plugins/i18n/admin/i18n-entries-page");

test("the real admin editor keeps its draft after a rejected server save and sends all eight translations", async () => {
    const initial = useSupDanceI18nStore.getState();
    const entry = initial.entries.find((row) => row.key === "upstream.nav.tools.canvas")!;
    const get = spyOn(http, "get").mockImplementation(async () => ({ items: [entry], total: 1, page: 1, pageSize: 20 }) as never);
    let request: { entries: typeof initial.entries } | undefined;
    const put = spyOn(http, "put").mockImplementation(async (_url, body) => {
        request = body as typeof request;
        throw new Error("test_server_rejected_translation");
    });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
        await act(async () =>
            root.render(
                <MemoryRouter>
                    <App>
                        <SupDanceI18nEntriesPage />
                    </App>
                </MemoryRouter>,
            ),
        );
        const edit = host.querySelector<HTMLButtonElement>('button[title="点击修改词条翻译"]');
        expect(edit).not.toBeNull();
        await act(async () => edit!.click());
        const drawer = document.querySelector(".ant-drawer-body");
        expect(drawer).not.toBeNull();
        const save = [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => /保存/.test(button.textContent ?? "") && button.closest(".ant-drawer"));
        expect(save).toBeDefined();
        await act(async () => save!.click());
        expect(request?.entries[0].translations["fr-FR"]).toBe(entry.translations["fr-FR"]);
        expect(request?.entries[0].translations["de-DE"]).toBe(entry.translations["de-DE"]);
        expect(Object.keys(request!.entries[0].translations)).toHaveLength(8);
        expect(document.querySelector(".ant-drawer-body")).toBe(drawer);
        expect(useSupDanceI18nStore.getState().entries).toBe(initial.entries);
        expect(useSupDanceI18nStore.getState().customEntries).toBe(initial.customEntries);
        expect(document.body.textContent).toContain("test_server_rejected_translation");
    } finally {
        await act(async () => root.unmount());
        host.remove();
        get.mockRestore();
        put.mockRestore();
        useSupDanceI18nStore.setState(initial);
    }
});
afterAll(async () => dom.happyDOM.close());

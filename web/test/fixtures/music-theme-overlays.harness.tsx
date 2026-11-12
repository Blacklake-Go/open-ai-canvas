import { afterAll, expect, test } from "bun:test";
import { Window } from "happy-dom";

const dom = new Window({ url: "http://localhost/toolbox/music" });
for (const [key, value] of Object.entries({
    window: dom,
    document: dom.document,
    navigator: dom.navigator,
    localStorage: dom.localStorage,
    HTMLElement: dom.HTMLElement,
    HTMLBodyElement: dom.HTMLBodyElement,
    HTMLHtmlElement: dom.HTMLHtmlElement,
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
const { ConfigProvider, theme } = await import("antd");
const { PromptBuilder } = await import("../../src/supdance/plugins/music-generation/components/style-templates");
const { getIsolatedAdminAntTheme } = await import("../../src/pages/admin/theme/admin-ant-theme");

for (const dark of [false, true]) {
    for (const admin of [false, true]) {
        test(`real prompt builder portals preserve ${admin ? "admin" : "studio"} scope in ${dark ? "dark" : "light"} mode`, async () => {
            document.documentElement.classList.toggle("dark", dark);
            const container = document.createElement("div");
            document.body.append(container);
            const root = createRoot(container);
            let applied = "";
            let closed = false;
            const hostTheme = admin ? getIsolatedAdminAntTheme(dark) : { algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm };
            try {
                await act(async () =>
                    root.render(
                        <ConfigProvider theme={{ ...hostTheme, token: { ...hostTheme.token, motion: false } }}>
                            <PromptBuilder
                                admin={admin}
                                onApply={(text) => {
                                    applied = text;
                                    return true;
                                }}
                                onClose={() => {
                                    closed = true;
                                }}
                            />
                        </ConfigProvider>,
                    ),
                );
                const dialog = document.querySelector('[role="dialog"]');
                expect(dialog).not.toBeNull();
                expect(container.contains(dialog)).toBe(false);
                expect(dialog?.closest(".plugin-music-generation")).not.toBeNull();
                expect(Boolean(dialog?.closest(".music-admin"))).toBe(admin);
                expect(Boolean(dialog?.closest(".admin-modal-root"))).toBe(admin);

                const input = dialog?.querySelector("input");
                expect(input).not.toBeNull();
                await act(async () => {
                    const setter = Object.getOwnPropertyDescriptor(dom.HTMLInputElement.prototype, "value")?.set;
                    setter?.call(input, "Original 用户内容 🌙");
                    input?.dispatchEvent(new dom.Event("input", { bubbles: true }));
                });
                const apply = dialog?.querySelector<HTMLButtonElement>(".music-builder-output + button");
                expect(apply).not.toBeNull();
                await act(async () => apply?.click());
                expect(applied).toContain("Original 用户内容 🌙");
                expect(closed).toBe(true);
            } finally {
                await act(async () => root.unmount());
                container.remove();
            }
        });
    }
}

afterAll(() => dom.happyDOM.abort());

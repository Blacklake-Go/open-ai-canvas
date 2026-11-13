import { afterAll, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { mkdtempSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
const dom = new Window({ url: "http://localhost/" });
for (const [key, value] of Object.entries({ window: dom, document: dom.document, navigator: dom.navigator, HTMLElement: dom.HTMLElement, Element: dom.Element, Node: dom.Node, IS_REACT_ACT_ENVIRONMENT: true }))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { i18n } = await import("../../src/i18n");
const { useLocaleStore } = await import("../../src/stores/use-locale-store");
// Load browser modules before Babel's Node stack helpers.
await import("../../src/supdance/plugins/i18n/store");
const { transformStaticUi } = await import("../../build/static-ui-i18n");
const temporary = mkdtempSync(join(tmpdir(), "i18n-compiled-ui-"));
symlinkSync(resolve(import.meta.dir, "../../node_modules"), join(temporary, "node_modules"), "dir");
test("compiled copy reacts to publication while retaining input nodes and business payloads", async () => {
    const source =
        'export function Probe({onAction,onRender}) { onRender(); return <section><h1>未保存的草稿</h1><input defaultValue="用户原文"/><button title="保存草稿" onClick={()=>onAction({prompt:"用户提示词",model:"中文枚举"})}>保存</button><div data-i18n-ignore>用户内容</div></section> }';
    const result = transformStaticUi(source, "/project/web/src/pages/compiled-probe.tsx");
    let code = result.code;
    code = code.replaceAll('"@/i18n/interface-text"', JSON.stringify(resolve(import.meta.dir, "../../src/i18n/interface-text")));
    const modulePath = join(temporary, "probe.tsx");
    writeFileSync(modulePath, code);
    const { Probe } = await import(pathToFileURL(modulePath).href);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    let renders = 0;
    let payload: unknown;
    try {
        await act(async () => root.render(<Probe onRender={() => renders++} onAction={(value: unknown) => (payload = value)} />));
        const input = host.querySelector("input")!;
        input.value = "用户编辑后的内容";
        for (const row of result.messages) i18n.addResource("en-US", "translation", row.key, `English ${row.source}`);
        await act(async () => useLocaleStore.getState().setLocale("en-US"));
        expect(host.querySelector("h1")!.textContent).toBe("English 未保存的草稿");
        const heading = result.messages.find((row) => row.source === "未保存的草稿")!;
        await act(async () => i18n.addResource("en-US", "translation", heading.key, "Published from translation management"));
        expect(host.querySelector("h1")!.textContent).toBe("Published from translation management");
        expect(renders).toBeGreaterThan(1);
        expect(host.querySelector("input")).toBe(input);
        expect(input.value).toBe("用户编辑后的内容");
        expect(host.querySelector("[data-i18n-ignore]")!.textContent).toBe("用户内容");
        await act(async () => host.querySelector("button")!.click());
        expect(payload).toEqual({ prompt: "用户提示词", model: "中文枚举" });
    } finally {
        await act(async () => root.unmount());
        host.remove();
    }
});
afterAll(async () => {
    rmSync(temporary, { recursive: true, force: true });
    await dom.happyDOM.close();
});

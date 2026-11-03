import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { SupDanceDomTranslator } from "../src/supdance/plugins/i18n/engine/dom-observer";
import { compileI18nDictionary } from "../src/supdance/plugins/i18n/engine/translator";
import { loadAllLocalePacks, mergeI18nEntries } from "../src/supdance/plugins/i18n/locales";

test("separate mutation deliveries in one frame all translate; alt and explicit keys restore", async () => {
    const dom = new Window();
    const names = ["window", "document", "MutationObserver", "requestAnimationFrame", "cancelAnimationFrame"];
    const originals = names.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
    const pending = new Map<number, FrameRequestCallback>();
    let sequence = 0;
    const values = [
        dom,
        dom.document,
        dom.MutationObserver,
        (cb: FrameRequestCallback) => {
            pending.set(++sequence, cb);
            return sequence;
        },
        (id: number) => pending.delete(id),
    ];
    names.forEach((name, i) => Object.defineProperty(globalThis, name, { configurable: true, value: values[i] }));
    const translator = new SupDanceDomTranslator();
    try {
        await loadAllLocalePacks();
        const dict = compileI18nDictionary(mergeI18nEntries());
        dom.document.body.innerHTML = '<span data-i18n-key="common.save">不同原文</span><img alt="保存"><div data-i18n-user-content>保存</div>';
        translator.attach(dom.document.body as unknown as HTMLElement, dict, "en-US");
        const first = dom.document.createElement("button");
        first.textContent = "保存";
        const second = dom.document.createElement("button");
        second.textContent = "取消";
        dom.document.body.appendChild(first);
        await new Promise((r) => setTimeout(r, 15));
        dom.document.body.appendChild(second);
        await new Promise((r) => setTimeout(r, 15));
        const callbacks = [...pending.values()];
        pending.clear();
        callbacks.forEach((cb) => cb(0));
        expect(first.textContent).toBe("Save");
        expect(second.textContent).toBe("Cancel");
        expect(dom.document.querySelector("span")?.textContent).toBe("Save");
        expect(dom.document.querySelector("img")?.alt).toBe("Save");
        expect(dom.document.querySelector("div")?.textContent).toBe("保存");
        translator.restoreAndDetach();
        expect(dom.document.querySelector("span")?.textContent).toBe("不同原文");
        expect(dom.document.querySelector("img")?.alt).toBe("保存");
    } finally {
        translator.restoreAndDetach();
        names.forEach((name, i) => {
            if (originals[i]) Object.defineProperty(globalThis, name, originals[i]!);
            else Reflect.deleteProperty(globalThis, name);
        });
        await dom.happyDOM.close();
    }
});

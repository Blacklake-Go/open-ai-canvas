import { afterEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { startPluginStateSync, PLUGIN_STATE_CHANGED_EVENT } from "../src/supdance/adapters/plugin-state-sync";

const originals = new Map<string, PropertyDescriptor | undefined>();
let stop: (() => void) | undefined;
afterEach(() => {
    stop?.();
    for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
    }
    originals.clear();
});

test("plugin sync serializes in-flight changes, refreshes on focus, and aborts on disposal", async () => {
    const dom = new Window();
    for (const [key, value] of Object.entries({ window: dom, document: dom.document })) {
        originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        Object.defineProperty(globalThis, key, { configurable: true, value });
    }
    let calls = 0;
    let release: (() => void) | undefined;
    let requestSignal: AbortSignal | undefined;
    stop = startPluginStateSync(async (signal) => {
        requestSignal = signal;
        calls++;
        if (calls === 1) await new Promise<void>((resolve) => { release = resolve; });
    }, 60_000);
    dom.dispatchEvent(new dom.Event(PLUGIN_STATE_CHANGED_EVENT));
    dom.dispatchEvent(new dom.Event(PLUGIN_STATE_CHANGED_EVENT));
    expect(calls).toBe(1);
    release?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls).toBe(2);
    dom.dispatchEvent(new dom.Event("focus"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls).toBe(3);
    stop();
    expect(requestSignal?.aborted).toBe(true);
    dom.dispatchEvent(new dom.Event("focus"));
    expect(calls).toBe(3);
    await dom.happyDOM.abort();
});

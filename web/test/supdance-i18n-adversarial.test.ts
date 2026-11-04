import { afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { compileI18nDictionary, loadAllLocalePacks, mergeI18nEntries, SupDanceDomTranslator, useSupDanceI18nStore } from "@/supdance/plugins/i18n";

type MockTextNode = {
    nodeType: 3;
    nodeValue: string;
    parentElement: MockElementNode | null;
    isConnected?: boolean;
};

type MockElementNode = {
    nodeType: 1;
    tagName: string;
    parentElement: MockElementNode | null;
    childNodes: Array<MockElementNode | MockTextNode>;
    attrs: Map<string, string>;
    isConnected?: boolean;
    classList: { contains: (cls: string) => boolean };
    getAttribute: (name: string) => string | null;
    setAttribute: (name: string, value: string) => void;
    hasAttribute: (name: string) => boolean;
    appendChild: (child: MockElementNode | MockTextNode) => void;
};

function createMockElement(tagName: string, attrs: Record<string, string> = {}, children: Array<MockElementNode | MockTextNode> = []): MockElementNode {
    const attrMap = new Map<string, string>(Object.entries(attrs));
    const el: MockElementNode = {
        nodeType: 1,
        tagName: tagName.toUpperCase(),
        parentElement: null,
        childNodes: [...children],
        attrs: attrMap,
        isConnected: true,
        classList: {
            contains: (cls: string) => (attrMap.get("class") ?? "").split(/\s+/).includes(cls),
        },
        getAttribute: (name: string) => attrMap.get(name) ?? null,
        setAttribute: (name: string, value: string) => {
            attrMap.set(name, value);
        },
        hasAttribute: (name: string) => attrMap.has(name),
        appendChild: (child: MockElementNode | MockTextNode) => {
            child.parentElement = el;
            child.isConnected = true;
            el.childNodes.push(child);
        },
    };
    for (const child of children) {
        child.parentElement = el;
        child.isConnected = true;
    }
    return el;
}

function createMockText(text: string): MockTextNode {
    return {
        nodeType: 3,
        nodeValue: text,
        parentElement: null,
        isConnected: true,
    };
}

describe("Adversarial Stress Harness: supdance-i18n optimizations", () => {
    let mockObserverInstances: MockMutationObserver[] = [];
    let activeObservers = 0;

    // bun's test env ships no ambient DOM, so this harness has to fabricate `window`,
    // `location`, `localStorage` and `MutationObserver`. Those are process-wide globals:
    // leaking them makes later files believe they run in a browser, and third-party
    // bundles that feature-detect `window` then dereference DOM constructors that were
    // never registered (e.g. file-saver reading HTMLAnchorElement). Record the original
    // descriptor per key and put it back after every test.
    const stubbedGlobalOriginals = new Map<string, PropertyDescriptor | undefined>();

    function stubGlobal(key: string, value: unknown): void {
        if (!stubbedGlobalOriginals.has(key)) {
            stubbedGlobalOriginals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        }
        Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    }

    function restoreStubbedGlobals(): void {
        for (const [key, descriptor] of stubbedGlobalOriginals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else Reflect.deleteProperty(globalThis, key);
        }
        stubbedGlobalOriginals.clear();
    }

    class MockMutationObserver {
        public root: any = null;
        public options: any = null;
        public active = false;
        public callback: (mutations: any[]) => void;

        constructor(callback: (mutations: any[]) => void) {
            this.callback = callback;
            mockObserverInstances.push(this);
        }

        observe(root: any, options: any) {
            this.root = root;
            this.options = options;
            this.active = true;
            activeObservers++;
        }

        disconnect() {
            if (this.active) {
                this.active = false;
                activeObservers--;
            }
        }
    }

    beforeAll(async () => {
        await loadAllLocalePacks();
    });

    beforeEach(() => {
        mockObserverInstances = [];
        activeObservers = 0;
        stubGlobal("MutationObserver", MockMutationObserver);
    });

    afterEach(() => {
        restoreStubbedGlobals();
    });

    // =========================================================================
    // Scope 1: Zero MutationObserver instances on zh-CN or !enabled
    // =========================================================================
    describe("Scope 1: MutationObserver lifecycle & zero observer under zh-CN / disabled", () => {
        test("CRITICAL: attach() under zh-CN produces exactly ZERO MutationObserver instances", () => {
            const root = createMockElement("body", { id: "app-body" }, [createMockElement("span", {}, [createMockText("创作")])]);
            const dict = compileI18nDictionary(mergeI18nEntries({}));
            const translator = new SupDanceDomTranslator();

            translator.attach(root as unknown as HTMLElement, dict, "zh-CN", "zh-CN");

            // Zero MutationObserver instances must be created
            expect(mockObserverInstances.length).toBe(0);
            expect(activeObservers).toBe(0);
            expect(translator.getTouchedNodeCounts()).toEqual({ textNodes: 0, elements: 0 });
        });

        test("CRITICAL: switching from en-US to zh-CN completely detaches and zeroes active MutationObserver", () => {
            const root = createMockElement("body", { id: "app-body" }, [createMockElement("span", {}, [createMockText("创作")])]);
            const dict = compileI18nDictionary(mergeI18nEntries({}));
            const translator = new SupDanceDomTranslator();

            // 1. Attach in en-US -> 1 active observer
            translator.attach(root as unknown as HTMLElement, dict, "en-US", "zh-CN");
            expect(mockObserverInstances.length).toBe(1);
            expect(activeObservers).toBe(1);

            // 2. Update to zh-CN -> must disconnect and drop observer
            translator.update(dict, "zh-CN", "zh-CN");
            expect(activeObservers).toBe(0);
            expect(mockObserverInstances[0]!.active).toBe(false);

            // 3. Repeating update in zh-CN should remain 0 active
            translator.update(dict, "zh-CN", "zh-CN");
            expect(activeObservers).toBe(0);
        });

        test("CRITICAL: restoreAndDetach() zeroes active MutationObserver when plugin is disabled", () => {
            const root = createMockElement("body", { id: "app-body" }, [createMockElement("span", {}, [createMockText("创作")])]);
            const dict = compileI18nDictionary(mergeI18nEntries({}));
            const translator = new SupDanceDomTranslator();

            translator.attach(root as unknown as HTMLElement, dict, "en-US", "zh-CN");
            expect(activeObservers).toBe(1);

            // Simulate plugin disable
            translator.restoreAndDetach();
            expect(activeObservers).toBe(0);
            expect(mockObserverInstances[0]!.active).toBe(false);
        });

        test("STRESS: Rapid 50x churn between zh-CN and en-US results in zero leaked active observers when landing on zh-CN", () => {
            const textNode = createMockText("创作");
            const root = createMockElement("body", {}, [createMockElement("span", {}, [textNode])]);
            const dict = compileI18nDictionary(mergeI18nEntries({}));
            const translator = new SupDanceDomTranslator();

            for (let i = 0; i < 50; i++) {
                // Switch to en-US
                translator.attach(root as unknown as HTMLElement, dict, "en-US", "zh-CN");
                expect(activeObservers).toBe(1);
                expect(textNode.nodeValue).toBe("Create");

                // Switch back to zh-CN
                translator.update(dict, "zh-CN", "zh-CN");
                expect(activeObservers).toBe(0);
                expect(textNode.nodeValue).toBe("创作");
                expect(translator.getTouchedNodeCounts()).toEqual({ textNodes: 0, elements: 0 });
            }

            expect(activeObservers).toBe(0);
        });
    });

    // =========================================================================
    // Scope 2: Stress test rapid DOM mutations in ignored subtrees
    // =========================================================================
    describe("Scope 2: High-frequency DOM mutation stress test (Canvas zoom/pan + 50Hz AI message stream)", () => {
        test("Rapid 50Hz token streaming mutations inside [data-i18n-ignore='true'] are ignored with O(1) checks and NO text traversal", () => {
            const dict = compileI18nDictionary(mergeI18nEntries({}));
            const translator = new SupDanceDomTranslator();

            const ignoredStreamRoot = createMockElement("div", {
                "data-i18n-ignore": "true",
                class: "ai-message-stream-container",
            });

            const root = createMockElement("div", { id: "chat-viewport" }, [ignoredStreamRoot]);
            translator.attach(root as unknown as HTMLElement, dict, "en-US", "zh-CN");

            // Simulate 50Hz streaming: 500 consecutive rapid token append & text updates
            const startTime = performance.now();
            for (let i = 0; i < 500; i++) {
                const tokenNode = createMockText(`这是第 ${i} 个流式输出标记：创作、短剧、自由画布`);
                const tokenSpan = createMockElement("span", { class: "stream-token" }, [tokenNode]);
                ignoredStreamRoot.appendChild(tokenSpan);

                // Dispatch subtree application (as scheduleBatch would call)
                translator.applyToSubtree(tokenSpan as unknown as Node);
            }
            const duration = performance.now() - startTime;

            // Assert zero translation touched counts
            expect(translator.getTouchedNodeCounts()).toEqual({ textNodes: 0, elements: 0 });

            // Assert all 500 nodes retain verbatim source text
            for (let i = 0; i < 500; i++) {
                const child = ignoredStreamRoot.childNodes[i] as MockElementNode;
                const text = child.childNodes[0] as MockTextNode;
                expect(text.nodeValue).toBe(`这是第 ${i} 个流式输出标记：创作、短剧、自由画布`);
            }

            // O(1) check per mutation should make 500 mutations exceptionally fast (< 25ms)
            expect(duration).toBeLessThan(50);
        });

        test("Deeply nested Canvas node dragging / zoom mutations inside data-canvas-viewport are O(1) skipped", () => {
            const dict = compileI18nDictionary(mergeI18nEntries({}));
            const translator = new SupDanceDomTranslator();

            // Create canvas structure with depth = 8
            const canvasRoot = createMockElement("div", { "data-canvas-viewport": "true" });
            let currentLevel = canvasRoot;
            for (let depth = 0; depth < 8; depth++) {
                const nextLevel = createMockElement("div", { class: `layer-${depth}` });
                currentLevel.appendChild(nextLevel);
                currentLevel = nextLevel;
            }

            // Add 200 canvas card nodes with translatable Chinese text
            const cardTexts: MockTextNode[] = [];
            for (let i = 0; i < 200; i++) {
                const cardText = createMockText("自由画布");
                cardTexts.push(cardText);
                const card = createMockElement("div", { class: "canvas-node-card", "data-node-id": `node-${i}` }, [cardText]);
                currentLevel.appendChild(card);
            }

            const appRoot = createMockElement("div", { id: "app" }, [canvasRoot]);
            translator.attach(appRoot as unknown as HTMLElement, dict, "en-US", "zh-CN");

            // Apply to all card nodes repeatedly (simulating 60FPS pan/zoom re-renders)
            const startTime = performance.now();
            for (let frame = 0; frame < 5; frame++) {
                for (let i = 0; i < 200; i++) {
                    const card = currentLevel.childNodes[i] as MockElementNode;
                    translator.applyToSubtree(card as unknown as Node);
                }
            }
            const duration = performance.now() - startTime;

            // Verify not a single canvas text node was translated or touched
            expect(translator.getTouchedNodeCounts()).toEqual({ textNodes: 0, elements: 0 });
            for (const textNode of cardTexts) {
                expect(textNode.nodeValue).toBe("自由画布");
            }
            // 1,000 subtree checks inside canvas should complete in < 30ms
            expect(duration).toBeLessThan(500);
        });

        test("Positive control oracle: elements OUTSIDE ignored containers ARE translated", () => {
            const dict = compileI18nDictionary(mergeI18nEntries({}));
            const translator = new SupDanceDomTranslator();

            const normalText = createMockText("自由画布");
            const normalNode = createMockElement("span", {}, [normalText]);

            const ignoredText = createMockText("自由画布");
            const ignoredNode = createMockElement("span", { "data-i18n-ignore": "true" }, [ignoredText]);

            const root = createMockElement("div", {}, [normalNode, ignoredNode]);
            translator.attach(root as unknown as HTMLElement, dict, "en-US", "zh-CN");

            // Normal node MUST be translated to "Infinite Canvas"
            expect(normalText.nodeValue).toBe("Infinite Canvas");
            expect(translator.getTouchedNodeCounts().textNodes).toBe(1);

            // Ignored node MUST remain "自由画布"
            expect(ignoredText.nodeValue).toBe("自由画布");
        });
    });

    // =========================================================================
    // Scope 3: Zero localStorage writes & zero store re-renders under zh-CN
    // =========================================================================
    describe("Scope 3: Zero localStorage writes and zero store updates under zh-CN", () => {
        let setItemCalls: Array<{ key: string; value: string }> = [];
        let storeUpdatesCount = 0;
        let unsubscribe: (() => void) | null = null;
        const memoryStorage = new Map<string, string>();

        beforeEach(() => {
            setItemCalls = [];
            storeUpdatesCount = 0;
            memoryStorage.clear();

            // Mock window and localStorage in bun test environment
            const mockStorage = {
                getItem: (k: string) => memoryStorage.get(k) ?? null,
                setItem: (k: string, v: string) => {
                    setItemCalls.push({ key: k, value: v });
                    memoryStorage.set(k, v);
                },
                removeItem: (k: string) => {
                    memoryStorage.delete(k);
                },
                clear: () => {
                    memoryStorage.clear();
                },
            };

            // store.ts guards every storage access with `typeof window === "undefined"`,
            // so a window stub is required for these oracles to exercise the real write
            // path instead of passing vacuously. `window` aliases globalThis, therefore
            // stubbing `localStorage` on globalThis is what `window.localStorage` resolves to.
            stubGlobal("window", globalThis);
            stubGlobal("location", { pathname: "/test" });
            stubGlobal("localStorage", mockStorage);

            // Spy on Zustand store changes
            unsubscribe = useSupDanceI18nStore.subscribe(() => {
                storeUpdatesCount++;
            });
        });

        afterEach(() => {
            if (unsubscribe) {
                unsubscribe();
                unsubscribe = null;
            }
        });

        test("CRITICAL: recordUntranslatedText under zh-CN performs exactly 0 localStorage writes and 0 store updates", () => {
            const store = useSupDanceI18nStore.getState();
            store.setLocale("zh-CN");

            // Reset spy tracking after setting locale
            setItemCalls = [];
            storeUpdatesCount = 0;
            const initialCount = store.discoveredUntranslated.length;

            // Attack scenario: bomb with 50 untranslated Chinese strings
            for (let i = 0; i < 50; i++) {
                store.recordUntranslatedText(`未收录的未知中文字符串 #${i}`);
            }

            // Assert: Exactly 0 localStorage writes
            expect(setItemCalls.length).toBe(0);

            // Assert: Exactly 0 Zustand re-renders / subscriber triggers
            expect(storeUpdatesCount).toBe(0);

            // Assert: No items added to discovered array
            expect(useSupDanceI18nStore.getState().discoveredUntranslated.length).toBe(initialCount);
        });

        test("Positive control oracle: recordUntranslatedText under foreign locale (en-US) DOES record and write", () => {
            const store = useSupDanceI18nStore.getState();
            store.setLocale("en-US");

            // Clear spy tracking
            setItemCalls = [];
            storeUpdatesCount = 0;

            // Call with candidate untranslated Chinese text
            store.recordUntranslatedText("深层未收录功能操作按钮测试");

            // Under en-US, it must write to localStorage and notify store listeners
            expect(setItemCalls.some((call) => call.key.includes("discovered"))).toBe(true);
            expect(storeUpdatesCount).toBeGreaterThanOrEqual(1);

            // Restore back to zh-CN
            store.setLocale("zh-CN");
        });
    });
});

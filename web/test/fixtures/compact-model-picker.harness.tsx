import { afterAll, expect, test } from "bun:test";
import { Window } from "happy-dom";
import type { PublicChannelModel } from "../../src/services/api/logical-models";

// The component uses a real AntD portal. Install a DOM before loading React DOM or AntD.
const dom = new Window({ url: "http://localhost/toolbox/video" });
for (const key of [
    "document",
    "navigator",
    "localStorage",
    "HTMLElement",
    "HTMLAnchorElement",
    "HTMLBodyElement",
    "HTMLHtmlElement",
    "Element",
    "Node",
    "SVGElement",
    "ShadowRoot",
    "MutationObserver",
    "ResizeObserver",
    "Event",
    "CustomEvent",
    "KeyboardEvent",
] as const) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: dom[key] });
}
Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom },
    __APP_VERSION__: { configurable: true, value: "test" },
    __APP_CHANGELOG__: { configurable: true, value: "" },
    getComputedStyle: { configurable: true, value: dom.getComputedStyle.bind(dom) },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, writable: true, value: true },
});
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { ModelPicker } = await import("../../src/components/model-picker");
const { appQueryClient } = await import("../../src/lib/query-client");
const { apiClient } = await import("../../src/services/api/request");
const { defaultConfig, normalizeConfigSnapshot } = await import("../../src/stores/use-config-store");
const { defaultModelCapabilityConfig } = await import("../../src/lib/model-capabilities");
const { systemChannelModelChannels } = await import("../../src/lib/user-session");
const { compactPublicKey, compactSettingsStorageKey, applyCompactPickerAvailability } = await import("../../src/supdance/plugins/compact-model-picker/settings");

function videoModel(displayName: string, modelKey: string, channelLabel: string): PublicChannelModel {
    return {
        id: modelKey,
        modelKey,
        displayName,
        channelLabel,
        description: "拟真动态电影感",
        icon: "",
        capability: "video",
        protocol: "seedance",
        available: true,
        pricingMode: "provider",
        priceLabel: "",
        capabilityConfig: defaultModelCapabilityConfig("seedance", "seedance-2.0"),
        tags: [{ text: "最具性价比", color: "gold" }],
        priceTiers: [4_900_000, 14_700_000].map((unitPriceMicrocredits, i) => ({
            id: `tier-${i}`,
            selector: { vquality: `${i ? 720 : 480}p` },
            resolution: `${i ? 720 : 480}p`,
            videoSeconds: 0,
            billingMode: "per_second",
            unitPriceMicrocredits,
            inputTokenPriceMicrocredits: 0,
            outputTokenPriceMicrocredits: 0,
            cachedTokenPriceMicrocredits: 0,
        })),
    };
}
const channels = systemChannelModelChannels([
    {
        id: "video",
        name: "平台",
        displayName: "平台",
        models: [videoModel("PixVerse", "pix", "PixVerse 6 文生视频"), videoModel("Sora", "sora", "Sora 标准版"), videoModel("Sora", "sora-pro", "Sora 专业版")],
    },
]);
const config = normalizeConfigSnapshot({ config: { ...defaultConfig, channels, model: "video::pix", videoModel: "video::pix" } }).config;
const settings = { enabled: true, showDescription: true, showPrice: true, showInspirations: false };
const buttons = (selector: string) => Array.from(document.querySelectorAll<HTMLButtonElement>(selector));
const settle = () =>
    act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
    });

for (const cachedEnabled of [undefined, false, true])
    test(`a cold open never paints native rows while the enabled policy is still loading (cache=${cachedEnabled})`, async () => {
        appQueryClient.clear();
        localStorage.removeItem(compactSettingsStorageKey);
        if (cachedEnabled !== undefined) localStorage.setItem(compactSettingsStorageKey, JSON.stringify({ ...settings, enabled: cachedEnabled }));
        let resolveSettings!: (value: unknown) => void;
        const response = new Promise((resolve) => {
            resolveSettings = resolve;
        });
        const original = apiClient.request;
        apiClient.request = (() => response) as typeof apiClient.request;
        const host = document.createElement("div");
        document.body.append(host);
        const root = createRoot(host);
        const paints: boolean[] = [];
        const observer = new MutationObserver(() => {
            const menu = document.querySelector('[role="listbox"]');
            if (menu) paints.push(menu.classList.contains("sd-compact-picker"));
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true });
        try {
            await act(async () => root.render(<ModelPicker config={config} value="video::pix" onChange={() => {}} capability="video" showSelectedPrice={false} showOptionPrices />));
            await act(async () => host.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!.click());
            await settle();
            expect(document.querySelectorAll(".canvas-model-picker-option")).toHaveLength(0);
            expect(document.querySelector(".sd-compact-picker")).not.toBeNull();
            await act(async () => resolveSettings({ status: 200, data: { code: 0, data: settings } }));
            await settle();
            expect(document.querySelectorAll(".sd-picker-option").length).toBeGreaterThan(0);
            expect(paints.length).toBeGreaterThan(0);
            expect(paints.every(Boolean)).toBe(true);
        } finally {
            observer.disconnect();
            resolveSettings({ status: 200, data: { code: 0, data: settings } });
            await act(async () => root.unmount());
            host.remove();
            apiClient.request = original;
            appQueryClient.clear();
        }
    });

async function withPicker(run: (changed: string[]) => Promise<void>, readFails: boolean | "once" = false, quoteCurrent = false, cached?: typeof settings) {
    localStorage.removeItem(compactSettingsStorageKey);
    if (cached) localStorage.setItem(compactSettingsStorageKey, JSON.stringify(cached));
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const changed: string[] = [];
    const reads: string[] = [];
    const original = apiClient.request;
    apiClient.request = (async (request: { method?: string; url?: string; data?: { modelKey?: string } }) => {
        const url = `${request.method?.toUpperCase()} ${request.url}`;
        reads.push(url);
        if (quoteCurrent && url === "POST /model-catalog/quote") {
            expect(request.data?.modelKey).toBe("pix");
            return { status: 200, data: { code: 0, msg: "", data: { quote: { amountMicrocredits: 24_500_000, estimated: true } } } };
        }
        if (readFails === true || (readFails === "once" && reads.length === 1) || url !== "GET /supdance/compact-model-picker/settings") throw new Error("Settings unavailable");
        return { status: 200, data: { code: 0, data: settings, msg: "ok" } };
    }) as typeof apiClient.request;
    try {
        await act(async () =>
            root.render(
                <ModelPicker
                    config={config}
                    value="video::pix"
                    onChange={(model) => changed.push(model)}
                    capability="video"
                    requirements={quoteCurrent ? { videoSeconds: "5" } : undefined}
                    showSelectedPrice={false}
                    showOptionPrices
                    modelDisabledReason={(id) => (id === "video::sora-pro" ? "当前入口不支持" : "")}
                />,
            ),
        );
        await settle();
        await act(async () => buttons('[aria-haspopup="listbox"]')[0].click());
        await settle();
        await run(changed);
        expect(reads).toEqual(
            quoteCurrent
                ? ["GET /supdance/compact-model-picker/settings", "POST /model-catalog/quote"]
                : readFails === "once"
                  ? ["GET /supdance/compact-model-picker/settings", "GET /supdance/compact-model-picker/settings"]
                  : ["GET /supdance/compact-model-picker/settings"],
        );
    } finally {
        await act(async () => root.unmount());
        apiClient.request = original;
        appQueryClient.clear();
        host.remove();
    }
}

test("compact video rows preserve the brand rail, price range, selection identity and disabled reasons", async () => {
    await withPicker(async (changed) => {
        const rail = ".canvas-model-picker-brand-rail button";
        expect(buttons(rail).map((button) => button.querySelector("strong")?.textContent)).toEqual(["PixVerse", "Sora"]);
        const current = buttons('[role="option"]')[0];
        expect(current.getAttribute("aria-selected")).toBe("true");
        expect(current.textContent).toContain("PixVerse 6 文生视频");
        expect(current.textContent).toContain("拟真动态电影感");
        expect(current.textContent).toContain("4.9-14.7 积分/秒");
        expect(current.textContent).not.toContain("最具性价比");
        expect(current.querySelector(".model-picker-availability")).toBeNull();
        await act(async () => buttons(rail)[1].click());
        const [standard, pro] = buttons('[role="option"]');
        expect(pro.disabled).toBe(true);
        expect(pro.textContent).toContain("当前入口不支持");
        await act(async () => {
            pro.click();
            standard.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
        });
        expect(document.activeElement).toBe(standard);
        expect(changed).toEqual([]);
        await act(async () => standard.click());
        expect(changed).toEqual(["video::sora"]);
        expect(buttons('[aria-haspopup="listbox"]')[0].getAttribute("aria-expanded")).toBe("false");
    });
});

test("display preferences can hide the price and description and restore native options", async () => {
    await withPicker(async () => {
        await act(async () => {
            appQueryClient.setQueryData(compactPublicKey, { enabled: true, showPrice: false, showDescription: false });
        });
        await settle();
        const option = () => buttons('[role="option"]')[0];
        expect(option().textContent).toContain("PixVerse 6 文生视频");
        expect(option().textContent).not.toContain("拟真动态电影感");
        expect(option().textContent).not.toContain("积分/秒");
        await act(async () => {
            appQueryClient.setQueryData(compactPublicKey, { ...settings, enabled: false });
        });
        await settle();
        expect(option().textContent).toContain("最具性价比");
        expect(option().textContent).toContain("4.9-14.7 积分/秒");
    });
});

test("only the selected model receives the exact quote for current inputs", async () => {
    await withPicker(
        async () => {
            await settle();
            expect(buttons('[role="option"]')[0].textContent).toContain("24.5 积分");
            await act(async () => buttons(".canvas-model-picker-brand-rail button")[1].click());
            expect(buttons('[role="option"]')[0].textContent).toContain("4.9-14.7 积分/秒");
            expect(buttons('[role="option"]')[0].textContent).not.toContain("24.5");
        },
        false,
        true,
    );
});

test("a confirmed enabled picker survives a fresh query cache and a failed refresh", async () => {
    await withPicker(
        async (changed) => {
            const option = buttons('[role="option"]')[0];
            expect(option.textContent).toContain("PixVerse 6 文生视频");
            expect(document.querySelectorAll(".canvas-model-picker-option")).toHaveLength(0);
            await act(async () => buttons(".canvas-model-picker-brand-rail button")[1].click());
            await act(async () => buttons('[role="option"]')[0].click());
            expect(changed).toEqual(["video::sora"]);
        },
        true,
        false,
        settings,
    );
});

test("an unknown configuration failure exposes retry instead of native mode", async () => {
    await withPicker(async () => {
        expect(document.querySelector('[role="alert"]')).not.toBeNull();
        expect(document.querySelectorAll(".canvas-model-picker-option")).toHaveLength(0);
        expect(document.querySelectorAll(".sd-picker-option")).toHaveLength(0);
        await act(async () => document.querySelector<HTMLButtonElement>('[role="alert"] button')!.click());
        await settle();
        expect(document.querySelectorAll(".sd-picker-option").length).toBeGreaterThan(0);
        expect(document.querySelectorAll(".canvas-model-picker-option")).toHaveLength(0);
    }, "once");
});

test("an acknowledged enablement cannot be overwritten by an older pending disabled read", async () => {
    appQueryClient.clear();
    localStorage.removeItem(compactSettingsStorageKey);
    let resolve!: (value: unknown) => void;
    const pending = new Promise((r) => {
        resolve = r;
    });
    const original = apiClient.request;
    apiClient.request = (() => pending) as typeof apiClient.request;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
        await act(async () => root.render(<ModelPicker config={config} value="video::pix" onChange={() => {}} capability="video" showSelectedPrice={false} />));
        await settle();
        await act(async () => applyCompactPickerAvailability(true));
        await act(async () => resolve({ status: 200, data: { code: 0, data: { ...settings, enabled: false } } }));
        await settle();
        expect(appQueryClient.getQueryData<typeof settings>(compactPublicKey)?.enabled).toBe(true);
        expect(JSON.parse(localStorage.getItem(compactSettingsStorageKey)!).enabled).toBe(true);
        await act(async () => host.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!.click());
        await settle();
        expect(document.querySelector(".sd-compact-picker")).not.toBeNull();
        expect(document.querySelectorAll(".canvas-model-picker-option")).toHaveLength(0);
    } finally {
        resolve({ status: 200, data: { code: 0, data: settings } });
        await act(async () => root.unmount());
        host.remove();
        apiClient.request = original;
        appQueryClient.clear();
    }
});

test("platform toggles persist immediately and synchronize acknowledged settings across tabs", async () => {
    await withPicker(async () => {
        await act(async () => applyCompactPickerAvailability(false));
        await settle();
        expect(document.querySelectorAll(".canvas-model-picker-option").length).toBeGreaterThan(0);
        await act(async () => applyCompactPickerAvailability(true));
        await settle();
        expect(document.querySelectorAll(".canvas-model-picker-option")).toHaveLength(0);
        expect(JSON.parse(localStorage.getItem(compactSettingsStorageKey)!).enabled).toBe(true);
        await act(async () => window.dispatchEvent(new dom.StorageEvent("storage", { key: compactSettingsStorageKey, newValue: JSON.stringify({ ...settings, showPrice: false }) })));
        await settle();
        expect(document.querySelector(".sd-picker-option")?.textContent).not.toContain("积分");
    });
});

afterAll(async () => {
    await dom.happyDOM.abort();
});

await import("./compact-picker-admin-case");
await import("./compact-picker-music-case");
await import("./site-compliance-footer-case");

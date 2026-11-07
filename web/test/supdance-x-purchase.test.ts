import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { Window } from "happy-dom";
import type { PaymentOrder } from "@/services/api/payments";
import { loadXPixel, marketingConsent, MARKETING_CONSENT_KEY, purchaseValues, safePixelLocation, setMarketingConsent, trackXPurchase } from "@/supdance/marketing/x-purchase";

const order: PaymentOrder = {
    id: "confirmed-order-uuid",
    merchantOrderNo: "private-order-no",
    productId: "product",
    productName: "credits",
    productKind: "credits",
    providerId: "alipay-page-pay",
    amountFen: 143,
    currency: "CNY",
    creditsMicrocredits: 100_000_000,
    status: "credited",
    checkout: { mode: "" },
    creditedAt: "2026-11-07T15:25:00Z",
    createdAt: "2026-11-07T15:24:00Z",
    updatedAt: "2026-11-07T15:25:00Z",
    expiresAt: "2026-11-07T16:00:00Z",
};
const now = Date.parse("2026-11-07T16:00:00Z");

describe("server-confirmed purchase eligibility", () => {
    test("uses exact minor units and actual currency", () => {
        expect(purchaseValues(order, now)).toEqual({ value: 1.43, currency: "CNY" });
        expect(purchaseValues({ ...order, currency: "USD", amountFen: 1001 }, now)).toEqual({ value: 10.01, currency: "USD" });
    });
    test("pending, failed, closed, sandbox, old, invalid and future orders never count", () => {
        for (const status of ["created", "pending", "closing", "closed", "create_failed"] as const) expect(purchaseValues({ ...order, status }, now)).toBeNull();
        for (const providerId of ["waffo-enterprise", "waffo-pancake", "unknown"]) expect(purchaseValues({ ...order, providerId }, now)).toBeNull();
        for (const amountFen of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) expect(purchaseValues({ ...order, amountFen }, now)).toBeNull();
        for (const createdAt of ["invalid", "2026-11-01T00:00:00Z", "2026-11-08T00:00:00Z"]) expect(purchaseValues({ ...order, createdAt }, now)).toBeNull();
        expect(purchaseValues({ ...order, creditedAt: undefined }, now)).toBeNull();
        expect(purchaseValues({ ...order, currency: "JPY" }, now)).toBeNull();
    });
    test("does not initialize measurement on admin, authentication or other hosts", () => {
        const safe = { hostname: "www.supdance.com", pathname: "/", search: "?utm_source=x&twclid=ad-click", hash: "" };
        expect(safePixelLocation(safe)).toBe(true);
        for (const pathname of ["/admin", "/admin/payments", "/auth/callback"]) expect(safePixelLocation({ ...safe, pathname })).toBe(false);
        expect(safePixelLocation({ ...safe, hostname: "localhost" })).toBe(false);
    });
});

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
let dom: Window;
beforeEach(() => {
    dom = new Window({ url: "https://www.supdance.com/" });
    Object.defineProperties(globalThis, { window: { value: dom, configurable: true }, document: { value: dom.document, configurable: true }, localStorage: { value: dom.localStorage, configurable: true } });
});
afterEach(() => {
    for (const [key, descriptor] of [
        ["window", originalWindow],
        ["document", originalDocument],
        ["localStorage", originalStorage],
    ] as const) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
    }
    void dom.happyDOM.abort();
});

test("no consent means no third-party script or purchase transmission", async () => {
    expect(await loadXPixel()).toBe(false);
    expect(await trackXPurchase(order)).toBe(false);
    expect(dom.document.querySelectorAll("script")).toHaveLength(0);
    setMarketingConsent(false);
    expect(dom.localStorage.getItem(MARKETING_CONSENT_KEY)).toBe("declined");
});

test("confirmed payment sends currency, value and hashed dedup ID once; withdrawal stops new orders", async () => {
    setMarketingConsent(true);
    expect(marketingConsent()).toBe(true);
    expect(safePixelLocation(window.location)).toBe(true);
    // Exercise the application bridge without making vendor network calls.
    let bridge: HTMLIFrameElement | undefined;
    let bridgeURL = "";
    const originalAppend = document.body.append.bind(document.body);
    const append = spyOn(document.body, "append").mockImplementation((node) => {
        bridge = node as HTMLIFrameElement;
        bridgeURL = bridge.src;
        bridge.src = "about:blank";
        originalAppend(bridge);
    });
    const pending = loadXPixel();
    expect(bridgeURL).toBe("https://www.supdance.com/supdance-x-measurement.html");
    const post = spyOn(bridge!.contentWindow!, "postMessage").mockImplementation(() => {});
    dom.dispatchEvent(new dom.MessageEvent("message", { origin: "https://www.supdance.com", source: bridge!.contentWindow as never, data: { source: "supdance-x-pixel", type: "ready" } }));
    append.mockRestore();
    expect(await pending).toBe(true);
    const liveOrder = { ...order, createdAt: new Date().toISOString() };
    expect(await trackXPurchase(liveOrder)).toBe(true);
    expect(await trackXPurchase(liveOrder)).toBe(false);
    const queue = post.mock.calls;
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject([{ source: "supdance-marketing", type: "purchase", value: 1.43, currency: "CNY", conversion_id: expect.stringMatching(/^[0-9a-f]{64}$/) }, "https://www.supdance.com"]);
    expect(JSON.stringify(queue)).not.toContain(order.id);
    expect(JSON.stringify(queue)).not.toContain(order.merchantOrderNo);
    setMarketingConsent(false);
    expect(await trackXPurchase({ ...liveOrder, id: "different-order" })).toBe(false);
    expect(queue).toHaveLength(1);
    expect(document.querySelector("iframe")).toBeNull();
    post.mockRestore();
});

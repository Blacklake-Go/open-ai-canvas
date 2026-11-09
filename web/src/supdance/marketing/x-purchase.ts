import type { PaymentOrder } from "@/services/api/payments";

export const X_PIXEL_ID = "rinhf";
export const X_PURCHASE_EVENT_ID = "tw-rinhf-rinl3";
export const MARKETING_CONSENT_KEY = "supdance:marketing-consent:v1";
const SENT_KEY = "supdance:x-purchases:v1";
// Only the existing live Alipay/WeChat integrations are admitted. Waffo sandbox
// orders must never train the production Purchase event.
const LIVE_PROVIDERS = new Set(["alipay-page-pay", "wechat-native"]);
const STARTED_AT = Date.parse("2026-11-07T15:21:00Z");
let loading: Promise<boolean> | undefined;
let frame: HTMLIFrameElement | undefined;
let cancelLoad: (() => void) | undefined;

export function marketingConsent(): boolean {
    try {
        return localStorage.getItem(MARKETING_CONSENT_KEY) === "accepted";
    } catch {
        return false;
    }
}

export function setMarketingConsent(accepted: boolean) {
    try {
        localStorage.setItem(MARKETING_CONSENT_KEY, accepted ? "accepted" : "declined");
    } catch {
        // Without a persistent choice we keep tracking disabled.
    }
    if (!accepted) {
        cancelLoad?.();
        frame?.remove();
        frame = undefined;
        loading = undefined;
    }
}

export function safePixelLocation(location: Pick<Location, "hostname" | "pathname" | "search" | "hash">): boolean {
    return location.hostname === "www.supdance.com" && !location.pathname.startsWith("/admin") && !location.pathname.startsWith("/auth/");
}

export function purchaseValues(order: PaymentOrder, now = Date.now()): { value: number; currency: string } | null {
    const created = Date.parse(order.createdAt);
    if (order.status !== "credited" || !order.creditedAt || !order.id || !LIVE_PROVIDERS.has(order.providerId)) return null;
    if (!Number.isFinite(created) || created < STARTED_AT || created > now || now - created > 30 * 86400_000) return null;
    if (!Number.isSafeInteger(order.amountFen) || order.amountFen <= 0 || !["CNY", "USD"].includes(order.currency)) return null;
    return { value: order.amountFen / 100, currency: order.currency };
}

export function loadXPixel(): Promise<boolean> {
    if (!marketingConsent() || !safePixelLocation(window.location)) return Promise.resolve(false);
    if (loading) return loading;
    loading = new Promise((resolve) => {
        const bridge = document.createElement("iframe");
        const url = new URL("/supdance-x-measurement.html", window.location.origin);
        const clickId = new URLSearchParams(window.location.search).get("twclid");
        if (clickId && /^[a-zA-Z0-9_-]{1,512}$/.test(clickId)) url.searchParams.set("twclid", clickId);
        bridge.src = url.href;
        bridge.hidden = true;
        bridge.title = "SupDance measurement";
        bridge.referrerPolicy = "no-referrer";
        frame = bridge;
        let finished = false;
        const finish = (success: boolean) => {
            if (finished) return;
            finished = true;
            cancelLoad = undefined;
            window.clearTimeout(timeout);
            window.removeEventListener("message", receive);
            if (!success) {
                bridge.remove();
                if (frame === bridge) frame = undefined;
                loading = undefined;
            }
            resolve(success);
        };
        const receive = (event: MessageEvent) => {
            if (event.origin !== window.location.origin || event.source !== bridge.contentWindow || event.data?.source !== "supdance-x-pixel") return;
            if (["ready", "error"].includes(event.data.type)) finish(event.data.type === "ready" && marketingConsent());
        };
        const timeout = window.setTimeout(() => finish(false), 15_000);
        cancelLoad = () => finish(false);
        window.addEventListener("message", receive);
        bridge.onerror = () => finish(false);
        document.body.append(bridge);
    });
    return loading;
}

/** Called only with the authenticated server order, never with return-URL flags. */
export async function trackXPurchase(order: PaymentOrder): Promise<boolean> {
    try {
        const values = purchaseValues(order);
        if (!values || !marketingConsent() || !safePixelLocation(window.location)) return false;
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`supdance-purchase:${order.id}`));
        const conversionId = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
        if (!(await loadXPixel()) || !marketingConsent() || !safePixelLocation(window.location)) return false;
        const saved: unknown = JSON.parse(localStorage.getItem(SENT_KEY) || "[]");
        const sent = Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
        if (sent.includes(conversionId)) return false;
        // Local guard + X conversion_id covers repeated polling, reload and tabs.
        localStorage.setItem(SENT_KEY, JSON.stringify([...sent.slice(-199), conversionId]));
        frame!.contentWindow!.postMessage({ source: "supdance-marketing", type: "purchase", ...values, conversion_id: conversionId }, window.location.origin);
        return true;
    } catch {
        // Marketing failure must never change payment confirmation or balances.
        return false;
    }
}

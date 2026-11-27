import type { PaymentOrder } from "@/services/api/payments";

export const MARKETING_CONSENT_KEY = "supdance:marketing-consent:v1";
const SENT_KEY = "supdance:x-purchases:v1";
const SALES_CLICK_KEY = "supdance:x-sales-click:v1";
const SALES_CAMPAIGNS = new Set(["supdance_sales_zh", "supdance_sales_ja", "supdance_sales_202611", "supdance_sales_zh_ja_202611", "canvas_zh_market_202611"]);
const CLICK_ID = /^[a-zA-Z0-9_-]{1,512}$/;
const ATTRIBUTION_WINDOW_MS = 30 * 86_400_000;
// Only the existing live Alipay/WeChat integrations are admitted. Waffo sandbox
// orders must never train the production Purchase event.
const LIVE_PROVIDERS = new Set(["alipay-page-pay", "wechat-native"]);
const STARTED_AT = Date.parse("2026-11-07T15:21:00Z");
let loading: Promise<boolean> | undefined;
let frame: HTMLIFrameElement | undefined;
let frameURL: URL | undefined;
let cancelLoad: (() => void) | undefined;

function resetPixel() {
    cancelLoad?.();
    frame?.remove();
    frame = undefined;
    frameURL = undefined;
    loading = undefined;
}

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
        if (!accepted) localStorage.removeItem(SALES_CLICK_KEY);
    } catch {
        // Without a persistent choice we keep tracking disabled.
    }
    if (!accepted) resetPixel();
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

function measurementURL(location: Location): URL {
    const url = new URL("/supdance-x-measurement.html", location.origin);
    const params = new URLSearchParams(location.search);
    const rawClickId = params.get("twclid") ?? "";
    const clickId = CLICK_ID.test(rawClickId) ? rawClickId : "";
    const isSalesCampaign = params.get("utm_source") === "x" && params.get("utm_medium") === "paid_social" && SALES_CAMPAIGNS.has(params.get("utm_campaign") ?? "");
    const anotherCampaign = !isSalesCampaign && (params.has("utm_campaign") || !!clickId);
    const now = Date.now();
    try {
        if (isSalesCampaign) {
            localStorage.setItem(SALES_CLICK_KEY, JSON.stringify({ clickId, seenAt: now }));
        } else if (anotherCampaign) {
            localStorage.removeItem(SALES_CLICK_KEY);
        }
        const saved: { clickId?: unknown; seenAt?: unknown } | null = JSON.parse(localStorage.getItem(SALES_CLICK_KEY) ?? "null");
        if (saved && typeof saved.seenAt === "number" && now >= saved.seenAt && now - saved.seenAt < ATTRIBUTION_WINDOW_MS) {
            url.searchParams.set("source", "sales");
            if (typeof saved.clickId === "string" && CLICK_ID.test(saved.clickId)) url.searchParams.set("twclid", saved.clickId);
            return url;
        }
    } catch {
        // The landing page can still use its own attribution when storage fails.
    }
    if (isSalesCampaign) url.searchParams.set("source", "sales");
    if (clickId) url.searchParams.set("twclid", clickId);
    return url;
}

export function loadXPixel(): Promise<boolean> {
    if (!marketingConsent() || !safePixelLocation(window.location)) return Promise.resolve(false);
    const url = measurementURL(window.location);
    if (loading && frameURL) {
        const legacyNavigation = !url.search && !frameURL.searchParams.has("source");
        if (frameURL.href === url.href || legacyNavigation) return loading;
        resetPixel();
    }
    loading = new Promise((resolve) => {
        const bridge = document.createElement("iframe");
        bridge.src = url.href;
        bridge.hidden = true;
        bridge.title = "SupDance measurement";
        bridge.referrerPolicy = "no-referrer";
        frame = bridge;
        frameURL = url;
        let finished = false;
        const finish = (success: boolean) => {
            if (finished) return;
            finished = true;
            cancelLoad = undefined;
            window.clearTimeout(timeout);
            window.removeEventListener("message", receive);
            if (!success) {
                bridge.remove();
                frame = undefined;
                frameURL = undefined;
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
        const ready = loadXPixel();
        const destination = frame;
        if (!(await ready) || destination !== frame || !destination?.contentWindow || !marketingConsent() || !safePixelLocation(window.location)) return false;
        const saved: unknown = JSON.parse(localStorage.getItem(SENT_KEY) || "[]");
        const sent = Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
        if (sent.includes(conversionId)) return false;
        // Local guard + X conversion_id covers repeated polling, reload and tabs.
        localStorage.setItem(SENT_KEY, JSON.stringify([...sent.slice(-199), conversionId]));
        destination.contentWindow.postMessage({ source: "supdance-marketing", type: "purchase", ...values, conversion_id: conversionId }, window.location.origin);
        return true;
    } catch {
        // Marketing failure must never change payment confirmation or balances.
        return false;
    }
}

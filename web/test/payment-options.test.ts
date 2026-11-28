import { describe, expect, test } from "bun:test";

import { formatCredits } from "@/constant/credits";
import { estimatePaymentCharge, parsePaymentRateMicros, paymentOptionsFromProviders } from "@/lib/payment-options";
import type { PaymentProvider } from "@/services/api/payments";
import { paymentBrandKey, topupCreditPresentation, walletPaymentIcon } from "@/supdance/wallet-presentation";

const provider = (overrides: Partial<PaymentProvider>): PaymentProvider => ({
    id: "epay",
    pluginId: "official-payment-epay",
    name: "易支付",
    icon: "assets/icon.svg",
    checkoutMode: "redirect",
    enabled: true,
    pluginEnabled: true,
    configured: true,
    closeAfterMinutes: 10,
    ...overrides,
});

describe("wallet checkout presentation", () => {
    test("formats point amounts at most one decimal place", () => {
        expect(formatCredits(1_013_103_358)).toBe("1,013.1");
        expect(formatCredits(1_000_000_000)).toBe("1,000");
        expect(formatCredits(-50_000)).toBe("-0.1");
        expect(formatCredits(-1)).toBe("0");
    });

    test("uses the brand without changing the provider or method identity", () => {
        const [alipay, waffo, wxpay, custom] = paymentOptionsFromProviders([
            provider({ id: "alipay-page-pay", name: "支付宝电脑网站支付" }),
            provider({ id: "waffo-pancake", name: "Waffo Pancake" }),
            provider({ methods: [{ id: "wxpay", name: "微信支付", icon: "brand:wechat-pay" }] }),
            provider({ id: "custom-checkout", name: "Custom Checkout" }),
        ]);

        expect([alipay, waffo, wxpay, custom].map(paymentBrandKey)).toEqual(["alipay", "waffo", "wechat", undefined]);
        expect(walletPaymentIcon(waffo, undefined)).toBe("brand:waffo-wallets");
        expect(walletPaymentIcon(waffo, "wallets")).toBe("brand:waffo-wallets");
        expect(walletPaymentIcon(waffo, "original")).toBe(waffo.icon);
        expect(walletPaymentIcon(wxpay, "wallets")).toBe("brand:wechat-pay");
        expect(waffo).toMatchObject({ key: "waffo-pancake", providerId: "waffo-pancake" });
        expect(wxpay).toMatchObject({ key: "epay:wxpay", providerId: "epay", method: "wxpay" });
    });

    test("shows the recorded gift only when the description matches the granted total", () => {
        const product = {
            kind: "credits" as const,
            name: "轻量包 · 赠 6%",
            description: "基础 5,000 积分 + 赠送 300 积分（+6%）",
            creditsMicrocredits: 5_300_000_000,
        };

        expect(topupCreditPresentation(product)).toEqual({ name: "轻量包", bonusMicrocredits: 300_000_000 });
        expect(topupCreditPresentation({ ...product, creditsMicrocredits: 5_000_000_000 })).toEqual({ name: product.name, bonusMicrocredits: 0 });
        expect(topupCreditPresentation({ ...product, kind: "storage" }).bonusMicrocredits).toBe(0);
        expect(topupCreditPresentation({ ...product, description: undefined }).bonusMicrocredits).toBe(0);
    });
});

describe("paymentOptionsFromProviders", () => {
    test("offers Stripe Checkout as one provider option for the configured currency", () => {
        const [option] = paymentOptionsFromProviders([provider({ id: "stripe", name: "Stripe", icon: "brand:stripe", settlementCurrency: "USD" })]);
        expect(option).toEqual({ key: "stripe", providerId: "stripe", name: "Stripe", icon: "brand:stripe", settlementCurrency: "USD" });
        expect(walletPaymentIcon(option, "wallets")).toBe("brand:stripe");
        expect(estimatePaymentCharge(1000, "CNY", option.settlementCurrency, "7.2")).toEqual({ amountFen: 139, currency: "USD" });
    });

    test("defaults to eligible Stripe with its public name and keeps the correct provider identity", () => {
        const alipay = provider({ id: "alipay-page-pay" });
        const sandbox = provider({ id: "stripe-sandbox", name: "Stripe Sandbox", icon: "brand:stripe", settlementCurrency: "USD" });
        const live = provider({ id: "stripe", name: "Stripe", icon: "brand:stripe", settlementCurrency: "USD" });

        expect(paymentOptionsFromProviders([alipay, sandbox])[0]).toMatchObject({ key: "stripe-sandbox", providerId: "stripe-sandbox", name: "Stripe" });
        expect(paymentOptionsFromProviders([alipay, sandbox, live]).map((option) => option.key)).toEqual(["stripe", "alipay-page-pay"]);
        expect(paymentOptionsFromProviders([alipay])[0].key).toBe("alipay-page-pay");
    });

    test("expands provider methods into individual options", () => {
        const options = paymentOptionsFromProviders([
            provider({
                settlementCurrency: "CNY",
                methods: [
                    { id: "alipay", name: "支付宝", icon: "brand:alipay" },
                    { id: "wxpay", name: "微信支付" },
                ],
            }),
            provider({ id: "wechat-native", name: "微信支付 Native", icon: "brand:wechat-pay" }),
        ]);
        expect(options.map((item) => item.key)).toEqual(["epay:alipay", "epay:wxpay", "wechat-native"]);
        expect(options[0]).toMatchObject({ providerId: "epay", method: "alipay", name: "支付宝", icon: "brand:alipay", settlementCurrency: "CNY" });
        expect(options[2]).toMatchObject({ providerId: "wechat-native", settlementCurrency: "CNY" });
        expect(options[2].method).toBeUndefined();
    });
});

describe("estimatePaymentCharge", () => {
    test("mirrors backend rounding", () => {
        expect(estimatePaymentCharge(999, "USD", "CNY", "7.2")).toEqual({ amountFen: 7193, currency: "CNY" });
        expect(estimatePaymentCharge(1000, "CNY", "USD", "7.2")).toEqual({ amountFen: 139, currency: "USD" });
        expect(estimatePaymentCharge(100_000_000, "USD", "CNY", "10000")).toEqual({ amountFen: 1_000_000_000_000, currency: "CNY" });
        expect(estimatePaymentCharge(500, "CNY", "CNY")).toEqual({ amountFen: 500, currency: "CNY" });
    });

    test("returns null when conversion is impossible", () => {
        expect(estimatePaymentCharge(999, "USD", "CNY", "")).toBeNull();
        expect(estimatePaymentCharge(1, "CNY", "USD", "10000")).toBeNull();
        expect(estimatePaymentCharge(100, "USD", "EUR", "7")).toBeNull();
    });

    test("parses rates like the backend", () => {
        expect(parsePaymentRateMicros("7.123456")).toBe(BigInt(7_123_456));
        expect(parsePaymentRateMicros("0.000001")).toBe(BigInt(1));
        for (const value of ["0", "1e3", "7.1234567", "10000.1", ".5", "-1"]) expect(parsePaymentRateMicros(value)).toBeNull();
    });
});

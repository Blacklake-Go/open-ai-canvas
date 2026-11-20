import type { PaymentOption } from "@/lib/payment-options";
import type { TopupProduct } from "@/services/api/payments";

const PAYMENT_BRAND_KEYS: Record<string, string> = {
    "brand:alipay": "alipay",
    "brand:wechat-pay": "wechat",
    "brand:qq-pay": "qq",
    "brand:usdt": "usdt",
    "alipay-page-pay": "alipay",
    "wechat-native": "wechat",
    "waffo-pancake": "waffo",
    "waffo-enterprise": "waffo",
    "zhifufm-pay": "zhifufm",
    "xunhupay-aggregate": "xunhupay",
    epay: "epay",
};

export function paymentBrandKey(option: PaymentOption): string | undefined {
    const brand = option.icon ? PAYMENT_BRAND_KEYS[option.icon] : undefined;
    return brand ?? (option.method ? undefined : PAYMENT_BRAND_KEYS[option.providerId]);
}

const BONUS_NAME_SUFFIX = /\s*·\s*赠\s*\d+\s*%$/u;
const CREDIT_BREAKDOWN = /^基础\s+([\d,]+)\s+积分\s*\+\s*赠送\s+([\d,]+)\s+积分\s*[（(]\+\d+%[）)]$/u;

export function topupCreditPresentation(product: Pick<TopupProduct, "kind" | "name" | "description" | "creditsMicrocredits">) {
    if (product.kind === "credits") {
        // 已上线的积分套餐把基础积分和赠送积分保存在说明里。仅认可与结算总积分一致的完整明细。
        const breakdown = product.description?.trim().match(CREDIT_BREAKDOWN);
        if (breakdown) {
            const base = Number(breakdown[1].replaceAll(",", ""));
            const bonus = Number(breakdown[2].replaceAll(",", ""));
            if (base > 0 && bonus > 0 && (base + bonus) * 1_000_000 === product.creditsMicrocredits) {
                return { name: product.name.replace(BONUS_NAME_SUFFIX, ""), bonusMicrocredits: bonus * 1_000_000 };
            }
        }
    }
    return { name: product.name, bonusMicrocredits: 0 };
}

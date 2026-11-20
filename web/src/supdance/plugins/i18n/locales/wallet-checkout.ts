import type { AppLocale } from "@/i18n/locales";

export const WALLET_CHECKOUT_NAMESPACE = "supdance-wallet";

const bonusLabels: Record<AppLocale, string> = {
    "zh-CN": "含赠送 {{amount}} 积分",
    "zh-TW": "含贈送 {{amount}} 積分",
    "en-US": "Includes {{amount}} bonus credits",
    "ja-JP": "ボーナス {{amount}} クレジット込み",
    "ko-KR": "보너스 {{amount}} 크레딧 포함",
    "es-ES": "Incluye {{amount}} créditos extra",
    "fr-FR": "Dont {{amount}} crédits offerts",
    "de-DE": "Davon {{amount}} Bonus-Credits",
};

export function walletCheckoutCatalog(locale: AppLocale): Record<string, string> {
    const chinese = locale === "zh-CN" || locale === "zh-TW";
    return {
        bonusIncluded: bonusLabels[locale],
        "brand.alipay": locale === "zh-CN" ? "支付宝" : locale === "zh-TW" ? "支付寶" : "Alipay",
        "brand.wechat": chinese ? "微信支付" : "WeChat Pay",
        "brand.qq": locale === "zh-CN" ? "QQ 钱包" : locale === "zh-TW" ? "QQ 錢包" : "QQ Wallet",
        "brand.usdt": "USDT",
        "brand.waffo": "Waffo",
        "brand.zhifufm": "支付FM",
        "brand.xunhupay": chinese ? "虎皮椒" : "XunhuPay",
        "brand.epay": chinese ? "易支付" : "EPay",
    };
}

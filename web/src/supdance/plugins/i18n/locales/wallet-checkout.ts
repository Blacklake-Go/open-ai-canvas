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

const waffoIconLabels: Record<AppLocale, { label: string; description: string; wallets: string; original: string; saved: string }> = {
    "zh-CN": { label: "充值页支付图标", description: "切换后自动保存，仅影响充值页显示。", wallets: "微信支付和支付宝", original: "原支付图标", saved: "Waffo 支付图标已保存" },
    "zh-TW": { label: "儲值頁付款圖示", description: "切換後自動儲存，僅影響儲值頁顯示。", wallets: "微信支付和支付寶", original: "原付款圖示", saved: "Waffo 付款圖示已儲存" },
    "en-US": { label: "Top-up payment icon", description: "Changes save automatically and apply to the top-up page.", wallets: "WeChat Pay and Alipay", original: "Original payment icon", saved: "Waffo payment icon saved" },
    "ja-JP": { label: "チャージ画面の決済アイコン", description: "変更は自動保存され、チャージ画面に反映されます。", wallets: "WeChat Pay と Alipay", original: "元の決済アイコン", saved: "Waffo の決済アイコンを保存しました" },
    "ko-KR": { label: "충전 페이지 결제 아이콘", description: "변경 사항은 자동 저장되며 충전 페이지에 적용됩니다.", wallets: "WeChat Pay 및 Alipay", original: "기존 결제 아이콘", saved: "Waffo 결제 아이콘이 저장되었습니다" },
    "es-ES": {
        label: "Icono de pago en recargas",
        description: "Los cambios se guardan automáticamente y se aplican a la página de recarga.",
        wallets: "WeChat Pay y Alipay",
        original: "Icono de pago original",
        saved: "Se ha guardado el icono de pago de Waffo",
    },
    "fr-FR": {
        label: "Icône de paiement pour la recharge",
        description: "Les changements sont enregistrés automatiquement et s’appliquent à la page de recharge.",
        wallets: "WeChat Pay et Alipay",
        original: "Icône de paiement d’origine",
        saved: "Icône de paiement Waffo enregistrée",
    },
    "de-DE": {
        label: "Zahlungssymbol auf der Aufladeseite",
        description: "Änderungen werden automatisch gespeichert und auf der Aufladeseite angezeigt.",
        wallets: "WeChat Pay und Alipay",
        original: "Ursprüngliches Zahlungssymbol",
        saved: "Waffo-Zahlungssymbol gespeichert",
    },
};

const waffoIconSaveErrors: Record<AppLocale, string> = {
    "zh-CN": "保存 Waffo 支付图标失败",
    "zh-TW": "儲存 Waffo 付款圖示失敗",
    "en-US": "Could not save the Waffo payment icon",
    "ja-JP": "Waffo の決済アイコンを保存できませんでした",
    "ko-KR": "Waffo 결제 아이콘을 저장하지 못했습니다",
    "es-ES": "No se pudo guardar el icono de pago de Waffo",
    "fr-FR": "Impossible d’enregistrer l’icône de paiement Waffo",
    "de-DE": "Das Waffo-Zahlungssymbol konnte nicht gespeichert werden",
};

export function walletCheckoutCatalog(locale: AppLocale): Record<string, string> {
    const chinese = locale === "zh-CN" || locale === "zh-TW";
    const waffoIcon = waffoIconLabels[locale];
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
        "waffoIcon.label": waffoIcon.label,
        "waffoIcon.description": waffoIcon.description,
        "waffoIcon.wallets": waffoIcon.wallets,
        "waffoIcon.original": waffoIcon.original,
        "waffoIcon.saved": waffoIcon.saved,
        "waffoIcon.saveFailed": waffoIconSaveErrors[locale],
    };
}

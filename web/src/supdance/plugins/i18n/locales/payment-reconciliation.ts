import type { AppLocale } from "@/i18n/locales";
import type { SupDanceI18nEntry } from "../types";

export const PAYMENT_RECONCILIATION_CATALOGS: Record<AppLocale, Record<string, string>> = {
    "zh-CN": { "admin.payment.billUnsupported": "不支持账单对账", "admin.payment.billUnsupportedHint": "该渠道尚未提供账单下载，本次未执行账单核对。订单查单和支付通知仍独立处理。" },
    "en-US": {
        "admin.payment.billUnsupported": "Bills unavailable",
        "admin.payment.billUnsupportedHint": "This channel does not provide bill downloads. No bill reconciliation was performed. Order queries and payment notifications are handled separately.",
    },
    "zh-TW": { "admin.payment.billUnsupported": "不支援帳單對帳", "admin.payment.billUnsupportedHint": "此渠道尚未提供帳單下載，本次未執行帳單核對。訂單查詢與付款通知仍獨立處理。" },
    "ja-JP": { "admin.payment.billUnsupported": "明細照合は未対応", "admin.payment.billUnsupportedHint": "この決済サービスは明細のダウンロードに対応していないため、明細照合は実行されていません。注文照会と決済通知は個別に処理されます。" },
    "ko-KR": { "admin.payment.billUnsupported": "명세서 대사 미지원", "admin.payment.billUnsupportedHint": "이 채널은 명세서 다운로드를 지원하지 않아 대사를 실행하지 않았습니다. 주문 조회와 결제 알림은 별도로 처리됩니다." },
    "es-ES": {
        "admin.payment.billUnsupported": "Extractos no disponibles",
        "admin.payment.billUnsupportedHint": "Este canal no permite descargar extractos. No se realizó la conciliación de extractos. Las consultas de pedidos y las notificaciones de pago se procesan por separado.",
    },
    "fr-FR": {
        "admin.payment.billUnsupported": "Relevés indisponibles",
        "admin.payment.billUnsupportedHint": "Ce canal ne permet pas de télécharger les relevés. Aucun rapprochement de relevés n’a été effectué. Les requêtes de commande et les notifications de paiement sont traitées séparément.",
    },
    "de-DE": {
        "admin.payment.billUnsupported": "Abrechnungen nicht verfügbar",
        "admin.payment.billUnsupportedHint": "Dieser Zahlungsanbieter bietet keinen Abrechnungsdownload an. Es wurde kein Abrechnungsabgleich durchgeführt. Bestellabfragen und Zahlungsbenachrichtigungen werden separat verarbeitet.",
    },
};

export const PAYMENT_RECONCILIATION_I18N_ENTRIES: SupDanceI18nEntry[] = Object.keys(PAYMENT_RECONCILIATION_CATALOGS["zh-CN"]).map((key) => ({
    key,
    namespace: "admin",
    sourceText: PAYMENT_RECONCILIATION_CATALOGS["zh-CN"][key],
    origin: "builtin",
    description: "支付账单能力状态",
    translations: Object.fromEntries(Object.entries(PAYMENT_RECONCILIATION_CATALOGS).map(([locale, catalog]) => [locale, catalog[key]])),
}));

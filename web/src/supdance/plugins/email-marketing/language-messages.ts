import type { AppLocale } from "@/i18n/locales";
import { SUPPORTED_LOCALES } from "@/i18n/locales";
import type { SupDanceI18nEntry } from "@/supdance/plugins/i18n/types";

const words = {
    language: ["用户语言", "User language", "使用者語言", "Idioma del usuario", "Langue de l’utilisateur", "Nutzersprache", "ユーザーの言語", "사용자 언어"],
    emailLanguage: ["邮件模板语言", "Email template language", "郵件範本語言", "Idioma de la plantilla", "Langue du modèle d’e-mail", "Sprache der E-Mail-Vorlage", "メールテンプレートの言語", "이메일 템플릿 언어"],
    languageHelp: [
        "账户邮件和已订阅的营销邮件按此语言发送；更改站点语言时会同步保存。",
        "Account emails and subscribed marketing use this language. Changing the site language also saves it.",
        "帳號郵件與已訂閱的行銷郵件依此語言寄送；切換網站語言時也會儲存。",
        "Los correos de la cuenta y de marketing suscrito usan este idioma. Cambiar el idioma del sitio también lo guarda.",
        "Les e-mails du compte et les actualités auxquelles vous êtes abonné utilisent cette langue. Le choix de langue du site est aussi enregistré.",
        "Konto-E-Mails und abonnierte Marketing-E-Mails verwenden diese Sprache. Ein Sprachwechsel auf der Website wird ebenfalls gespeichert.",
        "アカウントメールと購読中のニュースをこの言語で送信します。サイトの言語変更も保存されます。",
        "계정 이메일과 구독한 마케팅 이메일은 이 언어로 발송됩니다. 사이트 언어를 바꾸면 함께 저장됩니다.",
    ],
    saveLanguage: ["保存用户语言", "Save user language", "儲存使用者語言", "Guardar idioma", "Enregistrer la langue", "Nutzersprache speichern", "言語を保存", "사용자 언어 저장"],
    languageSaved: ["用户语言已保存", "User language saved", "已儲存使用者語言", "Idioma guardado", "Langue enregistrée", "Nutzersprache gespeichert", "言語を保存しました", "사용자 언어가 저장되었습니다"],
    languageError: [
        "语言未保存，请重试。",
        "Language was not saved. Please retry.",
        "語言尚未儲存，請重試。",
        "No se guardó el idioma. Inténtalo de nuevo.",
        "La langue n’a pas été enregistrée. Réessayez.",
        "Die Sprache wurde nicht gespeichert. Bitte erneut versuchen.",
        "言語を保存できませんでした。もう一度お試しください。",
        "언어가 저장되지 않았습니다. 다시 시도하세요.",
    ],
    localizedVariables: [
        "各语言运营内容 JSON（周报必填八种语言）",
        "Editorial content by locale, JSON (all eight required for newsletters)",
        "各語言營運內容 JSON（週報須填寫八種語言）",
        "Contenido por idioma, JSON (ocho idiomas para boletines)",
        "Contenu par langue, JSON (huit langues pour les actualités)",
        "Inhalte je Sprache, JSON (alle acht für Newsletter erforderlich)",
        "言語別の運営コンテンツ JSON（ニュースは 8 言語必須）",
        "언어별 운영 콘텐츠 JSON (뉴스레터는 8개 언어 필수)",
    ],
    autoLanguage: [
        "按每位收件人的用户语言发送，模板版本在创建活动时固定。",
        "Send in each recipient’s language, using template versions pinned when the campaign is created.",
        "依每位收件人的使用者語言寄送，建立活動時固定範本版本。",
        "Se envía en el idioma de cada destinatario, con las versiones fijadas al crear la campaña.",
        "Envoi dans la langue de chaque destinataire, avec les versions fixées à la création de la campagne.",
        "Versand in der jeweiligen Empfängersprache mit den bei der Kampagnenerstellung festgelegten Vorlagenversionen.",
        "受信者ごとの言語で送信し、キャンペーン作成時のテンプレート版を使用します。",
        "수신자별 언어로 발송하며 캠페인 생성 시 고정한 템플릿 버전을 사용합니다.",
    ],
} satisfies Record<string, readonly string[]>;

export function languageText(locale: AppLocale, key: keyof typeof words) {
    return words[key][SUPPORTED_LOCALES.findIndex((item) => item.code === locale)];
}
export const EMAIL_LANGUAGE_ENTRIES: SupDanceI18nEntry[] = Object.entries(words).map(([key, values]) => ({
    key: `email.center.${key}`,
    namespace: "admin",
    sourceText: values[0],
    description: "Mail language preference",
    origin: "builtin",
    translations: Object.fromEntries(SUPPORTED_LOCALES.map(({ code }, index) => [code, values[index]])),
}));

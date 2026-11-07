import { PRIVACY_DOC_MAP } from "./legal-i18n-content";
import { LinearLegalPage } from "./linear-legal-page";
import { MarketingPreferencesButton } from "@/supdance/marketing/consent";
import { MARKETING_I18N_ENTRIES } from "@/supdance/marketing/translations";

const marketingLanguages = { en: "en-US", "zh-CN": "zh-CN", "zh-TW": "zh-TW", ja: "ja-JP", ko: "ko-KR", es: "es-ES" } as const;
const privacyWithMeasurement = Object.fromEntries(
    Object.entries(PRIVACY_DOC_MAP).map(([language, doc]) => {
        const locale = marketingLanguages[language as keyof typeof marketingLanguages];
        const copy = (key: string) => MARKETING_I18N_ENTRIES.find((entry) => entry.key === `marketing.${key}`)!.translations[locale];
        return [
            language,
            { ...doc, version: `${doc.version}+measurement.1`, effectiveDate: "2026-11-07", sections: [...doc.sections, { id: "advertising-measurement", title: copy("title"), paragraphs: [copy("description"), "X: https://x.com/en/privacy"] }] },
        ];
    }),
) as typeof PRIVACY_DOC_MAP;

export default function PrivacyPage() {
    return (
        <LinearLegalPage docMap={privacyWithMeasurement} currentSlug="privacy">
            <MarketingPreferencesButton />
        </LinearLegalPage>
    );
}

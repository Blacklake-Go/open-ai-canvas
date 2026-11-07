import { Link } from "react-router";

import { useI18n } from "@/supdance/plugins/i18n";

const centerLabels: Record<string, string> = {
    "zh-CN": "法律中心",
    "zh-TW": "法律中心",
    "en-US": "Legal Center",
    "es-ES": "Centro legal",
    "ja-JP": "法務センター",
    "ko-KR": "법률 센터",
};
const paths = ["/terms", "/privacy", "/aup", "/legal"] as const;
const keys = ["legal.terms", "legal.privacy", "legal.aup"] as const;

export function LegalHeaderNav({ currentPath }: { currentPath: string }) {
    const { locale, t } = useI18n();

    return (
        <nav className="legal-header-nav" aria-label={t("legal.doc_nav_aria")}>
            {paths.map((to, index) => (
                <Link key={to} to={to} aria-current={currentPath === to ? "page" : undefined}>
                    {index < keys.length ? t(keys[index]) : (centerLabels[locale] ?? centerLabels["en-US"])}
                </Link>
            ))}
            <a href="/pricing.html">{t("nav.pricing")}</a>
        </nav>
    );
}

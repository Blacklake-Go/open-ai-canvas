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
const mcpLabels: Record<string, string> = {
    "zh-CN": "MCP 插件",
    "zh-TW": "MCP 外掛",
    "en-US": "MCP & Plugins",
    "es-ES": "MCP y Plugins",
    "ja-JP": "MCP & プラグイン",
    "ko-KR": "MCP 및 플러그인",
};
const paths = ["/terms", "/privacy", "/aup", "/legal", "/mcp"] as const;
const keys = ["legal.terms", "legal.privacy", "legal.aup"] as const;

export function LegalHeaderNav({ currentPath }: { currentPath: string }) {
    const { locale, t } = useI18n();

    return (
        <nav className="legal-header-nav" aria-label={t("legal.doc_nav_aria")}>
            {paths.map((to, index) => {
                let label = "";
                if (index < keys.length) {
                    label = t(keys[index]);
                } else if (to === "/legal") {
                    label = centerLabels[locale] ?? centerLabels["en-US"];
                } else if (to === "/mcp") {
                    label = mcpLabels[locale] ?? mcpLabels["en-US"];
                }
                return (
                    <Link key={to} to={to} aria-current={currentPath === to ? "page" : undefined}>
                        {label}
                    </Link>
                );
            })}
            <a href="/pricing.html">{t("nav.pricing")}</a>
        </nav>
    );
}

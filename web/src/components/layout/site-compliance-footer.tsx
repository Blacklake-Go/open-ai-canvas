import { ExternalLink } from "lucide-react";
import { Link } from "react-router";

import { cn } from "@/lib/utils";
import { useAppearanceStore } from "@/stores/use-appearance-store";
import { useI18n } from "@/supdance/plugins/i18n";

const MIIT_FILING_URL = "https://beian.miit.gov.cn/";

export function SiteComplianceFooter({ className, variant = "default" }: { className?: string; variant?: "default" | "auth" }) {
    const appearance = useAppearanceStore((state) => state.appearance);
    const { t } = useI18n();

    return (
        <footer className={cn("site-compliance-footer", variant === "auth" && "is-auth", className)} aria-label={t("account.layout.footer.label")}>
            <span>{appearance.footerCopyright}</span>
            {/* 收单机构与 GDPR 都要求政策页在未登录状态下从任意页面可达，因此挂在通用页脚而不是只放在登录页。 */}
            <Link to="/terms" target="_blank" rel="noopener noreferrer">
                {t("common.legal_terms", undefined, t("legal.terms", undefined, "服务条款"))}
            </Link>
            <Link to="/privacy" target="_blank" rel="noopener noreferrer">
                {t("common.legal_privacy", undefined, t("legal.privacy", undefined, "隐私政策"))}
            </Link>
            <Link to="/aup" target="_blank" rel="noopener noreferrer">
                {t("common.legal_aup", undefined, t("legal.aup", undefined, "AUP"))}
            </Link>
            {appearance.icpFilingEnabled && appearance.icpFilingNumber ? (
                <a href={MIIT_FILING_URL} target="_blank" rel="noopener noreferrer" aria-label={t("account.layout.footer.icpLink", { number: appearance.icpFilingNumber })}>
                    {appearance.icpFilingNumber}
                    <ExternalLink aria-hidden="true" />
                </a>
            ) : null}
        </footer>
    );
}

import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { useAppearanceStore } from "@/stores/use-appearance-store";

const MIIT_FILING_URL = "https://beian.miit.gov.cn/";

/** Anchors also work in the standalone welcome entry, which has no Router. */
export function SitePolicyLinks() {
    const { t } = useTranslation();
    return (
        <>
            <a href="/terms" target="_blank" rel="noopener noreferrer">
                {t("account.layout.footer.terms")}
            </a>
            <a href="/privacy" target="_blank" rel="noopener noreferrer">
                {t("account.layout.footer.privacy")}
            </a>
            <a href="/aup" target="_blank" rel="noopener noreferrer">
                {t("account.layout.footer.aup")}
            </a>
            <a href="mailto:support@supdance.com">{t("account.layout.footer.support")}</a>
        </>
    );
}

export function SiteComplianceFooter({ className, variant = "default" }: { className?: string; variant?: "default" | "auth" | "workspace" }) {
    const appearance = useAppearanceStore((state) => state.appearance);
    const { t } = useTranslation();

    return (
        <footer className={cn("site-compliance-footer", variant === "auth" && "is-auth", variant === "workspace" && "is-workspace", className)} aria-label={t("account.layout.footer.label")}>
            {variant !== "workspace" ? <span>{appearance.footerCopyright}</span> : null}
            {/* 收单机构与 GDPR 都要求政策页在未登录状态下从任意页面可达，因此挂在通用页脚而不是只放在登录页。 */}
            <SitePolicyLinks />
            {appearance.icpFilingEnabled && appearance.icpFilingNumber ? (
                <a href={MIIT_FILING_URL} target="_blank" rel="noopener noreferrer" aria-label={t("account.layout.footer.icpLink", { number: appearance.icpFilingNumber })}>
                    {appearance.icpFilingNumber}
                    <ExternalLink aria-hidden="true" />
                </a>
            ) : null}
        </footer>
    );
}

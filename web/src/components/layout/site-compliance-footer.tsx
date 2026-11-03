import { ExternalLink } from "lucide-react";
import { Link } from "react-router";

import { cn } from "@/lib/utils";
import { useAppearanceStore } from "@/stores/use-appearance-store";
import { useI18n } from "@/supdance/plugins/i18n";

const MIIT_FILING_URL = "https://beian.miit.gov.cn/";

export function SiteComplianceFooter({ className, variant = "default" }: { className?: string; variant?: "default" | "auth" }) {
    const { t } = useI18n();
    const appearance = useAppearanceStore((state) => state.appearance);

    return (
        <footer className={cn("site-compliance-footer", variant === "auth" && "is-auth", className)} aria-label={t("common.site_compliance_aria")}>
            <span>{appearance.footerCopyright}</span>
            <Link to="/terms">{t("legal.terms")}</Link>
            <Link to="/privacy">{t("legal.privacy")}</Link>
            <Link to="/aup">AUP</Link>
            {appearance.icpFilingEnabled && appearance.icpFilingNumber ? (
                <a href={MIIT_FILING_URL} target="_blank" rel="noopener noreferrer" aria-label={`${appearance.icpFilingNumber}，前往工业和信息化部备案管理系统查询`}>
                    {appearance.icpFilingNumber}
                    <ExternalLink aria-hidden="true" />
                </a>
            ) : null}
        </footer>
    );
}

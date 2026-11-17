import { ExternalLink, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { useAppearanceStore } from "@/stores/use-appearance-store";

const MIIT_FILING_URL = "https://beian.miit.gov.cn/";
const WORKSPACE_FOOTER_DISMISSED_KEY = "supdance:legal-footer:dismissed:v1";
const WORKSPACE_FOOTER_SEEN_KEY = "supdance:legal-footer:seen:v1";

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

    const [dismissed, setDismissed] = useState(() => {
        if (variant !== "workspace") return false;
        try {
            return localStorage.getItem(WORKSPACE_FOOTER_DISMISSED_KEY) === "true" || localStorage.getItem(WORKSPACE_FOOTER_SEEN_KEY) === "true";
        } catch {
            console.warn("Unable to read the legal footer display preference");
            return false;
        }
    });

    useEffect(() => {
        if (variant !== "workspace") return;
        // Keep the first view visible; later mounts and reloads stay hidden.
        try {
            localStorage.setItem(WORKSPACE_FOOTER_SEEN_KEY, "true");
        } catch {
            console.warn("Unable to persist the legal footer first-visit preference");
        }
    }, [variant]);

    if (variant === "workspace" && dismissed) return null;

    return (
        <footer className={cn("site-compliance-footer", variant === "auth" && "is-auth", variant === "workspace" && "is-workspace", className)} aria-label={t("account.layout.footer.label")}>
            {variant !== "workspace" ? <span>{variant === "auth" ? `© ${new Date().getFullYear()} ${appearance.brandName}` : appearance.footerCopyright}</span> : null}
            <SitePolicyLinks />
            {variant !== "auth" && appearance.icpFilingEnabled && appearance.icpFilingNumber ? (
                <a href={MIIT_FILING_URL} target="_blank" rel="noopener noreferrer" aria-label={t("account.layout.footer.icpLink", { number: appearance.icpFilingNumber })}>
                    {appearance.icpFilingNumber}
                    <ExternalLink aria-hidden="true" />
                </a>
            ) : null}
            {variant === "workspace" ? (
                <button
                    type="button"
                    className="site-compliance-footer-dismiss"
                    aria-label={t("account.layout.footer.dismiss")}
                    title={t("account.layout.footer.dismiss")}
                    onClick={() => {
                        setDismissed(true);
                        try {
                            localStorage.setItem(WORKSPACE_FOOTER_DISMISSED_KEY, "true");
                        } catch {
                            console.warn("Unable to persist the legal footer display preference");
                        }
                    }}
                >
                    <X aria-hidden="true" />
                </button>
            ) : null}
        </footer>
    );
}

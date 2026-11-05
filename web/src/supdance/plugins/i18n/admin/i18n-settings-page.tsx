import { useTranslation } from "react-i18next";
import { LanguageOptionGrid } from "@/components/layout/language-menu";
import { AdminPageFrame } from "@/pages/admin/components/admin-shell";

/** Interface language is the upstream device preference, independent of plugin switches. */
export function SupDanceI18nSettingsPage() {
    const { t } = useTranslation();
    return (
        <div data-plugin-scope="i18n">
            <AdminPageFrame title={t("language.label")} description={t("language.description")}>
                <LanguageOptionGrid />
                <p className="mt-4 text-sm text-foreground/60">{t("language.pending")}</p>
            </AdminPageFrame>
        </div>
    );
}

export default SupDanceI18nSettingsPage;

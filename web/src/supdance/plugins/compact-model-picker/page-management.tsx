import { lazy, Suspense } from "react";
import { Spin, Tabs } from "antd";
import { useSearchParams } from "react-router";
import { useI18n } from "@/supdance/plugins/i18n";
import CompactPickerAdmin from "./admin";
import "./page-management.css";

const HtmlPages = lazy(() => import("@/supdance/plugins/html-page-manager/admin/html-page-manager"));
const EmailCenter = lazy(() => import("@/supdance/plugins/email-marketing/admin/email-marketing-manager"));
const InspirationCuration = lazy(() => import("@/supdance/plugins/inspiration-curation/admin"));

export default function PageManagement() {
    const { t } = useI18n();
    const [params, setParams] = useSearchParams();
    const selected = params.get("page");
    const section = selected === "html" || selected === "email" || selected === "inspirations" ? selected : "models";
    return (
        <div className="page-management" data-plugin-scope="supdance-compact-model-picker">
            <div className="page-management-navigation">
                <strong>{t("page.management.title")}</strong>
            </div>
            <Tabs
                className="page-management-tabs"
                destroyOnHidden
                activeKey={section}
                items={[
                    { key: "models", label: t("page.management.models"), children: <CompactPickerAdmin /> },
                    {
                        key: "inspirations",
                        label: t("inspiration.curation.title"),
                        children: (
                            <Suspense fallback={<Spin tip={t("page.management.loading")} />}>
                                <InspirationCuration />
                            </Suspense>
                        ),
                    },
                    {
                        key: "html",
                        label: t("page.management.html"),
                        children: (
                            <Suspense fallback={<Spin tip={t("page.management.loading")} />}>
                                <HtmlPages />
                            </Suspense>
                        ),
                    },
                    {
                        key: "email",
                        label: t("page.management.email"),
                        children: (
                            <Suspense fallback={<Spin tip={t("page.management.loading")} />}>
                                <EmailCenter />
                            </Suspense>
                        ),
                    },
                ]}
                onChange={(key) => {
                    const next = new URLSearchParams(params);
                    next.set("page", key);
                    setParams(next);
                }}
            />
        </div>
    );
}

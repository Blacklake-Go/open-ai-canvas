import { lazy, Suspense } from "react";
import { Spin, Tabs } from "antd";
import { useSearchParams } from "react-router";
import { useI18n } from "@/supdance/plugins/i18n";
import CompactPickerAdmin from "./admin";
import { RequirePlugin } from "@/components/auth/require-plugin";
import "./page-management.css";

const HtmlPages = lazy(() => import("@/supdance/plugins/html-page-manager/admin/html-page-manager"));
const SidebarDockAdmin = lazy(() => import("@/supdance/plugins/html-page-manager/admin/sidebar-dock-manager"));
const EmailCenter = lazy(() => import("@/supdance/plugins/email-marketing/admin/email-marketing-manager"));
const InspirationCuration = lazy(() => import("@/supdance/plugins/inspiration-curation/admin"));

export default function PageManagement() {
    const { t } = useI18n();
    const [params, setParams] = useSearchParams();
    const selected = params.get("page");
    const section = selected === "html" || selected === "email" || selected === "inspirations" || selected === "sidebar-dock" ? selected : "models";
    return (
        <div className="page-management" data-plugin-scope="supdance-compact-model-picker">
            <Tabs
                className="page-management-tabs"
                classNames={{ body: "page-management-tab-body", content: "page-management-tab-panel" }}
                aria-label={t("page.management.title")}
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
                                <RequirePlugin pluginId="supdance-html-page-manager" pluginName={t("page.management.html")}>
                                    <HtmlPages />
                                </RequirePlugin>
                            </Suspense>
                        ),
                    },
                    {
                        key: "email",
                        label: t("page.management.email"),
                        children: (
                            <Suspense fallback={<Spin tip={t("page.management.loading")} />}>
                                <RequirePlugin pluginId="supdance-email-marketing" pluginName={t("page.management.email")}>
                                    <EmailCenter />
                                </RequirePlugin>
                            </Suspense>
                        ),
                    },
                    {
                        key: "sidebar-dock",
                        label: "侧边栏停靠区",
                        children: (
                            <Suspense fallback={<Spin tip={t("page.management.loading")} />}>
                                <RequirePlugin pluginId="supdance-html-page-manager" pluginName="侧边栏停靠区">
                                    <SidebarDockAdmin />
                                </RequirePlugin>
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

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Link, useLocation } from "react-router";

import { TopbarFeedbackButton } from "@/components/feedback/topbar-feedback-button";
import { SystemAnnouncementCenter } from "@/components/layout/system-announcement-center";
import { WorkspaceAccountMenu } from "@/components/layout/workspace-account-menu";
import { WorkspaceCreditGiftMark } from "@/components/layout/workspace-credit-gift-mark";
import { WorkspaceTopBarExtensionSlot } from "@/components/layout/workspace-top-bar-extension";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { useThemeStore } from "@/stores/use-theme-store";
import { useUserStore } from "@/stores/use-user-store";
import { useAppearanceStore } from "@/stores/use-appearance-store";
import { useWalletBalance } from "@/hooks/use-wallet-balance";
import { openWorkspaceWallet } from "@/lib/workspace-wallet";
import { TopbarLanguageSwitcher, useI18n } from "@/supdance/plugins/i18n";

const PAGE_TITLE_KEYS: Record<string, string> = {
    home: "nav.create",
    create: "nav.create",
    projects: "nav.projects",
    canvas: "nav.canvas",
    tasks: "nav.tasks",
    assets: "nav.assets",
    skills: "nav.skills",
    plugins: "nav.plugins",
    settings: "nav.settings",
};

export function WorkspaceTopBar({ sidebarOpen, onToggleSidebar }: { sidebarOpen: boolean; onToggleSidebar: () => void }) {
    const { t } = useI18n();
    const brandName = useAppearanceStore((state) => state.appearance.brandName);
    const theme = useThemeStore((state) => state.theme);
    const setTheme = useThemeStore((state) => state.setTheme);
    const user = useUserStore((state) => state.user);
    const creditsEnabled = useUserStore((state) => state.features.creditsEnabled);
    const { availableMicrocredits } = useWalletBalance(user?.id, creditsEnabled);
    const { pathname } = useLocation();
    const slug = pathname.split("/").filter(Boolean)[0];
    const pageTitleKey = slug ? PAGE_TITLE_KEYS[slug] : PAGE_TITLE_KEYS.home;
    const pageTitle = pageTitleKey ? t(pageTitleKey) : (slug ? slug : brandName);
    const balance = availableMicrocredits === null ? "--" : (availableMicrocredits / 1_000_000).toLocaleString("zh-CN", { maximumFractionDigits: 2 });

    return (
        <header className="app-workspace-topbar">
            <button
                type="button"
                className="app-workspace-mobile-menu app-workspace-topbar-icon-button"
                aria-label={sidebarOpen ? t("nav.collapse_sidebar") : t("nav.expand_sidebar")}
                onClick={onToggleSidebar}
            >
                {sidebarOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
            </button>
            <nav className="app-workspace-topbar-breadcrumb" aria-label={t("nav.current_location")}>
                <Link to="/" className="font-medium text-foreground/65 transition-colors hover:text-foreground">
                    {brandName}
                </Link>
                <span aria-hidden="true">/</span>
                <span className="truncate font-medium text-foreground">{pageTitle}</span>
            </nav>
            <WorkspaceTopBarExtensionSlot />
            <div className="app-workspace-topbar-actions">
                {user ? <TopbarFeedbackButton /> : null}
                {creditsEnabled ? (
                    <button
                        type="button"
                        className="app-workspace-topbar-credit-pill"
                        aria-label={t("nav.credits_aria", { balance })}
                        onClick={() => openWorkspaceWallet()}
                    >
                        <WorkspaceCreditGiftMark />
                        <span>{t("nav.credits")}</span>
                        <strong>{balance}</strong>
                    </button>
                ) : null}
                {user ? <SystemAnnouncementCenter userId={user.id} className="app-workspace-topbar-icon-button" autoOpen /> : null}
                <TopbarLanguageSwitcher surface="workspace" />
                <AnimatedThemeToggler className="app-workspace-topbar-icon-button" theme={theme} onThemeChange={setTheme} aria-label={t("nav.toggle_theme")} />
                <WorkspaceAccountMenu />
            </div>
        </header>
    );
}

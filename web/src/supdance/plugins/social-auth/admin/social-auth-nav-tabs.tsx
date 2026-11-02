import { Link, useLocation } from "react-router";
import { cn } from "@/lib/utils";

export function SocialAuthNavTabs() {
    const location = useLocation();
    const isOperations = location.pathname.includes("/admin/settings/social-auth/operations");

    const tabs = [
        { label: "渠道凭证配置", path: "/admin/settings/social-auth", active: !isOperations },
        { label: "运营控制与大盘", path: "/admin/settings/social-auth/operations", active: isOperations },
    ];

    return (
        <nav className="flex items-center gap-6 border-b border-[var(--admin-border)] mb-4" aria-label="第三方社交登录导航">
            {tabs.map((tab) => (
                <Link
                    key={tab.path}
                    to={tab.path}
                    className={cn("relative pb-2.5 text-xs transition-colors", tab.active ? "text-[var(--admin-text)] border-b-2 border-[var(--admin-text)] font-semibold" : "text-[var(--admin-text-secondary)] hover:text-[var(--admin-text)] font-normal")}
                >
                    {tab.label}
                </Link>
            ))}
        </nav>
    );
}

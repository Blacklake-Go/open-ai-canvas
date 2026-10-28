import { Button } from "antd";
import { ArrowUpRight, Coins, Gift, LogOut, RefreshCw, Settings, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import { useWalletBalance } from "@/hooks/use-wallet-balance";
import { useWorkspaceLogout } from "@/hooks/use-workspace-logout";
import { useUserStore } from "@/stores/use-user-store";
import { useI18n } from "@/supdance/plugins/i18n";
import { UserAvatar } from "./user-avatar";
import "./workspace-account-card.css";

/** 同一账户卡片用于顶部和侧栏；余额与退出均复用真实服务。 */
export function WorkspaceAccountCard({ onWallet, onNavigate }: { onWallet: () => void; onNavigate: () => void }) {
    const { t } = useI18n();
    const user = useUserStore((state) => state.user);
    const creditsEnabled = useUserStore((state) => state.features.creditsEnabled);
    const referralAvailable = useUserStore((state) => state.referralAvailable);
    const { availableMicrocredits, refreshing, refresh } = useWalletBalance(user?.id, creditsEnabled);
    const { handleLogout, loggingOut } = useWorkspaceLogout();
    if (!user) return null;
    return <section className="workspace-account-card" aria-label={t("nav.my_account")}>
        <header className="workspace-account-card-identity">
            <UserAvatar user={user} className="workspace-account-card-avatar" />
            <div><strong>{user.displayName || user.username}</strong><span>@{user.username}</span></div>
            <em>{user.role === "admin" ? t("nav.role_admin") : t("nav.role_creator")}</em>
        </header>
        {creditsEnabled ? <div className="workspace-account-card-wallet">
            <div className="workspace-account-card-balance"><span><Coins />{t("nav.available_credits")}</span><strong>{availableMicrocredits === null ? "—" : (availableMicrocredits / 1_000_000).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}</strong></div>
            {availableMicrocredits === null ? <Button size="small" loading={refreshing} icon={<RefreshCw />} onClick={() => void refresh()}>{t("nav.refresh_balance")}</Button> : <button type="button" onClick={onWallet}>{t("nav.topup_redeem")}<ArrowUpRight /></button>}
        </div> : null}
        <nav className="workspace-account-card-actions" aria-label={t("nav.account_actions")}>
            <Link to="/settings?section=profile" onClick={onNavigate}><Settings /><span>{t("nav.account_settings")}</span><ArrowUpRight /></Link>
            {referralAvailable ? <Link to="/referral" onClick={onNavigate}><Gift /><span>{t("nav.referral_center", undefined, "推广中心")}</span><ArrowUpRight /></Link> : null}
            {user.role === "admin" ? <Link to="/admin" onClick={onNavigate}><ShieldCheck /><span>{t("nav.admin_console")}</span><ArrowUpRight /></Link> : null}
            <Button danger type="text" icon={<LogOut />} loading={loggingOut} onClick={() => void handleLogout()}>{t("nav.logout")}</Button>
        </nav>
    </section>;
}

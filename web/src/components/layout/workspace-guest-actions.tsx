import { LogIn, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AuthLoginLink } from "@/components/auth/auth-login-link";
import { cn } from "@/lib/utils";
import "./workspace-guest-actions.css";

/** Shared guest entries keep the host's modal/page mode and return URL contract. */
export function WorkspaceGuestActions({ compact = false }: { compact?: boolean }) {
    const { t } = useTranslation();
    return (
        <div className={cn("workspace-guest-actions", compact && "is-compact")}>
            <AuthLoginLink
                className="workspace-guest-action workspace-guest-action-login"
                aria-label={t("auth.login.submit")}
                title={t("auth.login.submit")}
            >
                {compact ? <LogIn className="size-4" aria-hidden /> : <span>{t("auth.login.submit")}</span>}
            </AuthLoginLink>
            <AuthLoginLink
                view="register"
                className="workspace-guest-action workspace-guest-action-register"
                aria-label={t("auth.login.toRegister")}
                title={t("auth.login.toRegister")}
            >
                {compact ? <UserPlus className="size-4" aria-hidden /> : <span>{t("auth.login.toRegister")}</span>}
            </AuthLoginLink>
        </div>
    );
}

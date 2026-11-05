import { LogIn, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AuthLoginLink } from "@/components/auth/auth-login-link";
import { cn } from "@/lib/utils";

/** Shared guest entries keep the host's modal/page mode and return URL contract. */
export function WorkspaceGuestActions({ compact = false }: { compact?: boolean }) {
    const { t } = useTranslation();
    const pill = "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
    return (
        <div className={cn("flex gap-2", compact && "flex-col")}>
            <AuthLoginLink className={cn(pill, "border-border bg-background text-foreground hover:bg-muted", compact && "px-0")} aria-label={t("auth.login.submit")} title={t("auth.login.submit")}>
                {compact ? <LogIn className="size-4" aria-hidden /> : t("auth.login.submit")}
            </AuthLoginLink>
            <AuthLoginLink view="register" className={cn(pill, "border-primary bg-primary text-primary-foreground hover:opacity-90", compact && "px-0")} aria-label={t("auth.login.toRegister")} title={t("auth.login.toRegister")}>
                {compact ? <UserPlus className="size-4" aria-hidden /> : t("auth.login.toRegister")}
            </AuthLoginLink>
        </div>
    );
}

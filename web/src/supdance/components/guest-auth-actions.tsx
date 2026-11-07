import { Button } from "antd";
import { useNavigate } from "react-router";

import { cn } from "@/lib/utils";
import { useI18n } from "@/supdance/plugins/i18n";

export function GuestAuthActions({ collapsed = false }: { collapsed?: boolean }) {
    const navigate = useNavigate();
    const { t } = useI18n();

    return (
        <div className={cn("flex items-center gap-2", collapsed && "w-full flex-col")}>
            <Button shape="round" className="min-h-11 min-w-11 px-3" onClick={() => navigate("/login")}>
                {t("auth.login")}
            </Button>
            <Button type="primary" shape="round" className="min-h-11 min-w-11 px-3" onClick={() => navigate("/register")}>
                {t("auth.register")}
            </Button>
        </div>
    );
}

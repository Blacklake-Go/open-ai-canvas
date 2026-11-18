import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { useThemeStore } from "@/stores/use-theme-store";

export function LegalThemeToggler() {
    const { t } = useTranslation();
    const theme = useThemeStore((state) => state.theme);
    const setTheme = useThemeStore((state) => state.setTheme);

    useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle("dark", theme === "dark");
        root.style.colorScheme = theme;
    }, [theme]);

    return <AnimatedThemeToggler className={`legal-theme-toggler ${theme === "dark" ? "is-dark" : "is-light"}`} theme={theme} onThemeChange={setTheme} aria-label={t("shell.toggleTheme")} aria-pressed={theme === "dark"} />;
}

import { useEffect } from "react";

import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { useThemeStore } from "@/stores/use-theme-store";

export function LegalThemeToggler() {
    const theme = useThemeStore((state) => state.theme);
    const setTheme = useThemeStore((state) => state.setTheme);

    useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle("dark", theme === "dark");
        root.style.colorScheme = theme;
    }, [theme]);

    return <AnimatedThemeToggler className={`legal-theme-toggler ${theme === "dark" ? "is-dark" : "is-light"}`} theme={theme} onThemeChange={setTheme} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} />;
}

import { LanguageMenu } from "@/components/layout/language-menu";

type LanguageSwitcherSurface = "workspace" | "auth" | "canvas" | "admin" | "legal";

/** Extension surfaces share the upstream language menu and device preference. */
export function TopbarLanguageSwitcher({ surface = "workspace", className }: { surface?: LanguageSwitcherSurface; className?: string }) {
    return (
        <span data-plugin-scope="i18n" className="inline-flex">
            <LanguageMenu variant={surface === "auth" || surface === "legal" ? "auth" : "topbar"} className={className} updateLanguageQuery={surface === "legal"} />
        </span>
    );
}

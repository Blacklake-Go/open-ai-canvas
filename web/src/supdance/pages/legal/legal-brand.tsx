import { Link } from "react-router";
import { useLocaleStore } from "@/stores/use-locale-store";
import { centerLabels } from "./legal-header-nav";

export function LegalBrand() {
    const locale = useLocaleStore((state) => state.locale);
    return (
        <Link to="/" className="group flex items-center gap-2.5 text-base font-semibold tracking-tight no-underline" aria-label="Supdance">
            <img
                src="/supdance-brand-dark.png"
                alt="Supdance"
                className="hidden dark:block h-7 sm:h-8 w-auto max-w-[155px] object-contain"
            />
            <img
                src="/supdance-brand-light.png"
                alt="Supdance"
                className="block dark:hidden h-7 sm:h-8 w-auto max-w-[155px] object-contain"
            />
            <span className="rounded bg-muted px-2.5 py-1 font-mono text-[var(--fs-label)] tracking-widest text-muted-foreground uppercase">{centerLabels[locale]}</span>
        </Link>
    );
}

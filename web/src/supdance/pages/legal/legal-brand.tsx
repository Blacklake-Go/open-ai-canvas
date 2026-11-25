import { Link } from "react-router";
import { useLocaleStore } from "@/stores/use-locale-store";
import { centerLabels } from "./legal-header-nav";

import { LEGAL_OPERATOR_CONFIG } from "./legal-i18n-content";

export function LegalBrand() {
    const locale = useLocaleStore((state) => state.locale);
    return (
        <Link to="/" className="group flex items-center gap-2.5 text-base font-semibold tracking-tight no-underline">
            <span className="grid size-8 shrink-0 place-items-center rounded-[var(--r-sm)] bg-neutral-950 ring-1 ring-border">
                <img src="/supdance-mark.png" alt="" className="size-[27px] object-contain" />
            </span>
            <span className="font-semibold text-foreground">{LEGAL_OPERATOR_CONFIG.tradeName}</span>
            <span className="rounded bg-muted px-2.5 py-1 font-mono text-[var(--fs-label)] tracking-widest text-muted-foreground uppercase">{centerLabels[locale]}</span>
        </Link>
    );
}

import { Link } from "react-router";

import { LEGAL_OPERATOR_CONFIG } from "./legal-i18n-content";

export function LegalBrand({ badge }: { badge: string }) {
    return (
        <Link to="/" className="group flex items-center gap-2.5 text-base font-semibold tracking-tight no-underline">
            <span className="grid size-8 shrink-0 place-items-center rounded-[var(--r-sm)] bg-black">
                <img src="/supdance-mark.png" alt="" className="size-[27px] object-contain" />
            </span>
            <span className="font-semibold text-black dark:text-white">{LEGAL_OPERATOR_CONFIG.tradeName}</span>
            <span className="rounded bg-black/5 px-2.5 py-2 font-mono text-[11px] tracking-widest text-black/60 uppercase dark:bg-white/10 dark:text-white/60">{badge}</span>
        </Link>
    );
}

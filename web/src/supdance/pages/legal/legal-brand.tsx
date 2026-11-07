import { BrandLogoFrame } from "@/components/brand/brand-logo";
import { Link } from "react-router";

import { LEGAL_OPERATOR_CONFIG } from "./legal-i18n-content";

export function LegalBrand({ badge }: { badge: string }) {
    return (
        <Link to="/" className="group flex items-center gap-2.5 text-base font-semibold tracking-tight no-underline">
            <BrandLogoFrame
                className="grid size-8 shrink-0 place-items-center rounded-[var(--r-sm)]"
                logoClassName="size-5 object-contain"
                alt=""
                fallback={
                    <span className="grid size-8 place-items-center rounded-[var(--r-sm)] bg-black">
                        <img src="/supdance-mark.png" alt="" className="size-6 object-contain" />
                    </span>
                }
            />
            <span className="font-semibold text-black dark:text-white">{LEGAL_OPERATOR_CONFIG.tradeName}</span>
            <span className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[11px] tracking-widest text-black/60 uppercase dark:bg-white/10 dark:text-white/60">{badge}</span>
        </Link>
    );
}

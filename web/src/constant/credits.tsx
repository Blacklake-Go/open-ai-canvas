import type { ComponentProps } from "react";
import { Coins } from "lucide-react";

export { requestCreditCost } from "@/lib/model-pricing";

export function CreditSymbol({ className, ...props }: ComponentProps<"span">) {
    return (
        <span {...props} className={`inline-flex items-center justify-center ${className || ""}`}>
            <Coins className="size-[1em]" strokeWidth={2.2} />
        </span>
    );
}

const creditDisplayFormatter = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 });

export function formatCredits(value: number) {
    return creditDisplayFormatter.format(Math.abs(value) < 50_000 ? 0 : value / 1_000_000);
}

import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 font-medium whitespace-nowrap rounded-full px-2.5 py-0.5 text-label select-none",
  {
    variants: {
      variant: {
        default: "bg-wash text-ink-muted border border-line-subtle",
        accent: "bg-brand-soft text-brand-text border border-brand-line",
        success: "bg-success-soft text-success border border-success-line",
        warning: "bg-warning-soft text-warning border border-warning-line",
        danger: "bg-danger-soft text-danger border border-danger-line",
        info: "bg-info-soft text-info border border-info-line",
        outline: "bg-transparent text-ink-muted border border-line",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function withoutRadiusUtilities(className = "") {
  return String(className)
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !/^!?rounded(?:-|$)/.test(token.slice(token.lastIndexOf(":") + 1)))
    .join(" ");
}

function Badge({ className, variant, children, ...props }) {
  return (
    <span className={cn(badgeVariants({ variant }), withoutRadiusUtilities(className))} {...props}>
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
export default Badge;

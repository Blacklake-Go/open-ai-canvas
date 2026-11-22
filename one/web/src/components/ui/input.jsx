import * as React from "react";
import { cn } from "cn";

function withoutRadiusUtilities(className = "") {
  return String(className)
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !/^!?rounded(?:-|$)/.test(token.slice(token.lastIndexOf(":") + 1)))
    .join(" ");
}

/**
 * KOYO Studio Standard Input Primitive
 * Heights: sm (32px), md (38px), lg (44px)
 */
const Input = React.forwardRef(
  ({ className, type = "text", size = "md", disabled = false, error = false, ...props }, ref) => {
    const sizeClasses = {
      sm: "h-control-sm px-2.5 text-label rounded-xl",
      md: "h-control-md px-3 text-body rounded-xl",
      lg: "h-control-lg px-4 text-body rounded-xl",
    };

    return (
      <input
        ref={ref}
        type={type}
        disabled={disabled}
        aria-invalid={error || undefined}
        className={cn(
          "w-full bg-well text-ink placeholder:text-ink-subtle border border-line transition-[background-color,border-color,box-shadow] duration-fast ease-standard",
          "focus-visible:outline-none focus-visible:border-brand focus-visible:ring-1 focus-visible:ring-brand-ring",
          error && "border-danger focus-visible:border-danger focus-visible:ring-danger-ring",
          disabled && "opacity-45 cursor-not-allowed bg-base",
          sizeClasses[size] || sizeClasses.md,
          withoutRadiusUtilities(className)
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
